// ======================================================
// Thick-Walled Cylinder Stress Analysis (Lamé equations)
// Sign convention: tension positive, compression negative.
// ======================================================

if (window.FormulaFoundryReport) {
    window.FormulaFoundryReport.declareStructured();
}

const THICK_CYLINDER_POINTS = 10; // equal radial intervals -> 11 stations

const THICK_CYLINDER_EQUATIONS = [
    "\\sigma_r(r) = \\frac{a^2 p_i - b^2 p_o}{b^2 - a^2} - \\frac{a^2 b^2\\,(p_i - p_o)}{\\left(b^2 - a^2\\right) r^2}",
    "\\sigma_\\theta(r) = \\frac{a^2 p_i - b^2 p_o}{b^2 - a^2} + \\frac{a^2 b^2\\,(p_i - p_o)}{\\left(b^2 - a^2\\right) r^2}",
    "\\sigma_z = \\frac{a^2 p_i - b^2 p_o}{b^2 - a^2} \\;\\text{(closed ends)} \\qquad \\sigma_z = 0 \\;\\text{(open / free ends)}"
];

const THICK_CYLINDER_ASSUMPTIONS = [
    "Linear elastic, isotropic, homogeneous material; small strains",
    "Long cylinder of uniform circular cross-section, concentric bore and outer surface",
    "Uniform internal pressure p_i and external pressure p_o (gauge); no thermal or body-force loading",
    "Sign convention: tension positive, compression negative; the radial stress equals -p at a pressurized surface",
    "Axial stress is uniform and follows the selected end condition (closed-ended or open/free-ended); constrained ends (plane strain) are not modeled",
    "Away from end closures, flanges, holes and other discontinuities; stress concentrations are not included"
];

function thickCylinderEl(id) {
    return document.getElementById(id);
}

function thickCylinderFmt(value) {
    return Number(value.toPrecision(6)).toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function thickCylinderError(message) {
    thickCylinderEl("result").innerHTML = `
        <h3>Invalid Input</h3>
        <p>${escapeHtml(message)}</p>
    `;
    thickCylinderEl("plot").innerHTML = "";
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}

// Pure SI math: radii in m, pressures in Pa. endCondition: "closed" | "open".
function computeThickCylinder({ innerRadius, outerRadius, internalPressure, externalPressure, endCondition = "closed", points = THICK_CYLINDER_POINTS }) {
    const values = [innerRadius, outerRadius, internalPressure, externalPressure];
    if (!values.every(Number.isFinite)) throw new Error("All dimensions and pressures must be valid finite numbers.");
    if (innerRadius <= 0) throw new Error("Inner diameter must be greater than zero.");
    if (outerRadius <= innerRadius) throw new Error("Outer diameter must be greater than the inner diameter.");
    if (internalPressure < 0 || externalPressure < 0) throw new Error("Pressures must be zero or positive (gauge).");
    if (endCondition !== "closed" && endCondition !== "open") throw new Error("Unknown end condition.");

    const a = innerRadius;
    const b = outerRadius;
    const denominator = b * b - a * a;
    const constantA = (a * a * internalPressure - b * b * externalPressure) / denominator;
    const constantB = a * a * b * b * (internalPressure - externalPressure) / denominator;
    const axial = endCondition === "closed" ? constantA : 0;

    function stressAt(r) {
        return { r, radial: constantA - constantB / (r * r), hoop: constantA + constantB / (r * r), axial };
    }

    const stations = [];
    for (let i = 0; i <= points; i += 1) {
        stations.push(stressAt(a + (b - a) * i / points));
    }
    const inner = stations[0];
    const outer = stations[points];
    const mid = stressAt((a + b) / 2);
    const governing = Math.abs(inner.hoop) >= Math.abs(outer.hoop) ? inner : outer;

    return { constantA, constantB, axial, inner, mid, outer, stations, stressAt, governing, governingLocation: governing === inner ? "inner surface" : "outer surface" };
}

// Inline SVG: radial and hoop stress versus radius (values already in display units)
function thickCylinderPlotSvg(stations, stressUnit, distanceUnit) {
    const W = 560, H = 320, left = 70, right = 15, top = 20, bottom = 55;
    const xs = stations.map((s) => s.x);
    const ys = stations.flatMap((s) => [s.radial, s.hoop]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    let yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
    if (yMax === yMin) { yMax = yMin + 1; }
    const pad = (yMax - yMin) * 0.08;
    yMin -= pad; yMax += pad;
    const px = (x) => left + (x - xMin) / (xMax - xMin) * (W - left - right);
    const py = (y) => top + (yMax - y) / (yMax - yMin) * (H - top - bottom);
    const line = (key) => stations.map((s) => `${px(s.x).toFixed(1)},${py(s[key]).toFixed(1)}`).join(" ");
    const yTicks = [yMin, (yMin + yMax) / 2, yMax].concat(0);
    const tick = (y) => `<line x1="${left}" x2="${W - right}" y1="${py(y).toFixed(1)}" y2="${py(y).toFixed(1)}" stroke="#ddd6cb"/><text x="${left - 6}" y="${(py(y) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#26282b">${Number(y.toPrecision(3))}</text>`;
    const xTicks = [xMin, (xMin + xMax) / 2, xMax].map((x) => `<text x="${px(x).toFixed(1)}" y="${H - bottom + 16}" text-anchor="middle" font-size="11" fill="#26282b">${Number(x.toPrecision(4))}</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Radial and hoop stress versus radius">
<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
${yTicks.map(tick).join("")}
<line x1="${left}" x2="${left}" y1="${top}" y2="${H - bottom}" stroke="#26282b"/>
<polyline points="${line("hoop")}" fill="none" stroke="#c05621" stroke-width="2.5"/>
<polyline points="${line("radial")}" fill="none" stroke="#44484c" stroke-width="2.5" stroke-dasharray="6 4"/>
${xTicks}
<text x="${(left + W - right) / 2}" y="${H - 22}" text-anchor="middle" font-size="12" fill="#26282b">Radius r (${escapeHtml(distanceUnit)})</text>
<text transform="translate(14 ${(top + H - bottom) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#26282b">Stress (${escapeHtml(stressUnit)})</text>
<line x1="${left + 10}" x2="${left + 40}" y1="${H - 8}" y2="${H - 8}" stroke="#c05621" stroke-width="2.5"/><text x="${left + 46}" y="${H - 4}" font-size="11" fill="#26282b">Hoop σθ</text>
<line x1="${left + 130}" x2="${left + 160}" y1="${H - 8}" y2="${H - 8}" stroke="#44484c" stroke-width="2.5" stroke-dasharray="6 4"/><text x="${left + 166}" y="${H - 4}" font-size="11" fill="#26282b">Radial σr</text>
</svg>`;
}

function calculateThickCylinder() {
    const innerDiameter = readNumberInput("innerDiameter");
    const outerDiameter = readNumberInput("outerDiameter");
    const internalPressure = readNumberInput("internalPressure");
    const externalPressure = readNumberInput("externalPressure");
    const endCondition = thickCylinderEl("endCondition").value;
    const distanceUnit = thickCylinderEl("distanceUnit").value;
    const stressUnit = thickCylinderEl("stressUnit").value;

    let r;
    try {
        r = computeThickCylinder({
            innerRadius: convertDistance(innerDiameter, distanceUnit) / 2,
            outerRadius: convertDistance(outerDiameter, distanceUnit) / 2,
            internalPressure: convertStress(internalPressure, stressUnit),
            externalPressure: convertStress(externalPressure, stressUnit),
            endCondition
        });
    } catch (error) {
        thickCylinderError(error.message);
        return;
    }

    const s = (pa) => convertStressToUnit(pa, stressUnit);
    const radiusOut = (m) => convertDistanceToUnit(m, distanceUnit);
    const endText = endCondition === "closed" ? "closed ends (pressure acts on the end closures)" : "open / free ends (σ_z = 0)";

    const rows = [["Inner surface (r = a)", r.inner], ["Mid-wall", r.mid], ["Outer surface (r = b)", r.outer]];
    const tableRows = rows.map(([name, v]) => `<tr><td>${name}</td><td>${thickCylinderFmt(radiusOut(v.r))}</td><td>${thickCylinderFmt(s(v.radial))}</td><td>${thickCylinderFmt(s(v.hoop))}</td><td>${thickCylinderFmt(s(v.axial))}</td></tr>`).join("");
    const distributionRows = r.stations.map((v) => `<tr><td>${thickCylinderFmt(radiusOut(v.r))}</td><td>${thickCylinderFmt(s(v.radial))}</td><td>${thickCylinderFmt(s(v.hoop))}</td></tr>`).join("");

    thickCylinderEl("result").innerHTML = `
        <h3>Result - Lamé Stresses in a Thick-Walled Cylinder</h3>
        <div class="result-value">Inner-surface hoop stress: ${thickCylinderFmt(s(r.inner.hoop))} ${escapeHtml(stressUnit)}</div>
        <p>Largest-magnitude hoop stress: ${thickCylinderFmt(s(r.governing.hoop))} ${escapeHtml(stressUnit)} at the ${r.governingLocation}</p>
        <p>Sign convention: tension positive, compression negative. End condition: ${endText}.</p>
        <div class="table-scroll"><table class="result-table">
            <thead><tr><th>Location</th><th>r (${escapeHtml(distanceUnit)})</th><th>σ<sub>r</sub> (${escapeHtml(stressUnit)})</th><th>σ<sub>θ</sub> (${escapeHtml(stressUnit)})</th><th>σ<sub>z</sub> (${escapeHtml(stressUnit)})</th></tr></thead>
            <tbody>${tableRows}</tbody>
        </table></div>
        <details><summary>Stress distribution across the wall (${r.stations.length} stations)</summary>
        <table class="result-table">
            <thead><tr><th>r (${escapeHtml(distanceUnit)})</th><th>σ<sub>r</sub> (${escapeHtml(stressUnit)})</th><th>σ<sub>θ</sub> (${escapeHtml(stressUnit)})</th></tr></thead>
            <tbody>${distributionRows}</tbody>
        </table></details>
        <p><small>Elastic analytical stresses only. This is not a pressure-vessel code check and does not establish allowable pressure, fatigue life or safe operating limits.</small></p>
    `;

    const plotStations = r.stations.map((v) => ({ x: radiusOut(v.r), radial: s(v.radial), hoop: s(v.hoop) }));
    thickCylinderEl("plot").innerHTML = thickCylinderPlotSvg(plotStations, stressUnit, distanceUnit);

    if (window.FormulaFoundryReport) {
        const pair = (name, v) => [
            { label: name + " radial stress (σr)", value: s(v.radial), unit: stressUnit },
            { label: name + " hoop stress (σθ)", value: s(v.hoop), unit: stressUnit },
            { label: name + " axial stress (σz)", value: s(v.axial), unit: stressUnit }
        ];
        window.FormulaFoundryReport.recordResult({
            calculatorId: "thick-walled-cylinder",
            calculatorName: "Thick-Walled Cylinder Stress Analysis",
            path: "calculators/thick-walled-cylinder.html",
            title: "Thick-walled cylinder, " + thickCylinderFmt(innerDiameter) + "/" + thickCylinderFmt(outerDiameter) + " " + distanceUnit,
            inputs: [
                { label: "Inner diameter (2a)", value: innerDiameter, unit: distanceUnit },
                { label: "Outer diameter (2b)", value: outerDiameter, unit: distanceUnit },
                { label: "Internal pressure (p_i)", value: internalPressure, unit: stressUnit },
                { label: "External pressure (p_o)", value: externalPressure, unit: stressUnit },
                { label: "Axial end condition", value: endCondition === "closed" ? "Closed ends" : "Open / free ends (σz = 0)", unit: "" }
            ],
            outputs: [].concat(pair("Inner surface", r.inner), pair("Mid-wall", r.mid), pair("Outer surface", r.outer), [
                { label: "Largest-magnitude hoop stress location", value: r.governingLocation, unit: "" }
            ]),
            equations: THICK_CYLINDER_EQUATIONS,
            assumptions: THICK_CYLINDER_ASSUMPTIONS,
            method: "Lamé solution for a long, linear-elastic thick-walled cylinder under uniform internal and external pressure. Tension is positive; the radial stress at a pressurized surface equals minus the pressure.",
            warnings: ["Elastic stresses only; not a pressure-vessel code check and not an allowable-pressure, fatigue or fracture assessment."]
        });
    }
}

function resetThickCylinderCalculator() {
    ["innerDiameter", "outerDiameter", "internalPressure"].forEach((id) => { thickCylinderEl(id).value = ""; });
    thickCylinderEl("externalPressure").value = "0";
    thickCylinderEl("endCondition").value = "closed";
    thickCylinderEl("distanceUnit").value = "mm";
    thickCylinderEl("stressUnit").value = "MPa";
    thickCylinderEl("result").innerHTML = "Ready to calculate.";
    thickCylinderEl("plot").innerHTML = "";
    if (window.FormulaFoundryReport) window.FormulaFoundryReport.clearResult();
}
