const beamLengthInput = document.getElementById("beamLength");
const pointLoadInput = document.getElementById("pointLoad");
const distributedLoadInput = document.getElementById("distributedLoad");
const youngsModulusInput = document.getElementById("youngsModulus");
const beamMaterialSelect = document.getElementById("material");
const beamResultPanel = document.getElementById("result");
const loadingCaseSelect = document.getElementById("loadingCase");
const lengthUnitSelect = document.getElementById("lengthUnit");
const loadUnitSelect = document.getElementById("loadUnit");
const distributedLoadUnitSelect = document.getElementById("distributedLoadUnit");
const modulusUnitSelect = document.getElementById("modulusUnit");
const inertiaUnitSelect = document.getElementById("inertiaUnit");
const deflectionUnitSelect = document.getElementById("deflectionUnit");
const beamSpanSlider = document.getElementById("beamSpanSlider");
const pointLoadSlider = document.getElementById("pointLoadSlider");

function updateBeamDeflectionDiagram(recenterSpanRange = true, result = null, recenterLoadRange = true) {
    const host = document.getElementById("beamDiagram");
    if (!host || !window.FormulaFoundryBeamDeflectionDiagram) return;

    const spanRaw = beamLengthInput.value.trim();
    const span = Number(spanRaw);
    const validSpan = spanRaw !== "" && Number.isFinite(span) && span > 0;
    if (beamSpanSlider) {
        const spanRange = validSpan && window.FormulaFoundryDiagram
            ? window.FormulaFoundryDiagram.rangeAround(span, 0.5, 1.5)
            : null;
        beamSpanSlider.disabled = !spanRange;
        if (validSpan) {
            if (spanRange && (recenterSpanRange || !beamSpanSlider.dataset.initialized)) {
                beamSpanSlider.min = String(spanRange.min);
                beamSpanSlider.max = String(spanRange.max);
                beamSpanSlider.dataset.initialized = "true";
            }
            beamSpanSlider.value = String(span);
        }
    }

    const isPointLoad = loadingCaseSelect.value.endsWith("point");
    const loadInput = isPointLoad ? pointLoadInput : distributedLoadInput;
    const loadUnit = isPointLoad ? loadUnitSelect.value : distributedLoadUnitSelect.value;
    const loadRaw = loadInput.value.trim();
    const load = loadRaw === "" ? null : Number(loadRaw);
    const loadMagnitude = Number.isFinite(load) ? Math.abs(load) : null;
    const loadRange = isPointLoad && loadMagnitude > 0 && window.FormulaFoundryDiagram
        ? window.FormulaFoundryDiagram.rangeAround(loadMagnitude, 0.5, 1.5)
        : null;
    if (pointLoadSlider) {
        pointLoadSlider.disabled = !loadRange;
        if (loadRange) {
            if (recenterLoadRange || !pointLoadSlider.dataset.initialized) {
                pointLoadSlider.min = String(loadRange.min);
                pointLoadSlider.max = String(loadRange.max);
                pointLoadSlider.dataset.initialized = "true";
            }
            pointLoadSlider.value = String(loadMagnitude);
        }
    }
    const lengthUnit = lengthUnitSelect.value;
    host.replaceChildren(window.FormulaFoundryBeamDeflectionDiagram.render(document, {
        caseId: loadingCaseSelect.value,
        span: validSpan ? span : null,
        spanDisplay: validSpan ? spanRaw : "",
        lengthUnit,
        load: Number.isFinite(load) ? load : null,
        loadLabel: isPointLoad ? "P" : "w",
        ...(result || {})
    }, (nextSpan, event) => {
        beamLengthInput.value = String(nextSpan);
        updateBeamDeflectionDiagram(true);
        calculateBeamDeflection();
        if (event && event.type === "keydown") {
            const replacement = document.querySelector("#beamDiagram .beam-span-handle");
            if (replacement) replacement.focus();
        }
    }));
    const caption = document.getElementById("beamDiagramCaption");
    if (caption) {
        const selectedCase = beamDeflectionCases[loadingCaseSelect.value];
        caption.textContent = selectedCase
            ? `${selectedCase.support} · ${selectedCase.name}. ${loadDescriptionForCaption()}`.trim()
            : "Select one of the supported loading and support cases.";
    }
}

function loadDescriptionForCaption() {
    const isPointLoad = loadingCaseSelect.value.endsWith("point");
    const loadInput = isPointLoad ? pointLoadInput : distributedLoadInput;
    const raw = loadInput.value.trim();
    if (raw === "") return "Enter the applied load to complete the diagram.";
    const unit = isPointLoad ? loadUnitSelect.value : distributedLoadUnitSelect.value;
    return `Applied load ${isPointLoad ? "P" : "w"} = ${raw} ${unit}. Point-load position and supports match the selected closed-form case.`;
}

function beamDeflectionInputsReady() {
    if (!beamDeflectionCases[loadingCaseSelect.value]) return false;
    const isPointLoad = loadingCaseSelect.value.endsWith("point");
    const loadInput = isPointLoad ? pointLoadInput : distributedLoadInput;
    const profile = document.getElementById("sectionType").value;
    const required = [
        beamLengthInput,
        youngsModulusInput,
        loadInput,
        ...window.BeamSectionUI.getFields(profile).map((field) => document.getElementById(field.id))
    ];
    return required.every((input) => input && input.value.trim() !== "");
}

function markBeamDeflectionInputsStale() {
    if (!beamResultPanel.querySelector(".result-value")) return;
    beamResultPanel.textContent = "Inputs changed — recalculate to refresh the results.";
    updateBeamDeflectionDiagram(false);
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

function updateBeamDeflectionMaterialModulus() {
    const youngsModulusPa = getMaterialProperty(beamMaterialSelect.value, "youngsModulus");
    if (!Number.isFinite(youngsModulusPa) || youngsModulusPa <= 0) return;
    youngsModulusInput.value = String(convertModulusToUnit(youngsModulusPa, modulusUnitSelect.value));
}

const beamDeflectionCases = {
    "ss-point": {
        name: "Simply supported, center point load",
        support: "Simply supported (pin and roller)",
        formula: String.raw`\delta_{\max}=\frac{PL^3}{48EI}`,
        moment: (load, span) => load * span / 4,
        locationFraction: 0.5,
        location: "Midspan (L/2)"
    },
    "ss-udl": {
        name: "Simply supported, full-span uniform load",
        support: "Simply supported (pin and roller)",
        formula: String.raw`\delta_{\max}=\frac{5wL^4}{384EI}`,
        moment: (load, span) => load * span ** 2 / 8,
        locationFraction: 0.5,
        location: "Midspan (L/2)"
    },
    "cant-point": {
        name: "Cantilever, point load at free end",
        support: "Cantilever (fixed root, free end)",
        formula: String.raw`\delta_{\max}=\frac{PL^3}{3EI}`,
        moment: (load, span) => load * span,
        locationFraction: 1,
        location: "Free end (L)"
    },
    "cant-udl": {
        name: "Cantilever, full-span uniform load",
        support: "Cantilever (fixed root, free end)",
        formula: String.raw`\delta_{\max}=\frac{wL^4}{8EI}`,
        moment: (load, span) => load * span ** 2 / 2,
        locationFraction: 1,
        location: "Free end (L)"
    }
};

function beamDeflectionEscape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function beamDeflectionFormat(value, digits = 6) {
    return Number(value).toLocaleString(undefined, { maximumSignificantDigits: digits });
}

function beamDeflectionProfileInputs(profile) {
    const entries = window.BeamSectionUI.getFields(profile).map((field) => {
        const input = document.getElementById(field.id);
        const raw = input.value.trim();
        if (raw === "") throw new Error(field.label + " is required.");
        const value = Number(raw);
        const unit = document.getElementById(field.unit).value;
        const si = convertDistance(value, unit);
        if (!Number.isFinite(value) || !Number.isFinite(si) || si <= 0) {
            throw new Error(field.label + " must be a positive finite dimension.");
        }
        return { key: field.key, label: field.label, value, unit, si };
    });
    return {
        dimensions: Object.fromEntries(entries.map((entry) => [entry.key, entry.si])),
        entries
    };
}

function updateBeamDeflectionMode() {
    const loadingCase = loadingCaseSelect.value;
    const isPointLoad = ["ss-point", "cant-point"].includes(loadingCase);
    document.getElementById("pointLoadContainer").hidden = !isPointLoad;
    document.getElementById("pointLoadSliderContainer").hidden = !isPointLoad;
    document.getElementById("distributedLoadContainer").hidden = !["ss-udl", "cant-udl"].includes(loadingCase);
    const profile = document.getElementById("sectionType").value;
    const axis = document.getElementById("bendingAxis").value;
    window.BeamSectionUI.update(document, profile, axis);
    document.getElementById("profileEquation").textContent =
        `\\[ ${window.BeamSectionProperties.equations(profile)[0]} \\]`;
    if (typeof window.FormulaFoundryRenderMath === "function") window.FormulaFoundryRenderMath();
    beamResultPanel.innerHTML = "Ready to calculate.";
    updateBeamDeflectionDiagram(true);
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

function calculateBeamDeflection() {
    try {
        const caseDefinition = beamDeflectionCases[loadingCaseSelect.value];
        if (!caseDefinition) throw new Error("Select one of the supported load/support cases.");

        const spanRaw = beamLengthInput.value.trim();
        const modulusRaw = youngsModulusInput.value.trim();
        if (spanRaw === "" || modulusRaw === "") {
            throw new Error("Beam span and Young's modulus are required.");
        }
        const span = Number(spanRaw);
        const modulus = Number(modulusRaw);
        const lengthUnit = lengthUnitSelect.value;
        const modulusUnit = modulusUnitSelect.value;
        const spanM = convertDistance(span, lengthUnit);
        const modulusPa = convertModulus(modulus, modulusUnit);
        if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(spanM) || spanM <= 0) {
            throw new Error("Beam span must be a positive finite length.");
        }
        if (!Number.isFinite(modulus) || modulus <= 0 || !Number.isFinite(modulusPa) || modulusPa <= 0) {
            throw new Error("Young's modulus must be positive and finite.");
        }

        const profile = document.getElementById("sectionType").value;
        const axis = document.getElementById("bendingAxis").value;
        const { dimensions, entries } = beamDeflectionProfileInputs(profile);
        const properties = window.BeamSectionProperties.calculate(profile, dimensions);
        const inertiaM4 = axis === "x" ? properties.inertiaX : properties.inertiaY;
        const flexuralRigidity = modulusPa * inertiaM4;
        if (!Number.isFinite(flexuralRigidity) || flexuralRigidity <= 0) {
            throw new Error("The flexural rigidity is outside the supported numerical range.");
        }

        const isPointLoad = loadingCaseSelect.value.endsWith("point");
        const loadInput = isPointLoad ? pointLoadInput : distributedLoadInput;
        const loadRaw = loadInput.value.trim();
        if (loadRaw === "") throw new Error(isPointLoad ? "Point load is required." : "Uniform distributed load is required.");
        const load = Number(loadRaw);
        if (!Number.isFinite(load) || load === 0) {
            throw new Error("Load must be finite and non-zero.");
        }
        const loadUnit = isPointLoad ? loadUnitSelect.value : distributedLoadUnitSelect.value;
        const loadSI = isPointLoad ? convertForce(load, loadUnit) : convertDistributedLoad(load, loadUnit);
        if (!Number.isFinite(loadSI) || loadSI === 0) throw new Error("Load and its selected units must be finite and non-zero.");

        let maxDeflectionM;
        if (loadingCaseSelect.value === "ss-point") maxDeflectionM = loadSI * spanM ** 3 / (48 * flexuralRigidity);
        else if (loadingCaseSelect.value === "ss-udl") maxDeflectionM = 5 * loadSI * spanM ** 4 / (384 * flexuralRigidity);
        else if (loadingCaseSelect.value === "cant-point") maxDeflectionM = loadSI * spanM ** 3 / (3 * flexuralRigidity);
        else maxDeflectionM = loadSI * spanM ** 4 / (8 * flexuralRigidity);
        const maxMomentNm = caseDefinition.moment(loadSI, spanM);
        if (!Number.isFinite(maxDeflectionM) || !Number.isFinite(maxMomentNm)) {
            throw new Error("The result is outside the supported numerical range.");
        }

        const deflectionUnit = deflectionUnitSelect.value;
        const inertiaUnit = inertiaUnitSelect.value;
        const areaUnit = "mm²";
        const lengthDisplayUnit = entries[0].unit;
        const deflectionOutput = convertDistanceToUnit(maxDeflectionM, deflectionUnit);
        const deflectionMagnitude = Math.abs(deflectionOutput);
        const location = spanM * caseDefinition.locationFraction;
        const locationOutput = convertDistanceToUnit(location, lengthUnit);
        const maxMomentOutput = convertMomentToUnit(maxMomentNm, "N·m");
        const areaOutput = convertAreaToUnit(properties.area, areaUnit);
        const inertiaXOutput = convertAreaMomentInertiaToUnit(properties.inertiaX, inertiaUnit);
        const inertiaYOutput = convertAreaMomentInertiaToUnit(properties.inertiaY, inertiaUnit);
        const selectedInertiaOutput = convertAreaMomentInertiaToUnit(inertiaM4, inertiaUnit);
        const centroidXOutput = convertDistanceToUnit(properties.centroidX, lengthDisplayUnit);
        const centroidYOutput = convertDistanceToUnit(properties.centroidY, lengthDisplayUnit);
        const sectionModulusX = properties.sectionModulusX / convertDistance(1, lengthDisplayUnit) ** 3;
        const sectionModulusY = properties.sectionModulusY / convertDistance(1, lengthDisplayUnit) ** 3;
        const axisLabel = axis === "x" ? "horizontal x-axis (Iₓ)" : "vertical y-axis (Iᵧ)";
        const equation = caseDefinition.formula;
        document.getElementById("profileEquation").textContent = `\\[ ${window.BeamSectionProperties.equations(profile)[0]} \\]`;

        beamResultPanel.innerHTML = `
            <h3>Result — ${beamDeflectionEscape(caseDefinition.name)}</h3>
            <div class="result-label">Maximum deflection magnitude</div>
            <div class="result-value" aria-label="Maximum deflection">${beamDeflectionFormat(deflectionOutput)} ${beamDeflectionEscape(deflectionUnit)}</div>
            <hr>
            <p><strong>Beam model</strong></p>
            <p>Support and loading: ${beamDeflectionEscape(caseDefinition.support)} · ${beamDeflectionEscape(caseDefinition.name)}</p>
            <p>Maximum deflection location: ${caseDefinition.location}, ${beamDeflectionFormat(locationOutput)} ${beamDeflectionEscape(lengthUnit)} from the left end / fixed root.</p>
            ${isPointLoad ? `<p>Deflection at point-load position: ${beamDeflectionFormat(deflectionOutput)} ${beamDeflectionEscape(deflectionUnit)}</p>` : ""}
            <p>Signed deflection: δ<sub>max</sub> = ${beamDeflectionFormat(deflectionOutput)} ${beamDeflectionEscape(deflectionUnit)}; magnitude = ${beamDeflectionFormat(deflectionMagnitude)} ${beamDeflectionEscape(deflectionUnit)}</p>
            <p><strong>Governing deflection equation:</strong></p>
            <div class="formula-box">\\[ ${beamDeflectionEscape(equation)} \\]</div>
            <p>Maximum bending moment: M<sub>max</sub> = ${beamDeflectionFormat(maxMomentOutput)} N·m</p>
            <p><strong>Section properties (${beamDeflectionEscape(window.BeamSectionUI.getName(profile))})</strong></p>
            <p>Area A = ${beamDeflectionFormat(areaOutput)} ${areaUnit}; centroid x̄ = ${beamDeflectionFormat(centroidXOutput)} ${beamDeflectionEscape(lengthDisplayUnit)}, ȳ = ${beamDeflectionFormat(centroidYOutput)} ${beamDeflectionEscape(lengthDisplayUnit)} from lower-left bounds.</p>
            <p>Iₓ = ${beamDeflectionFormat(inertiaXOutput)} ${beamDeflectionEscape(inertiaUnit)}; Iᵧ = ${beamDeflectionFormat(inertiaYOutput)} ${beamDeflectionEscape(inertiaUnit)}; selected ${axisLabel}: I = ${beamDeflectionFormat(selectedInertiaOutput)} ${beamDeflectionEscape(inertiaUnit)}.</p>
            <p>Section moduli: Sₓ = ${beamDeflectionFormat(sectionModulusX)} ${beamDeflectionEscape(lengthDisplayUnit)}³; Sᵧ = ${beamDeflectionFormat(sectionModulusY)} ${beamDeflectionEscape(lengthDisplayUnit)}³.</p>
            <p>Flexural rigidity EI = ${beamDeflectionFormat(flexuralRigidity)} N·m²; E = ${beamDeflectionFormat(modulusPa)} Pa.</p>
            <p><small>Assumptions: linear-elastic homogeneous material, small deflection, prismatic beam with constant E and I, Euler–Bernoulli theory (shear deformation neglected), static loading, and ideal pin/roller or fixed-free supports. Not suitable where shear deformation, plasticity, local/lateral buckling, connection flexibility, support settlement, or dynamic effects dominate. Deflected-shape sketches are schematic, not to scale.</small></p>
        `;
        if (typeof window.FormulaFoundryRenderMath === "function") window.FormulaFoundryRenderMath();
        updateBeamDeflectionDiagram(false, { maxDeflection: deflectionMagnitude, deflectionUnit });

        if (window.FormulaFoundryReport) {
            const dimensionInputs = entries.map(({ label, value, unit }) => ({ label, value, unit }));
            const inputs = [
                { label: "Loading / support case", value: caseDefinition.name, unit: "" },
                { label: "Support configuration", value: caseDefinition.support, unit: "" },
                { label: "Beam span (L)", value: span, unit: lengthUnit },
                { label: isPointLoad ? "Point load (P)" : "Uniform distributed load (w)", value: load, unit: loadUnit },
                { label: "Young's modulus (E)", value: modulus, unit: modulusUnit },
                { label: "Cross-section profile", value: window.BeamSectionUI.getName(profile), unit: "" },
                ...dimensionInputs,
                { label: "Bending axis", value: axisLabel, unit: "" }
            ];
            const outputs = [
                { label: "Cross-sectional area (A)", value: areaOutput, unit: areaUnit },
                { label: "Centroid x̄", value: centroidXOutput, unit: lengthDisplayUnit },
                { label: "Centroid ȳ", value: centroidYOutput, unit: lengthDisplayUnit },
                { label: "Second moment of area (Iₓ)", value: inertiaXOutput, unit: inertiaUnit },
                { label: "Second moment of area (Iᵧ)", value: inertiaYOutput, unit: inertiaUnit },
                { label: "Selected second moment of area (I)", value: selectedInertiaOutput, unit: inertiaUnit },
                { label: "Section modulus (Sₓ)", value: sectionModulusX, unit: lengthDisplayUnit + "³" },
                { label: "Section modulus (Sᵧ)", value: sectionModulusY, unit: lengthDisplayUnit + "³" },
                { label: "Maximum deflection (signed)", value: deflectionOutput, unit: deflectionUnit },
                { label: "Maximum deflection magnitude", value: deflectionMagnitude, unit: deflectionUnit },
                { label: "Maximum deflection location", value: locationOutput, unit: lengthUnit },
                { label: "Maximum bending moment", value: maxMomentOutput, unit: "N·m" },
                { label: "Flexural rigidity (EI)", value: flexuralRigidity, unit: "N·m²" }
            ];
            window.FormulaFoundryReport.recordResult({
                calculatorId: "beam-deflection",
                calculatorName: "Beam Deflection",
                path: "calculators/beam-deflection.html",
                title: caseDefinition.name + " — " + window.BeamSectionUI.getName(profile),
                inputs,
                outputs,
                diagram: {
                    type: "beam-deflection",
                    caseId: loadingCaseSelect.value,
                    span,
                    spanUnit: lengthUnit,
                    load,
                    loadUnit,
                    profile,
                    dimensions: { ...dimensions },
                    axis,
                    sectionUnit: "m",
                    maxDeflection: deflectionMagnitude,
                    deflectionUnit
                },
                equations: [...window.BeamSectionProperties.equations(profile), equation],
                assumptions: [
                    "Linear-elastic homogeneous material, small deflection, prismatic beam and constant E and I.",
                    "Euler–Bernoulli beam theory; shear deformation is neglected.",
                    "Static full-span loading with ideal pin/roller or fixed-free supports, as specified by the selected case.",
                    "The closed-form solution does not represent plasticity, buckling, connection flexibility, support settlement, or dynamic effects."
                ],
                method: "The selected cross-section determines its centroidal inertia about the chosen bending axis. The corresponding closed-form Euler–Bernoulli beam solution is then evaluated using span, elastic modulus, and the selected point or uniform load.",
                warnings: ["Use only for the listed load and support cases; partial or varying loads and non-ideal supports require a different model."]
            });
        }
    } catch (error) {
        beamResultPanel.innerHTML = `<h3>Invalid Input</h3><p>${beamDeflectionEscape(error.message)}</p>`;
        if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
    }
}

function resetBeamDeflectionCalculator() {
    beamLengthInput.value = "";
    pointLoadInput.value = "";
    distributedLoadInput.value = "";
    youngsModulusInput.value = "";
    const fields = Object.values(window.BeamSectionUI.profiles).flatMap((profile) => profile.fields);
    [...new Set(fields.map(({ id }) => id))].forEach((id) => { document.getElementById(id).value = ""; });
    [...new Set(fields.map(({ unit }) => unit))].forEach((unit) => { document.getElementById(unit).value = "mm"; });
    lengthUnitSelect.value = "m";
    loadUnitSelect.value = "N";
    distributedLoadUnitSelect.value = "N/m";
    modulusUnitSelect.value = "GPa";
    inertiaUnitSelect.value = "m⁴";
    deflectionUnitSelect.value = "m";
    loadingCaseSelect.value = "ss-point";
    document.getElementById("sectionType").value = "rectangular";
    document.getElementById("bendingAxis").value = "x";
    beamMaterialSelect.value = "";
    if (beamSpanSlider) delete beamSpanSlider.dataset.initialized;
    updateBeamDeflectionMode();
    beamResultPanel.innerHTML = "Ready to calculate.";
}

document.addEventListener("DOMContentLoaded", function () {
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.declareStructured();
    populateMaterialSelect(beamMaterialSelect, {
        placeholderText: "-- Select a material or enter a custom value --",
        formatLabel(material) {
            const modulusGPa = convertModulusToUnit(material.youngsModulus, "GPa");
            return `${material.displayName} (E = ${modulusGPa.toLocaleString(undefined, { maximumFractionDigits: 3 })} GPa)`;
        }
    });
    beamMaterialSelect.addEventListener("change", updateBeamDeflectionMaterialModulus);
    beamLengthInput.addEventListener("input", () => updateBeamDeflectionDiagram(false));
    beamLengthInput.addEventListener("change", () => updateBeamDeflectionDiagram(true));
    lengthUnitSelect.addEventListener("change", () => updateBeamDeflectionDiagram(true));
    [pointLoadInput, distributedLoadInput].forEach((input) => input.addEventListener("input", () => updateBeamDeflectionDiagram(false)));
    [loadUnitSelect, distributedLoadUnitSelect].forEach((select) => select.addEventListener("change", () => updateBeamDeflectionDiagram(false)));
    loadingCaseSelect.addEventListener("change", () => updateBeamDeflectionDiagram(false));
    if (beamSpanSlider) {
        beamSpanSlider.addEventListener("input", () => {
            beamLengthInput.value = beamSpanSlider.value;
            updateBeamDeflectionDiagram(false);
            calculateBeamDeflection();
        });
    }
    document.getElementById("bendingAxis").addEventListener("change", updateBeamDeflectionMode);
    document.querySelectorAll(".calculator-column .calculator-box input:not(#beamSpanSlider):not(#pointLoadSlider), .calculator-column .calculator-box select")
        .forEach((control) => {
            control.addEventListener("input", markBeamDeflectionInputsStale);
            control.addEventListener("change", () => {
                if (control === beamLengthInput) updateBeamDeflectionDiagram(true);
                if (beamDeflectionInputsReady()) calculateBeamDeflection();
            });
        });
    if (pointLoadSlider) {
        pointLoadSlider.addEventListener("input", () => {
            const direction = Number(pointLoadInput.value) < 0 ? -1 : 1;
            pointLoadInput.value = String(direction * Number(pointLoadSlider.value));
            updateBeamDeflectionDiagram(false, null, false);
            calculateBeamDeflection();
        });
    }
    document.querySelectorAll("#sectionType, #bendingAxis, .profile-inputs input, .profile-inputs select")
        .forEach((input) => input.addEventListener("input", () => {
            window.BeamSectionUI.updateDiagram(document, document.getElementById("sectionType").value, document.getElementById("bendingAxis").value);
        }));
    updateBeamDeflectionMode();
});
