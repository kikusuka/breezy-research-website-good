import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { BreezyLogo } from '../components/BreezyLogo';
import { ActiveTab, LAB_NAV, MAIN_NAV, PROFILE_NAV, TITLES } from '../lib/nav';
import { userProfileService } from '../services/userProfileService';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.0';
export const initialsOf = (name: string) => { const v = name.trim(); return v ? v.split(/\\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() || '').join('') : 'B'; };

interface ShellProps { tab: ActiveTab; go: (t: ActiveTab) => void; backendOnline: boolean; endpointName: string; children: React.ReactNode; }

function useProfile() {
  const [p, setP] = useState(() => userProfileService.getProfile());
  useEffect(() => {
    const on = () => setP(userProfileService.getProfile());
    window.addEventListener('storage', on); window.addEventListener('breezy:profile-changed', on);
    return () => { window.removeEventListener('storage', on); window.removeEventListener('breezy:profile-changed', on); };
  }, []);
  return p;
}
function Avatar({ name, photo, size = 'w-8 h-8' }: { name: string; photo?: string; size?: string }) {
  return (
    <span className={`${size} rounded-circle bg-surface-container-high text-primary font-code-sm text-code-sm flex items-center justify-center overflow-hidden shrink-0`}>
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

function Sidebar({ tab, go, isExpanded, mobileOpen, onToggleExpanded, onNavigate }: {
  tab: ActiveTab; go: (t: ActiveTab) => void; isExpanded: boolean; mobileOpen: boolean;
  onToggleExpanded: () => void; onNavigate: () => void;
}) {
  const profile = useProfile();
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
        className={`relative flex items-center gap-space-md px-space-md py-[10px] rounded-xl transition-colors duration-150 ${isExpanded ? 'w-full' : 'w-11 justify-center'} ${active ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}>
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-circle bg-primary" />}
        <Icon name={n.icon} className="text-[20px] shrink-0" />
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
    <aside className={`fixed inset-y-0 left-0 z-[70] flex flex-col justify-between bg-surface-container-low/95 backdrop-blur-xl shadow-[1px_0_0_rgba(61,73,77,0.35)] transition-[width,transform] duration-200 ease-out ${isExpanded ? 'w-64' : 'w-[4.25rem]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        <div className={`h-16 flex items-center shrink-0 ${isExpanded ? 'px-space-lg gap-space-sm' : 'justify-center'}`}>
          <button type="button" onClick={onToggleExpanded} aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'} title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'} className="flex items-center justify-center rounded-xl min-w-8 min-h-8 hover:bg-surface-container-high transition-colors">
            <BreezyLogo size={30} />
          </button>
          {isExpanded && <><button type="button" onClick={() => { go('landing'); onNavigate(); }} className="font-headline-sm text-headline-sm tracking-tight text-on-surface">Breezy</button>
            <span className="ml-auto font-code-sm text-code-sm text-primary bg-surface-container-highest px-space-xs py-0.5 rounded">{VERSION}</span></>}
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
        {isExpanded && <button type="button" onClick={() => { go('docs'); onNavigate(); }} className="flex items-center gap-space-sm px-space-md py-space-xs rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors text-left" title="Open documentation">
          <Icon name="help_outline" className="text-[18px]" />
          <span className="font-label-sm text-label-sm">Help &amp; documentation</span>
        </button>}
      </div>
    </aside>
  );
}

function MobileHeader({ tab, go, onMenu }: { tab: ActiveTab; go: (t: ActiveTab) => void; onMenu: () => void }) {
  return (
    <header className="lg:hidden shrink-0 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_0_rgba(61,73,77,0.3)] relative z-40">
      <div className="h-14 px-gutter flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <button type="button" aria-label="Open navigation" onClick={onMenu} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high">
            <Icon name="menu" className="text-[22px]" />
          </button>
          <button type="button" onClick={() => go('landing')} className="flex items-center gap-space-sm text-left min-w-0">
            <BreezyLogo size={28} />
            <span className="flex flex-col min-w-0"><span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">Breezy</span><span className="font-code-sm text-code-sm text-on-surface-variant leading-none mt-1 truncate">{TITLES[tab]}</span></span>
          </button>
        </div>
        <button aria-label="Open history" type="button" onClick={() => go('history')} className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary transition-colors"><Icon name="history" className="text-[21px]" /></button>
      </div>
    </header>
  );
}

export function Shell({ tab, go, children }: ShellProps) {
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
      <Sidebar tab={tab} go={go} isExpanded={sidebarExpanded} mobileOpen={mobileOpen} onToggleExpanded={() => setSidebarExpanded((open) => !open)} onNavigate={closeMobile} />
      <div className={`flex-1 min-w-0 flex flex-col transition-[padding-left] duration-200 ease-out ${sidebarExpanded ? 'lg:pl-64' : 'lg:pl-[4.25rem]'}`}>
        <MobileHeader tab={tab} go={(next) => { go(next); closeMobile(); }} onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto splatter-soft" id="main">{children}</main>
      </div>
    </div>
  );
}
