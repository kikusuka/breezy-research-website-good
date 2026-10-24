/**
 * Read JSON payloads from a server-sent-event stream.
 * Handles LF/CRLF separators and flushes the final buffered event at EOF.
 */
export async function* readSseJsonEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const parseBlock = (block: string): any | undefined => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) return undefined;
    try {
      return JSON.parse(data);
    } catch {
      return undefined;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const event = parseBlock(block);
        if (event !== undefined) yield event;
      }
      if (done) break;
    }

    if (buffer.trim()) {
      const event = parseBlock(buffer);
      if (event !== undefined) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
