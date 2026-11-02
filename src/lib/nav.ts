export type ActiveTab = 'research' | 'chat' | 'build' | 'canvas' | 'library' | 'models' | 'docs' | 'settings' | 'profile';
export type LibraryTab = 'history' | 'notes';

export const VALID_TABS: ActiveTab[] = [
  'research', 'chat', 'build', 'canvas', 'library', 'models', 'docs', 'settings', 'profile',
];

/** Old routes keep working: bookmarks and in-app links to #history / #notes land in Library. */
const ALIASES: Record<string, ActiveTab> = { history: 'library', notes: 'library' };

const rawRoute = (): string[] =>
  window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase().split('/').filter(Boolean);

export const parseHash = (): ActiveTab => {
  const first = rawRoute()[0] ?? '';
  const tab = (ALIASES[first] ?? first) as ActiveTab;
  return VALID_TABS.includes(tab) ? tab : 'chat';
};

/** #library/notes, #notes and #history all resolve to a Library sub-tab. */
export const parseLibraryTab = (): LibraryTab => {
  const [first, second] = rawRoute();
  if (first === 'notes' || second === 'notes') return 'notes';
  return 'history';
};

export type NavItem = { id: ActiveTab; label: string; icon: string };

/** Everyday destinations: always visible, same set in the sidebar and the mobile tab bar. */
export const MAIN_NAV: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: 'chat_bubble_outline' },
  { id: 'research', label: 'Research', icon: 'travel_explore' },
  { id: 'library', label: 'Library', icon: 'collections_bookmark' },
  { id: 'models', label: 'Models', icon: 'hub' },
];

export const LAB_NAV: NavItem[] = [
  { id: 'build', label: 'Build', icon: 'terminal' },
  { id: 'canvas', label: 'Canvas', icon: 'draw' },
];

/** Account and configuration live in the profile menu. */
export const PROFILE_NAV: NavItem[] = [
  { id: 'profile', label: 'Account', icon: 'person_outline' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'docs', label: 'Help', icon: 'menu_book' },
];

export const TITLES: Record<ActiveTab, string> = {
  research: 'Research',
  chat: 'Chat',
  build: 'Build',
  canvas: 'Canvas',
  library: 'Library',
  models: 'Models',
  docs: 'Help',
  settings: 'Settings',
  profile: 'Account',
};
