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
    // Seed a minimal database so the metrics table renders on a clean storage context.
    // Clicking [data-log="wake"] opens a dialog and does not save an event — so this test
    // used to rely on leftover localStorage from a previous session, which fails in CI.
    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1,
        windowDays: 7, statBlend: 'median', autoOutlier: false,
        groupingMode: 'calendar', rejectedDays: [], stages: [],
        activeStageId: null, forecastAlgorithm: 'classic',
      },
      events: [
        { id: 'met02-wake-1',    type: 'wake',    at: '2025-06-01T08:00' },
        { id: 'met02-bedtime-1', type: 'bedtime', at: '2025-06-01T22:00' },
      ],
      activityLog: {},
    };
    await page.evaluate((data) => {
      localStorage.setItem('nightwatch:db', JSON.stringify(data));
    }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');

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
        { id: 'test-wake-1',    type: 'wake',    at: todayISO + 'T08:00' },
        { id: 'test-bedtime-1', type: 'bedtime', at: todayISO + 'T22:00' },
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
      events.push({ id: 'test-wake-'    + dayNum, type: 'wake',    at: date + 'T08:00' });
      events.push({ id: 'test-bedtime-' + dayNum, type: 'bedtime', at: date + 'T22:00' });
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

  test('MET-10/boundary: cold-start 7-day (6 non-rejected days available)', async ({ page }) => {
    // Seed 6 non-rejected days — 7-day window partially satisfied, 14-day not
    const events = [];
    for (let i = 0; i < 6; i++) {
      const dayNum = String(i + 1).padStart(2, '0');
      const date = '2025-02-' + dayNum;
      events.push({ id: 'test-wake-'    + dayNum, type: 'wake',    at: date + 'T08:00' });
      events.push({ id: 'test-bedtime-' + dayNum, type: 'bedtime', at: date + 'T22:00' });
    }

    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1, windowDays: 7,
        statBlend: 'median', autoOutlier: false, groupingMode: 'calendar',
        rejectedDays: [], stages: [], activeStageId: null, forecastAlgorithm: 'classic',
      },
      events,
      activityLog: {},
    };

    await page.evaluate((data) => { localStorage.setItem('nightwatch:db', JSON.stringify(data)); }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');
    await page.locator('[data-tab="metrics"]').click();
    await page.waitForSelector('.metricsTable');

    // 7-day section header: cold-start note '(6 days available)'
    const sevenDayHeader = page.locator('.metrics-rolling-tbody').nth(0).locator('.metrics-section-header');
    const sevenHeaderText = await sevenDayHeader.textContent();
    expect(sevenHeaderText).toContain('6 days available');

    // 7-day section: three aggregate rows always rendered (D-10)
    const sevenRows = page.locator('.metrics-rolling-tbody').nth(0).locator('.metrics-summary-row');
    await expect(sevenRows).toHaveCount(3);

    // 14-day section: also shows cold-start note '(6 days available)'
    const fourteenDayHeader = page.locator('.metrics-rolling-tbody').nth(1).locator('.metrics-section-header');
    const fourteenHeaderText = await fourteenDayHeader.textContent();
    expect(fourteenHeaderText).toContain('6 days available');
  });

  test('MET-10/boundary: cold-start 14-day only (13 non-rejected days available)', async ({ page }) => {
    // Seed 13 non-rejected days — 7-day fully satisfied, 14-day partially
    const events = [];
    for (let i = 0; i < 13; i++) {
      const dayNum = String(i + 1).padStart(2, '0');
      const date = '2025-03-' + dayNum;
      events.push({ id: 'test-wake-'    + dayNum, type: 'wake',    at: date + 'T08:00' });
      events.push({ id: 'test-bedtime-' + dayNum, type: 'bedtime', at: date + 'T22:00' });
    }

    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1, windowDays: 7,
        statBlend: 'median', autoOutlier: false, groupingMode: 'calendar',
        rejectedDays: [], stages: [], activeStageId: null, forecastAlgorithm: 'classic',
      },
      events,
      activityLog: {},
    };

    await page.evaluate((data) => { localStorage.setItem('nightwatch:db', JSON.stringify(data)); }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');
    await page.locator('[data-tab="metrics"]').click();
    await page.waitForSelector('.metricsTable');

    // 7-day section header: no cold-start note (7 days fully satisfied)
    const sevenDayHeader = page.locator('.metrics-rolling-tbody').nth(0).locator('.metrics-section-header');
    const sevenHeaderText = await sevenDayHeader.textContent();
    expect(sevenHeaderText).not.toContain('days available');
    expect(sevenHeaderText.toLowerCase()).toContain('7-day rolling');

    // 14-day section header: cold-start note '(13 days available)'
    const fourteenDayHeader = page.locator('.metrics-rolling-tbody').nth(1).locator('.metrics-section-header');
    const fourteenHeaderText = await fourteenDayHeader.textContent();
    expect(fourteenHeaderText).toContain('13 days available');
  });

  test('MET-10/boundary: both sections full (15 non-rejected days)', async ({ page }) => {
    // Seed 15 days — both 7-day and 14-day windows fully satisfied
    const events = [];
    for (let i = 0; i < 15; i++) {
      const dayNum = String(i + 1).padStart(2, '0');
      const date = '2025-04-' + dayNum;
      events.push({ id: 'test-wake-'    + dayNum, type: 'wake',    at: date + 'T08:00' });
      events.push({ id: 'test-bedtime-' + dayNum, type: 'bedtime', at: date + 'T22:00' });
    }

    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1, windowDays: 7,
        statBlend: 'median', autoOutlier: false, groupingMode: 'calendar',
        rejectedDays: [], stages: [], activeStageId: null, forecastAlgorithm: 'classic',
      },
      events,
      activityLog: {},
    };

    await page.evaluate((data) => { localStorage.setItem('nightwatch:db', JSON.stringify(data)); }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');
    await page.locator('[data-tab="metrics"]').click();
    await page.waitForSelector('.metricsTable');

    // Neither section header should contain 'days available'
    const sevenDayHeader = page.locator('.metrics-rolling-tbody').nth(0).locator('.metrics-section-header');
    const fourteenDayHeader = page.locator('.metrics-rolling-tbody').nth(1).locator('.metrics-section-header');

    const sevenText = await sevenDayHeader.textContent();
    const fourteenText = await fourteenDayHeader.textContent();
    expect(sevenText).not.toContain('days available');
    expect(fourteenText).not.toContain('days available');

    // Both sections must have 3 aggregate rows
    await expect(page.locator('.metrics-rolling-tbody').nth(0).locator('.metrics-summary-row')).toHaveCount(3);
    await expect(page.locator('.metrics-rolling-tbody').nth(1).locator('.metrics-summary-row')).toHaveCount(3);
  });

  test('MET-10/boundary: zero days — metrics table not rendered, no JS errors', async ({ page }) => {
    // Seed empty events — metrics screen should show empty state
    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1, windowDays: 7,
        statBlend: 'median', autoOutlier: false, groupingMode: 'calendar',
        rejectedDays: [], stages: [], activeStageId: null, forecastAlgorithm: 'classic',
      },
      events: [],
      activityLog: {},
    };

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.evaluate((data) => { localStorage.setItem('nightwatch:db', JSON.stringify(data)); }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');
    await page.locator('[data-tab="metrics"]').click();
    // No waitForTimeout — toBeVisible() retries until its own timeout

    // metricsTable must not be present (empty state renders instead)
    const tableCount = await page.locator('.metricsTable').count();
    expect(tableCount).toBe(0);

    // Empty state message must be visible
    await expect(page.locator('.emptyState')).toBeVisible();

    // No JS errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('MET-10/boundary: TIF placeholder cells hidden when TIF is off', async ({ page }) => {
    // Seed 8 days with classic algorithm — TIF is off
    const events = [];
    for (let i = 0; i < 8; i++) {
      const dayNum = String(i + 1).padStart(2, '0');
      const date = '2025-05-' + dayNum;
      events.push({ id: 'test-wake-'    + dayNum, type: 'wake',    at: date + 'T08:00' });
      events.push({ id: 'test-bedtime-' + dayNum, type: 'bedtime', at: date + 'T22:00' });
    }

    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1, windowDays: 7,
        statBlend: 'median', autoOutlier: false, groupingMode: 'calendar',
        rejectedDays: [], stages: [], activeStageId: null, forecastAlgorithm: 'classic',
      },
      events,
      activityLog: {},
    };

    await page.evaluate((data) => { localStorage.setItem('nightwatch:db', JSON.stringify(data)); }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');
    await page.locator('[data-tab="metrics"]').click();
    await page.waitForSelector('.metricsTable');

    // Count hidden td elements in the first aggregate row of the first rolling tbody
    // Expected: 12 hidden cells (TIF_COLUMNS.length = 12), hidden attribute present
    const hiddenTifCellCount = await page.evaluate(() => {
      const firstRollingTbody = document.querySelector('.metrics-rolling-tbody');
      if (!firstRollingTbody) return -1;
      const firstSummaryRow = firstRollingTbody.querySelector('.metrics-summary-row');
      if (!firstSummaryRow) return -2;
      const allTds = firstSummaryRow.querySelectorAll('td');
      let hiddenCount = 0;
      for (const td of allTds) {
        if (td.hidden) hiddenCount++;
      }
      return hiddenCount;
    });

    expect(hiddenTifCellCount).toBe(12);
  });

  test('MET-10/boundary: all days rejected — rolling sections render em-dash values, no JS errors', async ({ page }) => {
    // Seed 3 days of events but mark all three dates as rejected.
    // Unlike the empty-events test (events:[]) this exercises the code path where
    // nonRejectedDays is [] but the metrics table still renders (days is non-empty).
    const events = [
      { id: 'test-wake-01',    type: 'wake',    at: '2025-06-01T08:00' },
      { id: 'test-bedtime-01', type: 'bedtime', at: '2025-06-01T22:00' },
      { id: 'test-wake-02',    type: 'wake',    at: '2025-06-02T08:00' },
      { id: 'test-bedtime-02', type: 'bedtime', at: '2025-06-02T22:00' },
      { id: 'test-wake-03',    type: 'wake',    at: '2025-06-03T08:00' },
      { id: 'test-bedtime-03', type: 'bedtime', at: '2025-06-03T22:00' },
    ];

    const seedDb = {
      version: 2,
      settings: {
        cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1, windowDays: 7,
        statBlend: 'median', autoOutlier: false, groupingMode: 'calendar',
        rejectedDays: ['2025-06-01', '2025-06-02', '2025-06-03'],
        stages: [], activeStageId: null, forecastAlgorithm: 'classic',
      },
      events,
      activityLog: {},
    };

    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.evaluate((data) => { localStorage.setItem('nightwatch:db', JSON.stringify(data)); }, seedDb);
    await page.reload();
    await page.waitForSelector('[data-tab="today"]');
    await page.locator('[data-tab="metrics"]').click();
    await page.waitForSelector('.metricsTable');

    // Both rolling tbodies must be present (table renders because days exist)
    await expect(page.locator('.metrics-rolling-tbody').nth(0)).toBeVisible();
    await expect(page.locator('.metrics-rolling-tbody').nth(1)).toBeVisible();

    // Each rolling section must have 3 aggregate rows
    await expect(page.locator('.metrics-rolling-tbody').nth(0).locator('.metrics-summary-row')).toHaveCount(3);
    await expect(page.locator('.metrics-rolling-tbody').nth(1).locator('.metrics-summary-row')).toHaveCount(3);

    // All value cells in rolling sections must show em-dash (aggregateMetrics([]) → all-null)
    const emDashCheck = await page.evaluate(() => {
      const rollingTbodies = document.querySelectorAll('.metrics-rolling-tbody');
      const results = { total: 0, emDash: 0, other: [] };
      for (const tbody of rollingTbodies) {
        for (const row of tbody.querySelectorAll('.metrics-summary-row')) {
          // Skip the label cell (first td), check all value tds that are visible
          const tds = Array.from(row.querySelectorAll('td')).slice(1).filter(td => !td.hidden);
          for (const td of tds) {
            results.total++;
            if (td.textContent === '—') results.emDash++;
            else results.other.push(td.textContent);
          }
        }
      }
      return results;
    });

    expect(emDashCheck.other).toHaveLength(0);
    expect(emDashCheck.emDash).toBe(emDashCheck.total);
    expect(emDashCheck.total).toBeGreaterThan(0);

    // No JS errors
    expect(consoleErrors).toHaveLength(0);
  });
});
