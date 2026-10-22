# Project Report

Formula Foundry can collect results from several calculators into one print-ready report.
Everything is browser-local (`localStorage`, key `formulaFoundry.projectReport`); there is no backend.

## Using it
1. Calculate on any calculator page and press **Add to Project Report**.
2. Repeat on other calculators. The nav shows the entry count.
3. Open `report.html`: edit project metadata and general notes, rename, reorder, annotate or remove entries, or clear the project (with confirmation).
4. Press **Print / Save as PDF** and use the browser's print dialog. The app does not generate PDF files itself.

## Snapshot model
Each entry is a frozen copy: `{ id, calculatorId, calculatorName, title, notes, addedAt, inputs[{label,value,unit}], outputs[{label,value,unit}], equations[], assumptions[], method, warnings[], sourceUrl }`. Beam bending stress and beam deflection entries additionally store a validated `beam-section` diagram model (profile, SI dimensions, display unit, and selected axis), which is rendered into the report.
Design Studies entries (see `docs/design-studies.md`) may also carry `study` metadata, `tables[]` and a line `chart`; the report prints the numeric tables and an SVG chart rendered from stored points.
Entries are never recomputed. Re-adding a calculation creates a new entry (there is no in-place "update" yet).

Print output flows naturally: the project summary and index stay compact, short calculations can share a page, and long entries continue across pages. Use the browser's print preview or Save as PDF to inspect the final page breaks.

## Rules
- Invalid, incomplete, non-finite or stale results (inputs/result text changed since Calculate) are rejected with a message.
- Stored data is versioned (schema 1) and validated on load; invalid entries are dropped individually.
- If `localStorage` is unavailable the store falls back to memory for the session.

## Calculator integration
Structured calculators call `FormulaFoundryReport.declareStructured()` and `FormulaFoundryReport.recordResult(snapshot)` after a successful calculation and `clearResult()` on reset/failure. Other calculators are captured by scraping the visible inputs, result panel and equations. Include `js/report-builder.js` before `</body>`.

## Tests
`tests/core/report-builder.test.js`, `tests/smoke/project-report.test.js`, `tests/smoke/new-calculators-registry.test.js`.
