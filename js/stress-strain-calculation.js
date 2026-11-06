// DOM-independent axial stress/strain engine (SI: N, m², m, Pa), shared by the calculator page and Design Studies.
// Each mode solves one relation; the quantities are different and must not be mixed.
const STRESS_STRAIN_MODES = ["stress", "strain", "youngsModulus", "deformation"];

const STRESS_STRAIN_EQUATIONS = {
    stress: [String.raw`\sigma = \frac{F}{A}`],
    strain: [String.raw`\varepsilon = \frac{\Delta L}{L_0}`],
    youngsModulus: [String.raw`\sigma = \frac{F}{A},\quad E = \frac{\sigma}{\varepsilon}`],
    deformation: [String.raw`\Delta L = \frac{F\,L_0}{A\,E}`]
};

function computeStressStrain({ mode, forceN, areaM2, originalLengthM, deltaLengthM, strain, modulusPa }) {
    const bad = (message) => { throw new Error(message); };
    const forceOk = Number.isFinite(forceN) && forceN !== 0;
    const areaOk = Number.isFinite(areaM2) && areaM2 > 0;
    const lengthOk = Number.isFinite(originalLengthM) && originalLengthM > 0;
    let result;

    if (mode === "stress") {
        if (!forceOk || !areaOk) bad("Please enter both force and cross-sectional area.");
        result = { stressPa: forceN / areaM2 };
    } else if (mode === "strain") {
        if (!Number.isFinite(deltaLengthM) || !lengthOk) bad("Please enter change in length and original length.");
        result = { strain: deltaLengthM / originalLengthM };
    } else if (mode === "youngsModulus") {
        if (!forceOk || !areaOk || !Number.isFinite(strain) || strain === 0) bad("Please enter force, area, and strain.");
        const stressPa = forceN / areaM2;
        result = { stressPa, modulusPa: stressPa / strain };
    } else if (mode === "deformation") {
        if (!forceOk || !areaOk || !lengthOk || !Number.isFinite(modulusPa) || modulusPa <= 0) {
            bad("Please enter force, area, original length, and Young's modulus.");
        }
        result = { deltaLengthM: (forceN * originalLengthM) / (areaM2 * modulusPa) };
    } else {
        bad("Select a supported calculation mode.");
    }
    if (!Object.values(result).every(Number.isFinite)) bad("The result is outside the supported numerical range.");
    return result;
}
