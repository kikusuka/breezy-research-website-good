import { describe, expect, it } from 'vitest';
import { DEPTH_PROTOCOL, deriveStages, makeInitialSteps, protocolToDepth } from '../src/lib/research';
import type { CanonicalWorkspaceConfig } from '../src/services/providerConfigService';
import type { DebateSession } from '../src/types';

const config = {
  defaultProvider: 'gemini',
  defaultModel: 'gemini-2.5-flash',
  preset: 'balanced',
  roles: {
    architect: { provider: 'anthropic', model: 'analyst-model' },
    skeptic: { provider: 'groq', model: 'critic-model' },
    verifier: { provider: 'sambanova', model: 'verifier-model' },
    arbiter: { provider: 'openrouter', model: 'synth-model' },
  },
  fallback: { enabled: false, provider: '', model: '' },
  keys: {},
} as unknown as CanonicalWorkspaceConfig;

describe('selectable research workflows', () => {
  it('exposes Solo, Trio and Deep with explicit model-call budgets', () => {
    expect(Object.keys(DEPTH_PROTOCOL)).toEqual(['solo', 'trio', 'deep']);
    expect(DEPTH_PROTOCOL.solo.selectedRound).toBe(1);
    expect(DEPTH_PROTOCOL.trio.selectedRound).toBe(3);
    expect(DEPTH_PROTOCOL.deep.selectedRound).toBe(4);
  });

  it('restores legacy saved protocols to their corresponding depth', () => {
    expect(protocolToDepth('solo')).toBe('solo');
    expect(protocolToDepth('trio')).toBe('trio');
    expect(protocolToDepth('quad')).toBe('deep');
    expect(protocolToDepth('duel')).toBe('solo');
  });

  it('Solo needs one seat and creates one researcher step', () => {
    const steps = makeInitialSteps(config, 'solo');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ role: 'solo', agentName: 'Researcher', provider: 'anthropic', model: 'analyst-model', status: 'pending' });
  });

  it('Trio maps analyst, critic and synthesizer to their own configured seats', () => {
    const steps = makeInitialSteps(config, 'trio');
    expect(steps.map((step) => step.role)).toEqual(['architect', 'skeptic', 'arbiter']);
    expect(steps.map((step) => step.model)).toEqual(['analyst-model', 'critic-model', 'synth-model']);
  });

  it('Deep adds a verifier before synthesis', () => {
    const steps = makeInitialSteps(config, 'deep');
    expect(steps.map((step) => step.role)).toEqual(['architect', 'skeptic', 'verifier', 'arbiter']);
    expect(steps.map((step) => step.model)).toEqual(['analyst-model', 'critic-model', 'verifier-model', 'synth-model']);
  });

  it('shows the actual workflow stages and skips unused stages honestly', () => {
    const session = {
      id: 'test', prompt: 'Test question', protocol: 'trio', createdAt: 1, updatedAt: 1,
      status: 'running', steps: makeInitialSteps(config, 'trio'),
    } as DebateSession;
    const stages = deriveStages(session, true, false);
    expect(stages.find((stage) => stage.id === 'critic')?.state).toBe('pending');
    expect(stages.find((stage) => stage.id === 'verifier')?.state).toBe('skipped');
    expect(stages.find((stage) => stage.id === 'synthesizer')?.state).toBe('pending');
  });
});
