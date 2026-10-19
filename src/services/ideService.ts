/**
 * Breezy IDE backend (no UI).
 *
 * Non-visual building blocks for a repository-first online IDE:
 *   - GitHubIde      : file tree, open/save(commit)/create/delete files via the GitHub REST API
 *   - IdeWorkspace   : open-file buffers with dirty tracking (pure state, framework-agnostic)
 *   - runPython      : real Python execution in the browser through Pyodide (loaded lazily from a CDN)
 *   - runJavaScript  : runs JS in a Web Worker (killable on timeout) and captures console output
 *   - buildPreviewDoc: inlines linked CSS/JS from the repo so an HTML file can be shown in a sandboxed iframe
 *   - askIdeAgent    : asks the user's configured model to propose file edits, parseAgentEdits() reads the reply
 *
 * What this deliberately does NOT provide: a real shell/terminal. The browser has none and Breezy has no
 * server-side sandbox. A UI should call its output panel a "Console" and never imply a shell exists.
 *
 * GitHub limits: the existing gitHubService writes to the repository's default branch only.
 */
import { gitHubService } from './gitHubService';
import { apiClient } from './apiClient';
import { providerConfigService } from './providerConfigService';
import { effectiveProviderService } from './effectiveProviderService';

const API = 'https://api.github.com';
export const GITHUB_TOKEN_KEY = 'breezy_github_token';

export const getGitHubToken = (): string => {
  try { return localStorage.getItem(GITHUB_TOKEN_KEY) || ''; } catch { return ''; }
};
export const setGitHubToken = (token: string) => {
  try { token ? localStorage.setItem(GITHUB_TOKEN_KEY, token) : localStorage.removeItem(GITHUB_TOKEN_KEY); } catch { /* storage unavailable */ }
};

const headers = (token: string) => ({ Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' });

export interface TreeEntry { path: string; type: 'file' | 'dir'; size?: number; }

export type Language = 'python' | 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'markdown' | 'text';
export function languageOf(path: string): Language {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, Language> = { py: 'python', js: 'javascript', mjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', html: 'html', htm: 'html', css: 'css', json: 'json', md: 'markdown', markdown: 'markdown' };
  return map[ext] || 'text';
}
export const isRunnable = (path: string) => ['python', 'javascript', 'html'].includes(languageOf(path));

/* ───────────────────────────── GitHub ───────────────────────────── */
export const GitHubIde = {
  /** Entire repo tree in one request. Throws a readable error (the old service swallowed failures). */
  async getTree(token: string, repo: string): Promise<{ entries: TreeEntry[]; truncated: boolean; branch: string }> {
    const meta = await fetch(`${API}/repos/${repo}`, { headers: headers(token) });
    if (!meta.ok) throw new Error(`Could not open ${repo} (${meta.status}). Check the token and repository name.`);
    const branch = (await meta.json()).default_branch || 'main';
    const res = await fetch(`${API}/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: headers(token) });
    if (!res.ok) throw new Error(`Could not read the file tree (${res.status}).`);
    const data = await res.json();
    const entries: TreeEntry[] = (data.tree || [])
      .filter((n: any) => n.type === 'blob' || n.type === 'tree')
      .map((n: any) => ({ path: n.path, type: n.type === 'tree' ? 'dir' : 'file', size: n.size }));
    return { entries, truncated: Boolean(data.truncated), branch };
  },

  async readFile(token: string, repo: string, path: string) {
    return gitHubService.fetchFileDetails(token, repo, path); // { content, sha }
  },

  /** Commit a change. Pass the sha from readFile when updating; omit it to create a new file. */
  async saveFile(token: string, repo: string, path: string, content: string, sha: string | undefined, message?: string): Promise<{ sha: string }> {
    const res = await gitHubService.updateFileContent(token, repo, path, content, sha || '', message || `${sha ? 'Update' : 'Create'} ${path} via Breezy`);
    return { sha: res?.content?.sha };
  },

  async deleteFile(token: string, repo: string, path: string, sha: string, message?: string): Promise<void> {
    const res = await fetch(`${API}/repos/${repo}/contents/${path}`, {
      method: 'DELETE',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message || `Delete ${path} via Breezy`, sha }),
    });
    if (!res.ok) throw new Error(`Failed to delete ${path} (${res.status}): ${await res.text()}`);
  },
};

/* ─────────────────────── Open-file buffers ─────────────────────── */
export interface OpenFile { path: string; original: string; content: string; sha?: string; isNew: boolean; }

export class IdeWorkspace {
  private files = new Map<string, OpenFile>();
  active: string | null = null;

  open(path: string, content: string, sha?: string) {
    if (!this.files.has(path)) this.files.set(path, { path, original: content, content, sha, isNew: !sha });
    this.active = path;
    return this.files.get(path)!;
  }
  create(path: string, content = '') {
    if (this.files.has(path)) throw new Error(`${path} is already open.`);
    this.files.set(path, { path, original: '', content, isNew: true });
    this.active = path;
    return this.files.get(path)!;
  }
  edit(path: string, content: string) { const f = this.files.get(path); if (f) f.content = content; }
  get(path: string) { return this.files.get(path); }
  list() { return [...this.files.values()]; }
  isDirty(path: string) { const f = this.files.get(path); return Boolean(f && (f.isNew || f.content !== f.original)); }
  dirtyPaths() { return this.list().filter((f) => this.isDirty(f.path)).map((f) => f.path); }
  close(path: string) {
    this.files.delete(path);
    if (this.active === path) this.active = this.list().at(-1)?.path ?? null;
  }
  /** Commit one file and mark it clean. */
  async save(token: string, repo: string, path: string, message?: string) {
    const f = this.files.get(path);
    if (!f) throw new Error(`${path} is not open.`);
    const { sha } = await GitHubIde.saveFile(token, repo, path, f.content, f.sha, message);
    f.sha = sha; f.original = f.content; f.isNew = false;
    return f;
  }
}

/* ───────────────────────── Code execution ───────────────────────── */
export interface RunResult { stdout: string; stderr: string; error?: string; durationMs: number; }

const PYODIDE_VERSION = '0.26.4';
let pyodidePromise: Promise<any> | null = null;

async function loadPyodideRuntime(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('Python runs in the browser only.');
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    const base = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
    if (!(window as any).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = base + 'pyodide.js'; s.onload = () => resolve();
        s.onerror = () => reject(new Error('Could not download the Python runtime (Pyodide). Check your connection.'));
        document.head.appendChild(s);
      });
    }
    return (window as any).loadPyodide({ indexURL: base });
  })().catch((e) => { pyodidePromise = null; throw e; });
  return pyodidePromise;
}

export const pythonRuntimeState = () => (pyodidePromise ? 'loading-or-ready' : 'not-loaded');

/** Runs on the main thread, so very long computations will freeze the tab. */
export async function runPython(code: string): Promise<RunResult> {
  const start = performance.now();
  let stdout = ''; let stderr = '';
  try {
    const py = await loadPyodideRuntime();
    py.setStdout({ batched: (s: string) => { stdout += s + '\n'; } });
    py.setStderr({ batched: (s: string) => { stderr += s + '\n'; } });
    await py.loadPackagesFromImports(code);
    const result = await py.runPythonAsync(code);
    if (result !== undefined && result !== null && !stdout) stdout = String(result) + '\n';
    return { stdout, stderr, durationMs: Math.round(performance.now() - start) };
  } catch (e: any) {
    return { stdout, stderr, error: String(e?.message || e), durationMs: Math.round(performance.now() - start) };
  }
}

/**
 * Runs JavaScript in a Web Worker and returns what it logged. A worker has no DOM and no access to the
 * page's storage, and an infinite loop is stopped by terminating it after `timeoutMs` (an iframe cannot be
 * stopped this way because it can share the page's thread).
 */
export function runJavaScript(code: string, timeoutMs = 5000): Promise<RunResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    let out = ''; let err = '';
    const source = `
      const send=(kind,text)=>postMessage({kind,text});
      const fmt=a=>a.map(x=>typeof x==='string'?x:(()=>{try{return JSON.stringify(x)}catch{return String(x)}})()).join(' ');
      console.log=(...a)=>send('log',fmt(a));console.info=console.log;console.warn=(...a)=>send('warn',fmt(a));console.error=console.warn;
      onmessage=async(e)=>{
        try{const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;await new AsyncFunction(e.data)();send('done','')}
        catch(err){send('error',String(err&&err.message||err))}
      };`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    let worker: Worker;
    try { worker = new Worker(url); } catch (e: any) {
      URL.revokeObjectURL(url);
      return resolve({ stdout: '', stderr: '', error: `Could not start a worker: ${e?.message || e}`, durationMs: 0 });
    }
    let finished = false;
    const finish = (error?: string) => {
      if (finished) return; finished = true;
      clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url);
      resolve({ stdout: out, stderr: err, error, durationMs: Math.round(performance.now() - start) });
    };
    const timer = setTimeout(() => finish(`Stopped after ${timeoutMs / 1000}s (possible infinite loop).`), timeoutMs);
    worker.onmessage = (e: MessageEvent) => {
      const { kind, text } = e.data || {};
      if (kind === 'log') out += text + '\n';
      else if (kind === 'warn') err += text + '\n';
      else if (kind === 'error') finish(text);
      else if (kind === 'done') finish();
    };
    worker.onerror = (e) => finish(e.message || 'Script error');
    worker.postMessage(code);
  });
}

/* ───────────────────────────── Preview ───────────────────────────── */
/**
 * Build a single self-contained HTML document for a sandboxed iframe (sandbox="allow-scripts").
 * Relative <link rel=stylesheet href> and <script src> that exist in `files` are inlined.
 */
export function buildPreviewDoc(htmlPath: string, files: Record<string, string>): string {
  const html = files[htmlPath];
  if (html === undefined) throw new Error(`${htmlPath} is not loaded.`);
  const dir = htmlPath.includes('/') ? htmlPath.slice(0, htmlPath.lastIndexOf('/') + 1) : '';
  const resolve = (ref: string) => {
    if (/^(https?:)?\/\//i.test(ref) || ref.startsWith('data:')) return null;
    const parts = (ref.startsWith('/') ? ref.slice(1) : dir + ref).split('/');
    const out: string[] = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
    return out.join('/');
  };
  return html
    .replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, (tag) => {
      const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
      const p = href ? resolve(href) : null;
      return p && files[p] !== undefined ? `<style>${files[p]}</style>` : tag;
    })
    .replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
      const p = resolve(src);
      if (!(p && files[p] !== undefined)) return tag;
      const attrs = `${a} ${b}`.trim();
      return `<script${attrs ? ' ' + attrs : ''}>${files[p].replace(/<\/script/gi, '<\\/script')}</script>`;
    });
}

/* ────────────────────────────── Agent ────────────────────────────── */
export interface AgentEdit { path: string; content: string; }

const AGENT_SYSTEM = [
  'You are the coding agent inside Breezy, working on the user\'s repository.',
  'When you change or create files, output each COMPLETE new file as a fenced block whose info string is "file:<path>", for example:',
  '```file:src/app.py\n<entire file contents>\n```',
  'Never output partial files or diffs. Explain briefly outside the blocks. If no change is needed, output no file blocks.',
].join('\n');

export function parseAgentEdits(reply: string): AgentEdit[] {
  const edits: AgentEdit[] = [];
  const re = /```file:([^\n`]+)\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reply))) {
    const path = m[1].trim().replace(/^\/+/, '');
    if (path && !path.includes('..')) edits.push({ path, content: m[2] });
  }
  return edits;
}

export async function askIdeAgent(args: {
  instruction: string;
  activePath?: string;
  files?: Record<string, string>; // path -> current content, keep this small
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
}): Promise<{ text: string; edits: AgentEdit[] }> {
  const active = effectiveProviderService.getActiveRoutableModel();
  if (!active) throw new Error('No model is connected. Add a provider in Models first.');
  const ctx = Object.entries(args.files || {}).slice(0, 8)
    .map(([p, c]) => `### ${p}${p === args.activePath ? ' (active)' : ''}\n\`\`\`\n${c.slice(0, 12000)}\n\`\`\``).join('\n\n');
  const prompt = `${AGENT_SYSTEM}\n\n${ctx ? `Files:\n${ctx}\n\n` : ''}Request: ${args.instruction}`;
  const res = await apiClient.chatBreezy(
    { prompt, history: args.history || [], provider: active.provider, model: active.model, apiKey: providerConfigService.getKey(active.provider) },
    { signal: args.signal },
  );
  return { text: res.text, edits: parseAgentEdits(res.text) };
}
