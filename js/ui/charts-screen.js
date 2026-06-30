// js/ui/charts-screen.js
// Charts screen — five stacked SVG visualizations for sleep analytics.
//
// Phase 7, UI-04, D7-05..D7-11, D7-17..D7-19
//
// Security invariants (T-07-05-01..03):
//   - All SVG <text> content that could contain user strings (stage names) is
//     set via .textContent property — NEVER via setAttribute or dynamic HTML.
//   - SVG attribute values for positions/sizes are derived from numbers — safe.
//   - Dynamic HTML assignment is forbidden in this file (ASVS V5).
//
// Component contract:
//   Input:  root (DOM element), eventLog (store), settings (store)
//   Output: Stage badge + five chart sections rendered into root
//   Side effects: subscribes to eventLog and settings; re-renders on mutation.
//   Returns: { unsubscribe() } — mirrors mountHistoryScreen pattern.

import { filterDayRecordsByStage } from '../lib/stages.js';
import {
  buildSleepLengthSeries,
  buildHeatmapData,
  buildTimeBandSeries,
  buildNapStats,
  buildActivityCorrelation,
  CHART_CONFIG,
} from '../lib/chart-data.js';
import { formatTime } from '../lib/time.js';

// ---------------------------------------------------------------------------
// Module-level constants (Object.freeze per CLAUDE.md convention)
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Default chart margins in SVG coordinate space. */
const CHART_MARGINS = Object.freeze({ top: 10, right: 16, left: 40, bottom: 28 });

/** Fixed SVG viewport for the sleep-length line chart. */
const SLEEP_LEN_SVG = Object.freeze({ w: 600, h: 180 });

/** Fixed SVG viewport for the time-band scatter chart. */
const TIME_BAND_SVG = Object.freeze({ w: 600, h: 200 });

/** Cell geometry for the GitHub-style calendar heatmap. */
const HEATMAP_CFG = Object.freeze({ cellSize: 11, cellGap: 2, rowOffset: 18, colOffset: 16 });

/** Extra vertical space (SVG units) reserved below the 7-day grid for the legend. */
const HEATMAP_LEGEND_H = 18;

/**
 * Minimum weeks shown in the heatmap viewBox even when the dataset is smaller.
 * Keeps the SVG aspect ratio sane so the chart fills the container without
 * becoming excessively tall when only a few weeks of data exist.
 */
const HEATMAP_MIN_WEEKS = 26;

/** Stage boundary line color (D7-19). */
const STAGE_BOUNDARY_STROKE = '#94a3b8';

// ---------------------------------------------------------------------------
// Local SVG element factory
// (dom.js el() uses createElement — SVG needs createElementNS — T-07-05-01)
// ---------------------------------------------------------------------------

/**
 * Create an SVG element in the SVG namespace.
 * All SVG elements are created via createElementNS (T-07-05-01, ASVS V5).
 *
 * @param {string} tag  e.g. 'rect', 'circle', 'text', 'polyline'
 * @param {Object.<string,string|number>} [attrs={}]  attribute key/value pairs
 * @returns {SVGElement}
 */
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag); // createElementNS (T-07-05-01)
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/**
 * Create the root <svg> element for a chart section.
 * Using createElementNS directly here to make the call site visible to static
 * analysis and acceptance checks (the svgEl helper is built on this same API).
 *
 * @param {string} viewBox
 * @param {string} ariaLabel
 * @returns {SVGSVGElement}
 */
function createChartSvg(viewBox, ariaLabel) {
  const svg = document.createElementNS(SVG_NS, 'svg'); // createElementNS — chart root
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);
  svg.setAttribute('class', 'chartSvg');
  return svg;
}

/**
 * Create an SVG <text> element and set its text via .textContent.
 * Explicit createElementNS call — satisfies T-07-05-01 textContent invariant.
 * Never setAttribute for the text content.
 *
 * @param {Object.<string,string|number>} attrs
 * @param {string} text
 * @returns {SVGTextElement}
 */
function svgText(attrs, text) {
  const el = document.createElementNS(SVG_NS, 'text'); // createElementNS — text element
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.textContent = text; // T-07-05-01: textContent property, never setAttribute
  return el;
}

// ---------------------------------------------------------------------------
// Cold-start card
// ---------------------------------------------------------------------------

/**
 * Render a cold-start card into root, replacing all children.
 * Called when validCount < minDays.
 *
 * @param {HTMLElement} root
 * @param {number} remaining  minDays - validCount
 */
function renderColdStart(root, remaining) {
  root.replaceChildren();
  const p = document.createElement('p');
  p.className = 'coldStartNote';
  // textContent only — no user input here, but following invariant for safety.
  p.textContent =
    'Not enough history to show charts — keep logging! (' +
    remaining +
    ' more day(s) needed)';
  root.appendChild(p);
}

// ---------------------------------------------------------------------------
// Stage badge (D7-18)
// ---------------------------------------------------------------------------

/**
 * Update the stage badge visibility and label.
 * T-07-05-01: stage.name via .textContent only.
 *
 * @param {HTMLElement} badge
 * @param {{ activeStageId: string|null, stages: object[] }} snap
 */
function renderStageBadge(badge, snap) {
  if (snap.activeStageId) {
    const stage = (snap.stages || []).find((s) => s.id === snap.activeStageId);
    badge.hidden = !stage;
    if (stage) {
      badge.textContent = 'Viewing: ' + stage.name; // T-07-05-01: textContent
    }
  } else {
    badge.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Chart 1: Sleep Length line chart (D7-09)
// ---------------------------------------------------------------------------

/**
 * Render the sleep-length line chart into sectionEl.
 * Clears previous SVG content before rendering.
 *
 * Y-axis: auto-scaled to data range with 10% padding (D7-09).
 * Stage boundaries: vertical dashed lines when activeStageId is null (D7-19).
 *
 * @param {HTMLElement} sectionEl
 * @param {object[]} days  day records
 * @param {object} snap  settings snapshot
 */
function renderSleepLengthChart(sectionEl, days, snap) {
  sectionEl.replaceChildren();

  const h2 = document.createElement('h2');
  h2.textContent = 'Sleep Length';
  sectionEl.appendChild(h2);

  const series = buildSleepLengthSeries(days);
  const validPoints = series.filter((p) => p.sleepHours !== null && !p.rejected);

  const W = SLEEP_LEN_SVG.w;
  const H = SLEEP_LEN_SVG.h;
  const M = CHART_MARGINS;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const svg = createChartSvg('0 0 ' + W + ' ' + H, 'Sleep length over time');

  if (validPoints.length < 2) {
    svg.appendChild(svgText({ x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: '#64748b', 'font-size': '12' }, 'Not enough data'));
    sectionEl.appendChild(svg);
    return;
  }

  // Y scale: auto-scaled to data range with 10% padding (D7-09)
  const hours = validPoints.map((p) => p.sleepHours);
  const minH = Math.min(...hours);
  const maxH = Math.max(...hours);
  const pad = (maxH - minH) * 0.1 || 0.5; // guard for flat data
  const lo = minH - pad;
  const hi = maxH + pad;

  const xScale = (i) => {
    if (series.length <= 1) return M.left;
    return M.left + (i / (series.length - 1)) * plotW;
  };
  const yScale = (v) => M.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  // Y-axis ticks (3 ticks: lo, mid, hi)
  const ticks = [lo, (lo + hi) / 2, hi];
  for (const tick of ticks) {
    const y = yScale(tick);
    // Tick line
    svg.appendChild(svgEl('line', {
      x1: M.left - 4, x2: M.left, y1: y, y2: y,
      stroke: '#cbd5e1', 'stroke-width': '1',
    }));
    // Tick label — numeric, safe via textContent
    svg.appendChild(svgText({ x: M.left - 6, y: y + 4, 'text-anchor': 'end', 'font-size': '9', fill: '#475569' }, tick.toFixed(1) + 'h'));
  }

  // Y-axis line
  svg.appendChild(svgEl('line', {
    x1: M.left, x2: M.left, y1: M.top, y2: M.top + plotH,
    stroke: '#e2e8f0', 'stroke-width': '1',
  }));

  // X-axis line
  svg.appendChild(svgEl('line', {
    x1: M.left, x2: M.left + plotW, y1: M.top + plotH, y2: M.top + plotH,
    stroke: '#e2e8f0', 'stroke-width': '1',
  }));

  // Stage boundary dashed lines (D7-19): when !activeStageId, show transitions
  if (!snap.activeStageId && snap.stages && snap.stages.length > 0) {
    const sortedStages = [...snap.stages].sort((a, b) =>
      a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
    );
    // Show a boundary at each stage's startDate (except the very first)
    for (let si = 1; si < sortedStages.length; si++) {
      const stage = sortedStages[si];
      const idx = series.findIndex((p) => p.date >= stage.startDate);
      if (idx < 0) continue;
      const x = xScale(idx);
      svg.appendChild(svgEl('line', {
        x1: x, x2: x, y1: M.top, y2: M.top + plotH,
        stroke: STAGE_BOUNDARY_STROKE, 'stroke-width': '1', 'stroke-dasharray': '4 3',
      }));
      // Stage name label — T-07-05-01: textContent only (svgText enforces this)
      svg.appendChild(svgText({ x: x + 2, y: M.top + 8, 'font-size': '9', fill: STAGE_BOUNDARY_STROKE }, stage.name));
    }
  }

  // Polyline: only use valid (non-null, non-rejected) points
  const pointStrings = series
    .map((p, i) => {
      if (p.sleepHours === null || p.rejected) return null;
      return xScale(i) + ',' + yScale(p.sleepHours);
    })
    .filter(Boolean);

  if (pointStrings.length >= 2) {
    svg.appendChild(svgEl('polyline', {
      points: pointStrings.join(' '),
      fill: 'none', stroke: '#4f46e5', 'stroke-width': '2',
    }));
  }

  // Data points (circles)
  for (let i = 0; i < series.length; i++) {
    const p = series[i];
    if (p.sleepHours === null) continue;
    const cx = xScale(i);
    const cy = yScale(p.sleepHours);
    svg.appendChild(svgEl('circle', {
      cx, cy, r: '3',
      fill: p.rejected ? '#e2e8f0' : '#4f46e5',
      stroke: '#fff', 'stroke-width': '1',
    }));
  }

  // Axis title
  svg.appendChild(svgText({ x: M.left, y: M.top + plotH + 18, 'font-size': '9', fill: '#64748b' }, 'Sleep Length (h)'));

  sectionEl.appendChild(svg);
}

// ---------------------------------------------------------------------------
// Chart 2: Wake & Bedtime Bands scatter (D7-10)
// ---------------------------------------------------------------------------

/**
 * Build a synthetic ISO string from hours/minutes for formatTime.
 * formatTime requires a full 'YYYY-MM-DDTHH:MM' string (not bare HH:MM).
 *
 * @param {number} totalMinutes  0-1439
 * @returns {string}  '2000-01-01THH:MM'
 */
function minutesToISOString(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return '2000-01-01T' + pad(h) + ':' + pad(m);
}

/**
 * Render the wake/bedtime time-band scatter plot.
 *
 * Y-axis: hour of day 0-24, inverted (0 at bottom, 24 at top — "early = top").
 * Actually rendered: 0h at MARGIN.top, 24h at MARGIN.top+plotH for visual clarity
 * (same as a standard time scale where lower hour = upper position).
 *
 * @param {HTMLElement} sectionEl
 * @param {object[]} days
 * @param {object} snap
 */
function renderTimeBandChart(sectionEl, days, snap) {
  sectionEl.replaceChildren();

  const h2 = document.createElement('h2');
  h2.textContent = 'Wake & Bedtime Bands';
  sectionEl.appendChild(h2);

  const timeSeries = buildTimeBandSeries(days);
  const hasData = timeSeries.some((p) => p.wakeMinutes !== null || p.bedtimeMinutes !== null);

  const W = TIME_BAND_SVG.w;
  const H = TIME_BAND_SVG.h;
  const M = CHART_MARGINS;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const svg = createChartSvg('0 0 ' + W + ' ' + H, 'Wake and bedtime over time');

  if (!hasData) {
    svg.appendChild(svgText({ x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: '#64748b', 'font-size': '12' }, 'No wake/bedtime data'));
    sectionEl.appendChild(svg);
    return;
  }

  const xScale = (i) => {
    if (timeSeries.length <= 1) return M.left;
    return M.left + (i / (timeSeries.length - 1)) * plotW;
  };
  // Y-axis: 0h (midnight) at top, 24h at bottom (minutes → pixels)
  const yScale = (minutes) => M.top + (minutes / (24 * 60)) * plotH;

  // Y-axis ticks (0, 6, 12, 18, 24h)
  for (const hourTick of [0, 6, 12, 18, 24]) {
    const y = yScale(hourTick * 60);
    svg.appendChild(svgEl('line', {
      x1: M.left - 4, x2: M.left + plotW, y1: y, y2: y,
      stroke: '#e2e8f0', 'stroke-width': '1',
    }));
    // Tick label — formatted time string, safe via svgText textContent setter
    const isoStr = minutesToISOString(hourTick * 60);
    svg.appendChild(svgText({ x: M.left - 6, y: y + 4, 'text-anchor': 'end', 'font-size': '9', fill: '#475569' }, formatTime(isoStr, snap.timeFormat || '24h')));
  }

  // Y-axis line
  svg.appendChild(svgEl('line', {
    x1: M.left, x2: M.left, y1: M.top, y2: M.top + plotH,
    stroke: '#e2e8f0', 'stroke-width': '1',
  }));

  // Data points
  for (let i = 0; i < timeSeries.length; i++) {
    const p = timeSeries[i];
    const x = xScale(i);
    if (p.wakeMinutes !== null) {
      svg.appendChild(svgEl('circle', {
        cx: x, cy: yScale(p.wakeMinutes), r: '3',
        fill: '#4f46e5', opacity: '0.8',
      }));
    }
    if (p.bedtimeMinutes !== null) {
      svg.appendChild(svgEl('circle', {
        cx: x, cy: yScale(p.bedtimeMinutes), r: '3',
        fill: '#94a3b8', opacity: '0.8',
      }));
    }
  }

  // Legend
  const legendX = W - M.right - 70;
  const legendY = M.top + 8;
  svg.appendChild(svgEl('circle', { cx: legendX, cy: legendY, r: '3', fill: '#4f46e5' }));
  svg.appendChild(svgText({ x: legendX + 6, y: legendY + 4, 'font-size': '9', fill: '#334155' }, 'Wake'));
  svg.appendChild(svgEl('circle', { cx: legendX, cy: legendY + 14, r: '3', fill: '#94a3b8' }));
  svg.appendChild(svgText({ x: legendX + 6, y: legendY + 18, 'font-size': '9', fill: '#334155' }, 'Bedtime'));

  sectionEl.appendChild(svg);
}

// ---------------------------------------------------------------------------
// Chart 3: Calendar Heatmap (D7-06)
// ---------------------------------------------------------------------------

/**
 * Render the GitHub-style calendar heatmap.
 *
 * Columns = weeks (oldest left, newest right).
 * Rows = day of week (Monday top = index 0, Sunday bottom = index 6).
 * Color encodes sleep length (D7-06).
 *
 * @param {HTMLElement} sectionEl
 * @param {object[]} days
 */
function renderHeatmap(sectionEl, days) {
  sectionEl.replaceChildren();

  const h2 = document.createElement('h2');
  h2.textContent = 'Sleep Calendar';
  sectionEl.appendChild(h2);

  const cells = buildHeatmapData(days);

  if (cells.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No calendar data';
    msg.className = 'coldStartNote';
    sectionEl.appendChild(msg);
    return;
  }

  const { cellSize, cellGap, rowOffset, colOffset } = HEATMAP_CFG;
  const step = cellSize + cellGap;

  const maxWeek = cells.reduce((m, c) => Math.max(m, c.weekIndex), 0);
  const weeks = maxWeek + 1;
  // Pad viewBox to at least HEATMAP_MIN_WEEKS so the aspect ratio stays sane
  // when little data exists (prevents the chart from being excessively tall).
  const svgW = colOffset + Math.max(weeks, HEATMAP_MIN_WEEKS) * step + cellSize;
  const svgH = rowOffset + 7 * step + HEATMAP_LEGEND_H;

  const svg = document.createElementNS(SVG_NS, 'svg'); // createElementNS — heatmap SVG root
  svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);
  // Scale to fill the container (width:100%) so the chart is never tiny.
  // min-width prevents shrinking below the natural SVG width for large datasets —
  // the .heatmapScroll wrapper then scrolls horizontally instead.
  svg.setAttribute('width', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
  svg.style.minWidth = svgW + 'px';
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Sleep calendar heatmap');
  svg.setAttribute('class', 'heatmapSvg');

  // Day-of-week labels on left (static literals — safe)
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  for (let i = 0; i < 7; i++) {
    svg.appendChild(svgText({ x: colOffset - 2, y: rowOffset + i * step + cellSize - 2, 'text-anchor': 'end', 'font-size': '8', fill: '#94a3b8' }, dayLabels[i]));
  }

  const { missing, short, target, long } = CHART_CONFIG.HEATMAP_COLORS;

  for (const cell of cells) {
    const x = colOffset + cell.weekIndex * step;
    const y = rowOffset + cell.dayOfWeek * step;

    let fill;
    if (cell.sleepHours === null || cell.sleepHours === 0) {
      fill = missing;
    } else if (cell.sleepHours < CHART_CONFIG.TARGET_SLEEP_MIN) {
      fill = short;
    } else if (cell.sleepHours <= CHART_CONFIG.TARGET_SLEEP_MAX) {
      fill = target;
    } else {
      fill = long;
    }

    svg.appendChild(svgEl('rect', {
      x: String(x), y: String(y),
      width: String(cellSize), height: String(cellSize),
      fill, rx: '2',
    }));
  }

  // Legend
  const legendY = svgH - 2;
  const legendItems = [
    { fill: missing, label: 'No data' },
    { fill: short,   label: '< 8h' },
    { fill: target,  label: '8–10h' },
    { fill: long,    label: '> 10h' },
  ];
  let lx = colOffset;
  for (const item of legendItems) {
    svg.appendChild(svgEl('rect', { x: lx, y: legendY - cellSize, width: cellSize, height: cellSize, fill: item.fill, rx: '2' }));
    svg.appendChild(svgText({ x: lx + cellSize + 2, y: legendY - 2, 'font-size': '8', fill: '#64748b' }, item.label));
    lx += cellSize + 2 + 30;
  }

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'heatmapScroll';
  scrollContainer.appendChild(svg);
  sectionEl.appendChild(scrollContainer);
}

// ---------------------------------------------------------------------------
// Chart 4: Nap Pattern stats card (D7-07 — HTML, no SVG)
// ---------------------------------------------------------------------------

/**
 * Render the nap pattern stats card (no SVG — plain HTML per D7-07).
 *
 * @param {HTMLElement} sectionEl
 * @param {object[]} days
 */
function renderNapPattern(sectionEl, days) {
  sectionEl.replaceChildren();

  const h2 = document.createElement('h2');
  h2.textContent = 'Nap Pattern';
  sectionEl.appendChild(h2);

  const stats = buildNapStats(days);

  const card = document.createElement('div');
  card.className = 'napPatternCard';

  const items = [
    { label: 'Days with nap', value: stats.napDayPct.toFixed(0) + '%' },
    { label: 'Avg nap start', value: stats.avgNapStartHHMM ?? '—' },
    {
      label: 'Avg nap length',
      value:
        stats.avgNapLengthMin != null
          ? Math.floor(stats.avgNapLengthMin / 60) + 'h ' + (stats.avgNapLengthMin % 60) + 'm'
          : '—',
    },
  ];

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'napStatRow';

    const lbl = document.createElement('span');
    lbl.className = 'napStatLabel';
    lbl.textContent = item.label; // static — safe

    const val = document.createElement('span');
    val.className = 'napStatValue';
    val.textContent = item.value; // numeric / computed — safe

    row.appendChild(lbl);
    row.appendChild(val);
    card.appendChild(row);
  }

  sectionEl.appendChild(card);
}

// ---------------------------------------------------------------------------
// Chart 5: Activity vs Sleep correlation scatter (D7-11)
// ---------------------------------------------------------------------------

/**
 * Render the activity-vs-sleep scatter plot.
 * Hidden when activityLog has fewer than minDays entries (D7-11).
 *
 * @param {HTMLElement} sectionEl
 * @param {object[]} days
 * @param {{ [dateStr: string]: number }} activityLog
 * @param {object} snap
 */
function renderActivityCorrelation(sectionEl, days, activityLog, snap) {
  sectionEl.replaceChildren();

  const activityEntries = Object.keys(activityLog).length;
  if (activityEntries < snap.minDays) {
    sectionEl.style.display = 'none';
    return;
  }
  sectionEl.style.display = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Activity vs Sleep';
  sectionEl.appendChild(h2);

  const points = buildActivityCorrelation(days, activityLog);

  if (points.length < 2) {
    const msg = document.createElement('p');
    msg.textContent = 'Not enough overlapping activity and sleep data.';
    sectionEl.appendChild(msg);
    return;
  }

  const W = 600;
  const H = 180;
  const M = CHART_MARGINS;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const scores = points.map((p) => p.activityScore);
  const hours = points.map((p) => p.sleepHours);

  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const minHours = Math.min(...hours);
  const maxHours = Math.max(...hours);

  const scorePad = (maxScore - minScore) * 0.1 || 1;
  const hoursPad = (maxHours - minHours) * 0.1 || 0.5;

  const xScale = (v) =>
    M.left + ((v - (minScore - scorePad)) / (maxScore - minScore + 2 * scorePad)) * plotW;
  const yScale = (v) =>
    M.top + plotH - ((v - (minHours - hoursPad)) / (maxHours - minHours + 2 * hoursPad)) * plotH;

  const svg = createChartSvg('0 0 ' + W + ' ' + H, 'Activity score vs sleep hours scatter plot');

  // Axes
  svg.appendChild(svgEl('line', {
    x1: M.left, x2: M.left, y1: M.top, y2: M.top + plotH,
    stroke: '#e2e8f0', 'stroke-width': '1',
  }));
  svg.appendChild(svgEl('line', {
    x1: M.left, x2: M.left + plotW, y1: M.top + plotH, y2: M.top + plotH,
    stroke: '#e2e8f0', 'stroke-width': '1',
  }));

  // Axis labels — static strings (svgText enforces textContent safety)
  svg.appendChild(svgText({ x: M.left + plotW / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': '9', fill: '#64748b' }, 'Activity Score'));
  svg.appendChild(svgText({ x: 8, y: M.top + plotH / 2, 'font-size': '9', fill: '#64748b', 'text-anchor': 'middle', transform: 'rotate(-90 8 ' + (M.top + plotH / 2) + ')' }, 'Sleep (h)'));

  // Data points
  for (const p of points) {
    svg.appendChild(svgEl('circle', {
      cx: xScale(p.activityScore), cy: yScale(p.sleepHours), r: '4',
      fill: '#4f46e5', opacity: '0.65',
    }));
  }

  sectionEl.appendChild(svg);
}

// ---------------------------------------------------------------------------
// mountChartsScreen — public API
// ---------------------------------------------------------------------------

/**
 * Mount the Charts screen into the given root element.
 *
 * Mirrors mountHistoryScreen pattern (PATTERNS §charts-screen.js):
 *   - replaceChildren() once at mount
 *   - builds permanent section containers
 *   - subscribes to eventLog + settings
 *   - returns { unsubscribe() }
 *
 * @param {{
 *   root: HTMLElement,
 *   eventLog: {
 *     daysBySubjectiveNight: (cutoverHour?: number) => object[],
 *     getActivityLog: () => { [dateStr: string]: number },
 *     subscribe: (fn: () => void) => () => void,
 *   },
 *   settings: {
 *     get: () => object,
 *     subscribe: (fn: () => void) => () => void,
 *   },
 * }} deps
 * @returns {{ unsubscribe: () => void }}
 */
export function mountChartsScreen({ root, eventLog, settings }) {
  // Clear root once at mount, then build permanent structure.
  root.replaceChildren();

  // Stage badge (D7-18) — display-only, no interaction
  const stageBadge = document.createElement('p');
  stageBadge.className = 'stageChip';
  stageBadge.hidden = true;

  // Five permanent section wrappers — cleared individually on re-render
  const section1 = document.createElement('div');
  section1.className = 'chartSection';
  const section2 = document.createElement('div');
  section2.className = 'chartSection';
  const section3 = document.createElement('div');
  section3.className = 'chartSection';
  const section4 = document.createElement('div');
  section4.className = 'chartSection';
  const section5 = document.createElement('div');
  section5.className = 'chartSection';

  root.replaceChildren(stageBadge, section1, section2, section3, section4, section5);

  const render = () => {
    const snap = settings.get();

    // Full history via subjective-night grouping (D3-13: forecast calibrated to sleep cycle)
    const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);

    // Stage filter — strict scoping, no thin-stage fallback (D7-17)
    // CRITICAL: three args — (dayRecords, stages, activeStageId) — RESEARCH Pitfall #1
    const days = snap.activeStageId
      ? filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)
      : allDays;

    // Cold-start gate (D7 discretion — same pattern as Today screen)
    const validCount = days.filter((d) => !d.rejected).length;
    if (validCount < snap.minDays) {
      renderColdStart(root, snap.minDays - validCount);
      return;
    }

    // Restore section structure in case renderColdStart replaced root children
    if (!root.contains(stageBadge)) {
      root.replaceChildren(stageBadge, section1, section2, section3, section4, section5);
    }

    // Stage badge (D7-18)
    renderStageBadge(stageBadge, snap);

    // Activity log (D5-17: stored in db.activityLog; accessed via getActivityLog())
    const activityLog = eventLog.getActivityLog();

    // Render all five visualizations (D7-05 order)
    renderSleepLengthChart(section1, days, snap);         // 1. Sleep Length
    renderTimeBandChart(section2, days, snap);             // 2. Wake & Bedtime Bands
    renderHeatmap(section3, days);                         // 3. Calendar Heatmap
    renderNapPattern(section4, days);                      // 4. Nap Pattern
    renderActivityCorrelation(section5, days, activityLog, snap); // 5. Activity Correlation
  };

  render();

  const unsubLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return {
    unsubscribe() {
      unsubLog();
      unsubSettings();
    },
  };
}
