// js/lib/import-export.js
// Pure export helper for Nightwatch — no store imports, no DOM side effects
// beyond the transient anchor click pattern (D5-14, D5-15, D5-16).
//
// RESEARCH Pitfall 3: URL.revokeObjectURL must be deferred via setTimeout
// so the browser completes the download before the object URL is freed.
// Immediate revocation cancels the download in Chrome/Edge.

import { formatLocalISO } from './time.js';

/**
 * Trigger a browser download of the full canonical JSON blob (DATA-01 / DATA-05).
 *
 * Reads the current state from storage.load(), serializes with 2-space indent
 * (D5-16), builds a dated filename (D5-15), and uses URL.createObjectURL +
 * a transient <a download> to initiate the download without a server request.
 *
 * Security (T-05-03-02): only the object URL (no user data) flows into .href;
 * the download attribute is a string literal. No innerHTML anywhere.
 *
 * @param {{ load: () => object|null }} storage  storage adapter
 * @param {{ now: () => Date }} clock  clock adapter
 */
export function downloadJSON(storage, clock) {
  const blob = storage.load();
  const json = JSON.stringify(blob, null, 2);

  // D5-15: filename is nightwatch-YYYY-MM-DD.json
  const dateSlice = formatLocalISO(clock.now()).slice(0, 10);
  const filename = `nightwatch-${dateSlice}.json`;

  const blobObj = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blobObj);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // RESEARCH Pitfall 3: defer revocation so the browser finishes the download.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
