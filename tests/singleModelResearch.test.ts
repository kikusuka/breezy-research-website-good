import { describe, expect, it } from 'vitest';
import { DEPTH_PROTOCOL, deriveStages, makeInitialSteps, protocolToDepth } from '../src/lib/research';
import type { CanonicalWorkspaceConfig } from '../src/services/providerConfigService';
import type { DebateSession } from '../src/types';

const config = {
  defaultProvider: 'gemini',
  defaultModel: 'gemini-2.5-flash',
  preset: 'balanced',
  roles: {
    architect: { provider: 'anthropic', model: 'unused-analyst-model' },
    skeptic: { provider: 'groq', model: 'unused-critic-model' },
    verifier: { provider: 'sambanova', model: 'unused-verifier-model' },
    arbiter: { provider: 'openrouter', model: 'unused-synthesizer-model' },
  },
  fallback: { enabled: false, provider: '', model: '' },
  keys: {},
} as unknown as CanonicalWorkspaceConfig;

describe('single-model research workflow', () => {
  it('exposes only the single-model depth', () => {
    expect(Object.keys(DEPTH_PROTOCOL)).toEqual(['solo']);
    expect(DEPTH_PROTOCOL.solo.selectedRound).toBe(1);
  });

  it('normalizes legacy saved protocols to the single-model workflow', () => {
    expect(protocolToDepth('trio')).toBe('solo');
    expect(protocolToDepth('quad')).toBe('solo');
    expect(protocolToDepth('duel')).toBe('solo');
  });

  it('creates exactly one step using the configured default model, not legacy role seats', () => {
    const steps = makeInitialSteps(config, 'solo');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      role: 'solo',
      agentName: 'Researcher',
      provider: 'anthropic',
      model: 'unused-analyst-model',
      status: 'pending',
    });
  });

  it('shows the single-model investigation stages without critic or verifier stages', () => {
    const session = {
      id: 'test',
      prompt: 'Test question',
      protocol: 'solo',
      createdAt: 1,
      updatedAt: 1,
      status: 'running',
      steps: makeInitialSteps(config, 'solo'),
    } as DebateSession;
    const stages = deriveStages(session, true, false);
    expect(stages.map((stage) => stage.label)).toEqual([
      'Question',
      'Explore',
      'Analysis',
      'Evidence',
      'Answer',
    ]);
    expect(stages.some((stage) => /critic|verifier|synthesizer/i.test(stage.label))).toBe(false);
  });
});
