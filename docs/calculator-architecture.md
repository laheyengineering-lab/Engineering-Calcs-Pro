# Calculator Architecture

## Purpose

This document defines the calculator architecture for **Engineering Calcs Pro** based on the repository as it exists today. It is the reference for future calculator work and for the repository-wide audit/refactor planned for PR #4.

This document intentionally separates:

- **Current architecture** — what the repository actually does now
- **Preferred standard** — the target pattern future calculators should follow
- **Known inconsistencies** — real gaps that should be addressed in PR #4, not in this PR

## 1. Architecture Overview

Engineering Calcs Pro is a static browser application built from plain HTML, CSS, and JavaScript. There is no runtime framework, no bundler, and no production build step.

### Current structure

```text
index.html
├── js/calculator-data.js
└── js/homepage.js

calculators/*.html
├── ../css/style.css
├── ../js/katex-loader.js
├── ../js/engineering-units.js
├── optional shared support file(s)
│   └── ../js/bolt-database.js
└── calculator-specific script
    └── ../js/<calculator>.js
```

### Responsibility flow

```text
Calculator HTML page
  ↓
Calculator-specific JavaScript
  ↓
Shared engineering core
  ↓
Unit conversions / material data / shared support utilities
```

### Layer responsibilities

- **HTML** owns page structure, engineering explanation, form controls, and result placeholders.
- **Calculator JavaScript** owns input retrieval, validation, unit normalization, calculator-specific math, formatting, and DOM updates.
- **Engineering Core (`js/engineering-units.js`)** owns reusable engineering conversions and centralized material properties.
- **Other shared utilities** support specific cross-page concerns, such as homepage metadata (`js/calculator-data.js`), homepage rendering (`js/homepage.js`), KaTeX loading (`js/katex-loader.js`), and bolt size tables (`js/bolt-database.js`).

### Architectural principles

1. Engineering correctness comes first.
2. Shared engineering knowledge belongs in centralized systems.
3. Calculators should stay understandable to a mechanical engineer reading one file.
4. Separate concerns when it improves clarity, not for abstraction alone.
5. Tests should protect engineering behavior.
6. Consistency is the goal, but simple calculators should remain simple.
7. Documentation must describe reality, including technical debt.

## 2. HTML Responsibilities

### Current repository pattern

Each calculator page in `calculators/` is a standalone HTML document with:

- a back link to `index.html`
- a page title and short description in `.calculator-header`
- a two-column `.calculator-layout`
  - `.theory-column` for engineering explanation and diagrams
  - `.calculator-column` for inputs, actions, and the `#result` panel
- follow-on `.content-card` sections such as worked example, applications, references, and related calculators
- shared script tags at the bottom of the page

The visual shell comes from `css/style.css`, especially:

- `.content-card`
- `.formula-box`
- `.calculator-layout`
- `.input-row`
- `.button-row`
- `.result-panel`

### What belongs in calculator HTML

HTML should contain:

- page structure and headings
- calculator title and short description
- theory/background text
- governing equations markup
- variable definitions
- assumptions and limitations when useful
- input controls and labels
- unit selectors
- output-unit selectors
- result container (`id="result"`)
- worked example
- applications
- engineering considerations
- related calculators
- references
- diagrams/SVGs when they improve explanation
- script loading order

### Preferred content structure

For most calculators, the preferred page structure is:

1. **Engineering Context**
2. **Governing Equations**
3. **Variables**
4. **Assumptions & Limitations** when the model needs it
5. **Worked Example**
6. **Applications**
7. **Engineering Considerations**
8. **Related Calculators**
9. **References**

That is a standard, not a rigid template. A simple calculator does not need filler sections.

### What HTML should not contain

HTML should not be the long-term home for:

- unit conversion factors
- duplicated material constants
- calculator-specific engineering logic that belongs in JS
- validation rules that can drift from JS behavior
- reusable engineering data that belongs in the core

Inline event attributes such as `onclick` and `onchange` are part of the current repository pattern, but they are an implementation detail of the current global-script architecture, not engineering content.

### Accessibility considerations

Current pages already benefit from:

- semantic headings
- visible labels for most inputs
- explicit button text
- responsive layout from shared CSS

Current gaps to keep in mind for PR #4 and future work:

- calculators rely heavily on `innerHTML` result replacement rather than dedicated live regions
- inline SVG diagrams generally do not include explicit accessibility metadata
- accessibility behavior should stay aligned with the static-file architecture rather than requiring a UI rewrite

## 3. Calculator JavaScript Responsibilities

### Current repository pattern

Calculator scripts are plain browser scripts loaded with `<script src="...">`, so their top-level functions and constants live in the global scope.

Most calculator scripts follow this pattern:

1. cache DOM elements near the top of the file
2. expose one or more global UI functions
3. read values with `Number(...)`
4. validate required inputs
5. convert inputs to internal SI-like units
6. perform the calculator-specific math
7. format results for display
8. replace `#result` with HTML
9. provide a reset function
10. optionally perform setup on `DOMContentLoaded`

Typical function roles today:

- `calculate...()` — main calculation entry point
- `reset...()` — reset inputs and result panel
- `update...Mode()` — show/hide mode-specific fields
- `updateMaterial...()` — sync material presets into manual fields
- `populate...()` — build dropdowns from shared data

### Preferred conventions

#### Function names

Preferred future naming:

- `calculate<CalculatorName>()`
- `reset<CalculatorName>Calculator()`
- `update<CalculatorName>Mode()`
- `populate<CalculatorName><Thing>()`

Current repository mostly follows this, but not perfectly. `resetToSI()` in `js/moment.js` is the clearest naming outlier.

#### Input retrieval

- Cache frequently used DOM nodes at file scope when it improves readability.
- Read numeric user input with `Number(...)` or an equally explicit numeric conversion.
- Read units and mode selections from the associated `<select>` values.

#### Validation

Current calculators use a mix of `isNaN(...)`, `Number.isFinite(...)`, `=== 0`, and `<= 0` checks.

Preferred future standard:

- validate the mathematical domain first
- validate the physical domain second
- keep validation specific to the engineering meaning of each field
- avoid blanket “positive only” rules when negative values are physically meaningful

#### Error handling

Current calculators usually handle invalid states by writing an error message into `#result`. Some scripts also use `try/catch` around calculation blocks.

Preferred future standard:

- show user-facing errors in the result panel
- keep messages specific to the invalid condition
- handle missing shared data defensively
- avoid throwing raw exceptions into the page

#### Result formatting

Current calculators mostly use `toLocaleString(...)`, sometimes `toFixed(...)`, and sometimes `toExponential(...)` for secondary values.

Preferred future standard:

- use locale-aware formatting for user-facing numbers
- separate computation precision from display precision
- reserve scientific notation for very large/small or secondary engineering values

#### Event handling and globals

Current repository behavior depends on global functions because HTML pages use inline `onclick`/`onchange` handlers.

Preferred future standard for this repository:

- keep the public UI entry points global unless the page event model changes
- keep helper functions local to the file when possible
- avoid unnecessary new global utilities duplicated across calculators

## 4. Engineering Core Responsibilities

## Current engineering core

The central engineering core is `js/engineering-units.js`.

It currently contains:

- reusable unit conversion tables
- input-to-base conversion helpers
- base-to-output conversion helpers
- the centralized `materialDatabase`
- shared material lookup helpers
- small property-group arrays such as `stressProperties`, `elasticProperties`, and `thermalProperties`

It has no imports and is designed to be available globally once loaded.

### Why it exists

The engineering core prevents each calculator from re-implementing:

- unit factors
- unit naming
- engineering material properties
- common material lookups

That keeps formulas consistent and gives tests a single place to verify shared engineering behavior.

### What belongs in the engineering core

Belongs in the core:

- reusable conversion tables
- reusable conversion helpers
- centralized engineering constants and material data
- shared property lookup helpers
- shared engineering data used by more than one calculator

Does not belong in the core:

- calculator-specific formulas
- calculator-specific DOM logic
- page layout behavior
- assumptions unique to one calculator mode
- explanatory HTML content

### Current conversion categories

`js/engineering-units.js` currently defines conversions for:

- force
- distance/length
- moment/torque
- stress/pressure
- modulus (as a stress alias)
- temperature change
- area moment of inertia
- distributed load
- rotational speed

### How calculators interact with it

Current calculators typically:

1. read raw user values
2. call one or more `convert...()` helpers to normalize values
3. calculate in SI-like internal units
4. call `convert...ToUnit()` for user-facing output

### How conversions are represented

Most conversions are stored as plain objects keyed by exact display-unit strings. The values are multiplicative factors to a chosen base unit.

Examples:

- force → Newtons
- distance → meters
- moment → N·m
- stress/modulus → Pascals
- inertia → m⁴
- distributed load → N/m
- rotational speed → rpm

### Temperature conversion

Temperature changes are handled differently from simple scaling:

- `°C` and `K` intervals are treated as equivalent
- `°F` intervals are divided by `1.8`

This is correct for **temperature differences**, not absolute-temperature conversion. Future calculator work should keep that distinction explicit.

### Compound engineering units

The repository does not use a generic dimensional-analysis engine. Instead, compound units are handled as dedicated categories, for example:

- distributed load (`N/m`, `kN/m`, `lbf/ft`)
- area moment of inertia (`mm⁴`, `cm⁴`, `m⁴`, `in⁴`)
- moment (`N·mm`, `N·m`, `kN·m`, `lbf·in`, `lbf·ft`)

That approach fits the current static architecture and keeps the code readable.

### How to add a new unit

When adding a reusable unit to the engineering core:

1. decide the base unit for the category
2. add the unit key and factor to the category table
3. ensure the forward and reverse helpers support it
4. update any affected calculator UI selectors
5. add or update deterministic tests in `tests/core/engineering-units.test.js`
6. update documentation if the category or behavior changed

If a unit is calculator-specific and unlikely to be reused, document the reason before keeping it outside the core.

## 5. Material Database Architecture

### Current location and structure

Material data currently lives inside `js/engineering-units.js` as `materialDatabase`.

Materials are keyed by stable IDs such as:

- `carbon-steel`
- `stainless-steel`
- `aluminum`
- `copper`
- `brass`
- `titanium`
- `mild-steel`
- `high-strength-steel`
- `cast-iron`
- `magnesium`

Each entry includes a `displayName` plus engineering properties stored in SI units.

### Properties currently present

Current properties include:

- `density`
- `youngsModulus`
- `shearModulus`
- `poissonRatio`
- `thermalExpansionCoefficient`
- `tensileStrength`
- `yieldStrength`
- `elongationAtBreak`
- `hardness`
- `thermalConductivity`

### Access patterns

Current shared access helpers are:

- `getMaterial(materialKey)`
- `getMaterialProperty(materialKey, propertyName)`
- `getMaterialList()`
- `getMaterialListFormatted()`

### How calculators currently consume materials

Current usage is mixed:

- `js/column-buckling.js` and `js/factor-of-safety.js` populate material dropdowns from `getMaterialListFormatted()`
- `js/stress-strain.js`, `js/shaft-torsion.js`, and `js/thermal-expansion.js` use centralized property lookup but still hard-code material `<option>` lists in HTML
- calculators without a material dependency do not use the material database

### Standard going forward

Centralized material data should contain **engineering facts**, not calculator assumptions.

Belongs in centralized material data:

- elastic modulus
- shear modulus
- thermal expansion coefficient
- density
- yield strength
- tensile strength

Does not belong in centralized material data:

- chosen factor of safety
- selected load case
- support condition choice
- whether a member is assumed restrained in one specific calculator scenario

### Missing-property behavior

Current core helpers return `null` for missing material keys or properties. Future calculators should treat that as a supported error case and show a clear user-facing message rather than silently proceeding.

### How to add a new material

1. add a new key to `materialDatabase`
2. keep the property names consistent with existing entries
3. store values in SI units
4. update tests in `tests/core/materials.test.js`
5. update any calculators that intentionally expose a limited material subset

## 6. Units Architecture

### Current unit philosophy

The repository already follows a mostly consistent unit architecture:

- user input can be metric or imperial
- calculator scripts convert raw input into internal base units
- engineering calculations usually occur in SI-like units
- outputs are converted back into the user-selected display units

### Internal calculation units

Current internal bases are category-specific:

- N
- m
- N·m
- Pa
- m⁴
- N/m
- rpm
- °C interval

This is already the effective internal unit system for most calculators.

### Current inconsistencies

The overall philosophy is consistent, but implementation details are not fully centralized:

- `js/stress-strain.js` defines a local `convertArea()` helper instead of using a shared area conversion utility
- some secondary displays are hard-coded to a specific unit for readability, such as millimeters for a secondary deformation line
- some material preset UIs expose only a subset of the central material database

### Preferred standard

PR #4 should standardize on:

- convert inputs at the calculator boundary
- perform calculations in one consistent internal unit system
- convert outputs only at the display boundary
- centralize reusable conversion logic once it is used by more than one calculator

### Precision and rounding

Current calculators keep native JavaScript numeric precision internally and apply rounding only when formatting results. That is the right overall approach.

### Unit naming conventions

Unit strings are part of the API between HTML and JS. They should stay exact and consistent with the keys in `js/engineering-units.js`.

Examples:

- `N·m`, not `Nm`
- `lbf·ft`, not `lb-ft`
- `mm⁴`, not `mm^4`
- `1/°C`, not a custom free-form spelling

## 7. Calculator Data / Metadata

### Current state

`js/calculator-data.js` is currently a homepage catalog file, not a full calculator metadata system.

It centralizes:

- calculator name
- category
- short description
- link

It is used by `js/homepage.js` to render and filter homepage cards.

It currently includes both live calculators and “Coming Soon” placeholders.

### What is still embedded directly in pages

Calculator-specific pages still own:

- long descriptions
- theory content
- worked examples
- references
- related-calculator links
- engineering diagrams
- page-specific assumptions
- input/output structure

### Intended role going forward

The current file is the seed of a future metadata layer, but it is intentionally limited today.

A future metadata system could reasonably centralize:

- status
- category
- title
- short summary
- canonical page path
- related-calculator relationships
- complexity classification
- testing status or identifiers

It should not automatically centralize full theory text or all engineering explanations unless there is a clear maintenance benefit.

### Relationship to PR #5

PR #5 can build on this document by expanding metadata deliberately. This PR should only document the current metadata role and the likely future direction.

## 8. Mathematical Rendering / KaTeX

### Current integration

KaTeX is loaded through `js/katex-loader.js`.

That loader:

- loads KaTeX CSS from CDN
- loads KaTeX JS
- loads the auto-render extension
- falls back from jsDelivr to unpkg if needed
- runs `renderMathInElement(document.body, ...)`

### Delimiters currently supported

The loader currently supports all of these:

- `$$ ... $$`
- `$ ... $`
- `\( ... \)`
- `\[ ... \]`

### Repository authoring recommendation

Even though dollar-sign delimiters are enabled, future calculator content should prefer:

- `\( ... \)` for inline math
- `\[ ... \]` for display math

Those delimiters are clearer in mixed prose/HTML and reduce accidental rendering.

### Current usage pattern

Current calculators use KaTeX mainly for static page content:

- governing equations in `.formula-box`
- inline equations inside theory and worked-example text

Result panels generally use HTML entities, subscripts, superscripts, and Unicode symbols rather than inserting new LaTeX after calculation.

### Dynamic content consideration

`katex-loader.js` renders the page body on load. It does not re-render newly inserted result HTML automatically. Future calculators should either:

- keep dynamic result markup in plain HTML/Unicode, as current calculators do, or
- explicitly re-render math after dynamic insertion if live TeX output is introduced

### Notation standard

Preferred notation for future pages:

- fractions with `\frac{...}{...}`
- Greek symbols in LaTeX form
- subscripts with `_`
- superscripts with `^`
- multiplication shown with standard engineering notation, not `*` in explanatory math

Examples:

- inline: `\( \sigma = \frac{F}{A} \)`
- display: `\[ \sigma = \frac{F}{A} \]`
- display: `\[ P_{\text{cr}} = \frac{\pi^2 E I}{(K L)^2} \]`

## 9. Calculator Content Architecture

### Current repository pattern

The calculators already follow a stronger content model than a bare form page. Most pages include:

- theory
- equations
- variables
- diagrams
- worked example
- notes/assumptions
- applications
- references
- related calculators

### Preferred standard

Use this structure where it is useful:

#### Higher-value theory content

1. Engineering Context
2. Governing Equations
3. Variables
4. Assumptions & Limitations

#### Lower-page informational content

1. Worked Example
2. Applications
3. Engineering Considerations
4. Related Calculators
5. References

### Important distinction

**Assumptions & Limitations** describe the model boundary.

Examples:

- small deflection assumption
- Euler buckling applicability
- elastic behavior only
- fully restrained thermal stress assumption

**Engineering Considerations** describe practical interpretation.

Examples:

- manufacturing tolerance sensitivity
- load uncertainty
- buckling imperfection sensitivity
- code/standard requirements outside the ideal equation

The current repository often uses a combined “Engineering Notes/Assumptions” label. PR #4 can improve the separation, but this PR should document the distinction first.

## 10. Calculator Complexity Levels

A lightweight complexity classification is useful for architecture and testing, not for ranking calculators publicly.

### Suggested levels

#### Simple

Characteristics:

- one primary equation
- few inputs
- no material dependency
- limited unit categories
- minimal branching

Repository examples today:

- Moment
- Bolt Torque

#### Intermediate

Characteristics:

- multiple outputs or one mode switch
- geometry branching or secondary interpretation
- some domain-specific validation
- moderate unit handling

Repository examples today:

- Bearing Life
- Beam Bending Stress
- Factor of Safety

#### Advanced

Characteristics:

- multiple calculation modes or load cases
- stronger assumptions that must be documented
- material-property dependency
- more unit categories
- more edge cases and sensitivity to invalid combinations

Repository examples today:

- Stress & Strain
- Shaft Torsion
- Thermal Expansion
- Beam Deflection
- Column Buckling

### How complexity should affect implementation

As complexity increases, increase:

- theory depth
- validation specificity
- test coverage
- worked-example detail
- engineering limitation documentation

Do not increase abstraction automatically. More complex engineering content does not require a framework.

## 11. Error Handling and Validation

### Current state

Validation is calculator-local. There is no shared validation utility yet.

Common current behavior:

- missing or non-numeric values produce an “Invalid Input” message in `#result`
- geometry relationships such as inner diameter vs outer diameter are validated in relevant calculators
- missing shared material data is handled in some data-dependent calculators

### Standard principle

Validation should reflect the physical and mathematical domain of the calculator rather than rejecting values arbitrarily.

### Useful categories

#### Mathematically invalid

Examples:

- zero denominator inputs
- missing required values
- `NaN`
- `Infinity`
- unsupported material/property lookup

#### Physically invalid

Examples:

- negative diameter
- negative area
- inner diameter greater than or equal to outer diameter
- non-positive stiffness or modulus where the model requires a positive property

#### Physically unusual but mathematically valid

Examples:

- negative temperature change for contraction
- factor of safety below 1
- bearing cases where `P ≥ C`
- signed load/stress conventions if the calculator is explicitly designed for them

Future calculators should reject only the first two categories unless the engineering model specifically forbids the third.

## 12. Result Formatting

### Current state

Results are shown in the shared `#result.result-panel` pattern.

Common structure:

- a heading
- a prominent `.result-value`
- secondary details
- a calculation summary

Current formatting methods vary by calculator:

- `toLocaleString(...)` for most primary outputs
- `toFixed(...)` for some helper displays
- `toExponential(...)` for some secondary engineering values such as inertia summaries

### Standard going forward

- keep the primary result visually obvious
- always include units when the result is dimensional
- use dimensionless labeling explicitly when needed
- round for readability, not for false precision
- use scientific notation when it makes the value easier to read
- keep user-facing rounding separate from internal math

There is no single digit count that fits every calculator. The important rule is consistency within each calculator and reasonable consistency across calculators of similar type.

## 13. Naming Conventions

### Current repository pattern

#### Files

Current file naming is already consistent:

- calculator pages: `calculators/<calculator-name>.html`
- calculator scripts: `js/<calculator-name>.js`
- shared scripts: `js/<shared-name>.js`

All use lowercase kebab-case.

#### JavaScript functions

Current function names are descriptive and calculator-specific, but not fully standardized.

Common patterns:

- `calculateMoment()`
- `calculateBeamDeflection()`
- `updateStressStrainMode()`
- `populateFoSMaterials()`

Preferred future standard is to keep calculator name + role explicit.

#### DOM IDs

Current IDs are mostly lower camel case with no separators:

- `originalLength`
- `pointLoad`
- `strengthSource`
- `outputLengthUnit`

Current outlier to standardize later:

- `areamomentinertia`

#### Unit IDs

Current pattern is usually `<quantity>Unit`, for example:

- `forceUnit`
- `lengthUnit`
- `modulusUnit`
- `stressUnit`

This should remain the standard.

#### Material IDs

Material keys use lowercase kebab-case and should remain stable because multiple pages and tests depend on them.

Examples:

- `carbon-steel`
- `high-strength-steel`

## 14. Calculator Module Pattern

The preferred conceptual structure of a calculator is:

```text
Calculator Page
├── Presentation / Theory
├── Inputs
├── Validation
├── Unit Conversion
├── Engineering Calculation
├── Result Formatting
└── Engineering Information
```

In the current repository, these responsibilities usually live in one calculator JS file plus one calculator HTML file.

### Preferred separation

When it improves clarity, keep these concerns logically separate inside the calculator file:

1. DOM element references
2. UI mode/material sync helpers
3. validation
4. unit normalization
5. pure engineering calculation steps
6. result formatting
7. reset/setup

If a pure calculation function can be separated cleanly without obscuring the file, that is a good future direction. It is a preference, not a requirement for every simple calculator.

## 15. Testing Architecture

The calculator architecture is backed by the Vitest + jsdom test setup documented in `docs/testing.md`.

### Current testing structure

- `tests/core/` — shared unit conversions and material data
- `tests/calculators/` — calculator-specific known-value tests
- `tests/smoke/` — page-load and initialization checks
- `tests/helpers/browser-test-utils.js` — page-loading and DOM helper utilities

### Architectural testing relationship

```text
Engineering calculation
  ↓
Deterministic test case
  ↓
Calculator/UI behavior
```

### What calculators should test

Calculators should have tests for:

- known engineering calculations
- unit conversions in realistic scenarios
- material-data consumption where applicable
- invalid inputs
- edge cases
- regression-sensitive examples

### Testing guidance

Tests should protect behavior, not file-internal implementation details. The current test harness loads the real calculator HTML and scripts, which is well suited to future refactoring as long as externally observable engineering behavior stays stable.

## 16. Development Workflow for New Calculators

Recommended workflow:

1. define the engineering problem
2. verify the governing equations
3. define variables and valid unit sets
4. identify assumptions and limitations
5. determine complexity level
6. identify required material properties
7. identify reusable conversions needed from the engineering core
8. design inputs and outputs
9. implement calculator logic
10. implement validation
11. implement result formatting
12. add theory content
13. add a worked example
14. add engineering considerations where needed
15. add applications
16. add references
17. add related calculators when appropriate
18. add automated tests
19. verify browser behavior
20. review engineering correctness
21. review accessibility/usability
22. add metadata in `js/calculator-data.js` according to repository standards

Skip irrelevant steps for simple calculators. The workflow is intended to keep the repository consistent without forcing unnecessary complexity.

## Known Architectural Inconsistencies

These are concrete current inconsistencies that PR #4 should audit and refactor.

1. **Material selector implementation is inconsistent.**
   - `js/column-buckling.js` and `js/factor-of-safety.js` build dropdowns from `getMaterialListFormatted()`.
   - `stress-strain.html`, `shaft-torsion.html`, and `thermal-expansion.html` hard-code material options directly in HTML, and some expose only a subset of the centralized database.

2. **Validation style is inconsistent.**
   - Some calculators use `isNaN(...)` with `=== 0` checks.
   - Others use `Number.isFinite(...)` with `<= 0` checks.
   - Negative-value handling is therefore not standardized across the repository.

3. **Some conversion logic is still duplicated outside the core.**
   - `js/stress-strain.js` defines its own `convertArea()` helper.
   - The engineering core does not yet provide a shared area conversion utility.

4. **Result formatting precision is inconsistent.**
   - Primary and secondary outputs use different decimal conventions across calculators.
   - Some pages mix fixed decimals, locale formatting, and exponential notation without a repository-wide rule.

5. **Naming conventions are mostly good but not fully standardized.**
   - `areamomentinertia` is a clear DOM ID outlier.
   - `resetToSI()` in `js/moment.js` does not follow the broader reset naming pattern.
   - DOM cache variable prefixes are used consistently in some calculators and loosely in others.

6. **Common small helpers are duplicated.**
   - HTML-escaping helpers are redefined in multiple calculator scripts instead of being centralized.

7. **Content sections are not yet cleanly separated by purpose.**
   - Many calculators use a combined “Engineering Notes/Assumptions” label.
   - PR #4 should distinguish model assumptions from practical engineering considerations where that improves clarity.

8. **Dynamic math handling is not standardized.**
   - Static theory content uses KaTeX.
   - Dynamic result content generally uses HTML/Unicode instead of re-rendered TeX.
   - That is workable today, but it should be treated as an explicit pattern rather than an accidental one.

9. **Metadata remains split between homepage data and page-local content.**
   - `js/calculator-data.js` only centralizes homepage catalog data today.
   - Related-calculator relationships, complexity, and richer metadata are still page-local.

10. **Calculator-specific engineering patterns are not yet normalized across similar calculators.**
    - Mode-based calculators use different naming, initialization, and field-toggle patterns.
    - Material-assisted calculators use different approaches to preset values and manual overrides.

This PR documents those differences so PR #4 can apply a consistent standard without guessing.
