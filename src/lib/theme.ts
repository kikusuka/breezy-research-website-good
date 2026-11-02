/**
 * Theme handling. Device-level preference (not per account), stored in localStorage.
 * index.html applies the saved theme before first paint to avoid a flash.
 */
export type ThemeId = 'ocean' | 'slate' | 'paper' | 'sage';
export type ThemePref = ThemeId | 'system';

export const DEFAULT_THEME: ThemeId = 'ocean';
export const THEME_KEY = 'breezy.theme';

export interface ThemeInfo { id: ThemeId; label: string; note: string; mode: 'dark' | 'light'; bg: string; surface: string; accent: string; text: string; }

export const THEMES: ThemeInfo[] = [
  { id: 'ocean', label: 'Ocean', note: 'Default. Deep blue with a cyan accent.', mode: 'dark', bg: '#0c1728', surface: '#19334b', accent: '#4cd6fb', text: '#e6edf8' },
  { id: 'slate', label: 'Slate Ink', note: 'Neutral dark. The logo is the only colour.', mode: 'dark', bg: '#111319', surface: '#1b1f29', accent: '#4cd6fb', text: '#e6e9f0' },
  { id: 'paper', label: 'Paper', note: 'Light and warm. Easiest for long reading.', mode: 'light', bg: '#f6f5f1', surface: '#ffffff', accent: '#0b7a94', text: '#1b1f24' },
  { id: 'sage', label: 'Sage', note: 'Dark green-grey with a mint accent.', mode: 'dark', bg: '#0f1512', surface: '#1a2520', accent: '#6fd3a0', text: '#e5eee9' },
];

const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function getThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === 'system' || isThemeId(v) ? v : DEFAULT_THEME;
  } catch { return DEFAULT_THEME; }
}

/** "Match system" maps dark → Ocean and light → Paper. */
export function resolveTheme(pref: ThemePref): ThemeId {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'paper' : DEFAULT_THEME;
}

export function applyTheme(pref: ThemePref): ThemeId {
  const id = resolveTheme(pref);
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
  root.classList.toggle('dark', THEMES.find((t) => t.id === id)?.mode === 'dark');
  const bg = THEMES.find((t) => t.id === id)?.bg;
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  return id;
}

export function setThemePref(pref: ThemePref): void {
  try { window.localStorage.setItem(THEME_KEY, pref); } catch { /* storage blocked: theme still applies for this session */ }
  applyTheme(pref);
}

/** Call once at startup. Keeps "Match system" live while the page is open. */
export function initTheme(): void {
  applyTheme(getThemePref());
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (getThemePref() === 'system') applyTheme('system');
  });
}
