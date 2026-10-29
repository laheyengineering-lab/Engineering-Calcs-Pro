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
// Hertzian contact, shaft torsion, and the two beam calculators.
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
        version: "1",
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
            "Verify fit tolerances, material data, friction, stress concentrations, and applicable fit standards."
        ],
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
        version: "1",
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
            return values.configuration === "cylinders" ? HERTZ_CYLINDER_EQUATIONS : HERTZ_SPHERE_EQUATIONS;
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
        version: "1",
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
            return window.FormulaFoundryBeamCalculations.bendingEquations(values.sectionType, values.bendingAxis);
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
        version: "1",
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
            return window.BeamSectionProperties.equations(values.sectionType).concat([
                window.FormulaFoundryBeamCalculations.cases[values.loadingCase].formula
            ]);
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

    Studies.registerAdapter(cylinder);
    Studies.registerAdapter(differentialThermal);
    Studies.registerAdapter(pressFit);
    Studies.registerAdapter(hertz);
    Studies.registerAdapter(shaftTorsion);
    Studies.registerAdapter(beamBending);
    Studies.registerAdapter(beamDeflection);
})(window);
