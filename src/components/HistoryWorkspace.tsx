import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../shell/Icon';
import { Page } from '../ui/Page';
import { researchStore, useResearch } from '../lib/researchStore';
import { formatDuration, timeAgo } from '../lib/research';
import * as ex from '../utils/exportTranscript';

const FORMATS: Array<[string, string, (s: any) => void]> = [
  ['Synthesis (Markdown)', 'article', ex.exportSynthexisAsMarkdown], ['Full transcript (Markdown)', 'subject', ex.exportTranscriptAsMarkdown],
  ['Plain text', 'notes', ex.exportTranscriptAsText], ['JSON', 'data_object', ex.exportTranscriptAsJson],
  ['Synthesis (PDF)', 'picture_as_pdf', ex.exportSynthexisAsPdf], ['Full transcript (PDF)', 'picture_as_pdf', ex.exportFullTranscriptAsPdf],
];
const CANVAS_KEY = 'breezy_canvas_cards_v1';
const STATUS: Record<string, [string, string]> = { completed: ['bg-tertiary', 'Completed'], running: ['bg-primary animate-pulse', 'Running'], error: ['bg-error', 'Stopped'], idle: ['bg-outline', 'Not finished'] };

export const HistoryWorkspace: React.FC = () => {
  const r = useResearch(); const [q, setQ] = useState(() => { try { return sessionStorage.getItem('breezy:history-q') || ''; } catch { return ''; } });
  const [menu, setMenu] = useState<string | null>(null); const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { researchStore.refreshSessions(); const on = () => { try { setQ(sessionStorage.getItem('breezy:history-q') || ''); } catch { /* ignore */ } }; window.addEventListener('breezy:history-q', on); return () => window.removeEventListener('breezy:history-q', on); }, []);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return r.sessions.filter((s) => !t || s.prompt.toLowerCase().includes(t) || (s.finalOutput || '').toLowerCase().includes(t)); }, [r.sessions, q]);
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2500); };
  const open = (id: string) => { researchStore.open(id); window.location.hash = '#research'; };
  const pin = (s: any) => { try { const cards = JSON.parse(localStorage.getItem(CANVAS_KEY) || '[]'); localStorage.setItem(CANVAS_KEY, JSON.stringify([{ id: `pin-${s.id}-${Date.now()}`, type: 'research', title: s.prompt.slice(0, 120), content: (s.finalOutput || '').slice(0, 1500), tags: ['Research', s.protocol], sourceSessionId: s.id, createdAt: Date.now() }, ...cards])); say('Pinned to Canvas.'); } catch { say('Could not pin.'); } };
  const del = (id: string) => { if (window.confirm('Delete this session from this device?')) researchStore.remove(id); };

  return (
    <Page crumb="History" title="History" subtitle="Every research run saved on this device."
      right={r.sessions.length > 0 ? <button type="button" onClick={() => { if (window.confirm(`Delete all ${r.sessions.length} sessions from this device?`)) researchStore.clearAll(); }} className="px-space-md min-h-[40px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-error font-label-md text-label-md transition-colors">Clear all</button> : undefined}>
      <label className="flex items-center gap-space-sm bg-surface-container rounded-2xl hairline px-space-md min-h-[48px] focus-within:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]"><Icon name="search" className="text-[20px] text-outline" /><input value={q} onChange={(e) => { setQ(e.target.value); try { sessionStorage.setItem('breezy:history-q', e.target.value); } catch { /* ignore */ } }} placeholder="Search questions and answers" aria-label="Search history" className="flex-1 min-w-0 bg-transparent font-body-md text-body-md focus:outline-none placeholder:text-outline" />{q && <button type="button" aria-label="Clear search" onClick={() => { setQ(''); try { sessionStorage.removeItem('breezy:history-q'); } catch { /* ignore */ } }} className="p-1 text-outline hover:text-on-surface"><Icon name="close" className="text-[18px]" /></button>}</label>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-space-md py-space-xl bg-surface-container-low/70 rounded-3xl"><Icon name="history" className="text-[44px] text-outline-variant" /><div><h2 className="font-headline-md text-headline-md">{r.sessions.length ? 'No matches' : 'Nothing here yet'}</h2><p className="font-body-md text-body-md text-on-surface-variant mt-1">{r.sessions.length ? 'Try a different search.' : 'Finished research runs appear here, saved on this device.'}</p></div>
          {!r.sessions.length && <a href="#research" className="px-space-lg min-h-[44px] flex items-center rounded-xl bg-primary text-on-primary font-label-md text-label-md">Start a research run</a>}</div>
      ) : (
        <ul className="flex flex-col gap-space-sm pb-space-xl">{shown.map((s) => { const [dot, label] = STATUS[s.status] || STATUS.idle; const dur = formatDuration(s.researchMetrics?.durationMs ?? s.metrics?.durationMs); const src = s.evidenceGraph?.sourcesConsulted?.length || 0; return (
          <li key={s.id} className="bg-surface-container rounded-3xl coat p-space-lg relative">
            <button type="button" onClick={() => open(s.id)} className="text-left w-full min-h-[48px]"><div className="flex items-center gap-space-sm font-code-sm text-code-sm text-outline"><span className={`w-1.5 h-1.5 rounded-circle ${dot}`} /><span>{label}</span><span className="text-outline-variant">·</span><span>{timeAgo(s.updatedAt || s.createdAt)}</span><span className="text-outline-variant hidden sm:inline">·</span><span className="hidden sm:inline">{s.protocol === 'solo' ? 'Solo' : s.protocol === 'quad' ? 'Deep' : 'Standard'}</span>{dur && <span className="hidden sm:inline">· {dur}</span>}{src > 0 && <span className="hidden sm:inline">· {src} sources</span>}</div>
              <h2 className="font-headline-sm text-headline-sm mt-1 line-clamp-2">{s.prompt}</h2>{s.finalOutput && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">{s.finalOutput.replace(/[#*`>_-]/g, '').trim()}</p>}{s.status === 'error' && s.error && <p className="font-body-sm text-body-sm text-error mt-1 line-clamp-1">{s.error}</p>}</button>
            <div className="flex flex-wrap items-center gap-space-xs mt-space-md">
              <button type="button" onClick={() => open(s.id)} className="flex items-center gap-1 px-space-md min-h-[36px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md transition-colors"><Icon name="open_in_new" className="text-[16px]" />Open</button>
              <div className="relative"><button type="button" aria-haspopup="menu" aria-expanded={menu === s.id} onClick={() => setMenu(menu === s.id ? null : s.id)} className="flex items-center gap-1 px-space-md min-h-[36px] rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md transition-colors"><Icon name="download" className="text-[16px]" />Export<Icon name="expand_more" className="text-[16px]" /></button>
                {menu === s.id && (<><button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(null)} /><div role="menu" className="absolute z-40 left-0 mt-1 w-60 bg-surface-container-highest rounded-2xl p-space-xs shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)]">{FORMATS.map(([l, ic, fn]) => <button key={l} role="menuitem" type="button" disabled={!s.finalOutput && l.startsWith('Synthesis')} onClick={() => { fn(s); setMenu(null); }} className="w-full flex items-center gap-space-sm px-space-md min-h-[40px] rounded-xl text-left font-body-sm text-body-sm hover:bg-surface-container-high disabled:opacity-40"><Icon name={ic} className="text-[18px] text-outline" />{l}</button>)}</div></>)}</div>
              {s.finalOutput && <button type="button" onClick={() => pin(s)} className="flex items-center gap-1 px-space-md min-h-[36px] rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md transition-colors"><Icon name="draw" className="text-[16px]" />Pin</button>}
              <button type="button" onClick={() => del(s.id)} aria-label="Delete session" className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg text-outline hover:text-error hover:bg-surface-container-high transition-colors"><Icon name="delete" className="text-[18px]" /></button></div>
          </li>); })}</ul>)}
      {toast && <div role="status" className="fixed z-[90] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-space-xl px-space-lg py-space-sm bg-surface-container-highest rounded-xl font-body-sm text-body-sm shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)]">{toast}</div>}
    </Page>
  );
};
