# Phase 5: Data Import/Export — Research

**Written:** 2026-06-28
**Phase:** NW-05-data-import-export
**Status:** Complete — ready for planner

---

## §Summary

- Both stores (`event-log.js`, `settings.js`) need a `replace(blob)` method that swaps in-memory state, persists, and fires subscribers — Pattern A from CONTEXT.md. This is the cleanest seam and avoids reconstructing the stores (which would lose the existing subscriber registrations from app.js).
- CSV parsing is a pure function (`js/lib/csv-parse.js`) with column-name auto-detection (Polish OR English headers), delimiter auto-detection (`;` vs `,` by counting on the header row), and date-format auto-detection (dots → DD.MM.YYYY, dashes → YYYY-MM-DD). Time cells are `HH:MM` strings; the parser builds `YYYY-MM-DDTHH:MM` ISO strings and passes them through `parseLocalISO → roundTo5 → formatLocalISO` for canonical rounding.
- FileReader API (`reader.readAsText(file)` + `reader.onload` callback) is the correct pattern; it is callback-based (not async/await), which fits the existing synchronous subscriber model. The hidden `<input type="file">` lives in `index.html`; the Settings modal triggers `.click()` on it programmatically.
- JSON export uses `URL.createObjectURL(new Blob([...], {type:'application/json'}))` + a programmatic `<a click>` + immediate `URL.revokeObjectURL()`. Works from a dev server; `file://` download support is Phase 8 concern.
- `db.activityLog` is a new top-level field (`{ 'YYYY-MM-DD': number }`). `migrateV1ToV2()` needs a one-line patch to inject `activityLog: {}` when the field is absent, mirroring the existing `rejectedDays` injection pattern.
- Playwright file upload uses `page.setInputFiles('#csvInput', { name, mimeType, buffer })`. Download uses `const [download] = await Promise.all([page.waitForEvent('download'), exportBtn.click()])` then `download.saveAs(tmpPath)` + `fs.readFileSync(tmpPath)` to inspect the JSON content.

---

## §Pattern A: Store `replace(blob)` API

### Why Pattern A over Pattern B (re-init)

Re-initializing stores would destroy the subscriber registrations that `app.js` established at boot (the `eventLog.subscribe()` and `settings.subscribe()` calls in `mountTodayScreen`, `mountHistoryScreen`, etc.). Pattern A mutates the shared `db` in place and then fires existing subscribers, so the UI re-renders correctly without any re-wiring.

### Implementation for `js/store/event-log.js`

Add to the returned object (after `subscribe`):

```javascript
/**
 * Replace the entire in-memory db with the imported blob.
 * Migrates v1→v2, validates version, persists, and fires all subscribers.
 * Called by the import handler in the composition root / import-export module.
 *
 * @param {object} blob  raw parsed JSON (may be v1 or v2)
 * @throws Error if blob.version > 2 after migration
 */
replace(blob) {
  db = migrateV1ToV2(blob, DEFAULT_SETTINGS);
  if (db.version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version after migration: ${db.version}`);
  }
  storage.save(db);
  notifySubscribers();
},
```

**Key invariants:**
- `migrateV1ToV2` is already tested and handles v1, v2 (passthrough), and throws on v3+.
- The caller (import handler) must run `migrateV1ToV2` for user error messaging BEFORE calling `replace()`, so that a "version > 2" scenario shows a friendly UI error rather than an uncaught throw.
- `notifySubscribers()` is the existing private helper — no new notification path needed.

### Implementation for `js/store/settings.js`

Add to the returned object (after `subscribe`):

```javascript
/**
 * Replace the entire in-memory db with the imported blob.
 * Migrates v1→v2, validates+normalizes the settings slice, persists,
 * and fires all subscribers with the new snapshot.
 *
 * @param {object} blob  raw parsed JSON (may be v1 or v2)
 */
replace(blob) {
  db = migrateV1ToV2(blob, defaults);
  const { normalized } = validateSettings(db.settings ?? {}, { mode: 'load', defaults });
  db.settings = normalized;
  storage.save(db);
  const next = snapshot();
  const subs = [...subscribers];
  for (const fn of subs) fn(next);
},
```

**Key invariant:** Settings subscribers receive the normalized snapshot (same as `update()` path). Event-log subscribers receive no argument (same as `addEvent()` path). Keep this asymmetry — it is already established by the existing API.

### Import call sequence in composition root / import module

```javascript
// 1. Parse the raw JSON blob (already done by JSON.parse or parseCSV)
// 2. Check version BEFORE calling replace — show user-friendly error if too new
if (blob.version > 2) {
  showImportError('Incompatible file — exported by a newer version of Nightwatch.');
  return;
}
// 3. Persist the blob once via storage.save so both stores see the same data
storage.save(migrateV1ToV2(blob, DEFAULT_SETTINGS));
// 4. Call replace() on both stores so in-memory state + subscribers sync
eventLog.replace(blob);
settings.replace(blob);
// 5. Stores fire their own subscribers → UI re-renders automatically
```

**Pitfall:** If you call only one store's `replace()`, the other store will have stale in-memory state. Always call both. The cross-store race mitigation already present in `update()` / `persist()` handles any interleaving.

---

## §Pattern B: CSV Parsing

### New file: `js/lib/csv-parse.js`

Pure function — no DOM, no I/O. Fully unit-testable with `node:test`.

```
parseCSV(text: string) → {
  events: Array<{ id?: string, type: string, at: string }>,
  rejectedDays: Array<string>,       // YYYY-MM-DD strings for settings.rejectedDays
  activityLog: { [date: string]: number },
  skipped: Array<{ row: number, reason: string }>,
}
```

The `id` field is omitted — the caller (import handler) assigns new IDs via `newEventId()`.

### Column name mapping table (frozen)

```javascript
const COL = Object.freeze({
  // Polish headers (sen.xlsx / standard export)
  'Data':           'date',
  'Pobudka':        'wake',
  'Zaśnięcie':      'bedtime',
  'Drzemka start':  'napStart',
  'Drzemka stop':   'napEnd',
  'Aktywność':      'activity',
  'odrzucone':      'rejected',
  // English aliases (for re-imported nightwatch CSV if ever added)
  'Date':           'date',
  'Wake':           'wake',
  'Bedtime':        'bedtime',
  'Nap start':      'napStart',
  'Nap end':        'napEnd',
  'Activity':       'activity',
  'Rejected':       'rejected',
});
```

### Delimiter auto-detection

```javascript
function detectDelimiter(headerLine) {
  const semis = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semis >= commas ? ';' : ',';
}
```

### Date format auto-detection

```javascript
function detectDateFormat(sampleDate) {
  // DD.MM.YYYY: three dot-separated segments
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(sampleDate)) return 'dmy-dot';
  // YYYY-MM-DD: ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(sampleDate)) return 'iso';
  return null; // caller skips row
}

function parseDate(raw, fmt) {
  if (fmt === 'dmy-dot') {
    const [d, m, y] = raw.split('.');
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  if (fmt === 'iso') return raw.trim();
  return null;
}
```

### Time parsing: CSV `HH:MM` → canonical `YYYY-MM-DDTHH:MM`

```javascript
import { parseLocalISO, roundTo5, formatLocalISO } from './time.js';

function parseEventAt(dateStr, timeStr) {
  // timeStr is like '07:30' or '07:30:00' from Excel
  const hhmm = timeStr.trim().slice(0, 5); // take only HH:MM
  const isoStr = `${dateStr}T${hhmm}`;
  // parseLocalISO throws on malformed — caller catches and skips
  return formatLocalISO(roundTo5(parseLocalISO(isoStr)));
}
```

Note: `parseLocalISO` accepts exactly `YYYY-MM-DDTHH:MM` — the `slice(0, 5)` on the time string handles Excel exports that may include seconds (e.g., `07:30:00`).

### Row parsing loop skeleton

```javascript
export function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const headerLine = lines[0] ?? '';
  const delim = detectDelimiter(headerLine);
  const headers = headerLine.split(delim).map(h => h.trim());

  // Map header index → field name
  const colIdx = {};
  for (let i = 0; i < headers.length; i++) {
    const field = COL[headers[i]];
    if (field) colIdx[field] = i;
  }

  const events = [];
  const rejectedDays = [];
  const activityLog = {};
  const skipped = [];
  let dateFormat = null;

  for (let rowNum = 1; rowNum < lines.length; rowNum++) {
    const line = lines[rowNum].trim();
    if (!line) continue;
    const cells = line.split(delim).map(c => c.trim());

    const rawDate = cells[colIdx.date] ?? '';
    if (!rawDate) { skipped.push({ row: rowNum + 1, reason: 'missing date' }); continue; }

    // Detect format from first parseable row
    if (!dateFormat) dateFormat = detectDateFormat(rawDate);
    const dateStr = parseDate(rawDate, dateFormat);
    if (!dateStr) { skipped.push({ row: rowNum + 1, reason: 'unparseable date' }); continue; }

    const rawWake = cells[colIdx.wake] ?? '';
    if (!rawWake) { skipped.push({ row: rowNum + 1, reason: 'missing wake time' }); continue; }

    try {
      events.push({ type: 'wake',    at: parseEventAt(dateStr, rawWake) });
    } catch { skipped.push({ row: rowNum + 1, reason: 'invalid wake time' }); continue; }

    const rawBed = cells[colIdx.bedtime] ?? '';
    if (rawBed) {
      try { events.push({ type: 'bedtime', at: parseEventAt(dateStr, rawBed) }); }
      catch { /* skip bedtime but keep rest of row */ }
    }

    const rawNapStart = cells[colIdx.napStart] ?? '';
    const rawNapEnd   = cells[colIdx.napEnd]   ?? '';
    if (rawNapStart) {
      try { events.push({ type: 'napStart', at: parseEventAt(dateStr, rawNapStart) }); }
      catch { /* skip nap-start */ }
    }
    if (rawNapEnd) {
      try { events.push({ type: 'napEnd', at: parseEventAt(dateStr, rawNapEnd) }); }
      catch { /* skip nap-end */ }
    }

    // Rejected flag (D5-07)
    const rawRejected = cells[colIdx.rejected] ?? '';
    if (rawRejected && rawRejected !== '0' && rawRejected.toLowerCase() !== 'false') {
      rejectedDays.push(dateStr);
    }

    // Activity log (D5-17)
    const rawActivity = cells[colIdx.activity] ?? '';
    const actVal = parseFloat(rawActivity);
    if (!isNaN(actVal)) activityLog[dateStr] = actVal;
  }

  return { events, rejectedDays, activityLog, skipped };
}
```

**Note on `odrzucone` (rejected) column:** The Polish spreadsheet uses `1`/empty or `TRUE`/empty for this column. The condition `rawRejected !== '0' && rawRejected.toLowerCase() !== 'false'` plus a truthy check covers all common variants.

---

## §Pattern C: File Import (FileReader API)

### HTML — hidden file inputs in `index.html`

Add two hidden file inputs (one for CSV, one for JSON) outside the dialog, directly in `<body>`:

```html
<input type="file" id="csvInput"  accept=".csv,text/csv"             style="display:none">
<input type="file" id="jsonInput" accept=".json,application/json"    style="display:none">
```

Place them near the bottom of `<body>`, after the dialog elements.

### JS — triggering from Settings modal

In the settings-modal import section click handler:

```javascript
// Trigger the hidden file input
document.getElementById('csvInput').click();
```

### JS — FileReader callback (callback-style, no async/await)

```javascript
const input = document.getElementById('csvInput');
input.addEventListener('change', () => {
  const file = input.files[0];
  if (!file) return;
  // Reset input so the same file can be re-selected later
  input.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    // Hand off to import handler (which shows confirmation dialog first)
    handleCsvImport(text);
  };
  reader.onerror = () => {
    showImportError('Could not read file.');
  };
  reader.readAsText(file, 'UTF-8');
});
```

**Key pattern:** `input.value = ''` resets the file picker so the user can re-import the same file name after fixing it.

### Confirmation dialog

The import confirmation follows the Phase 4 delete-confirmation pattern (D4-06). Use `window.confirm()` for simplicity (consistent with delete confirmation already in use):

```javascript
function handleCsvImport(csvText) {
  const result = parseCSV(csvText);
  if (!window.confirm(`Import ${result.events.length} events? This will replace all current data.`)) return;
  // ... call replace() on both stores
}
```

**Pitfall:** Do NOT call `window.confirm()` inside a FileReader `onload` callback on some browsers/contexts — it may be blocked. Call it in the button click handler BEFORE triggering FileReader (the "are you sure?" flows before the file picker opens), or call it synchronously in `onload` (which works in all modern browsers for user-interactive flows).

Actually — the safer, established pattern for this codebase is: file picker opens → user picks file → FileReader reads → show confirmation dialog in onload before committing. All three browsers support `window.confirm()` in FileReader.onload callbacks.

---

## §Pattern D: File Export (JSON download via `<a>`)

```javascript
export function downloadJSON(blob, clock) {
  const today = formatLocalISO(clock.now()).slice(0, 10); // YYYY-MM-DD
  const filename = `nightwatch-${today}.json`;
  const json = JSON.stringify(blob, null, 2);

  const blobObj = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blobObj);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
```

**Where to call this:** In the "Export JSON" button handler on the History screen (D5-02). The `blob` is `storage.load()` — the current canonical db. The `clock` is injected from app.js (same clock adapter already injected into eventLog).

**What to export:** `storage.load()` — the full blob including `db.activityLog` (D5-14). Do NOT assemble the blob manually; load from storage so it is guaranteed to be the latest persisted state.

**Pitfall:** `URL.createObjectURL` is not available from `file://` protocol in Firefox (Chrome/Edge work). This is a Phase 8 PWA concern; for Phase 5 the app is run from a dev server (`http://localhost:8000`).

---

## §Pattern E: Playwright File I/O

### File upload — `page.setInputFiles()`

```javascript
import { readFileSync } from 'node:fs';

test('CSV import replaces events', async ({ page }) => {
  await page.goto('http://localhost:8000');

  // Open Settings and click Import CSV button
  await page.click('button[aria-label="Settings"]'); // gear icon
  await page.click('#importCsvBtn');

  // Playwright intercepts the hidden file input
  await page.setInputFiles('#csvInput', {
    name: 'test.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Data;Pobudka;Zaśnięcie\n28.06.2026;07:00;22:00'),
  });

  // Confirm the import dialog
  page.once('dialog', dialog => dialog.accept());

  // Wait for history table to show the imported row
  await expect(page.locator('.historyTable tbody tr')).toHaveCount(1);
});
```

**Note:** `page.setInputFiles()` works with `display:none` inputs as of Playwright 1.15+. The hidden `<input type="file">` does NOT need to be visible.

### File download — `page.waitForEvent('download')`

```javascript
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('JSON export round-trip', async ({ page }) => {
  await page.goto('http://localhost:8000');
  // Log some events first...

  // Navigate to History tab
  await page.click('button[data-tab="history"]');

  // Start waiting for download before triggering it
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportJsonBtn'),
  ]);

  // Save to a temp file and read it
  const tmpPath = join(tmpdir(), 'nightwatch-test.json');
  await download.saveAs(tmpPath);
  const exported = JSON.parse(readFileSync(tmpPath, 'utf-8'));
  unlinkSync(tmpPath);

  // Assert structure
  expect(exported.version).toBe(2);
  expect(Array.isArray(exported.events)).toBe(true);
  expect(exported.settings).toBeTruthy();
});
```

**Pitfall (Windows):** `tmpdir()` returns a Windows path with backslashes. `download.saveAs()` handles this correctly on Playwright for Windows. Use `path.join` not string concatenation.

### Round-trip E2E test structure

```javascript
test('JSON round-trip — export then import restores state', async ({ page }) => {
  // 1. Log events
  // 2. Export JSON → save to tmpPath
  // 3. Navigate away from app or clear localStorage via page.evaluate
  // 4. Reload page → localStorage cleared → cold start
  // 5. Import the saved JSON file via page.setInputFiles('#jsonInput', ...)
  // 6. Assert history table matches pre-export state
});
```

**Clear localStorage between steps:**
```javascript
await page.evaluate(() => localStorage.clear());
await page.reload();
```

---

## §Pattern F: `activityLog` Schema

### What `db.activityLog` is

A top-level field on the canonical db blob (D5-17):
```json
{
  "version": 2,
  "settings": { ... },
  "events": [ ... ],
  "activityLog": { "2026-06-01": 3.5, "2026-06-02": 4.0 }
}
```

### Migration update in `js/lib/db-shape.js` — `migrateV1ToV2()`

Mirroring the existing `rejectedDays` injection on v2 passthrough (line 83–86 of db-shape.js), add:

```javascript
if (blob.version === 2) {
  if (blob.settings && !Array.isArray(blob.settings.rejectedDays)) {
    blob.settings.rejectedDays = [];
  }
  // NEW: inject activityLog if absent (blobs exported before Phase 5)
  if (!blob.activityLog || typeof blob.activityLog !== 'object') {
    blob.activityLog = {};
  }
  return blob;
}
```

And for fresh install (null/undefined → fresh v2):
```javascript
return { version: 2, settings: { ...defaultSettings }, events: [], activityLog: {} };
```

And for v1 migration:
```javascript
return {
  version: 2,
  settings: { ...defaultSettings },
  events: Array.isArray(blob.events) ? blob.events : [],
  activityLog: {},
};
```

### Event-log store exposure for export

The export handler (in History screen or composition root) reads the full blob directly via `storage.load()` — it does NOT need the event-log store to expose `activityLog`. This keeps the store API clean.

If Phase 7 needs to read `activityLog` at runtime (for charts), add a `getActivityLog()` method to event-log at that time.

---

## §Wave Structure (Recommendation)

**Wave 1 (TDD foundation — parallel-eligible):**
- 05-01-PLAN.md: `js/lib/csv-parse.js` TDD + `js/lib/db-shape.js` activityLog migration update + unit tests
- 05-02-PLAN.md: `store.replace(blob)` API on both stores + integration test (replace → subscribers fire → UI re-render)

**Wave 2 (blocked on Wave 1):**
- 05-03-PLAN.md: Export JSON button on History screen toolbar (`downloadJSON` helper + E2E test)
- 05-04-PLAN.md: CSV Import in Settings modal (FileReader + confirmation + UI feedback + E2E test)

**Wave 3 (blocked on Wave 2):**
- 05-05-PLAN.md: JSON Import in Settings modal + round-trip E2E test + security audit + phase gate (human verify)

Alternatively, merge 05-03/04/05 into two plans (export + CSV import as one; JSON import + gate as another) if the executor prefers fewer plan files. The planner should decide based on task granularity.

---

## §Pitfalls

1. **FileReader is async, store notifications are sync.** The import result is available inside `reader.onload` — which is an async callback. The store `replace()` calls must happen INSIDE `onload`, not outside. Do not try to return a value from the FileReader callback; pass results via closure.

2. **`window.confirm()` blocks the event loop.** The confirmation dialog call in `onload` is fine for user-interactive import flows (the browser expects blocking dialogs after user actions). But it will block Playwright tests unless handled via `page.once('dialog', ...)` BEFORE the action that triggers it. See §Pattern E.

3. **`URL.revokeObjectURL` timing.** Call via `setTimeout(fn, 100)` after `a.click()` to give the browser time to start the download. Immediate revocation (same tick) can cancel the download in some browsers.

4. **Both stores must `replace()` before either fires subscribers.** If you call `eventLog.replace(blob)` first, its subscribers fire and the Today/History screens re-render — but `settings.replace()` hasn't run yet, so the settings snapshot is stale. Fix: call `storage.save(migratedBlob)` once BEFORE calling `replace()` on either store. Each store's `replace()` reads from storage before saving, so both get the same migrated blob. Then call `eventLog.replace(blob)` and `settings.replace(blob)` — both will see the already-persisted blob.

   Actually the simplest fix: call `storage.save(migratedBlob)` once, then call `eventLog.replace(migratedBlob)` and `settings.replace(migratedBlob)` — both replace() methods call `storage.save(db)` again (idempotent), which is fine.

5. **Cross-store race on import.** The event-log `persist()` function re-reads `fresh.settings` from storage before saving (cross-store race mitigation). After `replace()`, if a subscriber triggers an event-log mutation, it would re-read and overwrite the just-imported settings. Mitigation: the import flow should not trigger any event-log mutations. The subscriber chain (re-renders) is read-only; only the import handler writes.

6. **`db.activityLog` not yet known to event-log store.** The event-log store's `persist()` function saves `db` — but the event-log store's `db` variable was initialized without `activityLog`. When `replace()` is called, it sets `db = migrateV1ToV2(blob)` which now includes `activityLog`. From that point forward, `persist()` saves `db` including `activityLog`. No data loss.

7. **Playwright `setInputFiles` on hidden input.** `display:none` is fine. Do NOT use `visibility:hidden` or `width:0; height:0` — Playwright requires the element to exist in DOM but does NOT require it to be visible.

8. **CSV encoding.** Polish characters (`ś`, `ę`, `ó`, etc.) in column headers. `FileReader.readAsText(file, 'UTF-8')` handles UTF-8 correctly. If the user's Excel exported a Windows-1250 file (rare for modern Excel), the header names will be garbled. Mitigation: the column mapper silently ignores unrecognized headers, so only recognized columns are imported. The user is not blocked; they just won't get the benefit of the Polish-header recognition.

9. **Empty activityLog in export.** If `db.activityLog` is `{}` (no activity data), JSON.stringify still includes it: `"activityLog":{}`. This is correct and harmless. Phase 7 will use this field; Phase 5 just ensures it round-trips.

10. **`newEventId()` must be called for each imported event.** The CSV parser returns events WITHOUT `id` fields. The import handler must map over `result.events` and assign IDs: `result.events.map(e => ({ ...e, id: newEventId() }))`. The JSON import does NOT need this — the exported JSON already has valid IDs.

---

## §Open Questions

None — the CONTEXT.md decisions (D5-01 through D5-17) resolved all scope questions. The `replace()` API design (Pattern A) and wave structure above are the only implementation-level choices, and both have clear justifications.

---

*Research written: 2026-06-28*
*Phase: NW-05-data-import-export*
*Based on: 05-CONTEXT.md decisions + direct codebase analysis*
