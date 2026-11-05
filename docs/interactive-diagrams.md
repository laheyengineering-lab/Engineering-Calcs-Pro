# Engineering graphics

Every calculator page carries an engineering graphic. Graphics are native SVG, built on the shared helpers in `js/engineering-diagram.js` and registered in `js/calculator-diagrams.js`. A graphic is a **view of calculator state**: it reads the existing input fields, never solves anything, and never stores a parallel state model. No rendering dependency and no build step are used.

## Architecture

| File | Role |
| --- | --- |
| `js/engineering-diagram.js` | Shared scene and primitives (`FormulaFoundryDiagram`), plus the older `createSvg`, `add`, `bindSliderControl`. New: `scene()`, `bindFieldRanges()`, `rangeAround()`, `formatNumber()`. |
| `js/calculator-diagrams.js` | Registry (`FormulaFoundryCalculatorDiagrams`): `register`, `render`, `mount`, `attach`, `normalize`, `snapshot`, `caption`, `has`. |
| `js/diagram-renderers-loads.js` | Moment, bearing life, cylinder force, helical spring, shaft torsion. |
| `js/diagram-renderers-fasteners.js` | Bolt torque, thread strength, fillet weld, press fit. |
| `js/diagram-renderers-structural.js` | Column buckling, beam bending stress, stress-strain, thermal expansion, differential thermal expansion, factor of safety, Hertzian contact, thick-walled cylinder and its stress-vs-radius plot. |
| `js/calculator-diagram-pages.js` | One data-driven wiring script: per page, maps existing input fields to a model and declares optional range controls. |
| `js/beam-deflection-diagram.js`, `js/beam-section-properties.js` | Original beam diagram and section drawings (kept; restyled in CSS to the shared language). |
| `css/style.css` (`.ff-*` block) | Semantic tokens and classes for all graphics. |

### Visual language

Graphite outlines (`--ff-ink`), warm paper background (`--ff-paper`), copper accent (`--ff-accent`) for loads and selected features. Colour is never the only cue: forces are solid copper arrows, reactions are graphite arrows with open heads, pressure is a row of thin copper arrows, moments are curved arrows with a label, construction and ghost geometry are dashed or dash-dot, and every quantity is labelled. Text is 13–16 px in viewBox units; on screens under 560 px the SVG keeps a 430 px minimum width and its host scrolls horizontally rather than shrinking text below a legible size.

### Reusable primitives

`FormulaFoundryDiagram.scene(document, { size: [w, h], label, title, description })` returns a context with a responsive `viewBox`, `<title>`/`<desc>`, `role="img"`, and these helpers:

- Geometry: `line`, `rect`, `circle`, `path`, `polygon`, `polyline`, `group`, `text` (rich text: `A_p`, `σ_{max}`, `x^2`).
- Force-like arrows: `arrow(x1, y1, x2, y2, { kind: "force" | "reaction" | "pressure" | "stress", label })`.
- Moments: `momentArrow(cx, cy, r, fromDeg, toDeg, { ry, label })` for torque and bending moments (always curved, never axial).
- Annotation: `dimension` (extension lines, arrowheads, text), `leader`, `centerline`, `construction`.
- Sections: `hatchRect`, `hatchPath`, `groundHatch`.
- Supports and axes: `pinSupport`, `rollerSupport`, `fixedSupport`, `pivot`, `axes`.
- Text blocks: `lines(x, y, rows)` and `note(x, y, text, anchor)`. `note` word-wraps to the available width, stacks below earlier text, and `lines`/`note` grow the `viewBox` height instead of clipping.

Keep calculator-specific geometry in the renderers. Do not add shared primitives for one calculator.

## Calculator-specific renderers

Each renderer is registered once:

```js
registry.register("moment", {
    title: "…", caption: "…",            // caption states simplifications and exaggeration
    schema: { force: T.num(), distance: T.pos(), forceUnit: T.unit() },
    build(document, model, helpers) { /* returns an SVG built with scene() */ }
});
```

Conventions:

- `model` is small, serialisable data (finite numbers, short strings, short numeric arrays). `normalize(id, raw, strict)` enforces the schema: lenient on live pages (invalid fields are dropped and the renderer draws a generic state), strict for report snapshots (invalid models are rejected).
- Missing or invalid values fall back to a neutral drawing and the label shows `—`; the renderer must never emit `NaN` or `Infinity`.
- Proportions come from `helpers.ratio(value, reference, low, high, fallback)`, which clamps geometry to a drawable range and flags exaggeration. Exaggerated or schematic geometry is labelled in the drawing and the caption.
- No engineering equations. Values such as `deflection`, `tauMax` or `stress` are read from the calculator's results, not recomputed. The only arithmetic is for drawing proportions.

## Page wiring and input mapping

Calculator pages have a figure at the top of `.calculator-column`:

```html
<figure class="ff-figure"><div id="calcDiagram" class="ff-diagram-host" data-diagram="moment"></div></figure>
```

`calculator-diagram-pages.js` looks up `PAGES[id] = { watch, model(), commit?, ranges?, delegate? }`. `watch` lists the existing input ids, `model()` reads them into the registry model, and the figure refreshes on `input`/`change` and when `#result` changes. Hertzian contact has two hosts (line and point contact) and renders whichever is visible. If the diagram scripts are not loaded, the calculators work unchanged and the host stays empty.

## Static and interactive graphics

Interactivity is limited to cases where it maps directly to an existing input field.

| Calculator | Graphic | Controls (mapped input) | Why |
| --- | --- | --- | --- |
| Beam deflection | Interactive (pre-existing) | Span; load magnitude for point-load cases | Visual feel for span/load. Only the four closed-form cases; no movable load position. |
| Cylinder force | Interactive | Bore, rod, pressure | Shows how area ratio changes full-bore vs annular area. |
| Helical spring | Interactive | Wire d, mean coil D, active coils, axial force | Spring index, coil count and compression are geometry-driven; compression is exaggerated and labelled. |
| Shaft torsion | Interactive | Torque (sign sets twist direction) | Direction of twist and surface shear are intuitive. |
| Press fit | Interactive | Diametral interference | Interference is exaggerated (labelled) but its relation to contact pressure is direct. |
| Thermal expansion | Interactive | Temperature change | Free expansion versus restrained force. |
| Moment, bearing life, bolt torque, thread strength, fillet weld, column buckling, beam bending stress, stress-strain, differential thermal expansion, factor of safety, Hertzian contact, thick-walled cylinder | Static | none | The system is fixed by the selected option; a slider would imply unmodelled degrees of freedom (e.g. moment has no angle input). |

Range controls come from `bindFieldRanges()`: a labelled native `<input type="range">` (keyboard-operable with arrow/Home/End, visible focus, 44 px touch height, `aria-valuetext` with units). Moving a control writes the real input field, dispatches `input`, and calls the page's existing calculate function, but only if the user has already calculated. The slider range is an exploration aid; the numeric field remains unrestricted, and the slider is disabled while the field is empty or invalid.

## Numerical plot: thick-walled cylinder

The stress-versus-radius plot is calculated data. `thickCylinderRenderPlot()` samples `r.stressAt(r)` (the Lamé solution) at 41 points and mounts `thick-walled-cylinder-plot`. Axes are labelled with units, tension is positive, the zero line is drawn, radial, hoop and axial curves differ by line style and direct labels, and the y-range always includes zero. `tests/smoke/calculator-diagram-pages.test.js` checks the first and last samples against the closed-form values.

## Accessibility

- Every SVG has `role="img"`, `<title>`, `<desc>`, and a `viewBox` with `preserveAspectRatio="xMidYMid meet"`.
- Controls are native range inputs with associated labels and `aria-valuetext`; there are no pointer-only interactions.
- Colour is redundant with labels, line style and arrow shape.
- The caption below each figure states what is schematic or exaggerated.

## Report integration

Report snapshots store `diagram: { type: "calc-diagram", id, model[, companion] }` (`companion` is used for the thick-cylinder plot). Pages that record results explicitly (cylinder force, differential thermal expansion, Hertzian contact, thick-walled cylinder) pass `diagram`; scraped pages pick it up through the shared snapshot call. `report-builder.js` validates id and model (finite values only, bounded sizes, no markup, no nested objects), and `report-page.js` re-renders a fresh static SVG with strict `normalize()`. Entries saved before this change, and entries whose stored diagram no longer validates, render without a diagram and are otherwise unchanged. Report figures have no controls, avoid page breaks inside the figure, and force print colours.

Beam Deflection reports keep their existing `beam-deflection` snapshot.

## Adding a graphic

1. Add a renderer in the closest `diagram-renderers-*.js` with `registry.register(id, { title, caption, schema, build })`, built from `scene()` primitives.
2. Add the id to `CALC_DIAGRAM_IDS` in `js/report-builder.js`.
3. Add a `PAGES[id]` entry (`watch`, `model`, optional `commit`/`ranges`) in `calculator-diagram-pages.js`.
4. Add the `<figure class="ff-figure">` host and the diagram scripts to the calculator page (they load before `report-builder.js`).
5. Add cases to `tests/core/calculator-diagrams.test.js` (minimum, typical, maximum, zero, negative, missing) and, when the page has controls, to `tests/smoke/calculator-diagram-pages.test.js`.
6. Write the caption as a statement of simplifications, never beyond the calculator's equations.

## Audit inventory

| Calculator | Physical system and model | Prior state | Graphic |
| --- | --- | --- | --- |
| Bolt torque | `T = K·D·F` nut-factor model | Early SVG | Joint section: head, shank, thread, clamped members, torque arc, tension F vs clamp force, friction interfaces. Marked conceptual; K lumps friction; grip length is not an input. |
| Moment | `M = F·d` | Static SVG | Pivot, force, position vector, perpendicular arm, sign convention. The calculator has no angle input, so the oblique force is schematic. |
| Bearing life | `L10` from rating C, equivalent load P | Static SVG | Race/rolling-element section, radial load, rating vs equivalent load. No contact analysis implied. |
| Column buckling | Euler `Pcr = π²EI/(KL)²`, four ends | Missing | Four end conditions, centerline, illustrative mode shape, K, KL. |
| Beam bending stress | `σ = M·c/I` | Section drawing | Selected section/axis, neutral axis, c, tension/compression regions, σmax location. |
| Beam deflection | Four closed-form cases | Interactive SVG | Kept; restyled. |
| Cylinder force | `F = p·A` | Missing | Bore, piston, rod, full-bore vs annular area, extend/retract. Efficiency does not change geometry. |
| Differential thermal expansion | Free expansion of series sections | Missing | Two members, series sections, free expansion, differential. No restraint. |
| Factor of safety | Capacity ÷ demand | Static SVG | Demand vs capacity bars, stress/load definitions; "ratio, not a verdict". |
| Fillet weld | Throat-area shear | Missing | Section (leg w vs throat), plan view, length, load angle θ. |
| Hertzian contact | Line and point contact | Static SVG | Both configurations, radii, force, contact width/radius, qualitative pressure inset. Elastic only. |
| Press fit | Lamé thick-cylinder interface pressure | Missing | Shaft/hub section, interference, interface, press-in, retention. |
| Shaft torsion | `τ = T·r/J` | Static SVG | Solid/hollow, torque and reaction, twist, surface τmax. |
| Helical spring | `k = G d⁴ / 8 D³ N` | Missing | Coil geometry, d, D, outside diameter, load, deflection. |
| Stress & strain | `σ = F/A`, `ε = ΔL/L` | Static SVG | Original vs deformed (exaggerated, stated), area, gauge length, ΔL vs ε. No material curve. |
| Thermal expansion | `ΔL = α L ΔT` | Static SVG | Free vs fully restrained; thermal stress only in the restrained case. |
| Thick-walled cylinder | Lamé stresses | Plot only | Section with radii, pressures, σr/σθ and the axial condition; stress-vs-radius plot is calculated data. |
| Thread strength | Tensile and stripping areas | Missing | Engagement section, tensile vs stripping failure region. Approximate area model; no thread-by-thread load. |

## Flagged model ambiguities

- Moment has no force-angle or sign input; the angled force and counter-clockwise positive sign are conventions, labelled as schematic.
- Helical spring has no free-length input; free length is not drawn as a value.
- Bolt torque has no grip length input; the drawing is conceptual.
- Thermal expansion uses a single temperature change (not initial and final temperatures).
- Where a model is a simplification, the caption says so rather than depicting more detailed physics.
