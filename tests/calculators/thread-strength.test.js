import { describe, expect, it } from 'vitest';
import {
    loadCalculatorPage,
    getResultText,
    extractNumber,
    setInputValue,
    setSelectValue
} from '../helpers/browser-test-utils.js';

function setup() {
    return loadCalculatorPage('calculators/thread-strength.html', [
        'js/engineering-units.js',
        'js/calculator-utils.js',
        'js/thread-strength.js'
    ]);
}

function runThread(overrides = {}, selects = {}) {
    const { document, window } = setup();
    const values = {
        majorDiameter: 10,
        threadPitch: 1.5,
        tensileStressArea: 61.2,
        engagementLength: 15,
        appliedLoad: 10,
        boltStrength: 400,
        internalStrength: 400,
        ...overrides
    };
    Object.entries(values).forEach(([id, value]) => setInputValue(document, id, value));
    const units = {
        distanceUnit: 'mm',
        pitchUnit: 'mm',
        areaUnit: 'mm²',
        forceUnit: 'kN',
        strengthUnit: 'MPa',
        ...selects
    };
    Object.entries(units).forEach(([id, value]) => setSelectValue(document, id, value));
    window.calculateThreadStrength();
    return { document, window, text: getResultText(document) };
}

describe('thread strength calculator', () => {
    it('matches the entered-area tensile and internal stripping benchmark', () => {
        const { text } = runThread();
        expect(extractNumber(text, /Fastener Tensile Capacity: ([\d.,]+) kN/)).toBeCloseTo(24.48, 2);
        expect(extractNumber(text, /Applied Fastener Stress: ([\d.,]+) MPa/)).toBeCloseTo(163.40, 1);
        expect(extractNumber(text, /Fastener Utilization: ([\d.,]+)%/)).toBeCloseTo(40.85, 1);
        expect(extractNumber(text, /Approximate Internal-Thread Shear Area: ([\d.,]+) mm²/)).toBeCloseTo(255.082, 2);
        expect(extractNumber(text, /Internal-Thread Stripping Capacity: ([\d.,]+) kN/)).toBeCloseTo(58.873, 2);
        expect(text).toContain('Governing Mode: Fastener tensile');
    });

    it('converts equivalent inch, TPI-compatible, lbf, in², and psi quantities', () => {
        const { text } = runThread(
            {
                majorDiameter: 10 / 25.4,
                threadPitch: 1.5 / 25.4,
                tensileStressArea: 61.2 * 0.0015500031,
                engagementLength: 15 / 25.4,
                appliedLoad: 10000 / 4.4482216152605,
                boltStrength: 400 * 145.0377377,
                internalStrength: 400 * 145.0377377
            },
            { distanceUnit: 'in', pitchUnit: 'in', areaUnit: 'in²', forceUnit: 'lbf', strengthUnit: 'psi' }
        );
        expect(extractNumber(text, /Fastener Tensile Capacity: ([\d.,]+) lbf/) * 4.4482216152605).toBeCloseTo(24480, 0);
        expect(extractNumber(text, /Applied Fastener Stress: ([\d.,]+) psi/)).toBeCloseTo(23699, -1);
        expect(text).toContain('Governing Mode: Fastener tensile');
    });

    it('accepts TPI and explicitly skips stripping when internal strength is omitted', () => {
        const { text } = runThread(
            { majorDiameter: 0.5, threadPitch: 20, tensileStressArea: 0.1, engagementLength: 0.75, appliedLoad: 1000, boltStrength: 58000, internalStrength: '' },
            { distanceUnit: 'in', pitchUnit: 'TPI', areaUnit: 'in²', forceUnit: 'lbf', strengthUnit: 'psi' }
        );
        expect(text).toMatch(/internal-thread stripping not assessed/i);
        expect(text).toContain('Not assessed; provide internal-thread material strength.');
    });

    it('allows zero load and warns for short engagement', () => {
        const zeroLoad = runThread({ appliedLoad: 0 });
        expect(extractNumber(zeroLoad.text, /Fastener Utilization: ([\d.,]+)%/)).toBe(0);
        expect(extractNumber(zeroLoad.text, /Internal-Thread Utilization: ([\d.,]+)%/)).toBe(0);

        const short = runThread({ engagementLength: 5 });
        expect(short.text).toContain('outside the common preliminary range of 1–2 nominal diameters');
    });

    it.each([
        [{ majorDiameter: 0 }, 'Major diameter'],
        [{ majorDiameter: '' }, 'Major diameter'],
        [{ threadPitch: 0 }, 'Major diameter'],
        [{ threadPitch: 10 }, 'Thread pitch must be less'],
        [{ engagementLength: 0 }, 'engagement length'],
        [{ tensileStressArea: 0 }, 'tensile stress area'],
        [{ appliedLoad: -1 }, 'Applied tensile load'],
        [{ boltStrength: 0 }, 'fastener strength'],
        [{ internalStrength: 0 }, 'Internal-thread strength']
    ])('rejects invalid inputs %j', (overrides, message) => {
        expect(runThread(overrides).text).toContain(message);
    });

    it('loads material strengths independently for the bolt and internal thread', () => {
        const { document, window } = setup();
        setSelectValue(document, 'boltMaterial', 'carbon-steel');
        setSelectValue(document, 'internalMaterial', 'aluminum');
        document.getElementById('boltMaterial').dispatchEvent(new window.Event('change'));
        document.getElementById('internalMaterial').dispatchEvent(new window.Event('change'));
        expect(Number(document.getElementById('boltStrength').value)).toBe(250);
        expect(Number(document.getElementById('internalStrength').value)).toBe(310);
        setSelectValue(document, 'strengthUnit', 'psi');
        document.getElementById('strengthUnit').dispatchEvent(new window.Event('change'));
        expect(Number(document.getElementById('boltStrength').value)).toBeCloseTo(250e6 / 6894.757, 0);
        expect(Number(document.getElementById('internalStrength').value)).toBeCloseTo(310e6 / 6894.757, 0);
    });
});
