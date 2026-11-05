/**
 * TEMPORARY, owner-only preview switch.
 *
 * While the UI is being cleaned up, the sign-in page shows a "Skip for now" button that opens the
 * workspace without an account. Nothing is authorized by this: the backend still requires a Firebase
 * token, so research, server history and anything else that calls the API will not work while skipped.
 *
 * BEFORE DEPLOYING: set DEV_SKIP_SIGNIN to false (or delete this file and its three uses in
 * App.tsx and AuthView.tsx). `npm run build` fails on Cloudflare Pages / CI while this is true
 * (see scripts/check-release.mjs).
 */
export const DEV_SKIP_SIGNIN = false;

const KEY = 'breezy.devSkipSignin';

export const isDevSkipActive = (): boolean => {
  if (!DEV_SKIP_SIGNIN) return false;
  try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; }
};

export const activateDevSkip = (): void => {
  if (!DEV_SKIP_SIGNIN) return;
  try { window.sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked: skip lasts until reload */ }
};

export const clearDevSkip = (): void => {
  try { window.sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
};
