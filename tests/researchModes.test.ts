import { describe, expect, it } from 'vitest';
import { findMissingResearchSeats, resolveResearchMode } from '../src/server-core/researchModes';

describe('research mode resolution', () => {
  it('keeps Solo as a one-call mode', () => {
    expect(resolveResearchMode('solo', 1)).toMatchObject({ mode: 'solo', protocol: 'solo', rounds: 1, requiredSeats: ['architect'] });
  });
  it('resolves Trio to three stages including synthesis', () => {
    expect(resolveResearchMode('trio', 3)).toMatchObject({ mode: 'trio', protocol: 'trio', rounds: 3, requiredSeats: ['architect', 'skeptic', 'arbiter'] });
  });
  it('resolves Deep to four stages and never degrades to Trio', () => {
    expect(resolveResearchMode('quad', 4)).toMatchObject({ mode: 'deep', protocol: 'quad', rounds: 4, requiredSeats: ['architect', 'skeptic', 'verifier', 'arbiter'] });
  });
  it('accepts the older selectedRound value 2 as Trio', () => {
    expect(resolveResearchMode('solo', 2).mode).toBe('trio');
  });
  it('reports missing model assignments instead of silently substituting a seat', () => {
    expect(findMissingResearchSeats({ architect: { provider: 'gemini', model: 'flash' }, skeptic: { provider: 'groq', model: '' } }, ['architect', 'skeptic', 'arbiter'])).toEqual(['skeptic', 'arbiter']);
  });
});
