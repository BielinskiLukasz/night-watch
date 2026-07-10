// tests/integration/history-edit-mode.test.js
// Integration test: editMode toggle on History screen (UI-07 / D9-01–D9-04).
//
// Verifies:
//   1. Initial mount: no .rowEdit elements present (edit mode off by default).
//   2. After clicking .btnEditToggle: .rowEdit elements appear.
//   3. After a second click: .rowEdit elements disappear again.
//   4. Remount (new call to mountHistoryScreen): toggle resets to off, .rowEdit absent.
//
// This test runs in Node.js via node:test. Because mountHistoryScreen uses
// DOM APIs, a minimal DOM mock is established on globalThis before the import
// of the screen module. All DOM reads are via querySelectorAll on a plain JS
// tree — no browser, no jsdom, no npm packages.
//
// Run: node --test tests/integration/history-edit-mode.test.js

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal DOM mock — installed on globalThis before any DOM-using modules
// are invoked. Only the operations used by history-screen.js are needed.
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
    this.className = '';
    this.type = '';
    this.id = '';
    this.checked = false;
    this.scrollTop = 0;
    this._textContent = '';
    this._attrs = {};
    this._listeners = {};
  }

  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v); }

  setAttribute(name, value) { this._attrs[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null; }

  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  /** Simulate a click event on this element. */
  click() {
    const e = { preventDefault: () => {}, target: this };
    for (const fn of (this._listeners['click'] || [])) fn(e);
  }
}

function _matchesSel(node, selector) {
  if (!node || typeof node.className !== 'string') return false;
  if (selector.startsWith('.')) {
    const cls = selector.slice(1);
    return node.className.split(/\s+/).includes(cls);
  }
  return false;
}

function createMockDocument() {
  return {
    createElement(tag) { return new MockElement(tag); },
    createTextNode(text) {
      // history-screen.js does not call createTextNode directly, but dom.js does.
      const n = new MockNode();
      n._text = text;
      return n;
    },
  };
}

// Install DOM globals before importing screen module (imports are hoisted but
// module bodies run lazily; setting globals here is sufficient because the
// DOM API is only accessed inside function bodies, not at module init time).
globalThis.document = createMockDocument();
// window.confirm is referenced inside the delete-button handler; return false
// so any accidental trigger cancels rather than advancing.
globalThis.window = { confirm: () => false };

// ---------------------------------------------------------------------------
// Store imports — these use no DOM, just pure JS stores.
// ---------------------------------------------------------------------------

import { createEventLog } from '../../js/store/event-log.js';
import { createSettingsStore } from '../../js/store/settings.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';
import { mountHistoryScreen } from '../../js/ui/history-screen.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idSeq = 0;
function makeId() { return () => `e${++_idSeq}`; }

/**
 * Wire up memory storage + fixed clock + event log + settings store.
 * Seeds three events so every day row has at least one populated slot.
 */
function makeSetup() {
  const storage = createStorageMemory();
  const clock = createClockFixed(new Date(2026, 4, 20, 12, 0)); // 2026-05-20 noon
  const eventLog = createEventLog({ storage, clock, id: makeId() });
  const settings = createSettingsStore({ storage });

  // Seed three events on the same subjective night so one day row appears
  // with three populated time slots (wake, napStart, bedtime).
  eventLog.addEventAt('wake',     '2026-05-20T06:30');
  eventLog.addEventAt('napStart', '2026-05-20T13:00');
  eventLog.addEventAt('bedtime',  '2026-05-20T21:00');

  return { eventLog, settings };
}

/** Create a fresh mock root element to mount the screen into. */
function makeRoot() { return new MockElement('div'); }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('history-edit-mode toggle (UI-07)', () => {
  it('initial mount: no .rowEdit elements visible (edit mode off)', () => {
    const { eventLog, settings } = makeSetup();
    const root = makeRoot();

    const { unsubscribe } = mountHistoryScreen({ root, eventLog, settings });
    try {
      const editButtons = root.querySelectorAll('.rowEdit');
      assert.strictEqual(
        editButtons.length,
        0,
        `Expected 0 .rowEdit elements on initial mount, got ${editButtons.length}`,
      );
    } finally {
      unsubscribe();
    }
  });

  it('after clicking .btnEditToggle: .rowEdit elements appear for each data slot', () => {
    const { eventLog, settings } = makeSetup();
    const root = makeRoot();

    const { unsubscribe } = mountHistoryScreen({ root, eventLog, settings });
    try {
      const toggleBtn = root.querySelector('.btnEditToggle');
      assert.ok(toggleBtn, 'btnEditToggle must be present in the toolbar');

      toggleBtn.click();

      const editButtons = root.querySelectorAll('.rowEdit');
      assert.ok(
        editButtons.length > 0,
        `Expected .rowEdit elements after enabling edit mode, got ${editButtons.length}`,
      );
    } finally {
      unsubscribe();
    }
  });

  it('after second click: .rowEdit elements disappear', () => {
    const { eventLog, settings } = makeSetup();
    const root = makeRoot();

    const { unsubscribe } = mountHistoryScreen({ root, eventLog, settings });
    try {
      const toggleBtn = root.querySelector('.btnEditToggle');
      assert.ok(toggleBtn, 'btnEditToggle must be present');

      toggleBtn.click(); // ON
      toggleBtn.click(); // OFF

      const editButtons = root.querySelectorAll('.rowEdit');
      assert.strictEqual(
        editButtons.length,
        0,
        `Expected 0 .rowEdit elements after toggling off, got ${editButtons.length}`,
      );
    } finally {
      unsubscribe();
    }
  });

  it('remount resets toggle state: .rowEdit absent after fresh mount', () => {
    const { eventLog, settings } = makeSetup();
    const root1 = makeRoot();

    // First mount — enable edit mode
    const { unsubscribe: unsub1 } = mountHistoryScreen({ root: root1, eventLog, settings });
    const toggleBtn1 = root1.querySelector('.btnEditToggle');
    assert.ok(toggleBtn1, 'btnEditToggle must be present in first mount');
    toggleBtn1.click(); // enable edit mode
    assert.ok(root1.querySelectorAll('.rowEdit').length > 0, 'edit mode should be on after click');
    unsub1();

    // Remount into a fresh root — edit mode must start off
    const root2 = makeRoot();
    const { unsubscribe: unsub2 } = mountHistoryScreen({ root: root2, eventLog, settings });
    try {
      const editButtonsAfterRemount = root2.querySelectorAll('.rowEdit');
      assert.strictEqual(
        editButtonsAfterRemount.length,
        0,
        `Expected 0 .rowEdit elements after remount (toggle must reset), got ${editButtonsAfterRemount.length}`,
      );

      const toggleBtn2 = root2.querySelector('.btnEditToggle');
      assert.ok(toggleBtn2, 'btnEditToggle must be present after remount');
      assert.strictEqual(
        toggleBtn2.getAttribute('aria-pressed'),
        'false',
        'aria-pressed must be "false" after remount',
      );
      assert.strictEqual(
        toggleBtn2.textContent,
        'Edit history',
        'button label must reset to "Edit history" after remount',
      );
    } finally {
      unsub2();
    }
  });
});
