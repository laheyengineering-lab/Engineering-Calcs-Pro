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
    return loadCalculatorPage('calculators/press-fit.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/press-fit.js']);
}

function fill(document, overrides = {}) {
    const v = {
        interfaceDiameter: 50, diametralInterference: 0.05, hubOuterDiameter: 100,
        shaftBoreDiameter: 0, engagementLength: 50, frictionCoefficient: 0.12, ...overrides
    };
    Object.entries(v).forEach(([id, value]) => setInputValue(document, id, value));
    setSelectValue(document, 'hubMaterial', overrides.hubMaterial || 'carbon-steel');
    setSelectValue(document, 'shaftMaterial', overrides.shaftMaterial || 'carbon-steel');
}

// Independent Lamé solution
function lame({ d, dd, D, di, L, mu, Eh, nuh, Es, nus }) {
    const c = d / 2, b = D / 2, a = di / 2;
    const hf = (b * b + c * c) / (b * b - c * c);
    const sf = (c * c + a * a) / (c * c - a * a);
    const p = (dd / 2) / (c * ((hf + nuh) / Eh + (sf - nus) / Es));
    return { p, hub: p * hf, shaft: p * sf, F: mu * p * Math.PI * d * L, T: mu * p * Math.PI * d * d * L / 2 };
}

describe('press fit calculator', () => {
    it('matches the analytical same-material solid-shaft benchmark', () => {
        const { document, window } = setup();
        window.eval("materialDatabase['carbon-steel'].poissonRatio = 0.30; materialDatabase['carbon-steel'].youngsModulus = 200e9;");
        fill(document);
        window.calculatePressFit();

        const text = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(75.0, 3);
        expect(extractNumber(text, /hub bore hoop stress \(tensile\): ([\d.,]+) MPa/i)).toBeCloseTo(125.0, 3);
        expect(extractNumber(text, /Assembly Force: ([\d.,]+) kN/i)).toBeCloseTo(70.686, 3);
        expect(extractNumber(text, /Torque Capacity: ([\d.,]+) N·m/i)).toBeCloseTo(1767.146, 2);
        expect(text).toContain('compressive');
        expect(text).toContain('screening factor of safety');
    });

    it('converts inches, psi, and lbf·ft consistently', () => {
        const { document, window } = setup();
        fill(document, {
            interfaceDiameter: 50 / 25.4, diametralInterference: 0.05 / 25.4,
            hubOuterDiameter: 100 / 25.4, engagementLength: 50 / 25.4
        });
        setSelectValue(document, 'distanceUnit', 'in');
        setSelectValue(document, 'interferenceUnit', 'in');
        setSelectValue(document, 'stressUnit', 'psi');
        setSelectValue(document, 'forceUnit', 'lbf');
        setSelectValue(document, 'torqueUnit', 'lbf·ft');
        window.calculatePressFit();

        const e = lame({ d: 0.05, dd: 0.00005, D: 0.1, di: 0, L: 0.05, mu: 0.12, Eh: 200e9, nuh: 0.27, Es: 200e9, nus: 0.27 });
        const text = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(e.p / 6894.757, -1);
        expect(extractNumber(text, /Assembly Force: ([\d.,]+) lbf/i)).toBeCloseTo(e.F / 4.4482216152605, 0);
        expect(extractNumber(text, /Torque Capacity: ([\d.,]+) lbf·ft/i)).toBeCloseTo(e.T / 1.35581795, 1);
    });

    it('calculates a hollow shaft', () => {
        const { document, window } = setup();
        fill(document, { shaftBoreDiameter: 30 });
        window.calculatePressFit();

        const solid = lame({ d: 0.05, dd: 0.00005, D: 0.1, di: 0, L: 0.05, mu: 0.12, Eh: 200e9, nuh: 0.27, Es: 200e9, nus: 0.27 });
        const hollow = lame({ d: 0.05, dd: 0.00005, D: 0.1, di: 0.03, L: 0.05, mu: 0.12, Eh: 200e9, nuh: 0.27, Es: 200e9, nus: 0.27 });
        const p = extractLeadingNumber(getResultValueText(document));
        expect(p).toBeCloseTo(hollow.p / 1e6, 2);
        expect(p).toBeLessThan(solid.p / 1e6);
    });

    it('calculates dissimilar materials', () => {
        const { document, window } = setup();
        fill(document, { hubMaterial: 'aluminum', shaftMaterial: 'carbon-steel' });
        window.calculatePressFit();

        const e = lame({ d: 0.05, dd: 0.00005, D: 0.1, di: 0, L: 0.05, mu: 0.12, Eh: 68.9e9, nuh: 0.33, Es: 200e9, nus: 0.27 });
        const ref = window.eval("[getMaterialProperty('aluminum','youngsModulus'), getMaterialProperty('aluminum','poissonRatio')]");
        const e2 = lame({ d: 0.05, dd: 0.00005, D: 0.1, di: 0, L: 0.05, mu: 0.12, Eh: ref[0], nuh: ref[1], Es: 200e9, nus: 0.27 });
        expect(e.p).toBeGreaterThan(0);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(e2.p / 1e6, 2);
    });

    it('rejects an invalid hub outer diameter', () => {
        const { document, window } = setup();
        fill(document, { hubOuterDiameter: 50 });
        window.calculatePressFit();
        expect(getResultText(document)).toContain('Hub outer diameter must be greater');
    });

    it('rejects invalid shaft bore', () => {
        const { document, window } = setup();
        fill(document, { shaftBoreDiameter: 50 });
        window.calculatePressFit();
        expect(getResultText(document)).toContain('Shaft bore diameter must be less');
        fill(document, { shaftBoreDiameter: -1 });
        window.calculatePressFit();
        expect(getResultText(document)).toContain('cannot be negative');
    });

    it('rejects zero or negative interference', () => {
        const { document, window } = setup();
        fill(document, { diametralInterference: 0 });
        window.calculatePressFit();
        expect(getResultText(document)).toContain('Diametral interference must be greater');
        fill(document, { diametralInterference: -0.01 });
        window.calculatePressFit();
        expect(getResultText(document)).toContain('Diametral interference must be greater');
    });

    it('rejects invalid friction coefficient but accepts low friction', () => {
        const { document, window } = setup();
        fill(document, { frictionCoefficient: 0 });
        window.calculatePressFit();
        expect(getResultText(document)).toContain('Friction coefficient must be greater');
        fill(document, { frictionCoefficient: 0.01 });
        window.calculatePressFit();
        expect(getResultText(document)).toContain('Contact Pressure');
    });

    it('shows a clear error for missing material selection and missing properties', () => {
        const { document, window } = setup();
        fill(document);
        setSelectValue(document, 'hubMaterial', '');
        window.calculatePressFit();
        expect(getResultText(document)).toContain('valid hub material');

        fill(document);
        window.eval("delete materialDatabase['carbon-steel'].youngsModulus;");
        window.calculatePressFit();
        expect(getResultText(document)).toContain("Young's modulus");
    });

    it('is deterministic for the database carbon-steel worked example', () => {
        const { document, window } = setup();
        fill(document);
        window.calculatePressFit();

        const e = lame({ d: 0.05, dd: 0.00005, D: 0.1, di: 0, L: 0.05, mu: 0.12, Eh: 200e9, nuh: 0.27, Es: 200e9, nus: 0.27 });
        const text = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(75.0, 2);
        expect(extractNumber(text, /Assembly Force: ([\d.,]+) kN/i)).toBeCloseTo(e.F / 1000, 2);
        expect(extractNumber(text, /Torque Capacity: ([\d.,]+) N·m/i)).toBeCloseTo(e.T, 1);
        // F = 2T/d
        expect(e.F).toBeCloseTo(2 * e.T / 0.05, 6);
    });

    it('resets inputs and result', () => {
        const { document, window } = setup();
        fill(document);
        window.calculatePressFit();
        window.resetPressFitCalculator();
        expect(getResultText(document)).toBe('Ready to calculate.');
        expect(document.getElementById('frictionCoefficient').value).toBe('0.12');
    });
});
