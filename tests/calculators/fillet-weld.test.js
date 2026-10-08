import { describe, it, expect } from 'vitest';
import {
    loadCalculatorPage,
    getResultText,
    getResultValueText,
    extractLeadingNumber,
    extractNumber,
    setInputValue,
    setSelectValue
} from '../helpers/browser-test-utils.js';

function setup() {
    return loadCalculatorPage('calculators/fillet-weld.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/fillet-weld.js']);
}

const KIP = 1000; // lbf

// 1/4 in leg, 12 in length, E70XX, in imperial output (lbf)
function run(overrides = {}, selects = {}) {
    const { document, window } = setup();
    const inputs = { weldLeg: 0.25, weldLength: 12, appliedLoad: '', ...overrides };
    Object.entries(inputs).forEach(([id, v]) => setInputValue(document, id, v));
    const sel = { weldLegUnit: 'in', weldLengthUnit: 'in', electrode: 'E70XX', loadDirection: '0', designMethod: 'LRFD', forceUnit: 'lbf', ...selects };
    Object.entries(sel).forEach(([id, v]) => setSelectValue(document, id, v));
    window.calculateFilletWeld();
    return { document, window, text: getResultText(document) };
}

describe('fillet weld calculator', () => {
    it('calculates E70XX longitudinal throat, area and nominal capacity', () => {
        const { text } = run();
        expect(extractNumber(text, /Effective Throat: ([\d.,]+) in/)).toBeCloseTo(0.17675, 4);
        expect(extractNumber(text, /Effective Weld Area: ([\d.,]+) in²/)).toBeCloseTo(2.121, 3);
        expect(extractNumber(text, /Nominal Weld Capacity \(Rn\): ([\d.,]+) lbf/) / KIP).toBeCloseTo(89.1, 1);
    });

    it('calculates LRFD capacity', () => {
        const { document, text } = run();
        expect(extractLeadingNumber(getResultValueText(document)) / KIP).toBeCloseTo(66.82, 1);
        expect(extractNumber(text, /φRn \(φ = 0\.75\): ([\d.,]+) lbf/) / KIP).toBeCloseTo(66.82, 1);
    });

    it('calculates ASD capacity', () => {
        const { document } = run({}, { designMethod: 'ASD' });
        expect(extractLeadingNumber(getResultValueText(document)) / KIP).toBeCloseTo(44.55, 1);
    });

    it('applies the transverse directional strength increase (0.90 FEXX)', () => {
        const { text } = run({}, { loadDirection: '90' });
        expect(extractNumber(text, /Nominal Weld Capacity \(Rn\): ([\d.,]+) lbf/) / KIP).toBeCloseTo(89.1 * 1.5, 0);
        expect(extractNumber(text, /Fnw\): ([\d.,]+) MPa/)).toBeCloseTo(0.9 * 482.63, 0);
    });

    it('calculates required weld size without rounding', () => {
        const { text } = run({ appliedLoad: 20000 }, { designMethod: 'ASD' });
        expect(extractNumber(text, /Required Weld Leg Size: ([\d.,]+) in/)).toBeCloseTo(0.11226, 4);
    });

    it('calculates utilization, remaining capacity, and PASS/REVIEW status', () => {
        const pass = run({ appliedLoad: 33410 }, { designMethod: 'LRFD' });
        expect(extractNumber(pass.text, /Utilization: ([\d.,]+)/)).toBeCloseTo(0.5, 2);
        expect(pass.text).toContain('PASS');
        expect(extractNumber(pass.text, /Remaining Capacity: ([\d.,]+) lbf/) / KIP).toBeCloseTo(33.41, 1);

        const fail = run({ appliedLoad: 80000 }, { designMethod: 'LRFD' });
        expect(fail.text).toContain('REVIEW / INADEQUATE');
    });

    it('allows an explicit zero applied load', () => {
        const { text } = run({ appliedLoad: 0 });
        expect(extractNumber(text, /Utilization: ([\d.,]+)/)).toBe(0);
    });

    it('handles metric inputs equivalently to imperial', () => {
        const metric = run({ weldLeg: 6.35, weldLength: 304.8 }, { weldLegUnit: 'mm', weldLengthUnit: 'mm', forceUnit: 'N' });
        const imperial = run({}, { forceUnit: 'N' });
        const n = (t) => extractNumber(t, /Nominal Weld Capacity \(Rn\): ([\d.,]+) N/);
        expect(n(metric.text) / n(imperial.text)).toBeCloseTo(1, 4);
        expect(extractNumber(metric.text, /Effective Weld Area: ([\d.,]+) mm²/)).toBeCloseTo(0.707 * 6.35 * 304.8, 0);
    });

    it('handles imperial inputs with lbf output', () => {
        const { text } = run({ weldLeg: 0.25, weldLength: 1.2 }, { weldLengthUnit: 'cm', weldLegUnit: 'in', forceUnit: 'kN' });
        expect(text).toContain('Design Capacity');
        expect(text).not.toContain('Invalid');
    });

    it('rejects an invalid weld size', () => {
        expect(run({ weldLeg: 0 }).text).toContain('Weld leg size must be');
        expect(run({ weldLeg: -1 }).text).toContain('Weld leg size must be');
        expect(run({ weldLeg: '' }).text).toContain('Weld leg size must be');
    });

    it('rejects an invalid weld length', () => {
        expect(run({ weldLength: 0 }).text).toContain('Weld length must be');
        expect(run({ weldLength: '' }).text).toContain('Weld length must be');
    });

    it('rejects an invalid load direction', () => {
        expect(run({}, { loadDirection: '45' }).text).toContain('Load direction must be');
    });

    it('rejects an invalid applied load', () => {
        expect(run({ appliedLoad: -5 }).text).toContain('Applied load must be');
    });

    it('resets inputs', () => {
        const { document, window } = run({ appliedLoad: 5 });
        window.resetFilletWeldCalculator();
        expect(getResultText(document)).toBe('Ready to calculate.');
        expect(document.getElementById('weldLeg').value).toBe('');
    });
});
