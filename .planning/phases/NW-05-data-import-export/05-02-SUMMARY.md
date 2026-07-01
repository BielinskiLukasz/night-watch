---
plan: 05-02
phase: NW-05-data-import-export
status: complete
completed: 2026-06-28
commits:
  - 4809211  # test(05-02): add failing integration test for store replace() [RED]
  - 38daefd  # feat(05-02): add replace() to event-log and settings stores [GREEN]
tests_delta: "+7 integration (import-export-flow) | 5 existing tests updated for activityLog schema"
---

# Plan 05-02 Summary: Store replace() API

## What Was Built

**js/store/event-log.js** — `replace(blob)` method added:
- Calls `migrateV1ToV2(blob, DEFAULT_SETTINGS)` → version check → `storage.save(db)` → `notifySubscribers()`
- v1 blobs accepted (silently migrated); v3+ throws `Error: Unsupported schema version after migration: N`
- Subscriber registrations from boot-time wiring in app.js are preserved (Pattern A from RESEARCH.md — mutate shared db in place, do NOT re-create stores)

**js/store/settings.js** — `replace(blob)` method added:
- Calls `migrateV1ToV2(blob, defaults)` → `validateSettings(mode:'load')` for normalization → `storage.save(db)` → fires all subscribers with new snapshot
- Missing/invalid settings fields fall back to defaults (validateSettings mode:'load' semantics)

## Test Results

- `node --test tests/integration/import-export-flow.test.js`: **7/7 pass** (new file)
- `node --test tests/integration/*.test.js`: **140/140 pass** (0 regressions)

## Deviations

5 pre-existing integration tests updated to include `activityLog: {}` in expected blob shape — this is a direct consequence of Plan 05-01's `migrateV1ToV2` patch (D5-17). The tests were asserting the full canonical blob shape via `deepEqual`; updating them is the correct response (not a regression, the canonical shape legitimately changed).

Files updated: `persistence.test.js` (1 assertion), `event-log.test.js` (v2Snapshot helper), `manual-entry.test.js` (1 assertion).
