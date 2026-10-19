export const PROVIDER_LABELS: Record<string, string> = { gemini: 'Google Gemini', anthropic: 'Anthropic', groq: 'Groq', sambanova: 'SambaNova', openrouter: 'OpenRouter', ollama: 'Local Ollama', 'openai-compatible': 'OpenAI-compatible' };
export const providerLabel = (id: string) => PROVIDER_LABELS[id] || id || 'No provider';
export const RESEARCH_METHODS = ['adaptive', 'systematic', 'evidence-map', 'comparative'] as const;
