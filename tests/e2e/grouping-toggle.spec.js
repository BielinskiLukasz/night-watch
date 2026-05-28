// tests/e2e/grouping-toggle.spec.js
// Plan 02-05 / Task 2 — CFG-08 user-story E2E gate.
//
// The MVP-critical deliverable: a Calendar | Sleep cycle toggle on the
// Today screen, commit-on-click (D2-16), persisting across reload, and
// re-bucketing the day list using the user's settings.cutoverHour
// (D2-15, D2-17 — not a hardcoded 4).
//
// Covers:
//   - Default aria-pressed state matches DEFAULT_SETTINGS.groupingMode='calendar' (D2-03)
//   - Toggle commit-on-click (D2-16) — clicking 'Sleep cycle' flips aria-pressed without a Save step
//   - Persistence across reload — settings store survives via localStorage round-trip
//   - The Settings modal select reflects the same value (single source of truth)
//   - CFG-08 cutover-straddling regrouping: with cutoverHour=4, a 03:50
//     event vs an 05:00 event on the same wall-clock date land under the
//     same day header in calendar mode but different day headers in
//     sleepCycle mode (the 03:50 event belongs to the previous subjective
//     night since 03:50 < 04:00 cutover).
//
// Source: 02-CONTEXT.md D2-15/D2-16/D2-17/D2-27; 02-VALIDATION.md
// §Phase Requirements → Test Map CFG-08; 02-RESEARCH.md §Pattern G.
//
// Storage isolation per Phase 1 §Pitfall #8 — localStorage cleared in
// beforeEach so each spec starts from a clean default-settings state.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('default aria-pressed mirrors DEFAULT_SETTINGS.groupingMode = "calendar" (D2-03)', async ({ page }) => {
  await expect(page.locator('button[data-grouping="calendar"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button[data-grouping="sleepCycle"]')).toHaveAttribute('aria-pressed', 'false');
});

test('clicking Sleep cycle commits-on-click (D2-16): no Save step, aria-pressed flips immediately', async ({ page }) => {
  await page.locator('button[data-grouping="sleepCycle"]').click();

  await expect(page.locator('button[data-grouping="sleepCycle"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button[data-grouping="calendar"]')).toHaveAttribute('aria-pressed', 'false');
});

test('grouping mode persists across reload (settings → localStorage round-trip)', async ({ page }) => {
  await page.locator('button[data-grouping="sleepCycle"]').click();
  await page.reload();

  await expect(page.locator('button[data-grouping="sleepCycle"]')).toHaveAttribute('aria-pressed', 'true');
});

test('grouping mode is also reflected in the Settings modal select (single source of truth)', async ({ page }) => {
  await page.locator('button[data-grouping="sleepCycle"]').click();

  await page.locator('button.settingsTrigger').click();
  await expect(page.locator('#settings select[name="groupingMode"]')).toHaveValue('sleepCycle');
});

test('CFG-08: cutoverHour=4 — events at 03:50 and 05:00 same wall-clock day split into different subjective nights', async ({ page }) => {
  // Phase 1 manual-entry takes 24h hour input. We use 2026-05-20 (well in
  // the past) so the Plan 01-07 future-date guard does not interfere; both
  // events are unambiguously past relative to any reasonable test wall clock.
  //
  // cutoverHour stays at the default 4 — no Settings change needed.
  // 03:50 < 04:00 so it belongs to the night ENDING on 2026-05-20 (its
  // subjective-night key is 2026-05-19). 05:00 >= 04:00 so it belongs to
  // the night STARTING on 2026-05-20 (key 2026-05-20).

  // Log the 03:50 event.
  await page.locator('#addEventBtn').click();
  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('3');
  await page.locator('#manualEntry input[name="minute"]').fill('50');
  await page.locator('#manualEntry select[name="type"]').selectOption('wake');
  await page.locator('#manualEntry button[type="submit"]').click();

  // Log the 05:00 event.
  await page.locator('#addEventBtn').click();
  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('5');
  await page.locator('#manualEntry input[name="minute"]').fill('0');
  await page.locator('#manualEntry select[name="type"]').selectOption('bedtime');
  await page.locator('#manualEntry button[type="submit"]').click();

  // Calendar mode (default): both events share the same day header '2026-05-20'.
  const calendarDayHeaders = await page.locator('.day .dayHeader').allTextContents();
  expect(calendarDayHeaders).toContain('2026-05-20');
  // Both rows under the single 2026-05-20 article.
  await expect(page.locator('.day:has(.dayHeader:text("2026-05-20")) li.event')).toHaveCount(2);

  // Toggle to Sleep cycle — subscriber re-renders the day list.
  await page.locator('button[data-grouping="sleepCycle"]').click();

  // Sleep-cycle mode: 03:50 lands in night 2026-05-19, 05:00 lands in night 2026-05-20.
  const sleepCycleDayHeaders = await page.locator('.day .dayHeader').allTextContents();
  expect(sleepCycleDayHeaders).toContain('2026-05-19');
  expect(sleepCycleDayHeaders).toContain('2026-05-20');
  // Each of the two days now holds exactly one of the two events.
  await expect(page.locator('.day:has(.dayHeader:text("2026-05-19")) li.event')).toHaveCount(1);
  await expect(page.locator('.day:has(.dayHeader:text("2026-05-20")) li.event')).toHaveCount(1);
});
