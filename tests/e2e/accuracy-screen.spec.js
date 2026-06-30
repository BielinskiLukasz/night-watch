// tests/e2e/accuracy-screen.spec.js
// Phase 7, Plan 06 — E2E tests for the Accuracy screen (UI-05, D7-12..D7-16).
//
// DOM IDs / classes referenced:
//   #accuracy-screen              — accuracy screen section
//   #bottom-nav                   — bottom nav bar
//   button[data-tab="accuracy"]   — Accuracy tab button
//   .coldStartNote                — cold-start card shown when insufficient data
//   .accuracyGrid                 — 4x3 accuracy grid container
//   .accHeader                    — column header cells in the grid
//
// Source: 07-01-PLAN.md Task 3 (stub); 07-06-PLAN.md Task 2 (finalized)
// Decisions: D7-14 (4x3 grid), D7-15 (cold-start gate), D7-17 (stage filter)

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
    // Navigate to the Accuracy tab
    await page.locator('#bottom-nav button[data-tab="accuracy"]').click();

    // #accuracy-screen must be visible after navigation
    await expect(page.locator('#accuracy-screen')).toBeVisible();

    // Cold-start note should be visible inside the accuracy screen (D7-15 minimum data gate).
    // Scoped to #accuracy-screen to avoid strict-mode violation when charts-screen
    // also has a .coldStartNote element (both screens use the same class name).
    await expect(page.locator('#accuracy-screen .coldStartNote')).toBeVisible();

    // Grid should NOT be rendered in cold-start state (D7-14: grid only when validCount >= minDays)
    await expect(page.locator('#accuracy-screen .accuracyGrid')).toHaveCount(0);
  });

  test('accuracy screen section visible after navigating to accuracy tab', async ({ page }) => {
    // Navigate to the Accuracy tab
    await page.locator('#bottom-nav button[data-tab="accuracy"]').click();

    // The accuracy screen section must be visible
    await expect(page.locator('#accuracy-screen')).toBeVisible();
  });

});
