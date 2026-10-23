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
    let sentPartialChunk = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sentPartialChunk) {
          sentPartialChunk = true;
          controller.enqueue(new TextEncoder().encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"partial answer"}]}}]}\n',
          ));
          return;
        }
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


describe('provider SSE error events', () => {
  it('surfaces a Gemini error payload delivered with HTTP 200', async () => {
    stubSseResponse('data: {"error":{"code":503,"message":"model overloaded"}}');

    await expect(streamGeminiREST({
      apiKey: 'test-key',
      model: 'test-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk: () => {},
    })).rejects.toThrow('Gemini stream error: model overloaded');
  });

  it('surfaces an OpenAI-compatible error payload delivered with HTTP 200', async () => {
    stubSseResponse('data: {"error":{"message":"provider overloaded"}}');

    await expect(streamOpenAICompatible({
      endpoint: 'https://provider.example/v1/chat/completions',
      apiKey: 'test-key',
      model: 'test-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk: () => {},
    })).rejects.toThrow('Provider stream error: provider overloaded');
  });

  it('surfaces Anthropic error events instead of returning a successful partial response', async () => {
    stubSseResponse('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"overloaded"}}\n');

    await expect(streamAnthropicREST({
      apiKey: 'test-key',
      model: 'test-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk: () => {},
    })).rejects.toThrow('Anthropic stream error: overloaded');
  });

  it('does not swallow an error that arrives after a visible Anthropic partial answer', async () => {
    stubSseResponse(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial answer"}}\n' +
      'event: error\ndata: {"type":"error","error":{"message":"stream failed"}}\n',
    );
    const onChunk = vi.fn();

    await expect(streamAnthropicREST({
      apiKey: 'test-key',
      model: 'test-model',
      systemInstruction: '',
      userPrompt: 'test',
      onChunk,
    })).rejects.toThrow('Anthropic stream error: stream failed');

    expect(onChunk).toHaveBeenCalledWith('partial answer');
  });
});
