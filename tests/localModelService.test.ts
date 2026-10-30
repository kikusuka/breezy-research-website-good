import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLocalChatEndpoint, chatWithLocalModel, listLocalModels, testLocalModelEndpoint, testLocalModelGeneration } from '../src/services/localModelService';

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
  it('lists installed Ollama models by name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [{ name: 'qwen2.5:7b' }, { model: 'llama3.2:latest' }, { name: 'qwen2.5:7b' }, {}],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(listLocalModels('ollama', 'http://localhost:11434')).resolves.toEqual(['qwen2.5:7b', 'llama3.2:latest']);
  });
  it('lists IDs from an OpenAI-compatible models endpoint and sends the optional token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'local/qwen' }, { id: 'llama-local' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(listLocalModels('openai-compatible', 'http://127.0.0.1:1234/v1', 'secret')).resolves.toEqual(['local/qwen', 'llama-local']);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/models', expect.objectContaining({
      method: 'GET', credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
    }));
  });
  it('returns an empty list when the server has no installed models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 })));
    await expect(listLocalModels('ollama', 'http://localhost:11434')).resolves.toEqual([]);
  });
  it('rejects an unrecognized model-list response instead of fabricating model IDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'fake' }] }), { status: 200 })));
    await expect(listLocalModels('openai-compatible', 'http://localhost:1234/v1')).rejects.toThrow(/recognizable model list/i);
  });
  it('sends messages directly to the configured endpoint and reads the OpenAI response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Hello from local.' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithLocalModel({ provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'qwen-local', messages: [{ role: 'user', content: 'Hello' }], apiKey: 'local-token' });
    expect(result.text).toBe('Hello from local.');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:1234/v1/chat/completions', expect.objectContaining({ method: 'POST', credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer local-token' }) }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: 'qwen-local', stream: false });
  });
  it('tests generation with one small request to the selected local model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Hi from local.' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(testLocalModelGeneration({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5:7b' })).resolves.toBe('Hi from local.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'qwen2.5:7b', stream: false, messages: [{ role: 'user', content: 'Reply with a short greeting.' }],
    });
  });
  it('surfaces generation failures instead of reporting a local model as working', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'model not loaded' } }), { status: 404 })));
    await expect(testLocalModelGeneration({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'missing-model' })).rejects.toThrow(/HTTP 404/i);
  });
  it('reports empty model output instead of pretending the request succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(chatWithLocalModel({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5', messages: [{ role: 'user', content: 'Hello' }] })).rejects.toThrow(/no readable assistant text/i);
  });
  it('builds Anthropic Messages URLs from a versioned API base URL', () => {
    expect(buildLocalChatEndpoint('openai-compatible', 'http://127.0.0.1:8080/v1', 'anthropic')).toBe('http://127.0.0.1:8080/v1/messages');
  });
  it('sends Anthropic Messages headers and payload, and extracts text blocks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hello from Anthropic-compatible local.' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await chatWithLocalModel({
      provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:8080/v1', model: 'local-claude',
      messages: [{ role: 'system', content: 'Be concise.' }, { role: 'user', content: 'Hello' }],
      apiKey: 'local-secret', apiFormat: 'anthropic',
    });
    expect(result.text).toBe('Hello from Anthropic-compatible local.');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8080/v1/messages', expect.objectContaining({
      method: 'POST', credentials: 'omit',
      headers: expect.objectContaining({ 'x-api-key': 'local-secret', 'anthropic-version': '2023-06-01' }),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'local-claude', max_tokens: 1024, system: 'Be concise.',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });
  it('uses Anthropic authentication headers when listing compatible models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(listLocalModels('openai-compatible', 'http://127.0.0.1:8080/v1', 'local-secret', 'anthropic')).resolves.toEqual(['local-model']);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8080/v1/models', expect.objectContaining({
      headers: expect.objectContaining({ 'x-api-key': 'local-secret', 'anthropic-version': '2023-06-01' }),
    }));
  });

  it('reports browser network/CORS failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(testLocalModelEndpoint('openai-compatible', 'http://localhost:1234/v1')).rejects.toThrow(/CORS settings/i);
  });
});
