// ======================================================
// Differential and Multi-Section Thermal Expansion Calculator
// Free (unrestrained) linear thermal expansion of up to two members,
// each made of up to three series sections.
// ======================================================

if (window.FormulaFoundryReport) {
    window.FormulaFoundryReport.declareStructured();
}

const DTE_MEMBERS = ["A", "B"];
const DTE_SECTIONS = 3;

const DTE_ALPHA_UNITS = {
    "10⁻⁶/°C": 1e-6,
    "10⁻⁶/K": 1e-6,
    "1/°C": 1,
    "1/K": 1,
    "10⁻⁶/°F": 1.8e-6
};

const DTE_EQUATIONS = [
    "\\Delta L_i = \\alpha_i\\,L_{0,i}\\,\\left(T_{f,i} - T_{i,i}\\right) \\qquad \\Delta L_{member} = \\sum_i \\Delta L_i",
    "\\Delta_{diff} = \\Delta L_A - \\Delta L_B \\qquad \\text{(positive: member A grows more than member B)}"
];

const DTE_ASSUMPTIONS = [
    "Free (unrestrained) linear expansion: each section changes length independently by alpha x L0 x change in temperature",
    "Coefficient of thermal expansion is constant over the temperature range and uniform within each section (no temperature gradient along a section)",
    "Sections of a member are in series along one axis; member movement is the sum of its section expansions",
    "Differential movement = member A expansion minus member B expansion",
    "Does not solve restrained, contacting or mechanically loaded assemblies: restraint, contact or load changes the real movement and produces thermal stress that is not calculated here"
];

function dteEl(id) {
    return document.getElementById(id);
}

function dteFmt(value) {
    return Number(value.toPrecision(6)).toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function dteError(message) {
    dteEl("result").innerHTML = `
        <h3>Invalid Input</h3>
        <p>${escapeHtml(message)}</p>
    `;
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

// Absolute temperature in the given unit -> °C
function dteToCelsius(value, unit) {
    if (unit === "°F") return (value - 32) / 1.8;
    if (unit === "K") return value - 273.15;
    return value;
}

// Pure SI math. Section: { length (m), alpha (1/°C), tInitial (°C), tFinal (°C), label }
function computeSectionExpansion(section) {
    const deltaT = section.tFinal - section.tInitial;
    const expansion = section.alpha * section.length * deltaT;
    return { deltaT, expansion, finalLength: section.length + expansion, strain: section.alpha * deltaT };
}

function computeMemberExpansion(sections) {
    const details = sections.map((section) => Object.assign({}, section, computeSectionExpansion(section)));
    const initialLength = details.reduce((sum, d) => sum + d.length, 0);
    const expansion = details.reduce((sum, d) => sum + d.expansion, 0);
    return { sections: details, initialLength, expansion, finalLength: initialLength + expansion };
}

// Differential movement = member A expansion - member B expansion
function computeDifferentialExpansion(sectionsA, sectionsB) {
    const memberA = computeMemberExpansion(sectionsA);
    const memberB = sectionsB && sectionsB.length ? computeMemberExpansion(sectionsB) : null;
    if (!memberB) return { memberA, memberB: null };
    return {
        memberA, memberB,
        differential: memberA.expansion - memberB.expansion,
        initialLengthDifference: memberA.initialLength - memberB.initialLength,
        finalLengthDifference: memberA.finalLength - memberB.finalLength
    };
}

function buildDteRows() {
    DTE_MEMBERS.forEach((member) => {
        const host = dteEl("members" + member);
        for (let n = 1; n <= DTE_SECTIONS; n += 1) {
            const id = "sec" + member + n;
            const row = document.createElement("div");
            row.className = "section-row";
            row.innerHTML = `
                <strong>Member ${member}, section ${n}${member === "A" && n === 1 ? " (required)" : " (optional)"}</strong>
                <label class="input-label" for="${id}Label">Label (optional)</label>
                <div class="input-row"><input id="${id}Label" type="text" maxlength="60" placeholder="e.g. valve pin"></div>
                <label class="input-label" for="${id}Material">Material (fills α, editable)</label>
                <select id="${id}Material" class="output-select" onchange="applyDteMaterial('${id}')"></select>
                <label class="input-label" for="${id}Length">Initial length (L<sub>0</sub>)</label>
                <div class="input-row"><input id="${id}Length" type="number" step="any" placeholder="Length"></div>
                <label class="input-label" for="${id}Alpha">Coefficient of thermal expansion (α)</label>
                <div class="input-row"><input id="${id}Alpha" type="number" step="any" placeholder="α"></div>
                <label class="input-label" for="${id}Ti">Initial temperature</label>
                <div class="input-row"><input id="${id}Ti" type="number" step="any" placeholder="Initial temperature"></div>
                <label class="input-label" for="${id}Tf">Final temperature</label>
                <div class="input-row"><input id="${id}Tf" type="number" step="any" placeholder="Final temperature"></div>`;
            host.appendChild(row);
            populateMaterialSelect(dteEl(id + "Material"), {
                placeholderText: "-- Custom (enter α) --",
                formatLabel(material) {
                    return `${material.displayName} (${(material.thermalExpansionCoefficient * 1e6).toFixed(1)} × 10⁻⁶ /°C)`;
                }
            });
        }
    });
}

function applyDteMaterial(id) {
    const key = dteEl(id + "Material").value;
    if (!key) return;
    const perCelsius = getMaterialProperty(key, "thermalExpansionCoefficient");
    dteEl(id + "Alpha").value = Number((perCelsius / DTE_ALPHA_UNITS[dteEl("alphaUnit").value]).toPrecision(8));
}

function readDteSections(member, units) {
    const sections = [];
    const display = [];
    for (let n = 1; n <= DTE_SECTIONS; n += 1) {
        const id = "sec" + member + n;
        const fields = ["Length", "Alpha", "Ti", "Tf"];
        const raws = fields.map((f) => dteEl(id + f).value.trim());
        if (raws.every((v) => v === "")) {
            if (member === "A" && n === 1) throw new Error("Member A section 1 is required.");
            continue;
        }
        const name = `Member ${member}, section ${n}`;
        const [length, alpha, ti, tf] = raws.map((v) => (v === "" ? NaN : Number(v)));
        if (![length, alpha, ti, tf].every(Number.isFinite)) throw new Error(`${name}: enter a length, coefficient and both temperatures.`);
        if (length <= 0) throw new Error(`${name}: initial length must be greater than zero.`);
        const tInitial = dteToCelsius(ti, units.temperature);
        const tFinal = dteToCelsius(tf, units.temperature);
        if (tInitial < -273.15 || tFinal < -273.15) throw new Error(`${name}: temperatures must not be below absolute zero.`);
        sections.push({
            label: dteEl(id + "Label").value.trim().slice(0, 60) || name,
            length: convertDistance(length, units.length),
            alpha: alpha * DTE_ALPHA_UNITS[units.alpha],
            tInitial, tFinal
        });
        display.push({ name, label: dteEl(id + "Label").value.trim().slice(0, 60), length, alpha, ti, tf });
    }
    return { sections, display };
}

function calculateDifferentialThermalExpansion() {
    const units = {
        length: dteEl("lengthUnit").value,
        alpha: dteEl("alphaUnit").value,
        temperature: dteEl("temperatureUnit").value
    };
    const outUnit = dteEl("outputLengthUnit").value;

    let a, b, result;
    try {
        a = readDteSections("A", units);
        b = readDteSections("B", units);
        result = computeDifferentialExpansion(a.sections, b.sections);
    } catch (error) {
        dteError(error.message);
        return;
    }
    if (!Number.isFinite(result.memberA.expansion) || (result.memberB && !Number.isFinite(result.memberB.expansion))) {
        dteError("The calculation produced a non-finite result.");
        return;
    }

    const out = (m) => convertDistanceToUnit(m, outUnit);
    const memberRows = (member, data) => data.sections.map((d) =>
        `<tr><td>${escapeHtml(d.label)}</td><td>${dteFmt(out(d.length))}</td><td>${dteFmt(d.deltaT)}</td><td>${dteFmt(out(d.expansion))}</td></tr>`).join("") +
        `<tr><td><strong>Member ${member} total</strong></td><td>${dteFmt(out(data.initialLength))}</td><td></td><td><strong>${dteFmt(out(data.expansion))}</strong></td></tr>`;

    let html = `
        <h3>Result - Free Thermal Expansion${result.memberB ? " and Differential Movement" : ""}</h3>
        <div class="result-value">Member A expansion: ${dteFmt(out(result.memberA.expansion))} ${escapeHtml(outUnit)}</div>`;
    if (result.memberB) {
        html += `<div class="result-value">Member B expansion: ${dteFmt(out(result.memberB.expansion))} ${escapeHtml(outUnit)}</div>
        <div class="result-value">Differential (A − B): ${dteFmt(out(result.differential))} ${escapeHtml(outUnit)}</div>`;
    }
    html += `
        <p><small>Positive expansion = lengthening; negative = contraction. Positive differential means member A lengthens more than member B.</small></p>
        <table class="result-table">
            <thead><tr><th>Section</th><th>L<sub>0</sub> (${escapeHtml(outUnit)})</th><th>ΔT (°C)</th><th>ΔL (${escapeHtml(outUnit)})</th></tr></thead>
            <tbody>${memberRows("A", result.memberA)}${result.memberB ? memberRows("B", result.memberB) : ""}</tbody>
        </table>`;
    if (result.memberB) {
        html += `
        <p>Member A final length: ${dteFmt(out(result.memberA.finalLength))} ${escapeHtml(outUnit)}; member B final length: ${dteFmt(out(result.memberB.finalLength))} ${escapeHtml(outUnit)}</p>
        <p>Length difference (A − B): initial ${dteFmt(out(result.initialLengthDifference))} ${escapeHtml(outUnit)} → final ${dteFmt(out(result.finalLengthDifference))} ${escapeHtml(outUnit)}</p>`;
    }
    html += `<p><small>Free expansion only. If the parts are restrained, in contact or loaded, the real movement differs and thermal stress develops; that is not solved here.</small></p>`;
    dteEl("result").innerHTML = html;

    if (window.FormulaFoundryReport) {
        const inputs = [
            { label: "Length unit", value: units.length, unit: "" },
            { label: "Temperature unit", value: units.temperature, unit: "" },
            { label: "Coefficient unit", value: units.alpha, unit: "" }
        ];
        const outputs = [];
        [["A", a, result.memberA], ["B", b, result.memberB]].forEach(([member, read, data]) => {
            if (!data) return;
            read.display.forEach((d, i) => {
                const tag = d.name + (d.label ? " (" + d.label + ")" : "");
                inputs.push(
                    { label: tag + " initial length", value: d.length, unit: units.length },
                    { label: tag + " coefficient (α)", value: d.alpha, unit: units.alpha },
                    { label: tag + " initial temperature", value: d.ti, unit: units.temperature },
                    { label: tag + " final temperature", value: d.tf, unit: units.temperature }
                );
                outputs.push({ label: tag + " expansion (ΔL)", value: out(data.sections[i].expansion), unit: outUnit });
            });
            outputs.push({ label: "Member " + member + " total expansion", value: out(data.expansion), unit: outUnit });
        });
        if (result.memberB) {
            outputs.push({ label: "Differential movement (A − B)", value: out(result.differential), unit: outUnit });
            outputs.push({ label: "Final length difference (A − B)", value: out(result.finalLengthDifference), unit: outUnit });
        }
        window.FormulaFoundryReport.recordResult({
            calculatorId: "differential-thermal-expansion",
            calculatorName: "Differential Thermal Expansion",
            path: "calculators/differential-thermal-expansion.html",
            title: result.memberB ? "Differential thermal expansion (A − B)" : "Thermal expansion, member A",
            inputs, outputs,
            equations: DTE_EQUATIONS,
            assumptions: DTE_ASSUMPTIONS,
            method: "Each section's free expansion is alpha times initial length times temperature change. A member's expansion is the sum of its sections. The differential movement subtracts member B's expansion from member A's.",
            warnings: ["Free expansion only; restraint, contact or mechanical loading would change the real movement and cause thermal stress that is not calculated here."]
        });
    }
}

function resetDifferentialThermalExpansionCalculator() {
    DTE_MEMBERS.forEach((member) => {
        for (let n = 1; n <= DTE_SECTIONS; n += 1) {
            const id = "sec" + member + n;
            ["Label", "Length", "Alpha", "Ti", "Tf"].forEach((f) => { dteEl(id + f).value = ""; });
            dteEl(id + "Material").value = "";
        }
    });
    dteEl("lengthUnit").value = "mm";
    dteEl("alphaUnit").value = "10⁻⁶/°C";
    dteEl("temperatureUnit").value = "°C";
    dteEl("outputLengthUnit").value = "mm";
    dteEl("result").innerHTML = "Ready to calculate.";
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

document.addEventListener("DOMContentLoaded", buildDteRows);
