// tests/integration/today-card-collapse.test.js
// Integration test: probability-band prediction card collapse/expand toggle
// (UI-09 / D9-05/D9-06).
//
// Verifies:
//   1. hasProbBand=true: renderPredictionCard returns element with .collapsed class.
//   2. hasProbBand=true: .card-summary child exists.
//   3. hasProbBand=true: .card-chevron child exists with textContent '↓' (↓).
//   4. hasProbBand=true: .card-full child exists.
//   5. Click card: .collapsed removed, chevron → '↑' (↑).
//   6. Second click: .collapsed restored, chevron → '↓' (↓).
//   7. hasProbBand=false: no .collapsed class, no .card-summary child.
//
// Runs in Node.js via node:test. A minimal DOM mock is set on globalThis before
// the module import so el() (from dom.js) can call document.createElement.
// Only the DOM operations used by renderPredictionCard are needed here.
//
// Run: node --test tests/integration/today-card-collapse.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal DOM mock — installed on globalThis before any DOM-using modules
// are invoked. Only the operations used by renderPredictionCard are needed.
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

  /** querySelectorAll — supports single class selectors (.foo) only. */
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

    // classList proxy backed by _classSet.
    // className getter/setter keeps _classSet in sync so both APIs agree.
    this.classList = {
      add: (cls) => this._classSet.add(cls),
      remove: (cls) => this._classSet.delete(cls),
      contains: (cls) => this._classSet.has(cls),
      /**
       * toggle(cls): standard classList.toggle behaviour.
       * Returns true if the class is NOW present (was just added),
       * false if the class is NO LONGER present (was just removed).
       */
      toggle: (cls) => {
        if (this._classSet.has(cls)) {
          this._classSet.delete(cls);
          return false; // no longer has it
        }
        this._classSet.add(cls);
        return true; // now has it
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
}

function _matchesSel(node, selector) {
  if (!node || !node.classList) return false;
  if (selector.startsWith('.')) {
    const cls = selector.slice(1);
    return node.classList.contains(cls);
  }
  return false;
}

function createMockDocument() {
  return {
    createElement(tag) { return new MockElement(tag); },
    createTextNode(text) {
      // Used by dom.js el() when appending string children; not needed by
      // renderPredictionCard directly, but included for completeness.
      const n = new MockNode();
      n._text = text;
      return n;
    },
  };
}

// Install DOM globals before the module import.
// Module bodies run lazily — DOM is only accessed inside function bodies,
// never at module evaluation time — so setting globals here is sufficient.
globalThis.document = createMockDocument();
globalThis.window = { confirm: () => false };

// ---------------------------------------------------------------------------
// Import renderPredictionCard from today-screen.js
// NOTE: renderPredictionCard must be exported from today-screen.js for this
// import to succeed. If it is not yet exported, this import will fail with
// a named-export error, confirming the RED state.
// ---------------------------------------------------------------------------

import { renderPredictionCard } from '../../js/ui/today-screen.js';

// ---------------------------------------------------------------------------
// Shared test fixture helpers
// ---------------------------------------------------------------------------

/** A minimal probability-band prediction for a 'bedtime' event. */
function makeProbBandPred() {
  return {
    probabilityBand: [
      { time: '22:00', prob: 30 },
      { time: '23:30', prob: 70 },
    ],
  };
}

/** A minimal normal (non-prob-band) prediction for a 'wake' event. */
function makeNormalPred() {
  return { central: '06:30' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderPredictionCard collapse/expand toggle (UI-09)', () => {

  // --- hasProbBand = true ---

  it('hasProbBand=true: card has .collapsed class by default', () => {
    const card = renderPredictionCard(makeProbBandPred(), 'bedtime', '24h');
    assert.ok(
      card.classList.contains('collapsed'),
      'hasProbBand card must start with .collapsed class',
    );
  });

  it('hasProbBand=true: .card-summary child exists', () => {
    const card = renderPredictionCard(makeProbBandPred(), 'bedtime', '24h');
    const summary = card.querySelector('.card-summary');
    assert.ok(summary !== null, '.card-summary element must be present in hasProbBand card');
  });

  it('hasProbBand=true: .card-chevron child has textContent "↓" (U+2193)', () => {
    const card = renderPredictionCard(makeProbBandPred(), 'bedtime', '24h');
    const chevron = card.querySelector('.card-chevron');
    assert.ok(chevron !== null, '.card-chevron element must be present');
    assert.strictEqual(
      chevron.textContent,
      '↓',
      '.card-chevron must show ↓ (U+2193) when collapsed',
    );
  });

  it('hasProbBand=true: .card-full child exists', () => {
    const card = renderPredictionCard(makeProbBandPred(), 'bedtime', '24h');
    const full = card.querySelector('.card-full');
    assert.ok(full !== null, '.card-full element must be present in hasProbBand card');
  });

  it('click: .collapsed removed and chevron changes to "↑" (U+2191)', () => {
    const card = renderPredictionCard(makeProbBandPred(), 'bedtime', '24h');
    card.click();
    assert.ok(
      !card.classList.contains('collapsed'),
      'card must NOT have .collapsed after first click (expanded)',
    );
    const chevron = card.querySelector('.card-chevron');
    assert.strictEqual(
      chevron.textContent,
      '↑',
      '.card-chevron must show ↑ (U+2191) when expanded',
    );
  });

  it('second click: .collapsed restored and chevron returns to "↓" (U+2193)', () => {
    const card = renderPredictionCard(makeProbBandPred(), 'bedtime', '24h');
    card.click(); // expand
    card.click(); // collapse
    assert.ok(
      card.classList.contains('collapsed'),
      'card must have .collapsed again after second click',
    );
    const chevron = card.querySelector('.card-chevron');
    assert.strictEqual(
      chevron.textContent,
      '↓',
      '.card-chevron must return to ↓ (U+2193) after second click (re-collapsed)',
    );
  });

  // --- hasProbBand = false ---

  it('hasProbBand=false: card does NOT have .collapsed class', () => {
    const card = renderPredictionCard(makeNormalPred(), 'wake', '24h');
    assert.ok(
      !card.classList.contains('collapsed'),
      'non-probBand card must NOT have .collapsed class',
    );
  });

  it('hasProbBand=false: .card-summary element is absent', () => {
    const card = renderPredictionCard(makeNormalPred(), 'wake', '24h');
    const summary = card.querySelector('.card-summary');
    assert.strictEqual(
      summary,
      null,
      '.card-summary must not exist for non-probBand card',
    );
  });
});
