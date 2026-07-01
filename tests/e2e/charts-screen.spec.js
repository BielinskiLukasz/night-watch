// tests/e2e/charts-screen.spec.js
// Phase 7, Plan 01 — E2E stub for the Charts screen (UI-04, D7-05..D7-11).
//
// These tests are RED stubs: they will fail at runtime because the production
// DOM does not yet have #charts-screen. This is the expected state (TDD guard)
// — they will go GREEN when Plan 07-05 implements the Charts screen.
//
// DOM IDs referenced (to be created in later plans):
//   #charts-screen           — charts screen section
//   #bottom-nav              — bottom nav (needed to navigate to charts)
//   button[data-tab="charts"]    — Charts tab button
//   .coldStartNote           — cold-start card shown when insufficient data
//
// Source: 07-01-PLAN.md Task 3; D7-05..D7-11, D7-17

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Charts screen — UI-04, D7-05..D7-11', () => {

  test('charts section present in DOM after app loads', async ({ page }) => {
    // #charts-screen should be attached to the DOM (hidden by default, display:none)
    await expect(page.locator('#charts-screen')).toBeAttached();
  });

  test('shows cold-start card when insufficient data (fewer than minDays)', async ({ page }) => {
    // With no events logged, the charts screen should show a cold-start card
    // when navigated to. Fresh state has 0 events < default minDays=7.
    await page.locator('#bottom-nav button[data-tab="charts"]').click();

    // Cold-start note should be visible inside the charts screen (D7-05 minimum data gate).
    // Scoped to #charts-screen to avoid strict-mode violation when accuracy-screen
    // also has a .coldStartNote element (both screens use the same class name).
    await expect(page.locator('#charts-screen .coldStartNote')).toBeVisible();
  });

});
