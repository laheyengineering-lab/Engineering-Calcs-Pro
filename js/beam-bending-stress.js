const bendingSectionTypeSelect = document.getElementById("sectionType");
const bendingResultPanel = document.getElementById("result");
const bendingDimensionFields = {
    rectangular: [
        { key: "width", id: "rectWidth", unit: "rectWidthUnit", label: "Width (b)" },
        { key: "height", id: "rectHeight", unit: "rectHeightUnit", label: "Height (h)" }
    ],
    "solid-circular": [
        { key: "diameter", id: "diameter", unit: "diameterUnit", label: "Diameter (d)" }
    ],
    "hollow-circular": [
        { key: "outerDiameter", id: "outerDiameter", unit: "outerDiameterUnit", label: "Outer diameter (D)" },
        { key: "innerDiameter", id: "innerDiameter", unit: "innerDiameterUnit", label: "Inner diameter (d)" }
    ],
    "hollow-rectangular": [
        { key: "outerWidth", id: "outerWidth", unit: "outerWidthUnit", label: "Outer width (B)" },
        { key: "outerHeight", id: "outerHeight", unit: "outerHeightUnit", label: "Outer height (H)" },
        { key: "wallThickness", id: "wallThickness", unit: "wallThicknessUnit", label: "Wall thickness (t)" }
    ],
    "i-beam": [
        { key: "height", id: "overallHeight", unit: "overallHeightUnit", label: "Overall height (H)" },
        { key: "flangeWidth", id: "flangeWidth", unit: "flangeWidthUnit", label: "Flange width (B)" },
        { key: "flangeThickness", id: "flangeThickness", unit: "flangeThicknessUnit", label: "Flange thickness (t_f)" },
        { key: "webThickness", id: "webThickness", unit: "webThicknessUnit", label: "Web thickness (t_w)" }
    ],
    "t-section": [
        { key: "height", id: "overallHeight", unit: "overallHeightUnit", label: "Overall height (H)" },
        { key: "flangeWidth", id: "flangeWidth", unit: "flangeWidthUnit", label: "Flange width (B)" },
        { key: "flangeThickness", id: "flangeThickness", unit: "flangeThicknessUnit", label: "Flange thickness (t_f)" },
        { key: "webThickness", id: "webThickness", unit: "webThicknessUnit", label: "Web thickness (t_w)" }
    ]
};

const bendingProfileNames = {
    rectangular: "Solid rectangle / square",
    "solid-circular": "Solid circle",
    "hollow-circular": "Hollow circle / tube",
    "hollow-rectangular": "Hollow rectangle / tube",
    "i-beam": "Symmetric I-beam",
    "t-section": "T-section"
};

const bendingEquation = {
    rectangular: "A = b h; I_x = b h³ / 12; I_y = h b³ / 12",
    "solid-circular": "A = π d² / 4; I_x = I_y = π d⁴ / 64",
    "hollow-circular": "A = π(D² − d²) / 4; I_x = I_y = π(D⁴ − d⁴) / 64",
    "hollow-rectangular": "b = B − 2t; h = H − 2t; I_x = (B H³ − b h³) / 12; I_y = (H B³ − h b³) / 12",
    "i-beam": "Sum flange and web rectangles about their centroidal axes using the parallel-axis theorem; count the web between flanges only.",
    "t-section": "Find the composite centroid, then sum the flange and web rectangle inertias using the parallel-axis theorem."
};

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
    const entries = bendingDimensionFields[sectionType].map(bendingRead);
    return {
        dimensions: Object.fromEntries(entries.map((entry) => [entry.key, entry.si])),
        inputs: entries.map(({ label, value, unit }) => ({ label, value, unit })),
        entries
    };
}

function updateBeamBendingStressMode() {
    const type = bendingSectionTypeSelect.value;
    document.getElementById("rectSectionInputs").hidden = type !== "rectangular";
    document.getElementById("solidCircularInputs").hidden = type !== "solid-circular";
    document.getElementById("hollowCircularInputs").hidden = type !== "hollow-circular";
    document.getElementById("hollowRectInputs").hidden = type !== "hollow-rectangular";
    document.getElementById("compositeSectionInputs").hidden = !["i-beam", "t-section"].includes(type);
    document.getElementById("profileEquation").textContent = bendingEquation[type] + "; σ = M c / I";
    bendingResultPanel.innerHTML = "Ready to calculate.";
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
    drawBeamSection();
}

function drawBeamSection() {
    const type = bendingSectionTypeSelect.value;
    const fields = bendingDimensionFields[type];
    const values = {};
    fields.forEach((field) => {
        const raw = document.getElementById(field.id).value;
        values[field.key] = raw && Number.isFinite(Number(raw))
            ? convertDistance(Number(raw), document.getElementById(field.unit).value) * 1000
            : 0;
    });

    let width, height, shape, dimensionNames, dimensionLabel;
    if (type === "rectangular") {
        width = values.width || 60; height = values.height || 90;
        shape = `M ${150 - width / 2} ${110 - height / 2} h ${width} v ${height} h ${-width} Z`;
        dimensionNames = [`b = ${values.width ? document.getElementById("rectWidth").value : "?"}`, `h = ${values.height ? document.getElementById("rectHeight").value : "?"}`];
        dimensionLabel = "b";
    } else if (type === "solid-circular" || type === "hollow-circular") {
        const d = type === "solid-circular" ? values.diameter || 80 : values.outerDiameter || 100;
        const inner = type === "hollow-circular" ? values.innerDiameter || d * 0.6 : 0;
        width = height = d;
        shape = `<circle cx="150" cy="110" r="${d / 2}"/>`;
        if (inner > 0 && inner < d) shape += `<circle class="profile-cutout" cx="150" cy="110" r="${inner / 2}"/>`;
        dimensionNames = type === "solid-circular"
            ? [`d = ${values.diameter ? document.getElementById("diameter").value : "?"}`]
            : [`D = ${values.outerDiameter ? document.getElementById("outerDiameter").value : "?"}`, `d = ${values.innerDiameter ? document.getElementById("innerDiameter").value : "?"}`];
        dimensionLabel = type === "solid-circular" ? "d" : "D";
    } else if (type === "hollow-rectangular") {
        width = values.outerWidth || 100; height = values.outerHeight || 75;
        const wall = values.wallThickness || Math.min(width, height) / 6;
        shape = `M ${150 - width / 2} ${110 - height / 2} h ${width} v ${height} h ${-width} Z
            M ${150 - width / 2 + wall} ${110 - height / 2 + wall} v ${height - 2 * wall} h ${width - 2 * wall} v ${-(height - 2 * wall)} Z`;
        dimensionNames = [`B = ${values.outerWidth ? document.getElementById("outerWidth").value : "?"}`, `H = ${values.outerHeight ? document.getElementById("outerHeight").value : "?"}`, `t = ${values.wallThickness ? document.getElementById("wallThickness").value : "?"}`];
        dimensionLabel = "B";
    } else {
        height = values.height || 120;
        width = values.flangeWidth || 90;
        const tf = values.flangeThickness || 16;
        const tw = values.webThickness || 12;
        if (type === "i-beam") {
            shape = `M ${150 - width / 2} ${110 - height / 2} h ${width} v ${tf} h ${-(width - tw) / 2} v ${height - 2 * tf} h ${(width - tw) / 2} v ${tf} h ${-width} v ${-tf} h ${(width - tw) / 2} v ${-(height - 2 * tf)} h ${-(width - tw) / 2} Z`;
        } else {
            shape = `M ${150 - width / 2} ${110 - height / 2} h ${width} v ${tf} h ${-(width - tw) / 2} v ${height - tf} h ${-tw} v ${-(height - tf)} h ${-(width - tw) / 2} Z`;
        }
        dimensionNames = [
            `H = ${values.height ? document.getElementById("overallHeight").value : "?"}`,
            `B = ${values.flangeWidth ? document.getElementById("flangeWidth").value : "?"}`,
            `t_f = ${values.flangeThickness ? document.getElementById("flangeThickness").value : "?"}`,
            `t_w = ${values.webThickness ? document.getElementById("webThickness").value : "?"}`
        ];
        dimensionLabel = "B";
    }

    const scale = Math.min(112 / Math.max(width, 1), 112 / Math.max(height, 1));
    const transform = `translate(150 110) scale(${scale}) translate(-150 -110)`;
    const axis = document.getElementById("bendingAxis").value;
    let centroidY = height / 2;
    try {
        const dimensions = Object.fromEntries(fields.map((field) => [
            field.key,
            convertDistance(Number(document.getElementById(field.id).value), document.getElementById(field.unit).value)
        ]));
        const properties = window.BeamSectionProperties.calculate(type, dimensions);
        const heightMeters = type === "rectangular" ? dimensions.height
            : type === "solid-circular" || type === "hollow-circular" ? dimensions.diameter || dimensions.outerDiameter
                : type === "hollow-rectangular" ? dimensions.outerHeight : dimensions.height;
        centroidY = convertDistanceToUnit(properties.centroidY, "mm");
        if (Number.isFinite(heightMeters)) height = convertDistanceToUnit(heightMeters, "mm");
    } catch (error) {
        centroidY = height / 2;
    }
    const centroidScreenY = 110 + (height / 2 - centroidY) * scale;
    const sectionLeft = 150 - width * scale / 2;
    const sectionRight = 150 + width * scale / 2;
    const sectionBottom = 110 + height * scale / 2;
    const diagramDimensionY = Math.min(sectionBottom + 18, 205);
    const svg = `<svg viewBox="0 0 300 220" role="img" aria-label="${bendingEscape(bendingProfileNames[type])} cross-section showing centroidal x and y axes">
        <defs><marker id="beamAxisArrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#c05621"/></marker>
        <marker id="beamDimArrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M6,0 L0,3 L6,6" fill="none" stroke="#555" stroke-width="1"/></marker></defs>
        <g transform="${transform}" fill="#dce6ee" fill-rule="evenodd" stroke="#284b63" stroke-width="2">${shape}</g>
        <line class="beam-axis ${axis === "x" ? "selected" : ""}" x1="35" y1="${centroidScreenY}" x2="265" y2="${centroidScreenY}" marker-end="url(#beamAxisArrow)"/>
        <line class="beam-axis ${axis === "y" ? "selected" : ""}" x1="150" y1="205" x2="150" y2="15" marker-end="url(#beamAxisArrow)"/>
        <circle cx="150" cy="${centroidScreenY}" r="4" fill="#c05621"/><text x="158" y="${centroidScreenY - 5}" class="beam-axis-label">C</text>
        <text x="273" y="${centroidScreenY - 4}" class="beam-axis-label">x (Iₓ)</text><text x="155" y="17" class="beam-axis-label">y (Iᵧ)</text>
        <line x1="${sectionLeft}" y1="${diagramDimensionY}" x2="${sectionRight}" y2="${diagramDimensionY}" class="beam-dimension" marker-start="url(#beamDimArrow)" marker-end="url(#beamDimArrow)"/>
        <text x="150" y="${diagramDimensionY + 14}" text-anchor="middle" class="beam-dimension-label">${dimensionLabel}</text>
    </svg>`;
    document.getElementById("profileDiagram").innerHTML = svg;
    document.getElementById("profileDiagramCaption").textContent =
        bendingProfileNames[type] + " · " + dimensionNames.map((entry, index) =>
            entry + " " + document.getElementById(fields[index].unit).value
        ).join(" · ");
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
        const properties = window.BeamSectionProperties.calculate(sectionType, dimensions);
        const axis = document.getElementById("bendingAxis").value;
        const inertiaM4 = axis === "x" ? properties.inertiaX : properties.inertiaY;
        const cM = axis === "x" ? properties.extremeFiberX : properties.extremeFiberY;
        const stressPa = momentNm * cM / inertiaM4;
        if (!Number.isFinite(stressPa)) throw new Error("The resulting bending stress is outside the supported numerical range.");

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
                equations: [bendingEquation[sectionType], axis === "x" ? "σ_x = M_x c_x / I_x; S_x = I_x / c_x" : "σ_y = M_y c_y / I_y; S_y = I_y / c_y"],
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
    Object.values(bendingDimensionFields).flat().forEach(({ id }) => { document.getElementById(id).value = ""; });
    Object.values(bendingDimensionFields).flat().forEach(({ unit }) => { document.getElementById(unit).value = "mm"; });
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
    document.getElementById("bendingAxis").addEventListener("change", drawBeamSection);
    updateBeamBendingStressMode();
});
