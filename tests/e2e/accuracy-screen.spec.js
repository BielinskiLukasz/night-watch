// tests/e2e/accuracy-screen.spec.js
// Phase 7, Plan 01 — E2E stub for the Accuracy screen (UI-05, D7-12..D7-16).
//
// These tests are RED stubs: they will fail at runtime because the production
// DOM does not yet have #accuracy-screen. This is the expected state (TDD guard)
// — they will go GREEN when Plan 07-06 implements the Accuracy screen.
//
// DOM IDs referenced (to be created in later plans):
//   #accuracy-screen         — accuracy screen section
//   #bottom-nav              — bottom nav (needed to navigate to accuracy)
//   button[data-tab="accuracy"]  — Accuracy tab button
//   .coldStartNote           — cold-start card shown when insufficient data
//
// Source: 07-01-PLAN.md Task 3; D7-12..D7-16

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Accuracy screen — UI-05, D7-12..D7-16', () => {

  test('accuracy screen present in DOM after app loads', async ({ page }) => {
    // #accuracy-screen should be attached to the DOM (hidden by default, display:none)
    await expect(page.locator('#accuracy-screen')).toBeAttached();
  });

  test('shows cold-start card when insufficient data (fewer than minDays)', async ({ page }) => {
    // With no events logged, the accuracy screen should show a cold-start card
    // when navigated to. Fresh state has 0 events < default minDays=7.
    await page.locator('#bottom-nav button[data-tab="accuracy"]').click();

    // Cold-start note should be visible (D7-15 minimum data gate)
    await expect(page.locator('.coldStartNote')).toBeVisible();
  });

});
