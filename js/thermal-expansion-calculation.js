// DOM-independent thermal expansion engine (SI: m, 1/°C, °C increment, Pa), shared by the
// calculator page and Design Studies. Free expansion is always computed; the fully restrained
// thermal stress is computed only when a positive Young's modulus is supplied.
const THERMAL_EXPANSION_EQUATIONS = {
    free: [String.raw`\Delta L = \alpha L_0 \Delta T,\quad L_f = L_0 + \Delta L,\quad \varepsilon_{th} = \alpha\Delta T`],
    restrained: [String.raw`\sigma_{th} = E\,\alpha\,\Delta T\;\text{(member fully prevented from expanding)}`]
};

function computeThermalExpansion({ alpha, originalLengthM, deltaTC, modulusPa = null }) {
    if (!Number.isFinite(alpha) || alpha <= 0 || !Number.isFinite(originalLengthM) || originalLengthM <= 0 || !Number.isFinite(deltaTC)) {
        throw new Error("Please enter thermal expansion coefficient, original length, and temperature change.");
    }
    if (modulusPa !== null && (!Number.isFinite(modulusPa) || modulusPa <= 0)) {
        throw new Error("Young's modulus must be positive when restrained thermal stress is evaluated.");
    }
    const deltaLM = alpha * originalLengthM * deltaTC;
    const result = {
        deltaLM,
        finalLengthM: originalLengthM + deltaLM,
        thermalStrain: alpha * deltaTC,
        thermalStressPa: modulusPa === null ? null : modulusPa * alpha * deltaTC
    };
    if (![result.deltaLM, result.finalLengthM, result.thermalStrain].every(Number.isFinite) ||
        (result.thermalStressPa !== null && !Number.isFinite(result.thermalStressPa))) {
        throw new Error("The result is outside the supported numerical range.");
    }
    return result;
}
