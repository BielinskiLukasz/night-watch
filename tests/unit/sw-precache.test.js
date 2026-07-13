// tests/unit/sw-precache.test.js
// Source: 08-01-PLAN.md Task 2 <behavior>
//         RESEARCH.md Open Question 2 (SW unit test: parse sw.js as string in Node)
//         Assumption A2/A3 (clock-fixed.js and storage-memory.js are test-only adapters)
//
// Strategy: Read sw.js as a string via fs.readFileSync (sw.js uses self.addEventListener —
// browser global — so it cannot be imported in Node). Extract the PRECACHE_LIST array
// literal via regex and parse it.
//
// This test pins the PRECACHE_LIST against known good/bad file paths so regressions
// (accidentally adding test-only adapters or planning files) are caught immediately.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SW_PATH = join(__dirname, '..', '..', 'sw.js');

// Parse sw.js as a string and extract PRECACHE_LIST entries.
// The array spans multiple lines between Object.freeze([ ... ]);
function extractPrecacheList(src) {
  // Match the PRECACHE_LIST = Object.freeze([...]) block
  const match = src.match(/const PRECACHE_LIST\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*\)/);
  if (!match) throw new Error('Could not find PRECACHE_LIST in sw.js');
  // Extract all single-quoted strings
  const entries = [];
  const re = /'([^']+)'/g;
  let m;
  while ((m = re.exec(match[1])) !== null) {
    entries.push(m[1]);
  }
  return entries;
}

const swSrc = readFileSync(SW_PATH, 'utf8');
const precacheList = extractPrecacheList(swSrc);

describe('sw.js PRECACHE_LIST', () => {
  test('is frozen (Object.isFrozen)', () => {
    // Verify the sw.js source declares Object.freeze() on the array
    assert.match(swSrc, /Object\.freeze\(\[/);
  });

  test('contains ./index.html', () => {
    assert.ok(precacheList.includes('./index.html'), 'Missing ./index.html');
  });

  test('contains ./style.css', () => {
    assert.ok(precacheList.includes('./style.css'), 'Missing ./style.css');
  });

  test('contains ./manifest.json', () => {
    assert.ok(precacheList.includes('./manifest.json'), 'Missing ./manifest.json');
  });

  test('contains ./icons/favicon.jpeg', () => {
    assert.ok(precacheList.includes('./icons/favicon.jpeg'), 'Missing ./icons/favicon.jpeg');
  });

  test('contains ./icons/app-start.jpeg', () => {
    assert.ok(precacheList.includes('./icons/app-start.jpeg'), 'Missing ./icons/app-start.jpeg');
  });

  test('contains ./js/app.js', () => {
    assert.ok(precacheList.includes('./js/app.js'), 'Missing ./js/app.js');
  });

  test('does NOT contain ./sw.js (SW files do not cache themselves)', () => {
    // SW files typically exclude themselves from the precache list.
    // Decision: sw.js is excluded. The browser handles SW file updates via the
    // SW update check (byte-comparison of sw.js), not via the cache API.
    assert.ok(!precacheList.includes('./sw.js'), 'sw.js should NOT be in PRECACHE_LIST');
  });

  test('does NOT contain any path matching /clock-fixed/', () => {
    const bad = precacheList.filter((e) => /clock-fixed/.test(e));
    assert.deepEqual(bad, [], `Test-only adapter found: ${bad.join(', ')}`);
  });

  test('does NOT contain any path matching /storage-memory/', () => {
    const bad = precacheList.filter((e) => /storage-memory/.test(e));
    assert.deepEqual(bad, [], `Test-only adapter found: ${bad.join(', ')}`);
  });

  test('does NOT contain any path under tests/', () => {
    const bad = precacheList.filter((e) => /tests\//.test(e));
    assert.deepEqual(bad, [], `Test path in PRECACHE_LIST: ${bad.join(', ')}`);
  });

  test('does NOT contain any path under .planning/', () => {
    const bad = precacheList.filter((e) => /\.planning\//.test(e));
    assert.deepEqual(bad, [], `.planning path in PRECACHE_LIST: ${bad.join(', ')}`);
  });

  test('does NOT contain any path under .github/', () => {
    const bad = precacheList.filter((e) => /\.github\//.test(e));
    assert.deepEqual(bad, [], `.github path in PRECACHE_LIST: ${bad.join(', ')}`);
  });

  test('does NOT contain any path under scripts/', () => {
    const bad = precacheList.filter((e) => /scripts\//.test(e));
    assert.deepEqual(bad, [], `scripts/ path in PRECACHE_LIST: ${bad.join(', ')}`);
  });

  test('every entry starts with ./', () => {
    const bad = precacheList.filter((e) => !e.startsWith('./'));
    assert.deepEqual(bad, [], `Non-relative entries found: ${bad.join(', ')}`);
  });

  test('has at least 31 entries (full app file inventory)', () => {
    assert.ok(precacheList.length >= 31, `Expected >= 31 entries, got ${precacheList.length}`);
  });

  test('contains forecast-tif.js (TIF algorithm module)', () => {
    assert.ok(precacheList.includes('./js/lib/forecast-tif.js'), 'forecast-tif.js missing from PRECACHE_LIST');
  });

  test('contains metrics.js (TIF metrics helpers module)', () => {
    assert.ok(precacheList.includes('./js/lib/metrics.js'), 'metrics.js missing from PRECACHE_LIST');
  });
});
