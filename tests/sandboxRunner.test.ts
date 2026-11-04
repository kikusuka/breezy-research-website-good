import { describe, expect, it } from 'vitest';
import { PYODIDE_VERSION, formatRun, pythonFilesFrom, pythonWorkerSource, runnableLang } from '../src/services/sandboxRunner';

describe('sandbox helpers', () => {
  it('recognises runnable languages however a model labels them', () => {
    expect(runnableLang('Python')).toBe('python');
    expect(runnableLang('py')).toBe('python');
    expect(runnableLang('JS')).toBe('javascript');
    expect(runnableLang('rust')).toBeNull();
    expect(runnableLang(undefined)).toBeNull();
  });

  it('only exposes .py files to Python imports, and never paths that climb out', () => {
    const out = pythonFilesFrom([{ path: 'a.py', content: '1' }, { path: 'pkg/b.py', content: '2' }, { path: 'x.js', content: '3' }, { path: '../evil.py', content: '4' }]);
    expect(Object.keys(out)).toEqual(['a.py', 'pkg/b.py']);
  });

  it('formats output with timing, stdout, stderr and errors', () => {
    const text = formatRun({ stdout: 'hi\n', stderr: 'warn\n', error: 'boom', durationMs: 12 });
    expect(text).toContain('Finished in 12 ms');
    expect(text).toContain('hi');
    expect(text).toContain('[stderr]');
    expect(text).toContain('[error]\nboom');
  });

  it('pins the Pyodide version in the worker script', () => {
    expect(pythonWorkerSource()).toContain(`v${PYODIDE_VERSION}/full/`);
    expect(pythonWorkerSource()).toContain('importScripts');
  });
});
