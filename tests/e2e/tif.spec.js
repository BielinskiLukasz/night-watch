// tests/e2e/tif.spec.js
// Phase 10 (Plan 10-05) — E2E tests for TIF algorithm rendering on the Today screen.
//
// Tests:
//   1. TIF toggle show/hide in Settings — #tifOptions visibility mirrors forecastAlgorithm select
//   2. TIF prediction cards render when TIF is selected (tif-card, tif-score-badge)
//   3. Switching to Classic removes TIF cards from the DOM
//
// Fixture note: Tests 2 and 3 use a wake-only fixture (32 days, no bedtime/nap).
// This guarantees the wake prediction has exactly ONE source window (historic wake band)
// which always self-intersects, producing a normal (non-low-confidence) TIF card with
// a precision badge. NapStart, napEnd, bedtime predictions fall back to nullPrediction
// (still routed as .tif-card, just without times or a badge).

import { test, expect } from '@playwright/test';

// ── Seed helpers ──────────────────────────────────────────────────────────────

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
 * Build a wake-only 32-day fixture. Using only wake events ensures the TIF
 * wake prediction has a single source window (historic wake band), which
 * always self-intersects and produces a normal (non-low-confidence) TIF card.
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

// ── Test 1: TIF toggle show/hide in Settings ──────────────────────────────────

test('TIF options panel is hidden when Classic is selected, visible when TIF is selected (D10-12)', async ({ page }) => {
  // Open the Settings modal
  await page.locator('button.settingsTrigger').click();
  await expect(page.locator('dialog#settings')).toBeVisible();

  // #tifOptions should be hidden by default (forecastAlgorithm: 'classic')
  await expect(page.locator('#tifOptions')).toBeHidden();

  // Change algorithm select to 'tif'
  await page.locator('#settings select[name="forecastAlgorithm"]').selectOption('tif');

  // #tifOptions should now be visible
  await expect(page.locator('#tifOptions')).toBeVisible();

  // Switch back to 'classic'
  await page.locator('#settings select[name="forecastAlgorithm"]').selectOption('classic');

  // #tifOptions should be hidden again
  await expect(page.locator('#tifOptions')).toBeHidden();
});

// ── Test 2: TIF prediction cards render when TIF is selected ──────────────────

test('TIF prediction cards (.tif-card, .tif-score-badge) render after switching to TIF algorithm', async ({ page }) => {
  // Phase 21 D-07/D-08: this fixture's only logged event type is 'wake', so
  // lastEvent.type === 'wake' → nextReachableEvent → ['napStart', 'bedtimeAfterWake']
  // (dual hero, both null-data TIF placeholders) — 'wake' itself (the one TIF
  // prediction with real data) is NOT a hero candidate here and lands inside the
  // collapsed-by-default "Later today" section instead. Pin the clock before
  // eveningHour(18) so napStart isn't additionally dropped from the dual hero.
  await page.clock.setFixedTime(new Date('2026-06-02T09:00:00'));

  // Seed with 32 days of wake-only data and TIF algorithm selected.
  // Wake-only ensures the historic wake band self-intersects → normal TIF card.
  const db = makeWakeOnlyDb({ forecastAlgorithm: 'tif' });
  await seedAndReload(page, db);

  // Forecast section should be visible (not cold start — 32 days > minDays 7)
  await expect(page.locator('#forecast-cards')).toBeVisible();
  await expect(page.locator('#cold-start-message')).not.toBeVisible();

  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();

  // At least one .tif-card should be present (the wake card at minimum)
  const tifCards = laterToday.locator('.tif-card');
  const wakeCard = tifCards.first();
  // Normal TIF cards start collapsed while Later Today itself is still closed.
  await expect(wakeCard).toHaveClass(/collapsed/);

  // Opening Later Today auto-expands nested collapsible cards (D-13).
  await laterToday.locator('summary').click();
  await expect(wakeCard).toBeVisible();
  await expect(wakeCard).not.toHaveClass(/collapsed/);
  await expect(wakeCard.locator('.card-full')).toBeVisible();
  await expect(wakeCard.locator('.tif-score-badge')).toBeVisible();
  await expect(wakeCard.locator('.tif-score-badge')).toContainText('Precision:');
  await expect(wakeCard.locator('.tif-source-list')).toBeVisible();

  // Manual click still collapses it (the per-card toggle mechanism, D10-09).
  await wakeCard.click();
  await expect(wakeCard).toHaveClass(/collapsed/);
  await expect(wakeCard.locator('.card-full')).not.toBeVisible();

  // And a second click re-expands it.
  await wakeCard.click();
  await expect(wakeCard).not.toHaveClass(/collapsed/);
  await expect(wakeCard.locator('.tif-score-badge')).toBeVisible();
});

// ── Test 3: Switching to Classic removes TIF cards ────────────────────────────

test('switching from TIF to Classic removes .tif-card elements from the DOM', async ({ page }) => {
  // Phase 21 D-07/D-08: see Test 2 above — the wake-only fixture's TIF cards
  // live inside the collapsed "Later today" section, not the hero slot.
  await page.clock.setFixedTime(new Date('2026-06-02T09:00:00'));

  // Start with TIF active and wake-only data seeded
  const db = makeWakeOnlyDb({ forecastAlgorithm: 'tif' });
  await seedAndReload(page, db);

  // Confirm TIF cards are present (count doesn't require the section to be open)
  expect(await page.locator('#forecast-cards .tif-card').count()).toBeGreaterThan(0);

  // Open Settings, switch to Classic, save
  await page.locator('button.settingsTrigger').click();
  await expect(page.locator('dialog#settings')).toBeVisible();
  await page.locator('#settings select[name="forecastAlgorithm"]').selectOption('classic');
  await page.locator('#settings button[type="submit"]').click();

  // Wait for the reactive re-render to complete (settings subscriber fires synchronously)
  await expect(page.locator('#forecast-cards')).toBeVisible();

  // No .tif-card elements should remain
  await expect(page.locator('#forecast-cards .tif-card')).toHaveCount(0);
});
