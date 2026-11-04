import { accountStorage } from './accountStorage';
import { CanvasBlock, CanvasKind } from '../lib/canvas';

export interface CanvasVersion { content: string; at: number; source: 'model' | 'you'; messageId?: string }
export interface CanvasDoc { id: string; title: string; kind: CanvasKind; lang?: string; versions: CanvasVersion[] }
export type CanvasDocs = Record<string, CanvasDoc>;

const key = (threadId: string) => `breezy_canvas_${threadId}_v1`;
const MAX_VERSIONS = 30;
const COALESCE_MS = 30_000;

export const canvasStore = {
  load(threadId: string): CanvasDocs {
    try { return JSON.parse(accountStorage.getItem(key(threadId)) || '{}'); } catch { return {}; }
  },
  save(threadId: string, docs: CanvasDocs): void {
    try { accountStorage.setItem(key(threadId), JSON.stringify(docs)); } catch { /* storage full: docs stay in memory for this session */ }
  },
  remove(threadId: string): void { try { accountStorage.removeItem(key(threadId)); } catch { /* ignore */ } },
};

const cap = (versions: CanvasVersion[]): CanvasVersion[] => (versions.length > MAX_VERSIONS ? versions.slice(versions.length - MAX_VERSIONS) : versions);

/** Idempotent: the same message never adds the same version twice, so it is safe to call on every render pass. */
export function applyModelBlock(docs: CanvasDocs, block: CanvasBlock, messageId: string, now = Date.now()): CanvasDocs {
  if (!block.complete) return docs;
  const existing = docs[block.id];
  if (existing?.versions.some((v) => v.messageId === messageId)) return docs;
  const version: CanvasVersion = { content: block.content, at: now, source: 'model', messageId };
  if (!existing) return { ...docs, [block.id]: { id: block.id, title: block.title, kind: block.kind, lang: block.lang, versions: [version] } };
  if (existing.versions[existing.versions.length - 1]?.content === block.content) return docs;
  return { ...docs, [block.id]: { ...existing, title: block.title || existing.title, versions: cap([...existing.versions, version]) } };
}

/** A user edit. Rapid typing coalesces into one version instead of dozens. */
export function applyUserEdit(docs: CanvasDocs, id: string, content: string, now = Date.now()): CanvasDocs {
  const doc = docs[id];
  if (!doc) return docs;
  const last = doc.versions[doc.versions.length - 1];
  if (last.content === content) return docs;
  const versions = last.source === 'you' && now - last.at < COALESCE_MS
    ? [...doc.versions.slice(0, -1), { ...last, content, at: now }]
    : cap([...doc.versions, { content, at: now, source: 'you' as const }]);
  return { ...docs, [id]: { ...doc, versions } };
}

/** Make an older version the newest one. History is kept, so restoring can itself be undone. */
export function restoreVersion(docs: CanvasDocs, id: string, index: number, now = Date.now()): CanvasDocs {
  const doc = docs[id];
  const v = doc?.versions[index];
  if (!doc || !v) return docs;
  return { ...docs, [id]: { ...doc, versions: cap([...doc.versions, { content: v.content, at: now, source: 'you' }]) } };
}

/** Universal fallback: turn any reply into a document, even if the model ignored the canvas format. */
export function docFromMessage(docs: CanvasDocs, messageId: string, text: string, now = Date.now()): { docs: CanvasDocs; id: string } {
  const id = `reply-${messageId.slice(0, 8)}`;
  if (docs[id]) return { docs, id };
  const heading = /^#{1,3}\s+(.+)$/m.exec(text)?.[1]?.trim();
  const title = (heading || text.trim().split('\n')[0] || 'Reply').slice(0, 60);
  return { id, docs: { ...docs, [id]: { id, title, kind: 'document', versions: [{ content: text, at: now, source: 'model', messageId }] } } };
}
