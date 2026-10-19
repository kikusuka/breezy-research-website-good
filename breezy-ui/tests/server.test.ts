import { describe, it, expect } from 'vitest';
import { handleBackendRequest } from '../src/server-core/router';

describe('Server & Backend Router Core', () => {
  it('handles health check endpoint with JSON status', async () => {
    const req = new Request('http://localhost:3000/api/health', {
      method: 'GET',
    });

    const res = await handleBackendRequest(req, {}, 'local-dev');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ok');
    expect(body.backend).toBe('local-dev');
  });

  it('returns 404 for unknown endpoints', async () => {
    const req = new Request('http://localhost:3000/api/unknown-endpoint', {
      method: 'GET',
    });

    const res = await handleBackendRequest(req, {}, 'local-dev');
    expect(res.status).toBe(404);
  });

  it('handles CORS OPTIONS preflight', async () => {
    const req = new Request('http://localhost:3000/api/health', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });

    const res = await handleBackendRequest(req, {}, 'local-dev');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('rejects SSRF loopback URLs in webhook test endpoint', async () => {
    const req = new Request('http://localhost:3000/api/webhook/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: 'http://127.0.0.1:8080/admin' }),
    });

    const res = await handleBackendRequest(req, {}, 'local-dev');
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain('prohibited');
  });

  it('validates vault verify-key required parameters', async () => {
    const req = new Request('http://localhost:3000/api/vault/verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await handleBackendRequest(req, {}, 'local-dev');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
