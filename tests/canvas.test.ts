import { describe, expect, it } from 'vitest';
import { fileNameFor, parseCanvas, withCanvasHint } from '../src/lib/canvas';
import { applyModelBlock, applyUserEdit, docFromMessage, restoreVersion } from '../src/services/canvasStore';

const tag = (body: string, attrs = 'id="essay" title="My essay" kind="document"') => `<breezy-canvas ${attrs}>\n${body}\n</breezy-canvas>`;

describe('parseCanvas', () => {
  it('splits text around a complete block', () => {
    const segs = parseCanvas(`Here you go.\n${tag('# Hello')}\nAnything else?`);
    expect(segs.map((s) => s.type)).toEqual(['text', 'canvas', 'text']);
    const block = (segs[1] as any).block;
    expect(block).toMatchObject({ id: 'essay', title: 'My essay', kind: 'document', content: '# Hello', complete: true });
  });

  it('treats an unclosed block as still streaming', () => {
    const segs = parseCanvas('Sure.\n<breezy-canvas id="a" title="T" kind="code" lang="python">\nprint(1');
    const block = (segs[1] as any).block;
    expect(block.complete).toBe(false);
    expect(block.content).toBe('print(1');
    expect(block.lang).toBe('python');
  });

  it('returns plain text untouched and ignores unknown kinds', () => {
    expect(parseCanvas('just text')).toEqual([{ type: 'text', text: 'just text' }]);
    expect((parseCanvas(tag('x', 'title="Odd" kind="banana"'))[0] as any).block.kind).toBe('document');
  });

  it('makes a safe id from messy input', () => {
    expect((parseCanvas(tag('x', 'id="../My Doc!!" title="t"'))[0] as any).block.id).toBe('my-doc');
  });
});

describe('canvas hint', () => {
  it('is added to the last user message only', () => {
    const out = withCanvasHint([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }]);
    expect(out[0].content).toBe('a');
    expect(out[2].content.startsWith('c\n\n')).toBe(true);
    expect(out[2].content).toContain('breezy-canvas');
  });
});

describe('canvas versions', () => {
  const block = { id: 'd', title: 'D', kind: 'document' as const, content: 'v1', complete: true };

  it('creates a doc once per message and ignores replays', () => {
    const a = applyModelBlock({}, block, 'm1');
    expect(applyModelBlock(a, block, 'm1')).toBe(a);
    expect(a.d.versions).toHaveLength(1);
  });

  it('adds a version when the model revises, and skips unfinished blocks', () => {
    const a = applyModelBlock({}, block, 'm1');
    const b = applyModelBlock(a, { ...block, content: 'v2' }, 'm2');
    expect(b.d.versions.map((v) => v.content)).toEqual(['v1', 'v2']);
    expect(applyModelBlock(b, { ...block, content: 'v3', complete: false }, 'm3')).toBe(b);
  });

  it('coalesces quick user edits and restores old versions without losing history', () => {
    let docs = applyModelBlock({}, block, 'm1', 0);
    docs = applyUserEdit(docs, 'd', 'v1 a', 1000);
    docs = applyUserEdit(docs, 'd', 'v1 ab', 2000);
    expect(docs.d.versions.map((v) => v.content)).toEqual(['v1', 'v1 ab']);
    docs = restoreVersion(docs, 'd', 0, 3000);
    expect(docs.d.versions.map((v) => v.content)).toEqual(['v1', 'v1 ab', 'v1']);
  });

  it('can turn any reply into a document', () => {
    const { docs, id } = docFromMessage({}, 'abcdef123456', '# Plan\n\nText');
    expect(docs[id].title).toBe('Plan');
    expect(docFromMessage(docs, 'abcdef123456', 'other').id).toBe(id);
  });
});

describe('fileNameFor', () => {
  it('picks an extension from kind and language', () => {
    expect(fileNameFor('My Essay', 'document')).toBe('my-essay.md');
    expect(fileNameFor('Script', 'code', 'python')).toBe('script.py');
    expect(fileNameFor('Page', 'html')).toBe('page.html');
    expect(fileNameFor('Misc', 'code', 'zzz')).toBe('misc.txt');
  });
});
