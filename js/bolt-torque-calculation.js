// DOM-independent bolt torque engine (SI: m, N, N·m), shared by the calculator page and Design Studies.
const BOLT_TORQUE_EQUATIONS = [
    String.raw`T = K\,D\,F`
];

// Simplified torque-preload relation: the nut factor K lumps thread and bearing-face friction.
function computeBoltTorque({ diameterM, clampLoadN, nutFactor }) {
    if (![diameterM, clampLoadN, nutFactor].every(Number.isFinite) || diameterM <= 0 || clampLoadN <= 0 || nutFactor <= 0) {
        throw new Error("Please select a bolt size, enter clamp load, and verify nut factor.");
    }
    const torqueNm = nutFactor * diameterM * clampLoadN;
    if (!Number.isFinite(torqueNm)) throw new Error("The result is outside the supported numerical range.");
    return { torqueNm };
}
