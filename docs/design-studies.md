# Design Studies

`design-studies.html` turns individual calculators into a design-iteration workspace: save several scenarios for one calculator, compare them against a baseline, run a parametric sweep of one input and add the results to the project report. Everything is browser-local (`localStorage`, key `formulaFoundry.designStudies`); there is no backend.

## Supported calculators
| Calculator | Why it was chosen |
| --- | --- |
| Hydraulic/Pneumatic Cylinder Force (`cylinder-force`) | Pure SI function `computeCylinderForce()`, a small set of numeric inputs, clear outputs with units, easily hand-checked. |
| Differential Thermal Expansion (`differential-thermal-expansion`) | Pure SI functions `computeDifferentialExpansion()`; temperature, length and coefficient units; meaningful design-iteration sweeps (e.g. temperature vs movement). |

### Not yet supported
Beam Bending Stress and Beam Deflection are **not** integrated: their calculation is embedded in DOM-reading `calculate…()` functions and their scripts bind page elements at load time, so no structured, DOM-independent calculation entry point exists yet. Every other calculator likewise lacks one. Extracting such a function (without changing the equations) is the prerequisite for adding an adapter. Cross-calculator comparison is intentionally not offered: different calculators' inputs, outputs and assumptions do not share a physical meaning.

## Architecture
- `js/design-study-core.js` - DOM-free data model, adapter registry, comparison, sweep, persistence/validation and report-snapshot builders (`window.FormulaFoundryStudies`).
- `js/design-study-adapters.js` - one adapter per supported calculator. An adapter declares id/name/revision, unit groups (with conversions delegated to `engineering-units.js`), input definitions (units, `min`/`max`, `sweepable`, `optional`), output definitions (quantity, `plottable`, `comparable`), equations, assumptions, and a `calculate(values, units)` method that **calls the calculator's own function**. No formulas are duplicated in the Design Studies code.
- `js/design-studies.js` + `design-studies.html` + `css/studies.css` - the workspace UI (text is always set via `textContent`).
- `js/study-chart.js` + `css/study-chart.css` - dependency-free SVG line chart shared with the report.

To add a calculator: make sure its script exposes a pure calculation function, add an adapter, register it, and add tests that check the sweep against an independent hand calculation. Bump the adapter `version` whenever the calculator's results or outputs change; scenarios saved with an older revision are marked stale and cannot be compared until recalculated.

## Data model (schema 1)
`{ schemaVersion: 1, studies: [study] }`, study = `{ id, name, calculatorId, createdAt, updatedAt, baselineId, scenarios[], sweeps[] }`.
Scenario = `{ id, name, calculatorId, calculatorVersion, inputs{id: number|null}, units{group: unit}, status: new|calculated|stale|error, error, result, updatedAt }` where `result` is the saved snapshot `{ calculatedAt, calculatorVersion, inputs[{id,label,value,unit}], outputs[{id,label,value,unit,quantity}], equations[], assumptions[], method, warnings[] }`.
Editing an input or unit never changes `result`; it marks the scenario `stale` until the user presses **Recalculate**. Scenarios are never modified by edits to other scenarios (all operations return copies).
Loading validates every study, scenario and sweep; invalid items are dropped individually and reported. Unreadable or other-schema data is not loaded, is never silently overwritten and is copied to `formulaFoundry.designStudies.backup`.

## Comparison
Uses saved snapshots only. Scenarios must be of the same calculator, calculator revision and calculated (not stale/error). Differences are computed against the selected baseline after unit conversion; percentage differences are omitted with an explanation when the baseline is zero or missing, or when the quantity is on an offset scale (temperatures). Differences in optional outputs, units and assumptions are listed. The UI marks changed values but never labels them better or worse.

## Parametric sweeps
One input of a calculated baseline scenario is varied between a start and end value using either a step size or a sample count (2 to **200** samples). Every sample calls the adapter's `calculate()` with all other baseline inputs unchanged. Static input limits (e.g. `> 0`, `<= 100 %`) are checked before the run; sample-dependent failures (e.g. rod diameter ≥ bore) appear as failed rows, as gaps in the chart (marked ×), and are never interpolated. A sweep is a model-based exploration, not a physical test, and values between samples are not calculated.

## Report integration
Scenarios, comparisons and sweeps are added with `FormulaFoundryReport.addSnapshot()`. Entries are frozen copies and may carry optional `study` metadata, `tables[]` (`{caption, columns[], rows[][]}`) and a `chart` (`{type:"line", title, xLabel, yLabel, points[{x, y|null}]}`). The report always prints the numeric tables; the chart is an SVG rendered from the stored points. These are optional extensions to the existing snapshot format; existing entries are unaffected.

## Tests
`tests/core/design-studies.test.js` (model, units, comparison, sweeps, persistence, report snapshots), `tests/smoke/design-studies-page.test.js` (UI workflow), `tests/smoke/design-studies-report.test.js` (report rendering).
