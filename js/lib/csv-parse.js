// js/lib/csv-parse.js
// Pure CSV parser for Nightwatch — no DOM, no I/O.
//
// Handles the Polish sen.xlsx column schema (D5-06 to D5-10):
//   - Delimiter auto-detection: ';' (Polish/European Excel) vs ',' (D5-09)
//   - Date format auto-detection: DD.MM.YYYY dots vs YYYY-MM-DD dashes (D5-08)
//   - Nap columns optional: empty nap cells → no napStart/napEnd events (D5-05)
//   - Aggregate/computed columns silently ignored (D5-06)
//   - Bad rows skipped with row number + reason in skipped[] (D5-10)
//   - All event at-strings rounded to 5-minute boundary via parseLocalISO → roundTo5 → formatLocalISO (LOG-07)
//
// Returns: { events[], rejectedDays[], activityLog{}, skipped[{row, reason}] }

import { parseLocalISO, roundTo5, formatLocalISO } from './time.js';

/**
 * Column name → internal field name mapping.
 * Accepts both Polish headers (with/without diacritics) and English aliases.
 * Object.freeze per CLAUDE.md / mindful-breathing pattern (D5-06).
 */
const COL = Object.freeze({
  // Polish with diacritics (UTF-8 as exported by Excel/LibreOffice)
  'Data':           'date',
  'Pobudka':        'wake',
  'Zaśnięcie':      'bedtime',
  'Drzemka start':  'napStart',
  'Drzemka stop':   'napEnd',
  'Aktywność':      'activity',
  'odrzucone':      'rejected',
  // Polish without diacritics (ASCII fallback, common in some export tools)
  'Zasniecie':      'bedtime',
  'Aktywnosc':      'activity',
  // English aliases for test fixtures and non-Polish users
  'Date':           'date',
  'Wake':           'wake',
  'Bedtime':        'bedtime',
  'Nap start':      'napStart',
  'Nap end':        'napEnd',
  'Activity':       'activity',
  'Rejected':       'rejected',
});

/**
 * Detect the CSV delimiter from the header line.
 * Counts semicolons vs commas; semicolons win on a tie.
 * @param {string} headerLine
 * @returns {';' | ','}
 */
function detectDelimiter(headerLine) {
  const semis = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semis >= commas ? ';' : ',';
}

/**
 * Detect the date format from a sample date cell.
 * @param {string} sampleDate  raw date string from CSV
 * @returns {'dmy-dot' | 'iso' | null}
 */
function detectDateFormat(sampleDate) {
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(sampleDate.trim())) return 'dmy-dot';
  if (/^\d{4}-\d{2}-\d{2}$/.test(sampleDate.trim())) return 'iso';
  return null;
}

/**
 * Convert a raw date cell to an ISO date string (YYYY-MM-DD).
 * @param {string} raw
 * @param {'dmy-dot' | 'iso'} fmt
 * @returns {string}
 */
function parseDate(raw, fmt) {
  const s = raw.trim();
  if (fmt === 'dmy-dot') {
    const [d, m, y] = s.split('.');
    return `${y}-${m}-${d}`;
  }
  return s; // already ISO
}

/**
 * Build a canonical 5-min-rounded 'YYYY-MM-DDTHH:MM' at-string.
 * Slices time to first 5 chars so "HH:MM:SS" Excel suffix is handled.
 * @param {string} dateStr  YYYY-MM-DD
 * @param {string} timeStr  HH:MM or HH:MM:SS
 * @returns {string}
 * @throws {Error} on malformed input
 */
function parseEventAt(dateStr, timeStr) {
  const hhmm = timeStr.trim().slice(0, 5); // strip seconds if present
  const raw = `${dateStr}T${hhmm}`;
  return formatLocalISO(roundTo5(parseLocalISO(raw)));
}

/**
 * Parse a CSV string (UTF-8 text) into structured event data.
 *
 * @param {string} text  full CSV content as a string
 * @returns {{
 *   events: Array<{id: string, type: string, at: string}>,
 *   rejectedDays: string[],
 *   activityLog: Object<string, number>,
 *   skipped: Array<{row: number, reason: string}>
 * }}
 */
export function parseCSV(text) {
  const events = [];
  const rejectedDays = [];
  const activityLog = {};
  const skipped = [];

  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return { events, rejectedDays, activityLog, skipped };

  const headerLine = lines[0];
  const delimiter = detectDelimiter(headerLine);
  const headers = headerLine.split(delimiter).map(h => h.trim());

  // Build index: column position → field name (only for recognized headers)
  const colIdx = {};
  for (let i = 0; i < headers.length; i++) {
    const field = COL[headers[i]];
    if (field && !(field in colIdx)) {
      // First match wins (handles duplicate-column edge case)
      colIdx[i] = field;
    }
  }

  let dateFmt = null; // detected lazily from first parseable row

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line || !line.trim()) continue; // skip empty/whitespace-only lines

    const rowNum = lineIdx + 1; // 1-based for user-facing messages (header = row 1)
    const cells = line.split(delimiter);

    // Build a field→value map for this row
    const row = {};
    for (const [idxStr, field] of Object.entries(colIdx)) {
      row[field] = (cells[+idxStr] || '').trim();
    }

    // Require date
    if (!row.date) {
      skipped.push({ row: rowNum, reason: 'missing date' });
      continue;
    }

    // Require wake time
    if (!row.wake) {
      skipped.push({ row: rowNum, reason: 'missing wake time' });
      continue;
    }

    // Detect date format lazily from first parseable row
    if (!dateFmt) {
      dateFmt = detectDateFormat(row.date);
      if (!dateFmt) {
        skipped.push({ row: rowNum, reason: `unrecognized date format: ${row.date}` });
        continue;
      }
    }

    let dateStr;
    try {
      dateStr = parseDate(row.date, dateFmt);
    } catch {
      skipped.push({ row: rowNum, reason: `invalid date: ${row.date}` });
      continue;
    }

    // Required: wake event
    let wakeAt;
    try {
      wakeAt = parseEventAt(dateStr, row.wake);
    } catch {
      skipped.push({ row: rowNum, reason: `invalid wake time: ${row.wake}` });
      continue;
    }
    events.push({ type: 'wake', at: wakeAt });

    // Optional: bedtime event
    if (row.bedtime) {
      try {
        events.push({ type: 'bedtime', at: parseEventAt(dateStr, row.bedtime) });
      } catch { /* swallow parse errors for optional fields */ }
    }

    // Optional: nap start event
    if (row.napStart) {
      try {
        events.push({ type: 'napStart', at: parseEventAt(dateStr, row.napStart) });
      } catch { /* swallow */ }
    }

    // Optional: nap end event
    if (row.napEnd) {
      try {
        events.push({ type: 'napEnd', at: parseEventAt(dateStr, row.napEnd) });
      } catch { /* swallow */ }
    }

    // Rejected flag (D5-07): truthy and not '0' and not 'false'
    if (row.rejected && row.rejected !== '0' && row.rejected.toLowerCase() !== 'false') {
      rejectedDays.push(dateStr);
    }

    // Activity log (D5-17): store numeric value if parseable
    if (row.activity) {
      const val = parseFloat(row.activity);
      if (!isNaN(val)) {
        activityLog[dateStr] = val;
      }
    }
  }

  return { events, rejectedDays, activityLog, skipped };
}
