import { beforeEach, describe, expect, it } from 'vitest';
import { DEV_SKIP_SIGNIN, activateDevSkip, clearDevSkip, isDevSkipActive } from '../src/lib/devSkip';

describe('temporary sign-in skip', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('is inactive until the user chooses to skip', () => {
    expect(isDevSkipActive()).toBe(false);
  });

  it('activates only while the feature flag is on, and can be cleared', () => {
    activateDevSkip();
    expect(isDevSkipActive()).toBe(DEV_SKIP_SIGNIN);
    clearDevSkip();
    expect(isDevSkipActive()).toBe(false);
  });
});
