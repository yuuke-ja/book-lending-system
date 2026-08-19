import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const e2ePort = new URL(baseURL).port || '3000';
const e2eDatabaseURL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:book_e2e@127.0.0.1:55433/book_lending_e2e';
const requestedSlowMo = Number(process.env.E2E_SLOW_MO ?? '0');
const slowMo = Number.isFinite(requestedSlowMo) && requestedSlowMo >= 0
  ? requestedSlowMo
  : 0;

process.env.E2E_BASE_URL = baseURL;
process.env.E2E_DATABASE_URL = e2eDatabaseURL;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    launchOptions: { slowMo },

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  webServer: {
    command: 'npm run e2e:server',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      E2E_TEST_MODE: '1',
      DATABASE_URL: e2eDatabaseURL,
      AUTH_SECRET: 'local-e2e-auth-secret-at-least-32-characters',
      AUTH_GOOGLE_ID: 'e2e-google-client-id',
      AUTH_GOOGLE_SECRET: 'e2e-google-client-secret',
      AUTH_URL: baseURL,
      PORT: e2ePort,
      TZ: 'Asia/Tokyo',
    },
  },
});
