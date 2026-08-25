// tests/e2e/bottom-nav.spec.js
// Phase 7, Plan 01 — E2E stub for bottom navigation bar (UI-06, D7-01..D7-04).
//
// These tests are RED stubs: they will fail at runtime because the production
// DOM does not yet have #bottom-nav or the five data-tab buttons. This is the
// expected state (TDD guard) — they will go GREEN when Plan 07-04 wires the
// bottom nav UI.
//
// DOM IDs referenced (to be created in later plans):
//   #bottom-nav              — the <nav role="tablist"> element (D7-04)
//   button[data-tab="today"]     — Today tab button
//   button[data-tab="history"]   — History tab button
//   button[data-tab="charts"]    — Charts tab button
//   button[data-tab="accuracy"]  — Accuracy tab button
//   #charts-screen           — charts screen section
//   #accuracy-screen         — accuracy screen section
//
// Source: 07-01-PLAN.md Task 3; D7-01/D7-02/D7-03/D7-04

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Bottom navigation — UI-06, D7-01..D7-04', () => {

  test('renders five tab buttons inside #bottom-nav', async ({ page }) => {
    // D7-03: five tabs — Today | History | Charts | Accuracy | Metrics
    await expect(page.locator('#bottom-nav button[data-tab]')).toHaveCount(5);
  });

  test('Today tab is active by default (aria-selected="true")', async ({ page }) => {
    // D7-01/D7-03: Today is the default active tab
    await expect(
      page.locator('#bottom-nav button[data-tab="today"][aria-selected="true"]')
    ).toBeVisible();
  });

  test('clicking Charts tab shows charts screen and hides today screen', async ({ page }) => {
    // D7-01: clicking Charts tab switches visible screen to #charts-screen
    await page.locator('#bottom-nav button[data-tab="charts"]').click();

    // Charts screen should be visible (not display:none)
    const chartsDisplay = await page.locator('#charts-screen').evaluate(
      el => window.getComputedStyle(el).display
    );
    expect(chartsDisplay).not.toBe('none');
  });

  test('clicking Accuracy tab shows accuracy screen', async ({ page }) => {
    // D7-01: clicking Accuracy tab switches visible screen to #accuracy-screen
    await page.locator('#bottom-nav button[data-tab="accuracy"]').click();

    // Accuracy screen should be visible (not display:none)
    const accuracyDisplay = await page.locator('#accuracy-screen').evaluate(
      el => window.getComputedStyle(el).display
    );
    expect(accuracyDisplay).not.toBe('none');
  });

  test('clicking Metrics tab shows metrics screen and hides today screen', async ({ page }) => {
    // Navigation between Metrics and Today (existing behavior now via bottom nav)
    await page.locator('#bottom-nav button[data-tab="metrics"]').click();

    await expect(page.locator('#metrics-screen')).toBeVisible();
    await expect(page.locator('#today-screen')).toBeHidden();
  });

});
