# Engineering graphics

Every calculator page carries an engineering graphic. Graphics are native SVG, built on the shared helpers in `js/engineering-diagram.js` and registered in `js/calculator-diagrams.js`. A graphic is a **view of calculator state**. It reads the existing input fields and receives available results from the calculator. Rendering needs no dependency or build step.

## Architecture

| File | Role |
| --- | --- |
| `js/engineering-diagram.js` | Shared scene and primitives (`FormulaFoundryDiagram`), including `scene()`, `bindFieldRanges()`, `rangeAround()` and `formatNumber()`. Also exports `createSvg`, `add` and `bindSliderControl`. |
| `js/calculator-diagrams.js` | Registry (`FormulaFoundryCalculatorDiagrams`): `register`, `render`, `mount`, `attach`, `normalize`, `snapshot`, `caption`, `has`. |
| `js/diagram-renderers-loads.js` | Moment, bearing life, cylinder force, helical spring, shaft torsion. |
| `js/diagram-renderers-fasteners.js` | Bolt torque, thread strength, fillet weld, press fit. |
| `js/diagram-renderers-structural.js` | Column buckling, beam bending stress, stress-strain, thermal expansion, differential thermal expansion, factor of safety, Hertzian contact, thick-walled cylinder and its stress-vs-radius plot. |
| `js/expansion-diagrams.js` | Fluid, hydraulic, pneumatic, thermal and mounting schematics. |
| `js/electrical-diagrams.js` | Electrical circuits and wiring, power triangle, RC and RL time plots, and series RLC frequency response. |
| `js/calculator-diagram-pages.js` | Maps existing inputs and published results to a model and declares optional range controls. |
| `js/beam-deflection-diagram.js`, `js/beam-section-properties.js` | Four-case Beam Deflection graphic and shared beam section drawings. |
| `js/design-study-graphics.js` | Maps original Design Study scenarios and saved result rows to the same graphics models. |
| `css/style.css` (`.ff-*` block) | Semantic tokens and classes for all graphics. |

### Visual language

Structural outlines use graphite on a warm drawing surface. Applied force and torque use copper, and reactions use graphite with open heads. Thin arrows mark pressure, dashed arrows indicate motion or flow, and dash-dot centerlines locate axes. Use neighboring views or reserved rows when numeric labels would crowd a section. Keep captions in normal text flow and describe any exaggerated geometry. Phone-width legacy and expansion figures preserve drawing scale and scroll within the figure. Printed figures fit the available width.

### Reusable primitives

`FormulaFoundryDiagram.scene(document, { size: [w, h], label, title, description })` returns a context with a responsive `viewBox`, `<title>`/`<desc>`, `role="img"`, and these helpers:

- Geometry: `line`, `rect`, `circle`, `path`, `polygon`, `polyline`, `group`, `text` (rich text: `A_p`, `σ_{max}`, `x^2`).
- Force-like arrows: `arrow(x1, y1, x2, y2, { kind: "force" | "reaction" | "pressure" | "stress" | "flow" | "motion", label })`.
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
- No engineering equations. Values such as `deflection`, `tauMax` or `stress` are read from the calculator's results, not recomputed. Geometry can use unit conversion, section properties and bounded proportions.

## Page wiring and input mapping

Calculator pages have a figure at the top of `.calculator-column`:

```html
<figure class="ff-figure"><div id="calcDiagram" class="ff-diagram-host" data-diagram="moment"></div></figure>
```

`calculator-diagram-pages.js` looks up `PAGES[id] = { watch, model(), commit?, ranges?, delegate? }`. `watch` lists the existing input ids, `model()` reads them into the registry model, and the figure refreshes on `input`/`change` and when `#result` changes. Hertzian contact switches between line- and point-contact hosts.

The existing calculation publishes optional fields through `FormulaFoundryCalculatorDiagramPage.publish(fields)`. The page validates the fields and refreshes synchronously before report capture. A dependency edit clears the solved annotations and asks for recalculation. An invalid calculation calls `publish()` to clear results and show an input status. The calculator’s reset can call `reset()` to return to the initial drawing. Keep all result dependencies, including material and output-unit controls, in `watch` or `delegate`. Expansion figures take their status and values from the shared expansion form and existing result rows.

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
| Circuit Studio | Interactive | Component count, series/parallel arrangement, source voltage, individual resistance values, open state | Shared wiring and symbol primitives render the actual branch configuration, component values, voltage labels, and current direction. |
| Speaker impedance and divider | Interactive | Series/parallel and other circuit options, component values | Editing active fields rebuilds the selected circuit diagram. |
| Moment, bearing life, bolt torque, thread strength, fillet weld, column buckling, beam bending stress, stress-strain, differential thermal expansion, factor of safety, Hertzian contact, thick-walled cylinder | Static | none | The system is fixed by the selected option; a slider would imply unmodelled degrees of freedom (e.g. moment has no angle input). |

Range controls come from `bindFieldRanges()`: a labelled native `<input type="range">` (keyboard-operable with arrow/Home/End, visible focus, 44 px touch height, `aria-valuetext` with units). Moving a control writes the real input field, dispatches `input`, and calls the page's existing calculate function, but only if the user has already calculated. The slider range is an exploration aid; the numeric field remains unrestricted, and the slider is disabled while the field is empty or invalid.

## Numerical plot: thick-walled cylinder

The stress-versus-radius plot is calculated data. `thickCylinderRenderPlot()` samples `r.stressAt(r)` (the Lamé solution) at 41 points and mounts `thick-walled-cylinder-plot`. Edits hide the plot until another valid solve. Axes are labelled with units, tension is positive, the zero line is drawn, radial, hoop and axial curves differ by line style and direct labels, and the y-range always includes zero. `tests/smoke/calculator-diagram-pages.test.js` checks the first and last samples against the closed-form values.

## Circuit schematics and response plots

Circuit diagrams use the shared scene and registry APIs. The electrical renderer draws resistor, source, capacitor, inductor, and speaker symbols with wiring, junctions, and polarity or current reference labels where applicable. Circuit Studio stacks series components or places parallel branches between shared vertical rails so the number of labels grows with the component count. Kirchhoff analysis retains fixed current arrows so a negative value identifies reverse flow.

RC and RL plots use samples from the first-order time solutions. The series RLC plot samples impedance magnitude on a bounded logarithmic frequency axis. Each plot marks the selected operating point. Electrical figures are rendered from the same solved data used in the result panel. [Electrical models and references](electrical-calculators.md)

## Shaft and bearing graphics

The assembly in `js/shaft-bearing-diagram.js` uses two orthogonal projections, a circular section view, and a dimensioned bearing span. Station markers retain their axial positions. Numbered load controls fan out when stations are close or coincident and select the corresponding numeric inputs by mouse or keyboard. The section and arrow sizes are illustrative. The viewport scrolls inside the figure on narrow screens to keep labels readable.

The solved station profile supplies every plotted shear force, bending moment, internal torque, equivalent stress, and displacement. Repeated axial coordinates carry the left and right limits at jumps. Project Report reconstructs the assembly from bounded registry data and uses the shared Study chart to draw a saved equivalent stress profile with critical stations retained.

## Accessibility

- Every SVG has `role="img"`, `<title>`, `<desc>`, and a `viewBox` with `preserveAspectRatio="xMidYMid meet"`.
- Controls are native range inputs with associated labels and `aria-valuetext`; there are no pointer-only interactions.
- Colour is redundant with labels, line style and arrow shape.
- The caption below each figure states what is schematic or exaggerated.

## Report integration

Report snapshots store `diagram: { type: "calc-diagram", id, model[, companion] }`. The optional companion is used for thick-cylinder and electrical response plots. Structured pages can pass the model explicitly, and scraped pages can capture it through the shared snapshot call. `report-builder.js` validates the diagram ID and bounded model data. `report-page.js` re-renders a static SVG with strict `normalize()`. Entries without a valid diagram still render their calculation content. Report figures have no controls, avoid page breaks inside the figure, and force print colours.

Beam Deflection reports keep their existing `beam-deflection` snapshot. Additive optional diagram fields fit the existing schema-v1 JSON format. Saved values are reused when available, and older snapshots still render from the fields they recorded.

Design Studies passes current form geometry and uses saved output values and units only when the selected scenario is calculated. A stale scenario keeps its historical results in the results table. Adding a calculated scenario to the report captures a static figure with that result.

## Adding a graphic

1. Add a renderer in the closest `diagram-renderers-*.js` with `registry.register(id, { title, caption, schema, build })`, built from `scene()` primitives.
2. Add the id to `CALC_DIAGRAM_IDS` in `js/report-builder.js`.
3. Add a `PAGES[id]` entry (`watch`, `model`, optional `commit`/`ranges`) in `calculator-diagram-pages.js`.
4. Add the `<figure class="ff-figure">` host and the diagram scripts to the calculator page (they load before `report-builder.js`).
5. Add cases to `tests/core/calculator-diagrams.test.js` (minimum, typical, maximum, zero, negative, missing) and, when the page has controls, to `tests/smoke/calculator-diagram-pages.test.js`.
6. Write the caption as a statement of simplifications, never beyond the calculator's equations.

## Graphics 2.0 review

The [36-calculator inventory](engineering-graphics-2-audit.md) records the baseline, decisions, additional annotations, preserved controls and model limits. The [Chromium gallery](graphics-2-gallery/) contains before and after captures.
