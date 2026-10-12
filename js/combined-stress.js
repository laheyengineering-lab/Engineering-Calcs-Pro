const combinedStressElements = (id) => document.getElementById(id);

function renderCombinedStressMessage(title, message, headline, rows = []) {
    const result = combinedStressElements("result");
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

function calculateCombinedStress() {
    const forceRaw = combinedStressElements("axialForce").value;
    const momentRaw = combinedStressElements("bendingMoment").value;
    const widthRaw = combinedStressElements("sectionWidth").value;
    const heightRaw = combinedStressElements("sectionHeight").value;
    const values = [forceRaw, momentRaw, widthRaw, heightRaw].map(Number);

    if ([forceRaw, momentRaw, widthRaw, heightRaw].some((value) => value.trim() === "") ||
        values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) {
        renderCombinedStressMessage("Invalid Input", "Enter finite loads and positive section dimensions.");
        return;
    }

    try {
        const [force, moment, width, height] = values;
        const forceN = convertForce(force, combinedStressElements("forceUnit").value);
        const momentNm = convertMoment(moment, combinedStressElements("momentUnit").value);
        const widthM = convertDistance(width, combinedStressElements("lengthUnit").value);
        const heightM = convertDistance(height, combinedStressElements("heightUnit").value);
        const area = widthM * heightM;
        const inertia = widthM * Math.pow(heightM, 3) / 12;
        const axialStress = forceN / area;
        const bendingStress = momentNm * (heightM / 2) / inertia;
        const topStress = axialStress - bendingStress;
        const bottomStress = axialStress + bendingStress;
        const outputUnit = combinedStressElements("stressUnit").value;
        const topOutput = convertStressToUnit(topStress, outputUnit);
        const bottomOutput = convertStressToUnit(bottomStress, outputUnit);
        const format = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });

        renderCombinedStressMessage(
            "Result",
            "",
            `Top fiber: ${format(topOutput)} ${outputUnit}; bottom fiber: ${format(bottomOutput)} ${outputUnit}`,
            [
                ["Axial normal stress", `${format(convertStressToUnit(axialStress, outputUnit))} ${outputUnit}`],
                ["Bending stress magnitude", `${format(convertStressToUnit(Math.abs(bendingStress), outputUnit))} ${outputUnit}`],
                ["Rectangular area", `${format(area * 1e6)} mm²`],
                ["Centroidal area moment of inertia", `${format(inertia * 1e12)} mm⁴`]
            ]
        );
    } catch (error) {
        renderCombinedStressMessage("Calculation Error", error.message);
    }
}

function resetCombinedStress() {
    ["axialForce", "bendingMoment", "sectionWidth", "sectionHeight"].forEach((id) => {
        combinedStressElements(id).value = "";
    });
    combinedStressElements("result").textContent = "Ready to calculate.";
}
