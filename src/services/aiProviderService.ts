/**
 * Multi-Provider AI Service with Transparent Routing
 * Seamlessly integrates Backend Edge Proxy (Cloudflare / Deno / Render)
 * with Secure Client-Side Bring-Your-Own-Key (BYOK) proxying.
 * 
 * Truthful security model: Keys are stored locally and routed securely via edge backend proxies.
 * Never performs direct third-party browser-side requests.
 */

import { ProviderKeyConfig } from '../types';
import { apiClient } from './apiClient';
import { effectiveProviderService } from './effectiveProviderService';
import { providerConfigService, AVAILABLE_MODELS } from './providerConfigService';

export const aiProviderService = {
  /**
   * Get stored user provider keys from localStorage
   */
  getStoredKeys(): ProviderKeyConfig {
    return providerConfigService.getKeys();
  },

  /**
   * Save user provider keys
   */
  saveStoredKeys(config: ProviderKeyConfig) {
    providerConfigService.saveKeys(config);
  },

  /**
   * Generate content with genuine failover across only CONFIGURED and ROUTABLE providers.
   * Never fabricates execution on unconfigured providers.
   */
  async generateWithFailover(
    prompt: string,
    systemInstruction?: string,
    temperature: number = 0.7
  ): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
    const keys = this.getStoredKeys();
    const errors: string[] = [];

    // Check if any provider is actually configured
    const activeModel = effectiveProviderService.getActiveRoutableModel();
    if (!activeModel) {
      throw new Error('No usable default chat model is selected. Open Models, connect a provider, and explicitly choose a provider and model before running AI generation.');
    }

    // 1. Try primary active routable provider
    try {
      const res = await apiClient.chatBreezy({
        prompt,
        history: [],
        provider: activeModel.provider,
        model: activeModel.model,
        apiKey: keys[activeModel.provider] || undefined,
      });

      if (res && res.text) {
        const activeBackend = apiClient.getActiveEndpoint().name;
        return {
          text: res.text,
          providerUsed: `${activeModel.provider.toUpperCase()} (${activeModel.source === 'byok' ? 'BYOK via ' : activeModel.source === 'local' ? 'Local · ' : ''}${activeBackend})`,
          modelUsed: activeModel.model,
        };
      }
    } catch (err: any) {
      errors.push(`${activeModel.provider}: ${err.message || 'Request failed'}`);
    }

    // Only use a secondary provider when the user explicitly enabled and
    // configured a fallback provider AND model in settings.
    const config = providerConfigService.getConfig();
    const fallback = config.fallback;
    if (!fallback?.enabled || !fallback.provider || !fallback.model) {
      const summary = errors.length > 0 ? errors.join('; ') : 'Selected provider failed';
      throw new Error(`AI generation failed on the selected provider (${summary}). No automatic provider fallback is enabled.`);
    }

    if (fallback.provider === activeModel.provider) {
      throw new Error('The configured fallback must be different from the primary provider.');
    }
    if (!effectiveProviderService.isRoutable(fallback.provider)) {
      throw new Error(`Fallback provider ${fallback.provider} is not configured or is not routable.`);
    }

    try {
      const apiKey = keys[fallback.provider] || undefined;
      const res = await apiClient.chatBreezy({
        prompt,
        history: [],
        provider: fallback.provider,
        model: fallback.model,
        apiKey,
      });

      if (res && res.text) {
        const activeBackend = apiClient.getActiveEndpoint().name;
        return {
          text: res.text,
          providerUsed: `Explicit fallback · ${fallback.provider.toUpperCase()} via ${activeBackend}`,
          modelUsed: fallback.model,
        };
      }
      throw new Error('Fallback provider returned an empty response.');
    } catch (err: any) {
      errors.push(`Explicit fallback ${fallback.provider}: ${err.message || 'Request failed'}`);
      throw new Error(`AI generation failed (${errors.join('; ')}).`);
    }
  },
};
