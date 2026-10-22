import { DebateSession, DebateStep, DebateTone } from '../types';
import { accountStorage, getActiveAccountUid, getAccountDatabaseName, shouldSaveDataCategory } from './accountStorage';

export const STORAGE_SESSIONS_KEY = 'synthexis_research_sessions_v2';
export const STORAGE_ACTIVE_ID_KEY = 'synthexis_active_session_id_v2';
const DB_NAME = 'synthexis_storage_db';
function getDatabaseName() { const uid = getActiveAccountUid(); return uid ? getAccountDatabaseName(uid) : `${DB_NAME}_unscoped`; }
const STORE_NAME = 'research_sessions';

// Serialize writes/deletes within this tab so an earlier delayed save cannot
// finish after a delete and recreate records that the user explicitly removed.
let idbMutationQueue: Promise<void> = Promise.resolve();
function serializeIDBMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = idbMutationQueue.then(operation, operation);
  idbMutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not supported'));
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open research storage.'));
    request.onblocked = () => reject(new Error('Research storage is blocked by another tab.'));
  });
}

function waitForTransaction(tx: IDBTransaction, db: IDBDatabase, failureMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error(failureMessage)); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error(failureMessage)); };
  });
}

/** Serialize full-fidelity background saves and await transaction completion. */
export async function syncSessionsToIDB(sessions: DebateSession[]): Promise<void> {
  if (!shouldSaveDataCategory('researchHistory') || typeof indexedDB === 'undefined') return;
  const databaseName = getDatabaseName(); // Capture account before any async work.
  const snapshot = [...(sessions || [])];
  try {
    await serializeIDBMutation(async () => {
      const db = await openDatabase(databaseName);
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        snapshot.forEach((session) => store.put(session));
        await waitForTransaction(tx, db, 'Could not save research history to browser storage.');
      } catch (error) {
        db.close();
        throw error;
      }
    });
  } catch (err) {
    // Non-blocking background sync warning
    console.debug('IndexedDB sync background note:', err);
  }
}

/** Delete saved research records explicitly, even when future saving is disabled. */
export async function deleteSessionsFromIDB(ids?: string[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const databaseName = getDatabaseName(); // Capture account before queueing.
  await serializeIDBMutation(async () => {
    const db = await openDatabase(databaseName);
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (ids) ids.forEach((id) => store.delete(id));
      else store.clear();
      await waitForTransaction(tx, db, 'Could not delete research records.');
    } catch (error) {
      db.close();
      throw error;
    }
  });
}

/** Replace the full-fidelity research backup and wait for its IndexedDB transaction. */
export async function replaceSessionsInIDB(sessions: DebateSession[]): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  const databaseName = getDatabaseName();
  const snapshot = [...(sessions || [])];
  await serializeIDBMutation(async () => {
    const db = await openDatabase(databaseName);
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      snapshot.forEach((session) => store.put(session));
      await waitForTransaction(tx, db, 'Could not restore research history to browser storage.');
    } catch (error) {
      db.close();
      throw error;
    }
  });
  return true;
}

/**
 * IndexedDB absence means there is no full-fidelity copy to read. Actual read
 * failures reject so backup export cannot silently fall back to a partial copy.
 */
export async function loadSessionsFromIDB(): Promise<DebateSession[]> {
  if (typeof indexedDB === 'undefined') return [];
  const databaseName = getDatabaseName();
  const db = await openDatabase(databaseName);
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(error instanceof Error ? error : new Error('Could not read research history from browser storage.'));
    };
    let tx: IDBTransaction;
    try { tx = db.transaction(STORE_NAME, 'readonly'); }
    catch (error) { fail(error); return; }
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      if (settled) return;
      settled = true;
      const results = (req.result || []) as DebateSession[];
      db.close();
      resolve(results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    };
    req.onerror = () => fail(req.error || new Error('Could not read research history from browser storage.'));
    tx.onerror = () => fail(tx.error || new Error('Could not read research history from browser storage.'));
    tx.onabort = () => fail(tx.error || new Error('Research history read was interrupted.'));
  });
}

export function loadSessions(): DebateSession[] {
  try {
    const raw = accountStorage.getItem(STORAGE_SESSIONS_KEY) || accountStorage.getItem('synthexis_debate_sessions_v1');
    if (!raw) { saveSessions([]); return []; }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const userSessions = parsed.filter((s: DebateSession) =>
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

export type SessionSaveResult = 'saved' | 'pruned' | 'failed';
export function saveSessions(sessions: DebateSession[]): SessionSaveResult {
  void syncSessionsToIDB(sessions || []);
  try {
    accountStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify((sessions || []).slice(0, 40)));
    return 'saved';
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
      accountStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(pruned));
      return 'pruned';
    } catch (retryErr) {
      console.error('Critical quota error when saving research sessions:', retryErr);
      return 'failed';
    }
  }
}

export function loadActiveSessionId(): string | null {
  try { return accountStorage.getItem(STORAGE_ACTIVE_ID_KEY) || accountStorage.getItem('synthexis_active_session_id_v1'); }
  catch { return null; }
}

export function saveActiveSessionId(id: string | null): void {
  try {
    if (id) accountStorage.setItem(STORAGE_ACTIVE_ID_KEY, id);
    else accountStorage.removeItem(STORAGE_ACTIVE_ID_KEY);
  } catch (err) { console.error('Failed to save active session ID to localStorage:', err); }
}

export function createNewSession(prompt: string, protocol: 'trio' | 'quad' | 'duel' | 'solo', initialSteps: DebateStep[], tone: DebateTone = 'balanced'): DebateSession {
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
