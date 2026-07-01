// js/adapters/clock-system.js
// Real ClockAdapter backed by `new Date()`.
//
// THIS IS THE ONLY PLACE `new Date()` MAY APPEAR IN js/ OUTSIDE THE
// adapters/ folder (T-04 architectural invariant; Plan 05 enforces via
// a grep smoke test). Code that needs "now" must inject a ClockAdapter
// through the composition root (js/app.js).

export function createClockSystem() {
  return {
    now() {
      return new Date();
    },
  };
}
