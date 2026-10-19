export type ActiveTab = 'landing' | 'research' | 'chat' | 'build' | 'canvas' | 'notes' | 'models' | 'history' | 'docs' | 'settings' | 'profile';

export const VALID_TABS: ActiveTab[] = [
  'landing', 'research', 'chat', 'build', 'canvas', 'notes', 'models', 'history', 'docs', 'settings', 'profile',
];

export const parseHash = (): ActiveTab => {
  const hash = window.location.hash.replace(/^#\\/?/, '').split('?')[0].toLowerCase() as ActiveTab;
  return VALID_TABS.includes(hash) ? hash : 'landing';
};

export type NavItem = { id: ActiveTab; label: string; icon: string };

/** Keep the main navigation focused on everyday work. */
export const MAIN_NAV: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: 'chat_bubble_outline' },
  { id: 'research', label: 'Research', icon: 'travel_explore' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'notes', label: 'Notes', icon: 'sticky_note_2' },
  { id: 'docs', label: 'Docs', icon: 'menu_book' },
];

export const LAB_NAV: NavItem[] = [
  { id: 'build', label: 'Build', icon: 'terminal' },
  { id: 'canvas', label: 'Canvas', icon: 'draw' },
];

/** Less-frequent configuration destinations live in the profile menu. */
export const PROFILE_NAV: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: 'person_outline' },
  { id: 'models', label: 'Models', icon: 'hub' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
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
