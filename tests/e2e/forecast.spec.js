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
  const db = makeBaselineDb();
  await seedAndReload(page, db);

  await expect(page.locator('#cold-start-message')).not.toBeVisible();
  await expect(page.locator('#forecast-cards')).toBeVisible();
  const cardCount = await page.locator('#forecast-cards .prediction-card').count();
  expect(cardCount).toBe(4);

  const wakeCard = page.locator('#forecast-cards .prediction-card').first();
  await expect(wakeCard).toBeVisible();
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

test('probability-band forecast card renders collapsed by default (UI-09)', async ({ page }) => {
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

  const probBandCard = page.locator('#forecast-cards .prediction-card.probability-band').first();
  await expect(probBandCard).toBeVisible();
  await expect(probBandCard).toHaveClass(/collapsed/);
  await expect(probBandCard.locator('.card-summary')).toBeVisible();

  const cardFull = probBandCard.locator('.card-full');
  await expect(cardFull).toBeHidden();

  await expect(probBandCard.locator('.card-chevron')).toContainText('↓');
});

// ── Test 5: Click collapsed card to expand (UI-09 interact) ──────────────────

test('clicking a collapsed probability-band card expands it (UI-09)', async ({ page }) => {
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

  const probBandCard = page.locator('#forecast-cards .prediction-card.probability-band').first();
  await expect(probBandCard).toBeVisible();
  await expect(probBandCard).toHaveClass(/collapsed/);

  await probBandCard.click();
  await expect(probBandCard).not.toHaveClass(/collapsed/);
  await expect(probBandCard.locator('.card-full')).toBeVisible();
  await expect(probBandCard.locator('.card-full .prob-list')).toBeVisible();
  await expect(probBandCard.locator('.card-chevron')).toContainText('↑');

  await probBandCard.click();
  await expect(probBandCard).toHaveClass(/collapsed/);
  await expect(probBandCard.locator('.card-chevron')).toContainText('↓');
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

  const missedCard = page.locator('#forecast-cards .prediction-card.missed').first();
  await expect(missedCard).toBeVisible();

  const missedLabel = missedCard.locator('.missed-label');
  await expect(missedLabel).toBeVisible();
  await expect(missedLabel).toContainText(/Missed by/i);
  await expect(missedLabel).toContainText(/min/i);
});
