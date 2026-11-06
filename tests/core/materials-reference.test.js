import { describe, it, expect, beforeEach } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const NUMERIC = ['density', 'youngsModulus', 'shearModulus', 'poissonRatio', 'thermalExpansionCoefficient',
    'tensileStrength', 'yieldStrength', 'elongationAtBreak', 'hardness', 'thermalConductivity'];
const BASES = ['typical', 'nominal', 'specified-minimum', 'unverified'];
const LEGACY_KEYS = ['carbon-steel', 'stainless-steel', 'aluminum', 'copper', 'brass', 'titanium',
    'mild-steel', 'high-strength-steel', 'cast-iron', 'magnesium'];
const NEW_KEYS = ['aluminum-6061-o', 'aluminum-2024-t3', 'aluminum-7075-t6', 'stainless-316',
    'stainless-17-4ph-h900', 'steel-1018-cold-drawn', 'steel-4140-annealed', 'titanium-grade-5'];

// Reference values below come from the governing standards / datasheets, typed independently of the database.
// [key, property, expected SI value]
const SPECIFIED = [
    ['carbon-steel', 'yieldStrength', 250e6],            // ASTM A36 minimum yield
    ['carbon-steel', 'tensileStrength', 400e6],          // ASTM A36 minimum of 400-550 MPa
    ['high-strength-steel', 'yieldStrength', 690e6],     // ASTM A514 minimum, 100 ksi
    ['high-strength-steel', 'tensileStrength', 760e6],   // ASTM A514 range lower bound, 110 ksi
    ['stainless-316', 'tensileStrength', 515e6],         // ASTM A240 minimum
    ['stainless-316', 'yieldStrength', 205e6],           // ASTM A240 minimum
    ['titanium-grade-5', 'tensileStrength', 895e6],      // ASTM B265 minimum
    ['titanium-grade-5', 'yieldStrength', 828e6],        // ASTM B265 minimum
    ['titanium', 'yieldStrength', 275e6],                // ASTM B265 Grade 2 minimum
    ['stainless-17-4ph-h900', 'tensileStrength', 1310e6],// ASTM A564 H900 minimum, 190 ksi
    ['stainless-17-4ph-h900', 'yieldStrength', 1170e6],  // ASTM A564 H900 minimum, 170 ksi
    ['cast-iron', 'tensileStrength', 207e6],             // ASTM A48 Class 30 minimum, 30 ksi
    ['steel-4140-annealed', 'tensileStrength', 655e6],
    ['steel-4140-annealed', 'yieldStrength', 415e6],
    ['steel-1018-cold-drawn', 'tensileStrength', 440e6],
    ['steel-1018-cold-drawn', 'yieldStrength', 370e6]
];

describe('material database schema and metadata', () => {
    let window;
    let keys;

    beforeEach(() => {
        ({ window } = loadCore());
        keys = window.getMaterialList();
    });

    it('keeps every legacy key and adds the audited new presets', () => {
        expect(keys).toEqual(expect.arrayContaining([...LEGACY_KEYS, ...NEW_KEYS]));
        expect(keys.length).toBeGreaterThanOrEqual(18);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('stores only finite positive values in SI units and never zero placeholders', () => {
        keys.forEach((key) => {
            const material = window.getMaterial(key);
            NUMERIC.forEach((prop) => {
                if (prop in material) {
                    expect(Number.isFinite(material[prop]), `${key}.${prop}`).toBe(true);
                    expect(material[prop], `${key}.${prop}`).toBeGreaterThan(0);
                }
            });
            // Magnitudes expose unit mistakes (Pa vs MPa/GPa, 1/degC vs 1e-6/degC).
            expect(material.youngsModulus, key).toBeGreaterThan(1e9);
            expect(material.youngsModulus, key).toBeLessThan(1e12);
            expect(material.density, key).toBeGreaterThan(1000);
            expect(material.density, key).toBeLessThan(23000);
            if (material.thermalExpansionCoefficient) {
                expect(material.thermalExpansionCoefficient, key).toBeGreaterThan(1e-6);
                expect(material.thermalExpansionCoefficient, key).toBeLessThan(40e-6);
            }
            if (material.thermalConductivity) {
                expect(material.thermalConductivity, key).toBeGreaterThan(5);
                expect(material.thermalConductivity, key).toBeLessThan(500);
            }
            if (material.elongationAtBreak) {
                expect(material.elongationAtBreak, key).toBeLessThan(1);
            }
        });
    });

    it('has complete metadata with valid classifications and resolvable sources', () => {
        keys.forEach((key) => {
            const meta = window.getMaterialMetadata(key);
            expect(meta, key).toBeTruthy();
            ['family', 'designation', 'grade', 'condition', 'caveats'].forEach((field) => {
                expect(String(meta[field] || '').length, `${key}.${field}`).toBeGreaterThan(0);
            });
            expect(meta.referenceTemperatureC, key).toBeGreaterThan(-50);
            // The generic legacy mild-steel entry is the only one without a citable source.
            if (key !== 'mild-steel') {
                expect(meta.sources.length, key).toBeGreaterThan(0);
            }
            const resolved = window.getMaterialSources(key);
            expect(resolved.length, `${key} unresolved source id`).toBe(meta.sources.length);
            resolved.forEach((ref) => {
                expect(ref.title && ref.publisher, key).toBeTruthy();
                expect(ref.url || ref.identifier, key).toBeTruthy();
            });
            const material = window.getMaterial(key);
            const present = NUMERIC.filter((prop) => prop in material).sort();
            expect(Object.keys(meta.propertyBasis).sort(), key).toEqual(present);
            Object.values(meta.propertyBasis).forEach((basis) => expect(BASES).toContain(basis));
        });
    });

    it('is physically consistent: nu range, G ~ E/(2(1+nu)), yield below ultimate', () => {
        keys.forEach((key) => {
            const m = window.getMaterial(key);
            if (m.poissonRatio) {
                expect(m.poissonRatio, key).toBeGreaterThan(0.2);
                expect(m.poissonRatio, key).toBeLessThan(0.45);
            }
            if (m.poissonRatio && m.shearModulus) {
                const isotropicG = m.youngsModulus / (2 * (1 + m.poissonRatio));
                expect(Math.abs(m.shearModulus - isotropicG) / isotropicG, key).toBeLessThan(0.1);
            }
            if (m.yieldStrength && m.tensileStrength) {
                expect(m.yieldStrength, key).toBeLessThanOrEqual(m.tensileStrength);
            }
        });
    });

    it('matches independently established specification values', () => {
        SPECIFIED.forEach(([key, prop, expected]) => {
            expect(window.getMaterialProperty(key, prop), `${key}.${prop}`).toBeCloseTo(expected, -4);
        });
    });

    it('classifies specification minimums distinctly from typical values', () => {
        expect(window.getMaterialPropertyBasis('carbon-steel', 'yieldStrength')).toBe('specified-minimum');
        expect(window.getMaterialPropertyBasis('high-strength-steel', 'yieldStrength')).toBe('specified-minimum');
        expect(window.getMaterialPropertyBasis('aluminum', 'yieldStrength')).not.toBe('specified-minimum');
        expect(window.getMaterialPropertyBasis('mild-steel', 'yieldStrength')).toBe('unverified');
        expect(window.getMaterialPropertyBasis('carbon-steel', 'missingProperty')).toBeNull();
        expect(window.getMaterialPropertyBasis('missing-material', 'yieldStrength')).toBeNull();
    });

    it('omits properties that are not established instead of inventing them', () => {
        // Gray iron has no yield point; a generic yield must not be offered.
        expect(window.getMaterialProperty('cast-iron', 'yieldStrength')).toBeNull();
        expect(window.getMaterial('cast-iron')).not.toHaveProperty('yieldStrength');
        // Unverified-property omissions on new entries
        expect(window.getMaterialProperty('aluminum-6061-o', 'thermalExpansionCoefficient')).toBeNull();
        expect(window.getMaterialProperty('titanium-grade-5', 'shearModulus')).toBeNull();
        expect(window.getMaterialProperty('stainless-17-4ph-h900', 'thermalConductivity')).toBeNull();
        // Hardness removed where the legacy value contradicted the specification
        expect(window.getMaterialProperty('stainless-steel', 'hardness')).toBeNull();
        expect(window.getMaterialProperty('carbon-steel', 'hardness')).toBeNull();
    });

    it('uses specific grade and condition labels for condition-dependent materials', () => {
        const label = (key) => window.getMaterial(key).displayName;
        expect(label('aluminum-6061-o')).toMatch(/6061/);
        expect(label('aluminum-6061-o')).toMatch(/O/);
        expect(label('steel-4140-annealed')).toMatch(/annealed/i);
        expect(label('steel-1018-cold-drawn')).toMatch(/cold/i);
        expect(label('stainless-17-4ph-h900')).toMatch(/H900/);
        expect(window.getMaterialMetadata('steel-4140-annealed').condition).toMatch(/815/);
    });

    it('does not expand to unsupported polymer or unspecified conditions', () => {
        keys.forEach((key) => expect(window.getMaterialMetadata(key).family).not.toMatch(/polymer|plastic/i));
        ['steel-4140-qt', 'steel-1045-normalized', 'stainless-303', 'tool-steel-a2'].forEach((key) => {
            expect(window.getMaterial(key)).toBeNull();
        });
    });
});

describe('material lookup, grouping and conversion helpers', () => {
    let window;

    beforeEach(() => {
        ({ window } = loadCore());
    });

    it('groups materials by family without losing or duplicating any key', () => {
        const groups = window.getMaterialListGrouped();
        const grouped = groups.flatMap((group) => group.materials.map((m) => m.key));
        expect(grouped.slice().sort()).toEqual(window.getMaterialList().slice().sort());
        expect(groups.map((g) => g.family)).toContain('Aluminum alloy');
        groups.forEach((g) => g.materials.forEach((m) => expect(m.displayName).toBeTruthy()));
    });

    it('resolves sources and returns null for unknown materials', () => {
        expect(window.getMaterialSources('carbon-steel').length).toBeGreaterThan(0);
        expect(window.getMaterialSources('missing-material')).toEqual([]);
        expect(window.getMaterialMetadata('missing-material')).toBeNull();
    });

    it('keeps getMaterialListFormatted a plain {key, displayName} list', () => {
        window.getMaterialListFormatted().forEach((entry) => {
            expect(Object.keys(entry).sort()).toEqual(['displayName', 'key']);
        });
    });

    it('converts stored SI stress properties to common display units', () => {
        const sy = window.getMaterialProperty('carbon-steel', 'yieldStrength');
        expect(window.convertStressToUnit(sy, 'MPa')).toBeCloseTo(250, 9);
        expect(window.convertStressToUnit(sy, 'ksi')).toBeCloseTo(36.26, 2); // 250 MPa = 36.26 ksi
        expect(window.convertStressToUnit(window.getMaterialProperty('high-strength-steel', 'yieldStrength'), 'ksi')).toBeCloseTo(100.08, 1);
        expect(window.convertMaterialProperty(250, 'MPa', 'stress')).toBeCloseTo(250e6, 0);
    });
});
