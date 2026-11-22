import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

const g = 9.80665;
let model, projects, standalone;
beforeAll(() => {
    const context = createContext({ window: {}, Blob });
    for (const script of ['engineering-units', 'calculator-data', 'cylinder-geometry', 'fluid-thermal-calculations',
        'expansion-models', 'fluid-system-core', 'fluid-system-project']) {
        runInContext(readFileSync('js/' + script + '.js', 'utf8'), context, { filename: script });
    }
    model = context.window.FormulaFoundryFluidSystem;
    projects = context.window.FormulaFoundryFluidProject;
    standalone = runInContext('expansionModels["pipe-pressure-drop"]', context);
});

function example() {
    return projects.exampleProject().configurations[0].inputs;
}

function laminar() {
    return {
        ...example(), systemType: 'closed', flow: 0.6, density: 1000, efficiency: 50,
        segments: [{ id: 'test', name: 'Straight run', diameter: 20, length: 7, roughness: 0, minorCoefficient: 2, notes: '' }]
    };
}

function solve(inputs) {
    const result = model.calculate(inputs);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    return result;
}

describe('series engineering balances', () => {
    it('matches a standalone segment and an independent Hagen–Poiseuille and local-K calculation', () => {
        const inputs = laminar();
        const r = solve(inputs);
        const segment = r.segments[0];
        const standaloneResult = standalone.calculate({
            ...inputs, ...inputs.segments[0], viscosityMode: 'Dynamic'
        }, inputs.units);

        // 0.6 L/min = 1e-5 m³/s, ID = 0.02 m. Hagen–Poiseuille is independent of the Darcy implementation.
        const area = Math.PI * 1e-4;
        const flow = 1e-5;
        const velocity = flow / area;
        const major = 128 * 0.001 * 7 * flow / (Math.PI * 0.02 ** 4);
        const minor = 2 * 1000 * velocity ** 2 / 2;
        expect(segment.area).toBeCloseTo(area, 14);
        expect(segment.velocity).toBeCloseTo(velocity, 13);
        expect(segment.reynolds).toBeCloseTo(636.6197723675814, 10);
        expect(segment.darcyFactor).toBeCloseTo(0.1005309649148734, 12);
        expect(segment.major).toBeCloseTo(major, 10);
        expect(segment.minor).toBeCloseTo(minor, 10);
        expect(segment.total).toBeCloseTo(standaloneResult.total * 1000, 10);
        expect(segment.headLoss).toBeCloseTo(standaloneResult.headLoss, 13);
        expect(r.totals.frictionHead).toBeCloseTo((major + minor) / (1000 * g), 13);
        expect(r.totals.pumpPressure).toBeCloseTo(major + minor, 11);
        expect(r.totals.hydraulicPower).toBeCloseTo(flow * (major + minor), 12);
        expect(r.totals.shaftPower).toBeCloseTo(2 * flow * (major + minor), 12);
        expect(segment.regime).toBe('Laminar');
    });

    it('adds two identical runs like a single run with their combined lengths and fitting K', () => {
        const input = example();
        const [first] = input.segments;
        const split = solve({ ...input, systemType: 'closed', segments: [first, { ...first, id: 'copy' }] });
        const combined = solve({
            ...input, systemType: 'closed',
            segments: [{ ...first, length: first.length * 2, minorCoefficient: first.minorCoefficient * 2 }]
        });
        for (const key of ['major', 'minor', 'frictionPressure', 'frictionHead', 'shaftPower']) {
            expect(split.totals[key]).toBeCloseTo(combined.totals[key], 10);
        }
        expect(combined.totals.frictionPressure).toBeCloseTo(2219.705092152, 7);
    });

    it('reproduces the three-diameter worked example using independent fixed-point Colebrook references', () => {
        const inputs = example();
        const calculation = solve(inputs);
        expect(calculation.conditions.flow).toBeCloseTo(0.0004, 15);
        // Computed independently by iterating x = 1/sqrt(f) from x=6 to convergence,
        // then applying Darcy–Weisbach and fitting losses to the tabulated bore areas.
        const references = [
            [0.000804247719319, 0.497359197162, 15883.6633206, 0.00140625, 0.0299653608243, 924.698967081, 185.153578995, 0.1134002641],
            [0.000490873852123, 0.814873308631, 20331.0890503, 0.0018, 0.0293553433572, 5446.98177744, 1325.3809442, 0.6919727522],
            [0.000314159265359, 1.273239544735, 25413.8613054, 0.00225, 0.02920270015, 4724.6951048, 1617.8966604, 0.6480604865]
        ];
        calculation.segments.forEach((segment, i) => {
            const keys = ['area', 'velocity', 'reynolds', 'relativeRoughness', 'darcyFactor', 'major', 'minor', 'headLoss'];
            for (const [j, key] of keys.entries()) expect(segment[key] / references[i][j], key).toBeCloseTo(1, 8);
            expect(segment.area * segment.velocity).toBeCloseTo(0.0004, 14);
            expect(segment.major + segment.minor).toBeCloseTo(segment.total, 10);
            expect(segment.regime).toBe('Turbulent');
        });
        const { totals } = calculation;
        expect(totals.major).toBeCloseTo(11096.3758496, 5);
        expect(totals.minor).toBeCloseTo(3128.4311836, 5);
        expect(totals.frictionPressure).toBeCloseTo(14224.807033, 5);
        expect(totals.frictionHead).toBeCloseTo(1.453433503, 8);
        expect(totals.systemHead).toBeCloseTo(4.953433503, 8);
        expect(totals.pumpPressure).toBeCloseTo(48479.43548, 4);
        expect(totals.hydraulicPower).toBeCloseTo(19.39177419, 7);
        expect(totals.shaftPower).toBeCloseTo(29.83349876, 7);
        expect(totals.frictionHead).toBeCloseTo(calculation.segments.reduce((sum, { headLoss }) => sum + headLoss, 0), 12);
        expect(totals.pumpPressure - totals.frictionPressure).toBeCloseTo(998 * g * 3.5, 8);
        expect(inputs.segments.map(({ diameter }) => diameter)).toEqual([32, 25, 20]);
    });

    it('uses the transition interpolation and flags the approximate result', () => {
        const result = solve({
            ...laminar(), flow: 2.968805057642354,
            segments: [{ ...laminar().segments[0], roughness: 0.045 }]
        });
        expect(result.segments[0].reynolds).toBeCloseTo(3150, 9);
        expect(result.segments[0].regime).toBe('Transitional');
        // Midpoint of 64/2300 and the independently converged turbulent factor at Re=4000.
        expect(result.segments[0].darcyFactor).toBeCloseTo(0.0349793794434146, 12);
        expect(result.segments[0].major).toBeCloseTo(151.848765480685, 9);
        expect(result.warnings.join()).toMatch(/transitional flow.*approximate/);
    });

    it('applies positive and negative reservoir elevations and zero net loop elevation', () => {
        const input = example();
        const closed = solve({ ...input, systemType: 'closed', elevation: 500 });
        const uphill = solve(input);
        const downhill = solve({ ...input, elevation: -1 });
        const assisted = solve({ ...input, elevation: -3.5 });
        expect(closed.conditions.elevation).toBe(0);
        expect(closed.totals.systemHead).toBeCloseTo(1.453433503, 8);
        expect(uphill.totals.systemHead).toBeCloseTo(closed.totals.frictionHead + 3.5, 12);
        expect(downhill.totals.systemHead).toBeCloseTo(0.453433503, 8);
        expect(assisted.totals.systemHead).toBeCloseTo(-2.046566497, 8);
        expect(assisted.totals).toMatchObject({ pumpHead: 0, pumpPressure: 0, hydraulicPower: 0, shaftPower: 0 });
        expect(assisted.warnings.join(' ')).toMatch(/Gravity-assisted.*Actual flow depends/);
        const balanced = solve({ ...input, elevation: -closed.totals.frictionHead });
        expect(balanced.totals).toMatchObject({ systemHead: 0, pumpHead: 0, shaftPower: 0 });
        expect(balanced.warnings.join()).toContain('zero added head');
    });

    it('retains static pressure at zero open-system flow, with zero power and undefined Darcy factors', () => {
        const result = solve({ ...example(), flow: 0 });
        expect(result.segments[0]).toMatchObject({ velocity: 0, reynolds: 0, regime: 'No flow', darcyFactor: null, total: 0 });
        expect(result.totals).toMatchObject({ frictionHead: 0, pumpHead: 3.5, hydraulicPower: 0, shaftPower: 0 });
        expect(result.totals.pumpPressure).toBeCloseTo(998 * g * 3.5, 8);
        expect(result.warnings.join()).toContain('shutoff');
    });

    it('uses stated pump efficiency only for shaft power', () => {
        const input = example();
        const ideal = solve({ ...input, efficiency: 100 });
        const half = solve({ ...input, efficiency: 50 });
        expect(ideal.totals.hydraulicPower).toBe(half.totals.hydraulicPower);
        expect(ideal.totals.hydraulicPower).toBe(ideal.totals.shaftPower);
        expect(half.totals.shaftPower).toBe(2 * ideal.totals.shaftPower);
    });

    it('converts US flow, bore, length and density units against independent factors', () => {
        const metric = solve(example());
        const inputs = example();
        const us = {
            ...inputs, flow: 24 / 3.785411784, density: 998 * 0.3048 ** 3 / 0.45359237, elevation: 3.5 / 0.3048,
            units: { ...inputs.units, flow: 'GPM', density: 'lb/ft³', diameter: 'in', distance: 'ft', dynamicViscosity: 'cP' },
            segments: inputs.segments.map((segment) => ({
                ...segment, diameter: segment.diameter / 25.4, roughness: segment.roughness / 25.4, length: segment.length / 0.3048
            }))
        };
        const converted = solve(us);
        expect(converted.conditions.flow).toBeCloseTo(4e-4, 15);
        expect(converted.segments[1].diameter).toBeCloseTo(0.025, 14);
        expect(converted.totals.pumpHead).toBeCloseTo(4.953433503, 8);
        expect(converted.totals.shaftPower).toBeCloseTo(metric.totals.shaftPower, 11);
        const changed = model.changeUnits(inputs, 'diameter', 'in');
        expect(changed.segments[0].diameter).toBeCloseTo(32 / 25.4, 13);
        expect(changed.segments[0].roughness).toBeCloseTo(0.045 / 25.4, 13);
        expect(example().segments[0].diameter).toBe(32);
    });

    it('accepts equivalent dynamic and kinematic viscosity at nonunit density', () => {
        const input = { ...example(), viscosityMode: 'kinematicViscosity', kinematicViscosity: 1000 / 998, dynamicViscosity: null };
        const result = solve(input);
        expect(result.conditions.dynamicViscosity).toBeCloseTo(0.001, 14);
        expect(result.segments[1].reynolds).toBeCloseTo(20331.0890503, 6);
        expect(result.totals.frictionPressure).toBeCloseTo(14224.807033, 5);
    });

    it('keeps valid SI results independent of output display range', () => {
        const inputs = laminar();
        inputs.flow = 0;
        inputs.units.diameter = 'm';
        inputs.segments[0].diameter = 1e152;
        const result = solve(inputs);
        // The area is finite in SI even though its projection into mm² overflows.
        expect(solve(model.changeUnits(inputs, 'area', 'mm²'))).toEqual(result);
    });
});

describe('validation and sensitivity', () => {
    it.each([
        ['missing shared input', { density: null }, 'Fluid density'],
        ['negative flow', { flow: -1 }, 'Design flow rate'],
        ['no viscosity', { dynamicViscosity: 0 }, 'Dynamic viscosity'],
        ['zero pump efficiency', { efficiency: 0 }, 'Pump efficiency'],
        ['above 100% efficiency', { efficiency: 101 }, 'Pump efficiency'],
        ['invalid system type', { systemType: ['open'] }, 'system type'],
        ['non-finite balance', { elevation: Number.MAX_VALUE }, 'system balance'],
        ['open elevation missing', { elevation: null }, 'Reservoir elevation'],
        ['no segments', { segments: [] }, 'sequential pipe segments']
    ])('rejects %s', (_label, input, message) => {
        const result = model.calculate({ ...example(), ...input });
        expect(result.ok).toBe(false);
        expect(result.errors.map(({ message }) => message).join()).toContain(message);
    });

    it.each([
        [{ diameter: 0 }, 'internal diameter'],
        [{ length: -1 }, 'straight-pipe length'],
        [{ roughness: -0.01 }, 'absolute roughness'],
        [{ roughness: 2 }, 'relative roughness'],
        [{ minorCoefficient: null }, 'sum of fitting K'],
        [{ minorCoefficient: -1 }, 'sum of fitting K']
    ])('rejects a bad segment without returning partial totals (%j)', (patch, message) => {
        const inputs = example();
        inputs.segments[1] = { ...inputs.segments[1], ...patch };
        const result = model.calculate(inputs);
        expect(result.ok).toBe(false);
        expect(result.totals).toBeUndefined();
        expect(result.errors[0]).toMatchObject({ segmentId: inputs.segments[1].id, message: expect.stringContaining(message) });
    });

    it('returns independent pressure and power values for a laminar sweep', () => {
        const inputs = laminar();
        inputs.segments[0].minorCoefficient = 0;
        const sweep = model.runSweep(inputs, { start: 0, end: 1.2, count: 3 });
        expect(sweep.ok).toBe(true);
        expect(sweep.samples.map(({ flow }) => flow)).toEqual([0, 0.6, 1.2]);
        const h = 128e-3 * 7 * 1e-5 / (Math.PI * 0.02 ** 4 * 1000 * g);
        expect(sweep.samples[0]).toMatchObject({ frictionHead: 0, pumpHead: 0, shaftPower: 0 });
        expect(sweep.samples[1].pumpHead).toBeCloseTo(h, 14);
        expect(sweep.samples[2].frictionHead).toBeCloseTo(2 * h, 14);
        expect(sweep.samples[2].shaftPower).toBeCloseTo(4 * sweep.samples[1].shaftPower, 14);
    });

    it('flags individual unsupported sweep samples and rejects unbounded or indistinct ranges', () => {
        const sweep = model.runSweep(laminar(), { start: 0, end: 100000, count: 3 });
        expect(sweep.samples[0].pumpHead).toBe(0);
        expect(sweep.samples[1].pumpHead).toBeGreaterThan(0);
        expect(sweep.samples[2].errors.join()).toMatch(/100 million/);
        expect(sweep.samples[2].shaftPower).toBeUndefined();
        expect(model.runSweep(laminar(), { start: 5, end: 4, count: 5 }).ok).toBe(false);
        expect(model.runSweep(laminar(), { start: 0, end: 1, count: 101 }).ok).toBe(false);
        expect(model.runSweep(laminar(), { start: 1, end: 1 + Number.EPSILON, count: 4 }).ok).toBe(false);
    });
});

describe('projects and current results', () => {
    it('keeps the baseline solved while the alternative is edited and recalculated', () => {
        const project = projects.exampleProject();
        const initial = project.configurations[0];
        const original = projects.solved(initial, solve(initial.inputs));
        const copy = projects.duplicate(original);
        const inputs = copy.inputs;
        inputs.segments[2].diameter = 25;
        const solved = projects.solved(copy, solve(inputs));
        expect(original.inputs.segments[2].diameter).toBe(20);
        expect(projects.current(original).totals.shaftPower).toBeCloseTo(29.83349876, 7);
        expect(solved.result.totals.shaftPower).toBeCloseTo(27.29588597, 7);
        expect(solved.result.totals.pumpHead).toBeCloseTo(4.532098536, 8);
        expect(solved.inputs.segments[2].id).toBe(original.inputs.segments[2].id);
        const stale = projects.edit(solved, { ...inputs, flow: 6 });
        expect(stale.status).toBe('stale');
        expect(projects.current(stale)).toBeNull();
        expect(projects.percent(0, 5)).toBeNull();
        expect(projects.percent(10, 8)).toBeCloseTo(-20, 12);
    });

    it('round-trips a calculated baseline and a stale alternative without serializing derived data', () => {
        const project = projects.exampleProject();
        const base = project.configurations[0];
        const calculated = projects.solved(base, solve(base.inputs));
        const copy = projects.duplicate(calculated);
        const stale = projects.edit(projects.solved(copy, solve(copy.inputs)), { ...copy.inputs, density: null });
        project.configurations = [calculated, stale];
        project.activeId = stale.id;
        const portable = projects.serialize(project);
        expect(JSON.parse(portable)).toMatchObject({ schemaVersion: 1, modelVersion: 1, workflowId: 'fluid-system' });
        expect(portable).not.toMatch(/"result"|"totals"/);
        const parsed = projects.parse(portable);
        expect(parsed.ok).toBe(true);
        expect(projects.serialize(parsed.project)).toBe(portable);
        expect(projects.current(parsed.project.configurations[0]).totals.shaftPower).toBeCloseTo(29.83349876, 7);
        expect(projects.current(parsed.project.configurations[1])).toBeNull();
    });

    it('rejects malformed files, impossible calculated records, bad units and excessive file size', () => {
        const sample = () => JSON.parse(projects.serialize(projects.exampleProject()));
        const corruptions = [
            (file) => { file.modelVersion = 2; },
            (file) => { file.schemaVersion = 0; },
            (file) => { file.project.baselineId = 'missing'; },
            (file) => { file.project.configurations.push(file.project.configurations[0]); },
            (file) => { file.project.configurations[0].inputs.units.diameter = '__proto__'; },
            (file) => { file.project.configurations[0].inputs.segments[0].diameter = '32'; },
            (file) => { file.project.configurations[0].inputs.segments.push(file.project.configurations[0].inputs.segments[0]); },
            (file) => {
                const [config] = file.project.configurations;
                config.status = 'calculated';
                config.inputs.segments[0].roughness = -1;
            },
            (file) => { file.project.configurations[0].inputs.result = {}; },
            (file) => { file.project.configurations = Array(9).fill(file.project.configurations[0]); }
        ];
        for (const corrupt of corruptions) {
            const file = sample();
            corrupt(file);
            expect(projects.parse(JSON.stringify(file)).ok).toBe(false);
        }
        expect(projects.parse('{"x":').ok).toBe(false);
        expect(projects.parse('漢'.repeat(projects.MAX_FILE_BYTES / 2)).error).toMatch(/256 KiB/);
    });

    it('reads a saved draft from a new store and reports blocked storage', () => {
        const values = new Map();
        const adapter = { setItem(key, value) { values.set(key, value); }, getItem(key) { return values.get(key) ?? null; } };
        const draft = projects.newProject();
        draft.title = 'Partly specified system';
        expect(projects.createStore(adapter).save(draft)).toBe(true);
        expect(projects.createStore(adapter).load().project).toEqual(draft);
        const blocked = projects.createStore(undefined);
        expect(blocked.load().error).toMatch(/storage is unavailable/i);
        expect(blocked.save(draft)).toBe(false);
    });
});
