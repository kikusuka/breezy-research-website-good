import { beforeEach, describe, expect, it } from 'vitest';
import {
  accountStorage,
  clearCurrentAccountStorage,
  prepareAccountStorage,
  setActiveAccountUid,
  getDataSavePreferences,
  setDataSavePreference,
} from '../src/services/accountStorage';

describe('account-scoped local storage', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveAccountUid(null);
  });

  it('migrates existing local data into the first signed-in account', () => {
    localStorage.setItem('breezy_notes_v1', JSON.stringify([{ title: 'Legacy note' }]));
    localStorage.setItem('firebase:authUser:do-not-move', 'firebase persistence');

    setActiveAccountUid('user-a');
    prepareAccountStorage('user-a');

    expect(accountStorage.getItem('breezy_notes_v1')).toContain('Legacy note');
    expect(localStorage.getItem('breezy_notes_v1')).toBeNull();
    expect(localStorage.getItem('firebase:authUser:do-not-move')).toBe('firebase persistence');
  });

  it('keeps different accounts isolated and restores each account data', () => {
    setActiveAccountUid('user-a');
    accountStorage.setItem('breezy_chat_history_v1', 'account A');
    setActiveAccountUid('user-b');
    expect(accountStorage.getItem('breezy_chat_history_v1')).toBeNull();
    accountStorage.setItem('breezy_chat_history_v1', 'account B');

    setActiveAccountUid('user-a');
    expect(accountStorage.getItem('breezy_chat_history_v1')).toBe('account A');
    setActiveAccountUid('user-b');
    expect(accountStorage.getItem('breezy_chat_history_v1')).toBe('account B');
  });

  it('clears only the current account namespace', async () => {
    setActiveAccountUid('user-a');
    accountStorage.setItem('breezy_notes_v1', 'A notes');
    setActiveAccountUid('user-b');
    accountStorage.setItem('breezy_notes_v1', 'B notes');

    await clearCurrentAccountStorage();
    expect(accountStorage.getItem('breezy_notes_v1')).toBeNull();

    setActiveAccountUid('user-a');
    expect(accountStorage.getItem('breezy_notes_v1')).toBe('A notes');
  });

  it('preserves a current account value and shelves conflicting legacy data', () => {
    setActiveAccountUid('user-a');
    accountStorage.setItem('breezy_notes_v1', 'new account data');
    setActiveAccountUid(null);
    localStorage.setItem('breezy_notes_v1', 'old unscoped data');

    prepareAccountStorage('user-a');
    setActiveAccountUid('user-a');
    expect(accountStorage.getItem('breezy_notes_v1')).toBe('new account data');
    expect(localStorage.getItem('breezy:account-legacy:v1:breezy_notes_v1')).toBe('old unscoped data');
  });
  it('lets users disable saving independently for each data category', () => {
    expect(getDataSavePreferences()).toEqual({ researchHistory: true, chatHistory: true, notes: true, canvas: true });

    setDataSavePreference('chatHistory', false);
    accountStorage.setItem('breezy_chat_history_v1', 'new chat');
    accountStorage.setItem('breezy_notes_v1', 'keep this note');
    expect(accountStorage.getItem('breezy_chat_history_v1')).toBeNull();
    expect(accountStorage.getItem('breezy_notes_v1')).toBe('keep this note');

    setDataSavePreference('chatHistory', true);
    accountStorage.setItem('breezy_chat_history_v1', 'saved after opting in');
    expect(accountStorage.getItem('breezy_chat_history_v1')).toBe('saved after opting in');
  });

});
