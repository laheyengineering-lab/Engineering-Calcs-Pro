const calculators = [
    {
        id: "moment",
        name: "Moment Calculator",
        shortDescription: "Calculate torque from force and perpendicular distance.",
        description: "Calculate the moment (torque) created by a force acting at a perpendicular distance from a pivot point.",
        category: "Mechanical",
        path: "calculators/moment.html",
        related: ["beam-deflection", "bolt-torque", "stress-strain", "shaft-torsion"],
        keywords: ["moment", "torque", "force", "lever arm", "statics", "rotation"]
    },
    {
        id: "stress-strain",
        name: "Stress & Strain Calculator",
        shortDescription: "Calculate axial stress, strain, Young's modulus, and elastic deformation.",
        description: "Calculate axial normal stress, strain, Young's modulus, and elastic deformation for a prismatic member under uniaxial loading.",
        category: "Materials",
        path: "calculators/stress-strain.html",
        related: ["moment", "beam-deflection", "shaft-torsion", "thermal-expansion"],
        keywords: ["stress", "strain", "elastic", "deformation", "young's modulus", "tension", "compression"]
    },
    {
        id: "shaft-torsion",
        name: "Shaft Torsion Calculator",
        shortDescription: "Analyze circular shafts under torsion. Calculate shear stress and angle of twist.",
        description: "Analyze circular shafts under torsion. Calculate shear stress, polar moment of inertia, angle of twist, and torsional stiffness.",
        category: "Mechanical",
        path: "calculators/shaft-torsion.html",
        related: ["moment", "stress-strain", "beam-deflection", "thermal-expansion"],
        keywords: ["torsion", "torque", "shear stress", "shaft", "twist", "angle of twist"]
    },
    {
        id: "thermal-expansion",
        name: "Thermal Expansion Calculator",
        shortDescription: "Calculate linear thermal expansion and restrained thermal stress.",
        description: "Calculate linear thermal expansion or contraction for materials due to temperature changes. Includes free expansion and optional restrained member thermal stress analysis.",
        category: "Materials",
        path: "calculators/thermal-expansion.html",
        related: ["stress-strain", "shaft-torsion", "beam-deflection", "moment"],
        keywords: ["thermal", "expansion", "temperature", "contraction", "thermal stress", "coefficient"]
    },
    {
        id: "beam-deflection",
        name: "Beam Deflection Calculator",
        shortDescription: "Calculate beam deflection for simply supported and cantilever beams.",
        description: "Calculate maximum beam deflection, bending moment, and slope for common static loading cases using Euler-Bernoulli beam theory.",
        category: "Mechanical",
        path: "calculators/beam-deflection.html",
        related: ["stress-strain", "shaft-torsion", "thermal-expansion", "moment"],
        keywords: ["deflection", "beam", "bending", "deflection limit", "serviceability"]
    },
    {
        id: "column-buckling",
        name: "Column Buckling Calculator",
        shortDescription: "Calculate Euler critical buckling load for circular columns.",
        description: "Calculate Euler critical buckling load for solid and hollow circular columns with idealized end conditions.",
        category: "Mechanical",
        path: "calculators/column-buckling.html",
        related: ["factor-of-safety", "stress-strain", "beam-deflection", "moment"],
        keywords: ["buckling", "column", "Euler", "critical load", "slenderness", "stability"]
    },
    {
        id: "beam-bending-stress",
        name: "Beam Bending Stress Calculator",
        shortDescription: "Calculate elastic bending stress from moment and section geometry.",
        description: "Calculate elastic maximum bending stress from bending moment and cross-section properties.",
        category: "Mechanical",
        path: "calculators/beam-bending-stress.html",
        related: ["beam-deflection", "stress-strain", "factor-of-safety", "moment"],
        keywords: ["bending", "bending stress", "moment", "section modulus", "flexural stress"]
    },
    {
        id: "bearing-life",
        name: "Bearing Life Calculator",
        shortDescription: "Calculate basic L10 bearing life in revolutions and operating hours.",
        description: "Calculate basic rolling-element bearing rating life (L10) from dynamic rating, equivalent load, and speed.",
        category: "Mechanical",
        path: "calculators/bearing-life.html",
        related: ["shaft-torsion", "factor-of-safety", "bolt-torque", "stress-strain"],
        keywords: ["bearing", "life", "rating", "L10", "rolling bearing", "service life"]
    },
    {
        id: "factor-of-safety",
        name: "Factor of Safety Calculator",
        shortDescription: "Calculate factor of safety from stress- or load-based definitions.",
        description: "Calculate factor of safety using either stress-based or load-based definitions.",
        category: "Materials",
        path: "calculators/factor-of-safety.html",
        related: ["stress-strain", "beam-bending-stress", "column-buckling", "beam-deflection"],
        keywords: ["factor of safety", "safety factor", "margin", "yield strength", "load ratio"]
    },
    {
        id: "press-fit",
        name: "Press Fit Calculator",
        shortDescription: "Calculate interference-fit contact pressure, assembly force, and torque capacity.",
        description: "Analyze shaft and hub interference fits using elastic Lamé thick-cylinder theory.",
        category: "Mechanical",
        path: "calculators/press-fit.html",
        related: ["shaft-torsion", "stress-strain", "factor-of-safety", "thermal-expansion"],
        keywords: ["press fit", "interference fit", "shrink fit", "contact pressure", "hub stress", "shaft", "torque capacity", "press force"]
    },
    {
        id: "spring-calculations",
        name: "Helical Spring Calculations",
        shortDescription: "Calculate spring rate, deflection, and corrected shear stress for round-wire helical compression springs.",
        description: "Analyze round-wire helical compression springs under axial loading. Calculate spring index, spring rate, deflection, Wahl stress-correction factor, and maximum shear stress.",
        category: "Mechanical",
        path: "calculators/spring-calculations.html",
        related: ["shaft-torsion", "stress-strain", "factor-of-safety"],
        keywords: ["spring", "helical spring", "spring rate", "deflection", "shear stress", "compression spring"]
    },
    {
        id: "fillet-weld",
        name: "Fillet Weld Strength Calculator",
        shortDescription: "Calculate direct-load capacity and required size for fillet welds.",
        description: "Calculate effective throat, weld capacity, required fillet size, and utilization for directly loaded fillet welds.",
        category: "Manufacturing",
        path: "calculators/fillet-weld.html",
        related: ["factor-of-safety", "stress-strain", "moment", "beam-bending-stress"],
        keywords: ["fillet weld", "weld strength", "weld size", "weld throat", "E70", "weld capacity", "weld sizing", "welding"]
    },
    {
        id: "hertzian-contact",
        name: "Hertzian Contact Stress Calculator",
        shortDescription: "Estimate contact width or radius and peak contact pressure for cylinders and spheres.",
        description: "Estimate Hertzian contact geometry and maximum contact pressure for two parallel cylinders in line contact or two spheres in point contact, including flat and concave counterfaces.",
        category: "Mechanical",
        path: "calculators/hertzian-contact.html",
        related: ["press-fit", "bearing-life", "stress-strain", "factor-of-safety"],
        keywords: ["hertz", "hertzian", "contact stress", "contact pressure", "line contact", "point contact", "cylinder", "sphere", "roller", "ball", "rolling contact"]
    },
    {
        id: "differential-thermal-expansion",
        name: "Differential Thermal Expansion Calculator",
        shortDescription: "Calculate multi-section free thermal expansion and differential movement between two members.",
        description: "Calculate free thermal expansion for members made of up to three series sections with different lengths, coefficients and temperatures, and the differential movement between two members.",
        category: "Materials",
        path: "calculators/differential-thermal-expansion.html",
        related: ["thermal-expansion", "stress-strain", "press-fit"],
        keywords: ["differential expansion", "thermal expansion", "multi-section", "temperature", "clearance", "valve pin", "relative movement", "coefficient"]
    },
    {
        id: "cylinder-force",
        name: "Hydraulic/Pneumatic Cylinder Force Calculator",
        shortDescription: "Calculate theoretical extension and retraction force for a single-rod cylinder.",
        description: "Calculate theoretical extension and retraction force, piston area, rod area and annular area for a double-acting single-rod hydraulic or pneumatic cylinder, with an optional user-supplied efficiency estimate.",
        category: "Mechanical",
        path: "calculators/cylinder-force.html",
        related: ["thick-walled-cylinder", "column-buckling", "stress-strain"],
        keywords: ["hydraulic", "pneumatic", "cylinder", "actuator", "piston", "force", "pressure", "bore", "rod", "annular area", "fluid power"]
    },
    {
        id: "thick-walled-cylinder",
        name: "Thick-Walled Cylinder Stress Analysis",
        shortDescription: "Calculate Lamé radial, hoop and axial stresses under internal and external pressure.",
        description: "Estimate radial, hoop and axial stress distributions in a thick-walled cylinder under internal and/or external pressure using the elastic Lamé equations, with a stress-versus-radius plot.",
        category: "Mechanical",
        path: "calculators/thick-walled-cylinder.html",
        related: ["press-fit", "cylinder-force", "stress-strain", "factor-of-safety"],
        keywords: ["thick wall", "thick-walled", "Lamé", "Lame", "hoop stress", "radial stress", "pressure vessel", "internal pressure", "external pressure", "cylinder stress"]
    },
    {
        id: "bearing-pv",
        name: "Bearing PV",
        shortDescription: "Coming Soon",
        description: "Coming soon: evaluate bearing pressure-velocity limits and temperature limits.",
        category: "Mechanical",
        path: "calculators/bearing-pv.html",
        related: [],
        keywords: ["bearing", "PV", "pressure velocity", "temperature limit"],
        status: "coming-soon"
    },
    {
        id: "bolt-torque",
        name: "Bolt Torque Calculator",
        shortDescription: "Calculate tightening torque for threaded fasteners.",
        description: "Calculate the required tightening torque for threaded fasteners based on bolt size, clamp load, and friction factor.",
        category: "Fasteners",
        path: "calculators/bolt-torque.html",
        related: ["moment", "shaft-torsion", "stress-strain", "thermal-expansion"],
        keywords: ["bolt", "torque", "fastener", "preload", "nut factor", "clamp load"]
    },
    {
        id: "thread-strength",
        name: "Thread Strength Calculator",
        shortDescription: "Calculate tensile and stripping capacity for threaded fasteners and joints.",
        description: "Preliminary assessment of threaded fastener strength under tensile loading. Calculate fastener tensile capacity, internal-thread stripping capacity, and identify the governing failure mode.",
        category: "Fasteners",
        path: "calculators/thread-strength.html",
        related: ["bolt-torque", "stress-strain", "factor-of-safety"],
        keywords: ["thread", "fastener", "bolt", "tensile strength", "thread stripping", "engagement", "thread depth"]
    },
    {
        id: "bolt-preload",
        name: "Bolt Preload",
        shortDescription: "Coming Soon",
        description: "Coming soon: estimate fastener preload, clamping force, and joint stiffness.",
        category: "Fasteners",
        path: "calculators/bolt-preload.html",
        related: [],
        keywords: ["bolt", "preload", "fastener", "clamping", "joint stiffness"],
        status: "coming-soon"
    },
    {
        id: "deep-drawing",
        name: "Deep Drawing",
        shortDescription: "Coming Soon",
        description: "Coming soon: assess sheet-metal forming and draw ratios for punch and die designs.",
        category: "Manufacturing",
        path: "calculators/deep-drawing.html",
        related: [],
        keywords: ["drawing", "sheet metal", "forming", "draw ratio", "punch", "die"],
        status: "coming-soon"
    },
    {
        id: "pipe-flow",
        name: "Pipe Flow & Reynolds Number",
        shortDescription: "Find flow area, mean velocity and Reynolds number for a full circular pipe.",
        description: "Find flow area, mean velocity and Reynolds number for a full circular pipe.",
        category: "Fluid Mechanics",
        path: "calculators/pipe-flow.html",
        related: ["pipe-pressure-drop", "pump-hydraulic-power"],
        keywords: ["pipe", "reynolds", "laminar", "turbulent", "velocity", "viscosity"]
    },
    {
        id: "pipe-pressure-drop",
        name: "Pipe Pressure Drop & Fittings",
        shortDescription: "Estimate straight-pipe friction and fitting losses with Darcy–Weisbach.",
        description: "Estimate straight-pipe friction and fitting losses with Darcy–Weisbach.",
        category: "Fluid Mechanics",
        path: "calculators/pipe-pressure-drop.html",
        related: ["pipe-flow", "pump-hydraulic-power"],
        keywords: ["pipe", "darcy", "colebrook", "fittings", "roughness", "pressure", "head"]
    },
    {
        id: "pump-hydraulic-power",
        name: "Pump Hydraulic Power",
        shortDescription: "Calculate hydraulic output, required shaft power and shaft energy.",
        description: "Calculate hydraulic output, required shaft power and shaft energy.",
        category: "Fluid Mechanics",
        path: "calculators/pump-hydraulic-power.html",
        related: ["pipe-pressure-drop", "pipe-flow"],
        keywords: ["pump", "hydraulic", "horsepower", "efficiency", "energy", "duty", "head"]
    },
    {
        id: "hydraulic-cylinder-speed",
        name: "Hydraulic Cylinder Speed & Cycle Time",
        shortDescription: "Estimate stroke speeds, chamber volumes and theoretical travel times.",
        description: "Estimate stroke speeds, chamber volumes and theoretical travel times.",
        category: "Fluid Power",
        path: "calculators/hydraulic-cylinder-speed.html",
        related: ["cylinder-force", "pneumatic-air-consumption", "pump-hydraulic-power"],
        keywords: ["cylinder", "hydraulic", "stroke", "cycle", "extension", "retraction", "piston"]
    },
    {
        id: "pneumatic-air-consumption",
        name: "Pneumatic Air Consumption",
        shortDescription: "Calculate theoretical cylinder air use at explicitly entered reference conditions.",
        description: "Calculate theoretical cylinder air use at explicitly entered reference conditions.",
        category: "Fluid Power",
        path: "calculators/pneumatic-air-consumption.html",
        related: ["hydraulic-cylinder-speed", "cylinder-force"],
        keywords: ["pneumatic", "cylinder", "air", "compressor", "consumption", "free-air", "reference"]
    },
    {
        id: "multilayer-insulation",
        name: "Multilayer Insulation R-Value & U-Factor",
        shortDescription: "Combine up to six planar material layers and optional surface films.",
        description: "Combine up to six planar material layers and optional surface films.",
        category: "Thermal / HVAC",
        path: "calculators/multilayer-insulation.html",
        related: ["wall-heat-loss"],
        keywords: ["insulation", "R-value", "U-factor", "conduction", "resistance", "building"]
    },
    {
        id: "wall-heat-loss",
        name: "Wall / Building Assembly Heat Loss",
        shortDescription: "Estimate signed steady-state heat loss or gain through an assembly.",
        description: "Estimate signed steady-state heat loss or gain through an assembly.",
        category: "Thermal / HVAC",
        path: "calculators/wall-heat-loss.html",
        related: ["multilayer-insulation"],
        keywords: ["wall", "building", "heat", "loss", "gain", "HVAC", "transmittance", "energy"]
    },
    {
        id: "wall-mounting",
        name: "Wall Mounting & Anchor Load Assessment",
        shortDescription: "Estimate fastener demand for centered static loads and supported bearing arrangements.",
        description: "Estimate fastener demand for centered static loads and supported bearing arrangements.",
        category: "Practical Engineering",
        path: "calculators/wall-mounting.html",
        related: ["moment", "thread-strength"],
        keywords: ["wall", "shelf", "anchor", "drywall", "stud", "picture", "fastener", "eccentric"]
    },
    {
        id: "ohms-law",
        name: "Ohm’s Law & Electrical Power",
        shortDescription: "Solve voltage, current, resistance, and power from a selected pair.",
        description: "Solve voltage, current, resistance, and power from a selected pair.",
        category: "Electrical Engineering",
        path: "calculators/ohms-law.html",
        related: ["circuit-studio", "electrical-divider", "ac-power-factor"],
        keywords: ["ohm", "resistor", "voltage", "current", "watt", "passive sign"]
    },
    {
        id: "circuit-studio",
        name: "Series & Parallel Circuit Studio",
        shortDescription: "Edit a resistor network and see its schematic, quantities, and conservation checks update live.",
        description: "Edit a resistor network and see its schematic, quantities, and conservation checks update live.",
        category: "Electrical Engineering",
        path: "calculators/circuit-studio.html",
        related: ["ohms-law", "kirchhoff-circuit", "electrical-divider", "speaker-impedance"],
        keywords: ["resistors", "series", "parallel", "equivalent resistance", "short circuit", "open circuit"]
    },
    {
        id: "kirchhoff-circuit",
        name: "Kirchhoff’s Laws & DC Circuit Analysis",
        shortDescription: "Find node voltages and signed branch currents in a two-loop DC circuit.",
        description: "Find node voltages and signed branch currents in a two-loop DC circuit.",
        category: "Electrical Engineering",
        path: "calculators/kirchhoff-circuit.html",
        related: ["circuit-studio", "electrical-divider", "ohms-law"],
        keywords: ["kcl", "kvl", "nodal", "mesh", "two loop", "node potential"]
    },
    {
        id: "electrical-divider",
        name: "Voltage & Current Divider",
        shortDescription: "Analyze unloaded, loaded, and tapped voltage dividers or a parallel current divider.",
        description: "Analyze unloaded, loaded, and tapped voltage dividers or a parallel current divider.",
        category: "Electrical Engineering",
        path: "calculators/electrical-divider.html",
        related: ["circuit-studio", "kirchhoff-circuit", "dc-wire-voltage-drop"],
        keywords: ["voltage divider", "current divider", "tap", "loading error", "branch current"]
    },
    {
        id: "dc-wire-voltage-drop",
        name: "DC Wire Voltage Drop",
        shortDescription: "Estimate round-trip conductor loss and terminal voltage for a low-voltage DC run.",
        description: "Estimate round-trip conductor loss and terminal voltage for a low-voltage DC run.",
        category: "Electrical Engineering",
        path: "calculators/dc-wire-voltage-drop.html",
        related: ["ohms-law", "electrical-divider"],
        keywords: ["awg", "wire gauge", "copper", "aluminum", "resistivity", "round trip"]
    },
    {
        id: "rc-transients",
        name: "RC Circuit Transients",
        shortDescription: "Explore capacitor charge, discharge, and stored energy after a DC source step.",
        description: "Explore capacitor charge, discharge, and stored energy after a DC source step.",
        category: "Electrical Engineering",
        path: "calculators/rc-transients.html",
        related: ["rl-transients", "rlc-impedance", "circuit-studio"],
        keywords: ["capacitor", "exponential", "charging", "discharge", "time constant", "settling"]
    },
    {
        id: "rl-transients",
        name: "RL Circuit Transients",
        shortDescription: "Plot current buildup or decay and inductor voltage after a DC source step.",
        description: "Plot current buildup or decay and inductor voltage after a DC source step.",
        category: "Electrical Engineering",
        path: "calculators/rl-transients.html",
        related: ["rc-transients", "rlc-impedance", "circuit-studio"],
        keywords: ["inductor", "coil", "magnetic energy", "time constant", "decay", "settling"]
    },
    {
        id: "rlc-impedance",
        name: "Series RLC Impedance & Resonance",
        shortDescription: "Calculate complex impedance, phase, resonance, and RMS response versus frequency.",
        description: "Calculate complex impedance, phase, resonance, and RMS response versus frequency.",
        category: "Electrical Engineering",
        path: "calculators/rlc-impedance.html",
        related: ["ac-power-factor", "rc-transients", "rl-transients", "speaker-impedance"],
        keywords: ["phasor", "reactance", "rms", "frequency response", "quality factor", "resonant frequency"]
    },
    {
        id: "ac-power-factor",
        name: "AC Power & Power Factor",
        shortDescription: "Calculate real, reactive, and apparent power and see the signed power triangle.",
        description: "Calculate real, reactive, and apparent power and see the signed power triangle.",
        category: "Electrical Engineering",
        path: "calculators/ac-power-factor.html",
        related: ["rlc-impedance", "ohms-law", "speaker-impedance"],
        keywords: ["single phase", "watt", "var", "volt ampere", "rms", "leading", "lagging"]
    },
    {
        id: "speaker-impedance",
        name: "Speaker Impedance & Amplifier Power",
        shortDescription: "Explore nominal series and parallel speaker loads and estimated per-speaker power.",
        description: "Explore nominal series and parallel speaker loads and estimated per-speaker power.",
        category: "Electrical Engineering",
        path: "calculators/speaker-impedance.html",
        related: ["circuit-studio", "ohms-law", "rlc-impedance"],
        keywords: ["audio", "speakers", "amplifier", "impedance", "wiring", "channel load"]
    }
];

function validateCalculatorData(calculatorList) {
    const errors = [];
    const requiredFields = [
        "id",
        "name",
        "shortDescription",
        "description",
        "category",
        "path",
        "related",
        "keywords"
    ];

    if (!Array.isArray(calculatorList)) {
        console.error("Calculator data must be an array.");
        return false;
    }

    const ids = new Set();
    calculatorList.forEach((calculator, index) => {
        if (!calculator || typeof calculator !== "object") {
            errors.push(`Calculator at index ${index} must be an object.`);
            return;
        }

        requiredFields.forEach((field) => {
            const value = calculator[field];
            if (value === undefined || value === null || value === "") {
                errors.push(`Calculator at index ${index} is missing required field "${field}".`);
            }
        });

        if (typeof calculator.id === "string") {
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(calculator.id)) {
                errors.push(`Calculator ID "${calculator.id}" must use lowercase kebab-case.`);
            }
            if (ids.has(calculator.id)) {
                errors.push(`Calculator ID "${calculator.id}" is not unique.`);
            }
            ids.add(calculator.id);
        }

        if (calculator.related !== undefined && !Array.isArray(calculator.related)) {
            errors.push(`Calculator "${calculator.id}" related field must be an array.`);
        }
        if (calculator.keywords !== undefined && !Array.isArray(calculator.keywords)) {
            errors.push(`Calculator "${calculator.id}" keywords field must be an array.`);
        }
        if (calculator.status !== undefined && calculator.status !== "coming-soon") {
            errors.push(`Calculator "${calculator.id}" has an unsupported status.`);
        }
    });

    const knownIds = new Set(calculatorList.filter(Boolean).map((calculator) => calculator.id));
    calculatorList.forEach((calculator) => {
        if (!calculator || !Array.isArray(calculator.related)) return;
        calculator.related.forEach((relatedId) => {
            if (!knownIds.has(relatedId)) {
                errors.push(`Calculator "${calculator.id}" references unknown related ID "${relatedId}".`);
            }
        });
    });

    errors.forEach((error) => console.error(error));

    if (typeof window !== "undefined" && window.location.protocol !== "file:" && typeof fetch === "function") {
        calculatorList
            .filter((calculator) => calculator && calculator.status !== "coming-soon" && calculator.path)
            .forEach((calculator) => {
                fetch(calculator.path, { method: "HEAD" }).then((response) => {
                    if (!response.ok) {
                        console.error(`Calculator "${calculator.id}" path does not resolve: ${calculator.path}`);
                    }
                }).catch(() => {
                    console.error(`Calculator "${calculator.id}" path could not be checked: ${calculator.path}`);
                });
            });
    }

    return errors.length === 0;
}
