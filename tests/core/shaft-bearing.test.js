import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

let model, beam;
beforeAll(() => {
    const context = createContext({ window: {} });
    for (const script of ['beam-section-properties', 'beam-study-calculations', 'shaft-torsion-calculation',
        'factor-of-safety-calculation', 'bearing-life-calculation', 'shaft-bearing-core']) {
        runInContext(readFileSync('js/' + script + '.js', 'utf8'), context, { filename: script });
    }
    model = context.window.FormulaFoundryShaftBearing;
    beam = context.window.FormulaFoundryBeamCalculations;
});

const area = Math.PI * 0.05 ** 2 / 4;
const inertia = Math.PI * 0.05 ** 4 / 64;
const stiffness = 200e9 * inertia;
const S = inertia / 0.025;

function load(position, fy, fz = 0, id = 'load') {
    return { id, name: id, position, fy, fz, notes: '' };
}
function setup(overrides = {}) {
    return {
        span: 1, section: 'solid', outerDiameter: 0.05, innerDiameter: 0,
        material: { youngModulus: 200e9, shearModulus: 80e9, yieldStrength: 300e6, density: 7850 },
        speed: 600,
        torque: { value: 0, start: 0, end: 1 },
        loads: [load(0.5, -1000)],
        bearings: {
            a: { type: 'ball', dynamicRating: 2500, staticRating: 2000, targetHours: 10000 },
            b: { type: 'roller', dynamicRating: 4000, staticRating: null, targetHours: null }
        },
        ...overrides
    };
}
function solve(overrides) {
    const result = model.calculate(setup(overrides));
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    return result;
}
function sample(result, x, side = 'right') {
    return result.samples.find(sample => sample.x === x && sample.side === side);
}
function expectEquilibrium(result) {
    for (const residual of Object.values(result.equilibrium)) expect(residual).toBeCloseTo(0, 10);
}

describe('shaft statics and Euler–Bernoulli bending', () => {
    it('matches the known center-loaded simply supported case and the existing selected-case engine', () => {
        const result = solve();
        expect(result.reactions).toEqual({
            a: { fy: 500, fz: 0, resultant: 500 },
            b: { fy: 500, fz: 0, resultant: 500 }
        });
        expectEquilibrium(result);
        expect(result.geometry.area).toBeCloseTo(area, 14);
        expect(result.geometry.inertia).toBeCloseTo(inertia, 16);
        expect(result.geometry.polarMoment).toBeCloseTo(2 * inertia, 16);
        expect(result.geometry.sectionModulus).toBeCloseTo(S, 14);
        expect(result.geometry.mass).toBeCloseTo(7850 * area, 12);
        expect(result.geometry.stiffness).toBeCloseTo(stiffness, 10);
        expect(result.bending.maximum.x).toBe(0.5);
        expect(result.bending.maximum.resultant).toBe(250);
        expect(result.bending.maximum.bendingStress / (250 / S)).toBeCloseTo(1, 13);
        expect(result.combined.maximum.torsionalStress).toBe(0);
        expect(result.combined.maximum.equivalentStress / (250 / S)).toBeCloseTo(1, 13);
        expect(result.combined.yieldRatio).toBeCloseTo(300e6 / (250 / S), 13);
        const published = beam.computeDeflection({
            caseId: 'ss-point', spanM: 1, modulusPa: 200e9, inertiaM4: inertia, loadSI: -1000
        });
        const expectedDeflection = -1000 / (48 * stiffness);
        expect(result.deflection.maximum.x).toBeCloseTo(0.5, 12);
        expect(result.deflection.maximum.y).toBeCloseTo(expectedDeflection, 15);
        expect(result.deflection.maximum.y).toBeCloseTo(published.maxDeflectionM, 15);
        expect(result.deflection.stations[0].y).toBeCloseTo(expectedDeflection, 15);
        expect(result.deflection.slopes.a.y).toBeCloseTo(-1000 / (16 * stiffness), 14);
        expect(result.deflection.slopes.b.y).toBeCloseTo(1000 / (16 * stiffness), 14);
        expect(sample(result, 0).deflectionY).toBe(0);
        expect(sample(result, 1, 'left').deflectionY).toBe(0);
        expect(sample(result, 0.5, 'left').shearY).toBe(500);
        expect(sample(result, 0.5).shearY).toBe(-500);
        expect(sample(result, 0.5, 'left').momentY).toBe(sample(result, 0.5).momentY);
        expect(sample(result, 0, 'left').shearY).toBe(0);
        expect(sample(result, 1).shearY).toBe(0);
    });

    it('locates an asymmetric single-load deflection extremum away from the applied load', () => {
        const a = 0.2;
        const b = 0.8;
        const P = 1200;
        const result = solve({ loads: [load(a, P)] });
        expect(result.reactions.a.fy).toBe(-960);
        expect(result.reactions.b.fy).toBe(-240);
        expect(result.bending.maximum.x).toBe(a);
        expect(result.bending.maximum.momentY).toBeCloseTo(-192, 12);
        expect(result.deflection.stations[0].y).toBeCloseTo(P * a ** 2 * b ** 2 / (3 * stiffness), 15);
        // The right-hand branch has zero slope at L-x = sqrt((L²-a²)/3).
        const distanceFromB = Math.sqrt((1 - a ** 2) / 3);
        const expectedX = 1 - distanceFromB;
        const expectedY = P * a * distanceFromB * (1 - a ** 2 - distanceFromB ** 2) / (6 * stiffness);
        expect(result.deflection.maximum.x).toBeCloseTo(expectedX, 12);
        expect(result.deflection.maximum.y).toBeCloseTo(expectedY, 15);
        expect(sample(result, result.deflection.maximum.x).deflectionResultant).toBeCloseTo(expectedY, 15);
        expectEquilibrium(result);
    });

    it('handles nonproportional forces in two planes against independent integrated polynomials', () => {
        const loads = [load(0.2, -1200, 0, 'A'), load(0.55, 0, 1000, 'B'), load(0.8, 600, -350, 'C')];
        const result = solve({ loads });
        expect(result.reactions.a.fy).toBeCloseTo(840, 11);
        expect(result.reactions.a.fz).toBeCloseTo(-380, 11);
        expect(result.reactions.b.fy).toBeCloseTo(-240, 11);
        expect(result.reactions.b.fz).toBeCloseTo(-270, 11);
        expect(result.reactions.a.resultant).toBeCloseTo(Math.sqrt(840 ** 2 + 380 ** 2), 11);
        expect(result.reactions.b.resultant).toBeCloseTo(Math.sqrt(240 ** 2 + 270 ** 2), 11);
        expect(result.bending.maximum.x).toBe(0.55);
        expect(result.bending.maximum.momentY).toBeCloseTo(42, 12);
        expect(result.bending.maximum.momentZ).toBeCloseTo(-209, 12);
        expect(result.bending.maximum.resultant).toBeCloseTo(Math.sqrt(42 ** 2 + 209 ** 2), 11);
        expect(sample(result, 0.55, 'left').shearZ).toBeCloseTo(-380, 11);
        expect(sample(result, 0.55).shearZ).toBeCloseTo(620, 11);

        // Independent integration of M(x) with continuity and zero endpoint displacement:
        // on [0.2, 0.55], EI y = -60x³ + 120x² - 312x/5 + 8/5,
        // EI z = -190x³/3 + 3889x/80. Roots of yy'+zz' were solved in
        // SymPy for each interval and checked against their endpoints.
        expect(result.deflection.maximum.x).toBeCloseTo(0.478745225261775, 12);
        expect(result.deflection.maximum.y).toBeCloseTo(-0.000119846368447531, 15);
        expect(result.deflection.maximum.z).toBeCloseTo(0.000266033772151729, 15);
        expect(result.deflection.maximum.resultant).toBeCloseTo(0.000291782658763915, 15);
        expectEquilibrium(result);

        const individual = loads.map(station => solve({ loads: [station] }));
        const station = 0.4;
        for (const component of ['shearY', 'shearZ', 'momentY', 'momentZ', 'deflectionY', 'deflectionZ']) {
            const sum = individual.reduce((total, model) => total + sample(model, station)[component], 0);
            expect(sample(result, station)[component]).toBeCloseTo(sum, 12);
        }
    });

    it('adds coincident loads and carries loads applied at the bearings directly to the supports', () => {
        const split = solve({ loads: [load(0.5, -900, 300, 'one'), load(0.5, -100, -300, 'two'), load(0, 40, 20, 'three'), load(1, -60, 100, 'four')] });
        const single = solve();
        expect(split.reactions).toEqual({
            a: { fy: 460, fz: -20, resultant: Math.hypot(460, 20) },
            b: { fy: 560, fz: -100, resultant: Math.hypot(560, 100) }
        });
        expect(split.bending.maximum).toEqual(single.bending.maximum);
        expect(split.deflection.maximum).toEqual(single.deflection.maximum);
        expect(split.samples.filter(point => point.x === 0.5)).toHaveLength(2);
        expect(sample(split, 0).shearY).toBe(500);
        expect(sample(split, 1, 'left').shearY).toBe(-500);
        expectEquilibrium(split);
    });
});

describe('torque and bearing life', () => {
    it('uses the correct hollow section and preserves signed torque and input-minus-output twist', () => {
        const diameter = 0.1;
        const bore = 0.06;
        const polar = Math.PI * (diameter ** 4 - bore ** 4) / 32;
        const result = solve({
            section: 'hollow', outerDiameter: diameter, innerDiameter: bore, loads: [],
            torque: { value: -250, start: 0, end: 1 }
        });
        expect(result.geometry.area).toBeCloseTo(Math.PI * (diameter ** 2 - bore ** 2) / 4, 14);
        expect(result.geometry.inertia).toBeCloseTo(polar / 2, 16);
        expect(result.geometry.polarMoment).toBeCloseTo(polar, 16);
        expect(result.geometry.sectionModulus).toBeCloseTo(polar / diameter, 14);
        expect(result.bending.maximum.resultant).toBe(0);
        expect(result.combined.maximum.x).toBe(0);
        expect(result.combined.maximum.side).toBe('right');
        const tau = 250 * diameter / 2 / polar;
        expect(result.torque.shearStress / tau).toBeCloseTo(1, 13);
        expect(result.combined.maximum.equivalentStress / (Math.sqrt(3) * tau)).toBeCloseTo(1, 13);
        expect(result.torque.twist).toBeCloseTo(-250 / (80e9 * polar), 15);
        expect(sample(result, 0, 'left').torque).toBe(0);
        expect(sample(result, 0).torque).toBe(-250);
        expect(sample(result, 1, 'left').torque).toBe(-250);
        expect(sample(result, 1).torque).toBe(0);
        expect(result.deflection.maximum.resultant).toBe(0);
    });

    it('evaluates localized torque and bending on the same physical side of the critical station', () => {
        const result = solve({ torque: { value: 300, start: 0.1, end: 0.2 } });
        expect(result.bending.maximum.x).toBe(0.5);
        expect(result.combined.maximum.x).toBe(0.2);
        expect(result.combined.maximum.side).toBe('left');
        expect(result.combined.maximum.bendingStress / (100 / S)).toBeCloseTo(1, 13);
        expect(result.combined.maximum.torsionalStress / (150 / S)).toBeCloseTo(1, 13);
        expect(result.combined.maximum.equivalentStress / (Math.sqrt(100 ** 2 + 3 * 150 ** 2) / S)).toBeCloseTo(1, 13);
        expect(sample(result, 0.1, 'left').torque).toBe(0);
        expect(sample(result, 0.1).torque).toBe(300);
        expect(sample(result, 0.2, 'left').torque).toBe(300);
        expect(sample(result, 0.2).torque).toBe(0);
        expect(sample(result, 0.5).torsionalStress).toBe(0);
        expect(result.torque.twist).toBeCloseTo(300 * 0.1 / (80e9 * 2 * inertia), 15);
    });

    it('calculates independent ball and roller basic rating life and required C', () => {
        const { bearings } = solve();
        expect(bearings.a.lifeMillionRevolutions).toBe(125);
        expect(bearings.a.lifeHours).toBeCloseTo(125e6 / 36000, 10);
        expect(bearings.a.requiredDynamicRating).toBeCloseTo(500 * Math.cbrt(360), 10);
        expect(bearings.a.staticRatio).toBe(4);
        // C/P chosen as 8 so (C/P)^(10/3) is exactly 1024 mathematically.
        expect(bearings.b.lifeMillionRevolutions).toBeCloseTo(1024, 10);
        expect(bearings.b.lifeHours).toBeCloseTo(1024e6 / 36000, 9);
        expect(bearings.b.requiredDynamicRating).toBeNull();
        expect(bearings.b.staticRatio).toBeNull();
    });

    it('treats an unloaded bearing and a loaded stationary bearing explicitly', () => {
        const result = solve({ loads: [load(1, -800)], speed: 0 });
        expect(result.bearings.a).toMatchObject({
            radialLoad: 0, status: 'unloaded', lifeMillionRevolutions: null, lifeHours: null,
            requiredDynamicRating: null, staticRatio: null
        });
        expect(result.bearings.b).toMatchObject({ radialLoad: 800, status: 'stopped', lifeHours: null, requiredDynamicRating: null });
        expect(result.bearings.b.lifeMillionRevolutions).toBeCloseTo(5 ** (10 / 3), 11);
        expect(result.combined.yieldRatio).toBeNull();
        expect(result.warnings.join(' ')).toMatch(/zero modeled radial load.*zero shaft speed/);
    });
});

describe('shaft analysis limits and sensitivity', () => {
    it.each([
        [{ span: 0 }, 'span'],
        [{ outerDiameter: Infinity }, 'outerDiameter'],
        [{ section: 'hollow', innerDiameter: 0.05 }, 'innerDiameter'],
        [{ section: 'hollow', innerDiameter: 0 }, 'innerDiameter'],
        [{ material: { shearModulus: -1 } }, 'material.shearModulus'],
        [{ speed: -1 }, 'speed'],
        [{ loads: [load(-0.1, 10)] }, 'loads.0.position'],
        [{ loads: [load(1 + 1e-8, 10)] }, 'loads.0.position'],
        [{ loads: Array.from({ length: 9 }, () => load(0.5, 1)) }, 'loads'],
        [{ torque: { value: 100, start: 0.25, end: 0.25 } }, 'torque.end'],
        [{ torque: { value: 100, start: 0.25, end: 1.1 } }, 'torque.end'],
        [{ bearings: { a: { type: 'ball', dynamicRating: 0 } } }, 'bearings.a.dynamicRating']
    ])('rejects invalid physical inputs (%j)', (overrides, field) => {
        const result = model.calculate(setup(overrides));
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field })]));
    });

    it('preserves independent calculations when modulus, yield strength or density are unavailable', () => {
        const torque = { value: 100, start: 0.25, end: 0.75 };
        const full = solve({ torque });
        const missing = solve({ material: { youngModulus: null, shearModulus: null, yieldStrength: null, density: null }, torque });
        expect(missing.geometry.mass).toBeNull();
        expect(missing.geometry.stiffness).toBeNull();
        expect(missing.combined.yieldRatio).toBeNull();
        expect(missing.torque.twist).toBeNull();
        expect(missing.deflection.maximum).toBeNull();
        expect(missing.deflection.slopes).toBeNull();
        expect(missing.samples.every(point => point.deflectionResultant === null)).toBe(true);
        expect(missing.torque.shearStress).toBe(full.torque.shearStress);
        expect(missing.combined.maximum).toEqual(full.combined.maximum);
        expect(missing.reactions).toEqual(full.reactions);
        expect(missing.bearings).toEqual(full.bearings);
        expect(solve({ material: {} }).torque.twist).toBe(0);
    });

    it('scales stress, stiffness, deflection, twist and mass with fixed external loading', () => {
        const inputs = setup({ torque: { value: 100, start: 0, end: 1 } });
        const hoop = model.runSweep(inputs, { start: 0.05, end: 0.1, count: 2 });
        expect(hoop.ok).toBe(true);
        const [small, large] = hoop.samples;
        expect(small.equivalentStress / large.equivalentStress).toBeCloseTo(8, 12);
        expect(small.bendingStress / large.bendingStress).toBeCloseTo(8, 12);
        expect(large.stiffness / small.stiffness).toBeCloseTo(16, 12);
        expect(small.displacement / large.displacement).toBeCloseTo(16, 12);
        expect(small.twist / large.twist).toBeCloseTo(16, 12);
        expect(large.mass / small.mass).toBeCloseTo(4, 12);
        expect([large.reactionA, large.reactionB]).toEqual([small.reactionA, small.reactionB]);
        expect(inputs.outerDiameter).toBe(0.05);

        const hollow = setup({ section: 'hollow', innerDiameter: 0.04 });
        const stepped = model.runSweep(hollow, { start: 0.05, end: 0.1, count: 3 });
        expect(stepped.ok).toBe(true);
        expect(stepped.samples[2].mass).toBeCloseTo(7850 * Math.PI * (0.1 ** 2 - 0.04 ** 2) / 4, 12);
        expect(model.runSweep(hollow, { start: 0.04, end: 0.1, count: 3 }).ok).toBe(false);
        expect(model.runSweep(inputs, { start: 0.05, end: 0.1, count: 31 }).ok).toBe(false);
    });
});
