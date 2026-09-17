# Automated Testing in Engineering Calcs Pro

## Purpose

Automated tests provide a safety net for the existing calculator mathematics and shared engineering core so formula mistakes, unit-conversion regressions, and broken material data are caught early.

## Testing framework

The test suite uses **Vitest** with **jsdom**.

Why this setup:
- minimal Node-based tooling for a static HTML/CSS/JavaScript project
- fast test runs and built-in watch mode
- enough browser-like DOM support to execute the existing calculator scripts without a broad refactor

## Install dependencies

From the repository root:

```bash
npm install
```

## Test structure

Tests live under `tests/`.

- `tests/core/` — shared engineering core conversions and material database tests
- `tests/calculators/` — calculator-specific engineering calculation tests
- `tests/smoke/` — lightweight page-load smoke checks
- `tests/helpers/` — shared helpers for loading calculator pages and reading results

## What is tested

The suite currently covers:
- calculator mathematics for all 10 live calculators
- shared unit conversions in `js/engineering-units.js`
- centralized material data lookups and representative engineering constants
- important invalid-input and divide-by-zero paths
- regression-sensitive conversion behavior, including GPa/MPa scaling

## Run all tests

```bash
npm test
```

## Run one test file

```bash
npx vitest run tests/calculators/shaft-torsion.test.js
```

Replace the path with any other test file you want to run.

## Watch mode

```bash
npm run test:watch
```

Vitest will re-run affected tests when files change.

## How to interpret failures

A failing test usually means one of these happened:
- a calculator returned the wrong engineering result
- a unit conversion changed magnitude or units incorrectly
- a material property became missing, zero, or incorrect
- an invalid-input path started returning an unexpected result

Read the failing test name first, then compare the expected engineering example with the current calculator output shown in the assertion.

## How to add a test

1. Put the new test in the matching file under `tests/core/`, `tests/calculators/`, or `tests/smoke/`.
2. Reuse `tests/helpers/browser-test-utils.js` to load the real calculator HTML and scripts.
3. Prefer deterministic engineering examples with explicit expected values.
4. Use tolerances for floating-point results when exact equality is not appropriate.

Example pattern:

```js
const { document, window } = loadCalculatorPage(
    'calculators/moment.html',
    ['js/engineering-units.js', 'js/moment.js']
);

setInputValue(document, 'force', 100);
setInputValue(document, 'distance', 25);
setSelectValue(document, 'forceUnit', 'N');
setSelectValue(document, 'distanceUnit', 'mm');
setSelectValue(document, 'momentUnit', 'N·mm');

window.calculateMoment();
```

## Engineering test philosophy

Prefer known analytical solutions and deterministic examples over UI-only checks. The goal is to verify engineering behavior: given specific inputs, the calculator should produce the expected result in the selected units.
