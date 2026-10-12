# Engineering Calculation Reports

## User workflow

Every active calculator page provides **Generate Report** below its result. The action is available only after a successful calculation. Add optional project identification, purpose, and notes, preview the branded report, then use **Print / Save as PDF** to print it or save it through the browser. The report is generated locally; project details are not uploaded or persisted by Formula Foundry.

If any calculator input or result changes after preparation, the preview and print actions are blocked until the calculation is run again. Invalid and incomplete calculation states cannot produce reports.

## Shared report contract

`js/report-builder.js` defines `window.FormulaFoundryReport.getCurrentState()` and supports calculator-specific providers through:

```js
FormulaFoundryReport.registerAdapter("calculator-id", (currentState) => ({
    equations: currentState.equations,
    inputs: currentState.inputs,
    results: currentState.results,
    methodology: currentState.methodology,
    assumptions: currentState.assumptions
}));
```

The shared adapter obtains the calculator identity from `js/calculator-data.js`, equations and theory from the page's existing content, current inputs and displayed units from visible calculator controls, and outputs/intermediate details from the existing result panel. It does not perform engineering calculations. For mode-specific equations, tag the existing equation element with `data-report-mode` matching the mode control value; the shared adapter then includes only the selected mode's equation. Calculator-specific providers may refine structured fields without replacing the shared report template.

The preview inserts user-supplied project text using text nodes, not HTML. Report metadata remains in the active page session only. Print layout rules live in `css/style.css`; browser print-to-PDF is used instead of a PDF service or library.

The generic DOM adapter preserves exact displayed values and units but cannot infer a result's numeric data model independently of the calculator UI. Keep result labels and unit text explicit in calculator output, and add a tested adapter when a calculator's DOM does not identify its report inputs or results accurately.
