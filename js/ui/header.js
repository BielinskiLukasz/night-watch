// js/ui/header.js
// App header strip — renders the subject name, Settings gear trigger, and
// Today | History tab navigation.
//
// Plan: 02-04 (Task 1) — initial header + subject name + gear trigger
// Plan: 04-02 (Task 1) — added Today | History tab navigation (D4-07)
// Decisions: D2-10 (header layout), D2-11 (document.title formula),
//            D2-12 (gear opens Settings), D4-07 (two-tab header nav)
// Requirements: CFG-01, UI-03
//
// Security invariants (Pitfall #5 / T-07 / T-2-13):
//   - h1.textContent is the ONLY write path for subjectName. innerHTML is
//     never assigned in this module. The settings-store validator already
//     enforces maxLen:40, but the maxlength="40" attribute in index.html
//     and textContent assignment here form the belt-and-suspenders defense.
//   - document.title assignment is HTML-inert (browsers do not parse the
//     title string as markup), and we never construct any DOM node from
//     subjectName beyond the h1.textContent write above.
//   - Tab button textContent is a static literal ('Today' / 'History') —
//     never user input. data-tab attribute values are validated at the click
//     handler level (only known tab IDs trigger onTabChange).

import { openSettings } from './settings-modal.js';

const VALID_TABS = new Set(['today', 'history']);

/**
 * Mount the header into the given root element.
 *
 * Expects root to contain:
 *   - a pre-rendered <h1 class="subjectName">
 *   - a <button class="settingsTrigger">
 *   - a <nav class="tabNav" role="tablist"> with two <button data-tab="today|history">
 *     (declared statically in index.html, or injected by this function if absent)
 *
 * The header subscribes to settings changes so subjectName updates from
 * the modal Save flow propagate immediately without a manual call —
 * settings.update() fires subscribers synchronously (D2-09).
 *
 * Tab navigation (D4-07): emits onTabChange(tabId) when user clicks a tab.
 * Updates aria-selected on both tab buttons immediately (no server round-trip).
 *
 * Plan 05-04: accepts optional onSettings callback. When provided, that
 * callback fires instead of the default openSettings({ settings }) call,
 * allowing app.js to inject additional deps (eventLog, storage, id).
 *
 * @param {{
 *   root: HTMLElement,
 *   settings: { get: () => object, subscribe: (fn: (snap: object) => void) => () => void },
 *   onTabChange?: (tabId: 'today'|'history') => void,
 *   onSettings?: () => void,
 * }} deps
 */
export function mountHeader({ root, settings, onTabChange, onSettings }) {
  const h1 = root.querySelector('h1.subjectName');
  const trigger = root.querySelector('button.settingsTrigger');
  const tabNav = root.querySelector('nav.tabNav');

  const apply = (snap) => {
    // T-07 / Pitfall #5: textContent ONLY. Never innerHTML.
    h1.textContent = snap.subjectName || 'Nightwatch';
    // document.title: 'Nightwatch — {name}' when set, 'Nightwatch' when empty (D2-11).
    document.title = snap.subjectName ? `Nightwatch — ${snap.subjectName}` : 'Nightwatch';
  };

  apply(settings.get());
  settings.subscribe(apply);

  trigger.addEventListener('click', () => {
    if (typeof onSettings === 'function') {
      onSettings();
    } else {
      openSettings({ settings });
    }
  });

  // Tab navigation (D4-07). If no onTabChange callback provided, tab clicks
  // update aria-selected state but do not switch screens.
  if (tabNav) {
    tabNav.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-tab]');
      if (!btn || !tabNav.contains(btn)) return;
      const tabId = btn.getAttribute('data-tab');
      // Only known tab IDs are forwarded (security: no user-controlled string
      // flows into application state without validation).
      if (!VALID_TABS.has(tabId)) return;

      // Update aria-selected on all tab buttons immediately.
      for (const tabBtn of tabNav.querySelectorAll('button[data-tab]')) {
        tabBtn.setAttribute('aria-selected', String(tabBtn === btn));
      }

      if (typeof onTabChange === 'function') {
        onTabChange(tabId);
      }
    });
  }
}

/**
 * Programmatically set the active tab (e.g., on initial render).
 * Updates aria-selected on the tabNav buttons without firing onTabChange.
 *
 * @param {HTMLElement} root  the header root element
 * @param {'today'|'history'} tabId
 */
export function setActiveTab(root, tabId) {
  const tabNav = root.querySelector('nav.tabNav');
  if (!tabNav) return;
  for (const btn of tabNav.querySelectorAll('button[data-tab]')) {
    btn.setAttribute('aria-selected', String(btn.getAttribute('data-tab') === tabId));
  }
}
