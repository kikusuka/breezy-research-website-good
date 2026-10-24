import { useSyncExternalStore } from 'react';
import type { DebateSession, DebateTone, SearchEngineProvider, Attachment } from '../types';
import { apiClient } from '../services/apiClient';
import { providerConfigService } from '../services/providerConfigService';
import { effectiveProviderService } from '../services/effectiveProviderService';
import { createNewSession, deleteSessionsFromIDB, loadActiveSessionId, loadSessions, saveActiveSessionId, saveSessions } from '../services/sessionStorage';
import { googleDocsService } from '../services/googleDocsService';
import { userProfileService } from '../services/userProfileService';
import { authService } from '../services/authService';
import { Depth, DEPTH_PROTOCOL, makeInitialSteps, protocolToDepth } from './research';
import { attachmentsToPromptContext } from './files';

export interface RunEvent { at: number; kind: 'info' | 'warn' | 'error' | 'done'; message: string; }
export interface ResearchState {
  sessions: DebateSession[]; activeId: string | null; running: boolean; startedAt: number | null; explorationSeen: boolean;
  events: RunEvent[]; plan: { plan: string[]; searchQueries: string[] } | null; warnings: string[];
  draft: { query: string; depth: Depth }; notice: string | null;
}

/** Module-level store: a run keeps streaming while the user visits other screens. */
let state: ResearchState = { sessions: loadSessions(), activeId: loadActiveSessionId(), running: false, startedAt: null, explorationSeen: false, events: [], plan: null, warnings: [], draft: { query: '', depth: 'solo' }, notice: null };
const listeners = new Set<() => void>();
let controller: AbortController | null = null;
let accountGeneration = 0;
let saveTimer: number | undefined;

function set(patch: Partial<ResearchState> | ((s: ResearchState) => Partial<ResearchState>)) { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; listeners.forEach((l) => l()); }
function persist(now = false) {
  window.clearTimeout(saveTimer);
  const run = () => {
    try {
      const result = saveSessions(state.sessions);
      saveActiveSessionId(state.activeId);
      if (result === 'pruned') notify('Browser storage is tight. Recent research was saved in a reduced form; older sessions or transcript detail may be missing. Export important results.');
      if (result === 'failed') notify('Research history could not be saved in this browser. Export important results now; this is not a cloud backup.');
    } catch {
      notify('Research history could not be saved in this browser. Export important results now; this is not a cloud backup.');
    }
  };
  now ? run() : (saveTimer = window.setTimeout(run, 900));
}
const patchSession = (id: string, fn: (s: DebateSession) => DebateSession) => { set((st) => ({ sessions: st.sessions.map((s) => (s.id === id ? fn(s) : s)) })); persist(); };
const log = (kind: RunEvent['kind'], message: string) => set((s) => ({ events: [...s.events, { at: Date.now(), kind, message }].slice(-200) }));
const notify = (msg: string) => { set({ notice: msg }); window.setTimeout(() => set((s) => (s.notice === msg ? { notice: null } : {})), 4000); };

export const researchStore = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** Abort work and reload the module-level store after the active local account changes. */
  switchAccount() {
    accountGeneration += 1;
    controller?.abort();
    controller = null;
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
    state = {
      sessions: loadSessions(), activeId: loadActiveSessionId(), running: false, startedAt: null,
      explorationSeen: false, events: [], plan: null, warnings: [],
      draft: { query: '', depth: 'solo' }, notice: null,
    };
    listeners.forEach((l) => l());
  },
  refreshSessions() { if (!state.running) set({ sessions: loadSessions(), activeId: loadActiveSessionId() }); },
  setDraft(d: Partial<ResearchState['draft']>) { set((s) => ({ draft: { ...s.draft, ...d } })); },
  open(id: string) { const s = state.sessions.find((x) => x.id === id); set({ activeId: id, draft: s ? { query: s.prompt, depth: protocolToDepth(s.protocol) } : state.draft }); persist(true); },
  newInquiry() { if (!state.running) { set({ activeId: null, events: [], plan: null, warnings: [], draft: { ...state.draft, query: '' } }); persist(true); } },
  stop() { controller?.abort(); },
  async remove(id: string) {
    if (state.running && state.activeId === id) return;
    try {
      // Remove the full-fidelity copy before removing the visible/local record.
      await deleteSessionsFromIDB([id]);
      set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id), activeId: s.activeId === id ? null : s.activeId }));
      persist(true);
    } catch {
      notify('Could not fully delete this research item from browser storage. It has not been removed from the list; close other Breezy tabs and try again.');
    }
  },
  async clearAll() {
    if (state.running) return;
    try {
      await deleteSessionsFromIDB();
      set({ sessions: [], activeId: null });
      persist(true);
    } catch {
      notify('Could not fully erase research history from browser storage. Your list was kept; close other Breezy tabs and try again.');
    }
  },
  notify,
  async saveToGoogleDocs(id: string) {
    const s = state.sessions.find((x) => x.id === id); if (!s) return;
    try { const url = await googleDocsService.saveResearchSession(s); notify('Saved to Google Docs.'); if (url) window.open(url, '_blank', 'noopener'); }
    catch (e: any) { notify(e?.message || 'Google Docs save failed. Connect Google in Profile first.'); }
  },
  async start(query: string, depth: Depth, attachments: Attachment[] = []): Promise<'ok' | 'no-model'> {
    const prompt = query.trim();
    if (!prompt || state.running) return 'ok';
    const generation = accountGeneration;
    let serverOk = effectiveProviderService.isServerGeminiConfigured();
    try { const h = await apiClient.getHealth(); serverOk = Boolean(h.serverGeminiConfigured); } catch { /* offline: cached state */ }
    if (generation !== accountGeneration) return 'ok';
    const cfg = providerConfigService.getConfig();
    if (!serverOk && !effectiveProviderService.getActiveRoutableModel() && providerConfigService.getConfiguredProviders().length === 0) return 'no-model';

    controller?.abort(); const c = new AbortController(); controller = c;
    const mapping = DEPTH_PROTOCOL[depth];
    const session = createNewSession(prompt, mapping.protocol, makeInitialSteps(cfg, depth), 'balanced');
    session.status = 'running'; session.searchEngine = (cfg.searchEngine || 'duckduckgo') as SearchEngineProvider; session.enableSearchGrounding = true;
    const startedAt = Date.now();
    set((s) => ({ sessions: [session, ...s.sessions], activeId: session.id, draft: { query: prompt, depth }, running: true, startedAt, explorationSeen: false, plan: null, warnings: [], events: [{ at: startedAt, kind: 'info', message: 'Run started.' }] }));
    persist(true);
    const idx = (d: any) => Math.max(0, (Number(d.round) || 1) - 1);
    const stepPatch = (d: any, fn: (st: any) => any) => patchSession(session.id, (s) => { const i = idx(d); const steps = [...s.steps]; if (steps[i]) steps[i] = fn(steps[i]); return { ...s, steps, updatedAt: Date.now() }; });
    try {
      await apiClient.streamDebate({
        prompt: prompt + attachmentsToPromptContext(attachments), protocol: mapping.protocol, tone: 'balanced' as DebateTone, searchEngine: session.searchEngine,
        keys: providerConfigService.getKeys(), seats: providerConfigService.getSeatsPayload(cfg), enableSearchGrounding: true,
      }, {
        signal: c.signal, onNotice: (m) => { if (generation === accountGeneration) log('warn', m); },
        onEvent: (d) => {
          if (generation !== accountGeneration) return;
          switch (d.type) {
            case 'status': case 'notice': if (d.message) log(d.type === 'notice' ? 'warn' : 'info', d.message); break;
            case 'research_plan': set({ explorationSeen: true, plan: { plan: d.plan || [], searchQueries: d.searchQueries || [] } }); log('info', 'Research plan ready.'); break;
            case 'search_grounding': set({ explorationSeen: true }); if (d.sources) { patchSession(session.id, (s) => ({ ...s, evidenceGraph: { ...(s.evidenceGraph || { researchPlan: [], claims: [], contradictions: [], sourcesConsulted: [] }), sourcesConsulted: d.sources } })); log('info', `${d.sources.length} sources retrieved.`); } break;
            case 'round_start': stepPatch(d, (st) => ({ ...st, status: 'running', agentName: d.agentName || st.agentName, provider: d.provider || st.provider, model: d.model || st.model })); log('info', `${d.agentName || d.role || 'Step'} started${d.model ? ` on ${d.model}` : ''}.`); break;
            case 'token': stepPatch(d, (st) => ({ ...st, status: 'running', content: (st.content || '') + (d.token || '') })); break;
            case 'round_complete': stepPatch(d, (st) => ({ ...st, status: 'completed', content: d.content || st.content, provider: d.provider || st.provider, model: d.model || st.model, summary: d.summary ?? st.summary, durationMs: d.durationMs ?? st.durationMs })); break;
            case 'usage': patchSession(session.id, (s) => ({ ...s, usage: d.usage || s.usage })); break;
            case 'heartbeat': if (d.statusText) log('info', d.statusText); break;
            case 'stage_warning': set((s) => ({ warnings: [...s.warnings, d.message] })); log('warn', d.message); break;
            case 'evidence_graph': patchSession(session.id, (s) => ({ ...s, evidenceGraph: d.evidenceGraph || s.evidenceGraph, researchMetrics: d.researchMetrics || s.researchMetrics })); break;
            case 'complete': patchSession(session.id, (s) => ({ ...s, status: 'completed', finalOutput: d.finalOutput || s.finalOutput, evidenceGraph: d.evidenceGraph || s.evidenceGraph, researchMetrics: d.researchMetrics || s.researchMetrics, usage: d.usage || s.usage, metrics: d.metrics || s.metrics, updatedAt: Date.now(), steps: s.steps.map((st) => (st.status === 'running' ? { ...st, status: 'completed' as const } : st)) })); log('done', 'Research complete.'); break;
            case 'error': patchSession(session.id, (s) => ({ ...s, status: 'error', error: d.message || d.error || 'Research failed' })); log('error', d.message || d.error || 'Research failed'); break;
          }
        },
      });
      if (userProfileService.getProfile().autoSaveToDrive && authService.getAccessToken()) { const done = state.sessions.find((s) => s.id === session.id); if (done?.status === 'completed') void googleDocsService.saveResearchSession(done).catch(() => {}); }
    } catch (e: any) {
      if (generation !== accountGeneration) return 'ok';
      if (e?.name !== 'AbortError') { const msg = e?.message || 'Research failed'; patchSession(session.id, (s) => ({ ...s, status: 'error', error: msg })); log('error', msg); }
      else { patchSession(session.id, (s) => (s.status === 'running' ? { ...s, status: 'idle', steps: s.steps.map((st) => (st.status === 'running' ? { ...st, status: 'pending' as const } : st)) } : s)); log('warn', 'Run stopped.'); }
    } finally {
      if (generation === accountGeneration) { set({ running: false }); persist(true); controller = null; }
    }
    return 'ok';
  },
};
export function useResearch() {
  const s = useSyncExternalStore(researchStore.subscribe, researchStore.get);
  return { ...s, active: s.sessions.find((x) => x.id === s.activeId) || null };
}
