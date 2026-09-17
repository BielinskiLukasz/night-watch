// tests/unit/autosave.test.js
// Source: .planning/phases/24-autosave/24-01-PLAN.md Task 1 <behavior>
//
// Strategy: hand-rolled fake doubles (no mocking library — project has zero
// npm runtime dependencies). Mirrors tests/integration/persistence.test.js's
// makeFakeLS style: a plain-object-backed fake, not a class or library mock.
//
// Node has no IndexedDB global, so createIndexedDbHandleStore is exercised
// for real only in the browser (E2E, Plan 24-03). These unit tests exclusively
// exercise pickSaveDirectory/restoreHandle/saveToDisk via the injected `store`
// and `handle` fakes.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  pickSaveDirectory,
  restoreHandle,
  saveToDisk,
  removeSaveDirectory,
} from '../../js/lib/autosave.js';

// -------------------- fakes --------------------

// Fake handle-store, backed by a plain variable (mirrors makeFakeLS's plain
// object backing). get/set/remove are all async to match the real
// createIndexedDbHandleStore contract.
function makeFakeStore(initialHandle = null) {
  let current = initialHandle;
  const calls = [];
  return {
    calls,
    async get() {
      calls.push(['get']);
      return current;
    },
    async set(handle) {
      calls.push(['set', handle]);
      current = handle;
    },
    async remove() {
      calls.push(['remove']);
      current = null;
    },
  };
}

// Fake FileSystemDirectoryHandle double. `files` is the in-memory Map the
// read-back assertions inspect directly (the tracer's "confirm read-back"
// step) instead of re-implementing the write logic in the test.
function makeFakeHandle({
  name = 'TestDir',
  queryPermissionResult = 'granted',
  requestPermissionResult = 'granted',
  createWritableRejection = null,
  writeRejection = null,
} = {}) {
  const files = new Map();
  const calls = [];
  return {
    name,
    files,
    calls,
    async queryPermission(opts) {
      calls.push(['queryPermission', opts]);
      return queryPermissionResult;
    },
    async requestPermission(opts) {
      calls.push(['requestPermission', opts]);
      return requestPermissionResult;
    },
    async getFileHandle(filename, opts) {
      calls.push(['getFileHandle', filename, opts]);
      return {
        async createWritable() {
          calls.push(['createWritable']);
          if (createWritableRejection) throw createWritableRejection;
          return {
            async write(content) {
              calls.push(['write', content]);
              if (writeRejection) throw writeRejection;
              files.set(filename, content);
            },
            async close() {
              calls.push(['close']);
            },
          };
        },
      };
    },
  };
}

// -------------------- pickSaveDirectory (PLAT-01) --------------------

describe('pickSaveDirectory', () => {
  test('calls picker({mode:"readwrite"}), persists handle via store.set, returns handle', async () => {
    const handle = makeFakeHandle();
    const store = makeFakeStore();
    let pickerArgs = null;
    const picker = async (opts) => {
      pickerArgs = opts;
      return handle;
    };

    const result = await pickSaveDirectory({ picker, store });

    assert.deepEqual(pickerArgs, { mode: 'readwrite' }, 'picker called with readwrite mode');
    assert.equal(result, handle, 'returns the picked handle');
    assert.deepEqual(store.calls, [['set', handle]], 'store.set called exactly once with the handle');
  });

  test('rejects and does NOT call store.set when the picker rejects (cancel-path edge)', async () => {
    const store = makeFakeStore();
    const cancelError = new Error('AbortError');
    cancelError.name = 'AbortError';
    const picker = async () => {
      throw cancelError;
    };

    await assert.rejects(() => pickSaveDirectory({ picker, store }), /AbortError/);
    assert.deepEqual(store.calls, [], 'store.set never called after a picker rejection');
  });
});

// -------------------- restoreHandle (PLAT-03, D-06) --------------------

describe('restoreHandle', () => {
  test('returns {handle:null, status:"unset"} when store.get() resolves null', async () => {
    const store = makeFakeStore(null);

    const result = await restoreHandle({ store });

    assert.deepEqual(result, { handle: null, status: 'unset' });
  });

  test('returns {handle, status:"granted"} when queryPermission resolves "granted"', async () => {
    const handle = makeFakeHandle({ queryPermissionResult: 'granted' });
    const store = makeFakeStore(handle);

    const result = await restoreHandle({ store });

    assert.equal(result.handle, handle);
    assert.equal(result.status, 'granted');
    assert.deepEqual(
      handle.calls.filter((c) => c[0] === 'requestPermission'),
      [],
      'requestPermission must NOT be called when already granted',
    );
  });

  test('calls requestPermission ONLY when queryPermission resolves "prompt"; granted re-prompt maps to status "granted"', async () => {
    const handle = makeFakeHandle({ queryPermissionResult: 'prompt', requestPermissionResult: 'granted' });
    const store = makeFakeStore(handle);

    const result = await restoreHandle({ store });

    assert.equal(result.status, 'granted');
    assert.deepEqual(handle.calls[1], ['requestPermission', { mode: 'readwrite' }]);
  });

  test('calls requestPermission when queryPermission resolves "prompt"; declined re-prompt maps to status "denied"', async () => {
    const handle = makeFakeHandle({ queryPermissionResult: 'prompt', requestPermissionResult: 'denied' });
    const store = makeFakeStore(handle);

    const result = await restoreHandle({ store });

    assert.equal(result.status, 'denied');
    assert.deepEqual(handle.calls[1], ['requestPermission', { mode: 'readwrite' }]);
  });

  test('returns {handle, status:"denied"} directly (no re-prompt) when queryPermission already resolves "denied" (D-06)', async () => {
    const handle = makeFakeHandle({ queryPermissionResult: 'denied' });
    const store = makeFakeStore(handle);

    const result = await restoreHandle({ store });

    assert.equal(result.handle, handle);
    assert.equal(result.status, 'denied');
    assert.deepEqual(
      handle.calls.filter((c) => c[0] === 'requestPermission'),
      [],
      'requestPermission must NEVER be called when already denied',
    );
  });
});

// -------------------- saveToDisk (PLAT-02) --------------------

describe('saveToDisk', () => {
  test('calls getFileHandle, then createWritable, then write, then close — in order', async () => {
    const handle = makeFakeHandle();
    const jsonString = '{"version":2,"events":[]}';
    const filename = 'nightwatch-2026-06-27.json';

    await saveToDisk(handle, jsonString, filename);

    assert.deepEqual(handle.calls, [
      ['getFileHandle', filename, { create: true }],
      ['createWritable'],
      ['write', jsonString],
      ['close'],
    ]);
  });

  test('read-back: after saveToDisk resolves, the fake file map contains exactly jsonString for filename', async () => {
    const handle = makeFakeHandle();
    const jsonString = '{"version":2,"events":[{"id":"e1"}]}';
    const filename = 'nightwatch-2026-06-27.json';

    await saveToDisk(handle, jsonString, filename);

    assert.equal(handle.files.get(filename), jsonString);
  });

  test('calling saveToDisk twice with identical args leaves exactly one file entry with unchanged content (D-01/D-04 idempotent overwrite)', async () => {
    const handle = makeFakeHandle();
    const jsonString = '{"version":2,"events":[]}';
    const filename = 'nightwatch-2026-06-27.json';

    await saveToDisk(handle, jsonString, filename);
    await saveToDisk(handle, jsonString, filename);

    assert.equal(handle.files.size, 1, 'still exactly one entry for this filename');
    assert.equal(handle.files.get(filename), jsonString, 'content unchanged');
  });

  test('propagates (does not catch) a rejection thrown by createWritable()', async () => {
    const writeError = new Error('createWritable failed');
    const handle = makeFakeHandle({ createWritableRejection: writeError });

    await assert.rejects(
      () => saveToDisk(handle, '{}', 'nightwatch-2026-06-27.json'),
      /createWritable failed/,
    );
  });

  test('propagates (does not catch) a rejection thrown by write()', async () => {
    const writeError = new Error('write failed');
    const handle = makeFakeHandle({ writeRejection: writeError });

    await assert.rejects(
      () => saveToDisk(handle, '{}', 'nightwatch-2026-06-27.json'),
      /write failed/,
    );
  });
});

// -------------------- removeSaveDirectory --------------------

describe('removeSaveDirectory', () => {
  test('calls store.remove() exactly once and resolves without throwing', async () => {
    const store = makeFakeStore(makeFakeHandle());

    await assert.doesNotReject(() => removeSaveDirectory({ store }));
    assert.deepEqual(store.calls, [['remove']]);
  });

  test('never throws when the store already has no handle', async () => {
    const store = makeFakeStore(null);

    await assert.doesNotReject(() => removeSaveDirectory({ store }));
  });
});
