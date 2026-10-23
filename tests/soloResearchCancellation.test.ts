import { afterEach, describe, expect, it, vi } from 'vitest';

const { callAgentWithStream } = vi.hoisted(() => ({
  callAgentWithStream: vi.fn(),
}));

vi.mock('../src/server-core/providers', () => ({
  callAgentWithStream,
  sanitizeGeminiModel: (model: string) => model,
}));

import { handleBackendRequest } from '../src/server-core/router';

afterEach(() => {
  vi.clearAllMocks();
});

describe('Solo research cancellation wiring', () => {
  it('passes the incoming request signal to the primary Solo model call', async () => {
    callAgentWithStream.mockResolvedValue('A short Solo answer.');

    const controller = new AbortController();
    const req = new Request('http://localhost:3000/api/debate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: 'Explain a simple test topic.',
        protocol: 'solo',
        selectedRound: 1,
        heartbeatEnabled: false,
        enableSearchGrounding: false,
        keys: { gemini: 'test-key' },
        seats: { architect: { provider: 'gemini', model: 'gemini-2.5-flash' } },
      }),
    });

    await handleBackendRequest(req, {}, 'local-dev');

    await vi.waitFor(() => {
      expect(callAgentWithStream).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });
});
