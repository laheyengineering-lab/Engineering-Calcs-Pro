# Engineering Graphics 2.0 inventory

The baseline is main at [PR #41](https://github.com/laheyengineering-lab/Engineering-Calcs-Pro/pull/41). [PR #32](https://github.com/laheyengineering-lab/Engineering-Calcs-Pro/pull/32) established the original shared SVG library, and [PR #40](https://github.com/laheyengineering-lab/Engineering-Calcs-Pro/pull/40) added eight lightweight schematics. PR #41 provided the reference for readable numerical annotations, mode-specific geometry, and figures built from solved model data.

The controls column lists interactions associated with the graphic. Form edits, unit selections, and calculation remain available even where the figure has no dedicated control.

## Original catalog

The original figures use the shared registry except Beam Deflection, which uses its existing renderer and snapshot.

| Calculator | Baseline drawing and fidelity | State and controls | Graphics 2.0 disposition |
| --- | --- | --- | --- |
| Moment | Lever, pivot, force and arm. Rotation convention could disagree with the load arrow. | Signed force, perpendicular distance and solved moment. No dedicated control. | Redraw the free-body diagram with a consistent force and moment sign convention, a dimension line and the solved moment. |
| Bearing Life | Bearing section. Load and rotation cues suggested actual force direction and applied torque. | Ball or roller, C, equivalent P, speed, calculated life in revolutions and hours. No dedicated control. | Redraw raceways and rolling elements. Identify P as an equivalent input and show L₁₀ after calculation. |
| Column Buckling | Four Euler modes, with some supports hard to recognize. | End condition, length, K, effective length and critical load. No dedicated control. | Redraw supports and mode illustrations. Distinguish critical load from the unscaled mode amplitude. |
| Beam Bending Stress | Standard section profiles. The selected section could look generic, and bending and stress annotations competed for space. | Profile, dimensions, centroidal axis, signed moment, extreme fiber location and solved bending stress. No dedicated control. | Draw the selected section and neutral axis beside the linear stress profile. Mark the extreme fiber and sign using the selected axis. |
| Beam Deflection | Interactive beam with the four supported cases. Distributed-load labels and supports crowded the negative-load layout. | Case, signed point load or UDL, span, section and solved maximum deflection. Existing span and applicable load sliders. | Refine the load, support and deflected-shape layout. Preserve controls, solver and the original beam report model. |
| Cylinder Force | Extend and retract sections and inset piston faces. Port and pressure interpretation was weak. | Bore, rod, pressure, optional efficiency, piston and annular area, extension and retraction forces. Existing bore, rod and pressure sliders. | Redraw section, ports, face and annulus. Use the solver’s areas and theoretical forces. |
| Shaft Torsion | Solid/hollow views and torque arcs, with crowded wall and twist labels. | Section and dimensions, signed torque, solved twist and surface shear. Existing signed torque slider. | Redraw axial view and section. Separate applied and reaction torques from tangential surface shear. |
| Helical Spring | Schematized coil and load. Original and loaded representations lacked a clear displacement datum. | Wire diameter, mean coil diameter, active coils, axial load and solved deflection. Existing geometry and load sliders. | Draw the helix from a common seat and separate geometry, load and exaggerated displacement. Free length is outside the model. |
| Stress & Strain | Original/deformed bar showed a default elongation even when the calculation only modeled stress. | Stress, strain, modulus or elongation mode. Force, area, reference length and available deformation/strain. No dedicated control. | Show the applicable force and deformation separately, with gauge length and cross-section. |
| Factor of Safety | Demand and capacity bars saturated to the same width for some overloads. | Stress or load mode, capacity, demand and solved ratio. No dedicated control. | Redraw both bars from a common zero and scale. Keep the ratio separate from any design acceptance judgment. |
| Thermal Expansion | Free and restrained views. Datum resembled a clamp and the restrained sign needed clarification. | Reference length, signed temperature interval, free displacement and optional elastic restrained stress. Existing ΔT slider. | Use a free datum, two physical restraints where applicable, and sign-aware deformation and reaction indications. |
| Differential Thermal Expansion | Series sections and movement comparison. Narrow sections and extreme ratios could crowd labels. | Up to three series materials per member and current solved movement of A, B and A − B. No dedicated control. | Retain the series-member structure and comparison with cleaner section labels and current-only numeric outputs. |
| Hertzian Contact Stress | Line/point views with crowded body and pressure annotations. | Cylinders or spheres and convex, flat or concave second body. Force, dimensions, calculated half-width/radius and peak pressure. No dedicated control. | Draw the contact footprint and identify the actual model dimensions. Use enlarged geometry and numerical peak pressure without drawing a new pressure distribution. |
| Thick-Walled Cylinder Stress | Section and Lamé radial/hoop/axial plot. Section cues could obscure the selected end condition. | Radii, internal/external pressure, open/closed ends and sampled stress curves. No dedicated control. | Redraw the section and end condition. Preserve the calculated plot and hide outdated samples on edits. |
| Bolt Torque | Joint section with crowded force and friction labels. | Bolt diameter, clamp target, nut factor and calculated torque. No dedicated control. | Show opposing bolt tension and plate clamping, with separate under-nut and thread-friction locations. |
| Thread Strength | Teeth overlaid section hatching and the support reaction direction was ambiguous. | Major diameter, converted pitch, engagement, applied load, tensile capacity and optional stripping capacity. No dedicated control. | Draw interlocking profiles and separate tensile and stripping surfaces. Tooth shape is schematic. |
| Fillet Weld Strength | Weld cross-section and crowded plan. Load angle looked like an applied moment. | Equal leg, length, applied load direction and solved throat. No dedicated control. | Use separate section and plan views with a perpendicular throat and an in-plane geometric angle. |
| Press Fit | Shaft and hub section with a fixed interference depiction. | Solid/hollow geometry, interference, engagement, friction and solved pressure/force/torque. Existing interference slider. | Use matching end and axial sections, opposed contact pressure and a magnified radial-interference detail. |

## Fluid, thermal and practical catalog

All eight PR #40 diagrams previously used lightweight, calculator-specific SVG builders. The figures now use shared scene primitives and existing calculator/Design Study result rows. Numeric and unit fields remain the controls.

| Calculator | Baseline and missing information | Graphics 2.0 disposition and state |
| --- | --- | --- |
| Pipe Flow & Reynolds Number | Rectangular pipe with a flow arrow. Inside diameter and circular flow area lacked a clear location. | Add a longitudinal pipe view and circular end section with inside diameter and mean velocity, area, flow rate and Reynolds number where available. |
| Pipe Pressure Drop & Fittings | Flow schematic with little distinction between fittings and straight-pipe friction. | Locate inlet and outlet, dimension the run and bore, and label available velocity and losses. Fittings are symbolic. |
| Pump Hydraulic Power | Basic pump outline. Hydraulic transfer and shaft power were ambiguous. | Use a pump symbol, inlet/outlet and shaft input with pressure rise, hydraulic power and shaft power from the result. |
| Hydraulic Cylinder Speed & Cycle Time | Generic piston and rod. Active chamber, port and travel were unclear. | Show cap/rod areas, selected direction, stroke and the solved speed or cycle timing where applicable. |
| Pneumatic Air Consumption | Chamber boxes with little connection to actual supply and exhaust paths. | Distinguish both chamber volumes and routing for extension and retraction, with cycle and consumption annotations. |
| Multilayer Insulation R-Value & U-Factor | Simple layer blocks conveyed the count but little of the thermal path. | Label the series layers, film boundaries and heat-transfer reference direction, with available resistance and U-factor. |
| Wall / Building Assembly Heat Loss | Basic wall and arrow. Interior/exterior temperatures and signed heat gain were unclear. | Mark both temperatures and reverse the heat-transfer arrow when the selected values imply inward flow. Show current heat rate. |
| Wall Mounting & Anchor Load Assessment | Simple bracket and force arrow. Fastener-row load paths were ambiguous. | Use a side section with load eccentricity, shear, withdrawal and wall bearing. Load arrows are schematic. |

## Electrical reference graphics preserved

All ten use the PR #41 scene-based renderer. Their mode controls and electrical geometry already communicate modeled quantities and reference directions. The shared text helper change applies to all scenes so subscripts and superscripts return cleanly to the baseline.

| Calculator | Existing graphic and useful state | Interaction, annotation notes and disposition |
| --- | --- | --- |
| Ohm’s Law | Source and resistor with polarity and circuit values. | Solve-for selection and form fields. Preserve. |
| Circuit Studio | Series or parallel circuit with individual components, branch values and conventional current. | Editable component count, values, wiring mode and open states. Preserve. |
| Kirchhoff Circuit | Two-loop network with node labels and fixed current references. | Circuit form edits. Signed current already communicates flow relative to the reference. Preserve. |
| Voltage & Current Divider | Loaded divider, including current-source branching and common reference. | Divider mode and resistor/source fields. Preserve. |
| DC Wire Voltage Drop | Supply and return conductors with resistance and terminal voltages. | Wire and load inputs. Preserve. |
| Speaker Impedance | Series or parallel nominal loads, branch values and wiring. | Speaker count, arrangement and impedance. Preserve. |
| AC Power Factor | Power triangle with the chosen phase convention and active/reactive/apparent power. | Form inputs and phase selection. Preserve. |
| RC Transients | Circuit and first-order response with a marked operating point. | Time and charge/discharge state from input fields. Preserve. |
| RL Transients | Circuit and first-order response with a marked operating point. | Time and switching mode from input fields. Preserve. |
| RLC Impedance | Series circuit and logarithmic response with operating point and resonance. | Frequency and component fields. Preserve. |

The drawings remain idealized. They show component geometry and modeled loads with bounded display proportions. The magnification of twist, interference, deflection and contact size is illustrative. The original 41-sample cylinder plot remains available on the live calculator and its standalone reports. A cylinder Design Study scenario stores discrete result rows, which support the section and historical outputs without reconstructing a sampled curve.
