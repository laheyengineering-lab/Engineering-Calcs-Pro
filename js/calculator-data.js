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
