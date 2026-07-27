function calculateBoltTorque() {

    const boltDiameter = getBoltDiameterFromSelection();
    const clampLoad = Number(document.getElementById("clampLoad").value);
    const nutFactor = Number(document.getElementById("nutFactor").value);

    const result = document.getElementById("result");

    if (isNaN(boltDiameter) || boltDiameter === 0 || isNaN(clampLoad) || isNaN(nutFactor) || 
        clampLoad === 0 || nutFactor === 0) {

        result.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please select a bolt size, enter clamp load, and verify nut factor.</p>
        `;

        return;
    }

    const unitSystem = document.getElementById("unitSystem").value;
    const loadUnit = document.getElementById("loadUnit").value;
    const outputUnit = document.getElementById("torqueUnit").value;

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

    result.innerHTML = `
        <h3>Result</h3>

        <div class="result-value">
            ${output.toLocaleString(undefined, {
                maximumFractionDigits: 2
            })}
            ${outputUnit}
        </div>

        <hr>

        <p><strong>Calculation Summary</strong></p>

        <p>
            T = K × D × F
        </p>

        <p>
            T = ${nutFactor} × ${boltDiameter} ${diameterUnit} × ${clampLoad} ${loadUnit}
        </p>

        <p>
            T = ${nutFactor} × ${diameterM.toFixed(4)} m × ${loadN.toLocaleString()} N
        </p>

        <p>
            = <strong>${torqueNm.toLocaleString(undefined, {
                maximumFractionDigits: 2
            })} N·m</strong>
        </p>

        <p>
            = <strong>${output.toLocaleString(undefined, {
                maximumFractionDigits: 2
            })} ${outputUnit}</strong>
        </p>
    `;
}

function updateDiameterDisplay() {

    const boltDiameter = getBoltDiameterFromSelection();
    const unitSystem = document.getElementById("unitSystem").value;
    const unitDisplay = unitSystem === "metric" ? "mm" : "in";

    if (boltDiameter) {
        document.getElementById("diameterDisplay").textContent = boltDiameter.toFixed(3);
    } else {
        document.getElementById("diameterDisplay").textContent = "--";
    }

}

function resetTorqueCalculator(){

    document.getElementById("boltSize").value = "";

    document.getElementById("clampLoad").value = "";

    document.getElementById("nutFactor").value = "0.20";

    document.getElementById("diameterDisplay").textContent = "--";

    document.getElementById("result").innerHTML = "Ready to calculate.";

}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    populateBoltSizes();
});
