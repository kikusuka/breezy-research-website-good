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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(parseHash);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [endpointName, setEndpointName] = useState<string>('Breezy Backend');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

  // Keep the product gate in sync with the real Firebase session.
  useEffect(() => authService.onAuthChange((user) => {
    setAuthUser(user);
    setAuthLoading(false);
    if (user) {
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
      setAuthOpen(false);
    }
  }), []);

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

  return (
    <>
      <Shell tab={activeTab} go={navigateTo} backendOnline={backendOnline} endpointName={endpointName}>
        <div className="relative min-h-full">
          <div className={!authUser ? 'pointer-events-none select-none blur-[1px]' : ''} aria-hidden={!authUser}>
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
          </div>
          {!authUser && <div className="absolute inset-0 z-40 flex items-center justify-center p-5 bg-surface/35" aria-live="polite">
            <section className="w-full max-w-md rounded-3xl border border-outline-variant/60 bg-surface-container-low/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary"><span className="material-symbols-rounded text-[26px]">lock</span></div>
              <h2 className="font-headline-md text-headline-md text-on-surface">{authLoading ? 'Checking your session' : 'Your Breezy workspace'}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2 mb-6">{authLoading ? 'One moment while we check whether you’re signed in.' : 'You’re viewing a guest preview. Sign in to use chat, research, Build and your personal workspace.'}</p>
              {!authLoading && <button type="button" onClick={() => setAuthOpen(true)} className="w-full min-h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md hover:brightness-105 transition">Sign in to use Breezy</button>}
              <p className="font-body-sm text-body-sm text-outline mt-4">Your preview is read-only. No guest workspace is created.</p>
            </section>
          </div>}
        </div>
      </Shell>
      {authOpen && !authUser && <AuthView onClose={() => setAuthOpen(false)} />}
    </>
  );
}
