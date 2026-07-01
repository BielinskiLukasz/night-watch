// js/lib/stages.js
// Pure stage-filter utilities for Nightwatch — no DOM, no I/O, no side effects.
//
// Decisions: D6-01 (stages in settings), D6-02 (activeStageId), D6-05 (null endDate),
//            D6-10 (unknown activeStageId fallback to all data).
//
// Date comparisons use plain string order (YYYY-MM-DD lexicographic) — no Date
// constructor needed (DST-safe, consistent with the rest of the codebase).

/**
 * Filter day records to those within a named stage's date range.
 *
 * - activeStageId === null → returns dayRecords unchanged ("All data", D6-12)
 * - activeStageId not found in stages → returns dayRecords unchanged (D6-10 fallback)
 * - stage.endDate === null → include all records from startDate onwards (D6-05)
 * - Boundary dates are inclusive on both ends
 *
 * @param {object[]} dayRecords  array of day records (each must have .date: 'YYYY-MM-DD')
 * @param {object[]} stages      array of stage objects {id, name, startDate, endDate}
 * @param {string|null} activeStageId  id of the selected stage, or null
 * @returns {object[]}  filtered array (same objects, not copies); or original array if no filter
 */
export function filterDayRecordsByStage(dayRecords, stages, activeStageId) {
  if (!activeStageId) return dayRecords;
  const stage = (stages || []).find(s => s.id === activeStageId);
  if (!stage) return dayRecords; // D6-10: unknown id → fallback to all data
  return dayRecords.filter(d => {
    if (d.date < stage.startDate) return false;
    if (stage.endDate !== null && d.date > stage.endDate) return false;
    return true;
  });
}
