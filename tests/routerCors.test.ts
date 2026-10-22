import { describe, expect, it } from 'vitest';
import { getCorsHeaders } from '../src/server-core/router';

describe('backend CORS configuration', () => {
  it('allows the methods required by the chat persistence API', () => {
    const request = {
      headers: new Headers({ Origin: 'https://breezy.example.test' }),
    } as Request;
    const headers = getCorsHeaders(request, {
      ALLOWED_ORIGINS: 'https://breezy.example.test',
    });

    expect(headers['Access-Control-Allow-Origin']).toBe('https://breezy.example.test');
    expect(headers['Access-Control-Allow-Methods']).toContain('PATCH');
    expect(headers['Access-Control-Allow-Methods']).toContain('DELETE');
  });

  it('does not reflect an origin that is not in the allowlist', () => {
    const request = {
      headers: new Headers({ Origin: 'https://untrusted.example.test' }),
    } as Request;
    const headers = getCorsHeaders(request, {
      ALLOWED_ORIGINS: 'https://breezy.example.test',
    });

    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
