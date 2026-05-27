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

test('a 3-nap day renders 3 actionable rows; the 3rd is faint (LOG-09) — 01-UAT.md gap 4 regression', async ({ page }) => {
  // Plan 01-06 / UAT gap 4 contract: a day with 3 napStart events renders
  // EXACTLY 3 <li> rows (not 4 -- no dead summary row). The 1st and 2nd
  // are normal; the 3rd is faint via the .extraNap class (LOG-09 surfacing
  // preserved). Every row -- including the faint 3rd -- carries [edit]/[x]
  // affordances so the user can act on any nap they see.
  const napStart = page.getByRole('button', { name: /^nap start$/i });

  await napStart.click();
  // Wait past the 300ms debounce so each click is accepted as a distinct event.
  await page.waitForTimeout(350);
  await napStart.click();
  await page.waitForTimeout(350);
  await napStart.click();

  // Exactly 3 nap-start rows -- not 4 (no dead summary row).
  const napRows = page
    .locator('[data-role="events"] li.event')
    .filter({ hasText: /Nap start/ });
  await expect(napRows).toHaveCount(3);

  // 1st and 2nd are normal; 3rd carries .extraNap (LOG-09 surfacing preserved).
  await expect(napRows.nth(0)).not.toHaveClass(/extraNap/);
  await expect(napRows.nth(1)).not.toHaveClass(/extraNap/);
  await expect(napRows.nth(2)).toHaveClass(/extraNap/);

  // Every row -- including the faint 3rd -- has both [edit] and [x] (the
  // 01-UAT.md gap 4 user-acceptance criterion: user can act on every nap
  // they see).
  for (let i = 0; i < 3; i++) {
    await expect(napRows.nth(i).locator('button.rowEdit')).toHaveCount(1);
    await expect(napRows.nth(i).locator('button.rowDel')).toHaveCount(1);
  }
});
