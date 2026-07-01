// tests/e2e/stages.spec.js
// Plan 06-03 / Task 2 — E2E coverage for the stage selector on the Today screen:
//   - Selector hidden when no stages exist (D6-09)
//   - Selector visible with correct options when stages are seeded
//   - Selecting a stage persists activeStageId via settings.update()
//   - Selecting 'All data' resets activeStageId to null
//   - Fallback note shown when active stage has too few valid days (D6-11)
//
// Storage isolation: localStorage cleared in beforeEach (Pitfall #8).
// Seed strategy: inject canonical v2 db blob via page.evaluate() before reload,
// matching the pattern used by forecast.spec.js and reload.spec.js.
//
// Source: 06-03 PLAN.md; D6-09 (selector gate), D6-11 (thin-stage fallback),
//         D6-12 ("All data" option)

import { test, expect } from '@playwright/test';

// ── Seed helper ───────────────────────────────────────────────────────────────

/**
 * Build a canonical v2 db blob with stages-aware settings.
 * Uses the same wire format as other E2E test suites in this project.
 */
function makeDb(overrides = {}) {
  const defaults = {
    version: 2,
    settings: {
      subjectName: 'Baby',
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
    },
    events: [],
    activityLog: {},
  };
  return {
    ...defaults,
    ...overrides,
    settings: { ...defaults.settings, ...(overrides.settings || {}) },
  };
}

/**
 * Seed localStorage with a db blob and reload the page.
 */
async function seedAndReload(page, db) {
  await page.evaluate((data) => {
    localStorage.setItem('nightwatch:db', JSON.stringify(data));
  }, db);
  await page.reload();
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ── Test 1: Selector hidden when no stages exist (D6-09) ─────────────────────

test('stage selector is hidden when no stages exist (D6-09)', async ({ page }) => {
  // Fresh state with no stages (default)
  await expect(page.locator('#stage-selector-container')).not.toBeVisible();
});

// ── Test 2: Selector appears when stages are seeded ───────────────────────────

test('stage selector appears with correct options when stages are seeded', async ({ page }) => {
  const db = makeDb({
    settings: {
      stages: [{ id: '1', name: 'Early Stage', startDate: '2020-01-01', endDate: null }],
      activeStageId: null,
      minDays: 1, // low minDays so thin-stage fallback doesn't mask selector
    },
  });
  await seedAndReload(page, db);

  // Container should be visible
  await expect(page.locator('#stage-selector-container')).toBeVisible();

  // Select element should be visible
  await expect(page.locator('.stage-select')).toBeVisible();

  // "All data" option (value='') should exist (D6-12)
  const allDataOption = page.locator('.stage-select option[value=""]');
  await expect(allDataOption).toHaveCount(1);
  await expect(allDataOption).toContainText('All data');

  // Stage option should exist with correct value and label
  const stageOption = page.locator('.stage-select option[value="1"]');
  await expect(stageOption).toHaveCount(1);
  await expect(stageOption).toContainText('Early Stage');
});

// ── Test 3: Selecting a stage persists activeStageId ─────────────────────────

test('selecting a stage persists activeStageId in localStorage', async ({ page }) => {
  const db = makeDb({
    settings: {
      stages: [{ id: '1', name: 'Early Stage', startDate: '2020-01-01', endDate: null }],
      activeStageId: null,
      minDays: 1,
    },
  });
  await seedAndReload(page, db);

  // Select the stage option
  await page.locator('.stage-select').selectOption('1');

  // Verify activeStageId is persisted in localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.activeStageId).toBe('1');
});

// ── Test 4: Selecting 'All data' resets activeStageId to null ────────────────

test('selecting All data resets activeStageId to null in localStorage', async ({ page }) => {
  // Seed with an active stage already selected
  const db = makeDb({
    settings: {
      stages: [{ id: '1', name: 'Early Stage', startDate: '2020-01-01', endDate: null }],
      activeStageId: '1',
      minDays: 1,
    },
  });
  await seedAndReload(page, db);

  // Select "All data" (value='')
  await page.locator('.stage-select').selectOption('');

  // Verify activeStageId is null in localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.activeStageId).toBeNull();
});

// ── Test 5: Fallback note shown when stage has too few valid days (D6-11) ─────

test('fallback note visible when active stage has too few valid days (D6-11)', async ({ page }) => {
  // Seed: one stage with a date range far in the future so no events fall within it.
  // minDays=7 (default), no events → filtered count = 0 < 7 → thin-stage fallback.
  const db = makeDb({
    settings: {
      stages: [{ id: 'future', name: 'Future Stage', startDate: '2099-01-01', endDate: null }],
      activeStageId: 'future',
      minDays: 7,
    },
    events: [],
  });
  await seedAndReload(page, db);

  // The selector should be visible (stage exists)
  await expect(page.locator('#stage-selector-container')).toBeVisible();

  // The fallback note should be visible and contain the thin-stage message
  const note = page.locator('#stage-fallback-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Not enough data');
});

// =============================================================================
// Plan 06-04 — Settings modal Stages CRUD E2E tests
// =============================================================================
// These tests cover the CRUD UI added to the Settings modal (D6-13):
//   - Add a new stage (with endDate; open-ended; validation errors)
//   - Edit an existing stage
//   - Delete a stage (D6-15)
//   - Deleting the active stage resets activeStageId to null (D6-15)
//   - Overlap warning fires and allows proceeding (D6-06)
//
// Storage isolation: localStorage cleared in beforeEach (inherited from above).
// Settings modal opened via button.settingsTrigger (same pattern as settings-modal.spec.js).
// =============================================================================

// Helper: open the Settings modal
async function openSettingsModal(page) {
  await page.locator('button.settingsTrigger').click();
  await expect(page.locator('dialog#settings')).toBeVisible();
}

// ── CRUD Test 1: add a new stage with endDate ─────────────────────────────────

test('Settings CRUD: add a new stage saves to localStorage and shows in list', async ({ page }) => {
  await openSettingsModal(page);

  // Click Add stage button
  await page.locator('#addStageBtn').click();

  // Inline form should appear
  await expect(page.locator('.stage-inline-form')).toBeVisible();

  // Fill the form
  await page.locator('.stage-name-input').fill('Early Phase');
  await page.locator('.stage-start-input').fill('2025-01-01');
  await page.locator('.stage-end-input').fill('2025-06-30');

  // Save
  await page.locator('.stage-save-btn').click();

  // Inline form should be gone
  await expect(page.locator('.stage-inline-form')).toHaveCount(0);

  // Row should appear in the stages table
  await expect(page.locator('.stages-table')).toBeVisible();
  await expect(page.locator('.stages-table')).toContainText('Early Phase');

  // Verify localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.stages[0].name).toBe('Early Phase');
});

// ── CRUD Test 2: add a stage with open-ended (null) endDate ──────────────────

test('Settings CRUD: add stage with blank endDate shows "ongoing" and null in storage', async ({ page }) => {
  await openSettingsModal(page);

  await page.locator('#addStageBtn').click();
  await page.locator('.stage-name-input').fill('Open Stage');
  await page.locator('.stage-start-input').fill('2025-01-01');
  // Leave endDate blank (open-ended)
  await page.locator('.stage-save-btn').click();

  // End cell should show 'ongoing'
  await expect(page.locator('.stages-table')).toContainText('ongoing');

  // Verify localStorage: endDate must be null
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  const savedStage = stored.settings.stages.find(s => s.name === 'Open Stage');
  expect(savedStage).toBeDefined();
  expect(savedStage.endDate).toBeNull();
});

// ── CRUD Test 3: edit a stage ─────────────────────────────────────────────────

test('Settings CRUD: edit a stage renames it in the list and in localStorage', async ({ page }) => {
  // Seed one stage
  const db = makeDb({
    settings: {
      stages: [{ id: 'stage-1', name: 'Original Name', startDate: '2025-01-01', endDate: null }],
      activeStageId: null,
    },
  });
  await seedAndReload(page, db);
  await openSettingsModal(page);

  // Click Edit button for the first stage row
  await page.locator('.stage-edit-btn').first().click();

  // Inline form should appear pre-filled
  await expect(page.locator('.stage-inline-form')).toBeVisible();
  await expect(page.locator('.stage-name-input')).toHaveValue('Original Name');

  // Clear and fill new name
  await page.locator('.stage-name-input').fill('');
  await page.locator('.stage-name-input').fill('Renamed Phase');

  await page.locator('.stage-save-btn').click();

  // Inline form should be gone; renamed row should appear
  await expect(page.locator('.stage-inline-form')).toHaveCount(0);
  await expect(page.locator('.stages-table')).toContainText('Renamed Phase');
  await expect(page.locator('.stages-table')).not.toContainText('Original Name');

  // Verify localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.stages[0].name).toBe('Renamed Phase');
});

// ── CRUD Test 4: delete a stage ───────────────────────────────────────────────

test('Settings CRUD: delete a stage removes it from the list and from localStorage', async ({ page }) => {
  // Seed one stage
  const db = makeDb({
    settings: {
      stages: [{ id: 'stage-1', name: 'To Delete', startDate: '2025-01-01', endDate: null }],
      activeStageId: null,
    },
  });
  await seedAndReload(page, db);
  await openSettingsModal(page);

  // Accept the confirmation dialog
  page.once('dialog', d => d.accept());
  await page.locator('.stage-del-btn').first().click();

  // No stage rows should remain; empty message should appear
  await expect(page.locator('.stage-row')).toHaveCount(0);
  await expect(page.locator('.stages-empty')).toBeVisible();

  // Verify localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.stages.length).toBe(0);
});

// ── CRUD Test 5: deleting active stage resets activeStageId to null ───────────

test('Settings CRUD: deleting the active stage resets activeStageId to null (D6-15)', async ({ page }) => {
  // Seed one stage that is active
  const db = makeDb({
    settings: {
      stages: [{ id: 'active-stage', name: 'Active Stage', startDate: '2025-01-01', endDate: null }],
      activeStageId: 'active-stage',
    },
  });
  await seedAndReload(page, db);
  await openSettingsModal(page);

  // Accept the confirmation dialog
  page.once('dialog', d => d.accept());
  await page.locator('.stage-del-btn').first().click();

  // Verify activeStageId is null in localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.activeStageId).toBeNull();
});

// ── CRUD Test 6: validation — empty name shows error ─────────────────────────

test('Settings CRUD: saving with empty name shows validation error', async ({ page }) => {
  await openSettingsModal(page);

  await page.locator('#addStageBtn').click();

  // Fill startDate but leave name blank
  await page.locator('.stage-start-input').fill('2025-01-01');
  await page.locator('.stage-save-btn').click();

  // Error element should be visible and non-empty
  const errEl = page.locator('.stage-form-error');
  await expect(errEl).toBeVisible();
  const errText = await errEl.textContent();
  expect(errText.trim().length).toBeGreaterThan(0);

  // Inline form should still be present (not saved)
  await expect(page.locator('.stage-inline-form')).toBeVisible();
});

// ── CRUD Test 7: overlap warning fires and allows proceeding (D6-06) ──────────

test('Settings CRUD: overlap warning fires but allows saving when confirmed (D6-06)', async ({ page }) => {
  // Seed one stage 2025-01-01 to 2025-06-30
  const db = makeDb({
    settings: {
      stages: [{ id: 'stage-1', name: 'First Stage', startDate: '2025-01-01', endDate: '2025-06-30' }],
      activeStageId: null,
    },
  });
  await seedAndReload(page, db);
  await openSettingsModal(page);

  // Click Add stage
  await page.locator('#addStageBtn').click();

  // Fill overlapping range 2025-03-01 to 2025-12-31
  await page.locator('.stage-name-input').fill('Overlapping Stage');
  await page.locator('.stage-start-input').fill('2025-03-01');
  await page.locator('.stage-end-input').fill('2025-12-31');

  // Accept the overlap confirmation dialog
  page.once('dialog', d => d.accept());
  await page.locator('.stage-save-btn').click();

  // Both stages should now be in localStorage
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('nightwatch:db');
    if (!raw) return null;
    return JSON.parse(raw);
  });
  expect(stored).not.toBeNull();
  expect(stored.settings.stages.length).toBe(2);
});
