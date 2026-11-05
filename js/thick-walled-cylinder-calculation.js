// DOM-independent Lamé thick-walled cylinder engine (SI: m, Pa), shared by the calculator page and Design Studies.
// Sign convention: tension positive, compression negative.

const THICK_CYLINDER_POINTS = 10; // equal radial intervals -> 11 stations

const THICK_CYLINDER_EQUATIONS = [
    "\\sigma_r(r) = \\frac{a^2 p_i - b^2 p_o}{b^2 - a^2} - \\frac{a^2 b^2\\,(p_i - p_o)}{\\left(b^2 - a^2\\right) r^2}",
    "\\sigma_\\theta(r) = \\frac{a^2 p_i - b^2 p_o}{b^2 - a^2} + \\frac{a^2 b^2\\,(p_i - p_o)}{\\left(b^2 - a^2\\right) r^2}",
    "\\sigma_z = \\frac{a^2 p_i - b^2 p_o}{b^2 - a^2} \\;\\text{(closed ends)} \\qquad \\sigma_z = 0 \\;\\text{(open / free ends)}"
];

const THICK_CYLINDER_ASSUMPTIONS = [
    "Linear elastic, isotropic, homogeneous material; small strains",
    "Long cylinder of uniform circular cross-section, concentric bore and outer surface",
    "Uniform internal pressure p_i and external pressure p_o (gauge); no thermal or body-force loading",
    "Sign convention: tension positive, compression negative; the radial stress equals -p at a pressurized surface",
    "Axial stress is uniform and follows the selected end condition (closed-ended or open/free-ended); constrained ends (plane strain) are not modeled",
    "Away from end closures, flanges, holes and other discontinuities; stress concentrations are not included"
];

// Pure SI math: radii in m, pressures in Pa. endCondition: "closed" | "open".
function computeThickCylinder({ innerRadius, outerRadius, internalPressure, externalPressure, endCondition = "closed", points = THICK_CYLINDER_POINTS }) {
    const values = [innerRadius, outerRadius, internalPressure, externalPressure];
    if (!values.every(Number.isFinite)) throw new Error("All dimensions and pressures must be valid finite numbers.");
    if (innerRadius <= 0) throw new Error("Inner diameter must be greater than zero.");
    if (outerRadius <= innerRadius) throw new Error("Outer diameter must be greater than the inner diameter.");
    if (internalPressure < 0 || externalPressure < 0) throw new Error("Pressures must be zero or positive (gauge).");
    if (endCondition !== "closed" && endCondition !== "open") throw new Error("Unknown end condition.");

    const a = innerRadius;
    const b = outerRadius;
    const denominator = b * b - a * a;
    const constantA = (a * a * internalPressure - b * b * externalPressure) / denominator;
    const constantB = a * a * b * b * (internalPressure - externalPressure) / denominator;
    const axial = endCondition === "closed" ? constantA : 0;

    function stressAt(r) {
        return { r, radial: constantA - constantB / (r * r), hoop: constantA + constantB / (r * r), axial };
    }

    const stations = [];
    for (let i = 0; i <= points; i += 1) {
        stations.push(stressAt(a + (b - a) * i / points));
    }
    const inner = stations[0];
    const outer = stations[points];
    const mid = stressAt((a + b) / 2);
    const governing = Math.abs(inner.hoop) >= Math.abs(outer.hoop) ? inner : outer;

    return { constantA, constantB, axial, inner, mid, outer, stations, stressAt, governing, governingLocation: governing === inner ? "inner surface" : "outer surface" };
}
