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
    if (isNaN(torque) || isNaN(outerDiameter) || isNaN(length) || isNaN(shearModulus) ||
        torque === 0 || outerDiameter === 0 || length === 0 || shearModulus === 0) {
        torsionResultPanel.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter torque, diameter, shaft length, and shear modulus.</p>
        `;
        return;
    }
    
    // For hollow shaft, validate inner diameter
    if (shaftType === "hollow") {
        const innerDiameter = Number(torsionInnerDiameterInput.value);
        if (isNaN(innerDiameter) || innerDiameter === 0 || innerDiameter >= outerDiameter) {
            torsionResultPanel.innerHTML = `
                <h3>Invalid Input</h3>
                <p>For hollow shaft, inner diameter must be > 0 and < outer diameter.</p>
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
        
        // Calculate polar moment of inertia J (m⁴)
        let J;
        const outerRadius = outerDiameterM / 2;
        
        if (shaftType === "solid") {
            // J = π·D⁴/32 for solid shaft
            const D4 = Math.pow(outerDiameterM, 4);
            J = Math.PI * D4 / 32;
        } else {
            // J = π(D_o⁴ - D_i⁴)/32 for hollow shaft
            const innerDiameter = Number(torsionInnerDiameterInput.value);
            const innerDiameterM = convertDistance(innerDiameter, torsionInnerDiameterUnitSelect.value);
            const Do4 = Math.pow(outerDiameterM, 4);
            const Di4 = Math.pow(innerDiameterM, 4);
            J = Math.PI * (Do4 - Di4) / 32;
        }
        
        // Calculate maximum shear stress: τ_max = T·c/J = T·(D/2)/J
        const tauMaxPa = (torqueNm * outerRadius) / J;
        const tauMaxOutput = convertStressToUnit(tauMaxPa, stressUnit);
        
        // Calculate angle of twist: θ = T·L/(G·J) (in radians)
        const thetaRadians = (torqueNm * lengthM) / (modulusPa * J);
        const thetaDegrees = thetaRadians * (180 / Math.PI);
        
        // Torsional stiffness: k = G·J/L
        const stiffness = (modulusPa * J) / lengthM;
        
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
    updateShaftTorsionMode();
});
