// ======================================================
// Press Fit / Interference Fit Calculator
// Elastic Lamé thick-cylinder theory (hub + shaft)
// ======================================================

const pressFitIds = [
    "interfaceDiameter", "diametralInterference", "hubOuterDiameter",
    "shaftBoreDiameter", "engagementLength", "frictionCoefficient"
];

function pressFitEl(id) {
    return document.getElementById(id);
}

function pressFitFmt(value, digits = 3) {
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function pressFitError(message) {
    pressFitEl("result").innerHTML = `
        <h3>Invalid Input</h3>
        <p>${escapeHtml(message)}</p>
    `;
}

// Reads a required positive/non-negative number from an input; returns null if invalid
function readPressFitNumber(id) {
    const raw = pressFitEl(id).value;
    if (raw === null || String(raw).trim() === "") {
        return NaN;
    }
    return Number(raw);
}

function getPressFitMaterial(materialKey, label) {
    if (!materialKey || !getMaterial(materialKey)) {
        throw new Error(`Please select a valid ${label} material.`);
    }

    const youngsModulus = getMaterialProperty(materialKey, "youngsModulus");
    const poissonRatio = getMaterialProperty(materialKey, "poissonRatio");
    const yieldStrength = getMaterialProperty(materialKey, "yieldStrength");

    if (!Number.isFinite(youngsModulus) || youngsModulus <= 0) {
        throw new Error(`The ${label} material is missing a valid Young's modulus.`);
    }
    if (!Number.isFinite(poissonRatio) || poissonRatio <= 0 || poissonRatio >= 0.5) {
        throw new Error(`The ${label} material is missing a valid Poisson's ratio (expected 0 < ν < 0.5).`);
    }

    return {
        E: youngsModulus,
        nu: poissonRatio,
        Sy: Number.isFinite(yieldStrength) && yieldStrength > 0 ? yieldStrength : null
    };
}

// Pure SI engineering math (all lengths in m, stresses/moduli in Pa)
function computePressFit({ d, deltaDiametral, D, di, L, mu, hub, shaft }) {
    const c = d / 2;
    const b = D / 2;
    const a = di / 2;
    const deltaR = deltaDiametral / 2;

    // Lamé geometry factors
    const hubFactor = (b * b + c * c) / (b * b - c * c);
    const shaftFactor = (c * c + a * a) / (c * c - a * a);

    // δr = u_h + u_s, solved for p
    const hubCompliance = (hubFactor + hub.nu) / hub.E;
    const shaftCompliance = (shaftFactor - shaft.nu) / shaft.E;
    const p = deltaR / (c * (hubCompliance + shaftCompliance));

    const hubHoop = p * hubFactor;
    const shaftHoop = -p * shaftFactor;

    const pressForce = mu * p * Math.PI * d * L;
    const torqueCapacity = mu * p * Math.PI * d * d * L / 2;

    const fosHub = hub.Sy ? hub.Sy / hubHoop : null;
    const fosShaft = shaft.Sy ? shaft.Sy / Math.abs(shaftHoop) : null;
    const fosValues = [fosHub, fosShaft].filter((value) => value !== null);
    const fosControlling = fosValues.length ? Math.min(...fosValues) : null;

    return { p, hubHoop, shaftHoop, pressForce, torqueCapacity, fosHub, fosShaft, fosControlling };
}

function interpretPressFit(fos) {
    if (fos === null) {
        return "No yield-strength screening was possible because yield strength data was unavailable.";
    }
    if (fos < 1) {
        return "The elastic hoop stress exceeds yield for at least one member. Plastic deformation is likely; reduce the interference or revise the geometry/material.";
    }
    if (fos < 1.5) {
        return "The elastic stress screening margin is low. Check tolerance stack-up, stress concentrations and combined stresses before proceeding.";
    }
    return "The elastic hoop-stress screening margin is reasonable for a preliminary check. Verify tolerances, friction and fit standards for the real design.";
}

function calculatePressFit() {
    const values = {};
    pressFitIds.forEach((id) => { values[id] = readPressFitNumber(id); });

    const distanceUnit = pressFitEl("distanceUnit").value;
    const interferenceUnit = pressFitEl("interferenceUnit").value;
    const stressUnit = pressFitEl("stressUnit").value;
    const forceUnit = pressFitEl("forceUnit").value;
    const torqueUnit = pressFitEl("torqueUnit").value;

    if (!pressFitIds.every((id) => Number.isFinite(values[id]))) {
        pressFitError("Please enter valid numeric values for all geometry and friction inputs.");
        return;
    }
    if (values.interfaceDiameter <= 0) {
        pressFitError("Interface diameter must be greater than zero.");
        return;
    }
    if (values.diametralInterference <= 0) {
        pressFitError("Diametral interference must be greater than zero.");
        return;
    }
    if (values.hubOuterDiameter <= values.interfaceDiameter) {
        pressFitError("Hub outer diameter must be greater than the interface diameter.");
        return;
    }
    if (values.shaftBoreDiameter < 0) {
        pressFitError("Shaft bore diameter cannot be negative (use 0 for a solid shaft).");
        return;
    }
    if (values.shaftBoreDiameter >= values.interfaceDiameter) {
        pressFitError("Shaft bore diameter must be less than the interface diameter.");
        return;
    }
    if (values.engagementLength <= 0) {
        pressFitError("Engagement length must be greater than zero.");
        return;
    }
    if (values.frictionCoefficient <= 0) {
        pressFitError("Friction coefficient must be greater than zero.");
        return;
    }

    try {
        const hub = getPressFitMaterial(pressFitEl("hubMaterial").value, "hub");
        const shaft = getPressFitMaterial(pressFitEl("shaftMaterial").value, "shaft");

        const results = computePressFit({
            d: convertDistance(values.interfaceDiameter, distanceUnit),
            deltaDiametral: convertDistance(values.diametralInterference, interferenceUnit),
            D: convertDistance(values.hubOuterDiameter, distanceUnit),
            di: convertDistance(values.shaftBoreDiameter, distanceUnit),
            L: convertDistance(values.engagementLength, distanceUnit),
            mu: values.frictionCoefficient,
            hub,
            shaft
        });

        const numeric = [results.p, results.hubHoop, results.shaftHoop, results.pressForce, results.torqueCapacity];
        if (!numeric.every(Number.isFinite) || results.p <= 0) {
            throw new Error("The calculation produced a non-finite or non-physical result. Check the inputs.");
        }

        const pOut = convertStressToUnit(results.p, stressUnit);
        const hubOut = convertStressToUnit(results.hubHoop, stressUnit);
        const shaftOut = convertStressToUnit(results.shaftHoop, stressUnit);
        const forceOut = convertForceToUnit(results.pressForce, forceUnit);
        const torqueOut = convertMomentToUnit(results.torqueCapacity, torqueUnit);

        let fosHtml = "";
        if (results.fosControlling !== null) {
            fosHtml = `
            <p><strong>Elastic/yield stress screening factor of safety</strong></p>
            ${results.fosHub !== null ? `<p>Hub: ${pressFitFmt(results.fosHub, 2)}</p>` : ""}
            ${results.fosShaft !== null ? `<p>Shaft: ${pressFitFmt(results.fosShaft, 2)}</p>` : ""}
            <p>Controlling (lowest): <strong>${pressFitFmt(results.fosControlling, 2)}</strong></p>
            <p><em>Interface hoop stress vs. yield only; not a complete press-fit design-code safety factor.</em></p>`;
        }

        pressFitEl("result").innerHTML = `
            <h3>Result</h3>
            <div class="result-value">
                Contact Pressure: ${pressFitFmt(pOut)} ${escapeHtml(stressUnit)}
            </div>
            <hr>
            <p><strong>Hub bore hoop stress (tensile):</strong> ${pressFitFmt(hubOut)} ${escapeHtml(stressUnit)}</p>
            <p><strong>Shaft outer-surface hoop stress (compressive):</strong> ${pressFitFmt(shaftOut)} ${escapeHtml(stressUnit)}</p>
            <p><strong>Assembly Force:</strong> ${pressFitFmt(forceOut)} ${escapeHtml(forceUnit)}</p>
            <p><strong>Torque Capacity:</strong> ${pressFitFmt(torqueOut)} ${escapeHtml(torqueUnit)}</p>
            ${fosHtml}
            <hr>
            <p><strong>Interpretation:</strong> ${escapeHtml(interpretPressFit(results.fosControlling))}</p>
            <p><em>Friction results are idealized and use the assumed friction coefficient μ = ${escapeHtml(values.frictionCoefficient)}.</em></p>
        `;
    } catch (error) {
        pressFitEl("result").innerHTML = `
            <h3>Calculation Error</h3>
            <p>${escapeHtml(error.message)}</p>
        `;
    }
}

function resetPressFitCalculator() {
    pressFitIds.forEach((id) => { pressFitEl(id).value = ""; });
    pressFitEl("frictionCoefficient").value = "0.12";
    pressFitEl("distanceUnit").value = "mm";
    pressFitEl("interferenceUnit").value = "mm";
    pressFitEl("stressUnit").value = "MPa";
    pressFitEl("forceUnit").value = "kN";
    pressFitEl("torqueUnit").value = "N·m";
    pressFitEl("hubMaterial").value = "";
    pressFitEl("shaftMaterial").value = "";
    pressFitEl("result").innerHTML = "Ready to calculate.";
}

document.addEventListener("DOMContentLoaded", function () {
    ["hubMaterial", "shaftMaterial"].forEach((id) => {
        const select = pressFitEl(id);
        select.innerHTML = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Select Material --";
        select.appendChild(placeholder);
        getMaterialListFormatted().forEach((material) => {
            const option = document.createElement("option");
            option.value = material.key;
            option.textContent = material.displayName;
            select.appendChild(option);
        });
    });
});
