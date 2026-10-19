import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../shell/Icon';
import { Markdown } from '../ui/Markdown';
import { timeAgo } from '../lib/research';

export interface NoteItem { id: string; title: string; content: string; updatedAt: number; }
const STORAGE_KEY = 'breezy_notes_v1';

function load(): NoteItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as NoteItem[];
    // Earlier builds seeded a sample note; never show it as the user's own.
    return raw.filter((n) => !(n.id === 'note-1' && n.title === 'Empirical Verification Notes'));
  } catch { return []; }
}

export const NotesWorkspace: React.FC = () => {
  const [notes, setNotes] = useState<NoteItem[]>(load); const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [mode, setMode] = useState<'edit' | 'preview'>('edit'); const [detail, setDetail] = useState(false);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch { /* storage full */ } }, [notes]);
  useEffect(() => { if (!activeId && notes[0] && window.matchMedia('(min-width: 1024px)').matches) setActiveId(notes[0].id); }, []); // eslint-disable-line
  const active = notes.find((n) => n.id === activeId) || null;
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return [...notes].sort((a, b) => b.updatedAt - a.updatedAt).filter((n) => !t || n.title.toLowerCase().includes(t) || n.content.toLowerCase().includes(t)); }, [notes, q]);
  const add = () => { const n: NoteItem = { id: `note-${Date.now()}`, title: 'Untitled note', content: '', updatedAt: Date.now() }; setNotes((x) => [n, ...x]); setActiveId(n.id); setMode('edit'); setDetail(true); };
  const patch = (id: string, p: Partial<NoteItem>) => setNotes((x) => x.map((n) => (n.id === id ? { ...n, ...p, updatedAt: Date.now() } : n)));
  const del = (id: string) => { if (!window.confirm('Delete this note?')) return; setNotes((x) => x.filter((n) => n.id !== id)); setActiveId(null); setDetail(false); };
  const exportMd = (n: NoteItem) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`# ${n.title}\n\n${n.content}\n`], { type: 'text/markdown' })); a.download = `${n.title.replace(/[^\w\-]+/g, '_') || 'note'}.md`; a.click(); URL.revokeObjectURL(a.href); };

  return (
    <div className="h-full flex flex-col lg:flex-row max-w-6xl mx-auto w-full">
      <aside className={`${detail ? 'hidden lg:flex' : 'flex'} flex-col lg:w-80 shrink-0 px-gutter lg:px-space-lg py-space-lg gap-space-md min-h-0 flex-1 lg:flex-none`}>
        <div className="flex items-center justify-between"><h1 className="font-headline-lg text-headline-lg">Notes</h1><button type="button" onClick={add} className="flex items-center gap-space-xs px-space-md min-h-[40px] rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-label-md text-label-md transition-colors"><Icon name="add" className="text-[18px]" />New</button></div>
        <label className="flex items-center gap-space-sm bg-surface-container rounded-xl hairline px-space-md min-h-[44px] focus-within:shadow-[inset_0_0_0_1px_rgba(76,214,251,0.5)]"><Icon name="search" className="text-[18px] text-outline" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="flex-1 min-w-0 bg-transparent font-body-sm text-body-sm focus:outline-none placeholder:text-outline" /></label>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-space-xs">
          {shown.map((n) => (<button key={n.id} type="button" onClick={() => { setActiveId(n.id); setDetail(true); }} className={`text-left rounded-2xl p-space-md min-h-[64px] transition-colors ${n.id === activeId ? 'bg-surface-container-high ring-1 ring-primary/40' : 'bg-surface-container hover:bg-surface-container-high'}`}><div className="font-headline-sm text-headline-sm truncate">{n.title || 'Untitled note'}</div><div className="font-body-sm text-body-sm text-on-surface-variant truncate">{n.content.replace(/[#*`>\-]/g, '').trim() || 'Empty note'}</div><div className="font-code-sm text-code-sm text-outline mt-0.5">{timeAgo(n.updatedAt)}</div></button>))}
          {!shown.length && <div className="flex flex-col items-center text-center gap-space-sm py-space-xl text-on-surface-variant"><Icon name="sticky_note_2" className="text-[40px] text-outline-variant" /><p className="font-body-sm text-body-sm">{notes.length ? 'No notes match your search.' : 'No notes yet. Create one to start writing.'}</p></div>}
        </div>
      </aside>
      <section className={`${detail ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 min-h-0 flex-col px-gutter lg:px-space-lg py-space-lg lg:pl-0 gap-space-md`}>
        {active ? (<>
          <div className="flex items-center gap-space-sm"><button type="button" aria-label="Back to notes" onClick={() => setDetail(false)} className="lg:hidden w-11 h-11 -ml-2 flex items-center justify-center rounded-xl text-on-surface-variant"><Icon name="arrow_back" className="text-[22px]" /></button>
            <input value={active.title} onChange={(e) => patch(active.id, { title: e.target.value })} aria-label="Note title" placeholder="Title" className="flex-1 min-w-0 bg-transparent font-headline-lg text-headline-lg focus:outline-none placeholder:text-outline" />
            <div className="flex p-1 rounded-xl bg-surface-container-low shrink-0" role="group" aria-label="View">{(['edit', 'preview'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`px-3 min-h-[36px] rounded-lg font-label-md text-label-md capitalize ${mode === m ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant'}`}>{m}</button>)}</div>
            <button type="button" aria-label="Export note" title="Export as Markdown" onClick={() => exportMd(active)} className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high"><Icon name="download" className="text-[20px]" /></button>
            <button type="button" aria-label="Delete note" title="Delete" onClick={() => del(active.id)} className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-error hover:bg-surface-container-high"><Icon name="delete" className="text-[20px]" /></button></div>
          <div className="flex-1 min-h-0 bg-surface-container rounded-3xl coat overflow-hidden flex">
            {mode === 'edit' ? <textarea value={active.content} onChange={(e) => patch(active.id, { content: e.target.value })} aria-label="Note body" placeholder="Write in Markdown…" className="flex-1 w-full bg-transparent p-space-lg font-code-md text-base lg:text-code-md leading-relaxed resize-none focus:outline-none placeholder:text-outline" />
              : <div className="flex-1 overflow-y-auto p-space-lg">{active.content.trim() ? <Markdown>{active.content}</Markdown> : <p className="text-outline font-body-sm text-body-sm">Nothing to preview.</p>}</div>}
          </div></>) : <div className="flex-1 flex flex-col items-center justify-center text-center gap-space-sm text-on-surface-variant"><Icon name="edit_note" className="text-[48px] text-outline-variant" /><p className="font-body-md text-body-md">Select a note or create a new one.</p></div>}
      </section>
    </div>
  );
};
