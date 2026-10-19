import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { BreezyLogo } from '../components/BreezyLogo';
import { ActiveTab, LAB_NAV, MAIN_NAV, TITLES } from '../lib/nav';
import { useModelState } from '../lib/useModelState';
import { userProfileService } from '../services/userProfileService';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.0';
export const initialsOf = (name: string) => { const v = name.trim(); return v ? v.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() || '').join('') : 'B'; };

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

function Sidebar({ tab, go, backendOnline, endpointName, isOpen, onToggle }: Omit<ShellProps, 'children'> & { isOpen: boolean; onToggle: () => void }) {
  const profile = useProfile();
  const name = profile.displayName.trim() || 'Guest';
  const role = profile.roleTitle.trim() || 'Profile not set up';
  const item = (n: { id: ActiveTab; label: string; icon: string }) => {
    const active = tab === n.id;
    return (
      <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); go(n.id); }} aria-current={active ? 'page' : undefined}
        className={`relative flex items-center gap-space-md px-space-md py-space-sm rounded-xl transition-colors ${active ? 'bg-surface-container-high text-primary font-medium' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}>
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-circle bg-primary" />}
        <Icon name={n.icon} className="text-[20px]" fill={active} />
        {isOpen && <span className="font-body-md text-body-md">{n.label}</span>}
      </a>
    );
  };
  return (
    <aside className={`fixed left-0 top-0 h-full ${isOpen ? 'w-64' : 'w-16'} z-[70] flex flex-col justify-between bg-surface-container-low/95 backdrop-blur-xl shadow-[1px_0_0_rgba(61,73,77,0.35)] transition-[width] duration-300 ease-in-out will-change-[width]`}>
      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        <button type="button" onClick={onToggle} className={`h-16 flex items-center shrink-0 ${isOpen ? 'px-space-lg gap-space-sm' : 'justify-center'}`}>
          <BreezyLogo size={30} />
          {isOpen && <><span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">Breezy</span>
          <span className="ml-auto font-code-sm text-code-sm text-primary bg-surface-container-highest px-space-xs py-0.5 rounded">v{VERSION}</span></>}
        </button>
        <nav className={`py-space-sm flex flex-col gap-space-xs ${isOpen ? 'px-space-md' : 'items-center'}`} aria-label="Main">{MAIN_NAV.map(item)}</nav>
        {isOpen && <div className="px-space-md pt-space-md">
          <div className="px-space-md pb-space-xs font-label-sm text-label-sm uppercase tracking-wider text-outline">Laboratories</div>
          <nav className="flex flex-col gap-space-xs" aria-label="Laboratories">{LAB_NAV.map(item)}</nav>
        </div>}
      </div>
      <div className={`flex flex-col ${isOpen ? 'p-space-md gap-space-sm' : 'items-center pb-space-md gap-space-md'}`}>
        <button type="button" onClick={() => go('profile')} className={`text-left flex items-center ${isOpen ? 'w-full gap-space-md p-space-sm bg-surface-container rounded-2xl' : 'w-10 h-10 justify-center rounded-circle'}`}>
          <Avatar name={name} photo={profile.photoURL} size={isOpen ? 'w-8 h-8' : 'w-8 h-8'} />
          {isOpen && <span className="flex flex-col min-w-0 flex-1"><span className="font-label-md text-label-md text-on-surface truncate">{name}</span><span className="font-label-sm text-label-sm text-on-surface-variant truncate">{role}</span></span>}
        </button>
        {isOpen && <button type="button" onClick={() => go('docs')} className="flex items-center gap-space-sm px-space-md py-space-xs rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors text-left" title="Open documentation">
           <span className="w-5 h-5 flex items-center justify-center rounded-circle border border-outline-variant font-code-sm">?</span>
           <span className="font-label-sm text-label-sm">Help &amp; documentation</span>
        </button>}
      </div>
    </aside>
  );
}


function MobileHeader({ tab, go }: { tab: ActiveTab; go: (t: ActiveTab) => void }) {
  return (
    <header className="lg:hidden shrink-0 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_0_rgba(61,73,77,0.3)] relative z-40">
      <div className="h-14 px-gutter flex items-center justify-between">
        <button type="button" onClick={() => go('landing')} className="flex items-center gap-space-sm text-left min-h-[44px]">
          <BreezyLogo size={34} />
          <span className="flex flex-col"><span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">Breezy</span><span className="font-code-sm text-code-sm text-on-surface-variant leading-none mt-1">{TITLES[tab]}</span></span>
        </button>
        <div className="flex items-center">
          <button aria-label="Search history" type="button" onClick={() => go('history')} className="w-11 h-11 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary transition-colors"><Icon name="search" className="text-2xl" /></button>
        </div>
      </div>
    </header>
  );
}

export function Shell({ tab, go, backendOnline, endpointName, children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  return (
    <div className="h-[100dvh] w-full flex bg-surface text-on-surface overflow-hidden">
      <Sidebar tab={tab} go={go} backendOnline={backendOnline} endpointName={endpointName} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className={`flex-1 min-w-0 flex flex-col transition-[padding-left] duration-300 ease-in-out will-change-[padding-left] ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'}`}>
        <main className="flex-1 min-h-0 overflow-y-auto splatter-soft" id="main">{children}</main>
      </div>
    </div>
  );
}
