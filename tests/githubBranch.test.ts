import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubIde } from '../src/services/ideService';

type Call = { url: string; method: string; body?: any };
function mockFetch(handler: (c: Call) => { status: number; json?: any }) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const call = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const r = handler(call);
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status });
  });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe('work branch saves', () => {
  it('creates the branch from the base when it does not exist', async () => {
    const calls = mockFetch((c) => {
      if (c.url.endsWith('/git/ref/heads/breezy/work')) return { status: 404 };
      if (c.url.endsWith('/git/ref/heads/main')) return { status: 200, json: { object: { sha: 'base123' } } };
      return { status: 201, json: {} };
    });
    expect(await GitHubIde.ensureBranch('t', 'me/app', 'breezy/work', 'main')).toBe(true);
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({ ref: 'refs/heads/breezy/work', sha: 'base123' });
  });

  it('leaves an existing branch alone', async () => {
    const calls = mockFetch(() => ({ status: 200, json: {} }));
    expect(await GitHubIde.ensureBranch('t', 'me/app', 'breezy/work', 'main')).toBe(false);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('commits to the branch using the sha from that branch, with UTF-8 content', async () => {
    const calls = mockFetch((c) => (c.method === 'GET' ? { status: 200, json: { sha: 'onbranch' } } : { status: 200, json: { content: { sha: 'newsha' } } }));
    const res = await GitHubIde.saveFile('t', 'me/app', 'src/a b.ts', 'héllo', 'stale-default-sha', 'msg', 'breezy/work');
    expect(res.sha).toBe('newsha');
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toContain('/contents/src/a%20b.ts');
    expect(put.body).toMatchObject({ branch: 'breezy/work', sha: 'onbranch', message: 'msg' });
    expect(new TextDecoder().decode(Uint8Array.from(atob(put.body.content), (ch) => ch.charCodeAt(0)))).toBe('héllo');
  });

  it('creates a new file on the branch when it is not there yet', async () => {
    const calls = mockFetch((c) => (c.method === 'GET' ? { status: 404 } : { status: 201, json: { content: { sha: 's1' } } }));
    await GitHubIde.saveFile('t', 'me/app', 'new.py', 'print(1)', undefined, undefined, 'breezy/work');
    expect(calls.find((c) => c.method === 'PUT')!.body.sha).toBeUndefined();
  });

  it('opens a pull request, or returns the one that is already open', async () => {
    mockFetch(() => ({ status: 201, json: { html_url: 'https://github.com/me/app/pull/7' } }));
    expect(await GitHubIde.openPullRequest('t', 'me/app', 'breezy/work', 'main', 'Edits')).toEqual({ url: 'https://github.com/me/app/pull/7', existing: false });
    mockFetch((c) => (c.method === 'POST' ? { status: 422 } : { status: 200, json: [{ html_url: 'https://github.com/me/app/pull/3' }] }));
    expect(await GitHubIde.openPullRequest('t', 'me/app', 'breezy/work', 'main', 'Edits')).toEqual({ url: 'https://github.com/me/app/pull/3', existing: true });
  });
});
