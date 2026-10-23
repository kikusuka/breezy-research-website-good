import type { DebateSession, DebateStep } from '../types';
import type { CanonicalWorkspaceConfig } from '../services/providerConfigService';

export type Depth = 'solo';
/** Research deliberately uses one configured model call. Evidence retrieval remains separate and does not invoke a debate chain. */
export const DEPTH_PROTOCOL: Record<Depth, { protocol: 'solo'; selectedRound: 1; label: string; blurb: string }> = {
  solo: { protocol: 'solo', selectedRound: 1, label: 'Single model', blurb: 'One model call with source grounding' },
};
export const protocolToDepth = (_p?: DebateSession['protocol']): Depth => 'solo';

export function makeInitialSteps(config: CanonicalWorkspaceConfig, _depth: Depth): DebateStep[] {
  const now = Date.now();
  return [{
    stepId: `step_0_${now}`,
    role: 'solo',
    agentName: 'Researcher',
    provider: (config.roles.architect.provider || config.defaultProvider || '') as DebateStep['provider'],
    model: config.roles.architect.model || config.defaultModel || '',
    status: 'pending',
    content: '',
    timestamp: now,
  }];
}

export type StageState = 'done' | 'active' | 'pending' | 'skipped' | 'error';
export interface Stage { id: string; label: string; icon: string; description: string; state: StageState; }
export const STAGE_DEFS = [
  { id: 'question', label: 'Question', icon: 'help_outline', description: 'Your inquiry and settings' },
  { id: 'exploration', label: 'Explore', icon: 'manage_search', description: 'Plan and search for relevant sources' },
  { id: 'analysis', label: 'Analysis', icon: 'auto_awesome', description: 'One model analyzes the question and retrieved context' },
  { id: 'evidence', label: 'Evidence', icon: 'account_tree', description: 'Show retrieved sources and available evidence provenance' },
  { id: 'answer', label: 'Answer', icon: 'article', description: 'Present the completed research response' },
] as const;

/** Pipeline state reflects actual search, model, evidence, and completion events. */
export function deriveStages(session: DebateSession | null, running: boolean, explorationSeen: boolean): Stage[] {
  const mk = (i: number, state: StageState): Stage => ({ ...STAGE_DEFS[i], state });
  if (!session) return STAGE_DEFS.map((_, i) => mk(i, i === 0 ? 'active' : 'pending'));
  const step = session.steps?.find((item) => item.role === 'solo') || session.steps?.[0];
  const completed = session.status === 'completed';
  const errored = session.status === 'error';
  const analysisState: StageState = step?.status === 'completed' ? 'done'
    : step?.status === 'running' ? 'active'
    : step?.status === 'error' || errored ? 'error'
    : running ? 'active' : 'pending';
  const explorationState: StageState = explorationSeen || Boolean(session.evidenceGraph?.researchPlan?.length)
    ? 'done' : running ? 'active' : errored ? 'error' : 'pending';
  const evidenceState: StageState = session.evidenceGraph
    ? 'done' : completed ? 'done' : errored ? 'error' : step?.status === 'completed' ? 'active' : 'pending';
  const answerState: StageState = completed ? 'done' : errored ? 'error' : step?.status === 'completed' ? 'active' : 'pending';
  return [
    mk(0, 'done'),
    mk(1, explorationState),
    mk(2, analysisState),
    mk(3, evidenceState),
    mk(4, answerState),
  ];
}
export function formatDuration(ms?: number) {
  if (!ms || ms < 0) return null; const sec = Math.round(ms / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
export function timeAgo(ts: number) {
  const s = Math.max(0, Date.now() - ts) / 1000;
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}
