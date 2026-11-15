import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

/**
 * The end-to-end tests run against the real production build served by
 * `vite preview` — no backend, no dev tooling. Run `npm run build` first.
 * Dates are controlled with Playwright's clock API, which is exactly the
 * device clock the static site relies on.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testIgnore: /production-build|layout/,
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] },
      testIgnore: /production-build|layout/,
    },
    {
      name: 'production-build',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /production-build/,
    },
    {
      name: 'layout',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /layout/,
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
