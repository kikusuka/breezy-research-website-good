import { accountStorage } from './accountStorage';
import { apiClient } from './apiClient';
import { authService } from './authService';
import { chatStore, ensureIds } from './chatStore';
import { ChatMessage } from '../types';

/**
 * Pushes finished chat turns to the server. One request per sync, never per token.
 * Local data is always the source of truth for what you see; sync is a backup and a way to reach chats on another device.
 */
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'full' | 'error';

type Synced = Record<string, { hash: string; position: number }>;
const syncKey = (threadId: string) => `breezy_chat_sync_${threadId}_v1`;
const BATCH = 100;

export const hashOf = (m: ChatMessage): string => {
  let h = 5381;
  const text = `${m.role}\u0000${m.content}`;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${h}`;
};

export interface SyncPlan { upserts: Array<{ id: string; role: 'user' | 'assistant'; content: string; position: number; createdAt: number }>; deleteIds: string[] }

/** What changed since the last successful sync. Pure, so it is easy to test. */
export function planSync(messages: ChatMessage[], synced: Synced): SyncPlan {
  const upserts: SyncPlan['upserts'] = [];
  const present = new Set<string>();
  messages.forEach((m, position) => {
    if (!m.id || m.role === 'system' || !m.content) return;
    present.add(m.id);
    const prev = synced[m.id];
    if (!prev || prev.hash !== hashOf(m) || prev.position !== position) upserts.push({ id: m.id, role: m.role, content: m.content, position, createdAt: m.createdAt || Date.now() });
  });
  return { upserts, deleteIds: Object.keys(synced).filter((id) => !present.has(id)) };
}

let status: SyncStatus = 'idle';
let disabled = false; // set when the deployment has no server history, so we stop asking
const listeners = new Set<(s: SyncStatus) => void>();
const timers = new Map<string, number>();
const setStatus = (next: SyncStatus) => { if (status !== next) { status = next; listeners.forEach((l) => l(next)); } };

const readSynced = (threadId: string): Synced => { try { return JSON.parse(accountStorage.getItem(syncKey(threadId)) || '{}'); } catch { return {}; } };
const writeSynced = (threadId: string, value: Synced) => { try { accountStorage.setItem(syncKey(threadId), JSON.stringify(value)); } catch { /* next sync will resend; the server is idempotent */ } };

async function push(threadId: string, messages: ChatMessage[], replace: boolean): Promise<'ok' | 'conflict' | 'stop'> {
  const synced = replace ? {} : readSynced(threadId);
  const plan = planSync(messages, synced);
  if (!plan.upserts.length && !plan.deleteIds.length && !replace) return 'ok';
  const next: Synced = { ...synced };
  plan.deleteIds.forEach((id) => delete next[id]);
  const title = chatStore.listThreads().find((t) => t.id === threadId)?.title;
  const chunks = Math.max(1, Math.ceil(plan.upserts.length / BATCH));
  for (let c = 0; c < chunks; c++) {
    const slice = plan.upserts.slice(c * BATCH, (c + 1) * BATCH);
    const { status: code, body } = await apiClient.postChatSync({
      conversationId: threadId, title, messages: slice,
      deleteIds: c === 0 ? plan.deleteIds.slice(0, BATCH) : [], replace: replace && c === 0,
    });
    if (code === 503) { disabled = true; setStatus('off'); return 'stop'; }
    if (code === 413 && body?.code === 'STORAGE_QUOTA_EXCEEDED') { setStatus('full'); return 'stop'; }
    if (code === 409) return 'conflict';
    if (code < 200 || code >= 300 || !body?.ok) { setStatus('error'); return 'stop'; }
    slice.forEach((m) => { next[m.id] = { hash: hashOf(messages[m.position]), position: m.position }; });
    writeSynced(threadId, next);
  }
  writeSynced(threadId, next);
  return 'ok';
}

export const chatSyncService = {
  getStatus: () => status,
  subscribe(listener: (s: SyncStatus) => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },

  /** Debounced. Call after a turn finishes (not while a reply is streaming). */
  schedule(threadId: string, messages: ChatMessage[]): void {
    if (disabled || !authService.getCurrentUser() || !messages.length) { if (!authService.getCurrentUser()) setStatus('off'); return; }
    window.clearTimeout(timers.get(threadId));
    timers.set(threadId, window.setTimeout(() => { void chatSyncService.syncNow(threadId, messages); }, 1500));
  },

  async syncNow(threadId: string, messages: ChatMessage[]): Promise<void> {
    if (disabled || !authService.getCurrentUser()) return;
    setStatus('syncing');
    try {
      let result = await push(threadId, messages, false);
      if (result === 'conflict') result = await push(threadId, messages, true); // saved copy differs: this device wins
      if (result === 'ok') setStatus('synced');
      else if (result === 'conflict') setStatus('error');
    } catch { setStatus('error'); }
  },

  /** Removes the server copy too. Best effort: a chat that was never synced simply returns 404. */
  async deleteRemote(threadId: string): Promise<void> {
    window.clearTimeout(timers.get(threadId));
    try { accountStorage.removeItem(syncKey(threadId)); } catch { /* ignore */ }
    if (disabled || !authService.getCurrentUser()) return;
    try { await apiClient.deleteServerConversation(threadId); } catch { /* not on the server, or offline */ }
  },

  /** Brings chats saved from another device into this one. Only fetches threads this device does not have. */
  async restoreMissing(): Promise<number> {
    if (disabled || !authService.getCurrentUser()) return 0;
    try {
      const have = new Set(chatStore.listThreads().map((t) => t.id));
      const remote = (await apiClient.listServerConversations(20)).filter((c) => !have.has(c.id));
      let restored = 0;
      for (const conv of remote) {
        let rows: Awaited<ReturnType<typeof apiClient.getServerMessages>> = [];
        let before: number | undefined;
        for (let page = 0; page < 5; page++) {
          const chunk = await apiClient.getServerMessages(conv.id, before);
          rows = [...chunk, ...rows];
          if (chunk.length < 100) break;
          before = chunk[0].sequence_no;
        }
        if (!rows.length) continue;
        const messages: ChatMessage[] = ensureIds(rows.map((r) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at })));
        chatStore.importThread(conv.id, messages, conv.updated_at);
        const synced: Synced = {};
        messages.forEach((m, i) => { synced[m.id!] = { hash: hashOf(m), position: i }; });
        writeSynced(conv.id, synced);
        restored += 1;
      }
      return restored;
    } catch { return 0; }
  },
};
