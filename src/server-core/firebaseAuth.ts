import type { BackendEnv } from './types';

type VerificationResult =
  | { ok: true; uid: string }
  | { ok: false; status: 401 | 503; error: string };

type FirebaseJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };
let cachedKeys: { keys: FirebaseJwk[]; expiresAt: number } | null = null;

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
}

async function getFirebaseSigningKeys(forceRefresh = false): Promise<FirebaseJwk[]> {
  if (!forceRefresh && cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;

  const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('Firebase signing keys are temporarily unavailable.');
  const payload = await response.json() as { keys?: FirebaseJwk[] };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('Firebase signing-key response was invalid.');
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 3600);
  cachedKeys = { keys: payload.keys, expiresAt: Date.now() + Math.max(60, maxAge) * 1000 };
  return cachedKeys.keys;
}

/**
 * Verify a Firebase Authentication ID token without runtime-specific Admin SDKs.
 * This is compatible with Workers, Node, and Deno through Web Crypto.
 */
export async function verifyFirebaseIdToken(
  request: Request,
  env: BackendEnv
): Promise<VerificationResult> {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    return { ok: false, status: 503, error: 'Authentication verification is not configured on this backend.' };
  }

  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) return { ok: false, status: 401, error: 'Sign in to Breezy before using this feature.' };

  const parts = match[1].split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return { ok: false, status: 401, error: 'The sign-in session is invalid. Please sign in again.' };
  }

  let header: { alg?: string; kid?: string };
  let claims: {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
  };
  let signature: Uint8Array;
  try {
    header = decodeJsonSegment(parts[0]);
    claims = decodeJsonSegment(parts[1]);
    signature = decodeBase64Url(parts[2]);
  } catch {
    return { ok: false, status: 401, error: 'The sign-in session is invalid. Please sign in again.' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false, status: 401, error: 'The sign-in token uses an unsupported signing method.' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 128 ||
    typeof claims.exp !== 'number' || claims.exp <= now ||
    typeof claims.iat !== 'number' || claims.iat > now + 300 ||
    typeof claims.auth_time !== 'number' || claims.auth_time > now + 300
  ) {
    return { ok: false, status: 401, error: 'Your sign-in session has expired or is not valid for this Breezy project.' };
  }

  try {
    let keys = await getFirebaseSigningKeys();
    let jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) {
      keys = await getFirebaseSigningKeys(true);
      jwk = keys.find((key) => key.kid === header.kid);
    }
    if (!jwk) return { ok: false, status: 401, error: 'The sign-in token signing key is no longer valid.' };

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature,
      signedContent
    );
    if (!verified) return { ok: false, status: 401, error: 'The sign-in token signature is invalid.' };
    return { ok: true, uid: claims.sub };
  } catch {
    return { ok: false, status: 503, error: 'Could not verify the sign-in session right now. Please retry.' };
  }
}
