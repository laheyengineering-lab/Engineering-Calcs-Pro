// ======================================================
// Beam Deflection Calculator
// ======================================================

// Cache DOM elements
const beamLengthInput = document.getElementById("beamLength");
const pointLoadInput = document.getElementById("pointLoad");
const distributedLoadInput = document.getElementById("distributedLoad");
const youngsModulusInput = document.getElementById("youngsModulus");
const areamomentinertiaInput = document.getElementById("areamomentinertia");
const beamResultPanel = document.getElementById("result");
const loadingCaseSelect = document.getElementById("loadingCase");
const lengthUnitSelect = document.getElementById("lengthUnit");
const loadUnitSelect = document.getElementById("loadUnit");
const distributedLoadUnitSelect = document.getElementById("distributedLoadUnit");
const modulusUnitSelect = document.getElementById("modulusUnit");
const inertiaUnitSelect = document.getElementById("inertiaUnit");
const deflectionUnitSelect = document.getElementById("deflectionUnit");

// Update visible inputs based on loading case
function updateBeamDeflectionMode() {
    const loadingCase = loadingCaseSelect.value;
    const pointLoadContainer = document.getElementById("pointLoadContainer");
    const distributedLoadContainer = document.getElementById("distributedLoadContainer");
    
    // Hide both containers first
    pointLoadContainer.style.display = "none";
    distributedLoadContainer.style.display = "none";
    
    // Show relevant container based on case
    if (loadingCase === "ss-point" || loadingCase === "cant-point") {
        pointLoadContainer.style.display = "block";
    } else if (loadingCase === "ss-udl" || loadingCase === "cant-udl") {
        distributedLoadContainer.style.display = "block";
    }
    
    beamResultPanel.innerHTML = "Ready to calculate.";
}

function calculateBeamDeflection() {
    const loadingCase = loadingCaseSelect.value;
    const beamLength = Number(beamLengthInput.value);
    const youngsModulus = Number(youngsModulusInput.value);
    const areamomentinertia = Number(areamomentinertiaInput.value);
    
    const lengthUnit = lengthUnitSelect.value;
    const loadUnit = loadUnitSelect.value;
    const distributedLoadUnit = distributedLoadUnitSelect.value;
    const modulusUnit = modulusUnitSelect.value;
    const inertiaUnit = inertiaUnitSelect.value;
    const deflectionUnit = deflectionUnitSelect.value;
    
    // Validate basic inputs
    if (isNaN(beamLength) || isNaN(youngsModulus) || isNaN(areamomentinertia) ||
        beamLength === 0 || youngsModulus === 0 || areamomentinertia === 0) {
        beamResultPanel.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter beam length, Young's modulus, and area moment of inertia.</p>
        `;
        return;
    }
    
    try {
        // Convert inputs to SI base units using engineering-units.js
        const LM = convertDistance(beamLength, lengthUnit);
        const EPa = convertModulus(youngsModulus, modulusUnit); // FIXED: Uses centralized conversion
        const IM4 = convertAreaMomentInertia(areamomentinertia, inertiaUnit);
        const EI = EPa * IM4;
        
        let load = 0;
        let maxDeflectionM = 0;
        let maxMomentNm = 0;
        let deflectionLocationPercent = 0;
        let resultHTML = "";
        
        if (loadingCase === "ss-point") {
            // Simply Supported, Center Point Load
            load = Number(pointLoadInput.value);
            if (isNaN(load) || load === 0) {
                beamResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter a point load.</p>
                `;
                return;
            }
            
            const PN = convertForce(load, loadUnit);
            // δ_max = P·L³ / (48·E·I)
            maxDeflectionM = (PN * Math.pow(LM, 3)) / (48 * EI);
            // M_max = P·L / 4
            maxMomentNm = (PN * LM) / 4;
            deflectionLocationPercent = 50;
            
            const deflectionOutput = convertDistanceToUnit(maxDeflectionM, deflectionUnit);
            
            resultHTML = `
                <h3>Result - Simply Supported + Center Point Load</h3>
                <div class="result-value">
                    δ<sub>max</sub> = ${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}
                </div>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p><strong>Case:</strong> Simply Supported Beam with Center Point Load</p>
                <p>δ<sub>max</sub> = P·L³ / (48·E·I)</p>
                <p>δ<sub>max</sub> = ${PN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N × ${LM}³ m³ / (48 × ${EPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa × ${IM4.toLocaleString(undefined, { maximumFractionDigits: 8 })} m⁴)</p>
                <p>= <strong>${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}</strong></p>
                <p><strong>Maximum Moment:</strong></p>
                <p>M<sub>max</sub> = P·L / 4 = ${maxMomentNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N·m</p>
                <p><strong>Maximum Deflection Location:</strong> Midspan (L/2)</p>
            `;
            
        } else if (loadingCase === "ss-udl") {
            // Simply Supported, Uniform Distributed Load
            load = Number(distributedLoadInput.value);
            if (isNaN(load) || load === 0) {
                beamResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter a distributed load.</p>
                `;
                return;
            }
            
            // Convert N/m format using convertDistributedLoad from engineering-units.js
            const wNm = convertDistributedLoad(load, distributedLoadUnit);
            
            // δ_max = 5·w·L⁴ / (384·E·I)
            maxDeflectionM = (5 * wNm * Math.pow(LM, 4)) / (384 * EI);
            // M_max = w·L² / 8
            maxMomentNm = (wNm * Math.pow(LM, 2)) / 8;
            deflectionLocationPercent = 50;
            
            const deflectionOutput = convertDistanceToUnit(maxDeflectionM, deflectionUnit);
            
            resultHTML = `
                <h3>Result - Simply Supported + Uniform Distributed Load</h3>
                <div class="result-value">
                    δ<sub>max</sub> = ${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}
                </div>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p><strong>Case:</strong> Simply Supported Beam with Uniform Distributed Load</p>
                <p>δ<sub>max</sub> = 5·w·L⁴ / (384·E·I)</p>
                <p>δ<sub>max</sub> = 5 × ${wNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N/m × ${LM}⁴ m⁴ / (384 × ${EPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa × ${IM4.toLocaleString(undefined, { maximumFractionDigits: 8 })} m⁴)</p>
                <p>= <strong>${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}</strong></p>
                <p><strong>Maximum Moment:</strong></p>
                <p>M<sub>max</sub> = w·L² / 8 = ${maxMomentNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N·m</p>
                <p><strong>Maximum Deflection Location:</strong> Midspan (L/2)</p>
            `;
            
        } else if (loadingCase === "cant-point") {
            // Cantilever, Point Load at Free End
            load = Number(pointLoadInput.value);
            if (isNaN(load) || load === 0) {
                beamResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter a point load.</p>
                `;
                return;
            }
            
            const PN = convertForce(load, loadUnit);
            // δ_max = P·L³ / (3·E·I)
            maxDeflectionM = (PN * Math.pow(LM, 3)) / (3 * EI);
            // M_max = P·L (at fixed end)
            maxMomentNm = PN * LM;
            deflectionLocationPercent = 100;
            
            const deflectionOutput = convertDistanceToUnit(maxDeflectionM, deflectionUnit);
            
            resultHTML = `
                <h3>Result - Cantilever + Point Load</h3>
                <div class="result-value">
                    δ<sub>max</sub> = ${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}
                </div>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p><strong>Case:</strong> Cantilever Beam with Point Load at Free End</p>
                <p>δ<sub>max</sub> = P·L³ / (3·E·I)</p>
                <p>δ<sub>max</sub> = ${PN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N × ${LM}³ m³ / (3 × ${EPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa × ${IM4.toLocaleString(undefined, { maximumFractionDigits: 8 })} m⁴)</p>
                <p>= <strong>${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}</strong></p>
                <p><strong>Maximum Moment:</strong></p>
                <p>M<sub>max</sub> = P·L = ${maxMomentNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N·m (at fixed end)</p>
                <p><strong>Maximum Deflection Location:</strong> Free end (100% from fixed end)</p>
            `;
            
        } else if (loadingCase === "cant-udl") {
            // Cantilever, Uniform Distributed Load
            load = Number(distributedLoadInput.value);
            if (isNaN(load) || load === 0) {
                beamResultPanel.innerHTML = `
                    <h3>Invalid Input</h3>
                    <p>Please enter a distributed load.</p>
                `;
                return;
            }
            
            const wNm = convertDistributedLoad(load, distributedLoadUnit);
            
            // δ_max = w·L⁴ / (8·E·I)
            maxDeflectionM = (wNm * Math.pow(LM, 4)) / (8 * EI);
            // M_max = w·L² / 2 (at fixed end)
            maxMomentNm = (wNm * Math.pow(LM, 2)) / 2;
            deflectionLocationPercent = 100;
            
            const deflectionOutput = convertDistanceToUnit(maxDeflectionM, deflectionUnit);
            
            resultHTML = `
                <h3>Result - Cantilever + Uniform Distributed Load</h3>
                <div class="result-value">
                    δ<sub>max</sub> = ${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}
                </div>
                <hr>
                <p><strong>Calculation Summary</strong></p>
                <p><strong>Case:</strong> Cantilever Beam with Uniform Distributed Load</p>
                <p>δ<sub>max</sub> = w·L⁴ / (8·E·I)</p>
                <p>δ<sub>max</sub> = ${wNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N/m × ${LM}⁴ m⁴ / (8 × ${EPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa × ${IM4.toLocaleString(undefined, { maximumFractionDigits: 8 })} m⁴)</p>
                <p>= <strong>${deflectionOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${deflectionUnit}</strong></p>
                <p><strong>Maximum Moment:</strong></p>
                <p>M<sub>max</sub> = w·L² / 2 = ${maxMomentNm.toLocaleString(undefined, { maximumFractionDigits: 2 })} N·m (at fixed end)</p>
                <p><strong>Maximum Deflection Location:</strong> Free end (100% from fixed end)</p>
            `;
        }
        
        beamResultPanel.innerHTML = resultHTML;
        
    } catch (error) {
        beamResultPanel.innerHTML = `
            <h3>Calculation Error</h3>
            <p>${error.message}</p>
        `;
    }
}

function resetBeamDeflectionCalculator() {
    beamLengthInput.value = "";
    pointLoadInput.value = "";
    distributedLoadInput.value = "";
    youngsModulusInput.value = "";
    areamomentinertiaInput.value = "";
    
    lengthUnitSelect.value = "m";
    loadUnitSelect.value = "N";
    distributedLoadUnitSelect.value = "N/m";
    modulusUnitSelect.value = "GPa";
    inertiaUnitSelect.value = "m⁴";
    deflectionUnitSelect.value = "m";
    loadingCaseSelect.value = "ss-point";
    
    updateBeamDeflectionMode();
    beamResultPanel.innerHTML = "Ready to calculate.";
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    updateBeamDeflectionMode();
});
