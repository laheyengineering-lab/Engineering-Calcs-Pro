const pinBearingElement = (id) => document.getElementById(id);

function renderPinBearingMessage(title, message, headline, rows = []) {
    const result = pinBearingElement("result");
    const heading = document.createElement("h3");
    heading.textContent = title;
    result.replaceChildren(heading);
    if (headline) {
        const value = document.createElement("div");
        value.className = "result-value";
        value.textContent = headline;
        result.appendChild(value);
    }
    if (rows.length) {
        result.appendChild(document.createElement("hr"));
        rows.forEach(([label, value]) => {
            const paragraph = document.createElement("p");
            const strong = document.createElement("strong");
            strong.textContent = `${label}: `;
            paragraph.append(strong, document.createTextNode(value));
            result.appendChild(paragraph);
        });
    }
    if (message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        result.appendChild(paragraph);
    }
}

function calculatePinBearingPressure() {
    const raw = ["pinLoad", "pinDiameter", "plateThickness"].map((id) => pinBearingElement(id).value);
    const [load, diameter, thickness] = raw.map(Number);

    if (raw.some((value) => value.trim() === "") ||
        [load, diameter, thickness].some((value) => !Number.isFinite(value) || value <= 0)) {
        renderPinBearingMessage("Invalid Input", "Enter positive finite load, pin diameter, and plate thickness values.");
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

        renderPinBearingMessage(
            "Result",
            "",
            `Average projected bearing pressure = ${format(pressure)} ${stressUnit}`,
            [
                ["Projected bearing area", `${format(projectedArea * 1e6)} mm²`],
                ["Load carried by plate", `${format(forceN)} N`]
            ]
        );
    } catch (error) {
        renderPinBearingMessage("Calculation Error", error.message);
    }
}

function resetPinBearingPressure() {
    ["pinLoad", "pinDiameter", "plateThickness"].forEach((id) => {
        pinBearingElement(id).value = "";
    });
    pinBearingElement("result").textContent = "Ready to calculate.";
}
