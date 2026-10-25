import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLocalChatEndpoint, chatWithLocalModel, testLocalModelEndpoint } from '../src/services/localModelService';

describe('local model endpoint handling', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('builds Ollama chat URL from its root URL', () => {
    expect(buildLocalChatEndpoint('ollama', 'http://localhost:11434')).toBe('http://localhost:11434/v1/chat/completions');
  });
  it('preserves a custom OpenAI-compatible /v1 base path', () => {
    expect(buildLocalChatEndpoint('openai-compatible', 'http://127.0.0.1:1234/v1/')).toBe('http://127.0.0.1:1234/v1/chat/completions');
  });
  it('does not duplicate an existing chat completions path', () => {
    expect(buildLocalChatEndpoint('openai-compatible', 'https://example.test/v1/chat/completions')).toBe('https://example.test/v1/chat/completions');
  });
  it.each(['file:///tmp/model','ftp://localhost:11434','http://user:pass@localhost:11434','http://localhost:11434/v1?token=secret','http://localhost:11434/v1#fragment'])('rejects unsafe or ambiguous base URL %s', (url) => {
    expect(() => buildLocalChatEndpoint('openai-compatible', url)).toThrow();
  });
  it('sends messages directly to the configured endpoint and reads the OpenAI response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Hello from local.' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithLocalModel({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'qwen-local', messages: [{ role: 'user', content: 'Hello' }], apiKey: 'local-token' });
    expect(result.text).toBe('Hello from local.');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:1234/v1/chat/completions', expect.objectContaining({ method: 'POST', credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer local-token' }) }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: 'qwen-local', stream: false });
  });
  it('reports empty model output instead of pretending the request succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(chatWithLocalModel({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5', messages: [{ role: 'user', content: 'Hello' }] })).rejects.toThrow(/no readable assistant text/i);
  });
  it('reports browser network/CORS failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(testLocalModelEndpoint('openai-compatible', 'http://localhost:1234/v1')).rejects.toThrow(/CORS settings/i);
  });
});
