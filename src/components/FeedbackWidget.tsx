import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';

type ReportKind = 'bug' | 'suggestion';

async function sendReport(payload: Record<string, string>) {
  const endpoint = apiClient.getActiveEndpoint();
  const response = await fetch(`${endpoint.url}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: payload.kind === 'automatic_error',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.ok !== true) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'Report delivery failed.');
  }
}

function safeText(value: unknown, max = 500) {
  return String(value || '').slice(0, max)
    .replace(/(?:Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,})\b/g, '[redacted key]');
}

export function FeedbackWidget({ expanded = true }: { expanded?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const seenErrors = useRef(new Set<string>());

  useEffect(() => {
    const reportError = (titleValue: string, descriptionValue: string) => {
      const title = safeText(titleValue, 160);
      const description = safeText(descriptionValue, 700);
      if (!description || seenErrors.current.has(description)) return;
      seenErrors.current.add(description);
      if (seenErrors.current.size > 20) {
        const first = seenErrors.current.values().next().value;
        if (first) seenErrors.current.delete(first);
      }
      void sendReport({
        kind: 'automatic_error',
        title,
        description,
        diagnostic: 'Captured by global browser error handler; stack and page content omitted.',
        environment: `feature=${safeText(window.location.hash.replace(/^#/, ''), 60)}; browser=${safeText(navigator.userAgent, 180)}`,
      }).catch(() => {
        // Telemetry is best-effort. Never create an error loop or interrupt the workspace.
      });
    };
    const onError = (event: ErrorEvent) => {
      reportError('Uncaught browser error', event.message || 'An uncaught browser error occurred.');
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unhandled promise rejection.';
      reportError('Unhandled promise rejection', message);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setStatus(null);
    try {
      await sendReport({
        kind,
        title: safeText(title.trim(), 120),
        description: safeText(description.trim(), 2200),
        environment: `feature=${safeText(window.location.hash.replace(/^#/, ''), 60)}; browser=${safeText(navigator.userAgent, 180)}`,
      });
      setStatus({ type: 'success', text: 'Thanks — your report was delivered to the Breezy team.' });
      setTitle('');
      setDescription('');
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Your report could not be delivered. Please try again later.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative w-full">
      {open && <section aria-label="Send feedback" className={`absolute z-[100] ${expanded ? "bottom-full left-0 mb-3" : "left-full bottom-0 ml-3"} w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4 shadow-2xl sm:p-5`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div><h2 className="font-headline-sm text-headline-sm text-on-surface">Help improve Breezy</h2><p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Reports go to the Breezy team. Don’t include API keys or private research.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close feedback" className="rounded-lg px-2 py-1 text-on-surface-variant hover:bg-surface-container-high">×</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setKind('bug')} aria-pressed={kind === 'bug'} className={`rounded-xl border px-3 py-2 font-label-md text-label-md ${kind === 'bug' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>Report a bug</button>
            <button type="button" onClick={() => setKind('suggestion')} aria-pressed={kind === 'suggestion'} className={`rounded-xl border px-3 py-2 font-label-md text-label-md ${kind === 'suggestion' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>Suggest an idea</button>
          </div>
          <label className="block font-label-md text-label-md text-on-surface">Short summary <span className="text-outline">(optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary" placeholder={kind === 'bug' ? 'e.g. Research gets stuck' : 'e.g. Add a keyboard shortcut'} />
          </label>
          <label className="block font-label-md text-label-md text-on-surface">What would you like us to know?
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={2200} rows={4} className="mt-1 w-full resize-y rounded-xl border border-outline-variant bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary" placeholder={kind === 'bug' ? 'What happened, and what did you expect?' : 'What would make Breezy better for you?'} />
          </label>
          <p className="font-body-sm text-body-sm text-on-surface-variant">We attach only the current workspace name and browser user-agent. We do not attach chat or research content.</p>
          {status && <p role="status" aria-live="polite" className={`rounded-lg px-3 py-2 font-body-sm text-body-sm ${status.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}`}>{status.text}</p>}
          <button type="submit" disabled={sending || !description.trim()} className="w-full rounded-xl bg-primary px-4 py-2.5 font-label-md text-label-md text-on-primary disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Sending…' : kind === 'bug' ? 'Send bug report' : 'Send suggestion'}</button>
        </form>
      </section>}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Report a bug or suggest an idea" className={`flex items-center gap-2 border border-outline-variant/50 bg-surface-container-high font-label-md text-label-md text-on-surface transition hover:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${expanded ? "w-full rounded-xl px-3 py-2.5 justify-start" : "mx-auto h-11 w-11 justify-center rounded-full px-0 py-0"}`}>
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">feedback</span>{expanded && <span>Send feedback</span>}
      </button>
    </div>
  );
}
