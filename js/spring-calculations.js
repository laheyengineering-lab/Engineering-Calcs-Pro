function springElement(id) {
    return document.getElementById(id);
}

function springNumber(id) {
    const value = String(springElement(id).value).trim();
    return value === "" ? NaN : Number(value);
}

function springFormat(value, digits = 3) {
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function updateSpringMaterial() {
    const material = springElement("springMaterial").value;
    if (!material) return;

    const modulusPa = getMaterialProperty(material, "shearModulus");
    const unit = springElement("modulusUnit").value;
    if (Number.isFinite(modulusPa) && modulusPa > 0) {
        springElement("shearModulus").value = String(convertModulusToUnit(modulusPa, unit));
    }
}

function springError(message) {
    springElement("result").innerHTML = `<h3>Invalid Input</h3><p>${escapeHtml(message)}</p>`;
}

function calculateSpring() {
    const d = springNumber("wireDiameter");
    const D = springNumber("meanCoilDiameter");
    const activeCoils = springNumber("activeCoils");
    const force = springNumber("appliedForce");
    const modulus = springNumber("shearModulus");
    const distanceUnit = springElement("distanceUnit").value;
    const forceUnit = springElement("forceUnit").value;
    const modulusUnit = springElement("modulusUnit").value;
    const stressUnit = springElement("stressUnit").value;

    if (![d, D, activeCoils, modulus].every(Number.isFinite) ||
        d <= 0 || D <= 0 || activeCoils <= 0 || modulus <= 0) {
        springError("Wire diameter, mean coil diameter, active coils, and shear modulus must be finite values greater than zero.");
        return;
    }
    if (!Number.isFinite(force) || force < 0) {
        springError("Applied axial force must be a finite value greater than or equal to zero.");
        return;
    }

    const dM = convertDistance(d, distanceUnit);
    const DM = convertDistance(D, distanceUnit);
    const forceN = convertForce(force, forceUnit);
    const modulusPa = convertModulus(modulus, modulusUnit);
    if (![dM, DM, forceN, modulusPa].every(Number.isFinite) || DM <= dM) {
        springError("Check the selected units and geometry; mean coil diameter must be greater than wire diameter.");
        return;
    }

    const index = DM / dM;
    if (!Number.isFinite(index) || index <= 1) {
        springError("Spring geometry produces an invalid spring index.");
        return;
    }

    const rateNPerM = modulusPa * Math.pow(dM, 4) /
        (8 * Math.pow(DM, 3) * activeCoils);
    const deflectionM = forceN / rateNPerM;
    const wahlFactor = (4 * index - 1) / (4 * index - 4) + 0.615 / index;
    const shearStressPa = wahlFactor * 8 * forceN * DM / (Math.PI * Math.pow(dM, 3));
    const values = [rateNPerM, deflectionM, wahlFactor, shearStressPa];

    if (!values.every(Number.isFinite) || rateNPerM <= 0 || deflectionM < 0 || shearStressPa < 0) {
        springError("The calculation produced a non-finite result. Check the inputs and units.");
        return;
    }

    const rateOutput = convertForceToUnit(rateNPerM * distanceUnits[distanceUnit], forceUnit);
    const deflectionOutput = convertDistanceToUnit(deflectionM, distanceUnit);
    const stressOutput = convertStressToUnit(shearStressPa, stressUnit);
    const warnings = [];
    if (index < 4 || index > 16) {
        warnings.push("Spring index is outside the typical range of 4–16; review the geometry and applicable design guidance.");
    }

    springElement("result").innerHTML = `
        <h3>Result</h3>
        <div class="result-value">Spring Rate: ${springFormat(rateOutput)} ${escapeHtml(forceUnit)}/${escapeHtml(distanceUnit)}</div>
        <p><strong>Spring Index (C):</strong> ${springFormat(index, 3)}</p>
        <p><strong>Axial Deflection:</strong> ${springFormat(deflectionOutput)} ${escapeHtml(distanceUnit)}</p>
        <p><strong>Wahl Stress-Correction Factor:</strong> ${springFormat(wahlFactor, 4)}</p>
        <p><strong>Corrected Maximum Wire Shear Stress:</strong> ${springFormat(stressOutput, 2)} ${escapeHtml(stressUnit)}</p>
        ${warnings.map((warning) => `<p class="warning"><strong>Geometry warning:</strong> ${escapeHtml(warning)}</p>`).join("")}
        <hr>
        <p><em>Static, elastic round-wire spring estimate only. Coil bind, buckling, fatigue, surge, and material allowable checks are not performed.</em></p>
    `;
}

function resetSpringCalculator() {
    ["wireDiameter", "meanCoilDiameter", "activeCoils", "appliedForce", "shearModulus"].forEach((id) => {
        springElement(id).value = "";
    });
    springElement("springMaterial").value = "";
    springElement("distanceUnit").value = "mm";
    springElement("forceUnit").value = "N";
    springElement("modulusUnit").value = "GPa";
    springElement("stressUnit").value = "MPa";
    springElement("result").textContent = "Ready to calculate.";
}

document.addEventListener("DOMContentLoaded", () => {
    populateMaterialSelect(springElement("springMaterial"), { placeholderText: "-- Manual / select material --" });
    springElement("springMaterial").value = "";
    const modulusUnit = springElement("modulusUnit");
    let previousUnit = modulusUnit.value;
    modulusUnit.addEventListener("change", () => {
        const value = springNumber("shearModulus");
        if (Number.isFinite(value) && value > 0) {
            springElement("shearModulus").value = String(convertModulusToUnit(convertModulus(value, previousUnit), modulusUnit.value));
        }
        previousUnit = modulusUnit.value;
    });
});
