// First-order transient and sinusoidal steady-state circuit models. All inputs
// and outputs use coherent SI units, with RMS phasors and phase angles in radians.
const ElectricalTransientAC = (() => {
    const fullTurn = 2 * Math.PI;
    const plotIntervals = 96;

    function finite(value, label, { min = -Infinity, max = Infinity, positive = false } = {}) {
        if (!Number.isFinite(value) || value < min || value > max || (positive && value <= 0)) {
            if (positive) throw new Error(`${label} must be a finite positive value.`);
            if (Number.isFinite(min) && Number.isFinite(max)) {
                throw new Error(`${label} must be between ${min} and ${max}.`);
            }
            if (min === 0) throw new Error(`${label} must be a finite nonnegative value.`);
            throw new Error(`${label} must be finite.`);
        }
        return value;
    }

    function checkResult(...values) {
        if (values.some((value) => !Number.isFinite(value))) {
            throw new Error("These values produce a result outside the numeric range.");
        }
    }

    function settlingTimes(timeConstant) {
        const settlingTime1Percent = Math.log(100) * timeConstant;
        const settlingTime2Percent = Math.log(50) * timeConstant;
        checkResult(settlingTime1Percent, settlingTime2Percent);
        return { settlingTime1Percent, settlingTime2Percent };
    }

    function transientResponse(time, timeConstant, responseAt, endTime) {
        finite(time, "Selected time", { min: 0 });
        if (endTime != null) {
            finite(endTime, "Plot end time", { positive: true });
            if (endTime < time) throw new Error("Plot end time must reach the selected time.");
        }
        const maxX = endTime ?? Math.max(time, 5 * timeConstant);
        checkResult(maxX);
        // Keep samples concentrated near the transition even when the selected time is far away.
        const transitionEnd = Math.min(maxX, 8 * timeConstant);
        const times = new Set([0, time, maxX]);
        for (let index = 1; index <= plotIntervals; index += 1) {
            times.add(transitionEnd * (index / plotIntervals));
        }
        const selected = responseAt(time);
        const points = [...times].sort((a, b) => a - b).map(responseAt);
        return { minX: 0, maxX, points, selected };
    }

    // expm1 retains small early changes. Work from the final value near the asymptote.
    function approach(initial, final, elapsedConstants, decay) {
        if (elapsedConstants < 1) return initial - (final - initial) * Math.expm1(-elapsedConstants);
        return final + (initial - final) * decay;
    }

    function rc({ resistance, capacitance, initialVoltage, sourceVoltage, time, endTime }) {
        finite(resistance, "Resistance", { positive: true });
        finite(capacitance, "Capacitance", { positive: true });
        finite(initialVoltage, "Initial capacitor voltage");
        finite(sourceVoltage, "Final source voltage");
        const timeConstant = finite(resistance * capacitance, "RC time constant", { positive: true });
        const initialResistorVoltage = sourceVoltage - initialVoltage;
        checkResult(initialResistorVoltage);

        function responseAt(t) {
            const elapsedConstants = t / timeConstant;
            const decay = Math.exp(-elapsedConstants);
            const capacitorVoltage = approach(initialVoltage, sourceVoltage, elapsedConstants, decay);
            const resistorVoltage = initialResistorVoltage * decay;
            const current = resistorVoltage / resistance;
            checkResult(capacitorVoltage, resistorVoltage, current);
            return { time: t, capacitorVoltage, resistorVoltage, current };
        }

        const response = transientResponse(time, timeConstant, responseAt, endTime);
        const { capacitorVoltage, resistorVoltage, current } = response.selected;
        const charge = capacitance * capacitorVoltage;
        const energy = (charge / 2) * capacitorVoltage;
        checkResult(charge, energy);
        return { timeConstant, capacitorVoltage, resistorVoltage, current, charge, energy,
            ...settlingTimes(timeConstant), response };
    }

    function rl({ resistance, inductance, initialCurrent, sourceVoltage, time, endTime }) {
        finite(resistance, "Resistance", { positive: true });
        finite(inductance, "Inductance", { positive: true });
        finite(initialCurrent, "Initial inductor current");
        finite(sourceVoltage, "Final source voltage");
        const timeConstant = finite(inductance / resistance, "RL time constant", { positive: true });
        const finalCurrent = sourceVoltage / resistance;
        const initialInductorVoltage = sourceVoltage - initialCurrent * resistance;
        checkResult(finalCurrent, finalCurrent - initialCurrent, initialInductorVoltage);

        function responseAt(t) {
            const elapsedConstants = t / timeConstant;
            const decay = Math.exp(-elapsedConstants);
            const current = approach(initialCurrent, finalCurrent, elapsedConstants, decay);
            const resistorVoltage = current * resistance;
            const inductorVoltage = initialInductorVoltage * decay;
            checkResult(current, resistorVoltage, inductorVoltage);
            return { time: t, current, resistorVoltage, inductorVoltage };
        }

        const response = transientResponse(time, timeConstant, responseAt, endTime);
        const { current, resistorVoltage, inductorVoltage } = response.selected;
        const energy = inductance * (current / 2) * current;
        checkResult(energy);
        return { timeConstant, finalCurrent, current, resistorVoltage, inductorVoltage, energy,
            ...settlingTimes(timeConstant), response };
    }

    function rlc({ resistance, inductance, capacitance, frequency, voltage }) {
        finite(resistance, "Resistance", { min: 0 });
        finite(inductance, "Inductance", { positive: true });
        finite(capacitance, "Capacitance", { positive: true });
        finite(frequency, "Source frequency", { positive: true });
        finite(voltage, "RMS source voltage", { min: 0 });
        const resonantFrequency = finite(1 / fullTurn / Math.sqrt(inductance) / Math.sqrt(capacitance),
            "Resonant frequency", { positive: true });

        function impedanceAt(f) {
            const omega = fullTurn * f;
            const inductiveReactance = finite(omega * inductance, "Inductive reactance", { positive: true });
            const capacitiveReactance = finite(1 / omega / capacitance, "Capacitive reactance", { positive: true });
            const difference = inductiveReactance - capacitiveReactance;
            // Equal reactances can subtract with a few ulps of error at the computed resonance.
            const imaginary = f === resonantFrequency ? 0 : difference;
            const impedanceMagnitude = Math.hypot(resistance, imaginary);
            checkResult(impedanceMagnitude);
            return { inductiveReactance, capacitiveReactance, impedanceMagnitude, imaginary };
        }

        const { inductiveReactance, capacitiveReactance, impedanceMagnitude, imaginary } = impedanceAt(frequency);
        const reactanceTolerance = 4 * Number.EPSILON * Math.max(inductiveReactance, capacitiveReactance);
        if (resistance === 0 && Math.abs(imaginary) <= reactanceTolerance) {
            throw new Error("An ideal lossless circuit at resonance has zero impedance and no unique finite RMS current.");
        }
        const phase = Math.atan2(imaginary, resistance);
        const current = voltage / impedanceMagnitude;
        const realPower = resistance * current * current;
        const qualityFactor = resistance === 0 ? null : impedanceAt(resonantFrequency).inductiveReactance / resistance;
        checkResult(current, realPower, qualityFactor ?? 0);

        // Use logarithmic samples, always including the selected frequency and resonance.
        const minX = finite(Math.min(frequency, resonantFrequency / 10), "Plot minimum frequency", { positive: true });
        const maxX = finite(Math.max(frequency, resonantFrequency * 10), "Plot maximum frequency", { positive: true });
        const logMin = Math.log(minX);
        const logSpan = Math.log(maxX) - logMin;
        const frequencies = new Set([minX, maxX, frequency, resonantFrequency]);
        for (let index = 1; index < plotIntervals; index += 1) {
            frequencies.add(Math.exp(logMin + logSpan * (index / plotIntervals)));
        }
        // Add samples around a narrow resonance when its half-power offsets are resolvable.
        if (qualityFactor > 0) {
            const halfBandwidth = resonantFrequency / qualityFactor / 2;
            for (const factor of [0.25, 0.5, 1, 2, 4, 8]) {
                for (const offset of [-factor * halfBandwidth, factor * halfBandwidth]) {
                    const sample = resonantFrequency + offset;
                    if (sample > minX && sample < maxX) frequencies.add(sample);
                }
            }
        }
        const points = [...frequencies].sort((a, b) => a - b)
            .map((f) => ({ frequency: f, impedanceMagnitude: impedanceAt(f).impedanceMagnitude }));
        const response = { minX, maxX, points, selected: { frequency, impedanceMagnitude } };
        return { inductiveReactance, capacitiveReactance, impedance: { real: resistance, imaginary },
            impedanceMagnitude, phase, current, realPower, resonantFrequency, qualityFactor, response };
    }

    function acPower({ voltage, current, mode, powerFactor, phase, direction }) {
        finite(voltage, "RMS voltage", { min: 0 });
        finite(current, "RMS current", { min: 0 });
        const rightAngle = Math.PI / 2;
        let sine;
        if (mode === "power-factor") {
            finite(powerFactor, "Power factor", { min: 0, max: 1 });
            if (direction !== "leading" && direction !== "lagging") {
                throw new Error("Select a leading or lagging current for power-factor input.");
            }
            const sign = direction === "leading" ? -1 : 1;
            phase = powerFactor === 1 ? 0 : sign * Math.acos(powerFactor);
            sine = sign * Math.sqrt((1 - powerFactor) * (1 + powerFactor));
        } else if (mode === "phase") {
            if (!Number.isFinite(phase) || Math.abs(phase) > rightAngle) {
                throw new Error("Phase must be between −90° and +90° for a passive load.");
            }
            powerFactor = Math.abs(phase) === rightAngle ? 0 : Math.cos(phase);
            sine = Math.sin(phase);
        } else {
            throw new Error("Select power factor or signed phase as the known input.");
        }

        const apparentPower = voltage * current;
        checkResult(apparentPower);
        const realPower = apparentPower * powerFactor;
        const reactivePower = apparentPower === 0 || sine === 0 ? 0 : apparentPower * sine;
        direction = phase === 0 ? "unity" : phase > 0 ? "lagging" : "leading";
        return { realPower, reactivePower, apparentPower, phase, powerFactor, direction };
    }

    return Object.freeze({ rc, rl, rlc, acPower });
})();
