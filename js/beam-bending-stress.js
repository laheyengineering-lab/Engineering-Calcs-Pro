// ======================================================
// Beam Bending Stress Calculator
// ======================================================

const bendingSectionTypeSelect = document.getElementById("sectionType");
const bendingMomentInput = document.getElementById("moment");
const bendingMomentUnitSelect = document.getElementById("momentUnit");
const bendingRectWidthInput = document.getElementById("rectWidth");
const bendingRectWidthUnitSelect = document.getElementById("rectWidthUnit");
const bendingRectHeightInput = document.getElementById("rectHeight");
const bendingRectHeightUnitSelect = document.getElementById("rectHeightUnit");
const bendingDiameterInput = document.getElementById("diameter");
const bendingDiameterUnitSelect = document.getElementById("diameterUnit");
const bendingOuterDiameterInput = document.getElementById("outerDiameter");
const bendingOuterDiameterUnitSelect = document.getElementById("outerDiameterUnit");
const bendingInnerDiameterInput = document.getElementById("innerDiameter");
const bendingInnerDiameterUnitSelect = document.getElementById("innerDiameterUnit");
const bendingStressUnitSelect = document.getElementById("stressUnit");
const bendingInertiaUnitSelect = document.getElementById("inertiaUnit");
const bendingResultPanel = document.getElementById("result");

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function updateBeamBendingStressMode() {
    const sectionType = bendingSectionTypeSelect.value;

    document.getElementById("rectSectionInputs").style.display = sectionType === "rectangular" ? "block" : "none";
    document.getElementById("solidCircularInputs").style.display = sectionType === "solid-circular" ? "block" : "none";
    document.getElementById("hollowCircularInputs").style.display = sectionType === "hollow-circular" ? "block" : "none";

    bendingResultPanel.innerHTML = "Ready to calculate.";
}

function calculateBeamBendingStress() {
    const sectionType = bendingSectionTypeSelect.value;
    const moment = Number(bendingMomentInput.value);

    if (!Number.isFinite(moment) || moment === 0) {
        bendingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter a non-zero bending moment.</p>";
        return;
    }

    try {
        const momentNm = convertMoment(moment, bendingMomentUnitSelect.value);

        let inertiaM4;
        let cM;
        let summaryLine;
        let displayLengthUnit;

        if (sectionType === "rectangular") {
            const width = Number(bendingRectWidthInput.value);
            const height = Number(bendingRectHeightInput.value);

            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                bendingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter positive rectangular section dimensions.</p>";
                return;
            }

            const widthM = convertDistance(width, bendingRectWidthUnitSelect.value);
            const heightM = convertDistance(height, bendingRectHeightUnitSelect.value);
            inertiaM4 = (widthM * Math.pow(heightM, 3)) / 12;
            cM = heightM / 2;
            summaryLine = `I = b·h³/12 = ${widthM.toExponential(6)} × ${heightM.toExponential(6)}³ / 12`;
            displayLengthUnit = bendingRectHeightUnitSelect.value;
        } else if (sectionType === "solid-circular") {
            const diameter = Number(bendingDiameterInput.value);

            if (!Number.isFinite(diameter) || diameter <= 0) {
                bendingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter a positive diameter.</p>";
                return;
            }

            const diameterM = convertDistance(diameter, bendingDiameterUnitSelect.value);
            inertiaM4 = (Math.PI * Math.pow(diameterM, 4)) / 64;
            cM = diameterM / 2;
            summaryLine = `I = πd⁴/64 = π(${diameterM.toExponential(6)})⁴ / 64`;
            displayLengthUnit = bendingDiameterUnitSelect.value;
        } else {
            const outerDiameter = Number(bendingOuterDiameterInput.value);
            const innerDiameter = Number(bendingInnerDiameterInput.value);

            if (!Number.isFinite(outerDiameter) || !Number.isFinite(innerDiameter) || outerDiameter <= 0 || innerDiameter <= 0) {
                bendingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter positive outer and inner diameters.</p>";
                return;
            }

            const outerDiameterM = convertDistance(outerDiameter, bendingOuterDiameterUnitSelect.value);
            const innerDiameterM = convertDistance(innerDiameter, bendingInnerDiameterUnitSelect.value);

            if (innerDiameterM >= outerDiameterM) {
                bendingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Inner diameter must be less than outer diameter.</p>";
                return;
            }

            inertiaM4 = (Math.PI * (Math.pow(outerDiameterM, 4) - Math.pow(innerDiameterM, 4))) / 64;
            cM = outerDiameterM / 2;
            summaryLine = `I = π(D⁴ - d⁴)/64 = π(${outerDiameterM.toExponential(6)}⁴ - ${innerDiameterM.toExponential(6)}⁴) / 64`;
            displayLengthUnit = bendingOuterDiameterUnitSelect.value;
        }

        const stressPa = (momentNm * cM) / inertiaM4;
        const stressUnit = bendingStressUnitSelect.value;
        const inertiaUnit = bendingInertiaUnitSelect.value;
        const stressOutput = convertStressToUnit(stressPa, stressUnit);
        const inertiaOutput = convertAreaMomentInertiaToUnit(inertiaM4, inertiaUnit);
        const cOutput = convertDistanceToUnit(cM, displayLengthUnit);
        const sectionModulusM3 = inertiaM4 / cM;
        let sectionModulusDisplay = `${sectionModulusM3.toExponential(6)} m³`;
        if (sectionType !== "rectangular" || bendingRectWidthUnitSelect.value === bendingRectHeightUnitSelect.value) {
            const sectionModulusInSectionUnits = sectionModulusM3 / Math.pow(convertDistance(1, displayLengthUnit), 3);
            sectionModulusDisplay += ` (${sectionModulusInSectionUnits.toExponential(6)} ${escapeHtml(displayLengthUnit)}³)`;
        }
        const safeSummaryLine = escapeHtml(summaryLine);

        bendingResultPanel.innerHTML = `
            <h3>Result</h3>
            <div class="result-value">σ<sub>max</sub> = ${stressOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${escapeHtml(stressUnit)}</div>
            <hr>
            <p><strong>Area Moment of Inertia:</strong> I = ${inertiaOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${escapeHtml(inertiaUnit)}</p>
            <p><strong>Distance to Outermost Fiber:</strong> c = ${cOutput.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${escapeHtml(displayLengthUnit)}</p>
            <p><strong>Section Modulus:</strong> S = I/c = ${sectionModulusDisplay}</p>
            <hr>
            <p><strong>Calculation Summary</strong></p>
            <p>σ = M·c / I</p>
            <p>${safeSummaryLine}</p>
            <p>σ = ${momentNm.toLocaleString(undefined, { maximumFractionDigits: 6 })} N·m × ${cM.toExponential(6)} m / ${inertiaM4.toExponential(6)} m⁴</p>
            <p>= <strong>${stressOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${escapeHtml(stressUnit)}</strong></p>
        `;
    } catch (error) {
        bendingResultPanel.innerHTML = `<h3>Calculation Error</h3><p>${escapeHtml(error.message)}</p>`;
    }
}

function resetBeamBendingStressCalculator() {
    bendingSectionTypeSelect.value = "rectangular";
    bendingMomentInput.value = "";
    bendingRectWidthInput.value = "";
    bendingRectHeightInput.value = "";
    bendingDiameterInput.value = "";
    bendingOuterDiameterInput.value = "";
    bendingInnerDiameterInput.value = "";

    bendingMomentUnitSelect.value = "N·m";
    bendingRectWidthUnitSelect.value = "mm";
    bendingRectHeightUnitSelect.value = "mm";
    bendingDiameterUnitSelect.value = "mm";
    bendingOuterDiameterUnitSelect.value = "mm";
    bendingInnerDiameterUnitSelect.value = "mm";
    bendingStressUnitSelect.value = "MPa";
    bendingInertiaUnitSelect.value = "mm⁴";

    updateBeamBendingStressMode();
    bendingResultPanel.innerHTML = "Ready to calculate.";
}

document.addEventListener("DOMContentLoaded", function() {
    updateBeamBendingStressMode();
});
