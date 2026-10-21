import { describe, expect, it } from 'vitest';
import { handleChatPersistenceRequest } from '../src/server-core/chatPersistence';

describe('chat persistence', () => {
  it('reports that durable storage is unavailable when no D1 binding exists', async () => {
    const request = new Request('https://example.test/api/chat/conversations', { method: 'GET' });
    const response = await handleChatPersistenceRequest(request, {}, 'owner');

    expect(response?.status).toBe(503);
    const body = await response?.json();
    expect(body.code).toBe('CHAT_PERSISTENCE_UNAVAILABLE');
  });

  it('ignores paths outside the chat persistence API', async () => {
    const request = new Request('https://example.test/api/debate/stream', { method: 'POST' });
    await expect(handleChatPersistenceRequest(request, {}, 'owner')).resolves.toBeNull();
  });
});
