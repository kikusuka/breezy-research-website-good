import { describe, it, expect, beforeEach } from 'vitest';
import { providerConfigService, PRESET_ROLE_CONFIGS } from '../src/services/providerConfigService';

describe('providerConfigService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads truthful unconfigured canonical configuration when storage is empty', () => {
    const config = providerConfigService.getConfig();
    expect(config.defaultProvider).toBe('');
    expect(config.defaultModel).toBe('');
    expect(config.preset).toBe('balanced');
    expect(config.roles.architect.provider).toBe('');
  });

  it('correctly applies fast preset', () => {
    const updated = providerConfigService.applyPreset('fast');
    expect(updated.preset).toBe('fast');
    expect(updated.roles.architect.model).toBe('gemini-2.5-flash');
    expect(updated.roles.skeptic.model).toBe('gemini-2.5-flash');
  });

  it('correctly applies deep preset', () => {
    const updated = providerConfigService.applyPreset('deep');
    expect(updated.preset).toBe('deep');
    expect(updated.roles.architect.provider).toBe('anthropic');
    expect(updated.roles.skeptic.provider).toBe('groq');
    expect(updated.roles.verifier.provider).toBe('sambanova');
  });
  it('does not infer a default chat model from saved provider keys', () => {
    localStorage.setItem('breezy_canonical_provider_config', JSON.stringify({
      defaultProvider: '',
      defaultModel: '',
      keys: { groq: 'test-key' },
      roles: {},
    }));

    const config = providerConfigService.getConfig();
    expect(config.defaultProvider).toBe('');
    expect(config.defaultModel).toBe('');
    expect(providerConfigService.getActiveRoutableModel()).toBeNull();
  });

  it('routes only to the explicitly selected default provider and model', () => {
    localStorage.setItem('breezy_canonical_provider_config', JSON.stringify({
      defaultProvider: 'groq',
      defaultModel: 'llama-3.3-70b-versatile',
      keys: { groq: 'groq-test-key', gemini: 'gemini-test-key' },
      roles: {},
    }));

    expect(providerConfigService.getActiveRoutableModel()).toEqual({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
    });
  });

  it('preserves legacy keys without silently choosing Gemini during migration', () => {
    localStorage.setItem('breezy_byok_keys', JSON.stringify({ groq: 'legacy-key' }));

    const config = providerConfigService.getConfig();
    expect(config.keys.groq).toBe('legacy-key');
    expect(config.defaultProvider).toBe('');
    expect(config.defaultModel).toBe('');
    expect(providerConfigService.getActiveRoutableModel()).toBeNull();
  });

});
