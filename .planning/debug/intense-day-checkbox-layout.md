---
status: resolved
trigger: "CSS layout bug G-NW-12-3: Intense day checkbox in manualEntry dialog renders stacked (checkbox on own line, label text below) instead of inline"
created: 2026-08-26T00:00:00
updated: 2026-08-26T00:00:00
---

## Current Focus

hypothesis: CONFIRMED — `.checkboxRow` override selector omitted `#manualEntry`, leaving `#manualEntry label { flex-direction: column }` unopposed
test: git show 1cf2361 -- style.css confirms the pre-fix selector was `#settings label.checkboxRow` only
expecting: adding `#manualEntry label.checkboxRow` to the selector group restores row layout
next_action: COMPLETE — fix already applied in commit 1cf2361

## Symptoms

expected: "Intense day" checkbox and its label text render side-by-side on the same row (inline)
actual: Checkbox rendered centred on its own line; "Intense day" text appeared below it (stacked vertically)
errors: none (visual layout regression only)
reproduction: Open the Add Event modal (#manualEntry); observe the "Intense day" label at the bottom of the form
started: Introduced when the PRED-10 intense-day checkbox was added to the manualEntry dialog (NW-12 phase)

## Eliminated

- hypothesis: browser default checkbox display causing centering
  evidence: root cause is purely in the flex container on the <label> — no browser default involved
  timestamp: 2026-08-26

- hypothesis: fieldset label styles from #settings bleeding in
  evidence: the label is a direct child of <form> in #manualEntry, not inside a <fieldset>; no fieldset rule applies
  timestamp: 2026-08-26

## Evidence

- timestamp: 2026-08-26
  checked: style.css lines 263-269 — #manualEntry label rule
  found: display:flex; flex-direction:column; gap:0.2rem applied to ALL labels inside #manualEntry
  implication: every <label> in the dialog stacks its children vertically by default

- timestamp: 2026-08-26
  checked: style.css lines 399-404 — .checkboxRow override rule (current)
  found: selector is "#settings label.checkboxRow, #manualEntry label.checkboxRow"; sets flex-direction:row; align-items:center; gap:0.5rem
  implication: fix is in place — but BEFORE commit 1cf2361 only #settings label.checkboxRow was listed

- timestamp: 2026-08-26
  checked: git show 1cf2361 -- style.css
  found: diff shows exactly one selector line was added — ",\n#manualEntry label.checkboxRow" — confirming the pre-fix selector was #settings only
  implication: root cause confirmed; fix is the addition of #manualEntry label.checkboxRow to the selector group

- timestamp: 2026-08-26
  checked: index.html lines 171-174 — DOM structure of the checkbox label
  found: <label class="checkboxRow"> is a direct child of <form method="dialog"> inside #manualEntry, NOT inside a <fieldset>
  implication: no fieldset-scoped rule applies; the only competing rules are #manualEntry label and the .checkboxRow override

## Resolution

root_cause: "#manualEntry label { display:flex; flex-direction:column } at style.css:263 applied column layout to ALL labels in the manualEntry dialog. The .checkboxRow override rule (style.css:399) only listed '#settings label.checkboxRow' in its selector — #manualEntry label.checkboxRow was absent. With no override, the <label class='checkboxRow'> used flex-direction:column, stacking the checkbox above the text."
fix: "Added '#manualEntry label.checkboxRow' to the existing .checkboxRow selector group (style.css:399-404). The higher-specificity rule (1,1,1 vs 1,0,1) then overrides flex-direction to 'row' and sets align-items:center; gap:0.5rem, rendering checkbox and text inline."
verification: "Fix confirmed via git show 1cf2361; selector change is a 2-line diff — one comma and one new selector line. The cascade is clean: display:flex inherited from #manualEntry label, flex-direction:row from the now-matched .checkboxRow override."
files_changed:
  - style.css
