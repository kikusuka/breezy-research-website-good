import { DebateSession, DebateStep, DebateTone } from '../types';

// Storage key constants
export const STORAGE_SESSIONS_KEY = 'synthexis_research_sessions_v2';
export const STORAGE_ACTIVE_ID_KEY = 'synthexis_active_session_id_v2';
const DB_NAME = 'synthexis_storage_db';
const STORE_NAME = 'research_sessions';

// IndexedDB asynchronous fallback manager
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Async IndexedDB background sync for large session graphs
 */
export async function syncSessionsToIDB(sessions: DebateSession[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const session of sessions) {
      store.put(session);
    }
  } catch (err) {
    // Non-blocking background sync warning
    console.debug('IndexedDB sync background note:', err);
  }
}

/**
 * Load full-fidelity sessions from IndexedDB
 */
export async function loadSessionsFromIDB(): Promise<DebateSession[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        resolve(results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Load all saved research sessions from LocalStorage.
 */
export function loadSessions(): DebateSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY) || localStorage.getItem('synthexis_debate_sessions_v1');
    if (!raw) {
      saveSessions([]);
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const userSessions = parsed.filter(
        (s: DebateSession) =>
          s &&
          !s.id?.startsWith('sample-') &&
          !s.id?.startsWith('mock-') &&
          !['sample-rlhf-session', 'sample-kafka-session', 'sample-moe-session'].includes(s.id) &&
          !s.prompt?.toLowerCase().includes('sparse attention') &&
          !s.prompt?.toLowerCase().includes('quantization degradation') &&
          !s.prompt?.toLowerCase().includes('rlhf alignment') &&
          !s.prompt?.toLowerCase().includes('kafka streaming') &&
          !s.prompt?.toLowerCase().includes('moe routing')
      );
      // Immediately write back clean list to purge old sample sessions from localStorage
      saveSessions(userSessions);
      return userSessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    saveSessions([]);
    return [];
  } catch (err) {
    console.error('Failed to read research sessions from localStorage:', err);
    return [];
  }
}

/**
 * Save array of sessions to LocalStorage and IndexedDB.
 */
export function saveSessions(sessions: DebateSession[]): void {
  // Sync to IndexedDB for unlimited capacity
  syncSessionsToIDB(sessions || []);

  try {
    const trimmed = (sessions || []).slice(0, 40);
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to save research sessions directly; attempting pruned compression:', err);
    try {
      const pruned = (sessions || []).slice(0, 20).map((s) => ({
        ...s,
        steps: (s.steps || []).map((st) => ({
          ...st,
          content: st.content && st.content.length > 25000 ? st.content.slice(0, 25000) + '... [Transcript Truncated for Storage]' : st.content,
        })),
        evidenceGraph: s.evidenceGraph ? {
          ...s.evidenceGraph,
          claims: (s.evidenceGraph.claims || []).slice(0, 15),
          sourcesConsulted: (s.evidenceGraph.sourcesConsulted || []).slice(0, 15),
          contradictions: (s.evidenceGraph.contradictions || []).slice(0, 10),
        } : undefined,
      }));
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(pruned));
    } catch (retryErr) {
      console.error('Critical quota error when saving research sessions:', retryErr);
    }
  }
}

/**
 * Load active session ID from LocalStorage.
 */
export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_ACTIVE_ID_KEY) || localStorage.getItem('synthexis_active_session_id_v1');
  } catch {
    return null;
  }
}

/**
 * Persist active session ID to LocalStorage.
 */
export function saveActiveSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_ID_KEY);
    }
  } catch (err) {
    console.error('Failed to save active session ID to localStorage:', err);
  }
}

/**
 * Helper to create a new session object
 */
export function createNewSession(
  prompt: string,
  protocol: 'trio' | 'quad' | 'duel' | 'solo',
  initialSteps: DebateStep[],
  tone: DebateTone = 'balanced'
): DebateSession {
  const now = Date.now();
  return {
    id: `deb_${now}_${Math.random().toString(36).slice(2, 7)}`,
    prompt,
    protocol,
    tone,
    createdAt: now,
    updatedAt: now,
    status: 'running',
    steps: initialSteps,
  };
}
