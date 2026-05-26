// tests/e2e/quick-log.spec.js
// Plan 01-03 / Task 3 — E2E coverage for the four quick-log buttons + day-grouped
// list + double-click idempotency + LOG-09 extra-nap surfacing.
//
// Source: 01-RESEARCH.md §Code Examples §E2E test example, §Common Pitfalls #5
// (double-click idempotency), §Common Pitfalls #8 (Playwright storage isolation).
//
// `test.beforeEach` clears localStorage AND reloads — Playwright reuses browser
// contexts across tests by default, so without this guard the storage from
// the previous test would leak in and break the assertions (Pitfall #8).

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('click "Going to sleep" records a bedtime event visible in the list (LOG-02)', async ({ page }) => {
  const btn = page.getByRole('button', { name: /going to sleep/i });
  await expect(btn).toBeVisible();
  await btn.click();

  const list = page.locator('[data-role="events"]');
  await expect(list).toContainText(/Bedtime/);
});

test('click "Nap start" records a napStart event visible in the list (LOG-03)', async ({ page }) => {
  const btn = page.getByRole('button', { name: /^nap start$/i });
  await expect(btn).toBeVisible();
  await btn.click();

  const list = page.locator('[data-role="events"]');
  await expect(list).toContainText(/Nap start/);
});

test('click "Nap end" records a napEnd event visible in the list (LOG-04)', async ({ page }) => {
  const btn = page.getByRole('button', { name: /^nap end$/i });
  await expect(btn).toBeVisible();
  await btn.click();

  const list = page.locator('[data-role="events"]');
  await expect(list).toContainText(/Nap end/);
});

test('clicking each of the four buttons sequentially → four events visible', async ({ page }) => {
  // Click each button with enough spacing to bypass the 300ms debounce.
  await page.getByRole('button', { name: /woke up/i }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /going to sleep/i }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /^nap start$/i }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /^nap end$/i }).click();

  // All four event types should be visible in the list.
  const list = page.locator('[data-role="events"]');
  await expect(list).toContainText(/Wake/);
  await expect(list).toContainText(/Bedtime/);
  await expect(list).toContainText(/Nap start/);
  await expect(list).toContainText(/Nap end/);

  // Verify there are exactly 4 event rows (each li.event, NOT counting extraNap).
  const rows = page.locator('[data-role="events"] li.event');
  await expect(rows).toHaveCount(4);
});

test('double-clicking "Woke up" within 300ms produces exactly one event (T-05 / Pitfall #5)', async ({ page }) => {
  const btn = page.getByRole('button', { name: /woke up/i });
  await expect(btn).toBeVisible();

  // Two rapid clicks 50ms apart — well under the 300ms debounce window.
  await btn.click({ clickCount: 2, delay: 50 });

  // Step past the debounce window before asserting (idle).
  await page.waitForTimeout(400);

  // Exactly ONE event row matching Wake should be visible.
  const wakeRows = page.locator('[data-role="events"] li.event', { hasText: /Wake/ });
  await expect(wakeRows).toHaveCount(1);
});

test('a second "Nap start" on the same calendar date renders as an extraNap row (LOG-09 / T-06)', async ({ page }) => {
  const btn = page.getByRole('button', { name: /^nap start$/i });
  await btn.click();
  // Wait past the 300ms debounce so the second click is accepted as a distinct event.
  await page.waitForTimeout(400);
  await btn.click();

  // Plan 02 read-side enforcement puts the second napStart into dayRecord.extraNaps;
  // Plan 03's render maps it to <li class="extraNap">. Expect exactly one such row.
  const extraNapRows = page.locator('.extraNap');
  await expect(extraNapRows).toHaveCount(1);
  await expect(extraNapRows.first()).toContainText(/Extra nap/);
});
