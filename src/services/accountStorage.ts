/**
 * Account-scoped local storage.
 *
 * Existing Breezy data is kept on-device, but each authenticated Firebase UID gets
 * its own key namespace. The first sign-in migrates legacy unscoped keys to that
 * account. Firebase-owned persistence keys are never moved.
 */
const ACCOUNT_PREFIX = 'breezy:account-data:v1:';
const LEGACY_PREFIX = 'breezy:account-legacy:v1:';
let activeAccountUid: string | null = null;

const encode = (value: string) => encodeURIComponent(value);
const scopedPrefix = (uid: string) => `${ACCOUNT_PREFIX}${encode(uid)}:`;
const scopedKey = (uid: string, key: string) => `${scopedPrefix(uid)}${encode(key)}`;

function isFirebaseOwnedKey(key: string): boolean {
  return key.startsWith('firebase:') ||
    key.startsWith('firebaseLocalStorageDb') ||
    key.startsWith('firebase-heartbeat-database');
}

export function setActiveAccountUid(uid: string | null): void {
  activeAccountUid = uid;
}

export function getActiveAccountUid(): string | null {
  return activeAccountUid;
}

export function getAccountDatabaseName(uid: string): string {
  return `synthexis_storage_db_${encode(uid)}`;
}

export type DataSaveCategory = 'researchHistory' | 'chatHistory' | 'notes' | 'canvas';
export interface DataSavePreferences {
  researchHistory: boolean;
  chatHistory: boolean;
  notes: boolean;
  canvas: boolean;
}
const DATA_SAVE_PREFS_KEY = 'breezy_data_save_preferences_v1';
const DEFAULT_DATA_SAVE_PREFS: DataSavePreferences = { researchHistory: true, chatHistory: true, notes: true, canvas: true };

export function getDataSavePreferences(): DataSavePreferences {
  try {
    const raw = activeAccountUid
      ? localStorage.getItem(scopedKey(activeAccountUid, DATA_SAVE_PREFS_KEY))
      : localStorage.getItem(DATA_SAVE_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      researchHistory: parsed.researchHistory !== false,
      chatHistory: parsed.chatHistory !== false,
      notes: parsed.notes !== false,
      canvas: parsed.canvas !== false,
    };
  } catch { return { ...DEFAULT_DATA_SAVE_PREFS }; }
}

export function shouldSaveDataCategory(category: DataSaveCategory): boolean {
  return getDataSavePreferences()[category];
}

export function setDataSavePreference(category: DataSaveCategory, enabled: boolean): DataSavePreferences {
  const next = { ...getDataSavePreferences(), [category]: enabled };
  const key = activeAccountUid ? scopedKey(activeAccountUid, DATA_SAVE_PREFS_KEY) : DATA_SAVE_PREFS_KEY;
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

function categoryForStorageKey(key: string): DataSaveCategory | null {
  if (['synthexis_research_sessions_v2', 'synthexis_debate_sessions_v1', 'synthexis_active_session_id_v2', 'synthexis_active_session_id_v1'].includes(key)) return 'researchHistory';
  if (key === 'breezy_chat_history_v1') return 'chatHistory';
  if (key === 'breezy_notes_v1') return 'notes';
  if (key === 'breezy_canvas_cards_v1') return 'canvas';
  return null;
}

export const accountStorage = {
  getItem(key: string): string | null {
    return localStorage.getItem(activeAccountUid ? scopedKey(activeAccountUid, key) : key);
  },
  setItem(key: string, value: string): void {
    const category = categoryForStorageKey(key);
    if (category && !shouldSaveDataCategory(category)) return;
    localStorage.setItem(activeAccountUid ? scopedKey(activeAccountUid, key) : key, value);
  },
  removeItem(key: string): void {
    localStorage.removeItem(activeAccountUid ? scopedKey(activeAccountUid, key) : key);
  },
};

/**
 * Move legacy unscoped app keys into the authenticated account's namespace.
 * If that account already has a value for a key, preserve the older unscoped
 * value in a non-active legacy namespace instead of overwriting account data.
 */
export function prepareAccountStorage(uid: string): void {
  const targetPrefix = scopedPrefix(uid);
  const legacyPrefix = LEGACY_PREFIX;
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => Boolean(key))
    .filter((key) => !key.startsWith(ACCOUNT_PREFIX) && !key.startsWith(LEGACY_PREFIX) && !isFirebaseOwnedKey(key));

  const moved: Array<{ original: string; target: string; value: string; targetWasNew: boolean }> = [];
  try {
    for (const original of keys) {
      const value = localStorage.getItem(original);
      if (value === null) continue;
      const target = `${targetPrefix}${encode(original)}`;
      const existing = localStorage.getItem(target);
      if (existing === null) {
        localStorage.setItem(target, value);
        moved.push({ original, target, value, targetWasNew: true });
      } else {
        const legacyTarget = `${legacyPrefix}${encode(original)}`;
        const legacyWasMissing = localStorage.getItem(legacyTarget) === null;
        if (legacyWasMissing) localStorage.setItem(legacyTarget, value);
        moved.push({ original, target: legacyTarget, value, targetWasNew: legacyWasMissing });
      }
      localStorage.removeItem(original);
    }
  } catch (error) {
    // Roll back the migration as far as possible; do not open the workspace on a partial move.
    for (const item of moved.reverse()) {
      try {
        if (item.targetWasNew) localStorage.removeItem(item.target);
        localStorage.setItem(item.original, item.value);
      } catch {
        // The caller will keep the workspace locked and report the storage failure.
      }
    }
    throw error;
  }
}

export async function clearCurrentAccountStorage(): Promise<void> {
  if (!activeAccountUid) throw new Error('No signed-in account is active.');
  const uid = activeAccountUid;

  // Delete the account database first. If another tab keeps it open, preserve the
  // localStorage data too and let the UI ask the user to close the other tab.
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(getAccountDatabaseName(uid));
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Could not delete this account’s research database.'));
      request.onblocked = () => reject(new Error('Close other Breezy tabs before erasing this account’s data, then try again.'));
    });
  }

  const prefix = scopedPrefix(uid);
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => Boolean(key) && key!.startsWith(prefix));
  keys.forEach((key) => localStorage.removeItem(key));
}
