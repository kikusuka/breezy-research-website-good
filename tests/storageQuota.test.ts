import { describe, expect, it } from 'vitest';
import { DEFAULT_STORAGE_LIMIT_BYTES, handleChatPersistenceRequest, storageLimitBytes } from '../src/server-core/chatPersistence';

const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Minimal D1 fake: `rows` answers first(); every bound statement is recorded. */
function fakeDb(rows: (sql: string, values: unknown[]) => unknown) {
  const log: Array<{ sql: string; values: unknown[] }> = [];
  const batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
  const db = {
    prepare(sql: string) {
      const st: any = {
        values: [] as unknown[], sql,
        bind(...values: unknown[]) { this.values = values; log.push({ sql, values }); return this; },
        async first() { return rows(sql, this.values) ?? null; },
        async all() { return { results: [] }; },
        async run() { return { success: true, meta: { changes: 1 } }; },
      };
      return st;
    },
    async batch(statements: any[]) { batches.push(statements.map((s) => ({ sql: s.sql, values: s.values }))); return []; },
  };
  return { db, log, batches };
}

const run = (prompt: string) => new Request('https://example.test/api/chat/conversations/conv_1/runs', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, idempotencyKey: 'k1' }),
});

describe('storage quota', () => {
  it('defaults to 5 MB and accepts a valid override', () => {
    expect(DEFAULT_STORAGE_LIMIT_BYTES).toBe(5 * 1024 * 1024);
    expect(storageLimitBytes({})).toBe(DEFAULT_STORAGE_LIMIT_BYTES);
    expect(storageLimitBytes({ STORAGE_LIMIT_BYTES: '1000' })).toBe(1000);
    expect(storageLimitBytes({ STORAGE_LIMIT_BYTES: 'nope' })).toBe(DEFAULT_STORAGE_LIMIT_BYTES);
  });

  it('reports real usage and whether the account is full', async () => {
    const { db } = fakeDb((sql) => (sql.includes('FROM storage_usage') ? { bytes: 1000 } : null));
    const res = await handleChatPersistenceRequest(new Request('https://example.test/api/chat/storage'), { DB: db as any, STORAGE_LIMIT_BYTES: '1000' }, 'owner', respond);
    const body = await res!.json();
    expect(body).toMatchObject({ ok: true, usedBytes: 1000, limitBytes: 1000, remainingBytes: 0, full: true });
  });

  it('rejects a new message with 413 once the account is full, without writing anything', async () => {
    const { db, batches } = fakeDb((sql) => {
      if (sql.includes('SELECT id, title FROM conversations')) return { id: 'conv_1', title: 'x' };
      if (sql.includes('FROM storage_usage')) return { bytes: 995 };
      return null;
    });
    const res = await handleChatPersistenceRequest(run('hello world'), { DB: db as any, STORAGE_LIMIT_BYTES: '1000' }, 'owner', respond);
    expect(res!.status).toBe(413);
    expect((await res!.json()).code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(batches).toHaveLength(0);
  });

  it('counts the prompt in UTF-8 bytes when it is accepted', async () => {
    const { db, batches } = fakeDb((sql) => {
      if (sql.includes('SELECT id, title FROM conversations')) return { id: 'conv_1', title: 'x' };
      if (sql.includes('RETURNING next_sequence')) return { sequence_no: 0 };
      if (sql.includes('FROM storage_usage')) return { bytes: 0 };
      return null;
    });
    const res = await handleChatPersistenceRequest(run('héllo'), { DB: db as any }, 'owner', respond);
    expect(res!.status).toBe(201);
    const usage = batches[0].find((s) => s.sql.includes('INSERT INTO storage_usage'));
    expect(usage?.values[1]).toBe(6); // 'héllo' is 5 characters, 6 bytes
  });

  it('hard-deletes a conversation and gives its bytes back', async () => {
    const { db, batches } = fakeDb((sql) => (sql.includes('LEFT JOIN chat_messages') ? { id: 'conv_1', bytes: 420 } : null));
    const res = await handleChatPersistenceRequest(new Request('https://example.test/api/chat/conversations/conv_1', { method: 'DELETE' }), { DB: db as any }, 'owner', respond);
    expect((await res!.json())).toMatchObject({ ok: true, freedBytes: 420 });
    const sqls = batches[0].map((s) => s.sql);
    expect(sqls.some((q) => q.startsWith('DELETE FROM conversations'))).toBe(true);
    expect(batches[0].find((s) => s.sql.includes('UPDATE storage_usage'))?.values[0]).toBe(420);
  });

  it('returns 404 when deleting a conversation the account does not own', async () => {
    const { db, batches } = fakeDb(() => null);
    const res = await handleChatPersistenceRequest(new Request('https://example.test/api/chat/conversations/other', { method: 'DELETE' }), { DB: db as any }, 'owner', respond);
    expect(res!.status).toBe(404);
    expect(batches).toHaveLength(0);
  });
});

const syncReq = (body: unknown) => new Request('https://example.test/api/chat/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const msg = (over: Record<string, unknown> = {}) => ({ id: 'msg_aaaaaaaa', role: 'user', content: 'hello', position: 0, createdAt: 1000, ...over });

describe('chat sync', () => {
  it('upserts a turn in one batch and counts the new bytes', async () => {
    const { db, batches } = fakeDb((sql) => (sql.includes('FROM storage_usage') ? { bytes: 10 } : null));
    const res = await handleChatPersistenceRequest(syncReq({ conversationId: 'conv_12345678', messages: [msg(), msg({ id: 'msg_bbbbbbbb', role: 'assistant', content: 'hi there', position: 1 })] }), { DB: db as any }, 'owner', respond);
    expect(res!.status).toBe(200);
    expect(await res!.json()).toMatchObject({ ok: true, conversationId: 'conv_12345678', usedBytes: 10 + 5 + 8 });
    expect(batches).toHaveLength(1);
    expect(batches[0].filter((s) => s.sql.includes('INSERT INTO chat_messages'))).toHaveLength(2);
    expect(batches[0].find((s) => s.sql.includes('INSERT INTO storage_usage'))?.values[1]).toBe(13);
  });

  it('refuses a conversation id owned by someone else without writing', async () => {
    const { db, batches } = fakeDb((sql) => (sql.includes('SELECT owner_uid FROM conversations') ? { owner_uid: 'someone-else' } : null));
    const res = await handleChatPersistenceRequest(syncReq({ conversationId: 'conv_12345678', messages: [msg()] }), { DB: db as any }, 'owner', respond);
    expect(res!.status).toBe(404);
    expect(batches).toHaveLength(0);
  });

  it('returns 413 when the sync would exceed the limit', async () => {
    const { db, batches } = fakeDb((sql) => (sql.includes('FROM storage_usage') ? { bytes: 998 } : null));
    const res = await handleChatPersistenceRequest(syncReq({ conversationId: 'conv_12345678', messages: [msg({ content: 'too long' })] }), { DB: db as any, STORAGE_LIMIT_BYTES: '1000' }, 'owner', respond);
    expect(res!.status).toBe(413);
    expect((await res!.json()).code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(batches).toHaveLength(0);
  });

  it('rejects malformed input', async () => {
    const { db } = fakeDb(() => null);
    for (const body of [{ conversationId: 'x', messages: [] }, { conversationId: 'conv_12345678', messages: [msg({ role: 'system' })] }, { conversationId: 'conv_12345678', messages: [msg({ position: -1 })] }]) {
      const res = await handleChatPersistenceRequest(syncReq(body), { DB: db as any }, 'owner', respond);
      expect(res!.status).toBe(400);
    }
  });
});
