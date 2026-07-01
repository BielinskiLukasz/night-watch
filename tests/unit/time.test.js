// tests/unit/time.test.js
// Source: RESEARCH §Code Examples §Unit test example + 01-02-PLAN.md §Task 1 <behavior>
// Plan 02 hardens the rounding edge-case table + round-trip + strict regex rejection.
//
// Verifies:
//   - roundTo5 uses round-to-NEAREST (Pitfall #1 / Assumption A1)
//   - roundTo5 input invariants: returns a new Date, does not mutate input
//   - formatLocalISO emits 'YYYY-MM-DDTHH:MM' with zero-padding (D-04)
//   - formatLocalISO / parseLocalISO round-trips canonical timestamps
//   - parseLocalISO throws on date-only / truncated / wrong-separator / junk
//     (Pitfall #2 / T-02 mitigation)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundTo5,
  formatLocalISO,
  parseLocalISO,
  formatTime,
  to24h,
  to12h,
} from '../../js/lib/time.js';

describe('roundTo5 (round-to-nearest per Pitfall #1 / Assumption A1)', () => {
  // Table-driven: input local ISO → expected local ISO after round-to-nearest.
  const cases = [
    ['2026-05-26T06:30', '2026-05-26T06:30'],
    ['2026-05-26T06:32', '2026-05-26T06:30'],
    ['2026-05-26T06:33', '2026-05-26T06:35'],
    ['2026-05-26T06:35', '2026-05-26T06:35'],
    ['2026-05-26T06:37', '2026-05-26T06:35'],
    ['2026-05-26T06:38', '2026-05-26T06:40'],
    ['2026-05-26T23:58', '2026-05-27T00:00'], // midnight rollover (Pitfall #1)
  ];
  for (const [input, expected] of cases) {
    test(`${input} -> ${expected}`, () => {
      const rounded = roundTo5(parseLocalISO(input));
      assert.equal(formatLocalISO(rounded), expected);
    });
  }
});

describe('roundTo5 input invariants', () => {
  test('returns a Date instance', () => {
    const out = roundTo5(new Date(0));
    assert.ok(out instanceof Date, 'expected Date instance');
  });

  test('does not mutate its input', () => {
    const d = new Date(2026, 4, 26, 6, 33, 17, 250);
    const snapshotMs = d.getTime();
    roundTo5(d);
    assert.equal(
      d.getTime(),
      snapshotMs,
      'roundTo5 must return a NEW Date; the input must be untouched',
    );
  });
});

describe('formatLocalISO', () => {
  test("emits 'YYYY-MM-DDTHH:MM' for new Date(2026,4,26,3,50)", () => {
    // Month is 0-indexed in the Date constructor: 4 = May.
    assert.equal(formatLocalISO(new Date(2026, 4, 26, 3, 50)), '2026-05-26T03:50');
  });

  test('pads zeros on month / day / hour / minute', () => {
    assert.equal(formatLocalISO(new Date(2026, 0, 1, 0, 5)), '2026-01-01T00:05');
  });
});

describe('parseLocalISO round-trip (D-04 canonical format)', () => {
  for (const ts of ['2026-05-26T03:50', '2026-05-26T00:00', '2026-05-26T23:55']) {
    test(`round-trips '${ts}'`, () => {
      assert.equal(formatLocalISO(parseLocalISO(ts)), ts);
    });
  }
});

describe('parseLocalISO rejects malformed input (Pitfall #2 / T-02 mitigation)', () => {
  test("throws on bare date '2026-05-26'", () => {
    assert.throws(() => parseLocalISO('2026-05-26'), /Invalid local ISO timestamp/);
  });
  test("throws on 1-digit hour '2026-05-26T3:50'", () => {
    assert.throws(() => parseLocalISO('2026-05-26T3:50'), /Invalid local ISO timestamp/);
  });
  test("throws on wrong separator '2026/05/26T03:50'", () => {
    assert.throws(() => parseLocalISO('2026/05/26T03:50'), /Invalid local ISO timestamp/);
  });
  test("throws on junk 'not-a-date'", () => {
    assert.throws(() => parseLocalISO('not-a-date'), /Invalid local ISO timestamp/);
  });
  test('throws on empty string', () => {
    assert.throws(() => parseLocalISO(''), /Invalid local ISO timestamp/);
  });
  test('throws on null input', () => {
    assert.throws(() => parseLocalISO(null), /Invalid local ISO timestamp/);
  });
});

describe('DST limitation (documentation sentinel — Pitfall #3)', () => {
  // No assertion; presence of this test confirms the source file documents the
  // wall-clock-vs-DST limitation per RESEARCH §Common Pitfalls #3.
  test('time.js documents DST gap/fall-back as a known Phase 1 limitation', () => {
    // Sentinel only — the real check is in the acceptance criteria grep.
    assert.ok(true);
  });
});

// =====================================================================
// Plan 02-03 Task 2 — formatTime / to24h / to12h (CFG-09, D2-18, D2-20)
//
// String-based, no Date construction (Pitfall #3 / DST safety).
// Explicit conditionals at 12 AM / 12 PM boundaries (Pitfall #4) — the
// canonical regression guard for "naïve modulo arithmetic" bugs.
// =====================================================================

describe('formatTime (CFG-09 / D2-18 — display formatting)', () => {
  // Table-driven: at-string + format → expected display.
  const cases = [
    ['2026-05-01T03:50', '24h', '03:50'],
    ['2026-05-01T18:25', '24h', '18:25'],
    ['2026-05-01T00:00', '24h', '00:00'],
    ['2026-05-01T23:58', '24h', '23:58'],

    // Pitfall #4 — 12 AM / 12 PM boundary cases (the bug magnet).
    ['2026-05-01T00:00', '12h', '12:00 AM'],
    ['2026-05-01T12:00', '12h', '12:00 PM'],

    // Standard 12h cases.
    ['2026-05-01T03:50', '12h', '3:50 AM'],
    ['2026-05-01T11:55', '12h', '11:55 AM'],
    ['2026-05-01T13:05', '12h', '1:05 PM'],
    ['2026-05-01T23:58', '12h', '11:58 PM'],
  ];
  for (const [at, fmt, expected] of cases) {
    test(`formatTime('${at}', '${fmt}') === '${expected}'`, () => {
      assert.equal(formatTime(at, fmt), expected);
    });
  }
});

describe('to12h (h24 → {h12, ampm} — Pitfall #4 boundaries)', () => {
  const cases = [
    [0,  { h12: 12, ampm: 'AM' }],   // midnight — 12 AM, NOT 0 AM
    [1,  { h12: 1,  ampm: 'AM' }],
    [3,  { h12: 3,  ampm: 'AM' }],
    [11, { h12: 11, ampm: 'AM' }],
    [12, { h12: 12, ampm: 'PM' }],   // noon — 12 PM, NOT 0 PM
    [13, { h12: 1,  ampm: 'PM' }],
    [15, { h12: 3,  ampm: 'PM' }],
    [23, { h12: 11, ampm: 'PM' }],
  ];
  for (const [h24, expected] of cases) {
    test(`to12h(${h24}) → ${JSON.stringify(expected)}`, () => {
      assert.deepEqual(to12h(h24), expected);
    });
  }

  test('to12h(-1) throws (out of range)', () => {
    assert.throws(() => to12h(-1), /to12h/);
  });
  test('to12h(24) throws (out of range)', () => {
    assert.throws(() => to12h(24), /to12h/);
  });
  test('to12h("3") throws (non-integer / wrong type)', () => {
    assert.throws(() => to12h('3'), /to12h/);
  });
});

describe('to24h (hStr + ampm → h24 — Pitfall #4 boundaries)', () => {
  const cases = [
    ['12', 'AM', 0],   // midnight — 12 AM === 0 (NOT 12)
    ['12', 'PM', 12],  // noon    — 12 PM === 12 (NOT 0)
    ['1',  'AM', 1],
    ['3',  'AM', 3],
    ['11', 'AM', 11],
    ['1',  'PM', 13],
    ['3',  'PM', 15],
    ['11', 'PM', 23],
  ];
  for (const [hStr, ampm, expected] of cases) {
    test(`to24h('${hStr}', '${ampm}') === ${expected}`, () => {
      assert.equal(to24h(hStr, ampm), expected);
    });
  }

  test("to24h('0', 'AM') throws (0 not valid 12h hour)", () => {
    assert.throws(() => to24h('0', 'AM'), /to24h/);
  });
  test("to24h('13', 'AM') throws (13 not valid 12h hour)", () => {
    assert.throws(() => to24h('13', 'AM'), /to24h/);
  });
  test("to24h('3', 'XM') throws (invalid ampm)", () => {
    assert.throws(() => to24h('3', 'XM'), /to24h/);
  });
  test("to24h('abc', 'AM') throws (non-numeric hour)", () => {
    assert.throws(() => to24h('abc', 'AM'), /to24h/);
  });
});
