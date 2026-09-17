// tests/e2e/autosave-banner.spec.js
// Plan 24-04 / Task 2 — E2E coverage for the first-launch autosave discovery
// banner (D-10/D-11):
//   - Renders only when the File System Access API is supported AND the
//     dismissal flag is not set.
//   - "Dismiss" hides the banner and persists the dismissal across reload
//     (mirrors js/app.js's file:// note dismiss-and-persist precedent).
//   - Never renders in browsers without `window.showDirectoryPicker`
//     (PLAT-04 — unsupported browsers never see the nudge).
//
// Storage isolation per settings-modal.spec.js — localStorage is cleared in
// beforeEach so each spec starts from a clean, never-dismissed state.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('autosave banner (.autosave-banner) is visible on first load when supported (D-10)', async ({ page }) => {
  await expect(page.locator('.autosave-banner')).toBeVisible();
});

test('clicking "Dismiss" hides the banner and it does not reappear after reload (D-11)', async ({ page }) => {
  const banner = page.locator('.autosave-banner');
  await expect(banner).toBeVisible();

  await page.locator('.autosave-banner-dismiss').click();
  await expect(banner).toBeHidden();

  await page.reload();
  await expect(page.locator('.autosave-banner')).toHaveCount(0);
});

test('banner is NOT rendered when File System Access API is unsupported (PLAT-04)', async ({ page }) => {
  await page.addInitScript(() => { delete window.showDirectoryPicker; });
  await page.goto('/');
  await expect(page.locator('.autosave-banner')).toHaveCount(0);
});
