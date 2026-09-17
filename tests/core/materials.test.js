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
        expect(window.getMaterialProperty('stainless-steel', 'thermalExpansionCoefficient')).toBe(15.9e-6);
        expect(window.getMaterial('high-strength-steel').yieldStrength).toBe(1170e6);
    });

    it('provides valid positive properties for every registered material used by calculators', () => {
        const materials = window.getMaterialList();

        expect(materials.length).toBe(10);

        materials.forEach((materialKey) => {
            const material = window.getMaterial(materialKey);
            expect(material.displayName).toBeTruthy();
            expect(material.youngsModulus).toBeGreaterThan(0);
            expect(material.shearModulus).toBeGreaterThan(0);
            expect(material.thermalExpansionCoefficient).toBeGreaterThan(0);
            expect(material.tensileStrength).toBeGreaterThan(0);
            expect(material.yieldStrength).toBeGreaterThan(0);
        });
    });

    it('formats material lists for UI dropdowns and returns null for missing properties', () => {
        const formatted = window.getMaterialListFormatted();

        expect(formatted).toContainEqual({ key: 'carbon-steel', displayName: 'Carbon Steel (ASTM A36)' });
        expect(window.getMaterial('missing-material')).toBeNull();
        expect(window.getMaterialProperty('carbon-steel', 'missingProperty')).toBeNull();
    });
});
