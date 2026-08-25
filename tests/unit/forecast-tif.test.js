// tests/unit/forecast-tif.test.js
// Unit tests for trimmedMinMax() in js/lib/forecast-tif.js.
//
// Run: node --test tests/unit/forecast-tif.test.js
//
// Covers:
//   1. Basic no-trim (budget=0)
//   2. Standard 10% trim on 10 values
//   3. manualExcluded eats entire budget → no trim
//   4. manualExcluded reduces budget → partial trim
//   5. Empty array → null
//   6. 100% trimPct → all trimmed → null
//   7. manualExcluded > budget → budget clamped to 0
//   8. Asymmetric split: budget=3 (low=1, high=2)
//   9. Symmetric split: budget=4 (low=2, high=2)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trimmedMinMax } from '../../js/lib/forecast-tif.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a sorted array [start, start+step, ...] with `count` elements. */
function range(start, count, step = 10) {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('trimmedMinMax(values, trimPct, manualExcludedCount)', () => {

  // 1. No trim when budget rounds to 0 (N=5, trimPct=10 → floor(0.5)=0)
  it('budget=0 → no values removed', () => {
    const values = [400, 410, 420, 430, 440]; // sorted
    const result = trimmedMinMax(values, 10, 0);
    assert.deepStrictEqual(result, { min: 400, max: 440 });
  });

  // 2. Standard 10% trim on 10 values
  //    N=10, budget=floor(10*10/100)-0=1, low=0, high=1 → slice(0, 9)=[400..480]
  it('10 values, trimPct=10, manualExcluded=0 → removes 1 from top', () => {
    const values = [400, 410, 420, 430, 440, 450, 460, 470, 480, 490]; // sorted
    const result = trimmedMinMax(values, 10, 0);
    assert.deepStrictEqual(result, { min: 400, max: 480 });
  });

  // 3. manualExcluded eats entire budget → no auto-trim applied
  //    N=20, trimPct=10, manualExcluded=2 → budget=max(0, floor(20*10/100)-2)=max(0,0)=0
  it('20 values, trimPct=10, manualExcluded=2 → budget exhausted, no trim', () => {
    const values = range(0, 20); // [0, 10, 20, ..., 190]
    const result = trimmedMinMax(values, 10, 2);
    assert.deepStrictEqual(result, { min: 0, max: 190 });
  });

  // 4. manualExcluded reduces but does not zero out the budget
  //    N=20, trimPct=20, manualExcluded=2 → budget=max(0, floor(20*20/100)-2)=max(0,4-2)=2
  //    low=1, high=1 → slice(1, -1) = [10, ..., 180]
  it('20 values, trimPct=20, manualExcluded=2 → budget=2, removes 1 each end', () => {
    const values = range(0, 20); // [0, 10, ..., 190]
    const result = trimmedMinMax(values, 20, 2);
    assert.deepStrictEqual(result, { min: 10, max: 180 });
  });

  // 5. Empty array → null
  it('empty array → null', () => {
    assert.strictEqual(trimmedMinMax([], 10, 0), null);
  });

  // 6. 100% trimPct on 5 values → budget=5, removes everything → null
  //    low=2, high=3 → slice(2, 2) = [] → null
  it('100% trimPct → all values trimmed → null', () => {
    const values = [400, 410, 420, 430, 440];
    assert.strictEqual(trimmedMinMax(values, 100, 0), null);
  });

  // 7. manualExcluded > computed budget → budget clamped to 0, no auto-trim
  //    N=10, trimPct=10 → raw=1; manualExcluded=5 → budget=max(0,1-5)=0
  it('manualExcluded > raw budget → budget=0, no trim', () => {
    const values = range(100, 10); // [100, 110, ..., 190]
    const result = trimmedMinMax(values, 10, 5);
    assert.deepStrictEqual(result, { min: 100, max: 190 });
  });

  // 8. Asymmetric split: budget=3 → low=floor(3/2)=1, high=ceil(3/2)=2
  //    Need N and trimPct such that floor(N * trimPct / 100) = 3
  //    N=10, trimPct=30 → floor(3)=3; manualExcluded=0
  //    values=[0,10,20,30,40,50,60,70,80,90]
  //    low=1, high=2 → slice(1, 8) = [10,20,30,40,50,60,70]
  it('budget=3 (asymmetric) → removes 1 from bottom, 2 from top', () => {
    const values = range(0, 10); // [0, 10, 20, ..., 90]
    const result = trimmedMinMax(values, 30, 0);
    assert.deepStrictEqual(result, { min: 10, max: 70 });
  });

  // 9. Symmetric split: budget=4 → low=2, high=2
  //    N=10, trimPct=40 → floor(4)=4; manualExcluded=0
  //    values=[0,10,...,90], slice(2, 8) = [20,30,40,50,60,70]
  it('budget=4 (symmetric) → removes 2 from each end', () => {
    const values = range(0, 10); // [0, 10, 20, ..., 90]
    const result = trimmedMinMax(values, 40, 0);
    assert.deepStrictEqual(result, { min: 20, max: 70 });
  });

});
