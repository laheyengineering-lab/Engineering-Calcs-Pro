import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

let page, practical;
beforeAll(() => {
    page = loadCore([
        'js/engineering-units.js', 'js/electrical-dc-calculations.js', 'js/electrical-practical-calculations.js'
    ]);
    practical = page.window.eval('ElectricalPractical');
});
afterAll(() => page.dom.window.close());

const copperRun = {
    supplyVoltage: 12, loadCurrent: 5, oneWayLength: 10, material: 'copper',
    temperature: 293.15, sizeMode: 'area', area: 2e-6
};

describe('DC wire voltage drop', () => {
    it('accounts for equal outgoing and return conductors', () => {
        // 0.017241 Ω·mm²/m across 10 m and 2 mm² gives 0.086205 Ω per leg.
        const result = practical.wireVoltageDrop(copperRun);
        expect(result.oneWayResistance).toBeCloseTo(0.086205, 12);
        expect(result.loopResistance).toBeCloseTo(0.172410, 12);
        expect(result.voltageDrop).toBeCloseTo(0.862050, 12);
        expect(result.loadVoltage).toBeCloseTo(11.137950, 12);
        expect(result.percentDrop).toBeCloseTo(7.183750, 12);
        expect(result.powerLoss).toBeCloseTo(4.310250, 12);
        expect(result.diameter).toBeNull();
        expect(result.gauge).toBeNull();
    });

    it('uses the 20 °C EC-H19 reference and corrects it to the conductor temperature', () => {
        // NBS Handbook 109, table 1, gives 0.028264 Ω·mm²/m and 0.00403/°C.
        // At 75 °C the resistivity multiplier is 1.22165.
        const result = practical.wireVoltageDrop({
            supplyVoltage: 48, loadCurrent: 8, oneWayLength: 20, material: 'aluminum',
            temperature: 348.15, sizeMode: 'area', area: 4e-6
        });
        expect(result.resistivity / 1e-8).toBeCloseTo(3.45287156, 10);
        expect(result.oneWayResistance).toBeCloseTo(0.172643578, 12);
        expect(result.voltageDrop).toBeCloseTo(2.762297248, 12);
        expect(result.powerLoss).toBeCloseTo(22.098377984, 12);
    });

    it('reproduces the independent handbook AWG references within their tabulation precision', () => {
        // NBS Handbook 100, section 2.2 endpoints and Table 11 (14 AWG).
        const largest = practical.wireVoltageDrop({ ...copperRun, sizeMode: 'awg', gauge: '0000' });
        const datum = practical.wireVoltageDrop({ ...copperRun, sizeMode: 'awg', gauge: 36 });
        const awg14 = practical.wireVoltageDrop({ ...copperRun, sizeMode: 'awg', gauge: '14' });
        expect(largest.diameter * 1000).toBeCloseTo(11.684, 9);
        expect(datum.diameter * 1000).toBeCloseTo(0.127, 9);
        expect(awg14.diameter * 1000).toBeCloseTo(1.63, 2);
        expect(awg14.area * 1e6).toBeCloseTo(2.08, 2);
        expect(awg14.oneWayResistance * 100).toBeCloseTo(8.28, 1);
    });

    it('uses custom operating-temperature resistivity without a second correction', () => {
        const result = practical.wireVoltageDrop({
            ...copperRun, loadCurrent: 3, oneWayLength: 5, area: 1e-6, temperature: 400, customResistivity: 2e-8
        });
        expect(result.resistivity).toBe(2e-8);
        expect(result.loopResistance).toBeCloseTo(0.2, 12);
        expect(result.loadVoltage).toBeCloseTo(11.4, 12);
        expect(result.powerLoss).toBeCloseTo(1.8, 12);
    });

    it('handles zero drop and warns when the entered current leaves no positive voltage', () => {
        expect(practical.wireVoltageDrop({ ...copperRun, loadCurrent: 0 })).toMatchObject({
            voltageDrop: 0, loadVoltage: 12, percentDrop: 0, powerLoss: 0
        });
        expect(practical.wireVoltageDrop({ ...copperRun, oneWayLength: 0 })).toMatchObject({
            oneWayResistance: 0, loopResistance: 0, voltageDrop: 0, loadVoltage: 12
        });
        const exceeded = practical.wireVoltageDrop({ ...copperRun, supplyVoltage: 0.5 });
        expect(exceeded.loadVoltage).toBeCloseTo(-0.36205, 12);
        expect(exceeded.warnings[0]).toMatch(/no positive voltage/);
    });

    it('rejects unphysical inputs and temperatures outside the selected preset', () => {
        expect(() => practical.wireVoltageDrop({ ...copperRun, supplyVoltage: 0 })).toThrow(/supply voltage/i);
        expect(() => practical.wireVoltageDrop({ ...copperRun, loadCurrent: -1 })).toThrow(/load current/i);
        expect(() => practical.wireVoltageDrop({ ...copperRun, area: 0 })).toThrow(/cross-sectional area/i);
        expect(() => practical.wireVoltageDrop({ ...copperRun, sizeMode: 'awg', gauge: '41' })).toThrow(/gauge/i);
        expect(() => practical.wireVoltageDrop({ ...copperRun, material: 'steel' })).toThrow(/copper or aluminum/i);
        expect(() => practical.wireVoltageDrop({ ...copperRun, temperature: 400 })).toThrow(/preset temperature/i);
        expect(() => practical.wireVoltageDrop({ ...copperRun, customResistivity: -1e-8 })).toThrow(/custom resistivity/i);
    });
});

const speakers = { impedances: [8, 4, 8], sourceMode: 'voltage', rmsVoltage: 20 };

describe('speaker impedance and amplifier power', () => {
    it('adds series impedances and divides power in proportion to each impedance', () => {
        // At 1 A through the 20 Ω load, each speaker has I²Z watts.
        const result = practical.speakerLoad({ ...speakers, mode: 'series', minimumLoad: 4 });
        expect(result).toMatchObject({ equivalentImpedance: 20, totalCurrent: 1, totalPower: 20, loadComparison: 'above', loadMargin: 16 });
        expect(result.components.map((item) => [item.id, item.current, item.voltage, item.power])).toEqual([
            ['SP1', 1, 8, 8], ['SP2', 1, 4, 4], ['SP3', 1, 8, 8]
        ]);
    });

    it('infers the rated-reference RMS voltage and applies the same RMS voltage to each parallel branch', () => {
        // 50 W at 8 Ω implies 20 V. Conductances 1/8 + 1/4 + 1/8 give 2 Ω.
        const result = practical.speakerLoad({
            mode: 'parallel', impedances: speakers.impedances, sourceMode: 'rated', ratedPower: 50,
            referenceLoad: 8, minimumLoad: 4
        });
        expect(result.rmsVoltage).toBeCloseTo(20, 12);
        expect(result.equivalentImpedance).toBeCloseTo(2, 12);
        expect(result.totalCurrent).toBeCloseTo(10, 12);
        expect(result.totalPower).toBeCloseTo(200, 12);
        expect(result.loadComparison).toBe('below');
        expect(result.loadMargin).toBeCloseTo(-2, 12);
        for (const [index, branch] of result.components.entries()) {
            expect(branch.voltage).toBeCloseTo(20, 12);
            expect(branch.current).toBeCloseTo([2.5, 5, 2.5][index], 12);
            expect(branch.power).toBeCloseTo([50, 100, 50][index], 12);
        }
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.stringMatching(/varies with frequency/), expect.stringMatching(/reference load/),
            expect.stringMatching(/below the amplifier minimum/)
        ]));
    });

    it('supports one speaker, idle output, equality and absent minimum loads', () => {
        const result = practical.speakerLoad({ ...speakers, mode: 'series', impedances: [8], rmsVoltage: 0, minimumLoad: 8 });
        expect(result).toMatchObject({ equivalentImpedance: 8, totalCurrent: 0, totalPower: 0, loadComparison: 'equal', loadMargin: 0 });
        expect(result.components).toEqual([{ id: 'SP1', impedance: 8, voltage: 0, current: 0, power: 0 }]);
        const unbounded = practical.speakerLoad({ ...speakers, mode: 'parallel' });
        expect(unbounded.minimumLoad).toBeNull();
        expect(unbounded.loadComparison).toBeNull();
        expect(unbounded.loadMargin).toBeNull();
        expect(JSON.parse(JSON.stringify(unbounded))).toEqual(unbounded);
    });

    it('rejects shorted or open nominal loads and incomplete amplifier source data', () => {
        const candidate = { ...speakers, mode: 'parallel' };
        expect(() => practical.speakerLoad({ ...candidate, impedances: [8, 0] })).toThrow(/nominal impedance/i);
        expect(() => practical.speakerLoad({ ...candidate, impedances: [8, Infinity] })).toThrow(/nominal impedance/i);
        expect(() => practical.speakerLoad({ ...candidate, impedances: [] })).toThrow(/one and twelve/i);
        expect(() => practical.speakerLoad({ ...candidate, rmsVoltage: -20 })).toThrow(/rms amplifier/i);
        expect(() => practical.speakerLoad({ ...candidate, sourceMode: 'rated', ratedPower: 50 })).toThrow(/reference load/i);
        expect(() => practical.speakerLoad({ ...candidate, minimumLoad: 0 })).toThrow(/minimum nominal load/i);
    });
});
