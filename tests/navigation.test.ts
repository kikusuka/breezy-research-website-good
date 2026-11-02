import { describe, expect, it } from 'vitest';
import { LAB_NAV, MAIN_NAV, PROFILE_NAV, VALID_TABS, parseHash, parseLibraryTab } from '../src/lib/nav';

describe('workspace navigation', () => {
  it('keeps everyday destinations in the main navigation', () => {
    expect(MAIN_NAV.map((item) => item.id)).toEqual(['chat', 'research', 'library', 'models']);
  });

  it('keeps account, settings and help in the profile menu', () => {
    expect(PROFILE_NAV.map((item) => item.id)).toEqual(['profile', 'settings', 'docs']);
  });

  it('keeps Build and Canvas available as laboratory workspaces', () => {
    expect(LAB_NAV.map((item) => item.id)).toEqual(['build', 'canvas']);
  });

  it('uses unique, valid destinations across all navigation menus', () => {
    const ids = [...MAIN_NAV, ...LAB_NAV, ...PROFILE_NAV].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => VALID_TABS.includes(id))).toBe(true);
  });
});


describe('entry route', () => {
  it('opens Chat when no route is selected', () => {
    window.location.hash = '';
    expect(parseHash()).toBe('chat');
  });

  it('redirects the retired landing route to Chat', () => {
    window.location.hash = '#landing';
    expect(parseHash()).toBe('chat');
  });

  it('preserves valid workspace routes', () => {
    window.location.hash = '#research';
    expect(parseHash()).toBe('research');
  });
});

describe('legacy routes', () => {
  it('sends #history and #notes to Library with the right sub-tab', () => {
    window.location.hash = '#history';
    expect(parseHash()).toBe('library');
    expect(parseLibraryTab()).toBe('history');
    window.location.hash = '#notes';
    expect(parseHash()).toBe('library');
    expect(parseLibraryTab()).toBe('notes');
    window.location.hash = '#library/notes';
    expect(parseHash()).toBe('library');
    expect(parseLibraryTab()).toBe('notes');
  });
});
