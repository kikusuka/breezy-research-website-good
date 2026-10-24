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

async function runResearch(body: Record<string, unknown>) {
  const controller = new AbortController();
  const req = new Request('http://localhost:3000/api/debate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify(body),
  });
  const response = await handleBackendRequest(req, {}, 'local-dev');
  const reader = response.body!.getReader();
  const events: any[] = [];
  const drainPromise = (async () => {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const block of decoder.decode(value, { stream: true }).split('\n\n')) {
        const line = block.split('\n').find((part) => part.startsWith('data: '));
        if (line) { try { events.push(JSON.parse(line.slice(6))); } catch { /* ignore partial block */ } }
      }
    }
  })();
  await drainPromise;
  return { response, events, signal: controller.signal };
}

const seats = {
  architect: { provider: 'gemini', model: 'gemini-2.5-flash' },
  skeptic: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  verifier: { provider: 'sambanova', model: 'Qwen2.5-72B-Instruct' },
  arbiter: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
};

describe('Research mode backend routing', () => {
  it('runs Deep through Analyst, Critic, Verifier and Synthesizer using assigned models', async () => {
    callAgentWithStream.mockResolvedValue('A stage response with enough detail to continue.');

    const { events, signal } = await runResearch({
      prompt: 'Explain a simple test topic.', protocol: 'quad', selectedRound: 4,
      enableSearchGrounding: false, keys: { gemini: 'test-key', groq: 'groq-key', sambanova: 'samba-key', anthropic: 'anthropic-key' }, seats,
    });

    await vi.waitFor(() => expect(callAgentWithStream).toHaveBeenCalledTimes(5));
    expect(callAgentWithStream.mock.calls.slice(0, 4).map((call) => call[0].provider)).toEqual(['gemini', 'groq', 'sambanova', 'anthropic']);
    expect(callAgentWithStream.mock.calls.slice(0, 4).map((call) => call[0].model)).toEqual([
      'gemini-2.5-flash', 'llama-3.3-70b-versatile', 'Qwen2.5-72B-Instruct', 'claude-3-5-sonnet-20241022',
    ]);
    expect(callAgentWithStream.mock.calls.every((call) => call[0].signal === signal)).toBe(true);
    expect(events.filter((event) => event.type === 'round_start').map((event) => event.round)).toEqual([1, 2, 3, 4]);
    expect(events.some((event) => event.type === 'complete')).toBe(true);
  });

  it('keeps Solo on one answer-generation call and requires only the Analyst seat', async () => {
    callAgentWithStream.mockResolvedValue('A short Solo answer.');
    const { events } = await runResearch({
      prompt: 'Explain a simple test topic.', protocol: 'solo', selectedRound: 1,
      enableSearchGrounding: false, keys: { gemini: 'test-key' },
      seats: { architect: seats.architect },
    });
    await vi.waitFor(() => expect(callAgentWithStream).toHaveBeenCalledTimes(1));
    expect(events.filter((event) => event.type === 'round_start').map((event) => event.round)).toEqual([1]);
    expect(events.some((event) => event.type === 'complete')).toBe(true);
  });

  it('rejects a missing required seat instead of silently using another model', async () => {
    const { response } = await runResearch({
      prompt: 'A question', protocol: 'trio', selectedRound: 3,
      enableSearchGrounding: false, keys: { gemini: 'test-key' },
      seats: { architect: seats.architect, skeptic: seats.skeptic },
    });
    expect(response.status).toBe(400);
    expect(callAgentWithStream).not.toHaveBeenCalled();
  });
});
