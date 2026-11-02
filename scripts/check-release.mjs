// Fails a production build if the temporary sign-in skip is still enabled.
// Runs automatically before `npm run build`; only enforced on hosted builds (Cloudflare Pages, CI) or when BREEZY_RELEASE=1.
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/devSkip.ts', import.meta.url), 'utf8');
const enabled = /export const DEV_SKIP_SIGNIN\s*=\s*true\b/.test(source);
const hosted = Boolean(process.env.CF_PAGES || process.env.CI || process.env.BREEZY_RELEASE);

if (enabled && hosted) {
  console.error('\nRelease check failed: DEV_SKIP_SIGNIN is still true in src/lib/devSkip.ts.');
  console.error('Set it to false (or remove the skip feature) before deploying.\n');
  process.exit(1);
}
if (enabled) console.warn('Note: DEV_SKIP_SIGNIN is on (local/preview build). Turn it off before deploying.');
