const combinedStressElements = (id) => document.getElementById(id);

function calculateCombinedStress() {
    const forceRaw = combinedStressElements("axialForce").value;
    const momentRaw = combinedStressElements("bendingMoment").value;
    const widthRaw = combinedStressElements("sectionWidth").value;
    const heightRaw = combinedStressElements("sectionHeight").value;
    const result = combinedStressElements("result");
    const values = [forceRaw, momentRaw, widthRaw, heightRaw].map(Number);

    if ([forceRaw, momentRaw, widthRaw, heightRaw].some((value) => value.trim() === "") ||
        values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) {
        result.innerHTML = "<h3>Invalid Input</h3><p>Enter finite loads and positive section dimensions.</p>";
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

        result.innerHTML = `
            <h3>Result</h3>
            <div class="result-value">Top fiber: ${format(topOutput)} ${outputUnit}; bottom fiber: ${format(bottomOutput)} ${outputUnit}</div>
            <hr>
            <p><strong>Axial normal stress:</strong> ${format(convertStressToUnit(axialStress, outputUnit))} ${outputUnit}</p>
            <p><strong>Bending stress magnitude:</strong> ${format(convertStressToUnit(Math.abs(bendingStress), outputUnit))} ${outputUnit}</p>
            <p><strong>Rectangular area:</strong> ${format(area * 1e6)} mm²</p>
            <p><strong>Centroidal area moment of inertia:</strong> ${format(inertia * 1e12)} mm⁴</p>
        `;
    } catch (error) {
        result.innerHTML = `<h3>Calculation Error</h3><p>${escapeHtml(error.message)}</p>`;
    }
}

function resetCombinedStress() {
    ["axialForce", "bendingMoment", "sectionWidth", "sectionHeight"].forEach((id) => {
        combinedStressElements(id).value = "";
    });
    combinedStressElements("result").textContent = "Ready to calculate.";
}
