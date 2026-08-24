// ======================================================
// Factor of Safety Calculator
// ======================================================

const fosModeSelect = document.getElementById("mode");
const fosStrengthSourceSelect = document.getElementById("strengthSource");
const fosMaterialSelect = document.getElementById("material");
const fosStrengthInput = document.getElementById("strength");
const fosStrengthUnitSelect = document.getElementById("strengthUnit");
const fosAppliedStressInput = document.getElementById("appliedStress");
const fosAppliedStressUnitSelect = document.getElementById("appliedStressUnit");
const fosFailureLoadInput = document.getElementById("failureLoad");
const fosFailureLoadUnitSelect = document.getElementById("failureLoadUnit");
const fosAppliedLoadInput = document.getElementById("appliedLoad");
const fosAppliedLoadUnitSelect = document.getElementById("appliedLoadUnit");
const fosResultPanel = document.getElementById("result");

function populateFoSMaterials() {
    const materials = getMaterialListFormatted();
    fosMaterialSelect.innerHTML = '<option value="">-- Select Material --</option>';

    materials.forEach((material) => {
        const option = document.createElement("option");
        option.value = material.key;
        option.textContent = material.displayName;
        fosMaterialSelect.appendChild(option);
    });
}

function updateFactorOfSafetyMode() {
    const mode = fosModeSelect.value;
    const strengthSource = fosStrengthSourceSelect.value;

    document.getElementById("stressBasedInputs").style.display = mode === "stress" ? "block" : "none";
    document.getElementById("loadBasedInputs").style.display = mode === "load" ? "block" : "none";
    document.getElementById("strengthSourceContainer").style.display = mode === "stress" ? "block" : "none";

    const useMaterial = mode === "stress" && (strengthSource === "material-yield" || strengthSource === "material-tensile");
    document.getElementById("materialContainer").style.display = useMaterial ? "block" : "none";

    if (!useMaterial) {
        fosStrengthInput.readOnly = false;
    }

    fosResultPanel.innerHTML = "Ready to calculate.";
}

function updateMaterialStrength() {
    const material = fosMaterialSelect.value;
    const strengthSource = fosStrengthSourceSelect.value;

    if (!material || (strengthSource !== "material-yield" && strengthSource !== "material-tensile")) {
        return;
    }

    const propertyName = strengthSource === "material-yield" ? "yieldStrength" : "tensileStrength";
    const strengthPa = getMaterialProperty(material, propertyName);

    if (!Number.isFinite(strengthPa) || strengthPa <= 0) {
        fosResultPanel.innerHTML = "<h3>Material Data Missing</h3><p>The selected material does not include that strength property. Use direct entry.</p>";
        fosStrengthInput.readOnly = false;
        return;
    }

    const displayStrength = convertStressToUnit(strengthPa, fosStrengthUnitSelect.value);
    fosStrengthInput.value = displayStrength.toFixed(3);
    fosStrengthInput.readOnly = true;
}

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

function calculateFactorOfSafety() {
    const mode = fosModeSelect.value;

    try {
        if (mode === "stress") {
            const strengthValue = Number(fosStrengthInput.value);
            const appliedStressValue = Number(fosAppliedStressInput.value);

            if (!Number.isFinite(strengthValue) || !Number.isFinite(appliedStressValue) || strengthValue <= 0 || appliedStressValue <= 0) {
                fosResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter positive strength and applied stress values.</p>";
                return;
            }

            const strengthPa = convertStress(strengthValue, fosStrengthUnitSelect.value);
            const appliedStressPa = convertStress(appliedStressValue, fosAppliedStressUnitSelect.value);
            const fosValue = strengthPa / appliedStressPa;

            const interpretation = getFoSInterpretation(fosValue);
            const strengthDisplay = convertStressToUnit(strengthPa, fosStrengthUnitSelect.value);
            const appliedDisplay = convertStressToUnit(appliedStressPa, fosAppliedStressUnitSelect.value);

            fosResultPanel.innerHTML = `
                <h3>Result</h3>
                <div class="result-value">FoS = ${fosValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                <hr>
                <p><strong>Capacity/Strength:</strong> ${strengthDisplay.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${fosStrengthUnitSelect.value}</p>
                <p><strong>Applied Stress:</strong> ${appliedDisplay.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${fosAppliedStressUnitSelect.value}</p>
                <p><strong>Interpretation:</strong> ${interpretation}</p>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p>FoS = Strength / Applied Stress</p>
                <p>FoS = ${strengthPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa / ${appliedStressPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa</p>
                <p>= <strong>${fosValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong></p>
            `;
            return;
        }

        const failureLoadValue = Number(fosFailureLoadInput.value);
        const appliedLoadValue = Number(fosAppliedLoadInput.value);

        if (!Number.isFinite(failureLoadValue) || !Number.isFinite(appliedLoadValue) || failureLoadValue <= 0 || appliedLoadValue <= 0) {
            fosResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter positive failure and applied load values.</p>";
            return;
        }

        const failureLoadN = convertForce(failureLoadValue, fosFailureLoadUnitSelect.value);
        const appliedLoadN = convertForce(appliedLoadValue, fosAppliedLoadUnitSelect.value);
        const fosValue = failureLoadN / appliedLoadN;

        const interpretation = getFoSInterpretation(fosValue);
        const failureDisplay = convertForceToUnit(failureLoadN, fosFailureLoadUnitSelect.value);
        const appliedDisplay = convertForceToUnit(appliedLoadN, fosAppliedLoadUnitSelect.value);

        fosResultPanel.innerHTML = `
            <h3>Result</h3>
            <div class="result-value">FoS = ${fosValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
            <hr>
            <p><strong>Capacity/Failure Load:</strong> ${failureDisplay.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${fosFailureLoadUnitSelect.value}</p>
            <p><strong>Applied Load:</strong> ${appliedDisplay.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${fosAppliedLoadUnitSelect.value}</p>
            <p><strong>Interpretation:</strong> ${interpretation}</p>
            <hr>
            <p><strong>Calculation Summary</strong></p>
            <p>FoS = Failure Load / Applied Load</p>
            <p>FoS = ${failureLoadN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N / ${appliedLoadN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N</p>
            <p>= <strong>${fosValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong></p>
        `;
    } catch (error) {
        fosResultPanel.innerHTML = `<h3>Calculation Error</h3><p>${error.message}</p>`;
    }
}

function resetFactorOfSafetyCalculator() {
    fosModeSelect.value = "stress";
    fosStrengthSourceSelect.value = "direct";
    fosMaterialSelect.value = "";
    fosStrengthInput.value = "";
    fosAppliedStressInput.value = "";
    fosFailureLoadInput.value = "";
    fosAppliedLoadInput.value = "";

    fosStrengthUnitSelect.value = "MPa";
    fosAppliedStressUnitSelect.value = "MPa";
    fosFailureLoadUnitSelect.value = "kN";
    fosAppliedLoadUnitSelect.value = "kN";

    fosStrengthInput.readOnly = false;
    updateFactorOfSafetyMode();
    fosResultPanel.innerHTML = "Ready to calculate.";
}

document.addEventListener("DOMContentLoaded", function() {
    populateFoSMaterials();
    updateFactorOfSafetyMode();
});
