import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../ui/Page';
import { Icon } from '../shell/Icon';
import { apiClient, ServerConversationSize, ServerStorageUsage } from '../services/apiClient';
import { authService } from '../services/authService';

export const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; usage: ServerStorageUsage };

const NEAR_FULL = 0.8;

/** Server storage meter. Numbers come from the backend; nothing here is estimated. */
export const StorageSettings: React.FC = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [list, setList] = useState<ServerConversationSize[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authService.getCurrentUser()) { setState({ kind: 'signed-out' }); return; }
    setState({ kind: 'loading' });
    try {
      const usage = await apiClient.getServerStorage();
      setState(usage ? { kind: 'ready', usage } : { kind: 'unavailable' });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not read server storage.' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openList = async () => {
    setListError(null);
    try { setList(await apiClient.listServerConversationSizes()); }
    catch (e) { setListError(e instanceof Error ? e.message : 'Could not load conversations.'); }
  };

  const remove = async (id: string) => {
    setBusyId(id); setListError(null);
    try {
      await apiClient.deleteServerConversation(id);
      setConfirmId(null);
      setList((cur) => (cur ? cur.filter((c) => c.id !== id) : cur));
      await load();
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not delete the conversation.');
    } finally { setBusyId(null); }
  };

  const btn = 'inline-flex items-center gap-2 min-h-10 rounded-xl px-4 font-label-md text-label-md transition-colors';

  return (
    <Card>
      <h2 className="font-headline-md text-headline-md">Server storage</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Chats saved to your Breezy account count toward a limit. Chats kept on this device do not.</p>

      {state.kind === 'loading' && <p className="font-body-sm text-body-sm text-on-surface-variant" role="status">Checking storage…</p>}
      {state.kind === 'signed-out' && <p className="font-body-sm text-body-sm text-on-surface-variant">Sign in to see your server storage.</p>}
      {state.kind === 'unavailable' && <p className="font-body-sm text-body-sm text-on-surface-variant">Server history is not enabled on this deployment, so nothing is stored on Breezy’s servers. Your chats stay on this device.</p>}
      {state.kind === 'error' && (
        <div className="flex flex-wrap items-center gap-space-sm" role="alert">
          <p className="font-body-sm text-body-sm text-error flex-1 min-w-[200px]">{state.message}</p>
          <button type="button" onClick={() => void load()} className={`${btn} bg-surface-container-high text-on-surface`}>Retry</button>
        </div>
      )}

      {state.kind === 'ready' && (() => {
        const { usedBytes, limitBytes, full } = state.usage;
        const ratio = Math.min(usedBytes / limitBytes, 1);
        const near = !full && ratio >= NEAR_FULL;
        return (
          <div>
            <div className="flex items-baseline justify-between gap-space-sm">
              <span className="font-headline-sm text-headline-sm">{formatBytes(usedBytes)} <span className="text-on-surface-variant font-body-sm text-body-sm">of {formatBytes(limitBytes)}</span></span>
              <span className="font-code-sm text-code-sm text-outline">{Math.round(ratio * 100)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-highest" role="progressbar" aria-label="Server storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
              <div className={`h-full rounded-full ${full ? 'bg-error' : near ? 'bg-tertiary' : 'bg-primary'}`} style={{ width: `${ratio * 100}%` }} />
            </div>
            <p className="mt-2 font-code-sm text-code-sm text-outline">Counts message text only. Run details and metadata are not counted.</p>

            {(full || near) && (
              <div className={`mt-space-md rounded-xl border p-space-md ${full ? 'border-error/40 bg-error-container/20' : 'border-tertiary/40 bg-tertiary/10'}`} role={full ? 'alert' : 'status'}>
                <p className="font-headline-sm text-headline-sm">{full ? 'Server storage is full' : 'Server storage is almost full'}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {full ? 'New messages will not be saved to your account until you free space. Replies already in progress finish and are kept.' : 'Free some space soon, or move to your own storage.'}
                </p>
                <div className="mt-space-sm flex flex-wrap gap-space-sm">
                  <button type="button" onClick={() => void openList()} className={`${btn} bg-primary text-on-primary`}><Icon name="delete" className="text-[18px]" /> Delete conversations</button>
                  <a href="#profile" className={`${btn} bg-surface-container-high text-on-surface`}><Icon name="add_to_drive" className="text-[18px]" /> Use my own storage (Google Drive)</a>
                </div>
              </div>
            )}

            {!full && !near && <button type="button" onClick={() => void openList()} className={`mt-space-md ${btn} bg-surface-container-high text-on-surface`}>Manage saved conversations</button>}
          </div>
        );
      })()}

      {listError && <p className="mt-space-sm font-body-sm text-body-sm text-error" role="alert">{listError}</p>}
      {list && (
        <div className="mt-space-md">
          <div className="eyebrow font-code-sm text-code-sm text-outline mb-2">LARGEST FIRST</div>
          {list.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No saved conversations.</p>}
          <ul className="divide-y divide-outline-variant/40">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-space-sm py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-body-md text-body-md">{c.title || 'Untitled'}</div>
                  <div className="font-code-sm text-code-sm text-outline">{formatBytes(c.bytes)}</div>
                </div>
                {confirmId === c.id ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === c.id} onClick={() => void remove(c.id)} className={`${btn} bg-error text-on-error`}>{busyId === c.id ? 'Deleting…' : 'Delete forever'}</button>
                    <button type="button" onClick={() => setConfirmId(null)} className={`${btn} bg-surface-container-high`}>Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmId(c.id)} aria-label={`Delete ${c.title || 'conversation'}`} className={`${btn} text-on-surface-variant hover:text-error`}><Icon name="delete" className="text-[18px]" /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
