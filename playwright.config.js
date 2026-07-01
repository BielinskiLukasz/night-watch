// playwright.config.js
// Sources:
//   - playwright.dev/docs/test-webserver
//   - playwright.dev/docs/ci-intro
//   - D-21 in .planning/phases/NW-01-log-persist/01-CONTEXT.md
//
// webServer.command uses `node scripts/serve.js` rather than `python -m http.server`
// per RESEARCH §Environment Availability Assumption A2 — the project must run
// without Python on PATH. To swap in Python locally, change the line below to:
//   command: 'python -m http.server 8081'      (Windows)
//   command: 'python3 -m http.server 8081'     (Linux/macOS/CI Ubuntu)

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/serve.js',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
