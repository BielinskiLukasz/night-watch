// tests/e2e/forecast.spec.js
// PLAT-12: Rewritten with 30+ day fixture covering all four event types.
//
// Tests:
//   1. Cold-start message when < minDays (unchanged)
//   2. Prediction cards appear after minDays valid days (updated to 32-day fixture)
//   3. Quick-log reactive update without reload (unchanged logic)
//   4. Probability-band card is collapsed by default (NEW — UI-09 / D9-06)
//   5. Click collapsed card to expand (NEW — UI-09 interact)
//   6. Hero card "Next Predicted Event" label visible (NEW — UI-10 / D9-17)
//   7. Missed predictions have "missed" class and label (updated fixture)

import { test, expect } from '@playwright/test';

// ── Seed helpers ──────────────────────────────────────────────────────────────

/**
 * Build a canonical v2 db blob. Includes all DEFAULT_SETTINGS fields
 * from Phase 6+ (stages, activeStageId) and Phase 9 (confirmBeforeLogging).
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
 * Build the 32-day baseline fixture: all 4 event types, 32 consecutive days.
 * Total: 128 events (32 x 4).
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

// ── Test 1: Cold-start message when < minDays ─────────────────────────────────

test('land on Today, see cold-start message when < minDays (D3-06 / D3-09)', async ({ page }) => {
  await expect(page.locator('#cold-start-message')).toBeVisible();
  await expect(page.locator('#cold-start-message')).toContainText('Not enough data yet');
  await expect(page.locator('#cold-start-message')).toContainText('Log 7 more days');

  const cardCount = await page.locator('#forecast-cards .prediction-card').count();
  expect(cardCount).toBe(0);
});

// ── Test 2: Prediction cards appear after minDays valid days ──────────────────

test('after 32 valid-day events (all 4 types), prediction cards appear (D3-08)', async ({ page }) => {
  // Phase 21 D-07: last logged event across the fixture is day 32's bedtime →
  // nextReachableEvent(bedtime) → ['wake'] (single hero, no ambiguity). Pin the
  // clock for determinism even though this branch doesn't depend on currentHour.
  await page.clock.setFixedTime(new Date('2026-06-02T09:00:00'));

  const db = makeBaselineDb();
  await seedAndReload(page, db);

  await expect(page.locator('#cold-start-message')).not.toBeVisible();
  await expect(page.locator('#forecast-cards')).toBeVisible();

  // Hero: wake (Phase 21 D-07/D-08 — single hero here, no dual-hero ambiguity).
  const heroCard = page.locator('#next-event-card .next-event-hero');
  await expect(heroCard).toBeVisible();
  await expect(heroCard).toHaveAttribute('data-event-type', 'wake');

  // Every event type — including the hero's own (wake), per G-20-15 gap
  // closure — lives inside the collapsed-by-default "Details" section
  // (renamed from "Later today"; Phase 21 D-10/D-11/D-12, Phase 20-06).
  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();
  await laterToday.locator('summary').click();

  const cardCount = await page.locator('#forecast-cards .prediction-card').count();
  expect(cardCount).toBe(4);

  const firstCard = page.locator('#forecast-cards .prediction-card').first();
  await expect(firstCard).toBeVisible();
});

// ── Test 3: Quick-log button triggers reactive forecast re-render (no reload) ─

test('quick-log button triggers reactive forecast update without reload (D3-12)', async ({ page }) => {
  const db = makeBaselineDb();
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();
  await expect(page.locator('#cold-start-message')).not.toBeVisible();
  await expect(page.locator('#next-event-card .next-event-hero')).toBeVisible();

  const wakeBtn = page.getByRole('button', { name: /woke up/i });
  await wakeBtn.click();

  const eventsList = page.locator('[data-role="events"]');
  await expect(eventsList).toContainText(/Woke up/i);

  await expect(page.locator('#forecast-cards')).toBeVisible();
  await expect(page.locator('#next-event-card')).toBeVisible();
});

// ── Test 4: Probability-band card is collapsed by default (UI-09 / D9-05/D9-06) ─

test('probability-band forecast card starts collapsed, then auto-expands when Later Today opens (UI-09 / D-13)', async ({ page }) => {
  // Phase 21 D-08: pin the clock before eveningHour(18) so lastEvent='wake' resolves
  // to the dual-hero branch (napStart + bedtimeAfterWake) — this high-variance-wake
  // fixture's own wake prediction is therefore NOT a hero candidate and lands in
  // Later Today, preserving this test's original grid-level collapse/expand intent.
  await page.clock.setFixedTime(new Date('2026-05-27T09:00:00'));

  const highVarianceWake = [
    { id: 'hv-1', type: 'wake', at: '2026-05-20T06:00' },
    { id: 'hv-2', type: 'wake', at: '2026-05-21T06:20' },
    { id: 'hv-3', type: 'wake', at: '2026-05-22T06:40' },
    { id: 'hv-4', type: 'wake', at: '2026-05-23T07:00' },
    { id: 'hv-5', type: 'wake', at: '2026-05-24T07:20' },
    { id: 'hv-6', type: 'wake', at: '2026-05-25T07:40' },
    { id: 'hv-7', type: 'wake', at: '2026-05-26T08:00' },
  ];
  const db = makeDb(highVarianceWake, { maxDelta: 30, minDays: 7 });
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();

  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();

  const probBandCard = laterToday.locator('.prediction-card.probability-band').first();
  // Starts collapsed while Later Today itself is still closed (D-11).
  await expect(probBandCard).toHaveClass(/collapsed/);

  // Opening Later Today auto-expands nested collapsible cards (D-13).
  await laterToday.locator('summary').click();
  await expect(probBandCard).toBeVisible();
  await expect(probBandCard).not.toHaveClass(/collapsed/);
  await expect(probBandCard.locator('.card-full')).toBeVisible();
  await expect(probBandCard.locator('.card-chevron')).toContainText('↑');
});

// ── Test 5: Manual collapse/expand toggle still works after Later Today's auto-expand (UI-09) ─

test('clicking an auto-expanded probability-band card collapses it, clicking again re-expands it (UI-09)', async ({ page }) => {
  // Same dual-hero pin as Test 4 — keeps the high-variance wake card out of the hero slot.
  await page.clock.setFixedTime(new Date('2026-05-27T09:00:00'));

  const highVarianceWake = [
    { id: 'hv-1', type: 'wake', at: '2026-05-20T06:00' },
    { id: 'hv-2', type: 'wake', at: '2026-05-21T06:20' },
    { id: 'hv-3', type: 'wake', at: '2026-05-22T06:40' },
    { id: 'hv-4', type: 'wake', at: '2026-05-23T07:00' },
    { id: 'hv-5', type: 'wake', at: '2026-05-24T07:20' },
    { id: 'hv-6', type: 'wake', at: '2026-05-25T07:40' },
    { id: 'hv-7', type: 'wake', at: '2026-05-26T08:00' },
  ];
  const db = makeDb(highVarianceWake, { maxDelta: 30, minDays: 7 });
  await seedAndReload(page, db);

  const laterToday = page.locator('.later-today-section');
  await laterToday.locator('summary').click();

  const probBandCard = laterToday.locator('.prediction-card.probability-band').first();
  // Auto-expanded by D-13 as soon as Later Today opened.
  await expect(probBandCard).not.toHaveClass(/collapsed/);
  await expect(probBandCard.locator('.card-full')).toBeVisible();
  await expect(probBandCard.locator('.card-full .prob-list')).toBeVisible();

  // Manual click still collapses it (UI-09's original per-card toggle mechanism).
  await probBandCard.click();
  await expect(probBandCard).toHaveClass(/collapsed/);
  await expect(probBandCard.locator('.card-chevron')).toContainText('↓');

  // And a second click re-expands it.
  await probBandCard.click();
  await expect(probBandCard).not.toHaveClass(/collapsed/);
  await expect(probBandCard.locator('.card-chevron')).toContainText('↑');
});

// ── Test 6: Hero card shows "Next Predicted Event" label (UI-10 / D9-17) ──────

test('hero card displays "Next Predicted Event" label (UI-10)', async ({ page }) => {
  const db = makeBaselineDb();
  await seedAndReload(page, db);

  const heroCard = page.locator('#next-event-card .next-event-hero');
  await expect(heroCard).toBeVisible();

  const heroLabel = heroCard.locator('.hero-label');
  await expect(heroLabel).toBeVisible();
  await expect(heroLabel).toContainText('Next Predicted Event');

  await expect(heroCard.locator('.event-type')).toBeVisible();
  await expect(heroCard.locator('.time-central')).toBeVisible();
});

// ── Test 7: Missed predictions are grayed out and labeled (D3-11) ─────────────

test('missed predictions have "missed" class and "Missed by" label (D3-11)', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-27T14:00:00'));

  const wakeEvents = makeEvents(7, 'wake', '06:30', '2026-05-20', 'w');
  wakeEvents.push({ id: 'bed-1', type: 'bedtime', at: '2026-05-27T13:00' });
  const db = makeDb(wakeEvents, { minDays: 7 });
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();

  // Phase 21 D-07/D-08: lastEvent=bedtime → nextReachableEvent → ['wake'] (single
  // hero) — the missed prediction (wake, central 06:30, now 14:00) IS the hero here.
  const missedCard = page.locator('#next-event-card .next-event-hero.missed');
  await expect(missedCard).toBeVisible();

  const missedLabel = missedCard.locator('.missed-label');
  await expect(missedLabel).toBeVisible();
  await expect(missedLabel).toContainText(/Missed by/i);
  await expect(missedLabel).toContainText(/min/i);
});

// ── Test 8: napStart card fully disappears once the nap window has closed (Phase 21 D-01..D-05) ──

test('napStart card is absent once the nap window has closed, other cards remain (Phase 21)', async ({ page }) => {
  // 2026-06-08T20:00:00 is well past both napStart's P90 ('08:00', see below) and the
  // default eveningHour (18) — either signal alone would suppress napStart per D-05.
  await page.clock.setFixedTime(new Date('2026-06-08T20:00:00'));

  // 7 full days of a stable wake/napStart/napEnd/bedtime cycle, napStart flat at '08:00'
  // (so its P90 is also '08:00'), then a FINAL day truncated to only a wake event —
  // "today's wake logged, nothing else yet". Last logged event overall is that wake.
  const BASE = '2026-06-01';
  const fullDayEvents = [
    ...makeEvents(7, 'wake', '06:30', BASE, 'w'),
    ...makeEvents(7, 'napStart', '08:00', BASE, 'ns'),
    ...makeEvents(7, 'napEnd', '09:00', BASE, 'ne'),
    ...makeEvents(7, 'bedtime', '21:00', BASE, 'b'),
  ];
  const todayOnlyWake = [
    { id: 'today-wake', type: 'wake', at: '2026-06-08T06:30' },
  ];
  const db = makeDb([...fullDayEvents, ...todayOnlyWake], { minDays: 7 });
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();

  await expect(page.locator('[data-event-type="napStart"]')).toHaveCount(0);
  expect(await page.locator('[data-event-type="wake"]').count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator('[data-event-type="napEnd"]').count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator('[data-event-type="bedtime"]').count()).toBeGreaterThanOrEqual(1);
});
