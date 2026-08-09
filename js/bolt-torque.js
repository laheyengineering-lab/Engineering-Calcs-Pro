// Cache DOM elements for repeated access
const boltSizeSelect = document.getElementById("boltSize");
const clampLoadInput = document.getElementById("clampLoad");
const nutFactorInput = document.getElementById("nutFactor");
const resultPanel = document.getElementById("result");
const unitSystemSelect = document.getElementById("unitSystem");
const loadUnitSelect = document.getElementById("loadUnit");
const torqueUnitSelect = document.getElementById("torqueUnit");
const diameterDisplay = document.getElementById("diameterDisplay");
const diameterUnitDisplay = document.getElementById("diameterUnitDisplay");

function calculateBoltTorque() {
    const boltDiameter = getBoltDiameterFromSelection();
    const clampLoad = Number(clampLoadInput.value);
    const nutFactor = Number(nutFactorInput.value);

    if (isNaN(boltDiameter) || boltDiameter === 0 || isNaN(clampLoad) || isNaN(nutFactor) ||
        clampLoad === 0 || nutFactor === 0) {

        resultPanel.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please select a bolt size, enter clamp load, and verify nut factor.</p>
        `;
        return;
    }

    const unitSystem = unitSystemSelect.value;
    const loadUnit = loadUnitSelect.value;
    const outputUnit = torqueUnitSelect.value;

    // Determine diameter unit based on system
    const diameterUnit = unitSystem === "metric" ? "mm" : "in";

    // Convert to base units (meters and Newtons)
    const diameterM = convertDistance(boltDiameter, diameterUnit);
    const loadN = convertForce(clampLoad, loadUnit);

    // Calculate torque in N·m
    // T = K × D × F
    const torqueNm = nutFactor * diameterM * loadN;

    // Convert to output unit
    const output = convertMoment(torqueNm, outputUnit);

    // Format values once, reuse them
    const formattedOutput = output.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const formattedTorqueNm = torqueNm.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const formattedDiameterM = diameterM.toFixed(4);
    const formattedLoadN = loadN.toLocaleString();

    resultPanel.innerHTML = `
        <h3>Result</h3>
        <div class="result-value">
            ${formattedOutput} ${outputUnit}
        </div>
        <hr>
        <p><strong>Calculation Summary</strong></p>
        <p>T = K × D × F</p>
        <p>T = ${nutFactor} × ${boltDiameter} ${diameterUnit} × ${clampLoad} ${loadUnit}</p>
        <p>T = ${nutFactor} × ${formattedDiameterM} m × ${formattedLoadN} N</p>
        <p>= <strong>${formattedTorqueNm} N·m</strong></p>
        <p>= <strong>${formattedOutput} ${outputUnit}</strong></p>
    `;
}

function updateDiameterDisplay() {
    const boltDiameter = getBoltDiameterFromSelection();
    const unitSystem = unitSystemSelect.value;

    if (boltDiameter) {
        diameterDisplay.textContent = boltDiameter.toFixed(3);
    } else {
        diameterDisplay.textContent = "--";
    }
}

function resetTorqueCalculator() {
    boltSizeSelect.value = "";
    clampLoadInput.value = "";
    nutFactorInput.value = "0.20";
    diameterDisplay.textContent = "--";
    resultPanel.innerHTML = "Ready to calculate.";
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    populateBoltSizes();
});