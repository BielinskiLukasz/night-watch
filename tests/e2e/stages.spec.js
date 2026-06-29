// tests/e2e/stages.spec.js
// Plan 06-03 / Task 2 — E2E coverage for the stage selector on the Today screen:
//   - Selector hidden when no stages exist (D6-09)
//   - Selector visible with correct options when stages are seeded
//   - Selecting a stage persists activeStageId via settings.update()
//   - Selecting 'All data' resets activeStageId to null
//   - Fallback note shown when active stage has too few valid days (D6-11)
//
// Storage isolation: localStorage cleared in beforeEach (Pitfall #8).
// Seed strategy: inject canonical v2 db blob via page.evaluate() before reload,
// matching the pattern used by forecast.spec.js and reload.spec.js.
//
// Source: 06-03 PLAN.md; D6-09 (selector gate), D6-11 (thin-stage fallback),
//         D6-12 ("All data" option)

import { test, expect } from '@playwright/test';

// ── Seed helper ───────────────────────────────────────────────────────────────

/**
 * Build a canonical v2 db blob with stages-aware settings.
 * Uses the same wire format as other E2E test suites in this project.
 */
function makeDb(overrides = {}) {
  const defaults = {
    version: 2,
    settings: {
      subjectName: 'Baby',
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
    },
    events: [],
    activityLog: {},
  };
  return {
    ...defaults,
    ...overrides,
    settings: { ...defaults.settings, ...(overrides.settings || {}) },
  };
}

/**
 * Seed localStorage with a db blob and reload the page.
 */
async function seedAndReload(page, db) {
  await page.evaluate((data) => {
    localStorage.setItem('nightwatch:db', JSON.stringify(data));
  }, db);
  await page.reload();
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ── Test 1: Selector hidden when no stages exist (D6-09) ─────────────────────

test('stage selector is hidden when no stages exist (D6-09)', async ({ page }) => {
  // Fresh state with no stages (default)
  await expect(page.locator('#stage-selector-container')).not.toBeVisible();
});

// ── Test 2: Selector appears when stages are seeded ───────────────────────────

test('stage selector appears with correct options when stages are seeded', async ({ page }) => {
  const db = makeDb({
    settings: {
      stages: [{ id: '1', name: 'Early Stage', startDate: '2020-01-01', endDate: null }],
      activeStageId: null,
      minDays: 1, // low minDays so thin-stage fallback doesn't mask selector
    },
  });
  await seedAndReload(page, db);

  // Container should be visible
  await expect(page.locator('#stage-selector-container')).toBeVisible();

  // Select element should be visible
  await expect(page.locator('.stage-select')).toBeVisible();

  // "All data" option (value='') should exist (D6-12)
  const allDataOption = page.locator('.stage-select option[value=""]');
  await expect(allDataOption).toHaveCount(1);
  await expect(allDataOption).toContainText('All data');

  // Stage option should exist with correct value and label
  const stageOption = page.locator('.stage-select option[value="1"]');
  await expect(stageOption).toHaveCount(1);
  await expect(stageOption).toContainText('Early Stage');
});

// ── Test 3: Selecting a stage persists activeStageId ─────────────────────────

test('selecting a stage persists activeStageId in localStorage', async ({ page }) => {
  const db = makeDb({
    settings: {
      stages: [{ id: '1', name: 'Early Stage', startDate: '2020-01-01', endDate: null }],
      activeStageId: null,
      minDays: 1,
    },
  });
  await seedAndReload(page, db);

  // Select the stage option
  await page.locator('.stage-select').selectOption('1');

  // Verify activeStageId is persisted in localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.activeStageId).toBe('1');
});

// ── Test 4: Selecting 'All data' resets activeStageId to null ────────────────

test('selecting All data resets activeStageId to null in localStorage', async ({ page }) => {
  // Seed with an active stage already selected
  const db = makeDb({
    settings: {
      stages: [{ id: '1', name: 'Early Stage', startDate: '2020-01-01', endDate: null }],
      activeStageId: '1',
      minDays: 1,
    },
  });
  await seedAndReload(page, db);

  // Select "All data" (value='')
  await page.locator('.stage-select').selectOption('');

  // Verify activeStageId is null in localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.activeStageId).toBeNull();
});

// ── Test 5: Fallback note shown when stage has too few valid days (D6-11) ─────

test('fallback note visible when active stage has too few valid days (D6-11)', async ({ page }) => {
  // Seed: one stage with a date range far in the future so no events fall within it.
  // minDays=7 (default), no events → filtered count = 0 < 7 → thin-stage fallback.
  const db = makeDb({
    settings: {
      stages: [{ id: 'future', name: 'Future Stage', startDate: '2099-01-01', endDate: null }],
      activeStageId: 'future',
      minDays: 7,
    },
    events: [],
  });
  await seedAndReload(page, db);

  // The selector should be visible (stage exists)
  await expect(page.locator('#stage-selector-container')).toBeVisible();

  // The fallback note should be visible and contain the thin-stage message
  const note = page.locator('#stage-fallback-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Not enough data');
});
