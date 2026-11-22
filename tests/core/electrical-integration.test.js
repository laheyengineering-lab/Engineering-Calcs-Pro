import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const references = [
    ['ohms-law', { known: 'VR', voltage: 12, resistance: 120 }, 'current', 0.1, 'voltage'],
    ['circuit-studio', { mode: 'series', count: '2', sourceVoltage: 12, r1: 100, r2: 200 }, 'totalCurrent', 0.04, 'sourceVoltage'],
    ['kirchhoff-circuit', { leftVoltage: 12, rightVoltage: 6, leftResistance: 100, centerResistance: 100, rightResistance: 100 },
        'center', 6, 'leftVoltage'],
    ['electrical-divider', { mode: 'loaded', sourceVoltage: 12, r1: 1000, r2: 2000, loadResistance: 2000 },
        'outputVoltage', 6, 'sourceVoltage'],
    ['dc-wire-voltage-drop', { supplyVoltage: 12, loadCurrent: 5, oneWayLength: 10, material: 'copper',
        temperature: 20, sizeMode: 'area', area: 2 }, 'voltageDrop', 0.86205, 'loadCurrent'],
    ['rc-transients', { resistance: 2000, capacitance: 500, initialVoltage: 2, sourceVoltage: 10, time: 693.1471805599453 },
        'capacitorVoltage', 6, 'time'],
    ['rl-transients', { resistance: 4, inductance: 8000, initialCurrent: -1, sourceVoltage: 12, time: 1386.2943611198906 },
        'current', 1, 'sourceVoltage'],
    ['rlc-impedance', { resistance: 3, inductance: 40 / Math.PI, capacitance: 1250 / Math.PI, frequency: 50, voltage: 10 },
        'impedanceMagnitude', 5, 'frequency'],
    ['ac-power-factor', { voltage: 120, current: 5, mode: 'power-factor', powerFactor: 0.8, direction: 'leading' },
        'realPower', 480, 'current'],
    ['speaker-impedance', { mode: 'parallel', count: '2', r1: 8, r2: 8, sourceMode: 'voltage', rmsVoltage: 10, minimumLoad: 6 },
        'totalPower', 25, 'rmsVoltage']
];

let page, studies, report, diagrams;
beforeAll(() => {
    page = loadCore([
        'js/engineering-units.js', 'js/calculator-data.js', 'js/electrical-dc-calculations.js',
        'js/electrical-practical-calculations.js', 'js/electrical-transient-ac-calculations.js', 'js/electrical-models.js',
        'js/engineering-diagram.js', 'js/calculator-diagrams.js', 'js/electrical-diagrams.js',
        'js/design-study-core.js', 'js/electrical-study-adapters.js', 'js/report-builder.js'
    ]);
    studies = page.window.FormulaFoundryStudies;
    report = page.window.FormulaFoundryReport;
    diagrams = page.window.FormulaFoundryCalculatorDiagrams;
});
afterAll(() => page?.dom.window.close());

describe('electrical unit groups', () => {
    it.each([
        ['ohms-law', 'voltage', 'V', [['mV', 0.001], ['kV', 1000]]],
        ['ohms-law', 'current', 'A', [['mA', 0.001], ['µA', 0.000001]]],
        ['rlc-impedance', 'resistance', 'Ω', [['kΩ', 1000], ['MΩ', 1000000]]],
        ['rc-transients', 'capacitance', 'F', [['mF', 0.001], ['µF', 1e-6], ['nF', 1e-9], ['pF', 1e-12]]],
        ['rl-transients', 'inductance', 'H', [['mH', 0.001], ['µH', 0.000001]]],
        ['rlc-impedance', 'frequency', 'Hz', [['kHz', 1000], ['MHz', 1000000]]],
        ['rc-transients', 'time', 's', [['ms', 0.001], ['µs', 0.000001]]],
        ['ohms-law', 'power', 'W', [['mW', 0.001], ['kW', 1000]]],
        ['rc-transients', 'energy', 'J', [['Wh', 3600], ['kWh', 3600000]]],
        ['ac-power-factor', 'phase', 'rad', [['°', 0.017453292519943295]]]
    ])('converts %s %s to and from coherent SI', (id, group, baseUnit, alternatives) => {
        const adapter = studies.getAdapter(id);
        for (const [unit, base] of alternatives) {
            expect(studies.convertUnit(adapter, group, 3, unit, baseUnit) / base).toBeCloseTo(3, 13);
            expect(studies.convertUnit(adapter, group, 3 * base, baseUnit, unit)).toBeCloseTo(3, 13);
        }
    });

    it('shares power and energy definitions with existing engineering units', () => {
        expect(page.window.eval('electricalUnits.power === powerUnits && electricalUnits.energy === energyUnits')).toBe(true);
        expect(page.window.eval('electricalUnits.power.kW')).toBe(page.window.eval('fluidThermalUnits.power.kW'));
        expect(page.window.eval('electricalUnits.energy.kWh')).toBe(page.window.eval('fluidThermalUnits.energy.kWh'));
    });
});

function scenarioFor(id, values, name = 'Reference circuit', units) {
    const adapter = studies.getAdapter(id);
    const scenario = studies.calculateScenario(adapter, studies.createScenario(adapter, name, values, units));
    expect(scenario.status, scenario.error).toBe('calculated');
    return { adapter, scenario };
}

function sweepFor(adapter, scenario, inputId, outputId, start, end) {
    return studies.runSweep(adapter, scenario, { inputId, outputId, start, end, count: 3, mode: 'count' });
}

function reportFor(scenario) {
    const study = studies.addScenario(studies.createStudy('Electrical case study', scenario.calculatorId), scenario);
    const result = studies.scenarioReportSnapshot(study, scenario);
    expect(result.ok, result.error).toBe(true);
    const checked = report.validateSnapshot(result.snapshot);
    expect(checked.ok, checked.error).toBe(true);
    return checked.snapshot;
}

describe.each(references)('%s Design Study', (id, values, outputId, expected, inputId) => {
    it('saves the calculator result and sweeps a continuous input around a known reference', () => {
        const { adapter, scenario } = scenarioFor(id, values);
        const storedOutput = scenario.result.outputs.find((output) => output.id === outputId);
        expect(storedOutput?.value).toBeCloseTo(expected, 11);
        const defaults = studies.calculateScenario(adapter, studies.createScenario(adapter, 'Calculator defaults'));
        expect(defaults.status, defaults.error).toBe('calculated');
        expect(scenario.result.equations.length).toBeGreaterThan(0);
        expect(scenario.result.assumptions.length).toBeGreaterThan(0);
        const run = sweepFor(adapter, scenario, inputId, outputId, values[inputId], 1.2 * values[inputId]);
        expect(run.ok, run.errors?.join(', ')).toBe(true);
        expect(run.sweep.points).toHaveLength(3);
        expect(run.sweep.failedCount).toBe(0);
        expect(run.sweep.points[0].y).toBeCloseTo(expected, 9);
        const study = studies.addSweep(studies.addScenario(studies.createStudy('Saved case', id), scenario), run.sweep);
        const store = studies.createStudyStore(null);
        store.save([study]);
        const saved = store.load().studies[0];
        expect(saved.scenarios[0].result.outputs).toEqual(scenario.result.outputs);
        expect(saved.sweeps[0].points).toEqual(run.sweep.points);
    });

    it('validates and renders an SVG from the saved scenario report', () => {
        const { scenario } = scenarioFor(id, values);
        const snapshot = reportFor(scenario);
        expect(snapshot.diagram).toMatchObject({ type: 'calc-diagram', id });
        expect(snapshot.inputs.length).toBeGreaterThan(0);
        expect(snapshot.outputs).toContainEqual(expect.objectContaining({ value: expect.any(Number) }));
        expect(snapshot.equations).toEqual(scenario.result.equations);
        expect(snapshot.assumptions).toEqual(scenario.result.assumptions);
        expect(snapshot.warnings.join(' ')).toMatch(/design study scenario calculated/i);
        const svg = diagrams.render(page.document, id, snapshot.diagram.model);
        expect(svg.getAttribute('role')).toBe('img');
        expect(svg.querySelector('title')?.textContent.length).toBeGreaterThan(0);
        expect(svg.outerHTML).not.toMatch(/\b(?:NaN|Infinity)\b/);
    });
});

describe('circuit configurations in studies and reports', () => {
    const id = 'circuit-studio';
    const series = { mode: 'series', count: '2', sourceVoltage: 12000, r1: 0.1, r2: 200 };
    const seriesUnits = { voltage: 'mV', current: 'mA', r1studio: 'kΩ' };

    it('compares across topology and count using compatible units for numeric differences', () => {
        const { scenario: baseline } = scenarioFor(id, series, 'Series', seriesUnits);
        const { scenario: alternate } = scenarioFor(id, {
            mode: 'parallel', count: '3', sourceVoltage: 12, r1: 100, r2: 200, r3: 300
        }, 'Parallel');
        const comparison = studies.compareScenarios([baseline, alternate], baseline.id);
        expect(comparison.ok, comparison.error).toBe(true);
        for (const key of ['mode', 'count']) {
            const comparisonCell = comparison.inputRows.find((row) => row.id === key).cells[1];
            expect(comparisonCell).toMatchObject({ changed: true, delta: null });
            expect(comparisonCell.note).toMatch(/categorical/i);
        }
        for (const key of ['r1', 'sourceVoltage']) {
            expect(comparison.inputRows.find((row) => row.id === key).cells[1]).toMatchObject({ changed: false, delta: 0 });
        }
        const current = comparison.outputRows.find((row) => row.id === 'totalCurrent');
        expect(current.cells[0]).toMatchObject({ unit: 'mA', value: 40 });
        expect(current.cells[1]).toMatchObject({ unit: 'A', deltaUnit: 'mA' });
        expect(current.cells[1].delta).toBeCloseTo(180, 10);
    });

    it('sweeps an active resistance in its own units and excludes categorical and inactive inputs', () => {
        const { adapter, scenario } = scenarioFor(id, series, 'Series', seriesUnits);
        const run = sweepFor(adapter, scenario, 'r1', 'totalCurrent', 0.1, 0.3);
        expect(run.ok, run.errors?.join(', ')).toBe(true);
        expect(run.sweep.input.unit).toBe('kΩ');
        expect(run.sweep.output.unit).toBe('mA');
        expect(run.sweep.points.map(({ x, y }) => [x, y])).toEqual([[0.1, 40], [0.2, 30], [0.3, 24]]);
        for (const categorical of ['mode', 'count', 'open1']) {
            const rejected = sweepFor(adapter, scenario, categorical, 'totalCurrent', 1, 2);
            expect(rejected.ok).toBe(false);
            expect(rejected.errors.join(' ')).toMatch(/cannot be varied/i);
        }
        const inactive = sweepFor(adapter, scenario, 'r3', 'totalCurrent', 1, 2);
        expect(inactive.ok).toBe(false);
        expect(inactive.errors.join(' ')).toMatch(/no value in the baseline/i);
    });

    it('keeps singular samples and open paths explicit in saved results', () => {
        const { adapter, scenario } = scenarioFor(id, { ...series, mode: 'parallel' }, 'Closed parallel', seriesUnits);
        const run = sweepFor(adapter, scenario, 'r1', 'totalCurrent', 0, 0.1);
        expect(run.sweep.failedCount).toBe(1);
        expect(run.sweep.points[0]).toMatchObject({ x: 0, y: null, error: expect.stringMatching(/ideal short/i) });
        const { scenario: open } = scenarioFor(id, { ...series, open1: 'open', open2: 'open' }, 'Open series', seriesUnits);
        expect(open.result.outputs.find((row) => row.id === 'equivalentResistance')).toBeUndefined();
        expect(open.result.outputs.find((row) => row.id === 'totalCurrent').value).toBe(0);
        expect(open.result.warnings.join(' ')).toMatch(/floating nodes/i);
        const snapshot = reportFor(open);
        expect(snapshot.inputs).toContainEqual({ label: 'R1 state', value: 'open', unit: '' });
        expect(snapshot.inputs.some((input) => input.label === 'R1 resistance')).toBe(false);
    });

    it('exports and imports electrical scenarios and companion charts through the existing project format', () => {
        const original = report.emptyProject();
        original.meta.title = 'Electrical design verification';
        original.entries = references.map(([calculatorId, values]) => reportFor(scenarioFor(calculatorId, values).scenario));
        const saved = report.createProjectStore(null);
        saved.save(original);
        const exported = JSON.stringify(saved.load(), null, 2) + '\n';
        const imported = report.parseProjectJSON(exported);
        expect(imported.ok, imported.error).toBe(true);
        expect(imported.project.schemaVersion).toBe(1);
        expect(JSON.parse(JSON.stringify(imported.project))).toEqual(JSON.parse(JSON.stringify(original)));

        const studio = imported.project.entries.find((entry) => entry.calculatorId === id);
        expect(studio.diagram.model).toMatchObject({ mode: 'series', sourceVoltage: 12 });
        expect(studio.diagram.model.components.map((row) => row[0])).toEqual([100, 200]);
        const speaker = imported.project.entries.find((entry) => entry.calculatorId === 'speaker-impedance');
        expect(speaker.warnings.join(' ')).toMatch(/below.*minimum/i);

        for (const [calculatorId, selectedX, markers] of [
            ['rc-transients', 0.6931471805599453, 3], ['rl-transients', 1.3862943611198906, 3], ['rlc-impedance', 50, 1]
        ]) {
            const entry = imported.project.entries.find((item) => item.calculatorId === calculatorId);
            const companion = entry.diagram.companion;
            expect(companion.id).toBe(calculatorId + '-response');
            expect(companion.model.selected[0][0]).toBeCloseTo(selectedX, 13);
            expect(companion.model.points.length).toBeGreaterThan(30);
            expect(companion.model.points).toContainEqual(companion.model.selected[0]);
            const svg = diagrams.render(page.document, companion.id, companion.model);
            expect(svg.querySelectorAll('[data-selected-series]')).toHaveLength(markers);
            expect(svg.outerHTML).not.toMatch(/\b(?:NaN|Infinity)\b/);
        }
    });
});
