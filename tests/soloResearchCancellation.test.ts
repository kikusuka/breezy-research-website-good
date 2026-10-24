import { afterEach, describe, expect, it, vi } from 'vitest';

const { callAgentWithStream, performSearchGrounding, fetchReadableSource } = vi.hoisted(() => ({
  callAgentWithStream: vi.fn(),
  performSearchGrounding: vi.fn(),
  fetchReadableSource: vi.fn(),
}));

vi.mock('../src/server-core/providers', () => ({
  callAgentWithStream,
  sanitizeGeminiModel: (model: string) => model,
}));

vi.mock('../src/server-core/search', () => ({
  performSearchGrounding,
}));

vi.mock('../src/server-core/sourceFetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/server-core/sourceFetch')>();
  return { ...actual, fetchReadableSource };
});

vi.mock('../src/server-core/firebaseAuth', () => ({
  verifyFirebaseIdToken: vi.fn(async () => ({ ok: true, uid: 'test-user' })),
}));

import { handleBackendRequest } from '../src/server-core/router';

afterEach(() => {
  vi.clearAllMocks();
});

function researchRequest(options: { enableSearchGrounding: boolean; protocol?: string }) {
  const controller = new AbortController();
  const req = new Request('http://localhost:3000/api/debate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      prompt: 'Explain a simple test topic.',
      protocol: options.protocol ?? 'solo',
      selectedRound: 4,
      researchMethod: 'comparative',
      heartbeatEnabled: true,
      enableSearchGrounding: options.enableSearchGrounding,
      searchEngine: 'duckduckgo',
      keys: { gemini: 'test-key' },
      seats: {
        architect: { provider: 'gemini', model: 'gemini-2.5-flash' },
        skeptic: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        verifier: { provider: 'sambanova', model: 'Qwen2.5-72B-Instruct' },
        arbiter: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
      },
    }),
  });
  return { req, controller };
}

describe('Single-model research contract', () => {
  it('ignores legacy multi-round requests and makes only one model call', async () => {
    callAgentWithStream.mockResolvedValue('A short Solo answer.');

    const { req, controller } = researchRequest({ enableSearchGrounding: false, protocol: 'quad' });
    const response = await handleBackendRequest(req, {}, 'local-dev');
    const streamText = await response.text();

    expect(callAgentWithStream).toHaveBeenCalledTimes(1);
    expect(callAgentWithStream).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
    const modelCall = callAgentWithStream.mock.calls[0][0];
    expect(modelCall.userPrompt).not.toContain('RESEARCH METHOD: COMPARATIVE');
    expect(modelCall.userPrompt).not.toContain('Method: comparative');
    expect(modelCall.systemInstruction).toContain('Answer first; key evidence; important caveats; practical conclusion.');
    expect(modelCall.systemInstruction).not.toContain('comparative');
    expect(streamText).toContain('"type":"complete"');
  });

  it('uses retrieved page text as grounding while still making only one configured-model call', async () => {
    callAgentWithStream.mockResolvedValue('A grounded Solo answer.');
    performSearchGrounding.mockResolvedValue({
      engine: 'duckduckgo',
      engineName: 'DuckDuckGo Keyless Index',
      query: 'Explain a simple test topic.',
      results: [{
        title: 'Example article',
        url: 'https://example.com/article',
        snippet: 'A short search-result snippet.',
      }],
    });
    fetchReadableSource.mockResolvedValue({
      status: 'retrieved',
      finalUrl: 'https://example.com/article',
      text: 'The retrieved article says the example uses a stable identifier.',
    });

    const { req } = researchRequest({ enableSearchGrounding: true, protocol: 'trio' });
    const response = await handleBackendRequest(req, {}, 'local-dev');
    const streamText = await response.text();

    expect(performSearchGrounding).toHaveBeenCalledTimes(1);
    expect(fetchReadableSource).toHaveBeenCalledWith('https://example.com/article');
    expect(callAgentWithStream).toHaveBeenCalledTimes(1);
    const modelCall = callAgentWithStream.mock.calls[0][0];
    expect(modelCall.provider).toBe('gemini');
    expect(modelCall.model).toBe('gemini-2.5-flash');
    expect(modelCall.userPrompt).toContain('The retrieved article says the example uses a stable identifier.');
    expect(streamText).toContain('"type":"search_grounding"');
    expect(streamText).toContain('"retrievalStatus":"retrieved"');
    expect(streamText).toContain('The retrieved article says the example uses a stable identifier.');
    expect(streamText).toContain('"type":"complete"');
  });

  it('falls back to the real search snippet when page retrieval is unavailable', async () => {
    callAgentWithStream.mockResolvedValue('A snippet-grounded Solo answer.');
    performSearchGrounding.mockResolvedValue({
      engine: 'duckduckgo',
      engineName: 'DuckDuckGo Keyless Index',
      query: 'Explain a simple test topic.',
      results: [{
        title: 'Blocked article',
        url: 'https://example.com/blocked',
        snippet: 'The search result contains the fallback detail.',
      }],
    });
    fetchReadableSource.mockResolvedValue({ status: 'unavailable', reason: 'http_error' });

    const { req } = researchRequest({ enableSearchGrounding: true });
    const response = await handleBackendRequest(req, {}, 'local-dev');
    const streamText = await response.text();

    expect(callAgentWithStream).toHaveBeenCalledTimes(1);
    expect(callAgentWithStream.mock.calls[0][0].userPrompt).toContain(
      'Search snippet only (page text unavailable/not fetched): The search result contains the fallback detail.',
    );
    expect(streamText).toContain('"retrievalStatus":"unavailable"');
    expect(streamText).toContain('The search result contains the fallback detail.');
    expect(streamText).toContain('"type":"complete"');
  });
});
