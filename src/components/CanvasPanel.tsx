import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../shell/Icon';
import { Markdown } from '../ui/Markdown';
import { fileNameFor } from '../lib/canvas';
import { CanvasDoc } from '../services/canvasStore';
import { formatRun, pythonSandbox, runInSandbox, runnableLang } from '../services/sandboxRunner';

interface Props { doc: CanvasDoc; onEdit: (content: string) => void; onRestore: (index: number) => void; onClose: () => void }

const ago = (t: number): string => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Side panel next to the chat (full-screen sheet on phones). Editing is a plain text area on purpose:
 * it is fast, accessible and has no dependencies. Generated HTML runs in a sandboxed frame with no access to Breezy.
 */
export const CanvasPanel: React.FC<Props> = ({ doc, onEdit, onRestore, onClose }) => {
  const last = doc.versions.length - 1;
  const [view, setView] = useState(last);
  const [tab, setTab] = useState<'edit' | 'preview'>(doc.kind === 'document' ? 'edit' : 'edit');
  const [draft, setDraft] = useState(doc.versions[last].content);
  const [copied, setCopied] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const lang = doc.kind === 'code' ? runnableLang(doc.lang) : null;
  const timer = useRef<number | undefined>(undefined);
  const previewable = doc.kind !== 'code';

  // A new version arrived (model revision or restore): follow it.
  useEffect(() => { setView(doc.versions.length - 1); setDraft(doc.versions[doc.versions.length - 1].content); }, [doc.id, doc.versions.length]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const viewing = doc.versions[Math.min(view, last)];
  const readOnly = view !== last;
  const text = readOnly ? viewing.content : draft;

  const change = (value: string) => {
    setDraft(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onEdit(value), 600);
  };
  const run = async () => {
    if (!lang || running) return;
    setRunning(true); setOutput(lang === 'python' ? 'Starting Python…' : 'Running…');
    try { setOutput(formatRun(await runInSandbox(lang, text, {}, (s) => setOutput(s)))); }
    finally { setRunning(false); }
  };
  const copy = () => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };
  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileNameFor(doc.title, doc.kind, doc.lang);
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const btn = 'flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors';

  return (
    <section aria-label={`Canvas: ${doc.title}`} className="fixed inset-0 z-[95] flex flex-col bg-background lg:static lg:inset-auto lg:z-auto lg:w-[46%] lg:max-w-[42rem] lg:shrink-0 lg:border-l lg:border-outline-variant/40">
      <header className="flex shrink-0 items-center gap-1 border-b border-outline-variant/40 px-3 pt-safe lg:pt-0 min-h-14">
        <Icon name={doc.kind === 'document' ? 'description' : doc.kind === 'html' ? 'html' : 'code'} className="text-[20px] text-primary shrink-0" />
        <h2 className="min-w-0 flex-1 truncate px-1 font-headline-sm text-headline-sm">{doc.title}</h2>
        {lang && (running && lang === 'python'
          ? <button type="button" onClick={() => pythonSandbox.stop('Stopped by you.')} className={`${btn} text-error`} aria-label="Stop"><Icon name="stop" className="text-[18px]" /><span className="hidden xl:inline">Stop</span></button>
          : <button type="button" onClick={() => void run()} disabled={running} className={`${btn} text-primary`} aria-label="Run"><Icon name="play_arrow" className="text-[18px]" /><span className="hidden xl:inline">{running ? 'Running…' : 'Run'}</span></button>)}
        <button type="button" onClick={copy} className={btn} aria-label="Copy"><Icon name="content_copy" className="text-[18px]" /><span className="hidden xl:inline">{copied ? 'Copied' : 'Copy'}</span></button>
        <button type="button" onClick={download} className={btn} aria-label="Download"><Icon name="download" className="text-[18px]" /><span className="hidden xl:inline">Download</span></button>
        <button type="button" onClick={onClose} className={btn} aria-label="Close canvas"><Icon name="close" className="text-[20px]" /></button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-outline-variant/40 px-3 py-2">
        {previewable && (
          <div role="tablist" aria-label="View" className="inline-flex rounded-lg bg-surface-container-low p-0.5 border border-outline-variant/40">
            {(['edit', 'preview'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-8 rounded-md px-3 font-label-md text-label-md ${tab === t ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant'}`}>{t === 'edit' ? 'Edit' : 'Preview'}</button>
            ))}
          </div>
        )}
        <label className="ml-auto flex items-center gap-1.5 font-code-sm text-code-sm text-outline">
          <Icon name="history" className="text-[16px]" />
          <select value={view} onChange={(e) => setView(Number(e.target.value))} aria-label="Version" className="rounded-md border border-outline-variant/50 bg-surface-container-low px-2 py-1 text-on-surface">
            {doc.versions.map((v, i) => <option key={i} value={i}>{`v${i + 1} · ${v.source === 'model' ? 'Breezy' : 'You'} · ${ago(v.at)}`}</option>)}
          </select>
        </label>
      </div>

      {readOnly && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
          <span className="flex-1">Viewing version {view + 1}. Editing is off.</span>
          <button type="button" onClick={() => onRestore(view)} className="text-primary underline underline-offset-4">Restore this version</button>
        </div>
      )}

      <div className={`relative min-h-0 overflow-hidden ${output !== null ? 'flex-[2]' : 'flex-1'}`}>
        {tab === 'preview' && previewable ? (
          doc.kind === 'html'
            ? <iframe title="HTML preview" sandbox="allow-scripts" srcDoc={text} className="absolute inset-0 h-full w-full bg-white" />
            : <div className="absolute inset-0 overflow-y-auto p-4"><Markdown>{text}</Markdown></div>
        ) : (
          <textarea value={text} readOnly={readOnly} onChange={(e) => change(e.target.value)} spellCheck={doc.kind === 'document'} aria-label="Canvas content"
            className={`absolute inset-0 h-full w-full resize-none bg-transparent p-4 text-on-surface focus:outline-none ${doc.kind === 'document' ? 'font-body-md text-body-md leading-[1.65]' : 'font-code-md text-code-md'}`} />
        )}
      </div>
      {output !== null && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-outline-variant/40">
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5 font-code-sm text-code-sm text-outline">
            <span>OUTPUT</span>
            <button type="button" onClick={() => setOutput(null)} className="hover:text-on-surface" aria-label="Clear output">Clear</button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-3 pb-3 font-code-md text-code-md text-on-surface" aria-live="polite">{output}</pre>
        </div>
      )}
    </section>
  );
};
