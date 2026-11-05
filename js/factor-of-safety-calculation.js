// DOM-independent factor-of-safety engine, shared by the calculator page and Design Studies.
// Stress-based: FoS = strength / applied stress.  Load-based: FoS = failure load / applied load.
const FACTOR_OF_SAFETY_EQUATIONS = {
    stress: [String.raw`\mathrm{FoS}_{\sigma}=\frac{\text{strength}}{\text{applied stress}}`],
    load: [String.raw`\mathrm{FoS}_{F}=\frac{\text{failure load}}{\text{applied load}}`]
};

function getFoSInterpretation(fosValue) {
    const tolerance = 1e-9;

    if (fosValue > 1 + tolerance) {
        return "FoS > 1: The specified applied condition is below the specified strength/failure value.";
    }

    if (Math.abs(fosValue - 1) <= tolerance) {
        return "FoS = 1: The specified applied condition equals the specified strength/failure value.";
    }

    return "FoS < 1: The specified applied condition exceeds the specified strength/failure value.";
}

// mode "stress": strengthPa and appliedStressPa; mode "load": failureLoadN and appliedLoadN (SI).
function computeFactorOfSafety({ mode, strengthPa, appliedStressPa, failureLoadN, appliedLoadN }) {
    let capacity;
    let demand;
    if (mode === "stress") {
        capacity = strengthPa;
        demand = appliedStressPa;
        if (![capacity, demand].every(Number.isFinite) || capacity <= 0 || demand <= 0) {
            throw new Error("Please enter positive strength and applied stress values.");
        }
    } else if (mode === "load") {
        capacity = failureLoadN;
        demand = appliedLoadN;
        if (![capacity, demand].every(Number.isFinite) || capacity <= 0 || demand <= 0) {
            throw new Error("Please enter positive failure and applied load values.");
        }
    } else {
        throw new Error("Select a stress-based or load-based factor of safety.");
    }
    const factorOfSafety = capacity / demand;
    if (!Number.isFinite(factorOfSafety)) throw new Error("The result is outside the supported numerical range.");
    return { mode, factorOfSafety, interpretation: getFoSInterpretation(factorOfSafety) };
}
