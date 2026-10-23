import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  streamAnthropicREST,
  streamGeminiREST,
  streamOpenAICompatible,
} from '../src/server-core/providers';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSseResponse(payload: string) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })));
}

describe('provider SSE stream final event handling', () => {
  it('keeps a final Gemini event without a trailing newline', async () => {
    stubSseResponse('data: {"candidates":[{"content":{"parts":[{"text":"final Gemini chunk"}]}}]}');

    await expect(streamGeminiREST({
      apiKey: 'test-key',
      model: 'test-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk: () => {},
    })).resolves.toBe('final Gemini chunk');
  });

  it('keeps a final OpenAI-compatible event without a trailing newline', async () => {
    stubSseResponse('data: {"choices":[{"delta":{"content":"final compatible chunk"}}]}');

    await expect(streamOpenAICompatible({
      endpoint: 'https://provider.example/v1/chat/completions',
      apiKey: 'test-key',
      model: 'test-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk: () => {},
    })).resolves.toBe('final compatible chunk');
  });

  it('keeps a final Anthropic event without a trailing newline', async () => {
    stubSseResponse('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"final Anthropic chunk"}}');

    await expect(streamAnthropicREST({
      apiKey: 'test-key',
      model: 'test-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk: () => {},
    })).resolves.toBe('final Anthropic chunk');
  });
});
