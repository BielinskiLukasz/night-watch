// tests/e2e/next-reachable-event.spec.js
// Phase 21 Plan 03 (D-14/PRED-24/UI-13, ROADMAP Phase 21 Success Criterion 7):
// Dedicated E2E coverage matrix for every one of the 5 nextReachableEvent()
// paths (js/lib/forecast-utils.js, Plan 21-01) plus the Later-Today
// collapse/expand and TIF auto-expand interactions (Plan 21-02).
//
// Tests:
//   1. bedtime -> wake (single hero, Later Today: napStart/napEnd/bedtime)
//   2. napStart -> napEnd (single hero, Later Today: wake/napStart/bedtime)
//   3. napEnd -> bedtime (single hero, Later Today: wake/napStart/napEnd)
//   4. wake (window closed) -> bedtimeAfterWake only, napStart fully absent
//
// (Task 2 of this plan adds Tests 5-6: the dual-hero ambiguous path and the
// TIF auto-expand-in-Later-Today interaction, in the same file.)
//
// Every one of Tests 1-4 additionally asserts .later-today-section starts
// collapsed (no `open` attribute) immediately after seedAndReload, before any
// interaction — proving D-11 holds across every reachable-event state, not
// just one.

import { test, expect } from '@playwright/test';

// ── Seed helpers (mirrors tests/e2e/forecast.spec.js / tests/e2e/tif.spec.js) ──

/**
 * Build a canonical v2 db blob with optional settings overrides. Superset of
 * forecast.spec.js's and tif.spec.js's makeDb fields so this file can seed
 * both classic and TIF fixtures.
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
 * Shift a 'YYYY-MM-DD' date string by `days` (positive or negative).
 * Local-calendar arithmetic only — used to lay out consecutive fixture
 * sub-windows (nap days / no-nap days / today) without overlapping dates.
 */
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (x) => String(x).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

// ── Fixture builders — one per nextReachableEvent() path under test ────────────

/**
 * Path 1: bedtime -> wake. 32-day baseline, all 4 event types every day.
 * Last logged event overall is day32's bedtime (wake < napStart < napEnd <
 * bedtime within each day, by timestamp).
 */
function makeBedtimeToWakeDb(settingsOverrides = {}) {
  const BASE = '2026-05-01';
  const N = 32;
  const events = [
    ...makeEvents(N, 'wake', '06:30', BASE, 'w'),
    ...makeEvents(N, 'napStart', '13:00', BASE, 'ns'),
    ...makeEvents(N, 'napEnd', '14:30', BASE, 'ne'),
    ...makeEvents(N, 'bedtime', '21:00', BASE, 'b'),
  ];
  return makeDb(events, settingsOverrides);
}

/**
 * Path 2: napStart -> napEnd. 7 full days (wake/napStart/napEnd/bedtime) plus
 * a final day truncated right after napStart (no napEnd/bedtime logged yet).
 * Last logged event overall is the final day's napStart.
 */
function makeNapStartToNapEndDb(settingsOverrides = {}) {
  const BASE = '2026-06-01';
  const fullDays = [
    ...makeEvents(7, 'wake', '06:30', BASE, 'w'),
    ...makeEvents(7, 'napStart', '13:00', BASE, 'ns'),
    ...makeEvents(7, 'napEnd', '14:30', BASE, 'ne'),
    ...makeEvents(7, 'bedtime', '21:00', BASE, 'b'),
  ];
  const todayDate = addDays(BASE, 7);
  const todayPartial = [
    { id: 'today-wake', type: 'wake', at: `${todayDate}T06:30` },
    { id: 'today-napstart', type: 'napStart', at: `${todayDate}T13:00` },
  ];
  return makeDb([...fullDays, ...todayPartial], settingsOverrides);
}

/**
 * Path 3: napEnd -> bedtime. 7 full days plus a final day truncated right
 * after napEnd (no bedtime logged yet). Last logged event overall is the
 * final day's napEnd.
 */
function makeNapEndToBedtimeDb(settingsOverrides = {}) {
  const BASE = '2026-06-01';
  const fullDays = [
    ...makeEvents(7, 'wake', '06:30', BASE, 'w'),
    ...makeEvents(7, 'napStart', '13:00', BASE, 'ns'),
    ...makeEvents(7, 'napEnd', '14:30', BASE, 'ne'),
    ...makeEvents(7, 'bedtime', '21:00', BASE, 'b'),
  ];
  const todayDate = addDays(BASE, 7);
  const todayPartial = [
    { id: 'today-wake', type: 'wake', at: `${todayDate}T06:30` },
    { id: 'today-napstart', type: 'napStart', at: `${todayDate}T13:00` },
    { id: 'today-napend', type: 'napEnd', at: `${todayDate}T14:30` },
  ];
  return makeDb([...fullDays, ...todayPartial], settingsOverrides);
}

/**
 * Path 4: wake (nap window closed) -> bedtimeAfterWake only, napStart fully
 * absent. 7 full days with napStart flat at '08:00' (so its P90 is also
 * '08:00') plus a final day truncated to only a wake event. Mirrors the
 * fixture Plan 21-01 proved this exact capability with (tests/e2e/forecast.spec.js
 * "napStart card is absent once the nap window has closed"), now folded into
 * this file's permanent 5-path coverage matrix.
 */
function makeWindowClosedDb(settingsOverrides = {}) {
  const BASE = '2026-06-01';
  const fullDayEvents = [
    ...makeEvents(7, 'wake', '06:30', BASE, 'w'),
    ...makeEvents(7, 'napStart', '08:00', BASE, 'ns'),
    ...makeEvents(7, 'napEnd', '09:00', BASE, 'ne'),
    ...makeEvents(7, 'bedtime', '21:00', BASE, 'b'),
  ];
  const todayDate = addDays(BASE, 7);
  const todayOnlyWake = [
    { id: 'today-wake', type: 'wake', at: `${todayDate}T06:30` },
  ];
  return makeDb([...fullDayEvents, ...todayOnlyWake], settingsOverrides);
}

// ── Suite setup ───────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ── Test 1: bedtime -> wake ─────────────────────────────────────────────────

test('bedtime -> wake: single hero, Later Today has napStart/napEnd/bedtime', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-02T09:00:00'));

  const db = makeBedtimeToWakeDb();
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();

  // Single hero, no dual-hero wrapper.
  await expect(page.locator('#next-event-card .hero-row')).toHaveCount(0);
  const heroCard = page.locator('#next-event-card .next-event-hero');
  await expect(heroCard).toHaveCount(1);
  await expect(heroCard).toHaveAttribute('data-event-type', 'wake');

  // D-11: Later Today starts collapsed, before any interaction.
  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();
  expect(await laterToday.getAttribute('open')).toBeNull();

  await laterToday.locator('summary').click();
  await expect(laterToday.locator('.prediction-card, .tif-card')).toHaveCount(3);
  await expect(laterToday.locator('[data-event-type="napStart"]')).toHaveCount(1);
  await expect(laterToday.locator('[data-event-type="napEnd"]')).toHaveCount(1);
  await expect(laterToday.locator('[data-event-type="bedtime"]')).toHaveCount(1);
});

// ── Test 2: napStart -> napEnd ───────────────────────────────────────────────

test('napStart -> napEnd: single hero, Later Today has wake/napStart/bedtime', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-08T13:30:00'));

  const db = makeNapStartToNapEndDb();
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();

  await expect(page.locator('#next-event-card .hero-row')).toHaveCount(0);
  const heroCard = page.locator('#next-event-card .next-event-hero');
  await expect(heroCard).toHaveCount(1);
  await expect(heroCard).toHaveAttribute('data-event-type', 'napEnd');

  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();
  expect(await laterToday.getAttribute('open')).toBeNull();

  await laterToday.locator('summary').click();
  await expect(laterToday.locator('.prediction-card, .tif-card')).toHaveCount(3);
  await expect(laterToday.locator('[data-event-type="wake"]')).toHaveCount(1);
  await expect(laterToday.locator('[data-event-type="napStart"]')).toHaveCount(1);
  await expect(laterToday.locator('[data-event-type="bedtime"]')).toHaveCount(1);
});

// ── Test 3: napEnd -> bedtime ────────────────────────────────────────────────

test('napEnd -> bedtime: single hero, Later Today has wake/napStart/napEnd', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-08T15:00:00'));

  const db = makeNapEndToBedtimeDb();
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();

  await expect(page.locator('#next-event-card .hero-row')).toHaveCount(0);
  const heroCard = page.locator('#next-event-card .next-event-hero');
  await expect(heroCard).toHaveCount(1);
  // bedtimeAfterNap normalizes to the 'bedtime' loggable event type (D-07).
  await expect(heroCard).toHaveAttribute('data-event-type', 'bedtime');

  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();
  expect(await laterToday.getAttribute('open')).toBeNull();

  await laterToday.locator('summary').click();
  await expect(laterToday.locator('.prediction-card, .tif-card')).toHaveCount(3);
  await expect(laterToday.locator('[data-event-type="wake"]')).toHaveCount(1);
  await expect(laterToday.locator('[data-event-type="napStart"]')).toHaveCount(1);
  await expect(laterToday.locator('[data-event-type="napEnd"]')).toHaveCount(1);
});

// ── Test 4: wake (window closed) -> bedtimeAfterWake only, napStart absent ───

test('wake (window closed) -> bedtimeAfterWake only, napStart fully absent from the page', async ({ page }) => {
  // Past both napStart's P90 ('08:00') and the default eveningHour (18) —
  // either signal alone suppresses napStart per D-05.
  await page.clock.setFixedTime(new Date('2026-06-08T20:00:00'));

  const db = makeWindowClosedDb({ minDays: 7 });
  await seedAndReload(page, db);

  await expect(page.locator('#forecast-cards')).toBeVisible();

  await expect(page.locator('#next-event-card .hero-row')).toHaveCount(0);
  const heroCard = page.locator('#next-event-card .next-event-hero');
  await expect(heroCard).toHaveCount(1);
  // bedtimeAfterWake normalizes to the 'bedtime' loggable event type (D-07).
  await expect(heroCard).toHaveAttribute('data-event-type', 'bedtime');

  const laterToday = page.locator('.later-today-section');
  await expect(laterToday).toBeVisible();
  expect(await laterToday.getAttribute('open')).toBeNull();

  // napStart is absent BEFORE opening Later Today...
  await expect(page.locator('[data-event-type="napStart"]')).toHaveCount(0);

  // ...and remains absent once Later Today is opened (not merely hidden by
  // the <details> collapse — genuinely never appended to the DOM).
  await laterToday.locator('summary').click();
  await expect(page.locator('[data-event-type="napStart"]')).toHaveCount(0);
  expect(await page.locator('[data-event-type="wake"]').count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator('[data-event-type="napEnd"]').count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator('[data-event-type="bedtime"]').count()).toBeGreaterThanOrEqual(1);
});
