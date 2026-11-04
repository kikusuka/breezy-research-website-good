/** Canvas: documents and code the model writes into a side panel instead of the chat stream. */
export type CanvasKind = 'document' | 'code' | 'html';

export interface CanvasBlock { id: string; title: string; kind: CanvasKind; lang?: string; content: string; complete: boolean }
export type Segment = { type: 'text'; text: string } | { type: 'canvas'; block: CanvasBlock };

/**
 * Appended to the last user message in the request only (never stored or shown). Models that ignore it
 * simply answer in chat, and "Open in Canvas" still works on any reply.
 */
export const CANVAS_HINT = [
  'Formatting note (do not mention it): when you write a standalone document, long piece of text, or a complete code file the user will want to edit, put it inside',
  '<breezy-canvas id="short-id" title="Title" kind="document|code|html" lang="python">',
  '...content...',
  '</breezy-canvas>',
  'Use kind="document" for Markdown text, "code" with lang for source files, "html" for a full web page. Keep a stable id when revising the same item. Short answers and explanations stay in normal chat text.',
].join('\n');

export const withCanvasHint = <T extends { role: string; content: string }>(messages: T[]): T[] => {
  const i = messages.map((m) => m.role).lastIndexOf('user');
  if (i < 0) return messages;
  return messages.map((m, idx) => (idx === i ? { ...m, content: `${m.content}\n\n${CANVAS_HINT}` } : m));
};

const OPEN = /<breezy-canvas\b([^>]*)>/i;
const CLOSE = '</breezy-canvas>';

const slug = (v: string): string => v.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const attr = (attrs: string, name: string): string => new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs)?.[1]?.trim() ?? '';

/** Splits a reply into plain text and canvas blocks. An unclosed block (still streaming) is returned with complete=false. */
export function parseCanvas(text: string): Segment[] {
  const out: Segment[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = OPEN.exec(rest);
    if (!m) { out.push({ type: 'text', text: rest }); break; }
    if (m.index > 0) out.push({ type: 'text', text: rest.slice(0, m.index) });
    const after = rest.slice(m.index + m[0].length);
    const end = after.toLowerCase().indexOf(CLOSE);
    const complete = end >= 0;
    const raw = complete ? after.slice(0, end) : after;
    const kindAttr = attr(m[1], 'kind').toLowerCase();
    const kind: CanvasKind = kindAttr === 'code' || kindAttr === 'html' ? kindAttr : 'document';
    const title = attr(m[1], 'title') || 'Untitled';
    n += 1;
    out.push({ type: 'canvas', block: {
      id: slug(attr(m[1], 'id')) || slug(title) || `doc-${n}`,
      title, kind, lang: attr(m[1], 'lang') || undefined,
      content: raw.replace(/^\r?\n/, '').replace(/\r?\n$/, ''), complete,
    } });
    rest = complete ? after.slice(end + CLOSE.length) : '';
  }
  return out.filter((s) => s.type === 'canvas' || s.text.trim());
}

const EXT: Record<string, string> = { python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', tsx: 'tsx', jsx: 'jsx', json: 'json', css: 'css', sql: 'sql', bash: 'sh', sh: 'sh', java: 'java', c: 'c', cpp: 'cpp', rust: 'rs', go: 'go', kotlin: 'kt', html: 'html', markdown: 'md' };
export const fileNameFor = (title: string, kind: CanvasKind, lang?: string): string => {
  const ext = kind === 'document' ? 'md' : kind === 'html' ? 'html' : EXT[(lang || '').toLowerCase()] || 'txt';
  return `${slug(title) || 'canvas'}.${ext}`;
};
