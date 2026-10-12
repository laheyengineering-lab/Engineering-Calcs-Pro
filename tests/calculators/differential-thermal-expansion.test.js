import { describe, it, expect } from 'vitest';
import { loadCalculatorPage, getResultText, setInputValue, setSelectValue, extractNumber } from '../helpers/browser-test-utils.js';

const scripts = ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/differential-thermal-expansion.js'];
const load = () => loadCalculatorPage('calculators/differential-thermal-expansion.html', scripts);

function section(document, id, [length, alpha, ti, tf]) {
    setInputValue(document, id + 'Length', length);
    setInputValue(document, id + 'Alpha', alpha);
    setInputValue(document, id + 'Ti', ti);
    setInputValue(document, id + 'Tf', tf);
}

describe('differential thermal expansion', () => {
    // Independent hand calculation (alpha in 1e-6/°C):
    // A: 12e-6 * 500 * 80 = 0.480 mm; B: 23e-6*300*80 + 12e-6*200*40 = 0.552 + 0.096 = 0.648 mm; A - B = -0.168 mm
    it('computes multi-section expansion and signed differential movement', () => {
        const { document, window } = load();
        section(document, 'secA1', [500, 12, 20, 100]);
        section(document, 'secB1', [300, 23, 20, 100]);
        section(document, 'secB2', [200, 12, 20, 60]);
        window.calculateDifferentialThermalExpansion();
        const text = getResultText(document);
        expect(extractNumber(text, /Member A expansion: ([-\d.,]+) mm/)).toBeCloseTo(0.48, 6);
        expect(extractNumber(text, /Member B expansion: ([-\d.,]+) mm/)).toBeCloseTo(0.648, 6);
        expect(extractNumber(text, /Differential \(A − B\): ([-\d.,]+) mm/)).toBeCloseTo(-0.168, 6);
        expect(text).toMatch(/Positive differential means member A lengthens more/);
        expect(text).toMatch(/restrained, in contact or loaded/);
    });

    it('supports a basic single-member calculation', () => {
        const { document, window } = load();
        section(document, 'secA1', [1000, 12, 20, 70]);
        window.calculateDifferentialThermalExpansion();
        const text = getResultText(document);
        expect(extractNumber(text, /Member A expansion: ([-\d.,]+) mm/)).toBeCloseTo(0.6, 6);
        expect(text).not.toContain('Differential (A');
    });

    it('handles negative temperature change, zero change and equal free expansion', () => {
        const { window } = load();
        const sec = (length, alpha, tInitial, tFinal) => ({ length, alpha, tInitial, tFinal });
        const cool = window.computeDifferentialExpansion([sec(0.5, 12e-6, 100, 20)], null);
        expect(cool.memberA.expansion).toBeCloseTo(-0.00048, 10);
        const zero = window.computeDifferentialExpansion([sec(0.5, 12e-6, 20, 20)], null);
        expect(zero.memberA.expansion).toBe(0);
        // 0.1 m * 10e-6 * 50 = 0.2 m * 5e-6 * 50 = 5e-5 m
        const equal = window.computeDifferentialExpansion([sec(0.1, 10e-6, 0, 50)], [sec(0.2, 5e-6, 0, 50)]);
        expect(equal.memberA.expansion).toBeCloseTo(5e-5, 12);
        expect(equal.differential).toBeCloseTo(0, 15);
        expect(equal.initialLengthDifference).toBeCloseTo(-0.1, 12);
        expect(equal.finalLengthDifference).toBeCloseTo(-0.1, 12);
    });

    it('converts temperature and coefficient units', () => {
        const run = (ti, tf, tempUnit, alpha, alphaUnit) => {
            const { document, window } = load();
            setSelectValue(document, 'temperatureUnit', tempUnit);
            setSelectValue(document, 'alphaUnit', alphaUnit);
            section(document, 'secA1', [500, alpha, ti, tf]);
            window.calculateDifferentialThermalExpansion();
            return extractNumber(getResultText(document), /Member A expansion: ([-\d.,]+) mm/);
        };
        expect(run(68, 212, '°F', 12, '10⁻⁶/°C')).toBeCloseTo(0.48, 6);
        expect(run(293.15, 373.15, 'K', 12e-6, '1/°C')).toBeCloseTo(0.48, 6);
        expect(run(20, 100, '°C', 6.666667, '10⁻⁶/°F')).toBeCloseTo(0.48, 4);
    });

    it('fills the coefficient from the material database', () => {
        const { document, window } = load();
        setSelectValue(document, 'secA1Material', 'carbon-steel');
        window.applyDteMaterial('secA1');
        expect(Number(document.getElementById('secA1Alpha').value)).toBeCloseTo(12, 6);
    });

    it.each([
        ['missing member A', () => {}],
        ['partial section', (d) => { setInputValue(d, 'secA1Length', 100); }],
        ['zero length', (d, w) => section(d, 'secA1', [0, 12, 20, 100])],
        ['negative length', (d) => section(d, 'secA1', [-5, 12, 20, 100])],
        ['below absolute zero', (d) => { setSelectValue(d, 'temperatureUnit', 'K'); section(d, 'secA1', [100, 12, -5, 100]); }],
        ['incomplete member B section', (d) => { section(d, 'secA1', [100, 12, 20, 100]); setInputValue(d, 'secB1Length', 50); }]
    ])('rejects invalid input: %s', (name, setup) => {
        const { document, window } = load();
        setup(document, window);
        window.calculateDifferentialThermalExpansion();
        expect(getResultText(document)).toContain('Invalid Input');
    });
});
