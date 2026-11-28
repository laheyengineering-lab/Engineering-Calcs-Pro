# Project Report

Formula Foundry can collect results from calculators, Design Studies, and Engineering Workflows into one print-ready report.
Everything is browser-local (`localStorage`, key `formulaFoundry.projectReport`); there is no backend.

## Using it
1. Calculate on any calculator page and press **Add to Project Report**.
2. Repeat on other calculators. The nav shows the entry count.
3. Open `report.html`: edit project metadata and general notes, rename, reorder, annotate or remove entries, or clear the project (with confirmation).
4. Press **Print / Save as PDF** and use the browser's print dialog. The app does not generate PDF files itself.

## Move a project to another browser

1. On the Project Report page, choose **Export Project JSON**. Keep the downloaded JSON file as a backup or copy it to the other device. It contains all saved project information and notes, calculations in report order, equations, assumptions, units, full saved numeric values, and any saved diagram, table, chart, and Design Study snapshot data.
2. Open the Project Report page in the destination browser and choose **Import Project JSON**. Select the downloaded file. Imports accept Formula Foundry schema version 1 and files up to 32 MiB. A validation error leaves the current project intact.
3. Confirm replacement to load the file. Import replaces the entire current project, so export the current project first if you want to keep it. Canceling the confirmation keeps the current project.

If the browser cannot save to local storage, the imported project is available in the current page session. Keep the JSON file and export any changes before leaving or reloading. Exports over 32 MiB can still be downloaded for reference. The JSON file contains the project data in plain text. Export and import run in the browser.

## Snapshot model
Each entry is a frozen copy: `{ id, calculatorId, calculatorName, title, notes, addedAt, inputs[{label,value,unit}], outputs[{label,value,unit}], equations[], assumptions[], method, warnings[], path }`. Entries may store a validated diagram model, which is rendered into the report.
Design Studies entries (see `docs/design-studies.md`) may also carry `study` metadata, `tables[]` and a line `chart`; the report prints the numeric tables and an SVG chart rendered from stored points.
Entries are never recomputed. Re-adding a calculation creates a new entry (there is no in-place "update" yet).

Print output flows naturally: the project summary and index stay compact, short calculations can share a page, and long entries continue across pages. Use the browser's print preview or Save as PDF to inspect the final page breaks.

## Rules
- Invalid, incomplete, non-finite or stale results (inputs/result text changed since Calculate) are rejected with a message.
- Stored data is versioned (schema 1) and validated on load; invalid entries are dropped individually.
- If `localStorage` is unavailable the store falls back to memory for the session.

## Calculator integration
Structured calculators call `FormulaFoundryReport.declareStructured()` and `FormulaFoundryReport.recordResult(snapshot)` after a successful calculation and `clearResult()` on reset/failure. Other calculators are captured by scraping the visible inputs, result panel and equations. Include `js/report-builder.js` before `</body>`.

## Fluid, thermal and practical snapshots

All eight [expansion calculators](fluid-thermal-practical-calculators.md) capture structured active inputs, numerical outputs with units, equations, methodology and warning text plus a static schematic. Fluid transfers add the source and overrides to the warning text. Design Studies scenario reports include the same schematic. The diagram registry adds identifiers while retaining PR #39’s schema 1 and its existing import and export behavior.

## Electrical snapshots

All ten [electrical calculators](electrical-calculators.md) capture the active circuit configuration, component values and units, calculated results, equations, assumptions, and warnings. For tools with component-level results, a table records values such as resistor drops, currents, and power. The diagram snapshot stores validated values needed to reconstruct the circuit SVG. RC, RL, and series RLC snapshots also capture bounded chart samples and the selected time or frequency.

Electrical snapshots use Project Report schema 1. The report renderer reads the saved diagram values when a report is opened, printed, or imported. A later circuit edit updates the live calculator and leaves the saved entry frozen.

## Fluid System Designer snapshots

Fluid System Designer appends the active calculated configuration with the design conditions, ordered geometry, segment flow and loss tables, head balance, pump duty, equations, limitations and a reconstructible schematic. Include saved alternatives with the comparison checkbox. A current flow sweep adds its sample data and selected plot. The entry survives schema-v1 export, import and printing. [Fluid System Designer](fluid-system-workflow.md)

## Shaft & Bearing System Designer snapshots

Each analysis adds one schema-v1 entry with the shaft geometry, material condition and property basis, signed transverse loads, torque stations, bearing inputs, and calculated results. The report reconstructs the assembly schematic and plots the saved nominal equivalent stress samples. The signed transverse and bending results, configuration comparison, and diameter sweep use the existing report tables. Reports preserve the selected presentation units at the time of capture. [Shaft & Bearing System Designer](shaft-bearing-workflow.md)

## Tests
`tests/core/report-builder.test.js`, `tests/smoke/project-report.test.js`, `tests/smoke/new-calculators-registry.test.js`.
