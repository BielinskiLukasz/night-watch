// js/ui/bottom-nav.js
// Phase 7, UI-06, D7-01..D7-04
//
// mountBottomNav({ root, onTabChange }) — renders four-tab bottom navigation bar.
//
// Decisions: D7-01 (replace header tab bar), D7-02 (icon + label, 44px tap target),
//            D7-03 (Today | History | Charts | Accuracy order), D7-04 (fixed bottom nav)
// Requirements: UI-06
//
// Security invariants (T-07-04-01 / T-07-04-02):
//   - Tab IDs are validated against VALID_TABS before onTabChange fires.
//     Invalid IDs (including any forged data-tab attribute) are silently ignored.
//   - SVG icon path data (pathD) is a static string literal in the TABS array —
//     never derived from user input. setAttribute on path.d is safe for static content.
//   - No innerHTML assignments in this module.

const VALID_TABS = Object.freeze(new Set(['today', 'history', 'charts', 'accuracy']));

// Static tab definitions — icon paths chosen as clean 24x24 viewBox line-art.
// Today: crescent moon (sleep icon)
// History: list lines icon
// Charts: bar chart icon
// Accuracy: target/bullseye icon
const TABS = Object.freeze([
  {
    id: 'today',
    label: 'Today',
    // Crescent moon path — line-art style
    pathD: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',
  },
  {
    id: 'history',
    label: 'History',
    // List / lines icon
    pathD: 'M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h10v2H3v-2z',
  },
  {
    id: 'charts',
    label: 'Charts',
    // Bar chart icon
    pathD: 'M3 18v-6l3-3 4 2 4-5 3 3v9H3zm2-2h14v-3.5l-2.59-2.59L14 14l-4-2.18L8 13.9V16z',
  },
  {
    id: 'accuracy',
    label: 'Accuracy',
    // Target / bullseye icon
    pathD: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 12 6zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  },
]);

/**
 * Render a four-tab bottom navigation bar into root.
 *
 * @param {{
 *   root: HTMLElement,
 *   onTabChange?: (tabId: string) => void,
 * }} deps
 */
export function mountBottomNav({ root, onTabChange }) {
  root.replaceChildren();
  root.setAttribute('role', 'tablist');

  const svgNS = 'http://www.w3.org/2000/svg';

  for (const tab of TABS) {
    const button = document.createElement('button');
    button.setAttribute('role', 'tab');
    button.setAttribute('data-tab', tab.id);
    button.setAttribute('aria-selected', tab.id === 'today' ? 'true' : 'false');
    button.className = 'bottomNavTab';

    // Inline SVG icon (D7-02) — static path data, safe to use setAttribute.
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'currentColor');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', tab.pathD);
    svg.appendChild(path);

    // Text label (T-07-04-03: textContent, never innerHTML)
    const span = document.createElement('span');
    span.textContent = tab.label;

    button.append(svg, span);
    root.appendChild(button);
  }

  // Delegated click listener — validates tab ID before dispatching (T-07-04-01).
  root.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-tab]');
    if (!btn || !root.contains(btn)) return;
    const tabId = btn.getAttribute('data-tab');
    // Security invariant: only known tab IDs reach onTabChange.
    if (!VALID_TABS.has(tabId)) return;

    // Update aria-selected on all tab buttons immediately.
    for (const b of root.querySelectorAll('button[data-tab]')) {
      b.setAttribute('aria-selected', String(b === btn));
    }

    if (typeof onTabChange === 'function') {
      onTabChange(tabId);
    }
  });
}

/**
 * Programmatically set the active tab (e.g., on external tab change).
 * Updates aria-selected on nav buttons without firing onTabChange.
 *
 * @param {HTMLElement} root   the bottom-nav root element
 * @param {string} tabId       one of 'today'|'history'|'charts'|'accuracy'
 */
export function setActiveNavTab(root, tabId) {
  for (const b of root.querySelectorAll('button[data-tab]')) {
    b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tabId));
  }
}
