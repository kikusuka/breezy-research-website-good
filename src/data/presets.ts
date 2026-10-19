import { PresetQuestion } from '../types';

export const PRESET_QUESTIONS: PresetQuestion[] = [
  {
    id: 'fintech-arch',
    title: 'High-Throughput Financial Ledger',
    category: 'Architecture & Scalability',
    difficulty: 'Complex',
    prompt: 'We are designing a mission-critical financial ledger for a cross-border payment network handling 50,000 transactions/sec with strict zero-loss consistency. Should we use an Event-Sourcing architecture on ScyllaDB/Kafka with Raft consensus, or a distributed NewSQL system like CockroachDB? Detail exact failure modes, split-brain recovery, and latencies.'
  },
  {
    id: 'logic-coins',
    title: 'The 12-Coin Counterfeit Puzzle',
    category: 'Deductive Logic & Proof',
    difficulty: 'Deep',
    prompt: 'You have 12 visually identical coins and a balance scale without weights. One coin is counterfeit and has a different weight (you do not know whether it is heavier or lighter). Can you identify the counterfeit coin and whether it is heavy or light in strictly 3 weighings? Provide the rigorous decision tree.'
  },
  {
    id: 'security-jwt',
    title: 'Auth Protocol Security Audit',
    category: 'Security & Red-Teaming',
    difficulty: 'Complex',
    prompt: 'Critique this authentication design: A Single Page Application stores an HTTP-only refresh token in cookies with SameSite=Lax and an in-memory access token (expires in 15 mins). To handle multiple browser tabs, it broadcasts token refreshes via BroadcastChannel API. What are the subtle race conditions, CSRF bypasses, and cache poisoning risks?'
  },
  {
    id: 'startup-moat',
    title: 'The 2M+ Context vs Vector RAG Dilemma',
    category: 'AI Strategy & Systems',
    difficulty: 'Quick',
    prompt: 'Will massive LLM context windows (2M+ tokens like Gemini and Llama long-context) make chunked vector databases and hybrid RAG obsolete for enterprise knowledge retrieval? Dissect retrieval precision, needle-in-a-haystack decay, cost economics, and latency trade-offs.'
  }
];
