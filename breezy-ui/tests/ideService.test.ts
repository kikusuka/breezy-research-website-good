import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubIde, IdeWorkspace, buildPreviewDoc, parseAgentEdits, languageOf, isRunnable } from '../src/services/ideService';

describe('languageOf / isRunnable', () => {
  it('detects languages', () => {
    expect(languageOf('a/b/main.py')).toBe('python');
    expect(languageOf('x.tsx')).toBe('typescript');
    expect(languageOf('README')).toBe('text');
    expect(isRunnable('t.py')).toBe(true);
    expect(isRunnable('t.css')).toBe(false);
  });
});

describe('IdeWorkspace', () => {
  it('tracks dirty state and active file', () => {
    const w = new IdeWorkspace();
    w.open('a.py', 'print(1)', 'sha1');
    expect(w.isDirty('a.py')).toBe(false);
    w.edit('a.py', 'print(2)');
    expect(w.isDirty('a.py')).toBe(true);
    w.create('b.py', 'x');
    expect(w.dirtyPaths().sort()).toEqual(['a.py', 'b.py']);
    expect(() => w.create('b.py')).toThrow();
    w.close('b.py');
    expect(w.active).toBe('a.py');
  });
});

describe('GitHubIde (mocked fetch)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  beforeEach(() => { localStorage.clear(); });

  it('getTree maps blobs and trees and reports the default branch', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ default_branch: 'dev' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ truncated: false, tree: [{ path: 'src', type: 'tree' }, { path: 'src/a.py', type: 'blob', size: 5 }, { path: 'x', type: 'commit' }] }) }) as any;
    const t = await GitHubIde.getTree('tok', 'me/repo');
    expect(t.branch).toBe('dev');
    expect(t.entries).toEqual([{ path: 'src', type: 'dir', size: undefined }, { path: 'src/a.py', type: 'file', size: 5 }]);
  });

  it('getTree throws a readable error on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
    await expect(GitHubIde.getTree('tok', 'me/none')).rejects.toThrow(/404/);
  });

  it('save commits through PUT and marks the buffer clean', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: { sha: 'new-sha' } }) });
    globalThis.fetch = fetchMock as any;
    const w = new IdeWorkspace();
    w.open('a.py', 'old', 'old-sha');
    w.edit('a.py', 'new ✓');
    await w.save('tok', 'me/repo', 'a.py', 'msg');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/repos/me/repo/contents/a.py');
    const body = JSON.parse(init.body);
    expect(init.method).toBe('PUT');
    expect(body.sha).toBe('old-sha');
    expect(decodeURIComponent(escape(atob(body.content)))).toBe('new ✓');
    expect(w.isDirty('a.py')).toBe(false);
    expect(w.get('a.py')!.sha).toBe('new-sha');
  });

  it('deleteFile sends sha and throws on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 409, text: async () => 'conflict' });
    globalThis.fetch = fetchMock as any;
    await GitHubIde.deleteFile('t', 'me/r', 'a.py', 'abc');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sha).toBe('abc');
    await expect(GitHubIde.deleteFile('t', 'me/r', 'a.py', 'abc')).rejects.toThrow(/409/);
  });
});

describe('buildPreviewDoc', () => {
  it('inlines relative css and js, leaves external ones alone', () => {
    const files = {
      'site/index.html': '<link rel="stylesheet" href="style.css"><script src="../lib/app.js"></script><script src="https://cdn.x/y.js"></script>',
      'site/style.css': 'body{color:red}',
      'lib/app.js': 'console.log("hi")',
    };
    const out = buildPreviewDoc('site/index.html', files);
    expect(out).toContain('<style>body{color:red}</style>');
    expect(out).toContain('<script>console.log("hi")</script>');
    expect(out).toContain('src="https://cdn.x/y.js"');
    expect(() => buildPreviewDoc('nope.html', files)).toThrow();
  });
});

describe('parseAgentEdits', () => {
  it('extracts full-file blocks and rejects path traversal', () => {
    const reply = 'Done.\n```file:src/a.py\nprint(1)\nprint(2)\n```\ntext\n```file:../evil.sh\nrm -rf /\n```\n```js\nignored()\n```';
    expect(parseAgentEdits(reply)).toEqual([{ path: 'src/a.py', content: 'print(1)\nprint(2)' }]);
  });
});
