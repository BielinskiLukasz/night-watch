// tests/unit/metrics.test.js
// Unit tests for js/lib/metrics.js — duration helpers.
//
// Run: node --test tests/unit/metrics.test.js
//
// Test groups:
//   1. sleepDuration — midnight-crossing, nulls, event-object input
//   2. napDuration — normal, nulls
//   3. activityBeforeNap — normal, nulls
//   4. activityAfterNap — normal, nulls
//   5. dayLength — same-day, null
//   6. combinedSleepNap — sum, null propagation

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sleepDuration,
  napDuration,
  activityBeforeNap,
  activityAfterNap,
  dayLength,
  combinedSleepNap,
} from '../../js/lib/metrics.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal day record using bare 'HH:MM' strings (synthetic)
// ---------------------------------------------------------------------------
function makeDay(wake, bedtime, napStart, napEnd) {
  return { wake, bedtime, napStart, napEnd };
}

// ---------------------------------------------------------------------------
// 1. sleepDuration
// ---------------------------------------------------------------------------

describe('sleepDuration(day)', () => {
  it('normal night (wake after midnight): wake=07:30, bedtime=21:00 → 630 min', () => {
    // 450 - 1260 = -810 → -810 + 1440 = 630
    assert.strictEqual(sleepDuration(makeDay('07:30', '21:00', null, null)), 630);
  });

  it('midnight-crossing: wake=07:00, bedtime=23:30 → 450 min', () => {
    // 420 - 1410 = -990 → -990 + 1440 = 450
    assert.strictEqual(sleepDuration(makeDay('07:00', '23:30', null, null)), 450);
  });

  it('null wake → null', () => {
    assert.strictEqual(sleepDuration(makeDay(null, '21:00', null, null)), null);
  });

  it('null bedtime → null', () => {
    assert.strictEqual(sleepDuration(makeDay('07:30', null, null, null)), null);
  });

  it('both null → null', () => {
    assert.strictEqual(sleepDuration(makeDay(null, null, null, null)), null);
  });

  it('event-object input: wake={at:"2026-01-01T07:30"}, bedtime={at:"2025-12-31T21:00"} → 630', () => {
    const day = {
      wake:    { at: '2026-01-01T07:30' },
      bedtime: { at: '2025-12-31T21:00' },
      napStart: null,
      napEnd:   null,
    };
    assert.strictEqual(sleepDuration(day), 630);
  });
});

// ---------------------------------------------------------------------------
// 2. napDuration
// ---------------------------------------------------------------------------

describe('napDuration(day)', () => {
  it('normal nap: napStart=13:00, napEnd=14:30 → 90 min', () => {
    assert.strictEqual(napDuration(makeDay(null, null, '13:00', '14:30')), 90);
  });

  it('null napStart → null', () => {
    assert.strictEqual(napDuration(makeDay(null, null, null, '14:30')), null);
  });

  it('null napEnd → null', () => {
    assert.strictEqual(napDuration(makeDay(null, null, '13:00', null)), null);
  });
});

// ---------------------------------------------------------------------------
// 3. activityBeforeNap
// ---------------------------------------------------------------------------

describe('activityBeforeNap(day)', () => {
  it('normal: wake=07:00, napStart=12:30 → 330 min', () => {
    // 750 - 420 = 330
    assert.strictEqual(activityBeforeNap(makeDay('07:00', null, '12:30', null)), 330);
  });

  it('null wake → null', () => {
    assert.strictEqual(activityBeforeNap(makeDay(null, null, '12:30', null)), null);
  });

  it('null napStart → null', () => {
    assert.strictEqual(activityBeforeNap(makeDay('07:00', null, null, null)), null);
  });
});

// ---------------------------------------------------------------------------
// 4. activityAfterNap
// ---------------------------------------------------------------------------

describe('activityAfterNap(day)', () => {
  it('normal: napEnd=14:30, bedtime=20:00 → 330 min', () => {
    // 1200 - 870 = 330
    assert.strictEqual(activityAfterNap(makeDay(null, '20:00', null, '14:30')), 330);
  });

  it('null napEnd → null', () => {
    assert.strictEqual(activityAfterNap(makeDay(null, '20:00', null, null)), null);
  });

  it('null bedtime → null', () => {
    assert.strictEqual(activityAfterNap(makeDay(null, null, null, '14:30')), null);
  });
});

// ---------------------------------------------------------------------------
// 5. dayLength
// ---------------------------------------------------------------------------

describe('dayLength(day)', () => {
  it('same-day span: wake=07:00, bedtime=20:00 → 780 min', () => {
    // 1200 - 420 = 780
    assert.strictEqual(dayLength(makeDay('07:00', '20:00', null, null)), 780);
  });

  it('null wake → null', () => {
    assert.strictEqual(dayLength(makeDay(null, '20:00', null, null)), null);
  });

  it('null bedtime → null', () => {
    assert.strictEqual(dayLength(makeDay('07:00', null, null, null)), null);
  });
});

// ---------------------------------------------------------------------------
// 6. combinedSleepNap
// ---------------------------------------------------------------------------

describe('combinedSleepNap(day)', () => {
  it('both present: wake=07:30, bedtime=21:00, napStart=13:00, napEnd=14:30 → 720', () => {
    // sleepDuration = 630, napDuration = 90 → 720
    assert.strictEqual(
      combinedSleepNap(makeDay('07:30', '21:00', '13:00', '14:30')),
      720,
    );
  });

  it('null nap (napStart=null) → null', () => {
    assert.strictEqual(
      combinedSleepNap(makeDay('07:30', '21:00', null, '14:30')),
      null,
    );
  });

  it('null sleep (wake=null) → null', () => {
    assert.strictEqual(
      combinedSleepNap(makeDay(null, '21:00', '13:00', '14:30')),
      null,
    );
  });
});
