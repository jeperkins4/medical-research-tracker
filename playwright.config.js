// @ts-check
import { defineConfig, devices } from '@playwright/test';

const API_PORT  = process.env.TEST_API_PORT  || '3999';
const UI_PORT   = process.env.TEST_UI_PORT   || '5179'; // separate Vite instance for tests (5174 conflicts with OpenFuse)
const API_BASE  = `http://localhost:${API_PORT}`;
const UI_BASE   = `http://localhost:${UI_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: 30000,
  reporter: [['html', { outputFolder: 'tests/playwright-report', open: 'never' }], ['list']],

  globalSetup:    './tests/fixtures/global-setup.js',
  globalTeardown: './tests/fixtures/global-teardown.js',

  use: {
    baseURL: UI_BASE,
    extraHTTPHeaders: { 'x-test-mode': '1' },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'api-tests',
      testMatch: ['**/api.spec.js', '**/fhir.spec.js', '**/fhir-auth-contracts.spec.js', '**/fhir-security.spec.js', '**/fhir-sync-lifecycle.spec.js', '**/fhir-refresh-contracts.spec.js', '**/portal-sync.spec.js', '**/portal-ingestion-contracts.spec.js', '**/genomics.spec.js', '**/api-extended.spec.js', '**/api-crud.spec.js', '**/api-coverage.spec.js', '**/medications-extended.spec.js', '**/organ-health-nutrition.spec.js', '**/api-crud-extended.spec.js', '**/subscriptions.spec.js', '**/core-health-crud.spec.js', '**/analytics.spec.js', '**/nutrition-extended.spec.js', '**/cancer-profiles.spec.js', '**/clinical-data-crud.spec.js', '**/genomics-extended.spec.js', '**/data-quality-contracts.spec.js', '**/auth-contracts.spec.js', '**/fhir-token-lifecycle.spec.js', '**/therapy-suggestions.spec.js', '**/auth-check-contracts.spec.js', '**/fhir-oauth-state.spec.js'],
      use: { baseURL: API_BASE },
    },
    // IPC module smoke tests — no HTTP server or browser needed
    {
      name: 'ipc-modules',
      testMatch: '**/ipc-modules.spec.js',
      use: { baseURL: API_BASE },
    },
    // IPC coverage static analysis — scans JSX for unguarded /api/ calls
    {
      name: 'ipc-coverage',
      testMatch: '**/ipc-coverage.spec.js',
      use: { baseURL: API_BASE },
    },
    {
      name: 'chromium',
      testMatch: '**/ui.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: UI_BASE,
      },
    },
  ],

  webServer: {
    command: `npx vite --port ${UI_PORT} --strictPort`,
    url: UI_BASE,
    reuseExistingServer: !process.env.CI, // reuse dev server locally
    timeout: 60000,
  },
});
