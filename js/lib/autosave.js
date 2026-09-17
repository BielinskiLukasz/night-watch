// js/lib/autosave.js
// Pure, dependency-injectable core of Autosave for Nightwatch — the pick →
// persist → restore → write round trip over the File System Access API,
// with a minimal inline IndexedDB handle-store wrapper (no npm package,
// per PLAT-01/CLAUDE.md's zero-runtime-dependency constraint).
//
// Mirrors js/lib/import-export.js's framing: a lib/ module with a
// documented I/O boundary (File System Access API + IndexedDB) instead of
// import-export.js's <a download> + URL.createObjectURL boundary.
//
// Decisions this module implements:
//   D-01: autosave reuses the manual-export filename convention exactly —
//         nightwatch-YYYY-MM-DD.json — via deriveAutosaveFilename.
//   D-02: autosave.js owns filename derivation (Option A); Plan 24-02's
//         app.js calls deriveAutosaveFilename and passes the result into
//         saveToDisk's filename parameter (Option B) — both satisfied.
//   D-04: no automatic cleanup/retention — saveToDisk always overwrites the
//         same day's file idempotently, never deletes anything.
//   D-05: saveToDisk never catches/swallows a write failure — rejections
//         propagate to the caller (Plan 24-02's app.js), which owns retry
//         and error-surfacing policy.
//   D-06: restoreHandle's permission branching — 'granted' passes through,
//         'prompt' re-prompts via requestPermission, 'denied' passes
//         through directly with NO re-prompt (never silently retried).
//
// Testability seam (mirrors createStorageLocal(key, ls = globalThis.localStorage)
// in js/adapters/storage-local.js): pickSaveDirectory/restoreHandle/
// removeSaveDirectory accept an optional { picker, store } options object;
// tests inject fakes, the runtime call sites (Plan 24-02's app.js) omit them
// and get the real globalThis.showDirectoryPicker + createIndexedDbHandleStore().

const DB_NAME = 'nightwatch-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'directoryHandle';

/** PLAT-02: debounce interval for autosave triggers (mirrors today-screen.js's DEBOUNCE_MS naming convention). */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/**
 * Minimal inline IndexedDB wrapper for persisting a FileSystemDirectoryHandle
 * (PLAT-01 — hand-rolled, no npm package). A single object store ('handles')
 * inside one database ('nightwatch-autosave', v1); the handle lives under one
 * fixed key. Each call opens the database via idbFactory.open(...); native
 * IDBRequest/transaction callback shapes are wrapped in Promises.
 *
 * Exercised for real only in the browser (Node has no IndexedDB global) —
 * unit tests exclusively exercise pickSaveDirectory/restoreHandle/
 * removeSaveDirectory via the injected `store` fake, never this function.
 *
 * @param {IDBFactory} [idbFactory]
 * @returns {{ get: () => Promise<any>, set: (handle: any) => Promise<void>, remove: () => Promise<void> }}
 */
export function createIndexedDbHandleStore(idbFactory = globalThis.indexedDB) {
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = idbFactory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async get() {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    },
    async set(handle) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async remove() {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

/**
 * Open the native directory picker and persist the returned handle.
 * PLAT-01 cancel-path edge: when the picker rejects (e.g. AbortError from
 * the user cancelling the native dialog), store.set() is never called and
 * the rejection propagates to the caller.
 *
 * @param {{ picker?: (opts: {mode: string}) => Promise<any>, store?: {set: (h: any) => Promise<void>} }} [opts]
 * @returns {Promise<any>} the picked FileSystemDirectoryHandle
 */
export async function pickSaveDirectory({ picker = globalThis.showDirectoryPicker, store } = {}) {
  const handle = await picker({ mode: 'readwrite' });
  await (store ?? createIndexedDbHandleStore()).set(handle);
  return handle;
}

/**
 * Retrieve the persisted directory handle and resolve its usable permission
 * status (PLAT-03, D-06).
 *
 * @param {{ store?: {get: () => Promise<any>} }} [opts]
 * @returns {Promise<{ handle: any|null, status: 'unset'|'granted'|'denied' }>}
 */
export async function restoreHandle({ store } = {}) {
  const resolvedStore = store ?? createIndexedDbHandleStore();
  const handle = await resolvedStore.get();
  if (handle === null) return { handle: null, status: 'unset' };

  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission === 'granted') return { handle, status: 'granted' };
  if (permission === 'denied') return { handle, status: 'denied' };

  // permission === 'prompt': re-prompt exactly once (D-06).
  const requested = await handle.requestPermission({ mode: 'readwrite' });
  return { handle, status: requested === 'granted' ? 'granted' : 'denied' };
}

/**
 * Write jsonString to filename inside the directory handle via the File
 * System Access API. Idempotent overwrite (D-01/D-04): two identical calls
 * leave the same single file with the same content — no duplication, no
 * append.
 *
 * D-05: deliberately no try/catch — a rejection from getFileHandle/
 * createWritable/write/close propagates to the caller, which owns retry
 * and error-surfacing policy.
 *
 * @param {any} handle FileSystemDirectoryHandle
 * @param {string} jsonString
 * @param {string} filename
 * @returns {Promise<void>}
 */
export async function saveToDisk(handle, jsonString, filename) {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(jsonString);
  await writable.close();
}

/**
 * Clear the persisted directory handle. Never throws when the store already
 * has no handle (remove() on an absent key is a no-op).
 *
 * @param {{ store?: {remove: () => Promise<void>} }} [opts]
 * @returns {Promise<void>}
 */
export async function removeSaveDirectory({ store } = {}) {
  await (store ?? createIndexedDbHandleStore()).remove();
}

// deriveAutosaveFilename, isFileSystemAccessSupported, createDebouncedAutosave
// are added in Task 2 (filename derivation, debounce, and support detection).
