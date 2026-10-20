import { accountStorage } from '../services/accountStorage';
import React, { useEffect, useRef, useState } from 'react';
import type { Attachment, DebateSession } from '../types';
import { Icon } from '../shell/Icon';
import { Markdown } from '../ui/Markdown';
import { researchStore, useResearch } from '../lib/researchStore';
import { Depth, DEPTH_PROTOCOL, Stage, deriveStages, formatDuration } from '../lib/research';
import { RESEARCH_STARTERS } from '../lib/starters';
import { RESEARCH_METHODS } from '../lib/providers';
import { readAttachment } from '../lib/files';
import { useElapsed } from '../lib/useElapsed';
import { useModelState, announceConfigChange } from '../lib/useModelState';
import { providerConfigService } from '../services/providerConfigService';
import { exportSynthexisAsMarkdown } from '../utils/exportTranscript';

const CANVAS_KEY = 'breezy_canvas_cards_v1';
const SEATS = [{ id: 'architect', label: 'Analyst' }, { id: 'skeptic', label: 'Critic' }, { id: 'verifier', label: 'Verifier' }, { id: 'arbiter', label: 'Synthesizer' }] as const;
const DEPTH_ICON: Record<Depth, string> = { solo: 'person', standard: 'speed', deep: 'radar' };

function Stepper({ stages }: { stages: Stage[] }) {
  const current = stages.find((s) => s.state === 'active') || [...stages].reverse().find((s) => s.state === 'done') || stages[0];
  return (
    <div className="w-full max-w-3xl mx-auto">
      <ol className="relative flex items-start justify-between">
        <div className="absolute left-[8%] right-[8%] top-[18px] h-px bg-surface-container-highest" aria-hidden />
        {stages.map((s) => {
          const tone = s.state === 'done' ? 'bg-tertiary-container text-on-tertiary-container' : s.state === 'active' ? 'bg-surface-container-high text-primary ring-1 ring-primary/60 glow-primary' : s.state === 'error' ? 'bg-error-container text-on-error-container' : s.state === 'skipped' ? 'bg-surface-container-low text-outline-variant' : 'bg-surface-container text-outline';
          return (
            <li key={s.id} className="relative z-10 flex flex-col items-center gap-space-xs flex-1 min-w-0" title={s.description + (s.state === 'skipped' ? ' (not part of this depth)' : '')}>
              <span className={`w-9 h-9 rounded-circle flex items-center justify-center ${tone}`}><Icon name={s.state === 'done' ? 'check' : s.icon} className={`text-[18px] ${s.state === 'active' ? 'animate-pulse' : ''}`} /></span>
              <span className={`hidden sm:block font-code-sm text-code-sm ${s.state === 'active' ? 'text-primary' : s.state === 'done' ? 'text-tertiary' : 'text-outline'} ${s.state === 'skipped' ? 'line-through' : ''}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="sm:hidden text-center mt-space-sm font-code-sm text-code-sm text-primary">{current.label} <span className="text-outline">· {current.description}</span></p>
    </div>
  );
}

const Chip = ({ children, tone = 'text-on-surface' }: { children: React.ReactNode; tone?: string }) => (
  <span className={`inline-flex items-center gap-space-xs px-space-sm py-1 rounded-lg bg-surface-container-low font-code-sm text-code-sm ${tone}`}>{children}</span>
);

function Results({ s, running, events, plan, warnings }: { s: DebateSession; running: boolean; events: any[]; plan: any; warnings: string[] }) {
  const g = s.evidenceGraph; const m = s.researchMetrics; const dur = formatDuration(m?.durationMs ?? s.metrics?.durationMs);
  const stepsWithContent = s.steps.filter((x) => x.content || x.status === 'running');
  const claimStyle = { supported: ['check_circle', 'text-tertiary'], contradicted: ['cancel', 'text-error'], unresolved: ['warning', 'text-[#F59E0B]'] } as const;
  const act = [
    ['content_copy', 'Copy', () => { void navigator.clipboard.writeText(s.finalOutput || '').then(() => researchStore.notify('Copied.')).catch(() => researchStore.notify('Copy failed.')); }],
    ['download', 'Export', () => exportSynthexisAsMarkdown(s as any)],
    ['draw', 'Pin to Canvas', () => { try { const ex = JSON.parse(accountStorage.getItem(CANVAS_KEY) || '[]'); accountStorage.setItem(CANVAS_KEY, JSON.stringify([{ id: `pin-${s.id}-${Date.now()}`, type: 'research', title: s.prompt.slice(0, 120), content: (s.finalOutput || '').slice(0, 1500), tags: ['Research', s.protocol], sourceSessionId: s.id, createdAt: Date.now() }, ...ex])); researchStore.notify('Pinned to Canvas.'); } catch { researchStore.notify('Could not pin.'); } }],
    ['description', 'Google Docs', () => void researchStore.saveToGoogleDocs(s.id)],
    ['replay', 'Run again', () => void researchStore.start(s.prompt, researchStore.get().draft.depth)],
  ] as const;
  return (
    <div className="flex flex-col gap-space-lg">
      {warnings.map((w, i) => <div key={i} className="flex gap-space-sm items-start bg-surface-container-low rounded-xl p-space-md text-[#F59E0B] font-body-sm text-body-sm"><Icon name="warning" className="text-[20px] shrink-0" /><span>{w}</span></div>)}
      {s.status === 'error' && s.error && <div className="flex gap-space-sm items-start bg-error-container/30 rounded-xl p-space-md text-error font-body-sm text-body-sm"><Icon name="error" className="text-[20px] shrink-0" /><span>{s.error}</span></div>}
      {s.finalOutput && (
        <section className="bg-surface-container rounded-3xl coat p-space-lg lg:p-space-xl flex flex-col gap-space-md">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <h2 className="font-headline-md text-headline-md">Synthesis</h2>
            <div className="flex flex-wrap gap-space-xs">{act.map(([ic, label, fn]) => (
              <button key={label} type="button" onClick={fn} className="flex items-center gap-space-xs px-space-sm min-h-[36px] rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors"><Icon name={ic} className="text-[16px]" />{label}</button>))}</div>
          </div>
          <div className="flex flex-wrap gap-space-xs">
            {dur && <Chip><span className="text-outline">Duration</span>{dur}</Chip>}
            {m && <><Chip><span className="text-outline">Sources</span>{m.sourcesConsulted}</Chip><Chip tone="text-tertiary"><span className="text-outline">Supported</span>{m.claimsSupported}/{m.claimsIdentified}</Chip>{m.claimsContradicted ? <Chip tone="text-error"><span className="text-outline">Contradicted</span>{m.claimsContradicted}</Chip> : null}</>}
            {s.usage?.totalTokens ? <Chip><span className="text-outline">Tokens</span>{s.usage.totalTokens.toLocaleString()}{s.usage.estimated ? ' (est.)' : ''}</Chip> : null}
          </div>
          <div className="max-w-3xl"><Markdown>{s.finalOutput}</Markdown></div>
        </section>
      )}
      {g && (g.claims?.length > 0 || g.sourcesConsulted?.length > 0) && (
        <section className="bg-surface-container rounded-3xl p-space-lg flex flex-col gap-space-md">
          <div className="flex items-center justify-between"><h2 className="font-headline-md text-headline-md">Evidence</h2><span className="font-code-sm text-code-sm text-outline">{g.sourcesConsulted.length} sources · {g.claims.length} claims</span></div>
          {g.claims.length > 0 && <ul className="flex flex-col gap-space-sm">{g.claims.map((c) => { const [ic, tone] = claimStyle[c.status] || claimStyle.unresolved; return (
            <li key={c.id} className="bg-surface-container-low rounded-xl p-space-md flex gap-space-md"><Icon name={ic} className={`${tone} text-[20px] shrink-0`} /><div className="min-w-0"><p className="font-body-sm text-body-sm">{c.claim}</p><p className="font-code-sm text-code-sm text-outline mt-1">{c.status}{typeof c.confidence === 'number' ? ` · confidence ${Math.round(c.confidence)}%` : ''} · {c.supportingSources?.length || 0} supporting · {c.counterEvidence?.length || 0} counter</p></div></li>); })}</ul>}
          {g.sourcesConsulted.length > 0 && <div className="flex flex-wrap gap-space-xs">{g.sourcesConsulted.map((x) => (
            <a key={x.id || x.url} href={x.url} target="_blank" rel="noreferrer noopener" title={x.title} className="flex items-center gap-space-xs px-space-sm py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors max-w-full"><Icon name="link" className="text-[14px] text-secondary" /><span className="font-code-sm text-code-sm text-on-surface-variant truncate">{x.domain || x.url}</span></a>))}</div>}
        </section>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-space-lg">
        <div className="lg:col-span-3 flex flex-col gap-space-sm min-w-0">
          <h2 className="font-headline-sm text-headline-sm px-space-xs">{s.finalOutput ? 'Stage outputs' : 'Live output'}</h2>
          {stepsWithContent.map((st) => (
            <details key={st.stepId} open={st.status === 'running'} className="group bg-surface-container-low rounded-2xl">
              <summary className="flex items-center gap-space-sm px-space-lg py-space-md cursor-pointer list-none min-h-[48px]">
                <span className={`w-1.5 h-1.5 rounded-circle shrink-0 ${st.status === 'completed' ? 'bg-tertiary' : st.status === 'running' ? 'bg-primary animate-pulse' : st.status === 'error' ? 'bg-error' : 'bg-outline'}`} />
                <span className="font-headline-sm text-headline-sm">{st.agentName}</span>{st.model && <span className="font-code-sm text-code-sm text-outline truncate">{st.model}</span>}
                <span className="ml-auto font-code-sm text-code-sm text-on-surface-variant">{st.status}</span><Icon name="expand_more" className="text-outline group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-space-lg pb-space-lg"><Markdown>{st.content || '_Waiting for the first tokens…_'}</Markdown></div>
            </details>))}
          {!stepsWithContent.length && <div className="bg-surface-container-low rounded-2xl p-space-lg font-body-sm text-body-sm text-on-surface-variant">{running ? 'Waiting for the first model output…' : 'No output was produced.'}</div>}
        </div>
        <div className="lg:col-span-2 flex flex-col gap-space-sm min-w-0">
          <h2 className="font-headline-sm text-headline-sm px-space-xs">Run log</h2>
          <div className="bg-surface-container-low rounded-2xl p-space-md max-h-80 overflow-y-auto flex flex-col gap-1.5">
            {plan?.plan?.length > 0 && <div className="pb-space-sm mb-space-xs border-b border-outline-variant/30"><p className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1">Research plan{plan.method ? ` · ${plan.method}` : ''}</p><ol className="list-decimal pl-space-lg font-body-sm text-body-sm text-on-surface-variant space-y-0.5">{plan.plan.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol></div>}
            {!events.length && <span className="font-code-sm text-code-sm text-outline">Events appear here while a run is active in this session.</span>}
            {events.map((e, i) => <div key={i} className="flex gap-space-sm font-code-sm text-code-sm"><span className="text-outline-variant shrink-0">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span><span className={e.kind === 'error' ? 'text-error' : e.kind === 'warn' ? 'text-[#F59E0B]' : e.kind === 'done' ? 'text-tertiary' : 'text-on-surface-variant'}>{e.message}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ResearchWorkspace: React.FC<{ initialPrompt?: string }> = ({ initialPrompt = '' }) => {
  const r = useResearch(); const model = useModelState(); const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Attachment[]>([]); const elapsed = useElapsed(r.startedAt, r.running);
  const { query, depth } = r.draft; const s = r.active; const cfg = model.config;
  useEffect(() => { researchStore.refreshSessions(); }, []);
  useEffect(() => { if (initialPrompt) researchStore.setDraft({ query: initialPrompt }); }, [initialPrompt]);

  const canRun = model.routable || model.serverGemini || providerConfigService.getConfiguredProviders().length > 0;
  const stages = deriveStages(s, r.running, r.explorationSeen);
  const submit = async () => {
    if (r.running) return researchStore.stop();
    const res = await researchStore.start(query, depth, files); setFiles([]);
    if (res === 'no-model') { researchStore.notify('No model connected. Add a provider in Models first.'); window.location.hash = '#models'; }
  };
  const onFiles = async (list: FileList) => { for (const f of Array.from(list)) { try { const a = await readAttachment(f); setFiles((x) => [...x, a]); } catch (e: any) { researchStore.notify(e?.message || `Could not read ${f.name}.`); } } };
  const setMethod = (m: string) => { providerConfigService.saveConfig({ ...providerConfigService.getConfig(), researchMethod: m as any }); announceConfigChange(); };
  const heading = r.running ? 'Synthesis in progress' : s?.status === 'completed' ? 'Synthesis complete' : s?.status === 'error' ? 'Synthesis stopped' : 'No active synthesis';
  const sub = r.running ? 'Breezy is working through the pipeline with your configured models.' : s?.status === 'completed' ? 'Saved to History on this device.' : s?.status === 'error' ? (s.error || 'The run stopped with an error.') : canRun ? 'Submit an inquiry above to run exploration, challenge and synthesis.' : 'Connect a model in Models, then submit an inquiry above.';
  const statusDot = r.running ? 'bg-primary animate-pulse' : canRun ? 'bg-tertiary' : 'bg-outline';

  return (
    <div className="w-full max-w-5xl mx-auto px-gutter lg:px-space-lg py-space-lg lg:py-space-xl flex flex-col gap-space-lg lg:gap-space-xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="min-w-0">
          <div className="hidden lg:flex items-center gap-space-sm font-code-sm text-code-sm uppercase tracking-wider text-outline min-w-0"><span>Workspace / Research</span><span className="text-outline-variant">/</span><span className="text-primary truncate normal-case">{s ? s.prompt : 'No active run'}</span></div>
          <h1 className="font-headline-xl-mobile lg:font-headline-xl text-headline-xl-mobile lg:text-headline-xl tracking-tight mt-1">Research Workspace</h1>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <span className="flex items-center gap-space-sm px-space-md py-space-xs rounded-full bg-surface-container-high font-label-md text-label-md"><span className={`w-2 h-2 rounded-circle ${statusDot}`} />{r.running ? 'Run in progress' : canRun ? 'Model available' : 'No model connected'}<span className="text-outline-variant">·</span><span className="font-code-sm text-code-sm text-on-surface-variant truncate max-w-[180px]">{elapsed ?? (canRun ? (model.routable ? model.label : 'Server Gemini') : 'Open Models')}</span></span>
          <span className="hidden xl:flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-surface-container font-code-sm text-code-sm text-outline"><Icon name="travel_explore" className="text-[14px]" />Search: {model.searchEngine}</span>
        </div>
      </div>

      <section className="relative bg-surface-container rounded-3xl coat p-space-lg">
        <div className="pointer-events-none absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center justify-between pb-space-md">
          <label htmlFor="inquiry" className="flex items-center gap-space-sm text-primary font-code-sm text-code-sm uppercase tracking-wide font-semibold"><Icon name="neurology" className="text-[20px]" />Inquiry formulation</label>
          <span className="hidden sm:inline font-code-sm text-code-sm text-outline">Markdown output</span>
        </div>
        <div className="bg-surface-container-low rounded-2xl focus-within:bg-surface-container-lowest transition-colors hairline focus-within:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.45)]">
          <textarea id="inquiry" rows={4} value={query} disabled={r.running} onChange={(e) => researchStore.setDraft({ query: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (query.trim()) void submit(); } }}
            placeholder="State your research question or hypothesis…" className="w-full bg-transparent px-space-md py-space-md font-body-lg text-body-lg placeholder:text-outline focus:outline-none resize-none disabled:opacity-60" />
          <div className="px-space-md pb-space-sm flex items-center justify-between font-code-sm text-code-sm text-outline-variant"><span>{query.trim() ? `${query.length} characters` : 'Awaiting statement'}</span><span className="hidden sm:flex items-center gap-1 text-outline"><kbd className="bg-surface-container px-1 rounded">Shift</kbd>+<kbd className="bg-surface-container px-1 rounded">Return</kbd> newline</span></div>
        </div>
        {files.length > 0 && <div className="flex flex-wrap gap-space-xs pt-space-md">{files.map((a) => <span key={a.id} className="flex items-center gap-space-xs pl-space-sm pr-1 py-1 rounded-lg bg-surface-container-high font-code-sm text-code-sm text-on-surface-variant"><Icon name={a.fileType === 'pdf' ? 'picture_as_pdf' : 'description'} className="text-[14px] text-secondary" /><span className="truncate max-w-[180px]">{a.fileName}</span><button type="button" aria-label={`Remove ${a.fileName}`} onClick={() => setFiles((x) => x.filter((f) => f.id !== a.id))} className="p-0.5 rounded hover:bg-surface-container-highest"><Icon name="close" className="text-[14px]" /></button></span>)}</div>}
        <div className="pt-space-md flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="flex p-1 rounded-xl bg-surface-container-low" role="group" aria-label="Depth">{(Object.keys(DEPTH_PROTOCOL) as Depth[]).map((d) => (
              <button key={d} type="button" disabled={r.running} aria-pressed={depth === d} title={DEPTH_PROTOCOL[d].blurb} onClick={() => researchStore.setDraft({ depth: d })} className={`px-3 min-h-[40px] rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-all ${depth === d ? 'bg-surface-container-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}><Icon name={DEPTH_ICON[d]} className={`text-[16px] ${depth === d ? 'text-primary' : ''}`} />{DEPTH_PROTOCOL[d].label}</button>))}</div>
            <label className="flex items-center gap-space-xs bg-surface-container-low rounded-xl px-space-sm min-h-[48px]"><Icon name="fact_check" className="text-[16px] text-tertiary" /><span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Method</span>
              <select aria-label="Research method" value={cfg.researchMethod || 'adaptive'} disabled={r.running} onChange={(e) => setMethod(e.target.value)} className="bg-transparent font-label-md text-label-md focus:outline-none capitalize cursor-pointer">{RESEARCH_METHODS.map((m) => <option key={m} value={m} className="bg-surface-container-high capitalize">{m}</option>)}</select></label>
            <button type="button" disabled={r.running} onClick={() => fileRef.current?.click()} className="flex items-center gap-space-xs bg-surface-container-low hover:bg-surface-container-high rounded-xl px-space-md min-h-[48px] text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors"><Icon name="attachment" className="text-[16px] text-secondary" />Attach</button>
          </div>
          <button type="button" onClick={() => void submit()} disabled={!r.running && !query.trim()} className="flex items-center justify-center gap-space-sm bg-primary hover:bg-primary-fixed text-on-primary font-headline-sm text-headline-sm px-space-lg min-h-[48px] rounded-2xl glow-primary transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"><span>{r.running ? 'Stop run' : 'Initiate Synthesis'}</span><Icon name={r.running ? 'stop_circle' : 'arrow_forward'} className="text-[20px]" /></button>
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.tsv,.html,.js,.ts,.tsx,.jsx,.py,.tex,.bib,text/*,application/pdf" className="hidden" onChange={(e) => { if (e.target.files?.length) void onFiles(e.target.files); e.target.value = ''; }} />
      </section>

      <section className="bg-surface-container-low/80 rounded-3xl p-space-lg lg:p-space-xl flex flex-col items-center text-center gap-space-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none [background-image:radial-gradient(circle_at_center,#4cd6fb_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative w-full"><Stepper stages={stages} /></div>
        <div className="relative max-w-xl"><h2 className="font-headline-md text-headline-md">{heading}</h2><p className="font-body-md text-body-md text-on-surface-variant mt-1">{sub}</p></div>
        {!s && (
          <div className="relative w-full max-w-3xl">
            <div className="flex items-center justify-center gap-space-xs mb-space-md text-outline font-label-sm text-label-sm uppercase tracking-wider"><Icon name="bolt" className="text-[14px]" />Starter prompts</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm text-left">{RESEARCH_STARTERS.map((st, i) => (
              <button key={st.id} type="button" onClick={() => researchStore.setDraft({ query: st.prompt })} className="group p-space-md min-h-[48px] bg-surface-container hover:bg-surface-container-high rounded-2xl transition-colors">
                <div className="flex items-center justify-between mb-space-xs"><span className={`font-code-sm text-code-sm ${['text-primary', 'text-secondary', 'text-tertiary'][i]}`}>Starter</span><Icon name="north_east" className="text-[16px] text-outline group-hover:text-primary transition-colors" /></div>
                <div className="font-headline-sm text-headline-sm">{st.title}</div><div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">{st.blurb}</div>
              </button>))}</div>
          </div>)}
      </section>

      {s && <Results s={s} running={r.running} events={r.events} plan={r.plan} warnings={r.warnings} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm font-code-sm text-code-sm pb-space-xl">
        {SEATS.map((seat) => { const c = cfg.roles[seat.id]; const m = c?.provider && c?.model ? c.model : null; return (
          <button key={seat.id} type="button" onClick={() => { window.location.hash = '#models'; }} className="flex items-center gap-space-sm bg-surface-container-low hover:bg-surface-container px-space-md min-h-[40px] rounded-full min-w-0 text-left transition-colors">
            <span className={`w-1.5 h-1.5 rounded-circle shrink-0 ${m ? 'bg-tertiary' : 'bg-outline'}`} /><span className="text-on-surface-variant shrink-0">{seat.label}:</span><span className={`ml-auto truncate ${m ? 'text-on-surface' : 'text-outline'}`}>{m || 'Not assigned'}</span>
          </button>); })}
      </div>
      {r.notice && <div role="status" className="fixed z-[90] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-space-xl max-w-[92vw] px-space-lg py-space-sm bg-surface-container-highest rounded-xl shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)] font-body-sm text-body-sm">{r.notice}</div>}
    </div>
  );
};
