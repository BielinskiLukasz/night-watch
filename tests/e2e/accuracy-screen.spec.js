// tests/e2e/accuracy-screen.spec.js
// Phase 7, Plan 06 — E2E tests for the Accuracy screen (UI-05, D7-12..D7-16).
// Phase 22, Plan 03 — rewritten avgScore grid, overall headline, bedtime
// nap-day split, and TIF bedtime split coverage (ACC-01..04, D-08..D-11, D-05).
//
// DOM IDs / classes referenced:
//   #accuracy-screen              — accuracy screen section
//   #bottom-nav                   — bottom nav bar
//   button[data-tab="accuracy"]   — Accuracy tab button
//   .coldStartNote                — cold-start card shown when insufficient data
//   .accuracyGrid                 — 1-col x 6-row accuracy grid container (D-09)
//   .accHeader                    — column header cells in the grid
//   .accRowLabel                  — row label cells in the grid
//   .accCell                      — data cells in the grid
//   .accApprox                    — band-approximated score marker (D-07)
//   .overallScoreHeadline         — overall headline score, above the grid (D-10)
//
// Source: 07-01-PLAN.md Task 3 (stub); 07-06-PLAN.md Task 2 (finalized);
//         22-03-PLAN.md Task 1/Task 2 (avgScore rewrite + TIF bedtime split)
// Decisions: D7-14 (old 4x3 grid, superseded), D7-15 (cold-start gate), D7-17 (stage filter),
//            D-08/D-09/D-10/D-11 (avgScore grid + headline), D-05 (TIF bedtime split)

import { test, expect } from '@playwright/test';

// ── Seed helpers ──────────────────────────────────────────────────────────────
// Duplicated locally per this project's convention (no shared e2e helper module) —
// mirrors tests/e2e/forecast.spec.js's makeDb/makeEvents/makeBaselineDb/seedAndReload.

/**
 * Build a canonical v2 db blob. Includes all DEFAULT_SETTINGS fields
 * from Phase 6+ (stages, activeStageId), Phase 9 (confirmBeforeLogging),
 * and Phase 10 (forecastAlgorithm/trimPct/precisionTarget).
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
 * Build the 32-day baseline fixture: all 4 event types, 32 consecutive days,
 * all at constant times. Because every day is identical, computeAccuracy()
 * retroactively predicts every scored day (index 7..31) with D=0 for every
 * event type — fully deterministic scoring (every score = 100).
 */
function makeBaselineDb(settingsOverrides = {}) {
  const BASE = '2026-05-01';
  const N = 32;
  const events = [
    ...makeEvents(N, 'wake',     '06:30', BASE, 'w'),
    ...makeEvents(N, 'napStart', '13:00', BASE, 'ns'),
    ...makeEvents(N, 'napEnd',   '14:30', BASE, 'ne'),
    ...makeEvents(N, 'bedtime',  '21:00', BASE, 'b'),
  ];
  return makeDb(events, settingsOverrides);
}

/**
 * Seed the app's localStorage with the given db blob and reload the page.
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

test.describe('Accuracy screen — classic avgScore grid (Phase 22, D-08..D-11)', () => {

  test('classic grid renders avgScore column, bedtime nap-day split, and overall headline', async ({ page }) => {
    const db = makeBaselineDb();
    await seedAndReload(page, db);

    // Navigate to the Accuracy tab.
    await page.locator('#bottom-nav button[data-tab="accuracy"]').click();

    // Grid renders (not cold-start).
    const grid = page.locator('#accuracy-screen .accuracyGrid');
    await expect(grid).toBeVisible();

    // D-10: overall headline score above the grid, reading overallScore verbatim.
    // Every day in the fixture matches its own forecast exactly (D=0), so every
    // scored day's per-day mean is 100, and overallScore is 100.
    const headline = page.locator('#accuracy-screen .overallScoreHeadline');
    await expect(headline).toBeVisible();
    await expect(headline).toContainText('100');

    // D-09: exactly one score column (not the old 3-column withinDelta/withinHalfDelta/
    // insideBand layout) across the 6 rows.
    await expect(grid.locator('.accHeader:not(.accHeaderEmpty)')).toHaveCount(1);
    await expect(grid.locator('.accCell')).toHaveCount(6);

    // Wake row: constant time every day → D=0 → avgScore=100, no approximation marker.
    const wakeCell = grid.locator('.accRowLabel:text-is("Wake") + .accCell');
    await expect(wakeCell).toContainText('100');
    await expect(wakeCell.locator('.accApprox')).toHaveCount(0);

    // Bedtime (nap day): every day has a nap, so every scored bedtime day is
    // classified nap-day → avgScore=100.
    const napDayCell = grid.locator('.accRowLabel:text-is("Bedtime (nap day)") + .accCell');
    await expect(napDayCell).toContainText('100');

    // Bedtime (no nap): zero no-nap days in this fixture → existing cold-data dash.
    const noNapCell = grid.locator('.accRowLabel:text-is("Bedtime (no nap)") + .accCell');
    await expect(noNapCell).toContainText('—');
  });

  test('pre-existing cold-start test still passes unmodified alongside the new grid', async ({ page }) => {
    // No data seeded — cold start still shown, .accuracyGrid still absent.
    await page.locator('#bottom-nav button[data-tab="accuracy"]').click();
    await expect(page.locator('#accuracy-screen .coldStartNote')).toBeVisible();
    await expect(page.locator('#accuracy-screen .accuracyGrid')).toHaveCount(0);
  });

});

test.describe('Accuracy screen — TIF bedtime nap-day split (Phase 22, D-05)', () => {

  test('TIF accuracy table renders bedtime nap-day/no-nap-day split rows', async ({ page }) => {
    // Same deterministic 32-day baseline fixture, with TIF selected.
    const db = makeBaselineDb({ forecastAlgorithm: 'tif' });
    await seedAndReload(page, db);

    // Navigate to the Accuracy tab.
    await page.locator('#bottom-nav button[data-tab="accuracy"]').click();

    const table = page.locator('#accuracy-screen table');
    await expect(table).toBeVisible();

    // D-05: the original 4 rows are still present.
    await expect(table.locator('th:text-is("Wake")')).toHaveCount(1);
    await expect(table.locator('th:text-is("Nap Start")')).toHaveCount(1);
    await expect(table.locator('th:text-is("Nap End")')).toHaveCount(1);
    await expect(table.locator('th:text-is("Bedtime")')).toHaveCount(1);

    // D-05: the two new bedtime nap-day/no-nap-day split rows are present.
    // (Numeric values are not asserted — TIF's window-bound arithmetic is not
    // as trivially deterministic as the classic path's point-delta scoring.)
    await expect(table.locator('th:text-is("Bedtime (nap day)")')).toHaveCount(1);
    await expect(table.locator('th:text-is("Bedtime (no nap)")')).toHaveCount(1);
  });

});
