// ======================================================
// Bearing Life Calculator
// ======================================================

const bearingTypeSelect = document.getElementById("bearingType");
const bearingDynamicRatingInput = document.getElementById("dynamicLoadRating");
const bearingDynamicRatingUnitSelect = document.getElementById("dynamicLoadRatingUnit");
const bearingEquivalentLoadInput = document.getElementById("equivalentDynamicLoad");
const bearingEquivalentLoadUnitSelect = document.getElementById("equivalentDynamicLoadUnit");
const bearingSpeedInput = document.getElementById("speed");
const bearingSpeedUnitSelect = document.getElementById("speedUnit");
const bearingResultPanel = document.getElementById("result");

const bearingLifeExponents = {
    ball: 3,
    roller: 10 / 3
};

function calculateBearingLife() {
    const bearingType = bearingTypeSelect.value;
    const dynamicLoadRating = Number(bearingDynamicRatingInput.value);
    const equivalentDynamicLoad = Number(bearingEquivalentLoadInput.value);
    const speed = Number(bearingSpeedInput.value);

    if (!(bearingType in bearingLifeExponents)) {
        bearingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please select a valid bearing type.</p>";
        return;
    }

    if (!Number.isFinite(dynamicLoadRating) || !Number.isFinite(equivalentDynamicLoad) || !Number.isFinite(speed) || dynamicLoadRating <= 0 || equivalentDynamicLoad <= 0 || speed <= 0) {
        bearingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter positive values for C, P, and rotational speed.</p>";
        return;
    }

    try {
        const dynamicLoadRatingN = convertForce(dynamicLoadRating, bearingDynamicRatingUnitSelect.value);
        const equivalentLoadN = convertForce(equivalentDynamicLoad, bearingEquivalentLoadUnitSelect.value);
        const speedRpm = convertRotationalSpeed(speed, bearingSpeedUnitSelect.value);

        const exponent = bearingLifeExponents[bearingType];
        const lifeMillionRevolutions = Math.pow(dynamicLoadRatingN / equivalentLoadN, exponent);
        const lifeRevolutions = lifeMillionRevolutions * 1e6;
        const lifeHours = lifeRevolutions / (60 * speedRpm);

        const loadWarning = equivalentLoadN >= dynamicLoadRatingN
            ? `<p style="color:#b00020;"><strong>Load Warning:</strong> P ≥ C. The basic rating life is at or below 1 million revolutions and may indicate the selected condition is beyond typical rating assumptions. Verify the application and manufacturer guidance.</p>`
            : "";

        bearingResultPanel.innerHTML = `
            <h3>Result</h3>
            <div class="result-value">L<sub>10</sub> = ${lifeMillionRevolutions.toLocaleString(undefined, { maximumFractionDigits: 6 })} million rev</div>
            <hr>
            <p><strong>Life in Revolutions:</strong> ${lifeRevolutions.toLocaleString(undefined, { maximumFractionDigits: 2 })} rev</p>
            <p><strong>Life in Operating Hours:</strong> ${lifeHours.toLocaleString(undefined, { maximumFractionDigits: 3 })} h</p>
            <p><strong>Selected Exponent:</strong> p = ${exponent.toLocaleString(undefined, { maximumFractionDigits: 6 })} (${bearingType} bearing)</p>
            ${loadWarning}
            <hr>
            <p><strong>Calculation Summary</strong></p>
            <p>L<sub>10</sub> = (C/P)<sup>p</sup></p>
            <p>L<sub>10</sub> = (${dynamicLoadRatingN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N / ${equivalentLoadN.toLocaleString(undefined, { maximumFractionDigits: 2 })} N)<sup>${exponent.toLocaleString(undefined, { maximumFractionDigits: 6 })}</sup></p>
            <p>= <strong>${lifeMillionRevolutions.toLocaleString(undefined, { maximumFractionDigits: 6 })} million rev</strong></p>
            <p>L<sub>10h</sub> = (L<sub>10</sub> × 10⁶) / (60n)</p>
            <p>L<sub>10h</sub> = (${lifeMillionRevolutions.toLocaleString(undefined, { maximumFractionDigits: 6 })} × 10⁶) / (60 × ${speedRpm.toLocaleString(undefined, { maximumFractionDigits: 6 })} rpm)</p>
            <p>= <strong>${lifeHours.toLocaleString(undefined, { maximumFractionDigits: 3 })} h</strong></p>
        `;
    } catch (error) {
        bearingResultPanel.innerHTML = `<h3>Calculation Error</h3><p>${error.message}</p>`;
    }
}

function resetBearingLifeCalculator() {
    bearingTypeSelect.value = "ball";
    bearingDynamicRatingInput.value = "";
    bearingEquivalentLoadInput.value = "";
    bearingSpeedInput.value = "";

    bearingDynamicRatingUnitSelect.value = "kN";
    bearingEquivalentLoadUnitSelect.value = "kN";
    bearingSpeedUnitSelect.value = "rpm";

    bearingResultPanel.innerHTML = "Ready to calculate.";
}
