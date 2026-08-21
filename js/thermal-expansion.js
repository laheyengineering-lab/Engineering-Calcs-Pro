// ======================================================
// Thermal Expansion Calculator
// ======================================================

// Cache DOM elements
const thermalAlphaInput = document.getElementById("alpha");
const thermalOriginalLengthInput = document.getElementById("originalLength");
const thermalTemperatureChangeInput = document.getElementById("temperatureChange");
const thermalYoungsModulusInput = document.getElementById("youngsModulus");
const thermalResultPanel = document.getElementById("result");
const thermalMaterialSelect = document.getElementById("material");
const thermalAlphaUnitSelect = document.getElementById("alphaUnit");
const thermalLengthUnitSelect = document.getElementById("lengthUnit");
const thermalTemperatureUnitSelect = document.getElementById("temperatureUnit");
const thermalModulusUnitSelect = document.getElementById("modulusUnit");
const thermalOutputLengthUnitSelect = document.getElementById("outputLengthUnit");
const thermalStressUnitSelect = document.getElementById("stressUnit");

// Material thermal expansion coefficients (1/°C)
const materialAlphaValues = {
    "carbon-steel": 12.0e-6,
    "stainless-steel": 15.9e-6,
    "aluminum": 23.6e-6,
    "copper": 16.5e-6,
    "brass": 19.0e-6,
    "titanium": 8.6e-6
};

// Update thermal expansion coefficient when material is selected
function updateMaterialAlpha() {
    const material = thermalMaterialSelect.value;
    
    if (material && materialAlphaValues[material]) {
        thermalAlphaInput.value = materialAlphaValues[material];
        thermalAlphaUnitSelect.value = "1/°C";
    }
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

// Convert temperature change
function convertTemperatureChange(value, unit) {
    if (unit === "°F") {
        // Convert Fahrenheit interval to Celsius interval (divide by 1.8)
        return value / 1.8;
    }
    // °C and K intervals are equivalent
    return value;
}

function calculateThermalExpansion() {
    const alpha = Number(thermalAlphaInput.value);
    const originalLength = Number(thermalOriginalLengthInput.value);
    const temperatureChange = Number(thermalTemperatureChangeInput.value);
    const youngsModulus = Number(thermalYoungsModulusInput.value);
    
    const alphaUnit = thermalAlphaUnitSelect.value;
    const lengthUnit = thermalLengthUnitSelect.value;
    const temperatureUnit = thermalTemperatureUnitSelect.value;
    const modulusUnit = thermalModulusUnitSelect.value;
    const outputLengthUnit = thermalOutputLengthUnitSelect.value;
    const stressUnit = thermalStressUnitSelect.value;
    
    // Validate basic inputs
    if (isNaN(alpha) || isNaN(originalLength) || isNaN(temperatureChange) || alpha === 0 || originalLength === 0) {
        thermalResultPanel.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter thermal expansion coefficient, original length, and temperature change.</p>
        `;
        return;
    }
    
    try {
        // Convert inputs to SI base units
        const originalLengthM = convertDistance(originalLength, lengthUnit);
        const deltaTC = convertTemperatureChange(temperatureChange, temperatureUnit);
        
        // Calculate free expansion
        // ΔL = α·L₀·ΔT
        const deltaLM = alpha * originalLengthM * deltaTC;
        
        // Final length
        const finalLengthM = originalLengthM + deltaLM;
        
        // Thermal strain
        // ε = α·ΔT
        const thermalStrain = alpha * deltaTC;
        
        // Convert output lengths
        const deltaLOutput = deltaLM / convertDistance(1, outputLengthUnit);
        const finalLengthOutput = finalLengthM / convertDistance(1, outputLengthUnit);
        
        // Calculate restrained thermal stress (optional)
        let thermalStressPa = null;
        let thermalStressOutput = null;
        
        if (!isNaN(youngsModulus) && youngsModulus !== 0) {
            const modulusPa = convertModulus(youngsModulus, modulusUnit);
            // σ = E·α·ΔT
            thermalStressPa = modulusPa * alpha * deltaTC;
            thermalStressOutput = convertStress(thermalStressPa, stressUnit);
        }
        
        // Build result HTML
        let resultHTML = `
            <h3>Result - Free Thermal Expansion</h3>
            <div class="result-value">
                ΔL = ${deltaLOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${outputLengthUnit}
            </div>
            <hr>
            <p><strong>Calculation Summary</strong></p>
            <p>ΔL = α·L₀·ΔT</p>
            <p>ΔL = ${alpha.toLocaleString(undefined, { maximumFractionDigits: 8 })} /°C × ${originalLength} ${lengthUnit} × ${temperatureChange} ${temperatureUnit}</p>
            <p>ΔL = ${alpha.toLocaleString(undefined, { maximumFractionDigits: 8 })} × ${originalLengthM.toLocaleString(undefined, { maximumFractionDigits: 6 })} m × ${deltaTC.toLocaleString(undefined, { maximumFractionDigits: 2 })} °C</p>
            <p>= <strong>${deltaLOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${outputLengthUnit}</strong></p>
            
            <p style="margin-top: 15px;"><strong>Final Length:</strong></p>
            <p>L<sub>f</sub> = L₀ + ΔL = ${originalLength} ${lengthUnit} + ${deltaLOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${outputLengthUnit}</p>
            <p>= <strong>${finalLengthOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${outputLengthUnit}</strong></p>
            
            <p style="margin-top: 15px;"><strong>Thermal Strain:</strong></p>
            <p>ε<sub>thermal</sub> = α·ΔT = ${alpha.toLocaleString(undefined, { maximumFractionDigits: 8 })} × ${deltaTC.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            <p>= <strong>${thermalStrain.toLocaleString(undefined, { maximumFractionDigits: 8 })}</strong> (dimensionless)</p>
        `;
        
        // Add restrained thermal stress if Young's modulus provided
        if (thermalStressPa !== null) {
            resultHTML += `
                <hr>
                <h3 style="margin-top: 15px; color: #cc0000;">Fully Restrained Thermal Stress</h3>
                <div class="result-value">
                    σ<sub>thermal</sub> = ${thermalStressOutput.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${stressUnit}
                </div>
                <p style="margin-top: 10px;"><strong>Calculation:</strong></p>
                <p>σ<sub>thermal</sub> = E·α·ΔT</p>
                <p>σ<sub>thermal</sub> = ${youngsModulus} ${modulusUnit} × ${alpha.toLocaleString(undefined, { maximumFractionDigits: 8 })} /°C × ${temperatureChange} ${temperatureUnit}</p>
                <p>= <strong>${thermalStressOutput.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${stressUnit}</strong></p>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    <em>This stress develops ONLY if the member is completely fixed and cannot expand.</em>
                </p>
            `;
        }
        
        thermalResultPanel.innerHTML = resultHTML;
        
    } catch (error) {
        thermalResultPanel.innerHTML = `
            <h3>Calculation Error</h3>
            <p>${error.message}</p>
        `;
    }
}

function resetThermalExpansionCalculator() {
    thermalAlphaInput.value = "";
    thermalOriginalLengthInput.value = "";
    thermalTemperatureChangeInput.value = "";
    thermalYoungsModulusInput.value = "";
    
    thermalAlphaUnitSelect.value = "1/°C";
    thermalLengthUnitSelect.value = "m";
    thermalTemperatureUnitSelect.value = "°C";
    thermalModulusUnitSelect.value = "GPa";
    thermalOutputLengthUnitSelect.value = "m";
    thermalStressUnitSelect.value = "MPa";
    thermalMaterialSelect.value = "";
    
    thermalResultPanel.innerHTML = "Ready to calculate.";
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    // Initialization if needed
});
