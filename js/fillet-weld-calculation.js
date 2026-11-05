// DOM-independent AISC 360 Chapter J2 direct-load fillet weld engine (SI: m, Pa, N),
// shared by the calculator page and Design Studies.

// Filler-metal classification strengths F_EXX (ksi), normalized via convertStress()
const filletWeldElectrodes = {
    E60XX: 60,
    E70XX: 70,
    E80XX: 80
};

const FILLET_THROAT_FACTOR = 0.707;
const FILLET_LRFD_PHI = 0.75;
const FILLET_ASD_OMEGA = 2.0;

const FILLET_WELD_EQUATIONS = [
    String.raw`a_e = 0.707\,w,\quad A_w = a_e L`,
    String.raw`F_{nw} = 0.60\,F_{EXX}\left(1 + 0.50\sin^{1.5}\theta\right),\quad R_n = F_{nw}A_w`,
    String.raw`\mathrm{LRFD}:\ \phi R_n\ (\phi = 0.75),\qquad \mathrm{ASD}:\ R_n/\Omega\ (\Omega = 2.00)`
];

// Pure SI engineering math (m, Pa, N)
function computeFilletWeld({ legM, lengthM, FexxPa, angleDeg, method, loadN }) {
    const theta = angleDeg * Math.PI / 180;
    const throatM = FILLET_THROAT_FACTOR * legM;
    const areaM2 = throatM * lengthM;

    // F_nw = 0.60 F_EXX (1 + 0.50 sin^1.5 θ)
    const Fnw = 0.60 * FexxPa * (1 + 0.50 * Math.pow(Math.sin(theta), 1.5));
    const nominalN = Fnw * areaM2;
    const lrfdN = FILLET_LRFD_PHI * nominalN;
    const asdN = nominalN / FILLET_ASD_OMEGA;
    const designN = method === "LRFD" ? lrfdN : asdN;

    const result = { throatM, areaM2, Fnw, nominalN, lrfdN, asdN, designN };

    if (loadN !== null) {
        // w_req solved algebraically from the selected design equation
        result.requiredLegM = method === "LRFD"
            ? loadN / (FILLET_LRFD_PHI * Fnw * FILLET_THROAT_FACTOR * lengthM)
            : (loadN * FILLET_ASD_OMEGA) / (Fnw * FILLET_THROAT_FACTOR * lengthM);
        result.utilization = loadN / designN;
        result.remainingN = designN - loadN;
    }

    return result;
}

// Validating entry point: electrode name instead of F_EXX; load direction 0–90°; optional applied load (null).
function computeFilletWeldChecked({ legM, lengthM, electrode, angleDeg, method, loadN = null }) {
    if (!Number.isFinite(legM) || legM <= 0) throw new Error("Weld leg size must be a number greater than zero.");
    if (!Number.isFinite(lengthM) || lengthM <= 0) throw new Error("Weld length must be a number greater than zero.");
    if (!Object.prototype.hasOwnProperty.call(filletWeldElectrodes, electrode)) {
        throw new Error("Please select a valid electrode classification.");
    }
    if (!Number.isFinite(angleDeg) || angleDeg < 0 || angleDeg > 90) throw new Error("Load direction must be between 0° and 90°.");
    if (method !== "LRFD" && method !== "ASD") throw new Error("Please select LRFD or ASD.");
    if (loadN !== null && (!Number.isFinite(loadN) || loadN < 0)) {
        throw new Error("Applied load must be a number greater than or equal to zero.");
    }

    const FexxPa = convertStress(filletWeldElectrodes[electrode], "ksi");
    const r = computeFilletWeld({ legM, lengthM, FexxPa, angleDeg, method, loadN });
    if (!Number.isFinite(r.designN) || r.designN <= 0) {
        throw new Error("Design capacity is zero or non-finite. Check the inputs.");
    }
    if (loadN !== null && !Number.isFinite(r.requiredLegM)) throw new Error("Required weld size could not be computed.");
    return Object.assign({ FexxPa }, r);
}
