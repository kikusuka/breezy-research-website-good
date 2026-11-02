import React, { useState, useEffect } from 'react';
import { Shell } from './shell/Shell';
import { ActiveTab, parseHash } from './lib/nav';
import { ResearchWorkspace } from './components/ResearchWorkspace';
import { ChatWorkspace } from './components/ChatWorkspace';
import { BuildWorkspace } from './components/BuildWorkspace';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { LibraryWorkspace } from './components/LibraryWorkspace';
import { VaultWorkspace } from './components/VaultWorkspace';
import { DocsWorkspace } from './components/DocsWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { ProfileWorkspace } from './components/ProfileWorkspace';
import { apiClient } from './services/apiClient';
import { authService, AuthUser } from './services/authService';
import { DEV_SKIP_SIGNIN, activateDevSkip, clearDevSkip, isDevSkipActive } from './lib/devSkip';
import { AuthView } from './components/AuthView';
import { userProfileService } from './services/userProfileService';
import { prepareAccountStorage, setActiveAccountUid } from './services/accountStorage';
import { researchStore } from './lib/researchStore';

/**
 * Sign-in is required by default. For local development without Firebase, set
 * VITE_BREEZY_REQUIRE_AUTH=false in .env.local.
 *
 * This is only a frontend gate. Backend endpoints still enforce Firebase tokens;
 * never treat this flag as authorization or expose private user data through APIs.
 */
const AUTH_REQUIRED = import.meta.env.VITE_BREEZY_REQUIRE_AUTH !== 'false';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(parseHash);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [endpointName, setEndpointName] = useState<string>('Breezy Backend');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authStorageError, setAuthStorageError] = useState<string | null>(null);
  const [devSkip, setDevSkip] = useState<boolean>(isDevSkipActive);

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

    // One check on load and one when the connection returns. No polling: every ping costs a Worker request,
    // and real requests already update status through apiClient.subscribe below.
    checkBackend();
    window.addEventListener('online', checkBackend);

    const unsub = apiClient.subscribe((state) => {
      setBackendOnline(state.isOnline);
      setEndpointName(state.activeName);
    });

    return () => {
      window.removeEventListener('online', checkBackend);
      unsub();
    };
  }, []);

  const navigateTo = (tab: ActiveTab) => {
    window.location.hash = `#${tab}`;
    setActiveTab(tab);
  };

  // In review mode, mount the real workspaces without requiring an account.
  // Their local data uses the unscoped browser namespace until auth is restored.
  const workspaceEnabled = !AUTH_REQUIRED || Boolean(authUser) || devSkip;
  const showAuthGate = AUTH_REQUIRED && !authUser && !devSkip;

  if (showAuthGate) {
    if (authLoading) return <div className="min-h-[100dvh] grid place-items-center bg-background text-on-surface-variant" role="status">Checking your session…</div>;
    if (authStorageError) return (
      <div className="min-h-[100dvh] grid place-items-center bg-background p-5 text-center">
        <div className="max-w-md" role="alert">
          <h1 className="font-headline-md text-headline-md text-on-surface">Account setup needs attention</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 mb-6">{authStorageError}</p>
          <button type="button" onClick={retryAccountStorage} className="min-h-12 rounded-xl bg-primary px-6 text-on-primary font-label-md text-label-md">Try again</button>
        </div>
      </div>
    );
    return <AuthView onSkip={DEV_SKIP_SIGNIN ? () => { activateDevSkip(); setDevSkip(true); } : undefined} />;
  }

  return (
    <>
      <Shell tab={activeTab} go={navigateTo} backendOnline={backendOnline} endpointName={endpointName} previewMode={false}>
        <div className="relative min-h-full">
          {devSkip && !authUser && (
            <div role="status" className="flex flex-wrap items-center gap-2 border-b border-tertiary/40 bg-tertiary/10 px-4 py-2 font-body-sm text-body-sm text-on-surface-variant">
              <span className="flex-1 min-w-[200px]">Preview mode: sign-in skipped. Research and server features will not work until you sign in. Remove this before deploying.</span>
              <button type="button" onClick={() => { clearDevSkip(); setDevSkip(false); }} className="text-primary underline underline-offset-4">Sign in</button>
            </div>
          )}
          {authUser && authUser.providerId === 'password' && !authUser.emailVerified && (
            <div role="status" className="flex flex-wrap items-center gap-2 border-b border-outline-variant/40 bg-surface-container-low px-4 py-2 font-body-sm text-body-sm text-on-surface-variant">
              <span className="flex-1 min-w-[200px]">Confirm your email address using the link we sent to {authUser.email}.</span>
              <button type="button" onClick={() => void authService.resendVerificationEmail()} className="text-primary underline underline-offset-4">Resend email</button>
            </div>
          )}
          <div key={authUser?.uid || 'local'}>
            {workspaceEnabled ? <>
              {activeTab === 'research' && <ResearchWorkspace />}
              {activeTab === 'chat' && <ChatWorkspace />}
              {activeTab === 'build' && <BuildWorkspace />}
              {activeTab === 'canvas' && <CanvasWorkspace />}
              {activeTab === 'library' && <LibraryWorkspace />}
              {activeTab === 'models' && <VaultWorkspace />}
              {activeTab === 'docs' && <DocsWorkspace />}
              {activeTab === 'settings' && <SettingsWorkspace />}
              {activeTab === 'profile' && <ProfileWorkspace />}
            </> : null}
          </div>
        </div>
      </Shell>
    </>
  );
}
