# Phase 24: Autosave - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 6 new/modified files
**Analogs found:** 5 / 6 (js/lib/autosave.js has multiple strong analogs; existing files reference themselves)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/lib/autosave.js` | library/utility | file-I/O + state management | `js/lib/import-export.js` + `js/store/event-log.js` | excellent |
| `js/app.js` | composition root | request-response + pub-sub | self (existing patterns) | exact |
| `js/ui/settings-modal.js` | component/UI | request-response + state mutation | self (existing fieldsets) | exact |
| `js/ui/today-screen.js` | component/UI | request-response + state mutation | self (existing banner/modal patterns) | exact |
| `sw.js` | config/app-shell | static asset caching | self (existing PRECACHE_LIST) | exact |
| `tests/unit/sw-precache.test.js` | test | assertion/verification | self (existing test patterns) | exact |

---

## Pattern Assignments

### `js/lib/autosave.js` (library/utility, file-I/O + state management)

**Primary Analog:** `js/lib/import-export.js`

The autosave module will mirror the file-I/O and JSON serialization patterns from `downloadJSON`, but using the File System Access API (`getFileHandle`, `createWritable`) instead of the transient `<a download>` pattern.

**Imports pattern** (lines 1-9):
```javascript
import { formatLocalISO } from './time.js';

/**
 * Trigger autosave to user-chosen directory via File System Access API.
 * Exports async functions: pickSaveDirectory(), saveToDisk(handle, jsonString),
 * restoreHandle(). Minimal inline IndexedDB wrapper for handle persistence.
 *
 * No npm dependencies (PLAT-01).
 */
```

**Filename convention reuse** (js/lib/import-export.js:24-30):
```javascript
export function downloadJSON(storage, clock) {
  // ... truncated ...
  const dateSlice = formatLocalISO(clock.now()).slice(0, 10);
  const filename = `nightwatch-${dateSlice}.json`;
  // ... rest of function
}
```
👉 **For autosave:** `saveToDisk(handle, jsonString)` must compute the same dated filename: `nightwatch-YYYY-MM-DD.json`. Either import `formatLocalISO` directly (D-02 option A) or receive `filename` as a parameter from `app.js` (D-02 option B).

**JSON serialization reuse** (js/lib/import-export.js:24-26):
```javascript
export function downloadJSON(storage, clock) {
  const blob = storage.load();
  const json = JSON.stringify(blob, null, 2);
  // ... file write ...
}
```
👉 **For autosave:** The JSON serialization (2-space indent) is identical. `saveToDisk(handle, jsonString)` receives the pre-serialized string from the caller (`app.js`), so do NOT call `storage.load()` and serialize again inside `autosave.js` — that would duplicate the export logic.

---

**Secondary Analog:** `js/store/event-log.js`

The autosave module will follow the store subscription pattern for wiring into the event-log mutations.

**Subscription pattern** (js/store/event-log.js:233-248):
```javascript
/**
 * Register a subscriber that is called synchronously after every
 * successful mutation (addEvent, addEventAt, editEvent, deleteEvent).
 *
 * Mirrors the settings.subscribe() pattern (D2-09 / D3-12). Returns an
 * unsubscribe function. Subscriber re-entry safety: the notification loop
 * snapshots the Set before iterating (Pitfall #3 / T-2-07).
 *
 * @param {() => void} fn  callback with no arguments (unlike settings.subscribe
 *                          which passes a snapshot — callers re-read state themselves)
 * @returns {() => void} unsubscribe function
 */
subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
},
```

👉 **For autosave wiring in app.js** (line ~103):
```javascript
// After creating eventLog, subscribe the debounced saveToDisk handler:
const unsubscribeAutosave = eventLog.subscribe(() => {
  // Call debounced saveToDisk here
});
// Store unsubscribeAutosave if cleanup is needed (or let it persist for the app lifetime)
```

---

### `js/app.js` (composition root, request-response + pub-sub)

**Pattern reference:** Existing patterns in `js/app.js` (lines 22-45, 90-116)

The composition root must extend its existing adapter-injection and store-wiring patterns to integrate autosave.

**Imports pattern** (lines 22-35):
```javascript
import { createStorageLocal } from './adapters/storage-local.js';
import { createClockSystem } from './adapters/clock-system.js';
import { newEventId } from './lib/id.js';
import { createEventLog } from './store/event-log.js';
import { createSettingsStore } from './store/settings.js';
import { mountTodayScreen } from './ui/today-screen.js';
import { mountHeader } from './ui/header.js';
// ... more UI imports ...
import { downloadJSON } from './lib/import-export.js';
import { openSettings } from './ui/settings-modal.js';
```

👉 **For autosave imports:** Add `import { pickSaveDirectory, saveToDisk, restoreHandle } from './lib/autosave.js';` to the import block (around line 34).

**Dependency injection pattern for onSettings callback** (lines 92-96):
```javascript
mountHeader({
  root: headerEl,
  settings,
  onSettings: () => openSettings({ settings, eventLog, storage, id: newEventId }),
});
```

👉 **For Settings modal Backup fieldset:** The `openSettings` call must also pass `pickSaveDirectory` and `removeSaveDirectory` callbacks (or a single `onAutosaveAction` callback). Pattern:
```javascript
openSettings({
  settings,
  eventLog,
  storage,
  id: newEventId,
  onPickDirectory: () => pickSaveDirectory(),
  // OR: pickSaveDirectory callback passed directly for the "Change folder" button
})
```

**History screen export callback pattern** (lines 109-116):
```javascript
const historyScreen = historyTableRootEl
  ? mountHistoryScreen({
      root: historyTableRootEl,
      eventLog,
      settings,
      onExport: () => downloadJSON(storage, clock),
    })
  : null;
```

👉 **For Settings modal Backup fieldset export button** (D-03): The fallback manual Export button reuses the same `onExport: () => downloadJSON(storage, clock)` handler already injected for the History screen.

**Event log subscription pattern** (none yet in app.js — add after eventLog creation, around line 45):
```javascript
const eventLog = createEventLog({ storage, clock, id: newEventId });

// NEW: Subscribe autosave to event-log mutations (debounced 500ms per ROADMAP)
const AUTOSAVE_DEBOUNCE_MS = 500;
let autosaveTimeoutId = null;
const debouncedAutosave = () => {
  clearTimeout(autosaveTimeoutId);
  autosaveTimeoutId = setTimeout(() => {
    // Call the debounced save function here
  }, AUTOSAVE_DEBOUNCE_MS);
};
eventLog.subscribe(debouncedAutosave);
```

👉 **Actual implementation:** Let the planner decide whether debounce logic lives in `autosave.js` or in `app.js`. Either pattern is acceptable as long as the 500ms debounce fires only on event-log mutations (not settings mutations).

---

### `js/ui/settings-modal.js` (component/UI, request-response + state mutation)

**Pattern reference:** Existing fieldset structure (lines 66-102) and form handling (lines 148-209)

The Settings modal already has a three-fieldset structure; the new Backup fieldset follows the same pattern.

**Fieldset structure & conditional visibility pattern** (lines 99-102):
```javascript
const tifOptionsEl = document.getElementById('tifOptions');
if (tifOptionsEl) tifOptionsEl.hidden = (s.forecastAlgorithm !== 'tif');
const classicOptionsEl = document.getElementById('classicOptions');
if (classicOptionsEl) classicOptionsEl.hidden = (s.forecastAlgorithm === 'tif');
```

👉 **For Backup fieldset:** Use the same `el.hidden = condition` pattern to show/hide rows based on browser support and permission state:
```javascript
const backupFolderRowEl = form.elements.namedItem('autosaveFolderRow');
const backupUnsupportedEl = form.elements.namedItem('autosaveUnsupported');
if (backupFolderRowEl) backupFolderRowEl.hidden = !isSupported;
if (backupUnsupportedEl) backupUnsupportedEl.hidden = isSupported;
```

**Form value population pattern** (lines 71-102):
```javascript
function populateForm(s) {
  form.elements.namedItem('subjectName').value = s.subjectName;
  form.elements.namedItem('cutoverHour').value = String(s.cutoverHour);
  // ... more field assignments ...
}
```

👉 **For Backup fieldset (display-only):** The folder name is not a form input; it's static text in the row. Do NOT add it to FormData. Instead, set `textContent` on a display element:
```javascript
const folderNameEl = form.elements.namedItem('autosaveFolderName');
if (folderNameEl && persistedHandle) {
  folderNameEl.textContent = persistedHandle.name;
}
```

**Button event wiring pattern** (lines 133-142, algorithm change handler):
```javascript
const forecastAlgorithmEl = form.elements.namedItem('forecastAlgorithm');
const tifOptionsEl        = document.getElementById('tifOptions');
if (forecastAlgorithmEl && tifOptionsEl) {
  if (_forecastAlgorithmChangeHandler) {
    forecastAlgorithmEl.removeEventListener('change', _forecastAlgorithmChangeHandler);
  }
  _forecastAlgorithmChangeHandler = () => {
    const isTif = forecastAlgorithmEl.value === 'tif';
    tifOptionsEl.hidden = !isTif;
    // ...
  };
  forecastAlgorithmEl.addEventListener('change', _forecastAlgorithmChangeHandler);
}
```

👉 **For Backup fieldset buttons:** Wire "Choose folder" and "Remove" buttons at the module level (similar to CSV import handlers at lines 37-43). Store handler references to prevent accumulation on repeated opens:
```javascript
let _pickDirectoryHandler = null;
let _removeDirectoryHandler = null;

// Inside openSettings:
const pickBtn = form.querySelector('#autosavePickBtn');
if (pickBtn) {
  if (_pickDirectoryHandler) pickBtn.removeEventListener('click', _pickDirectoryHandler);
  _pickDirectoryHandler = async () => {
    const handle = await pickSaveDirectory(); // injected callback from app.js
    // Update display after successful pick
  };
  pickBtn.addEventListener('click', _pickDirectoryHandler);
}
```

**Error rendering pattern** (lines 195-201):
```javascript
if (errorsEl) {
  clear(errorsEl);
  for (const err of result.errors) {
    errorsEl.appendChild(
      el('p', { 'data-field': err.field, textContent: err.message }),
    );
  }
}
```

👉 **For Backup fieldset error/status display:** Use the same `textContent` guard pattern for the "Last saved" or error status line (D-09):
```javascript
const statusEl = document.getElementById('autosaveStatus');
if (statusEl) {
  statusEl.textContent = ''; // Clear previous status
  if (error) {
    statusEl.textContent = `Error: ${error.message}`;
  } else if (lastSavedTime) {
    statusEl.textContent = `Last saved: ${lastSavedTime}`;
  }
}
```

---

### `js/ui/today-screen.js` (component/UI, request-response + state mutation)

**Pattern reference:** Existing banner/modal patterns (none yet — this is new)

The first-launch banner (D-10, D-11) will follow the existing modal-trigger pattern and use the `el` helper for DOM construction.

**DOM construction helper pattern** (js/ui/dom.js, referenced in today-screen.js header comments):
```javascript
// From js/ui/today-screen.js imports:
import { el, clear } from './dom.js';
```

👉 **For first-launch banner:** Construct the banner element using the `el` helper and insert it at the top of the today-screen root:
```javascript
// At the start of the mount function, after root is cleared:
const dismissedKey = 'autosaveBannerDismissed';
const isDismissed = localStorage.getItem(dismissedKey); // gsd:allow-storage-local
const isSupported = 'showDirectoryPicker' in window;

if (isSupported && !isDismissed) {
  const bannerEl = el('div', {
    className: 'autosave-banner',
    children: [
      el('p', { textContent: 'Back up your sleep data automatically...' }),
      el('button', {
        textContent: 'Set up autosave',
        onclick: async () => {
          await onAutosaveSetup(); // callback from app.js
          localStorage.setItem(dismissedKey, '1'); // gsd:allow-storage-local
          bannerEl.remove();
        },
      }),
      el('button', {
        textContent: 'Dismiss',
        onclick: () => {
          localStorage.setItem(dismissedKey, '1'); // gsd:allow-storage-local
          bannerEl.remove();
        },
      }),
    ],
  });
  root.insertBefore(bannerEl, root.firstChild);
}
```

**Mount function signature pattern** (js/ui/today-screen.js header, lines 1-4):
```javascript
// Mount function receives { root, eventLog, settings, clock } deps
export function mountTodayScreen({ root, eventLog, settings, clock }) {
  // ... clear root, render content ...
}
```

👉 **For first-launch banner:** The banner does NOT require additional deps beyond what `mountTodayScreen` already receives. If the button needs to call `pickSaveDirectory()`, it should be injected as an optional callback:
```javascript
export function mountTodayScreen({
  root,
  eventLog,
  settings,
  clock,
  onAutosaveSetup, // optional callback from app.js
}) {
  // ... banner rendering with onAutosaveSetup() call ...
}
```

---

### `sw.js` (config/app-shell, static asset caching)

**Pattern reference:** Existing PRECACHE_LIST structure (lines 23-65)

The PRECACHE_LIST must include the new `autosave.js` library module.

**PRECACHE_LIST insertion point** (sw.js:35-50, lib section):
```javascript
const PRECACHE_LIST = Object.freeze([
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/favicon.jpeg',
  './icons/app-start.jpeg',
  // App composition root
  './js/app.js',
  // Adapters (runtime only — test-only adapters clock-fixed.js and storage-memory.js excluded)
  './js/adapters/clock-system.js',
  './js/adapters/storage-local.js',
  // Pure-logic lib
  './js/lib/accuracy-tif.js',
  './js/lib/accuracy.js',
  './js/lib/chart-data.js',
  './js/lib/csv-parse.js',
  './js/lib/day-bucket.js',
  './js/lib/db-shape.js',
  // ...
]);
```

👉 **Add to PRECACHE_LIST:** Insert `'./js/lib/autosave.js',` in the "Pure-logic lib" section, in alphabetical order (after `'./js/lib/accuracy.js',` and before `'./js/lib/chart-data.js',`):

```javascript
  // Pure-logic lib
  './js/lib/accuracy-tif.js',
  './js/lib/accuracy.js',
  './js/lib/autosave.js',  // <-- NEW
  './js/lib/chart-data.js',
  // ...
```

---

### `tests/unit/sw-precache.test.js` (test, assertion/verification)

**Pattern reference:** Existing test assertions (lines 41-131)

The test file must be extended to assert that `./js/lib/autosave.js` is in PRECACHE_LIST.

**Test assertion pattern** (lines 117-123):
```javascript
test('contains forecast-tif.js (TIF algorithm module)', () => {
  assert.ok(
    precacheList.includes('./js/lib/forecast-tif.js'),
    'forecast-tif.js missing from PRECACHE_LIST'
  );
});

test('contains forecast-utils.js (event-reachability utilities module)', () => {
  assert.ok(
    precacheList.includes('./js/lib/forecast-utils.js'),
    'forecast-utils.js missing from PRECACHE_LIST'
  );
});
```

👉 **Add new test:** Insert a new test assertion for `autosave.js` before the last closing brace of the describe block (around line 131):

```javascript
test('contains autosave.js (File System Access API module)', () => {
  assert.ok(
    precacheList.includes('./js/lib/autosave.js'),
    'autosave.js missing from PRECACHE_LIST'
  );
});
```

Also update line 113 ("at least 32 entries") if the entry count changes (currently 64 entries after adding autosave.js, but the test allows ">= 32" so no change needed).

---

## Shared Patterns

### File I/O & JSON Serialization
**Source:** `js/lib/import-export.js:24-30`

Filename convention (used by both `downloadJSON` and `autosave.js`):
```javascript
const dateSlice = formatLocalISO(clock.now()).slice(0, 10);
const filename = `nightwatch-${dateSlice}.json`;
```

**Apply to:** `autosave.js` — reuse the dated filename convention exactly, so manual export and autosave produce identical files for the same calendar day (D-01).

---

### Event-Log Subscription
**Source:** `js/store/event-log.js:245-248`

Subscriber callback pattern:
```javascript
subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
```

**Apply to:** `app.js` — wire `saveToDisk` (debounced) to `eventLog.subscribe()` so autosave fires only on event mutations, not settings mutations.

---

### Form Field Population & Display
**Source:** `js/ui/settings-modal.js:71-102`

Safe value assignment pattern (property, never innerHTML):
```javascript
form.elements.namedItem('fieldName').value = stringValue;
form.elements.namedItem('fieldName').checked = booleanValue;
```

**Apply to:** `settings-modal.js` Backup fieldset — populate the folder name via `textContent`, not form values. Update the "Last saved" status line via `textContent` only (no HTML injection).

---

### Conditional Visibility
**Source:** `js/ui/settings-modal.js:99-102`

Show/hide pattern:
```javascript
el.hidden = condition;
```

**Apply to:** `settings-modal.js` Backup fieldset rows — toggle visibility based on browser support (`'showDirectoryPicker' in window`) and permission state (`'prompt'` vs. `'granted'` vs. `'denied'`).

---

### LocalStorage One-Time Flags
**Source:** `js/app.js:221-235` (file-note dismissal pattern)

One-time UI-state tracking:
```javascript
const FLAG_KEY = 'nw_file_note_dismissed';
if (!localStorage.getItem(FLAG_KEY)) {
  // Show UI element
  dismissBtn.addEventListener('click', () => {
    localStorage.setItem(FLAG_KEY, '1');
    el.hidden = true;
  });
}
```

**Apply to:** `today-screen.js` first-launch banner (D-11) — track dismissal via `localStorage.getItem('autosaveBannerDismissed')` with no schema involvement.

---

## No Analog Found

None. All required patterns are present in the existing codebase.

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`, `js/store/`, `js/adapters/`, `sw.js`, `tests/unit/`

**Files scanned:** 12 (import-export, time, event-log, app, settings-modal, today-screen, sw, sw-precache test, dom, manual-entry, history-screen, settings store)

**Pattern extraction date:** 2026-09-17

**Key decisions reflected:**
- D-01/D-02: Filename convention reuse from `downloadJSON`
- D-03: Fallback export button uses existing `downloadJSON` handler
- D-05/D-09: Status line pattern for error + "Last saved" display
- D-07: Backup fieldset added as fourth fieldset (not folded into Profile)
- D-10/D-11: First-launch banner with localStorage dismissal flag
- PLAT-01: No npm dependencies — inline IndexedDB wrapper only
