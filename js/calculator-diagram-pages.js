(function (root) {
    "use strict";

    // Connects each calculator page to its engineering diagram. The diagrams are views of existing input fields:
    // nothing here solves an equation. Where a page already exposes a pure compute function (differential thermal
    // expansion) that function is reused instead of duplicated.

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const document = root.document;
    if (!registry || !document) return;
    const hosts = Array.from(document.querySelectorAll("[data-diagram]"));
    if (!hosts.length) return;
    const diagramId = hosts[0].getAttribute("data-diagram");
    if (!registry.has(diagramId)) return;

    const el = (id) => document.getElementById(id);
    const num = (id) => {
        const field = el(id);
        if (!field || String(field.value).trim() === "") return undefined;
        const value = Number(field.value);
        return Number.isFinite(value) ? value : undefined;
    };
    const str = (id) => {
        const field = el(id);
        return field ? String(field.value) : undefined;
    };
    const positive = (value) => (value !== undefined && value > 0 ? value : undefined);
    const nonneg = (value) => (value !== undefined && value >= 0 ? value : undefined);
    const convertDistance = (value, fromUnit, toUnit) => {
        if (value === undefined || !fromUnit || !toUnit) return undefined;
        if (fromUnit === toUnit) return value;
        if (typeof root.convertDistance !== "function" || typeof root.convertDistanceToUnit !== "function") return undefined;
        return root.convertDistanceToUnit(root.convertDistance(value, fromUnit), toUnit);
    };
    const run = (name) => () => {
        const result = el("result");
        if (result && result.querySelector(".result-value") && typeof root[name] === "function") root[name]();
    };
    const span = (value, low, high) => ({ min: Math.min(low(value), high(value)), max: Math.max(low(value), high(value)) });
    const unitOf = (id) => () => str(id) || "";

    const PAGES = {
        moment: {
            watch: ["force", "distance", "forceUnit", "distanceUnit", "momentUnit"],
            model: () => ({ force: num("force"), forceUnit: str("forceUnit"), distance: positive(num("distance")), distanceUnit: str("distanceUnit") })
        },
        "bearing-life": {
            watch: ["bearingType", "dynamicLoadRating", "equivalentDynamicLoad", "speed", "dynamicLoadRatingUnit", "equivalentDynamicLoadUnit", "speedUnit"],
            model: () => ({
                bearingType: str("bearingType"), rating: positive(num("dynamicLoadRating")), ratingUnit: str("dynamicLoadRatingUnit"),
                load: positive(num("equivalentDynamicLoad")), loadUnit: str("equivalentDynamicLoadUnit"),
                speed: positive(num("speed")), speedUnit: str("speedUnit")
            })
        },
        "cylinder-force": {
            watch: ["boreDiameter", "rodDiameter", "workingPressure", "efficiency", "distanceUnit", "pressureUnit", "forceUnit", "areaUnit"],
            model: () => {
                const efficiency = num("efficiency");
                return {
                    bore: positive(num("boreDiameter")), rod: nonneg(num("rodDiameter")), distanceUnit: str("distanceUnit"),
                    pressure: positive(num("workingPressure")), pressureUnit: str("pressureUnit"),
                    efficiency: efficiency > 0 && efficiency <= 100 ? efficiency : undefined
                };
            },
            commit: "calculateCylinderForce",
            ranges: [
                { inputId: "boreDiameter", label: "Bore diameter D", unit: unitOf("distanceUnit"), bounds: (v) => (v > 0 ? span(v, (x) => x * 0.5, (x) => x * 1.5) : null) },
                { inputId: "rodDiameter", label: "Rod diameter d", unit: unitOf("distanceUnit"), bounds: (v) => {
                    const bore = num("boreDiameter");
                    return bore > 0 && v >= 0 ? { min: 0, max: bore * 0.95 } : null;
                } },
                { inputId: "workingPressure", label: "Working pressure p", unit: unitOf("pressureUnit"), bounds: (v) => (v > 0 ? span(v, (x) => x * 0.25, (x) => x * 2) : null) }
            ]
        },
        "spring-calculations": {
            watch: ["wireDiameter", "meanCoilDiameter", "activeCoils", "appliedForce", "distanceUnit", "forceUnit",
                "springMaterial", "shearModulus", "modulusUnit", "stressUnit"],
            model: () => ({
                wire: positive(num("wireDiameter")), coil: positive(num("meanCoilDiameter")), coils: positive(num("activeCoils")),
                force: nonneg(num("appliedForce")), distanceUnit: str("distanceUnit"), forceUnit: str("forceUnit")
            }),
            commit: "calculateSpring",
            ranges: [
                { inputId: "wireDiameter", label: "Wire diameter d", unit: unitOf("distanceUnit"), bounds: (v) => (v > 0 ? span(v, (x) => x * 0.5, (x) => x * 2) : null) },
                { inputId: "meanCoilDiameter", label: "Mean coil diameter D", unit: unitOf("distanceUnit"), bounds: (v) => (v > 0 ? span(v, (x) => x * 0.5, (x) => x * 2) : null) },
                { inputId: "activeCoils", label: "Active coils N", step: 0.5, bounds: (v) => (v > 0 ? { min: Math.max(1, Math.floor(v / 2)), max: Math.ceil(v * 2) } : null) },
                { inputId: "appliedForce", label: "Axial force F", unit: unitOf("forceUnit"), bounds: (v) => (v >= 0 ? { min: 0, max: Math.max(v * 2, 1) } : null) }
            ]
        },
        "shaft-torsion": {
            watch: ["shaftType", "torque", "outerDiameter", "innerDiameter", "length", "torqueUnit", "diameterUnit", "innerDiameterUnit",
                "lengthUnit", "material", "shearModulus", "modulusUnit", "stressUnit"],
            model: () => {
                const diameterUnit = str("diameterUnit");
                return {
                    shaftType: str("shaftType"), torque: num("torque"), torqueUnit: str("torqueUnit"),
                    outer: positive(num("outerDiameter")),
                    inner: nonneg(convertDistance(num("innerDiameter"), str("innerDiameterUnit"), diameterUnit)),
                    diameterUnit,
                    length: positive(num("length")), lengthUnit: str("lengthUnit")
                };
            },
            commit: "calculateShaftTorsion",
            ranges: [
                { inputId: "torque", label: "Applied torque T", unit: unitOf("torqueUnit"), bounds: (v) => (v !== 0 ? span(v, (x) => -Math.abs(x) * 2, (x) => Math.abs(x) * 2) : null) }
            ]
        },
        "bolt-torque": {
            watch: ["unitSystem", "boltSize", "clampLoad", "nutFactor", "loadUnit", "torqueUnit"],
            model: () => {
                const diameter = typeof root.getBoltDiameterFromSelection === "function" ? root.getBoltDiameterFromSelection() : undefined;
                return {
                    diameter: Number.isFinite(diameter) && diameter > 0 ? diameter : undefined,
                    diameterUnit: str("unitSystem") === "metric" ? "mm" : "in",
                    clamp: positive(num("clampLoad")), clampUnit: str("loadUnit"), nutFactor: positive(num("nutFactor"))
                };
            }
        },
        "thread-strength": {
            watch: ["majorDiameter", "engagementLength", "threadPitch", "appliedLoad", "distanceUnit", "pitchUnit", "forceUnit",
                "tensileStressArea", "boltStrength", "internalStrength", "areaUnit", "strengthUnit", "boltMaterial", "internalMaterial"],
            model: () => {
                const distanceUnit = str("distanceUnit");
                const pitchUnit = str("pitchUnit");
                const rawPitch = positive(num("threadPitch"));
                const pitch = pitchUnit === "TPI"
                    ? (rawPitch ? convertDistance(1 / rawPitch, "in", distanceUnit) : undefined)
                    : convertDistance(rawPitch, pitchUnit, distanceUnit);
                return {
                    diameter: positive(num("majorDiameter")), diameterUnit: distanceUnit, engagement: positive(num("engagementLength")),
                    engagementUnit: distanceUnit, pitch: positive(pitch),
                    load: nonneg(num("appliedLoad")), loadUnit: str("forceUnit")
                };
            }
        },
        "fillet-weld": {
            watch: ["weldLeg", "weldLegUnit", "weldLength", "weldLengthUnit", "loadDirection", "appliedLoad", "forceUnit", "electrode", "designMethod"],
            model: () => {
                const angle = num("loadDirection");
                return {
                    leg: positive(num("weldLeg")), legUnit: str("weldLegUnit"), length: positive(num("weldLength")), lengthUnit: str("weldLengthUnit"),
                    angle: angle !== undefined && angle >= 0 && angle <= 90 ? angle : undefined, load: nonneg(num("appliedLoad")), loadUnit: str("forceUnit")
                };
            }
        },
        "press-fit": {
            watch: ["interfaceDiameter", "diametralInterference", "interferenceUnit", "hubOuterDiameter", "shaftBoreDiameter", "engagementLength",
                "frictionCoefficient", "distanceUnit", "stressUnit", "forceUnit", "torqueUnit", "hubMaterial", "shaftMaterial"],
            model: () => {
                const diameter = positive(num("interfaceDiameter"));
                const distanceUnit = str("distanceUnit");
                const interference = nonneg(num("diametralInterference"));
                const interferenceUnit = str("interferenceUnit");
                const sameUnitInterference = convertDistance(interference, interferenceUnit, distanceUnit);
                return {
                    interface: diameter, hubOuter: positive(num("hubOuterDiameter")), bore: nonneg(num("shaftBoreDiameter")),
                    length: positive(num("engagementLength")), distanceUnit, interference, interferenceUnit,
                    relativeInterference: diameter && sameUnitInterference !== undefined ? sameUnitInterference / diameter : undefined,
                    friction: nonneg(num("frictionCoefficient"))
                };
            },
            commit: "calculatePressFit",
            ranges: [
                { inputId: "diametralInterference", label: "Diametral interference δ", unit: unitOf("interferenceUnit"), bounds: (v) => (v >= 0 ? { min: 0, max: Math.max(v * 2, 1e-6) } : null) }
            ]
        },
        "column-buckling": {
            watch: ["boundaryCondition", "length", "lengthUnit", "sectionType", "material", "outerDiameter", "outerDiameterUnit",
                "innerDiameter", "innerDiameterUnit", "forceUnit"],
            model: () => ({ condition: str("boundaryCondition"), length: positive(num("length")), lengthUnit: str("lengthUnit") })
        },
        "beam-bending-stress": {
            watch: ["sectionType", "bendingAxis", "moment", "momentUnit", "rectWidth", "rectWidthUnit", "rectHeight", "rectHeightUnit",
                "diameter", "diameterUnit", "outerDiameter", "outerDiameterUnit", "innerDiameter", "innerDiameterUnit",
                "outerWidth", "outerWidthUnit", "outerHeight", "outerHeightUnit", "wallThickness", "wallThicknessUnit",
                "overallHeight", "overallHeightUnit", "flangeWidth", "flangeWidthUnit", "flangeThickness", "flangeThicknessUnit", "webThickness", "webThicknessUnit", "stressUnit"],
            model: () => {
                const profile = str("sectionType");
                const axis = str("bendingAxis");
                const model = { profile, axis, moment: num("moment"), momentUnit: str("momentUnit") };
                const fields = root.BeamSectionUI && root.BeamSectionUI.getFields(profile);
                if (!fields || !root.BeamSectionProperties || typeof root.convertDistance !== "function") return model;
                const dimensions = {};
                for (const field of fields) {
                    const value = num(field.id);
                    const unit = str(field.unit);
                    if (value === undefined || !unit) return model;
                    dimensions[field.key] = root.convertDistance(value, unit);
                }
                try {
                    const properties = root.BeamSectionProperties.calculate(profile, dimensions);
                    const width = dimensions.width || dimensions.diameter || dimensions.outerDiameter || dimensions.outerWidth || dimensions.flangeWidth;
                    const height = dimensions.height || dimensions.diameter || dimensions.outerDiameter || dimensions.outerHeight;
                    const unit = str(fields[0].unit);
                    const c = axis === "x" ? properties.extremeFiberX : properties.extremeFiberY;
                    const display = (value) => value === undefined ? undefined : root.convertDistanceToUnit(value, unit);
                    return Object.assign(model, {
                        centroidXRatio: properties.centroidX / width, centroidYRatio: properties.centroidY / height,
                        c: display(c), distanceUnit: unit, width: display(width), height: display(height),
                        innerDiameter: display(dimensions.innerDiameter), wallThickness: display(dimensions.wallThickness),
                        flangeThickness: display(dimensions.flangeThickness), webThickness: display(dimensions.webThickness)
                    });
                } catch (error) {
                    return model;
                }
            }
        },
        "stress-strain": {
            watch: ["calculationMode", "force", "forceUnit", "area", "areaUnit", "originalLength", "lengthUnit", "deltaLength",
                "deltaLengthUnit", "strain", "youngsModulus", "modulusUnit", "outputUnit"],
            model: () => {
                const mode = str("calculationMode");
                const usesForce = mode !== "strain";
                const usesLength = mode === "strain" || mode === "deformation";
                const model = {
                    mode,
                    force: usesForce ? num("force") : undefined,
                    forceUnit: usesForce ? str("forceUnit") : undefined,
                    area: usesForce ? positive(num("area")) : undefined,
                    areaUnit: usesForce ? str("areaUnit") : undefined,
                    length: usesLength ? positive(num("originalLength")) : undefined,
                    lengthUnit: usesLength ? str("lengthUnit") : undefined
                };
                if (mode === "strain") model.deltaLength = convertDistance(num("deltaLength"), str("deltaLengthUnit"), str("lengthUnit"));
                if (mode === "youngsModulus") model.strain = num("strain");
                return model;
            }
        },
        "thermal-expansion": {
            watch: ["originalLength", "lengthUnit", "temperatureChange", "temperatureUnit", "material", "alpha", "alphaUnit",
                "youngsModulus", "modulusUnit", "outputLengthUnit", "stressUnit"],
            model: () => ({ length: positive(num("originalLength")), lengthUnit: str("lengthUnit"), deltaT: num("temperatureChange"), tempUnit: str("temperatureUnit") }),
            commit: "calculateThermalExpansion",
            ranges: [
                { inputId: "temperatureChange", label: "Temperature change ΔT", unit: unitOf("temperatureUnit"), bounds: (v) => {
                    const limit = Math.max(100, Math.abs(v) * 2);
                    return { min: -limit, max: limit };
                }, step: 1 }
            ]
        },
        "differential-thermal-expansion": {
            watch: ["lengthUnit", "alphaUnit", "temperatureUnit", "outputLengthUnit"],
            delegate: ["membersA", "membersB"],
            model: () => {
                const units = { length: str("lengthUnit"), alpha: str("alphaUnit"), temperature: str("temperatureUnit") };
                const read = (member) => {
                    try {
                        return root.readDteSections(member, units).sections;
                    } catch (error) {
                        return [];
                    }
                };
                const A = read("A");
                const B = read("B");
                if (!A.length && !B.length) return {};
                const rows = (sections) => sections.map((s) => [s.length, s.alpha * (s.tFinal - s.tInitial)]);
                return { a: rows(A), b: rows(B), lengthUnit: str("outputLengthUnit") };
            }
        },
        "factor-of-safety": {
            watch: ["mode", "strength", "strengthUnit", "appliedStress", "appliedStressUnit", "failureLoad", "failureLoadUnit", "appliedLoad", "appliedLoadUnit",
                "strengthSource", "material"],
            model: () => {
                const stress = str("mode") !== "load";
                const capacityId = stress ? "strength" : "failureLoad";
                const demandId = stress ? "appliedStress" : "appliedLoad";
                const capUnit = str(capacityId + "Unit");
                const demUnit = str(demandId + "Unit");
                const toBase = stress ? root.convertStress : root.convertForce;
                const fromBase = stress ? root.convertStressToUnit : root.convertForceToUnit;
                const capacity = positive(num(capacityId));
                const demandRaw = positive(num(demandId));
                let demand;
                if (demandRaw !== undefined && typeof toBase === "function" && typeof fromBase === "function") {
                    demand = positive(fromBase(toBase(demandRaw, demUnit), capUnit));
                }
                return { mode: stress ? "stress" : "load", capacity, demand, unit: capUnit };
            }
        },
        "hertzian-contact": {
            watch: ["configuration", "shape2", "diameter1", "diameter2", "contactLength", "contactForce", "distanceUnit", "forceUnit",
                "stressUnit", "contactUnit", "material1", "material2", "modulus1", "modulus2", "modulusUnit1", "modulusUnit2", "poisson1", "poisson2"],
            model: () => ({
                config: str("configuration"), shape2: str("shape2"), d1: positive(num("diameter1")), d2: nonneg(num("diameter2")),
                length: positive(num("contactLength")), distanceUnit: str("distanceUnit"), force: positive(num("contactForce")), forceUnit: str("forceUnit")
            })
        },
        "thick-walled-cylinder": {
            watch: ["innerDiameter", "outerDiameter", "internalPressure", "externalPressure", "endCondition", "distanceUnit", "stressUnit"],
            model: () => ({
                inner: positive(num("innerDiameter")), outer: positive(num("outerDiameter")), distanceUnit: str("distanceUnit"),
                pi: nonneg(num("internalPressure")), po: nonneg(num("externalPressure")), pressureUnit: str("stressUnit"), end: str("endCondition")
            })
        }
    };

    const page = PAGES[diagramId];
    if (!page) return;
    const inputKey = () => {
        const fields = [
            ...page.watch.map(el).filter(Boolean),
            ...(page.delegate || []).flatMap((id) => Array.from(el(id)?.querySelectorAll("input, select, textarea") || []))
        ];
        return JSON.stringify(fields.map((field) => [field.value, field.checked]));
    };
    let solved;
    let status = "";
    const statusLabels = hosts.map((host) => {
        const label = document.createElement("p");
        label.className = "ff-diagram-status";
        label.setAttribute("role", "status");
        label.hidden = true;
        host.closest("figure")?.appendChild(label);
        return label;
    });

    const updaters = hosts.map((host, index) => {
        const forced = host.getAttribute("data-diagram-config");
        const captionHost = document.getElementById(host.id + "Caption");
        const figcaption = captionHost || document.getElementById("calcDiagramCaption");
        if (figcaption) figcaption.textContent = registry.caption(diagramId);
        return registry.attach(document, host.id, diagramId, {
            model: () => {
                const model = page.model();
                if (solved && (!forced || forced === model.config)) Object.assign(model, solved.fields);
                if (forced) model.config = forced;
                return model;
            },
            ranges: index === 0 ? page.ranges : undefined,
            onCommit: page.commit ? run(page.commit) : undefined
        });
    });
    const update = () => {
        if (solved && solved.key !== inputKey()) {
            solved = undefined;
            status = "Recalculate to update diagram results.";
        }
        statusLabels.forEach((label) => {
            if (label.textContent !== status) label.textContent = status;
            label.hidden = !status;
        });
        updaters.forEach((item) => item.update());
    };
    [...page.watch, ...(page.delegate || [])].forEach((id) => {
        const target = el(id);
        if (!target) return;
        target.addEventListener("input", update);
        target.addEventListener("change", update);
    });
    // Called by the existing solver. Refresh synchronously so a report can capture
    // the same results, then discard those annotations at the first input change.
    const publish = (fields) => {
        solved = fields ? { fields: registry.normalize(diagramId, fields, false), key: inputKey() } : undefined;
        status = fields ? "" : "Diagram results unavailable. Check the calculator inputs.";
        update();
    };
    const reset = () => {
        solved = undefined;
        status = "";
        update();
    };
    root.FormulaFoundryCalculatorDiagramPage = { update, publish, reset };
    root.addEventListener("load", update);

    // Result-driven pages refresh again once the page's own calculation has produced output.
    const result = el("result");
    if (result && typeof root.MutationObserver === "function") {
        new root.MutationObserver(update).observe(result, { childList: true, subtree: true });
    }
})(window);
