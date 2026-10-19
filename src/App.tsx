import React, { useState, useEffect } from 'react';
import { Shell } from './shell/Shell';
import { ActiveTab, parseHash } from './lib/nav';
import { LandingView } from './components/LandingView';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(parseHash);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [endpointName, setEndpointName] = useState<string>('Breezy Backend');
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');

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

  const handleStartSearchWithQuery = (query: string) => {
    setInitialSearchQuery(query);
    navigateTo('research');
  };

  // If on landing, show pure full-bleed landing view
  if (activeTab === 'landing') {
    return (
      <div className="w-full min-h-screen bg-surface text-on-surface font-sans antialiased overflow-x-hidden">
        <LandingView onStartSearchWithQuery={handleStartSearchWithQuery} />
      </div>
    );
  }

  return (
    <Shell tab={activeTab} go={navigateTo} backendOnline={backendOnline} endpointName={endpointName}>
      {activeTab === 'research' && <ResearchWorkspace initialPrompt={initialSearchQuery} />}
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
