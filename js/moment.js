// Cache DOM elements
const momentForceInput = document.getElementById("force");
const momentDistanceInput = document.getElementById("distance");
const momentResultPanel = document.getElementById("result");
const momentForceUnitSelect = document.getElementById("forceUnit");
const momentDistanceUnitSelect = document.getElementById("distanceUnit");
const momentOutputUnitSelect = document.getElementById("momentUnit");

function calculateMoment() {
    const force = Number(momentForceInput.value);
    const distance = Number(momentDistanceInput.value);

    if (isNaN(force) || isNaN(distance) || force === 0 || distance === 0) {
        momentResultPanel.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter both a force and a distance.</p>
        `;
        return;
    }

    const forceUnit = momentForceUnitSelect.value;
    const distanceUnit = momentDistanceUnitSelect.value;
    const outputUnit = momentOutputUnitSelect.value;

    const forceN = convertForce(force, forceUnit);
    const distanceM = convertDistance(distance, distanceUnit);
    const momentNm = forceN * distanceM;
    const output = convertMoment(momentNm, outputUnit);

    // Format output once and reuse
    const formattedOutput = output.toLocaleString(undefined, { maximumFractionDigits: 3 });

    momentResultPanel.innerHTML = `
        <h3>Result</h3>
        <div class="result-value">
            ${formattedOutput} ${outputUnit}
        </div>
        <hr>
        <p><strong>Calculation Summary</strong></p>
        <p>${force} ${forceUnit} × ${distance} ${distanceUnit}</p>
        <p>=<strong> ${formattedOutput} ${outputUnit}</strong></p>
    `;
}

function resetToSI() {
    momentForceInput.value = "";
    momentDistanceInput.value = "";
    momentForceUnitSelect.value = "N";
    momentDistanceUnitSelect.value = "m";
    momentOutputUnitSelect.value = "N·m";
    momentResultPanel.innerHTML = "Ready to calculate.";
}