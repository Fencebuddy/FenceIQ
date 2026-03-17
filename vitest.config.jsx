/**
 * Vitest configuration for FenceIQ CI gate
 *
 * • Picks up all *.test.js files under components/testing/
 * • Uses jsdom environment so React imports don't crash
 * • No coverage required by default (use npm run test:coverage to opt-in)
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Match all test files in the components/testing directory
    include: ['components/testing/**/*.test.{js,ts}'],

    // Browser-like environment (needed if any test imports React components)
    environment: 'jsdom',

    // Fail fast on first failure — keeps CI feedback tight
    bail: 0,

    // Verbose output so CI logs are human-readable
    reporter: ['verbose'],

    // Treat any test file parse/import error as a failure
    passWithNoTests: false,

    // Timeout per individual test (ms)
    testTimeout: 10000,
  },
});