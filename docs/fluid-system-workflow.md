# Fluid System Designer

Open **Workflows** from the Formula Foundry navigation. Fluid System Designer links fluid and pipe inputs to segment calculations, a system head balance, pump duty and a Project Report. Standalone calculators solve individual relationships. Design Studies compare scenarios for one calculator.

## Use the workspace

1. Enter a project title and select a closed loop or open reservoir transfer. Enter the target flow, fluid density and one viscosity at operating conditions. Supply pump efficiency at the intended duty.
2. Enter 1–8 segments in flow order. Use internal bore diameter, straight length, absolute roughness and the sum of fitting K values. Add, duplicate, remove or move segments with the buttons. Changing a unit converts the existing values in that configuration. GPM uses US liquid gallons. Select a schematic segment to focus its editor.
3. Calculate. Inspect the per-segment states and losses, the signed system head balance, the required pump head and the shaft power.
4. Duplicate the active configuration, give the copy a name, and change its design inputs. Recalculate to see comparisons against the selected baseline. Duplicated configurations retain the original segment identities for per-segment comparisons. A new or separately duplicated segment has its own identity.
5. Run a flow sweep with 2–100 distinct samples. Flow varies while the geometry, density, viscosity, elevation and assumed efficiency stay fixed. The sweep table records friction head, signed net head, required pump head and shaft power. Failed samples have a gap in the plot and an explanation in the table.
6. Save locally or download workflow JSON. Add the active calculation to Project Report to capture the design basis, geometry, numerical results, equations, limitations and schematic. Include the comparison if useful. A current sweep adds its sample table and the selected plot.

**Load worked example** populates a reproducible three-segment installation. New projects and newly added segments start with blank engineering inputs.

## Model and sign convention

Each segment has the same volumetric flow $Q$. The existing pipe engines determine $A$, $v$, Reynolds number and Darcy factor. The pressure loss in a segment is the sum of Darcy–Weisbach straight-pipe loss and local fitting loss. Use the local mean velocity when supplying a total K for a segment, including applicable inlet, exit and diameter-change losses. Zero length permits a fitting-only segment. Zero roughness represents a smooth-pipe assumption.

The system sums the major and minor loss terms separately and converts their sum to friction head $h_f=\Delta p_f/(\rho g)$, with $g=9.80665\ \mathrm{m/s^2}$.

| System type | Net system head $H_\mathrm{net}$ | Conditions |
| --- | --- | --- |
| Closed recirculating loop | $h_f$ | The circuit returns to its start. Rises and falls contribute zero net elevation change. |
| Open reservoir-to-reservoir transfer | $h_f+z_\mathrm{out}-z_\mathrm{in}$ | Free surfaces share a reference pressure and their velocities are negligible. A lower receiving reservoir gives a negative elevation term. |

Required pump head is $\max(0,H_\mathrm{net})$. The equivalent pressure addition is $\rho g H_p$. The shared pump engine gives hydraulic output $Q\Delta p_p$ and shaft input $P_h/\eta$. An elevation drop that exceeds friction yields zero added pump head and power. Holding the desired flow may require dissipating the excess head. Gravity-assisted and zero-head results leave the actual operating flow undetermined. At zero flow the Darcy factor is undefined and modeled friction and power are zero. An uphill transfer can still have a static pressure requirement.

Darcy friction uses $64/\mathrm{Re}$ in laminar flow and the Colebrook–White relation for turbulent flow. Between Re 2,300 and 4,000, the shared solver interpolates the endpoint Darcy factors and the workflow flags the resulting estimate. Relative roughness is limited to 0.05 and turbulent Reynolds number to $10^8$.

The analysis assumes a single, full, steady series path with constant incompressible liquid properties. Branches, parallel lines, leaks, distributed withdrawals, gas compressibility, two-phase flow, thermal gradients, detailed valve/fitting geometry, and water hammer or other transients are outside the model. Pump curves, suction pressure, NPSH, cavitation and actual operating-point or shutoff calculations require separate analysis. Estimated shaft power excludes motor and drive losses. The fluid-engine equations and source references are documented with the standalone calculators. [Fluid calculator models and references](fluid-thermal-practical-calculators.md)

## Implementation

| File | Responsibility |
| --- | --- |
| `js/fluid-system-core.js` | Workflow ID and model revision, shared unit factors, validation, SI series balance and bounded sensitivity sweep. `computePipePressureDrop` calls `computePipeFlow` for each segment, then the workflow applies the boundary balance and calls `computePumpPower`. |
| `js/fluid-system-project.js` | Named configurations, baseline and active selection, edit/calculation states, local persistence and workflow JSON validation. |
| `workflows/fluid-system.html`, `css/fluid-system.css`, `js/fluid-system-page.js` | Guided editor and accessible results, comparison, sweep and export controls. |
| `js/fluid-system-diagram.js` | A registered Graphics 2.0 scene drawn from display geometry and solved quantities. The editor adds keyboard and pointer access to segment inputs. A report renders the saved scene model statically. |
| `js/fluid-system-report.js` | Tables and chart definitions shared by the editor and the schema-v1 report snapshot. |

The stages are explicit and synchronous. The solver accepts unit-aware inputs and returns SI values, segment-specific errors or warnings, and the conditions used. Views read those results; the drawing does not solve engineering equations. Later predefined workflows can follow the same pattern with their own model revision, controls and storage key, and reuse the existing report API and graphic primitives.

## Storage and compatibility

- The browser stores one project under `formulaFoundry.fluidSystemProject`. It can contain up to eight configurations, including the baseline, with up to eight segments each.
- A project file has `workflowId: "fluid-system"`, `schemaVersion: 1`, `modelVersion: 1` and a `project` record. It holds project metadata, configurations, unit selections, IDs, and calculation status. File imports are bounded to 256 KiB and validate the entire payload before prompting to replace the editor project.
- Editing physical inputs, units or segments invalidates the affected result, its solved annotations and sweep. Project and configuration titles and project-level notes can be edited independently. A saved calculated configuration is solved again from its validated inputs on load. Draft and edited configurations require a new calculation. Sweep samples are page-local.
- Save locally to make the editor project reopen after reload. A valid import opens in the editor first. If browser storage fails, export workflow JSON to keep it.
- The workflow file is separate from Project Report JSON. Adding an analysis appends a snapshot through `FormulaFoundryReport.addSnapshot()`. The report continues to use schema 1, including existing entries. An imported report uses the stored numbers and approved diagram model.

## Numerical and browser verification

An independent Colebrook fixed-point calculation for the published 24 L/min example gives $f_D$ of 0.02996536, 0.02935534 and 0.02920270. Summed friction is 14.224807 kPa or 1.453434 m. With +3.5 m of lift and 65% efficiency, required head is 4.953434 m, hydraulic power is 19.39177 W and shaft power is 29.83350 W. Enlarging only the 20 mm discharge to 25 mm gives 4.532099 m required head and 27.29589 W shaft power. The core tests also check a laminar Hagen–Poiseuille reference, continuity, loss addition, equivalent units and viscosity, model limits and gravity-assisted duty.

Run the automated suite with `npm test`. Set `FORMULA_FOUNDRY_KATEX_DIR` to the pinned KaTeX 0.16.11 dist directory to include rendering tests. The Chromium journey uses the installed browser and pinned KaTeX scripts, stylesheet and fonts. It captures images, report JSON, workflow JSON and an A4 PDF in the output directory.

```sh
FORMULA_FOUNDRY_KATEX_DIR=/path/to/katex/dist node tests/browser/fluid-system.mjs /tmp/fluid-review
```

[Workspace](fluid-system-screenshots/workspace.webp) · [Open transfer](fluid-system-screenshots/open-transfer.webp) · [Eight-segment loop](fluid-system-screenshots/closed-loop-eight-segments.webp) · [Comparison and sweep](fluid-system-screenshots/comparison.webp) · [Imported report](fluid-system-screenshots/report-round-trip.webp) · [Mobile results](fluid-system-screenshots/mobile-results.webp) · [Mobile scrolled schematic](fluid-system-screenshots/mobile-diagram-scroll.webp) · [Mobile worked example](fluid-system-screenshots/mobile-worked-example.webp)
