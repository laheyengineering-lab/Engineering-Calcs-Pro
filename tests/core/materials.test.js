import { describe, it, expect, beforeEach } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

describe('engineering material database', () => {
    let window;

    beforeEach(() => {
        ({ window } = loadCore());
    });

    it('returns expected representative material properties', () => {
        expect(window.getMaterialProperty('carbon-steel', 'youngsModulus')).toBe(200e9);
        expect(window.getMaterialProperty('aluminum', 'shearModulus')).toBe(26e9);
        // Intentional data corrections (see docs/material-reference.md):
        // legacy 304 alpha 15.9e-6 was the 316 value; 304 is 17.2e-6 /C.
        expect(window.getMaterialProperty('stainless-steel', 'thermalExpansionCoefficient')).toBe(17.2e-6);
        // legacy A514 yield 1170 MPa is not an A514 value; specified minimum is 690 MPa (100 ksi).
        expect(window.getMaterial('high-strength-steel').yieldStrength).toBe(690e6);
    });

    it('provides valid positive properties for every registered material used by calculators', () => {
        const materials = window.getMaterialList();

        // The 10 legacy presets must remain; new presets extend the list.
        expect(materials).toEqual(expect.arrayContaining([
            'carbon-steel', 'stainless-steel', 'aluminum', 'copper', 'brass',
            'titanium', 'mild-steel', 'high-strength-steel', 'cast-iron', 'magnesium'
        ]));
        expect(materials.length).toBeGreaterThanOrEqual(18);

        // Properties are optional (omitted when unverified) but never zero/negative/NaN when present.
        const optional = ['density', 'youngsModulus', 'shearModulus', 'poissonRatio', 'thermalExpansionCoefficient',
            'tensileStrength', 'yieldStrength', 'elongationAtBreak', 'hardness', 'thermalConductivity'];
        materials.forEach((materialKey) => {
            const material = window.getMaterial(materialKey);
            expect(material.displayName).toBeTruthy();
            expect(material.youngsModulus).toBeGreaterThan(0);
            expect(material.density).toBeGreaterThan(0);
            optional.forEach((prop) => {
                if (prop in material) {
                    expect(Number.isFinite(material[prop])).toBe(true);
                    expect(material[prop]).toBeGreaterThan(0);
                }
            });
        });
    });

    it('formats material lists for UI dropdowns and returns null for missing properties', () => {
        const formatted = window.getMaterialListFormatted();

        expect(formatted).toContainEqual({ key: 'carbon-steel', displayName: 'Carbon Steel (ASTM A36)' });
        expect(window.getMaterial('missing-material')).toBeNull();
        expect(window.getMaterialProperty('carbon-steel', 'missingProperty')).toBeNull();
    });
});
