import { describe, it, expect } from 'vitest';
import { loadCalculatorPage, getResultText, setInputValue, setSelectValue, extractNumber } from '../helpers/browser-test-utils.js';

const scripts = ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/cylinder-force.js'];

function run(values, units = {}) {
    const { document, window } = loadCalculatorPage('calculators/cylinder-force.html', scripts);
    Object.entries({ boreDiameter: '', rodDiameter: '', workingPressure: '', efficiency: '', ...values }).forEach(([id, v]) => setInputValue(document, id, v));
    Object.entries(units).forEach(([id, v]) => setSelectValue(document, id, v));
    window.calculateCylinderForce();
    return { document, window, text: getResultText(document) };
}

describe('cylinder force calculator', () => {
    // Independent hand calculation: D = 100 mm, d = 50 mm, p = 10 MPa
    // A_p = 7853.98 mm2, A_r = 1963.50 mm2, A_a = 5890.49 mm2, F_ext = 78.540 kN, F_ret = 58.905 kN
    it('matches the hand-calculated extension and retraction forces', () => {
        const { text } = run({ boreDiameter: 100, rodDiameter: 50, workingPressure: 100 }, { areaUnit: 'mm²' });
        expect(extractNumber(text, /Full piston area Ap: ([\d.,]+) mm²/i)).toBeCloseTo(7853.98, 2);
        expect(extractNumber(text, /Rod cross-sectional area Ar: ([\d.,]+) mm²/i)).toBeCloseTo(1963.5, 1);
        expect(extractNumber(text, /annular \(rod-side\) area Aa: ([\d.,]+) mm²/i)).toBeCloseTo(5890.49, 1);
        expect(extractNumber(text, /Extension: ([\d.,]+) kN/)).toBeCloseTo(78.54, 2);
        expect(extractNumber(text, /Retraction: ([\d.,]+) kN/)).toBeCloseTo(58.905, 2);
        expect(text).toContain('no efficiency factor was applied');
    });

    it('gives equal extension and retraction for a zero rod diameter', () => {
        const { window } = run({ boreDiameter: 100, rodDiameter: 0, workingPressure: 100 });
        const r = window.computeCylinderForce({ bore: 0.1, rod: 0, pressure: 1e7 });
        expect(r.retractionForce).toBeCloseTo(r.extensionForce, 6);
        expect(r.rodArea).toBe(0);
    });

    it('applies efficiency only when supplied and labels it as an assumption', () => {
        const { text } = run({ boreDiameter: 100, rodDiameter: 50, workingPressure: 100, efficiency: 90 });
        expect(extractNumber(text, /Usable extension force: ([\d.,]+) kN/)).toBeCloseTo(70.686, 2);
        expect(extractNumber(text, /Usable retraction force: ([\d.,]+) kN/)).toBeCloseTo(53.014, 2);
        expect(text).toMatch(/user-supplied efficiency/i);
        expect(text).toMatch(/seals, pressure losses, friction/i);
    });

    it('converts units (in, psi, lbf)', () => {
        // 4 in bore, 0 rod, 1000 psi -> 12566.4 lbf
        const { text } = run({ boreDiameter: 4, rodDiameter: 0, workingPressure: 1000 }, { distanceUnit: 'in', pressureUnit: 'psi', forceUnit: 'lbf' });
        expect(extractNumber(text, /Extension: ([\d.,]+) lbf/)).toBeCloseTo(12566.4, 0);
    });

    it.each([
        [{ boreDiameter: 50, rodDiameter: 50, workingPressure: 10 }, /smaller than the bore/],
        [{ boreDiameter: 50, rodDiameter: 60, workingPressure: 10 }, /smaller than the bore/],
        [{ boreDiameter: 50, rodDiameter: -1, workingPressure: 10 }, /cannot be negative/],
        [{ boreDiameter: 0, rodDiameter: 0, workingPressure: 10 }, /greater than zero/],
        [{ boreDiameter: 50, rodDiameter: 20, workingPressure: 0 }, /pressure must be greater/],
        [{ boreDiameter: 50, rodDiameter: '', workingPressure: 10 }, /valid numbers/],
        [{ boreDiameter: 50, rodDiameter: 20, workingPressure: 10, efficiency: 120 }, /Efficiency/],
        [{ boreDiameter: 50, rodDiameter: 20, workingPressure: 10, efficiency: 0 }, /Efficiency/]
    ])('rejects invalid input %j', (values, message) => {
        const { text } = run(values);
        expect(text).toContain('Invalid Input');
        expect(text).toMatch(message);
    });
});
