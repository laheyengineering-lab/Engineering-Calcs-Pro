import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

let model, projects, example;
beforeAll(() => {
    const context = createContext({ window: {}, Blob });
    for (const script of ['engineering-units', 'beam-section-properties', 'beam-study-calculations',
        'shaft-torsion-calculation', 'factor-of-safety-calculation', 'bearing-life-calculation',
        'shaft-bearing-core', 'shaft-bearing-project', 'shaft-bearing-example']) {
        runInContext(readFileSync('js/' + script + '.js', 'utf8'), context, { filename: script });
    }
    model = context.window.FormulaFoundryShaftBearing;
    projects = context.window.FormulaFoundryShaftProject;
    example = context.window.FormulaFoundryShaftExample;
});

function calculatedProject() {
    const project = example.create(projects);
    const configuration = project.configurations[0];
    const result = model.calculate(configuration.inputs);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    project.configurations[0] = projects.solved(configuration, result);
    return project;
}

describe('shaft project units and material provenance', () => {
    it('normalizes US customary input to independently known base units', () => {
        expect(projects.toSI(2, 'length', 'ft')).toBeCloseTo(0.6096, 12);
        expect(projects.toSI(1.5, 'diameter', 'in')).toBeCloseTo(0.0381, 12);
        expect(projects.toSI(-120, 'force', 'lbf')).toBeCloseTo(-533.78659383126, 10);
        expect(projects.toSI(60, 'torque', 'lbf·ft')).toBeCloseTo(81.349077, 8);
        expect(projects.toSI(30e3, 'modulus', 'ksi')).toBeCloseTo(206.84271e9, 2);
        expect(projects.toSI(0.284 * 1728, 'density', 'lb/ft³')).toBeCloseTo(7861.092937698, 7);
        expect(projects.toSI(15, 'speed', 'rps')).toBe(900);
        expect(projects.fromSI(Math.PI, 'angle', '°')).toBe(180);
        expect(projects.fromSI(0.0254 ** 4, 'inertia', 'in⁴')).toBe(1);
    });

    it('solves equivalent SI and US customary physical inputs', () => {
        const [{ inputs }] = example.create(projects).configurations;
        const { toSI } = projects;
        const load = { ...inputs.loads[0], position: 0.1524, fy: -2001.699726867225, fz: 0 };
        const direct = {
            ...inputs, span: 0.3048, outerDiameter: 0.0381, speed: 900,
            torque: { value: 81.349077, start: 0, end: 0.3048 },
            loads: [load]
        };
        const converted = {
            ...direct,
            span: toSI(12, 'length', 'in'),
            outerDiameter: toSI(1.5, 'diameter', 'in'),
            speed: toSI(15, 'speed', 'rps'),
            torque: { value: toSI(60, 'torque', 'lbf·ft'), start: 0, end: toSI(1, 'length', 'ft') },
            loads: [{ ...load, position: toSI(6, 'length', 'in'), fy: toSI(-450, 'force', 'lbf') }]
        };
        const si = model.calculate(direct);
        const us = model.calculate(converted);
        expect(si.ok).toBe(true);
        expect(us.ok).toBe(true);
        expect(si.reactions.a.fy).toBeCloseTo(1000.8498634336125, 10);
        expect(us.reactions.a.fy).toBeCloseTo(si.reactions.a.fy, 10);
        expect(us.combined.maximum.equivalentStress).toBeCloseTo(si.combined.maximum.equivalentStress, 6);
        expect(us.deflection.maximum.resultant).toBeCloseTo(si.deflection.maximum.resultant, 12);
        expect(us.bearings.a.lifeHours).toBeCloseTo(si.bearings.a.lifeHours, 10);
    });

    it('retains the same solved model and SI inputs while changing input and output units', () => {
        const [base] = calculatedProject().configurations;
        const result = projects.current(base);
        expect(result).not.toBeNull();
        const converted = projects.changeUnit(projects.changeUnit(base, 'force', 'lbf'), 'stress', 'ksi');
        expect(projects.current(converted)).toBe(result);
        expect(converted.inputs).toBe(base.inputs);
        expect(base.units.force).toBe('N');
        expect(base.units.stress).toBe('MPa');
        expect(converted.units.force).toBe('lbf');
        expect(converted.units.stress).toBe('ksi');
        expect(projects.changeUnit(converted, 'force', 'lbf')).toBe(converted);
        expect(() => projects.changeUnit(converted, 'stress', 'kg')).toThrow();
    });

    it('uses the selected material condition and clears properties missing from another preset', () => {
        const [{ inputs }] = example.create(projects).configurations;
        const preset = projects.materialInfo(inputs);
        expect(preset.condition).toBe('Cold drawn');
        expect(preset.productForm).toBe('Bar');
        expect(preset.properties.yieldStrength).toMatchObject({ value: 370e6, basis: 'typical' });
        expect(preset.caveats).toContain('bar size');
        expect(preset.sources.length).toBeGreaterThan(0);

        const override = projects.setMaterialProperty(inputs, 'shearModulus', 82e9);
        expect(projects.applyMaterial(override, inputs.materialId)).toBe(override);
        expect(projects.materialInfo(override).properties.shearModulus).toMatchObject({ value: 82e9, basis: 'manual' });
        const reverted = projects.setMaterialProperty(override, 'shearModulus', 80e9);
        expect(reverted.materialOverrides).toEqual([]);
        expect(projects.materialInfo(reverted).properties.shearModulus.basis).toBe('nominal');

        const changed = projects.applyMaterial(override, 'titanium-grade-5');
        expect(changed.materialOverrides).toEqual([]);
        expect(projects.materialInfo(changed).properties.shearModulus).toMatchObject({ value: null, basis: 'unavailable' });
        expect(changed.material.youngModulus).toBe(113.8e9);
        expect(projects.applyMaterial(changed, '').material).toEqual({
            youngModulus: null, shearModulus: null, yieldStrength: null, density: null
        });
    });

    it('does not preload a legacy unverified reference property', () => {
        const legacy = projects.applyMaterial(projects.newProject().configurations[0].inputs, 'titanium');
        expect(projects.materialInfo(legacy).properties.shearModulus).toEqual({
            value: null, basis: 'unavailable', basisLabel: 'Unavailable (reference value unverified)'
        });
    });
});

describe('shaft project persistence and configuration lifecycle', () => {
    it('duplicates alternatives with isolated editable records and invalidates changed results', () => {
        const [base] = calculatedProject().configurations;
        const copy = projects.duplicate(base);
        expect(copy.status).toBe('draft');
        expect(copy.id).not.toBe(base.id);
        expect(projects.current(copy)).toBeNull();
        expect(copy.units).not.toBe(base.units);
        copy.inputs.loads[0].fy = -1200;
        copy.inputs.material.youngModulus = 198e9;
        copy.inputs.torque.value = -12;
        copy.inputs.bearings.a.dynamicRating = 12000;
        expect(base.inputs.loads[0].fy).toBe(-1600);
        expect(base.inputs.material.youngModulus).toBe(205e9);
        expect(base.inputs.torque.value).toBe(110);
        expect(base.inputs.bearings.a.dynamicRating).toBe(8400);

        const edited = projects.edit(base, { ...base.inputs, outerDiameter: 0.05 });
        expect(edited.status).toBe('stale');
        expect(projects.current(edited)).toBeNull();
        expect(projects.current(base)).not.toBeNull();
        expect(projects.percent(40, 50)).toBe(25);
        expect(projects.percent(0, 1)).toBeNull();
        expect(projects.percent(null, 1)).toBeNull();
        expect(projects.percent(1, null)).toBeNull();
    });

    it('round-trips calculated, stale and draft alternatives without trusting saved results', () => {
        const project = calculatedProject();
        const [base] = project.configurations;
        const changed = projects.setMaterialProperty(base.inputs, 'yieldStrength', null);
        const stale = projects.edit(base, changed);
        const alternate = projects.changeUnit(projects.duplicate(base), 'outputLength', 'in');
        project.configurations = [base, { ...stale, id: 'changed-material' }, alternate];
        project.activeId = alternate.id;
        const serialized = projects.serialize(project);
        const raw = JSON.parse(serialized);
        expect(raw.workflowId).toBe('shaft-bearing');
        expect(raw.schemaVersion).toBe(1);
        expect(raw.project.configurations.every((config) => !Object.hasOwn(config, 'result'))).toBe(true);

        const decoded = projects.parse(serialized);
        expect(decoded.ok, decoded.error).toBe(true);
        expect(decoded.project.baselineId).toBe(base.id);
        expect(decoded.project.activeId).toBe(alternate.id);
        expect(decoded.project.configurations.map((c) => c.status)).toEqual(['calculated', 'stale', 'draft']);
        expect(projects.current(decoded.project.configurations[0])).toEqual(base.result);
        expect(decoded.project.configurations[2].units.outputLength).toBe('in');
        expect(projects.materialInfo(decoded.project.configurations[1].inputs).properties.yieldStrength).toMatchObject({
            value: null, basis: 'unavailable', basisLabel: 'Unavailable (cleared manually)'
        });
    });

    it.each([
        (raw) => { raw.workflowId = 'fluid-system'; },
        (raw) => { raw.modelVersion += 1; },
        (raw) => { raw.project.baselineId = 'missing'; },
        (raw) => { raw.project.configurations[0].units.stress = 'm'; },
        (raw) => { raw.project.configurations[0].inputs.outerDiameter = -0.05; },
        (raw) => { raw.project.configurations[0].inputs.loads[0].fy = '1600'; },
        (raw) => { raw.project.configurations[0].inputs.loads.push(raw.project.configurations[0].inputs.loads[0]); },
        (raw) => { raw.project.configurations[0].inputs.material.youngModulus = 200e9; },
        (raw) => { raw.project.configurations[0].inputs.materialOverrides = [['shearModulus']]; },
        (raw) => { raw.project.configurations[0].result = { ok: true }; },
        (raw) => { delete raw.project.configurations[0].inputs.bearings.b; }
    ])('rejects a malformed or inconsistent project', (corrupt) => {
        const raw = JSON.parse(projects.serialize(calculatedProject()));
        corrupt(raw);
        expect(projects.parse(JSON.stringify(raw)).ok).toBe(false);
    });

    it('saves in separate local storage and handles invalid JSON and denied storage', () => {
        const values = new Map([['formulaFoundry.fluidSystemProject', 'existing fluid data']]);
        const store = projects.createStore({
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, value); }
        });
        expect(store.load()).toEqual({ ok: true, project: null });
        expect(store.save(calculatedProject())).toBe(true);
        expect(store.load().project.configurations[0].status).toBe('calculated');
        expect(values.get('formulaFoundry.fluidSystemProject')).toBe('existing fluid data');
        values.set(projects.STORAGE_KEY, '{');
        expect(store.load().ok).toBe(false);
        const denied = projects.createStore({
            getItem() { throw new Error('unavailable'); },
            setItem() { throw new Error('unavailable'); }
        });
        expect(denied.load().ok).toBe(false);
        expect(denied.save(calculatedProject())).toBe(false);
    });
});
