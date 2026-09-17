# Calculator Development Guide

## Purpose

This guide explains how to build a new calculator in Engineering Calcs Pro using the current repository architecture. The architecture document explains the rules; this guide explains how to apply them.

## Before Coding

Before creating files, define:

1. the engineering problem being solved
2. the governing equations
3. the required inputs and outputs
4. the valid unit sets
5. the assumptions and limitations
6. the expected result format
7. whether material properties are required
8. representative test cases
9. the calculator complexity level

Useful checkpoint questions:

- Is the calculator a single closed-form relation or a multi-mode tool?
- Which values must stay positive?
- Which values may be zero?
- Which values may be negative and still be meaningful?
- Which engineering properties belong in the shared material database rather than the calculator page?
- Which unit conversions already exist in `js/engineering-units.js`?

## Create the Calculator

### Expected files

A new calculator will usually add:

- `calculators/example-calculator.html`
- `js/example-calculator.js`
- `tests/calculators/example-calculator.test.js`

It will usually also require:

- an entry in `js/calculator-data.js`
- possible updates to `docs/testing.md` only if testing workflow changed

### Start from the repository pattern

Follow the existing structure used by the current calculators:

```text
calculators/example-calculator.html
├── shared stylesheet
├── page header
├── calculator layout
│   ├── theory column
│   └── calculator column
├── result panel
├── informational sections
└── shared scripts + calculator script

js/example-calculator.js
├── DOM element references
├── mode/material helper functions if needed
├── calculateExampleCalculator()
├── resetExampleCalculator()
└── DOMContentLoaded setup if needed
```

## Implement the Engineering Calculation

### Keep the math understandable

A calculator JS file should be readable by someone who understands the engineering problem but has never seen the codebase before.

Prefer this flow:

1. read raw input values
2. validate them
3. convert them to internal units
4. calculate the engineering result
5. convert outputs for display
6. render the result panel

### Prefer pure calculation steps where practical

You do not need to build a formal module hierarchy, but calculation steps should still be separable in thought from DOM work.

Good pattern:

- DOM reads happen once
- unit conversions happen explicitly
- equations are obvious in the code
- formatting happens near the result render

### Use centralized units

Before adding a local conversion factor, check `js/engineering-units.js`.

Use shared helpers for reusable categories such as:

- force
- distance
- area
- moment
- stress/modulus
- temperature change
- distributed load
- rotational speed
- area moment of inertia

Avoid copying factors like `0.0254`, `6894.757`, or `4.4482216152605` into calculator files when the engineering core already owns them.

### Use centralized material properties

If the calculator depends on engineering material data:

- read it from `getMaterialProperty(...)`
- keep the calculator-specific assumption outside the material database
- handle missing properties explicitly

Examples of centralized material facts:

- Young's modulus
- shear modulus
- thermal expansion coefficient
- yield strength

Examples of calculator-specific assumptions:

- chosen support condition
- selected factor of safety
- fully restrained vs free expansion case

### Avoid hidden assumptions

If a formula only applies under a specific engineering assumption, document that in the page content and keep the code aligned with that statement.

## Implement Validation

Validation should match the engineering domain.

### Common validation types

#### Required values

Reject values that are missing or non-numeric when the calculation cannot proceed without them.

#### Positive-only values

Use positive-only validation for quantities that must be strictly positive in the model, such as:

- diameter
- area
- modulus
- length when the chosen model requires a physical span or thickness

#### Values that may legitimately be zero

Allow zero only when the engineering meaning supports it. Example cases might include a zero temperature change or zero deformation input in a mode that explicitly evaluates that condition.

#### Physically unusual but valid values

Do not reject a value only because it is uncommon.

Examples:

- a negative temperature change representing cooling
- a factor of safety below 1
- a warning-level load ratio in bearing life

#### Mathematically impossible values

Reject conditions such as:

- division by zero
- non-finite results
- unsupported unit key
- missing required material property
- inner diameter greater than or equal to outer diameter

## Build the Theory Section

The theory column should explain the model, not just restate the form labels.

### Engineering Context

Briefly explain:

- what the calculator measures
- what engineering problem it addresses
- when an engineer would use it

### Governing Equations

Include the core equations in KaTeX display format.

Preferred style:

```text
\[ \sigma = \frac{F}{A} \]
```

### Variables

Define each variable clearly and state whether it is an input, output, or derived term.

### Assumptions & Limitations

Document the model boundary, such as:

- elastic behavior only
- ideal support conditions
- steady-state loading
- small-deflection theory
- classical closed-form equation limits

Do not duplicate every assumption again in lower sections unless a practical engineering note adds new value.

## Build the Informational Sections

### Worked Example

Use a deterministic example that can also support an automated test.

A good worked example:

- states all inputs and units
- shows the equation path
- gives a reproducible final value

### Applications

Explain where the calculator is useful in practice.

### Engineering Considerations

Use this section for judgment and interpretation, not for repeating the theory section.

Good topics include:

- sensitivity to assumptions
- manufacturing tolerance effects
- load uncertainty
- material variability
- code/standard checks outside the simplified model

### Related Calculators

Link only calculators with a real conceptual relationship.

### References

Use credible engineering references and standards where possible.

## KaTeX Guidelines

KaTeX is loaded by `js/katex-loader.js` and currently supports `\( ... \)` and `\[ ... \]` along with dollar delimiters. Prefer the escaped delimiter forms in repository content.

### Inline math

Use:

```text
\( \tau = \frac{T c}{J} \)
```

### Display math

Use:

```text
\[ \delta_{\max} = \frac{P L^3}{48 E I} \]
```

### Fractions

```text
\[ \frac{F}{A} \]
```

### Greek symbols

```text
\( \sigma, \tau, \delta, \varepsilon, \alpha \)
```

### Subscripts and superscripts

```text
\( L_0 \)
\( P_{\text{cr}} \)
\( 10^6 \)
```

### Multiplication

Prefer conventional mathematical notation rather than `*` in explanatory equations.

Examples:

```text
\[ T = K D F \]
\[ \sigma = \frac{M c}{I} \]
```

### Units in equations

Keep engineering units out of the pure symbolic equation when possible. Show units in surrounding prose or the worked example steps.

### Dynamic result content

Current calculators usually do **not** inject new TeX into result panels. They use HTML/Unicode instead. Stay consistent with that pattern unless you intentionally add result re-rendering.

## Add Tests

Follow `docs/testing.md`.

### Current repository style

Tests use Vitest + jsdom and load the real HTML and calculator scripts.

Typical pattern:

```js
const { document, window } = loadCalculatorPage(
    'calculators/example-calculator.html',
    ['js/engineering-units.js', 'js/example-calculator.js']
);

setInputValue(document, 'force', 1000);
setSelectValue(document, 'forceUnit', 'N');

window.calculateExampleCalculator();
```

### Add these test types

#### Known-value tests

Use independently checked engineering examples.

#### Unit-conversion tests

Verify at least one realistic non-default unit path.

#### Invalid-input tests

Verify that invalid conditions show the expected user-facing error state.

#### Regression tests

Add a test whenever a calculator has:

- a bug-prone unit path
- a critical material lookup
- multiple modes or geometry branches

## Final Review Checklist

### Engineering

- [ ] Governing equations verified
- [ ] Units verified
- [ ] Material properties verified
- [ ] Assumptions documented
- [ ] Expected results independently calculated
- [ ] Edge cases considered

### Code

- [ ] Shared Engineering Core used where appropriate
- [ ] No duplicated unit conversion constants
- [ ] No duplicated material data
- [ ] Validation implemented
- [ ] Results formatted consistently
- [ ] No unnecessary global state
- [ ] No unnecessary abstraction

### Content

- [ ] Theory is accurate
- [ ] Variables are defined
- [ ] Assumptions are documented
- [ ] Worked example is reproducible
- [ ] Engineering considerations add practical value
- [ ] References are credible
- [ ] KaTeX renders correctly

### Testing

- [ ] Automated tests added
- [ ] Known engineering values tested
- [ ] Unit conversions tested
- [ ] Invalid inputs tested
- [ ] Full test suite passes

### UI

- [ ] Existing calculator layout preserved
- [ ] Inputs are understandable
- [ ] Results are obvious
- [ ] No unnecessary UI complexity
- [ ] Mobile layout works
- [ ] Browser console is clean
