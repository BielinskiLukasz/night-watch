// tests/unit/manual-entry-save-more.test.js
// Unit tests for nextInSequence + advanceDateByOneDay helpers (LOG-11 / Plan 09-05).
// These functions are pure and have no DOM dependency — safe to run in node:test.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextInSequence, advanceDateByOneDay } from '../../js/ui/manual-entry.js';

describe('nextInSequence', () => {
  it('wake → napStart', () => {
    assert.strictEqual(nextInSequence('wake'), 'napStart');
  });

  it('napStart → napEnd', () => {
    assert.strictEqual(nextInSequence('napStart'), 'napEnd');
  });

  it('napEnd → bedtime', () => {
    assert.strictEqual(nextInSequence('napEnd'), 'bedtime');
  });

  it('bedtime → wake (wraps around)', () => {
    assert.strictEqual(nextInSequence('bedtime'), 'wake');
  });

  it('unknown type → wake (fallback to first in sequence)', () => {
    // indexOf returns -1 for unknown, (-1 + 1) % 4 = 0, so index 0 = 'wake'
    assert.strictEqual(nextInSequence('unknown'), 'wake');
  });

  it('empty string → wake (fallback to first in sequence)', () => {
    assert.strictEqual(nextInSequence(''), 'wake');
  });
});

describe('advanceDateByOneDay', () => {
  it('advances a regular date by one day', () => {
    assert.strictEqual(advanceDateByOneDay('2026-07-10'), '2026-07-11');
  });

  it('handles year-end rollover (2026-12-31 → 2027-01-01)', () => {
    assert.strictEqual(advanceDateByOneDay('2026-12-31'), '2027-01-01');
  });

  it('handles month-end rollover (2026-01-31 → 2026-02-01)', () => {
    assert.strictEqual(advanceDateByOneDay('2026-01-31'), '2026-02-01');
  });

  it('handles leap year (2024-02-28 → 2024-02-29)', () => {
    assert.strictEqual(advanceDateByOneDay('2024-02-28'), '2024-02-29');
  });
});
