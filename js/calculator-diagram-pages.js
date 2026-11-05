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
    const run = (name) => () => {
        const result = el("result");
        if (result && result.querySelector(".result-value") && typeof root[name] === "function") root[name]();
    };
    const span = (value, low, high) => ({ min: Math.min(low(value), high(value)), max: Math.max(low(value), high(value)) });
    const unitOf = (id) => () => str(id) || "";

    const PAGES = {
        moment: {
            watch: ["force", "distance", "forceUnit", "distanceUnit"],
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
            watch: ["boreDiameter", "rodDiameter", "workingPressure", "efficiency", "distanceUnit", "pressureUnit"],
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
            watch: ["wireDiameter", "meanCoilDiameter", "activeCoils", "appliedForce", "distanceUnit", "forceUnit"],
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
            watch: ["shaftType", "torque", "outerDiameter", "innerDiameter", "length", "torqueUnit", "diameterUnit", "innerDiameterUnit", "lengthUnit"],
            model: () => {
                const torque = num("torque");
                return {
                    shaftType: str("shaftType"), torque: torque !== 0 ? torque : undefined, torqueUnit: str("torqueUnit"),
                    outer: positive(num("outerDiameter")), inner: nonneg(num("innerDiameter")), diameterUnit: str("diameterUnit"),
                    length: positive(num("length")), lengthUnit: str("lengthUnit")
                };
            },
            commit: "calculateShaftTorsion",
            ranges: [
                { inputId: "torque", label: "Applied torque T", unit: unitOf("torqueUnit"), bounds: (v) => (v !== 0 ? span(v, (x) => -Math.abs(x) * 2, (x) => Math.abs(x) * 2) : null) }
            ]
        },
        "bolt-torque": {
            watch: ["unitSystem", "boltSize", "clampLoad", "nutFactor", "loadUnit"],
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
            watch: ["majorDiameter", "engagementLength", "threadPitch", "appliedLoad", "distanceUnit", "pitchUnit", "forceUnit"],
            model: () => ({
                diameter: positive(num("majorDiameter")), diameterUnit: str("distanceUnit"), engagement: positive(num("engagementLength")),
                engagementUnit: str("distanceUnit"), pitch: str("pitchUnit") === "TPI" ? undefined : positive(num("threadPitch")),
                load: nonneg(num("appliedLoad")), loadUnit: str("forceUnit")
            })
        },
        "fillet-weld": {
            watch: ["weldLeg", "weldLegUnit", "weldLength", "weldLengthUnit", "loadDirection", "appliedLoad", "forceUnit"],
            model: () => {
                const angle = num("loadDirection");
                return {
                    leg: positive(num("weldLeg")), legUnit: str("weldLegUnit"), length: positive(num("weldLength")), lengthUnit: str("weldLengthUnit"),
                    angle: angle !== undefined && angle >= 0 && angle <= 90 ? angle : undefined, load: positive(num("appliedLoad")), loadUnit: str("forceUnit")
                };
            }
        },
        "press-fit": {
            watch: ["interfaceDiameter", "diametralInterference", "interferenceUnit", "hubOuterDiameter", "shaftBoreDiameter", "engagementLength", "frictionCoefficient", "distanceUnit"],
            model: () => ({
                interface: positive(num("interfaceDiameter")), hubOuter: positive(num("hubOuterDiameter")), bore: nonneg(num("shaftBoreDiameter")),
                length: positive(num("engagementLength")), distanceUnit: str("distanceUnit"), interference: nonneg(num("diametralInterference")),
                interferenceUnit: str("interferenceUnit"), friction: nonneg(num("frictionCoefficient"))
            }),
            commit: "calculatePressFit",
            ranges: [
                { inputId: "diametralInterference", label: "Diametral interference δ", unit: unitOf("interferenceUnit"), bounds: (v) => (v >= 0 ? { min: 0, max: Math.max(v * 2, 1e-6) } : null) }
            ]
        },
        "column-buckling": {
            watch: ["boundaryCondition", "length", "lengthUnit"],
            model: () => ({ condition: str("boundaryCondition"), length: positive(num("length")), lengthUnit: str("lengthUnit") })
        },
        "beam-bending-stress": {
            watch: ["sectionType", "bendingAxis", "moment", "momentUnit"],
            model: () => ({ profile: str("sectionType"), axis: str("bendingAxis"), moment: num("moment"), momentUnit: str("momentUnit") })
        },
        "stress-strain": {
            watch: ["calculationMode", "force", "forceUnit", "area", "areaUnit", "originalLength", "lengthUnit", "deltaLength", "strain"],
            model: () => ({
                force: num("force"), forceUnit: str("forceUnit"), area: positive(num("area")), areaUnit: str("areaUnit"),
                length: positive(num("originalLength")), lengthUnit: str("lengthUnit"), deltaLength: num("deltaLength"), strain: num("strain")
            })
        },
        "thermal-expansion": {
            watch: ["originalLength", "lengthUnit", "temperatureChange", "temperatureUnit"],
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
                const model = { a: rows(A), b: rows(B), lengthUnit: str("outputLengthUnit") };
                if (A.length && typeof root.computeDifferentialExpansion === "function" && typeof root.convertDistanceToUnit === "function") {
                    const out = root.computeDifferentialExpansion(A, B.length ? B : null);
                    const toUnit = (m) => root.convertDistanceToUnit(m, model.lengthUnit);
                    model.expA = toUnit(out.memberA.expansion);
                    if (out.memberB) {
                        model.expB = toUnit(out.memberB.expansion);
                        model.diff = toUnit(out.differential);
                    }
                }
                return model;
            }
        },
        "factor-of-safety": {
            watch: ["mode", "strength", "strengthUnit", "appliedStress", "appliedStressUnit", "failureLoad", "failureLoadUnit", "appliedLoad", "appliedLoadUnit"],
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
            watch: ["configuration", "shape2", "diameter1", "diameter2", "contactLength", "contactForce", "distanceUnit", "forceUnit"],
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
    const updaters = hosts.map((host, index) => {
        const forced = host.getAttribute("data-diagram-config");
        const captionHost = document.getElementById(host.id + "Caption");
        const figcaption = captionHost || document.getElementById("calcDiagramCaption");
        if (figcaption) figcaption.textContent = registry.caption(diagramId);
        return registry.attach(document, host.id, diagramId, {
            model: () => (forced ? Object.assign(page.model(), { config: forced }) : page.model()),
            watch: index === 0 ? page.watch : [],
            ranges: index === 0 ? page.ranges : undefined,
            onCommit: page.commit ? run(page.commit) : undefined
        });
    });
    const update = () => updaters.forEach((item) => item.update());
    if (hosts.length > 1) {
        page.watch.forEach((id) => {
            const field = el(id);
            if (!field) return;
            field.addEventListener("input", update);
            field.addEventListener("change", update);
        });
    }
    (page.delegate || []).forEach((id) => {
        const container = el(id);
        if (!container) return;
        container.addEventListener("input", update);
        container.addEventListener("change", update);
    });
    root.FormulaFoundryCalculatorDiagramPage = { update };
    root.addEventListener("load", update);

    // Result-driven pages refresh again once the page's own calculation has produced output.
    const result = el("result");
    if (result && typeof root.MutationObserver === "function") {
        new root.MutationObserver(update).observe(result, { childList: true, subtree: true });
    }
})(window);
