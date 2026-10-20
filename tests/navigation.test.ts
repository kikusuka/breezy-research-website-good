import { describe, expect, it } from 'vitest';
import { LAB_NAV, MAIN_NAV, PROFILE_NAV, VALID_TABS, parseHash } from '../src/lib/nav';

describe('workspace navigation', () => {
  it('keeps everyday destinations in the main sidebar', () => {
    const ids = MAIN_NAV.map((item) => item.id);
    expect(ids).toContain('chat');
    expect(ids).toContain('research');
    expect(ids).toContain('history');
    expect(ids).toContain('notes');
    expect(ids).not.toContain('models');
    expect(ids).not.toContain('settings');
    expect(ids).not.toContain('docs');
  });

  it('keeps profile and configuration destinations in the profile menu', () => {
    expect(PROFILE_NAV.map((item) => item.id)).toEqual(['profile', 'models', 'settings', 'docs']);
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
