import { accountStorage } from '../services/accountStorage';
import React, { useEffect, useRef, useState } from 'react';
import type { Attachment, DebateSession } from '../types';
import { Icon } from '../shell/Icon';
import { Markdown } from '../ui/Markdown';
import { researchStore, useResearch } from '../lib/researchStore';
import { Stage, deriveStages, formatDuration, DEPTH_PROTOCOL, type Depth } from '../lib/research';
import { RESEARCH_STARTERS } from '../lib/starters';
import { RESEARCH_METHODS } from '../lib/providers';
import { readAttachment } from '../lib/files';
import { useElapsed } from '../lib/useElapsed';
import { useModelState, announceConfigChange } from '../lib/useModelState';
import { providerConfigService } from '../services/providerConfigService';
import { exportSynthexisAsMarkdown } from '../utils/exportTranscript';
import { EvidenceMap } from './research/EvidenceMap';
import { safeEvidenceHref } from '../lib/evidenceMap';

const CANVAS_KEY = 'breezy_canvas_cards_v1';

function Stepper({ stages }: { stages: Stage[] }) {
  const current = stages.find((s) => s.state === 'active') || [...stages].reverse().find((s) => s.state === 'done') || stages[0];
  return (
    <div className="w-full max-w-3xl mx-auto">
      <ol className="relative flex items-start justify-between">
        <div className="absolute left-[8%] right-[8%] top-[18px] h-px bg-surface-container-highest" aria-hidden />
        {stages.map((s) => {
          const tone = s.state === 'done' ? 'bg-tertiary-container text-on-tertiary-container' : s.state === 'active' ? 'bg-surface-container-high text-primary ring-1 ring-primary/60 glow-primary' : s.state === 'error' ? 'bg-error-container text-on-error-container' : s.state === 'skipped' ? 'bg-surface-container-low text-outline-variant' : 'bg-surface-container text-outline';
          return (
            <li key={s.id} className="relative z-10 flex flex-col items-center gap-space-xs flex-1 min-w-0" title={s.description}>
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

type ResearchPanel = 'findings' | 'map' | 'activity';

function Results({ s, running, events, plan, warnings, panel, onPanelChange }: {
  s: DebateSession;
  running: boolean;
  events: Array<{ at: number; kind: string; message: string }>;
  plan: any;
  warnings: string[];
  panel: ResearchPanel;
  onPanelChange: (panel: ResearchPanel) => void;
}) {
  const g = s.evidenceGraph;
  const m = s.researchMetrics;
  const dur = formatDuration(m?.durationMs ?? s.metrics?.durationMs);
  const stepsWithContent = s.steps.filter((step) => step.content || step.status === 'running');
  const claims = g?.claims ?? [];
  const sources = g?.sourcesConsulted ?? [];
  const runIsActive = running && s.status === 'running';
  const wasInterrupted = !running && s.status === 'running';
  const actions = [
    ['content_copy', 'Copy', () => {
      void navigator.clipboard.writeText(s.finalOutput || '').then(() => researchStore.notify('Copied.')).catch(() => researchStore.notify('Copy failed.'));
    }],
    ['download', 'Export Markdown', () => exportSynthexisAsMarkdown(s as any)],
    ['draw', 'Pin to Canvas', () => {
      try {
        const existing = JSON.parse(accountStorage.getItem(CANVAS_KEY) || '[]');
        accountStorage.setItem(CANVAS_KEY, JSON.stringify([{
          id: `pin-${s.id}-${Date.now()}`,
          type: 'research',
          title: s.prompt.slice(0, 120),
          content: (s.finalOutput || '').slice(0, 1500),
          tags: ['Research', s.protocol],
          sourceSessionId: s.id,
          createdAt: Date.now(),
        }, ...existing]));
        researchStore.notify('Pinned to Canvas.');
      } catch {
        researchStore.notify('Could not pin.');
      }
    }],
    ['description', 'Google Docs', () => void researchStore.saveToGoogleDocs(s.id)],
    ['replay', 'Run again', () => void researchStore.start(s.prompt, researchStore.get().draft.depth)],
  ] as const;

  const tabs: Array<{ id: ResearchPanel; label: string; icon: string }> = [
    { id: 'findings', label: 'Findings', icon: 'article' },
    { id: 'map', label: 'Evidence map', icon: 'account_tree' },
    { id: 'activity', label: 'Activity', icon: 'timeline' },
  ];

  return (
    <section className="flex flex-col gap-space-md min-w-0">
      <div className="flex flex-col gap-space-md sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Investigation</p>
          <h2 className="mt-1 font-headline-md text-headline-md break-words">{s.prompt}</h2>
          <div className="mt-space-sm flex flex-wrap items-center gap-space-xs">
            <span className={`inline-flex items-center gap-space-xs rounded-full px-space-sm py-1 font-label-sm text-label-sm ${s.status === 'completed' ? 'bg-tertiary-container/50 text-tertiary' : s.status === 'error' ? 'bg-error-container/50 text-error' : runIsActive ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'completed' ? 'bg-tertiary' : s.status === 'error' ? 'bg-error' : runIsActive ? 'bg-primary animate-pulse' : 'bg-outline'}`} />
              {runIsActive ? 'Investigation running' : wasInterrupted ? 'Interrupted' : s.status === 'completed' ? 'Completed' : s.status === 'error' ? 'Failed' : 'Stopped'}
            </span>
            {dur && <Chip><span className="text-outline">Duration</span>{dur}</Chip>}
            {sources.length > 0 && <Chip><span className="text-outline">Sources found</span>{sources.length}</Chip>}
            {claims.length > 0 && <Chip><span className="text-outline">Claims extracted</span>{claims.length}</Chip>}
            {s.usage?.totalTokens ? <Chip><span className="text-outline">Tokens</span>{s.usage.totalTokens.toLocaleString()}{s.usage.estimated ? ' estimated' : ''}</Chip> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-space-xs shrink-0">
          {actions.map(([icon, label, action]) => (
            <button key={label} type="button" onClick={action} disabled={label === 'Run again' && running}
              className="inline-flex min-h-[38px] items-center gap-space-xs rounded-xl border border-outline-variant/50 bg-surface-container px-space-sm font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40">
              <Icon name={icon} className="text-[16px]" />{label}
            </button>
          ))}
        </div>
      </div>

      {warnings.map((warning, index) => (
        <div key={index} className="flex items-start gap-space-sm rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-space-md font-body-sm text-body-sm text-[#F59E0B]">
          <Icon name="warning" className="mt-0.5 shrink-0 text-[18px]" /><span>{warning}</span>
        </div>
      ))}
      {s.status === 'error' && s.error && (
        <div role="alert" className="flex items-start gap-space-sm rounded-xl border border-error/30 bg-error-container/20 p-space-md font-body-sm text-body-sm text-error">
          <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" /><span>{s.error}</span>
        </div>
      )}
      {(s.status === 'idle' || wasInterrupted) && !running && (
        <div role="status" className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="stop_circle" className="mt-0.5 shrink-0 text-[18px]" /><span>{wasInterrupted ? 'This session was saved while a run was active, but no live run is attached in this tab. Its partial output, if any, remains available below.' : 'This run was stopped. Its partial output, if any, remains available below.'}</span>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface-container-low p-1" role="tablist" aria-label="Investigation views">
        {tabs.map((tab) => (
          <button key={tab.id} id={`research-tab-${tab.id}`} type="button" role="tab" aria-selected={panel === tab.id} aria-controls={`research-panel-${tab.id}`} onClick={() => onPanelChange(tab.id)}
            className={`inline-flex min-h-[42px] shrink-0 items-center justify-center gap-space-xs rounded-xl px-space-md font-label-md text-label-md transition-colors ${panel === tab.id ? 'bg-surface-container-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}>
            <Icon name={tab.icon} className="text-[18px]" />{tab.label}
            {tab.id === 'map' && <span className="rounded-full bg-surface-container px-1.5 py-0.5 font-code-sm text-code-sm">{claims.length + sources.length}</span>}
          </button>
        ))}
      </div>

      {panel === 'findings' && (
        <div id="research-panel-findings" role="tabpanel" aria-labelledby="research-tab-findings" className="flex flex-col gap-space-md min-w-0">
          {s.finalOutput ? (
            <article className="min-w-0 rounded-3xl border border-outline-variant/40 bg-surface-container p-space-lg sm:p-space-xl">
              <div className="mb-space-md flex items-center gap-space-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name="auto_awesome" className="text-[20px]" /></span>
                <div><h3 className="font-headline-sm text-headline-sm">Research findings</h3><p className="font-body-sm text-body-sm text-on-surface-variant">The answer produced by this investigation</p></div>
              </div>
              <div className="max-w-4xl"><Markdown>{s.finalOutput}</Markdown></div>
            </article>
          ) : (
            <article className="rounded-3xl border border-outline-variant/40 bg-surface-container p-space-lg sm:p-space-xl">
              <div className="flex items-start gap-space-md">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${running ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-outline'}`}><Icon name={running ? 'travel_explore' : 'article'} className={`text-[22px] ${running ? 'animate-pulse' : ''}`} /></span>
                <div className="min-w-0">
                  <h3 className="font-headline-sm text-headline-sm">{running ? 'Investigating your question' : 'No final answer was produced'}</h3>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{running ? 'Breezy is processing the run. Open Activity to see events and stage output as they arrive.' : 'Check Activity for the last recorded events and any error details.'}</p>
                </div>
              </div>
              {running && <div className="mt-space-lg flex flex-col gap-space-sm">{stepsWithContent.map((step) => (
                <div key={step.stepId} className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${step.status === 'completed' ? 'bg-tertiary' : step.status === 'running' ? 'bg-primary animate-pulse' : step.status === 'error' ? 'bg-error' : 'bg-outline'}`} />
                  <span className="font-body-sm text-body-sm">{step.agentName}</span><span className="ml-auto font-code-sm text-code-sm text-outline">{step.status}</span>
                </div>
              ))}</div>}
            </article>
          )}

          {claims.length > 0 && (
            <section className="rounded-3xl border border-outline-variant/40 bg-surface-container p-space-lg">
              <div className="flex flex-col gap-space-xs sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-headline-sm text-headline-sm">Claims to inspect</h3><p className="font-body-sm text-body-sm text-on-surface-variant">Model-assisted labels, not independent verification.</p></div>
                <button type="button" onClick={() => onPanelChange('map')} className="inline-flex min-h-[40px] items-center gap-space-xs self-start rounded-xl px-space-sm font-label-md text-label-md text-primary hover:bg-surface-container-high">Explore evidence <Icon name="arrow_forward" className="text-[17px]" /></button>
              </div>
              <div className="mt-space-md grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                {claims.slice(0, 4).map((claim) => {
                  const status = claim.status === 'supported'
                    ? { label: 'Model-assessed support', icon: 'check_circle', tone: 'text-tertiary' }
                    : claim.status === 'contradicted'
                      ? { label: 'Model-assessed contradiction', icon: 'report', tone: 'text-error' }
                      : { label: 'Unresolved', icon: 'help', tone: 'text-[#F59E0B]' };
                  return <button key={claim.id} type="button" onClick={() => onPanelChange('map')} className="flex min-w-0 items-start gap-space-sm rounded-2xl bg-surface-container-low p-space-md text-left hover:bg-surface-container-high">
                    <Icon name={status.icon} className={`mt-0.5 shrink-0 text-[19px] ${status.tone}`} />
                    <span className="min-w-0"><span className="block font-body-sm text-body-sm text-on-surface">{claim.claim}</span><span className={`mt-1 block font-code-sm text-code-sm ${status.tone}`}>{status.label}</span></span>
                  </button>;
                })}
              </div>
            </section>
          )}

          {sources.length > 0 && (
            <section className="rounded-3xl border border-outline-variant/40 bg-surface-container p-space-lg">
              <div className="flex items-center justify-between gap-space-sm"><div><h3 className="font-headline-sm text-headline-sm">Sources discovered</h3><p className="font-body-sm text-body-sm text-on-surface-variant">Search-result records from this run; not proof that a claim is supported.</p></div><span className="font-code-sm text-code-sm text-outline">{sources.length}</span></div>
              <div className="mt-space-md grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                {sources.slice(0, 6).map((source) => {
                  const href = safeEvidenceHref(source.url);
                  const content = <><Icon name={href ? 'open_in_new' : 'description'} className="mt-0.5 shrink-0 text-[17px] text-secondary" /><span className="min-w-0"><span className="block break-words font-body-sm text-body-sm text-on-surface">{source.title || source.url || 'Untitled source'}</span><span className="mt-1 block truncate font-code-sm text-code-sm text-outline">{source.domain || source.url || 'URL unavailable'}</span>{source.snippet && <span className="mt-1 block line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{source.snippet}</span>}</span></>;
                  return href
                    ? <a key={source.id || source.url} href={href} target="_blank" rel="noreferrer noopener" className="flex min-w-0 items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md hover:bg-surface-container-high">{content}</a>
                    : <div key={source.id || source.title} className="flex min-w-0 items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">{content}</div>;
                })}
              </div>
              {sources.length > 6 && <button type="button" onClick={() => onPanelChange('map')} className="mt-space-md min-h-[40px] font-label-md text-label-md text-primary">View all sources in Evidence map</button>}
            </section>
          )}
          {!s.finalOutput && !claims.length && !sources.length && !running && <p className="rounded-xl border border-dashed border-outline-variant/50 p-space-lg font-body-sm text-on-surface-variant">No findings or source records were saved for this run.</p>}
        </div>
      )}

      {panel === 'map' && <div id="research-panel-map" role="tabpanel" aria-labelledby="research-tab-map"><EvidenceMap graph={g} /></div>}

      {panel === 'activity' && (
        <div id="research-panel-activity" role="tabpanel" aria-labelledby="research-tab-activity" className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] gap-space-md items-start">
          <section className="min-w-0 rounded-2xl border border-outline-variant/40 bg-surface-container p-space-lg">
            <div className="mb-space-lg"><h3 className="font-headline-sm text-headline-sm">Research stages</h3><p className="font-body-sm text-body-sm text-on-surface-variant">Progress reflects recorded stage events.</p></div>
            <Stepper stages={deriveStages(s, running, Boolean(plan))} />
            <div className="mt-space-xl flex flex-col gap-space-sm">
              {stepsWithContent.map((step) => (
                <details key={step.stepId} open={step.status === 'running'} className="group rounded-xl bg-surface-container-low">
                  <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-space-sm px-space-md py-space-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${step.status === 'completed' ? 'bg-tertiary' : step.status === 'running' ? 'bg-primary animate-pulse' : step.status === 'error' ? 'bg-error' : 'bg-outline'}`} />
                    <span className="min-w-0 font-body-sm text-body-sm">{step.agentName}</span>
                    {step.model && <span className="hidden sm:block max-w-[180px] truncate font-code-sm text-code-sm text-outline">{step.model}</span>}
                    <span className="ml-auto font-code-sm text-code-sm text-outline">{step.status}</span><Icon name="expand_more" className="text-[17px] text-outline group-open:rotate-180" />
                  </summary>
                  <div className="px-space-md pb-space-md"><Markdown>{step.content || (running ? '_Waiting for output…_' : '_No output recorded for this stage._')}</Markdown></div>
                </details>
              ))}
              {!stepsWithContent.length && <p className="font-body-sm text-body-sm text-on-surface-variant">{running ? 'Waiting for the first stage output.' : 'No stage output was recorded.'}</p>}
            </div>
          </section>
          <section className="min-w-0 rounded-2xl border border-outline-variant/40 bg-surface-container p-space-lg">
            <h3 className="font-headline-sm text-headline-sm">Activity log</h3>
            {plan?.plan?.length > 0 && <div className="mt-space-md rounded-xl bg-surface-container-low p-space-md"><p className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Research plan{plan.method ? ` · ${plan.method}` : ''}</p><ol className="mt-space-sm list-decimal space-y-1 pl-space-lg font-body-sm text-body-sm text-on-surface-variant">{plan.plan.map((item: string, index: number) => <li key={index}>{item}</li>)}</ol></div>}
            <div className="mt-space-md flex max-h-[560px] flex-col gap-space-sm overflow-y-auto">
              {events.length ? events.map((event, index) => <div key={index} className="flex min-w-0 gap-space-sm font-code-sm text-code-sm"><span className="shrink-0 text-outline-variant">{new Date(event.at).toLocaleTimeString([], { hour12: false })}</span><span className={`min-w-0 break-words ${event.kind === 'error' ? 'text-error' : event.kind === 'warn' ? 'text-[#F59E0B]' : event.kind === 'done' ? 'text-tertiary' : 'text-on-surface-variant'}`}>{event.message}</span></div>) : <p className="font-body-sm text-body-sm text-on-surface-variant">No activity events were recorded for this session.</p>}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export const ResearchWorkspace: React.FC<{ initialPrompt?: string }> = ({ initialPrompt = '' }) => {
  const r = useResearch();
  const model = useModelState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [panel, setPanel] = useState<ResearchPanel>('findings');
  const elapsed = useElapsed(r.startedAt, r.running);
  const { query, depth } = r.draft;
  const s = r.active;
  const cfg = model.config;

  useEffect(() => { researchStore.refreshSessions(); }, []);
  useEffect(() => { if (initialPrompt) researchStore.setDraft({ query: initialPrompt }); }, [initialPrompt]);
  useEffect(() => { setPanel('findings'); }, [s?.id]);

  const canRun = model.routable || model.serverGemini || providerConfigService.getConfiguredProviders().length > 0;
  const submit = async () => {
    if (r.running) return researchStore.stop();
    const result = await researchStore.start(query, depth, files);
    setFiles([]);
    if (result === 'no-model') {
      researchStore.notify('No model connected. Add a provider in Models first.');
      window.location.hash = '#models';
    }
  };
  const onFiles = async (list: FileList) => {
    for (const file of Array.from(list)) {
      try {
        const attachment = await readAttachment(file);
        setFiles((current) => [...current, attachment]);
      } catch (error: any) {
        researchStore.notify(error?.message || `Could not read ${file.name}.`);
      }
    }
  };
  const setMethod = (method: string) => {
    providerConfigService.saveConfig({ ...providerConfigService.getConfig(), researchMethod: method as any });
    announceConfigChange();
  };

  const statusLabel = r.running
    ? 'Investigation running'
    : s?.status === 'running'
      ? 'Previous run interrupted'
      : s?.status === 'completed'
      ? 'Completed'
      : s?.status === 'error'
        ? 'Run failed'
        : s?.status === 'idle'
          ? 'Stopped'
          : canRun
            ? 'Ready to investigate'
            : 'No model configured';
  const statusTone = r.running ? 'bg-primary' : s?.status === 'error' ? 'bg-error' : s?.status === 'completed' ? 'bg-tertiary' : canRun ? 'bg-secondary' : 'bg-outline';
  const recent = r.sessions.filter((session) => session.id !== s?.id).slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-space-lg px-gutter py-space-lg sm:gap-space-xl lg:px-space-xl lg:py-space-xl">
      <header className="flex min-w-0 flex-col gap-space-md sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-space-xs font-code-sm text-code-sm uppercase tracking-wider text-outline"><span>Workspace</span><Icon name="chevron_right" className="text-[14px]" /><span className="text-primary">Research</span></div>
          <h1 className="font-headline-xl-mobile text-headline-xl-mobile tracking-tight sm:font-headline-xl sm:text-headline-xl">Research</h1>
          <p className="mt-1 max-w-2xl font-body-md text-body-md text-on-surface-variant">Investigate a question, inspect the evidence, and keep the findings you need.</p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="inline-flex min-h-[36px] items-center gap-space-xs rounded-full border border-outline-variant/40 bg-surface-container px-space-md font-label-sm text-label-sm text-on-surface-variant" role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${statusTone} ${r.running ? 'animate-pulse' : ''}`} />
            {statusLabel}
          </span>
          {r.running && elapsed && <span className="font-code-sm text-code-sm text-outline">{elapsed}</span>}
        </div>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container p-space-md shadow-lg sm:p-space-lg lg:p-space-xl">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="flex items-start gap-space-md">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex"><Icon name="travel_explore" className="text-[24px]" /></span>
          <div className="min-w-0 flex-1">
            <label htmlFor="inquiry" className="block font-headline-sm text-headline-sm">What do you want to find out?</label>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Be specific about the question, constraints, or decision you're trying to make.</p>
          </div>
        </div>
        <div className="mt-space-md rounded-2xl border border-outline-variant/50 bg-surface-container-low focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20">
          <textarea id="inquiry" rows={4} value={query} disabled={r.running}
            onChange={(event) => researchStore.setDraft({ query: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (query.trim()) void submit(); } }}
            placeholder="e.g. Compare the best free databases for a small TypeScript app, including limits, licensing, and migration risks."
            className="w-full resize-y bg-transparent px-space-md py-space-md font-body-lg text-body-lg text-on-surface placeholder:text-outline focus:outline-none disabled:opacity-60 sm:px-space-lg" />
          <div className="flex flex-wrap items-center justify-between gap-space-sm border-t border-outline-variant/30 px-space-md py-space-sm font-code-sm text-code-sm text-outline sm:px-space-lg">
            <span>{query.trim() ? `${query.length} characters` : 'Start with a question or decision'}</span>
            <span className="hidden items-center gap-1 sm:flex"><kbd className="rounded bg-surface-container px-1.5 py-0.5">Enter</kbd> research · <kbd className="rounded bg-surface-container px-1.5 py-0.5">Shift + Enter</kbd> newline</span>
          </div>
        </div>

        {files.length > 0 && <div className="mt-space-md flex flex-wrap gap-space-xs">{files.map((file) => (
          <span key={file.id} className="inline-flex max-w-full items-center gap-space-xs rounded-xl bg-surface-container-high px-space-sm py-1.5 font-code-sm text-code-sm text-on-surface-variant">
            <Icon name={file.fileType === 'pdf' ? 'picture_as_pdf' : 'description'} className="shrink-0 text-[15px] text-secondary" /><span className="max-w-[180px] truncate">{file.fileName}</span>
            <button type="button" aria-label={`Remove ${file.fileName}`} onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} className="rounded p-0.5 hover:bg-surface-container-highest"><Icon name="close" className="text-[14px]" /></button>
          </span>
        ))}</div>}

        <div className="mt-space-md flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-space-sm">
            <label className="inline-flex min-h-[44px] items-center gap-space-xs rounded-xl border border-outline-variant/40 bg-surface-container-low px-space-md font-label-md text-label-md text-on-surface-variant">
              <Icon name="account_tree" className="text-[17px]" />
              <span className="sr-only">Research mode</span>
              <select aria-label="Research mode" value={r.draft.depth} disabled={r.running}
                onChange={(event) => researchStore.setDraft({ depth: event.target.value as Depth })}
                className="max-w-[140px] bg-transparent font-label-md text-label-md text-on-surface outline-none">
                {Object.entries(DEPTH_PROTOCOL).map(([depth, option]) => <option key={depth} value={depth} className="bg-surface-container">{option.label}</option>)}
              </select>
            </label>
            <button type="button" disabled={r.running} onClick={() => fileRef.current?.click()} className="inline-flex min-h-[44px] items-center gap-space-xs rounded-xl border border-outline-variant/40 bg-surface-container-low px-space-md font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50">
              <Icon name="attach_file" className="text-[17px]" />Attach files
            </button>
            <details className="relative">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-space-xs rounded-xl px-space-md font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
                <Icon name="tune" className="text-[17px]" />Advanced options <Icon name="expand_more" className="text-[16px]" />
              </summary>
              <div className="mt-space-xs w-full rounded-2xl border border-outline-variant/50 bg-surface-container-low p-space-md sm:absolute sm:right-0 sm:z-20 sm:w-80 sm:shadow-xl">
                <label className="block font-label-sm text-label-sm text-on-surface-variant" htmlFor="research-method">Research method</label>
                <select id="research-method" aria-label="Research method" value={cfg.researchMethod || 'adaptive'} disabled={r.running} onChange={(event) => setMethod(event.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-outline-variant/40 bg-surface-container px-space-sm font-body-sm text-body-sm capitalize">
                  {RESEARCH_METHODS.map((method) => <option key={method} value={method} className="capitalize">{method}</option>)}
                </select>
                <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">{DEPTH_PROTOCOL[r.draft.depth].blurb}. Solo uses one model call; Trio runs analyst → critic → synthesizer; Deep adds a verifier before synthesis. Multi-stage modes make more provider calls and may use more tokens. Each stage uses the model assigned to its seat.</p>
                <div className="mt-space-md border-t border-outline-variant/30 pt-space-md">
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Configured research seats</p>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface">{(['architect', ...(r.draft.depth === 'solo' ? [] : ['skeptic']), ...(r.draft.depth === 'deep' ? ['verifier'] : []), ...(r.draft.depth === 'solo' ? [] : ['arbiter'])] as const).map((role) => { const seat = cfg.roles?.[role]; const provider = seat?.provider || (role === 'architect' ? cfg.defaultProvider : ''); const model = seat?.model || (role === 'architect' ? cfg.defaultModel : ''); const name = role === 'architect' ? 'Analyst' : role === 'skeptic' ? 'Critic' : role === 'verifier' ? 'Verifier' : 'Synthesizer'; return `${name}: ${provider && model ? `${provider} · ${model}` : 'not configured'}`; }).join('  |  ')}</p>
                  <button type="button" onClick={() => { window.location.hash = '#models'; }} className="mt-space-sm min-h-[36px] font-label-md text-label-md text-primary">Configure model <Icon name="arrow_forward" className="text-[16px] align-middle" /></button>
                </div>
              </div>
            </details>
          </div>
          <button type="button" onClick={() => void submit()} disabled={!r.running && !query.trim()}
            className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-space-sm rounded-2xl px-space-lg font-headline-sm text-headline-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${r.running ? 'border border-error/30 bg-error-container/30 text-error hover:bg-error-container/50' : 'bg-primary text-on-primary shadow-md shadow-primary/10 hover:brightness-110'}`}>
            <Icon name={r.running ? 'stop_circle' : 'arrow_forward'} className="text-[20px]" />{r.running ? 'Stop research' : 'Start research'}
          </button>
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.tsv,.html,.js,.ts,.tsx,.jsx,.py,.tex,.bib,text/*,application/pdf" className="hidden"
          onChange={(event) => { if (event.target.files?.length) void onFiles(event.target.files); event.target.value = ''; }} />
      </section>

      {!s && !r.running && (
        <section className="grid grid-cols-1 gap-space-md lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="rounded-3xl border border-outline-variant/40 bg-surface-container p-space-lg sm:p-space-xl">
            <div className="mb-space-md flex items-center gap-space-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><Icon name="lightbulb" className="text-[20px]" /></span><div><h2 className="font-headline-sm text-headline-sm">Start with a direction</h2><p className="font-body-sm text-body-sm text-on-surface-variant">Choose a prompt to shape your question.</p></div></div>
            <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
              {RESEARCH_STARTERS.map((starter) => <button key={starter.id} type="button" onClick={() => researchStore.setDraft({ query: starter.prompt })}
                className="group min-w-0 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-space-md text-left transition-colors hover:border-primary/40 hover:bg-surface-container-high">
                <span className="flex items-center justify-between gap-space-sm"><span className="font-headline-sm text-headline-sm">{starter.title}</span><Icon name="north_east" className="shrink-0 text-[16px] text-outline group-hover:text-primary" /></span>
                <span className="mt-1 block font-body-sm text-body-sm text-on-surface-variant">{starter.blurb}</span>
              </button>)}
            </div>
          </div>
          <div className="rounded-3xl border border-outline-variant/40 bg-surface-container p-space-lg sm:p-space-xl">
            <div className="mb-space-md flex items-center gap-space-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name="history" className="text-[20px]" /></span><div><h2 className="font-headline-sm text-headline-sm">Pick up where you left off</h2><p className="font-body-sm text-body-sm text-on-surface-variant">Recent investigations saved in this browser.</p></div></div>
            {recent.length ? <div className="flex flex-col gap-space-xs">{recent.map((session) => <button key={session.id} type="button" onClick={() => researchStore.open(session.id)} className="flex min-w-0 items-start gap-space-sm rounded-xl px-space-sm py-space-md text-left hover:bg-surface-container-low">
              <Icon name="description" className="mt-0.5 shrink-0 text-[17px] text-secondary" /><span className="min-w-0 flex-1"><span className="block line-clamp-2 font-body-sm text-body-sm text-on-surface">{session.prompt}</span><span className="mt-1 block font-code-sm text-code-sm text-outline">{new Date(session.updatedAt || session.createdAt).toLocaleDateString()} · {session.status === 'completed' ? 'Completed' : session.status === 'error' ? 'Failed' : session.status === 'running' ? 'Previously running' : 'Stopped'}</span></span><Icon name="chevron_right" className="shrink-0 text-[17px] text-outline" />
            </button>)}</div> : <p className="rounded-xl border border-dashed border-outline-variant/40 p-space-md font-body-sm text-body-sm text-on-surface-variant">Your saved investigations will appear here after you run one. History stays in this browser unless you export it.</p>}
          </div>
        </section>
      )}

      {s && <Results s={s} running={r.running} events={r.events} plan={r.plan} warnings={r.warnings} panel={panel} onPanelChange={setPanel} />}

      {r.notice && <div role="status" className="fixed bottom-24 left-1/2 z-[90] max-w-[92vw] -translate-x-1/2 rounded-xl bg-surface-container-highest px-space-lg py-space-sm font-body-sm text-body-sm shadow-xl lg:bottom-space-xl">{r.notice}</div>}
    </div>
  );
};
