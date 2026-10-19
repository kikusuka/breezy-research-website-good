export type ProviderId = 'gemini' | 'anthropic' | 'groq' | 'sambanova' | 'openrouter' | 'ollama' | 'openai-compatible';

export type SearchEngineProvider = 'google' | 'tavily' | 'serper' | 'brave' | 'duckduckgo' | 'searxng';

export interface ProviderKeyConfig {
  gemini?: string;
  anthropic?: string;
  groq?: string;
  sambanova?: string;
  openrouter?: string;
  tavily?: string;
  serper?: string;
  brave?: string;
  [key: string]: string | undefined;
}

export interface OllamaConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
}

export interface ModelUsageStats {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  estimated?: boolean;
}

export interface DebateUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  estimated: boolean;
  byRound?: Record<string, ModelUsageStats>;
}

export type AgentRole = 'architect' | 'skeptic' | 'verifier' | 'arbiter' | 'synthesizer' | 'solo';

export interface AgentConfig {
  id: AgentRole;
  name: string;
  roleTitle: string;
  description: string;
  provider: ProviderId | 'ollama';
  model: string;
  avatarColor: string;
  systemPrompt: string;
}

export interface DebateStep {
  stepId: string;
  role: AgentRole;
  agentName: string;
  provider: ProviderId | 'ollama';
  model: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  content: string;
  timestamp: number;
  durationMs?: number;
  critiqueSummary?: string;
  summary?: string;
  agreedPoints?: string[];
  disputedPoints?: string[];
  usage?: ModelUsageStats;
}

export type DebateTone = 'diplomatic' | 'balanced' | 'rigorous' | 'aggressive';

export interface ResearchClaim {
  id: string;
  claim: string;
  status: 'supported' | 'contradicted' | 'unresolved';
  confidence: number; // 0 - 100%
  supportingSources: Array<{ title: string; url: string; snippet?: string; domain?: string }>;
  counterEvidence: Array<{ title: string; url: string; snippet?: string; domain?: string }>;
  analystStance?: string;
  criticStance?: string;
  reviewerVerdict?: string;
  verifiedAt?: string;
}

export interface EvidenceContradiction {
  id: string;
  claimA: string;
  claimB: string;
  description: string;
  sourceA?: string;
  sourceB?: string;
  resolutionStatus: 'resolved' | 'contested' | 'unclear';
  reconciledResolution?: string;
}

export interface EvidenceSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  isPrimary: boolean;
  snippet: string;
  citationIndex?: number;
}

export interface ResearchMetrics {
  durationMs: number;
  claimsIdentified: number;
  claimsSupported: number;
  claimsContradicted: number;
  claimsUnresolved: number;
  sourcesConsulted: number;
  primarySourcesCount?: number;
  preferredDomainSourcesCount?: number;
}

export interface EvidenceGraph {
  researchPlan: string[];
  claims: ResearchClaim[];
  contradictions: EvidenceContradiction[];
  sourcesConsulted: EvidenceSource[];
}

export interface DebateSession {
  id: string;
  prompt: string;
  protocol: 'trio' | 'quad' | 'duel' | 'solo';
  tone?: DebateTone;
  searchEngine?: SearchEngineProvider;
  enableSearchGrounding?: boolean;
  researchMethod?: 'adaptive' | 'systematic' | 'evidence-map' | 'comparative';
  heartbeatEnabled?: boolean;
  heartbeatIntervalSec?: number;
  createdAt: number;
  updatedAt?: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  steps: DebateStep[];
  finalOutput?: string;
  evidenceGraph?: EvidenceGraph;
  researchMetrics?: ResearchMetrics;
  usage?: DebateUsage;
  metrics?: {
    durationMs: number;
    contentionLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
    resolvedPointsCount: number;
  };
  error?: string;
}

export interface PresetQuestion {
  id: string;
  title: string;
  category: string;
  prompt: string;
  difficulty: 'Quick' | 'Complex' | 'Deep';
}

export type WindowViewMode = 'chat' | 'council' | 'split';

export interface HeartbeatState {
  bpm: number;
  role?: AgentRole;
  agentName?: string;
  statusText: string;
  taskReminder?: string;
  timestamp: number;
}

export interface SessionSnapshot {
  id: string;
  sessionId: string;
  name: string;
  prompt: string;
  protocol: 'trio' | 'quad' | 'duel' | 'solo' | 'deep';
  steps: DebateStep[];
  finalOutput?: string;
  timestamp: number;
}

export interface SessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  promptCount: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'image' | 'text' | 'code';
  content?: string;
  size: number;
  uploadedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
}

export interface ModelConfig {
  provider: ProviderId | 'ollama';
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}
