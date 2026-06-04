// js/app.js
// Composition root — the ONLY place adapters are constructed and injected.
//
// Source: 01-RESEARCH.md §Pattern 1; 01-CONTEXT.md D-06, D-07.
// Every later phase EXTENDS this file rather than scattering side effects
// across modules.
//
// The storage key is declared exactly once in the codebase (here) —
// Plan 01 acceptance criterion.

import { createStorageLocal } from './adapters/storage-local.js';
import { createClockSystem } from './adapters/clock-system.js';
import { newEventId } from './lib/id.js';
import { createEventLog } from './store/event-log.js';
import { createSettingsStore } from './store/settings.js';
import { mountTodayScreen } from './ui/today-screen.js';
import { mountHeader } from './ui/header.js';

const storage = createStorageLocal('nightwatch:db');
const clock = createClockSystem();

// D2-08: settings + event-log share the SAME storage instance.
// Both stores call storage.load() independently and migrate their slice.
// Settings constructed first so any default-injection write (if applicable)
// happens before event-log writes — though both apply migrateV1ToV2.
const settings = createSettingsStore({ storage });
const eventLog = createEventLog({ storage, clock, id: newEventId });

// Plan 02-04 wiring: header reads settings.subjectName for h1 + document.title
// and exposes the gear → openSettings({settings}) entrypoint.
mountHeader({ root: document.querySelector('header.appHeader'), settings });

// Plan 03-04 wiring: mountTodayScreen now includes the full forecast section
// (next-event hero card, four prediction cards, cold-start gating, reactive
// updates). The forecast function and selectNextEvent are imported internally
// by today-screen.js — D3-13 (derived state), D3-12 (reactive on data change).
// The composition root only provides eventLog + settings (the two data sources).
mountTodayScreen({ root: document.getElementById('app'), eventLog, settings });
