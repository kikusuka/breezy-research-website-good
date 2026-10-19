import { ProviderId, SearchEngineProvider } from '../types';

/**
 * Canonical Provider Configuration Service
 * Unified configuration layer for Breezy and Synthexis research workspaces.
 * Eliminates duplicate storage keys and ensures a single source of truth.
 */

export interface RoleSeatConfig {
  provider: ProviderId | '';
  model: string;
}

export interface CanonicalProviderKeys {
  gemini?: string;
  groq?: string;
  sambanova?: string;
  openrouter?: string;
  tavily?: string;
  serper?: string;
  brave?: string;
  anthropic?: string;
  ollama?: string;
  openaiCompatible?: string;
  [key: string]: string | undefined;
}

export const AVAILABLE_MODELS: Record<string, { id: string; name: string; description: string }[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, highly intelligent multimodal reasoning & code' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Deep reasoning, thinking, and complex synthesis' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Ultra-lightweight low-latency model' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best-in-class deep reasoning & analytical synthexis' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Ultra-fast lightweight Claude model' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'Groq LPUs ultra-fast open weights reasoning' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B Instruct', description: 'Fast MoE architecture' },
  ],
  sambanova: [
    { id: 'Meta-Llama-3.3-70B-Instruct', name: 'Meta Llama 3.3 70B', description: 'High-speed SambaNova reconfigurable dataflow' },
    { id: 'Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B Instruct', description: 'Top open coding & math model' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (OpenRouter)', description: 'Unified router access' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (OpenRouter)', description: 'Deep reasoning & chain-of-thought verification' },
  ],
  ollama: [],
  'openai-compatible': [],
};

export interface CanonicalWorkspaceConfig {
  defaultProvider: ProviderId | '';
  defaultModel: string;
  preset: 'fast' | 'balanced' | 'deep' | 'custom';
  roles: {
    architect: RoleSeatConfig;
    skeptic: RoleSeatConfig;
    verifier: RoleSeatConfig;
    arbiter: RoleSeatConfig;
  };
  fallback: {
    enabled: boolean;
    provider: ProviderId | '';
    model: string;
  };
  keys: CanonicalProviderKeys;
  autoResolve?: boolean;
  agreementThreshold?: number;
  selectedRound?: number;
  searchEngine?: SearchEngineProvider;
  researchMethod?: 'adaptive' | 'systematic' | 'evidence-map' | 'comparative';
  heartbeatEnabled?: boolean;
  heartbeatIntervalSec?: number;
  ollamaBaseUrl?: string;
  openaiCompatibleBaseUrl?: string;
}

const CANONICAL_STORAGE_KEY = 'breezy_canonical_provider_config';

export const UNCONFIGURED_ROLE: RoleSeatConfig = { provider: '', model: '' };

const UNCONFIGURED_ROLES: CanonicalWorkspaceConfig['roles'] = {
  architect: UNCONFIGURED_ROLE,
  skeptic: UNCONFIGURED_ROLE,
  verifier: UNCONFIGURED_ROLE,
  arbiter: UNCONFIGURED_ROLE,
};

export const PRESET_ROLE_CONFIGS: Record<string, CanonicalWorkspaceConfig['roles']> = {
  fast: {
    architect: { provider: 'gemini', model: 'gemini-2.5-flash' },
    skeptic: { provider: 'gemini', model: 'gemini-2.5-flash' },
    verifier: { provider: 'gemini', model: 'gemini-2.5-flash' },
    arbiter: { provider: 'gemini', model: 'gemini-2.5-flash' },
  },
  balanced: {
    architect: { provider: 'gemini', model: 'gemini-2.5-flash' },
    skeptic: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    verifier: { provider: 'gemini', model: 'gemini-2.5-flash' },
    arbiter: { provider: 'gemini', model: 'gemini-2.5-flash' },
  },
  deep: {
    architect: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    skeptic: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    verifier: { provider: 'sambanova', model: 'Qwen2.5-72B-Instruct' },
    arbiter: { provider: 'gemini', model: 'gemini-2.5-flash' },
  },
};

export const providerConfigService = {
  /**
   * Apply preset and update role seat assignments canonically
   */
  applyPreset(presetId: 'fast' | 'balanced' | 'deep' | 'custom'): CanonicalWorkspaceConfig {
    const current = this.getConfig();
    const targetRoles = PRESET_ROLE_CONFIGS[presetId];
    const updated: CanonicalWorkspaceConfig = {
      ...current,
      preset: presetId,
      roles: targetRoles ? { ...targetRoles } : current.roles,
    };
    this.saveConfig(updated);
    return updated;
  },

  /**
   * Get canonical workspace provider config
   */
  getConfig(): CanonicalWorkspaceConfig {
    try {
      const raw = localStorage.getItem(CANONICAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          // Preserve an explicitly empty selection. Having a key is not consent
          // to silently select a provider or model for the user.
          defaultProvider: typeof parsed.defaultProvider === 'string' ? parsed.defaultProvider : '',
          defaultModel: typeof parsed.defaultModel === 'string' ? parsed.defaultModel : '',
          preset: parsed.preset || 'balanced',
          roles: parsed.roles || UNCONFIGURED_ROLES,
          fallback: parsed.fallback || { enabled: false, provider: '', model: '' },
          keys: parsed.keys || {},
          autoResolve: typeof parsed.autoResolve === 'boolean' ? parsed.autoResolve : true,
          agreementThreshold: typeof parsed.agreementThreshold === 'number' ? Math.min(100, Math.max(0, parsed.agreementThreshold)) : 78,
          selectedRound: typeof parsed.selectedRound === 'number' ? parsed.selectedRound : 2,
          searchEngine: parsed.searchEngine || 'duckduckgo',
          researchMethod: parsed.researchMethod || 'adaptive',
          heartbeatEnabled: typeof parsed.heartbeatEnabled === 'boolean' ? parsed.heartbeatEnabled : true,
          heartbeatIntervalSec: typeof parsed.heartbeatIntervalSec === 'number' ? Math.min(300, Math.max(20, parsed.heartbeatIntervalSec)) : 60,
          ollamaBaseUrl: parsed.ollamaBaseUrl || 'http://localhost:11434',
          openaiCompatibleBaseUrl: parsed.openaiCompatibleBaseUrl || '',
        };
      }

      // Backwards-compatibility migration from legacy keys
      const legacyKeysRaw =
        localStorage.getItem('breezy_byok_keys') ||
        localStorage.getItem('breezy_provider_keys') ||
        localStorage.getItem('synthexis_byok_keys');

      const keys: CanonicalProviderKeys = legacyKeysRaw ? JSON.parse(legacyKeysRaw) : {};
      const initialConfig: CanonicalWorkspaceConfig = {
        // Legacy keys are retained, but the user must explicitly choose where
        // new chat requests are routed.
        defaultProvider: '',
        defaultModel: '',
        preset: 'balanced',
        roles: UNCONFIGURED_ROLES,
        fallback: { enabled: false, provider: '', model: '' },
        keys,
        autoResolve: true,
        agreementThreshold: 78,
        selectedRound: 2,
        searchEngine: 'duckduckgo',
        researchMethod: 'adaptive',
        heartbeatEnabled: true,
        heartbeatIntervalSec: 60,
        ollamaBaseUrl: 'http://localhost:11434',
        openaiCompatibleBaseUrl: '',
      };

      this.saveConfig(initialConfig);
      return initialConfig;
    } catch {
      return {
        defaultProvider: '',
        defaultModel: '',
        preset: 'balanced',
        roles: UNCONFIGURED_ROLES,
        fallback: { enabled: false, provider: '', model: '' },
        keys: {},
        autoResolve: true,
        selectedRound: 2,
        searchEngine: 'duckduckgo',
        researchMethod: 'adaptive',
        heartbeatEnabled: true,
        heartbeatIntervalSec: 60,
        ollamaBaseUrl: 'http://localhost:11434',
        openaiCompatibleBaseUrl: '',
      };
    }
  },

  /**
   * Save canonical configuration
   */
  saveConfig(config: CanonicalWorkspaceConfig): void {
    try {
      localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to persist provider config:', e);
    }
  },

  /**
   * Build seats payload for streamDebate API request truthfully
   */
  getSeatsPayload(config?: CanonicalWorkspaceConfig) {
    const current = config || this.getConfig();
    const roles = current.roles || UNCONFIGURED_ROLES;

    const resolveSeat = (roleKey: keyof CanonicalWorkspaceConfig['roles']) => {
      const assigned = roles[roleKey];
      if (assigned && assigned.provider && assigned.model) {
        return { provider: assigned.provider, model: assigned.model };
      }
      return { provider: '' as any, model: '' };
    };

    return {
      architect: resolveSeat('architect'),
      skeptic: resolveSeat('skeptic'),
      verifier: resolveSeat('verifier'),
      arbiter: resolveSeat('arbiter'),
    };
  },

  /**
   * Check if a specific provider has a configured API key
   */
  isProviderConfigured(provider: string): boolean {
    if (!provider) return false;
    const keys = this.getKeys();
    return Boolean(keys[provider]);
  },

  /**
   * Get list of all providers with active keys configured
   */
  getConfiguredProviders(): string[] {
    const keys = this.getKeys();
    const config = this.getConfig();
    const configured = Object.keys(keys).filter((p) => Boolean(keys[p]));

    const hasSelectedLocalModel = (provider: 'ollama' | 'openai-compatible') =>
      (config.defaultProvider === provider && Boolean(config.defaultModel)) ||
      Object.values(config.roles || {}).some(
        (seat) => seat?.provider === provider && Boolean(seat.model)
      );

    if (hasSelectedLocalModel('ollama') && !configured.includes('ollama')) {
      configured.push('ollama');
    }
    if (hasSelectedLocalModel('openai-compatible') && !configured.includes('openai-compatible')) {
      configured.push('openai-compatible');
    }

    return configured;
  },

  /**
   * Get the active routable provider and model, or null if none is configured
   */
  getActiveRoutableModel(): { provider: string; model: string } | null {
    const config = this.getConfig();
    const configured = this.getConfiguredProviders();

    // Never infer a chat model from key order or from a research seat.
    if (!config.defaultProvider || !config.defaultModel || !configured.includes(config.defaultProvider)) {
      return null;
    }

    return { provider: config.defaultProvider, model: config.defaultModel };
  },

  /**
   * Get all active keys
   */
  getKeys(): CanonicalProviderKeys {
    return this.getConfig().keys;
  },

  /**
   * Save updated keys
   */
  saveKeys(keys: CanonicalProviderKeys): void {
    const config = this.getConfig();
    config.keys = keys;
    this.saveConfig(config);
  },

  /**
   * Get a specific key
   */
  getKey(provider: string): string | undefined {
    return this.getKeys()[provider];
  },
};
