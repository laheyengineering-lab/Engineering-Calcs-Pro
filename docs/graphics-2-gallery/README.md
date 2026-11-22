# Engineering Graphics 2.0 visual review

The comparison sheets show native Chromium screenshots of the same engineering inputs on `main` before the changes and on the graphics branch after the changes. Diagrams remain SVG in the application and in reconstructed reports.

| Review sheet | Figures |
| --- | --- |
| [Loads and components](loads.webp) | Moment, Bearing Life, Cylinder Force, Shaft Torsion, Helical Spring |
| [Structural analysis](structural.webp) | Column Buckling, Beam Bending Stress, Beam Deflection, Stress & Strain, Factor of Safety |
| [Expansion, contact and pressure](thermal-contact.webp) | Thermal Expansion, Differential Thermal Expansion, Hertzian Contact, Thick-Walled Cylinder |
| [Manufacturing and joints](manufacturing.webp) | Bolt Torque, Thread Strength, Fillet Weld, Press Fit |
| [Fluid and fluid power](fluid-power.webp) | Pipe Flow, Pipe Pressure Drop, Pump Hydraulic Power, Hydraulic Cylinder Speed, Pneumatic Air Consumption |
| [Building applications](building.webp) | Multilayer Insulation, Wall Heat Loss, Wall Mounting |
| [Retained numerical plot](retained.webp) | Lamé stress plot from the Thick-Walled Cylinder calculation |
| [Mobile viewport](mobile.webp) | Cylinder Force and Wall Mounting at 390 px, with both ends of the scrollable figures |
| [Project Report](saved-views.webp) | Current report and imported pre-change schema-v1 snapshot |
| [Design Study and alternate contact](alternate-views.webp) | Wall Mounting context and Hertzian sphere-on-flat contact |

From the repository root, run the Chromium check below with Node.js 24 and Chromium installed. Set `CHROMIUM` to the executable path if it differs from `chromium`.

```sh
mkdir -p /tmp/ff-graphics-baseline
git archive 9f76071 | tar -x -C /tmp/ff-graphics-baseline
node tests/browser/engineering-graphics.mjs /tmp/ff-graphics-baseline /tmp/ff-graphics-review
```

The output directory contains desktop and mobile captures at 1440 px and 390 px, label bounds diagnostics, schema-v1 projects, and a print PDF. The check compares saved engineering results against pre-change values and exercises report import, Design Studies, native keyboard controls, and alternate calculation states.
