// ======================================================
// Formula Foundry - Design Studies calculator adapters
// Each adapter wraps a calculator's own pure calculation function
// (computeCylinderForce, computeDifferentialExpansion). No engineering
// formulas are duplicated here; adapters only translate between the
// scenario data model and the calculator's SI-based calculation API.
//
// Load AFTER js/engineering-units.js, the calculator script(s) and
// js/design-study-core.js.
//
// Supported: cylinder-force, differential-thermal-expansion.
// Not yet supported (see docs/design-studies.md): all other calculators.
// ======================================================
(function (root) {
    "use strict";

    const Studies = root.FormulaFoundryStudies;

    function distanceGroup(label, options, defaultUnit) {
        return {
            label, options, default: defaultUnit, percentMeaningful: true,
            toBase: (v, u) => convertDistance(v, u),
            fromBase: (v, u) => convertDistanceToUnit(v, u)
        };
    }

    // ---------- Hydraulic / Pneumatic Cylinder Force ----------

    const cylinder = {
        id: "cylinder-force",
        name: "Hydraulic/Pneumatic Cylinder Force",
        version: "1",
        path: "calculators/cylinder-force.html",
        groups: {
            distance: distanceGroup("bore and rod diameter", ["mm", "cm", "m", "in", "ft"], "mm"),
            pressure: {
                label: "working pressure", options: ["bar", "MPa", "kPa", "psi", "Pa"], default: "bar", percentMeaningful: true,
                toBase: (v, u) => convertStress(v, u), fromBase: (v, u) => convertStressToUnit(v, u)
            },
            force: {
                label: "force", options: ["N", "kN", "lbf"], default: "kN", percentMeaningful: true,
                toBase: (v, u) => convertForce(v, u), fromBase: (v, u) => convertForceToUnit(v, u)
            },
            area: {
                label: "area", options: ["mm²", "cm²", "m²", "in²"], default: "cm²", percentMeaningful: true,
                toBase: (v, u) => convertArea(v, u), fromBase: (v, u) => convertAreaToUnit(v, u)
            }
        },
        inputs: [
            { id: "boreDiameter", label: "Bore diameter (D)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "rodDiameter", label: "Rod diameter (d)", group: "distance", min: 0, sweepable: true },
            { id: "workingPressure", label: "Working pressure (p)", group: "pressure", min: 0, minExclusive: true, sweepable: true },
            { id: "efficiency", label: "Assumed efficiency (user supplied)", group: null, unit: "%", optional: true, min: 0, minExclusive: true, max: 100, sweepable: true }
        ],
        outputs: [
            { id: "pistonArea", label: "Full piston area (A_p)", group: "area", quantity: "area" },
            { id: "rodArea", label: "Rod area (A_r)", group: "area", quantity: "area" },
            { id: "annularArea", label: "Annular area (A_a)", group: "area", quantity: "area" },
            { id: "extensionForce", label: "Theoretical extension force", group: "force", quantity: "force" },
            { id: "retractionForce", label: "Theoretical retraction force", group: "force", quantity: "force" },
            { id: "usableExtension", label: "Estimated usable extension force", group: "force", quantity: "force-with-efficiency", optional: true },
            { id: "usableRetraction", label: "Estimated usable retraction force", group: "force", quantity: "force-with-efficiency", optional: true }
        ],
        equations: CYLINDER_FORCE_EQUATIONS,
        assumptions: CYLINDER_FORCE_ASSUMPTIONS,
        warnings: ["Theoretical force; not guaranteed delivered force.", "Does not check rod buckling, seal limits, pressure ratings or speed."],
        method: "Force equals net gauge pressure times the pressurized area. Extension acts on the full piston area; retraction acts on the annular area (piston area minus rod area).",
        calculate(values, units) {
            const num = (v) => (v === null || v === undefined ? NaN : v);
            const r = computeCylinderForce({
                bore: convertDistance(num(values.boreDiameter), units.distance),
                rod: convertDistance(num(values.rodDiameter), units.distance),
                pressure: convertStress(num(values.workingPressure), units.pressure),
                efficiency: values.efficiency === null || values.efficiency === undefined ? null : values.efficiency / 100
            });
            const area = (v) => convertAreaToUnit(v, units.area);
            const force = (v) => convertForceToUnit(v, units.force);
            const out = {
                pistonArea: area(r.pistonArea), rodArea: area(r.rodArea), annularArea: area(r.annularArea),
                extensionForce: force(r.extensionForce), retractionForce: force(r.retractionForce)
            };
            if (r.usableExtension !== null) {
                out.usableExtension = force(r.usableExtension);
                out.usableRetraction = force(r.usableRetraction);
            }
            return out;
        }
    };

    // ---------- Differential Thermal Expansion ----------

    const ALPHA_OPTIONS = Object.keys(DTE_ALPHA_UNITS);
    const dteInputs = [];
    DTE_MEMBERS.forEach((member) => {
        for (let n = 1; n <= DTE_SECTIONS; n += 1) {
            const required = member === "A" && n === 1;
            const section = "Member " + member + ", section " + n;
            const base = { group: null, optional: !required, sweepable: true, section };
            dteInputs.push(
                Object.assign({}, base, { id: member + n + "Length", label: section + " initial length (L0)", group: "length", min: 0, minExclusive: true }),
                Object.assign({}, base, { id: member + n + "Alpha", label: section + " coefficient (α)", group: "alpha" }),
                Object.assign({}, base, { id: member + n + "Ti", label: section + " initial temperature", group: "temperature" }),
                Object.assign({}, base, { id: member + n + "Tf", label: section + " final temperature", group: "temperature" })
            );
        }
    });

    const differentialThermal = {
        id: "differential-thermal-expansion",
        name: "Differential Thermal Expansion",
        version: "1",
        path: "calculators/differential-thermal-expansion.html",
        groups: {
            length: distanceGroup("input length", ["mm", "cm", "m", "in", "ft"], "mm"),
            alpha: {
                label: "coefficient of thermal expansion", options: ALPHA_OPTIONS, default: "10⁻⁶/°C", percentMeaningful: true,
                toBase: (v, u) => v * DTE_ALPHA_UNITS[u], fromBase: (v, u) => v / DTE_ALPHA_UNITS[u]
            },
            temperature: {
                label: "temperature", options: ["°C", "°F", "K"], default: "°C", percentMeaningful: false,
                toBase: (v, u) => dteToCelsius(v, u),
                fromBase: (v, u) => (u === "°F" ? v * 1.8 + 32 : u === "K" ? v + 273.15 : v)
            },
            outputLength: distanceGroup("expansion output", ["µm", "mm", "cm", "m", "in", "ft"], "mm")
        },
        inputs: dteInputs,
        outputs: [
            { id: "memberAExpansion", label: "Member A total expansion", group: "outputLength", quantity: "length-change" },
            { id: "memberBExpansion", label: "Member B total expansion", group: "outputLength", quantity: "length-change", optional: true },
            { id: "differential", label: "Differential movement (A − B)", group: "outputLength", quantity: "length-change", optional: true },
            { id: "finalLengthDifference", label: "Final length difference (A − B)", group: "outputLength", quantity: "length", optional: true }
        ],
        equations: DTE_EQUATIONS,
        assumptions: DTE_ASSUMPTIONS,
        warnings: ["Free expansion only; restraint, contact or mechanical loading would change the real movement and cause thermal stress that is not calculated here."],
        method: "Each section's free expansion is alpha times initial length times temperature change. A member's expansion is the sum of its sections. The differential movement subtracts member B's expansion from member A's.",
        calculate(values, units) {
            const readMember = (member) => {
                const sections = [];
                for (let n = 1; n <= DTE_SECTIONS; n += 1) {
                    const keys = ["Length", "Alpha", "Ti", "Tf"].map((f) => member + n + f);
                    const raws = keys.map((k) => values[k]);
                    const name = "Member " + member + ", section " + n;
                    if (raws.every((v) => v === null || v === undefined)) {
                        if (member === "A" && n === 1) throw new Error("Member A section 1 is required.");
                        continue;
                    }
                    if (!raws.every(Number.isFinite)) throw new Error(name + ": enter a length, coefficient and both temperatures.");
                    const [length, alpha, ti, tf] = raws;
                    if (length <= 0) throw new Error(name + ": initial length must be greater than zero.");
                    const tInitial = dteToCelsius(ti, units.temperature);
                    const tFinal = dteToCelsius(tf, units.temperature);
                    if (tInitial < -273.15 || tFinal < -273.15) throw new Error(name + ": temperatures must not be below absolute zero.");
                    sections.push({ label: name, length: convertDistance(length, units.length), alpha: alpha * DTE_ALPHA_UNITS[units.alpha], tInitial, tFinal });
                }
                return sections;
            };
            const result = computeDifferentialExpansion(readMember("A"), readMember("B"));
            const out = (m) => convertDistanceToUnit(m, units.outputLength);
            const outputs = { memberAExpansion: out(result.memberA.expansion) };
            if (result.memberB) {
                outputs.memberBExpansion = out(result.memberB.expansion);
                outputs.differential = out(result.differential);
                outputs.finalLengthDifference = out(result.finalLengthDifference);
            }
            return outputs;
        }
    };

    Studies.registerAdapter(cylinder);
    Studies.registerAdapter(differentialThermal);
})(window);
