// tests/unit/csv-parse.test.js
// TDD RED → GREEN tests for js/lib/csv-parse.js
//
// Phase 5, Plan 01 — all assertions must FAIL before implementation exists
// (MODULE_NOT_FOUND on the import satisfies RED).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../../js/lib/csv-parse.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Minimal fixture helpers — inline fixtures per task spec.
// ASCII header aliases (Zasniecie / Aktywnosc) used in fixtures to avoid
// encoding issues in the test file; the COL map accepts both forms.

describe('parseCSV', () => {

  // -------------------------------------------------------------------------
  // Delimiter auto-detection (D5-09)
  // -------------------------------------------------------------------------

  it('semicolon-delimited Polish-header CSV with dot dates → wake + bedtime events', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;Drzemka start;Drzemka stop;Aktywnosc;odrzucone',
      '28.06.2026;07:00;22:00;;;3.5;',
    ].join('\n');
    const { events } = parseCSV(csv);
    const types = events.map(e => e.type);
    assert.ok(types.includes('wake'), 'must contain wake event');
    assert.ok(types.includes('bedtime'), 'must contain bedtime event');
  });

  it('comma-delimited CSV → delimiter auto-detected, events parsed correctly', () => {
    const csv = [
      'Data,Pobudka,Zasniecie,Drzemka start,Drzemka stop,Aktywnosc,odrzucone',
      '2026-06-28,07:00,22:00,,,3.5,',
    ].join('\n');
    const { events } = parseCSV(csv);
    const types = events.map(e => e.type);
    assert.ok(types.includes('wake'), 'comma-delimited: must contain wake');
    assert.ok(types.includes('bedtime'), 'comma-delimited: must contain bedtime');
  });

  // -------------------------------------------------------------------------
  // Date format auto-detection (D5-08)
  // -------------------------------------------------------------------------

  it('DD.MM.YYYY date format → at-string has ISO date prefix YYYY-MM-DD', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '28.06.2026;07:00;22:00',
    ].join('\n');
    const { events } = parseCSV(csv);
    const wake = events.find(e => e.type === 'wake');
    assert.ok(wake, 'wake event must exist');
    assert.ok(wake.at.startsWith('2026-06-28T'), `at must start with 2026-06-28T, got: ${wake.at}`);
  });

  it('YYYY-MM-DD date format → at-string accepted as-is with ISO prefix', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '2026-06-28;07:00;22:00',
    ].join('\n');
    const { events } = parseCSV(csv);
    const wake = events.find(e => e.type === 'wake');
    assert.ok(wake, 'wake event must exist');
    assert.ok(wake.at.startsWith('2026-06-28T'), `at must start with 2026-06-28T, got: ${wake.at}`);
  });

  // -------------------------------------------------------------------------
  // Nap columns optional (D5-05)
  // -------------------------------------------------------------------------

  it('row with empty nap columns → no napStart/napEnd events, wake/bedtime present', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;Drzemka start;Drzemka stop',
      '28.06.2026;07:00;22:00;;',
    ].join('\n');
    const { events } = parseCSV(csv);
    const types = events.map(e => e.type);
    assert.ok(types.includes('wake'), 'wake must be present');
    assert.ok(types.includes('bedtime'), 'bedtime must be present');
    assert.ok(!types.includes('napStart'), 'napStart must NOT be present when empty');
    assert.ok(!types.includes('napEnd'), 'napEnd must NOT be present when empty');
  });

  it('row with nap columns populated → napStart and napEnd events in output', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;Drzemka start;Drzemka stop',
      '28.06.2026;07:00;22:00;14:00;15:00',
    ].join('\n');
    const { events } = parseCSV(csv);
    const types = events.map(e => e.type);
    assert.ok(types.includes('napStart'), 'napStart must be present');
    assert.ok(types.includes('napEnd'), 'napEnd must be present');
  });

  // -------------------------------------------------------------------------
  // Bad row skipping (D5-10)
  // -------------------------------------------------------------------------

  it('row missing required wake time → recorded in skipped with reason', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '28.06.2026;;22:00',
    ].join('\n');
    const { skipped } = parseCSV(csv);
    assert.ok(skipped.length > 0, 'skipped must contain the bad row');
    const entry = skipped[0];
    assert.ok(typeof entry.row === 'number', 'skipped entry must have row number');
    assert.ok(typeof entry.reason === 'string', 'skipped entry must have reason');
    assert.ok(entry.reason.toLowerCase().includes('wake'), `reason must mention wake, got: ${entry.reason}`);
  });

  it('row missing required date → recorded in skipped with reason', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      ';07:00;22:00',
    ].join('\n');
    const { skipped } = parseCSV(csv);
    assert.ok(skipped.length > 0, 'skipped must contain the bad row');
    assert.ok(skipped[0].reason.toLowerCase().includes('date'), `reason must mention date, got: ${skipped[0].reason}`);
  });

  // -------------------------------------------------------------------------
  // Rejected days (D5-07)
  // -------------------------------------------------------------------------

  it('odrzucone column truthy ("1") → date appears in rejectedDays', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;odrzucone',
      '28.06.2026;07:00;22:00;1',
    ].join('\n');
    const { rejectedDays } = parseCSV(csv);
    assert.ok(rejectedDays.includes('2026-06-28'), `rejectedDays must contain 2026-06-28, got: ${JSON.stringify(rejectedDays)}`);
  });

  it('odrzucone column falsy (empty) → date absent from rejectedDays', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;odrzucone',
      '28.06.2026;07:00;22:00;',
    ].join('\n');
    const { rejectedDays } = parseCSV(csv);
    assert.ok(!rejectedDays.includes('2026-06-28'), 'rejectedDays must NOT contain date when falsy');
  });

  it('odrzucone column value "0" → date absent from rejectedDays', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;odrzucone',
      '28.06.2026;07:00;22:00;0',
    ].join('\n');
    const { rejectedDays } = parseCSV(csv);
    assert.ok(!rejectedDays.includes('2026-06-28'), 'rejectedDays must NOT contain date when "0"');
  });

  // -------------------------------------------------------------------------
  // Activity log (D5-17)
  // -------------------------------------------------------------------------

  it('Aktywnosc column with numeric value → date/value pair in activityLog', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;Aktywnosc',
      '28.06.2026;07:00;22:00;3.5',
    ].join('\n');
    const { activityLog } = parseCSV(csv);
    assert.ok('2026-06-28' in activityLog, 'activityLog must have entry for the date');
    assert.equal(activityLog['2026-06-28'], 3.5);
  });

  it('Aktywnosc column empty → date absent from activityLog', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;Aktywnosc',
      '28.06.2026;07:00;22:00;',
    ].join('\n');
    const { activityLog } = parseCSV(csv);
    assert.ok(!('2026-06-28' in activityLog), 'activityLog must NOT have entry when Aktywnosc is empty');
  });

  // -------------------------------------------------------------------------
  // Unrecognized columns silently ignored (D5-06)
  // -------------------------------------------------------------------------

  it('unrecognized column headers are silently ignored; recognized columns still parse', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;UnknownColumn1;AnotherGarbage',
      '28.06.2026;07:00;22:00;IGNORED;IGNORED',
    ].join('\n');
    const { events, skipped } = parseCSV(csv);
    const types = events.map(e => e.type);
    assert.ok(types.includes('wake'), 'wake must parse even with unknown columns');
    assert.ok(types.includes('bedtime'), 'bedtime must parse even with unknown columns');
    assert.equal(skipped.length, 0, 'unknown columns must not cause skips');
  });

  // -------------------------------------------------------------------------
  // 5-minute alignment (LOG-07)
  // -------------------------------------------------------------------------

  it('event at-strings are 5-minute-aligned (07:32 → 07:30)', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '28.06.2026;07:32;22:00',
    ].join('\n');
    const { events } = parseCSV(csv);
    const wake = events.find(e => e.type === 'wake');
    assert.ok(wake, 'wake must exist');
    assert.ok(wake.at.endsWith('T07:30'), `07:32 must round to 07:30, got: ${wake.at}`);
  });

  it('event at-strings are 5-minute-aligned (07:33 → 07:35)', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '28.06.2026;07:33;22:00',
    ].join('\n');
    const { events } = parseCSV(csv);
    const wake = events.find(e => e.type === 'wake');
    assert.ok(wake, 'wake must exist');
    assert.ok(wake.at.endsWith('T07:35'), `07:33 must round to 07:35, got: ${wake.at}`);
  });

  // -------------------------------------------------------------------------
  // Excel seconds suffix (HH:MM:SS → HH:MM only)
  // -------------------------------------------------------------------------

  it('Excel seconds suffix in time ("07:30:00") → parsed correctly with only HH:MM used', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '28.06.2026;07:30:00;22:00:00',
    ].join('\n');
    const { events } = parseCSV(csv);
    const wake = events.find(e => e.type === 'wake');
    assert.ok(wake, 'wake must exist');
    assert.ok(wake.at.endsWith('T07:30'), `seconds suffix must be ignored, got: ${wake.at}`);
  });

  // -------------------------------------------------------------------------
  // Empty trailing lines
  // -------------------------------------------------------------------------

  it('empty trailing lines in CSV are skipped without error', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '28.06.2026;07:00;22:00',
      '',
      '   ',
      '',
    ].join('\n');
    const { events, skipped } = parseCSV(csv);
    assert.ok(events.length > 0, 'events must be parsed from valid rows');
    assert.equal(skipped.length, 0, 'empty trailing lines must not appear in skipped');
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  it('parseCSV returns object with events, rejectedDays, activityLog, and skipped arrays/objects', () => {
    const csv = [
      'Data;Pobudka;Zasniecie',
      '28.06.2026;07:00;22:00',
    ].join('\n');
    const result = parseCSV(csv);
    assert.ok(Array.isArray(result.events), 'events must be an Array');
    assert.ok(Array.isArray(result.rejectedDays), 'rejectedDays must be an Array');
    assert.ok(result.activityLog !== null && typeof result.activityLog === 'object' && !Array.isArray(result.activityLog), 'activityLog must be a plain object');
    assert.ok(Array.isArray(result.skipped), 'skipped must be an Array');
  });

  // -------------------------------------------------------------------------
  // Multiple rows
  // -------------------------------------------------------------------------

  it('two-row CSV → 4 events total (wake+bedtime per row, no naps)', () => {
    const csv = [
      'Data;Pobudka;Zasniecie;Drzemka start;Drzemka stop;Aktywnosc;odrzucone',
      '28.06.2026;07:00;22:00;;;3.5;',
      '29.06.2026;07:30;22:30;14:00;15:00;4.0;1',
    ].join('\n');
    const { events, rejectedDays, activityLog } = parseCSV(csv);
    assert.equal(events.filter(e => e.type === 'wake').length, 2, 'two wake events');
    assert.equal(events.filter(e => e.type === 'bedtime').length, 2, 'two bedtime events');
    assert.equal(events.filter(e => e.type === 'napStart').length, 1, 'one napStart');
    assert.equal(events.filter(e => e.type === 'napEnd').length, 1, 'one napEnd');
    assert.ok(rejectedDays.includes('2026-06-29'), 'row 2 is rejected');
    assert.ok(!rejectedDays.includes('2026-06-28'), 'row 1 is not rejected');
    assert.ok('2026-06-28' in activityLog, 'row 1 has activity');
    assert.ok('2026-06-29' in activityLog, 'row 2 has activity');
  });

});
