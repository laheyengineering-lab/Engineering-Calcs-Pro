import { describe, it, expect } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const scripts = [
    'js/engineering-units.js',
    'js/calculator-utils.js',
    'js/press-fit-calculation.js',
    'js/hertzian-contact-calculation.js',
    'js/shaft-torsion-calculation.js',
    'js/beam-section-properties.js',
    'js/beam-study-calculations.js',
    'js/cylinder-force.js',
    'js/differential-thermal-expansion.js',
    'js/report-builder.js',
    'js/design-study-core.js',
    'js/design-study-adapters.js'
];

function memoryStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; }
    };
}

function setup() {
    const { window } = loadCore(scripts);
    const S = window.FormulaFoundryStudies;
    return { S, window, report: window.FormulaFoundryReport, cyl: S.getAdapter('cylinder-force'), dte: S.getAdapter('differential-thermal-expansion') };
}

// Independent hand calculation: D = 100 mm, d = 50 mm, p = 100 bar (10 MPa)
// A_p = 7853.98 mm2 -> F_ext = 78.5398 kN; A_a = 5890.49 mm2 -> F_ret = 58.9049 kN
const cylInputs = { boreDiameter: 100, rodDiameter: 50, workingPressure: 100 };

function calcCylinder(S, cyl, name = 'Baseline', inputs = cylInputs, units) {
    return S.calculateScenario(cyl, S.createScenario(cyl, name, inputs, units));
}

// Steel 12e-6/°C and aluminium 23e-6/°C, 1000 mm, 20 -> 120 °C: 1.2 mm and 2.3 mm
const dteInputs = {
    A1Length: 1000, A1Alpha: 12, A1Ti: 20, A1Tf: 120,
    B1Length: 1000, B1Alpha: 23, B1Ti: 20, B1Tf: 120
};
const out = (s, id) => s.result.outputs.find((o) => o.id === id);

describe('scenario model', () => {
    it('creates a calculated scenario with a full snapshot using the real calculator', () => {
        const { S, cyl } = setup();
        const s = calcCylinder(S, cyl);
        expect(s.status).toBe('calculated');
        expect(out(s, 'extensionForce').value).toBeCloseTo(78.5398, 3);
        expect(out(s, 'extensionForce').unit).toBe('kN');
        expect(out(s, 'retractionForce').value).toBeCloseTo(58.9049, 3);
        expect(out(s, 'pistonArea').value).toBeCloseTo(78.5398, 3); // cm2
        expect(out(s, 'usableExtension')).toBeUndefined();
        expect(s.result.inputs.find((i) => i.id === 'boreDiameter')).toMatchObject({ value: 100, unit: 'mm' });
        expect(s.result.equations.length).toBeGreaterThan(0);
        expect(s.result.assumptions.length).toBeGreaterThan(0);
        expect(s.result.calculatorVersion).toBe('1');
        expect(Number.isFinite(Date.parse(s.result.calculatedAt))).toBe(true);
    });

    it('duplicates with a new id and an independent snapshot', () => {
        const { S, cyl } = setup();
        const a = calcCylinder(S, cyl);
        const b = S.duplicateScenario(a, 'Copy');
        expect(b.id).not.toBe(a.id);
        expect(b.name).toBe('Copy');
        expect(b.result).toEqual(a.result);
        b.result.outputs[0].value = -1;
        expect(a.result.outputs[0].value).not.toBe(-1);
    });

    it('editing one scenario never changes another or its saved result until recalculated', () => {
        const { S, cyl } = setup();
        let study = S.createStudy('Study', 'cylinder-force');
        const a = calcCylinder(S, cyl);
        const b = S.duplicateScenario(a, 'B');
        study = S.addScenario(S.addScenario(study, a), b);
        const before = JSON.stringify(study.scenarios[0]);
        const edited = S.setScenarioInput(cyl, study.scenarios[1], 'workingPressure', 200);
        study = S.replaceScenario(study, edited);
        expect(JSON.stringify(study.scenarios[0])).toBe(before);
        expect(study.scenarios[1].status).toBe('stale');
        expect(study.scenarios[1].inputs.workingPressure).toBe(200);
        // saved snapshot still shows the old results/inputs until the explicit recalculation
        expect(out(study.scenarios[1], 'extensionForce').value).toBeCloseTo(78.5398, 3);
        expect(study.scenarios[1].result.inputs.find((i) => i.id === 'workingPressure').value).toBe(100);
        const recalculated = S.calculateScenario(cyl, study.scenarios[1]);
        expect(recalculated.status).toBe('calculated');
        expect(out(recalculated, 'extensionForce').value).toBeCloseTo(157.0796, 3);
    });

    it('does not mutate the input scenario when calculating, renaming or editing', () => {
        const { S, cyl } = setup();
        const s = S.createScenario(cyl, 'X', cylInputs);
        const frozen = JSON.stringify(s);
        S.calculateScenario(cyl, s); S.renameScenario(s, 'Y'); S.setScenarioInput(cyl, s, 'rodDiameter', 10); S.setScenarioUnit(cyl, s, 'distance', 'in');
        expect(JSON.stringify(s)).toBe(frozen);
    });

    it('records calculation errors transparently and keeps a previous snapshot out of an error state', () => {
        const { S, cyl } = setup();
        const bad = S.calculateScenario(cyl, S.createScenario(cyl, 'Bad', { boreDiameter: 50, rodDiameter: 60, workingPressure: 10 }));
        expect(bad.status).toBe('error');
        expect(bad.error).toMatch(/smaller than the bore/);
        expect(bad.result).toBeNull();
    });

    it('adds optional usable-force outputs only when efficiency is supplied', () => {
        const { S, cyl } = setup();
        const s = calcCylinder(S, cyl, 'Eff', { ...cylInputs, efficiency: 90 });
        expect(out(s, 'usableExtension').value).toBeCloseTo(70.6858, 3);
        expect(out(s, 'usableRetraction').value).toBeCloseTo(53.0144, 3);
    });

    it('limits scenarios per study and rejects scenarios of another calculator', () => {
        const { S, cyl, dte } = setup();
        let study = S.createStudy('S', 'cylinder-force');
        expect(() => S.addScenario(study, S.createScenario(dte, 'x'))).toThrow(/one calculator/);
        for (let i = 0; i < S.MAX_SCENARIOS; i += 1) study = S.addScenario(study, S.createScenario(cyl, 'n' + i));
        expect(() => S.addScenario(study, S.createScenario(cyl, 'over'))).toThrow(/at most/);
    });

    it('removes scenarios and reassigns the baseline', () => {
        const { S, cyl } = setup();
        let study = S.createStudy('S', 'cylinder-force');
        const a = S.createScenario(cyl, 'a');
        const b = S.createScenario(cyl, 'b');
        study = S.addScenario(S.addScenario(study, a), b);
        expect(study.baselineId).toBe(a.id);
        study = S.removeScenario(study, a.id);
        expect(study.baselineId).toBe(b.id);
        study = S.removeScenario(study, b.id);
        expect(study.baselineId).toBeNull();
    });
});

describe('unit consistency', () => {
    it('stores inputs and outputs in the scenario units and converts consistently', () => {
        const { S, cyl } = setup();
        // 4 in bore, no rod, 1000 psi -> 12566.4 lbf (hand calc: pi*4^2/4 * 1000)
        const s = calcCylinder(S, cyl, 'US', { boreDiameter: 4, rodDiameter: 0, workingPressure: 1000 }, { distance: 'in', pressure: 'psi', force: 'lbf' });
        expect(out(s, 'extensionForce')).toMatchObject({ unit: 'lbf' });
        expect(out(s, 'extensionForce').value).toBeCloseTo(12566.4, 0);
        expect(s.result.inputs.find((i) => i.id === 'workingPressure').unit).toBe('psi');
    });

    it('rejects unsupported units', () => {
        const { S, cyl } = setup();
        expect(() => S.setScenarioUnit(cyl, S.createScenario(cyl, 'x'), 'force', 'parsec')).toThrow(/Unsupported unit/);
        expect(S.convertUnit(cyl, 'force', 1, 'kN', 'furlong')).toBeNull();
        expect(S.convertUnit(cyl, 'force', 1, 'kN', 'N')).toBeCloseTo(1000, 9);
    });
});

describe('comparison', () => {
    it('computes differences and percentages against the selected baseline', () => {
        const { S, cyl } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const b = calcCylinder(S, cyl, 'B', { ...cylInputs, workingPressure: 150 });
        const cmp = S.compareScenarios([a, b], a.id);
        expect(cmp.ok).toBe(true);
        const ext = cmp.outputRows.find((r) => r.id === 'extensionForce');
        expect(ext.cells[1].delta).toBeCloseTo(39.2699, 3);
        expect(ext.cells[1].percent.value).toBeCloseTo(50, 6);
        expect(ext.cells[1].changed).toBe(true);
        const area = cmp.outputRows.find((r) => r.id === 'pistonArea');
        expect(area.cells[1].changed).toBe(false);
        // switching the baseline reverses the difference
        const reversed = S.compareScenarios([a, b], b.id);
        expect(reversed.scenarios[0].name).toBe('B');
        expect(reversed.outputRows.find((r) => r.id === 'extensionForce').cells[1].percent.value).toBeCloseTo(-100 / 3, 6);
    });

    it('converts units before differencing', () => {
        const { S, cyl } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const b = calcCylinder(S, cyl, 'B', { boreDiameter: 3.937007874015748, rodDiameter: 1.968503937007874, workingPressure: 1450.377377302 }, { distance: 'in', pressure: 'psi', force: 'lbf' });
        const cmp = S.compareScenarios([a, b], a.id);
        const ext = cmp.outputRows.find((r) => r.id === 'extensionForce');
        expect(ext.cells[1].unit).toBe('lbf');
        expect(ext.cells[1].deltaUnit).toBe('kN');
        expect(Math.abs(ext.cells[1].delta)).toBeLessThan(0.01);
        expect(cmp.notes.join(' ')).toMatch(/uses lbf/);
    });

    it('refuses percentage change when the baseline is zero', () => {
        const { S, cyl } = setup();
        expect(S.percentDifference(0, 5)).toEqual({ value: null, reason: expect.stringMatching(/baseline value is zero/) });
        expect(S.percentDifference(10, 15).value).toBeCloseTo(50, 9);
        expect(S.percentDifference(-10, -5).value).toBeCloseTo(50, 9);
        expect(S.percentDifference(NaN, 1).value).toBeNull();
        const a = calcCylinder(S, cyl, 'A', { ...cylInputs, rodDiameter: 0 });
        const b = calcCylinder(S, cyl, 'B', { ...cylInputs, rodDiameter: 20 });
        const rod = S.compareScenarios([a, b], a.id).outputRows.find((r) => r.id === 'rodArea');
        expect(rod.cells[0].value).toBe(0);
        expect(rod.cells[1].percent.value).toBeNull();
        expect(rod.cells[1].percent.reason).toMatch(/zero/);
        expect(rod.cells[1].delta).toBeGreaterThan(0);
    });

    it('does not offer percentages for offset temperature inputs', () => {
        const { S, dte } = setup();
        const a = S.calculateScenario(dte, S.createScenario(dte, 'A', dteInputs));
        const b = S.calculateScenario(dte, S.createScenario(dte, 'B', { ...dteInputs, A1Tf: 220 }));
        const cmp = S.compareScenarios([a, b], a.id);
        const tf = cmp.inputRows.find((r) => r.id === 'A1Tf');
        expect(tf.cells[1].delta).toBe(100);
        expect(tf.cells[1].percent.value).toBeNull();
        expect(tf.cells[1].percent.reason).toMatch(/not meaningful/);
        expect(cmp.outputRows.find((r) => r.id === 'memberAExpansion').cells[1].delta).toBeCloseTo(1.2, 9);
    });

    it('flags configuration differences when outputs exist in only one scenario', () => {
        const { S, cyl } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const b = calcCylinder(S, cyl, 'B', { ...cylInputs, efficiency: 90 });
        const cmp = S.compareScenarios([a, b], a.id);
        expect(cmp.notes.join(' ')).toMatch(/Estimated usable extension force/);
        expect(cmp.outputRows.find((r) => r.id === 'usableExtension').cells[0].missing).toBe(true);
    });

    it('rejects incompatible comparisons', () => {
        const { S, cyl, dte } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const d = S.calculateScenario(dte, S.createScenario(dte, 'D', dteInputs));
        expect(S.compareScenarios([a, d], a.id)).toMatchObject({ ok: false, error: expect.stringMatching(/different calculators/) });
        expect(S.compareScenarios([a], a.id).ok).toBe(false);
        const stale = S.setScenarioInput(cyl, calcCylinder(S, cyl, 'S'), 'workingPressure', 5);
        expect(S.compareScenarios([a, stale], a.id).error).toMatch(/recalculate/);
        const bad = S.calculateScenario(cyl, S.createScenario(cyl, 'bad', { boreDiameter: 1, rodDiameter: 2, workingPressure: 1 }));
        expect(S.compareScenarios([a, bad], a.id).ok).toBe(false);
        const tampered = calcCylinder(S, cyl, 'T');
        tampered.result.outputs[0].unit = 'kN'; // area reported in a force unit
        expect(S.compareScenarios([a, tampered], a.id).error).toMatch(/incompatible unit/);
        const meaning = calcCylinder(S, cyl, 'M');
        meaning.result.outputs[0].quantity = 'force';
        expect(S.compareScenarios([a, meaning], a.id).error).toMatch(/physical meaning/);
        const revised = calcCylinder(S, cyl, 'R');
        revised.result.calculatorVersion = '0';
        expect(S.compareScenarios([a, revised], a.id).error).toMatch(/revision/);
        expect(S.compareScenarios([a, calcCylinder(S, cyl, 'B')], 'missing').ok).toBe(false);
    });

    it('uses the saved snapshot even when the live inputs have been edited', () => {
        const { S, cyl } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const b = calcCylinder(S, cyl, 'B', { ...cylInputs, workingPressure: 150 });
        b.inputs.workingPressure = 999; // draft edit without recalculation, status still "calculated" by tampering
        const cmp = S.compareScenarios([a, b], a.id);
        expect(cmp.inputRows.find((r) => r.id === 'workingPressure').cells[1].value).toBe(150);
    });
});

describe('parametric sweeps', () => {
    it('matches independent hand calculations and keeps non-varied inputs', () => {
        const { S, cyl } = setup();
        const base = calcCylinder(S, cyl);
        const r = S.runSweep(cyl, base, { inputId: 'workingPressure', outputId: 'extensionForce', start: 50, end: 150, mode: 'step', step: 50 });
        expect(r.ok).toBe(true);
        // F = p * pi*D^2/4 with D = 0.1 m: 5 MPa -> 39.2699 kN, 10 -> 78.5398, 15 -> 117.8097
        expect(r.sweep.points.map((p) => p.x)).toEqual([50, 100, 150]);
        expect(r.sweep.points[0].y).toBeCloseTo(39.2699, 3);
        expect(r.sweep.points[1].y).toBeCloseTo(78.5398, 3);
        expect(r.sweep.points[2].y).toBeCloseTo(117.8097, 3);
        expect(r.sweep.input).toMatchObject({ unit: 'bar' });
        expect(r.sweep.output).toMatchObject({ unit: 'kN' });
        expect(r.sweep.baseInputs.find((i) => i.id === 'boreDiameter').value).toBe(100);
        expect(r.sweep.failedCount).toBe(0);
        // baseline scenario untouched
        expect(base.inputs.workingPressure).toBe(100);
    });

    it('supports a sample-count mode, descending ranges and the end point exactly', () => {
        const { S, cyl } = setup();
        const base = calcCylinder(S, cyl);
        const r = S.runSweep(cyl, base, { inputId: 'workingPressure', outputId: 'extensionForce', start: 100, end: 0.1, mode: 'count', count: 3 });
        expect(r.ok).toBe(true);
        expect(r.sweep.points.map((p) => p.x)).toEqual([100, 50.05, 0.1]);
        const down = S.runSweep(cyl, base, { inputId: 'workingPressure', outputId: 'extensionForce', start: 100, end: 50, mode: 'step', step: 25 });
        expect(down.sweep.points.map((p) => p.x)).toEqual([100, 75, 50]);
    });

    it('reports failed samples without hiding or inventing them', () => {
        const { S, cyl } = setup();
        const base = calcCylinder(S, cyl);
        // bore is 100 mm, so rod diameters of 100 and 120 mm are invalid
        const r = S.runSweep(cyl, base, { inputId: 'rodDiameter', outputId: 'retractionForce', start: 0, end: 120, mode: 'step', step: 20 });
        expect(r.ok).toBe(true);
        expect(r.sweep.points.map((p) => p.x)).toEqual([0, 20, 40, 60, 80, 100, 120]);
        expect(r.sweep.failedCount).toBe(2);
        expect(r.sweep.points[5]).toMatchObject({ y: null, error: expect.stringMatching(/smaller than the bore/) });
        expect(r.sweep.points[6].y).toBeNull();
        // rod 0: F_ret = F_ext = 78.5398 kN; rod 60: p*(pi/4)(0.1^2-0.06^2) = 10e6*0.0050265 = 50.2655 kN
        expect(r.sweep.points[0].y).toBeCloseTo(78.5398, 3);
        expect(r.sweep.points[3].y).toBeCloseTo(50.2655, 3);
    });

    it('validates start, end, step and sample count', () => {
        const { S, cyl } = setup();
        const base = calcCylinder(S, cyl);
        const p = { inputId: 'workingPressure', outputId: 'extensionForce', start: 10, end: 20, mode: 'step', step: 5 };
        const errors = (over) => S.runSweep(cyl, base, { ...p, ...over }).errors || [];
        expect(errors({ start: NaN }).join()).toMatch(/Start value must be a number/);
        expect(errors({ end: Infinity }).join()).toMatch(/End value must be a number/);
        expect(errors({ end: 10 }).join()).toMatch(/must be different/);
        expect(errors({ step: 0 }).join()).toMatch(/positive/);
        expect(errors({ step: -1 }).join()).toMatch(/positive/);
        expect(errors({ step: 11 }).join()).toMatch(/must not exceed the sweep range/);
        expect(errors({ start: 0 }).join()).toMatch(/greater than 0/);
        expect(errors({ inputId: 'nothing' }).join()).toMatch(/Select an input/);
        expect(errors({ outputId: 'nothing' }).join()).toMatch(/Select an output/);
        expect(errors({ mode: 'count', count: 1 }).join()).toMatch(/at least 2/);
        expect(errors({ mode: 'count', count: 2.5 }).join()).toMatch(/whole number/);
        expect(errors({ mode: 'count', count: 5 })).toEqual([]);
        expect(errors({ inputId: 'efficiency', start: 50, end: 120 }).join()).toMatch(/at most 100/);
    });

    it('enforces the sample-count limit for both modes', () => {
        const { S, cyl } = setup();
        const base = calcCylinder(S, cyl);
        const limit = S.MAX_SWEEP_SAMPLES;
        const p = { inputId: 'workingPressure', outputId: 'extensionForce', start: 1, end: 1000, mode: 'count' };
        expect(S.runSweep(cyl, base, { ...p, count: limit }).ok).toBe(true);
        expect(S.runSweep(cyl, base, { ...p, count: limit + 1 }).errors.join()).toMatch(/exceeds the maximum/);
        expect(S.runSweep(cyl, base, { ...p, mode: 'step', step: 0.001 }).errors.join()).toMatch(/exceeds the maximum/);
        const exact = S.runSweep(cyl, base, { ...p, mode: 'step', step: 1 }); // 1000 samples
        expect(exact.ok).toBe(false);
    });

    it('requires a calculated baseline', () => {
        const { S, cyl } = setup();
        const fresh = S.createScenario(cyl, 'x', cylInputs);
        expect(S.runSweep(cyl, fresh, { inputId: 'workingPressure', outputId: 'extensionForce', start: 1, end: 2, mode: 'count', count: 2 }).errors.join()).toMatch(/baseline/);
    });

    it('sweeps the differential thermal expansion calculator with hand-checked values', () => {
        const { S, dte } = setup();
        const base = S.calculateScenario(dte, S.createScenario(dte, 'Base', dteInputs));
        expect(out(base, 'memberAExpansion').value).toBeCloseTo(1.2, 9);
        expect(out(base, 'memberBExpansion').value).toBeCloseTo(2.3, 9);
        expect(out(base, 'differential').value).toBeCloseTo(-1.1, 9);
        // alpha_A*L*dT: 12e-6 * 1000 mm * (Tf - 20)
        const r = S.runSweep(dte, base, { inputId: 'A1Tf', outputId: 'differential', start: 20, end: 220, mode: 'step', step: 100 });
        expect(r.sweep.points.map((p) => p.y)).toEqual([expect.closeTo(-2.3, 9), expect.closeTo(-1.1, 9), expect.closeTo(0.1, 9)]);
        // member A: 12e-6 * 1000 * 200 = 2.4 mm; minus 2.3 = 0.1 mm
        expect(r.sweep.input.unit).toBe('°C');
        expect(r.sweep.output.unit).toBe('mm');
    });

    it('reports invalid thermal samples (below absolute zero) and respects temperature units', () => {
        const { S, dte } = setup();
        const base = S.calculateScenario(dte, S.createScenario(dte, 'Base', dteInputs));
        const r = S.runSweep(dte, base, { inputId: 'A1Tf', outputId: 'memberAExpansion', start: -300, end: -200, mode: 'count', count: 3 });
        expect(r.sweep.points[0]).toMatchObject({ y: null, error: expect.stringMatching(/absolute zero/) });
        expect(r.sweep.points[2].y).toBeCloseTo(12e-6 * 1000 * (-200 - 20), 9);
        const f = S.calculateScenario(dte, S.createScenario(dte, 'F', { ...dteInputs, A1Ti: 68, A1Tf: 248, B1Ti: 68, B1Tf: 248 }, { temperature: '°F' }));
        expect(out(f, 'memberAExpansion').value).toBeCloseTo(1.2, 9); // 68-248 °F = 20-120 °C
    });

    it('reports partially filled sections and a missing required section as scenario errors', () => {
        const { S, dte } = setup();
        expect(S.calculateScenario(dte, S.createScenario(dte, 'x', {})).error).toMatch(/Member A section 1 is required/);
        const partial = S.calculateScenario(dte, S.createScenario(dte, 'x', { ...dteInputs, A2Length: 10 }));
        expect(partial.status).toBe('error');
        expect(partial.error).toMatch(/Member A, section 2/);
    });

    it('does not use eval or dynamic code in the Design Studies modules', async () => {
        const fs = await import('node:fs');
        ['js/design-study-core.js', 'js/design-study-adapters.js', 'js/design-studies.js', 'js/study-chart.js'].forEach((file) => {
            const src = fs.readFileSync(file, 'utf8');
            expect(src).not.toMatch(/\beval\s*\(|new Function\s*\(|innerHTML/);
        });
    });
});

describe('persistence and validation', () => {
    function savedStudy(S, cyl) {
        let study = S.createStudy('Persisted', 'cylinder-force');
        const a = calcCylinder(S, cyl, 'A');
        study = S.addScenario(S.addScenario(study, a), S.duplicateScenario(a, 'B'));
        const sweep = S.runSweep(cyl, a, { inputId: 'workingPressure', outputId: 'extensionForce', start: 50, end: 150, mode: 'count', count: 3 }).sweep;
        return S.addSweep(study, sweep);
    }

    it('round-trips studies through storage', () => {
        const { S, cyl } = setup();
        const storage = memoryStorage();
        const store = S.createStudyStore(storage);
        const study = savedStudy(S, cyl);
        expect(store.save([study])).toBe(true);
        const loaded = store.load();
        expect(loaded.issues).toEqual([]);
        expect(loaded.studies).toHaveLength(1);
        expect(loaded.studies[0].scenarios.map((s) => s.name)).toEqual(['A', 'B']);
        expect(loaded.studies[0].scenarios[0].result.outputs).toEqual(study.scenarios[0].result.outputs);
        expect(loaded.studies[0].sweeps[0].points).toEqual(study.sweeps[0].points);
        expect(loaded.studies[0].baselineId).toBe(study.baselineId);
    });

    it('drops only malformed scenarios, sweeps and studies', () => {
        const { S, cyl } = setup();
        const good = savedStudy(S, cyl);
        const raw = JSON.parse(JSON.stringify(good));
        raw.scenarios.push({ id: 'bad1', calculatorId: 'cylinder-force', inputs: { boreDiameter: 'abc' } });
        raw.scenarios.push({ id: 'bad2', calculatorId: 'cylinder-force', units: { force: 'parsec' }, inputs: {} });
        raw.scenarios.push('nonsense');
        raw.scenarios.push({ ...JSON.parse(JSON.stringify(good.scenarios[0])), id: good.scenarios[0].id }); // duplicate id
        raw.sweeps.push({ id: 'badsweep', input: { id: 'nope' } });
        const other = { id: 'other', name: 'Mystery', calculatorId: 'unknown-calc', scenarios: [] };
        const result = S.sanitizeStudies({ schemaVersion: 1, studies: [raw, other, null] });
        expect(result.studies).toHaveLength(1);
        expect(result.studies[0].scenarios).toHaveLength(2);
        expect(result.studies[0].sweeps).toHaveLength(1);
        expect(result.issues.join(' ')).toMatch(/not supported/);
        expect(result.issues.length).toBeGreaterThanOrEqual(5);
    });

    it('does not trust stored results with non-finite or unit-inconsistent values', () => {
        const { S, cyl } = setup();
        const raw = JSON.parse(JSON.stringify(savedStudy(S, cyl)));
        raw.scenarios[0].result.outputs[0].value = null; // JSON turns NaN into null
        raw.scenarios[1].result.outputs[3].unit = 'mm';
        const study = S.sanitizeStudies({ schemaVersion: 1, studies: [raw] }).studies[0];
        study.scenarios.forEach((s) => { expect(s.result).toBeNull(); expect(s.status).toBe('new'); });
        expect(study.scenarios[0].inputs.boreDiameter).toBe(100); // inputs survive
    });

    it('marks results from another calculator revision as stale', () => {
        const { S, cyl } = setup();
        const raw = JSON.parse(JSON.stringify(savedStudy(S, cyl)));
        raw.scenarios[0].result.calculatorVersion = '0';
        expect(S.sanitizeStudies({ schemaVersion: 1, studies: [raw] }).studies[0].scenarios[0].status).toBe('stale');
    });

    it('handles corrupt and outdated storage without crashing and keeps a backup', () => {
        const { S } = setup();
        const corrupt = memoryStorage({ [S.STORAGE_KEY]: '{not json' });
        const r1 = S.createStudyStore(corrupt).load();
        expect(r1.studies).toEqual([]);
        expect(r1.issues[0]).toMatch(/corrupt/);
        expect(corrupt.data[S.BACKUP_KEY]).toBe('{not json');
        const old = memoryStorage({ [S.STORAGE_KEY]: JSON.stringify({ schemaVersion: 0, studies: [{ id: 'x' }] }) });
        const r2 = S.createStudyStore(old).load();
        expect(r2.studies).toEqual([]);
        expect(r2.issues[0]).toMatch(/outdated/);
        expect(old.data[S.BACKUP_KEY]).toContain('"schemaVersion":0');
        expect(S.createStudyStore(memoryStorage()).load()).toEqual({ studies: [], issues: [] });
    });

    it('falls back to memory when storage is unavailable or full', () => {
        const { S, cyl } = setup();
        const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} };
        const store = S.createStudyStore(full);
        expect(store.save([savedStudy(S, cyl)])).toBe(false);
        expect(store.load().studies).toHaveLength(1);
        expect(S.createStudyStore(null).save([])).toBe(false);
    });
});

describe('report integration', () => {
    it('builds an immutable scenario snapshot and adds it to the project report', () => {
        const { S, cyl, report } = setup();
        let study = S.createStudy('Actuator', 'cylinder-force');
        const a = calcCylinder(S, cyl, 'Baseline');
        study = S.addScenario(study, a);
        const built = S.scenarioReportSnapshot(study, study.scenarios[0]);
        expect(built.ok).toBe(true);
        const store = report.createProjectStore(memoryStorage());
        const added = store.addEntry(built.snapshot);
        expect(added.ok).toBe(true);
        expect(added.entry.study).toMatchObject({ name: 'Actuator', kind: 'scenario', scenarios: ['Baseline'] });
        expect(added.entry.inputs.find((i) => i.label.startsWith('Bore'))).toMatchObject({ value: 100, unit: 'mm' });
        expect(added.entry.outputs.find((o) => /extension/.test(o.label)).value).toBeCloseTo(78.5398, 3);
        expect(added.entry.equations.length).toBeGreaterThan(0);
        expect(added.entry.assumptions.length).toBeGreaterThan(0);
        expect(added.entry.path).toBe('design-studies.html');
        // later changes to the study do not alter the stored entry
        const edited = S.replaceScenario(study, S.calculateScenario(cyl, S.setScenarioInput(cyl, study.scenarios[0], 'workingPressure', 999)));
        expect(edited.scenarios[0].result.outputs.find((o) => o.id === 'extensionForce').value).toBeGreaterThan(500);
        expect(store.load().entries[0].outputs.find((o) => /extension/.test(o.label)).value).toBeCloseTo(78.5398, 3);
    });

    it('rejects report snapshots for scenarios without a current result', () => {
        const { S, cyl } = setup();
        const study = S.addScenario(S.createStudy('S', 'cylinder-force'), S.createScenario(cyl, 'x', cylInputs));
        expect(S.scenarioReportSnapshot(study, study.scenarios[0]).ok).toBe(false);
    });

    it('stores comparison snapshots with tables and baseline-relative differences', () => {
        const { S, cyl, report } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const b = calcCylinder(S, cyl, 'B', { ...cylInputs, workingPressure: 150 });
        const study = S.addScenario(S.addScenario(S.createStudy('Cmp', 'cylinder-force'), a), b);
        const built = S.comparisonReportSnapshot(study, [a, b], a.id);
        expect(built.ok).toBe(true);
        const entry = report.createProjectStore(memoryStorage()).addEntry(built.snapshot).entry;
        expect(entry.study.kind).toBe('comparison');
        expect(entry.tables).toHaveLength(2);
        const row = entry.tables[1].rows.find((r) => r[0].startsWith('Theoretical extension'));
        expect(row[1]).toBe('78.5398 kN');
        expect(row[2]).toMatch(/\+39\.2699 kN \(\+50 %\)/);
        expect(S.comparisonReportSnapshot(study, [a], a.id).ok).toBe(false);
    });

    it('stores sweep snapshots with the numerical table, chart data and failed points', () => {
        const { S, cyl, report } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const study = S.addScenario(S.createStudy('Sweepy', 'cylinder-force'), a);
        const sweep = S.runSweep(cyl, a, { inputId: 'rodDiameter', outputId: 'retractionForce', start: 0, end: 120, mode: 'step', step: 40 }).sweep;
        const built = S.sweepReportSnapshot(study, sweep);
        expect(built.ok).toBe(true);
        const store = report.createProjectStore(memoryStorage());
        const entry = store.addEntry(built.snapshot).entry;
        expect(entry.study.kind).toBe('sweep');
        expect(entry.tables[0].rows).toHaveLength(4);
        expect(entry.tables[0].rows[3]).toEqual(['120', 'FAILED', expect.stringMatching(/smaller than the bore/)]);
        expect(entry.chart.points[3]).toEqual({ x: 120, y: null });
        expect(entry.chart.xLabel).toMatch(/\[mm\]/);
        expect(entry.chart.yLabel).toMatch(/\[kN\]/);
        expect(entry.warnings.join(' ')).toMatch(/model-based exploration/);
        expect(entry.inputs.find((i) => /Bore/.test(i.label)).value).toBe(100);
        // survives a reload through sanitisation
        expect(store.load().entries[0].chart.points).toHaveLength(4);
    });

    it('rejects sweeps with no valid points and malformed tables/charts in the report builder', () => {
        const { S, cyl, report } = setup();
        const a = calcCylinder(S, cyl, 'A');
        const study = S.addScenario(S.createStudy('S', 'cylinder-force'), a);
        const sweep = S.runSweep(cyl, a, { inputId: 'rodDiameter', outputId: 'retractionForce', start: 100, end: 200, mode: 'count', count: 2 }).sweep;
        expect(S.sweepReportSnapshot(study, sweep).ok).toBe(false);
        const base = { calculatorId: 'x', inputs: [{ label: 'a', value: 1, unit: '' }], outputs: [{ label: 'b', value: 2, unit: '' }] };
        expect(report.validateSnapshot({ ...base, tables: [{ caption: 'c', columns: ['a'], rows: [[NaN]] }] }).ok).toBe(false);
        expect(report.validateSnapshot({ ...base, tables: [{ caption: 'c', columns: ['a', 'b'], rows: [['x']] }] }).ok).toBe(false);
        expect(report.validateSnapshot({ ...base, chart: { type: 'line', points: [{ x: NaN, y: 1 }] } }).ok).toBe(false);
        expect(report.validateSnapshot({ ...base, chart: { type: 'bar', points: [] } }).ok).toBe(false);
        expect(report.validateSnapshot(base).snapshot.tables).toBeUndefined();
    });
});

describe('registry', () => {
    it('only registers valid adapters and exposes the supported calculators', () => {
        const { S } = setup();
        expect(S.listAdapters().map((a) => a.id).sort()).toEqual([
            'beam-bending-stress', 'beam-deflection', 'cylinder-force',
            'differential-thermal-expansion', 'hertzian-contact', 'press-fit', 'shaft-torsion'
        ]);
        expect(() => S.registerAdapter({ id: 'Bad Id' })).toThrow();
        expect(() => S.registerAdapter({ id: 'ok', name: 'n', version: '1', path: 'p.html', groups: {}, inputs: [{ id: 'x', group: 'missing' }], outputs: [], calculate() {} })).toThrow(/unknown unit group/);
        expect(S.getAdapter('toString')).toBeNull();
        expect(S.createStudy('x', 'beam-deflection').calculatorId).toBe('beam-deflection');
    });
});

function calculateStudyScenario(S, calculatorId, name, inputs, units) {
    const adapter = S.getAdapter(calculatorId);
    return S.calculateScenario(adapter, S.createScenario(adapter, name, inputs, units));
}

describe('engineering calculator study adapters', () => {
    it('calculates press-fit reference values, converts units, rejects invalid geometry, sweeps gaps, and snapshots reports', () => {
        const { S, report } = setup();
        const press = S.getAdapter('press-fit');
        const inputs = {
            interfaceDiameter: 50, diametralInterference: 0.05, hubOuterDiameter: 100,
            shaftBoreDiameter: 0, engagementLength: 50, frictionCoefficient: 0.12,
            hubMaterial: 'carbon-steel', shaftMaterial: 'carbon-steel'
        };
        const base = calculateStudyScenario(S, press.id, 'Metric', inputs);
        expect(base.status).toBe('calculated');
        expect(out(base, 'contactPressure').value).toBeCloseTo(75, 2);
        expect(out(base, 'assemblyForce').value).toBeCloseTo(70.6858, 2);
        expect(out(base, 'torqueCapacity').value).toBeCloseTo(1767.15, 1);

        const inch = calculateStudyScenario(S, press.id, 'Imperial', {
            ...inputs,
            interfaceDiameter: 50 / 25.4, diametralInterference: 0.05 / 25.4,
            hubOuterDiameter: 100 / 25.4, engagementLength: 50 / 25.4
        }, { distance: 'in', interference: 'in', stress: 'psi', force: 'lbf', torque: 'lbf·ft' });
        expect(out(inch, 'contactPressure').value).toBeCloseTo(75e6 / 6894.757, 1);
        expect(out(inch, 'assemblyForce').value).toBeCloseTo(70685.8 / 4.4482216152605, 0);
        expect(S.compareScenarios([base, inch], base.id).ok).toBe(true);

        const adapter = S.getAdapter(press.id);
        const sweep = S.runSweep(adapter, base, {
            inputId: 'hubOuterDiameter', outputId: 'contactPressure', start: 49, end: 51, mode: 'count', count: 3
        }).sweep;
        expect(sweep.failedCount).toBe(2);
        expect(sweep.points.map((point) => point.y === null)).toEqual([true, true, false]);
        const study = S.addScenario(S.createStudy('Press-fit report', press.id), base);
        const built = S.scenarioReportSnapshot(study, base);
        expect(built.ok).toBe(true);
        const added = report.createProjectStore(memoryStorage()).addEntry(built.snapshot);
        expect(added.ok).toBe(true);
        expect(added.entry.assumptions.join(' ')).toMatch(/Lamé/);
        const studyStore = S.createStudyStore(memoryStorage());
        expect(studyStore.save([study])).toBe(true);
        expect(studyStore.load().studies[0].scenarios[0].inputs.hubMaterial).toBe('carbon-steel');

        const invalid = S.calculateScenario(adapter, S.createScenario(adapter, 'Invalid', { ...inputs, hubOuterDiameter: 50 }));
        expect(invalid.status).toBe('error');
        expect(invalid.error).toMatch(/Hub outer diameter/);
        const edited = S.setScenarioInput(adapter, S.duplicateScenario(base, 'Edited'), 'frictionCoefficient', 0.2);
        expect(edited.status).toBe('stale');
        expect(S.compareScenarios([base, edited], base.id).ok).toBe(false);
    });

    it('keeps Hertzian line and point contact models separate and matches independent references in both unit systems', () => {
        const { S } = setup();
        const hertz = S.getAdapter('hertzian-contact');
        const steel = { modulus1: 200, poisson1: 0.3, modulus2: 200, poisson2: 0.3 };
        const cylinder = calculateStudyScenario(S, hertz.id, 'Cylinders', {
            configuration: 'cylinders', shape2: 'convex', diameter1: 100, diameter2: 100,
            contactLength: 40, contactForce: 20000, ...steel
        });
        expect(cylinder.status).toBe('calculated');
        expect(out(cylinder, 'maxPressure').value).toBeCloseTo(836.41, 1);
        expect(out(cylinder, 'halfWidth').value).toBeCloseTo(0.380567, 5);

        const inch = calculateStudyScenario(S, hertz.id, 'Cylinder imperial', {
            configuration: 'cylinders', shape2: 'convex', diameter1: 100 / 25.4, diameter2: 100 / 25.4,
            contactLength: 40 / 25.4, contactForce: 20000 / 4.4482216152605,
            modulus1: 200e9 / 6894.757, poisson1: 0.3, modulus2: 200e9 / 6894.757, poisson2: 0.3
        }, { distance: 'in', contactSize: 'in', force: 'lbf', modulus: 'psi', stress: 'psi', lineLoad: 'lbf/ft' });
        expect(S.convertUnit(hertz, 'stress', out(inch, 'maxPressure').value, 'psi', 'MPa')).toBeCloseTo(836.41, 1);
        expect(S.compareScenarios([cylinder, inch], cylinder.id).ok).toBe(true);

        const sphere = calculateStudyScenario(S, hertz.id, 'Sphere on flat', {
            configuration: 'spheres', shape2: 'flat', diameter1: 50, diameter2: null,
            contactLength: null, contactForce: 500, modulus1: 200, poisson1: 0.3, modulus2: 69, poisson2: 0.33
        });
        expect(out(sphere, 'contactRadius').value).toBeCloseTo(0.547069, 5);
        expect(out(sphere, 'maxPressure').value).toBeCloseTo(797.676, 1);
        expect(out(sphere, 'contactWidth')).toBeUndefined();
        expect(S.compareScenarios([cylinder, sphere], cylinder.id)).toMatchObject({ ok: false, error: expect.stringMatching(/incompatible calculation models/) });
        const concave = calculateStudyScenario(S, hertz.id, 'Concave cylinder', {
            configuration: 'cylinders', shape2: 'concave', diameter1: 50, diameter2: 60,
            contactLength: 20, contactForce: 10000, ...steel
        });
        const sweep = S.runSweep(hertz, concave, {
            inputId: 'diameter2', outputId: 'maxPressure', start: 45, end: 55, mode: 'count', count: 3
        }).sweep;
        expect(sweep.failedCount).toBe(2);
        const study = S.addScenario(S.createStudy('Hertz report', hertz.id), sphere);
        expect(S.scenarioReportSnapshot(study, sphere).snapshot.assumptions.join(' ')).toMatch(/Linear elastic/);
        const invalid = S.calculateScenario(hertz, S.createScenario(hertz, 'Invalid', {
            configuration: 'cylinders', shape2: 'concave', diameter1: 50, diameter2: 50,
            contactLength: 20, contactForce: 100, ...steel
        }));
        expect(invalid.status).toBe('error');
        expect(invalid.error).toMatch(/larger diameter/);
    });

    it('calculates solid and hollow shaft torsion from explicit geometry and preserves stress/twist references', () => {
        const { S } = setup();
        const shaft = S.getAdapter('shaft-torsion');
        const inputs = {
            shaftType: 'solid', torque: 500, outerDiameter: 0.05, innerDiameter: null,
            length: 2, shearModulus: 80
        };
        const base = calculateStudyScenario(S, shaft.id, 'Solid', inputs, { angle: 'rad' });
        const J = Math.PI * 0.05 ** 4 / 32;
        expect(out(base, 'polarMoment').value).toBeCloseTo(J, 13);
        expect(out(base, 'maximumShearStress').value).toBeCloseTo(20.3718, 3);
        expect(out(base, 'angleOfTwist').value).toBeCloseTo(500 * 2 / (80e9 * J), 8);

        const imperial = calculateStudyScenario(S, shaft.id, 'Imperial', {
            shaftType: 'solid', torque: 500 / 1.35581795, outerDiameter: 0.05 / 0.0254,
            innerDiameter: null, length: 2 / 0.3048, shearModulus: 80e9 / 6894.757
        }, { torque: 'lbf·ft', shaftDiameter: 'in', length: 'ft', modulus: 'psi', stress: 'ksi', angle: 'rad' });
        expect(out(imperial, 'maximumShearStress').value).toBeCloseTo(out(base, 'maximumShearStress').value / 6.894757, 3);
        expect(out(imperial, 'angleOfTwist').value).toBeCloseTo(out(base, 'angleOfTwist').value, 8);
        const comparison = S.compareScenarios([base, imperial], base.id);
        expect(comparison).toMatchObject({ ok: true });

        const hollow = calculateStudyScenario(S, shaft.id, 'Hollow', {
            ...inputs, shaftType: 'hollow', innerDiameter: 0.04
        }, { angle: 'rad' });
        expect(out(hollow, 'polarMoment').value).toBeCloseTo(Math.PI * (0.05 ** 4 - 0.04 ** 4) / 32, 13);
        const hollowSweep = S.runSweep(shaft, hollow, {
            inputId: 'innerDiameter', outputId: 'maximumShearStress', start: 0.049, end: 0.051, mode: 'count', count: 3
        }).sweep;
        expect(hollowSweep.failedCount).toBe(2);
        const study = S.addScenario(S.createStudy('Torsion report', shaft.id), base);
        expect(S.scenarioReportSnapshot(study, base).ok).toBe(true);
        const invalid = S.calculateScenario(shaft, S.createScenario(shaft, 'Invalid', {
            ...inputs, shaftType: 'hollow', innerDiameter: 0.05
        }));
        expect(invalid.status).toBe('error');
        expect(invalid.error).toMatch(/inner diameter must be less/);
    });

    it('regresses beam bending stress and supports the existing section set, comparisons, sweeps, and invalid geometry', () => {
        const { S } = setup();
        const beam = S.getAdapter('beam-bending-stress');
        const inputs = {
            sectionType: 'rectangular', bendingAxis: 'x', section_width: 50, section_height: 100,
            moment: 1000
        };
        const base = calculateStudyScenario(S, beam.id, 'Rectangle', inputs);
        expect(base.status).toBe('calculated');
        expect(out(base, 'bendingStress').value).toBeCloseTo(12, 6);
        expect(out(base, 'inertiaX').value).toBeCloseTo(4.1666667e6, 1);
        expect(out(base, 'sectionModulusX').value).toBeCloseTo(83333.333, 1);

        const tSection = calculateStudyScenario(S, beam.id, 'T section', {
            sectionType: 't-section', bendingAxis: 'x', section_height: 120,
            section_flangeWidth: 90, section_flangeThickness: 16, section_webThickness: 12, moment: 500
        });
        expect(tSection.status).toBe('calculated');
        expect(tSection.result.equations[0]).toMatch(/\\bar{y}/);

        const sweep = S.runSweep(beam, base, {
            inputId: 'moment', outputId: 'bendingStress', start: 500, end: 1500, mode: 'count', count: 3
        }).sweep;
        sweep.points.forEach((point, index) => expect(point.y).toBeCloseTo([6, 12, 18][index], 10));
        expect(S.compareScenarios([base, tSection], base.id).ok).toBe(true);
        const study = S.addScenario(S.createStudy('Bending report', beam.id), base);
        expect(S.scenarioReportSnapshot(study, base).ok).toBe(true);
        const invalid = S.calculateScenario(beam, S.createScenario(beam, 'Invalid', {
            ...inputs, section_height: 0
        }));
        expect(invalid.status).toBe('error');
        expect(invalid.error).toMatch(/positive finite dimension/);
    });

    it('regresses each beam-deflection calculation case and handles unit conversion and report snapshots', () => {
        const { S, report } = setup();
        const beam = S.getAdapter('beam-deflection');
        const inputs = {
            loadingCase: 'ss-point', span: 2, pointLoad: 1000, uniformLoad: null, youngsModulus: 200,
            sectionType: 'rectangular', section_width: 100, section_height: 100, bendingAxis: 'x'
        };
        const base = calculateStudyScenario(S, beam.id, 'Simply supported', inputs, { deflection: 'mm' });
        expect(base.status).toBe('calculated');
        expect(out(base, 'signedDeflection').value).toBeCloseTo(0.1, 8);
        expect(out(base, 'maximumMoment').value).toBeCloseTo(500, 8);

        const imperial = calculateStudyScenario(S, beam.id, 'Imperial', {
            ...inputs,
            span: 2 / 0.3048,
            section_width: 100 / 25.4,
            section_height: 100 / 25.4,
            pointLoad: 1000 / 4.4482216152605,
            youngsModulus: 200e9 / 6894.757
        }, {
            span: 'ft', distance: 'in', force: 'lbf', modulus: 'psi', deflection: 'in', moment: 'lbf·ft',
            lengthOutput: 'in', area: 'in²', inertia: 'in⁴', sectionModulus: 'in³'
        });
        expect(out(imperial, 'signedDeflection').value).toBeCloseTo(0.1 / 25.4, 5);
        const comparison = S.compareScenarios([base, imperial], base.id);
        expect(comparison).toMatchObject({ ok: true });

        const cantilever = calculateStudyScenario(S, beam.id, 'Cantilever', {
            ...inputs, loadingCase: 'cant-point'
        }, { deflection: 'm' });
        expect(out(cantilever, 'signedDeflection').value).toBeCloseTo(0.0016, 8);
        const sweep = S.runSweep(beam, base, {
            inputId: 'span', outputId: 'deflectionMagnitude', start: 1, end: 3, mode: 'count', count: 3
        }).sweep;
        sweep.points.forEach((point, index) => expect(point.y).toBeCloseTo([0.0125, 0.1, 0.3375][index], 10));
        const study = S.addScenario(S.createStudy('Beam report', beam.id), base);
        const built = S.scenarioReportSnapshot(study, base);
        expect(built.ok).toBe(true);
        expect(report.createProjectStore(memoryStorage()).addEntry(built.snapshot).ok).toBe(true);
        const edited = S.setScenarioInput(beam, base, 'loadingCase', 'cant-point');
        expect(edited.status).toBe('stale');
        expect(S.compareScenarios([base, edited], base.id).ok).toBe(false);
    });

    it('uses saved material presets for elastic and thermal properties while allowing numeric overrides', () => {
        const { S } = setup();
        const hertz = S.getAdapter('hertzian-contact');
        const contact = calculateStudyScenario(S, hertz.id, 'Material contact', {
            configuration: 'spheres', shape2: 'flat', diameter1: 50, diameter2: null,
            contactLength: null, contactForce: 500, material1: 'carbon-steel', material2: 'aluminum'
        });
        expect(contact.status).toBe('calculated');
        expect(out(contact, 'maxPressure').value).toBeCloseTo(795.083, 1);
        expect(contact.result.inputs.find((input) => input.id === 'modulus1')).toMatchObject({ value: 200, unit: 'GPa' });
        expect(contact.result.inputs.find((input) => input.id === 'poisson1').value).toBe(0.27);
        expect(hertz.inputs.find((input) => input.id === 'material1').options).toContain('carbon-steel');

        const shaft = S.getAdapter('shaft-torsion');
        const torsionInputs = {
            shaftType: 'solid', torque: 500, outerDiameter: 0.05, innerDiameter: null,
            length: 2, material: 'carbon-steel', shearModulus: null
        };
        const torsion = calculateStudyScenario(S, shaft.id, 'Material shaft', torsionInputs);
        expect(out(torsion, 'maximumShearStress').value).toBeCloseTo(20.3718, 3);
        expect(torsion.result.inputs.find((input) => input.id === 'shearModulus')).toMatchObject({ value: 80, unit: 'GPa' });
        expect(shaft.inputs.find((input) => input.id === 'material').options).toContain('carbon-steel');
        const imperialTorsion = calculateStudyScenario(S, shaft.id, 'Material shaft imperial', torsionInputs, {
            modulus: 'psi', stress: 'ksi', angle: 'rad'
        });
        expect(out(imperialTorsion, 'maximumShearStress').value).toBeCloseTo(out(torsion, 'maximumShearStress').value / 6.894757, 3);
        expect(imperialTorsion.result.inputs.find((input) => input.id === 'shearModulus'))
            .toMatchObject({ value: 80e9 / 6894.757, unit: 'psi' });
        const override = calculateStudyScenario(S, shaft.id, 'Custom G', { ...torsionInputs, shearModulus: 40 });
        expect(out(override, 'maximumShearStress').value).toBeCloseTo(out(torsion, 'maximumShearStress').value, 8);
        expect(out(override, 'angleOfTwist').value).toBeCloseTo(out(torsion, 'angleOfTwist').value * 2, 8);

        const beam = S.getAdapter('beam-deflection');
        const deflection = calculateStudyScenario(S, beam.id, 'Material beam', {
            loadingCase: 'ss-point', span: 2, pointLoad: 1000, uniformLoad: null, material: 'carbon-steel',
            youngsModulus: null, sectionType: 'rectangular', section_width: 100, section_height: 100, bendingAxis: 'x'
        }, { deflection: 'mm' });
        expect(out(deflection, 'signedDeflection').value).toBeCloseTo(0.1, 8);
        expect(deflection.result.inputs.find((input) => input.id === 'youngsModulus')).toMatchObject({ value: 200, unit: 'GPa' });

        const dte = S.getAdapter('differential-thermal-expansion');
        const expansion = calculateStudyScenario(S, dte.id, 'Material expansion', {
            A1Length: 1000, A1Material: 'carbon-steel', A1Ti: 20, A1Tf: 120,
            B1Length: 1000, B1Material: 'aluminum', B1Ti: 20, B1Tf: 120
        });
        expect(out(expansion, 'memberAExpansion').value).toBeCloseTo(1.2, 8);
        expect(out(expansion, 'memberBExpansion').value).toBeCloseTo(2.36, 8);
        expect(out(expansion, 'differential').value).toBeCloseTo(-1.16, 8);
        expect(expansion.result.inputs.find((input) => input.id === 'A1Alpha')).toMatchObject({ value: 12, unit: '10⁻⁶/°C' });
        expect(dte.inputs.find((input) => input.id === 'A1Material').options).toContain('carbon-steel');
    });
});

describe('sweep of blank optional inputs', () => {
    it('refuses to vary an input that has no baseline value', () => {
        const { S, dte } = setup();
        const base = S.calculateScenario(dte, S.createScenario(dte, 'Base', dteInputs));
        const r = S.runSweep(dte, base, { inputId: 'B2Length', outputId: 'differential', start: 1, end: 2, mode: 'count', count: 2 });
        expect(r.ok).toBe(false);
        expect(r.errors.join()).toMatch(/no value in the baseline/);
    });
});
