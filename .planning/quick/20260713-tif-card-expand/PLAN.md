---
slug: tif-card-expand
date: 2026-07-13
status: in-progress
---

# Quick Task: TIF Normal Card — Collapsible + Evidence Windows

## Goal

Make TIF normal prediction cards expandable so users can inspect the source evidence windows that produced each prediction.

## Change

**File:** `js/ui/today-screen.js` — `renderTifNormalCard()`

Converted from a flat, always-visible card to a collapsible card following the same pattern as `renderTifLowConfidenceCard`:

- **Collapsed (default):** summary row — `Label — central — min–max ↓`
- **Expanded (click):** full details — uppercase label, central time, display band, algorithm range (when wider than precisionTarget), source evidence windows list (`tif-source-list`), precision score badge

The `sourceWindows` list (`[{ label, min, max }]`) was already present in every TIF prediction object but not exposed in the UI for normal (high-confidence) cards. The CSS collapse machinery (`collapsed`, `card-full`, `card-summary`, `tif-source-list`) was already in place from Phase 9/10.

## Tasks

- [x] Apply change to `renderTifNormalCard`
- [x] Run tests
- [x] Commit
