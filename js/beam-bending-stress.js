const bendingSectionTypeSelect = document.getElementById("sectionType");
const bendingResultPanel = document.getElementById("result");
const bendingProfileNames = Object.fromEntries(
    Object.entries(window.BeamSectionUI.profiles).map(([key, profile]) => [key, profile.name])
);

function bendingEscape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function bendingFormat(value, digits = 5) {
    return Number(value).toLocaleString(undefined, { maximumSignificantDigits: digits });
}

function bendingRead(field) {
    const raw = document.getElementById(field.id).value.trim();
    if (raw === "") throw new Error(field.label + " is required.");
    const value = Number(raw);
    const unit = document.getElementById(field.unit).value;
    const si = convertDistance(value, unit);
    if (!Number.isFinite(value) || !Number.isFinite(si) || si <= 0) {
        throw new Error(field.label + " must be a positive finite dimension.");
    }
    return { key: field.key, label: field.label, value, unit, si };
}

function bendingProfileInputs(sectionType) {
    const entries = window.BeamSectionUI.getFields(sectionType).map(bendingRead);
    return {
        dimensions: Object.fromEntries(entries.map((entry) => [entry.key, entry.si])),
        inputs: entries.map(({ label, value, unit }) => ({ label, value, unit })),
        entries
    };
}

function computeBeamBendingStress({ sectionType, dimensions, momentNm, axis }) {
    if (!Number.isFinite(momentNm)) throw new Error("Bending moment must be finite.");
    if (axis !== "x" && axis !== "y") throw new Error("Select a supported bending axis.");
    const properties = window.BeamSectionProperties.calculate(sectionType, dimensions);
    const inertiaM4 = axis === "x" ? properties.inertiaX : properties.inertiaY;
    const cM = axis === "x" ? properties.extremeFiberX : properties.extremeFiberY;
    const stressPa = momentNm * cM / inertiaM4;
    if (!Number.isFinite(stressPa)) throw new Error("The resulting bending stress is outside the supported numerical range.");
    return { properties, inertiaM4, cM, stressPa };
}

function updateBeamBendingStressEquation() {
    const type = bendingSectionTypeSelect.value;
    const axis = document.getElementById("bendingAxis").value;
    const sectionEquations = window.BeamSectionProperties.equations(type);
    const equation = axis === "x"
        ? String.raw`\sigma_x=\frac{M_x c_x}{I_x},\quad S_x=\frac{I_x}{c_x}`
        : String.raw`\sigma_y=\frac{M_y c_y}{I_y},\quad S_y=\frac{I_y}{c_y}`;
    document.getElementById("profileEquation").textContent =
        `\\[ ${sectionEquations[0]} \\] \\[ ${equation} \\]`;
    if (typeof window.FormulaFoundryRenderMath === "function") window.FormulaFoundryRenderMath();
}

function updateBeamBendingStressMode() {
    const type = bendingSectionTypeSelect.value;
    window.BeamSectionUI.update(document, type, document.getElementById("bendingAxis").value);
    updateBeamBendingStressEquation();
    bendingResultPanel.innerHTML = "Ready to calculate.";
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
    drawBeamSection();
}

function drawBeamSection() {
    window.BeamSectionUI.updateDiagram(
        document, bendingSectionTypeSelect.value, document.getElementById("bendingAxis").value
    );
}

function calculateBeamBendingStress() {
    try {
        const sectionType = bendingSectionTypeSelect.value;
        const momentText = document.getElementById("moment").value.trim();
        if (momentText === "") throw new Error("Bending moment is required.");
        const moment = Number(momentText);
        if (!Number.isFinite(moment)) throw new Error("Bending moment must be finite.");
        const momentUnit = document.getElementById("momentUnit").value;
        const momentNm = convertMoment(moment, momentUnit);
        if (!Number.isFinite(momentNm)) throw new Error("Select a valid bending-moment unit.");

        const { dimensions, inputs: dimensionInputs, entries } = bendingProfileInputs(sectionType);
        const axis = document.getElementById("bendingAxis").value;
        const { properties, inertiaM4, cM, stressPa } = computeBeamBendingStress({ sectionType, dimensions, momentNm, axis });

        const stressUnit = document.getElementById("stressUnit").value;
        const areaUnit = document.getElementById("areaUnit").value;
        const inertiaUnit = document.getElementById("inertiaUnit").value;
        const displayLengthUnit = entries[0].unit;
        const stressOutput = convertStressToUnit(stressPa, stressUnit);
        const areaOutput = convertAreaToUnit(properties.area, areaUnit);
        const inertiaXOutput = convertAreaMomentInertiaToUnit(properties.inertiaX, inertiaUnit);
        const inertiaYOutput = convertAreaMomentInertiaToUnit(properties.inertiaY, inertiaUnit);
        const centroidXOutput = convertDistanceToUnit(properties.centroidX, displayLengthUnit);
        const centroidYOutput = convertDistanceToUnit(properties.centroidY, displayLengthUnit);
        const cOutput = convertDistanceToUnit(cM, displayLengthUnit);
        const sectionModulusX = properties.sectionModulusX / convertDistance(1, displayLengthUnit) ** 3;
        const sectionModulusY = properties.sectionModulusY / convertDistance(1, displayLengthUnit) ** 3;
        const selectedInertia = axis === "x" ? inertiaXOutput : inertiaYOutput;
        const selectedSectionModulus = axis === "x" ? sectionModulusX : sectionModulusY;
        const stressLabel = axis === "x" ? "horizontal x-axis" : "vertical y-axis";

        bendingResultPanel.innerHTML = `
            <h3>Result — ${bendingEscape(bendingProfileNames[sectionType])}</h3>
            <div class="result-value">Extreme-fiber bending stress: ${bendingFormat(stressOutput)} ${bendingEscape(stressUnit)}</div>
            <hr>
            <p><strong>Section properties</strong></p>
            <p>Area A: ${bendingFormat(areaOutput)} ${bendingEscape(areaUnit)}</p>
            <p>Centroid: x̄ = ${bendingFormat(centroidXOutput)} ${bendingEscape(displayLengthUnit)}, ȳ = ${bendingFormat(centroidYOutput)} ${bendingEscape(displayLengthUnit)} from the lower-left section bounds</p>
            <p>Second moments: Iₓ = ${bendingFormat(inertiaXOutput)} ${bendingEscape(inertiaUnit)}; Iᵧ = ${bendingFormat(inertiaYOutput)} ${bendingEscape(inertiaUnit)}</p>
            <p>Section moduli: Sₓ = ${bendingFormat(sectionModulusX)} ${bendingEscape(displayLengthUnit)}³; Sᵧ = ${bendingFormat(sectionModulusY)} ${bendingEscape(displayLengthUnit)}³</p>
            <p>Selected ${stressLabel}: I = ${bendingFormat(selectedInertia)} ${bendingEscape(inertiaUnit)}, c = ${bendingFormat(cOutput)} ${bendingEscape(displayLengthUnit)}, S = ${bendingFormat(selectedSectionModulus)} ${bendingEscape(displayLengthUnit)}³</p>
            <p>σ = M c / I = ${bendingFormat(momentNm)} N·m × ${bendingFormat(cM)} m / ${bendingFormat(inertiaM4)} m⁴</p>
            <p><small>Signed extreme-fiber stress; the opposite extreme fiber has equal magnitude and opposite sign. Linear elastic, prismatic-beam flexure assumptions apply; shear, local buckling, lateral-torsional buckling, fatigue, stress concentrations and deflection are not evaluated.</small></p>
        `;

        if (window.FormulaFoundryReport) {
            const inputs = [
                { label: "Cross-section profile", value: bendingProfileNames[sectionType], unit: "" },
                ...dimensionInputs,
                { label: "Bending moment (M)", value: moment, unit: momentUnit },
                { label: "Bending axis", value: stressLabel, unit: "" }
            ];
            const outputs = [
                { label: "Cross-sectional area (A)", value: areaOutput, unit: areaUnit },
                { label: "Centroid x̄", value: centroidXOutput, unit: displayLengthUnit },
                { label: "Centroid ȳ", value: centroidYOutput, unit: displayLengthUnit },
                { label: "Second moment of area (Iₓ)", value: inertiaXOutput, unit: inertiaUnit },
                { label: "Second moment of area (Iᵧ)", value: inertiaYOutput, unit: inertiaUnit },
                { label: "Section modulus (Sₓ)", value: sectionModulusX, unit: displayLengthUnit + "³" },
                { label: "Section modulus (Sᵧ)", value: sectionModulusY, unit: displayLengthUnit + "³" },
                { label: "Extreme-fiber distance (c)", value: cOutput, unit: displayLengthUnit },
                { label: "Bending stress", value: stressOutput, unit: stressUnit }
            ];
            window.FormulaFoundryReport.recordResult({
                calculatorId: "beam-bending-stress",
                calculatorName: "Beam Bending Stress",
                path: "calculators/beam-bending-stress.html",
                title: bendingProfileNames[sectionType] + " bending stress",
                inputs,
                outputs,
                diagram: {
                    type: "beam-section",
                    profile: sectionType,
                    dimensions,
                    axis,
                    unit: displayLengthUnit
                },
                equations: [...window.BeamSectionProperties.equations(sectionType), axis === "x"
                    ? String.raw`\sigma_x=\frac{M_x c_x}{I_x},\quad S_x=\frac{I_x}{c_x}`
                    : String.raw`\sigma_y=\frac{M_y c_y}{I_y},\quad S_y=\frac{I_y}{c_y}`],
                assumptions: [
                    "Linear elastic material response and small deformation; prismatic cross-section and simple elastic flexure.",
                    "Bending is about a centroidal principal axis of the homogeneous section.",
                    "Shear stress, local and lateral-torsional buckling, fatigue, stress concentrations and full beam deflection are not evaluated."
                ],
                method: "Cross-section area, centroid and centroidal second moments are derived from the entered profile. Bending stress is calculated from the signed applied moment and the selected centroidal axis using σ = M c / I.",
                warnings: ["Verify the section properties and elastic-beam assumptions for the actual design."]
            });
        }
        drawBeamSection();
    } catch (error) {
        bendingResultPanel.innerHTML = `<h3>Invalid Input</h3><p>${bendingEscape(error.message)}</p>`;
        if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
    }
}

function resetBeamBendingStressCalculator() {
    const fields = Object.values(window.BeamSectionUI.profiles).flatMap((profile) => profile.fields);
    [...new Set(fields.map(({ id }) => id))].forEach((id) => { document.getElementById(id).value = ""; });
    [...new Set(fields.map(({ unit }) => unit))].forEach((unit) => { document.getElementById(unit).value = "mm"; });
    document.getElementById("sectionType").value = "rectangular";
    document.getElementById("moment").value = "";
    document.getElementById("momentUnit").value = "N·m";
    document.getElementById("bendingAxis").value = "x";
    document.getElementById("stressUnit").value = "MPa";
    document.getElementById("areaUnit").value = "mm²";
    document.getElementById("inertiaUnit").value = "mm⁴";
    updateBeamBendingStressMode();
}

document.addEventListener("DOMContentLoaded", function () {
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.declareStructured();
    document.querySelectorAll("#sectionType, #bendingAxis, .profile-inputs input, .profile-inputs select")
        .forEach((input) => input.addEventListener("input", drawBeamSection));
    document.getElementById("bendingAxis").addEventListener("change", () => {
        drawBeamSection();
        updateBeamBendingStressEquation();
    });
    updateBeamBendingStressMode();
});
