// js/adapters/storage-local.js
// Real StorageAdapter backed by window.localStorage.
//
// Source: 01-RESEARCH.md §Pattern 2; 01-PATTERNS.md Pattern D
// (try/catch idiom from ../mindful-breathing/index.html lines 1316-1353).
// Threat references: T-03 (corrupted blob), T-04 (quota exceeded).
//
// Phase 1 error policy:
//   - load(): try/catch around getItem + JSON.parse — corrupted blob is
//     treated as "no data" with a console.warn (T-03 mitigation; Phase 5
//     import is the recovery path).
//   - save(): try/catch around setItem — QuotaExceededError (DOMException
//     code 22 OR name 'QuotaExceededError') is translated into a friendly
//     thrown Error so the UI can surface "Storage full" to the user.
//     Other errors are re-thrown unchanged (fail loudly).
//
// Divergence from mindful-breathing: that app silently swallows both load
// and save errors because settings are throwaway. Nightwatch sleep data is
// the user's primary artifact — silent save loss is unacceptable.

/**
 * @param {string} key storage key passed by the composition root (D-02)
 * @returns {{ load: () => object|null, save: (db: object) => void }}
 */
export function createStorageLocal(key) {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw);
      } catch (e) {
        console.warn(`[nightwatch] Could not parse ${key}; ignoring cache.`, e);
        return null;
      }
    },
    save(db) {
      try {
        localStorage.setItem(key, JSON.stringify(db));
      } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          // T-04 mitigation. Phase 5 export/import gives the user a real
          // recovery path; for now we surface a non-recoverable error so
          // sleep data is never silently lost.
          throw new Error('Storage full. Export and clear before continuing.');
        }
        throw e;
      }
    },
  };
}
