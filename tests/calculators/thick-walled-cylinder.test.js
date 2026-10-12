import { describe, it, expect } from 'vitest';
import { loadCalculatorPage, getResultText, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

const scripts = ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/thick-walled-cylinder.js'];

function load() {
    return loadCalculatorPage('calculators/thick-walled-cylinder.html', scripts);
}

// Reference values (MPa) calculated independently by hand / Python for a = 50 mm, b = 100 mm.
const g = { innerRadius: 0.05, outerRadius: 0.1 };
const MPa = 1e6;

describe('thick-walled cylinder (Lamé)', () => {
    it('internal pressure 100 MPa, closed ends', () => {
        const { window } = load();
        const r = window.computeThickCylinder({ ...g, internalPressure: 100 * MPa, externalPressure: 0, endCondition: 'closed' });
        expect(r.inner.radial / MPa).toBeCloseTo(-100, 6);
        expect(r.inner.hoop / MPa).toBeCloseTo(166.6667, 3);
        expect(r.outer.radial / MPa).toBeCloseTo(0, 6);
        expect(r.outer.hoop / MPa).toBeCloseTo(66.6667, 3);
        expect(r.inner.axial / MPa).toBeCloseTo(33.3333, 3);
        expect(r.governingLocation).toBe('inner surface');
    });

    it('external pressure 100 MPa only gives compressive hoop stress', () => {
        const { window } = load();
        const r = window.computeThickCylinder({ ...g, internalPressure: 0, externalPressure: 100 * MPa, endCondition: 'closed' });
        expect(r.inner.radial / MPa).toBeCloseTo(0, 6);
        expect(r.inner.hoop / MPa).toBeCloseTo(-266.6667, 3);
        expect(r.outer.radial / MPa).toBeCloseTo(-100, 6);
        expect(r.outer.hoop / MPa).toBeCloseTo(-166.6667, 3);
        expect(r.inner.axial / MPa).toBeCloseTo(-133.3333, 3);
    });

    it('combined pressures and open ends', () => {
        const { window } = load();
        const r = window.computeThickCylinder({ ...g, internalPressure: 100 * MPa, externalPressure: 40 * MPa, endCondition: 'open' });
        expect(r.inner.radial / MPa).toBeCloseTo(-100, 6);
        expect(r.outer.radial / MPa).toBeCloseTo(-40, 6);
        expect(r.inner.hoop / MPa).toBeCloseTo(60, 3);
        expect(r.outer.hoop / MPa).toBeCloseTo(0, 3);
        expect(r.inner.axial).toBe(0);
    });

    it('pressure-free case gives zero stress everywhere', () => {
        const { window } = load();
        const r = window.computeThickCylinder({ ...g, internalPressure: 0, externalPressure: 0 });
        r.stations.forEach((s) => {
            expect(s.radial).toBeCloseTo(0, 9);
            expect(s.hoop).toBeCloseTo(0, 9);
            expect(s.axial).toBeCloseTo(0, 9);
        });
    });

    it('has the expected distribution shape: boundary radial stress, monotonic hoop, equilibrium', () => {
        const { window } = load();
        const pi = 80 * MPa, po = 20 * MPa;
        const r = window.computeThickCylinder({ ...g, internalPressure: pi, externalPressure: po });
        expect(r.stations).toHaveLength(11);
        expect(r.stations[0].radial).toBeCloseTo(-pi, 3);
        expect(r.stations[10].radial).toBeCloseTo(-po, 3);
        for (let i = 1; i < r.stations.length; i += 1) {
            expect(r.stations[i].hoop).toBeLessThan(r.stations[i - 1].hoop); // pi > po: hoop falls with radius
            // sigma_r + sigma_theta is constant through the wall (= 2A)
            expect(r.stations[i].radial + r.stations[i].hoop).toBeCloseTo(r.stations[0].radial + r.stations[0].hoop, 3);
        }
        // Radial equilibrium: d(r*sigma_r)/dr = sigma_theta (central difference at mid-wall)
        const rm = 0.075, h = 1e-6;
        const d = (rm + h) * r.stressAt(rm + h).radial - (rm - h) * r.stressAt(rm - h).radial;
        expect(d / (2 * h)).toBeCloseTo(r.stressAt(rm).hoop, -1);
    });

    it('approaches the thin-wall hoop stress p*r/t for a thin wall', () => {
        const { window } = load();
        const r = window.computeThickCylinder({ innerRadius: 0.1, outerRadius: 0.101, internalPressure: 10 * MPa, externalPressure: 0 });
        const thin = 10 * MPa * 0.1005 / 0.001;
        expect(Math.abs(r.inner.hoop - thin) / thin).toBeLessThan(0.01);
    });

    it.each([
        [{ innerRadius: 0, outerRadius: 0.1, internalPressure: 1, externalPressure: 0 }],
        [{ innerRadius: -0.05, outerRadius: 0.1, internalPressure: 1, externalPressure: 0 }],
        [{ innerRadius: 0.1, outerRadius: 0.1, internalPressure: 1, externalPressure: 0 }],
        [{ innerRadius: 0.1, outerRadius: 0.05, internalPressure: 1, externalPressure: 0 }],
        [{ innerRadius: 0.05, outerRadius: 0.1, internalPressure: -1, externalPressure: 0 }],
        [{ innerRadius: 0.05, outerRadius: 0.1, internalPressure: 1, externalPressure: -1 }],
        [{ innerRadius: NaN, outerRadius: 0.1, internalPressure: 1, externalPressure: 0 }],
        [{ innerRadius: 0.05, outerRadius: Infinity, internalPressure: 1, externalPressure: 0 }],
        [{ innerRadius: 0.05, outerRadius: 0.1, internalPressure: 1, externalPressure: 0, endCondition: 'bad' }]
    ])('rejects invalid input %j', (values) => {
        const { window } = load();
        expect(() => window.computeThickCylinder(values)).toThrow();
    });

    it('displays table values, units, sign convention and plot', () => {
        const { document, window } = load();
        setInputValue(document, 'innerDiameter', 100);
        setInputValue(document, 'outerDiameter', 200);
        setInputValue(document, 'internalPressure', 100);
        window.calculateThickCylinder();
        const text = getResultText(document);
        expect(text).toContain('166.667');
        expect(text).toContain('-100');
        expect(text).toMatch(/tension positive, compression negative/);
        expect(text).toContain('closed ends');
        const svg = document.querySelector('#plot svg');
        expect(svg.textContent).toContain('Radius r (mm)');
        expect(svg.textContent).toContain('Stress (MPa)');
    });

    it('converts units: psi and inches', () => {
        const { document, window } = load();
        setInputValue(document, 'innerDiameter', 2);
        setInputValue(document, 'outerDiameter', 4);
        setInputValue(document, 'internalPressure', 10000);
        setSelectValue(document, 'distanceUnit', 'in');
        setSelectValue(document, 'stressUnit', 'psi');
        window.calculateThickCylinder();
        expect(getResultText(document).replace(/,/g, '')).toContain('16666.7');
    });

    it('rejects blank and invalid geometry in the UI', () => {
        const { document, window } = load();
        window.calculateThickCylinder();
        expect(getResultText(document)).toContain('Invalid Input');
        setInputValue(document, 'innerDiameter', 200);
        setInputValue(document, 'outerDiameter', 100);
        setInputValue(document, 'internalPressure', 10);
        window.calculateThickCylinder();
        expect(getResultText(document)).toMatch(/Outer diameter must be greater/);
    });
});
