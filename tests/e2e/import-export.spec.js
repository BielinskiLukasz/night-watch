// tests/e2e/import-export.spec.js
// Phase 5 — E2E tests for JSON export (Plan 05-03) and CSV/JSON import (Plan 05-04/05).
//
// Pattern: localStorage is cleared and page reloaded in beforeEach for test
// isolation (RESEARCH §Common Pitfalls #8 / Playwright storage isolation).

import { test, expect } from '@playwright/test';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Shared fixture — v2 blob with a few events for export assertions
// ---------------------------------------------------------------------------
const TEST_DB = {
  version: 2,
  settings: {
    subjectName: 'ExportTest',
    cutoverHour: 4,
    groupingMode: 'calendar',
    rejectedDays: [],
    timeFormat: '24h',
    autoOutlier: false,
    maxDelta: 30,
    minDays: 7,
    windowDays: 7,
    statBlend: 'median',
  },
  events: [
    { id: 'e1', type: 'wake',    at: '2026-06-27T07:00' },
    { id: 'e2', type: 'bedtime', at: '2026-06-27T22:00' },
  ],
  activityLog: { '2026-06-27': 3.5 },
};

// ---------------------------------------------------------------------------
// Export JSON — Plan 05-03
// ---------------------------------------------------------------------------

test.describe('Export JSON (Plan 05-03)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate((db) => {
      localStorage.setItem('nightwatch:db', JSON.stringify(db));
    }, TEST_DB);
    await page.reload();
  });

  test('Export JSON button is visible on History screen toolbar (D5-02)', async ({ page }) => {
    await page.click('button[data-tab="history"]');
    await expect(page.locator('#exportJsonBtn')).toBeVisible();
  });

  test('Export JSON button is NOT present on Today screen (D5-03)', async ({ page }) => {
    // Today screen is the default — should not have an export button
    await expect(page.locator('#exportJsonBtn')).not.toBeVisible();
  });

  test('Export JSON downloads a valid nightwatch JSON file (D5-14, D5-15, D5-16)', async ({ page }) => {
    await page.click('button[data-tab="history"]');
    await expect(page.locator('#exportJsonBtn')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportJsonBtn'),
    ]);

    const tmpPath = join(tmpdir(), `nw-test-export-${Date.now()}.json`);
    try {
      await download.saveAs(tmpPath);
      const exported = JSON.parse(readFileSync(tmpPath, 'utf-8'));

      // D5-14: full canonical blob
      expect(exported.version).toBe(2);
      expect(Array.isArray(exported.events)).toBe(true);
      expect(exported.settings !== null && typeof exported.settings === 'object').toBe(true);
      expect(typeof exported.activityLog).toBe('object');
      expect(exported.activityLog).not.toBeNull();

      // D5-16: 2-space indent (pretty-printed)
      const rawContent = readFileSync(tmpPath, 'utf-8');
      expect(rawContent).toContain('  "version"');
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  test('Exported JSON filename is date-stamped nightwatch-YYYY-MM-DD.json (D5-15)', async ({ page }) => {
    await page.click('button[data-tab="history"]');
    await expect(page.locator('#exportJsonBtn')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportJsonBtn'),
    ]);

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^nightwatch-\d{4}-\d{2}-\d{2}\.json$/);
  });

});

// ---------------------------------------------------------------------------
// CSV Import — Plan 05-04
// ---------------------------------------------------------------------------

const SIMPLE_CSV = [
  'Data;Pobudka;Zasniecie',
  '28.06.2026;07:00;22:00',
].join('\n');

const SIMPLE_CSV_WITH_REJECTED = [
  'Data;Pobudka;Zasniecie;Drzemka start;Drzemka stop;Aktywnosc;odrzucone',
  '28.06.2026;07:00;22:00;;;3.5;',
  '29.06.2026;07:30;22:30;14:00;15:00;4.0;1',
].join('\n');

test.describe('CSV Import (Plan 05-04)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Settings modal has Import CSV button (D5-01)', async ({ page }) => {
    await page.click('button[aria-label="Settings"]');
    await expect(page.locator('#importCsvBtn')).toBeVisible();
  });

  test('Import CSV is NOT on History toolbar (D5-03)', async ({ page }) => {
    await page.click('button[data-tab="history"]');
    await expect(page.locator('#importCsvBtn')).not.toBeVisible();
  });

  test('CSV import flow — confirm → History shows imported rows (D5-04)', async ({ page }) => {
    // Open Settings
    await page.click('button[aria-label="Settings"]');
    await expect(page.locator('#importCsvBtn')).toBeVisible();

    // Intercept the confirm dialog (accept it)
    page.once('dialog', dialog => dialog.accept());

    // Simulate file selection — triggers change event → FileReader → confirm → replace()
    await page.setInputFiles('#csvInput', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SIMPLE_CSV),
    });

    // Wait for the import status to update
    await expect(page.locator('#importStatus')).not.toBeEmpty();
    await expect(page.locator('#importStatus')).toContainText('Import complete');

    // Close Settings (Escape)
    await page.keyboard.press('Escape');

    // Navigate to History and verify the imported row is there
    await page.click('button[data-tab="history"]');
    await expect(page.locator('.historyTable tbody tr')).toHaveCount(1);
  });

  test('CSV import — same file can be re-imported (input.value reset)', async ({ page }) => {
    // First import
    await page.click('button[aria-label="Settings"]');
    page.once('dialog', dialog => dialog.accept());
    await page.setInputFiles('#csvInput', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SIMPLE_CSV),
    });
    await expect(page.locator('#importStatus')).toContainText('Import complete');

    // Second import of the same "file" — should work (input.value was reset)
    page.once('dialog', dialog => dialog.accept());
    await page.setInputFiles('#csvInput', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SIMPLE_CSV),
    });
    await expect(page.locator('#importStatus')).toContainText('Import complete');
  });

});
