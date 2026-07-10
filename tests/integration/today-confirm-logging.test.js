// tests/integration/today-confirm-logging.test.js
// Integration tests for the confirmBeforeLogging data-model round-trip.
//
// These tests exercise DEFAULT_SETTINGS and validateSettings at the data-layer
// only. The full confirm-before-logging UI flow (quick-log button →
// openManualEntry pre-fill) is covered by E2E tests in Plan 09-06.
//
// Why data-layer only: mountTodayScreen requires a full DOM which is not
// available in node:test. The data-model contract (correct default, correct
// validation) is sufficient to guarantee correctness at this layer; E2E tests
// provide the behavioral coverage.
//
// CFG-10 / LOG-10 / D9-13 / D9-15

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';
import { validateSettings } from '../../js/lib/settings-validate.js';

// ---------------------------------------------------------------------------
// DEFAULT_SETTINGS.confirmBeforeLogging — default value
// ---------------------------------------------------------------------------

describe('confirmBeforeLogging — DEFAULT_SETTINGS', () => {
  it('DEFAULT_SETTINGS.confirmBeforeLogging is false (D9-13)', () => {
    assert.strictEqual(DEFAULT_SETTINGS.confirmBeforeLogging, false);
  });
});

// ---------------------------------------------------------------------------
// validateSettings round-trip — confirmBeforeLogging (CFG-10)
// ---------------------------------------------------------------------------

describe('confirmBeforeLogging — validateSettings round-trip', () => {
  it('accepts true → normalized.confirmBeforeLogging === true', () => {
    const result = validateSettings(
      { ...DEFAULT_SETTINGS, confirmBeforeLogging: true },
      { mode: 'save' },
    );
    assert.equal(result.ok, true, `Expected ok: true; errors: ${JSON.stringify(result.errors)}`);
    assert.strictEqual(result.normalized.confirmBeforeLogging, true);
  });

  it('accepts false → normalized.confirmBeforeLogging === false', () => {
    const result = validateSettings(
      { ...DEFAULT_SETTINGS, confirmBeforeLogging: false },
      { mode: 'save' },
    );
    assert.equal(result.ok, true, `Expected ok: true; errors: ${JSON.stringify(result.errors)}`);
    assert.strictEqual(result.normalized.confirmBeforeLogging, false);
  });

  it('rejects string \'yes\' in mode:\'save\' → ok: false', () => {
    const result = validateSettings(
      { ...DEFAULT_SETTINGS, confirmBeforeLogging: 'yes' },
      { mode: 'save' },
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.field === 'confirmBeforeLogging'),
      `Expected error for confirmBeforeLogging; got: ${JSON.stringify(result.errors)}`,
    );
  });

  // Full confirm-before-logging UI flow covered by E2E tests in Plan 09-06
});
