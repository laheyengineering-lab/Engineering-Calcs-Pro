import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../js/electrical-transient-ac-calculations.js', import.meta.url), 'utf8');
const { rc, rl, rlc, acPower } = runInNewContext(`${source}\nElectricalTransientAC;`);

describe('RC transient', () => {
    const charging = { resistance: 2000, capacitance: 0.0005, initialVoltage: 2, sourceVoltage: 10 };

    it('preserves the initial voltage and reaches the independently derived halfway charge', () => {
        const initial = rc({ ...charging, time: 0 });
        expect(initial.capacitorVoltage).toBe(2);
        expect(initial.resistorVoltage).toBe(8);
        expect(initial.current).toBe(0.004);
        const result = rc({ ...charging, time: 0.6931471805599453 });
        expect(result.timeConstant).toBe(1);
        expect(result.capacitorVoltage).toBe(6);
        expect(result.resistorVoltage).toBe(4);
        expect(result.current).toBe(0.002);
        expect(result.charge).toBe(0.003);
        expect(result.energy).toBeCloseTo(0.009, 15);
        expect(result.settlingTime1Percent).toBeCloseTo(4.605170185988092, 13);
        expect(result.settlingTime2Percent).toBeCloseTo(3.912023005428146, 13);
    });

    it('models signed discharge, conservation, and the long-time asymptote', () => {
        const discharging = { ...charging, initialVoltage: 10, sourceVoltage: 0 };
        const result = rc({ ...discharging, time: 0.6931471805599453, endTime: 3 });
        expect(result.current).toBe(-0.0025);
        expect(result.capacitorVoltage).toBe(5);
        expect(result.resistorVoltage).toBe(-5);
        expect(result.energy).toBeCloseTo(0.00625, 15);
        expect(result.response.points.at(-1).time).toBe(3);
        expect(result.response.points).toContainEqual(result.response.selected);
        for (const point of result.response.points) {
            expect(point.capacitorVoltage + point.resistorVoltage).toBeCloseTo(0, 13);
        }
        const settled = rc({ ...discharging, time: 60 });
        expect(settled.capacitorVoltage).toBeCloseTo(0, 20);
        expect(settled.current).toBeCloseTo(0, 20);
        expect(settled.response.maxX).toBe(60);
    });

    it('retains small early-time changes and rejects undefined time constants and intervals', () => {
        const result = rc({ ...charging, initialVoltage: 0, time: 1e-18 });
        expect(result.capacitorVoltage / 1e-17).toBeCloseTo(1, 14);
        expect(() => rc({ ...charging, resistance: 0, time: 0 })).toThrow(/resistance/i);
        expect(() => rc({ ...charging, capacitance: -1, time: 0 })).toThrow(/capacitance/i);
        expect(() => rc({ ...charging, time: -1 })).toThrow(/selected time/i);
        expect(() => rc({ ...charging, time: 2, endTime: 1 })).toThrow(/end time/i);
    });
});

describe('RL transient', () => {
    const buildup = { resistance: 4, inductance: 8, initialCurrent: -1, sourceVoltage: 12 };

    it('preserves signed initial current and reaches the independently derived halfway current', () => {
        const initial = rl({ ...buildup, time: 0 });
        expect(initial.current).toBe(-1);
        expect(initial.resistorVoltage).toBe(-4);
        expect(initial.inductorVoltage).toBe(16);
        const result = rl({ ...buildup, time: 1.3862943611198906 });
        expect(result.timeConstant).toBe(2);
        expect(result.finalCurrent).toBe(3);
        expect(result.current).toBe(1);
        expect(result.resistorVoltage).toBe(4);
        expect(result.inductorVoltage).toBe(8);
        expect(result.energy).toBe(4);
        expect(result.settlingTime1Percent).toBeCloseTo(9.210340371976184, 13);
        expect(result.settlingTime2Percent).toBeCloseTo(7.824046010856292, 13);
        for (const point of result.response.points) {
            expect(point.resistorVoltage + point.inductorVoltage).toBeCloseTo(12, 13);
        }
    });

    it('models decay, reversed inductor voltage, and the asymptotic state', () => {
        const decaying = { ...buildup, initialCurrent: 3, sourceVoltage: 0 };
        const result = rl({ ...decaying, time: 1.3862943611198906 });
        expect(result.current).toBe(1.5);
        expect(result.resistorVoltage).toBe(6);
        expect(result.inductorVoltage).toBe(-6);
        expect(result.energy).toBe(9);
        expect(rl({ ...decaying, time: 100 }).current).toBeCloseTo(0, 20);
        const settled = rl({ ...buildup, time: 100 });
        expect(settled.current).toBe(3);
        expect(settled.inductorVoltage).toBeCloseTo(0, 20);
    });

    it('rejects zero resistance, zero inductance, and nonfinite initial values', () => {
        expect(() => rl({ ...buildup, resistance: 0, time: 0 })).toThrow(/resistance/i);
        expect(() => rl({ ...buildup, inductance: 0, time: 0 })).toThrow(/inductance/i);
        expect(() => rl({ ...buildup, initialCurrent: Infinity, time: 0 })).toThrow(/initial/i);
    });
});

describe('series RLC impedance and resonance', () => {
    // At 50 Hz these parts give 4 Ω inductive and 8 Ω capacitive reactance.
    const circuit = { resistance: 3, inductance: 4 / (100 * Math.PI),
        capacitance: 1 / (800 * Math.PI), frequency: 50, voltage: 10 };
    const resonance = 70.71067811865476;

    it('matches a 3–4–5 impedance triangle and RMS power', () => {
        const result = rlc(circuit);
        expect(result.inductiveReactance).toBeCloseTo(4, 13);
        expect(result.capacitiveReactance).toBeCloseTo(8, 13);
        expect(result.impedance.real).toBe(3);
        expect(result.impedance.imaginary).toBeCloseTo(-4, 13);
        expect(result.impedanceMagnitude).toBeCloseTo(5, 13);
        expect(result.phase).toBeCloseTo(-0.9272952180016122, 13);
        expect(result.current).toBeCloseTo(2, 13);
        expect(result.realPower).toBeCloseTo(12, 13);
        expect(result.resonantFrequency).toBeCloseTo(resonance, 13);
        expect(result.qualityFactor).toBeCloseTo(1.885618083164127, 13);
    });

    it('includes the selected frequency and resonance in a bounded sorted impedance response', () => {
        const result = rlc({ ...circuit, frequency: 100 });
        expect(result.phase).toBeGreaterThan(0);
        const { minX, maxX, points, selected } = result.response;
        expect(minX).toBeCloseTo(7.071067811865475, 13);
        expect(maxX).toBeCloseTo(707.1067811865476, 11);
        expect(points).toContainEqual(selected);
        expect(points.find((point) => point.frequency === result.resonantFrequency).impedanceMagnitude).toBe(3);
        expect(points.every((point, index) => index === 0 || point.frequency > points[index - 1].frequency)).toBe(true);
        const tuned = rlc({ ...circuit, frequency: resonance });
        expect(tuned.impedanceMagnitude).toBeCloseTo(3, 13);
        expect(tuned.phase).toBeCloseTo(0, 13);
        expect(tuned.current).toBeCloseTo(10 / 3, 13);
    });

    it('handles lossless off-resonance impedance and rejects the singular ideal current', () => {
        const result = rlc({ ...circuit, resistance: 0 });
        expect(result.qualityFactor).toBeNull();
        expect(result.current).toBeCloseTo(2.5, 13);
        expect(result.phase).toBe(-Math.PI / 2);
        expect(result.realPower).toBe(0);
        expect(() => rlc({ ...circuit, resistance: 0, frequency: resonance })).toThrow(/lossless.*resonance/i);
        expect(() => rlc({ ...circuit, resistance: 0, frequency: resonance, voltage: 0 })).toThrow(/no unique/i);
        expect(() => rlc({ ...circuit, frequency: 0 })).toThrow(/frequency/i);
        expect(() => rlc({ ...circuit, voltage: -10 })).toThrow(/RMS source voltage/i);
    });
});

describe('single-phase sinusoidal RMS power', () => {
    const rms = { voltage: 120, current: 5 };

    it('matches an independent 3–4–5 power triangle with both reactive signs', () => {
        const lagging = acPower({ ...rms, mode: 'power-factor', powerFactor: 0.8, direction: 'lagging' });
        expect(lagging.apparentPower).toBe(600);
        expect(lagging.realPower).toBe(480);
        expect(lagging.reactivePower).toBeCloseTo(360, 12);
        expect(lagging.phase).toBeCloseTo(0.6435011087932844, 14);
        const leading = acPower({ ...rms, mode: 'phase', phase: -0.6435011087932844 });
        expect(leading.direction).toBe('leading');
        expect(leading.powerFactor).toBeCloseTo(0.8, 13);
        expect(leading.realPower).toBeCloseTo(480, 12);
        expect(leading.reactivePower).toBeCloseTo(-360, 12);
        expect(Math.hypot(leading.realPower, leading.reactivePower)).toBeCloseTo(600, 12);
    });

    it('handles unity, purely reactive, and zero-power states', () => {
        expect(acPower({ ...rms, mode: 'power-factor', powerFactor: 1, direction: 'leading' }))
            .toEqual({ realPower: 600, reactivePower: 0, apparentPower: 600, phase: 0, powerFactor: 1, direction: 'unity' });
        const capacitive = acPower({ ...rms, mode: 'phase', phase: -Math.PI / 2 });
        expect(capacitive.realPower).toBe(0);
        expect(capacitive.reactivePower).toBe(-600);
        const zero = acPower({ ...rms, current: 0, mode: 'power-factor', powerFactor: 0, direction: 'leading' });
        expect(zero.apparentPower).toBe(0);
        expect(zero.reactivePower).toBe(0);
    });

    it('rejects invalid RMS input, power-factor magnitude, phase and direction', () => {
        expect(() => acPower({ ...rms, voltage: -1, mode: 'phase', phase: 0 })).toThrow(/RMS voltage/i);
        expect(() => acPower({ ...rms, mode: 'power-factor', powerFactor: 1.1, direction: 'leading' })).toThrow(/Power factor/i);
        expect(() => acPower({ ...rms, mode: 'phase', phase: 2 })).toThrow(/phase/i);
        expect(() => acPower({ ...rms, mode: 'power-factor', powerFactor: 0.8 })).toThrow(/leading or lagging/i);
    });
});
