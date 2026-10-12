// ======================================================
// Hertzian Contact Stress Calculator
// Parallel cylinders (line contact) and spheres (point contact)
// ======================================================

if (window.FormulaFoundryReport) {
    window.FormulaFoundryReport.declareStructured();
}

const HERTZ_COMMON_EQUATIONS = [
    "\\frac{1}{E^*} = \\frac{1-\\nu_1^2}{E_1} + \\frac{1-\\nu_2^2}{E_2} \\qquad \\frac{1}{R} = \\frac{1}{R_1} \\pm \\frac{1}{R_2}"
];
const HERTZ_CYLINDER_EQUATIONS = HERTZ_COMMON_EQUATIONS.concat([
    "w = \\frac{F}{L} \\qquad b = \\sqrt{\\frac{4\\,w\\,R}{\\pi E^*}} \\qquad p_{max} = \\frac{2w}{\\pi b} = \\sqrt{\\frac{w E^*}{\\pi R}}"
]);
const HERTZ_SPHERE_EQUATIONS = HERTZ_COMMON_EQUATIONS.concat([
    "a = \\left(\\frac{3 F R}{4 E^*}\\right)^{1/3} \\qquad p_{max} = \\frac{3F}{2\\pi a^2} \\qquad \\delta = \\frac{a^2}{R}"
]);

const HERTZ_ASSUMPTIONS = [
    "Linear elastic, isotropic, homogeneous bodies; contact dimensions small compared with the body radii",
    "Frictionless contact surfaces; normal load only (no tangential or rolling traction)",
    "Smooth surfaces; no roughness, coating, residual stress or lubricant film effects",
    "Static load; no dynamic, impact or thermal effects",
    "Cylinders: parallel axes, plane-strain line contact, length L much larger than the contact width and uniform load along L (no edge or crowning effects)",
    "Spheres: point contact between spheres of uniform radius (a flat plate is a sphere of infinite radius)",
    "Maximum contact pressure is not a fatigue, wear, yield or service-life assessment"
];

const HERTZ_SHAPES = { convex: 1, flat: 0, concave: -1 };

function hertzEl(id) {
    return document.getElementById(id);
}

function hertzFmt(value) {
    return Number(value.toPrecision(6)).toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function hertzError(message) {
    hertzEl("result").innerHTML = `
        <h3>Invalid Input</h3>
        <p>${escapeHtml(message)}</p>
    `;
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

// Pure SI math. Lengths in m, force in N, moduli in Pa.
// configuration: "cylinders" | "spheres"; shape2: "convex" | "flat" | "concave"
function computeHertzContact({ configuration, shape2 = "convex", diameter1, diameter2 = null, length = null, force, E1, nu1, E2, nu2 }) {
    if (configuration !== "cylinders" && configuration !== "spheres") throw new Error("Select two cylinders or two spheres.");
    if (!(shape2 in HERTZ_SHAPES)) throw new Error("Unknown body 2 shape.");
    const required = [diameter1, force, E1, nu1, E2, nu2];
    if (shape2 !== "flat") required.push(diameter2);
    if (configuration === "cylinders") required.push(length);
    if (!required.every(Number.isFinite)) throw new Error("Please enter valid numeric values for all required inputs.");
    if (diameter1 <= 0) throw new Error("Body 1 diameter must be greater than zero.");
    if (shape2 !== "flat" && diameter2 <= 0) throw new Error("Body 2 diameter must be greater than zero.");
    if (shape2 === "concave" && diameter2 <= diameter1) throw new Error("A concave (internal) body 2 must have a larger diameter than body 1.");
    if (configuration === "cylinders" && length <= 0) throw new Error("Contact length must be greater than zero.");
    if (force <= 0) throw new Error("Contact force must be greater than zero.");
    if (E1 <= 0 || E2 <= 0) throw new Error("Young's moduli must be greater than zero.");
    if (nu1 < 0 || nu1 >= 0.5 || nu2 < 0 || nu2 >= 0.5) throw new Error("Poisson's ratios must be between 0 and 0.5.");

    const curvature = 2 / diameter1 + (shape2 === "flat" ? 0 : HERTZ_SHAPES[shape2] * 2 / diameter2);
    const effectiveRadius = 1 / curvature;
    const effectiveModulus = 1 / ((1 - nu1 * nu1) / E1 + (1 - nu2 * nu2) / E2);

    if (configuration === "cylinders") {
        const lineLoad = force / length;
        const halfWidth = Math.sqrt(4 * lineLoad * effectiveRadius / (Math.PI * effectiveModulus));
        const maxPressure = 2 * lineLoad / (Math.PI * halfWidth);
        return {
            configuration, effectiveRadius, effectiveModulus, lineLoad, halfWidth,
            contactWidth: 2 * halfWidth, maxPressure, meanPressure: Math.PI / 4 * maxPressure,
            maxShear: 0.30 * maxPressure, maxShearDepth: 0.786 * halfWidth
        };
    }

    const contactRadius = Math.cbrt(3 * force * effectiveRadius / (4 * effectiveModulus));
    const maxPressure = 3 * force / (2 * Math.PI * contactRadius * contactRadius);
    return {
        configuration, effectiveRadius, effectiveModulus, contactRadius,
        maxPressure, meanPressure: 2 / 3 * maxPressure,
        approach: contactRadius * contactRadius / effectiveRadius,
        maxShear: 0.31 * maxPressure, maxShearDepth: 0.48 * contactRadius
    };
}

function updateHertzConfiguration() {
    const spheres = hertzEl("configuration").value === "spheres";
    hertzEl("lengthGroup").hidden = spheres;
    hertzEl("diameterNote").textContent = spheres
        ? "Sphere diameters (a flat plate is entered via the body 2 shape)."
        : "Cylinder diameters (parallel axes).";
}

function updateHertzShape() {
    hertzEl("diameter2Group").hidden = hertzEl("shape2").value === "flat";
}

function applyHertzMaterial(body) {
    const key = hertzEl("material" + body).value;
    if (!key) return;
    hertzEl("modulus" + body).value = getMaterialProperty(key, "youngsModulus") / 1e9;
    hertzEl("modulusUnit" + body).value = "GPa";
    hertzEl("poisson" + body).value = getMaterialProperty(key, "poissonRatio");
}

function calculateHertzContact() {
    const configuration = hertzEl("configuration").value;
    const shape2 = hertzEl("shape2").value;
    const distanceUnit = hertzEl("distanceUnit").value;
    const forceUnit = hertzEl("forceUnit").value;
    const stressUnit = hertzEl("stressUnit").value;
    const contactUnit = hertzEl("contactUnit").value;
    const modulusUnit1 = hertzEl("modulusUnit1").value;
    const modulusUnit2 = hertzEl("modulusUnit2").value;

    const raw = {
        diameter1: readNumberInput("diameter1"),
        diameter2: shape2 === "flat" ? null : readNumberInput("diameter2"),
        length: configuration === "cylinders" ? readNumberInput("contactLength") : null,
        force: readNumberInput("contactForce"),
        E1: readNumberInput("modulus1"), nu1: readNumberInput("poisson1"),
        E2: readNumberInput("modulus2"), nu2: readNumberInput("poisson2")
    };

    let r;
    try {
        r = computeHertzContact({
            configuration, shape2,
            diameter1: convertDistance(raw.diameter1, distanceUnit),
            diameter2: raw.diameter2 === null ? null : convertDistance(raw.diameter2, distanceUnit),
            length: raw.length === null ? null : convertDistance(raw.length, distanceUnit),
            force: convertForce(raw.force, forceUnit),
            E1: convertModulus(raw.E1, modulusUnit1), nu1: raw.nu1,
            E2: convertModulus(raw.E2, modulusUnit2), nu2: raw.nu2
        });
    } catch (error) {
        hertzError(error.message);
        return;
    }

    const s = (pa) => convertStressToUnit(pa, stressUnit);
    const len = (m) => convertDistanceToUnit(m, contactUnit);
    const cyl = configuration === "cylinders";
    const outputs = [
        { label: "Effective elastic modulus (E*)", value: s(r.effectiveModulus), unit: stressUnit },
        { label: "Equivalent radius (R)", value: convertDistanceToUnit(r.effectiveRadius, distanceUnit), unit: distanceUnit }
    ];
    if (cyl) {
        outputs.push({ label: "Line load (w = F/L)", value: convertForceToUnit(r.lineLoad, forceUnit) / convertDistanceToUnit(1, distanceUnit), unit: forceUnit + "/" + distanceUnit });
        outputs.push({ label: "Contact half-width (b)", value: len(r.halfWidth), unit: contactUnit });
        outputs.push({ label: "Contact width (2b)", value: len(r.contactWidth), unit: contactUnit });
    } else {
        outputs.push({ label: "Contact radius (a)", value: len(r.contactRadius), unit: contactUnit });
        outputs.push({ label: "Approach of centres (δ)", value: len(r.approach), unit: contactUnit });
    }
    outputs.push({ label: "Maximum contact pressure (p_max)", value: s(r.maxPressure), unit: stressUnit });
    outputs.push({ label: "Mean contact pressure", value: s(r.meanPressure), unit: stressUnit });
    outputs.push({ label: "Approx. maximum shear stress (ν ≈ 0.3)", value: s(r.maxShear), unit: stressUnit });
    outputs.push({ label: "Depth of maximum shear", value: len(r.maxShearDepth), unit: contactUnit });

    const lines = outputs.map((o) => `<p>${escapeHtml(o.label)}: ${hertzFmt(o.value)} ${escapeHtml(o.unit)}</p>`).join("");
    hertzEl("result").innerHTML = `
        <h3>Result - Hertzian Contact (${cyl ? "Two Cylinders, Line Contact" : "Two Spheres, Point Contact"})</h3>
        <div class="result-value">Maximum contact pressure: ${hertzFmt(s(r.maxPressure))} ${escapeHtml(stressUnit)}</div>
        <div class="result-value">${cyl ? "Contact width 2b" : "Contact radius a"}: ${hertzFmt(len(cyl ? r.contactWidth : r.contactRadius))} ${escapeHtml(contactUnit)}</div>
        <hr>
        ${lines}
        <p><small>Maximum shear values use the ν ≈ 0.3 coefficients of the cited references and are indicative only. Contact pressure alone is not a fatigue, wear, yield or life assessment.</small></p>
    `;

    if (window.FormulaFoundryReport) {
        const shapeLabel = { convex: "Convex body", flat: "Flat plate", concave: "Concave (internal) body" }[shape2];
        const inputs = [
            { label: "Configuration", value: cyl ? "Two cylinders (line contact)" : "Two spheres (point contact)", unit: "" },
            { label: "Body 1 diameter", value: raw.diameter1, unit: distanceUnit },
            { label: "Body 2 shape", value: shapeLabel, unit: "" }
        ];
        if (shape2 !== "flat") inputs.push({ label: "Body 2 diameter", value: raw.diameter2, unit: distanceUnit });
        if (cyl) inputs.push({ label: "Contact length (L)", value: raw.length, unit: distanceUnit });
        inputs.push(
            { label: "Contact force (F)", value: raw.force, unit: forceUnit },
            { label: "Body 1 Young's modulus (E₁)", value: raw.E1, unit: modulusUnit1 },
            { label: "Body 1 Poisson's ratio (ν₁)", value: raw.nu1, unit: "" },
            { label: "Body 2 Young's modulus (E₂)", value: raw.E2, unit: modulusUnit2 },
            { label: "Body 2 Poisson's ratio (ν₂)", value: raw.nu2, unit: "" }
        );
        window.FormulaFoundryReport.recordResult({
            calculatorId: "hertzian-contact",
            calculatorName: "Hertzian Contact Stress",
            path: "calculators/hertzian-contact.html",
            title: cyl ? "Hertzian line contact (cylinders)" : "Hertzian point contact (spheres)",
            inputs, outputs,
            equations: cyl ? HERTZ_CYLINDER_EQUATIONS : HERTZ_SPHERE_EQUATIONS,
            assumptions: HERTZ_ASSUMPTIONS,
            method: cyl
                ? "Hertz line contact of parallel cylinders under plane strain: contact half-width from the equivalent radius and effective modulus, with a semi-elliptical pressure distribution."
                : "Hertz point contact of two spheres: contact radius from the equivalent radius and effective modulus, with a semi-ellipsoidal pressure distribution.",
            warnings: ["Maximum contact pressure is not a fatigue, wear, yielding or service-life assessment.", "Shear-stress values use ν ≈ 0.3 coefficients and are approximate."]
        });
    }
}

function resetHertzCalculator() {
    ["diameter1", "diameter2", "contactLength", "contactForce", "modulus1", "poisson1", "modulus2", "poisson2"].forEach((id) => { hertzEl(id).value = ""; });
    hertzEl("configuration").value = "cylinders";
    hertzEl("shape2").value = "convex";
    ["material1", "material2"].forEach((id) => { hertzEl(id).value = ""; });
    hertzEl("distanceUnit").value = "mm";
    hertzEl("forceUnit").value = "N";
    hertzEl("stressUnit").value = "MPa";
    hertzEl("contactUnit").value = "mm";
    hertzEl("modulusUnit1").value = "GPa";
    hertzEl("modulusUnit2").value = "GPa";
    updateHertzConfiguration();
    updateHertzShape();
    hertzEl("result").innerHTML = "Ready to calculate.";
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

document.addEventListener("DOMContentLoaded", function () {
    ["material1", "material2"].forEach((id) => {
        populateMaterialSelect(hertzEl(id), {
            placeholderText: "-- Custom (enter E and ν below) --",
            formatLabel(material) {
                return `${material.displayName} (E = ${material.youngsModulus / 1e9} GPa, ν = ${material.poissonRatio})`;
            }
        });
    });
    updateHertzConfiguration();
    updateHertzShape();
});
