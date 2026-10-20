import { describe, expect, it } from 'vitest';
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
