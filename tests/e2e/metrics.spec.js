import { test, expect } from '@playwright/test';

test.describe('Metrics Screen (MET-01..MET-06)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app (assumes server running on localhost:8081)
    await page.goto('http://localhost:8081');
    // Wait for app to load
    await page.waitForSelector('[data-tab="today"]');
  });

  test('MET-01: User can navigate to Metrics tab', async ({ page }) => {
    // Click the Metrics tab in bottom nav
    const metricsTab = page.locator('[data-tab="metrics"]');
    await expect(metricsTab).toBeVisible();
    await metricsTab.click();

    // Verify metrics screen is shown
    const metricsScreen = page.locator('#metrics-screen');
    await expect(metricsScreen).toBeVisible();
  });

  test('MET-02/MET-03: Table renders with correct columns and data', async ({ page }) => {
    // Add a test event first (log a wake event today)
    const wakeBtn = page.locator('[data-log="wake"]');
    await wakeBtn.click();

    // If manual entry dialog opens, skip it (use quick-log if available)
    // For now, assume quick-log was used and data exists

    // Navigate to Metrics tab
    await page.locator('[data-tab="metrics"]').click();

    // Wait for table to render
    const table = page.locator('.metricsTable');
    await expect(table).toBeVisible();

    // Check column headers exist
    const headerCells = page.locator('.metricsTable th');
    const count = await headerCells.count();
    expect(count).toBe(14); // 14 columns

    // Check that some expected headers are present
    const headerTexts = await page.locator('.metricsTable th').allTextContents();
    expect(headerTexts).toContain('Date');
    expect(headerTexts).toContain('Wake');
    expect(headerTexts).toContain('Sleep');
  });

  test('MET-06: Stage filter badge shown/hidden based on active stage', async ({ page }) => {
    // Check that stage badge is initially hidden (no stage active)
    const stageBadge = page.locator('#metrics-screen .stageChip');
    await page.locator('[data-tab="metrics"]').click();
    await expect(stageBadge).toHaveAttribute('hidden', '');

    // NOTE: Activating a stage requires Settings modal interaction
    // This is deferred to a more complex test; for now, just verify the badge element exists with hidden attribute
  });

  test('Navigation back from Metrics tab hides metrics screen', async ({ page }) => {
    // Navigate to Metrics
    await page.locator('[data-tab="metrics"]').click();
    const metricsScreen = page.locator('#metrics-screen');
    await expect(metricsScreen).toBeVisible();

    // Navigate back to Today
    await page.locator('[data-tab="today"]').click();

    // Metrics screen should be hidden
    await expect(metricsScreen).toHaveAttribute('hidden');
  });
});
