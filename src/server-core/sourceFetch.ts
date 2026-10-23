/**
 * Bounded public web-page retrieval for research grounding.
 * Hostname checks reduce SSRF risk, but cannot fully defeat DNS rebinding on runtimes
 * that do not expose DNS resolution/pinning. Do not use for user-configured internal URLs.
 */
export type SourceFetchResult = {
  status: 'retrieved' | 'unavailable';
  finalUrl?: string;
  contentType?: string;
  text?: string;
  reason?: string;
};

const MAX_REDIRECTS = 3;
const MAX_BYTES = 512 * 1024;
const MAX_TEXT_CHARS = 4000;
const TIMEOUT_MS = 4500;

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host.includes(':')) {
    if (host === '::1' || host.startsWith('::ffff:')) return true;
    // Only allow IPv6 global-unicast space (2000::/3); block loopback, link-local,
    // unique-local, multicast, unspecified, and other special-purpose ranges.
    const firstHextet = host.split(':')[0];
    if (!/^(?:2[0-9a-f]{3}|3[0-9a-f]{3})$/i.test(firstHextet)) return true;
  }
  const parts = host.split('.');
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [a, b, c] = parts.map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113) ||
        (a === 100 && b >= 64 && b <= 127)) return true;
  }
  return false;
}

export function validatePublicSourceUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') ||
        url.username || url.password || url.port ||
        isBlockedHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|template)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/article|\/section|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readBoundedBody(response: Response): Promise<string | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

export async function fetchReadableSource(
  inputUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceFetchResult> {
  let current = validatePublicSourceUrl(inputUrl);
  if (!current) return { status: 'unavailable', reason: 'blocked_url' };

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await fetchImpl(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
          'User-Agent': 'BreezyResearchBot/1.0 (+https://github.com/kikusuka/breezy-research-website-good)',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirects === MAX_REDIRECTS) return { status: 'unavailable', reason: 'redirect_limit' };
        const next = validatePublicSourceUrl(new URL(location, current).toString());
        if (!next) return { status: 'unavailable', reason: 'blocked_redirect' };
        current = next;
        continue;
      }
      if (!response.ok) return { status: 'unavailable', reason: 'http_error' };

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!['text/html', 'application/xhtml+xml', 'text/plain'].includes(contentType)) {
        return { status: 'unavailable', reason: 'unsupported_content_type', contentType };
      }
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > MAX_BYTES) return { status: 'unavailable', reason: 'body_too_large', contentType };

      const body = await readBoundedBody(response);
      if (body === null) return { status: 'unavailable', reason: 'body_too_large', contentType };
      const text = contentType === 'text/plain' ? body.replace(/\s+/g, ' ').trim() : htmlToText(body);
      if (!text) return { status: 'unavailable', reason: 'empty_text', contentType };
      return {
        status: 'retrieved',
        finalUrl: current.toString(),
        contentType,
        text: text.slice(0, MAX_TEXT_CHARS),
      };
    }
    return { status: 'unavailable', reason: 'redirect_limit' };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'fetch_failed',
    };
  }
}


/**
 * Attach bounded page-fetch outcomes to discovered search records. Failed or skipped
 * page reads preserve the original search result and its snippet for fallback use.
 */
export function attachSourceFetchResults<T extends {
  url: string;
  retrievalStatus?: string;
  pageText?: string;
  retrievedUrl?: string;
}>(sources: T[], pageResults: Array<SourceFetchResult | undefined>): T[] {
  return sources.map((source, index) => {
    const page = pageResults[index];
    if (!page) return { ...source, retrievalStatus: 'not_attempted' };
    return {
      ...source,
      retrievalStatus: page.status,
      ...(page.status === 'retrieved' && page.text ? { pageText: page.text } : {}),
      ...(page.status === 'retrieved' && page.finalUrl ? { retrievedUrl: page.finalUrl } : {}),
    };
  });
}
