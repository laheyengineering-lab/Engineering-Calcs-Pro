// ======================================================
// Shaft Torsion Calculator
// ======================================================

window.FormulaFoundryReport?.declareStructured();

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
    window.FormulaFoundryReport?.clearResult();
}

// Update shear modulus when material is selected
function updateMaterialShearModulus() {
    applyMaterialPropertyToInput(torsionMaterialSelect, torsionShearModulusInput, "shearModulus", {
        formatValue: (value) => value / 1e9, unitElement: torsionModulusUnitSelect, unit: "GPa"
    });
}

function calculateShaftTorsion() {
    const report = window.FormulaFoundryReport;
    report?.clearResult();

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
    const isHollow = shaftType === "hollow";
    const innerDiameterText = torsionInnerDiameterInput.value;
    const innerDiameter = isHollow ? Number(innerDiameterText) : null;
    const innerDiameterUnit = torsionInnerDiameterUnitSelect.value;
    
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
    if (isHollow && (!Number.isFinite(innerDiameter) || innerDiameter < 0)) {
        torsionResultPanel.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter a non-negative inner diameter for hollow shafts.</p>
        `;
        return;
    }
    
    try {
        // Convert inputs to SI base units using engineering-units.js
        const torqueNm = convertMoment(torque, torqueUnit); // Convert to N·m
        const outerDiameterM = convertDistance(outerDiameter, diameterUnit);
        const lengthM = convertDistance(length, lengthUnit);
        const modulusPa = convertModulus(shearModulus, modulusUnit); // FIXED: Now uses centralized conversion
        
        const innerDiameterM = isHollow ? convertDistance(innerDiameter, innerDiameterUnit) : null;
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

        // The calculator still treats an empty bore as zero. Require an explicit
        // inner diameter to document a hollow-shaft calculation in the report.
        if (report && (!isHollow || innerDiameterText !== "")) {
            const inputs = [
                { label: "Shaft type", value: shaftType },
                { label: "Applied torque", value: torque, unit: torqueUnit },
                { label: "Outer diameter", value: outerDiameter, unit: diameterUnit }
            ];
            if (isHollow) {
                inputs.push({ label: "Inner diameter", value: innerDiameter, unit: innerDiameterUnit });
            }
            inputs.push(
                { label: "Shaft length", value: length, unit: lengthUnit },
                { label: "Shear modulus (G)", value: shearModulus, unit: modulusUnit }
            );
            const material = getMaterial(torsionMaterialSelect.value);
            if (material) {
                inputs.push({ label: "Selected material", value: material.displayName });
            }

            const diagram = report.currentCalcDiagram();
            report.recordResult({
                calculatorId: "shaft-torsion",
                calculatorName: "Shaft Torsion",
                path: "calculators/shaft-torsion.html",
                inputs,
                outputs: [
                    { label: "Polar moment of inertia (J)", value: J, unit: "m⁴" },
                    { label: "Maximum shear stress (signed)", value: tauMaxOutput, unit: stressUnit },
                    { label: "Angle of twist (signed)", value: thetaRadians, unit: "rad" },
                    { label: "Angle of twist (signed)", value: thetaDegrees, unit: "°" },
                    { label: "Torsional stiffness", value: stiffness, unit: "N·m/rad" }
                ],
                equations: SHAFT_TORSION_EQUATIONS,
                assumptions: [
                    "Uniform solid or concentric hollow circular shaft.",
                    "Linear-elastic material with constant shear modulus and uniform torque along the shaft.",
                    "Small angle of twist and no warping (classical torsion theory)."
                ],
                method: "Maximum shear stress is evaluated at the outer radius. Shear stress and twist follow the sign of the applied torque.",
                ...(diagram ? { diagram } : {})
            });
        }
    } catch (error) {
        const heading = error.message.startsWith("For hollow shaft, inner diameter")
            ? "Invalid Input"
            : "Calculation Error";
        torsionResultPanel.innerHTML = `
            <h3>${heading}</h3>
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
            if (!Number.isFinite(material.shearModulus)) {
                return `${material.displayName} (G unavailable; enter manually)`;
            }
            return `${material.displayName} (${(material.shearModulus / 1e9).toLocaleString(undefined, {
                maximumFractionDigits: 0
            })} GPa)`;
        }
    });
    updateShaftTorsionMode();
});
