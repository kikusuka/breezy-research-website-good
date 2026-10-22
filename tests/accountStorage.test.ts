import { beforeEach, describe, expect, it } from 'vitest';
import {
  accountStorage,
  getDataSavePreferences,
  prepareAccountStorage,
  setActiveAccountUid,
  setDataSavePreference,
} from '../src/services/accountStorage';

describe('account-scoped local storage', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveAccountUid(null);
  });

  it('keeps each signed-in account namespace separate', () => {
    setActiveAccountUid('account-a');
    accountStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'note-a', text: 'private to A' }]));
    setActiveAccountUid('account-b');
    expect(accountStorage.getItem('breezy_notes_v1')).toBeNull();
    accountStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'note-b', text: 'private to B' }]));
    setActiveAccountUid('account-a');
    expect(JSON.parse(accountStorage.getItem('breezy_notes_v1') || '[]')).toEqual([{ id: 'note-a', text: 'private to A' }]);
    setActiveAccountUid('account-b');
    expect(JSON.parse(accountStorage.getItem('breezy_notes_v1') || '[]')).toEqual([{ id: 'note-b', text: 'private to B' }]);
  });

  it('migrates legacy app data to the first signed-in account without moving Firebase-owned keys', () => {
    localStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'legacy-note' }]));
    localStorage.setItem('firebase:authUser:example', 'firebase-owned-value');
    setActiveAccountUid('account-a');
    prepareAccountStorage('account-a');
    expect(accountStorage.getItem('breezy_notes_v1')).toBe(JSON.stringify([{ id: 'legacy-note' }]));
    expect(localStorage.getItem('breezy_notes_v1')).toBeNull();
    expect(localStorage.getItem('firebase:authUser:example')).toBe('firebase-owned-value');
  });

  it('preserves account data and moves conflicting legacy data into the legacy namespace', () => {
    setActiveAccountUid('account-a');
    accountStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'account-note' }]));
    setActiveAccountUid(null);
    localStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'legacy-note' }]));
    setActiveAccountUid('account-a');
    prepareAccountStorage('account-a');
    expect(JSON.parse(accountStorage.getItem('breezy_notes_v1') || '[]')).toEqual([{ id: 'account-note' }]);
    expect(localStorage.getItem('breezy_notes_v1')).toBeNull();
    expect(localStorage.getItem('breezy:account-legacy:v1:breezy_notes_v1')).toBe(JSON.stringify([{ id: 'legacy-note' }]));
  });

  it('does not save new notes when note saving is disabled', () => {
    setActiveAccountUid('account-a');
    setDataSavePreference('notes', false);
    accountStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'new-note' }]));
    expect(accountStorage.getItem('breezy_notes_v1')).toBeNull();
    expect(getDataSavePreferences().notes).toBe(false);
  });

  it('allows explicit note removal while note saving is disabled', () => {
    setActiveAccountUid('account-a');
    accountStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'keep' }, { id: 'delete' }]));
    setDataSavePreference('notes', false);
    accountStorage.setItem('breezy_notes_v1', JSON.stringify([{ id: 'keep' }]));
    expect(JSON.parse(accountStorage.getItem('breezy_notes_v1') || '[]')).toEqual([{ id: 'keep' }]);
  });
});
