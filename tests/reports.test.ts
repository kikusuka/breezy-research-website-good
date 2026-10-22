import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleBackendRequest } from '../src/server-core/router';

function reportRequest(body: unknown, client = crypto.randomUUID()) {
  return new Request('https://breezy.example/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-real-ip': client,
    },
    body: JSON.stringify(body),
  });
}

describe('feedback report endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns an explicit configuration error when Discord is not configured', async () => {
    const response = await handleBackendRequest(reportRequest({
      kind: 'bug',
      description: 'Research stopped unexpectedly',
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: 'REPORTING_NOT_CONFIGURED',
    });
  });

  it('rejects unknown report types without contacting Discord', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleBackendRequest(reportRequest({
      kind: 'secret-kind',
      description: 'This should not be sent',
    }), { DISCORD_ALERT_WEBHOOK_URL: 'https://discord.example/webhook/test' });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delivers valid reports with mentions disabled and reports success only after delivery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleBackendRequest(reportRequest({
      kind: 'bug',
      title: 'Research issue',
      description: 'Authorization: Bearer abcdefghijklmnop and sk-abcdefghijklmnopqrstuvwxyz',
      environment: 'feature=research',
    }), { DISCORD_ALERT_WEBHOOK_URL: 'https://discord.example/webhook/test' });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(sent.allowed_mentions).toEqual({ parse: [] });
    expect(sent.content).toContain('Bearer [redacted]');
    expect(sent.content).toContain('[redacted key]');
    expect(sent.content).not.toContain('abcdefghijklmnop');
    expect(sent.content).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
  });

  it('does not claim success when Discord delivery fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleBackendRequest(reportRequest({
      kind: 'suggestion',
      description: 'Add a keyboard shortcut',
    }), { DISCORD_ALERT_WEBHOOK_URL: 'https://discord.example/webhook/test' });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it('rejects empty user-submitted descriptions', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleBackendRequest(reportRequest({
      kind: 'suggestion',
      description: '   ',
    }), { DISCORD_ALERT_WEBHOOK_URL: 'https://discord.example/webhook/test' });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
