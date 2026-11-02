import React, { useEffect, useState } from 'react';
import { HistoryWorkspace } from './HistoryWorkspace';
import { NotesWorkspace } from './NotesWorkspace';
import { LibraryTab, parseLibraryTab } from '../lib/nav';

const TABS: Array<{ id: LibraryTab; label: string }> = [
  { id: 'history', label: 'Research history' },
  { id: 'notes', label: 'Notes' },
];

/** One place for saved work: past research runs and notes. */
export const LibraryWorkspace: React.FC = () => {
  const [tab, setTab] = useState<LibraryTab>(parseLibraryTab);
  useEffect(() => {
    const sync = () => setTab(parseLibraryTab());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const choose = (next: LibraryTab) => { setTab(next); window.history.replaceState(null, '', `#library/${next}`); };
  return (
    <div>
      <div className="px-4 sm:px-6 lg:px-8 pt-4">
        <div role="tablist" aria-label="Library sections" className="inline-flex gap-1 rounded-xl bg-surface-container-low p-1 border border-outline-variant/40">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}
              className={`min-h-9 rounded-lg px-4 font-label-md text-label-md transition-colors ${tab === t.id ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{t.label}</button>
          ))}
        </div>
      </div>
      {tab === 'history' ? <HistoryWorkspace /> : <NotesWorkspace />}
    </div>
  );
};
