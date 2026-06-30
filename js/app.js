// js/app.js
// Composition root — the ONLY place adapters are constructed and injected.
//
// Source: 01-RESEARCH.md §Pattern 1; 01-CONTEXT.md D-06, D-07.
// Every later phase EXTENDS this file rather than scattering side effects
// across modules.
//
// The storage key is declared exactly once in the codebase (here) —
// Plan 01 acceptance criterion.
//
// Plan 04-02 additions (D4-07, D4-08):
//   - activeTab module-level state (persists across subscription re-renders)
//   - onTabChange handler → show/hide today-screen / history-screen
//   - mountHistoryScreen call (read-only; Wave 3 adds edit/delete)
//
// Plan 07-04 additions (D7-01..D7-04):
//   - mountBottomNav call (replaces header tab nav)
//   - Four-screen applyTabVisibility (today/history/charts/accuracy)
//   - mountChartsScreen + mountAccuracyScreen stub calls
//   - header.js import simplified (tab nav export removed in D7-01)

import { createStorageLocal } from './adapters/storage-local.js';
import { createClockSystem } from './adapters/clock-system.js';
import { newEventId } from './lib/id.js';
import { createEventLog } from './store/event-log.js';
import { createSettingsStore } from './store/settings.js';
import { mountTodayScreen } from './ui/today-screen.js';
import { mountHeader } from './ui/header.js';
import { mountHistoryScreen } from './ui/history-screen.js';
import { mountBottomNav } from './ui/bottom-nav.js';
import { mountChartsScreen } from './ui/charts-screen.js';
import { mountAccuracyScreen } from './ui/accuracy-screen.js';
import { downloadJSON } from './lib/import-export.js';
import { openSettings } from './ui/settings-modal.js';

const storage = createStorageLocal('nightwatch:db');
const clock = createClockSystem();

// D2-08: settings + event-log share the SAME storage instance.
// Both stores call storage.load() independently and migrate their slice.
// Settings constructed first so any default-injection write (if applicable)
// happens before event-log writes — though both apply migrateV1ToV2.
const settings = createSettingsStore({ storage });
const eventLog = createEventLog({ storage, clock, id: newEventId });

// D4-08: activeTab persists at module scope so subscription re-renders
// (from eventLog.subscribe / settings.subscribe) do not reset the tab.
let activeTab = 'today';

const headerEl = document.querySelector('header.appHeader');
const todayScreenEl = document.getElementById('today-screen');
const historyScreenEl = document.getElementById('history-screen');
// history-table-root is the mount point for the day-column table; the outer
// historyScreenEl is toggled visible/hidden by applyTabVisibility().
const historyTableRootEl = document.getElementById('history-table-root');
// Plan 07-04: new screen and nav elements (D7-01..D7-04)
const chartsScreenEl = document.getElementById('charts-screen');
const accuracyScreenEl = document.getElementById('accuracy-screen');
const bottomNavEl = document.getElementById('bottom-nav');

// Show/hide all four screens based on activeTab.
// Called once at init and after every tab-change (D7-04).
// The SCREENS map uses direct element references captured above.
const SCREENS = Object.freeze({
  today: todayScreenEl,
  history: historyScreenEl,
  charts: chartsScreenEl,
  accuracy: accuracyScreenEl,
});

function applyTabVisibility() {
  for (const [tabId, el] of Object.entries(SCREENS)) {
    if (el) el.style.display = (tabId === activeTab ? '' : 'none');
  }
  // Bottom nav handles its own aria-selected state internally via the
  // delegated click listener in mountBottomNav.
}

// Plan 02-04 wiring: header reads settings.subjectName for h1 + document.title
// and exposes the gear → openSettings({settings}) entrypoint.
// Plan 05-04: onSettings callback injects eventLog, storage, id for CSV import.
// Plan 07-04: onTabChange removed — tab navigation moved to bottom nav (D7-01).
mountHeader({
  root: headerEl,
  settings,
  onSettings: () => openSettings({ settings, eventLog, storage, id: newEventId }),
});

// Plan 03-04 wiring: mountTodayScreen now includes the full forecast section
// (next-event hero card, four prediction cards, cold-start gating, reactive
// updates). The forecast function and selectNextEvent are imported internally
// by today-screen.js — D3-13 (derived state), D3-12 (reactive on data change).
// The composition root only provides eventLog + settings (the two data sources).
mountTodayScreen({ root: todayScreenEl, eventLog, settings });

// Plan 04-02 wiring: History screen — read-only day-column table (Wave 2).
// Plan 05-03 wiring: onExport callback injects downloadJSON so the Export JSON
// button on the History toolbar can trigger a download without importing
// storage/clock into history-screen.js directly (composition-root pattern).
if (historyTableRootEl) {
  mountHistoryScreen({
    root: historyTableRootEl,
    eventLog,
    settings,
    onExport: () => downloadJSON(storage, clock),
  });
}

// Plan 07-04 wiring: Bottom navigation bar (D7-01..D7-04).
// Wires the four-tab bottom nav; onTabChange updates activeTab and calls
// applyTabVisibility to show/hide the correct screen.
if (bottomNavEl) {
  mountBottomNav({
    root: bottomNavEl,
    onTabChange: (tabId) => {
      activeTab = tabId;
      applyTabVisibility();
    },
  });
}

// Plan 07-04 wiring: Charts screen (stub — full implementation in 07-05).
if (chartsScreenEl) {
  mountChartsScreen({ root: chartsScreenEl, eventLog, settings });
}

// Plan 07-04 wiring: Accuracy screen (stub — full implementation in 07-06).
if (accuracyScreenEl) {
  mountAccuracyScreen({ root: accuracyScreenEl, eventLog, settings });
}

// Initial render: apply tab visibility so Today is shown and all others hidden
// (matching the 'today' default activeTab).
applyTabVisibility();
