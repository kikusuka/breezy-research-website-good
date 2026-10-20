import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifyFirebaseIdToken } from '../src/server-core/firebaseAuth';

describe('Firebase ID token verification', () => {
  it('fails closed when backend project configuration is missing', async () => {
    const request = new Request('https://breezy.example/api/breezy/chat', { method: 'POST' });
    const result = await verifyFirebaseIdToken(request, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toContain('not configured');
    }
  });

  it('rejects requests without a bearer token', async () => {
    const request = new Request('https://breezy.example/api/breezy/chat', { method: 'POST' });
    const result = await verifyFirebaseIdToken(request, { FIREBASE_PROJECT_ID: 'test-project' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toContain('Sign in to Breezy');
    }
  });

  it('rejects malformed tokens without attempting remote key lookup', async () => {
    const request = new Request('https://breezy.example/api/breezy/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    const result = await verifyFirebaseIdToken(request, { FIREBASE_PROJECT_ID: 'test-project' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});

describe('Firebase ID token signature validation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts a correctly signed token and rejects a tampered signature', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const pair = await webcrypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    const publicJwk = {
      ...await webcrypto.subtle.exportKey('jwk', pair.publicKey),
      kid: 'breezy-test-key',
      alg: 'RS256',
      use: 'sig',
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    })));

    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'RS256', typ: 'JWT', kid: 'breezy-test-key' });
    const claims = encode({
      aud: 'test-project',
      iss: 'https://securetoken.google.com/test-project',
      sub: 'test-user',
      exp: now + 3600,
      iat: now,
      auth_time: now,
    });
    const unsigned = `${header}.${claims}`;
    const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(unsigned));
    const token = `${unsigned}.${Buffer.from(signature).toString('base64url')}`;

    const validRequest = new Request('https://breezy.example/api/breezy/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(verifyFirebaseIdToken(validRequest, { FIREBASE_PROJECT_ID: 'test-project' }))
      .resolves.toEqual({ ok: true, uid: 'test-user' });

    const tamperedRequest = new Request('https://breezy.example/api/breezy/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${header}.${claims}.${Buffer.alloc(256).toString('base64url')}` },
    });
    const tampered = await verifyFirebaseIdToken(tamperedRequest, { FIREBASE_PROJECT_ID: 'test-project' });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.status).toBe(401);
  });
});
