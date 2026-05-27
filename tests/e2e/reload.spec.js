// tests/e2e/reload.spec.js
// Source: RESEARCH §Code Examples §E2E test example + 01-PLAN.md §Task 2 <behavior>
//
// LOG-01 + DATA-04 walking-skeleton proof: click "Woke up", event appears,
// reload, event still visible. Phase 1's only E2E spec.
//
// `test.beforeEach` clears localStorage to keep specs deterministic
// (Pitfall #8 — Playwright reuses browser contexts by default).

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('click "Woke up", event appears, reload, event still visible', async ({ page }) => {
  const wakeButton = page.getByRole('button', { name: /woke up/i });
  await expect(wakeButton).toBeVisible();
  await wakeButton.click();

  // The event row should appear after the click. Row label is 'Woke up'
  // (matches button label; 01-UAT.md gap 1 closure -- not 'Wake').
  const eventsList = page.locator('[data-role="events"]');
  await expect(eventsList).toContainText(/Woke up/i);

  // Reload — the event must survive (DATA-04, D-05)
  await page.reload();
  await expect(eventsList).toContainText(/Woke up/i);
});
