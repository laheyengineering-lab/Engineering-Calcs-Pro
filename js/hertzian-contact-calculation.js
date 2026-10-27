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
