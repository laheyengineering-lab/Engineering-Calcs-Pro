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

### Register calculator metadata

Add every calculator, including planned calculators, to the `calculators` array in `js/calculator-data.js`. The registry is the canonical source for homepage metadata and calculator discovery; do not duplicate homepage descriptions or search terms in other shared files.

Each entry must include:

| Field | Requirement |
| --- | --- |
| `id` | Required, unique, stable lowercase kebab-case identifier, such as `stress-strain`. Base it on the calculator concept, not its display title. |
| `name` | Required display name, such as `Stress & Strain Calculator`. |
| `shortDescription` | Required concise, one-line summary used on the homepage card. |
| `description` | Required fuller calculator description, suitable for a calculator page header. |
| `category` | Required homepage category. Use an existing category where appropriate. |
| `path` | Required relative path to the calculator HTML page. |
| `related` | Required array of IDs for meaningful related calculators; an empty array is valid. |
| `keywords` | Required, manually curated array of concise engineer-facing search terms; an empty array is valid. |
| `status` | Optional. Set to `"coming-soon"` when the planned page does not exist yet; use its intended path. |

Keep IDs unique and stable after publishing; changing a display name does not require changing its ID. Related links are one-way references: include only useful conceptual relationships and ensure each referenced ID exists. Do not force reciprocal relationships. Choose keywords based on terms engineers may search for, including useful synonyms and common terminology; do not generate them automatically from descriptions.

Keep `shortDescription` brief for the homepage card and use `description` for the more complete page-header explanation. For a Coming Soon entry, retain all required metadata, set `status` to `"coming-soon"`, use the intended future `path`, and leave `related` empty until meaningful links exist. The homepage keeps these entries visible without linking to a nonexistent page.

When creating a calculator, add its metadata entry and verify the ID, category, existing page path (unless Coming Soon), related IDs, and curated keywords. The lightweight `validateCalculatorData(calculators)` check runs on homepage initialization and reports registry issues in the browser console without preventing rendering.

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

## Mobile Information Hierarchy

At widths of 900px and below, calculator pages read in this order:

1. Title and concise description (`.calculator-header`)
2. Compact calculation context (`.calculator-context`)
3. Inputs and Calculate action (`.calculator-column`)
4. Results and status indicators (`#result`)
5. Detailed theory, equations, variables, assumptions, limitations (`.theory-column`)
6. Worked example, applications, considerations, related calculators, references

Implementation notes:

- The context block is generated by `js/calculator-context.js` from existing page content. Do not hard-code a separate description. It shows the governing equation (cloned from the theory column, only when the page has exactly one `.formula-box`), the primary inputs (from form labels), and a link to `#theory`.
- Include `<script src="../js/calculator-context.js"></script>` before `katex-loader.js` so the cloned equation is rendered by KaTeX.
- The theory column keeps its DOM order; on mobile `.calculator-column` is moved first with CSS `order`. Desktop keeps the two-column Theory/Calculation layout and hides the context block.
- Keep the first sentence of the header description meaningful, put the main equation in the first `.formula-box`, and use clear `<label>` text; the context is derived from them.

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

## Visual Standards and Shared CSS

All styling lives in `css/style.css`. Do not add a CSS framework, and do not hard-code colors, spacing, or radii in calculator pages; use the design tokens (CSS custom properties defined in `:root`).

### Design tokens

- **Brand/accent:** `--color-navy-800` (headings, primary brand), `--color-accent` (actions, links, active states)
- **Surfaces:** `--color-bg`, `--color-surface`, `--color-surface-muted`, `--color-surface-accent`
- **Text:** `--color-text`, `--color-text-muted`
- **Borders:** `--color-border`, `--color-border-strong`
- **Status:** `--color-success`, `--color-warning`, `--color-error` (each with a `-bg` variant)
- **Typography:** `--font-sans`, `--font-mono`, `--text-xs` … `--text-result`, `--leading-tight`, `--leading-base`
- **Spacing:** `--space-1` … `--space-7`
- **Radii:** `--radius-sm` (controls), `--radius-md` (buttons, panels), `--radius-lg` (cards)
- **Shadows:** `--shadow-sm` (cards), `--shadow-md` (hover)
- **Layout/motion:** `--content-width`, `--control-height`, `--transition`, `--focus-ring`

### Components

- **Cards:** `.content-card` for every theory/info/calculator section. Nested cards inside `.calculator-box` render flat. Use `.category-card` / `.calculator-card` only on the homepage.
- **Inputs:** use `.input-label` followed by `.input-row` (input + unit `<select>`). Standalone selects use `.output-select`. Native `input`, `select`, and `textarea` elements are styled globally; keep `<label>`/`id` associations. Mark invalid fields with `aria-invalid="true"` or `.input-error`.
- **Buttons:** `<button>` is the primary action; add `.secondary-button` for Reset/secondary actions. Group in `.button-row`. Disabled buttons are styled automatically.
- **Results:** wrap output in `.result-panel`; show the headline number in `.result-value`.
- **Notices:** `.notice`, `.warning`, `.error`, `.success`. Always include a text label (for example "Warning:") — never rely on color alone.
- **Equations:** `.formula-box` for display math; KaTeX is loaded via `js/katex-loader.js`.
- **Layout:** `.calculator-layout` with `.theory-column` and `.calculator-column`.

### Spacing and responsive rules

- Use `--space-*` tokens (4 px scale: 0.25 rem to 3 rem); avoid arbitrary pixel values.
- Breakpoints: `900px` collapses the two-column calculator layout; `700px` stacks input rows and buttons, and tightens padding.
- Controls must remain at least `--control-height` (46 px) tall and pages must not scroll horizontally at 375 px. Wide tables/equations scroll inside their container.
- Keep keyboard focus visible and respect `prefers-reduced-motion` (handled globally).
- Avoid inline `style=` attributes for color or spacing in new work.

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
- [ ] Only shared CSS tokens/components used; no new hard-coded colors
- [ ] Browser console is clean
