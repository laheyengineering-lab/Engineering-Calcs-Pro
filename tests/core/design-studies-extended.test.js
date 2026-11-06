import { describe, it, expect } from 'vitest';
import { loadCore, loadCalculatorPage, getResultText, getResultValueText, extractLeadingNumber, extractNumber, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

const scripts = [
    'js/engineering-units.js', 'js/calculator-utils.js',
    'js/press-fit-calculation.js', 'js/hertzian-contact-calculation.js', 'js/shaft-torsion-calculation.js',
    'js/bolt-torque-calculation.js', 'js/moment-calculation.js', 'js/bearing-life-calculation.js', 'js/column-buckling-calculation.js',
    'js/factor-of-safety-calculation.js', 'js/fillet-weld-calculation.js', 'js/spring-calculation.js', 'js/stress-strain-calculation.js',
    'js/thermal-expansion-calculation.js', 'js/thick-walled-cylinder-calculation.js', 'js/thread-strength-calculation.js',
    'js/beam-section-properties.js', 'js/beam-study-calculations.js', 'js/cylinder-force.js', 'js/differential-thermal-expansion.js',
    'js/report-builder.js', 'js/design-study-core.js', 'js/design-study-adapters.js'
];

const NEW_IDS = [
    'bolt-torque', 'moment', 'bearing-life', 'column-buckling', 'factor-of-safety', 'fillet-weld',
    'spring-calculations', 'stress-strain', 'thermal-expansion', 'thick-walled-cylinder', 'thread-strength'
];

function setup() {
    const { window } = loadCore(scripts);
    return { S: window.FormulaFoundryStudies, report: window.FormulaFoundryReport };
}

function memoryStorage() {
    const data = {};
    return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

function calc(S, id, inputs, units, name = 'Scenario') {
    const adapter = S.getAdapter(id);
    return S.calculateScenario(adapter, S.createScenario(adapter, name, inputs, units));
}
const out = (scenario, id) => scenario.result.outputs.find((o) => o.id === id);
const value = (scenario, id) => out(scenario, id).value;

// ---------- Independent hand-calculated reference inputs ----------
const BOLT = { nominalDiameter: 10, clampLoad: 20, nutFactor: 0.2 }; // T = 0.2 * 0.010 m * 20 000 N = 40 N·m
const BEARING = { bearingType: 'ball', dynamicLoadRating: 30, equivalentLoad: 10, speed: 1500 }; // 3^3 = 27 Mrev, 27e6/(60*1500) = 300 h
const COLUMN = { sectionType: 'solid', material: 'carbon-steel', length: 1000, outerDiameter: 20, boundaryCondition: 'pinned-pinned' };
// I = pi*0.02^4/64 = 7.85398e-9 m4; Pcr = pi^2 * 200e9 * I / 1^2 = 15.503 kN
const WELD = { weldLeg: 6, weldLength: 100, electrode: 'E70XX', loadDirection: '0', designMethod: 'LRFD' };
// F_EXX = 70 ksi = 482.633 MPa; Fnw = 289.580 MPa; Aw = 0.707*6*100 = 424.2 mm2; Rn = 122.84 kN
const SPRING = { wireDiameter: 2, meanDiameter: 20, activeCoils: 10, force: 100, material: 'carbon-steel' };
// C = 10, k = 80e9*(0.002)^4 / (8*0.02^3*10) = 2000 N/m, delta = 50 mm, Kw = 39/36 + 0.0615 = 1.144833, tau = 728.8 MPa
const THICK = { innerDiameter: 100, outerDiameter: 200, internalPressure: 10, externalPressure: 0, endCondition: 'closed' };
// a = 50 mm, b = 100 mm: inner hoop 16.667, inner radial -10, outer hoop 6.667, axial 3.333 MPa
const THREAD = {
    majorDiameter: 10, threadPitch: 1.5, tensileStressArea: 58, engagementLength: 10, appliedLoad: 20, boltStrength: 800, internalStrength: 400
}; // capacity 46.4 kN, strip area 170.05 mm2, strip capacity 39.248 kN

describe('extended Design Studies registry', () => {
    it('registers all eleven additional calculators with stable ids, versions and paths', () => {
        const { S } = setup();
        const materialRevisionTwo = new Set([
            'column-buckling', 'factor-of-safety', 'spring-calculations',
            'stress-strain', 'thermal-expansion', 'thread-strength'
        ]);
        NEW_IDS.forEach((id) => {
            const adapter = S.getAdapter(id);
            expect(adapter, id).not.toBeNull();
            expect(adapter.version).toBe(materialRevisionTwo.has(id) ? '2' : '1');
            expect(adapter.path).toBe('calculators/' + id + '.html');
            expect(adapter.equations.length).toBeGreaterThan(0);
            expect(adapter.assumptions.length).toBeGreaterThan(0);
            expect(adapter.warnings.length).toBeGreaterThan(0);
            expect(adapter.method.length).toBeGreaterThan(10);
        });
        expect(S.listAdapters()).toHaveLength(18);
    });

    it('never makes categorical inputs sweepable', () => {
        const { S } = setup();
        NEW_IDS.forEach((id) => {
            S.getAdapter(id).inputs.filter((input) => input.options).forEach((input) => expect(input.sweepable, id + '.' + input.id).toBe(false));
        });
    });
});

describe('bolt torque adapter', () => {
    it('matches the hand-calculated T = K·D·F', () => {
        const { S } = setup();
        const s = calc(S, 'bolt-torque', BOLT);
        expect(s.status).toBe('calculated');
        expect(value(s, 'torque')).toBeCloseTo(40, 9);
        expect(out(s, 'torque')).toMatchObject({ unit: 'N·m', quantity: 'torque' });
    });

    it('converts alternate units (0.5 in, 1000 lbf, K = 0.2 -> 100 lbf·in)', () => {
        const { S } = setup();
        const s = calc(S, 'bolt-torque', { nominalDiameter: 0.5, clampLoad: 1000, nutFactor: 0.2 }, { diameter: 'in', force: 'lbf', torque: 'lbf·in' });
        expect(value(s, 'torque')).toBeCloseTo(100, 6);
    });

    it('reports invalid input as an error', () => {
        const { S } = setup();
        expect(calc(S, 'bolt-torque', { ...BOLT, nutFactor: 0 }).status).toBe('error');
        expect(calc(S, 'bolt-torque', { ...BOLT, clampLoad: null }).status).toBe('error');
    });

    it('states that nut factor and clamp load are assumptions', () => {
        const { S } = setup();
        const adapter = S.getAdapter('bolt-torque');
        expect(adapter.inputs.find((i) => i.id === 'nutFactor').label).toMatch(/assumed/i);
        expect(adapter.inputs.find((i) => i.id === 'clampLoad').label).toMatch(/assumed/i);
        expect(adapter.assumptions.join(' ')).toMatch(/not predictions/);
    });
});

describe('moment adapter', () => {
    it('keeps the sign of the force', () => {
        const { S } = setup();
        expect(value(calc(S, 'moment', { force: -500, distance: 0.3 }, { distance: 'm' }), 'moment')).toBeCloseTo(-150, 9);
        expect(value(calc(S, 'moment', { force: 2, distance: 250 }, { force: 'kN', distance: 'mm' }), 'moment')).toBeCloseTo(500, 9);
    });

    it('supports imperial units and rejects zero force or distance', () => {
        const { S } = setup();
        const s = calc(S, 'moment', { force: 100, distance: 2 }, { force: 'lbf', distance: 'ft', moment: 'lbf·ft' });
        expect(value(s, 'moment')).toBeCloseTo(200, 6);
        expect(calc(S, 'moment', { force: 0, distance: 1 }).status).toBe('error');
        expect(calc(S, 'moment', { force: 10, distance: 0 }).status).toBe('error');
    });
});

describe('bearing life adapter', () => {
    it('matches ball-bearing hand calculations with life clearly split into revolutions and hours', () => {
        const { S } = setup();
        const s = calc(S, 'bearing-life', BEARING);
        expect(value(s, 'exponent')).toBe(3);
        expect(value(s, 'loadRatio')).toBeCloseTo(1 / 3, 12);
        expect(value(s, 'lifeMillionRevolutions')).toBeCloseTo(27, 9);
        expect(value(s, 'lifeRevolutions')).toBeCloseTo(27e6, 3);
        expect(value(s, 'lifeHours')).toBeCloseTo(300, 9);
        expect(out(s, 'lifeMillionRevolutions').unit).toBe('million rev');
        expect(out(s, 'lifeRevolutions').unit).toBe('rev');
        expect(out(s, 'lifeHours')).toMatchObject({ unit: 'h', quantity: 'time' });
        expect(S.getAdapter('bearing-life').warnings.join(' ')).toMatch(/not a prediction of actual service life/);
        const slower = calc(S, 'bearing-life', { ...BEARING, speed: 750 });
        const comparison = S.compareScenarios([s, slower], s.id);
        expect(comparison.outputRows.find((row) => row.id === 'lifeHours').cells[1].percent.value).toBeCloseTo(100, 9);
    });

    it('uses the roller exponent 10/3 and converts rps and lbf', () => {
        const { S } = setup();
        const s = calc(S, 'bearing-life', { ...BEARING, bearingType: 'roller', speed: 25 }, { speed: 'rps' });
        expect(value(s, 'exponent')).toBeCloseTo(10 / 3, 12);
        expect(value(s, 'lifeMillionRevolutions')).toBeCloseTo(38.9407, 3); // 3^3 * 3^(1/3)
        expect(value(s, 'lifeHours')).toBeCloseTo(38.9407e6 / 90000, 2);
        const lbf = calc(S, 'bearing-life', { ...BEARING, dynamicLoadRating: 30000 / 4.4482216152605, equivalentLoad: 10000 / 4.4482216152605 }, { rating: 'lbf', load: 'lbf' });
        expect(value(lbf, 'lifeMillionRevolutions')).toBeCloseTo(27, 6);
    });

    it('requires an explicit bearing type and positive values', () => {
        const { S } = setup();
        expect(calc(S, 'bearing-life', { ...BEARING, bearingType: null }).status).toBe('error');
        expect(calc(S, 'bearing-life', { ...BEARING, speed: 0 }).status).toBe('error');
    });
});

describe('column buckling adapter', () => {
    it('matches Euler hand calculations for every end condition', () => {
        const { S } = setup();
        const base = calc(S, 'column-buckling', COLUMN);
        expect(value(base, 'inertia')).toBeCloseTo(7853.98, 1); // mm4
        expect(value(base, 'kFactor')).toBe(1);
        expect(value(base, 'effectiveLength')).toBeCloseTo(1000, 9);
        expect(value(base, 'criticalLoad')).toBeCloseTo(15.5031, 3);
        const expected = { 'fixed-free': [2, 15.5031 / 4], 'fixed-pinned': [0.699, 15.5031 / 0.699 ** 2], 'fixed-fixed': [0.5, 15.5031 * 4] };
        Object.entries(expected).forEach(([boundaryCondition, [k, pcr]]) => {
            const s = calc(S, 'column-buckling', { ...COLUMN, boundaryCondition });
            expect(value(s, 'kFactor')).toBe(k);
            expect(value(s, 'effectiveLength')).toBeCloseTo(1000 * k, 6);
            expect(value(s, 'criticalLoad')).toBeCloseTo(pcr, 2);
        });
    });

    it('handles hollow sections, ignores inner diameter for solid and rejects invalid geometry', () => {
        const { S } = setup();
        const hollow = calc(S, 'column-buckling', { ...COLUMN, sectionType: 'hollow', innerDiameter: 10 });
        expect(value(hollow, 'inertia')).toBeCloseTo(7363.11, 1); // pi*(20^4 - 10^4)/64
        expect(value(hollow, 'criticalLoad')).toBeCloseTo(14.5342, 3);
        expect(value(calc(S, 'column-buckling', { ...COLUMN, innerDiameter: 500 }), 'criticalLoad')).toBeCloseTo(15.5031, 3);
        expect(calc(S, 'column-buckling', { ...COLUMN, sectionType: 'hollow', innerDiameter: 20 }).status).toBe('error');
        expect(calc(S, 'column-buckling', { ...COLUMN, sectionType: 'hollow' }).status).toBe('error');
        expect(calc(S, 'column-buckling', { ...COLUMN, boundaryCondition: null }).status).toBe('error');
        expect(calc(S, 'column-buckling', { ...COLUMN, material: null }).status).toBe('error');
    });

    it('uses material presets and alternate units', () => {
        const { S } = setup();
        const aluminum = calc(S, 'column-buckling', { ...COLUMN, material: 'aluminum' });
        expect(value(aluminum, 'criticalLoad')).toBeCloseTo(15.5031 * 68.9 / 200, 3);
        const imperial = calc(S, 'column-buckling', { ...COLUMN, length: 1000 / 25.4, outerDiameter: 20 / 25.4 }, { distance: 'in', force: 'lbf', inertia: 'in⁴', effectiveLength: 'in' });
        expect(value(imperial, 'criticalLoad')).toBeCloseTo(15503.1 / 4.4482216152605, 0);
        expect(value(imperial, 'effectiveLength')).toBeCloseTo(1000 / 25.4, 6);
    });
});

describe('factor of safety adapter', () => {
    it('keeps stress-based and load-based definitions distinct', () => {
        const { S } = setup();
        const stress = calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'direct', strength: 250, appliedStress: 100 }, { stress: 'MPa' });
        expect(value(stress, 'stressFactor')).toBeCloseTo(2.5, 12);
        expect(out(stress, 'stressFactor').quantity).toBe('factor-of-safety-stress');
        expect(out(stress, 'loadFactor')).toBeUndefined();
        const load = calc(S, 'factor-of-safety', { mode: 'load', failureLoad: 50, appliedLoad: 20 });
        expect(value(load, 'loadFactor')).toBeCloseTo(2.5, 12);
        expect(out(load, 'loadFactor').quantity).toBe('factor-of-safety-load');
        expect(out(load, 'stressFactor')).toBeUndefined();
    });

    it('reads yield or tensile strength from material presets and preserves unit conversion', () => {
        const { S } = setup();
        const yielded = calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'material-yield', material: 'carbon-steel', appliedStress: 125 }, { stress: 'MPa' });
        // A36 specified-minimum yield corrected from legacy 170 MPa to 250 MPa
        expect(value(yielded, 'stressFactor')).toBeCloseTo(2, 12);
        expect(value(yielded, 'strengthUsed')).toBeCloseTo(250, 9);
        const tensile = calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'material-tensile', material: 'carbon-steel', appliedStress: 160 });
        expect(value(tensile, 'stressFactor')).toBeCloseTo(2.5, 12);
        const psi = calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'direct', strength: 36259.43, appliedStress: 14503.77 }, { stress: 'psi' });
        expect(value(psi, 'stressFactor')).toBeCloseTo(2.5, 4);
    });

    it('rejects missing definitions, material data and non-positive demand', () => {
        const { S } = setup();
        expect(calc(S, 'factor-of-safety', { strength: 1, appliedStress: 1 }).status).toBe('error');
        expect(calc(S, 'factor-of-safety', { mode: 'stress', appliedStress: 1 }).status).toBe('error');
        expect(calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'material-yield', appliedStress: 1 }).status).toBe('error');
        expect(calc(S, 'factor-of-safety', { mode: 'load', failureLoad: 10, appliedLoad: 0 }).status).toBe('error');
    });

    it('does not compare different definitions or strength sources', () => {
        const { S } = setup();
        const a = calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'direct', strength: 250, appliedStress: 100 });
        const b = calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'direct', strength: 250, appliedStress: 125 });
        const load = calc(S, 'factor-of-safety', { mode: 'load', failureLoad: 50, appliedLoad: 20 });
        const yielded = calc(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'material-yield', material: 'carbon-steel', appliedStress: 85 });
        expect(S.compareScenarios([a, b], a.id).ok).toBe(true);
        expect(S.compareScenarios([a, load], a.id)).toMatchObject({ ok: false, error: expect.stringMatching(/incompatible calculation models/) });
        expect(S.compareScenarios([a, yielded], a.id).ok).toBe(false);
        const adapter = S.getAdapter('factor-of-safety');
        expect(adapter.equationsFor({ mode: 'load' })).toHaveLength(1);
        expect(adapter.equationsFor({})).toEqual([]);
    });
});

describe('fillet weld adapter', () => {
    it('matches AISC J2 hand calculations for a longitudinal weld with LRFD and ASD', () => {
        const { S } = setup();
        const s = calc(S, 'fillet-weld', WELD);
        expect(value(s, 'throat')).toBeCloseTo(4.242, 3);
        expect(value(s, 'area')).toBeCloseTo(424.2, 1);
        expect(value(s, 'fexx')).toBeCloseTo(482.633, 2);
        expect(value(s, 'nominalStress')).toBeCloseTo(289.58, 2);
        expect(value(s, 'nominalStrength')).toBeCloseTo(122.84, 1);
        expect(value(s, 'lrfdStrength')).toBeCloseTo(92.13, 1);
        expect(value(s, 'asdStrength')).toBeCloseTo(61.42, 1);
        expect(value(s, 'designCapacity')).toBeCloseTo(92.13, 1);
        expect(out(s, 'requiredLeg')).toBeUndefined();
        const asd = calc(S, 'fillet-weld', { ...WELD, designMethod: 'ASD' });
        expect(value(asd, 'designCapacity')).toBeCloseTo(61.42, 1);
    });

    it('applies the 90° directional strength increase and other electrodes', () => {
        const { S } = setup();
        const transverse = calc(S, 'fillet-weld', { ...WELD, loadDirection: '90' });
        expect(value(transverse, 'nominalStress')).toBeCloseTo(289.58 * 1.5, 2);
        const e60 = calc(S, 'fillet-weld', { ...WELD, electrode: 'E60XX' });
        expect(value(e60, 'fexx')).toBeCloseTo(413.685, 2);
    });

    it('evaluates the optional applied load, required leg size and alternate units', () => {
        const { S } = setup();
        const s = calc(S, 'fillet-weld', { ...WELD, appliedLoad: 60 });
        expect(value(s, 'utilization')).toBeCloseTo(60 / 92.13, 3);
        expect(value(s, 'requiredLeg')).toBeCloseTo(3.9075, 3);
        expect(value(s, 'remainingCapacity')).toBeCloseTo(32.13, 1);
        const inch = calc(S, 'fillet-weld', { ...WELD, weldLeg: 6 / 25.4, weldLength: 100 / 25.4 }, { leg: 'in', length: 'in', force: 'lbf', area: 'in²' });
        expect(value(inch, 'designCapacity')).toBeCloseTo(92130 / 4.4482216152605, -1);
    });

    it('rejects unsupported configurations and keeps methods incomparable', () => {
        const { S } = setup();
        expect(calc(S, 'fillet-weld', { ...WELD, weldLeg: 0 }).status).toBe('error');
        expect(calc(S, 'fillet-weld', { ...WELD, electrode: null }).status).toBe('error');
        expect(calc(S, 'fillet-weld', { ...WELD, loadDirection: null }).status).toBe('error');
        expect(calc(S, 'fillet-weld', { ...WELD, designMethod: null }).status).toBe('error');
        const lrfd = calc(S, 'fillet-weld', WELD);
        const asd = calc(S, 'fillet-weld', { ...WELD, designMethod: 'ASD' });
        expect(S.compareScenarios([lrfd, asd], lrfd.id).ok).toBe(false);
        const bigger = calc(S, 'fillet-weld', { ...WELD, weldLeg: 8 });
        expect(S.compareScenarios([lrfd, bigger], lrfd.id).ok).toBe(true);
    });
});

describe('helical spring adapter', () => {
    it('matches hand-calculated rate, deflection, Wahl factor and shear stress', () => {
        const { S } = setup();
        const s = calc(S, 'spring-calculations', SPRING);
        expect(value(s, 'rate')).toBeCloseTo(1.9825, 9); // N/mm, G = 79.3 GPa
        expect(out(s, 'rate').unit).toBe('N/mm');
        expect(value(s, 'index')).toBeCloseTo(10, 12);
        expect(value(s, 'deflection')).toBeCloseTo(100 / 1.9825, 9);
        expect(value(s, 'wahlFactor')).toBeCloseTo(1.144833, 6);
        expect(value(s, 'shearStress')).toBeCloseTo(728.82, 1);
    });

    it('converts spring-rate units and lets an entered modulus override the material', () => {
        const { S } = setup();
        const lbf = calc(S, 'spring-calculations', SPRING, { rate: 'lbf/in' });
        expect(value(lbf, 'rate')).toBeCloseTo(1982.5 * 0.0254 / 4.4482216152605, 4);
        const kn = calc(S, 'spring-calculations', SPRING, { rate: 'kN/m' });
        expect(value(kn, 'rate')).toBeCloseTo(1.9825, 9);
        const override = calc(S, 'spring-calculations', { ...SPRING, shearModulus: 40 }, { modulus: 'GPa' });
        expect(value(override, 'rate')).toBeCloseTo(1, 9);
    });

    it('rejects invalid geometry', () => {
        const { S } = setup();
        expect(calc(S, 'spring-calculations', { ...SPRING, meanDiameter: 2 }).status).toBe('error');
        expect(calc(S, 'spring-calculations', { ...SPRING, activeCoils: 0 }).status).toBe('error');
        expect(calc(S, 'spring-calculations', { ...SPRING, material: null }).status).toBe('error');
        expect(calc(S, 'spring-calculations', { ...SPRING, force: -1 }).status).toBe('error');
        expect(value(calc(S, 'spring-calculations', { ...SPRING, force: 0 }), 'deflection')).toBe(0);
    });
});

describe('stress and strain adapter', () => {
    const base = { mode: 'stress', force: 10, area: 100 };
    const units = { force: 'kN' };

    it('solves each mode and reports only that mode’s physical quantity', () => {
        const { S } = setup();
        const stress = calc(S, 'stress-strain', base, units);
        expect(value(stress, 'stress')).toBeCloseTo(100, 9);
        expect(stress.result.outputs.map((o) => o.id)).toEqual(['stress']);
        const strain = calc(S, 'stress-strain', { mode: 'strain', deltaLength: 0.5, originalLength: 500 });
        expect(value(strain, 'strain')).toBeCloseTo(0.001, 12);
        expect(strain.result.outputs.map((o) => o.id)).toEqual(['strain']);
        const modulus = calc(S, 'stress-strain', { mode: 'youngsModulus', force: 10, area: 100, strain: 0.0005 }, units);
        expect(value(modulus, 'modulus')).toBeCloseTo(200, 9);
        expect(modulus.result.outputs.map((o) => o.id)).toEqual(['stress', 'modulus']);
        const elongation = calc(S, 'stress-strain', { mode: 'deformation', force: 10, area: 100, originalLength: 1000, material: 'carbon-steel' }, units);
        expect(value(elongation, 'elongation')).toBeCloseTo(0.5, 9);
        expect(out(elongation, 'elongation').quantity).toBe('length-change');
    });

    it('lets an entered modulus override the material and converts units', () => {
        const { S } = setup();
        const entered = calc(S, 'stress-strain', { mode: 'deformation', force: 10, area: 100, originalLength: 1000, material: 'aluminum', youngsModulus: 200 }, units);
        expect(value(entered, 'elongation')).toBeCloseTo(0.5, 9);
        const al = calc(S, 'stress-strain', { mode: 'deformation', force: 10, area: 100, originalLength: 1000, material: 'aluminum' }, units);
        expect(value(al, 'elongation')).toBeCloseTo(0.5 * 200 / 68.9, 6);
        const imperial = calc(S, 'stress-strain', { mode: 'stress', force: 1000, area: 1 }, { force: 'lbf', area: 'in²', stress: 'psi' });
        expect(value(imperial, 'stress')).toBeCloseTo(1000, 2);
    });

    it('rejects missing mode-specific inputs and zero values', () => {
        const { S } = setup();
        expect(calc(S, 'stress-strain', { force: 1, area: 1 }).status).toBe('error');
        expect(calc(S, 'stress-strain', { mode: 'stress', force: 10 }).status).toBe('error');
        expect(calc(S, 'stress-strain', { mode: 'strain', deltaLength: 1 }).status).toBe('error');
        expect(calc(S, 'stress-strain', { mode: 'youngsModulus', force: 10, area: 100, strain: 0 }).status).toBe('error');
        expect(calc(S, 'stress-strain', { mode: 'deformation', force: 10, area: 100, originalLength: 10 }).status).toBe('error');
    });

    it('refuses to compare scenarios solving for different quantities', () => {
        const { S } = setup();
        const stress = calc(S, 'stress-strain', base, units);
        const stress2 = calc(S, 'stress-strain', { ...base, force: 20 }, units);
        const strain = calc(S, 'stress-strain', { mode: 'strain', deltaLength: 0.5, originalLength: 500 });
        expect(S.compareScenarios([stress, stress2], stress.id).ok).toBe(true);
        expect(S.compareScenarios([stress, strain], stress.id).ok).toBe(false);
        expect(S.getAdapter('stress-strain').equationsFor({ mode: 'strain' })[0]).toMatch(/varepsilon/);
        expect(S.getAdapter('stress-strain').equationsFor({})).toEqual([]);
    });
});

describe('thermal expansion adapter', () => {
    const free = { condition: 'free', material: 'carbon-steel', originalLength: 2000, temperatureChange: 50 };

    it('matches hand calculations for free and fully restrained conditions', () => {
        const { S } = setup();
        const f = calc(S, 'thermal-expansion', free);
        expect(value(f, 'expansion')).toBeCloseTo(1.17, 9); // A36 alpha corrected from 12.0 to 11.7 um/m/C
        expect(value(f, 'finalLength')).toBeCloseTo(2001.17, 9);
        expect(value(f, 'thermalStrain')).toBeCloseTo(5.85e-4, 12);
        expect(out(f, 'restrainedStress')).toBeUndefined();
        const r = calc(S, 'thermal-expansion', { ...free, condition: 'restrained' });
        expect(value(r, 'restrainedStress')).toBeCloseTo(-117, 9);
        expect(out(r, 'restrainedStress').quantity).toBe('restrained-thermal-stress');
        expect(S.getAdapter('thermal-expansion').equationsFor({ condition: 'restrained' })).toHaveLength(2);
        expect(S.getAdapter('thermal-expansion').equationsFor({ condition: 'restrained' }).at(-1)).toMatch(/= -E/);
    });

    it('handles temperature intervals, coefficient units, entered values and cooling', () => {
        const { S } = setup();
        const fahrenheit = calc(S, 'thermal-expansion', { ...free, temperatureChange: 90 }, { temperature: '°F' });
        expect(value(fahrenheit, 'expansion')).toBeCloseTo(1.17, 9);
        const kelvin = calc(S, 'thermal-expansion', { ...free, material: null, alpha: 12e-6, temperatureChange: 50 }, { alpha: '1/K', temperature: 'K', outputLength: 'm' });
        expect(value(kelvin, 'expansion')).toBeCloseTo(0.0012, 12);
        const cooling = calc(S, 'thermal-expansion', { ...free, condition: 'restrained', temperatureChange: -50 });
        expect(value(cooling, 'restrainedStress')).toBeCloseTo(117, 9);
        const entered = calc(S, 'thermal-expansion', { ...free, condition: 'restrained', youngsModulus: 100 }, { modulus: 'GPa' });
        expect(value(entered, 'restrainedStress')).toBeCloseTo(-58.5, 9);
        const aluminum = calc(S, 'thermal-expansion', { ...free, material: 'aluminum' });
        expect(value(aluminum, 'expansion')).toBeCloseTo(23.6e-6 * 2000 * 50, 6);
    });

    it('requires a modulus for restrained stress, ignores it for free expansion and blocks mixed comparison', () => {
        const { S } = setup();
        expect(calc(S, 'thermal-expansion', { ...free, condition: 'restrained', material: null, alpha: 12e-6 }).status).toBe('error');
        expect(calc(S, 'thermal-expansion', { ...free, material: null, alpha: 12e-6 }).status).toBe('calculated');
        expect(calc(S, 'thermal-expansion', { ...free, condition: null }).status).toBe('error');
        expect(calc(S, 'thermal-expansion', { ...free, originalLength: 0 }).status).toBe('error');
        const a = calc(S, 'thermal-expansion', free);
        const b = calc(S, 'thermal-expansion', { ...free, temperatureChange: 80 });
        const r = calc(S, 'thermal-expansion', { ...free, condition: 'restrained' });
        expect(S.compareScenarios([a, b], a.id).ok).toBe(true);
        expect(S.compareScenarios([a, r], a.id).ok).toBe(false);
    });
});

describe('thick-walled cylinder adapter', () => {
    it('matches Lamé hand calculations for closed and open ends', () => {
        const { S } = setup();
        const closed = calc(S, 'thick-walled-cylinder', THICK);
        expect(value(closed, 'innerRadial')).toBeCloseTo(-10, 9);
        expect(value(closed, 'innerHoop')).toBeCloseTo(16.6667, 3);
        expect(value(closed, 'midRadial')).toBeCloseTo(-2.5926, 3);
        expect(value(closed, 'midHoop')).toBeCloseTo(9.2593, 3);
        expect(value(closed, 'outerRadial')).toBeCloseTo(0, 9);
        expect(value(closed, 'outerHoop')).toBeCloseTo(6.6667, 3);
        expect(value(closed, 'axialStress')).toBeCloseTo(3.3333, 3);
        expect(value(closed, 'governingHoop')).toBeCloseTo(16.6667, 3);
        const open = calc(S, 'thick-walled-cylinder', { ...THICK, endCondition: 'open' });
        expect(value(open, 'axialStress')).toBe(0);
        expect(value(open, 'innerHoop')).toBeCloseTo(16.6667, 3);
    });

    it('supports external pressure (compressive governing hoop) and alternate units', () => {
        const { S } = setup();
        const external = calc(S, 'thick-walled-cylinder', { ...THICK, internalPressure: 0, externalPressure: 100 });
        expect(value(external, 'innerHoop')).toBeCloseTo(-266.6667, 3);
        expect(value(external, 'governingHoop')).toBeCloseTo(-266.6667, 3);
        expect(value(external, 'axialStress')).toBeCloseTo(-133.3333, 3);
        const imperial = calc(S, 'thick-walled-cylinder', { ...THICK, innerDiameter: 100 / 25.4, outerDiameter: 200 / 25.4, internalPressure: 10 * 145.0377377 }, { distance: 'in', pressure: 'psi', stress: 'psi' });
        expect(value(imperial, 'innerHoop')).toBeCloseTo(16.6667 * 145.0377377, 1);
    });

    it('rejects invalid geometry, negative pressure and missing end condition', () => {
        const { S } = setup();
        expect(calc(S, 'thick-walled-cylinder', { ...THICK, outerDiameter: 100 }).status).toBe('error');
        expect(calc(S, 'thick-walled-cylinder', { ...THICK, innerDiameter: 0 }).status).toBe('error');
        expect(calc(S, 'thick-walled-cylinder', { ...THICK, internalPressure: -1 }).status).toBe('error');
        expect(calc(S, 'thick-walled-cylinder', { ...THICK, endCondition: null }).status).toBe('error');
    });

    it('retains the end condition in saved scenarios and blocks closed/open comparisons', () => {
        const { S } = setup();
        const closed = calc(S, 'thick-walled-cylinder', THICK);
        const open = calc(S, 'thick-walled-cylinder', { ...THICK, endCondition: 'open' });
        expect(closed.result.inputs.find((i) => i.id === 'endCondition').value).toBe('closed');
        expect(S.compareScenarios([closed, open], closed.id).ok).toBe(false);
        const more = calc(S, 'thick-walled-cylinder', { ...THICK, internalPressure: 20 });
        expect(S.compareScenarios([closed, more], closed.id).ok).toBe(true);
    });
});

describe('thread strength adapter', () => {
    it('keeps fastener tension and internal-thread stripping as separate hand-calculated modes', () => {
        const { S } = setup();
        const s = calc(S, 'thread-strength', THREAD);
        expect(value(s, 'fastenerCapacity')).toBeCloseTo(46.4, 6);
        expect(value(s, 'appliedStress')).toBeCloseTo(344.83, 1);
        expect(value(s, 'fastenerUtilization')).toBeCloseTo(43.1, 1);
        expect(value(s, 'internalShearArea')).toBeCloseTo(170.05, 1);
        expect(value(s, 'strippingCapacity')).toBeCloseTo(39.248, 2);
        expect(value(s, 'strippingUtilization')).toBeCloseTo(50.96, 1);
        expect(value(s, 'governingCapacity')).toBeCloseTo(39.248, 2);
        expect(out(s, 'fastenerUtilization').unit).toBe('%');
    });

    it('skips the stripping check without an internal-thread strength and uses material presets', () => {
        const { S } = setup();
        const noInternal = calc(S, 'thread-strength', { ...THREAD, internalStrength: null });
        expect(out(noInternal, 'strippingCapacity')).toBeUndefined();
        expect(value(noInternal, 'governingCapacity')).toBeCloseTo(46.4, 6);
        const material = calc(S, 'thread-strength', { ...THREAD, boltStrength: null, boltMaterial: 'high-strength-steel', internalStrength: null, internalMaterial: 'aluminum' });
        expect(value(material, 'fastenerCapacity')).toBeCloseTo(58e-6 * 760e6 / 1000, 6);
        expect(value(material, 'strippingCapacity')).toBeCloseTo(0.577 * 310e6 * 0.5413 * Math.PI * 100e-6 / 1000, 4);
    });

    it('converts TPI pitch and imperial units and rejects invalid geometry', () => {
        const { S } = setup();
        const tpi = calc(S, 'thread-strength', { ...THREAD, threadPitch: 16.9333 }, { pitch: 'TPI' });
        expect(tpi.status).toBe('calculated');
        expect(calc(S, 'thread-strength', { ...THREAD, threadPitch: 12 }).status).toBe('error');
        expect(calc(S, 'thread-strength', { ...THREAD, threadPitch: 1 }, { pitch: 'TPI' }).status).toBe('error');
        expect(calc(S, 'thread-strength', { ...THREAD, engagementLength: 0 }).status).toBe('error');
        const imperial = calc(S, 'thread-strength', {
            majorDiameter: 10 / 25.4, threadPitch: 1.5 / 25.4, tensileStressArea: 58 * 0.0015500031, engagementLength: 10 / 25.4,
            appliedLoad: 20000 / 4.4482216152605, boltStrength: 800 * 145.0377377, internalStrength: 400 * 145.0377377
        }, { distance: 'in', pitch: 'in', area: 'in²', force: 'lbf', strength: 'psi' });
        expect(value(imperial, 'fastenerCapacity') * 4.4482216152605).toBeCloseTo(46400, -1);
        expect(value(imperial, 'fastenerUtilization')).toBeCloseTo(43.1, 1);
    });
});

describe('page and Design Studies parity', () => {
    const base = ['js/engineering-units.js', 'js/calculator-utils.js'];

    it('bearing life: page and adapter agree', () => {
        const { S } = setup();
        const { document, window } = loadCalculatorPage('calculators/bearing-life.html', [...base, 'js/bearing-life-calculation.js', 'js/bearing-life.js']);
        setSelectValue(document, 'bearingType', 'roller');
        setInputValue(document, 'dynamicLoadRating', 42);
        setInputValue(document, 'equivalentDynamicLoad', 11);
        setInputValue(document, 'speed', 900);
        window.calculateBearingLife();
        const pageLife = extractLeadingNumber(getResultValueText(document));
        const s = calc(S, 'bearing-life', { bearingType: 'roller', dynamicLoadRating: 42, equivalentLoad: 11, speed: 900 });
        expect(value(s, 'lifeMillionRevolutions')).toBeCloseTo(pageLife, 2);
    });

    it('column buckling: page and adapter agree for hollow fixed-pinned', () => {
        const { S } = setup();
        const { document, window } = loadCalculatorPage('calculators/column-buckling.html', [...base, 'js/column-buckling-calculation.js', 'js/column-buckling.js']);
        setSelectValue(document, 'sectionType', 'hollow');
        setSelectValue(document, 'material', 'stainless-steel');
        setInputValue(document, 'length', 2.5);
        setInputValue(document, 'outerDiameter', 60);
        setInputValue(document, 'innerDiameter', 45);
        setSelectValue(document, 'lengthUnit', 'm');
        setSelectValue(document, 'outerDiameterUnit', 'mm');
        setSelectValue(document, 'innerDiameterUnit', 'mm');
        setSelectValue(document, 'boundaryCondition', 'fixed-pinned');
        setSelectValue(document, 'forceUnit', 'kN');
        window.calculateColumnBuckling();
        const pageLoad = extractLeadingNumber(getResultValueText(document));
        const s = calc(S, 'column-buckling', { sectionType: 'hollow', material: 'stainless-steel', length: 2500, outerDiameter: 60, innerDiameter: 45, boundaryCondition: 'fixed-pinned' });
        expect(value(s, 'criticalLoad')).toBeCloseTo(pageLoad, 2);
    });

    it('thread strength: page and adapter agree', () => {
        const { S } = setup();
        const { document, window } = loadCalculatorPage('calculators/thread-strength.html', [...base, 'js/thread-strength-calculation.js', 'js/thread-strength.js']);
        const values = { majorDiameter: 10, threadPitch: 1.5, tensileStressArea: 61.2, engagementLength: 15, appliedLoad: 10, boltStrength: 400, internalStrength: 400 };
        Object.entries(values).forEach(([id, v]) => setInputValue(document, id, v));
        ['distanceUnit:mm', 'pitchUnit:mm', 'areaUnit:mm²', 'forceUnit:kN', 'strengthUnit:MPa'].forEach((pair) => setSelectValue(document, ...pair.split(':')));
        window.calculateThreadStrength();
        const text = getResultText(document);
        const s = calc(S, 'thread-strength', values);
        expect(value(s, 'fastenerCapacity')).toBeCloseTo(extractNumber(text, /Fastener Tensile Capacity: ([\d.,]+) kN/), 2);
        expect(value(s, 'strippingCapacity')).toBeCloseTo(extractNumber(text, /Internal-Thread Stripping Capacity: ([\d.,]+) kN/), 2);
        expect(value(s, 'internalShearArea')).toBeCloseTo(extractNumber(text, /Approximate Internal-Thread Shear Area: ([\d.,]+) mm²/), 2);
        expect(value(s, 'fastenerUtilization')).toBeCloseTo(extractNumber(text, /Fastener Utilization: ([\d.,]+)%/), 1);
    });

    it('thermal expansion, moment and bolt torque: pages and adapters agree', () => {
        const { S } = setup();
        const thermal = loadCalculatorPage('calculators/thermal-expansion.html', [...base, 'js/thermal-expansion-calculation.js', 'js/thermal-expansion.js']);
        setInputValue(thermal.document, 'alpha', 12e-6);
        setInputValue(thermal.document, 'originalLength', 2);
        setInputValue(thermal.document, 'temperatureChange', 50);
        setInputValue(thermal.document, 'youngsModulus', 200);
        setSelectValue(thermal.document, 'lengthUnit', 'm');
        setSelectValue(thermal.document, 'modulusUnit', 'GPa');
        setSelectValue(thermal.document, 'outputLengthUnit', 'mm');
        setSelectValue(thermal.document, 'stressUnit', 'MPa');
        thermal.window.calculateThermalExpansion();
        const t = calc(S, 'thermal-expansion', { condition: 'restrained', alpha: 12e-6, originalLength: 2, temperatureChange: 50, youngsModulus: 200 }, { length: 'm', modulus: 'GPa' });
        expect(value(t, 'expansion')).toBeCloseTo(extractLeadingNumber(getResultValueText(thermal.document)), 6);
        expect(value(t, 'restrainedStress')).toBeCloseTo(-120, 9);
        expect(getResultText(thermal.document)).toContain('120 MPa');

        const moment = loadCalculatorPage('calculators/moment.html', ['js/engineering-units.js', 'js/moment-calculation.js', 'js/moment.js']);
        setInputValue(moment.document, 'force', 100);
        setInputValue(moment.document, 'distance', 25);
        setSelectValue(moment.document, 'forceUnit', 'N');
        setSelectValue(moment.document, 'distanceUnit', 'mm');
        setSelectValue(moment.document, 'momentUnit', 'N·mm');
        moment.window.calculateMoment();
        const m = calc(S, 'moment', { force: 100, distance: 25 }, { distance: 'mm', moment: 'N·mm' });
        expect(value(m, 'moment')).toBeCloseTo(extractLeadingNumber(getResultValueText(moment.document)), 6);

        const bolt = loadCalculatorPage('calculators/bolt-torque.html', ['js/engineering-units.js', 'js/bolt-database.js', 'js/bolt-torque-calculation.js', 'js/bolt-torque.js']);
        setSelectValue(bolt.document, 'unitSystem', 'metric');
        bolt.window.updateBoltCalculator();
        setSelectValue(bolt.document, 'boltSize', '10');
        setInputValue(bolt.document, 'clampLoad', 50);
        setInputValue(bolt.document, 'nutFactor', 0.2);
        setSelectValue(bolt.document, 'loadUnit', 'kN');
        setSelectValue(bolt.document, 'torqueUnit', 'N·m');
        bolt.window.calculateBoltTorque();
        const b = calc(S, 'bolt-torque', { nominalDiameter: 10, clampLoad: 50, nutFactor: 0.2 }, { force: 'kN' });
        expect(value(b, 'torque')).toBeCloseTo(extractLeadingNumber(getResultValueText(bolt.document)), 6);
    });
});

describe('parametric sweeps on the new adapters', () => {
    function sweep(S, id, inputs, options, units) {
        const adapter = S.getAdapter(id);
        const scenario = calc(S, id, inputs, units);
        return { adapter, scenario, result: S.runSweep(adapter, scenario, { mode: 'step', ...options }) };
    }

    it('sweeps numeric inputs and matches hand calculations', () => {
        const { S } = setup();
        const bolt = sweep(S, 'bolt-torque', BOLT, { inputId: 'clampLoad', outputId: 'torque', start: 10, end: 30, step: 10 }).result.sweep;
        expect(bolt.points.map((p) => p.y)).toEqual([20, 40, 60].map((v) => expect.closeTo(v, 9)));
        const column = sweep(S, 'column-buckling', COLUMN, { inputId: 'length', outputId: 'criticalLoad', start: 500, end: 1000, step: 500 }).result.sweep;
        expect(column.points[0].y).toBeCloseTo(15.5031 * 4, 2);
        expect(column.points[1].y).toBeCloseTo(15.5031, 3);
        const bearing = sweep(S, 'bearing-life', BEARING, { inputId: 'equivalentLoad', outputId: 'lifeHours', start: 10, end: 30, step: 20 }).result.sweep;
        expect(bearing.points[1].y).toBeCloseTo(300 / 27, 6);
        const fos = sweep(S, 'factor-of-safety', { mode: 'stress', strengthSource: 'direct', strength: 250, appliedStress: 100 }, { inputId: 'appliedStress', outputId: 'stressFactor', start: 50, end: 250, step: 100 }).result.sweep;
        expect(fos.points.map((p) => p.y)).toEqual([5, 5 / 3, 1].map((v) => expect.closeTo(v, 9)));
    });

    it('preserves failed samples as gaps rather than interpolating', () => {
        const { S } = setup();
        const hollow = sweep(S, 'column-buckling', { ...COLUMN, sectionType: 'hollow', innerDiameter: 10 }, { inputId: 'innerDiameter', outputId: 'criticalLoad', start: 10, end: 30, step: 10 }).result.sweep;
        expect(hollow.failedCount).toBe(2);
        expect(hollow.points[0].y).not.toBeNull();
        expect(hollow.points[1]).toMatchObject({ y: null, error: expect.stringMatching(/Inner diameter/) });
        const thick = sweep(S, 'thick-walled-cylinder', THICK, { inputId: 'outerDiameter', outputId: 'innerHoop', start: 80, end: 120, step: 20 }).result.sweep;
        expect(thick.points.map((p) => p.y === null)).toEqual([true, true, false]);
        expect(thick.baseInputs.find((i) => i.id === 'endCondition').value).toBe('closed');
        const thread = sweep(S, 'thread-strength', THREAD, { inputId: 'threadPitch', outputId: 'fastenerCapacity', start: 10, end: 14, step: 2 }).result.sweep;
        expect(thread.failedCount).toBe(3);
        const spring = sweep(S, 'spring-calculations', SPRING, { inputId: 'meanDiameter', outputId: 'rate', start: 2, end: 20, step: 9 }).result.sweep;
        expect(spring.points.map((p) => p.y === null)).toEqual([true, false, false]);
    });

    it('keeps the selected mode, boundary and definition in each sweep and rejects categorical sweeps', () => {
        const { S } = setup();
        const thermal = sweep(S, 'thermal-expansion', { condition: 'restrained', material: 'carbon-steel', originalLength: 2000, temperatureChange: 50 }, { inputId: 'temperatureChange', outputId: 'restrainedStress', start: 0, end: 100, step: 50 }).result.sweep;
        expect(thermal.points.map((p) => p.y)).toEqual([0, -117, -234].map((v) => expect.closeTo(v, 9)));
        expect(thermal.baseInputs.find((i) => i.id === 'condition').value).toBe('restrained');
        const weld = sweep(S, 'fillet-weld', { ...WELD, designMethod: 'ASD' }, { inputId: 'weldLeg', outputId: 'designCapacity', start: 4, end: 8, step: 2 }).result.sweep;
        expect(weld.baseInputs.find((i) => i.id === 'designMethod').value).toBe('ASD');
        expect(weld.points[0].y).toBeCloseTo(61.42 * 4 / 6, 1);
        const strain = sweep(S, 'stress-strain', { mode: 'stress', force: 10, area: 100 }, { inputId: 'force', outputId: 'stress', start: 10, end: 30, step: 10 }, { force: 'kN' }).result.sweep;
        expect(strain.points.map((p) => p.y)).toEqual([100, 200, 300].map((v) => expect.closeTo(v, 9)));
        const bad = S.runSweep(S.getAdapter('thick-walled-cylinder'), calc(S, 'thick-walled-cylinder', THICK), { inputId: 'endCondition', outputId: 'innerHoop', start: 1, end: 2, mode: 'step', step: 1 });
        expect(bad.ok).toBe(false);
    });
});

describe('report snapshots for the new adapters', () => {
    const SCENARIOS = {
        'bolt-torque': [BOLT, 'torque'],
        moment: [{ force: 100, distance: 0.5 }, 'moment'],
        'bearing-life': [BEARING, 'lifeHours'],
        'column-buckling': [COLUMN, 'criticalLoad'],
        'factor-of-safety': [{ mode: 'load', failureLoad: 50, appliedLoad: 20 }, 'loadFactor'],
        'fillet-weld': [WELD, 'designCapacity'],
        'spring-calculations': [SPRING, 'rate'],
        'stress-strain': [{ mode: 'stress', force: 10, area: 100 }, 'stress'],
        'thermal-expansion': [{ condition: 'free', material: 'carbon-steel', originalLength: 2000, temperatureChange: 50 }, 'expansion'],
        'thick-walled-cylinder': [THICK, 'innerHoop'],
        'thread-strength': [THREAD, 'fastenerCapacity']
    };

    it('stores scenario, comparison and sweep snapshots with units, equations and assumptions', () => {
        const { S, report } = setup();
        Object.entries(SCENARIOS).forEach(([id, [inputs, outputId]]) => {
            const adapter = S.getAdapter(id);
            const a = calc(S, id, inputs, undefined, 'Baseline');
            expect(a.status, id + ': ' + a.error).toBe('calculated');
            const study = S.addScenario(S.createStudy('Study ' + id, id), a);
            const store = report.createProjectStore(memoryStorage());
            const single = S.scenarioReportSnapshot(study, study.scenarios[0]);
            expect(single.ok, id).toBe(true);
            const entry = store.addEntry(single.snapshot).entry;
            expect(entry.study).toMatchObject({ kind: 'scenario', scenarios: ['Baseline'] });
            expect(entry.outputs.length).toBeGreaterThan(0);
            expect(entry.equations.length).toBeGreaterThan(0);
            expect(entry.assumptions.length).toBeGreaterThan(0);
            expect(entry.path).toBe('design-studies.html');

            const numericInput = adapter.inputs.find((i) => i.sweepable && Number.isFinite(a.inputs[i.id]) && a.inputs[i.id] > 0);
            const sweepResult = S.runSweep(adapter, a, { inputId: numericInput.id, outputId, start: a.inputs[numericInput.id], end: a.inputs[numericInput.id] * 2, mode: 'count', count: 3 });
            expect(sweepResult.ok, id + ': ' + sweepResult.error).toBe(true);
            const built = S.sweepReportSnapshot(study, sweepResult.sweep);
            expect(built.ok, id).toBe(true);
            expect(store.addEntry(built.snapshot).entry.study.kind).toBe('sweep');
        });
    });

    it('retains categorical selections in the stored scenario snapshot and compares compatible scenarios in reports', () => {
        const { S, report } = setup();
        const closed = calc(S, 'thick-walled-cylinder', THICK, undefined, 'Closed');
        const study = S.addScenario(S.createStudy('Vessel', 'thick-walled-cylinder'), closed);
        const entry = report.createProjectStore(memoryStorage()).addEntry(S.scenarioReportSnapshot(study, study.scenarios[0]).snapshot).entry;
        expect(JSON.stringify(entry.inputs)).toContain('closed');

        const a = calc(S, 'thermal-expansion', { condition: 'free', material: 'carbon-steel', originalLength: 2000, temperatureChange: 50 }, undefined, 'A');
        const b = calc(S, 'thermal-expansion', { condition: 'free', material: 'aluminum', originalLength: 2000, temperatureChange: 50 }, undefined, 'B');
        const thermalStudy = S.addScenario(S.addScenario(S.createStudy('Thermal', 'thermal-expansion'), a), b);
        const cmp = S.comparisonReportSnapshot(thermalStudy, [a, b], a.id);
        expect(cmp.ok).toBe(true);
        const restrained = calc(S, 'thermal-expansion', { condition: 'restrained', material: 'carbon-steel', originalLength: 2000, temperatureChange: 50 }, undefined, 'R');
        expect(S.comparisonReportSnapshot(S.addScenario(thermalStudy, restrained), [a, restrained], a.id).ok).toBe(false);
    });
});
