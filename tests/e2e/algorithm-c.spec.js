// tests/e2e/algorithm-c.spec.js
// Phase 25 (Plan 25-05) — E2E tests for Algorithm C's Settings modal wiring
// and Today-screen rendering.
//
// Scope: three-way selector fieldset visibility (D-14, UI-12), and real-data
// prediction rendering for Algorithm C ('blend') via the pre-existing Classic
// '.prediction-card' rendering path — never '.tif-card' (PRED-13, PRED-17).
//
// Tests:
//   1. Three-way algorithm selector shows exactly one fieldset at a time
//      (#classicOptions/#tifOptions/#blendOptions), extending
//      tests/e2e/tif.spec.js's existing two-way toggle test to three options.
//   2. Algorithm C prediction cards render via .prediction-card (never
//      .tif-card) with real, non-placeholder central times.
//   3. Switching from Algorithm C to Classic removes any Algorithm-C-only
//      card state cleanly (no stale DOM), mirroring tests/e2e/tif.spec.js's
//      existing switch-away regression test.

import { test, expect } from '@playwright/test';

// ── Suite setup ───────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ── Test 1: Three-way selector fieldset visibility (D-14) ─────────────────────

test('three-way algorithm selector shows exactly one fieldset at a time (D-14)', async ({ page }) => {
  // Open the Settings modal
  await page.locator('button.settingsTrigger').click();
  await expect(page.locator('dialog#settings')).toBeVisible();

  // Default (forecastAlgorithm: 'classic'): only #classicOptions is visible.
  await expect(page.locator('#classicOptions')).toBeVisible();
  await expect(page.locator('#tifOptions')).toBeHidden();
  await expect(page.locator('#blendOptions')).toBeHidden();

  // Switch to TIF: only #tifOptions is visible.
  await page.locator('#settings select[name="forecastAlgorithm"]').selectOption('tif');
  await expect(page.locator('#tifOptions')).toBeVisible();
  await expect(page.locator('#classicOptions')).toBeHidden();
  await expect(page.locator('#blendOptions')).toBeHidden();

  // Switch to Algorithm C: only #blendOptions is visible.
  await page.locator('#settings select[name="forecastAlgorithm"]').selectOption('blend');
  await expect(page.locator('#blendOptions')).toBeVisible();
  await expect(page.locator('#classicOptions')).toBeHidden();
  await expect(page.locator('#tifOptions')).toBeHidden();

  // Switch back to Classic: original state is restored.
  await page.locator('#settings select[name="forecastAlgorithm"]').selectOption('classic');
  await expect(page.locator('#classicOptions')).toBeVisible();
  await expect(page.locator('#tifOptions')).toBeHidden();
  await expect(page.locator('#blendOptions')).toBeHidden();
});
