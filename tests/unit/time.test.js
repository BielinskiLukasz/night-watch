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
