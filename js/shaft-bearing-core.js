// SI mechanical model. Speed is in rpm, bearing life in million revolutions and operating hours.
(function (root) {
    "use strict";

    const ID = "shaft-bearing";
    const MODEL_VERSION = 1;
    const MAX_LOADS = 8;
    const POSITION_ROUNDOFF = 4 * Number.EPSILON;
    const DEFLECTION_METHOD = "Piecewise Euler–Bernoulli superposition. Maximum displacement is estimated by isolating stationary roots of the squared displacement magnitude on each interval (normalized station tolerance 10⁻¹²).";
    const ASSUMPTIONS = Object.freeze([
        "Straight, uniform circular shaft between two ideal simple radial supports. Shaft mass is informational and self-weight is excluded.",
        "Bending and deflection use a slender, small-deflection, linear-elastic Euler–Bernoulli beam with separate signed load planes.",
        "Signed external torque at the introduction station is balanced by the opposite torque at extraction. Bearings supply no torque.",
        "Nominal outer-fiber bending and torsional stresses use ductile von Mises static yield assessment. Keyway, shoulder, notch, spline, surface-finish, residual-stress and fatigue effects are excluded.",
        "Stationary transverse forces can produce fully reversed bending stress in a rotating shaft.",
        "Bearing reactions supply simplified radial dynamic and static loads. L10 is statistical basic rating life. Axial load, preload, lubrication, contamination, misalignment, operating temperature, limiting speed and modified life are excluded."
    ]);
    const EQUATIONS = Object.freeze([
        String.raw`R_{Bq}=-\sum_i F_{iq}a_i/L,\quad R_{Aq}=-\sum_i F_{iq}-R_{Bq},\quad q\in\{y,z\}`,
        String.raw`V_q=R_{Aq}+\sum_{a_i<x}F_{iq},\quad M_q=R_{Aq}x+\sum_i F_{iq}\langle x-a_i\rangle,\quad M=\sqrt{M_y^2+M_z^2}`,
        String.raw`A=\frac{\pi}{4}(D_o^2-D_i^2),\quad I=\frac{\pi}{64}(D_o^4-D_i^4),\quad J=2I,\quad S=2I/D_o`,
        String.raw`\sigma_b=M/S,\quad \tau=\frac{TD_o}{2J},\quad \sigma_\mathrm{eq}=\sqrt{\sigma_b^2+3\tau^2},\quad n_y=S_y/\sigma_\mathrm{eq}`,
        String.raw`\theta_\mathrm{in}-\theta_\mathrm{out}=\frac{T(x_\mathrm{out}-x_\mathrm{in})}{GJ},\quad EI\,u_q''=M_q,\quad u_q(0)=u_q(L)=0`,
        String.raw`P=\sqrt{R_y^2+R_z^2},\quad L_{10}=(C/P)^p,\quad L_{10h}=\frac{10^6 L_{10}}{60n},\quad p=3\text{ (ball) or }10/3\text{ (roller)}`,
        String.raw`C_{\mathrm{required}}=P\left(\frac{60n L_{\mathrm{target,h}}}{10^6}\right)^{1/p},\quad s_0=C_0/P`
    ]);

    function failure(field, message) {
        return { ok: false, errors: [{ field, message }] };
    }

    function validate(inputs) {
        const errors = [];
        function require(condition, field, message) {
            if (!condition) errors.push({ field, message });
        }
        const positive = value => Number.isFinite(value) && value > 0;
        const optionalPositive = value => value == null || positive(value);
        const validPosition = value => Number.isFinite(value) && value >= 0
            && (value <= inputs.span || value - inputs.span <= POSITION_ROUNDOFF * inputs.span);
        require(positive(inputs.span), "span", "Bearing span must be positive.");
        require(["solid", "hollow"].includes(inputs.section), "section", "Choose a solid or hollow circular shaft.");
        require(positive(inputs.outerDiameter), "outerDiameter", "Outside diameter must be positive.");
        if (inputs.section === "hollow") {
            require(positive(inputs.innerDiameter) && inputs.innerDiameter < inputs.outerDiameter, "innerDiameter",
                "Hollow shaft inside diameter must be positive and less than outside diameter.");
        }

        const properties = { youngModulus: "Young’s modulus", shearModulus: "Shear modulus", yieldStrength: "Yield strength", density: "Density" };
        for (const [key, label] of Object.entries(properties)) {
            require(optionalPositive(inputs.material?.[key]), "material." + key, label + " must be positive when supplied.");
        }
        require(Number.isFinite(inputs.speed) && inputs.speed >= 0, "speed", "Shaft speed must be zero or positive.");

        const torque = inputs.torque || {};
        require(Number.isFinite(torque.value), "torque.value", "Enter a finite signed torque, including zero if no torque is transmitted.");
        require(validPosition(torque.start), "torque.start", "Torque introduction must be within the bearing span.");
        require(validPosition(torque.end), "torque.end", "Torque extraction must be within the bearing span.");
        const start = Math.min(torque.start, inputs.span);
        const end = Math.min(torque.end, inputs.span);
        require(end > start || (torque.value === 0 && end === start), "torque.end",
            "Place extraction at or to the right of introduction. Use separate stations for nonzero torque.");

        require(Array.isArray(inputs.loads) && inputs.loads.length <= MAX_LOADS, "loads", "Use up to eight point loads.");
        if (Array.isArray(inputs.loads)) {
            for (const [index, station] of inputs.loads.entries()) {
                const prefix = "loads." + index + ".";
                require(validPosition(station?.position), prefix + "position",
                    "Load " + (index + 1) + " must be at or between the bearing supports.");
                for (const axis of ["fy", "fz"]) {
                    require(Number.isFinite(station?.[axis]), prefix + axis,
                        "Load " + (index + 1) + " requires a signed " + axis.toUpperCase() + " force, including zero.");
                }
            }
        }

        for (const side of ["a", "b"]) {
            const bearing = inputs.bearings?.[side] || {};
            const prefix = "bearings." + side + ".";
            const name = "Bearing " + side.toUpperCase();
            require(["ball", "roller"].includes(bearing.type), prefix + "type", name + " must be a ball or roller bearing.");
            require(positive(bearing.dynamicRating), prefix + "dynamicRating", name + " dynamic rating C must be positive.");
            require(optionalPositive(bearing.staticRating), prefix + "staticRating", name + " static rating C₀ must be positive when supplied.");
            require(optionalPositive(bearing.targetHours), prefix + "targetHours", name + " target life in hours must be positive when supplied.");
        }
        return errors;
    }

    function normalizeSupportPositions(inputs) {
        const { span, torque, loads } = inputs;
        if (torque.start <= span && torque.end <= span && loads.every(load => load.position <= span)) return inputs;
        // Independently converted equivalent lengths can differ by roundoff.
        return {
            ...inputs,
            torque: { ...torque, start: Math.min(torque.start, span), end: Math.min(torque.end, span) },
            loads: loads.map(load => load.position > span ? { ...load, position: span } : load)
        };
    }

    function solveReactions(loads, span) {
        const a = { fy: 0, fz: 0 };
        const b = { fy: 0, fz: 0 };
        const applied = { fy: 0, fz: 0, my: 0, mz: 0 };
        for (const load of loads) {
            const leftFraction = load.position / span;
            const rightFraction = (span - load.position) / span;
            for (const axis of ["fy", "fz"]) {
                a[axis] -= load[axis] * rightFraction;
                b[axis] -= load[axis] * leftFraction;
                applied[axis] += load[axis];
            }
            applied.my -= load.fz * load.position;
            applied.mz += load.fy * load.position;
        }
        a.resultant = Math.hypot(a.fy, a.fz);
        b.resultant = Math.hypot(b.fy, b.fz);
        return {
            reactions: { a, b },
            equilibrium: { fy: a.fy + b.fy + applied.fy, fz: a.fz + b.fz + applied.fz, my: applied.my - b.fz * span, mz: applied.mz + b.fy * span }
        };
    }

    // Each concentrated force contributes a triangular moment and a step in shear.
    // Subscripts refer to load planes: physical M_z = momentY and M_y = -momentZ.
    function bendingAt(x, side, loads, span) {
        let shearY = 0;
        let shearZ = 0;
        let momentY = 0;
        let momentZ = 0;
        for (const { position, fy, fz } of loads) {
            const momentArm = -Math.min(x, position) * ((span - Math.max(x, position)) / span);
            momentY += fy * momentArm;
            momentZ += fz * momentArm;
            if ((x === 0 && side === "left") || (x === span && side === "right")) continue;
            const shearFactor = x > position || (x === position && side === "right")
                ? position / span : -(span - position) / span;
            shearY += fy * shearFactor;
            shearZ += fz * shearFactor;
        }
        return { shearY, shearZ, momentY, momentZ, momentResultant: Math.hypot(momentY, momentZ) };
    }

    // Closed-form response to each point load, mirrored about the other support
    // when evaluating beyond that load. The distance factor is zero at a support.
    function displacementAt(x, loads, span, rigidity) {
        let y = 0;
        let z = 0;
        let slopeY = 0;
        let slopeZ = 0;
        for (const { position, fy, fz } of loads) {
            const beforeLoad = x <= position;
            const station = (beforeLoad ? x : span - x) / span;
            const nearArm = (beforeLoad ? position : span - position) / span;
            const farArm = (beforeLoad ? span - position : position) / span;
            const scale = farArm * (span / rigidity) * span / 6;
            const shape = nearArm * (1 + farArm);
            const displacement = (scale * span) * station * (shape - station ** 2);
            const slope = (beforeLoad ? 1 : -1) * scale * (shape - 3 * station ** 2);
            y += fy * displacement;
            z += fz * displacement;
            slopeY += fy * slope;
            slopeZ += fz * slope;
        }
        return { x, y, z, slopeY, slopeZ, resultant: Math.hypot(y, z) };
    }

    function polynomialValue(coefficients, x) {
        return coefficients.reduceRight((value, coefficient) => value * x + coefficient, 0);
    }

    // A polynomial is monotone between its derivative roots. Recursive isolation
    // handles all sign-changing roots without a plot grid, and also checks tangent roots.
    function interiorRoots(coefficients) {
        while (coefficients.length && coefficients.at(-1) === 0) coefficients.pop();
        const degree = coefficients.length - 1;
        if (degree < 1) return [];
        const scale = Math.max(...coefficients.map(Math.abs));
        if (scale === 0) return [];
        const normalized = coefficients.map(value => value / scale);
        if (degree === 1) {
            const root = -normalized[0] / normalized[1];
            return root > 0 && root < 1 ? [root] : [];
        }

        const derivative = normalized.slice(1).map((value, index) => value * (index + 1));
        const boundaries = [0, ...interiorRoots(derivative), 1];
        const roots = boundaries.slice(1, -1).filter(x => Math.abs(polynomialValue(normalized, x)) < 64 * Number.EPSILON);
        for (let i = 1; i < boundaries.length; i++) {
            let left = boundaries[i - 1];
            let right = boundaries[i];
            let leftValue = polynomialValue(normalized, left);
            const rightValue = polynomialValue(normalized, right);
            if (leftValue === 0 || rightValue === 0 || Math.sign(leftValue) === Math.sign(rightValue)) continue;
            while (right - left > 1e-12) {
                const midpoint = (left + right) / 2;
                const midValue = polynomialValue(normalized, midpoint);
                if (midValue === 0) {
                    left = right = midpoint;
                } else if (Math.sign(midValue) === Math.sign(leftValue)) {
                    left = midpoint;
                    leftValue = midValue;
                } else {
                    right = midpoint;
                }
            }
            roots.push((left + right) / 2);
        }
        return [...new Set(roots)].sort((a, b) => a - b);
    }

    function maximumDeflection(stations, loads, span, rigidity) {
        let maximum = displacementAt(0, loads, span, rigidity);
        for (let index = 1; index < stations.length; index++) {
            const left = stations[index - 1];
            const right = stations[index];
            const length = right - left;
            const displacement = displacementAt(left, loads, span, rigidity);
            const bending = bendingAt(left, "right", loads, span);
            const bendingScale = (length / rigidity) * length / 2;
            const shearScale = bendingScale * length / 3;
            const planes = [
                [displacement.y, displacement.slopeY * length, bending.momentY * bendingScale, bending.shearY * shearScale],
                [displacement.z, displacement.slopeZ * length, bending.momentZ * bendingScale, bending.shearZ * shearScale]
            ];
            const scale = Math.max(...planes.flat().map(Math.abs));
            const coefficients = Array(6).fill(0);
            if (scale > 0) {
                for (const plane of planes) {
                    const normalized = plane.map(value => value / scale);
                    for (let i = 0; i < normalized.length; i++) {
                        for (let j = 1; j < normalized.length; j++) {
                            coefficients[i + j - 1] += normalized[i] * j * normalized[j];
                        }
                    }
                }
            }
            const candidates = interiorRoots(coefficients).map(fraction => left + length * fraction).concat(right);
            for (const x of candidates) {
                const candidate = displacementAt(x, loads, span, rigidity);
                if (candidate.resultant > maximum.resultant) maximum = candidate;
            }
        }
        const { x, y, z, resultant } = maximum;
        return { x, y, z, resultant };
    }

    function solveBearing(bearing, radialLoad, speed) {
        const ratings = { bearingType: bearing.type, dynamicLoadRatingN: bearing.dynamicRating, equivalentLoadN: radialLoad, speedRpm: speed };
        const life = radialLoad === 0 ? null : speed === 0 ? computeBearingLifeRevolutions(ratings) : computeBearingLife(ratings);
        const exponent = BEARING_LIFE_EXPONENTS[bearing.type];
        const requiredDynamicRating = radialLoad > 0 && speed > 0 && bearing.targetHours != null
            ? radialLoad * (60 * speed * bearing.targetHours / 1e6) ** (1 / exponent) : null;
        return {
            type: bearing.type, exponent, radialLoad,
            lifeMillionRevolutions: life?.lifeMillionRevolutions ?? null,
            lifeHours: life?.lifeHours ?? null,
            requiredDynamicRating,
            staticRatio: radialLoad > 0 && bearing.staticRating != null ? bearing.staticRating / radialLoad : null,
            status: radialLoad === 0 ? "unloaded" : speed === 0 ? "stopped" : "rated",
            loadExceedsRating: life?.loadExceedsRating ?? false
        };
    }

    function hasFiniteOutputs(value) {
        if (typeof value === "number") return Number.isFinite(value);
        return !value || typeof value !== "object" || Object.values(value).every(hasFiniteOutputs);
    }

    function solve(inputs) {
        const { span, section, outerDiameter, loads, bearings, speed } = inputs;
        const { youngModulus, shearModulus, yieldStrength, density } = inputs.material || {};
        const innerDiameter = section === "solid" ? 0 : inputs.innerDiameter;
        const sectionType = section + "-circular";
        const dimensions = { diameter: outerDiameter, outerDiameter, innerDiameter };
        const properties = root.BeamSectionProperties.calculate(sectionType, dimensions);
        const { value, start, end } = inputs.torque;
        const length = end - start;
        const torsionInputs = { shaftType: section, torqueNm: value, outerDiameterM: outerDiameter, innerDiameterM: innerDiameter };
        const { J, tauMaxPa } = computeShaftTorsionalStress(torsionInputs);
        const twist = value === 0 ? 0 : shearModulus == null ? null : computeShaftTorsion({
            ...torsionInputs, lengthM: length, modulusPa: shearModulus
        }).thetaRadians;
        const torque = { value, start, end, length, twist, shearStress: Math.abs(tauMaxPa) };
        const rigidity = youngModulus == null ? null : youngModulus * properties.inertiaX;
        const geometry = {
            area: properties.area, inertia: properties.inertiaX, polarMoment: J, sectionModulus: properties.sectionModulusX,
            stiffness: rigidity, mass: density == null ? null : density * properties.area * span
        };
        const { reactions, equilibrium } = solveReactions(loads, span);
        if (rigidity != null && (!Number.isFinite(rigidity) || rigidity <= 0)) {
            return failure("material.youngModulus", "Flexural rigidity is outside the supported numerical range.");
        }

        const loadStations = [...new Set([0, span, ...loads.map(load => load.position)])].sort((a, b) => a - b);
        const breakpoints = new Set([...loadStations, start, end]);
        const criticalStations = [...breakpoints].sort((a, b) => a - b);
        function stationAt(x, side) {
            const bending = bendingAt(x, side, loads, span);
            const bendingStress = root.FormulaFoundryBeamCalculations.bendingStressFromSection(bending.momentResultant, properties, "x").stressPa;
            const activeTorque = (x > start && x < end) || (x === start && side === "right" && length > 0)
                || (x === end && side === "left" && length > 0);
            const torsionalStress = activeTorque ? torque.shearStress : 0;
            return {
                x, side, ...bending, torque: activeTorque ? value : 0, bendingStress, torsionalStress,
                equivalentStress: Math.hypot(bendingStress, Math.sqrt(3) * torsionalStress)
            };
        }

        // M is affine and torque is constant within each open interval. The
        // maximum norm therefore occurs at an endpoint, using the proper side.
        const candidates = criticalStations.flatMap(x => {
            const sides = x === 0 ? ["right"] : x === span ? ["left"] : ["left", "right"];
            return sides.map(side => stationAt(x, side));
        });
        const maxMoment = candidates.reduce((best, next) => next.momentResultant > best.momentResultant ? next : best);
        const maxStress = candidates.reduce((best, next) => next.equivalentStress > best.equivalentStress ? next : best);
        const bending = {
            maximum: { x: maxMoment.x, momentY: maxMoment.momentY, momentZ: maxMoment.momentZ,
                resultant: maxMoment.momentResultant, bendingStress: maxMoment.bendingStress }
        };
        const combined = {
            maximum: { x: maxStress.x, side: maxStress.side, bendingStress: maxStress.bendingStress,
                torsionalStress: maxStress.torsionalStress, equivalentStress: maxStress.equivalentStress },
            yieldRatio: yieldStrength != null && maxStress.equivalentStress > 0
                ? computeFactorOfSafety({ mode: "stress", strengthPa: yieldStrength, appliedStressPa: maxStress.equivalentStress }).factorOfSafety
                : null
        };
        const deflection = { maximum: null, slopes: null, stations: [], method: DEFLECTION_METHOD };
        if (rigidity != null) {
            deflection.maximum = maximumDeflection(loadStations, loads, span, rigidity);
            const slopeA = displacementAt(0, loads, span, rigidity);
            const slopeB = displacementAt(span, loads, span, rigidity);
            deflection.slopes = { a: { y: slopeA.slopeY, z: slopeA.slopeZ }, b: { y: slopeB.slopeY, z: slopeB.slopeZ } };
            deflection.stations = loads.map(({ id, position }) => {
                const { x, y, z, resultant } = displacementAt(position, loads, span, rigidity);
                return { id, x, y, z, resultant };
            });
        }

        const plotStations = new Set(criticalStations);
        if (deflection.maximum) plotStations.add(deflection.maximum.x);
        const exactPlotStations = [...plotStations];
        const plotRoundoff = (8 * Number.EPSILON) * span;
        for (let step = 1; step < 120; step++) {
            const x = span * (step / 120);
            if (!exactPlotStations.some(station => Math.abs(station - x) <= plotRoundoff)) plotStations.add(x);
        }
        const samples = [...plotStations].sort((a, b) => a - b).flatMap(x => {
            const displacement = rigidity == null ? null : displacementAt(x, loads, span, rigidity);
            const sides = breakpoints.has(x) ? ["left", "right"] : ["right"];
            return sides.map(side => ({
                ...stationAt(x, side), deflectionY: displacement?.y ?? null, deflectionZ: displacement?.z ?? null,
                deflectionResultant: displacement?.resultant ?? null
            }));
        });

        const bearingResults = { a: solveBearing(bearings.a, reactions.a.resultant, speed), b: solveBearing(bearings.b, reactions.b.resultant, speed) };
        const warnings = [];
        if (youngModulus == null) warnings.push("Enter Young’s modulus to calculate deflection and bearing slopes.");
        if (twist == null) warnings.push("Enter shear modulus to calculate angle of twist.");
        if (yieldStrength == null) warnings.push("Enter yield strength to calculate the nominal static yield ratio.");
        if (density == null) warnings.push("Enter density to calculate shaft mass.");
        if (combined.yieldRatio != null && combined.yieldRatio < 1) warnings.push("Calculated nominal equivalent stress exceeds the entered yield strength.");
        for (const [key, bearing] of Object.entries(bearingResults)) {
            const side = key.toUpperCase();
            if (bearing.status === "unloaded") warnings.push("Bearing " + side + " has zero modeled radial load. Rating life and static ratio are undefined; operating loads may still be present.");
            if (bearing.status === "stopped") warnings.push("Bearing " + side + " has zero shaft speed. A rating life in operating hours cannot be calculated.");
            if (bearing.loadExceedsRating) warnings.push("Bearing " + side + " modeled radial load meets or exceeds its basic dynamic load rating C.");
        }
        const outputs = { geometry, reactions, equilibrium, torque, bending, combined, deflection, bearings: bearingResults, samples, warnings };
        if (!hasFiniteOutputs(outputs)) return failure("calculation", "A result is outside the supported numerical range.");
        return { ok: true, modelVersion: MODEL_VERSION, inputs, ...outputs };
    }

    function calculate(inputs) {
        if (!inputs || typeof inputs !== "object") return failure("inputs", "Enter shaft and bearing inputs.");
        const errors = validate(inputs);
        if (errors.length) return { ok: false, errors };
        try {
            return solve(normalizeSupportPositions(inputs));
        } catch (error) {
            return failure("calculation", error.message);
        }
    }

    function runSweep(inputs, { start, end, count } = {}) {
        if (!inputs || typeof inputs !== "object") return failure("inputs", "Enter shaft and bearing inputs.");
        const inner = inputs.section === "hollow" ? inputs.innerDiameter : 0;
        if (![start, end].every(Number.isFinite) || !(start > inner && end > start)) {
            return failure("diameter", "Use an increasing outside-diameter range above the fixed inside diameter.");
        }
        if (!Number.isInteger(count) || count < 2 || count > 30) {
            return failure("count", "Choose between 2 and 30 sweep samples.");
        }
        const samples = [];
        for (let index = 0; index < count; index++) {
            const diameter = index === count - 1 ? end : start + (end - start) * (index / (count - 1));
            const result = calculate({ ...inputs, outerDiameter: diameter });
            if (!result.ok) return result;
            samples.push({
                diameter, bendingStress: result.bending.maximum.bendingStress, equivalentStress: result.combined.maximum.equivalentStress,
                displacement: result.deflection.maximum?.resultant ?? null, stiffness: result.geometry.stiffness,
                mass: result.geometry.mass, twist: result.torque.twist,
                yieldRatio: result.combined.yieldRatio, reactionA: result.reactions.a.resultant, reactionB: result.reactions.b.resultant
            });
        }
        return { ok: true, samples };
    }

    root.FormulaFoundryShaftBearing = { ID, MODEL_VERSION, MAX_LOADS, ASSUMPTIONS, EQUATIONS, calculate, runSweep };
})(typeof window === "undefined" ? globalThis : window);
