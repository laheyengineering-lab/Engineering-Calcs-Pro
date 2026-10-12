const toleranceStackElement = (id) => document.getElementById(id);
const TOLERANCE_CONTRIBUTORS = 5;

function renderToleranceStackMessage(title, message, headline, rows = []) {
    const result = toleranceStackElement("result");
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

function calculateToleranceStackUp() {
    const entries = Array.from({ length: TOLERANCE_CONTRIBUTORS }, (_, index) => {
        const input = toleranceStackElement(`tolerance${index + 1}`);
        const unit = toleranceStackElement(`toleranceUnit${index + 1}`).value;
        return { raw: input.value.trim(), unit };
    }).filter((entry) => entry.raw !== "");
    if (entries.length === 0) {
        renderToleranceStackMessage("Invalid Input", "Enter at least one non-negative tolerance contribution.");
        return;
    }
    const values = entries.map((entry) => Number(entry.raw));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        renderToleranceStackMessage("Invalid Input", "Tolerance contributions must be finite and non-negative.");
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

        renderToleranceStackMessage(
            "Result",
            "",
            `Worst-case band: ±${format(worstCase)} ${outputUnit}; RSS estimate: ±${format(rss)} ${outputUnit}`,
            [
                ["Contributors included", String(entries.length)],
                ["Worst-case", "Sum of absolute bilateral half-range contributions."],
                ["RSS", `Square root of squared contributions, combined in ${outputUnit}.`]
            ]
        );
    } catch (error) {
        renderToleranceStackMessage("Calculation Error", error.message);
    }
}

function resetToleranceStackUp() {
    Array.from({ length: TOLERANCE_CONTRIBUTORS }, (_, index) => {
        toleranceStackElement(`tolerance${index + 1}`).value = "";
    });
    toleranceStackElement("outputUnit").value = "mm";
    toleranceStackElement("result").textContent = "Ready to calculate.";
}
