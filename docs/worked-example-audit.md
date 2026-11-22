# Worked example audit

The baseline was the 36 active calculators on main at `2a2cbe1`. The table evaluates the worked examples as published at that revision. The last column records corrections and independent reference results. Scope is the published cases. The four original format references were Bolt Torque, Shaft Torsion, Beam Bending Stress and Cylinder Force.

**Key** ✓ complete or verified, △ partial or ambiguous, ✗ missing or incorrect, — no example math to render or no conversion needed. **G** numerical givens, **F** requested quantities, **E** governing equations, **S** numerical substitution, **I** intermediate steps and conversions, **R** results and units, **N** numerical agreement, **A** assumptions, modes and current data, **K** KaTeX. A check in **X** indicates an example existed.

| Calculator | X | G | F | E | S | I | R | N | A | K | Finding and verified result |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| Bolt Torque | ✓ | ✓ | ✓ | ✓ | ✓ | △ | ✓ | ✓ | ✓ | ✓ | Made 10 mm → 0.010 m explicit. 100 N·m. |
| Shaft Torsion | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | ✓ | Specified manual 80 GPa so the case stays distinct from the A36 preset. 20.37 MPa, 1.17°. |
| Beam Bending Stress | ✓ | ✓ | △ | △ | △ | △ | ✓ | ✓ | ✓ | ✓ | Made the moment conversion explicit. Worked the supplemental T-section using two rectangles and the parallel-axis theorem. 60 MPa for the rectangle and 173.921 MPa for the T-section. |
| Cylinder Force | ✓ | △ | ✗ | ✓ | ✓ | △ | ✓ | ✓ | △ | ✓ | Stated pressure difference and optional efficiency and showed both force paths. Ideal 78.54/58.90 kN, adjusted 70.69/53.01 kN. |
| Beam Deflection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | △ | Corrected the tenfold deflection error and rendered the substitution. The given inertia and load produce 0.5625 mm and 7500 N·m. |
| Bearing Life | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | Rendered the numerical power with the equation. 27 million revolutions, 300 h. |
| Column Buckling | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Retained. Pinned solid round column at 200 GPa gives 151.4 kN. |
| Differential Thermal Expansion | ✓ | ✓ | ✗ | △ | ✓ | △ | ✓ | ✓ | △ | ✓ | Identified manual coefficients, serial section sum, temperature changes and signed result. 0.480 mm, 0.648 mm, −0.168 mm. |
| Factor of Safety | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | △ | ✓ | Named the A36 plate preset and clarified the 2.5 yield-to-applied-stress ratio. |
| Fillet Weld | ✓ | △ | ✗ | ✓ | ✓ | △ | ✓ | ✗ | △ | ✓ | Matched the engine’s 0.707 throat coefficient without early rounding. Nominal 89.082 kip, LRFD 66.81 kip, ASD 44.54 kip and ASD leg 0.1123 in. |
| Hertzian Contact | ✓ | ✓ | △ | △ | △ | △ | ✓ | ✓ | △ | ✓ | Clarified manual properties and worked cylinder half-width and pressure. Spheres 0.4402 mm and 2464 MPa. Cylinders 0.3806 mm and 836.4 MPa. |
| Moment | ✓ | ✓ | ✓ | △ | ✓ | — | ✓ | ✓ | △ | ✓ | Identified the perpendicular lever arm and stated the governing relation. 2500 N·mm. |
| Press Fit | ✓ | ✓ | ✗ | △ | △ | △ | ✓ | ✗ | ✗ | ✓ | Verified the 250 MPa minimum for the shared A36 plate preset. 75 MPa contact pressure, +125/−75 MPa hoop stresses, 70.686 kN and 1767.15 N·m. Hub ratio is 2.00 and governs over the shaft’s 3.33. |
| Spring Calculations | ✓ | ✓ | ✗ | △ | ✓ | ✓ | ✓ | ✓ | △ | ✓ | Identified the manual modulus and summarized 9.77 N/mm, 51.20 mm and 482.4 MPa. |
| Stress & Strain | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | ✓ | Mapped stress, strain and deformation to separate modes. 100 MPa, 0.0005, 0.25 mm. |
| Thermal Expansion | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | ✓ | Identified manual coefficients and the solver’s compression-positive restrained-stress convention. 1.2 mm free expansion or +120 MPa compression for full restraint. Corrected the cooling interpretation. |
| Thick-Walled Cylinder | ✓ | ✓ | ✗ | △ | △ | △ | ✓ | ✓ | ✓ | ✓ | Named the Lamé terms and expanded the external-pressure case. Bore hoop stress is +166.67 MPa for internal pressure and −266.67 MPa for external pressure. |
| Thread Strength | ✓ | ✓ | ✗ | △ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Added explicit objectives and result. Retained the entered area caveat. Tensile capacity 24.48 kN governs, with 40.85% utilization. |
| Pipe Flow & Reynolds Number | ✓ | △ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | △ | — | Added the required fluid density and area, flow and viscosity conversions. 9.425 L/min, Re 2000, laminar. |
| Pipe Pressure Drop & Fittings | ✓ | △ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | △ | — | Replaced the implicit smooth, laminar case with an explicit turbulent case to demonstrate Colebrook. Darcy factor 0.0221745 and total loss 2.109 kPa. |
| Pump Hydraulic Power | ✓ | △ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | △ | — | Added density and head conversion. 200 W output, 250 W shaft input, 0.50 kWh. |
| Hydraulic Cylinder Speed & Cycle Time | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Worked both areas, volumes and speeds. 15.71 s extension, 10.05 s retraction and 25.76 s full cycle. |
| Pneumatic Air Consumption | ✓ | △ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | △ | — | Specified both temperatures, computed absolute pressure and used absolute reference conditions. 15.46 L per cycle and 154.57 L/min. |
| Multilayer Insulation | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Worked the layer and film resistances in series. 2.87 m²·K/W and 0.3484 W/(m²·K). |
| Wall Heat Loss | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | — | Converted duration and energy explicitly. +120 W outward and 1.20 kWh. |
| Wall Mounting & Anchor Load | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | △ | — | Worked force and moment equilibrium and illustrative component ratios. 100 N shear and 200 N tension per fastener. Ratios 66.7% and 50%. |
| Ohm’s Law & Electrical Power | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | — | Solved 2 A and checked 24 W absorption two ways. |
| Circuit Studio | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Solved both topologies through power balance. Series 400 Ω and 0.36 W. Parallel 75 Ω and 1.92 W. |
| Kirchhoff’s Laws & DC Analysis | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | — | Used nodal analysis and a case with reversing current. Center 4 V, left/center/right 2/1/−1 A and 15 W total dissipation. |
| Voltage & Current Divider | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Showed the equivalent lower leg, branch currents and loading error. 6 V unloaded, 4 V loaded, −33.3%. |
| DC Wire Voltage Drop | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Used the annealed copper reference at 20 °C and distinguished one-way from loop resistance. 0.862 V drop, 11.138 V at the load and 4.310 W loss. |
| RC Circuit Transients | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Worked the exponential at one time constant and derived charge and energy. 8.321 V, 0.3679 mA and 3.462 mJ. |
| RL Circuit Transients | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Worked the exponential at one time constant and checked the series voltage split. 0.3161 A, 1.839 V across the inductor and 4.995 mJ. |
| Series RLC Impedance & Resonance | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Added an off-resonance calculation and compared it with resonance. At 100 Hz, 47.970 Ω, +77.97°, 0.2085 A RMS and 0.4346 W. Resonance is near 50.33 Hz. |
| AC Power & Power Factor | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | — | Worked the sinusoidal power triangle. 600 VA, 480 W, +360 var and +36.87°. |
| Speaker Impedance & Amplifier Power | ✓ | ✓ | ✗ | ✗ | ✗ | △ | ✓ | ✓ | ✓ | — | Replaced equal speakers with 8 Ω and 16 Ω in parallel. 5.333 Ω, 2.25 A RMS and 27 W total, split 18/9 W. |

## Numerical verification

The audit recalculated the cases in coherent SI units, retaining full precision until the final rounding. Colebrook was checked by fixed-point iteration against production bisection. Kirchhoff was checked by nodal balance against the mesh solver. The wire calculation uses the production annealed copper reference. The A36 strength comes from the shared material record and was checked through the production Press Fit lookup. The signed wall, Kirchhoff and AC results follow the references on their pages.

The example tests feed published inputs through the production models or legacy calculation functions and compare outputs at the printed precision. The expanded cases also check the presence of input, calculation and result values in the page content. The KaTeX check uses the production loader and pinned renderer to confirm every display and inline expression produces math markup, with zero raw delimiters in the visible example.

The audited discrepancies were in published examples or explanations. The audit did not require a production-engine or material-data change.

## Browser verification

Chromium loaded all 36 calculator pages at 1440 px and 375 px, with the cache disabled and the production KaTeX scripts, styles and fonts supplied from the pinned CDN distribution. All 72 views rendered without raw delimiters, equation clipping or horizontal overflow in the worked examples. Circuit Studio also rendered with the OS dark preference enabled under the site’s light palette. Its parallel calculation produced 75 Ω, updated the schematic and saved the same result to Project Report.

The existing Chromium graphics regression passed against the baseline for 26 calculator pages and report entries. It also exercised print output, Design Studies, keyboard controls and alternate inputs.

| Desktop at 1440 px | Mobile at 375 px |
| --- | --- |
| [Pipe Pressure Drop](worked-example-screenshots/pipe-pressure-drop-1440.webp) | [Kirchhoff’s Laws](worked-example-screenshots/kirchhoff-circuit-375.webp) |
| [Circuit Studio](worked-example-screenshots/circuit-studio-1440.webp) | [Press Fit](worked-example-screenshots/press-fit-375.webp) |
