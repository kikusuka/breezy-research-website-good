import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/server-core/firebaseAuth', () => ({
  verifyFirebaseIdToken: vi.fn(async () => ({ ok: true, uid: 'test-user' })),
}));

import { handleBackendRequest } from '../src/server-core/router';

describe('webhook verification redirect safety', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuses redirects from a validated public webhook URL', async () => {
    const req = new Request('https://breezy.example/api/webhook/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: 'https://hooks.example.com/notify',
        payload: { text: 'test' },
      }),
    });

    const response = await handleBackendRequest(req, { FIREBASE_PROJECT_ID: 'test-project' }, 'local-dev');
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(fetch).mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(init.redirect).toBe('error');
  });
});
