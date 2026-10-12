const pinBearingElement = (id) => document.getElementById(id);

function calculatePinBearingPressure() {
    const raw = ["pinLoad", "pinDiameter", "plateThickness"].map((id) => pinBearingElement(id).value);
    const result = pinBearingElement("result");
    const [load, diameter, thickness] = raw.map(Number);

    if (raw.some((value) => value.trim() === "") ||
        [load, diameter, thickness].some((value) => !Number.isFinite(value) || value <= 0)) {
        result.innerHTML = "<h3>Invalid Input</h3><p>Enter positive finite load, pin diameter, and plate thickness values.</p>";
        return;
    }

    try {
        const forceN = convertForce(load, pinBearingElement("forceUnit").value);
        const diameterM = convertDistance(diameter, pinBearingElement("diameterUnit").value);
        const thicknessM = convertDistance(thickness, pinBearingElement("thicknessUnit").value);
        const projectedArea = diameterM * thicknessM;
        const pressurePa = forceN / projectedArea;
        const stressUnit = pinBearingElement("stressUnit").value;
        const pressure = convertStressToUnit(pressurePa, stressUnit);
        const format = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 5 });

        result.innerHTML = `
            <h3>Result</h3>
            <div class="result-value">Average projected bearing pressure = ${format(pressure)} ${stressUnit}</div>
            <hr>
            <p><strong>Projected bearing area:</strong> ${format(projectedArea * 1e6)} mm²</p>
            <p><strong>Load carried by plate:</strong> ${format(forceN)} N</p>
        `;
    } catch (error) {
        result.innerHTML = `<h3>Calculation Error</h3><p>${escapeHtml(error.message)}</p>`;
    }
}

function resetPinBearingPressure() {
    ["pinLoad", "pinDiameter", "plateThickness"].forEach((id) => {
        pinBearingElement(id).value = "";
    });
    pinBearingElement("result").textContent = "Ready to calculate.";
}
