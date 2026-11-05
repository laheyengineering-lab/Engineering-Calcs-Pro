// DOM-independent Euler column buckling engine (SI: m, Pa, N), shared by the calculator page and Design Studies.
const COLUMN_END_CONDITION_FACTORS = {
    "fixed-free": 2.0,
    "pinned-pinned": 1.0,
    "fixed-pinned": 0.699,
    "fixed-fixed": 0.5
};

const COLUMN_BUCKLING_EQUATIONS = [
    String.raw`I_{\mathrm{solid}}=\frac{\pi D^4}{64},\quad I_{\mathrm{hollow}}=\frac{\pi\left(D_o^4-D_i^4\right)}{64}`,
    String.raw`L_e = K L,\quad P_{cr}=\frac{\pi^2 E I}{(K L)^2}`
];

// sectionType: "solid" | "hollow" (innerDiameterM is ignored for solid columns).
function computeColumnBuckling({ sectionType, boundaryCondition, lengthM, outerDiameterM, innerDiameterM = null, youngsModulusPa }) {
    if (!Object.prototype.hasOwnProperty.call(COLUMN_END_CONDITION_FACTORS, boundaryCondition)) {
        throw new Error("Please select a valid boundary condition.");
    }
    if (sectionType !== "solid" && sectionType !== "hollow") throw new Error("Select a solid or hollow circular section.");
    if (!Number.isFinite(lengthM) || !Number.isFinite(outerDiameterM) || lengthM <= 0 || outerDiameterM <= 0) {
        throw new Error("Please enter positive length and outer diameter values.");
    }
    if (!Number.isFinite(youngsModulusPa) || youngsModulusPa <= 0) {
        throw new Error("Young's modulus is unavailable for the selected material.");
    }

    let inertiaM4;
    if (sectionType === "solid") {
        inertiaM4 = (Math.PI * Math.pow(outerDiameterM, 4)) / 64;
    } else {
        if (!Number.isFinite(innerDiameterM) || innerDiameterM <= 0) {
            throw new Error("Please enter a positive inner diameter for hollow sections.");
        }
        if (innerDiameterM >= outerDiameterM) throw new Error("Inner diameter must be less than outer diameter.");
        inertiaM4 = (Math.PI * (Math.pow(outerDiameterM, 4) - Math.pow(innerDiameterM, 4))) / 64;
    }

    const kFactor = COLUMN_END_CONDITION_FACTORS[boundaryCondition];
    const effectiveLengthM = kFactor * lengthM;
    const criticalLoadN = (Math.PI * Math.PI * youngsModulusPa * inertiaM4) / Math.pow(effectiveLengthM, 2);
    if (![inertiaM4, effectiveLengthM, criticalLoadN].every(Number.isFinite)) {
        throw new Error("The result is outside the supported numerical range.");
    }
    return { inertiaM4, kFactor, effectiveLengthM, criticalLoadN };
}
