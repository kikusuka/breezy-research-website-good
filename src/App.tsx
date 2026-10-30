import React, { useState, useEffect } from 'react';
import { Shell } from './shell/Shell';
import { ActiveTab, parseHash } from './lib/nav';
import { ResearchWorkspace } from './components/ResearchWorkspace';
import { ChatWorkspace } from './components/ChatWorkspace';
import { BuildWorkspace } from './components/BuildWorkspace';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { NotesWorkspace } from './components/NotesWorkspace';
import { VaultWorkspace } from './components/VaultWorkspace';
import { HistoryWorkspace } from './components/HistoryWorkspace';
import { DocsWorkspace } from './components/DocsWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { ProfileWorkspace } from './components/ProfileWorkspace';
import { apiClient } from './services/apiClient';
import { authService, AuthUser } from './services/authService';
import { AuthView } from './components/AuthView';
import { userProfileService } from './services/userProfileService';
import { GuestWorkspacePreview } from './components/GuestWorkspacePreview';
import { prepareAccountStorage, setActiveAccountUid } from './services/accountStorage';
import { researchStore } from './lib/researchStore';

/**
 * Review access is enabled by default so the UI can be evaluated without sign-in.
 * Set VITE_BREEZY_REQUIRE_AUTH=true to restore the frontend sign-in gate.
 *
 * This is only a frontend gate. Backend endpoints still enforce Firebase tokens;
 * never treat this flag as authorization or expose private user data through APIs.
 */
const AUTH_REQUIRED = import.meta.env.VITE_BREEZY_REQUIRE_AUTH === 'true';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(parseHash);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [endpointName, setEndpointName] = useState<string>('Breezy Backend');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authStorageError, setAuthStorageError] = useState<string | null>(null);

  // Restore the signed-in account's local namespace before mounting any workspace.
  useEffect(() => authService.onAuthChange((user) => {
    // In review mode, keep workspace data in the unscoped local namespace even if
    // this browser happens to have a Firebase session. Do not mix review data with
    // an account namespace until the real sign-in gate is explicitly enabled.
    if (!AUTH_REQUIRED) {
      setAuthLoading(false);
      setActiveAccountUid(null);
      researchStore.switchAccount();
      setAuthUser(null);
      setAuthOpen(false);
      return;
    }

    setAuthLoading(false);
    if (!user) {
      setActiveAccountUid(null);
      researchStore.switchAccount();
      setAuthUser(null);
      setAuthOpen(false);
      return;
    }

    try {
      setActiveAccountUid(user.uid);
      prepareAccountStorage(user.uid);
      researchStore.switchAccount();
      const providerId = user.providerId || '';
      const authorizationType = providerId === 'google.com' ? 'google_oauth'
        : providerId === 'github.com' ? 'github_oauth'
        : providerId === 'oidc.discord' ? 'discord_oauth'
        : 'email_password';
      userProfileService.saveProfile({
        displayName: user.displayName || user.email?.split('@')[0] || 'Breezy user',
        email: user.email || '',
        photoURL: user.photoURL || undefined,
        authorizationType,
      });
      window.dispatchEvent(new Event('breezy:profile-changed'));
      setAuthStorageError(null);
      setAuthUser(user);
      setAuthOpen(false);
    } catch {
      setActiveAccountUid(null);
      researchStore.switchAccount();
      setAuthUser(null);
      setAuthOpen(false);
      setAuthStorageError('Breezy could not safely separate this account’s local data. Free up browser storage, then retry. Your existing data has not been intentionally cleared.');
    }
  }), []);

  const retryAccountStorage = () => {
    const user = authService.getCurrentUser();
    if (!user) { setAuthStorageError(null); setAuthOpen(true); return; }
    try {
      setActiveAccountUid(user.uid);
      prepareAccountStorage(user.uid);
      researchStore.switchAccount();
      setAuthStorageError(null);
      setAuthUser(user);
    } catch {
      setActiveAccountUid(null);
      researchStore.switchAccount();
      setAuthStorageError('Breezy still cannot separate this account’s local data. Free up browser storage and retry.');
    }
  };

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const nextTab = parseHash();
      setActiveTab(nextTab);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Backend Health Check & Ping
  useEffect(() => {
    const checkBackend = async () => {
      const ok = await apiClient.checkHealth(true);
      setBackendOnline(ok);
      const active = apiClient.getActiveEndpoint();
      setEndpointName(active.name);
    };

    checkBackend();
    const interval = setInterval(checkBackend, 30000);

    const unsub = apiClient.subscribe((state) => {
      setBackendOnline(state.isOnline);
      setEndpointName(state.activeName);
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const navigateTo = (tab: ActiveTab) => {
    window.location.hash = `#${tab}`;
    setActiveTab(tab);
  };

  // In review mode, mount the real workspaces without requiring an account.
  // Their local data uses the unscoped browser namespace until auth is restored.
  const workspaceEnabled = !AUTH_REQUIRED || Boolean(authUser);
  const showAuthGate = AUTH_REQUIRED && !authUser;

  return (
    <>
      <Shell tab={activeTab} go={navigateTo} backendOnline={backendOnline} endpointName={endpointName} previewMode={showAuthGate}>
        <div className="relative min-h-full">
          <div key={authUser?.uid || 'local'} className={showAuthGate ? 'pointer-events-none select-none blur-[1px]' : ''} aria-hidden={showAuthGate}>
            {workspaceEnabled ? <>
              {activeTab === 'research' && <ResearchWorkspace />}
              {activeTab === 'chat' && <ChatWorkspace />}
              {activeTab === 'build' && <BuildWorkspace />}
              {activeTab === 'canvas' && <CanvasWorkspace />}
              {activeTab === 'notes' && <NotesWorkspace />}
              {activeTab === 'models' && <VaultWorkspace />}
              {activeTab === 'history' && <HistoryWorkspace />}
              {activeTab === 'docs' && <DocsWorkspace />}
              {activeTab === 'settings' && <SettingsWorkspace />}
              {activeTab === 'profile' && <ProfileWorkspace />}
            </> : <GuestWorkspacePreview tab={activeTab} />}
          </div>
          {showAuthGate && <div className="absolute inset-0 z-40 flex items-center justify-center p-5 bg-surface/35" aria-live="polite">
            <section className="w-full max-w-md rounded-3xl border border-outline-variant/60 bg-surface-container-low/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary"><span className="material-symbols-outlined text-[26px]">lock</span></div>
              <h2 className="font-headline-md text-headline-md text-on-surface">{authLoading ? 'Checking your session' : authStorageError ? 'Account setup needs attention' : 'Your Breezy workspace'}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2 mb-6">{authLoading ? 'One moment while we check whether you’re signed in.' : authStorageError || 'You’re viewing a guest preview. Sign in to use chat, research, Build and your personal workspace.'}</p>
              {!authLoading && <button type="button" onClick={authStorageError ? retryAccountStorage : () => setAuthOpen(true)} className="w-full min-h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:brightness-105 transition">{authStorageError ? 'Retry account setup' : 'Sign in to use Breezy'}</button>}
              <p className="font-body-sm text-body-sm text-outline mt-4">Your preview is read-only. No guest workspace is created.</p>
            </section>
          </div>}
        </div>
      </Shell>
      {showAuthGate && authOpen && <AuthView onClose={() => setAuthOpen(false)} />}
    </>
  );
}
