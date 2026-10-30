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
  // These endpoints are called directly by the user's browser for Chat. Research
  // generation runs on Breezy's backend, which cannot reach that browser's localhost.
  if (provider === 'ollama' || provider === 'openai-compatible') return 'provider-unavailable';
  if (configuredProviders.includes(provider) || (provider === 'gemini' && serverGeminiConfigured)) {
    return 'ready';
  }
  return 'provider-unavailable';
}
