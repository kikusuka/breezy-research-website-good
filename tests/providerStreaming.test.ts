import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callAgentWithStream,
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


describe('Gemini retry safety after streaming begins', () => {
  it('forwards Gemini chunks to the caller as they arrive', async () => {
    stubSseResponse('data: {"candidates":[{"content":{"parts":[{"text":"visible chunk"}]}}]}\n');
    const onChunk = vi.fn();

    await expect(callAgentWithStream({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'custom-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk,
    })).resolves.toBe('visible chunk');

    expect(onChunk).toHaveBeenCalledWith('visible chunk');
  });

  it('does not retry or switch models after a partial stream has reached the caller', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'data: {"candidates":[{"content":{"parts":[{"text":"partial answer"}]}}]}\n',
        ));
        controller.error(new Error('connection dropped mid-stream'));
      },
    });
    const fetchMock = vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const chunks: string[] = [];

    await expect(callAgentWithStream({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'custom-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk: (chunk) => chunks.push(chunk),
    })).rejects.toThrow('connection dropped mid-stream');

    expect(chunks).toEqual(['partial answer']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
