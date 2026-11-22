// DOM-free conductor voltage drop and nominal single-channel speaker loads.
// All numeric inputs use coherent SI units, including absolute temperature in kelvin.
const ElectricalPractical = (() => {
    const referenceTemperature = 293.15;
    const conductors = {
        // NBS Handbook 100, Copper Wire Tables, sections 1.1 and 1.3.
        copper: { resistivity: 1.7241e-8, temperatureCoefficient: 0.00393 },
        // NBS Handbook 109, Aluminum Wire Tables, Table 1 (EC-H19, 61% IACS).
        aluminum: { resistivity: 2.8264e-8, temperatureCoefficient: 0.00403 }
    };
    const awgGauges = Object.freeze([
        "0000", "000", "00", "0", ...Array.from({ length: 40 }, (_, index) => String(index + 1))
    ]);

    function requireMagnitude(value, label, allowZero = false) {
        if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
            throw new Error(label + (allowZero ? " must be finite and nonnegative." : " must be finite and positive."));
        }
    }

    function wireVoltageDrop({ supplyVoltage, loadCurrent, oneWayLength, material, temperature,
        sizeMode, gauge, area, customResistivity }) {
        requireMagnitude(supplyVoltage, "Supply voltage");
        requireMagnitude(loadCurrent, "Load current", true);
        requireMagnitude(oneWayLength, "One-way length", true);
        requireMagnitude(temperature, "Absolute conductor temperature");
        if (!Object.hasOwn(conductors, material)) throw new Error("Choose copper or aluminum.");
        const conductor = conductors[material];
        const warnings = [];

        let diameter = null;
        if (sizeMode === "awg") {
            gauge = String(gauge);
            const index = awgGauges.indexOf(gauge);
            if (index === -1) throw new Error("Choose a gauge from 4/0 through 40 AWG.");
            // Ideal solid-round geometry from the nominal AWG progression
            // (NBS Handbook 100, section 2.2). AWG 0000 maps to n = -3.
            const gaugeNumber = index - 3;
            diameter = convertDistance(0.005, "in") * 92 ** ((36 - gaugeNumber) / 39);
            area = Math.PI * diameter ** 2 / 4;
        } else if (sizeMode === "area") {
            requireMagnitude(area, "Metallic cross-sectional area");
            gauge = null;
        } else {
            throw new Error("Choose nominal AWG or enter a conductor area.");
        }

        let resistivity = customResistivity;
        if (resistivity == null) {
            // Both handbooks tabulate 0–100 °C. The preset is a linear
            // resistance correction at fixed nominal geometry over that interval.
            if (temperature < 273.15 || temperature > 373.15) {
                throw new Error("The preset temperature model covers 0 to 100 °C. Enter custom resistivity at the operating temperature to use a different temperature.");
            }
            resistivity = conductor.resistivity * (1 + conductor.temperatureCoefficient * (temperature - referenceTemperature));
        } else {
            requireMagnitude(resistivity, "Custom resistivity at the operating temperature");
        }

        const oneWayResistance = resistivity * oneWayLength / area;
        const loopResistance = 2 * oneWayResistance;
        const voltageDrop = loadCurrent * loopResistance;
        const loadVoltage = supplyVoltage - voltageDrop;
        const percentDrop = (voltageDrop / supplyVoltage) * 100;
        const powerLoss = loadCurrent * voltageDrop;
        if (![oneWayResistance, loopResistance, voltageDrop, loadVoltage, percentDrop, powerLoss].every(Number.isFinite)) {
            throw new Error("These inputs produce a wire-drop result outside the supported numeric range.");
        }
        if (loadVoltage <= 0 && loadCurrent > 0) {
            warnings.push("At this current the wire drop equals or exceeds the supply voltage. The result leaves no positive voltage for the load.");
        }
        return {
            supplyVoltage, loadCurrent, oneWayLength, material, temperature, sizeMode, gauge, area, diameter,
            resistivity, oneWayResistance, loopResistance, voltageDrop, loadVoltage, percentDrop, powerLoss, warnings
        };
    }

    function speakerLoad({ mode, impedances, sourceMode, rmsVoltage, ratedPower, referenceLoad, minimumLoad = null }) {
        if (mode !== "series" && mode !== "parallel") throw new Error("Choose series or parallel speaker wiring.");
        if (!Array.isArray(impedances) || impedances.length < 1 || impedances.length > 12) {
            throw new Error("Enter between one and twelve nominal speaker impedances.");
        }
        for (const [index, impedance] of impedances.entries()) {
            requireMagnitude(impedance, "Speaker " + (index + 1) + " nominal impedance");
        }
        if (minimumLoad != null) requireMagnitude(minimumLoad, "Amplifier minimum nominal load");

        const warnings = ["Speaker impedance varies with frequency. Current and power use the nominal values as resistive loads."];
        if (sourceMode === "rated") {
            requireMagnitude(ratedPower, "Amplifier power at the reference load");
            requireMagnitude(referenceLoad, "Reference load");
            rmsVoltage = Math.sqrt(ratedPower) * Math.sqrt(referenceLoad);
            warnings.push("RMS voltage is inferred at the stated reference load. Available output may change at the estimated channel load.");
        } else if (sourceMode !== "voltage") {
            throw new Error("Choose RMS output voltage or rated power and reference load.");
        }
        requireMagnitude(rmsVoltage, "RMS amplifier output voltage", sourceMode === "voltage");

        let equivalentImpedance, totalCurrent, totalPower, components;
        if (impedances.length === 1) {
            equivalentImpedance = impedances[0];
            totalCurrent = rmsVoltage / equivalentImpedance;
            totalPower = rmsVoltage * totalCurrent;
            if (![totalCurrent, totalPower].every(Number.isFinite)) {
                throw new Error("These inputs produce an amplifier load result outside the supported numeric range.");
            }
            components = [{ id: "SP1", impedance: equivalentImpedance, voltage: rmsVoltage, current: totalCurrent, power: totalPower }];
        } else {
            const network = ElectricalDC.resistorNetwork({ mode, sourceVoltage: rmsVoltage, resistances: impedances });
            equivalentImpedance = network.equivalentResistance;
            totalCurrent = network.totalCurrent;
            totalPower = network.totalPower;
            components = network.components.map(({ resistance, voltage, current, power }, index) => ({
                id: "SP" + (index + 1), impedance: resistance, voltage, current, power
            }));
        }

        let loadComparison = null;
        let loadMargin = null;
        if (minimumLoad != null) {
            const roundingAllowance = 8 * Number.EPSILON * Math.max(minimumLoad, equivalentImpedance);
            loadMargin = equivalentImpedance - minimumLoad;
            if (Math.abs(loadMargin) <= roundingAllowance) loadMargin = 0;
            loadComparison = loadMargin === 0 ? "equal" : (loadMargin < 0 ? "below" : "above");
            if (loadComparison === "below") {
                warnings.push("The estimated channel load is below the amplifier minimum nominal load you entered.");
            }
        }
        return {
            mode, sourceMode, rmsVoltage, equivalentImpedance, totalCurrent, totalPower,
            minimumLoad, loadComparison, loadMargin, components, warnings
        };
    }

    return Object.freeze({ awgGauges, wireVoltageDrop, speakerLoad });
})();
