import { describe, expect, it } from 'vitest';
import {
    loadCalculatorPage,
    getResultText,
    extractNumber,
    setInputValue,
    setSelectValue
} from '../helpers/browser-test-utils.js';

function setup() {
    return loadCalculatorPage('calculators/spring-calculations.html', [
        'js/engineering-units.js',
        'js/calculator-utils.js',
        'js/spring-calculations.js'
    ]);
}

function runSpring(overrides = {}, selects = {}) {
    const { document, window } = setup();
    const values = {
        wireDiameter: 5,
        meanCoilDiameter: 40,
        activeCoils: 10,
        appliedForce: 500,
        shearModulus: 80,
        ...overrides
    };
    Object.entries(values).forEach(([id, value]) => setInputValue(document, id, value));
    const units = {
        distanceUnit: 'mm',
        forceUnit: 'N',
        modulusUnit: 'GPa',
        stressUnit: 'MPa',
        ...selects
    };
    Object.entries(units).forEach(([id, value]) => setSelectValue(document, id, value));
    window.calculateSpring();
    return { document, window, text: getResultText(document) };
}

describe('helical spring calculator', () => {
    it('matches the independently calculated 5 mm wire benchmark', () => {
        const { text } = runSpring();
        expect(extractNumber(text, /Spring Rate: ([\d.,]+) N\/mm/)).toBeCloseTo(9.765625, 3);
        expect(extractNumber(text, /Spring Index \(C\): ([\d.,]+)/)).toBeCloseTo(8, 3);
        expect(extractNumber(text, /Axial Deflection: ([\d.,]+) mm/)).toBeCloseTo(51.2, 2);
        expect(extractNumber(text, /Factor: ([\d.,]+)/)).toBeCloseTo(1.1840, 3);
        expect(extractNumber(text, /Stress: ([\d.,]+) MPa/)).toBeCloseTo(482.41, 1);
    });

    it('converts equivalent inch, lbf, and psi inputs and outputs', () => {
        const { text } = runSpring(
            { wireDiameter: 5 / 25.4, meanCoilDiameter: 40 / 25.4, appliedForce: 500 / 4.4482216152605, shearModulus: 80e9 / 6894.757 },
            { distanceUnit: 'in', forceUnit: 'lbf', modulusUnit: 'psi', stressUnit: 'psi' }
        );
        expect(extractNumber(text, /Spring Rate: ([\d.,]+) lbf\/in/)).toBeCloseTo(55.7632, 2);
        expect(extractNumber(text, /Axial Deflection: ([\d.,]+) in/)).toBeCloseTo(51.2 / 25.4, 3);
        expect(extractNumber(text, /Stress: ([\d.,]+) psi/)).toBeCloseTo(69968, -1);
    });

    it('allows zero load and valid spring-index boundary values', () => {
        const zeroLoad = runSpring({ appliedForce: 0 });
        expect(extractNumber(zeroLoad.text, /Axial Deflection: ([\d.,]+) mm/)).toBe(0);
        expect(extractNumber(zeroLoad.text, /Stress: ([\d.,]+) MPa/)).toBe(0);

        const boundary = runSpring({ meanCoilDiameter: 20 });
        expect(boundary.text).not.toContain('Geometry warning');
        expect(extractNumber(boundary.text, /Spring Index \(C\): ([\d.,]+)/)).toBe(4);
    });

    it('warns when spring index is outside the typical range', () => {
        expect(runSpring({ meanCoilDiameter: 17 * 5 }).text).toContain('outside the typical range of 4–16');
        expect(runSpring({ meanCoilDiameter: 3 * 5 }).text).toContain('outside the typical range of 4–16');
    });

    it.each([
        [{ wireDiameter: '' }, 'Wire diameter'],
        [{ wireDiameter: -1 }, 'Wire diameter'],
        [{ meanCoilDiameter: 0 }, 'Wire diameter'],
        [{ meanCoilDiameter: 5 }, 'mean coil diameter must be greater'],
        [{ activeCoils: 0 }, 'active coils'],
        [{ shearModulus: 0 }, 'shear modulus'],
        [{ appliedForce: -1 }, 'Applied axial force'],
        [{ appliedForce: '' }, 'Applied axial force']
    ])('rejects invalid inputs %j', (overrides, message) => {
        expect(runSpring(overrides).text).toContain(message);
    });

    it('uses material shear modulus and resets controls', () => {
        const { document, window } = setup();
        setSelectValue(document, 'springMaterial', 'carbon-steel');
        document.getElementById('springMaterial').dispatchEvent(new window.Event('change'));
        expect(Number(document.getElementById('shearModulus').value)).toBe(80);
        setSelectValue(document, 'modulusUnit', 'psi');
        document.getElementById('modulusUnit').dispatchEvent(new window.Event('change'));
        expect(Number(document.getElementById('shearModulus').value)).toBeCloseTo(80e9 / 6894.757, 0);
        setInputValue(document, 'wireDiameter', 5);
        window.resetSpringCalculator();
        expect(document.getElementById('wireDiameter').value).toBe('');
        expect(getResultText(document)).toBe('Ready to calculate.');
    });
});
