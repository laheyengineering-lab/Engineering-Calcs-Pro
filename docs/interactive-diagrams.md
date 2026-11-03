# Interactive engineering diagrams

Formula Foundry diagrams use native SVG and the shared `js/engineering-diagram.js` helpers. Calculator-specific renderers receive the current form values, render a static SVG when interaction is unavailable, and map any supported SVG control back to the existing calculator input and calculation function. The diagram is a view of calculator state, not a second store or a solver.

## Current pilot

`js/beam-deflection-diagram.js` renders the four closed-form models already supported by Beam Deflection: simply supported center point load, simply supported full-span uniform load, cantilever free-end point load, and cantilever full-span uniform load. The diagram's length dimension is illustrative; span changes use the keyboard-accessible range control beneath the SVG or the numeric span field, both of which update the existing calculation pipeline. For point-load cases, a second range control adjusts load magnitude in the selected units while preserving its direction and the supported load position. Numeric entries remain unrestricted by the sliders' exploration ranges.

Supports and load locations are fixed by the selected case. In particular, arbitrary point-load positions are not supported by the calculator's current equations, so the diagram does not imply that the point load can move to an unmodeled position. The deflected curve is qualitative, explicitly marked as illustrative, and never used in a calculation. Bending Stress continues to show its selected section profile and axis: it accepts a supplied bending moment, not a beam support/load model.

Beam Deflection report entries store a validated model snapshot and render it again from saved values. The snapshot includes loading/support case, span and units, load and units, selected section dimensions, axis, and calculated maximum deflection; report diagrams are static and print with the numeric input/result tables.

## Extension pattern

1. Load `js/engineering-diagram.js` before a calculator-specific renderer.
2. Keep SVG geometry and interactions in a calculator-specific module; read current input values from its caller rather than storing parallel engineering state.
3. Use `FormulaFoundryDiagram.createSvg()` and `add()` for finite, text-safe SVG elements. Use `bindSliderControl()` only when a supported input has a meaningful, bounded mapping; provide a standard numeric or native range control as an accessible alternative.
4. Make the calculator callback update the existing form input and call its established calculation pipeline. Keep visual exaggeration out of calculation inputs and label illustrative geometry.
5. If the report needs a diagram, add a validated serializable model snapshot and render a fresh SVG from that snapshot in `js/report-page.js`; do not capture a live DOM image.

For example, a future cylinder renderer can receive `{ bore, rod }` from the current inputs and emit a bore/rod cross-section. A supported drag callback would write the new bore back to its numeric input and call that calculator's existing calculation function; the renderer itself would not retain a second bore value or calculate cylinder force.

Future diagrams can follow this pattern for Hertzian radii, thermal lengths, hydraulic-cylinder geometry, or moment arms when those calculators expose suitable model inputs. Design Studies now supports both beam calculators through the DOM-free calculation entry points in `js/beam-study-calculations.js`; new adapters should likewise call tested calculation engines rather than duplicate equations.
