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

import { createStorageLocal } from './adapters/storage-local.js';
import { createClockSystem } from './adapters/clock-system.js';
import { newEventId } from './lib/id.js';
import { createEventLog } from './store/event-log.js';
import { createSettingsStore } from './store/settings.js';
import { mountTodayScreen } from './ui/today-screen.js';
import { mountHeader, setActiveTab } from './ui/header.js';
import { mountHistoryScreen } from './ui/history-screen.js';
import { downloadJSON } from './lib/import-export.js';

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

// Show/hide the two screens based on activeTab.
// Called once at init and after every tab-change.
function applyTabVisibility() {
  if (!todayScreenEl || !historyScreenEl) return;
  if (activeTab === 'history') {
    todayScreenEl.style.display = 'none';
    historyScreenEl.style.display = '';
  } else {
    todayScreenEl.style.display = '';
    historyScreenEl.style.display = 'none';
  }
  // Keep aria-selected in sync (programmatic tab change without user click).
  setActiveTab(headerEl, activeTab);
}

// Plan 02-04 wiring: header reads settings.subjectName for h1 + document.title
// and exposes the gear → openSettings({settings}) entrypoint.
// Plan 04-02: also receives onTabChange to switch screens (D4-07).
mountHeader({
  root: headerEl,
  settings,
  onTabChange: (tabId) => {
    activeTab = tabId;
    applyTabVisibility();
  },
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

// Initial render: apply tab visibility so Today is shown and History is hidden
// (matching the 'today' default activeTab).
applyTabVisibility();
