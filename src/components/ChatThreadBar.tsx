import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../shell/Icon';
import { chatStore, ChatThread } from '../services/chatStore';
import { chatSyncService, SyncStatus } from '../services/chatSyncService';

const when = (t: number): string => {
  const d = Date.now() - t;
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`;
  return new Date(t).toLocaleDateString();
};

const SYNC_TEXT: Partial<Record<SyncStatus, { icon: string; text: string; tone: string }>> = {
  syncing: { icon: 'sync', text: 'Saving…', tone: 'text-outline' },
  synced: { icon: 'cloud_done', text: 'Saved to your account', tone: 'text-outline' },
  full: { icon: 'cloud_off', text: 'Server storage full. Not syncing', tone: 'text-error' },
  error: { icon: 'cloud_off', text: 'Could not sync. Will retry', tone: 'text-tertiary' },
};

/** Conversation switcher and sync status for Chat. */
export const ChatThreadBar: React.FC<{ threadId: string; busy: boolean; onSwitch: (id: string) => void; onNew: () => void; refreshKey: number; canvasOn: boolean; onToggleCanvas: () => void }> = ({ threadId, busy, onSwitch, onNew, refreshKey, canvasOn, onToggleCanvas }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(chatSyncService.getStatus());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => chatSyncService.subscribe(setStatus), []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  void refreshKey; // re-read the thread list after restores and deletes
  const threads: ChatThread[] = chatStore.listThreads();
  const current = threads.find((t) => t.id === threadId);
  const sync = SYNC_TEXT[status];

  return (
    <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-7rem)] items-center gap-2 lg:left-5" ref={ref}>
      <div className="relative min-w-0">
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-9 max-w-[14rem] items-center gap-1.5 rounded-lg px-2.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
          <span className="truncate font-label-md text-label-md">{current?.title ?? 'New chat'}</span>
          <Icon name="expand_more" className="text-[18px] shrink-0" />
        </button>
        {open && (
          <div role="menu" aria-label="Conversations" className="absolute left-0 top-full mt-1 w-72 max-w-[85vw] overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container shadow-2xl">
            <button type="button" role="menuitem" disabled={busy} onClick={() => { setOpen(false); onNew(); }} className="flex w-full items-center gap-2 border-b border-outline-variant/40 px-3 min-h-11 text-left text-primary hover:bg-surface-container-high disabled:opacity-50">
              <Icon name="add" className="text-[18px]" /><span className="font-label-md text-label-md">New chat</span>
            </button>
            <ul className="max-h-72 overflow-y-auto p-1">
              {threads.length === 0 && <li className="px-3 py-3 font-body-sm text-body-sm text-outline">No saved chats yet.</li>}
              {threads.map((t) => (
                <li key={t.id}>
                  <button type="button" role="menuitem" disabled={busy} onClick={() => { setOpen(false); onSwitch(t.id); }} className={`flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-surface-container-high disabled:opacity-50 ${t.id === threadId ? 'bg-surface-container-high' : ''}`}>
                    <span className="truncate font-body-md text-body-md">{t.title}</span>
                    <span className="font-code-sm text-code-sm text-outline">{when(t.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" role="menuitemcheckbox" aria-checked={canvasOn} onClick={onToggleCanvas} className="flex w-full items-center gap-2 border-t border-outline-variant/40 px-3 min-h-11 text-left hover:bg-surface-container-high">
              <Icon name="edit_note" className="text-[18px] text-on-surface-variant" />
              <span className="flex-1 font-label-md text-label-md">Canvas for documents and code</span>
              <span className={`font-code-sm text-code-sm ${canvasOn ? 'text-primary' : 'text-outline'}`}>{canvasOn ? 'On' : 'Off'}</span>
            </button>
          </div>
        )}
      </div>
      {sync && (
        <span className={`hidden sm:flex items-center gap-1 font-code-sm text-code-sm ${sync.tone}`} role="status">
          <Icon name={sync.icon} className="text-[14px]" />
          {sync.text}
          {status === 'full' && <a href="#settings" className="underline underline-offset-2 text-primary ml-1">Manage</a>}
        </span>
      )}
    </div>
  );
};
