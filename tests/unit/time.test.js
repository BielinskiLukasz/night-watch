// tests/unit/time.test.js
// Source: RESEARCH §Code Examples §Unit test example + 01-PLAN.md §Task 2 <behavior>
// Walking-skeleton coverage. Plan 02 hardens the rounding edge-case table.
//
// Verifies:
//   - roundTo5 returns a Date instance for any valid Date input
//   - formatLocalISO / parseLocalISO round-trips canonical 'YYYY-MM-DDTHH:MM'
//   - parseLocalISO throws on date-only 'YYYY-MM-DD' (Pitfall #2 / T-02 mitigation)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundTo5,
  formatLocalISO,
  parseLocalISO,
} from '../../js/lib/time.js';

describe('roundTo5', () => {
  test('returns a Date instance for any valid Date input', () => {
    const out = roundTo5(new Date(2026, 4, 26, 6, 33));
    assert.ok(out instanceof Date, 'expected Date instance');
    // Plan 01 acceptance: any 5-min boundary is fine (floor or nearest both pass).
    assert.equal(out.getMinutes() % 5, 0, 'expected minutes on a 5-min boundary');
  });
});

describe('formatLocalISO / parseLocalISO', () => {
  test('round-trips "2026-05-26T03:50"', () => {
    const original = '2026-05-26T03:50';
    assert.equal(formatLocalISO(parseLocalISO(original)), original);
  });

  test('throws on date-only "2026-05-26"', () => {
    assert.throws(
      () => parseLocalISO('2026-05-26'),
      /Invalid local ISO timestamp/,
    );
  });

  test('throws on truncated "2026-05-26T3:50"', () => {
    assert.throws(
      () => parseLocalISO('2026-05-26T3:50'),
      /Invalid local ISO timestamp/,
    );
  });
});
