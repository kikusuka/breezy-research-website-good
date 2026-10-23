import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callAgentWithStream } = vi.hoisted(() => ({
  callAgentWithStream: vi.fn(),
}));

vi.mock('../src/server-core/providers', () => ({ callAgentWithStream }));

import { generateRealEvidenceGraph, summarizeStage } from '../src/server-core/evidence';

function abortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

describe('evidence stage cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the request signal to summarization and does not swallow an abort', async () => {
    const controller = new AbortController();
    callAgentWithStream.mockRejectedValue(abortError());

    await expect(
      summarizeStage('x'.repeat(400), 'Analyst', 'key', {}, 'gemini', 'gemini-2.5-flash', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(callAgentWithStream).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
  });

  it('passes the request signal to evidence extraction and does not convert an abort to an incomplete graph', async () => {
    const controller = new AbortController();
    callAgentWithStream.mockRejectedValue(abortError());

    await expect(
      generateRealEvidenceGraph({
        prompt: 'question',
        finalSynthexis: 'final answer',
        proposalContent: 'proposal',
        critiqueContent: 'critique',
        discoveredSources: [],
        durationMs: 1,
        apiKey: 'key',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(callAgentWithStream).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
  });

  it('does not start summarization when the request is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      summarizeStage('x'.repeat(400), 'Analyst', 'key', {}, 'gemini', 'gemini-2.5-flash', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(callAgentWithStream).not.toHaveBeenCalled();
  });
});
