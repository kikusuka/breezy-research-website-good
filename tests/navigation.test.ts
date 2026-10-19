import { describe, expect, it } from 'vitest';
import { LAB_NAV, MAIN_NAV, VALID_TABS } from '../src/lib/nav';

describe('workspace navigation', () => {
  it('keeps the primary destinations reachable from the shared sidebar', () => {
    const ids = MAIN_NAV.map((item) => item.id);
    expect(ids).toContain('chat');
    expect(ids).toContain('research');
    expect(ids).toContain('history');
    expect(ids).toContain('models');
    expect(ids).toContain('docs');
    expect(ids).toContain('settings');
  });

  it('keeps Build and Canvas available as laboratory workspaces', () => {
    expect(LAB_NAV.map((item) => item.id)).toEqual(['build', 'canvas']);
  });

  it('uses unique, valid destinations across the shared navigation', () => {
    const ids = [...MAIN_NAV, ...LAB_NAV].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => VALID_TABS.includes(id))).toBe(true);
  });
});
