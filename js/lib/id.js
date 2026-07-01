// js/lib/id.js
// Event ID minting. Wraps the native crypto.randomUUID() global.
//
// === Why this file exists (CONTEXT.md "Claude's Discretion") ===
//
// 1. Per 01-CONTEXT.md, the event-id minting scheme is a discretion-point.
//    crypto.randomUUID() is the chosen default — available as a global in
//    Node 18+ and all evergreen browsers, cryptographically random, no
//    dependency, RFC4122 v4 shape (8-4-4-4-12 hex with the version nibble
//    fixed). A monotonic counter is a valid substitute (predictable IDs in
//    tests, deterministic ordering) — see RESEARCH §Don't Hand-Roll for the
//    trade-off discussion.
//
// 2. The runtime uses crypto.randomUUID() via this wrapper, NOT via direct
//    import of the global. The composition root (js/app.js) calls newEventId
//    from this module; tests inject their own id factory (typically a counter
//    `() => 'e' + (n++)') at the same seam so test fixtures are predictable.
//    See tests/integration/event-log.test.js makeTestLog() for the pattern.
//
// 3. Uniqueness contract (verified by tests/unit/id.test.js): 100 sequential
//    calls produce 100 distinct ids; each id matches the RFC4122 shape. This
//    is what crypto.randomUUID() guarantees by spec; codifying it here means
//    a future change to this file cannot silently break the contract.

/**
 * Mint a new event id.
 *
 * @returns {string} RFC4122 v4 UUID (8-4-4-4-12 hex, lowercase)
 */
export function newEventId() {
  return crypto.randomUUID();
}
