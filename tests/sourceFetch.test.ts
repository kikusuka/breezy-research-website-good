import { describe, expect, it, vi } from 'vitest';
import { attachSourceFetchResults, fetchReadableSource, validatePublicSourceUrl } from '../src/server-core/sourceFetch';

describe('research source fallback mapping', () => {
  it('attaches retrieved page text and the validated final URL to the matching source', () => {
    const sources = [
      { url: 'https://example.com/start', snippet: 'Original search snippet', retrievalStatus: 'not_attempted' },
      { url: 'https://example.org/blocked', snippet: 'Fallback snippet', retrievalStatus: 'not_attempted' },
    ];
    const mapped = attachSourceFetchResults(sources, [
      { status: 'retrieved', finalUrl: 'https://example.com/final', text: 'Bounded article text' },
      { status: 'unavailable', reason: 'http_error' },
    ]);

    expect(mapped[0]).toMatchObject({
      url: 'https://example.com/start',
      retrievedUrl: 'https://example.com/final',
      pageText: 'Bounded article text',
      retrievalStatus: 'retrieved',
      snippet: 'Original search snippet',
    });
    expect(mapped[1]).toMatchObject({
      url: 'https://example.org/blocked',
      retrievalStatus: 'unavailable',
      snippet: 'Fallback snippet',
    });
    expect(mapped[1]).not.toHaveProperty('pageText');
    expect(mapped[1]).not.toHaveProperty('retrievedUrl');
  });

  it('marks sources outside the bounded fetch batch as not attempted', () => {
    const sources = [
      { url: 'https://example.com/one', snippet: 'One' },
      { url: 'https://example.com/two', snippet: 'Two' },
    ];
    expect(attachSourceFetchResults(sources, [
      { status: 'unavailable', reason: 'timeout' },
    ])).toEqual([
      { ...sources[0], retrievalStatus: 'unavailable' },
      { ...sources[1], retrievalStatus: 'not_attempted' },
    ]);
  });
});

describe('bounded source-page retrieval', () => {
  it('blocks non-web and local/private URLs before making a request', async () => {
    expect(validatePublicSourceUrl('file:///etc/passwd')).toBeNull();
    expect(validatePublicSourceUrl('javascript:alert(1)')).toBeNull();
    expect(validatePublicSourceUrl('http://127.0.0.1/')).toBeNull();
    expect(validatePublicSourceUrl('http://10.0.0.2/')).toBeNull();
    expect(validatePublicSourceUrl('http://[::1]/')).toBeNull();
    expect(validatePublicSourceUrl('http://[fd00::1]/')).toBeNull();
    expect(validatePublicSourceUrl('http://[fe80::1]/')).toBeNull();
    expect(validatePublicSourceUrl('http://[ff02::1]/')).toBeNull();
    expect(validatePublicSourceUrl('http://192.0.2.1/')).toBeNull();
    expect(validatePublicSourceUrl('http://service.local/')).toBeNull();
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await fetchReadableSource('http://127.0.0.1/', fetchImpl);
    expect(result).toMatchObject({ status: 'unavailable', reason: 'blocked_url' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('extracts readable text while stripping scripts and navigation markup', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      '<html><nav>menu</nav><main><h1>Useful title</h1><p>Readable &amp; useful text.</p><script>secret()</script></main></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )) as unknown as typeof fetch;
    const result = await fetchReadableSource('https://example.com/page', fetchImpl);
    expect(result.status).toBe('retrieved');
    expect(result.text).toContain('Useful title');
    expect(result.text).toContain('Readable & useful text.');
    expect(result.text).not.toContain('secret()');
    expect(result.text).not.toContain('menu');
  });

  it('validates each redirect and refuses a redirect to a private address', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'http://192.168.1.10/admin' },
    })) as unknown as typeof fetch;
    const result = await fetchReadableSource('https://example.com/redirect', fetchImpl);
    expect(result).toMatchObject({ status: 'unavailable', reason: 'blocked_redirect' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows a bounded public redirect and reads the final page', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/article' } }))
      .mockResolvedValueOnce(new Response('Article text', { status: 200, headers: { 'content-type': 'text/plain' } })) as unknown as typeof fetch;
    const result = await fetchReadableSource('https://example.com/start', fetchImpl);
    expect(result).toMatchObject({
      status: 'retrieved',
      finalUrl: 'https://example.com/article',
      text: 'Article text',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported content types and oversized declared bodies', async () => {
    const unsupported = await fetchReadableSource('https://example.com/file.pdf', (async () =>
      new Response('%PDF', { status: 200, headers: { 'content-type': 'application/pdf' } })) as typeof fetch);
    expect(unsupported).toMatchObject({ status: 'unavailable', reason: 'unsupported_content_type' });

    const oversized = await fetchReadableSource('https://example.com/large', (async () =>
      new Response('x', { status: 200, headers: { 'content-type': 'text/plain', 'content-length': '600000' } })) as typeof fetch);
    expect(oversized).toMatchObject({ status: 'unavailable', reason: 'body_too_large' });
  });

  it('stops reading a streamed body once it exceeds the byte cap', async () => {
    const oversizedBody = 'x'.repeat(512 * 1024 + 1);
    const fetchImpl = (async () => new Response(oversizedBody, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })) as typeof fetch;
    const result = await fetchReadableSource('https://example.com/streamed-large', fetchImpl);
    expect(result).toMatchObject({ status: 'unavailable', reason: 'body_too_large' });
  });

  it('returns an unavailable result when the fetch fails or times out', async () => {
    const fetchImpl = (async () => { throw new DOMException('aborted', 'TimeoutError'); }) as typeof fetch;
    await expect(fetchReadableSource('https://example.com/slow', fetchImpl)).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'timeout',
    });
  });
});
