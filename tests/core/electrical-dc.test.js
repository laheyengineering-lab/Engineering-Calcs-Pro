import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../js/electrical-dc-calculations.js', import.meta.url), 'utf8');
const { ohmsLaw, resistorNetwork, kirchhoff, divider } = runInNewContext(`${source}\nElectricalDC;`);

describe('Ohm’s law and passive DC power', () => {
    // 12 V × 3 A = 36 W and 12 V / 3 A = 4 Ω.
    it.each([
        ['VI', { voltage: 12, current: 3 }],
        ['VR', { voltage: 12, resistance: 4 }],
        ['VP', { voltage: 12, power: 36 }],
        ['IR', { current: 3, resistance: 4 }],
        ['IP', { current: 3, power: 36 }],
        ['RP', { resistance: 4, power: 36 }]
    ])('solves the %s known pair', (known, values) => {
        expect(ohmsLaw({ known, ...values })).toMatchObject({
            voltage: 12, current: 3, resistance: 4, power: 36, sourcePower: -36
        });
    });

    it('retains signed references and the distinction between absorbed and delivered power', () => {
        expect(ohmsLaw({ known: 'VR', voltage: -12, resistance: 4 })).toMatchObject({ current: -3, power: 36 });
        expect(ohmsLaw({ known: 'VP', voltage: -12, power: 36 })).toMatchObject({ current: -3, resistance: 4 });
        expect(ohmsLaw({ known: 'IP', current: -3, power: 36 })).toMatchObject({ voltage: -12, resistance: 4 });
        expect(ohmsLaw({ known: 'RP', resistance: 4, power: 36, polarity: -1 })).toMatchObject({
            voltage: -12, current: -3, power: 36, sourcePower: -36
        });
    });

    it('allows uniquely determined zero-voltage and zero-current cases', () => {
        expect(ohmsLaw({ known: 'IR', resistance: 0, current: 5 })).toMatchObject({ voltage: 0, power: 0 });
        expect(ohmsLaw({ known: 'IP', current: 5, power: 0 })).toMatchObject({ voltage: 0, resistance: 0 });
        expect(ohmsLaw({ known: 'VI', voltage: 0, current: 5 })).toMatchObject({ resistance: 0, power: 0 });
        expect(ohmsLaw({ known: 'VI', voltage: 0, current: -5 })).toMatchObject({ resistance: 0, power: 0 });
        expect(ohmsLaw({ known: 'VR', voltage: 0, resistance: 4 })).toMatchObject({ current: 0, power: 0 });
    });

    it.each([
        [{ known: 'VIR', voltage: 12, current: 3, resistance: 4 }, /exactly two/i],
        [{ known: 'VI', voltage: 12, current: -3 }, /negative resistance/i],
        [{ known: 'VI', voltage: 12, current: 0 }, /ideal open/i],
        [{ known: 'VI', voltage: 0, current: 0 }, /do not determine/i],
        [{ known: 'VR', voltage: 12, resistance: 0 }, /no finite current/i],
        [{ known: 'VR', voltage: 0, resistance: 0 }, /undetermined/i],
        [{ known: 'VP', voltage: 0, power: 3 }, /cannot absorb/i],
        [{ known: 'VP', voltage: 1, power: 0 }, /ideal open/i],
        [{ known: 'IP', current: 0, power: 0 }, /undetermined/i],
        [{ known: 'RP', resistance: 0, power: 1 }, /cannot absorb/i],
        [{ known: 'RP', resistance: 4, power: -1 }, /cannot deliver/i],
        [{ known: 'VR', voltage: Infinity, resistance: 4 }, /finite number/i],
        [{ known: 'IR', current: 1e300, resistance: 10 }, /numeric range/i]
    ])('rejects nonphysical or underdetermined inputs %j', (values, error) => {
        expect(() => ohmsLaw(values)).toThrow(error);
    });
});

describe('series and parallel resistor networks', () => {
    it('adds series resistances and obeys KCL, KVL and power balance', () => {
        // 2 + 4 + 12 = 18 Ω, so 18 V produces 1 A, and 18 W total.
        const solved = resistorNetwork({ mode: 'series', sourceVoltage: 18, resistances: [2, 4, 12] });
        expect(solved).toMatchObject({ equivalentResistance: 18, totalCurrent: 1, totalPower: 18,
            kclResidual: 0, kvlResidual: 0, powerResidual: 0 });
        expect(solved.components).toEqual([
            { id: 'R1', resistance: 2, voltage: 2, current: 1, power: 2 },
            { id: 'R2', resistance: 4, voltage: 4, current: 1, power: 4 },
            { id: 'R3', resistance: 12, voltage: 12, current: 1, power: 12 }
        ]);
    });

    it('sums parallel conductances and reverses current under a negative reference voltage', () => {
        // 18 V across 2, 4 and 12 Ω yields 9, 4.5 and 1.5 A. Total 15 A
        // implies 18 V / 15 A = 1.2 Ω and 18 V × 15 A = 270 W.
        const solved = resistorNetwork({ mode: 'parallel', sourceVoltage: -18, resistances: [2, 4, 12] });
        expect(solved.equivalentResistance).toBeCloseTo(1.2, 12);
        expect(solved.totalCurrent).toBeCloseTo(-15, 12);
        expect(solved.totalPower).toBeCloseTo(270, 12);
        expect(solved.kclResidual).toBeCloseTo(0, 12);
        expect(solved.kvlResidual).toBe(0);
        expect(solved.powerResidual).toBeCloseTo(0, 12);
        expect(solved.components.map((part) => [part.voltage, part.current, part.power])).toEqual([
            [-18, -9, 162], [-18, -4.5, 81], [-18, -1.5, 27]
        ]);
    });

    it('treats ideal shorts and series opens according to their electrical constraints', () => {
        const withShort = resistorNetwork({ mode: 'series', sourceVoltage: 12, resistances: [0, 6] });
        expect(withShort.components[0]).toMatchObject({ voltage: 0, current: 2, power: 0 });
        const withOpen = resistorNetwork({ mode: 'series', sourceVoltage: 12, resistances: [4, null, 8] });
        expect(withOpen).toMatchObject({ equivalentResistance: null, totalCurrent: 0, totalPower: 0, kvlResidual: 0 });
        expect(withOpen.components.map((part) => part.voltage)).toEqual([0, 12, 0]);
        const floating = resistorNetwork({ mode: 'series', sourceVoltage: 12, resistances: [null, 4, null] });
        expect(floating.components.map((part) => part.voltage)).toEqual([null, 0, null]);
        expect(floating.kvlResidual).toBeNull();
        expect(floating.warnings.join()).toMatch(/floating nodes/i);
        expect(JSON.parse(JSON.stringify(floating))).toEqual(floating);
    });

    it('treats parallel open branches as carrying zero current with the full source voltage', () => {
        const mixed = resistorNetwork({ mode: 'parallel', sourceVoltage: 12, resistances: [null, 6] });
        expect(mixed).toMatchObject({ equivalentResistance: 6, totalCurrent: 2, totalPower: 24 });
        expect(mixed.components[0]).toMatchObject({ resistance: null, voltage: 12, current: 0, power: 0 });
        const open = resistorNetwork({ mode: 'parallel', sourceVoltage: 12, resistances: [null, null] });
        expect(open).toMatchObject({ equivalentResistance: null, totalCurrent: 0, totalPower: 0 });
    });

    it('supports the maximum of 12 resistors', () => {
        const twelve = resistorNetwork({ mode: 'parallel', sourceVoltage: 4, resistances: Array(12).fill(24) });
        expect(twelve.totalCurrent).toBe(2);
        expect(twelve.equivalentResistance).toBe(2);
        expect(twelve.components[11]).toMatchObject({ id: 'R12', resistance: 24 });
    });

    it('keeps a finite parallel solution when unscaled conductance would overflow', () => {
        const solved = resistorNetwork({ mode: 'parallel', sourceVoltage: 1e-310, resistances: [1e-310, 1e-310] });
        expect(solved.totalCurrent).toBeCloseTo(2, 10);
        expect(solved.components.map((part) => part.current)).toEqual([1, 1]);
    });

    it.each([
        [{ mode: 'series', sourceVoltage: 12, resistances: [0, 0] }, /no finite current/i],
        [{ mode: 'parallel', sourceVoltage: 12, resistances: [0, 2] }, /no finite current/i],
        [{ mode: 'parallel', sourceVoltage: 0, resistances: [0, 2] }, /undetermined/i],
        [{ mode: 'series', sourceVoltage: 12, resistances: [2] }, /between 2 and 12/i],
        [{ mode: 'series', sourceVoltage: 12, resistances: Array(13).fill(1) }, /between 2 and 12/i],
        [{ mode: 'series', sourceVoltage: 12, resistances: [2, -3] }, /at least zero/i],
        [{ mode: 'series', sourceVoltage: 12, resistances: Array(3) }, /finite number/i],
        [{ mode: 'series', sourceVoltage: 12, resistances: [2, Infinity] }, /finite number/i]
    ])('explains unsupported networks %j', (values, error) => {
        expect(() => resistorNetwork(values)).toThrow(error);
    });
});

describe('two-loop Kirchhoff analysis', () => {
    const circuit = { leftResistance: 2, centerResistance: 4, rightResistance: 3, leftVoltage: 8, rightVoltage: 1 };

    it('matches a hand-solved nodal equation, including a source absorbing power', () => {
        // Independent check at center A: (8-A)/2 + (1-A)/3 = A/4,
        // giving 52 = 13A. The references yield 2 A, 1 A and -1 A.
        const solved = kirchhoff(circuit);
        expect(solved.nodes).toEqual({ left: 8, center: 4, right: 1, ground: 0 });
        expect(solved.branches).toEqual([
            { id: 'R1', resistance: 2, voltage: 4, current: 2, power: 8 },
            { id: 'R2', resistance: 4, voltage: 4, current: 1, power: 4 },
            { id: 'R3', resistance: 3, voltage: -3, current: -1, power: 3 }
        ]);
        expect(solved).toMatchObject({ totalPower: 15, leftSourcePower: -16, rightSourcePower: 1, sourcePower: -15,
            powerResidual: 0, kclResidual: 0, leftKvlResidual: 0, rightKvlResidual: 0 });
    });

    it('handles one ideal short with unique branch currents', () => {
        // The center is grounded by the short. The independent branches feed
        // 8 V / 2 Ω and 1 V / 3 Ω into the ground path together.
        const solved = kirchhoff({ ...circuit, centerResistance: 0 });
        expect(solved.nodes.center).toBe(0);
        expect(solved.branches[1].current).toBeCloseTo(13 / 3, 12);
        expect(solved.branches[1].power).toBe(0);
        expect(solved.kclResidual).toBeCloseTo(0, 12);

        // With the left arm shorted, A = 8 V. R2 draws 2 A and current
        // of 7/3 A exits through R3 toward the right source at 1 V.
        const leftShort = kirchhoff({ ...circuit, leftResistance: 0 });
        expect(leftShort.nodes.center).toBe(8);
        expect(leftShort.branches[0].current).toBeCloseTo(13 / 3, 12);
        expect(leftShort.branches[2].current).toBeCloseTo(-7 / 3, 12);
    });

    it('retains a small center current with much larger opposing source currents', () => {
        // The symmetric side resistors form a 1 V, 0.5 nΩ Thevenin
        // equivalent at center. The center current is 1 V / (1 GΩ + 0.5 nΩ).
        const solved = kirchhoff({ leftResistance: 1e-9, centerResistance: 1e9, rightResistance: 1e-9,
            leftVoltage: 2, rightVoltage: 0 });
        expect(solved.nodes.center).toBeCloseTo(1, 12);
        expect(solved.branches[1].current).toBeCloseTo(1e-9, 17);
        expect(solved.branches[2].current).toBeCloseTo(-1e9, 5);
    });

    it('avoids an intermediate overflow in a finite mesh solution', () => {
        // Equal side R values with opposite source voltages set A = 0 V.
        // Each arm carries 0.9 A, for a total 1.62e308 W of resistor power.
        const solved = kirchhoff({ leftResistance: 1e308, centerResistance: 1e308, rightResistance: 1e308,
            leftVoltage: 9e307, rightVoltage: -9e307 });
        expect(solved.nodes.center).toBe(0);
        expect(solved.branches[0].current).toBeCloseTo(0.9, 12);
        expect(solved.branches[2].current).toBeCloseTo(-0.9, 12);
        expect(solved.totalPower / 1.62e308).toBeCloseTo(1, 12);
    });

    it('explains singular and inconsistent combinations of ideal sources and shorts', () => {
        expect(() => kirchhoff({ ...circuit, leftResistance: 0, rightResistance: 0 })).toThrow(/conflicting node voltages/i);
        expect(() => kirchhoff({ ...circuit, leftResistance: 0, rightResistance: 0, rightVoltage: 8 })).toThrow(/singular/i);
        expect(() => kirchhoff({ ...circuit, leftResistance: 0, centerResistance: 0 })).toThrow(/inconsistent/i);
    });
});

describe('voltage and current dividers', () => {
    it('finds voltage across the lower leg of a two-resistor or multi-resistor series divider', () => {
        const two = divider({ mode: 'voltage', sourceVoltage: 12, resistances: [1000, 2000] });
        expect(two.outputVoltage).toBe(8);
        expect(two.totalCurrent).toBe(0.004);
        const series = divider({ mode: 'series', sourceVoltage: 24, resistances: [1000, 2000, 3000], tap: 2 });
        expect(series.outputVoltage).toBe(12); // Lower leg is half of the 6 kΩ total.
        expect(series.components.map((part) => part.voltage)).toEqual([4, 8, 12]);
    });

    it('accounts for load current and power in a loaded divider', () => {
        // A 2 kΩ load halves the lower leg from 2 kΩ to 1 kΩ. It then
        // shares half of the resulting 6 mA with R2, dropping 6 V instead of 8 V.
        const solved = divider({ mode: 'loaded', sourceVoltage: 12, resistances: [1000, 2000], loadResistance: 2000 });
        expect(solved).toMatchObject({ outputVoltage: 6, unloadedVoltage: 8, loadingError: -2, loadingErrorPercent: -25,
            equivalentResistance: 2000, totalCurrent: 0.006, loadCurrent: 0.003 });
        expect(solved.components[1].current).toBe(0.003);
        expect(solved.components[0].power).toBeCloseTo(0.036, 12);
        expect(solved.components[1].power).toBeCloseTo(0.018, 12);
        expect(solved.loadPower).toBeCloseTo(0.018, 12);
        expect(solved.totalPower).toBeCloseTo(0.072, 12);
        expect(divider({ mode: 'loaded', sourceVoltage: 0, resistances: [1000, 2000], loadResistance: 2000 })
            .loadingErrorPercent).toBeNull();
    });

    it('divides current in the inverse resistance ratio', () => {
        // Conductance ratio is 4:2:1. The 7 A source thus drives 4/2/1 A at 12 V.
        const solved = divider({ mode: 'current', sourceCurrent: 7, resistances: [3, 6, 12] });
        expect(solved.equivalentResistance).toBeCloseTo(12 / 7, 12);
        expect(solved.outputVoltage).toBeCloseTo(12, 12);
        for (const [index, current] of [4, 2, 1].entries()) {
            expect(solved.components[index].current).toBeCloseTo(current, 12);
        }
        expect(solved.totalPower).toBeCloseTo(84, 12);
    });

    it('explains undetermined divider configurations', () => {
        const short = divider({ mode: 'current', sourceCurrent: 4, resistances: [0, 2] });
        expect(short.components.map((part) => part.current)).toEqual([4, 0]);
        expect(() => divider({ mode: 'current', sourceCurrent: 4, resistances: [0, 0] })).toThrow(/undetermined/i);
        expect(() => divider({ mode: 'current', sourceCurrent: 4, resistances: [null, null] })).toThrow(/closed path/i);
        expect(() => divider({ mode: 'series', sourceVoltage: 24, resistances: [1, 2, 3], tap: 3 })).toThrow(/tap/i);
        expect(() => divider({ mode: 'loaded', sourceVoltage: 12, resistances: [1, 2], loadResistance: 0 })).toThrow(/load resistance/i);
    });
});
