import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    // Only test the active root application. breezy-ui/ is an archived duplicate
    // with stale relative imports and its own obsolete test suite.
    include: ['tests/**/*.test.ts'],
  },
});
