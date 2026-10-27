// ======================================================
// Shaft Torsion Calculator
// ======================================================

// Cache DOM elements
const torsionTorqueInput = document.getElementById("torque");
const torsionOuterDiameterInput = document.getElementById("outerDiameter");
const torsionInnerDiameterInput = document.getElementById("innerDiameter");
const torsionLengthInput = document.getElementById("length");
const torsionShearModulusInput = document.getElementById("shearModulus");
const torsionResultPanel = document.getElementById("result");
const torsionShaftTypeSelect = document.getElementById("shaftType");
const torsionTorqueUnitSelect = document.getElementById("torqueUnit");
const torsionDiameterUnitSelect = document.getElementById("diameterUnit");
const torsionInnerDiameterUnitSelect = document.getElementById("innerDiameterUnit");
const torsionLengthUnitSelect = document.getElementById("lengthUnit");
const torsionModulusUnitSelect = document.getElementById("modulusUnit");
const torsionStressUnitSelect = document.getElementById("stressUnit");
const torsionMaterialSelect = document.getElementById("material");

// Update visible inputs based on shaft type
function updateShaftTorsionMode() {
    const shaftType = torsionShaftTypeSelect.value;
    const innerDiameterContainer = document.getElementById("innerDiameterContainer");
    
    if (shaftType === "hollow") {
        innerDiameterContainer.style.display = "block";
    } else {
        innerDiameterContainer.style.display = "none";
    }
    
    torsionResultPanel.innerHTML = "Ready to calculate.";
}

// Update shear modulus when material is selected
function updateMaterialShearModulus() {
    const material = torsionMaterialSelect.value;
    
    if (material) {
        const shearModulusValue = getMaterialProperty(material, "shearModulus");
        if (shearModulusValue !== null) {
            // Convert from SI (Pa) to GPa for display
            const shearModulusGPa = shearModulusValue / 1e9;
            torsionShearModulusInput.value = shearModulusGPa;
            torsionModulusUnitSelect.value = "GPa";
        }
    }
}

function computeShaftTorsion({ shaftType, torqueNm, outerDiameterM, innerDiameterM = null, lengthM, modulusPa }) {
    if (shaftType !== "solid" && shaftType !== "hollow") throw new Error("Select a solid or hollow circular shaft.");
    if (![torqueNm, outerDiameterM, lengthM, modulusPa].every(Number.isFinite)
        || torqueNm === 0 || outerDiameterM <= 0 || lengthM <= 0 || modulusPa <= 0) {
        throw new Error("Please enter torque, diameter, shaft length, and shear modulus.");
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
    const thetaRadians = (torqueNm * lengthM) / (modulusPa * J);
    const thetaDegrees = thetaRadians * (180 / Math.PI);
    const stiffness = (modulusPa * J) / lengthM;
    if (![J, tauMaxPa, thetaRadians, thetaDegrees, stiffness].every(Number.isFinite)) {
        throw new Error("The result is outside the supported numerical range.");
    }
    return { J, tauMaxPa, thetaRadians, thetaDegrees, stiffness };
}

function calculateShaftTorsion() {
    const shaftType = torsionShaftTypeSelect.value;
    const torque = Number(torsionTorqueInput.value);
    const outerDiameter = Number(torsionOuterDiameterInput.value);
    const length = Number(torsionLengthInput.value);
    const shearModulus = Number(torsionShearModulusInput.value);
    
    const torqueUnit = torsionTorqueUnitSelect.value;
    const diameterUnit = torsionDiameterUnitSelect.value;
    const lengthUnit = torsionLengthUnitSelect.value;
    const modulusUnit = torsionModulusUnitSelect.value;
    const stressUnit = torsionStressUnitSelect.value;
    
    // Validate basic inputs
    if (!Number.isFinite(torque) || torque === 0 || !Number.isFinite(outerDiameter) || outerDiameter <= 0 ||
        !Number.isFinite(length) || length <= 0 || !Number.isFinite(shearModulus) || shearModulus <= 0) {
        torsionResultPanel.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter torque, diameter, shaft length, and shear modulus.</p>
        `;
        return;
    }
    
    // For hollow shaft, validate inner diameter
    if (shaftType === "hollow") {
        const innerDiameter = Number(torsionInnerDiameterInput.value);
        if (!Number.isFinite(innerDiameter) || innerDiameter < 0) {
            torsionResultPanel.innerHTML = `
                <h3>Invalid Input</h3>
                <p>Please enter a non-negative inner diameter for hollow shafts.</p>
            `;
            return;
        }
    }
    
    try {
        // Convert inputs to SI base units using engineering-units.js
        const torqueNm = convertMoment(torque, torqueUnit); // Convert to N·m
        const outerDiameterM = convertDistance(outerDiameter, diameterUnit);
        const lengthM = convertDistance(length, lengthUnit);
        const modulusPa = convertModulus(shearModulus, modulusUnit); // FIXED: Now uses centralized conversion
        
        const innerDiameterM = shaftType === "hollow"
            ? convertDistance(Number(torsionInnerDiameterInput.value), torsionInnerDiameterUnitSelect.value)
            : null;
        const result = computeShaftTorsion({ shaftType, torqueNm, outerDiameterM, innerDiameterM, lengthM, modulusPa });
        const { J, tauMaxPa, thetaRadians, thetaDegrees, stiffness } = result;
        const outerRadius = outerDiameterM / 2;
        const tauMaxOutput = convertStressToUnit(tauMaxPa, stressUnit);
        
        // Format output
        const resultHTML = `
            <h3>Result</h3>
            <div class="result-value">
                τ<sub>max</sub> = ${tauMaxOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${stressUnit}
            </div>
            <hr>
            <p><strong>Calculation Summary</strong></p>
            <p><strong>Polar Moment of Inertia:</strong></p>
            <p>J = ${J.toLocaleString(undefined, { maximumFractionDigits: 8 })} m⁴</p>
            <p><strong>Maximum Shear Stress:</strong></p>
            <p>τ<sub>max</sub> = T·c / J = ${torqueNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N·m × ${outerRadius.toLocaleString(undefined, { maximumFractionDigits: 6 })} m / ${J.toLocaleString(undefined, { maximumFractionDigits: 8 })} m⁴</p>
            <p>= <strong>${tauMaxOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${stressUnit}</strong></p>
            <p><strong>Angle of Twist:</strong></p>
            <p>θ = T·L / (G·J) = ${torqueNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N·m × ${lengthM.toLocaleString(undefined, { maximumFractionDigits: 3 })} m / (${(modulusPa / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })} GPa × ${J.toLocaleString(undefined, { maximumFractionDigits: 8 })} m⁴)</p>
            <p>= <strong>${thetaRadians.toLocaleString(undefined, { maximumFractionDigits: 6 })} rad</strong></p>
            <p>= <strong>${thetaDegrees.toLocaleString(undefined, { maximumFractionDigits: 3 })}°</strong></p>
            <p><strong>Torsional Stiffness:</strong></p>
            <p>k = G·J / L = ${stiffness.toLocaleString(undefined, { maximumFractionDigits: 2 })} N·m/rad</p>
        `;
        
        torsionResultPanel.innerHTML = resultHTML;
        
    } catch (error) {
        torsionResultPanel.innerHTML = `
            <h3>Calculation Error</h3>
            <p>${error.message}</p>
        `;
    }
}

function resetShaftTorsionCalculator() {
    torsionTorqueInput.value = "";
    torsionOuterDiameterInput.value = "";
    torsionInnerDiameterInput.value = "";
    torsionLengthInput.value = "";
    torsionShearModulusInput.value = "";
    
    torsionTorqueUnitSelect.value = "N·m";
    torsionDiameterUnitSelect.value = "m";
    torsionInnerDiameterUnitSelect.value = "m";
    torsionLengthUnitSelect.value = "m";
    torsionModulusUnitSelect.value = "GPa";
    torsionStressUnitSelect.value = "MPa";
    torsionShaftTypeSelect.value = "solid";
    torsionMaterialSelect.value = "";
    
    updateShaftTorsionMode();
    torsionResultPanel.innerHTML = "Ready to calculate.";
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    populateMaterialSelect(torsionMaterialSelect, {
        placeholderText: "-- Select Material or Enter Custom --",
        formatLabel(material) {
            return `${material.displayName} (${(material.shearModulus / 1e9).toLocaleString(undefined, {
                maximumFractionDigits: 0
            })} GPa)`;
        }
    });
    updateShaftTorsionMode();
});
