// @ts-check
import { defineConfig, devices } from '@playwright/test';

const API_PORT  = process.env.TEST_API_PORT  || '3999';
const UI_PORT   = process.env.TEST_UI_PORT   || '5174'; // separate Vite instance for tests
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
      testMatch: '**/api.spec.js',
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
