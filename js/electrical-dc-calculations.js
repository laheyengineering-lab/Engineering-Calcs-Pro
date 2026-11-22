// DOM-free DC models. Quantities use coherent SI units. In resistor arrays,
// null represents an intentional ideal open and zero represents an ideal short.
const ElectricalDC = (() => {
    function finite(value, label) {
        if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
    }

    function resistance(value, label, allowZero = true) {
        finite(value, label);
        if (value < 0 || (!allowZero && value === 0)) {
            throw new Error(`${label} must be ${allowZero ? 'at least zero' : 'greater than zero'}.`);
        }
    }

    function checkResults(values) {
        if (values.some((value) => value !== null && !Number.isFinite(value))) {
            throw new Error('The result exceeds the supported numeric range. Check the input magnitudes.');
        }
    }

    const sum = (values) => values.reduce((total, value) => total + value, 0);
    const canonicalZero = (value) => value === 0 ? 0 : value;

    function ohmsLaw({ known, voltage, current, resistance: ohms, power, polarity = 1 }) {
        const knownPairs = ['VI', 'VR', 'VP', 'IR', 'IP', 'RP'];
        if (!knownPairs.includes(known)) throw new Error('Select exactly two known quantities.');
        if (known.includes('V')) finite(voltage, 'Voltage');
        if (known.includes('I')) finite(current, 'Current');
        if (known.includes('R')) resistance(ohms, 'Resistance');
        if (known.includes('P')) {
            finite(power, 'Absorbed power');
            if (power < 0) throw new Error('A passive resistor cannot deliver power. Enter nonnegative absorbed power.');
        }

        switch (known) {
        case 'VI':
            if (current === 0) {
                throw new Error(voltage === 0 ? 'Zero voltage and current do not determine resistance.'
                    : 'Nonzero voltage at zero current requires an ideal open. No finite resistance fits this pair.');
            }
            if (voltage !== 0 && Math.sign(voltage) !== Math.sign(current)) {
                throw new Error('Opposite voltage and current signs imply negative resistance under the passive sign convention.');
            }
            ohms = voltage / current;
            power = voltage * current;
            break;
        case 'VR':
            if (ohms === 0) {
                throw new Error(voltage === 0 ? 'The current in a zero-voltage ideal short is undetermined.'
                    : 'An ideal short across a nonzero ideal voltage has no finite current solution.');
            }
            current = voltage / ohms;
            power = voltage * current;
            break;
        case 'VP':
            if (voltage === 0) {
                throw new Error(power === 0 ? 'Zero voltage and power leave current and resistance undetermined.'
                    : 'A finite current at zero voltage cannot absorb positive power.');
            }
            if (power === 0) throw new Error('Nonzero voltage at zero power requires an ideal open.');
            current = power / voltage;
            ohms = voltage / current;
            break;
        case 'IR':
            voltage = current * ohms;
            power = voltage * current;
            break;
        case 'IP':
            if (current === 0) {
                throw new Error(power === 0 ? 'Zero current and power leave voltage and resistance undetermined.'
                    : 'A finite voltage at zero current cannot absorb positive power.');
            }
            voltage = power / current;
            ohms = voltage / current;
            break;
        case 'RP':
            if (ohms === 0) {
                throw new Error(power === 0 ? 'Zero resistance and power leave short-circuit current undetermined.'
                    : 'An ideal short cannot absorb positive power at finite current.');
            }
            if (polarity !== 1 && polarity !== -1) throw new Error('Select a positive or negative voltage reference.');
            voltage = polarity * Math.sqrt(power) * Math.sqrt(ohms);
            current = polarity * Math.sqrt(power) / Math.sqrt(ohms);
            break;
        }

        checkResults([voltage, current, ohms, power]);
        if ((power !== 0 && (voltage === 0 || current === 0 || ohms === 0)) ||
            (voltage !== 0 && (current === 0 || ohms === 0))) {
            throw new Error('The result falls below the supported numeric range. Check the input magnitudes.');
        }
        return {
            voltage: canonicalZero(voltage), current: canonicalZero(current), resistance: canonicalZero(ohms),
            power: canonicalZero(power), sourcePower: canonicalZero(-power),
            warnings: ohms === 0 ? ['An ideal short can carry the specified current at zero voltage and dissipates no power.'] : []
        };
    }

    function validateResistors(resistances, allowOpen = true, allowZero = true) {
        if (!Array.isArray(resistances) || resistances.length < 2 || resistances.length > 12) {
            throw new Error('Enter between 2 and 12 resistors.');
        }
        // Array iteration here also catches unfilled slots.
        for (const [index, value] of resistances.entries()) {
            if (allowOpen && value === null) continue;
            resistance(value, `R${index + 1}`, allowZero);
        }
    }

    function seriesResistance(resistances) {
        if (resistances.includes(null)) return null;
        const equivalent = sum(resistances);
        checkResults([equivalent]);
        return equivalent;
    }

    function parallelResistance(resistances) {
        const closed = resistances.filter((value) => value !== null);
        if (closed.length === 0) return null;
        const smallest = Math.min(...closed);
        if (smallest === 0) return 0;
        // Normalize conductances so a very small individual R cannot overflow 1/R.
        const equivalent = smallest / sum(closed.map((value) => smallest / value));
        if (equivalent === 0) throw new Error('Equivalent resistance is below the supported numeric range.');
        return equivalent;
    }

    function component(index, ohms, voltage, current) {
        const power = voltage === null || current === 0 ? 0 : voltage * current;
        checkResults([voltage, current, power]);
        return { id: `R${index + 1}`, resistance: canonicalZero(ohms), voltage: canonicalZero(voltage),
            current: canonicalZero(current), power: canonicalZero(power) };
    }

    function parallelComponents(resistances, voltage, shortCurrent = 0) {
        return resistances.map((value, index) => {
            const current = value === null ? 0 : value === 0 ? shortCurrent : voltage / value;
            return component(index, value, voltage, current);
        });
    }

    function resistorNetwork({ mode, sourceVoltage, resistances }) {
        finite(sourceVoltage, 'Source voltage');
        validateResistors(resistances);
        if (mode !== 'series' && mode !== 'parallel') throw new Error('Select a series or parallel circuit.');

        const series = mode === 'series';
        const equivalentResistance = series ? seriesResistance(resistances) : parallelResistance(resistances);
        if (equivalentResistance === 0) {
            throw new Error(sourceVoltage === 0 ? 'The ideal voltage source and short leave the current undetermined at 0 V.'
                : 'An ideal short across the voltage source has no finite current solution.');
        }
        const totalCurrent = equivalentResistance === null ? 0 : sourceVoltage / equivalentResistance;
        const openCount = resistances.filter((value) => value === null).length;
        const components = series ? resistances.map((value, index) => {
            const voltage = value === null ? (openCount === 1 ? sourceVoltage : null) : totalCurrent * value;
            return component(index, value, voltage, totalCurrent);
        }) : parallelComponents(resistances, sourceVoltage);

        const kclResidual = series ? Math.max(...components.map((part) => Math.abs(part.current - totalCurrent)))
            : totalCurrent - sum(components.map((part) => part.current));
        const kvlResidual = series ? (openCount > 1 ? null : sourceVoltage - sum(components.map((part) => part.voltage)))
            : Math.max(...components.map((part) => Math.abs(sourceVoltage - part.voltage)));
        const totalPower = totalCurrent === 0 ? 0 : sourceVoltage * totalCurrent;
        const powerResidual = totalPower - sum(components.map((part) => part.power));
        checkResults([totalCurrent, totalPower, kclResidual, kvlResidual, powerResidual]);

        const warnings = [];
        if (equivalentResistance === null) warnings.push('There is no closed path through the source. Total current and dissipated power are zero.');
        if (series && openCount > 1) warnings.push('Floating nodes make individual open-circuit voltage drops indeterminate. Only their sum is fixed by the source.');
        if (resistances.includes(0)) warnings.push('A short has zero voltage drop and dissipates zero power.');
        return { mode, sourceVoltage, equivalentResistance, totalCurrent, totalPower, components,
            kclResidual, kvlResidual, powerResidual, warnings };
    }

    function kirchhoff({ leftResistance, centerResistance, rightResistance, leftVoltage, rightVoltage }) {
        const resistances = [leftResistance, centerResistance, rightResistance];
        validateResistors(resistances, false);
        finite(leftVoltage, 'Left source voltage');
        finite(rightVoltage, 'Right source voltage');

        if (resistances.filter((value) => value === 0).length >= 2) {
            const forcedPotentials = [leftVoltage, 0, rightVoltage].filter((_, index) => resistances[index] === 0);
            if (forcedPotentials.some((value) => value !== forcedPotentials[0])) {
                throw new Error('The ideal shorts force conflicting node voltages. The circuit is inconsistent.');
            }
            throw new Error('The ideal shorts leave branch currents undetermined. The circuit equations are singular.');
        }

        // Reference directions: left and right source terminals toward the center,
        // then center toward ground. KVL gives the two mesh equations
        // (R1 + R2) I1 + R2 I3 = VL and R2 I1 + (R2 + R3) I3 = VR.
        // Scale R and expand the determinant as a sum of products to avoid
        // subtracting large, nearly equal terms when the center R dominates.
        const scale = Math.max(...resistances);
        const [left, center, right] = resistances.map((value) => value / scale);
        const determinant = left * center + left * right + center * right;
        if (determinant === 0) throw new Error('The resistance ratios exceed the supported precision for the circuit equations.');
        const voltageDifference = leftVoltage - rightVoltage;
        // Divide the individual voltage terms by the resistance scale before
        // adding to avoid overflowing a sum of large voltages in Cramer's rule.
        const leftScaledVoltage = leftVoltage / scale;
        const rightScaledVoltage = rightVoltage / scale;
        const sharedTerm = Number.isFinite(voltageDifference) ? center * (voltageDifference / scale)
            : center * leftScaledVoltage - center * rightScaledVoltage;
        const leftCurrent = (right * leftScaledVoltage + sharedTerm) / determinant;
        const rightCurrent = (left * rightScaledVoltage - sharedTerm) / determinant;
        // Solve for I1 + I3 directly to preserve a small center current when
        // opposing source currents are much larger than that center current.
        const centerCurrent = (right * leftScaledVoltage + left * rightScaledVoltage) / determinant;
        const currents = [leftCurrent, centerCurrent, rightCurrent];
        const branches = resistances.map((value, index) => component(index, value, value * currents[index], currents[index]));
        const [leftDrop, centerDrop, rightDrop] = branches.map((part) => part.voltage);
        const nodes = { left: leftVoltage, center: centerDrop, right: rightVoltage, ground: 0 };
        const kclResidual = leftCurrent + rightCurrent - centerCurrent;
        const leftKvlResidual = leftVoltage - leftDrop - centerDrop;
        const rightKvlResidual = rightVoltage - rightDrop - centerDrop;
        const totalPower = sum(branches.map((part) => part.power));
        const leftSourcePower = canonicalZero(-leftVoltage * leftCurrent);
        const rightSourcePower = canonicalZero(-rightVoltage * rightCurrent);
        const sourcePower = leftSourcePower + rightSourcePower;
        const powerResidual = sourcePower + totalPower;
        checkResults([kclResidual, leftKvlResidual, rightKvlResidual, totalPower, sourcePower, powerResidual]);
        return { nodes, branches, kclResidual, leftKvlResidual, rightKvlResidual, totalPower,
            leftSourcePower, rightSourcePower, sourcePower, powerResidual, warnings: [] };
    }

    function currentDivider(sourceCurrent, resistances) {
        finite(sourceCurrent, 'Source current');
        validateResistors(resistances);
        const equivalentResistance = parallelResistance(resistances);
        if (equivalentResistance === null) {
            throw new Error(sourceCurrent === 0 ? 'Open branches leave voltage across the zero-current source undetermined.'
                : 'A nonzero ideal current source requires at least one closed path.');
        }
        if (resistances.filter((value) => value === 0).length > 1) {
            throw new Error('The current split between multiple ideal shorts is undetermined.');
        }
        const outputVoltage = equivalentResistance * sourceCurrent;
        const components = parallelComponents(resistances, outputVoltage, sourceCurrent);
        const totalPower = outputVoltage * sourceCurrent;
        checkResults([outputVoltage, totalPower]);
        return { mode: 'current', sourceCurrent, equivalentResistance, outputVoltage, totalPower,
            totalCurrent: sourceCurrent, components, unloadedVoltage: null, loadingError: null,
            loadingErrorPercent: null, loadCurrent: null, loadPower: null, warnings: [] };
    }

    function divider({ mode, sourceVoltage, sourceCurrent, resistances, tap, loadResistance }) {
        if (mode === 'current') return currentDivider(sourceCurrent, resistances);
        if (!['voltage', 'series', 'loaded'].includes(mode)) throw new Error('Select a divider arrangement.');
        validateResistors(resistances, false, false);
        if (mode !== 'series' && resistances.length !== 2) throw new Error('This divider uses exactly two resistors.');
        const split = mode === 'series' ? (tap ?? 1) : 1;
        if (!Number.isInteger(split) || split < 1 || split >= resistances.length) {
            throw new Error('Select an output tap between two adjacent resistors.');
        }
        const unloaded = resistorNetwork({ mode: 'series', sourceVoltage, resistances });
        const unloadedVoltage = sum(unloaded.components.slice(split).map((part) => part.voltage));
        if (mode !== 'loaded') {
            return { ...unloaded, mode, tap: split, outputVoltage: unloadedVoltage, unloadedVoltage,
                loadingError: null, loadingErrorPercent: null, loadCurrent: null, loadPower: null };
        }

        resistance(loadResistance, 'Load resistance', false);
        const [first, second] = resistances;
        const lower = parallelResistance([second, loadResistance]);
        const loaded = resistorNetwork({ mode: 'series', sourceVoltage, resistances: [first, lower] });
        const outputVoltage = loaded.components[1].voltage;
        const components = [loaded.components[0], component(1, second, outputVoltage, outputVoltage / second)];
        const loadCurrent = outputVoltage / loadResistance;
        const loadPower = outputVoltage * loadCurrent;
        const loadingError = outputVoltage - unloadedVoltage;
        const loadingErrorPercent = unloadedVoltage === 0 ? null : 100 * (loadingError / unloadedVoltage);
        checkResults([loadCurrent, loadPower, loadingError, loadingErrorPercent]);
        return { mode, sourceVoltage, outputVoltage, unloadedVoltage, loadingError, loadingErrorPercent,
            equivalentResistance: loaded.equivalentResistance, totalCurrent: loaded.totalCurrent,
            totalPower: loaded.totalPower, loadResistance, loadCurrent, loadPower, components, warnings: [] };
    }

    return Object.freeze({ ohmsLaw, resistorNetwork, kirchhoff, divider });
})();
