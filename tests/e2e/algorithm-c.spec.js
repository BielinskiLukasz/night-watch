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

// ── Seed helpers (copied verbatim from tests/e2e/tif.spec.js per this
// project's per-spec-file fixture-duplication convention) ──────────────────

/**
 * Build a canonical v2 db blob with optional settings overrides.
 */
function makeDb(events, settingsOverrides = {}) {
  return {
    version: 2,
    settings: {
      subjectName: 'Test',
      cutoverHour: 4,
      groupingMode: 'calendar',
      timeFormat: '24h',
      autoOutlier: false,
      maxDelta: 30,
      minDays: 7,
      windowDays: 7,
      statBlend: 'median',
      rejectedDays: [],
      stages: [],
      activeStageId: null,
      confirmBeforeLogging: false,
      forecastAlgorithm: 'classic',
      trimPct: 10,
      precisionTarget: 60,
      ...settingsOverrides,
    },
    events,
    activityLog: {},
  };
}

/**
 * Generate n events of a given type, one per calendar day, all at the same HH:MM.
 */
function makeEvents(n, type, hhmm, baseDate, idPrefix) {
  const events = [];
  const [y, m, d] = baseDate.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    const date = new Date(y, m - 1, d + i);
    const pad = (x) => String(x).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    events.push({
      id: `${idPrefix}-${i + 1}`,
      type,
      at: `${dateStr}T${hhmm}`,
    });
  }
  return events;
}

/**
 * Build a wake-only 32-day fixture. Using only wake events ensures the
 * wake prediction has a single source window (historic wake band), which
 * always self-intersects and produces a normal (non-placeholder) prediction
 * card regardless of which algorithm computes it.
 */
function makeWakeOnlyDb(settingsOverrides = {}) {
  const BASE = '2026-05-01';
  const N = 32;
  const events = makeEvents(N, 'wake', '06:30', BASE, 'w');
  return makeDb(events, settingsOverrides);
}

/**
 * Seed localStorage and reload the page.
 */
async function seedAndReload(page, db) {
  await page.evaluate((data) => {
    localStorage.setItem('nightwatch:db', JSON.stringify(data));
  }, db);
  await page.reload();
}

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

// ── Test 2: Algorithm C predictions render via .prediction-card, never .tif-card ──

test('Algorithm C predictions render via .prediction-card, never .tif-card', async ({ page }) => {
  // Same fixed time as tif.spec.js's Test 2, for the identical
  // reachable-event reasoning documented there.
  await page.clock.setFixedTime(new Date('2026-06-02T09:00:00'));

  // Seed with 32 days of wake-only data and Algorithm C selected. Deliberately
  // omit blendWindowDays/blendTrimPct/blendShrinkage from the override so this
  // test also proves Plan 25-03's migration/validation default-injection path
  // works end-to-end, not just the algorithm dispatch.
  const db = makeWakeOnlyDb({ forecastAlgorithm: 'blend' });
  await seedAndReload(page, db);

  // Forecast section should be visible (not cold start — 32 days > minDays 7)
  await expect(page.locator('#forecast-cards')).toBeVisible();
  await expect(page.locator('#cold-start-message')).not.toBeVisible();

  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();

  // Opening Later Today auto-expands nested collapsible cards (D-13); plain
  // Algorithm C prediction cards (no probability band) render uncollapsed
  // regardless, but opening the section is required to reach them at all.
  await laterToday.locator('summary').click();

  // Algorithm C predictions never carry precisionScore/isLowConfidence, so
  // renderForecastSection's generic dispatch never selects the TIF card
  // renderer — no .tif-card should exist anywhere in the forecast section.
  await expect(page.locator('#forecast-cards .tif-card')).toHaveCount(0);

  // At least one real .prediction-card exists inside the opened Later-Today
  // section — the wake card specifically, located via the same
  // data-event-type attribute tif.spec.js's TIF-card assertions rely on.
  const wakeCard = laterToday.locator('.prediction-card[data-event-type="wake"]');
  await expect(wakeCard).toBeVisible();

  // Its central time is real data, not the null-fallback em-dash placeholder.
  await expect(wakeCard.locator('.time-central')).not.toHaveText('—');
});

// ── Test 3: Switching away from Algorithm C removes Algorithm-C-only state ────

test('switching from Algorithm C to Classic removes any Algorithm-C-only card state', async ({ page }) => {
  // Same fixed time as tif.spec.js's Test 3, for the identical
  // reachable-event reasoning documented there.
  await page.clock.setFixedTime(new Date('2026-06-02T09:00:00'));

  // Start with Algorithm C active and wake-only data seeded.
  const db = makeWakeOnlyDb({ forecastAlgorithm: 'blend' });
  await seedAndReload(page, db);

  // Confirm prediction cards are present (count doesn't require the section
  // to be open).
  expect(await page.locator('#forecast-cards .prediction-card').count()).toBeGreaterThan(0);

  // Fail the test if switching algorithms throws an unexpected runtime error.
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err));

  // Open Settings, switch to Classic, save.
  await page.locator('button.settingsTrigger').click();
  await expect(page.locator('dialog#settings')).toBeVisible();
  await page.locator('#settings select[name="forecastAlgorithm"]').selectOption('classic');
  await page.locator('#settings button[type="submit"]').click();

  // Wait for the reactive re-render to complete (settings subscriber fires synchronously)
  await expect(page.locator('#forecast-cards')).toBeVisible();

  // No .tif-card elements should remain (there never was one, but this
  // mirrors tif.spec.js's exact assertion shape for the equivalent regression).
  await expect(page.locator('#forecast-cards .tif-card')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
