const toleranceStackElement = (id) => document.getElementById(id);
const TOLERANCE_CONTRIBUTORS = 5;

function calculateToleranceStackUp() {
    const entries = Array.from({ length: TOLERANCE_CONTRIBUTORS }, (_, index) => {
        const input = toleranceStackElement(`tolerance${index + 1}`);
        const unit = toleranceStackElement(`toleranceUnit${index + 1}`).value;
        return { raw: input.value.trim(), unit };
    }).filter((entry) => entry.raw !== "");
    const result = toleranceStackElement("result");

    if (entries.length === 0) {
        result.innerHTML = "<h3>Invalid Input</h3><p>Enter at least one non-negative tolerance contribution.</p>";
        return;
    }
    const values = entries.map((entry) => Number(entry.raw));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        result.innerHTML = "<h3>Invalid Input</h3><p>Tolerance contributions must be finite and non-negative.</p>";
        return;
    }

    try {
        const valuesM = entries.map((entry, index) => convertDistance(values[index], entry.unit));
        const worstCaseM = valuesM.reduce((sum, value) => sum + value, 0);
        const rssM = Math.sqrt(valuesM.reduce((sum, value) => sum + value * value, 0));
        const outputUnit = toleranceStackElement("outputUnit").value;
        const worstCase = convertDistanceToUnit(worstCaseM, outputUnit);
        const rss = convertDistanceToUnit(rssM, outputUnit);
        const format = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });

        result.innerHTML = `
            <h3>Result</h3>
            <div class="result-value">Worst-case band: ±${format(worstCase)} ${outputUnit}; RSS estimate: ±${format(rss)} ${outputUnit}</div>
            <hr>
            <p><strong>Contributors included:</strong> ${entries.length}</p>
            <p>Worst-case = sum of absolute bilateral half-range contributions.</p>
            <p>RSS = square root of the sum of squared contributions, combined in ${outputUnit}.</p>
        `;
    } catch (error) {
        result.innerHTML = `<h3>Calculation Error</h3><p>${escapeHtml(error.message)}</p>`;
    }
}

function resetToleranceStackUp() {
    Array.from({ length: TOLERANCE_CONTRIBUTORS }, (_, index) => {
        toleranceStackElement(`tolerance${index + 1}`).value = "";
    });
    toleranceStackElement("outputUnit").value = "mm";
    toleranceStackElement("result").textContent = "Ready to calculate.";
}
