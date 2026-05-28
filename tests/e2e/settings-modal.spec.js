// tests/e2e/settings-modal.spec.js
// Plan 02-04 / Task 2 — E2E coverage for the Settings modal:
//   - CFG-01: subject name flows from form → settings.update → h1.subjectName
//     + document.title (D2-11); persists across reload; XSS-safe under
//     HTML-entity input (Pitfall #5 / T-2-13).
//   - CFG-02..04, CFG-06..07: stored-but-inert fields round-trip Save→reload.
//   - D2-14: Cancel + ESC fire dlg.close with non-'save' returnValue and
//     must NOT call settings.update; Save with invalid cutoverHour shows
//     inline error in <output id="settingsErrors"> and keeps the modal open.
//   - Modal a11y: aria-labelledby='settingsTitle' on dialog#settings.
//
// Source: 02-CONTEXT.md D2-12/D2-13/D2-14/D2-27, 02-VALIDATION.md
// §Phase Requirements → Test Map (settings-modal.spec.js covers CFG-01,
// CFG-02..04, 06..07 persistence), 02-RESEARCH.md §Pitfall #5 (XSS guard).
//
// Storage isolation per Phase 1's RESEARCH §Pitfall #8 — localStorage is
// cleared in beforeEach so each spec starts from a clean default-settings state.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('gear icon opens the Settings modal (D2-12)', async ({ page }) => {
  await expect(page.locator('dialog#settings')).toBeHidden();
  await page.locator('button.settingsTrigger').click();
  await expect(page.locator('dialog#settings')).toBeVisible();
});

test('CFG-01: subject name appears in h1.subjectName and document.title after Save (D2-11)', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('Alice');
  await page.locator('#settings button[type="submit"]').click();

  await expect(page.locator('header.appHeader h1.subjectName')).toHaveText('Alice');
  await expect(page).toHaveTitle('Nightwatch — Alice');
});

test('CFG-01: empty subjectName → h1 + document.title both read "Nightwatch" via fallback (D2-11)', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('');
  await page.locator('#settings button[type="submit"]').click();

  await expect(page.locator('header.appHeader h1.subjectName')).toHaveText('Nightwatch');
  await expect(page).toHaveTitle('Nightwatch');
});

test('CFG-01: XSS-safe — HTML entities in subjectName render as literal text (Pitfall #5 / T-2-13)', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('<b>test</b>');
  await page.locator('#settings button[type="submit"]').click();

  // textContent assignment leaves the angle brackets literal; if anyone
  // ever swaps to innerHTML the assertion below will flip to '0' bold elements.
  const h1 = page.locator('header.appHeader h1.subjectName');
  await expect(h1).toHaveText('<b>test</b>');
  await expect(h1.locator('b')).toHaveCount(0);
});

test('CFG-01: subject name persists across reload (D2-04 + D2-09)', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('Alice');
  await page.locator('#settings button[type="submit"]').click();

  await page.reload();

  await expect(page.locator('header.appHeader h1.subjectName')).toHaveText('Alice');
  await expect(page).toHaveTitle('Nightwatch — Alice');
});

test('D2-14: Save with invalid cutoverHour shows inline error and keeps modal open', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  // fill() bypasses HTML5 min/max — exercises the JS validateSettings guard.
  await page.locator('#settings input[name="cutoverHour"]').fill('99');
  await page.locator('#settings button[type="submit"]').click();

  await expect(page.locator('dialog#settings')).toBeVisible();
  await expect(page.locator('#settingsErrors')).toContainText(/cutoverHour/);
  await expect(page.locator('#settingsErrors p[data-field="cutoverHour"]')).toHaveCount(1);
});

test('D2-14: Cancel button discards pending edits (no settings.update)', async ({ page }) => {
  // Establish a baseline name via a real save first.
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('Alice');
  await page.locator('#settings button[type="submit"]').click();
  await expect(page.locator('header.appHeader h1.subjectName')).toHaveText('Alice');

  // Open again, type 'Bob', press Cancel — header must stay 'Alice'.
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('Bob');
  await page.locator('#settingsCancel').click();

  await expect(page.locator('header.appHeader h1.subjectName')).toHaveText('Alice');
});

test('D2-14: ESC discards pending edits (native <dialog> empty returnValue)', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('Alice');
  await page.locator('#settings button[type="submit"]').click();
  await expect(page.locator('header.appHeader h1.subjectName')).toHaveText('Alice');

  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings input[name="subjectName"]').fill('Bob');
  await page.keyboard.press('Escape');

  await expect(page.locator('header.appHeader h1.subjectName')).toHaveText('Alice');
});

test('CFG-02..04, CFG-06..07: forecast-tuning + time/day fields round-trip Save → reload', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();

  // Pick values distinct from defaults so reload-equality is meaningful.
  await page.locator('#settings input[name="cutoverHour"]').fill('5');
  await page.locator('#settings select[name="groupingMode"]').selectOption('sleepCycle');
  await page.locator('#settings select[name="timeFormat"]').selectOption('12h');
  await page.locator('#settings input[name="maxDelta"]').fill('45');
  await page.locator('#settings input[name="minDays"]').fill('14');
  await page.locator('#settings input[name="windowDays"]').fill('21');
  await page.locator('#settings select[name="statBlend"]').selectOption('mean');
  await page.locator('#settings input[name="autoOutlier"]').check();

  await page.locator('#settings button[type="submit"]').click();
  await page.reload();
  await page.locator('button.settingsTrigger').click();

  await expect(page.locator('#settings input[name="cutoverHour"]')).toHaveValue('5');
  await expect(page.locator('#settings select[name="groupingMode"]')).toHaveValue('sleepCycle');
  await expect(page.locator('#settings select[name="timeFormat"]')).toHaveValue('12h');
  await expect(page.locator('#settings input[name="maxDelta"]')).toHaveValue('45');
  await expect(page.locator('#settings input[name="minDays"]')).toHaveValue('14');
  await expect(page.locator('#settings input[name="windowDays"]')).toHaveValue('21');
  await expect(page.locator('#settings select[name="statBlend"]')).toHaveValue('mean');
  await expect(page.locator('#settings input[name="autoOutlier"]')).toBeChecked();
});

test('a11y: dialog#settings has aria-labelledby="settingsTitle" (D2-13)', async ({ page }) => {
  await expect(page.locator('dialog#settings')).toHaveAttribute('aria-labelledby', 'settingsTitle');
  await expect(page.locator('#settingsTitle')).toHaveText('Settings');
});

// -----------------------------------------------------------------------------
// Plan 02-06 / CFG-09: 12h time-format propagation into the manual-entry modal.
// The Settings modal already exposes the 24h/12h select (Plan 02-04); these
// specs verify that the choice changes the manual-entry picker shape and the
// Today list display format (D2-19 / D2-20).
// -----------------------------------------------------------------------------

test('CFG-09: switching to 12h — manual-entry HH input becomes 1-12 range with AM/PM select', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings select[name="timeFormat"]').selectOption('12h');
  await page.locator('#settings button[type="submit"]').click();

  await page.locator('#addEventBtn').click();
  await expect(page.locator('#manualEntry input[name="hour"]')).toHaveAttribute('min', '1');
  await expect(page.locator('#manualEntry input[name="hour"]')).toHaveAttribute('max', '12');
  await expect(page.locator('#manualEntry select[name="ampm"]')).toBeVisible();
  // Both options present in the static order applyTimeFormat wrote them.
  await expect(page.locator('#manualEntry select[name="ampm"] option')).toHaveCount(2);
});

test('CFG-09: switching back to 24h — AM/PM select disappears, HH input restores 0-23', async ({ page }) => {
  // Establish 12h first
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings select[name="timeFormat"]').selectOption('12h');
  await page.locator('#settings button[type="submit"]').click();

  // Confirm the 12h shape arrived
  await page.locator('#addEventBtn').click();
  await expect(page.locator('#manualEntry select[name="ampm"]')).toBeVisible();
  await page.locator('#manualCancel').click();

  // Toggle to 24h
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings select[name="timeFormat"]').selectOption('24h');
  await page.locator('#settings button[type="submit"]').click();

  await page.locator('#addEventBtn').click();
  await expect(page.locator('#manualEntry input[name="hour"]')).toHaveAttribute('min', '0');
  await expect(page.locator('#manualEntry input[name="hour"]')).toHaveAttribute('max', '23');
  await expect(page.locator('#manualEntry select[name="ampm"]')).toHaveCount(0);
});

test('CFG-09: time format persists across reload — 12h picker reappears on a fresh load', async ({ page }) => {
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings select[name="timeFormat"]').selectOption('12h');
  await page.locator('#settings button[type="submit"]').click();

  await page.reload();

  await page.locator('#addEventBtn').click();
  await expect(page.locator('#manualEntry input[name="hour"]')).toHaveAttribute('min', '1');
  await expect(page.locator('#manualEntry input[name="hour"]')).toHaveAttribute('max', '12');
  await expect(page.locator('#manualEntry select[name="ampm"]')).toBeVisible();
});

test('CFG-09: 12h mode — event row time renders as H:MM AM/PM in the Today list', async ({ page }) => {
  // Switch to 12h
  await page.locator('button.settingsTrigger').click();
  await page.locator('#settings select[name="timeFormat"]').selectOption('12h');
  await page.locator('#settings button[type="submit"]').click();

  // Log a past-day event at 14:30 (PM) — fill via the 12h picker shape.
  // 14 → 2 PM in 12h. The internal storage stays 24h regardless (D2-20).
  await page.locator('#addEventBtn').click();
  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('2');
  await page.locator('#manualEntry select[name="ampm"]').selectOption('PM');
  await page.locator('#manualEntry input[name="minute"]').fill('30');
  await page.locator('#manualEntry select[name="type"]').selectOption('wake');
  await page.locator('#manualEntry button[type="submit"]').click();

  // formatTime('YYYY-MM-DDT14:30', '12h') → '2:30 PM'
  await expect(page.locator('[data-role="events"]')).toContainText(/2:30\s+PM/);
  // The literal 24h string '14:30' MUST NOT appear in 12h mode.
  await expect(page.locator('[data-role="events"]')).not.toContainText('14:30');
});

test('CFG-09: 24h mode (default) — event row time renders as HH:MM with no AM/PM', async ({ page }) => {
  // Default is 24h after localStorage.clear() in beforeEach.
  await page.locator('#addEventBtn').click();
  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('14');
  await page.locator('#manualEntry input[name="minute"]').fill('30');
  await page.locator('#manualEntry select[name="type"]').selectOption('wake');
  await page.locator('#manualEntry button[type="submit"]').click();

  await expect(page.locator('[data-role="events"]')).toContainText('14:30');
  await expect(page.locator('[data-role="events"]')).not.toContainText(/AM|PM/);
});
