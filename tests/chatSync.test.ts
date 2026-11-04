import { beforeEach, describe, expect, it } from 'vitest';
import { chatStore, ensureIds, titleFrom } from '../src/services/chatStore';
import { hashOf, planSync } from '../src/services/chatSyncService';
import { ChatMessage } from '../src/types';

const m = (id: string, role: 'user' | 'assistant', content: string): ChatMessage => ({ id, role, content, createdAt: 1 });

describe('planSync', () => {
  it('sends everything the first time', () => {
    const plan = planSync([m('a', 'user', 'hi'), m('b', 'assistant', 'hello')], {});
    expect(plan.upserts.map((u) => [u.id, u.position])).toEqual([['a', 0], ['b', 1]]);
    expect(plan.deleteIds).toEqual([]);
  });

  it('sends nothing when nothing changed', () => {
    const msgs = [m('a', 'user', 'hi')];
    expect(planSync(msgs, { a: { hash: hashOf(msgs[0]), position: 0 } })).toEqual({ upserts: [], deleteIds: [] });
  });

  it('sends edited messages and deletions (regenerate replaces the last reply)', () => {
    const before = [m('a', 'user', 'hi'), m('b', 'assistant', 'old')];
    const synced = { a: { hash: hashOf(before[0]), position: 0 }, b: { hash: hashOf(before[1]), position: 1 } };
    const plan = planSync([before[0], m('c', 'assistant', 'new')], synced);
    expect(plan.upserts.map((u) => u.id)).toEqual(['c']);
    expect(plan.deleteIds).toEqual(['b']);
  });

  it('never sends system messages or empty placeholders', () => {
    expect(planSync([{ id: 's', role: 'system', content: 'x' }, m('a', 'assistant', '')], {}).upserts).toEqual([]);
  });
});

describe('chatStore', () => {
  beforeEach(() => window.localStorage.clear());

  it('titles a chat from the first user message', () => {
    expect(titleFrom([m('a', 'user', '  Explain   transformers  ')])).toBe('Explain transformers');
    expect(titleFrom([])).toBe('New chat');
  });

  it('assigns ids to old messages without changing them', () => {
    const out = ensureIds([{ role: 'user', content: 'hi' }]);
    expect(out[0].id).toBeTruthy();
    expect(out[0].content).toBe('hi');
  });

  it('moves the old single conversation into a thread once', () => {
    window.localStorage.setItem('breezy_chat_history_v1', JSON.stringify([{ role: 'user', content: 'old chat' }]));
    const id = chatStore.init();
    expect(chatStore.loadMessages(id)[0].content).toBe('old chat');
    expect(chatStore.listThreads()).toHaveLength(1);
    expect(window.localStorage.getItem('breezy_chat_history_v1')).toBeNull();
    expect(chatStore.init()).toBe(id);
    expect(chatStore.listThreads()).toHaveLength(1);
  });

  it('creates, saves and deletes threads', () => {
    const id = chatStore.createThread();
    chatStore.saveMessages(id, [m('a', 'user', 'hello')]);
    expect(chatStore.listThreads()[0].title).toBe('hello');
    chatStore.deleteThread(id);
    expect(chatStore.listThreads()).toHaveLength(0);
  });
});
