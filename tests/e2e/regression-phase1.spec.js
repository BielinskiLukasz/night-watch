// tests/e2e/regression-phase1.spec.js
// Plan 02-05 / Task 2 — Phase 1 regression guard (Nyquist D8).
//
// Phase 2 makes cutoverHour user-configurable but DEFAULT_SETTINGS.cutoverHour
// stays at 4 — the same value Phase 1 used as a hardcoded BUCKET_CONFIG
// constant. This spec re-runs the Phase 1 happy path on a clean install
// and asserts the user-visible behavior is identical: four quick-log
// buttons each produce a row, reload preserves them, calendar grouping
// is the default mode.
//
// Source: 02-VALIDATION.md §Nyquist Dimension 8 — Phase 1 happy path
// continues to pass with default settings.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Phase 1 regression: four quick-log buttons each add a row, reload persists, calendar mode is default', async ({ page }) => {
  // Calendar grouping is the default — no toggle interaction needed.
  await expect(page.locator('button[data-grouping="calendar"]')).toHaveAttribute('aria-pressed', 'true');

  // Quick-log each of the four event types — single click per button so
  // the 300ms T-05 debounce does not eat any of them.
  await page.getByRole('button', { name: /woke up/i }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /going to sleep/i }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /^nap start$/i }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /^nap end$/i }).click();

  await expect(page.locator('[data-role="events"] li.event')).toHaveCount(4);

  // Reload → all four rows persist (D-04 / D2-04 localStorage round-trip).
  await page.reload();
  await expect(page.locator('[data-role="events"] li.event')).toHaveCount(4);

  // Default cutoverHour=4 produces the same single-day calendar grouping
  // Phase 1's hardcoded 4 produced — all four events on today's date share
  // one day header (assuming wall-clock test run is after 04:00 local; the
  // four quick-log events use clock.now() which is current wall-clock time,
  // so they all land on the same calendar date).
  const dayCount = await page.locator('.day').count();
  expect(dayCount).toBe(1);
});

test('Phase 1 regression: row times render in 24h format by default (CFG-09 default = "24h")', async ({ page }) => {
  // formatTime('YYYY-MM-DDTHH:MM', '24h') produces 'HH:MM' — the same
  // output the old hhmm() helper produced. Phase 1 E2E assertions like
  // toContainText('06:35') keep matching because the default timeFormat
  // is '24h' and renderEventRow defers to formatTime.
  await page.locator('#addEventBtn').click();
  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('6');
  await page.locator('#manualEntry input[name="minute"]').fill('35');
  await page.locator('#manualEntry select[name="type"]').selectOption('wake');
  await page.locator('#manualEntry button[type="submit"]').click();

  // 24h format string — no AM/PM suffix.
  await expect(page.locator('[data-role="events"]')).toContainText('06:35');
  await expect(page.locator('[data-role="events"]')).not.toContainText('AM');
  await expect(page.locator('[data-role="events"]')).not.toContainText('PM');
});
