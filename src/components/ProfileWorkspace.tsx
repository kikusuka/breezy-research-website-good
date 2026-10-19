import React, { useEffect, useState } from 'react';
import { Page, Card, fieldCls } from '../ui/Page';
import { Icon } from '../shell/Icon';
import { initialsOf } from '../shell/Shell';
import { userProfileService, UserProfile } from '../services/userProfileService';
import { authService, isFirebaseConfigured } from '../services/authService';
import { getStorageQuotaStatus, StorageQuota, formatStorageSize } from '../services/storageQuotaService';
import { getGitHubToken, setGitHubToken } from '../services/ideService';

export const ProfileWorkspace: React.FC = () => {
  const [p, setP] = useState<UserProfile>(userProfileService.getProfile()); const [saved, setSaved] = useState(false);
  const [quota, setQuota] = useState<QuotaState>(null); const [gh, setGh] = useState(getGitHubToken()); const [ghShow, setGhShow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  type QuotaState = StorageQuota | null;
  useEffect(() => { getStorageQuotaStatus().then(setQuota).catch(() => setQuota(null)); }, []);
  const save = (patch: Partial<UserProfile>) => { const next = userProfileService.saveProfile(patch); setP(next); window.dispatchEvent(new Event('breezy:profile-changed')); setSaved(true); window.setTimeout(() => setSaved(false), 1500); };
  const google = async () => {
    setBusy(true); setMsg(null);
    try { const r = await authService.signInWithGoogle(); if (r?.user) save({ displayName: p.displayName || r.user.displayName || '', email: r.user.email || '', photoURL: r.user.photoURL || undefined, authorizationType: 'google_oauth' }); }
    catch (e: any) { setMsg(e?.message || 'Google sign-in failed.'); } finally { setBusy(false); }
  };
  const reset = () => { if (window.confirm('Erase all Breezy data on this device (keys, history, chat, notes, Canvas)? This cannot be undone.')) { try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ } window.location.hash = '#landing'; window.location.reload(); } };
  const pct = quota ? Math.min(100, Math.round((quota.usedMB / quota.limitMB) * 100)) : 0;
  const name = p.displayName.trim();
  return (
    <Page crumb="Profile" title="Profile" subtitle="Optional. Used for the sidebar and for Google and GitHub connections." narrow
      right={<span className={`flex items-center gap-1 font-code-sm text-code-sm text-tertiary transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} aria-live="polite"><Icon name="check" className="text-[16px]" />Saved</span>}>
      <Card><div className="flex items-center gap-space-md mb-space-lg"><span className="w-14 h-14 rounded-2xl bg-surface-container-high text-primary font-headline-md text-headline-md flex items-center justify-center overflow-hidden shrink-0 glow-primary">{p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : initialsOf(name)}</span>
        <div className="min-w-0"><div className="font-headline-md text-headline-md truncate">{name || 'Guest'}</div><div className="font-code-sm text-code-sm text-outline truncate">{p.email || 'Not signed in · data stays in this browser'}</div></div></div>
        <div className="grid sm:grid-cols-2 gap-space-md">{([['displayName', 'Display name', 'Your name'], ['roleTitle', 'Role', 'e.g. Researcher'], ['organization', 'Organization', 'Optional']] as const).map(([k, l, ph]) => (
          <label key={k} className={k === 'organization' ? 'sm:col-span-2' : ''}><span className="font-label-md text-label-md text-on-surface-variant">{l}</span>
            <input value={p[k] as string} onChange={(e) => setP({ ...p, [k]: e.target.value })} onBlur={() => save({ [k]: p[k] } as any)} placeholder={ph} className={`${fieldCls} mt-1`} /></label>))}</div></Card>

      <Card><h2 className="font-headline-md text-headline-md mb-space-md">Connections</h2>
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between gap-space-md flex-wrap"><div className="flex items-center gap-space-sm"><span className="w-9 h-9 rounded-xl bg-surface-container-high text-primary flex items-center justify-center"><Icon name="description" className="text-[20px]" /></span><div><div className="font-headline-sm text-headline-sm">Google</div><div className="font-body-sm text-body-sm text-on-surface-variant">For saving research to Google Docs</div></div></div>
            {p.authorizationType === 'google_oauth' ? <button type="button" onClick={async () => { await authService.signOut(); save({ authorizationType: 'guest', email: '', photoURL: undefined }); }} className="px-space-md min-h-[40px] rounded-xl bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md">Sign out</button>
              : <button type="button" disabled={busy || !isFirebaseConfigured} onClick={() => void google()} className="px-space-md min-h-[40px] rounded-xl bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40">{isFirebaseConfigured ? (busy ? 'Connecting…' : 'Connect Google') : 'Not configured on this deployment'}</button>}</div>
          {msg && <p role="alert" className="font-code-sm text-code-sm text-error">{msg}</p>}
          <label className="flex items-center justify-between gap-space-md"><span><span className="font-headline-sm text-headline-sm block">Auto-save finished research to Google Docs</span><span className="font-body-sm text-body-sm text-on-surface-variant">Requires a connected Google account.</span></span>
            <input type="checkbox" checked={p.autoSaveToDrive} onChange={(e) => save({ autoSaveToDrive: e.target.checked })} className="w-5 h-5 accent-[#4cd6fb]" /></label>
          <div className="border-t border-outline-variant/25 pt-space-md"><div className="flex items-center justify-between"><div className="font-headline-sm text-headline-sm">GitHub token <span className="font-body-sm text-body-sm text-outline">(for Build)</span></div><span className={`flex items-center gap-1.5 font-code-sm text-code-sm ${gh ? 'text-tertiary' : 'text-outline'}`}><span className={`w-1.5 h-1.5 rounded-circle ${gh ? 'bg-tertiary' : 'bg-outline'}`} />{gh ? 'Token saved' : 'Not connected'}</span></div>
            <div className="flex items-center gap-space-xs mt-space-sm bg-surface-container-lowest rounded-xl hairline px-space-sm"><input type={ghShow ? 'text' : 'password'} value={gh} onChange={(e) => { setGh(e.target.value); setGitHubToken(e.target.value.trim()); }} placeholder="ghp_… or fine-grained token" autoComplete="off" spellCheck={false} aria-label="GitHub token" className="flex-1 min-w-0 bg-transparent py-2.5 font-code-md text-code-md placeholder:text-outline-variant focus:outline-none" />
              <button type="button" aria-label={ghShow ? 'Hide token' : 'Show token'} onClick={() => setGhShow((v) => !v)} className="p-1.5 text-outline hover:text-on-surface"><Icon name={ghShow ? 'visibility_off' : 'visibility'} className="text-[18px]" /></button></div>
            <p className="font-body-sm text-body-sm text-outline mt-space-xs">Needs repository contents read and write access to commit. Stored only in this browser.</p></div>
        </div></Card>

      <Card><div className="flex items-center justify-between mb-space-sm"><h2 className="font-headline-md text-headline-md">Storage on this device</h2><span className="font-code-sm text-code-sm text-on-surface-variant">{quota ? `${formatStorageSize(quota.usedMB)} of ${formatStorageSize(quota.limitMB)}` : 'Unavailable'}</span></div>
        <div className="h-2 rounded-circle bg-surface-container-highest overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-circle ${pct >= 80 ? 'bg-[#F59E0B]' : 'bg-primary'}`} style={{ width: `${Math.max(pct, quota ? 2 : 0)}%` }} /></div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">Sessions, chat, notes, Canvas cards, settings and keys are kept in this browser. Clearing site data removes them.</p></Card>

      <div className="rounded-3xl bg-error-container/20 p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md mb-space-xl"><div><h2 className="font-headline-sm text-headline-sm text-error">Erase all data on this device</h2><p className="font-body-sm text-body-sm text-on-surface-variant">Removes keys, history, chat, notes and Canvas cards from this browser.</p></div>
        <button type="button" onClick={reset} className="px-space-lg min-h-[44px] rounded-xl bg-error-container text-on-error-container font-label-md text-label-md hover:brightness-110 transition">Erase everything</button></div>
    </Page>
  );
};
