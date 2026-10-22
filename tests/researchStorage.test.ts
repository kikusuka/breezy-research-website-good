import { beforeEach, describe, expect, it } from 'vitest';
import type { DebateSession } from '../src/types';
import {
  deleteSessionsFromIDB,
  loadSessionsFromIDB,
  replaceSessionsInIDB,
  syncSessionsToIDB,
} from '../src/services/sessionStorage';
import { setActiveAccountUid, setDataSavePreference } from '../src/services/accountStorage';

const DATABASE_NAME = 'synthexis_storage_db_unscoped';

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Could not reset test database'));
    request.onblocked = () => reject(new Error('Test database deletion was blocked'));
  });
}

function session(id: string): DebateSession {
  return {
    id,
    prompt: `Research prompt ${id}`,
    protocol: 'solo',
    tone: 'balanced',
    createdAt: Number(id.length),
    updatedAt: Number(id.length),
    status: 'completed',
    steps: [],
  } as DebateSession;
}

describe('research history IndexedDB lifecycle', () => {
  beforeEach(async () => {
    localStorage.clear();
    setActiveAccountUid(null);
    setDataSavePreference('researchHistory', true);
    await deleteDatabase();
  });

  it('persists and reads the full research records', async () => {
    const original = session('record-a');
    await syncSessionsToIDB([original]);

    await expect(loadSessionsFromIDB()).resolves.toEqual([original]);
  });

  it('serializes a pending save before an explicit delete so deleted records stay deleted', async () => {
    const original = session('record-to-delete');

    const save = syncSessionsToIDB([original]);
    const remove = deleteSessionsFromIDB([original.id]);
    await Promise.all([save, remove]);

    await expect(loadSessionsFromIDB()).resolves.toEqual([]);
  });

  it('replaces the old database contents when restoring a backup', async () => {
    await syncSessionsToIDB([session('old-a'), session('old-b')]);
    const restored = [session('restored-c')];

    await expect(replaceSessionsInIDB(restored)).resolves.toBe(true);
    await expect(loadSessionsFromIDB()).resolves.toEqual(restored);
  });

  it('allows explicit deletion even when future research saving is disabled', async () => {
    const original = session('existing-record');
    await syncSessionsToIDB([original]);
    setDataSavePreference('researchHistory', false);

    await deleteSessionsFromIDB([original.id]);

    await expect(loadSessionsFromIDB()).resolves.toEqual([]);
  });

  it('does not enqueue new research persistence while saving is disabled', async () => {
    setDataSavePreference('researchHistory', false);

    await syncSessionsToIDB([session('not-saved')]);

    await expect(loadSessionsFromIDB()).resolves.toEqual([]);
  });
});
