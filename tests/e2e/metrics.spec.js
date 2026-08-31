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

    // Check column headers exist: 18 base columns + 12 TIF inline columns = 30 total.
    // TIF columns are hidden (hidden attribute) when TIF is not active but still in DOM.
    const headerCells = page.locator('.metricsTable th');
    const count = await headerCells.count();
    expect(count).toBe(30); // 18 base + 12 TIF inline columns (Phase 14 layout)

    // Check that some expected headers are present
    const headerTexts = await page.locator('.metricsTable th').allTextContents();
    expect(headerTexts).toContain('Date');
    expect(headerTexts).toContain('Wake');
    expect(headerTexts).toContain('Sleep');
  });

  test('MET-06: Stage filter badge shown/hidden based on active stage', async ({ page }) => {
    // ========================================================================
    // PART 1: Set up test data
    // ========================================================================
    // Seed a database with one sleep event so we have metrics to display.
    // Create a stage that covers the logged event's date.

    // Get today's date
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Seed data: one logged event (wake) and one stage
    const seedDb = {
      version: 2,
      settings: {
        subjectName: 'Test',
        cutoverHour: 4,
        timeFormat: '24h',
        maxDelta: 30,
        minDays: 1,
        windowDays: 7,
        statBlend: 'median',
        autoOutlier: false,
        groupingMode: 'calendar',
        rejectedDays: [],
        stages: [
          {
            id: 'work-week',
            name: 'Work Week',
            startDate: '2024-01-01',
            endDate: null
          }
        ],
        activeStageId: null,
      },
      events: [
        {
          type: 'wake',
          at: todayISO + 'T08:00'
        },
        {
          type: 'bedtime',
          at: todayISO + 'T22:00'
        }
      ],
      activityLog: {},
    };

    // Inject the seed data and reload
    await page.evaluate((data) => {
      localStorage.setItem('nightwatch:db', JSON.stringify(data));
    }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');

    // ========================================================================
    // PART 2: Verify stage badge is initially hidden on Metrics screen
    // ========================================================================
    await page.locator('[data-tab="metrics"]').click();
    const stageBadge = page.locator('#metrics-screen .stageChip');
    await expect(stageBadge).toHaveAttribute('hidden');

    // ========================================================================
    // PART 3: Select the stage from the stage selector on Today screen
    // ========================================================================
    // Navigate back to Today screen
    await page.locator('[data-tab="today"]').click();

    // Find and click the stage selector dropdown
    const stageSelect = page.locator('.stage-select');
    await expect(stageSelect).toBeVisible();

    // Select the "Work Week" stage (id='work-week')
    await stageSelect.selectOption('work-week');

    // Verify the selection was saved to localStorage
    const storedAfterSelect = await page.evaluate(() => {
      const raw = localStorage.getItem('nightwatch:db');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedAfterSelect.settings.activeStageId).toBe('work-week');

    // ========================================================================
    // PART 4: Navigate to Metrics screen and verify badge is visible
    // ========================================================================
    await page.locator('[data-tab="metrics"]').click();

    // Badge should now be visible and show "Viewing: Work Week"
    await expect(stageBadge).not.toHaveAttribute('hidden');
    const badgeText = await stageBadge.textContent();
    expect(badgeText).toContain('Viewing: Work Week');

    // ========================================================================
    // PART 5: Select "All" and verify badge is hidden again
    // ========================================================================
    // Go back to Today screen
    await page.locator('[data-tab="today"]').click();

    // Select "All data" (empty value)
    await stageSelect.selectOption('');

    // Verify it was saved
    const storedAfterDeselect = await page.evaluate(() => {
      const raw = localStorage.getItem('nightwatch:db');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedAfterDeselect.settings.activeStageId).toBeNull();

    // Navigate back to Metrics screen
    await page.locator('[data-tab="metrics"]').click();

    // Badge should now be hidden again
    await expect(stageBadge).toHaveAttribute('hidden');
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

test.describe('Metrics Screen: Rolling Window Aggregates (MET-09, MET-10)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForSelector('[data-tab="today"]');
  });

  test('MET-09: 7-day rolling section appears above per-day rows', async ({ page }) => {
    // Seed 8 days of wake+bedtime pairs so the 7-day window is fully satisfied.
    const events = [];
    for (let i = 0; i < 8; i++) {
      const dayNum = String(i + 1).padStart(2, '0');
      const date = '2025-01-' + dayNum;
      events.push({ type: 'wake',    at: date + 'T08:00' });
      events.push({ type: 'bedtime', at: date + 'T22:00' });
    }

    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4,
        timeFormat: '24h',
        maxDelta: 30,
        minDays: 1,
        windowDays: 7,
        statBlend: 'median',
        autoOutlier: false,
        groupingMode: 'calendar',
        rejectedDays: [],
        stages: [],
        activeStageId: null,
        forecastAlgorithm: 'classic',
      },
      events,
      activityLog: {},
    };

    await page.evaluate((data) => {
      localStorage.setItem('nightwatch:db', JSON.stringify(data));
    }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');

    // Navigate to Metrics tab
    await page.locator('[data-tab="metrics"]').click();
    await page.waitForSelector('.metricsTable');

    // 7-day rolling tbody must be visible
    const firstRollingTbody = page.locator('.metrics-rolling-tbody').first();
    await expect(firstRollingTbody).toBeVisible();

    // Section header must contain '7-day rolling'
    const sectionHeader = firstRollingTbody.locator('.metrics-section-header');
    await expect(sectionHeader).toContainText('7-day rolling', { ignoreCase: true });

    // Three aggregate rows (Min, Average, Max) must be present
    const summaryRows = firstRollingTbody.locator('.metrics-summary-row');
    await expect(summaryRows).toHaveCount(3);
  });
});
