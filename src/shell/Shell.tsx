import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { BreezyLogo } from '../components/BreezyLogo';
import { ActiveTab, LAB_NAV, MAIN_NAV, NavItem, PROFILE_NAV, TITLES } from '../lib/nav';
import { userProfileService, UserProfile } from '../services/userProfileService';
import { FeedbackWidget } from '../components/FeedbackWidget';

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

function Sidebar({ tab, go, isExpanded: expandedPref, previewMode, onToggleExpanded, onNavigate, variant = 'desktop', onClose }: {
  tab: ActiveTab; go: (t: ActiveTab) => void; isExpanded: boolean; previewMode: boolean;
  onToggleExpanded: () => void; onNavigate: () => void; variant?: 'desktop' | 'drawer'; onClose?: () => void;
}) {
  const drawer = variant === 'drawer';
  const isExpanded = drawer || expandedPref; // the drawer always shows labels
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
        className={`breezy-nav-link ${isExpanded ? 'w-full' : 'w-11 justify-center'} ${active ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}>
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
    <aside id={drawer ? 'breezy-drawer' : 'breezy-sidebar'} aria-label={drawer ? 'Navigation menu' : undefined}
      className={drawer
        ? 'fixed inset-y-0 left-0 z-[90] flex w-72 max-w-[85vw] flex-col justify-between border-r border-outline-variant/40 bg-surface pt-safe pb-safe lg:hidden'
        : `fixed inset-y-0 left-0 z-[70] hidden lg:flex flex-col justify-between border-r border-outline-variant/30 bg-surface transition-[width] duration-200 ease-out ${isExpanded ? 'w-64' : 'w-[4.5rem]'}`}>
      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        <div className={isExpanded ? 'flex h-16 shrink-0 items-center gap-space-sm px-space-md' : 'flex shrink-0 flex-col items-center gap-1 pb-2 pt-3'}>
          <button type="button" onClick={() => { go('chat'); onNavigate(); }} aria-label="Go to chat" title="Go to chat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-surface-container-high transition-colors">
            <BreezyLogo size={30} />
          </button>
          {isExpanded && <button type="button" onClick={() => { go('chat'); onNavigate(); }} className="font-headline-sm text-headline-sm tracking-tight text-on-surface">Breezy</button>}
          {drawer ? (
            <button type="button" onClick={onClose} aria-label="Close menu" className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"><Icon name="close" className="text-[20px]" /></button>
          ) : (
            <button type="button" onClick={onToggleExpanded} aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'} title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              className={`flex shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors ${isExpanded ? 'ml-auto h-8 w-8' : 'h-9 w-9'}`}>
              <Icon name={isExpanded ? 'left_panel_close' : 'left_panel_open'} className="text-[18px]" />
            </button>
          )}
        </div>
        <nav className={`py-space-sm flex flex-col gap-space-xs ${isExpanded ? 'px-space-md' : 'items-center px-1'}`} aria-label="Main navigation">
          {MAIN_NAV.map(item)}
        </nav>
        <div className={isExpanded ? 'px-space-md pt-space-md' : 'w-full'}>
          {isExpanded
            ? <div className="px-space-md pb-space-xs font-label-sm text-label-sm uppercase tracking-wider text-outline">Labs</div>
            : <div aria-hidden="true" className="mx-auto my-space-sm h-px w-8 bg-outline-variant/50" />}
          <nav className={`flex flex-col gap-space-xs ${isExpanded ? '' : 'items-center px-1'}`} aria-label="Labs">{LAB_NAV.map(item)}</nav>
        </div>
      </div>
      <div className={`relative flex flex-col ${isExpanded ? 'p-space-md gap-space-sm' : 'items-center pb-space-md gap-space-md'}`}>
        <FeedbackWidget expanded={isExpanded} />
        {profileMenuOpen && <div role="menu" aria-label="Profile menu" className={`absolute z-[90] bottom-full mb-space-sm rounded-2xl border border-outline-variant/60 bg-surface-container-low p-space-xs shadow-2xl ${isExpanded ? 'left-space-md right-space-md' : 'left-full ml-space-sm w-52'}`}>
          {PROFILE_NAV.map(profileItem)}
        </div>}
        <button type="button" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}
          className={`text-left flex items-center transition-colors ${isExpanded ? 'w-full gap-space-md p-space-sm bg-surface-container rounded-2xl hover:bg-surface-container-high' : 'w-11 h-11 justify-center rounded-full border border-outline-variant/50 bg-surface-container-high hover:bg-surface-container-highest'} ${tab === 'profile' ? 'ring-1 ring-primary/40' : ''}`}>
          <Avatar name={name} photo={profile.photoURL} />
          {isExpanded && <span className="flex flex-col min-w-0 flex-1"><span className="font-label-md text-label-md text-on-surface truncate">{name}</span><span className="font-label-sm text-label-sm text-on-surface-variant truncate">{role}</span></span>}
          {isExpanded && <Icon name={profileMenuOpen ? 'keyboard_arrow_down' : 'keyboard_arrow_up'} className="text-[18px] text-on-surface-variant" />}
        </button>
      </div>
    </aside>
  );
}

const PALETTE_ITEMS: NavItem[] = [...MAIN_NAV, ...LAB_NAV, ...PROFILE_NAV];

/** Ctrl/Cmd+K: jump to any destination from the keyboard. */
function CommandPalette({ open, onClose, go, tab }: { open: boolean; onClose: () => void; go: (t: ActiveTab) => void; tab: ActiveTab }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const items = PALETTE_ITEMS.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  useEffect(() => { setIdx(0); }, [q]);
  if (!open) return null;
  const pick = (i: NavItem | undefined) => { if (!i) return; go(i.id); onClose(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((n) => Math.min(n + 1, Math.max(items.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((n) => Math.max(n - 1, 0)); }
    else if (e.key === 'Enter') pick(items[idx]);
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[15vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Go to" className="w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container shadow-2xl" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to…" aria-label="Go to" className="w-full bg-transparent px-4 py-3 text-on-surface placeholder:text-outline outline-none border-b border-outline-variant/40" />
        <ul role="listbox" className="max-h-72 overflow-y-auto p-1">
          {items.map((i, n) => (
            <li key={i.id} role="option" aria-selected={n === idx}>
              <button type="button" onMouseEnter={() => setIdx(n)} onClick={() => pick(i)} className={`flex w-full items-center gap-3 rounded-xl px-3 min-h-11 text-left ${n === idx ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant'}`}>
                <Icon name={i.icon} className="text-[20px]" /><span className="flex-1 font-body-md text-body-md">{i.label}</span>{tab === i.id && <span className="font-code-sm text-code-sm text-primary">current</span>}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-4 font-body-sm text-body-sm text-outline">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}

export function Shell({ tab, go, children, previewMode = false }: ShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-[100dvh] w-full flex flex-col lg:flex-row bg-surface text-on-surface overflow-hidden">
      <Sidebar tab={tab} go={go} isExpanded={sidebarExpanded} previewMode={previewMode} onToggleExpanded={() => setSidebarExpanded((o) => !o)} onNavigate={() => undefined} />

      <header className="lg:hidden flex h-14 shrink-0 items-center gap-2 border-b border-outline-variant/40 bg-surface px-2 pt-safe box-content">
        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen} aria-controls="breezy-drawer" className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors">
          <Icon name="menu" className="text-[24px]" />
        </button>
        <BreezyLogo size={26} />
        <span className="font-headline-sm text-headline-sm truncate">{TITLES[tab]}</span>
        <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Go to…" className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors">
          <Icon name="search" className="text-[22px]" />
        </button>
      </header>

      {drawerOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-[85] bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <Sidebar variant="drawer" tab={tab} go={go} isExpanded previewMode={previewMode} onToggleExpanded={() => undefined} onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} />
        </>
      )}

      <div className={`flex-1 min-h-0 min-w-0 flex flex-col transition-[padding-left] duration-200 ease-out ${sidebarExpanded ? 'lg:pl-64' : 'lg:pl-[4.5rem]'}`}>
        <main className="relative flex-1 min-h-0 overflow-y-auto bg-background" id="main">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} go={go} tab={tab} />
    </div>
  );
}
