import React, { useEffect, useRef, useState } from 'react';
import { providerConfigService, CanonicalWorkspaceConfig } from '../services/providerConfigService';
import { Page, Card, fieldCls } from '../ui/Page';
import { Icon } from '../shell/Icon';
import { announceConfigChange } from '../lib/useModelState';
import { accountStorage, DataSaveCategory, getDataSavePreferences, setDataSavePreference, shouldSaveDataCategory } from '../services/accountStorage';
import { deleteSessionsFromIDB, loadSessions, loadSessionsFromIDB, replaceSessionsInIDB, saveSessions } from '../services/sessionStorage';

const ENGINES = [
  ['duckduckgo', 'DuckDuckGo', 'No key needed'], ['tavily', 'Tavily', 'Key in Models'], ['serper', 'Serper', 'Key in Models'],
  ['brave', 'Brave Search', 'Key in Models'], ['google', 'Google Custom Search', 'Key in Models'], ['searxng', 'SearXNG', 'Open metasearch instance'],
] as const;

export const SettingsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CanonicalWorkspaceConfig>(providerConfigService.getConfig()); const [saved, setSaved] = useState(false); const t = useRef<number | undefined>(undefined);
  useEffect(() => setConfig(providerConfigService.getConfig()), []);
  const change = (p: Partial<CanonicalWorkspaceConfig>) => { const next = { ...config, ...p }; setConfig(next); providerConfigService.saveConfig(next); announceConfigChange(); setSaved(true); window.clearTimeout(t.current); t.current = window.setTimeout(() => setSaved(false), 1800); };
  const [savePrefs, setSavePrefs] = useState(getDataSavePreferences);
  const [backupSelection, setBackupSelection] = useState<Record<DataSaveCategory, boolean>>({ researchHistory: true, chatHistory: true, notes: true, canvas: true });
  const [backupStatus, setBackupStatus] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreInputKey, setRestoreInputKey] = useState(0);
  const toggleSavePref = (category: DataSaveCategory, enabled: boolean) => {
    try { setSavePrefs(setDataSavePreference(category, enabled)); }
    catch { setSaved(false); }
  };
  const backupKeys: Record<Exclude<DataSaveCategory, 'researchHistory'>, string> = {
    chatHistory: 'breezy_chat_history_v1', notes: 'breezy_notes_v1', canvas: 'breezy_canvas_cards_v1',
  };
  const exportBackup = async () => {
    setBackupBusy(true); setBackupStatus('');
    try {
      const categories: Partial<Record<DataSaveCategory, unknown>> = {};
      for (const category of Object.keys(backupSelection) as DataSaveCategory[]) {
        if (!backupSelection[category]) continue;
        if (category === 'researchHistory') {
          const full = await loadSessionsFromIDB();
          categories.researchHistory = full.length ? full : loadSessions();
        } else {
          const raw = accountStorage.getItem(backupKeys[category]);
          categories[category] = raw ? JSON.parse(raw) : [];
        }
      }
      const backup = { format: 'breezy-local-backup', version: 1, exportedAt: new Date().toISOString(), categories };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'breezy-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupStatus('Backup exported. Keep the file somewhere safe; it stays on your device until you choose to share it.');
    } catch {
      setBackupStatus('Export failed. Browser storage may be unavailable or contain unreadable data.');
    } finally { setBackupBusy(false); }
  };
  const restoreBackup = async (file: File | undefined) => {
    if (!file) return;
    setBackupBusy(true); setBackupStatus('');
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== 'breezy-local-backup' || parsed?.version !== 1 || !parsed?.categories || typeof parsed.categories !== 'object') throw new Error('Unsupported backup format');
      const selected = (Object.keys(backupSelection) as DataSaveCategory[]).filter((category) => backupSelection[category] && parsed.categories[category] !== undefined);
      if (!selected.length) { setBackupStatus('Choose at least one category included in this backup.'); return; }
      for (const category of selected) {
        if (!shouldSaveDataCategory(category)) continue;
        const value = parsed.categories[category];
        if (!Array.isArray(value)) throw new Error('Invalid ' + category + ' data');
        if (category === 'researchHistory' && value.some((item: any) => !item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.prompt !== 'string')) throw new Error('Research history validation failed');
        if (category === 'notes' && value.some((item: any) => !item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.content !== 'string')) throw new Error('Notes validation failed');
        if (category === 'canvas' && value.some((item: any) => !item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.content !== 'string')) throw new Error('Canvas validation failed');
        if (category === 'chatHistory' && value.some((item: any) => !item || typeof item !== 'object')) throw new Error('Chat history validation failed');
      }
      const skipped = selected.filter((category) => !shouldSaveDataCategory(category));
      if (!window.confirm('Restore the selected data categories? Existing data in selected categories will be replaced. ' + (skipped.length ? 'Saving is turned off for: ' + skipped.join(', ') + '; those categories will be skipped. ' : '') + 'This cannot be automatically undone.')) return;
      for (const category of selected) {
        if (!shouldSaveDataCategory(category)) continue;
        const value = parsed.categories[category];
        if (category === 'researchHistory') {
          // Commit the full-fidelity copy before reporting restore success. If IndexedDB
          // is unavailable, saveSessions retains the app's localStorage-only fallback.
          await replaceSessionsInIDB(value);
          const result = saveSessions(value);
          if (result === 'failed') throw new Error('Could not save restored research history to local browser storage');
        } else {
          accountStorage.setItem(backupKeys[category], JSON.stringify(value));
        }
      }
      setBackupStatus('Restore finished. Applied ' + selected.filter((category) => shouldSaveDataCategory(category)).length + ' selected category/categories' + (skipped.length ? '; skipped disabled: ' + skipped.join(', ') : '') + '. Reload the relevant workspace if it was already open.');
    } catch (error) {
      setBackupStatus(error instanceof Error ? 'Restore failed: ' + error.message + '. No automatic rollback is available, so check your data before retrying.' : 'Restore failed. The backup may be damaged or from an unsupported version.');
    } finally { setBackupBusy(false); setRestoreInputKey((n) => n + 1); }
  };
  return (
    <Page crumb="Settings" title="Settings" subtitle="How research runs search the web and reason. Changes save instantly on this device." narrow
      right={<span className={`flex items-center gap-1 font-code-sm text-code-sm text-tertiary transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} aria-live="polite"><Icon name="check" className="text-[16px]" />Saved</span>}>
      <Card><h2 className="font-headline-md text-headline-md">Web search</h2><p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Used by research runs to retrieve sources before and during the debate.</p>
        <div className="grid sm:grid-cols-2 gap-space-sm" role="radiogroup" aria-label="Search engine">{ENGINES.map(([id, name, note]) => { const on = (config.searchEngine || 'duckduckgo') === id; return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => change({ searchEngine: id as any })} className={`text-left rounded-2xl p-space-md min-h-[64px] transition-colors ${on ? 'bg-surface-container-high ring-1 ring-primary/50' : 'bg-surface-container-low hover:bg-surface-container-high'}`}>
            <div className="flex items-center justify-between"><span className="font-headline-sm text-headline-sm">{name}</span><span className={`w-4 h-4 rounded-circle flex items-center justify-center ${on ? 'bg-primary' : 'bg-surface-container-highest'}`}>{on && <Icon name="check" className="text-[12px] text-on-primary" />}</span></div>
            <div className="font-code-sm text-code-sm text-outline mt-0.5">{note}</div></button>); })}</div></Card>

      <Card>
        <h2 className="font-headline-md text-headline-md">Portable backup</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Export a JSON backup to your device, or restore from a previous Breezy backup. Select the categories to include or restore. This does not upload anything to a server.</p>
        <div className="grid sm:grid-cols-2 gap-space-xs mb-space-md">
          {([
            ['researchHistory', 'Research history'], ['chatHistory', 'Chat history'], ['notes', 'Notes'], ['canvas', 'Canvas cards'],
          ] as Array<[DataSaveCategory, string]>).map(([category, label]) => (
            <label key={category} className="flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm min-h-[44px] font-body-sm text-body-sm">
              <input type="checkbox" checked={backupSelection[category]} onChange={(e) => setBackupSelection((prev) => ({ ...prev, [category]: e.target.checked }))} className="accent-primary" />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <button type="button" disabled={backupBusy || !Object.values(backupSelection).some(Boolean)} onClick={() => void exportBackup()} className="inline-flex items-center justify-center gap-space-xs rounded-xl bg-primary px-space-md min-h-[42px] text-on-primary font-label-md text-label-md disabled:opacity-50"><Icon name="download" className="text-[18px]" />Export backup</button>
          <label className={`inline-flex items-center justify-center gap-space-xs rounded-xl border border-outline-variant px-space-md min-h-[42px] font-label-md text-label-md cursor-pointer ${backupBusy ? 'opacity-50 pointer-events-none' : ''}`}><Icon name="upload" className="text-[18px]" />Restore backup<input key={restoreInputKey} type="file" accept="application/json,.json" disabled={backupBusy} onChange={(e) => void restoreBackup(e.target.files?.[0])} className="sr-only" /></label>
        </div>
        {backupStatus && <p role="status" aria-live="polite" className="font-body-sm text-body-sm text-on-surface-variant mt-space-md">{backupStatus}</p>}
        <p className="font-code-sm text-code-sm text-outline mt-space-sm">Backups may contain private research and chat content. Store and share the file carefully.</p>
      </Card>

      <Card>
        <h2 className="font-headline-md text-headline-md">Data &amp; privacy</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Choose which kinds of work Breezy keeps on this device. These controls affect future saves; turning one off does not erase data already saved. Use each workspace's delete controls to remove existing items.</p>
        <div className="flex flex-col divide-y divide-outline-variant/30">
          {([
            ['researchHistory', 'Research history', 'Research prompts, results, transcripts, and source notes.'],
            ['chatHistory', 'Chat history', 'Messages in the Chat workspace.'],
            ['notes', 'Notes', 'Notes you create in the Notes workspace.'],
            ['canvas', 'Canvas cards', 'Cards and ideas saved to Canvas.'],
          ] as Array<[DataSaveCategory, string, string]>).map(([category, title, description]) => (
            <div key={category} className="flex items-center justify-between gap-space-md py-space-md">
              <div className="min-w-0">
                <div className="font-headline-sm text-headline-sm">{title}</div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{description}</p>
              </div>
              <button type="button" role="switch" aria-checked={savePrefs[category]} aria-label={`Save ${title.toLowerCase()} on this device`} onClick={() => toggleSavePref(category, !savePrefs[category])} className={`relative w-12 h-7 shrink-0 rounded-circle transition-colors ${savePrefs[category] ? 'bg-primary' : 'bg-surface-container-highest'}`}>
                <span className={`absolute top-1 w-5 h-5 rounded-circle bg-surface transition-all ${savePrefs[category] ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
        <p className="font-code-sm text-code-sm text-outline mt-space-sm">Saved locally by default. These switches do not enable cloud sync.</p>
      </Card>
    </Page>
  );
};
