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
    <Shell tab={activeTab} go={navigateTo} backendOnline={backendOnline} endpointName={endpointName}>
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
    </Shell>
  );
}
