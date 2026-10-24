export type ResearchModelReadiness = 'unconfigured' | 'provider-unavailable' | 'ready';

/**
 * Research uses its explicitly selected research model, not the separate Chat default.
 * A provider is ready only when its own connection is configured, or Gemini is available
 * through the server-side key.
 */
export function getResearchModelReadiness(
  provider: string,
  model: string,
  configuredProviders: string[],
  serverGeminiConfigured: boolean,
): ResearchModelReadiness {
  if (!provider.trim() || !model.trim()) return 'unconfigured';
  if (configuredProviders.includes(provider) || (provider === 'gemini' && serverGeminiConfigured)) {
    return 'ready';
  }
  return 'provider-unavailable';
}
