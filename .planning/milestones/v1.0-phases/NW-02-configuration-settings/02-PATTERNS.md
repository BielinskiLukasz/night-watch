# Phase 2: Configuration & Settings - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12 (1 pure new pattern)

> **Note for the planner.** Phase 2 extends Phase 1's walking skeleton by adding configuration as a first-class data tier. The phase reuses Phase 1's established patterns (adapter seam, store API shape, pure validator, modal mechanics, DOM helpers) and applies them to settings. New work: a second store sharing the existing storage adapter, a v1→v2 schema migration, a subscriber/observer notification system, a pure validator mirroring Plan 01-07's shape, and wiring configuration values into the Today screen + manual-entry modal. All of Phase 1's analogs (composition root, storage adapter, event-log store, manual-entry modal, dom helpers) are directly reusable.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/store/settings.js` (NEW) | store (state coordination) | CRUD + subscriber | `js/store/event-log.js` (mutate-in-place + persist pattern) | exact role-match |
| `js/lib/settings-validate.js` (NEW) | utility (pure logic) | transform / validation | `js/ui/manual-entry.js` validate() export (D2-23 mirrors Plan 01-07) | exact pattern match |
| `js/lib/db-shape.js` (NEW) | utility (pure logic) | transform / migration | `js/adapters/storage-local.js` (error handling + null-coalesce pattern) | partial — migration logic is net-new, error handling idiom transfers |
| `js/lib/time.js` (EXTEND) | utility (pure logic) | transform | `js/lib/time.js` lines 1–89 (existing 24h ISO format + parsing) | same-file extension |
| `js/store/event-log.js` (MODIFY) | store (state coordination) | CRUD | self (no external analog needed — internal wiring to accept v2 schema) | self-reference |
| `js/ui/header.js` (NEW) | view (chrome element) | event-driven (settings subscriber) | `js/ui/today-screen.js` subscriber mount pattern (D2-09) | role-match |
| `js/ui/settings-modal.js` (NEW) | view (modal dialog) | event-driven (form submit + validation) | `js/ui/manual-entry.js` lines 1–150+ (native `<dialog>` + Form + validate pattern) | exact role-match |
| `js/ui/today-screen.js` (EXTEND) | view (rendering) | event-driven (settings subscriber + DOM clicks) | self + `js/ui/manual-entry.js` subscriber re-render (D2-09, D2-15) | same-file extension + pattern-match |
| `js/ui/manual-entry.js` (EXTEND) | view (modal dialog) | event-driven (settings subscriber + time format toggle) | self + `js/ui/today-screen.js` subscriber pattern (D2-19) | same-file extension + pattern-match |
| `js/app.js` (MODIFY) | composition root | one-shot wire-up at boot | self | self-reference |
| `index.html` (MODIFY) | view shell (entry) | request-response (browser load) | self + Phase 1 pattern | self-reference |
| `style.css` (MODIFY) | style | n/a | existing Phase 1 CSS | self-reference |

**Summary of analog coverage:**
- **Settings store (CRUD + subscriber):** `event-log.js` — mutate-in-place + persist idiom transfers exactly, subscriber is additive.
- **Pure validator:** Plan 01-07's `validate()` in `manual-entry.js` — return shape, error collection, and call-site injection pattern all transfer.
- **Schema migration:** `storage-local.js` error-handling idiom (null-coalesce, try/catch, console.warn) transfers; v1→v2 logic is net-new.
- **12h time conversion:** `time.js` string-slice + arithmetic pattern (lines 1–89) extends; conversion helpers are straightforward arithmetic.
- **Native dialog + form handling:** `manual-entry.js` is the direct analog for `settings-modal.js`; both use `<dialog method="dialog">`, `FormData`, and subscriber re-render.
- **Header + reactive subscriber:** `today-screen.js` subscriber pattern extends to `header.js`; both mount via snapshot + subscribe.

---

## Pattern Assignments

### `js/store/settings.js` (store, CRUD + subscriber)

**Analog:** `js/store/event-log.js` lines 52–195

**Constructor signature and load pattern** (event-log.js lines 52–62):
```javascript
export function createEventLog({ storage, clock, id }) {
  let db = storage.load();
  if (db === null) {
    db = { version: SCHEMA_VERSION, events: [] };
  }
  if (db.version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${db.version}`);
  }
  const persist = () => storage.save(db);
```

**Apply to settings.js:**
- Constructor: `createSettingsStore({ storage, defaults? })`
- Load once at construction; in-memory `db` is the working copy
- Schema version check happens AFTER migration (Phase 2's D2-05 raises version 1→2)
- Whole-blob rewrite on every `update()` (inherited from event-log's `persist()` pattern)

**Mutate-in-place + persist pattern** (event-log.js lines 123–138):
```javascript
editEvent(eventId, patch) {
  const i = db.events.findIndex((e) => e.id === eventId);
  if (i === -1) throw new Error(`Event not found: ${eventId}`);
  const next = { ...db.events[i], ...patch };
  // ... validation ...
  db.events[i] = next;  // Mutate-in-place at SAME index
  persist();            // Write whole blob
  return next;
}
```

**Apply to settings.js:**
- `update(patch)` does spread-merge: `db.settings = { ...db.settings, ...patch }`
- Call `storage.save(db)` (whole-blob rewrite, same as event-log)
- Return an `Object.freeze`'d snapshot for the caller
- No edit-creates-duplicate risk (Pitfall #6) because settings is a single object, not an array

**Defensive copy + Object.freeze pattern** (event-log.js lines 165–167):
```javascript
listEvents() {
  return [...db.events];  // Defensive copy
}
```

**Apply to settings.js:**
- `get()` returns `Object.freeze({ ...db.settings })` (D2-07)
- Caller cannot mutate the returned snapshot

**Subscriber/observer pattern (NEW to event-log, added in Phase 2):**

Phase 1 event-log does NOT have subscribers. Phase 2 adds them to settings-store:
```javascript
const subscribers = new Set();

return {
  get: () => Object.freeze({ ...db.settings }),
  update(patch) {
    db.settings = { ...db.settings, ...patch };
    storage.save(db);
    const next = Object.freeze({ ...db.settings });
    for (const fn of subscribers) fn(next);  // Fire synchronously
    return next;
  },
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);     // Unsubscribe function
  },
};
```

---

### `js/lib/settings-validate.js` (utility, pure validation)

**Analog:** `js/ui/manual-entry.js` lines 91–150+ (the `validate()` export)

**Return shape and error collection** (manual-entry.js lines 91–150):
```javascript
export function validate({ date, hourStr, minuteStr, type }, { now }) {
  const errors = [];
  // Collect all errors before returning
  if (!date) {
    errors.push({ field: 'date', message: 'Date is required.' });
  }
  // ... more checks ...
  return {
    ok: errors.length === 0,
    errors,
    atString: /* computed if ok */,
    type: /* computed if ok */,
  };
}
```

**Apply to settings-validate.js:**
- Pure function: `validateSettings(input, { mode?, defaults? })`
- Collect ALL errors before returning (don't early-exit)
- Return `{ ok: boolean, errors: [{field, message}], normalized: object }`
- Two modes (D2-22):
  - `mode: 'save'` (strict) — return errors for out-of-range values
  - `mode: 'load'` (lenient) — silently default per-field with `console.warn` prefix `[nightwatch]` (matching `storage-local.js` convention)

**Field validation pattern (manual-entry.js lines 109–128):**
```javascript
let hour = NaN;
if (hourStr !== '' && hourStr !== undefined && hourStr !== null) {
  hour = Number(hourStr);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    errors.push({ field: 'hour', message: 'Hour must be 0–23.' });
  }
}
```

**Apply to settings-validate.js:**
- Use a `RULES` object (frozen) mapping field name → validation rule
- Iterate over `RULES` entries, check each field independently
- Support multiple rule types: `'string'`, `'integer'`, `'enum'`, `'boolean'`
- Each rule carries metadata: `type`, `min`, `max`, `maxLen`, `values` (for enums)

**Recommended structure:**
```javascript
const RULES = Object.freeze({
  subjectName: { type: 'string', trim: true, maxLen: 40 },
  cutoverHour: { type: 'integer', min: 0, max: 23 },
  groupingMode: { type: 'enum', values: new Set(['calendar', 'sleepCycle']) },
  timeFormat: { type: 'enum', values: new Set(['24h', '12h']) },
  // ... more fields ...
});

function validateSettings(input, { mode = 'save', defaults = DEFAULT_SETTINGS } = {}) {
  const errors = [];
  const normalized = { ...defaults };
  for (const [field, rule] of Object.entries(RULES)) {
    const raw = input?.[field];
    const checked = checkField(field, raw, rule);
    if (checked.ok) {
      normalized[field] = checked.value;
    } else if (mode === 'save') {
      errors.push({ field, message: checked.message });
    } else {
      console.warn(`[nightwatch] settings.${field} invalid (${JSON.stringify(raw)})...`);
      normalized[field] = defaults[field];
    }
  }
  return { ok: errors.length === 0, errors, normalized };
}

function checkField(field, raw, rule) {
  switch (rule.type) {
    case 'string': /* ... */ break;
    case 'integer': /* ... */ break;
    case 'boolean': /* ... */ break;
    case 'enum': /* ... */ break;
  }
}
```

---

### `js/lib/db-shape.js` (utility, pure migration + schema helpers)

**Analog:** `js/adapters/storage-local.js` lines 38–62 (error handling + null-coalesce pattern)

**Null-coalesce + error-handling pattern** (storage-local.js lines 38–46):
```javascript
load() {
  try {
    const raw = ls.getItem(key);
    if (raw === null) return null;  // Null = no data, not an error
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[nightwatch] Could not parse ${key}; ignoring cache.`, e);
    return null;  // Treat parse error as "no data"
  }
}
```

**Apply to db-shape.js migration:**
- Accept `blob` (null/undefined means fresh install)
- Return a normalized v2 blob: `{ version: 2, settings: {...}, events: [...] }`
- Idempotent: a v2 blob passes through unchanged
- A v1 blob (no `settings` key) → inject `DEFAULT_SETTINGS`, bump version
- Unrecognized versions → throw (fail loudly, let caller handle recovery)
- Use `console.info('[nightwatch] migrating db v1 → v2...')` (info level, matching prefix)

**Recommended structure:**
```javascript
export function migrateV1ToV2(blob, defaultSettings) {
  if (blob === null || blob === undefined) {
    return { version: 2, settings: { ...defaultSettings }, events: [] };
  }
  if (blob.version === 2) return blob;
  if (blob.version === 1) {
    console.info('[nightwatch] migrating db v1 → v2 (injecting default settings)');
    return {
      version: 2,
      settings: { ...defaultSettings },
      events: Array.isArray(blob.events) ? blob.events : [],
    };
  }
  throw new Error(`Unsupported schema version: ${blob.version}`);
}
```

**Where migration is called (composition root integration):**
Per D2-08, option (b): migration happens in `js/app.js` before stores are constructed. Each store calls `createSettingsStore` / `createEventLog`, which both call `migrateV1ToV2` on their internal `storage.load()` result. The first to load() normalizes and saves; the second to load() sees the un-normalized localStorage (lazy persist per D2-05, but once either store updates, the v2 blob is persisted for both).

---

### `js/lib/time.js` (EXTEND existing file)

**Analog:** `js/lib/time.js` lines 46–89 (existing 24h ISO parsing + rounding)

**Add two new exports for 12h conversion (D2-20, D2-09):**

```javascript
/**
 * Convert 12h HH + AM/PM string to 24h integer hour.
 * Inputs: hStr (e.g. '3', '12'), ampm (e.g. 'AM', 'PM').
 * Output: integer 0–23.
 *
 * Examples:
 *   to24h('12', 'AM') → 0   (midnight)
 *   to24h('12', 'PM') → 12  (noon)
 *   to24h('3', 'AM') → 3
 *   to24h('3', 'PM') → 15
 */
export function to24h(hStr, ampm) {
  const h = parseInt(hStr, 10);
  if (!Number.isFinite(h) || h < 1 || h > 12) throw new Error(`Invalid 12h hour: ${hStr}`);
  if (ampm === 'AM') return h === 12 ? 0 : h;
  if (ampm === 'PM') return h === 12 ? 12 : h + 12;
  throw new Error(`Invalid AM/PM: ${ampm}`);
}

/**
 * Convert 24h integer hour to {h12: integer 1–12, ampm: 'AM'|'PM'}.
 *
 * Examples:
 *   to12h(0) → {h12: 12, ampm: 'AM'}   (midnight)
 *   to12h(12) → {h12: 12, ampm: 'PM'}  (noon)
 *   to12h(3) → {h12: 3, ampm: 'AM'}
 *   to12h(15) → {h12: 3, ampm: 'PM'}
 */
export function to12h(h24) {
  if (!Number.isInteger(h24) || h24 < 0 || h24 > 23) throw new Error(`Invalid 24h hour: ${h24}`);
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { h12, ampm };
}

/**
 * Format the time portion of a canonical 'YYYY-MM-DDTHH:MM' for display.
 * Ignores date portion — caller already has it.
 *
 * 24h: 'HH:MM'       e.g. '03:50', '18:25'
 * 12h: 'H:MM AM/PM'  e.g. '3:50 AM', '6:25 PM', '12:00 AM', '12:00 PM'
 *
 * String-based — never constructs a Date — preserves DST safety (Pitfall #3).
 */
export function formatTime(at, timeFormat) {
  const hh = at.slice(11, 13);
  const mm = at.slice(14, 16);
  if (timeFormat === '24h') return `${hh}:${mm}`;
  const h24 = parseInt(hh, 10);
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${mm} ${ampm}`;
}
```

**Integration notes:**
- No changes to existing `roundTo5`, `formatLocalISO`, `parseLocalISO` functions
- All three new exports are string-based — no Date construction (matches existing time.js discipline per Pitfall #3)
- `formatTime` is called from `today-screen.js` when rendering event rows with `snap.timeFormat`
- `to24h` / `to12h` are called from `manual-entry.js` when converting form inputs

---

### `js/ui/header.js` (NEW view, settings subscriber)

**Analog:** `js/ui/today-screen.js` lines 71–100 (mount pattern + settings subscriber integration per D2-09, added in Phase 2)

**Mount signature and subscriber pattern:**
```javascript
export function mountHeader({ root, settings }) {
  const h1 = root.querySelector('h1.subjectName');
  const trigger = root.querySelector('button.settingsTrigger');

  const apply = (snap) => {
    h1.textContent = snap.subjectName;
    document.title = snap.subjectName ? `Nightwatch — ${snap.subjectName}` : 'Nightwatch';
  };
  apply(settings.get());                  // Initial render
  settings.subscribe(apply);              // Re-render on update

  trigger.addEventListener('click', () => openSettings({ settings }));
}
```

**Key differences from today-screen:**
- Header is static HTML (no JS-generated children), so mount only updates `textContent` and `document.title`
- Single subscriber callback `apply()` handles both fields (`subjectName` + `document.title`)
- Gear icon click opens the Settings modal (imported from `./settings-modal.js`)

---

### `js/ui/settings-modal.js` (NEW view, native dialog + form validation)

**Analog:** `js/ui/manual-entry.js` lines 1–250+ (native `<dialog>`, FormData reading, validate call, error rendering)

**Dialog + form + close handler pattern** (manual-entry.js sketch):
```javascript
export function openManualEntry({ eventLog, clock }) {
  const dlg = document.getElementById('manualEntry');
  const form = dlg.querySelector('form');
  // ... populate fields from current state or defaults ...
  
  const onClose = () => {
    if (dlg.returnValue !== 'save') return;
    const data = new FormData(form);
    const result = validate(/* extracted data */, { now: clock.now });
    if (!result.ok) {
      // Re-render errors, re-show modal, focus first error field
      // ... error handling ...
      queueMicrotask(() => { dlg.showModal(); });
      return;
    }
    // Success: call eventLog.addEventAt(), close modal
    eventLog.addEventAt(result.type, result.atString);
  };
  dlg.addEventListener('close', onClose, { once: true });
  dlg.showModal();
}
```

**Apply to settings-modal.js:**
```javascript
export function openSettings({ settings }) {
  const dlg = document.getElementById('settings');
  const form = dlg.querySelector('form');
  const errorsEl = dlg.querySelector('#settingsErrors');
  const snap = settings.get();

  // Populate every field from snap (use .value / .checked, never innerHTML)
  form.elements.namedItem('subjectName').value = snap.subjectName;
  form.elements.namedItem('cutoverHour').value = String(snap.cutoverHour);
  form.elements.namedItem('groupingMode').value = snap.groupingMode;
  form.elements.namedItem('timeFormat').value = snap.timeFormat;
  form.elements.namedItem('autoOutlier').checked = snap.autoOutlier;
  form.elements.namedItem('maxDelta').value = String(snap.maxDelta);
  form.elements.namedItem('minDays').value = String(snap.minDays);
  form.elements.namedItem('windowDays').value = String(snap.windowDays);
  form.elements.namedItem('statBlend').value = snap.statBlend;

  if (errorsEl) clear(errorsEl);

  const onClose = () => {
    if (dlg.returnValue !== 'save') return;
    const data = new FormData(form);
    const raw = {
      subjectName: String(data.get('subjectName') ?? '').trim(),
      cutoverHour: Number(data.get('cutoverHour')),
      groupingMode: String(data.get('groupingMode') ?? ''),
      timeFormat: String(data.get('timeFormat') ?? ''),
      autoOutlier: data.get('autoOutlier') === 'on',  // checkbox → boolean
      maxDelta: Number(data.get('maxDelta')),
      minDays: Number(data.get('minDays')),
      windowDays: Number(data.get('windowDays')),
      statBlend: String(data.get('statBlend') ?? ''),
    };

    const result = validateSettings(raw, { mode: 'save' });
    if (!result.ok) {
      // Re-render errors, re-show modal
      if (errorsEl) {
        clear(errorsEl);
        for (const err of result.errors) {
          errorsEl.appendChild(el('p', { 'data-field': err.field, textContent: err.message }));
        }
      }
      queueMicrotask(() => {
        dlg.showModal();
        dlg.addEventListener('close', onClose, { once: true });
        const first = form.elements.namedItem(result.errors[0]?.field);
        if (first && first.focus) try { first.focus(); } catch {}
      });
      return;
    }

    settings.update(result.normalized);  // Fires subscribers synchronously
    // Modal is already closed (returnValue === 'save')
  };
  dlg.addEventListener('close', onClose, { once: true });

  const cancelBtn = dlg.querySelector('#settingsCancel');
  const onCancel = () => dlg.close('cancel');
  cancelBtn.addEventListener('click', onCancel, { once: true });

  dlg.showModal();
}
```

**Key patterns:**
- Error rendering uses `el('p', { 'data-field': field, textContent: message })` (matches Plan 01-07's inline-error surface)
- Checkbox is read as `data.get('autoOutlier') === 'on'` (HTML5 checkbox idiom when no explicit `value` is set)
- Number inputs are coerced via `Number(data.get(...))` (trust the validator for bounds)
- `settings.update(result.normalized)` fires subscribers synchronously (D2-09) — no manual re-render needed, Today + header react automatically

---

### `js/ui/today-screen.js` (EXTEND with grouping toggle + settings subscriber)

**Analog:** `js/ui/today-screen.js` lines 71–100 (existing mount signature) + Phase 2's new subscriber pattern

**Current mountTodayScreen signature** (existing):
```javascript
export function mountTodayScreen({ root, eventLog }) { ... }
```

**Phase 2 extension (new parameter):**
```javascript
export function mountTodayScreen({ root, eventLog, settings }) {
  // ... existing quick-log row construction ...
  
  // NEW: Grouping-mode toggle above the day list
  const toggle = el('div', { className: 'groupingToggle', role: 'group', 'aria-label': 'Day grouping' });
  toggle.appendChild(el('button', { type: 'button', 'data-grouping': 'calendar', textContent: 'Calendar' }));
  toggle.appendChild(el('button', { type: 'button', 'data-grouping': 'sleepCycle', textContent: 'Sleep cycle' }));

  const reflectGrouping = (snap) => {
    for (const btn of toggle.querySelectorAll('button[data-grouping]')) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-grouping') === snap.groupingMode));
    }
  };
  reflectGrouping(settings.get());
  settings.subscribe((next) => { reflectGrouping(next); render(); });

  toggle.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-grouping]');
    if (!btn) return;
    const next = btn.getAttribute('data-grouping');
    if (next !== settings.get().groupingMode) {
      settings.update({ groupingMode: next });  // Commits-on-click (D2-16)
      // Subscriber chain handles aria-pressed + render — no manual call needed
    }
  });

  // ... rest of mount ...
  
  // NEW: render() reads from settings
  const render = () => {
    clear(dayList);
    const snap = settings.get();
    const days = snap.groupingMode === 'sleepCycle'
      ? eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)
      : eventLog.daysByCalendar(7);
    for (const day of days) {
      dayList.appendChild(renderDay(day, snap.timeFormat));
    }
  };
  
  // Render day row with time format applied
  const renderDay = (day, timeFormat) => {
    // ... existing day-header construction ...
    // Update event row time display:
    // OLD: const timeStr = hhmm(evt.at);
    // NEW: const timeStr = formatTime(evt.at, timeFormat);
  };

  // Initial render
  render();
}
```

**Key patterns:**
- `settings.subscribe((snap) => { render(); })` — re-render on any settings change (groupingMode, cutoverHour, timeFormat)
- Grouping toggle's commit-on-click behavior: `settings.update({ groupingMode: next })` → subscriber fires → `render()` automatically called
- `formatTime(evt.at, snap.timeFormat)` replaces the inline `hhmm()` helper (new import from `js/lib/time.js`)
- Cutover hour wiring: `eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)` (D2-17 — inject user setting instead of hardcoded 4)

---

### `js/ui/manual-entry.js` (EXTEND with 12h time picker + settings subscriber)

**Analog:** `js/ui/manual-entry.js` lines 1–250+ (existing form pattern) + Phase 2's time format subscriber

**Current signature** (existing):
```javascript
export function openManualEntry({ eventLog, clock }) { ... }
```

**Phase 2 extension (new parameter):**
```javascript
export function openManualEntry({ eventLog, clock, settings }) {
  const dlg = document.getElementById('manualEntry');
  const form = dlg.querySelector('form');
  // ... existing date + type fields ...
  
  // NEW: Time format subscriber for dynamic picker re-render
  const hourInput = form.elements.namedItem('hour');
  const minuteInput = form.elements.namedItem('minute');
  
  // Placeholder for AM/PM select (created dynamically when 12h mode is active)
  let ampmSelect = null;
  
  const applyTimeFormat = (snap) => {
    if (snap.timeFormat === '12h') {
      // Switch to 12h HH (1-12) + AM/PM
      hourInput.min = '1';
      hourInput.max = '12';
      // Create or show AM/PM select if not already present
      if (!ampmSelect) {
        ampmSelect = el('select', { name: 'ampm' });
        ampmSelect.appendChild(el('option', { value: 'AM', textContent: 'AM' }));
        ampmSelect.appendChild(el('option', { value: 'PM', textContent: 'PM' }));
        hourInput.parentNode.insertBefore(ampmSelect, hourInput.nextSibling);
      }
      // Convert existing hour value if present (e.g., 14 → 2 PM)
      if (hourInput.value) {
        const h24 = parseInt(hourInput.value, 10);
        if (Number.isFinite(h24) && h24 >= 0 && h24 <= 23) {
          const { h12, ampm } = to12h(h24);
          hourInput.value = String(h12);
          ampmSelect.value = ampm;
        }
      }
    } else {
      // Switch to 24h HH (0-23), remove AM/PM
      hourInput.min = '0';
      hourInput.max = '23';
      if (ampmSelect && ampmSelect.parentNode) {
        ampmSelect.parentNode.removeChild(ampmSelect);
        ampmSelect = null;
      }
      // Convert existing values if present (e.g., 2 AM → 02)
      if (hourInput.value && ampmSelect?.value) {
        const h24 = to24h(hourInput.value, ampmSelect.value);
        hourInput.value = String(h24);
      }
    }
  };
  
  applyTimeFormat(settings.get());
  settings.subscribe(applyTimeFormat);

  const onClose = () => {
    if (dlg.returnValue !== 'save') return;
    const data = new FormData(form);
    
    // Convert 12h → 24h if needed
    let hourStr = String(data.get('hour'));
    if (settings.get().timeFormat === '12h') {
      const h24 = to24h(hourStr, String(data.get('ampm')));
      hourStr = String(h24);
    }
    
    const result = validate({
      date: String(data.get('date') ?? ''),
      hourStr,
      minuteStr: String(data.get('minute') ?? ''),
      type: String(data.get('type') ?? ''),
    }, { now: clock.now });
    
    // ... rest of validation/error handling (same as Phase 1) ...
  };
  
  // ... rest of modal mechanics ...
}
```

**Key patterns:**
- AM/PM select is created dynamically only in 12h mode (no hardcoded HTML, keeps the modal markup clean)
- Time format subscriber (`applyTimeFormat`) runs on open and on every settings change
- Conversion helpers (`to24h`, `to12h`) are imported from `js/lib/time.js`
- Form submission converts 12h → 24h before calling the existing `validate()` function (keeps validator pure, UI layer handles format conversion)

---

### `js/store/event-log.js` (MODIFY schema version + migration seam)

**Analog:** `js/store/event-log.js` lines 36–61 (existing schema version check and load logic)

**Current code** (Phase 1):
```javascript
const SCHEMA_VERSION = 1;
// ...
let db = storage.load();
if (db === null) {
  db = { version: SCHEMA_VERSION, events: [] };
}
if (db.version !== SCHEMA_VERSION) {
  throw new Error(`Unsupported schema version: ${db.version}`);
}
```

**Phase 2 modification:**
```javascript
const SCHEMA_VERSION = 2;  // Raise from 1 to 2
// ...
import { migrateV1ToV2 } from '../lib/db-shape.js';
import { DEFAULT_SETTINGS } from './settings.js';  // OR import from db-shape.js
// ...
let db = migrateV1ToV2(storage.load(), DEFAULT_SETTINGS);
if (db.version !== SCHEMA_VERSION) {
  throw new Error(`Unsupported schema version: ${db.version}`);
}
```

**Key invariant:**
- Migration happens BEFORE the version check
- Event-log doesn't care about the contents of `db.settings` — it just preserves the slot
- The `persist()` function already writes the whole blob including `db.settings`; no changes needed

---

### `js/app.js` (MODIFY composition root)

**Analog:** `js/app.js` lines 11–21 (existing composition root pattern)

**Current code** (Phase 1):
```javascript
import { createStorageLocal } from './adapters/storage-local.js';
import { createClockSystem } from './adapters/clock-system.js';
import { newEventId } from './lib/id.js';
import { createEventLog } from './store/event-log.js';
import { mountTodayScreen } from './ui/today-screen.js';

const storage = createStorageLocal('nightwatch:db');
const clock = createClockSystem();
const eventLog = createEventLog({ storage, clock, id: newEventId });

mountTodayScreen({ root: document.getElementById('app'), eventLog });
```

**Phase 2 extension:**
```javascript
import { createStorageLocal } from './adapters/storage-local.js';
import { createClockSystem } from './adapters/clock-system.js';
import { newEventId } from './lib/id.js';
import { createEventLog } from './store/event-log.js';
import { createSettingsStore } from './store/settings.js';
import { mountTodayScreen } from './ui/today-screen.js';
import { mountHeader } from './ui/header.js';
import { openSettings } from './ui/settings-modal.js';

const storage = createStorageLocal('nightwatch:db');
const clock = createClockSystem();
const settings = createSettingsStore({ storage });  // NEW
const eventLog = createEventLog({ storage, clock, id: newEventId });

mountHeader({
  root: document.querySelector('header.appHeader'),
  settings,
});
mountTodayScreen({
  root: document.getElementById('app'),
  eventLog,
  settings,  // NEW
});
```

**Key invariant:**
- Both stores are constructed with the SAME `storage` instance (D2-08)
- Settings store is constructed FIRST (or order doesn't matter — both call `migrateV1ToV2` independently)
- Header is mounted before Today screen (optional ordering, but logical)
- Composition root is the only place adapters are constructed and injected

---

### `index.html` (MODIFY, add header + settings dialog)

**Analog:** Phase 1's `index.html` (existing body structure) + `js/ui/manual-entry.js` dialog pattern

**Current structure** (Phase 1 lines 20–96):
```html
<body>
  <main id="app">
    <div class="quickLog">...</div>
    <section class="dayList" data-role="events"></section>
    <button type="button" id="addEventBtn" class="addEventBtn">+ Add event</button>
  </main>

  <dialog id="manualEntry" aria-labelledby="manualEntryTitle">
    <form method="dialog">...</form>
  </dialog>

  <script type="module" src="js/app.js"></script>
</body>
```

**Phase 2 additions:**

Add BEFORE `<main>`:
```html
<header class="appHeader">
  <h1 class="subjectName"></h1>
  <button type="button" class="settingsTrigger" aria-label="Settings">
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <!-- inline SVG gear icon, minimal outline style -->
      <path d="M12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l1.11-.83c.1-.08.12-.21.05-.32l-1.05-1.82c-.05-.09-.27-.12-.39-.06l-1.31.99c-.27-.2-.56-.39-.86-.54l-.2-1.36c-.02-.11-.13-.19-.24-.19h-2.1c-.12 0-.23.08-.25.19l-.2 1.36c-.3.15-.59.34-.86.54l-1.31-.99c-.12-.06-.34-.03-.39.06l-1.05 1.82c-.07.11-.05.24.05.32l1.11.83c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-1.11.83c-.1.08-.12.21-.05.32l1.05 1.82c.05.09.27.12.39.06l1.31-.99c.27.2.56.39.86.54l.2 1.36c.02.11.13.19.24.19h2.1c.12 0 .23-.08.25-.19l.2-1.36c.3-.15.59-.34.86-.54l1.31.99c.12.06.34.03.39-.06l1.05-1.82c.07-.11.05-.24-.05-.32l-1.11-.83z" fill="currentColor"/>
    </svg>
  </button>
</header>
```

Add AFTER `<dialog id="manualEntry">`:
```html
<dialog id="settings" aria-labelledby="settingsTitle">
  <form method="dialog">
    <h2 id="settingsTitle">Settings</h2>
    
    <fieldset>
      <legend>Profile</legend>
      <label>Subject name
        <input type="text" name="subjectName" maxlength="40">
      </label>
    </fieldset>
    
    <fieldset>
      <legend>Time &amp; Day</legend>
      <label>Day cutover hour
        <input type="number" name="cutoverHour" min="0" max="23">
      </label>
      <label>View grouping
        <select name="groupingMode">
          <option value="calendar">Calendar</option>
          <option value="sleepCycle">Sleep cycle</option>
        </select>
      </label>
      <label>Time format
        <select name="timeFormat">
          <option value="24h">24-hour</option>
          <option value="12h">12-hour</option>
        </select>
      </label>
    </fieldset>
    
    <fieldset>
      <legend>Forecast tuning</legend>
      <label><input type="checkbox" name="autoOutlier"> Automatic outlier detection</label>
      <label>Max delta (minutes)
        <input type="number" name="maxDelta" min="5" max="120">
      </label>
      <label>Min days
        <input type="number" name="minDays" min="1" max="90">
      </label>
      <label>Rolling window (days)
        <input type="number" name="windowDays" min="3" max="90">
      </label>
      <label>Statistical blend
        <select name="statBlend">
          <option value="median">Median</option>
          <option value="mean">Mean</option>
          <option value="blend">Blend</option>
        </select>
      </label>
    </fieldset>
    
    <output id="settingsErrors" aria-live="polite"></output>
    
    <menu>
      <button type="button" id="settingsCancel">Cancel</button>
      <button type="submit" value="save">Save</button>
    </menu>
  </form>
</dialog>
```

**Key patterns:**
- Header is static markup (JS only updates `textContent` + event listeners)
- Settings dialog uses native `<dialog method="dialog">` (reuses manual-entry pattern)
- Fieldsets group settings logically (Profile, Time & Day, Forecast tuning)
- No inline `<style>` — CSS comes from external `style.css`

---

## Shared Patterns

### Authentication / Authorization
Not applicable to Phase 2 — settings are not access-controlled.

### Error Handling
**Source:** `js/adapters/storage-local.js` lines 38–62

**Apply to:** Settings validation + settings-store loading
- Strict on save: `validateSettings(input, {mode:'save'})` returns errors for invalid data; the UI Save handler calls this before `settings.update()`
- Lenient on load: `validateSettings(input, {mode:'load'})` silently defaults per-field with `console.warn('[nightwatch] settings.${field} invalid...')`
- Migration handles unsupported schema versions: throw `new Error('Unsupported schema version: ...')`

### Validation
**Source:** Plan 01-07 (`js/ui/manual-entry.js` lines 91–160)

**Apply to:** All form-submission handlers (Settings Save button)
- Pure function: `validateSettings(input, {mode?, defaults?})`
- Collect ALL errors before returning (don't early-exit on first error)
- Return `{ ok: boolean, errors: [{field, message}], normalized: object }`
- Called from UI Save handler (strict mode) AND settings-store loader (lenient mode)

### Persistence
**Source:** `js/store/event-log.js` (mutate-in-place + whole-blob rewrite pattern)

**Apply to:** Settings store
- Load once at construction; in-memory `db` is the working copy
- Mutate-in-place: `db.settings = { ...db.settings, ...patch }`
- Whole-blob rewrite on every update: `storage.save(db)` (preserves `db.events` alongside `db.settings`)
- Lazy persist: don't save on initial load; first `update()` or `editEvent()` writes the blob

### Subscriber / Observer Pattern
**Source:** Phase 2 innovation, mirroring event-driven patterns from Phase 1

**Apply to:** Settings store + reactive UI mounts
- Settings store exports: `subscribe(fn): unsubscribe`
- Subscribers fire synchronously after every successful `update()`
- Mount functions call `const unsub = settings.subscribe(redraw); return () => unsub();` at unmount
- Redraws preserve partially-entered form values (e.g., manual-entry time picker when format toggles mid-edit)

### Testing
**Source:** Phase 1's test structure (`tests/unit/`, `tests/integration/`, `tests/e2e/`)

**Apply to Phase 2:**
- **Unit tests** (`tests/unit/settings-validate.test.js`, `tests/unit/db-shape.test.js`): pure-logic validators and migration helpers, no DOM/storage I/O
- **Integration tests** (`tests/integration/settings-store.test.js`, `tests/integration/v1-to-v2-migration.test.js`): wire settings-store with fake storage, assert get/update/subscribe + persistence
- **E2E tests** (`tests/e2e/settings-modal.spec.js`, `tests/e2e/grouping-toggle.spec.js`): browser automation via Playwright, cover all CFG-* requirements per D2-27 (D-22 coverage matrix carried forward from Phase 1)

---

## No Analog Found

All files in Phase 2 have close analogs from Phase 1 or are straightforward extensions. No file type is entirely new — even the migration helper (`db-shape.js`) reuses Phase 1's error-handling idiom. Confidence level: **HIGH**.

---

## Metadata

**Analog search scope:**
- Phase 1 source: `js/store/event-log.js`, `js/adapters/storage-local.js`, `js/ui/manual-entry.js`, `js/ui/today-screen.js`, `js/ui/dom.js`, `js/lib/time.js`, `js/app.js`, `index.html`
- Test scaffold: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- Reference app: `../mindful-breathing/` (not directly consulted; Phase 1 patterns already adapted)

**Files scanned:** 12 Phase 2 files (new/modified) vs ~26 Phase 1 files (source + test + config)

**Pattern extraction date:** 2026-05-28

---

**Status:** Ready for Phase 2 planner.
**Next step:** Planner consumes this PATTERNS.md and produces `.planning/phases/NW-02-configuration-settings/02-PLAN.md` with per-task action sections referencing the analog files and code excerpts above.
