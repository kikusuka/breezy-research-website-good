/**
 * Account-scoped local storage.
 *
 * Existing Breezy data is kept on-device, but each authenticated Firebase UID gets
 * its own key namespace. The first sign-in migrates legacy unscoped keys to that
 * account. Firebase-owned persistence keys are never moved.
 */
const ACCOUNT_PREFIX = 'breezy:account-data:v1:';
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

export const accountStorage = {
  getItem(key: string): string | null {
    return localStorage.getItem(activeAccountUid ? scopedKey(activeAccountUid, key) : key);
  },
  setItem(key: string, value: string): void {
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
  const legacyPrefix = `${ACCOUNT_PREFIX}legacy:`;
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => Boolean(key))
    .filter((key) => !key.startsWith(ACCOUNT_PREFIX) && !isFirebaseOwnedKey(key));

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
        if (localStorage.getItem(legacyTarget) === null) localStorage.setItem(legacyTarget, value);
        moved.push({ original, target: legacyTarget, value, targetWasNew: localStorage.getItem(legacyTarget) === value });
      }
      localStorage.removeItem(original);
    }
  } catch (error) {
    // Roll back the migration as far as possible; do not open the workspace on a partial move.
    for (const item of moved.reverse()) {
      try {
        localStorage.removeItem(item.target);
        localStorage.setItem(item.original, item.value);
      } catch {
        // The caller will keep the workspace locked and report the storage failure.
      }
    }
    throw error;
  }
}

export function clearCurrentAccountStorage(): void {
  if (!activeAccountUid) return;
  const prefix = scopedPrefix(activeAccountUid);
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => Boolean(key) && key!.startsWith(prefix));
  keys.forEach((key) => localStorage.removeItem(key));
}
