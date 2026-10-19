import type { DebateSession, DebateStep } from '../types';
import type { CanonicalWorkspaceConfig } from '../services/providerConfigService';

export type Depth = 'solo' | 'standard' | 'deep';
/** Depth -> real backend protocol (matches effectiveProtocol in server-core/router.ts: 1=solo, 2=trio, 4=quad). */
export const DEPTH_PROTOCOL: Record<Depth, { protocol: 'solo' | 'trio' | 'quad'; selectedRound: 1 | 2 | 4; label: string; blurb: string }> = {
  solo: { protocol: 'solo', selectedRound: 1, label: 'Solo', blurb: 'One model, one pass' },
  standard: { protocol: 'trio', selectedRound: 2, label: 'Standard', blurb: 'Proposal, challenge, synthesis' },
  deep: { protocol: 'quad', selectedRound: 4, label: 'Deep', blurb: 'Adds an independent verification round' },
};
export const protocolToDepth = (p?: DebateSession['protocol']): Depth => (p === 'solo' ? 'solo' : p === 'quad' ? 'deep' : 'standard');

export function makeInitialSteps(config: CanonicalWorkspaceConfig, depth: Depth): DebateStep[] {
  const seat = (id: 'architect' | 'skeptic' | 'verifier' | 'arbiter', name: string) => ({ id, name, provider: config.roles[id].provider || config.defaultProvider, model: config.roles[id].model || config.defaultModel });
  const roles = depth === 'solo' ? [{ id: 'solo', name: 'Solo Researcher', provider: config.defaultProvider, model: config.defaultModel }]
    : depth === 'standard' ? [seat('architect', 'Analyst'), seat('skeptic', 'Critic'), seat('arbiter', 'Synthesizer')]
    : [seat('architect', 'Analyst'), seat('skeptic', 'Critic'), seat('verifier', 'Verifier'), seat('arbiter', 'Synthesizer')];
  const now = Date.now();
  return roles.map((r, i) => ({ stepId: `step_${i}_${now}`, role: r.id as DebateStep['role'], agentName: r.name, provider: (r.provider || '') as DebateStep['provider'], model: r.model || '', status: 'pending', content: '', timestamp: now }));
}

export type StageState = 'done' | 'active' | 'pending' | 'skipped' | 'error';
export interface Stage { id: string; label: string; icon: string; description: string; state: StageState; }
export const STAGE_DEFS = [
  { id: 'question', label: 'Question', icon: 'help_outline', description: 'Your inquiry and settings' },
  { id: 'exploration', label: 'Exploration', icon: 'manage_search', description: 'Research plan and source search' },
  { id: 'proposals', label: 'Proposals', icon: 'schema', description: 'First-pass analysis by the analyst' },
  { id: 'challenge', label: 'Challenge', icon: 'gavel', description: 'The critic stress-tests the proposal' },
  { id: 'evidence', label: 'Evidence', icon: 'verified', description: 'An independent verifier checks claims' },
  { id: 'synthesis', label: 'Synthesis', icon: 'auto_stories', description: 'The final answer is assembled' },
] as const;

/** Pipeline state derived only from real step statuses, received events and session status. */
export function deriveStages(session: DebateSession | null, running: boolean, explorationSeen: boolean): Stage[] {
  const mk = (i: number, state: StageState): Stage => ({ ...STAGE_DEFS[i], state });
  if (!session) return STAGE_DEFS.map((_, i) => mk(i, i === 0 ? 'active' : 'pending'));
  const steps = session.steps || []; const completed = session.status === 'completed'; const errored = session.status === 'error';
  const st = (s?: DebateStep): StageState => (!s ? 'skipped' : s.status === 'completed' ? 'done' : s.status === 'running' ? 'active' : s.status === 'error' ? 'error' : 'pending');
  const by = (r: string) => steps.find((s) => s.role === r);
  const first = by('architect') || by('solo'); const started = steps.some((s) => s.status !== 'pending');
  const out: Stage[] = [mk(0, 'done'), mk(1, started || completed ? 'done' : errored ? 'error' : running || explorationSeen ? 'active' : 'pending'), mk(2, st(first)),
    mk(3, session.protocol === 'solo' ? 'skipped' : st(by('skeptic'))), mk(4, session.protocol === 'solo' || session.protocol === 'trio' ? 'skipped' : st(by('verifier'))),
    mk(5, session.protocol === 'solo' ? (completed ? 'done' : first && first.status === 'running' ? 'active' : 'pending') : st(by('arbiter')))];
  return completed ? out.map((s) => (s.state === 'pending' || s.state === 'active' ? { ...s, state: 'done' as StageState } : s)) : out;
}
export function formatDuration(ms?: number) {
  if (!ms || ms < 0) return null; const sec = Math.round(ms / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
export function timeAgo(ts: number) {
  const s = Math.max(0, Date.now() - ts) / 1000;
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}
