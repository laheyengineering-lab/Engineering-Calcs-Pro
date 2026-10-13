import { describe, it, expect } from 'vitest';
import { loadCalculatorPage, getResultText, setInputValue, setSelectValue, extractNumber } from '../helpers/browser-test-utils.js';

const scripts = ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/hertzian-contact.js'];
const load = () => loadCalculatorPage('calculators/hertzian-contact.html', scripts);
const steel = { E1: 200e9, nu1: 0.3, E2: 200e9, nu2: 0.3 };

// Reference values were calculated independently in Python; the pressure
// distribution was also integrated numerically to confirm that it carries the load.
describe('Hertzian contact: two spheres (point contact)', () => {
    it('matches the steel/steel reference case', () => {
        const { window } = load();
        const r = window.computeHertzContact({ configuration: 'spheres', diameter1: 0.05, diameter2: 0.05, force: 1000, ...steel });
        expect(r.effectiveModulus / 1e9).toBeCloseTo(109.8901, 3);
        expect(r.effectiveRadius).toBeCloseTo(0.0125, 9);
        expect(r.contactRadius * 1e3).toBeCloseTo(0.440221, 5);
        expect(r.maxPressure / 1e6).toBeCloseTo(2463.767, 2);
        expect(r.approach * 1e3).toBeCloseTo(0.0155036, 6);
        expect(r.meanPressure).toBeCloseTo(r.maxPressure * 2 / 3, 3);
    });

    it('agrees with the alternative closed form p0 = (6 F E*^2 / (pi^3 R^2))^(1/3)', () => {
        const { window } = load();
        const r = window.computeHertzContact({ configuration: 'spheres', diameter1: 0.05, diameter2: 0.05, force: 1000, ...steel });
        const alt = Math.cbrt(6 * 1000 * r.effectiveModulus ** 2 / (Math.PI ** 3 * r.effectiveRadius ** 2));
        expect(r.maxPressure).toBeCloseTo(alt, -2);
    });

    it('handles a dissimilar-material sphere on a flat plate', () => {
        const { window } = load();
        const r = window.computeHertzContact({ configuration: 'spheres', shape2: 'flat', diameter1: 0.05, force: 500, E1: 200e9, nu1: 0.3, E2: 69e9, nu2: 0.33 });
        expect(r.effectiveModulus / 1e9).toBeCloseTo(57.259, 3);
        expect(r.contactRadius * 1e3).toBeCloseTo(0.547069, 5);
        expect(r.maxPressure / 1e6).toBeCloseTo(797.676, 2);
    });
});

describe('Hertzian contact: two cylinders (line contact)', () => {
    it('matches the steel/steel reference case', () => {
        const { window } = load();
        const r = window.computeHertzContact({ configuration: 'cylinders', diameter1: 0.1, diameter2: 0.1, length: 0.04, force: 20000, ...steel });
        expect(r.lineLoad).toBeCloseTo(500000, 6);
        expect(r.halfWidth * 1e3).toBeCloseTo(0.380567, 5);
        expect(r.contactWidth).toBeCloseTo(2 * r.halfWidth, 12);
        expect(r.maxPressure / 1e6).toBeCloseTo(836.410, 2);
        expect(r.maxPressure).toBeCloseTo(Math.sqrt(r.lineLoad * r.effectiveModulus / (Math.PI * r.effectiveRadius)), -2);
    });

    it('handles a cylinder inside a larger concave bore', () => {
        const { window } = load();
        const r = window.computeHertzContact({ configuration: 'cylinders', shape2: 'concave', diameter1: 0.05, diameter2: 0.06, length: 0.02, force: 10000, ...steel });
        expect(r.effectiveRadius).toBeCloseTo(0.15, 9);
        expect(r.halfWidth * 1e3).toBeCloseTo(0.932194, 5);
        expect(r.maxPressure / 1e6).toBeCloseTo(341.463, 2);
    });

    it('uses different equations for cylinders and spheres', () => {
        const { window } = load();
        const base = { diameter1: 0.05, diameter2: 0.05, force: 1000, ...steel };
        const sphere = window.computeHertzContact({ configuration: 'spheres', ...base });
        const cyl = window.computeHertzContact({ configuration: 'cylinders', length: 0.01, ...base });
        expect(sphere.contactRadius).not.toBeCloseTo(cyl.halfWidth, 6);
        expect(sphere.maxPressure).not.toBeCloseTo(cyl.maxPressure, -3);
    });
});

describe('Hertzian contact: validation and UI', () => {
    it.each([
        [{ configuration: 'cylinders', diameter1: 0.1, diameter2: 0.1, length: 0, force: 1, ...steel }],
        [{ configuration: 'spheres', diameter1: -1, diameter2: 0.1, force: 1, ...steel }],
        [{ configuration: 'spheres', diameter1: 0.1, diameter2: 0.1, force: 0, ...steel }],
        [{ configuration: 'spheres', diameter1: 0.1, diameter2: 0.1, force: 1, ...steel, E1: 0 }],
        [{ configuration: 'spheres', diameter1: 0.1, diameter2: 0.1, force: 1, ...steel, nu2: 0.5 }],
        [{ configuration: 'spheres', diameter1: 0.1, diameter2: 0.1, force: 1, ...steel, nu1: -0.1 }],
        [{ configuration: 'spheres', shape2: 'concave', diameter1: 0.1, diameter2: 0.1, force: 1, ...steel }],
        [{ configuration: 'spheres', diameter1: 0.1, diameter2: NaN, force: 1, ...steel }],
        [{ configuration: 'cylinders', diameter1: 0.1, diameter2: 0.1, length: NaN, force: 1, ...steel }],
        [{ configuration: 'cones', diameter1: 0.1, diameter2: 0.1, force: 1, ...steel }]
    ])('rejects invalid input %j', (values) => {
        const { window } = load();
        expect(() => window.computeHertzContact(values)).toThrow();
    });

    function fill(document, values) {
        Object.entries(values).forEach(([id, v]) => setInputValue(document, id, v));
    }

    it('shows formatted results for spheres and hides the length field', () => {
        const { document, window } = load();
        setSelectValue(document, 'configuration', 'spheres');
        window.updateHertzConfiguration();
        expect(document.getElementById('lengthGroup').hidden).toBe(true);
        expect(document.getElementById('sphereContactDiagram').hidden).toBe(false);
        expect(document.getElementById('cylinderContactDiagram').hidden).toBe(true);
        expect(document.getElementById('sphereContactDiagram').closest('.calculator-column')).toBeTruthy();
        fill(document, { diameter1: 50, diameter2: 50, contactForce: 1000, modulus1: 200, poisson1: 0.3, modulus2: 200, poisson2: 0.3 });
        window.calculateHertzContact();
        const text = getResultText(document);
        expect(extractNumber(text, /Maximum contact pressure: ([\d.,]+) MPa/)).toBeCloseTo(2463.77, 1);
        expect(extractNumber(text, /Contact radius a: ([\d.,]+) mm/)).toBeCloseTo(0.440221, 5);
        expect(document.getElementById('sphereContactDiagram').hidden).toBe(false);
    });

    it('shows formatted results for cylinders and handles the flat shape and material presets', () => {
        const { document, window } = load();
        expect(document.getElementById('cylinderContactDiagram').hidden).toBe(false);
        expect(document.getElementById('sphereContactDiagram').hidden).toBe(true);
        setSelectValue(document, 'material1', 'carbon-steel');
        window.applyHertzMaterial(1);
        expect(document.getElementById('modulus1').value).toBe('200');
        fill(document, { diameter1: 100, diameter2: 100, contactLength: 40, contactForce: 20, modulus2: 200, poisson2: 0.27 });
        setSelectValue(document, 'forceUnit', 'kN');
        window.calculateHertzContact();
        const first = extractNumber(getResultText(document), /Maximum contact pressure: ([\d.,]+) MPa/);
        expect(first).toBeGreaterThan(800);
        setSelectValue(document, 'shape2', 'flat');
        window.updateHertzShape();
        expect(document.getElementById('diameter2Group').hidden).toBe(true);
        window.calculateHertzContact();
        const flat = extractNumber(getResultText(document), /Maximum contact pressure: ([\d.,]+) MPa/);
        expect(flat).toBeLessThan(first); // larger equivalent radius lowers contact pressure
        setSelectValue(document, 'configuration', 'spheres');
        window.updateHertzConfiguration();
        expect(document.getElementById('cylinderContactDiagram').hidden).toBe(true);
        expect(document.getElementById('sphereContactDiagram').hidden).toBe(false);
    });

    it('rejects missing inputs with a clear message and states the limitation', () => {
        const { document, window } = load();
        window.calculateHertzContact();
        expect(getResultText(document)).toContain('Invalid Input');
        expect(document.body.textContent).toMatch(/not.*fatigue, wear, yielding or service-life/i);
    });
});
