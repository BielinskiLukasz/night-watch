// tests/e2e/settings-autosave.spec.js
// Plan 24-03 — E2E coverage for the Settings modal's Backup fieldset
// (PLAT-01, PLAT-04). Two states are exercised in a REAL Chromium instance,
// not with hand-rolled fakes:
//
//   - Unsupported fallback (PLAT-04): window.showDirectoryPicker is deleted
//     before the app loads. #autosaveUnsupportedRow becomes visible and its
//     fallback Export button fires a real download via the SAME shared
//     export handler (historyOnExport) the History screen's Export JSON
//     button already uses (D-03) — proving it is not a second, dead code path.
//
//   - Supported pick-and-save flow (PLAT-01/PLAT-02): window.showDirectoryPicker
//     is mocked to resolve navigator.storage.getDirectory() — the browser's
//     real, dialog-free Origin Private File System root. Per .planning/BACKLOG.md
//     B-051's implementation notes, Playwright's page.on('filechooser') cannot
//     intercept showDirectoryPicker, so OPFS's root handle (which implements the
//     same getFileHandle/createWritable/queryPermission interface as a real
//     user-picked FileSystemDirectoryHandle) stands in with zero permission
//     dialogs required. This exercises the REAL saveToDisk/
//     createIndexedDbHandleStore code paths end-to-end, including a real file
//     write and read-back — complementing Plan 24-01's fake-double unit tests.
//
// Storage isolation per the existing settings-modal.spec.js pattern —
// localStorage is cleared and the page reloaded in each beforeEach so every
// test starts from a clean default-settings state.

import { test, expect } from '@playwright/test';

test.describe('Unsupported fallback (PLAT-04)', () => {
  test.beforeEach(async ({ page }) => {
    // Must run before any app script evaluates isFileSystemAccessSupported()
    // at module load — addInitScript executes ahead of page scripts on every
    // navigation for this page, including the reload below.
    await page.addInitScript(() => {
      delete window.showDirectoryPicker;
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Backup fieldset renders the unsupported row with fallback Export (D-06)', async ({ page }) => {
    await page.locator('button.settingsTrigger').click();

    await expect(page.locator('#autosaveUnsupportedRow')).toBeVisible();
    await expect(page.locator('#autosaveUnsetRow')).toBeHidden();
    await expect(page.locator('#autosaveSetRow')).toBeHidden();
    await expect(page.locator('#autosaveExportBtn')).toBeVisible();
  });

  test('fallback Export button fires the shared export handler (D-03)', async ({ page }) => {
    await page.locator('button.settingsTrigger').click();
    await expect(page.locator('#autosaveExportBtn')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#autosaveExportBtn'),
    ]);

    // Same nightwatch-YYYY-MM-DD.json filename convention as the History
    // screen's Export JSON button (tests/e2e/import-export.spec.js) — proof
    // both buttons drive the identical downloadJSON(storage, clock) call.
    expect(download.suggestedFilename()).toMatch(/^nightwatch-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

test.describe('Supported pick-and-save flow (PLAT-01/PLAT-02)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.showDirectoryPicker = async () => await navigator.storage.getDirectory();
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Choose folder flips the row to set, and a logged event triggers a real OPFS write (PLAT-01/PLAT-02)', async ({ page }) => {
    await page.locator('button.settingsTrigger').click();
    await expect(page.locator('#autosaveUnsetRow')).toBeVisible();
    await expect(page.locator('#autosaveSetRow')).toBeHidden();

    await page.click('#autosavePickBtn');

    // The pick handler re-renders from a fresh getState() with no modal
    // close/reopen — the row flips in place.
    await expect(page.locator('#autosaveSetRow')).toBeVisible();
    await expect(page.locator('#autosaveUnsetRow')).toBeHidden();
    // #autosaveFolderName is attached and rendered via textContent only
    // (T-24-07/D-08). Note: OPFS's synthetic root handle's own .name is the
    // empty string per spec (confirmed empirically against real Chromium),
    // unlike a real user-picked folder — so this asserts render-path
    // correctness (attached, no exception), not a specific non-empty value.
    await expect(page.locator('#autosaveFolderName')).toBeAttached();

    // Close Settings without saving, then log an event on the Today screen
    // to trigger the debounced (500ms) autosave write.
    await page.click('#settingsCancel');
    await page.click('button[data-log="wake"]');
    await page.waitForTimeout(600);

    // Read back the just-written file directly from the real OPFS root —
    // proves the full pick -> debounce -> write chain wrote a real file.
    const written = await page.evaluate(async () => {
      const dir = await navigator.storage.getDirectory();
      const names = [];
      for await (const name of dir.keys()) names.push(name);
      const jsonName = names.find((n) => /^nightwatch-\d{4}-\d{2}-\d{2}\.json$/.test(n));
      if (!jsonName) return null;
      const fileHandle = await dir.getFileHandle(jsonName);
      const file = await fileHandle.getFile();
      return await file.text();
    });

    expect(written).not.toBeNull();
    const parsed = JSON.parse(written);
    expect(Array.isArray(parsed.events)).toBe(true);
    expect(parsed.events.some((e) => e.type === 'wake')).toBe(true);

    // Re-open Settings and confirm the status line reflects the write (D-09).
    await page.locator('button.settingsTrigger').click();
    await expect(page.locator('#autosaveStatus')).toHaveText(/^Last saved: \d{2}:\d{2}$/);
  });

  test('Remove flips the row back to unset without closing or reopening Settings (Gap A regression)', async ({ page }) => {
    await page.locator('button.settingsTrigger').click();
    await page.click('#autosavePickBtn');
    await expect(page.locator('#autosaveSetRow')).toBeVisible();

    await page.click('#autosaveRemoveBtn');

    // No reload, no re-open of Settings, no waitForTimeout — Playwright's
    // default auto-retrying assertions (5s) are the only wait allowed here.
    // Before the Fix 1 await, this times out because the pre-fix handler
    // reads a stale getState() snapshot and the DOM never flips.
    await expect(page.locator('#autosaveUnsetRow')).toBeVisible();
    await expect(page.locator('#autosaveSetRow')).toBeHidden();
  });

  test('picking a folder in Settings suppresses the first-launch banner on next load without ever touching the banner (Gap B regression)', async ({ page }) => {
    await expect(page.locator('.autosave-banner')).toBeVisible();

    await page.locator('button.settingsTrigger').click();
    await page.click('#autosavePickBtn');
    await expect(page.locator('#autosaveSetRow')).toBeVisible();
    await page.click('#settingsCancel');

    await page.reload();

    await expect(page.locator('.autosave-banner')).toHaveCount(0);
  });
});
