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
// Supported: cylinder-force, differential-thermal-expansion, press-fit,
// Hertzian contact, shaft torsion, the two beam calculators, and the
// bolt-torque, moment, bearing-life, column-buckling, factor-of-safety,
// fillet-weld, spring, stress-strain, thermal-expansion, thick-walled-cylinder
// and thread-strength calculators (via their *-calculation.js engines).
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

    const materialOptions = getMaterialList();
    const materialLabels = Object.fromEntries(materialOptions.map((key) => [key, getMaterial(key).displayName]));
    const materialsWithProperties = (...properties) => materialOptions.filter((key) => properties.every((property) => {
        const value = getMaterialProperty(key, property);
        if (!Number.isFinite(value)) return false;
        if ((property === "youngsModulus" || property === "shearModulus") && value <= 0) return false;
        return property !== "poissonRatio" || (value >= 0 && value < 0.5);
    }));
    function categorical(id, label, options, optionLabels = {}, optional = false) {
        return { id, label, group: null, unit: "", options, optionLabels, optional, sweepable: false };
    }
    function materialInput(adapter, values, units, selectionId, inputId, property) {
        if (Number.isFinite(values[inputId])) return values[inputId];
        const materialValue = getMaterialProperty(values[selectionId], property);
        if (!Number.isFinite(materialValue)) return NaN;
        const input = adapter.inputs.find((item) => item.id === inputId);
        return input && input.group ? adapter.groups[input.group].fromBase(materialValue, units[input.group]) : materialValue;
    }

    const ALPHA_OPTIONS = Object.keys(DTE_ALPHA_UNITS);
    const alphaMaterialOptions = materialsWithProperties("thermalExpansionCoefficient");
    const alphaMaterialLabels = Object.fromEntries(alphaMaterialOptions.map((key) => [key, getMaterial(key).displayName]));
    const dteInputs = [];
    const dteMaterialBindings = [];
    DTE_MEMBERS.forEach((member) => {
        for (let n = 1; n <= DTE_SECTIONS; n += 1) {
            const required = member === "A" && n === 1;
            const section = "Member " + member + ", section " + n;
            const base = { group: null, optional: !required, sweepable: true, section };
            dteInputs.push(
                Object.assign({}, base, { id: member + n + "Length", label: section + " initial length (L0)", group: "length", min: 0, minExclusive: true }),
                Object.assign({}, base, { id: member + n + "Alpha", label: section + " coefficient (α)", group: "alpha", optional: true }),
                Object.assign(categorical(member + n + "Material", section + " material", alphaMaterialOptions, alphaMaterialLabels, true), { section }),
                Object.assign({}, base, { id: member + n + "Ti", label: section + " initial temperature", group: "temperature" }),
                Object.assign({}, base, { id: member + n + "Tf", label: section + " final temperature", group: "temperature" })
            );
            dteMaterialBindings.push({
                selectionId: member + n + "Material",
                inputs: [{ id: member + n + "Alpha", property: "thermalExpansionCoefficient", group: "alpha" }]
            });
        }
    });

    const differentialThermal = {
        id: "differential-thermal-expansion",
        name: "Differential Thermal Expansion",
        version: "2",
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
        materialBindings: dteMaterialBindings,
        outputs: [
            { id: "memberAExpansion", label: "Member A total expansion", group: "outputLength", quantity: "length-change" },
            { id: "memberBExpansion", label: "Member B total expansion", group: "outputLength", quantity: "length-change", optional: true },
            { id: "differential", label: "Differential movement (A − B)", group: "outputLength", quantity: "length-change", optional: true },
            { id: "finalLengthDifference", label: "Final length difference (A − B)", group: "outputLength", quantity: "length", optional: true }
        ],
        equations: DTE_EQUATIONS,
        assumptions: DTE_ASSUMPTIONS.concat(["A selected material supplies its database thermal expansion coefficient; an entered coefficient takes precedence."]),
        warnings: ["Free expansion only; restraint, contact or mechanical loading would change the real movement and cause thermal stress that is not calculated here."],
        method: "Each section's free expansion is alpha times initial length times temperature change. A member's expansion is the sum of its sections. The differential movement subtracts member B's expansion from member A's.",
        calculate(values, units) {
            const readMember = (member) => {
                const sections = [];
                for (let n = 1; n <= DTE_SECTIONS; n += 1) {
                    const keys = ["Length", "Alpha", "Ti", "Tf", "Material"].map((f) => member + n + f);
                    const raws = keys.map((k) => values[k]);
                    const name = "Member " + member + ", section " + n;
                    if (raws.every((v) => v === null || v === undefined)) {
                        if (member === "A" && n === 1) throw new Error("Member A section 1 is required.");
                        continue;
                    }
                    const [length, inputAlpha, ti, tf, material] = raws;
                    const materialAlpha = material ? getMaterialProperty(material, "thermalExpansionCoefficient") : null;
                    const alpha = Number.isFinite(inputAlpha) ? inputAlpha :
                        (Number.isFinite(materialAlpha) ? materialAlpha / DTE_ALPHA_UNITS[units.alpha] : NaN);
                    if (![length, alpha, ti, tf].every(Number.isFinite)) throw new Error(name + ": enter a length, coefficient or material, and both temperatures.");
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

    function unitGroup(label, options, defaultUnit, toBase, fromBase, percentMeaningful = true) {
        return { label, options, default: defaultUnit, percentMeaningful, toBase, fromBase };
    }

    const distanceUnits = ["mm", "cm", "m", "in", "ft"];
    const stressUnits = ["Pa", "MPa", "GPa", "psi", "ksi"];
    const modulusUnits = ["Pa", "MPa", "GPa", "psi", "ksi"];
    const forceUnits = ["N", "kN", "lbf"];
    const torqueUnits = ["N·mm", "N·m", "kN·m", "lbf·in", "lbf·ft"];
    const stressGroup = (label = "stress", options = stressUnits) => unitGroup(
        label, options, "MPa", (value, unit) => convertStress(value, unit), (value, unit) => convertStressToUnit(value, unit)
    );
    const forceGroup = (label = "force", defaultUnit = "N") => unitGroup(
        label, forceUnits, defaultUnit, (value, unit) => convertForce(value, unit), (value, unit) => convertForceToUnit(value, unit)
    );
    const momentGroup = (label = "moment") => unitGroup(
        label, torqueUnits, "N·m", (value, unit) => convertMoment(value, unit), (value, unit) => convertMomentToUnit(value, unit)
    );
    const areaGroup = unitGroup(
        "area", ["mm²", "cm²", "m²", "in²"], "mm²", (value, unit) => convertArea(value, unit), (value, unit) => convertAreaToUnit(value, unit)
    );
    const inertiaGroup = unitGroup(
        "area moment of inertia", ["mm⁴", "cm⁴", "m⁴", "in⁴"], "mm⁴",
        (value, unit) => convertAreaMomentInertia(value, unit), (value, unit) => convertAreaMomentInertiaToUnit(value, unit)
    );
    const modulusGroup = unitGroup(
        "elastic modulus", modulusUnits, "GPa", (value, unit) => convertModulus(value, unit), (value, unit) => convertModulusToUnit(value, unit)
    );
    const factorGroup = unitGroup("screening factor", ["×"], "×", (value) => value, (value) => value);
    const pressFit = {
        id: "press-fit",
        name: "Press-Fit Stress",
        version: "3",
        path: "calculators/press-fit.html",
        groups: {
            distance: distanceGroup("diameter and engagement length", distanceUnits, "mm"),
            interference: distanceGroup("diametral interference", ["mm", "µm", "in"], "mm"),
            stress: stressGroup("stress and contact pressure", ["MPa", "GPa", "psi", "ksi"]),
            force: forceGroup("force", "kN"),
            torque: momentGroup(),
            factor: factorGroup
        },
        inputs: [
            { id: "interfaceDiameter", label: "Interface diameter (d)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "diametralInterference", label: "Diametral interference (Δd)", group: "interference", min: 0, minExclusive: true, sweepable: true },
            { id: "hubOuterDiameter", label: "Hub outer diameter (D)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "shaftBoreDiameter", label: "Shaft bore diameter (dᵢ; zero for solid shaft)", group: "distance", min: 0, sweepable: true },
            { id: "engagementLength", label: "Engagement length (L)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "frictionCoefficient", label: "Assumed friction coefficient (μ)", group: null, unit: "", min: 0, minExclusive: true, sweepable: true },
            categorical("hubMaterial", "Hub material", materialOptions, materialLabels),
            categorical("shaftMaterial", "Shaft material", materialOptions, materialLabels)
        ],
        outputs: [
            { id: "contactPressure", label: "Contact pressure", group: "stress", quantity: "pressure" },
            { id: "hubHoopStress", label: "Hub bore hoop stress (tensile)", group: "stress", quantity: "stress" },
            { id: "shaftHoopStress", label: "Shaft outer-surface hoop stress (compressive)", group: "stress", quantity: "stress" },
            { id: "assemblyForce", label: "Idealized assembly force", group: "force", quantity: "force" },
            { id: "torqueCapacity", label: "Idealized torque capacity", group: "torque", quantity: "torque" },
            { id: "hubFos", label: "Hub elastic/yield screening factor", group: "factor", quantity: "factor", optional: true },
            { id: "shaftFos", label: "Shaft elastic/yield screening factor", group: "factor", quantity: "factor", optional: true },
            { id: "controllingFos", label: "Controlling elastic/yield screening factor", group: "factor", quantity: "factor", optional: true }
        ],
        equations: PRESS_FIT_EQUATIONS,
        assumptions: [
            "Elastic Lamé thick-cylinder model for a uniform nominal interface pressure and perfect cylindrical geometry.",
            "Nominal interference is used directly; no roughness, asperity flattening, tolerance stack-up, chamfer, end-effect, thermal residual stress, or plasticity correction.",
            "Material properties are the selected database Young's modulus, Poisson's ratio, and optional yield strength.",
            "Reported hoop stresses are the interface values only; no three-dimensional or von Mises stress analysis.",
            "Friction force and torque are idealized using the user-supplied coefficient; they are not guaranteed assembly or service capacities."
        ],
        warnings: [
            "The yield comparison is an elastic hoop-stress screening factor, not a complete press-fit design-code factor of safety.",
            "An overall controlling screening factor is reported only when both hub and shaft yield strengths are available.",
            "Verify fit tolerances, material data, friction, stress concentrations, and applicable fit standards."
        ],
        warningsFor(values) {
            const unscreened = [];
            if (!Number.isFinite(getMaterialProperty(values.hubMaterial, "yieldStrength"))) unscreened.push("hub");
            if (!Number.isFinite(getMaterialProperty(values.shaftMaterial, "yieldStrength"))) unscreened.push("shaft");
            return unscreened.length
                ? ["Yield-strength screening is unavailable for the " + unscreened.join(" and ") + "; no overall controlling factor is reported."]
                : [];
        },
        method: "Calls computePressFit() from the press-fit calculator's SI calculation engine after applying the selected materials and unit conversions.",
        calculate(values, units) {
            const required = ["interfaceDiameter", "diametralInterference", "hubOuterDiameter", "shaftBoreDiameter", "engagementLength", "frictionCoefficient"];
            if (!required.every((id) => Number.isFinite(values[id]))) throw new Error("Enter all press-fit geometry and friction inputs.");
            const d = convertDistance(values.interfaceDiameter, units.distance);
            const deltaDiametral = convertDistance(values.diametralInterference, units.interference);
            const D = convertDistance(values.hubOuterDiameter, units.distance);
            const di = convertDistance(values.shaftBoreDiameter, units.distance);
            const L = convertDistance(values.engagementLength, units.distance);
            const mu = values.frictionCoefficient;
            if (d <= 0) throw new Error("Interface diameter must be greater than zero.");
            if (deltaDiametral <= 0) throw new Error("Diametral interference must be greater than zero.");
            if (D <= d) throw new Error("Hub outer diameter must be greater than the interface diameter.");
            if (di < 0) throw new Error("Shaft bore diameter cannot be negative (use 0 for a solid shaft).");
            if (di >= d) throw new Error("Shaft bore diameter must be less than the interface diameter.");
            if (L <= 0) throw new Error("Engagement length must be greater than zero.");
            if (mu <= 0) throw new Error("Friction coefficient must be greater than zero.");
            const result = computePressFit({
                d, deltaDiametral, D, di, L, mu,
                hub: getPressFitMaterial(values.hubMaterial, "hub"),
                shaft: getPressFitMaterial(values.shaftMaterial, "shaft")
            });
            const numeric = [result.p, result.hubHoop, result.shaftHoop, result.pressForce, result.torqueCapacity];
            if (!numeric.every(Number.isFinite) || result.p <= 0) throw new Error("The calculation produced a non-finite or non-physical result. Check the inputs.");
            const outputs = {
                contactPressure: convertStressToUnit(result.p, units.stress),
                hubHoopStress: convertStressToUnit(result.hubHoop, units.stress),
                shaftHoopStress: convertStressToUnit(result.shaftHoop, units.stress),
                assemblyForce: convertForceToUnit(result.pressForce, units.force),
                torqueCapacity: convertMomentToUnit(result.torqueCapacity, units.torque)
            };
            if (result.fosHub !== null) outputs.hubFos = result.fosHub;
            if (result.fosShaft !== null) outputs.shaftFos = result.fosShaft;
            if (result.fosControlling !== null) outputs.controllingFos = result.fosControlling;
            return outputs;
        }
    };

    const hertz = {
        id: "hertzian-contact",
        name: "Hertzian Contact Stress",
        version: "2",
        path: "calculators/hertzian-contact.html",
        groups: {
            distance: distanceGroup("body diameter and contact length", ["µm", ...distanceUnits], "mm"),
            contactSize: distanceGroup("contact dimensions", ["µm", "mm", "cm", "m", "in"], "mm"),
            force: forceGroup(),
            modulus: modulusGroup,
            stress: stressGroup("contact stress"),
            lineLoad: unitGroup(
                "line load", ["N/m", "kN/m", "lbf/ft"], "N/m",
                (value, unit) => convertDistributedLoad(value, unit), (value, unit) => convertDistributedLoadToUnit(value, unit)
            )
        },
        inputs: [
            categorical("configuration", "Contact model", ["cylinders", "spheres"], { cylinders: "Two cylinders (line contact)", spheres: "Two spheres (point contact)" }),
            categorical("shape2", "Body 2 shape", ["convex", "flat", "concave"], { convex: "Convex", flat: "Flat plate", concave: "Concave (internal)" }),
            { id: "diameter1", label: "Body 1 diameter", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "diameter2", label: "Body 2 diameter (omit for a flat plate)", group: "distance", min: 0, minExclusive: true, optional: true, sweepable: true },
            { id: "contactLength", label: "Contact length (cylinders only)", group: "distance", min: 0, minExclusive: true, optional: true, sweepable: true },
            { id: "contactForce", label: "Normal contact force", group: "force", min: 0, minExclusive: true, sweepable: true },
            categorical("material1", "Body 1 material", materialsWithProperties("youngsModulus", "poissonRatio"), materialLabels, true),
            { id: "modulus1", label: "Body 1 Young's modulus", group: "modulus", min: 0, minExclusive: true, sweepable: true },
            { id: "poisson1", label: "Body 1 Poisson's ratio", group: null, unit: "", min: 0, max: 0.5, sweepable: true },
            categorical("material2", "Body 2 material", materialsWithProperties("youngsModulus", "poissonRatio"), materialLabels, true),
            { id: "modulus2", label: "Body 2 Young's modulus", group: "modulus", min: 0, minExclusive: true, sweepable: true },
            { id: "poisson2", label: "Body 2 Poisson's ratio", group: null, unit: "", min: 0, max: 0.5, sweepable: true }
        ],
        materialBindings: [
            { selectionId: "material1", inputs: [{ id: "modulus1", property: "youngsModulus" }, { id: "poisson1", property: "poissonRatio" }] },
            { selectionId: "material2", inputs: [{ id: "modulus2", property: "youngsModulus" }, { id: "poisson2", property: "poissonRatio" }] }
        ],
        outputs: [
            { id: "effectiveModulus", label: "Effective elastic modulus (E*)", group: "stress", quantity: "stress" },
            { id: "effectiveRadius", label: "Equivalent radius (R)", group: "distance", quantity: "length" },
            { id: "lineLoad", label: "Line load (w)", group: "lineLoad", quantity: "force-per-length", optional: true },
            { id: "halfWidth", label: "Contact half-width (b)", group: "contactSize", quantity: "length", optional: true },
            { id: "contactWidth", label: "Contact width (2b)", group: "contactSize", quantity: "length", optional: true },
            { id: "contactRadius", label: "Contact radius (a)", group: "contactSize", quantity: "length", optional: true },
            { id: "approach", label: "Approach of centres (δ)", group: "contactSize", quantity: "length", optional: true },
            { id: "maxPressure", label: "Maximum contact pressure (pₘₐₓ)", group: "stress", quantity: "stress" },
            { id: "meanPressure", label: "Mean contact pressure", group: "stress", quantity: "stress" },
            { id: "maxShear", label: "Approximate maximum shear stress", group: "stress", quantity: "stress" },
            { id: "maxShearDepth", label: "Depth of maximum shear", group: "contactSize", quantity: "length" }
        ],
        equations: HERTZ_COMMON_EQUATIONS,
        equationsFor(values) {
            return values.configuration === "spheres" ? HERTZ_SPHERE_EQUATIONS : HERTZ_CYLINDER_EQUATIONS;
        },
        comparisonKey(scenario) {
            return scenario.inputs.configuration;
        },
        assumptions: HERTZ_ASSUMPTIONS.concat(["Selected body materials populate database E and ν values; directly entered numeric properties take precedence."]),
        warnings: [
            "Cylinder results require parallel, sufficiently long cylinders with uniform load and no edge effects.",
            "Maximum shear stress uses approximate ν ≈ 0.3 coefficients; pressure is not a fatigue, wear, yield, or service-life assessment."
        ],
        method: "Calls computeHertzContact() using exactly one selected geometry: cylinders for line contact or spheres for point contact, with the selected body 2 curvature.",
        calculate(values, units) {
            const number = (id) => values[id] === null || values[id] === undefined ? NaN : values[id];
            const r = computeHertzContact({
                configuration: values.configuration,
                shape2: values.shape2,
                diameter1: convertDistance(number("diameter1"), units.distance),
                diameter2: values.shape2 === "flat" ? null : convertDistance(number("diameter2"), units.distance),
                length: values.configuration === "cylinders" ? convertDistance(number("contactLength"), units.distance) : null,
                force: convertForce(number("contactForce"), units.force),
                E1: convertModulus(materialInput(hertz, values, units, "material1", "modulus1", "youngsModulus"), units.modulus),
                nu1: materialInput(hertz, values, units, "material1", "poisson1", "poissonRatio"),
                E2: convertModulus(materialInput(hertz, values, units, "material2", "modulus2", "youngsModulus"), units.modulus),
                nu2: materialInput(hertz, values, units, "material2", "poisson2", "poissonRatio")
            });
            const stress = (value) => convertStressToUnit(value, units.stress);
            const length = (value) => convertDistanceToUnit(value, units.contactSize);
            const outputs = {
                effectiveModulus: stress(r.effectiveModulus),
                effectiveRadius: convertDistanceToUnit(r.effectiveRadius, units.distance),
                maxPressure: stress(r.maxPressure),
                meanPressure: stress(r.meanPressure),
                maxShear: stress(r.maxShear),
                maxShearDepth: length(r.maxShearDepth)
            };
            if (r.lineLoad !== undefined) outputs.lineLoad = convertDistributedLoadToUnit(r.lineLoad, units.lineLoad);
            ["halfWidth", "contactWidth", "contactRadius", "approach"].forEach((id) => {
                if (r[id] !== undefined) outputs[id] = length(r[id]);
            });
            return outputs;
        }
    };

    const shaftTorsion = {
        id: "shaft-torsion",
        name: "Shaft Torsion",
        version: "2",
        path: "calculators/shaft-torsion.html",
        groups: {
            torque: momentGroup(),
            shaftDiameter: distanceGroup("shaft diameter", ["mm", "cm", "m", "in"], "m"),
            length: distanceGroup("shaft length", distanceUnits, "m"),
            modulus: modulusGroup,
            stress: stressGroup("shear stress"),
            inertia: unitGroup("polar moment of inertia", ["m⁴"], "m⁴", (value) => value, (value) => value),
            angle: unitGroup("angle of twist", ["rad", "°"], "°",
                (value, unit) => unit === "°" ? value * Math.PI / 180 : value,
                (value, unit) => unit === "°" ? value * 180 / Math.PI : value),
            stiffness: unitGroup("torsional stiffness", ["N·m/rad"], "N·m/rad", (value) => value, (value) => value)
        },
        inputs: [
            categorical("shaftType", "Shaft geometry", ["solid", "hollow"], { solid: "Solid circular shaft", hollow: "Hollow circular shaft" }),
            { id: "torque", label: "Applied torque", group: "torque", sweepable: true },
            { id: "outerDiameter", label: "Outer diameter", group: "shaftDiameter", min: 0, minExclusive: true, sweepable: true },
            { id: "innerDiameter", label: "Inner diameter (hollow shaft only)", group: "shaftDiameter", min: 0, optional: true, sweepable: true },
            { id: "length", label: "Shaft length", group: "length", min: 0, minExclusive: true, sweepable: true },
            categorical("material", "Shaft material", materialsWithProperties("shearModulus"), materialLabels, true),
            { id: "shearModulus", label: "Shear modulus (G)", group: "modulus", min: 0, minExclusive: true, sweepable: true }
        ],
        materialBindings: [
            { selectionId: "material", inputs: [{ id: "shearModulus", property: "shearModulus" }] }
        ],
        outputs: [
            { id: "polarMoment", label: "Polar moment of inertia (J)", group: "inertia", quantity: "area-moment-of-inertia" },
            { id: "maximumShearStress", label: "Maximum shear stress (signed)", group: "stress", quantity: "stress" },
            { id: "angleOfTwist", label: "Angle of twist (signed)", group: "angle", quantity: "angle" },
            { id: "torsionalStiffness", label: "Torsional stiffness", group: "stiffness", quantity: "torsional-stiffness" }
        ],
        equations: SHAFT_TORSION_EQUATIONS,
        assumptions: [
            "Circular, prismatic shaft with constant torque, length, and shear modulus.",
            "Linear-elastic Saint-Venant torsion; solid or concentric hollow circular section only.",
            "A selected material supplies its database shear modulus; a directly entered value takes precedence.",
            "Shear stress is signed with applied torque; material strength, stress concentrations, fatigue, buckling, and yielding are not assessed."
        ],
        warnings: ["Select the intended solid or hollow shaft explicitly; a hollow-shaft inner diameter must be smaller than its outer diameter."],
        method: "Calls computeShaftTorsion() with the selected shaft geometry and SI-converted torque, dimensions, and shear modulus.",
        calculate(values, units) {
            const number = (id) => values[id] === null || values[id] === undefined ? NaN : values[id];
            const result = computeShaftTorsion({
                shaftType: values.shaftType,
                torqueNm: convertMoment(number("torque"), units.torque),
                outerDiameterM: convertDistance(number("outerDiameter"), units.shaftDiameter),
                innerDiameterM: values.shaftType === "hollow" ? convertDistance(number("innerDiameter"), units.shaftDiameter) : null,
                lengthM: convertDistance(number("length"), units.length),
                modulusPa: convertModulus(materialInput(shaftTorsion, values, units, "material", "shearModulus", "shearModulus"), units.modulus)
            });
            return {
                polarMoment: convertAreaMomentInertiaToUnit(result.J, units.inertia),
                maximumShearStress: convertStressToUnit(result.tauMaxPa, units.stress),
                angleOfTwist: units.angle === "°" ? result.thetaDegrees : result.thetaRadians,
                torsionalStiffness: result.stiffness
            };
        }
    };

    const beamProfiles = {
        rectangular: [
            { key: "width", id: "width", label: "Width (b)" },
            { key: "height", id: "height", label: "Height (h)" }
        ],
        "solid-circular": [{ key: "diameter", id: "diameter", label: "Diameter (d)" }],
        "hollow-circular": [
            { key: "outerDiameter", id: "outerDiameter", label: "Outer diameter (D)" },
            { key: "innerDiameter", id: "innerDiameter", label: "Inner diameter (d)" }
        ],
        "hollow-rectangular": [
            { key: "outerWidth", id: "outerWidth", label: "Outer width (B)" },
            { key: "outerHeight", id: "outerHeight", label: "Outer height (H)" },
            { key: "wallThickness", id: "wallThickness", label: "Wall thickness (t)" }
        ],
        "i-beam": [
            { key: "height", id: "height", label: "Overall height (H)" },
            { key: "flangeWidth", id: "flangeWidth", label: "Flange width (B)" },
            { key: "flangeThickness", id: "flangeThickness", label: "Flange thickness (t_f)" },
            { key: "webThickness", id: "webThickness", label: "Web thickness (t_w)" }
        ],
        "t-section": [
            { key: "height", id: "height", label: "Overall height (H)" },
            { key: "flangeWidth", id: "flangeWidth", label: "Flange width (B)" },
            { key: "flangeThickness", id: "flangeThickness", label: "Flange thickness (t_f)" },
            { key: "webThickness", id: "webThickness", label: "Web thickness (t_w)" }
        ]
    };
    const beamProfileNames = {
        rectangular: "Solid rectangle / square",
        "solid-circular": "Solid circle",
        "hollow-circular": "Hollow circle / tube",
        "hollow-rectangular": "Hollow rectangle / tube",
        "i-beam": "Symmetric I-beam",
        "t-section": "T-section"
    };
    const sectionOptions = Object.keys(beamProfiles);
    const sectionLabels = Object.fromEntries(sectionOptions.map((key) => [key, beamProfileNames[key]]));
    const axisOptions = ["x", "y"];
    const axisLabels = { x: "Horizontal x-axis (Iₓ)", y: "Vertical y-axis (Iᵧ)" };
    const dimensionInputs = Object.entries(beamProfiles).flatMap(([profile, fields]) => fields.map((field) => ({
        id: "section_" + field.id,
        label: beamProfileNames[profile] + " — " + field.label,
        group: "distance",
        optional: true,
        min: 0,
        minExclusive: true,
        sweepable: true,
        section: "Cross-section (" + beamProfileNames[profile] + ")"
    }))).filter((input, index, inputs) => inputs.findIndex((item) => item.id === input.id) === index);
    function beamDimensions(values, profile, unit) {
        const dimensions = {};
        beamProfiles[profile].forEach((field) => {
            const value = values["section_" + field.id];
            if (!Number.isFinite(value) || value <= 0) throw new Error(field.label + " must be a positive finite dimension.");
            dimensions[field.key] = convertDistance(value, unit);
        });
        return dimensions;
    }
    function sectionOutputValues(properties, axis, units) {
        return {
            area: convertAreaToUnit(properties.area, units.area),
            centroidX: convertDistanceToUnit(properties.centroidX, units.lengthOutput),
            centroidY: convertDistanceToUnit(properties.centroidY, units.lengthOutput),
            inertiaX: convertAreaMomentInertiaToUnit(properties.inertiaX, units.inertia),
            inertiaY: convertAreaMomentInertiaToUnit(properties.inertiaY, units.inertia),
            sectionModulusX: properties.sectionModulusX / convertDistance(1, units.lengthOutput) ** 3,
            sectionModulusY: properties.sectionModulusY / convertDistance(1, units.lengthOutput) ** 3,
            selectedInertia: convertAreaMomentInertiaToUnit(axis === "x" ? properties.inertiaX : properties.inertiaY, units.inertia)
        };
    }
    const beamOutputs = [
        { id: "area", label: "Cross-sectional area (A)", group: "area", quantity: "area" },
        { id: "centroidX", label: "Centroid x̄", group: "lengthOutput", quantity: "length" },
        { id: "centroidY", label: "Centroid ȳ", group: "lengthOutput", quantity: "length" },
        { id: "inertiaX", label: "Second moment of area (Iₓ)", group: "inertia", quantity: "area-moment-of-inertia" },
        { id: "inertiaY", label: "Second moment of area (Iᵧ)", group: "inertia", quantity: "area-moment-of-inertia" },
        { id: "sectionModulusX", label: "Section modulus (Sₓ)", group: "sectionModulus", quantity: "length-cubed" },
        { id: "sectionModulusY", label: "Section modulus (Sᵧ)", group: "sectionModulus", quantity: "length-cubed" }
    ];
    const sectionModulusUnits = {
        "mm³": 1e-9,
        "cm³": 1e-6,
        "m³": 1,
        "in³": 0.0254 ** 3
    };
    const beamGroups = {
        distance: distanceGroup("span and cross-section dimensions", distanceUnits, "mm"),
        lengthOutput: distanceGroup("section-property and deflection length", distanceUnits, "mm"),
        area: areaGroup,
        inertia: inertiaGroup,
        sectionModulus: unitGroup("section modulus", Object.keys(sectionModulusUnits), "mm³",
            (value, unit) => value * sectionModulusUnits[unit],
            (value, unit) => value / sectionModulusUnits[unit]),
        stress: stressGroup("bending stress"),
        moment: momentGroup()
    };

    const beamBending = {
        id: "beam-bending-stress",
        name: "Beam Bending Stress",
        version: "1",
        path: "calculators/beam-bending-stress.html",
        groups: beamGroups,
        inputs: [
            categorical("sectionType", "Cross-section profile", sectionOptions, sectionLabels),
            categorical("bendingAxis", "Bending axis", axisOptions, axisLabels),
            ...dimensionInputs,
            { id: "moment", label: "Signed bending moment", group: "moment", sweepable: true }
        ],
        outputs: beamOutputs.concat([
            { id: "bendingStress", label: "Signed extreme-fiber bending stress", group: "stress", quantity: "stress" }
        ]),
        equations: window.FormulaFoundryBeamCalculations.bendingEquations("rectangular", "x"),
        equationsFor(values) {
            const sectionType = sectionOptions.includes(values.sectionType) ? values.sectionType : "rectangular";
            const axis = axisOptions.includes(values.bendingAxis) ? values.bendingAxis : "x";
            return window.FormulaFoundryBeamCalculations.bendingEquations(sectionType, axis);
        },
        assumptions: [
            "Linear-elastic, homogeneous material response; small deformation; prismatic cross-section and simple elastic flexure.",
            "Bending is about the selected centroidal principal axis.",
            "The opposite extreme fiber has equal stress magnitude and opposite sign.",
            "Shear, local and lateral-torsional buckling, fatigue, stress concentrations, and deflection are not evaluated."
        ],
        warnings: ["Verify entered cross-section geometry and elastic-beam assumptions for the actual design."],
        method: "Calls the beam bending calculator's DOM-independent calculation engine and shared section-property engine.",
        calculate(values, units) {
            const dimensions = beamDimensions(values, values.sectionType, units.distance);
            const result = window.FormulaFoundryBeamCalculations.computeBendingStress({
                sectionType: values.sectionType,
                dimensions,
                momentNm: convertMoment(values.moment, units.moment),
                axis: values.bendingAxis
            });
            return Object.assign(sectionOutputValues(result.properties, values.bendingAxis, units), {
                bendingStress: convertStressToUnit(result.stressPa, units.stress)
            });
        }
    };

    const caseOptions = Object.keys(window.FormulaFoundryBeamCalculations.cases);
    const caseLabels = Object.fromEntries(caseOptions.map((key) => [key, window.FormulaFoundryBeamCalculations.cases[key].name]));
    const beamDeflection = {
        id: "beam-deflection",
        name: "Beam Bending Stress and Deflection",
        version: "2",
        path: "calculators/beam-deflection.html",
        groups: Object.assign({}, beamGroups, {
            force: forceGroup(),
            distributedLoad: unitGroup("uniform distributed load", ["N/m", "kN/m", "lbf/ft"], "N/m",
                (value, unit) => convertDistributedLoad(value, unit), (value, unit) => convertDistributedLoadToUnit(value, unit)),
            modulus: modulusGroup,
            span: distanceGroup("beam span", distanceUnits, "m"),
            deflection: distanceGroup("maximum deflection", ["mm", "m", "in"], "m"),
            flexuralRigidity: unitGroup("flexural rigidity", ["N·m²"], "N·m²", (value) => value, (value) => value)
        }),
        inputs: [
            categorical("loadingCase", "Loading and support case", caseOptions, caseLabels),
            { id: "span", label: "Beam span (L)", group: "span", min: 0, minExclusive: true, sweepable: true },
            { id: "pointLoad", label: "Point load (P)", group: "force", optional: true, sweepable: true },
            { id: "uniformLoad", label: "Uniform distributed load (w)", group: "distributedLoad", optional: true, sweepable: true },
            categorical("material", "Beam material", materialsWithProperties("youngsModulus"), materialLabels, true),
            { id: "youngsModulus", label: "Young's modulus (E)", group: "modulus", min: 0, minExclusive: true, sweepable: true },
            categorical("sectionType", "Cross-section profile", sectionOptions, sectionLabels),
            ...dimensionInputs,
            categorical("bendingAxis", "Bending axis", axisOptions, axisLabels)
        ],
        materialBindings: [
            { selectionId: "material", inputs: [{ id: "youngsModulus", property: "youngsModulus" }] }
        ],
        outputs: beamOutputs.concat([
            { id: "selectedInertia", label: "Selected second moment of area (I)", group: "inertia", quantity: "area-moment-of-inertia" },
            { id: "signedDeflection", label: "Maximum deflection (signed)", group: "deflection", quantity: "length" },
            { id: "deflectionMagnitude", label: "Maximum deflection magnitude", group: "deflection", quantity: "length" },
            { id: "deflectionLocation", label: "Maximum deflection location", group: "distance", quantity: "length" },
            { id: "maximumMoment", label: "Maximum bending moment", group: "moment", quantity: "moment" },
            { id: "flexuralRigidity", label: "Flexural rigidity (EI)", group: "flexuralRigidity", quantity: "flexural-rigidity" }
        ]),
        equations: [window.FormulaFoundryBeamCalculations.cases["ss-point"].formula],
        equationsFor(values) {
            const caseDefinition = window.FormulaFoundryBeamCalculations.cases[values.loadingCase];
            if (!caseDefinition) return [];
            const sectionType = sectionOptions.includes(values.sectionType) ? values.sectionType : "rectangular";
            return window.BeamSectionProperties.equations(sectionType).concat([caseDefinition.formula]);
        },
        assumptions: [
            "Linear-elastic homogeneous material, small deflection, prismatic beam and constant E and I.",
            "A selected material supplies its database Young's modulus; a directly entered value takes precedence.",
            "Euler–Bernoulli beam theory; shear deformation is neglected.",
            "Static full-span loading with ideal pin/roller or fixed-free supports, as specified by the selected case.",
            "The closed-form solution does not represent plasticity, buckling, connection flexibility, support settlement, or dynamic effects."
        ],
        warnings: ["Only the listed full-span point/uniform loads and ideal support cases are modeled; other load distributions require a different model."],
        method: "Calls the beam deflection calculator's closed-form engine and shared section-property engine, using one of its existing support/loading cases.",
        calculate(values, units) {
            const caseDefinition = window.FormulaFoundryBeamCalculations.cases[values.loadingCase];
            if (!caseDefinition) throw new Error("Select one of the supported load/support cases.");
            const isPoint = values.loadingCase.endsWith("point");
            const rawLoad = isPoint ? values.pointLoad : values.uniformLoad;
            if (!Number.isFinite(rawLoad) || rawLoad === 0) throw new Error(isPoint ? "Point load is required and must be non-zero." : "Uniform distributed load is required and must be non-zero.");
            const dimensions = beamDimensions(values, values.sectionType, units.distance);
            const properties = window.BeamSectionProperties.calculate(values.sectionType, dimensions);
            const axis = values.bendingAxis;
            const inertiaM4 = axis === "x" ? properties.inertiaX : axis === "y" ? properties.inertiaY : NaN;
            const loadSI = isPoint ? convertForce(rawLoad, units.force) : convertDistributedLoad(rawLoad, units.distributedLoad);
            const result = window.FormulaFoundryBeamCalculations.computeDeflection({
                caseId: values.loadingCase,
                spanM: convertDistance(values.span, units.span),
                modulusPa: convertModulus(materialInput(beamDeflection, values, units, "material", "youngsModulus", "youngsModulus"), units.modulus),
                inertiaM4,
                loadSI
            });
            const sectionValues = sectionOutputValues(properties, axis, units);
            return Object.assign(sectionValues, {
                selectedInertia: sectionValues.selectedInertia,
                signedDeflection: convertDistanceToUnit(result.maxDeflectionM, units.deflection),
                deflectionMagnitude: convertDistanceToUnit(Math.abs(result.maxDeflectionM), units.deflection),
                deflectionLocation: convertDistanceToUnit(result.locationM, units.span),
                maximumMoment: convertMomentToUnit(result.maxMomentNm, units.moment),
                flexuralRigidity: result.flexuralRigidity
            });
        }
    };

    // ---------- Extended calculator library ----------
    // Each adapter below delegates to the DOM-free engine extracted from its calculator page
    // (js/<name>-calculation.js); no engineering formulas are repeated here.

    const dimensionless = (label, unit) => unitGroup(label, [unit], unit, (value) => value, (value) => value);
    const lengthChangeGroup = (label, options, defaultUnit) => distanceGroup(label, options, defaultUnit);
    const num = (values, id) => (values[id] === null || values[id] === undefined ? NaN : values[id]);
    const optionalNum = (values, id) => (values[id] === null || values[id] === undefined ? null : values[id]);
    const labelMap = (pairs) => Object.fromEntries(pairs);
    const forceUnitsList = ["N", "kN", "lbf"];

    function numberedMaterialBinding(selectionId, inputId, property) {
        return { selectionId, inputs: [{ id: inputId, property }] };
    }

    // ---------- Bolt Torque ----------

    const boltTorque = {
        id: "bolt-torque",
        name: "Bolt Torque",
        version: "1",
        path: "calculators/bolt-torque.html",
        groups: {
            diameter: distanceGroup("nominal bolt diameter", ["mm", "in"], "mm"),
            force: forceGroup("clamp load", "kN"),
            factor: unitGroup("nut factor", ["K"], "K", (v) => v, (v) => v, false),
            torque: momentGroup()
        },
        inputs: [
            { id: "nominalDiameter", label: "Nominal bolt diameter (D)", group: "diameter", min: 0, minExclusive: true, sweepable: true },
            { id: "clampLoad", label: "Target clamp load (F), assumed", group: "force", min: 0, minExclusive: true, sweepable: true },
            { id: "nutFactor", label: "Nut factor (K), assumed", group: "factor", unit: "", min: 0, minExclusive: true, sweepable: true }
        ],
        outputs: [{ id: "torque", label: "Installation torque (T)", group: "torque", quantity: "torque" }],
        equations: BOLT_TORQUE_EQUATIONS,
        assumptions: [
            "Simplified torque–preload relation T = K·D·F; the nut factor K lumps thread and bearing-face friction into one assumed number.",
            "Nut factor and clamp load are explicit assumptions supplied by you, not predictions of the real preload or friction distribution.",
            "The nominal diameter is entered directly; standard bolt sizes are not looked up in Design Studies."
        ],
        warnings: [
            "Actual preload scatters widely with lubrication, surface finish, coatings and tightening method; this estimate does not predict it.",
            "Bolt strength, proof load, joint stiffness and embedment are not checked."
        ],
        method: "Calls computeBoltTorque() with the SI-converted nominal diameter, assumed clamp load and assumed nut factor.",
        calculate(values, units) {
            const r = computeBoltTorque({
                diameterM: convertDistance(num(values, "nominalDiameter"), units.diameter),
                clampLoadN: convertForce(num(values, "clampLoad"), units.force),
                nutFactor: num(values, "nutFactor")
            });
            return { torque: convertMomentToUnit(r.torqueNm, units.torque) };
        }
    };

    // ---------- Moment ----------

    const moment = {
        id: "moment",
        name: "Moment (Force × Distance)",
        version: "1",
        path: "calculators/moment.html",
        groups: { force: forceGroup(), distance: distanceGroup("perpendicular distance", distanceUnits, "m"), moment: momentGroup() },
        inputs: [
            { id: "force", label: "Force (F, signed; sign sets moment sign)", group: "force", sweepable: true },
            { id: "distance", label: "Perpendicular distance (d)", group: "distance", min: 0, minExclusive: true, sweepable: true }
        ],
        outputs: [{ id: "moment", label: "Moment (M, signed with force)", group: "moment", quantity: "moment" }],
        equations: MOMENT_EQUATIONS,
        assumptions: [
            "A single force acting at a perpendicular distance from the reference point.",
            "The moment keeps the sign of the entered force; the distance is a positive perpendicular distance.",
            "No other load positions, force angles or arbitrary geometry are modeled."
        ],
        warnings: ["Enter the perpendicular (moment-arm) distance; resolve inclined forces into components first."],
        method: "Calls computeMoment() with the SI-converted force and distance.",
        calculate(values, units) {
            const r = computeMoment({ forceN: convertForce(num(values, "force"), units.force), distanceM: convertDistance(num(values, "distance"), units.distance) });
            return { moment: convertMomentToUnit(r.momentNm, units.moment) };
        }
    };

    // ---------- Bearing Life ----------

    const bearingLife = {
        id: "bearing-life",
        name: "Bearing Life (L10)",
        version: "1",
        path: "calculators/bearing-life.html",
        groups: {
            rating: forceGroup("dynamic load rating", "kN"),
            load: forceGroup("equivalent dynamic load", "kN"),
            speed: unitGroup("rotational speed", ["rpm", "rps"], "rpm", (v, u) => convertRotationalSpeed(v, u), (v, u) => convertRotationalSpeedToUnit(v, u)),
            exponent: dimensionless("life exponent", "–"),
            ratio: dimensionless("load ratio", "–"),
            millionRev: dimensionless("L10 life", "million rev"),
            revolutions: dimensionless("L10 life", "rev"),
            hours: dimensionless("L10h life", "h")
        },
        inputs: [
            categorical("bearingType", "Bearing type (life exponent)", ["ball", "roller"], { ball: "Ball bearing (p = 3)", roller: "Roller bearing (p = 10/3)" }),
            { id: "dynamicLoadRating", label: "Basic dynamic load rating (C)", group: "rating", min: 0, minExclusive: true, sweepable: true },
            { id: "equivalentLoad", label: "Equivalent dynamic load (P)", group: "load", min: 0, minExclusive: true, sweepable: true },
            { id: "speed", label: "Rotational speed (n)", group: "speed", min: 0, minExclusive: true, sweepable: true }
        ],
        outputs: [
            { id: "exponent", label: "Life exponent (p)", group: "exponent", quantity: "life-exponent", plottable: false },
            { id: "loadRatio", label: "Load ratio (P/C)", group: "ratio", quantity: "ratio" },
            { id: "lifeMillionRevolutions", label: "Basic rating life L10 (million revolutions)", group: "millionRev", quantity: "life-million-revolutions" },
            { id: "lifeRevolutions", label: "Basic rating life L10 (revolutions)", group: "revolutions", quantity: "life-revolutions" },
            { id: "lifeHours", label: "Basic rating life L10h (operating hours)", group: "hours", quantity: "time" }
        ],
        equations: BEARING_LIFE_EQUATIONS,
        assumptions: [
            "Basic rating life L10: 90 % reliability, standard bearing material and ideal lubrication; the exponent is 3 for ball and 10/3 for roller bearings.",
            "C and P are supplied by you; P is the equivalent dynamic load including any radial/axial combination, which is not derived here.",
            "Constant load and speed."
        ],
        warnings: [
            "L10 is a statistical basic rating life, not a prediction of actual service life; no reliability, lubrication, contamination or misalignment life modification factors are applied.",
            "Results with P ≥ C fall outside the normal range of the basic rating-life equation."
        ],
        method: "Calls computeBearingLife() with C and P in newtons and speed in rpm.",
        calculate(values, units) {
            const r = computeBearingLife({
                bearingType: values.bearingType,
                dynamicLoadRatingN: convertForce(num(values, "dynamicLoadRating"), units.rating),
                equivalentLoadN: convertForce(num(values, "equivalentLoad"), units.load),
                speedRpm: convertRotationalSpeed(num(values, "speed"), units.speed)
            });
            return {
                exponent: r.exponent, loadRatio: r.loadRatio, lifeMillionRevolutions: r.lifeMillionRevolutions,
                lifeRevolutions: r.lifeRevolutions, lifeHours: r.lifeHours
            };
        }
    };

    // ---------- Column Buckling ----------

    const columnMaterials = materialsWithProperties("youngsModulus");
    const columnBuckling = {
        id: "column-buckling",
        name: "Column Buckling (Euler)",
        version: "2",
        path: "calculators/column-buckling.html",
        groups: {
            distance: distanceGroup("column length and diameters", distanceUnits, "mm"),
            inertia: inertiaGroup,
            force: forceGroup("critical load", "kN"),
            k: dimensionless("effective length factor", "K"),
            effectiveLength: distanceGroup("effective length", distanceUnits, "mm")
        },
        inputs: [
            categorical("sectionType", "Cross-section", ["solid", "hollow"], { solid: "Solid circular", hollow: "Hollow circular" }),
            categorical("material", "Material (supplies Young's modulus)", columnMaterials, materialLabels),
            { id: "length", label: "Column length (L)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "outerDiameter", label: "Outer diameter (D)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "innerDiameter", label: "Inner diameter (hollow sections only)", group: "distance", optional: true, min: 0, minExclusive: true, sweepable: true },
            categorical("boundaryCondition", "End condition (K)", Object.keys(COLUMN_END_CONDITION_FACTORS), {
                "fixed-free": "Fixed–free (K = 2.0)", "pinned-pinned": "Pinned–pinned (K = 1.0)",
                "fixed-pinned": "Fixed–pinned (K = 0.699)", "fixed-fixed": "Fixed–fixed (K = 0.5)"
            })
        ],
        outputs: [
            { id: "inertia", label: "Area moment of inertia (I)", group: "inertia", quantity: "area-moment-of-inertia" },
            { id: "kFactor", label: "Effective length factor (K)", group: "k", quantity: "effective-length-factor", plottable: false },
            { id: "effectiveLength", label: "Effective length (KL)", group: "effectiveLength", quantity: "length" },
            { id: "criticalLoad", label: "Euler critical buckling load (Pcr)", group: "force", quantity: "force" }
        ],
        equations: COLUMN_BUCKLING_EQUATIONS,
        assumptions: [
            "Euler elastic buckling of a straight, prismatic, concentrically loaded circular column (solid or hollow).",
            "Idealized end conditions with the effective length factors K of the calculator; the selection is categorical.",
            "Young's modulus is the selected material's database value; no material nonlinearity, imperfections or eccentricity.",
            "Inner diameter is ignored for solid sections."
        ],
        warnings: [
            "Euler's formula applies only to slender columns; short columns can yield or crush before buckling. Slenderness and yield are not checked.",
            "Pcr is an ideal critical load, not an allowable load; no safety factor or design-code column curve is applied."
        ],
        method: "Calls computeColumnBuckling() with the SI-converted geometry, selected end condition and material modulus.",
        calculate(values, units) {
            if (!values.material) throw new Error("Please select a material.");
            const hollow = values.sectionType === "hollow";
            const inner = optionalNum(values, "innerDiameter");
            const r = computeColumnBuckling({
                sectionType: values.sectionType,
                boundaryCondition: values.boundaryCondition,
                lengthM: convertDistance(num(values, "length"), units.distance),
                outerDiameterM: convertDistance(num(values, "outerDiameter"), units.distance),
                innerDiameterM: hollow && inner !== null ? convertDistance(inner, units.distance) : null,
                youngsModulusPa: getMaterialProperty(values.material, "youngsModulus")
            });
            return {
                inertia: convertAreaMomentInertiaToUnit(r.inertiaM4, units.inertia), kFactor: r.kFactor,
                effectiveLength: convertDistanceToUnit(r.effectiveLengthM, units.effectiveLength),
                criticalLoad: convertForceToUnit(r.criticalLoadN, units.force)
            };
        }
    };

    // ---------- Factor of Safety ----------

    const fosMaterials = materialsWithProperties("yieldStrength");
    const factorOfSafety = {
        id: "factor-of-safety",
        name: "Factor of Safety",
        version: "2",
        path: "calculators/factor-of-safety.html",
        groups: {
            stress: stressGroup("strength and applied stress", ["Pa", "MPa", "GPa", "psi", "ksi"]),
            force: forceGroup("failure and applied load", "kN"),
            stressFactor: dimensionless("stress-based factor of safety", "×"),
            loadFactor: dimensionless("load-based factor of safety", "×")
        },
        inputs: [
            categorical("mode", "Factor-of-safety definition", ["stress", "load"], { stress: "Stress-based (strength ÷ applied stress)", load: "Load-based (failure load ÷ applied load)" }),
            categorical("strengthSource", "Strength source (stress-based only)", ["direct", "material-yield", "material-tensile"], {
                direct: "Direct entry", "material-yield": "Material yield strength", "material-tensile": "Material tensile strength"
            }, true),
            categorical("material", "Material (when strength source is a material)", materialsWithProperties(), materialLabels, true),
            { id: "strength", label: "Strength (direct entry; stress-based)", group: "stress", optional: true, min: 0, minExclusive: true, sweepable: true },
            { id: "appliedStress", label: "Applied stress (stress-based)", group: "stress", optional: true, min: 0, minExclusive: true, sweepable: true },
            { id: "failureLoad", label: "Failure load (load-based)", group: "force", optional: true, min: 0, minExclusive: true, sweepable: true },
            { id: "appliedLoad", label: "Applied load (load-based)", group: "force", optional: true, min: 0, minExclusive: true, sweepable: true }
        ],
        outputs: [
            { id: "stressFactor", label: "Stress-based factor of safety (strength ÷ applied stress)", group: "stressFactor", quantity: "factor-of-safety-stress", optional: true },
            { id: "loadFactor", label: "Load-based factor of safety (failure load ÷ applied load)", group: "loadFactor", quantity: "factor-of-safety-load", optional: true },
            { id: "strengthUsed", label: "Strength used (stress-based)", group: "stress", quantity: "stress", optional: true }
        ],
        equations: FACTOR_OF_SAFETY_EQUATIONS.stress.concat(FACTOR_OF_SAFETY_EQUATIONS.load),
        equationsFor(values) {
            return FACTOR_OF_SAFETY_EQUATIONS[values.mode] ? FACTOR_OF_SAFETY_EQUATIONS[values.mode].slice() : [];
        },
        comparisonKey(scenario) {
            const i = scenario.inputs;
            return "mode:" + i.mode + (i.mode === "stress" ? "|source:" + (i.strengthSource || "") : "");
        },
        assumptions: [
            "The factor of safety is the ratio of a specified capacity (strength or failure load) to a specified demand (applied stress or load); it is only as meaningful as those inputs.",
            "Stress-based and load-based factors use different definitions and are never compared with each other.",
            "A material strength source supplies the database yield or tensile strength; direct entry uses the strength typed here.",
            "A database strength can be typical, nominal, specified-minimum, or unverified; it is a reference property, not a certified design allowable.",
            "Only the inputs for the selected definition are used; the other definition's inputs are ignored."
        ],
        warnings: [
            "FoS = 1 means the applied condition equals the specified strength or failure value, not that failure is imminent or acceptable.",
            "Required factors of safety depend on codes, consequences and uncertainty; none is recommended here.",
            "Different strength sources (yield, tensile, direct) give factors with different meanings.",
            "Verify the selected material's strength basis and product condition before relying on a material-based factor of safety."
        ],
        method: "Calls computeFactorOfSafety() for the selected definition; strength comes from direct entry or the selected material property.",
        calculate(values, units) {
            if (values.mode === "load") {
                const r = computeFactorOfSafety({
                    mode: "load", failureLoadN: convertForce(num(values, "failureLoad"), units.force),
                    appliedLoadN: convertForce(num(values, "appliedLoad"), units.force)
                });
                return { loadFactor: r.factorOfSafety };
            }
            if (values.mode !== "stress") throw new Error("Select a stress-based or load-based factor of safety.");
            const source = values.strengthSource;
            let strengthPa;
            if (source === "direct") strengthPa = convertStress(num(values, "strength"), units.stress);
            else if (source === "material-yield" || source === "material-tensile") {
                if (!values.material) throw new Error("Select a material for the chosen strength source.");
                strengthPa = getMaterialProperty(values.material, source === "material-yield" ? "yieldStrength" : "tensileStrength");
                if (!Number.isFinite(strengthPa)) throw new Error("The selected material does not include that strength property. Use direct entry.");
            } else throw new Error("Select a strength source.");
            const r = computeFactorOfSafety({ mode: "stress", strengthPa, appliedStressPa: convertStress(num(values, "appliedStress"), units.stress) });
            return { stressFactor: r.factorOfSafety, strengthUsed: convertStressToUnit(strengthPa, units.stress) };
        }
    };

    // ---------- Fillet Weld ----------

    const filletWeld = {
        id: "fillet-weld",
        name: "Fillet Weld Strength",
        version: "1",
        path: "calculators/fillet-weld.html",
        groups: {
            leg: distanceGroup("weld leg size", ["mm", "cm", "in"], "mm"),
            length: distanceGroup("weld length", ["mm", "cm", "in"], "mm"),
            force: forceGroup("force", "kN"),
            stress: stressGroup("filler-metal stress", ["MPa", "GPa", "psi", "ksi"]),
            area: areaGroup,
            utilization: dimensionless("capacity utilization", "×")
        },
        inputs: [
            { id: "weldLeg", label: "Weld leg size (w)", group: "leg", min: 0, minExclusive: true, sweepable: true },
            { id: "weldLength", label: "Weld length (L)", group: "length", min: 0, minExclusive: true, sweepable: true },
            categorical("electrode", "Electrode classification (F_EXX)", Object.keys(filletWeldElectrodes), {
                E60XX: "E60XX (60 ksi)", E70XX: "E70XX (70 ksi)", E80XX: "E80XX (80 ksi)"
            }),
            categorical("loadDirection", "Load direction to weld axis", ["0", "90"], { 0: "0° (longitudinal)", 90: "90° (transverse)" }),
            categorical("designMethod", "Design method", ["LRFD", "ASD"], { LRFD: "LRFD (φ = 0.75)", ASD: "ASD (Ω = 2.00)" }),
            { id: "appliedLoad", label: "Applied load (optional, factored for LRFD / service for ASD)", group: "force", optional: true, min: 0, sweepable: true }
        ],
        outputs: [
            { id: "throat", label: "Effective throat (a_e)", group: "leg", quantity: "length" },
            { id: "area", label: "Effective weld area (A_w)", group: "area", quantity: "area" },
            { id: "fexx", label: "Electrode strength (F_EXX)", group: "stress", quantity: "stress" },
            { id: "nominalStress", label: "Nominal weld stress (F_nw)", group: "stress", quantity: "stress" },
            { id: "nominalStrength", label: "Nominal strength (R_n)", group: "force", quantity: "force" },
            { id: "lrfdStrength", label: "LRFD design strength (φR_n)", group: "force", quantity: "force" },
            { id: "asdStrength", label: "ASD allowable strength (R_n/Ω)", group: "force", quantity: "force" },
            { id: "designCapacity", label: "Design capacity (selected method)", group: "force", quantity: "design-capacity" },
            { id: "requiredLeg", label: "Required leg size for the applied load", group: "leg", quantity: "length", optional: true },
            { id: "utilization", label: "Utilization (load ÷ design capacity)", group: "utilization", quantity: "utilization", optional: true },
            { id: "remainingCapacity", label: "Remaining capacity (design capacity − load)", group: "force", quantity: "force", optional: true }
        ],
        equations: FILLET_WELD_EQUATIONS,
        comparisonKey: (scenario) => "method:" + scenario.inputs.designMethod,
        assumptions: [
            "Direct-load AISC 360 Chapter J2 fillet-weld strength with a single load direction relative to the weld axis (0° or 90°).",
            "Effective throat is 0.707 times the leg size for equal-leg welds; weld metal strength only (no base-metal check).",
            "LRFD and ASD capacities are different definitions; scenarios using different methods are not compared.",
            "Eccentric loading, combined loading, weld groups and fatigue are not modeled."
        ],
        warnings: [
            "Check base-metal strength, minimum/maximum weld size, end returns and applicable code provisions separately.",
            "Capacity is for the selected design method only; an LRFD load must be factored and an ASD load a service load."
        ],
        method: "Calls computeFilletWeldChecked() with the SI-converted weld size, length, electrode, load direction, method and optional applied load.",
        calculate(values, units) {
            const load = optionalNum(values, "appliedLoad");
            const r = computeFilletWeldChecked({
                legM: convertDistance(num(values, "weldLeg"), units.leg),
                lengthM: convertDistance(num(values, "weldLength"), units.length),
                electrode: values.electrode,
                angleDeg: values.loadDirection === null || values.loadDirection === undefined ? NaN : Number(values.loadDirection),
                method: values.designMethod,
                loadN: load === null ? null : convertForce(load, units.force)
            });
            const force = (v) => convertForceToUnit(v, units.force);
            const out = {
                throat: convertDistanceToUnit(r.throatM, units.leg), area: convertAreaToUnit(r.areaM2, units.area),
                fexx: convertStressToUnit(r.FexxPa, units.stress), nominalStress: convertStressToUnit(r.Fnw, units.stress),
                nominalStrength: force(r.nominalN), lrfdStrength: force(r.lrfdN), asdStrength: force(r.asdN), designCapacity: force(r.designN)
            };
            if (load !== null) {
                out.requiredLeg = convertDistanceToUnit(r.requiredLegM, units.leg);
                out.utilization = r.utilization;
                out.remainingCapacity = force(r.remainingN);
            }
            return out;
        }
    };

    // ---------- Helical Spring ----------

    const springRateUnits = { "N/mm": ["N", "mm"], "N/m": ["N", "m"], "kN/m": ["kN", "m"], "lbf/in": ["lbf", "in"], "lbf/ft": ["lbf", "ft"] };
    const springMaterials = materialsWithProperties("shearModulus");
    const helicalSpring = {
        id: "spring-calculations",
        name: "Helical Compression Spring",
        version: "2",
        path: "calculators/spring-calculations.html",
        groups: {
            distance: distanceGroup("wire and coil diameter", distanceUnits, "mm"),
            force: forceGroup("axial force", "N"),
            modulus: unitGroup("shear modulus", ["GPa", "MPa", "psi", "ksi"], "GPa", (v, u) => convertModulus(v, u), (v, u) => convertModulusToUnit(v, u)),
            stress: stressGroup("shear stress", ["MPa", "GPa", "psi", "ksi"]),
            deflection: distanceGroup("deflection", distanceUnits, "mm"),
            rate: unitGroup("spring rate", Object.keys(springRateUnits), "N/mm",
                (v, u) => convertForce(v, springRateUnits[u][0]) / convertDistance(1, springRateUnits[u][1]),
                (v, u) => convertForceToUnit(v * convertDistance(1, springRateUnits[u][1]), springRateUnits[u][0])),
            index: dimensionless("spring index", "C"),
            wahl: dimensionless("Wahl factor", "K_W")
        },
        inputs: [
            { id: "wireDiameter", label: "Wire diameter (d)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "meanDiameter", label: "Mean coil diameter (D)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "activeCoils", label: "Active coils (N_a)", group: null, unit: "", min: 0, minExclusive: true, sweepable: true },
            { id: "force", label: "Applied axial force (F)", group: "force", min: 0, sweepable: true },
            categorical("material", "Spring material (supplies shear modulus)", springMaterials, materialLabels, true),
            { id: "shearModulus", label: "Shear modulus (G)", group: "modulus", min: 0, minExclusive: true, sweepable: true }
        ],
        materialBindings: [numberedMaterialBinding("material", "shearModulus", "shearModulus")],
        outputs: [
            { id: "rate", label: "Spring rate (k)", group: "rate", quantity: "spring-rate" },
            { id: "index", label: "Spring index (C = D/d)", group: "index", quantity: "spring-index", plottable: true },
            { id: "deflection", label: "Axial deflection (δ)", group: "deflection", quantity: "length" },
            { id: "wahlFactor", label: "Wahl correction factor (K_W)", group: "wahl", quantity: "wahl-factor" },
            { id: "shearStress", label: "Corrected maximum shear stress (τ_max)", group: "stress", quantity: "stress" }
        ],
        equations: SPRING_EQUATIONS,
        assumptions: [
            "Round-wire helical compression spring with constant coil diameter and linear elastic behavior.",
            "Spring rate uses the active coils entered; end-coil treatment is your responsibility.",
            "Shear stress includes the Wahl curvature/direct-shear correction factor.",
            "A selected material supplies its database shear modulus; a directly entered value takes precedence."
        ],
        warnings: [
            "Fatigue, buckling, coil contact (solid height), relaxation and set removal are not evaluated.",
            "Stress is not compared with any allowable value; check against the material's torsional yield and fatigue limits."
        ],
        method: "Calls computeSpring() with SI-converted wire and coil diameters, active coils, force and shear modulus.",
        calculate(values, units) {
            const modulus = materialInput(helicalSpring, values, units, "material", "shearModulus", "shearModulus");
            const r = computeSpring({
                wireDiameterM: convertDistance(num(values, "wireDiameter"), units.distance),
                meanDiameterM: convertDistance(num(values, "meanDiameter"), units.distance),
                activeCoils: num(values, "activeCoils"), forceN: convertForce(num(values, "force"), units.force),
                shearModulusPa: convertModulus(modulus, units.modulus)
            });
            return {
                rate: helicalSpring.groups.rate.fromBase(r.rateNPerM, units.rate), index: r.index,
                deflection: convertDistanceToUnit(r.deflectionM, units.deflection), wahlFactor: r.wahlFactor,
                shearStress: convertStressToUnit(r.shearStressPa, units.stress)
            };
        }
    };

    // ---------- Stress & Strain ----------

    const stressStrainModes = { stress: "Stress (σ = F/A)", strain: "Strain (ε = ΔL/L₀)", youngsModulus: "Young's modulus (E = σ/ε)", deformation: "Elongation (ΔL = FL₀/AE)" };
    const stressStrain = {
        id: "stress-strain",
        name: "Stress & Strain",
        version: "2",
        path: "calculators/stress-strain.html",
        groups: {
            force: forceGroup(),
            area: areaGroup,
            length: distanceGroup("original length", distanceUnits, "mm"),
            deltaLength: lengthChangeGroup("length change", ["mm", "cm", "m", "in"], "mm"),
            modulus: modulusGroup,
            stress: stressGroup("stress", ["MPa", "GPa", "Pa", "psi", "ksi"]),
            strain: dimensionless("strain", "m/m"),
            elasticModulus: unitGroup("modulus output", ["MPa", "GPa", "Pa", "psi", "ksi"], "GPa", (v, u) => convertStress(v, u), (v, u) => convertStressToUnit(v, u)),
            elongation: lengthChangeGroup("elongation", ["mm", "cm", "m", "in"], "mm")
        },
        inputs: [
            categorical("mode", "Calculation mode (what is solved for)", Object.keys(stressStrainModes), stressStrainModes),
            { id: "force", label: "Axial force (F; stress, modulus, elongation modes)", group: "force", optional: true, sweepable: true },
            { id: "area", label: "Cross-sectional area (A; stress, modulus, elongation modes)", group: "area", optional: true, min: 0, minExclusive: true, sweepable: true },
            { id: "originalLength", label: "Original length (L₀; strain, elongation modes)", group: "length", optional: true, min: 0, minExclusive: true, sweepable: true },
            { id: "deltaLength", label: "Change in length (ΔL; strain mode)", group: "deltaLength", optional: true, sweepable: true },
            { id: "strain", label: "Strain (ε; modulus mode)", group: null, unit: "m/m", optional: true, sweepable: true },
            categorical("material", "Material (fills Young's modulus; elongation mode)", materialsWithProperties("youngsModulus"), materialLabels, true),
            { id: "youngsModulus", label: "Young's modulus (E; elongation mode)", group: "modulus", optional: true, min: 0, minExclusive: true, sweepable: true }
        ],
        materialBindings: [numberedMaterialBinding("material", "youngsModulus", "youngsModulus")],
        outputs: [
            { id: "stress", label: "Normal stress (σ)", group: "stress", quantity: "stress", optional: true },
            { id: "strain", label: "Normal strain (ε)", group: "strain", quantity: "strain", optional: true },
            { id: "modulus", label: "Young's modulus (E = σ/ε)", group: "elasticModulus", quantity: "elastic-modulus", optional: true },
            { id: "elongation", label: "Elongation (ΔL)", group: "elongation", quantity: "length-change", optional: true }
        ],
        equations: Object.values(STRESS_STRAIN_EQUATIONS).flat(),
        equationsFor(values) {
            return STRESS_STRAIN_EQUATIONS[values.mode] ? STRESS_STRAIN_EQUATIONS[values.mode].slice() : [];
        },
        comparisonKey: (scenario) => "mode:" + scenario.inputs.mode,
        assumptions: [
            "Uniform axial stress in a prismatic bar; linear-elastic, isotropic material within the proportional limit.",
            "Each mode solves for one quantity from its own inputs; stress, strain, modulus and elongation are different physical quantities and are never compared with each other.",
            "In elongation mode a selected material supplies Young's modulus; a directly entered value takes precedence.",
            "Inputs not used by the selected mode are ignored."
        ],
        warnings: [
            "Results are not checked against yield or ultimate strength; do not extrapolate beyond the elastic range.",
            "Stress concentrations, buckling in compression and thermal effects are not included."
        ],
        method: "Calls computeStressStrain() for the selected mode with SI-converted inputs.",
        calculate(values, units) {
            const optional = (id, convert) => (values[id] === null || values[id] === undefined ? undefined : convert(values[id]));
            const mode = values.mode;
            const args = {
                mode,
                forceN: optional("force", (v) => convertForce(v, units.force)),
                areaM2: optional("area", (v) => convertArea(v, units.area)),
                originalLengthM: optional("originalLength", (v) => convertDistance(v, units.length)),
                deltaLengthM: optional("deltaLength", (v) => convertDistance(v, units.deltaLength)),
                strain: optional("strain", (v) => v)
            };
            if (mode === "deformation") {
                args.modulusPa = convertModulus(materialInput(stressStrain, values, units, "material", "youngsModulus", "youngsModulus"), units.modulus);
            }
            const r = computeStressStrain(args);
            const out = {};
            if (r.stressPa !== undefined) out.stress = convertStressToUnit(r.stressPa, units.stress);
            if (r.strain !== undefined) out.strain = r.strain;
            if (r.modulusPa !== undefined) out.modulus = convertStressToUnit(r.modulusPa, units.elasticModulus);
            if (r.deltaLengthM !== undefined) out.elongation = convertDistanceToUnit(r.deltaLengthM, units.elongation);
            return out;
        }
    };

    // ---------- Thermal Expansion ----------

    const thermalMaterials = materialsWithProperties("thermalExpansionCoefficient");
    const THERMAL_STUDY_RESTRAINED_EQUATION = String.raw`\sigma_{th} = -E\,\alpha\,\Delta T\;\text{(tension positive; member fully restrained)}`;
    const thermalExpansion = {
        id: "thermal-expansion",
        name: "Thermal Expansion",
        version: "2",
        path: "calculators/thermal-expansion.html",
        groups: {
            alpha: unitGroup("coefficient of thermal expansion", ["1/°C", "1/K"], "1/°C", (v) => v, (v) => v, false),
            length: distanceGroup("original length", distanceUnits, "mm"),
            temperature: unitGroup("temperature change", ["°C", "K", "°F"], "°C", (v, u) => convertTemperatureChange(v, u), (v, u) => (u === "°F" ? v * 1.8 : v), false),
            modulus: modulusGroup,
            outputLength: distanceGroup("length output", ["mm", "m", "in"], "mm"),
            stress: stressGroup("thermal stress", ["MPa", "GPa", "Pa", "psi", "ksi"]),
            strain: dimensionless("thermal strain", "m/m")
        },
        inputs: [
            categorical("condition", "Boundary condition", ["free", "restrained"], { free: "Free expansion", restrained: "Fully restrained (thermal stress)" }),
            categorical("material", "Material (fills α and E)", materialsWithProperties("thermalExpansionCoefficient"), materialLabels, true),
            { id: "alpha", label: "Coefficient of thermal expansion (α)", group: "alpha", min: 0, minExclusive: true, sweepable: true },
            { id: "originalLength", label: "Original length (L₀)", group: "length", min: 0, minExclusive: true, sweepable: true },
            { id: "temperatureChange", label: "Temperature change (ΔT, signed interval)", group: "temperature", sweepable: true },
            { id: "youngsModulus", label: "Young's modulus (E; restrained only)", group: "modulus", optional: true, min: 0, minExclusive: true, sweepable: true }
        ],
        materialBindings: [{
            selectionId: "material",
            inputs: [{ id: "alpha", property: "thermalExpansionCoefficient" }, { id: "youngsModulus", property: "youngsModulus" }]
        }],
        outputs: [
            { id: "expansion", label: "Free length change (ΔL)", group: "outputLength", quantity: "length-change" },
            { id: "finalLength", label: "Final free length (L_f)", group: "outputLength", quantity: "length" },
            { id: "thermalStrain", label: "Thermal strain (ε = αΔT)", group: "strain", quantity: "strain" },
            { id: "restrainedStress", label: "Fully restrained thermal stress (σ, signed)", group: "stress", quantity: "restrained-thermal-stress", optional: true }
        ],
        equations: THERMAL_EXPANSION_EQUATIONS.free.concat([THERMAL_STUDY_RESTRAINED_EQUATION]),
        equationsFor(values) {
            if (values.condition === "free") return THERMAL_EXPANSION_EQUATIONS.free.slice();
            if (values.condition === "restrained") return THERMAL_EXPANSION_EQUATIONS.free.concat([THERMAL_STUDY_RESTRAINED_EQUATION]);
            return [];
        },
        comparisonKey: (scenario) => "condition:" + scenario.inputs.condition,
        assumptions: [
            "Uniform temperature change and constant coefficient α over the range; isotropic, linear-elastic material.",
            "Free expansion reports the unrestrained length change, final length and thermal strain.",
            "Restrained stress assumes the member is fully prevented from expanding (rigid supports); it is a compression for heating and a tension for cooling.",
            "A selected material supplies α and E; directly entered values take precedence. E is used only for the restrained condition."
        ],
        warnings: [
            "Free and restrained conditions are different physical situations; the restrained stress is an upper bound for rigid constraint.",
            "Buckling, yielding, support compliance and temperature gradients are not evaluated."
        ],
        method: "Calls computeThermalExpansion() with SI-converted length and temperature interval; modulus is passed only for the restrained condition.",
        calculate(values, units) {
            if (values.condition !== "free" && values.condition !== "restrained") throw new Error("Select free or fully restrained expansion.");
            const alpha = materialInput(thermalExpansion, values, units, "material", "alpha", "thermalExpansionCoefficient");
            let modulusPa = null;
            if (values.condition === "restrained") {
                modulusPa = convertModulus(materialInput(thermalExpansion, values, units, "material", "youngsModulus", "youngsModulus"), units.modulus);
                if (!Number.isFinite(modulusPa)) throw new Error("Enter Young's modulus or select a material for restrained thermal stress.");
            }
            const r = computeThermalExpansion({
                alpha, originalLengthM: convertDistance(num(values, "originalLength"), units.length),
                deltaTC: convertTemperatureChange(num(values, "temperatureChange"), units.temperature), modulusPa
            });
            const out = {
                expansion: convertDistanceToUnit(r.deltaLM, units.outputLength), finalLength: convertDistanceToUnit(r.finalLengthM, units.outputLength),
                thermalStrain: r.thermalStrain
            };
            if (r.thermalStressPa !== null) out.restrainedStress = convertStressToUnit(r.thermalStressPa === 0 ? 0 : -r.thermalStressPa, units.stress);
            return out;
        }
    };

    // ---------- Thick-Walled Cylinder ----------

    const thickWalled = {
        id: "thick-walled-cylinder",
        name: "Thick-Walled Cylinder (Lamé)",
        version: "1",
        path: "calculators/thick-walled-cylinder.html",
        groups: {
            distance: distanceGroup("inner and outer diameter", distanceUnits, "mm"),
            pressure: stressGroup("pressure", ["MPa", "bar", "kPa", "Pa", "GPa", "psi", "ksi"]),
            stress: stressGroup("stress", ["MPa", "bar", "kPa", "Pa", "GPa", "psi", "ksi"])
        },
        inputs: [
            { id: "innerDiameter", label: "Inner diameter (2a)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "outerDiameter", label: "Outer diameter (2b)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "internalPressure", label: "Internal gauge pressure (p_i)", group: "pressure", min: 0, sweepable: true },
            { id: "externalPressure", label: "External gauge pressure (p_o)", group: "pressure", min: 0, sweepable: true },
            categorical("endCondition", "End condition", ["closed", "open"], { closed: "Closed ends (axial stress carried)", open: "Open / free ends (axial stress = 0)" })
        ],
        outputs: [
            { id: "innerRadial", label: "Radial stress at inner surface", group: "stress", quantity: "stress" },
            { id: "innerHoop", label: "Hoop stress at inner surface", group: "stress", quantity: "stress" },
            { id: "midRadial", label: "Radial stress at mid-wall", group: "stress", quantity: "stress" },
            { id: "midHoop", label: "Hoop stress at mid-wall", group: "stress", quantity: "stress" },
            { id: "outerRadial", label: "Radial stress at outer surface", group: "stress", quantity: "stress" },
            { id: "outerHoop", label: "Hoop stress at outer surface", group: "stress", quantity: "stress" },
            { id: "axialStress", label: "Axial stress (uniform)", group: "stress", quantity: "stress" },
            { id: "governingHoop", label: "Governing hoop stress (signed, larger magnitude surface)", group: "stress", quantity: "stress" }
        ],
        equations: THICK_CYLINDER_EQUATIONS,
        comparisonKey: (scenario) => "end:" + scenario.inputs.endCondition,
        assumptions: THICK_CYLINDER_ASSUMPTIONS,
        warnings: [
            "Closed-end and open-end scenarios have different axial stress and are not compared with each other.",
            "No yield, fatigue or von Mises check is performed; stresses are elastic Lamé values."
        ],
        method: "Calls computeThickCylinder() with SI-converted radii (diameter ÷ 2), pressures and the selected end condition.",
        calculate(values, units) {
            const r = computeThickCylinder({
                innerRadius: convertDistance(num(values, "innerDiameter"), units.distance) / 2,
                outerRadius: convertDistance(num(values, "outerDiameter"), units.distance) / 2,
                internalPressure: convertStress(num(values, "internalPressure"), units.pressure),
                externalPressure: convertStress(num(values, "externalPressure"), units.pressure),
                endCondition: values.endCondition
            });
            const s = (v) => convertStressToUnit(v, units.stress);
            return {
                innerRadial: s(r.inner.radial), innerHoop: s(r.inner.hoop), midRadial: s(r.mid.radial), midHoop: s(r.mid.hoop),
                outerRadial: s(r.outer.radial), outerHoop: s(r.outer.hoop), axialStress: s(r.axial), governingHoop: s(r.governing.hoop)
            };
        }
    };

    // ---------- Thread Strength ----------

    const threadMaterials = materialsWithProperties("tensileStrength");
    const threadStrength = {
        id: "thread-strength",
        name: "Thread Strength",
        version: "2",
        path: "calculators/thread-strength.html",
        groups: {
            distance: distanceGroup("major diameter and engagement length", distanceUnits, "mm"),
            pitch: unitGroup("thread pitch", ["mm", "in", "TPI"], "mm",
                (v, u) => (u === "TPI" ? 0.0254 / v : convertDistance(v, u)),
                (v, u) => (u === "TPI" ? 0.0254 / v : convertDistanceToUnit(v, u)), false),
            area: areaGroup,
            force: forceGroup("force and capacity", "kN"),
            strength: stressGroup("strength and stress", ["MPa", "GPa", "psi", "ksi"]),
            utilization: dimensionless("utilization", "%")
        },
        inputs: [
            { id: "majorDiameter", label: "Nominal major diameter (D)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "threadPitch", label: "Thread pitch (P)", group: "pitch", min: 0, minExclusive: true, sweepable: true },
            { id: "tensileStressArea", label: "Tensile stress area (A_t)", group: "area", min: 0, minExclusive: true, sweepable: true },
            { id: "engagementLength", label: "Thread engagement length (L_e)", group: "distance", min: 0, minExclusive: true, sweepable: true },
            { id: "appliedLoad", label: "Applied tensile load (F)", group: "force", min: 0, sweepable: true },
            categorical("boltMaterial", "Fastener material (fills tensile strength)", threadMaterials, materialLabels, true),
            { id: "boltStrength", label: "Fastener tensile strength (S_u)", group: "strength", min: 0, minExclusive: true, sweepable: true },
            categorical("internalMaterial", "Internal-thread material (fills tensile strength)", threadMaterials, materialLabels, true),
            { id: "internalStrength", label: "Internal-thread tensile strength (optional; enables stripping check)", group: "strength", optional: true, min: 0, minExclusive: true, sweepable: true }
        ],
        materialBindings: [
            numberedMaterialBinding("boltMaterial", "boltStrength", "tensileStrength"),
            numberedMaterialBinding("internalMaterial", "internalStrength", "tensileStrength")
        ],
        outputs: [
            { id: "fastenerCapacity", label: "Fastener tensile capacity (A_t·S_u)", group: "force", quantity: "force" },
            { id: "appliedStress", label: "Applied tensile stress (F/A_t)", group: "strength", quantity: "stress" },
            { id: "fastenerUtilization", label: "Fastener tensile utilization (F ÷ capacity)", group: "utilization", quantity: "utilization" },
            { id: "internalShearArea", label: "Approximate internal-thread shear area", group: "area", quantity: "area", optional: true },
            { id: "strippingCapacity", label: "Internal-thread stripping capacity (approximate)", group: "force", quantity: "force", optional: true },
            { id: "strippingUtilization", label: "Internal-thread stripping utilization (F ÷ capacity)", group: "utilization", quantity: "utilization", optional: true },
            { id: "governingCapacity", label: "Lower of the assessed capacities (governing)", group: "force", quantity: "force" }
        ],
        equations: THREAD_STRENGTH_EQUATIONS,
        assumptions: [
            "Preliminary check of two distinct failure modes: fastener tensile capacity and approximate internal-thread stripping.",
            "Stripping uses an approximate shear area 0.5413·π·D·L_e and a von Mises shear factor of 0.577 on the internal-thread strength; the load is assumed to engage the whole length uniformly.",
            "No thread-by-thread load distribution, pitch-dependent stripping area or external-thread stripping is modeled.",
            "A selected material supplies its tensile strength; a directly entered value takes precedence.",
            "The governing failure mode is named on the source calculator page; Design Studies reports only the numeric lower capacity, and the two utilizations show which mode is closer to its limit."
        ],
        warnings: [
            "Engagement outside roughly 1–2 nominal diameters, or a pitch not smaller than the diameter, is outside the intended preliminary range.",
            "Capacities are not allowable loads; no safety factor, preload, fatigue or thread tolerance effects are applied."
        ],
        method: "Calls computeThreadStrength() with SI-converted geometry, load and strengths; internal-thread strength is optional.",
        calculate(values, units) {
            const internal = materialInput(threadStrength, values, units, "internalMaterial", "internalStrength", "tensileStrength");
            const r = computeThreadStrength({
                diameterM: convertDistance(num(values, "majorDiameter"), units.distance),
                pitchM: threadStrength.groups.pitch.toBase(num(values, "threadPitch"), units.pitch),
                engagementM: convertDistance(num(values, "engagementLength"), units.distance),
                stressAreaM2: convertArea(num(values, "tensileStressArea"), units.area),
                forceN: convertForce(num(values, "appliedLoad"), units.force),
                boltStrengthPa: convertStress(materialInput(threadStrength, values, units, "boltMaterial", "boltStrength", "tensileStrength"), units.strength),
                internalStrengthPa: Number.isFinite(internal) ? convertStress(internal, units.strength) : null
            });
            const force = (v) => convertForceToUnit(v, units.force);
            const out = {
                fastenerCapacity: force(r.boltCapacityN), appliedStress: convertStressToUnit(r.appliedStressPa, units.strength),
                fastenerUtilization: r.boltUtilization * 100, governingCapacity: force(r.governingCapacityN)
            };
            if (r.internalCapacityN !== null) {
                out.internalShearArea = convertAreaToUnit(r.internalShearAreaM2, units.area);
                out.strippingCapacity = force(r.internalCapacityN);
                out.strippingUtilization = r.internalUtilization * 100;
            }
            return out;
        }
    };

    Studies.registerAdapter(cylinder);
    Studies.registerAdapter(differentialThermal);
    Studies.registerAdapter(pressFit);
    Studies.registerAdapter(hertz);
    Studies.registerAdapter(shaftTorsion);
    Studies.registerAdapter(beamBending);
    Studies.registerAdapter(beamDeflection);
    Studies.registerAdapter(boltTorque);
    Studies.registerAdapter(moment);
    Studies.registerAdapter(bearingLife);
    Studies.registerAdapter(columnBuckling);
    Studies.registerAdapter(factorOfSafety);
    Studies.registerAdapter(filletWeld);
    Studies.registerAdapter(helicalSpring);
    Studies.registerAdapter(stressStrain);
    Studies.registerAdapter(thermalExpansion);
    Studies.registerAdapter(thickWalled);
    Studies.registerAdapter(threadStrength);
})(window);
