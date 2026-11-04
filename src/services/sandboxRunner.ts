import { RunResult, runJavaScript } from './ideService';

/**
 * Browser-side code execution shared by Build and Canvas. Nothing here touches Breezy's servers.
 * Python runs in a Web Worker (Pyodide, loaded from jsDelivr) so a long loop can be stopped instead of freezing the tab.
 * A worker has no DOM and no access to the page's storage or keys. It can still make network requests.
 */
export const PYODIDE_VERSION = '0.26.4';
const BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const LOAD_TIMEOUT_MS = 90_000;
export const RUN_TIMEOUT_MS = 30_000;

export function pythonWorkerSource(): string {
  return `
const BASE=${JSON.stringify(BASE)};
let py=null, ready=null;
const send=(kind,text)=>postMessage({kind,text});
async function init(){
  importScripts(BASE+'pyodide.js');
  py=await loadPyodide({indexURL:BASE});
  py.setStdout({batched:s=>send('out',s)});
  py.setStderr({batched:s=>send('err',s)});
  py.runPython("import os, sys\\nos.makedirs('/home/pyodide', exist_ok=True)\\nos.chdir('/home/pyodide')\\nsys.path.insert(0, '/home/pyodide')");
}
onmessage=async(e)=>{
  const {code,files}=e.data||{};
  try{
    if(!ready){send('status','Loading Python (first run downloads about 10 MB)…');ready=init();}
    await ready;
    for(const [path,content] of Object.entries(files||{})){
      const full='/home/pyodide/'+path.replace(/^\\/+/,'');
      const dir=full.slice(0,full.lastIndexOf('/'));
      if(dir) py.FS.mkdirTree(dir);
      py.FS.writeFile(full,content);
    }
    send('started','');
    await py.loadPackagesFromImports(code);
    const r=await py.runPythonAsync(code);
    if(r!==undefined&&r!==null) send('result',String(r));
    send('done','');
  }catch(err){send('error',String(err&&err.message||err));}
};`;
}

type Listener = (status: string) => void;

class PythonSandbox {
  private worker: Worker | null = null;
  private url: string | null = null;
  private cancel: ((reason: string) => void) | null = null;

  get running(): boolean { return this.cancel !== null; }

  /** Ends the current run and discards the worker (the next run starts a fresh one). */
  stop(reason = 'Stopped.'): void { this.cancel?.(reason); }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    this.url = URL.createObjectURL(new Blob([pythonWorkerSource()], { type: 'text/javascript' }));
    this.worker = new Worker(this.url);
    return this.worker;
  }

  private discard(): void {
    this.worker?.terminate(); this.worker = null;
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
  }

  run(code: string, files: Record<string, string> = {}, onStatus?: Listener, timeoutMs = RUN_TIMEOUT_MS): Promise<RunResult> {
    if (this.running) return Promise.resolve({ stdout: '', stderr: '', error: 'Python is already running. Stop it first.', durationMs: 0 });
    return new Promise((resolve) => {
      const start = performance.now();
      let out = ''; let err = '';
      let timer: number | undefined;
      let worker: Worker;
      try { worker = this.ensure(); } catch (e: any) {
        return resolve({ stdout: '', stderr: '', error: `Could not start a worker: ${e?.message || e}`, durationMs: 0 });
      }
      const finish = (error?: string, kill = false) => {
        window.clearTimeout(timer); worker.onmessage = null; worker.onerror = null; this.cancel = null;
        if (kill) this.discard();
        resolve({ stdout: out, stderr: err, error, durationMs: Math.round(performance.now() - start) });
      };
      this.cancel = (reason) => finish(reason, true);
      timer = window.setTimeout(() => finish('Could not load the Python runtime. Check your connection and try again.', true), LOAD_TIMEOUT_MS);
      worker.onmessage = (e: MessageEvent) => {
        const { kind, text } = e.data || {};
        if (kind === 'status') onStatus?.(text);
        else if (kind === 'started') { window.clearTimeout(timer); timer = window.setTimeout(() => finish(`Stopped after ${timeoutMs / 1000}s (possible infinite loop).`, true), timeoutMs); }
        else if (kind === 'out') out += `${text}\n`;
        else if (kind === 'err') err += `${text}\n`;
        else if (kind === 'result') { if (!out) out = `${text}\n`; }
        else if (kind === 'error') finish(text);
        else if (kind === 'done') finish();
      };
      worker.onerror = (ev) => finish(ev.message || 'Python worker failed.', true);
      worker.postMessage({ code, files });
    });
  }
}

export const pythonSandbox = new PythonSandbox();

export type RunnableLang = 'python' | 'javascript';

/** Maps a language label (as models write it) to something we can run, or null. */
export function runnableLang(lang?: string): RunnableLang | null {
  const l = (lang || '').trim().toLowerCase();
  if (l === 'python' || l === 'py' || l === 'python3') return 'python';
  if (l === 'javascript' || l === 'js' || l === 'node') return 'javascript';
  return null;
}

/** Only .py files are made importable from Python code. */
export function pythonFilesFrom(files: Array<{ path: string; content: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of files) if (/\.py$/i.test(f.path) && !f.path.includes('..')) out[f.path] = f.content;
  return out;
}

export function formatRun(res: RunResult): string {
  let s = `Finished in ${res.durationMs} ms\n`;
  if (res.stdout) s += `\n${res.stdout}`;
  if (res.stderr) s += `\n[stderr]\n${res.stderr}`;
  if (res.error) s += `\n[error]\n${res.error}\n`;
  return s;
}

export async function runInSandbox(lang: RunnableLang, code: string, files: Record<string, string> = {}, onStatus?: Listener): Promise<RunResult> {
  return lang === 'python' ? pythonSandbox.run(code, files, onStatus) : runJavaScript(code, 5000);
}
