// tests/unit/id.test.js
// Source: 01-02-PLAN.md §Task 3 <behavior> + CONTEXT.md Claude's Discretion
//
// Verifies:
//   - newEventId returns a non-empty string
//   - 100 sequential calls produce 100 distinct ids (uniqueness)
//   - Each id matches RFC4122 shape (8-4-4-4-12 hex)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newEventId } from '../../js/lib/id.js';

const RFC4122 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('newEventId', () => {
  test('returns a non-empty string', () => {
    const id = newEventId();
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0, 'expected non-empty string');
  });

  test('returns a different value on each of 100 sequential calls', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(newEventId());
    assert.equal(seen.size, 100, '100 sequential calls must produce 100 distinct ids');
  });

  test('returns RFC4122-shaped UUID (8-4-4-4-12 hex)', () => {
    const id = newEventId();
    assert.match(id, RFC4122, `expected RFC4122 UUID, got: ${id}`);
  });
});
