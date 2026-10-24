import { describe, expect, it } from 'vitest';
import { getResearchModelReadiness } from '../src/lib/researchModelStatus';

describe('research model readiness', () => {
  it('requires an explicitly selected research provider and model', () => {
    expect(getResearchModelReadiness('', '', ['gemini'], true)).toBe('unconfigured');
    expect(getResearchModelReadiness('anthropic', '', ['anthropic'], false)).toBe('unconfigured');
  });

  it('does not treat an unrelated configured provider as a ready research model', () => {
    expect(getResearchModelReadiness('anthropic', 'claude-sonnet', ['gemini'], true)).toBe('provider-unavailable');
  });

  it('accepts the selected provider when its connection is configured', () => {
    expect(getResearchModelReadiness('anthropic', 'claude-sonnet', ['anthropic'], false)).toBe('ready');
  });

  it('accepts server-configured Gemini without requiring a user API key', () => {
    expect(getResearchModelReadiness('gemini', 'gemini-2.5-flash', [], true)).toBe('ready');
  });

  it('does not treat server Gemini as availability for another selected provider', () => {
    expect(getResearchModelReadiness('groq', 'llama-3.3-70b-versatile', [], true)).toBe('provider-unavailable');
  });
});
