import { describe, expect, it } from 'vitest';
import { handleChatPersistenceRequest } from '../src/server-core/chatPersistence';

describe('chat persistence', () => {
  it('reports that durable storage is unavailable when no D1 binding exists', async () => {
    const request = new Request('https://example.test/api/chat/conversations', { method: 'GET' });
    const response = await handleChatPersistenceRequest(request, {}, 'owner', (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));

    expect(response?.status).toBe(503);
    const body = await response?.json();
    expect(body.code).toBe('CHAT_PERSISTENCE_UNAVAILABLE');
  });

  it('ignores paths outside the chat persistence API', async () => {
    const request = new Request('https://example.test/api/debate/stream', { method: 'POST' });
    await expect(handleChatPersistenceRequest(request, {}, 'owner', (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))).resolves.toBeNull();
  });
});

  it('uses a stable timestamp-and-id cursor for conversation pagination', async () => {
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        const statement: any = {
          values: [] as unknown[],
          bind(...values: unknown[]) {
            this.values = values;
            prepared.push({ sql, values });
            return this;
          },
          async all() {
            return { results: [{ id: 'conv_b', title: 'Example', created_at: 100, updated_at: 123, last_message_at: 123 }] };
          },
          async first() { return null; },
          async run() { return { success: true, meta: { changes: 1 } }; },
        };
        return statement;
      },
      async batch() { return []; },
    };
    const request = new Request('https://example.test/api/chat/conversations?limit=1&before=123&beforeId=conv_z');
    const response = await handleChatPersistenceRequest(request, { DB: db as any }, 'owner', (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
    const body = await response?.json();

    expect(response?.status).toBe(200);
    expect(prepared[0].sql).toContain('(updated_at < ? OR (updated_at = ? AND id < ?))');
    expect(prepared[0].values).toEqual(['owner', 123, 123, 'conv_z', 1]);
    expect(body.nextCursor).toEqual({ before: 123, beforeId: 'conv_b' });
  });
