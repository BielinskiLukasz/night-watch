// tests/unit/stages.test.js
// TDD RED → GREEN tests for js/lib/stages.js
//
// Phase 6, Plan 02 — all assertions must FAIL before implementation exists
// (MODULE_NOT_FOUND on the import satisfies RED).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { filterDayRecordsByStage } from '../../js/lib/stages.js';

describe('filterDayRecordsByStage', () => {
  const allRecords = [
    { date: '2025-01-15' }, // before stage
    { date: '2025-03-01' }, // start boundary — included
    { date: '2025-05-15' }, // inside — included
    { date: '2025-06-30' }, // end boundary — included
    { date: '2025-07-01' }, // after stage — excluded
  ];
  const stages = [{ id: '1', name: 'Stage 1', startDate: '2025-03-01', endDate: '2025-06-30' }];

  test('returns records unchanged when activeStageId is null (no filter)', () => {
    const result = filterDayRecordsByStage(allRecords, stages, null);
    assert.strictEqual(result, allRecords); // same reference
  });

  test('returns records unchanged when stages array is empty and activeStageId is null', () => {
    const result = filterDayRecordsByStage(allRecords, [], null);
    assert.strictEqual(result, allRecords);
  });

  test('returns records unchanged when activeStageId does not match any stage (D6-10 fallback)', () => {
    const result = filterDayRecordsByStage(allRecords, stages, 'nonexistent-id');
    assert.strictEqual(result, allRecords);
  });

  test('filters records to those within stage date range (both boundaries inclusive)', () => {
    const result = filterDayRecordsByStage(allRecords, stages, '1');
    assert.deepStrictEqual(result, [
      { date: '2025-03-01' },
      { date: '2025-05-15' },
      { date: '2025-06-30' },
    ]);
  });

  test('includes all records from startDate onwards when endDate is null (D6-05)', () => {
    const openStages = [{ id: '2', name: 'Open', startDate: '2025-03-01', endDate: null }];
    const result = filterDayRecordsByStage(allRecords, openStages, '2');
    assert.deepStrictEqual(result, [
      { date: '2025-03-01' },
      { date: '2025-05-15' },
      { date: '2025-06-30' },
      { date: '2025-07-01' },
    ]);
  });

  test('does not mutate the input array', () => {
    const copy = [...allRecords];
    filterDayRecordsByStage(allRecords, stages, '1');
    assert.deepStrictEqual(allRecords, copy);
  });

  test('returns empty array when no records fall in stage range', () => {
    const futureStages = [{ id: '3', name: 'Future', startDate: '2030-01-01', endDate: '2030-12-31' }];
    const result = filterDayRecordsByStage(allRecords, futureStages, '3');
    assert.deepStrictEqual(result, []);
  });
});
