import { describe, expect, it } from 'vitest';
import { readSseJsonEvents } from '../src/services/sseJsonStream';

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('research SSE JSON stream parser', () => {
  it('reads multiple LF-delimited events even when chunks split an event', async () => {
    const events = [];
    for await (const event of readSseJsonEvents(streamFrom(['data: {"type":"round_', 'start"}\n\ndata: {"type":"complete"}\n\n']))) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'round_start' }, { type: 'complete' }]);
  });

  it('accepts CRLF separators', async () => {
    const events = [];
    for await (const event of readSseJsonEvents(streamFrom(['data: {"type":"complete"}\r\n\r\n']))) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'complete' }]);
  });

  it('flushes a final event when the stream closes without a trailing blank line', async () => {
    const events = [];
    for await (const event of readSseJsonEvents(streamFrom(['data: {"type":"complete"}']))) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'complete' }]);
  });

  it('ignores malformed JSON blocks without crashing the stream', async () => {
    const events = [];
    for await (const event of readSseJsonEvents(streamFrom(['data: {bad json}\n\ndata: {"type":"complete"}\n\n']))) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'complete' }]);
  });
});
