/**
 * Centralized Canonical Provider State Engine
 * Single Source of Truth for Provider Status, Routing, and Model Availability
 * 
 * Enforces Constitutional Truthfulness:
 * - AVAILABLE: Model exists in static catalog
 * - CONFIGURED: User BYOK key saved or server key present
 * - CONNECTED: Successfully verified via live ping
 * - ACTIVE: Currently selected AND routable with valid credentials
 * - NOT_CONNECTED: Unkeyed / unconfigured
 */

import { providerConfigService, AVAILABLE_MODELS } from './providerConfigService';
import { apiClient } from './apiClient';

export type ProviderConnectionStatus = 'CONNECTED' | 'CONFIGURED' | 'NOT_CONNECTED' | 'ERROR';

export interface EffectiveProviderInfo {
  provider: string;
  status: ProviderConnectionStatus;
  source: 'byok' | 'server' | 'local' | 'none';
  hasKey: boolean;
  latencyMs?: number;
  errorMessage?: string;
}

class EffectiveProviderService {
  private serverGeminiConfigured: boolean = false;
  private verificationCache: Map<string, { status: ProviderConnectionStatus; latencyMs?: number; msg?: string; timestamp: number }> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.refreshServerHealth();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Check edge backend health to ascertain server-side Gemini key status
   */
  public async refreshServerHealth(): Promise<boolean> {
    try {
      const health = await apiClient.getHealth();
      const prev = this.serverGeminiConfigured;
      this.serverGeminiConfigured = Boolean(health.serverGeminiConfigured);
      if (prev !== this.serverGeminiConfigured) {
        this.notify();
      }
      return this.serverGeminiConfigured;
    } catch {
      this.serverGeminiConfigured = false;
      return false;
    }
  }

  public isServerGeminiConfigured(): boolean {
    return this.serverGeminiConfigured;
  }

  /**
   * Get single source of truth status for any provider
   */
  public getProviderInfo(provider: string): EffectiveProviderInfo {
    if (!provider) {
      return { provider: '', status: 'NOT_CONNECTED', source: 'none', hasKey: false };
    }

    const byokKey = providerConfigService.getKey(provider);
    const hasByok = Boolean(byokKey);
    const config = providerConfigService.getConfig();
    const hasSelectedLocalModel =
      (config.defaultProvider === provider && Boolean(config.defaultModel)) ||
      Object.values(config.roles || {}).some(
        (seat) => seat?.provider === provider && Boolean(seat.model)
      ) ||
      Boolean(providerConfigService.getKey(provider));

    const hasLocalRuntime =
      provider === 'ollama'
        ? Boolean(config.ollamaBaseUrl && hasSelectedLocalModel)
        : provider === 'openai-compatible'
          ? Boolean(config.openaiCompatibleBaseUrl && hasSelectedLocalModel)
          : false;
    const hasServer = provider === 'gemini' && this.serverGeminiConfigured;
    const hasKey = hasByok || hasServer || hasLocalRuntime;

    if (!hasKey) {
      return {
        provider,
        status: 'NOT_CONNECTED',
        source: 'none',
        hasKey: false,
      };
    }

    const cached = this.verificationCache.get(provider);
    if (cached) {
      return {
        provider,
        status: cached.status,
        source: hasByok ? 'byok' : hasServer ? 'server' : hasLocalRuntime ? 'local' : 'none',
        hasKey: true,
        latencyMs: cached.latencyMs,
        errorMessage: cached.msg,
      };
    }

    return {
      provider,
      status: 'CONFIGURED',
      source: hasByok ? 'byok' : hasServer ? 'server' : 'local',
      hasKey: true,
    };
  }

  /**
   * Verify a provider key live
   */
  public async verifyProvider(provider: string): Promise<EffectiveProviderInfo> {
    const info = this.getProviderInfo(provider);
    if (!info.hasKey) {
      return info;
    }

    const byokKey = providerConfigService.getKey(provider) || '';
    // Local runtimes (Ollama / OpenAI-compatible) do not have a remote vault key to verify.
    // Their routability is determined by the configured base URL and model instead.
    if (info.source === 'local') {
      this.verificationCache.set(provider, { status: 'CONNECTED', timestamp: Date.now() });
      this.notify();
      return this.getProviderInfo(provider);
    }

    if (info.source === 'server') {
      this.verificationCache.set(provider, {
        status: 'CONFIGURED',
        timestamp: Date.now(),
      });
      this.notify();
      return this.getProviderInfo(provider);
    }

    try {
      const startTime = Date.now();
      const res = await apiClient.verifyVaultKey(provider, byokKey);
      if (res.valid) {
        this.verificationCache.set(provider, {
          status: 'CONNECTED',
          latencyMs: res.latencyMs || Date.now() - startTime,
          timestamp: Date.now(),
        });
      } else {
        this.verificationCache.set(provider, {
          status: 'ERROR',
          msg: res.error || 'Key verification failed',
          timestamp: Date.now(),
        });
      }
    } catch (e: any) {
      this.verificationCache.set(provider, {
        status: 'ERROR',
        msg: e.message || 'Network error',
        timestamp: Date.now(),
      });
    }

    this.notify();
    return this.getProviderInfo(provider);
  }

  /**
   * Check if a provider is genuinely routable with active credentials
   */
  public isRoutable(provider: string): boolean {
    const info = this.getProviderInfo(provider);
    return info.hasKey && info.status !== 'ERROR';
  }

  /**
   * Get the primary active routable model or null
   */
  public getActiveRoutableModel(): { provider: string; model: string; source: 'byok' | 'server' | 'local' } | null {
    const config = providerConfigService.getConfig();
    const provider = config.defaultProvider;
    const model = config.defaultModel;

    // Chat uses only the explicitly selected default. A saved key or a research
    // seat assignment must not silently choose a provider/model for conversations.
    if (!provider || !model || !this.isRoutable(provider)) return null;

    const info = this.getProviderInfo(provider);
    return {
      provider,
      model,
      source: info.source as 'byok' | 'server' | 'local',
    };
  }
}

export const effectiveProviderService = new EffectiveProviderService();
