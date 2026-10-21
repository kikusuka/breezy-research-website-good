/**
 * Shared Backend Core Types
 * Runtime-agnostic type definitions for Cloudflare Workers, Deno Deploy, and Node Express.
 */

export interface D1QueryResult<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta?: { changes?: number; duration?: number; rows_read?: number; rows_written?: number };
  error?: string;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1QueryResult<T>>;
  run(): Promise<D1QueryResult>;
}

export interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1QueryResult[]>;
}

export interface BackendEnv {
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  SAMBANOVA_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  TAVILY_API_KEY?: string;
  SERPER_API_KEY?: string;
  BRAVE_API_KEY?: string;
  SEARXNG_URL?: string;
  OLLAMA_BASE_URL?: string;
  OPENAI_COMPATIBLE_BASE_URL?: string;
  ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  /** Cloudflare D1 binding for durable chat history. Must reference the canonical database. */
  DB?: D1DatabaseBinding;
  [key: string]: string | D1DatabaseBinding | undefined;
}

export type SearchEngineProvider = 'google' | 'tavily' | 'serper' | 'brave' | 'duckduckgo' | 'searxng';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface SearchGroundingResult {
  engine: SearchEngineProvider;
  engineName: string;
  query: string;
  summary?: string;
  results: SearchResultItem[];
}

export interface CallAgentParams {
  provider: 'gemini' | 'groq' | 'sambanova' | 'openrouter' | 'anthropic' | 'ollama' | 'openai-compatible';
  model?: string;
  apiKey?: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  enableSearchGrounding?: boolean;
  onChunk: (chunk: string) => void;
  onUsage?: (usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number; cachedInputTokens?: number }) => void;
  env?: BackendEnv;
  signal?: AbortSignal;
}

export interface HealthResponse {
  ok: boolean;
  status: 'ok' | 'degraded';
  backend: 'cloudflare-worker' | 'deno-deploy' | 'render-node' | 'local-dev';
  version: string;
  serverGeminiConfigured: boolean;
  defaultModel: string;
  providers: string[];
  supportedProviders?: string[];
  timestamp: number;
}
