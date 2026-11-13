import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] }, testIgnore: /screenshots|production/ },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testIgnore: /screenshots|production/ },
    { name: 'production-build', use: { ...devices['Desktop Chrome'] }, testMatch: /production/ },
    { name: 'screenshots', use: { ...devices['Desktop Chrome'] }, testMatch: /screenshots/ },
  ],
  webServer: {
    // Fresh demo database for every run; fictional content only.
    command: `rm -rf .demo-data/e2e && vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { DEMO_DATA_DIR: '.demo-data/e2e', DEMO_INITIAL_TIME: '2026-12-05T08:00:00Z' },
    timeout: 120_000,
  },
});
