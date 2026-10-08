// ======================================================
// Fillet Weld Strength Calculator
// AISC 360 Chapter J2 direct-load fillet weld model
// ======================================================

// Filler-metal classification strengths F_EXX (ksi), normalized via convertStress()
const filletWeldElectrodes = {
    E60XX: 60,
    E70XX: 70,
    E80XX: 80
};

const FILLET_THROAT_FACTOR = 0.707;
const FILLET_LRFD_PHI = 0.75;
const FILLET_ASD_OMEGA = 2.0;

function weldEl(id) {
    return document.getElementById(id);
}

function weldFmt(value, digits = 3) {
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function weldError(message) {
    weldEl("result").innerHTML = `
        <h3>Invalid Input</h3>
        <p>${escapeHtml(message)}</p>
    `;
}

function readWeldNumber(id) {
    const raw = weldEl(id).value;
    if (raw === null || String(raw).trim() === "") {
        return NaN;
    }
    return Number(raw);
}

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

function calculateFilletWeld() {
    const leg = readWeldNumber("weldLeg");
    const length = readWeldNumber("weldLength");
    const legUnit = weldEl("weldLegUnit").value;
    const lengthUnit = weldEl("weldLengthUnit").value;
    const electrode = weldEl("electrode").value;
    const angleDeg = Number(weldEl("loadDirection").value);
    const method = weldEl("designMethod").value;
    const forceUnit = weldEl("forceUnit").value;
    const loadRaw = String(weldEl("appliedLoad").value).trim();
    const hasLoad = loadRaw !== "";
    const load = hasLoad ? Number(loadRaw) : null;

    if (!Number.isFinite(leg) || leg <= 0) {
        weldError("Weld leg size must be a number greater than zero.");
        return;
    }
    if (!Number.isFinite(length) || length <= 0) {
        weldError("Weld length must be a number greater than zero.");
        return;
    }
    if (!(electrode in filletWeldElectrodes)) {
        weldError("Please select a valid electrode classification.");
        return;
    }
    if (weldEl("loadDirection").value === "" || !Number.isFinite(angleDeg) || angleDeg < 0 || angleDeg > 90) {
        weldError("Load direction must be between 0° and 90°.");
        return;
    }
    if (method !== "LRFD" && method !== "ASD") {
        weldError("Please select LRFD or ASD.");
        return;
    }
    if (hasLoad && (!Number.isFinite(load) || load < 0)) {
        weldError("Applied load must be a number greater than or equal to zero.");
        return;
    }

    try {
        const legM = convertDistance(leg, legUnit);
        const lengthM = convertDistance(length, lengthUnit);
        const FexxPa = convertStress(filletWeldElectrodes[electrode], "ksi");
        const loadN = hasLoad ? convertForce(load, forceUnit) : null;

        const r = computeFilletWeld({ legM, lengthM, FexxPa, angleDeg, method, loadN });

        if (!Number.isFinite(r.designN) || r.designN <= 0) {
            throw new Error("Design capacity is zero or non-finite. Check the inputs.");
        }
        if (hasLoad && !Number.isFinite(r.requiredLegM)) {
            throw new Error("Required weld size could not be computed.");
        }

        const areaUnit = { mm: "mm²", cm: "cm²", in: "in²" }[lengthUnit];
        const legOut = (m) => convertDistanceToUnit(m, legUnit);
        const f = (n) => weldFmt(convertForceToUnit(n, forceUnit), 3);
        const methodLabel = method === "LRFD" ? "LRFD Design Strength (φRn)" : "ASD Allowable Strength (Rn/Ω)";

        let loadHtml = "";
        if (hasLoad) {
            const pass = r.utilization <= 1;
            loadHtml = `
            <hr>
            <p><strong>Applied Load:</strong> ${f(loadN)} ${escapeHtml(forceUnit)}</p>
            <p><strong>Required Weld Leg Size:</strong> ${weldFmt(legOut(r.requiredLegM), 5)} ${escapeHtml(legUnit)}</p>
            <p><strong>Utilization:</strong> ${weldFmt(r.utilization, 3)}</p>
            <p><strong>Remaining Capacity:</strong> ${f(r.remainingN)} ${escapeHtml(forceUnit)}</p>
            <p><strong>Status: ${pass ? "PASS" : "REVIEW / INADEQUATE"}</strong> (weld-metal check only)</p>`;
        } else {
            loadHtml = `<hr><p>Enter an applied load to calculate the required weld leg size and utilization.</p>`;
        }

        weldEl("result").innerHTML = `
            <h3>Result</h3>
            <div class="result-value">
                Design Capacity: ${f(r.designN)} ${escapeHtml(forceUnit)}
            </div>
            <p>(${escapeHtml(methodLabel)})</p>
            <hr>
            <p><strong>Effective Throat:</strong> ${weldFmt(legOut(r.throatM), 5)} ${escapeHtml(legUnit)}</p>
            <p><strong>Effective Weld Area:</strong> ${weldFmt(convertAreaToUnit(r.areaM2, areaUnit), 4)} ${areaUnit}</p>
            <p><strong>Nominal Weld Capacity (Rn):</strong> ${f(r.nominalN)} ${escapeHtml(forceUnit)}</p>
            <p><strong>LRFD φRn (φ = 0.75):</strong> ${f(r.lrfdN)} ${escapeHtml(forceUnit)}</p>
            <p><strong>ASD Rn/Ω (Ω = 2.00):</strong> ${f(r.asdN)} ${escapeHtml(forceUnit)}</p>
            <p><strong>Nominal Weld Stress (Fnw):</strong> ${weldFmt(convertStressToUnit(r.Fnw, "MPa"), 1)} MPa</p>
            ${loadHtml}
            <hr>
            <p><em>This is a simplified weld-metal calculation, not a code-compliant connection approval. A weld that passes may still fail another applicable connection or base-metal check.</em></p>
        `;
    } catch (error) {
        weldEl("result").innerHTML = `
            <h3>Calculation Error</h3>
            <p>${escapeHtml(error.message)}</p>
        `;
    }
}

function resetFilletWeldCalculator() {
    ["weldLeg", "weldLength", "appliedLoad"].forEach((id) => { weldEl(id).value = ""; });
    weldEl("weldLegUnit").value = "in";
    weldEl("weldLengthUnit").value = "in";
    weldEl("electrode").value = "E70XX";
    weldEl("loadDirection").value = "0";
    weldEl("designMethod").value = "LRFD";
    weldEl("forceUnit").value = "kN";
    weldEl("result").innerHTML = "Ready to calculate.";
}
