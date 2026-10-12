// ======================================================
// Hydraulic / Pneumatic Cylinder Force Calculator
// Theoretical force of a double-acting single-rod cylinder
// ======================================================

if (window.FormulaFoundryReport) {
    window.FormulaFoundryReport.declareStructured();
}

const CYLINDER_FORCE_EQUATIONS = [
    "A_p = \\frac{\\pi D^2}{4} \\qquad A_r = \\frac{\\pi d^2}{4} \\qquad A_a = A_p - A_r",
    "F_{ext} = p\\,A_p \\qquad F_{ret} = p\\,A_a",
    "F_{usable} = \\eta\\,F_{theoretical}"
];

const CYLINDER_FORCE_ASSUMPTIONS = [
    "Pressure p is the net gauge pressure acting on the pressurized side; the opposite side is assumed to be at zero gauge pressure (no back pressure)",
    "Static, theoretical force: no seal friction, pressure losses, acceleration or side-load effects",
    "Extension pressurizes the full piston area; retraction pressurizes the rod-side annular area",
    "Any efficiency is a user-supplied estimate, not a calculated or guaranteed value"
];

function cylinderForceEl(id) {
    return document.getElementById(id);
}

function cylinderForceFmt(value) {
    return Number(value.toPrecision(6)).toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function cylinderForceError(message) {
    cylinderForceEl("result").innerHTML = `
        <h3>Invalid Input</h3>
        <p>${escapeHtml(message)}</p>
    `;
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

// Pure SI math: bore, rod in m, pressure in Pa, efficiency as fraction (or null).
function computeCylinderForce({ bore, rod, pressure, efficiency = null }) {
    if (![bore, rod, pressure].every(Number.isFinite)) throw new Error("Bore diameter, rod diameter and pressure must be valid numbers.");
    if (bore <= 0) throw new Error("Bore diameter must be greater than zero.");
    if (rod < 0) throw new Error("Rod diameter cannot be negative.");
    if (rod >= bore) throw new Error("Rod diameter must be smaller than the bore diameter.");
    if (pressure <= 0) throw new Error("Working pressure must be greater than zero.");
    if (efficiency !== null && (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1)) {
        throw new Error("Efficiency must be greater than 0 % and no more than 100 %.");
    }

    const pistonArea = Math.PI * bore * bore / 4;
    const rodArea = Math.PI * rod * rod / 4;
    const annularArea = pistonArea - rodArea;
    const extensionForce = pressure * pistonArea;
    const retractionForce = pressure * annularArea;

    return {
        pistonArea, rodArea, annularArea, extensionForce, retractionForce,
        usableExtension: efficiency === null ? null : efficiency * extensionForce,
        usableRetraction: efficiency === null ? null : efficiency * retractionForce
    };
}

function calculateCylinderForce() {
    const boreRaw = readNumberInput("boreDiameter");
    const rodRaw = readNumberInput("rodDiameter");
    const pressureRaw = readNumberInput("workingPressure");
    const efficiencyText = cylinderForceEl("efficiency").value.trim();
    const efficiencyRaw = efficiencyText === "" ? null : Number(efficiencyText);

    const distanceUnit = cylinderForceEl("distanceUnit").value;
    const pressureUnit = cylinderForceEl("pressureUnit").value;
    const forceUnit = cylinderForceEl("forceUnit").value;
    const areaUnit = cylinderForceEl("areaUnit").value;

    let r;
    try {
        r = computeCylinderForce({
            bore: convertDistance(boreRaw, distanceUnit),
            rod: convertDistance(rodRaw, distanceUnit),
            pressure: convertStress(pressureRaw, pressureUnit),
            efficiency: efficiencyRaw === null ? null : efficiencyRaw / 100
        });
    } catch (error) {
        cylinderForceError(error.message);
        return;
    }

    const area = (value) => convertAreaToUnit(value, areaUnit);
    const force = (value) => convertForceToUnit(value, forceUnit);
    const out = {
        pistonArea: area(r.pistonArea), rodArea: area(r.rodArea), annularArea: area(r.annularArea),
        extension: force(r.extensionForce), retraction: force(r.retractionForce)
    };
    const usable = r.usableExtension === null ? null : { extension: force(r.usableExtension), retraction: force(r.usableRetraction) };

    let html = `
        <h3>Result - Theoretical Cylinder Force</h3>
        <div class="result-value">Extension: ${cylinderForceFmt(out.extension)} ${escapeHtml(forceUnit)}</div>
        <div class="result-value">Retraction: ${cylinderForceFmt(out.retraction)} ${escapeHtml(forceUnit)}</div>
        <hr>
        <p><strong>Areas</strong></p>
        <p>Full piston area A<sub>p</sub>: ${cylinderForceFmt(out.pistonArea)} ${escapeHtml(areaUnit)}</p>
        <p>Rod cross-sectional area A<sub>r</sub>: ${cylinderForceFmt(out.rodArea)} ${escapeHtml(areaUnit)}</p>
        <p>Effective annular (rod-side) area A<sub>a</sub>: ${cylinderForceFmt(out.annularArea)} ${escapeHtml(areaUnit)}</p>
        <p><strong>Theoretical force</strong></p>
        <p>Extension force F<sub>ext</sub> = p·A<sub>p</sub>: ${cylinderForceFmt(out.extension)} ${escapeHtml(forceUnit)}</p>
        <p>Retraction force F<sub>ret</sub> = p·A<sub>a</sub>: ${cylinderForceFmt(out.retraction)} ${escapeHtml(forceUnit)}</p>`;
    if (usable) {
        html += `
        <p><strong>Estimated usable force (user-supplied efficiency η = ${cylinderForceFmt(efficiencyRaw)} %)</strong></p>
        <p>Usable extension force: ${cylinderForceFmt(usable.extension)} ${escapeHtml(forceUnit)}</p>
        <p>Usable retraction force: ${cylinderForceFmt(usable.retraction)} ${escapeHtml(forceUnit)}</p>
        <p><small>The efficiency is an assumption you supplied. Actual force depends on the cylinder, seals, pressure losses, friction and system conditions.</small></p>`;
    } else {
        html += `<p><small>Theoretical force only; no efficiency factor was applied. Delivered force will be lower.</small></p>`;
    }
    cylinderForceEl("result").innerHTML = html;

    if (window.FormulaFoundryReport) {
        const inputs = [
            { label: "Bore diameter (D)", value: boreRaw, unit: distanceUnit },
            { label: "Rod diameter (d)", value: rodRaw, unit: distanceUnit },
            { label: "Working pressure (p)", value: pressureRaw, unit: pressureUnit }
        ];
        const outputs = [
            { label: "Full piston area (A_p)", value: out.pistonArea, unit: areaUnit },
            { label: "Rod area (A_r)", value: out.rodArea, unit: areaUnit },
            { label: "Annular area (A_a)", value: out.annularArea, unit: areaUnit },
            { label: "Theoretical extension force", value: out.extension, unit: forceUnit },
            { label: "Theoretical retraction force", value: out.retraction, unit: forceUnit }
        ];
        if (usable) {
            inputs.push({ label: "Assumed efficiency (user supplied)", value: efficiencyRaw, unit: "%" });
            outputs.push({ label: "Estimated usable extension force", value: usable.extension, unit: forceUnit });
            outputs.push({ label: "Estimated usable retraction force", value: usable.retraction, unit: forceUnit });
        }
        window.FormulaFoundryReport.recordResult({
            calculatorId: "cylinder-force",
            calculatorName: "Hydraulic/Pneumatic Cylinder Force",
            path: "calculators/cylinder-force.html",
            title: "Cylinder force, " + cylinderForceFmt(boreRaw) + " " + distanceUnit + " bore",
            inputs, outputs,
            equations: CYLINDER_FORCE_EQUATIONS,
            assumptions: CYLINDER_FORCE_ASSUMPTIONS,
            method: "Force equals net gauge pressure times the pressurized area. Extension acts on the full piston area; retraction acts on the annular area (piston area minus rod area).",
            warnings: ["Theoretical force; not guaranteed delivered force.", "Does not check rod buckling, seal limits, pressure ratings or speed."]
        });
    }
}

function resetCylinderForceCalculator() {
    ["boreDiameter", "rodDiameter", "workingPressure", "efficiency"].forEach((id) => { cylinderForceEl(id).value = ""; });
    cylinderForceEl("distanceUnit").value = "mm";
    cylinderForceEl("pressureUnit").value = "bar";
    cylinderForceEl("forceUnit").value = "kN";
    cylinderForceEl("areaUnit").value = "cm²";
    cylinderForceEl("result").innerHTML = "Ready to calculate.";
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}
