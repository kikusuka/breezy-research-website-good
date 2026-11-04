import { accountStorage } from './accountStorage';
import { ChatMessage } from '../types';

/** Local-first chat threads. Everything here lives in this browser (scoped per account by accountStorage). */
export interface ChatThread { id: string; title: string; createdAt: number; updatedAt: number }

const INDEX_KEY = 'breezy_chat_threads_v1';
const ACTIVE_KEY = 'breezy_chat_active_v1';
const LEGACY_KEY = 'breezy_chat_history_v1';
const msgKey = (id: string) => `breezy_chat_thread_${id}_v1`;

export const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

const read = <T,>(key: string, fallback: T): T => { try { const raw = accountStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };

export function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content.replace(/\s+/g, ' ').trim() ?? '';
  return first ? (first.length > 60 ? `${first.slice(0, 57)}…` : first) : 'New chat';
}

/** Give every message a stable id and timestamp. Returns the same array when nothing changed. */
export function ensureIds(messages: ChatMessage[]): ChatMessage[] {
  if (messages.every((m) => m.id && m.createdAt)) return messages;
  const base = Date.now();
  return messages.map((m, i) => (m.id && m.createdAt ? m : { ...m, id: m.id || newId(), createdAt: m.createdAt || base + i }));
}

export const chatStore = {
  listThreads(): ChatThread[] {
    return read<ChatThread[]>(INDEX_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  loadMessages(id: string): ChatMessage[] {
    return ensureIds(read<ChatMessage[]>(msgKey(id), []));
  },

  /** Throws when the browser refuses the write, so the UI can warn. */
  saveMessages(id: string, messages: ChatMessage[]): void {
    accountStorage.setItem(msgKey(id), JSON.stringify(messages));
    const threads = read<ChatThread[]>(INDEX_KEY, []);
    const now = Date.now();
    const title = titleFrom(messages);
    const i = threads.findIndex((t) => t.id === id);
    if (i >= 0) threads[i] = { ...threads[i], title, updatedAt: now };
    else threads.push({ id, title, createdAt: now, updatedAt: now });
    accountStorage.setItem(INDEX_KEY, JSON.stringify(threads));
  },

  createThread(): string {
    const id = newId();
    accountStorage.setItem(ACTIVE_KEY, id);
    return id;
  },

  /** Adds a thread restored from the server without making it active. */
  importThread(id: string, messages: ChatMessage[], updatedAt: number): void {
    accountStorage.setItem(msgKey(id), JSON.stringify(messages));
    const threads = read<ChatThread[]>(INDEX_KEY, []).filter((t) => t.id !== id);
    threads.push({ id, title: titleFrom(messages), createdAt: messages[0]?.createdAt || updatedAt, updatedAt });
    accountStorage.setItem(INDEX_KEY, JSON.stringify(threads));
  },

  deleteThread(id: string): void {
    accountStorage.removeItem(msgKey(id));
    accountStorage.setItem(INDEX_KEY, JSON.stringify(read<ChatThread[]>(INDEX_KEY, []).filter((t) => t.id !== id)));
    if (accountStorage.getItem(ACTIVE_KEY) === id) accountStorage.removeItem(ACTIVE_KEY);
  },

  getActiveId(): string | null { return accountStorage.getItem(ACTIVE_KEY); },
  setActiveId(id: string): void { accountStorage.setItem(ACTIVE_KEY, id); },

  /** Call once on load. Moves the old single-conversation history into a thread, then returns the active thread id. */
  init(): string {
    const threads = read<ChatThread[]>(INDEX_KEY, []);
    if (!threads.length) {
      const legacy = read<ChatMessage[]>(LEGACY_KEY, []);
      if (legacy.length) {
        const id = newId();
        this.saveMessages(id, ensureIds(legacy));
        accountStorage.removeItem(LEGACY_KEY);
        this.setActiveId(id);
        return id;
      }
    }
    const active = this.getActiveId();
    if (active && (threads.some((t) => t.id === active) || !threads.length)) return active;
    const id = threads[0]?.id ?? this.createThread();
    this.setActiveId(id);
    return id;
  },
};
