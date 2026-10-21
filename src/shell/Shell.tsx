import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { BreezyLogo } from '../components/BreezyLogo';
import { ActiveTab, LAB_NAV, MAIN_NAV, PROFILE_NAV } from '../lib/nav';
import { userProfileService, UserProfile } from '../services/userProfileService';

export const initialsOf = (name: string) => { const v = name.trim(); return v ? v.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() || '').join('') : 'B'; };

interface ShellProps { tab: ActiveTab; go: (t: ActiveTab) => void; backendOnline: boolean; endpointName: string; children: React.ReactNode; previewMode?: boolean; }

const EMPTY_PROFILE: UserProfile = { displayName: '', email: '', roleTitle: '', organization: '', authorizationType: 'guest', autoSaveToDrive: false };

function useProfile(previewMode: boolean) {
  const [p, setP] = useState<UserProfile>(() => previewMode ? EMPTY_PROFILE : userProfileService.getProfile());
  useEffect(() => {
    if (previewMode) { setP(EMPTY_PROFILE); return; }
    const on = () => setP(userProfileService.getProfile());
    setP(userProfileService.getProfile());
    window.addEventListener('storage', on); window.addEventListener('breezy:profile-changed', on);
    return () => { window.removeEventListener('storage', on); window.removeEventListener('breezy:profile-changed', on); };
  }, [previewMode]);
  return p;
}
function Avatar({ name, photo, size = 'w-8 h-8' }: { name: string; photo?: string; size?: string }) {
  return (
    <span className={`${size} rounded-circle bg-surface-container-high text-primary font-code-sm text-code-sm flex items-center justify-center overflow-hidden shrink-0`}>
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

function Sidebar({ tab, go, isExpanded, mobileOpen, previewMode, onToggleExpanded, onNavigate }: {
  tab: ActiveTab; go: (t: ActiveTab) => void; isExpanded: boolean; mobileOpen: boolean; previewMode: boolean;
  onToggleExpanded: () => void; onNavigate: () => void;
}) {
  const profile = useProfile(previewMode);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const name = profile.displayName.trim() || 'Guest';
  const role = profile.roleTitle.trim() || 'Profile not set up';

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [profileMenuOpen]);

  const item = (n: { id: ActiveTab; label: string; icon: string }) => {
    const active = tab === n.id;
    return (
      <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); go(n.id); setProfileMenuOpen(false); onNavigate(); }} aria-current={active ? 'page' : undefined}
        title={!isExpanded ? n.label : undefined}
        className={`relative flex items-center gap-space-md px-space-md py-[9px] rounded-lg transition-colors duration-150 ${isExpanded ? 'w-full' : 'w-11 justify-center'} ${active ? 'bg-surface-container-high/75 text-primary' : 'text-on-surface-variant hover:bg-surface-container/70 hover:text-on-surface'}`}>
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-circle bg-primary" />}
        <Icon name={n.icon} className="text-[19px] shrink-0" />
        {isExpanded && <span className="font-body-md text-body-md truncate">{n.label}</span>}
      </a>
    );
  };

  const profileItem = (n: { id: ActiveTab; label: string; icon: string }) => (
    <button key={n.id} type="button" role="menuitem" onClick={() => { go(n.id); setProfileMenuOpen(false); onNavigate(); }}
      className={`w-full flex items-center gap-space-sm rounded-xl px-space-md py-space-sm text-left transition-colors ${tab === n.id ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
      <Icon name={n.icon} className="text-[19px]" />
      <span className="font-body-md text-body-md">{n.label}</span>
    </button>
  );

  return (
    <aside className={`fixed inset-y-0 left-0 z-[70] flex flex-col justify-between bg-surface/95 backdrop-blur-md border-r border-outline-variant/25 transition-[width,transform] duration-200 ease-out ${isExpanded ? 'w-64' : 'w-[4.25rem]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        <div className={`relative flex items-center h-16 shrink-0 px-2 gap-1 ${isExpanded ? 'lg:px-space-md lg:gap-space-sm' : 'justify-between lg:justify-center'}`}>
          <button type="button" onClick={() => { go('chat'); onNavigate(); }} aria-label="Go to chat" title="Go to chat" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl hover:bg-surface-container-high transition-colors">
            <BreezyLogo size={30} />
          </button>
          {isExpanded && <button type="button" onClick={() => { go('chat'); onNavigate(); }} className="font-headline-sm text-headline-sm tracking-tight text-on-surface">Breezy</button>}
          <button type="button" onClick={onToggleExpanded} aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'} title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'} className={`hidden lg:flex shrink-0 items-center justify-center rounded-lg transition-colors ${isExpanded ? 'ml-auto w-8 h-8 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface' : 'w-7 h-8 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'}`}>
            <Icon name={isExpanded ? 'left_panel_close' : 'left_panel_open'} className="text-[18px]" />
          </button>
        </div>
        <nav className={`py-space-sm flex flex-col gap-space-xs ${isExpanded ? 'px-space-md' : 'items-center px-1'}`} aria-label="Main navigation">
          {MAIN_NAV.map(item)}
        </nav>
        {isExpanded && <div className="px-space-md pt-space-md">
          <div className="px-space-md pb-space-xs font-label-sm text-label-sm uppercase tracking-wider text-outline">Laboratories</div>
          <nav className="flex flex-col gap-space-xs" aria-label="Laboratories">{LAB_NAV.map(item)}</nav>
        </div>}
      </div>
      <div className={`relative flex flex-col ${isExpanded ? 'p-space-md gap-space-sm' : 'items-center pb-space-md gap-space-md'}`}>
        {profileMenuOpen && <div role="menu" aria-label="Profile menu" className={`absolute z-[90] bottom-full mb-space-sm rounded-2xl border border-outline-variant/60 bg-surface-container-low p-space-xs shadow-2xl coat ${isExpanded ? 'left-space-md right-space-md' : 'left-full ml-space-sm w-52'}`}>
          {PROFILE_NAV.map(profileItem)}
        </div>}
        <button type="button" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}
          className={`text-left flex items-center transition-colors ${isExpanded ? 'w-full gap-space-md p-space-sm bg-surface-container rounded-2xl hover:bg-surface-container-high' : 'w-11 h-11 justify-center rounded-full hover:bg-surface-container-high'} ${tab === 'profile' ? 'ring-1 ring-primary/40' : ''}`}>
          <Avatar name={name} photo={profile.photoURL} />
          {isExpanded && <span className="flex flex-col min-w-0 flex-1"><span className="font-label-md text-label-md text-on-surface truncate">{name}</span><span className="font-label-sm text-label-sm text-on-surface-variant truncate">{role}</span></span>}
          {isExpanded && <Icon name={profileMenuOpen ? 'keyboard_arrow_down' : 'keyboard_arrow_up'} className="text-[18px] text-on-surface-variant" />}
        </button>
      </div>
    </aside>
  );
}

export function Shell({ tab, go, children, previewMode = false }: ShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const updateForViewport = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) setMobileOpen(false);
    };
    updateForViewport();
    window.addEventListener('resize', updateForViewport);
    return () => window.removeEventListener('resize', updateForViewport);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="h-[100dvh] w-full flex bg-surface text-on-surface overflow-hidden">
      {mobileOpen && <button type="button" aria-label="Close navigation" onClick={closeMobile} className="lg:hidden fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]" />}
      <Sidebar tab={tab} go={go} isExpanded={sidebarExpanded} mobileOpen={mobileOpen} previewMode={previewMode} onToggleExpanded={() => setSidebarExpanded((open) => !open)} onNavigate={closeMobile} />
      <div className={`flex-1 min-w-0 flex flex-col transition-[padding-left] duration-200 ease-out ${sidebarExpanded ? 'lg:pl-64' : 'lg:pl-[4.25rem]'}`}>
        <main className="relative flex-1 min-h-0 overflow-y-auto splatter-soft pt-14 lg:pt-0" id="main">
          <button type="button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="lg:hidden fixed z-50 left-3 top-2 w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface shadow-lg shadow-black/20 hover:bg-surface-container-high transition-colors" title="Open navigation"><Icon name="menu" className="text-[21px]" /></button>
          {children}
        </main>
      </div>
    </div>
  );
}
