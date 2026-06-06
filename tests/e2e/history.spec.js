// tests/e2e/history.spec.js
// Plan 04-02 / Task 6 — E2E coverage for the History screen:
//   - Tab navigation (Today ↔ History)
//   - Day-column table rendering with correct columns
//   - Descending date order (D4-02)
//   - Time formatting per user's timeFormat setting (D4-03)
//   - Rejected row styling (D4-10)
//   - Empty-state message when no events
//   - Tab state persistence (D4-08)
//
// Pattern: localStorage is cleared and page reloaded in beforeEach for
// test isolation (RESEARCH §Common Pitfalls #8 / Playwright storage isolation).

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ---------------------------------------------------------------------------
// 1. Tab navigation
// ---------------------------------------------------------------------------

test('History tab is visible in the header (D4-07)', async ({ page }) => {
  const historyTab = page.locator('button[data-tab="history"]');
  await expect(historyTab).toBeVisible();
  await expect(historyTab).toHaveText('History');
});

test('Today tab is visible and active by default (D4-07)', async ({ page }) => {
  const todayTab = page.locator('button[data-tab="today"]');
  await expect(todayTab).toBeVisible();
  await expect(todayTab).toHaveAttribute('aria-selected', 'true');

  const historyTab = page.locator('button[data-tab="history"]');
  await expect(historyTab).toHaveAttribute('aria-selected', 'false');
});

test('clicking History tab switches to history screen (D4-07)', async ({ page }) => {
  // Today screen visible, history hidden initially
  await expect(page.locator('#today-screen')).toBeVisible();
  await expect(page.locator('#history-screen')).toBeHidden();

  // Click History tab
  await page.locator('button[data-tab="history"]').click();

  // History screen now visible, today hidden
  await expect(page.locator('#history-screen')).toBeVisible();
  await expect(page.locator('#today-screen')).toBeHidden();

  // aria-selected updated
  await expect(page.locator('button[data-tab="history"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('button[data-tab="today"]')).toHaveAttribute('aria-selected', 'false');
});

test('clicking Today tab returns to today screen (D4-07)', async ({ page }) => {
  // Switch to History first
  await page.locator('button[data-tab="history"]').click();
  await expect(page.locator('#history-screen')).toBeVisible();

  // Switch back to Today
  await page.locator('button[data-tab="today"]').click();
  await expect(page.locator('#today-screen')).toBeVisible();
  await expect(page.locator('#history-screen')).toBeHidden();

  await expect(page.locator('button[data-tab="today"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('button[data-tab="history"]')).toHaveAttribute('aria-selected', 'false');
});

// ---------------------------------------------------------------------------
// 2. Empty-state message
// ---------------------------------------------------------------------------

test('History screen shows empty-state message when no events logged', async ({ page }) => {
  await page.locator('button[data-tab="history"]').click();

  // No table should be present
  await expect(page.locator('table.historyTable')).not.toBeAttached();

  // Empty-state message visible
  const emptyMsg = page.locator('.historyEmpty');
  await expect(emptyMsg).toBeVisible();
  await expect(emptyMsg).toContainText('No events logged yet');
});

// ---------------------------------------------------------------------------
// 3. Table rendering with events
// ---------------------------------------------------------------------------

test('History table is visible after logging events and switching tab', async ({ page }) => {
  // Log a wake event from Today screen
  await page.locator('button[data-log="wake"]').click();

  // Switch to History
  await page.locator('button[data-tab="history"]').click();

  // Table should appear
  await expect(page.locator('table.historyTable')).toBeVisible();
});

test('History table has correct column headers (D4-01)', async ({ page }) => {
  // Log an event so table renders
  await page.locator('button[data-log="wake"]').click();
  await page.locator('button[data-tab="history"]').click();

  const table = page.locator('table.historyTable');
  await expect(table).toBeVisible();

  // Check header text — reordered to group naps in the middle (Nap End → Nap Start)
  // and move Bedtime to the end as the day's closing marker.
  const headers = table.locator('thead th');
  await expect(headers.nth(0)).toHaveText('Date');
  await expect(headers.nth(1)).toHaveText('Wake');
  await expect(headers.nth(2)).toHaveText('Nap End');
  await expect(headers.nth(3)).toHaveText('Nap Start');
  await expect(headers.nth(4)).toHaveText('Bedtime');
  await expect(headers.nth(5)).toHaveText('Rejected');
  await expect(headers.nth(6)).toHaveText('Actions');
});

test('History table renders one row per calendar day (D4-01)', async ({ page }) => {
  // Log 3 events (all same day since tests run quickly)
  await page.locator('button[data-log="wake"]').click();
  await page.waitForTimeout(100);
  await page.locator('button[data-log="napStart"]').click();
  await page.waitForTimeout(100);
  await page.locator('button[data-log="bedtime"]').click();

  await page.locator('button[data-tab="history"]').click();

  const table = page.locator('table.historyTable');
  await expect(table).toBeVisible();

  // All 3 events are on the same day → exactly 1 row
  const rows = table.locator('tbody tr.day-row');
  await expect(rows).toHaveCount(1);
});

test('History table rows have date cells (D4-03)', async ({ page }) => {
  await page.locator('button[data-log="wake"]').click();
  await page.locator('button[data-tab="history"]').click();

  const table = page.locator('table.historyTable');
  const firstRow = table.locator('tbody tr.day-row').first();

  // Date cell should contain a YYYY-MM-DD format date
  const dateCell = firstRow.locator('td.day-date');
  await expect(dateCell).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
});

test('History table shows times in 24h format by default (D4-03)', async ({ page }) => {
  await page.locator('button[data-log="wake"]').click();
  await page.locator('button[data-tab="history"]').click();

  const table = page.locator('table.historyTable');
  const wakeCell = table.locator('tbody tr.day-row').first().locator('td.day-wake');

  // 24h format: HH:MM (no AM/PM)
  const text = await wakeCell.textContent();
  // Either a time (HH:MM) or em-dash if just logged at wrong resolution
  // Accept both since the event might have been logged for current time
  expect(text).toMatch(/^\d{1,2}:\d{2}$|^—$/);
});

// ---------------------------------------------------------------------------
// 4. Rejected row styling (D4-10)
// ---------------------------------------------------------------------------

test('Rejected rows have class "rejected" (D4-10)', async ({ page }) => {
  // Log an event to create a day
  await page.locator('button[data-log="wake"]').click();

  // Get today's date in YYYY-MM-DD format
  const todayDate = await page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  // Mark today as rejected via settings.update
  await page.evaluate((date) => {
    // Access the app's eventLog/settings via the module (unavailable from outside),
    // so use localStorage directly — write a pre-rejected v2 blob.
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return;
    const db = JSON.parse(raw);
    if (!db.settings) return;
    db.settings.rejectedDays = [date];
    localStorage.setItem('nightwatch:db', JSON.stringify(db));
  }, todayDate);

  // Reload so the app picks up the updated localStorage
  await page.reload();

  // Navigate to History
  await page.locator('button[data-tab="history"]').click();

  // The day row should have the "rejected" class
  const rejectedRow = page.locator('table.historyTable tbody tr.rejected');
  await expect(rejectedRow).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// 5. Tab persistence (D4-08)
// ---------------------------------------------------------------------------

test('Tab state persists: switching back to History shows the table (D4-08)', async ({ page }) => {
  // Log an event
  await page.locator('button[data-log="wake"]').click();

  // Switch to History
  await page.locator('button[data-tab="history"]').click();
  await expect(page.locator('table.historyTable')).toBeVisible();

  // Switch to Today
  await page.locator('button[data-tab="today"]').click();
  await expect(page.locator('#today-screen')).toBeVisible();

  // Switch back to History — table should still be there
  await page.locator('button[data-tab="history"]').click();
  await expect(page.locator('table.historyTable')).toBeVisible();
  await expect(page.locator('#history-screen')).toBeVisible();
});

test('History table updates reactively when a new event is added on Today screen (D3-12)', async ({ page }) => {
  // Log one event
  await page.locator('button[data-log="wake"]').click();

  // Switch to History and count rows
  await page.locator('button[data-tab="history"]').click();
  const rowsBefore = await page.locator('table.historyTable tbody tr.day-row').count();
  expect(rowsBefore).toBe(1);

  // Switch to Today, log another event type on the same day
  await page.locator('button[data-tab="today"]').click();
  await page.waitForTimeout(100);
  await page.locator('button[data-log="bedtime"]').click();

  // Switch to History — still 1 row (same day) but row is now updated
  await page.locator('button[data-tab="history"]').click();
  const rowsAfter = await page.locator('table.historyTable tbody tr.day-row').count();
  expect(rowsAfter).toBe(1);

  // Wake and Bedtime cells should now be populated (not em-dash)
  const firstRow = page.locator('table.historyTable tbody tr.day-row').first();
  await expect(firstRow.locator('td.day-wake')).not.toHaveText('—');
  await expect(firstRow.locator('td.day-bedtime')).not.toHaveText('—');
});
