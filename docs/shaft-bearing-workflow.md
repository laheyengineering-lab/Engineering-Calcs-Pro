# Shaft & Bearing System Designer

The workspace estimates the static response of a straight, uniform circular shaft between two ideal radial supports. It combines solid or hollow section properties, transverse point loads in two planes, a transmitted torque path, deflection, nominal elastic stress and individual bearing basic rating life.

## Use the workspace

1. Enter project details and a configuration name. Set the bearing span, section dimensions and shaft speed. Choose a material preset or enter properties manually. The material panel lists the selected condition, product form, property basis and applicable caveats.
2. Add up to eight load records. Enter each axial position from Bearing A and signed force components along the stationary transverse axes. Load records can share a location. Use the buttons to duplicate, remove or reorder records. Select a station in the schematic to focus its numeric editor.
3. Supply the signed torque at its introduction station. The extraction station carries an equal and opposite external torque. Enter each bearing’s type, basic dynamic load rating and, if available, basic static load rating and target life.
4. Calculate and inspect the assembly, equilibrium residuals, shaft plots and bearing results. Change result units to inspect the same solution in another unit.
5. Duplicate the configuration, change a design input and calculate the alternative. Select a baseline for percentage comparisons. Run an outside-diameter sweep with 2–30 samples. For a hollow section, the bore stays fixed and the wall thickness varies with outside diameter.
6. Save the project locally or export workflow JSON. Add the current analysis to Project Report to capture the design basis, results, schematic, plot and supporting tables.

**Load Worked Example** supplies a two-plane gear load and a separate torque pair on a cold-drawn AISI 1018 shaft. The workspace gives the numerical solution alongside the reproducible inputs.

## Model and sign conventions

The positive axial coordinate runs from Bearing A at $x=0$ to Bearing B at $x=L$. The two supports prevent translation in both transverse directions and allow rotation. A point force uses signed components $F_{iy},F_{iz}$ in fixed global axes. End loads at the supports are allowed. An end load contributes to the coincident reaction and can cancel it in the interior shear diagram. The solver uses the supplied forces directly. Gear or belt forces require separate inputs.

For either load plane $q$, the reactions follow from force equilibrium and moment equilibrium about A.

$$
R_{Bq}=-\frac{\sum_i F_{iq}a_i}{L},\qquad
R_{Aq}=-\sum_i F_{iq}-R_{Bq}.
$$

Here $a_i$ is the position of load $i$. The signed residuals use global force and moment components. A positive $F_y$ at positive $x$ contributes positive $M_z$ globally, and a positive $F_z$ contributes negative $M_y$. In the shaft plots $M_{[y]}$ is the moment in the Y loading plane and equals global $M_z$, while $M_{[z]}$ equals negative global $M_y$.

$$
V_q(x)=R_{Aq}+\sum_{a_i<x}F_{iq},\qquad
M_{[q]}(x)=R_{Aq}x+\sum_i F_{iq}\max(x-a_i,0).
$$

The shear curve uses both one-sided values at a concentrated load. Crossing a station to the right adds the sum of its signed forces. The moment is continuous. The resultant $M_r=\sqrt{M_{[y]}^2+M_{[z]}^2}$ is nonnegative. Between consecutive breakpoints both moment components are affine, so their norm reaches its maximum at an interval endpoint.

### Torsion and nominal static yield

Positive external introduction torque follows the right-hand convention about +X. The constant transmitted internal torque has the introduction sign between the two torque stations and is zero elsewhere. The bearings supply radial forces only. For outside diameter $D_o$ and bore $D_i$, where $D_i=0$ for a solid section,

$$
A=\frac{\pi(D_o^2-D_i^2)}4,\qquad
I=\frac{\pi(D_o^4-D_i^4)}{64},\qquad
J=2I,\qquad Z=\frac{2I}{D_o}.
$$

At each candidate section, outer-fiber bending stress is $M_r/Z$ and torsional shear magnitude is $|T(x)|D_o/(2J)$. The von Mises equivalent stress is $\sqrt{\sigma_b^2+3\tau^2}$ using the two stresses from the same station and the same side of each torque discontinuity. The constant internal torque and affine moment components make interval endpoints sufficient for the maximum. The solver examines both physical sides at internal breakpoints and chooses the earliest station when the values tie exactly. The stated static yield ratio is $S_y/\max_x\sigma_\mathrm{eq}(x)$ when an applicable strength and nonzero stress are available. The reported twist is the angle at torque introduction minus the angle at extraction, $T(x_\mathrm{out}-x_\mathrm{in})/(GJ)$.

Apply the static yield assessment to ductile materials. Nominal stress excludes keyways, shoulders, notches, splines, surface finish, residual stress and fatigue effects. A material point in a rotating shaft under stationary transverse loading can experience fully reversed bending. Fatigue design requires a separate assessment.

### Deflection and stiffness

The two transverse displacements follow $EI\,v_q''=M_{[q]}$. Closed-form simply supported point-load solutions are superposed with $v_q(0)=v_q(L)=0$. The workflow reports signed plane displacements at each load and the analytical slopes at the bearings. It evaluates the resultant displacement $\sqrt{v_y^2+v_z^2}$ at load stations and at the stationary points inside each interval.

Within an interval the plane displacements are cubic polynomials. The derivative of squared resultant displacement is proportional to $v_yv_y'+v_zv_z'$, a polynomial of degree at most five. The solver brackets its roots between derivative roots, refines the brackets by bisection to a normalized station tolerance of $10^{-12}$, and also checks interval endpoints. The solver locates the displacement maximum numerically from these analytical pieces. Plots use 120 uniform intervals plus stations at discontinuities and the located deflection maximum.

The beam model assumes a slender shaft, small deflection, uniform geometry and linear elasticity. Effects from overhangs, steps, redundant supports, support stiffness, axial thrust, rotor dynamics and critical speeds are outside scope. Shaft mass is $\rho A L$. Shaft self-weight is excluded from the static loads, so changing diameter alone leaves reactions and bearing life unchanged.

### Bearing basic rating life

The resultant of each bearing’s signed reaction components provides that bearing’s radial load $P=\sqrt{R_y^2+R_z^2}$. For the simplified radial-only case, the workflow uses this value as both the equivalent dynamic load and the equivalent static load. With speed $n$ in rpm,

$$
L_{10}=(C/P)^p,\qquad L_{10h}=\frac{10^6L_{10}}{60n},
\qquad p=3\ {\rm (ball)},\quad p=10/3\ {\rm (roller)}.
$$

$L_{10}$ is in million revolutions and $L_{10h}$ in operating hours. For a positive load and speed, the required rating for a target $L_\mathrm{target,h}$ is $P(60nL_\mathrm{target,h}/10^6)^{1/p}$. A supplied $C_0$ enables the basic static rating ratio $C_0/P$ for a positive load. At zero load the life and the static ratio are undefined. At zero speed and positive load the revolution rating remains available and operating hours are undefined.

Individual $L_{10}$ values are statistical basic ratings. Actual service life and system reliability require additional analysis. The model excludes lubrication, contamination, misalignment, axial loading, preload, operating temperature, limiting speed and modified rating life. Unloaded results describe the specified load model. Real bearings can carry loads omitted from the model.

## Implementation and review plan

The implementation follows the layered architecture in Fluid System Designer (PR #44), the shared scene and report reconstruction pattern in Engineering Graphics 2.0 (PR #42), and the numerical example standard in PR #43. The calculator expansions in PRs #40 and #41 established the reusable calculation and registry patterns. The shaft workflow uses the existing engines where their mathematical domains apply.

| Layer | Responsibility and engineering audit |
| --- | --- |
| Shared section and beam engines | Reuse `BeamSectionProperties.calculate` for section geometry. Expose `bendingStressFromSection` to reuse the existing bending-stress calculation with prepared section properties. The existing simply supported deflection cases cover a centered point load and a full-span uniform load. Use the centered case as a benchmark for the new arbitrary position solver. |
| Shared torsion, strength and bearing engines | Use the circular shaft torsion engine and expose its stress calculation independently of shear modulus. Reuse the stress-based factor-of-safety ratio for nominal static yield. Expose the basic bearing revolution rating separately from the existing speed-dependent hour calculation. |
| Shaft solver | Implement signed equilibrium, point-load diagrams, two-plane superposition, one-sided stress evaluation, numerical isolation of displacement extrema and a fixed-bore outside-diameter sweep. Keep the core independent of the DOM. |
| Project state and units | Follow the existing local project and alternative workflow. Store geometry, loads and material values in SI, speed in rpm and target life in hours. Keep input and output formats as separate configuration preferences and use the shared conversions and material reference data. |
| Graphics and editor | Render the solved state through shared SVG primitives. Add editable load stations, project controls, signed result plots and comparison and sensitivity views. The reconstructed report scene uses the same diagram renderer. |
| Reporting and review | Capture the solved configuration through the existing schema-v1 report API. Verify analytic benchmarks, the loaded worked example, persistence, existing report interoperability and a desktop and mobile Chromium journey. |

Young’s modulus enables displacement and slope, shear modulus enables nonzero torque twist, yield strength enables a static yield ratio and density enables mass. Related results stay available when a property is missing. The shared material reference records can omit properties or flag legacy values as unverified. The workflow leaves those properties blank for manual entry, preserves explicit overrides within that material selection, and loads the new preset’s values when the material changes. [Material reference and provenance](material-reference.md)

## Projects and reports

- Local storage uses `formulaFoundry.shaftBearingProject` for one project with up to eight configurations. Configurations retain independent editable records and unit preferences.
- Portable project JSON identifies `workflowId: "shaft-bearing"`, `schemaVersion: 1` and the calculation model version. A file stores inputs, selections and calculation status. Saved calculated configurations are solved again from the saved inputs. Imports check the whole structure, including permitted units, material provenance and record identity, before changing the editor. The file limit is 256 KiB. Draft or edited configurations can retain incomplete inputs.
- Physical edits clear the affected calculation, plots, sweep and report eligibility until recalculation. Input and output unit changes preserve the canonical inputs and result. Output settings update displays, current sweep samples and newly captured report snapshots. Sweep samples are page-local.
- Adding an analysis appends a schema-v1 snapshot to Project Report. The snapshot retains the captured numbers, equation set and reconstructible schematic. Project Report JSON also supports calculator, Design Study and Fluid System Designer entries. [Project reporting](reporting.md)

## Benchmarks and browser verification

Independent equilibrium and beam formulas for the example give $R_A=(960,-720)\,\mathrm N$ and $R_B=(640,-480)\,\mathrm N$ in the Y and Z directions. The 40 mm shaft reaches $288\,\mathrm{N\,m}$ resultant bending moment and $48.279\,\mathrm{MPa}$ equivalent stress at $x=0.24\,\mathrm m$. Peak displacement is $0.33128\,\mathrm{mm}$ at $x=0.28251\,\mathrm m$ and the torque path twists $0.13165^\circ$. The ball and roller basic ratings are $6351.85\,\mathrm h$ and $18962.96\,\mathrm h$ respectively. Increasing the solid diameter to 50 mm under the same loads reduces stress to $24.719\,\mathrm{MPa}$ and displacement to $0.13569\,\mathrm{mm}$.

The independent multi-load benchmark uses a 1 m span, solid 50 mm diameter, $E=200\,\mathrm{GPa}$, and station/force triples $(0.20,-1200,0)$, $(0.55,0,1000)$ and $(0.80,600,-350)$ in meters and newtons. Signed reactions are $(840,-380)\,\mathrm N$ and $(-240,-270)\,\mathrm N$. The maximum resultant moment occurs at $x=0.55\,\mathrm m$, with signed plane components $(42,-209)\,\mathrm{N\,m}$. Independent symbolic integration yields maximum displacement $0.291782659\,\mathrm{mm}$ at $x=0.478745225\,\mathrm m$.

The localized-torque benchmark uses a 1 m span with a $-1000\,\mathrm N$ center load and $300\,\mathrm{N\,m}$ torque between $x=0.10$ and $0.20\,\mathrm m$. Maximum bending moment is $250\,\mathrm{N\,m}$ at midspan. Combined stress peaks at the left limit of $x=0.20\,\mathrm m$, where the moment is $100\,\mathrm{N\,m}$ and the section still transmits torque.

Run the engineering and integration suites with `npm test`. Set `FORMULA_FOUNDRY_KATEX_DIR` to the pinned KaTeX 0.16.11 distribution to include the equation rendering tests. The Chromium journey uses the pinned distribution including fonts and records screenshots and a print PDF in the chosen output directory.

```sh
FORMULA_FOUNDRY_KATEX_DIR=/path/to/katex/dist node tests/browser/shaft-bearing.mjs /tmp/shaft-bearing-review
```

[Assembly](shaft-bearing-screenshots/assembly.webp) · [Eight load stations](shaft-bearing-screenshots/assembly-eight-loads.webp) · [Results](shaft-bearing-screenshots/results.webp) · [Plots](shaft-bearing-screenshots/plots.webp) · [Comparison and sweep](shaft-bearing-screenshots/comparison-and-sweep.webp) · [Worked example](shaft-bearing-screenshots/worked-example.webp) · [Project Report](shaft-bearing-screenshots/report.webp) · [Printed report](shaft-bearing-screenshots/report-print.webp)

[Mobile assembly](shaft-bearing-screenshots/mobile-assembly.webp) · [Mobile scrolled schematic](shaft-bearing-screenshots/mobile-assembly-scrolled.webp) · [Mobile results](shaft-bearing-screenshots/mobile-results.webp) · [Mobile plots](shaft-bearing-screenshots/mobile-plots.webp) · [Mobile worked example](shaft-bearing-screenshots/mobile-worked-example.webp)

## Engineering references

- Roark’s Formulas for Stress and Strain, 9th ed., for circular section properties and simply supported point-load beam response. [McGraw Hill](https://www.mheducation.com/highered/mhp/product/roark-s-formulas-stress-strain-9e)
- Shigley’s Mechanical Engineering Design for elastic circular-shaft torsion, distortion-energy yield theory and the need to consider reversed bending in rotating shafts. [McGraw Hill](https://www.mheducation.com/highered/product/shigleys-mechanical-engineering-design-nisbett.html)
- ISO 281:2007 for basic dynamic load rating and rating life and ISO 76:2006 for static load ratings. [ISO 281](https://www.iso.org/standard/38102.html) · [ISO 76](https://www.iso.org/standard/38101.html)
