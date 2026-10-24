import { afterEach, describe, expect, it, vi } from 'vitest';

const { callAgentWithStream } = vi.hoisted(() => ({
  callAgentWithStream: vi.fn(),
}));

vi.mock('../src/server-core/providers', () => ({
  callAgentWithStream,
  sanitizeGeminiModel: (model: string) => model,
}));

vi.mock('../src/server-core/firebaseAuth', () => ({
  verifyFirebaseIdToken: vi.fn(async () => ({ ok: true, uid: 'test-user' })),
}));

import { handleBackendRequest } from '../src/server-core/router';

afterEach(() => {
  vi.clearAllMocks();
});

describe('Single-model research contract', () => {
  it('ignores legacy multi-round requests and makes only one model call', async () => {
    callAgentWithStream.mockResolvedValue('A short Solo answer.');

    const controller = new AbortController();
    const req = new Request('http://localhost:3000/api/debate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: 'Explain a simple test topic.',
        protocol: 'quad',
        selectedRound: 4,
        heartbeatEnabled: true,
        enableSearchGrounding: false,
        keys: { gemini: 'test-key' },
        seats: {
          architect: { provider: 'gemini', model: 'gemini-2.5-flash' },
          skeptic: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
          verifier: { provider: 'sambanova', model: 'Qwen2.5-72B-Instruct' },
          arbiter: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        },
      }),
    });

    const response = await handleBackendRequest(req, {}, 'local-dev');
    const reader = response.body!.getReader();
    const drainPromise = (async () => {
      while (!(await reader.read()).done) {
        // Drain the SSE stream so backpressure does not pause the research task.
      }
    })();

    await vi.waitFor(() => {
      expect(callAgentWithStream).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      );
    });
    await drainPromise;
    expect(callAgentWithStream).toHaveBeenCalledTimes(1);
  });
});
