// tests/e2e/forecast.spec.js
// Plan 03-04 / Task 5 — E2E coverage for the forecast UI cards:
//   - Cold-start message when < minDays (D3-06 / D3-09)
//   - Prediction cards appear after minDays events logged on different days (D3-08)
//   - Quick-log button triggers reactive forecast re-render without reload (D3-12)
//   - Probability-band fallback when band width > maxDelta (D3-04)
//   - Next-event hero card is visible and correctly identifies next event (D3-10)
//   - Missed predictions are grayed out with "Missed by Xmin" label (D3-11)
//
// Test strategy:
//   - Tests 1–3, 5, 6 seed localStorage directly via page.evaluate() to bypass
//     the manual-entry UI when seeding 7+ days of data. This matches Phase 1
//     E2E test patterns (RESEARCH §Pitfall #8). The seeded blob follows D-04
//     canonical shape { version: 2, events: [...], settings: {...} }.
//   - Test 4 (probability-band) seeds high-variance wake times (120-min spread)
//     with maxDelta=30 in settings to trigger the D3-04 fallback.
//   - Test 6 (missed) uses Playwright's fake clock to freeze time at 14:00 so
//     wake predictions at 07:00 are unambiguously in the past.
//   - All tests clear localStorage in beforeEach (Pitfall #8 storage isolation).
//
// Source: 03-CONTEXT.md D3-04/D3-06/D3-07/D3-08/D3-09/D3-10/D3-11/D3-12/D3-16

import { test, expect } from '@playwright/test';

// ── Seed helpers ──────────────────────────────────────────────────────────────

/**
 * Build a canonical v2 db blob with the given events and optional settings overrides.
 * D-04 wire format: { version: 2, settings: {...}, events: [{id,type,at},...] }
 *
 * Default settings match DEFAULT_SETTINGS (Phase 2) with minDays=7, maxDelta=30.
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
      ...settingsOverrides,
    },
    events,
  };
}

/**
 * Generate n events, one per calendar day starting from baseDate, all of the
 * given type and HH:MM time. Returns canonical {id, type, at} objects.
 *
 * @param {number}   n          number of events
 * @param {string}   type       'wake' | 'bedtime' | 'napStart' | 'napEnd'
 * @param {string}   hhmm       'HH:MM'
 * @param {string}   baseDate   'YYYY-MM-DD' — first event date
 * @param {number}   startId    starting numeric id suffix
 */
function makeEvents(n, type, hhmm, baseDate, startId = 1) {
  const events = [];
  const [y, m, d] = baseDate.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    // Increment calendar day by i
    const date = new Date(y, m - 1, d + i);
    const pad = (x) => String(x).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    events.push({
      id: `evt-${startId + i}`,
      type,
      at: `${dateStr}T${hhmm}`,
    });
  }
  return events;
}

/**
 * Seed the app's localStorage with the given db blob and reload.
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

// ── Test 1: Cold-start message when < minDays ─────────────────────────────────

test('land on Today, see cold-start message when < minDays (D3-06 / D3-09)', async ({ page }) => {
  // Fresh state — no events, minDays=7 (default)
  await expect(page.locator('#cold-start-message')).toBeVisible();
  await expect(page.locator('#cold-start-message')).toContainText('Not enough data yet');
  await expect(page.locator('#cold-start-message')).toContainText('Log 7 more days');

  // The four prediction cards section should be empty (display:none or no children)
  const forecastCards = page.locator('#forecast-cards');
  // Either hidden or has no prediction-card children
  const cardCount = await forecastCards.locator('.prediction-card').count();
  expect(cardCount).toBe(0);
});

// ── Test 2: Log 7 events on different days → prediction cards appear ──────────

test('after 7 valid-day events, prediction cards appear (PRED-01 / D3-08)', async ({ page }) => {
  // Seed 7 wake events on consecutive days; minDays=7 by default
  const events = makeEvents(7, 'wake', '06:30', '2026-05-20');
  const db = makeDb(events);
  await seedAndReload(page, db);

  // Cold-start message should be gone (or hidden)
  const coldStart = page.locator('#cold-start-message');
  await expect(coldStart).not.toBeVisible();

  // Four prediction cards should be rendered
  const forecastCards = page.locator('#forecast-cards');
  await expect(forecastCards).toBeVisible();

  // At least the wake card should be present and show a central time
  const wakeCard = forecastCards.locator('.prediction-card').first();
  await expect(wakeCard).toBeVisible();

  // The wake card should contain a time (06:30 median of identical values)
  await expect(wakeCard).toContainText('06:30');
});

// ── Test 3: Quick-log button triggers reactive forecast re-render (no reload) ─

test('quick-log button triggers reactive forecast update without reload (D3-12)', async ({ page }) => {
  // Start with 7 days of data so cold-start is bypassed
  const events = makeEvents(7, 'wake', '06:30', '2026-05-20');
  const db = makeDb(events);
  await seedAndReload(page, db);

  // Confirm prediction cards are visible (cold-start satisfied)
  await expect(page.locator('#forecast-cards')).toBeVisible();
  await expect(page.locator('#cold-start-message')).not.toBeVisible();

  // Confirm next-event hero is visible
  await expect(page.locator('#next-event-card .next-event-hero')).toBeVisible();

  // Click "Woke up" quick-log button — adds a wake event for today
  const wakeBtn = page.getByRole('button', { name: /woke up/i });
  await wakeBtn.click();

  // No page reload — forecasts should update reactively
  // Verify the event list got a new entry (confirming addEvent fired)
  const eventsList = page.locator('[data-role="events"]');
  await expect(eventsList).toContainText(/Woke up/i);

  // The forecast cards should still be present (still >= minDays after adding)
  await expect(page.locator('#forecast-cards')).toBeVisible();

  // The next-event card should still be rendered (hero card updates reactively)
  await expect(page.locator('#next-event-card')).toBeVisible();
});

// ── Test 4: Probability-band fallback when ±delta > maxDelta (D3-04) ──────────

test('probability-band view appears when band width > maxDelta (PRED-04 / D3-04)', async ({ page }) => {
  // 7 wake events with 120-minute spread: 06:00, 06:20, 06:40, 07:00, 07:20, 07:40, 08:00
  // P10 ≈ 06:07, P90 ≈ 07:53 → band ≈ 106 min > maxDelta=30 → triggers probability band
  const highVarianceEvents = [
    { id: 'ev-1', type: 'wake', at: '2026-05-20T06:00' },
    { id: 'ev-2', type: 'wake', at: '2026-05-21T06:20' },
    { id: 'ev-3', type: 'wake', at: '2026-05-22T06:40' },
    { id: 'ev-4', type: 'wake', at: '2026-05-23T07:00' },
    { id: 'ev-5', type: 'wake', at: '2026-05-24T07:20' },
    { id: 'ev-6', type: 'wake', at: '2026-05-25T07:40' },
    { id: 'ev-7', type: 'wake', at: '2026-05-26T08:00' },
  ];
  const db = makeDb(highVarianceEvents, { maxDelta: 30 });
  await seedAndReload(page, db);

  // Forecast cards section should be visible
  await expect(page.locator('#forecast-cards')).toBeVisible();

  // The wake card should have the probability-band class
  const wakeCard = page.locator('#forecast-cards .prediction-card.probability-band').first();
  await expect(wakeCard).toBeVisible();

  // The probability list should have items (P(Wake by HH:MM) = X%)
  const probList = wakeCard.locator('.prob-list');
  await expect(probList).toBeVisible();
  const probItems = probList.locator('li');
  await expect(probItems.first()).toBeVisible();

  // Verify probability item text contains "%" (percentage)
  await expect(probItems.first()).toContainText('%');
});

// ── Test 5: Next-event hero card visible and shows priority-correct event ──────

test('next-event hero card is visible and applies cycle-aware priority (D3-10)', async ({ page }) => {
  // Seed: 7 wake events + 1 bedtime as the last event
  // With last event = bedtime, priority order is: wake > napStart > napEnd > bedtime
  // So the hero card should show "Wake" (the next predicted event)
  const wakeEvents = makeEvents(7, 'wake', '06:30', '2026-05-20');
  // Add a bedtime event on 2026-05-27 (after the 7 wake events)
  const bedtimeEvent = { id: 'bed-1', type: 'bedtime', at: '2026-05-27T20:00' };
  const events = [...wakeEvents, bedtimeEvent];
  const db = makeDb(events);
  await seedAndReload(page, db);

  // Hero card should be visible
  const heroCard = page.locator('#next-event-card .next-event-hero');
  await expect(heroCard).toBeVisible();

  // Hero card should show "Wake" (cycle priority: after bedtime → wake is next, D3-10)
  await expect(heroCard.locator('.event-type')).toContainText(/wake/i);

  // Hero card should show a central time
  await expect(heroCard.locator('.time-central')).toBeVisible();
  await expect(heroCard.locator('.time-central')).toContainText('06:30');
});

// ── Test 6: Missed predictions are grayed out and labeled ─────────────────────

test('missed predictions have "missed" class and "Missed by" label (D3-11)', async ({ page }) => {
  // Freeze time at 14:00 so wake predictions at 06:30 are unambiguously in the past.
  // Playwright's page.clock intercepts the browser's Date constructor.
  await page.clock.setFixedTime(new Date('2026-05-27T14:00:00'));

  // Seed 7 wake events at 06:30 — median will be 06:30, which is < 14:00 (missed)
  const events = makeEvents(7, 'wake', '06:30', '2026-05-20');
  // Last event is a bedtime so the priority order makes wake the next event
  events.push({ id: 'bed-1', type: 'bedtime', at: '2026-05-27T13:00' });
  const db = makeDb(events);
  await seedAndReload(page, db);

  // Wake prediction card should have the 'missed' class (D3-11)
  const forecastCards = page.locator('#forecast-cards');
  await expect(forecastCards).toBeVisible();

  const missedCard = forecastCards.locator('.prediction-card.missed').first();
  await expect(missedCard).toBeVisible();

  // The "Missed by Xmin" label should be present
  const missedLabel = missedCard.locator('.missed-label');
  await expect(missedLabel).toBeVisible();
  await expect(missedLabel).toContainText(/Missed by/i);
  await expect(missedLabel).toContainText(/min/i);
});
