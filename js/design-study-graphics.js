(function (root) {
    "use strict";

    // Scenario inputs use adapter display units. Calculated annotations come from
    // the persisted, current output rows, so browsing a study never reruns a solve.
    const sectionFields = {
        rectangular: ["width", "height"],
        "solid-circular": ["diameter"],
        "hollow-circular": ["outerDiameter", "innerDiameter"],
        "hollow-rectangular": ["outerWidth", "outerHeight", "wallThickness"],
        "i-beam": ["height", "flangeWidth", "flangeThickness", "webThickness"],
        "t-section": ["height", "flangeWidth", "flangeThickness", "webThickness"]
    };

    function sectionDimensions(v) {
        const fields = sectionFields[v.text("sectionType")] || [];
        return Object.fromEntries(fields.map((key) => [key, v.raw("section_" + key)]));
    }

    function beamSection(v) {
        const profile = v.text("sectionType");
        const dimensions = sectionDimensions(v);
        const keys = sectionFields[profile] || [];
        const unit = v.unitOf("section_" + keys[0]);
        return { profile, dimensions, unit };
    }

    const models = {
        moment: (v, o) => ({
            force: v.raw("force"), forceUnit: v.unitOf("force"), distance: v.raw("distance"),
            distanceUnit: v.unitOf("distance"), moment: o("moment").value, momentUnit: o("moment").unit
        }),
        "bearing-life": (v, o) => ({
            bearingType: v.text("bearingType"), rating: v.raw("dynamicLoadRating"), ratingUnit: v.unitOf("dynamicLoadRating"),
            load: v.raw("equivalentLoad"), loadUnit: v.unitOf("equivalentLoad"), speed: v.raw("speed"),
            speedUnit: v.unitOf("speed"), lifeMillions: o("lifeMillionRevolutions").value, lifeHours: o("lifeHours").value
        }),
        "cylinder-force": (v, o) => ({
            bore: v.raw("boreDiameter"), rod: v.raw("rodDiameter"), distanceUnit: v.unitOf("boreDiameter"),
            pressure: v.raw("workingPressure"), pressureUnit: v.unitOf("workingPressure"), efficiency: v.raw("efficiency"),
            pistonArea: o("pistonArea").value, annularArea: o("annularArea").value, areaUnit: o("pistonArea").unit,
            extensionForce: o("extensionForce").value, retractionForce: o("retractionForce").value,
            forceUnit: o("extensionForce").unit
        }),
        "spring-calculations": (v, o) => ({
            wire: v.raw("wireDiameter"), coil: v.raw("meanDiameter"), coils: v.raw("activeCoils"),
            distanceUnit: v.unitOf("wireDiameter"), force: v.raw("force"), forceUnit: v.unitOf("force"),
            deflection: lengthIn(o("deflection"), v.unitOf("wireDiameter"))
        }),
        "shaft-torsion": (v, o) => ({
            shaftType: v.text("shaftType"), torque: v.raw("torque"), torqueUnit: v.unitOf("torque"),
            outer: v.raw("outerDiameter"), inner: v.raw("innerDiameter"), diameterUnit: v.unitOf("outerDiameter"),
            length: v.raw("length"), lengthUnit: v.unitOf("length"), twist: o("angleOfTwist").value,
            twistUnit: o("angleOfTwist").unit, tauMax: o("maximumShearStress").value, stressUnit: o("maximumShearStress").unit
        }),
        "bolt-torque": (v, o) => ({
            diameter: v.raw("nominalDiameter"), diameterUnit: v.unitOf("nominalDiameter"), clamp: v.raw("clampLoad"),
            clampUnit: v.unitOf("clampLoad"), nutFactor: v.raw("nutFactor"), torque: o("torque").value, torqueUnit: o("torque").unit
        }),
        "thread-strength": (v, o) => ({
            diameter: v.raw("majorDiameter"), diameterUnit: v.unitOf("majorDiameter"), engagement: v.raw("engagementLength"),
            engagementUnit: v.unitOf("engagementLength"), pitch: fromMetres(v.pos("threadPitch"), v.unitOf("majorDiameter")),
            load: v.raw("appliedLoad"), loadUnit: v.unitOf("appliedLoad"),
            tensileCapacity: o("fastenerCapacity").value, strippingCapacity: o("strippingCapacity").value
        }),
        "fillet-weld": (v, o) => ({
            leg: v.raw("weldLeg"), legUnit: v.unitOf("weldLeg"), length: v.raw("weldLength"), lengthUnit: v.unitOf("weldLength"),
            angle: v.text("loadDirection") === null ? undefined : Number(v.text("loadDirection")),
            load: v.raw("appliedLoad"), loadUnit: v.unitOf("appliedLoad"), throat: o("throat").value
        }),
        "press-fit": (v, o) => {
            const diameter = v.pos("interfaceDiameter");
            const interference = v.pos("diametralInterference");
            return { interface: v.raw("interfaceDiameter"), hubOuter: v.raw("hubOuterDiameter"), bore: v.raw("shaftBoreDiameter"),
                length: v.raw("engagementLength"), distanceUnit: v.unitOf("interfaceDiameter"),
                interference: v.raw("diametralInterference"), interferenceUnit: v.unitOf("diametralInterference"),
                relativeInterference: diameter && interference ? interference / diameter : undefined,
                friction: v.raw("frictionCoefficient"), pressure: o("contactPressure").value, pressureUnit: o("contactPressure").unit,
                assemblyForce: o("assemblyForce").value, assemblyForceUnit: o("assemblyForce").unit,
                torqueCapacity: o("torqueCapacity").value, torqueCapacityUnit: o("torqueCapacity").unit };
        },
        "column-buckling": (v, o) => ({
            condition: v.text("boundaryCondition"), length: v.raw("length"), lengthUnit: v.unitOf("length"),
            critical: o("criticalLoad").value, forceUnit: o("criticalLoad").unit
        }),
        "beam-bending-stress": (v, o) => {
            const { profile, dimensions: d, unit } = beamSection(v);
            const axis = v.text("bendingAxis");
            const model = { profile, axis, moment: v.raw("moment"), momentUnit: v.unitOf("moment"),
                stress: o("bendingStress").value, stressUnit: o("bendingStress").unit };
            if (!Object.keys(d).length || !Object.values(d).every((value) => value > 0)) return model;
            try {
                // Section properties here locate the centroid and extreme fiber in the drawing.
                const properties = root.BeamSectionProperties.calculate(profile, d);
                const width = d.width || d.outerDiameter || d.diameter || d.outerWidth || d.flangeWidth;
                const height = d.height || d.outerDiameter || d.diameter || d.outerHeight;
                return { ...model, width, height, distanceUnit: unit, innerDiameter: d.innerDiameter,
                    wallThickness: d.wallThickness, flangeThickness: d.flangeThickness, webThickness: d.webThickness,
                    centroidXRatio: properties.centroidX / width, centroidYRatio: properties.centroidY / height,
                    c: axis === "y" ? properties.extremeFiberY : properties.extremeFiberX };
            } catch (error) {
                return model;
            }
        },
        "stress-strain": (v, o) => {
            const mode = v.text("mode");
            const lengthUnit = v.unitOf("originalLength");
            return { mode, force: mode === "strain" ? undefined : v.raw("force"), forceUnit: v.unitOf("force"),
                area: mode === "strain" ? undefined : v.raw("area"), areaUnit: v.unitOf("area"),
                length: mode === "stress" ? undefined : v.raw("originalLength"), lengthUnit,
                deltaLength: mode === "strain" ? fromMetres(v.si("deltaLength"), lengthUnit) : lengthIn(o("elongation"), lengthUnit),
                strain: o("strain").value ?? (mode === "youngsModulus" ? v.raw("strain") : undefined),
                stress: o("stress").value, stressUnit: o("stress").unit,
                modulus: o("modulus").value, modulusUnit: o("modulus").unit };
        },
        "thermal-expansion": (v, o) => ({
            length: v.raw("originalLength"), lengthUnit: v.unitOf("originalLength"), deltaT: v.raw("temperatureChange"),
            tempUnit: v.unitOf("temperatureChange"), deltaLength: o("expansion").value, deltaLengthUnit: o("expansion").unit,
            stress: Number.isFinite(o("restrainedStress").value) ? -o("restrainedStress").value : undefined,
            stressUnit: o("restrainedStress").unit
        }),
        "differential-thermal-expansion": (v, o) => ({
            a: thermalMember(v, "A"), b: thermalMember(v, "B"), expA: o("memberAExpansion").value,
            expB: o("memberBExpansion").value, diff: o("differential").value, lengthUnit: o("memberAExpansion").unit
        }),
        "factor-of-safety": (v, o) => {
            const mode = v.text("mode");
            return mode === "load" ? { mode, capacity: v.raw("failureLoad"), demand: v.raw("appliedLoad"),
                unit: v.unitOf("failureLoad"), factor: o("loadFactor").value }
                : { mode, capacity: o("strengthUsed").value ?? v.raw("strength"), demand: v.raw("appliedStress"),
                    unit: v.unitOf("strength"), factor: o("stressFactor").value };
        },
        "hertzian-contact": (v, o) => {
            const config = v.text("configuration");
            const contact = o(config === "spheres" ? "contactRadius" : "halfWidth");
            return { config, shape2: v.text("shape2"), d1: v.raw("diameter1"), d2: v.raw("diameter2"),
                length: v.raw("contactLength"), distanceUnit: v.unitOf("diameter1"), force: v.raw("contactForce"),
                forceUnit: v.unitOf("contactForce"), contact: contact.value, contactUnit: contact.unit,
                pressure: o("maxPressure").value, pressureUnit: o("maxPressure").unit };
        },
        "thick-walled-cylinder": (v) => ({
            inner: v.raw("innerDiameter"), outer: v.raw("outerDiameter"), distanceUnit: v.unitOf("innerDiameter"),
            pi: v.raw("internalPressure"), po: v.raw("externalPressure"), pressureUnit: v.unitOf("internalPressure"),
            end: v.text("endCondition")
        })
    };

    function fromMetres(value, unit) {
        return Number.isFinite(value) ? root.convertDistanceToUnit(value, unit) : undefined;
    }

    function lengthIn(output, unit) {
        return Number.isFinite(output.value) ? fromMetres(root.convertDistance(output.value, output.unit), unit) : undefined;
    }

    function thermalMember(v, member) {
        return [1, 2, 3].flatMap((index) => {
            const prefix = member + index;
            const length = v.pos(prefix + "Length");
            if (length === null) return [];
            const initial = v.si(prefix + "Ti");
            const final = v.si(prefix + "Tf");
            const alpha = v.si(prefix + "Alpha") ?? root.getMaterialProperty(v.text(prefix + "Material"), "thermalExpansionCoefficient");
            const strain = [alpha, initial, final].every(Number.isFinite) ? alpha * (final - initial) : 0;
            return [[length, Number.isFinite(strain) ? strain : 0]];
        });
    }

    function outputs(scenario) {
        const rows = scenario?.status === "calculated" ? scenario.result?.outputs : null;
        const values = new Map((rows || []).map((output) => [output.id, output]));
        return (key) => values.get(key) || {};
    }

    function diagram(id, scenario, v) {
        const registry = root.FormulaFoundryCalculatorDiagrams;
        if (!Object.hasOwn(models, id) || !registry?.has(id)) return null;
        return { type: "calc-diagram", id, model: registry.normalize(id, models[id](v, outputs(scenario)), false) };
    }

    function beamSnapshot(scenario, v) {
        const magnitude = outputs(scenario)("deflectionMagnitude");
        const profile = v.text("sectionType");
        const dimensions = Object.fromEntries((sectionFields[profile] || []).map((key) => [key, v.si("section_" + key)]));
        const caseId = v.text("loadingCase");
        const point = caseId?.endsWith("point");
        const loadInput = point ? "pointLoad" : "uniformLoad";
        if (!Number.isFinite(magnitude.value)) return null;
        // Beam reports have a fixed schema-v1 unit list. Base units are accepted
        // for every study, including studies entered in units outside that list.
        return { type: "beam-deflection", caseId, span: v.si("span"), spanUnit: "m",
            load: v.si(loadInput), loadUnit: point ? "N" : "N/m", profile, dimensions, axis: v.text("bendingAxis"),
            sectionUnit: "m", maxDeflection: magnitude.value, deflectionUnit: magnitude.unit };
    }

    root.FormulaFoundryStudyGraphics = { diagram, beamSnapshot };
})(window);
