// tests/integration/today-hero-later-today.test.js
// Integration test: dual-hero rendering + "Later today" collapsible section
// (Phase 21 D-08/D-10/D-11/D-12/D-13, Plan 21-02 Task 2).
//
// Verifies:
//   1. renderNextEventCard given a 2-element prediction array produces a
//      .hero-row wrapper with exactly 2 .next-event-hero children (D-08).
//   2. renderNextEventCard given a single prediction (or a 1-element array)
//      returns the pre-existing bare .next-event-hero shape — no .hero-row.
//   3. renderForecastSection's "Later today" <details> auto-expands a nested
//      TIF-shaped card (removing .collapsed) once the section's `toggle`
//      event fires in the open state (D-13).
//
// Runs in Node.js via node:test. A minimal DOM mock is set on globalThis
// before the module import, mirroring tests/integration/today-card-collapse.test.js's
// pattern, extended with:
//   - compound-class selector matching (e.g. '.tif-card.collapsed') — the
//     production auto-expand listener needs this.
//   - dispatchEvent(eventName) — simulates the native <details> 'toggle' event.
//
// Run: node --test tests/integration/today-hero-later-today.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal DOM mock — installed on globalThis before any DOM-using modules
// are invoked.
// ---------------------------------------------------------------------------

class MockNode {
  constructor() {
    this._children = [];
  }

  appendChild(child) {
    this._children.push(child);
    return child;
  }

  replaceChildren(...nodes) {
    this._children = [...nodes];
  }

  /** Depth-first walk of all descendants, invoking visitor(node). */
  _walk(visitor) {
    for (const child of this._children) {
      visitor(child);
      if (child._walk) child._walk(visitor);
    }
  }

  /** querySelectorAll — supports single AND compound class selectors (.foo.bar). */
  querySelectorAll(selector) {
    const results = [];
    this._walk((node) => {
      if (_matchesSel(node, selector)) results.push(node);
    });
    return results;
  }

  /** querySelector — first match from querySelectorAll. */
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class MockElement extends MockNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this._classSet = new Set();
    this.type = '';
    this.id = '';
    this.checked = false;
    this.scrollTop = 0;
    this._textContent = '';
    this._attrs = {};
    this._listeners = {};
    this.style = {};

    this.classList = {
      add: (cls) => this._classSet.add(cls),
      remove: (cls) => this._classSet.delete(cls),
      contains: (cls) => this._classSet.has(cls),
      toggle: (cls) => {
        if (this._classSet.has(cls)) {
          this._classSet.delete(cls);
          return false;
        }
        this._classSet.add(cls);
        return true;
      },
    };
  }

  get className() { return [...this._classSet].join(' '); }
  set className(v) {
    this._classSet = new Set(v ? v.split(/\s+/).filter(Boolean) : []);
  }

  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v); }

  setAttribute(name, value) { this._attrs[name] = String(value); }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
  }

  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  /** Simulate a click: fires all registered 'click' listeners in order. */
  click() {
    const e = { preventDefault: () => {}, target: this };
    for (const fn of (this._listeners['click'] || [])) fn(e);
  }

  /**
   * Simulate any DOM event (used here for the native <details> 'toggle'
   * event, which today-screen.js's Later-Today auto-expand listener relies
   * on — D-13). Fires all registered listeners for the given event name.
   */
  dispatchEvent(eventName) {
    const e = { type: eventName, target: this };
    for (const fn of (this._listeners[eventName] || [])) fn(e);
    return true;
  }
}

/**
 * Matches a selector against a node's classList and/or attributes. Supports:
 *   - single ('.foo') AND compound ('.foo.bar') class selectors — the
 *     production auto-expand listener in today-screen.js queries
 *     '.tif-card.collapsed' / '.probability-band.collapsed', which
 *     today-card-collapse.test.js's original single-class-only matcher
 *     could not resolve.
 *   - attribute-value selectors ('[data-event-type="wake"]') — 20-06 G-20-15
 *     regression coverage needs to assert a card's data-event-type directly,
 *     which the original class-only matcher silently always failed (never
 *     matched, regardless of the actual DOM state) rather than raising an
 *     error, letting a stale assertion pass for the wrong reason.
 */
function _matchesSel(node, selector) {
  if (!node) return false;
  if (selector.startsWith('[')) {
    const m = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (!m || !node.getAttribute) return false;
    const [, attrName, attrValue] = m;
    const actual = node.getAttribute(attrName);
    if (actual === null) return false;
    return attrValue === undefined ? true : actual === attrValue;
  }
  if (!node.classList) return false;
  if (selector.startsWith('.')) {
    const classes = selector.slice(1).split('.').filter(Boolean);
    return classes.length > 0 && classes.every((cls) => node.classList.contains(cls));
  }
  return false;
}

function createMockDocument() {
  return {
    createElement(tag) { return new MockElement(tag); },
    createTextNode(text) {
      const n = new MockNode();
      n._text = text;
      return n;
    },
  };
}

// Install DOM globals before the module import.
globalThis.document = createMockDocument();
globalThis.window = { confirm: () => false };

// ---------------------------------------------------------------------------
// Import from today-screen.js
// ---------------------------------------------------------------------------

import { renderNextEventCard, renderForecastSection } from '../../js/ui/today-screen.js';

// ---------------------------------------------------------------------------
// Test 1/2: renderNextEventCard dual-hero vs single-hero shape (D-08)
// ---------------------------------------------------------------------------

describe('renderNextEventCard (Phase 21 D-08 dual-hero)', () => {
  const napStartPred = { type: 'napStart', isMissed: false, central: '13:00', min: '12:30', max: '13:30' };
  const bedtimeAfterWakePred = { type: 'bedtimeAfterWake', isMissed: false, central: '21:00', min: '20:30', max: '21:30' };

  it('2-element array produces a .hero-row wrapper with exactly 2 .next-event-hero children', () => {
    const el = renderNextEventCard([napStartPred, bedtimeAfterWakePred], '24h');
    assert.ok(el.classList.contains('hero-row'), 'result must be the .hero-row wrapper');
    const heroCards = el.querySelectorAll('.next-event-hero');
    assert.strictEqual(heroCards.length, 2, 'exactly 2 .next-event-hero children expected');
  });

  it('single (bare) prediction returns the pre-existing single-hero shape — no .hero-row', () => {
    const el = renderNextEventCard(napStartPred, '24h');
    assert.ok(el.classList.contains('next-event-hero'), 'must be a .next-event-hero card');
    assert.ok(!el.classList.contains('hero-row'), 'must NOT be wrapped in .hero-row');
  });

  it('1-element array is treated the same as a bare single prediction — no .hero-row', () => {
    const el = renderNextEventCard([napStartPred], '24h');
    assert.ok(el.classList.contains('next-event-hero'), 'must be a .next-event-hero card');
    assert.ok(!el.classList.contains('hero-row'), 'must NOT be wrapped in .hero-row for a 1-element array');
  });

  it('null/undefined/empty array all return null', () => {
    assert.strictEqual(renderNextEventCard(null, '24h'), null);
    assert.strictEqual(renderNextEventCard(undefined, '24h'), null);
    assert.strictEqual(renderNextEventCard([], '24h'), null);
  });
});

// ---------------------------------------------------------------------------
// Test 3: "Later today" auto-expand on toggle (D-13)
// ---------------------------------------------------------------------------

describe('renderForecastSection "Later today" section (D-10/D-11/D-12/D-13)', () => {
  /** A single day record whose last event is 'bedtime' → nextReachableEvent → ['wake'] hero only. */
  function makeDayRecords() {
    return [{
      date: '2026-01-01',
      wake: '06:30',
      bedtime: '21:00',
      napStart: '13:00',
      napEnd: '14:00',
      rejected: false,
      allEvents: [
        { id: 'w-1', type: 'wake', at: '2026-01-01T06:30' },
        { id: 'ns-1', type: 'napStart', at: '2026-01-01T13:00' },
        { id: 'ne-1', type: 'napEnd', at: '2026-01-01T14:00' },
        { id: 'b-1', type: 'bedtime', at: '2026-01-01T21:00' },
      ],
    }];
  }

  function makePredictions() {
    return {
      isColdStart: false,
      wake: { central: '06:30', min: '06:00', max: '07:00' },
      bedtime: { central: '21:00', min: '20:30', max: '21:30' },
      // TIF-shaped (precisionScore set, isLowConfidence absent) → renderTifNormalCard,
      // which starts collapsed — this is the nested card D-13's auto-expand targets.
      napStart: { central: '13:00', min: '12:30', max: '13:30', precisionScore: 80 },
      napEnd: { central: '14:00', min: '13:30', max: '14:30' },
      bedtimeAfterWake: null,
    };
  }

  const settingsSnap = { timeFormat: '24h', eveningHour: 18, precisionTarget: 60 };

  function renderAndGetLaterToday() {
    const nextEventCard = new MockElement('div');
    const coldStartMsg = new MockElement('div');
    const forecastCards = new MockElement('section');
    renderForecastSection(makePredictions(), settingsSnap, makeDayRecords(), nextEventCard, coldStartMsg, forecastCards);
    const laterToday = forecastCards.querySelector('.later-today-section');
    return { nextEventCard, forecastCards, laterToday };
  }

  it('exactly one .later-today-section <details> is present under forecastCards, with no `open` set', () => {
    const { forecastCards, laterToday } = renderAndGetLaterToday();
    const sections = forecastCards.querySelectorAll('.later-today-section');
    assert.strictEqual(sections.length, 1, 'exactly one .later-today-section expected');
    assert.ok(laterToday, '.later-today-section must be found');
    assert.strictEqual(laterToday.open, undefined, 'must not start with `open` set (collapsed by default, D-11)');
  });

  it('the hero (wake) is rendered into nextEventCard AND also gets its own detail card inside Details', () => {
    const { nextEventCard, laterToday } = renderAndGetLaterToday();
    const hero = nextEventCard.querySelector('.next-event-hero');
    assert.ok(hero, 'hero card must be present in nextEventCard');
    assert.strictEqual(hero.getAttribute('data-event-type'), 'wake');
    // G-20-15 gap closure: the hero's own type is no longer excluded from
    // Details, so the next predicted event always has a detail card
    // somewhere, not just a vague hero card.
    const wakeCardsInLaterToday = laterToday.querySelectorAll('[data-event-type="wake"]');
    assert.strictEqual(wakeCardsInLaterToday.length, 1, 'wake must also appear inside Details, exactly once');
  });

  it('a nested TIF-shaped card starts with .collapsed', () => {
    const { laterToday } = renderAndGetLaterToday();
    const tifCard = laterToday.querySelector('.tif-card');
    assert.ok(tifCard, 'TIF-shaped napStart card must be nested in Later Today');
    assert.ok(tifCard.classList.contains('collapsed'), 'TIF card must start collapsed');
  });

  it('dispatching `toggle` while open removes .collapsed from the nested TIF card and flips its chevron to ↑ (D-13)', () => {
    const { laterToday } = renderAndGetLaterToday();
    const tifCard = laterToday.querySelector('.tif-card');
    assert.ok(tifCard.classList.contains('collapsed'), 'sanity: starts collapsed');

    laterToday.open = true;
    laterToday.dispatchEvent('toggle');

    assert.ok(!tifCard.classList.contains('collapsed'), '.collapsed must be removed once Later Today opens');
    const chevron = tifCard.querySelector('.card-chevron');
    assert.ok(chevron, 'chevron must exist');
    assert.strictEqual(chevron.textContent, '↑', 'chevron must flip to ↑ on auto-expand');
  });

  it('dispatching `toggle` while closed (open=false) does NOT auto-expand', () => {
    const { laterToday } = renderAndGetLaterToday();
    const tifCard = laterToday.querySelector('.tif-card');

    laterToday.open = false;
    laterToday.dispatchEvent('toggle');

    assert.ok(tifCard.classList.contains('collapsed'), '.collapsed must remain when the section is not open');
  });
});
