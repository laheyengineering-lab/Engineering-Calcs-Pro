// ======================================================
// Stress & Strain Calculator
// ======================================================

// Cache DOM elements
const stressStrainForceInput = document.getElementById("force");
const stressStrainAreaInput = document.getElementById("area");
const stressStrainLengthInput = document.getElementById("originalLength");
const stressStrainDeltaLInput = document.getElementById("deltaLength");
const stressStrainYoungsModulusInput = document.getElementById("youngsModulus");
const stressStrainStrainInput = document.getElementById("strain");
const stressStrainResultPanel = document.getElementById("result");
const stressStrainForceUnitSelect = document.getElementById("forceUnit");
const stressStrainAreaUnitSelect = document.getElementById("areaUnit");
const stressStrainLengthUnitSelect = document.getElementById("lengthUnit");
const stressStrainDeltaLengthUnitSelect = document.getElementById("deltaLengthUnit");
const stressStrainModulusUnitSelect = document.getElementById("modulusUnit");
const stressStrainOutputUnitSelect = document.getElementById("outputUnit");
const stressStrainModeSelect = document.getElementById("calculationMode");

// Update visible inputs based on calculation mode
function updateStressStrainMode() {
    const mode = stressStrainModeSelect.value;
    
    // Hide all conditional containers
    document.getElementById("deltaLContainer").style.display = "none";
    document.getElementById("youngsModulusContainer").style.display = "none";
    document.getElementById("strainContainer").style.display = "none";
    
    // Show relevant containers based on mode
    if (mode === "strain") {
        document.getElementById("deltaLContainer").style.display = "block";
    } else if (mode === "youngsModulus") {
        document.getElementById("strainContainer").style.display = "block";
    } else if (mode === "deformation") {
        document.getElementById("youngsModulusContainer").style.display = "block";
    }
    
    stressStrainResultPanel.innerHTML = "Ready to calculate.";
}

// Stress conversion helper
function convertStress(valueInPa, outputUnit) {
    const stressUnits = {
        "Pa": 1,
        "MPa": 1e6,
        "GPa": 1e9,
        "psi": 6894.757,
        "ksi": 6894757
    };
    return valueInPa / stressUnits[outputUnit];
}

// Modulus conversion (stress units)
function convertModulus(valueInPa, outputUnit) {
    return convertStress(valueInPa, outputUnit);
}

// Area conversion helper - SQUARED
function convertArea(value, unit) {
    const areaUnits = {
        "mm²": 1e-6,           // (0.001)^2 = 1e-6 m²
        "cm²": 1e-4,           // (0.01)^2 = 1e-4 m²
        "m²": 1,
        "in²": 6.4516e-4       // (0.0254)^2 = 6.4516e-4 m²
    };
    return value * areaUnits[unit];
}

function calculateStressStrain() {
    const mode = stressStrainModeSelect.value;
    const forceUnit = stressStrainForceUnitSelect.value;
    const areaUnit = stressStrainAreaUnitSelect.value;
    const lengthUnit = stressStrainLengthUnitSelect.value;
    const deltaLengthUnit = stressStrainDeltaLengthUnitSelect.value;
    const modulusUnit = stressStrainModulusUnitSelect.value;
    const outputUnit = stressStrainOutputUnitSelect.value;
    
    let resultHTML = "";
    
    try {
        if (mode === "stress") {
            // σ = F / A
            const force = Number(stressStrainForceInput.value);
            const area = Number(stressStrainAreaInput.value);
            
            if (isNaN(force) || isNaN(area) || force === 0 || area === 0) {
                stressStrainResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter both force and cross-sectional area.</p>
                `;
                return;
            }
            
            const forceN = convertForce(force, forceUnit);
            const areaM2 = convertArea(area, areaUnit);
            const stressPa = forceN / areaM2;
            const stressOutput = convertStress(stressPa, outputUnit);
            
            resultHTML = `
                <h3>Result</h3>
                <div class="result-value">
                    ${stressOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${outputUnit}
                </div>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p>σ = F / A</p>
                <p>σ = ${force} ${forceUnit} / ${area} ${areaUnit}</p>
                <p>σ = ${forceN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N / ${areaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })} m²</p>
                <p>= <strong>${stressOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${outputUnit}</strong></p>
            `;
            
        } else if (mode === "strain") {
            // ε = ΔL / L₀
            const deltaL = Number(stressStrainDeltaLInput.value);
            const originalLength = Number(stressStrainLengthInput.value);
            
            if (isNaN(deltaL) || isNaN(originalLength) || originalLength === 0) {
                stressStrainResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter change in length and original length.</p>
                `;
                return;
            }
            
            const deltaLM = convertDistance(deltaL, deltaLengthUnit);
            const originalLengthM = convertDistance(originalLength, lengthUnit);
            const strain = deltaLM / originalLengthM;
            
            resultHTML = `
                <h3>Result</h3>
                <div class="result-value">
                    ${strain.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </div>
                <p style="color: #666; font-size: 14px;">(dimensionless)</p>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p>ε = ΔL / L₀</p>
                <p>ε = ${deltaL} ${deltaLengthUnit} / ${originalLength} ${lengthUnit}</p>
                <p>ε = ${deltaLM.toLocaleString(undefined, { maximumFractionDigits: 6 })} m / ${originalLengthM.toLocaleString(undefined, { maximumFractionDigits: 6 })} m</p>
                <p>= <strong>${strain.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong></p>
            `;
            
        } else if (mode === "youngsModulus") {
            // E = σ / ε
            const force = Number(stressStrainForceInput.value);
            const area = Number(stressStrainAreaInput.value);
            const strainValue = Number(stressStrainStrainInput.value);
            
            if (isNaN(force) || isNaN(area) || isNaN(strainValue) || force === 0 || area === 0 || strainValue === 0) {
                stressStrainResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter force, area, and strain.</p>
                `;
                return;
            }
            
            const forceN = convertForce(force, forceUnit);
            const areaM2 = convertArea(area, areaUnit);
            const stressPa = forceN / areaM2;
            const modulusPa = stressPa / strainValue;
            const modulusOutput = convertModulus(modulusPa, outputUnit);
            
            resultHTML = `
                <h3>Result</h3>
                <div class="result-value">
                    ${modulusOutput.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${outputUnit}
                </div>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p>E = σ / ε</p>
                <p>σ = ${force} ${forceUnit} / ${area} ${areaUnit} = ${(forceN / areaM2).toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa</p>
                <p>E = ${(forceN / areaM2).toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa / ${strainValue}</p>
                <p>= <strong>${modulusOutput.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${outputUnit}</strong></p>
            `;
            
        } else if (mode === "deformation") {
            // ΔL = (F·L₀) / (A·E)
            const force = Number(stressStrainForceInput.value);
            const area = Number(stressStrainAreaInput.value);
            const originalLength = Number(stressStrainLengthInput.value);
            const youngsModulus = Number(stressStrainYoungsModulusInput.value);
            
            if (isNaN(force) || isNaN(area) || isNaN(originalLength) || isNaN(youngsModulus) ||
                force === 0 || area === 0 || originalLength === 0 || youngsModulus === 0) {
                stressStrainResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter force, area, original length, and Young's modulus.</p>
                `;
                return;
            }
            
            const forceN = convertForce(force, forceUnit);
            const areaM2 = convertArea(area, areaUnit);
            const originalLengthM = convertDistance(originalLength, lengthUnit);
            const modolusPa = convertModulus(youngsModulus, modulusUnit);
            
            const deltaLM = (forceN * originalLengthM) / (areaM2 * modolusPa);
            const deltaLmm = deltaLM * 1000; // Convert to mm for display
            
            resultHTML = `
                <h3>Result</h3>
                <div class="result-value">
                    ${deltaLM.toLocaleString(undefined, { maximumFractionDigits: 6 })} m
                </div>
                <p style="color: #666; font-size: 14px;">(${deltaLmm.toLocaleString(undefined, { maximumFractionDigits: 3 })} mm)</p>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p>ΔL = (F·L₀) / (A·E)</p>
                <p>ΔL = (${force} ${forceUnit} · ${originalLength} ${lengthUnit}) / (${area} ${areaUnit} · ${youngsModulus} ${modulusUnit})</p>
                <p>ΔL = (${forceN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N · ${originalLengthM.toLocaleString(undefined, { maximumFractionDigits: 6 })} m) / (${areaM2.toLocaleString(undefined, { maximumFractionDigits: 6 })} m² · ${modolusPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa)</p>
                <p>= <strong>${deltaLM.toLocaleString(undefined, { maximumFractionDigits: 6 })} m (${deltaLmm.toLocaleString(undefined, { maximumFractionDigits: 3 })} mm)</strong></p>
            `;
        }
        
        stressStrainResultPanel.innerHTML = resultHTML;
        
    } catch (error) {
        stressStrainResultPanel.innerHTML = `
            <h3>Calculation Error</h3>
            <p>${error.message}</p>
        `;
    }
}

function resetStressStrainCalculator() {
    stressStrainForceInput.value = "";
    stressStrainAreaInput.value = "";
    stressStrainLengthInput.value = "";
    stressStrainDeltaLInput.value = "";
    stressStrainYoungsModulusInput.value = "";
    stressStrainStrainInput.value = "";
    
    stressStrainForceUnitSelect.value = "N";
    stressStrainAreaUnitSelect.value = "mm²";
    stressStrainLengthUnitSelect.value = "m";
    stressStrainDeltaLengthUnitSelect.value = "m";
    stressStrainModulusUnitSelect.value = "MPa";
    stressStrainOutputUnitSelect.value = "MPa";
    stressStrainModeSelect.value = "stress";
    
    updateStressStrainMode();
    stressStrainResultPanel.innerHTML = "Ready to calculate.";
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    updateStressStrainMode();
});
