import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, THEME_KEY, applyTheme, getThemePref, setThemePref } from '../src/lib/theme';

describe('theme preference', () => {
  beforeEach(() => { window.localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });

  it('defaults to Ocean', () => {
    expect(DEFAULT_THEME).toBe('ocean');
    expect(getThemePref()).toBe('ocean');
  });

  it('persists a chosen theme and applies it to the document', () => {
    setThemePref('paper');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('paper');
    expect(document.documentElement.getAttribute('data-theme')).toBe('paper');
  });

  it('falls back to Ocean for an unknown stored value', () => {
    window.localStorage.setItem(THEME_KEY, 'neon');
    expect(getThemePref()).toBe('ocean');
  });

  it('ships four themes, each resolvable', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['ocean', 'slate', 'paper', 'sage']);
    for (const t of THEMES) expect(applyTheme(t.id)).toBe(t.id);
  });
});
