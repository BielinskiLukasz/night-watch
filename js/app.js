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
import { mountTodayScreen } from './ui/today-screen.js';

const storage = createStorageLocal('nightwatch:db');
const clock = createClockSystem();
const eventLog = createEventLog({ storage, clock, id: newEventId });

mountTodayScreen({ root: document.getElementById('app'), eventLog });
