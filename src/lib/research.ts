import type { DebateSession, DebateStep } from '../types';
import type { CanonicalWorkspaceConfig } from '../services/providerConfigService';

export type Depth = 'solo' | 'trio' | 'deep';
export const DEPTH_PROTOCOL: Record<Depth, { protocol: 'solo' | 'trio' | 'quad'; selectedRound: 1 | 3 | 4; label: string; blurb: string }> = {
  solo: { protocol: 'solo', selectedRound: 1, label: 'Solo', blurb: 'One model call; lowest usage' },
  trio: { protocol: 'trio', selectedRound: 3, label: 'Trio', blurb: 'Analyst, critic, synthesizer' },
  deep: { protocol: 'quad', selectedRound: 4, label: 'Deep', blurb: 'Analyst, critic, verifier, synthesizer' },
};
export const protocolToDepth = (p?: DebateSession['protocol']): Depth =>
  p === 'quad' || p === 'deep' ? 'deep' : p === 'trio' ? 'trio' : 'solo';

const ROLE_STEPS: Record<Exclude<Depth, 'solo'>, Array<{ role: DebateStep['role']; seat: 'architect' | 'skeptic' | 'verifier' | 'arbiter'; name: string }>> = {
  trio: [
    { role: 'architect', seat: 'architect', name: 'Analyst' },
    { role: 'skeptic', seat: 'skeptic', name: 'Critic' },
    { role: 'arbiter', seat: 'arbiter', name: 'Synthesizer' },
  ],
  deep: [
    { role: 'architect', seat: 'architect', name: 'Analyst' },
    { role: 'skeptic', seat: 'skeptic', name: 'Critic' },
    { role: 'verifier', seat: 'verifier', name: 'Verifier' },
    { role: 'arbiter', seat: 'arbiter', name: 'Synthesizer' },
  ],
};

export function makeInitialSteps(config: CanonicalWorkspaceConfig, depth: Depth): DebateStep[] {
  const now = Date.now();
  const definitions = depth === 'solo'
    ? [{ role: 'solo' as const, seat: 'architect' as const, name: 'Researcher' }]
    : ROLE_STEPS[depth];
  return definitions.map(({ role, seat, name }, index) => ({
    stepId: `step_${index}_${now}`,
    role,
    agentName: name,
    provider: (config.roles?.[seat]?.provider || (seat === 'architect' ? config.defaultProvider : '')) as DebateStep['provider'],
    model: config.roles?.[seat]?.model || (seat === 'architect' ? config.defaultModel : ''),
    status: 'pending',
    content: '',
    timestamp: now,
  }));
}

export type StageState = 'done' | 'active' | 'pending' | 'skipped' | 'error';
export interface Stage { id: string; label: string; icon: string; description: string; state: StageState; }
const STAGE_DEFS = [
  { id: 'question', label: 'Question', icon: 'help_outline', description: 'Your inquiry and settings' },
  { id: 'exploration', label: 'Explore', icon: 'manage_search', description: 'Search for relevant sources and retrieve bounded page text' },
  { id: 'analyst', label: 'Analyst', icon: 'psychology', description: 'Develop an initial answer from the question and available sources' },
  { id: 'critic', label: 'Critic', icon: 'rate_review', description: 'Challenge assumptions and identify gaps or counter-evidence' },
  { id: 'verifier', label: 'Verifier', icon: 'fact_check', description: 'Check claims against available source material; not independent fact verification' },
  { id: 'synthesizer', label: 'Synthesis', icon: 'merge_type', description: 'Combine the analysis and challenges into a final answer' },
  { id: 'evidence', label: 'Evidence', icon: 'account_tree', description: 'Expose sources, claims, and retrieval provenance' },
  { id: 'answer', label: 'Answer', icon: 'article', description: 'Present the final research response' },
] as const;

export function deriveStages(session: DebateSession | null, running: boolean, explorationSeen: boolean): Stage[] {
  const depth = protocolToDepth(session?.protocol);
  const used = depth === 'solo' ? new Set(['analyst']) : depth === 'trio' ? new Set(['analyst', 'critic', 'synthesizer']) : new Set(['analyst', 'critic', 'verifier', 'synthesizer']);
  const mk = (id: typeof STAGE_DEFS[number]['id'], state: StageState): Stage => {
    const def = STAGE_DEFS.find((stage) => stage.id === id)!;
    return { ...def, state };
  };
  if (!session) return [mk('question', 'active'), mk('exploration', 'pending'), mk('analyst', 'pending'), mk('critic', 'skipped'), mk('verifier', 'skipped'), mk('synthesizer', 'skipped'), mk('evidence', 'pending'), mk('answer', 'pending')];
  const stepByRole = new Map((session.steps || []).map((step) => [step.role, step]));
  const stateForRole = (role: 'analyst' | 'critic' | 'verifier' | 'synthesizer'): StageState => {
    if (!used.has(role)) return 'skipped';
    const stepRole = role === 'analyst' ? (depth === 'solo' ? 'solo' : 'architect') : role === 'critic' ? 'skeptic' : role === 'verifier' ? 'verifier' : 'arbiter';
    const step = stepByRole.get(stepRole as DebateStep['role']);
    if (step?.status === 'completed') return 'done';
    if (step?.status === 'error' || session.status === 'error' && step?.status === 'running') return 'error';
    if (step?.status === 'running') return 'active';
    return running ? 'pending' : 'pending';
  };
  const completed = session.status === 'completed';
  const errored = session.status === 'error';
  const exploration: StageState = explorationSeen || Boolean(session.evidenceGraph?.researchPlan?.length) ? 'done' : running ? 'active' : errored ? 'error' : 'pending';
  const evidence: StageState = session.evidenceGraph ? 'done' : completed ? 'done' : errored ? 'error' : session.steps.some((step) => step.status === 'completed') ? 'active' : 'pending';
  return [
    mk('question', 'done'),
    mk('exploration', exploration),
    mk('analyst', stateForRole('analyst')),
    mk('critic', stateForRole('critic')),
    mk('verifier', stateForRole('verifier')),
    mk('synthesizer', stateForRole('synthesizer')),
    mk('evidence', evidence),
    mk('answer', completed ? 'done' : errored ? 'error' : session.steps.some((step) => step.status === 'completed') ? 'active' : 'pending'),
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
