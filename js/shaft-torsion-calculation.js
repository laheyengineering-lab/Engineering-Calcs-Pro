const SHAFT_TORSION_EQUATIONS = [
    String.raw`J_{\mathrm{solid}}=\frac{\pi D^4}{32},\quad J_{\mathrm{hollow}}=\frac{\pi(D_o^4-D_i^4)}{32}`,
    String.raw`\tau_{\max}=\frac{Tc}{J},\quad \theta=\frac{TL}{GJ},\quad k=\frac{GJ}{L}`
];

// The stress calculation does not require a modulus or transmission length.
function computeShaftTorsionalStress({ shaftType, torqueNm, outerDiameterM, innerDiameterM = null }) {
    if (shaftType !== "solid" && shaftType !== "hollow") throw new Error("Select a solid or hollow circular shaft.");
    if (![torqueNm, outerDiameterM].every(Number.isFinite) || outerDiameterM <= 0) {
        throw new Error("Please enter finite torque and positive outer diameter.");
    }

    const outerRadius = outerDiameterM / 2;
    let J;
    if (shaftType === "solid") {
        J = Math.PI * Math.pow(outerDiameterM, 4) / 32;
    } else {
        if (!Number.isFinite(innerDiameterM) || innerDiameterM < 0) {
            throw new Error("Please enter a non-negative inner diameter for hollow shafts.");
        }
        if (innerDiameterM >= outerDiameterM) {
            throw new Error("For hollow shaft, inner diameter must be less than outer diameter.");
        }
        J = Math.PI * (Math.pow(outerDiameterM, 4) - Math.pow(innerDiameterM, 4)) / 32;
    }
    const tauMaxPa = (torqueNm * outerRadius) / J;
    if (!(J > 0) || ![J, tauMaxPa].every(Number.isFinite)) {
        throw new Error("The result is outside the supported numerical range.");
    }
    return { J, tauMaxPa };
}

function computeShaftTorsion({ shaftType, torqueNm, outerDiameterM, innerDiameterM = null, lengthM, modulusPa }) {
    if (shaftType !== "solid" && shaftType !== "hollow") throw new Error("Select a solid or hollow circular shaft.");
    if (![torqueNm, outerDiameterM, lengthM, modulusPa].every(Number.isFinite)
        || torqueNm === 0 || outerDiameterM <= 0 || lengthM <= 0 || modulusPa <= 0) {
        throw new Error("Please enter torque, diameter, shaft length, and shear modulus.");
    }

    const { J, tauMaxPa } = computeShaftTorsionalStress({ shaftType, torqueNm, outerDiameterM, innerDiameterM });
    const thetaRadians = (torqueNm * lengthM) / (modulusPa * J);
    const thetaDegrees = thetaRadians * (180 / Math.PI);
    const stiffness = (modulusPa * J) / lengthM;
    if (![J, tauMaxPa, thetaRadians, thetaDegrees, stiffness].every(Number.isFinite)) {
        throw new Error("The result is outside the supported numerical range.");
    }
    return { J, tauMaxPa, thetaRadians, thetaDegrees, stiffness };
}
