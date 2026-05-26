// js/lib/id.js
// Event ID minting. Wraps the native crypto.randomUUID() global.
//
// Per CONTEXT.md "Claude's Discretion" — crypto.randomUUID() is the chosen
// default (available in Node 18+ and all evergreen browsers). Tests inject
// a counter via the composition root for predictable IDs; the runtime keeps
// the uuid wrapper here so the event log doesn't import the global directly.

export function newEventId() {
  return crypto.randomUUID();
}
