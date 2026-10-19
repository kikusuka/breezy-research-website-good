export type ActiveTab = 'landing' | 'research' | 'chat' | 'build' | 'canvas' | 'notes' | 'models' | 'history' | 'docs' | 'settings' | 'profile';

export const VALID_TABS: ActiveTab[] = [
  'landing', 'research', 'chat', 'build', 'canvas', 'notes', 'models', 'history', 'docs', 'settings', 'profile',
];

export const parseHash = (): ActiveTab => {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase() as ActiveTab;
  return VALID_TABS.includes(hash) ? hash : 'landing';
};

export type NavItem = { id: ActiveTab; label: string; icon: string };

/** Core destinations shown in the desktop sidebar. Keep these aligned with Stitch. */
export const MAIN_NAV: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: 'chat_bubble' },
  { id: 'research', label: 'Research', icon: 'psychology' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'models', label: 'Models', icon: 'hub' },
  { id: 'docs', label: 'Docs', icon: 'menu_book' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'notes', label: 'Notes', icon: 'sticky_note_2' },
];

export const LAB_NAV: NavItem[] = [
  { id: 'build', label: 'Build', icon: 'terminal' },
  { id: 'canvas', label: 'Canvas', icon: 'draw' },
];

export const TITLES: Record<ActiveTab, string> = {
  landing: 'Home',
  research: 'Research',
  chat: 'Chat',
  build: 'Build',
  canvas: 'Canvas',
  notes: 'Notes',
  models: 'Models',
  history: 'History',
  docs: 'Docs',
  settings: 'Settings',
  profile: 'Profile',
};
