// js/adapters/storage-memory.js
// In-memory StorageAdapter test double.
//
// Source: 01-RESEARCH.md §Pattern 3.
// Deep-clones via JSON on every load/save so test mutations cannot bleed
// through the boundary — mirrors the serialize/deserialize boundary the
// real storage adapter enforces.

/**
 * @param {object|null} initial
 * @returns {{ load: () => object|null, save: (db: object) => void, _snapshot: () => object|null }}
 */
export function createStorageMemory(initial = null) {
  let blob = initial === null ? null : JSON.parse(JSON.stringify(initial));
  return {
    load() {
      return blob === null ? null : JSON.parse(JSON.stringify(blob));
    },
    save(db) {
      blob = JSON.parse(JSON.stringify(db));
    },
    // Test-only inspector — NOT part of the StorageAdapter contract (D-07).
    _snapshot() {
      return blob === null ? null : JSON.parse(JSON.stringify(blob));
    },
  };
}
