// tests/e2e/manual-entry.spec.js
// Plan 01-04 / Task 3 — E2E coverage for the manual-entry modal:
//   - LOG-05: open the modal via '+ Add event', submit a past-day event,
//     verify it appears under the correct date.
//   - LOG-07: silent minute rounding (typed 33 → stored 35).
//   - LOG-05 + Pitfall #6 (T-05): edit an existing event — events.length stays at 1.
//   - LOG-06: native confirm + deleteEvent + reload persists the delete.
//   - Modal cancel + ESC: returnValue !== 'save' must NOT dispatch onSave.
//
// Source: 01-RESEARCH.md §Pattern 6 (native <dialog> ESC behavior),
// §Common Pitfalls #6 (edit-creates-duplicate E2E regression guard),
// §Common Pitfalls #8 (Playwright storage isolation — beforeEach).
//
// Native window.confirm() dispatches are auto-accepted via
// `page.on('dialog', d => d.accept())` (RESEARCH §Code Examples).

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('open modal via + Add event, submit a past-day wake event, verify it appears in the list (LOG-05 back-fill)', async ({ page }) => {
  await page.locator('#addEventBtn').click();

  // Modal is now open — fill the form. Use a past date so the back-fill semantic
  // is exercised (LOG-05). 2026-05-20 is several days before today's date.
  await page.fill('#manualEntry input[name="date"]', '2026-05-20');
  await page.fill('#manualEntry input[name="hour"]', '7');
  await page.fill('#manualEntry input[name="minute"]', '30');
  await page.selectOption('#manualEntry select[name="type"]', 'wake');

  // Click Save (the submit button with value="save" triggers form close with returnValue='save').
  await page.locator('#manualEntry button[type="submit"]').click();

  // The event should appear in the list under its calendar date.
  const list = page.locator('[data-role="events"]');
  await expect(list).toContainText(/Wake/);
  await expect(list).toContainText(/2026-05-20/);

  // Exactly ONE event row should exist (no duplicate).
  const rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(1);
});

test('submit modal with minute=33 — event saved with minute=35 (silent rounding per Open Question #2, LOG-07)', async ({ page }) => {
  await page.locator('#addEventBtn').click();

  await page.fill('#manualEntry input[name="date"]', '2026-05-20');
  await page.fill('#manualEntry input[name="hour"]', '6');
  // Override step="5" by directly setting a non-5 value via fill — manual-entry.js
  // normalizes via Math.round(rawMinute / 5) * 5 so 33 → 35.
  await page.fill('#manualEntry input[name="minute"]', '33');
  await page.selectOption('#manualEntry select[name="type"]', 'wake');

  await page.locator('#manualEntry button[type="submit"]').click();

  // The displayed event time should be 06:35, not 06:33.
  const list = page.locator('[data-role="events"]');
  await expect(list).toContainText('06:35');
  // And it should NOT contain 06:33 anywhere.
  await expect(list).not.toContainText('06:33');
});

test('edit an existing event — events.length stays at 1 after save (Pitfall #6 / T-05 E2E regression guard, includes duplicate-check)', async ({ page }) => {
  // Step 1: log one event via the quick-log button.
  await page.getByRole('button', { name: /woke up/i }).click();

  // One event exists.
  let rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(1);

  // Step 2: click the [edit] button on that row.
  await page.locator('.rowEdit').first().click();

  // Step 3: change the event to a clearly past day+time. The quick-log click
  // above recorded the event at "now" (rounded to 5min); to test edit-in-place
  // without tripping the Plan 01-07 future-date guard, we move the edit target
  // to 2026-05-20 04:40 — far enough in the past to survive any reasonable
  // clock offset between test runs. The point of this spec is the
  // events.length===1 invariant (Pitfall #6 / T-05), not the time value.
  await page.fill('#manualEntry input[name="date"]', '2026-05-20');
  await page.fill('#manualEntry input[name="hour"]', '4');
  await page.fill('#manualEntry input[name="minute"]', '40');

  // Step 4: Save.
  await page.locator('#manualEntry button[type="submit"]').click();

  // Step 5: still exactly ONE event row — no duplicate (events.length stays at 1).
  rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(1);

  // Step 6: reload — Step 7: still exactly ONE event row (D-05 invariant + D-03
  // mutate-in-place verified end-to-end).
  await page.reload();
  rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(1);
  // The edited minute should be present after reload.
  await expect(page.locator('[data-role="events"]')).toContainText(':40');
});

test('click [×] on a row, accept native confirm → row disappears AND reload confirms persistence of the delete (LOG-06)', async ({ page }) => {
  // Auto-accept any native confirm dialog (the delete-confirm prompt).
  page.on('dialog', (d) => d.accept());

  // Pre-condition: log one event.
  await page.getByRole('button', { name: /woke up/i }).click();
  await expect(page.locator('.rowDel')).toHaveCount(1);

  // Click [×] → window.confirm auto-accepts → deleteEvent removes the row.
  await page.locator('.rowDel').first().click();
  await expect(page.locator('.rowDel')).toHaveCount(0);

  // Reload and verify the delete persisted (D-05).
  await page.reload();
  await expect(page.locator('.rowDel')).toHaveCount(0);
});

test('cancel button in modal → no event added (modal cancel path)', async ({ page }) => {
  await page.locator('#addEventBtn').click();
  await page.fill('#manualEntry input[name="date"]', '2026-05-20');
  await page.fill('#manualEntry input[name="hour"]', '7');
  await page.fill('#manualEntry input[name="minute"]', '30');
  await page.selectOption('#manualEntry select[name="type"]', 'wake');

  // Click Cancel instead of Save. returnValue is 'cancel', so onSave must NOT fire.
  await page.locator('#manualCancel').click();

  // No event should have been added.
  const rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(0);
});

test('press ESC in modal → no event added (native <dialog> ESC-to-close + cancel semantic per RESEARCH §Pattern 6)', async ({ page }) => {
  await page.locator('#addEventBtn').click();
  await page.fill('#manualEntry input[name="date"]', '2026-05-20');
  await page.fill('#manualEntry input[name="hour"]', '7');
  await page.fill('#manualEntry input[name="minute"]', '30');
  await page.selectOption('#manualEntry select[name="type"]', 'wake');

  // Press ESC — native <dialog> closes with empty returnValue, which the
  // manual-entry.js close handler treats as "not save".
  await page.keyboard.press('Escape');

  // No event should have been added.
  const rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(0);
});

// -----------------------------------------------------------------------------
// Plan 01-07 — visible-failure regression specs (UAT gaps 2, 3).
// The two specs below encode the user-facing behavior: an invalid Save attempt
// keeps the modal OPEN, surfaces an inline error in the <output> block, and
// adds NO row to the day list. The pure validate() unit-tests in
// tests/integration/manual-entry.test.js pin the function-level contract;
// these specs guard the UI wiring (re-open + render-into-output).
//
// Playwright cannot easily inject a fixed clock into the page's clock adapter
// (validate() is exported but openManualEntry's fallback uses real `now`).
// Using 2099-01-01 for the future-date spec is defensive: guaranteed future
// regardless of when the test runs.
// -----------------------------------------------------------------------------

test('Save with future date keeps modal open, shows future-date error, no row added (01-UAT.md gap 2 regression)', async ({ page }) => {
  await page.locator('#addEventBtn').click();

  // 2099-01-01 is guaranteed to be in the future for any reasonable test run.
  // The HTML5 max=today on the date input is the belt; the JS validate() is
  // the suspenders. We bypass the HTML5 picker constraint by using fill()
  // which sets the value directly — exercises the JS guard.
  await page.locator('#manualEntry input[name="date"]').fill('2099-01-01');
  await page.locator('#manualEntry input[name="hour"]').fill('10');
  await page.locator('#manualEntry input[name="minute"]').fill('00');
  await page.locator('#manualEntry select[name="type"]').selectOption('wake');

  const rowsBefore = await page.locator('[data-role="events"] li.event').count();
  await page.locator('#manualEntry button[type="submit"]').click();

  // Modal stays open; the future-date error is announced in the errors block.
  await expect(page.locator('#manualEntry')).toBeVisible();
  await expect(page.locator('#manualEntryErrors')).toContainText(/future/i);

  // No row added — silent no-op is dead.
  const rowsAfter = await page.locator('[data-role="events"] li.event').count();
  expect(rowsAfter).toBe(rowsBefore);
});

test('within a day, newest event renders at the top (presentation reverse of bucketer chronological order)', async ({ page }) => {
  // Post-smoke fix-up (2026-05-27): the bucketer sorts events within a day
  // chronologically (oldest first) so downstream forecast/predict consumers
  // (Phase 3+) can iterate time-series forward. The renderer reverses that
  // for display so the user reads the most recent log at the top, matching
  // the day-level newest-first sort. Using two distinct-time manual entries
  // (07:30 wake, 15:45 bedtime) keeps the test deterministic regardless of
  // wall-clock — same 5-min bucket would tie and rely on stable-sort
  // behavior; distinct buckets exercise the reverse path unambiguously.
  await page.locator('#addEventBtn').click();
  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('7');
  await page.locator('#manualEntry input[name="minute"]').fill('30');
  await page.locator('#manualEntry select[name="type"]').selectOption('wake');
  await page.locator('#manualEntry button[type="submit"]').click();

  await page.locator('#addEventBtn').click();
  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('15');
  await page.locator('#manualEntry input[name="minute"]').fill('45');
  await page.locator('#manualEntry select[name="type"]').selectOption('bedtime');
  await page.locator('#manualEntry button[type="submit"]').click();

  // Two rows under 2026-05-20. Newest (15:45 bedtime) at top, oldest (07:30 wake) at bottom.
  const rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('15:45');
  await expect(rows.nth(0)).toContainText(/Bedtime/);
  await expect(rows.nth(1)).toContainText('07:30');
  await expect(rows.nth(1)).toContainText(/Wake/);
});

test('Save with date=2026-05-27 23:58 carries to 2026-05-28T00:00 — LOG-07 minute carry post-smoke regression', async ({ page }) => {
  // Post-smoke fix-up to Plan 01-07: the original 0-55 minute guard rejected
  // valid clock minutes 56-59. Manual smoke flagged it; the fix accepts
  // 0-59 and routes through roundTo5 so 23:58 carries to next day 00:00.
  // 2026-05-27 is a past date relative to the test wall clock (today is
  // 2026-05-27 in the project's currentDate but tests can run any time
  // after); using a clearly past date (2026-05-20) keeps the future-date
  // guard out of the picture so the carry is the only thing under test.
  await page.locator('#addEventBtn').click();

  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  await page.locator('#manualEntry input[name="hour"]').fill('23');
  await page.locator('#manualEntry input[name="minute"]').fill('58');
  await page.locator('#manualEntry select[name="type"]').selectOption('bedtime');

  await page.locator('#manualEntry button[type="submit"]').click();

  // Modal closes (no validation error), one row appears under 2026-05-21
  // (next day, carried by roundTo5 + Date arithmetic).
  await expect(page.locator('#manualEntry')).not.toBeVisible();
  const list = page.locator('[data-role="events"]');
  await expect(list).toContainText('2026-05-21');
  await expect(list).toContainText('00:00');
  await expect(list).toContainText(/Bedtime/);
  await expect(page.locator('[data-role="events"] li.event')).toHaveCount(1);
});

test('Save with hour=25 keeps modal open, shows hour-range error, no row added (01-UAT.md gap 3 regression)', async ({ page }) => {
  await page.locator('#addEventBtn').click();

  await page.locator('#manualEntry input[name="date"]').fill('2026-05-20');
  // fill() bypasses HTML5 min/max on the number input — exercises the JS guard.
  await page.locator('#manualEntry input[name="hour"]').fill('25');
  await page.locator('#manualEntry input[name="minute"]').fill('30');
  await page.locator('#manualEntry select[name="type"]').selectOption('wake');

  const rowsBefore = await page.locator('[data-role="events"] li.event').count();
  await page.locator('#manualEntry button[type="submit"]').click();

  // Modal stays open; the hour-range error mentions "0..23".
  await expect(page.locator('#manualEntry')).toBeVisible();
  await expect(page.locator('#manualEntryErrors')).toContainText(/0.+23/);

  // No row added.
  const rowsAfter = await page.locator('[data-role="events"] li.event').count();
  expect(rowsAfter).toBe(rowsBefore);
});
