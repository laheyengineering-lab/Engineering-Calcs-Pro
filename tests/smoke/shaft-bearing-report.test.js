import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { loadCalculatorPage, loadCore } from '../helpers/browser-test-utils.js';

const reportKey = 'formulaFoundry.projectReport';
const workflowScripts = [
    'js/engineering-units.js', 'js/beam-section-properties.js', 'js/beam-study-calculations.js',
    'js/shaft-torsion-calculation.js', 'js/bearing-life-calculation.js', 'js/factor-of-safety-calculation.js',
    'js/shaft-bearing-core.js', 'js/shaft-bearing-project.js', 'js/shaft-bearing-example.js',
    'js/engineering-diagram.js', 'js/calculator-diagrams.js', 'js/shaft-bearing-diagram.js',
    'js/report-builder.js', 'js/shaft-bearing-report.js'
];

function openPage(path, storage) {
    const scripts = [...readFileSync(path, 'utf8').matchAll(/<script src="(?:\.\.\/)?(js\/[^"]+)"><\/script>/g)]
        .map((match) => match[1]).filter((script) => script !== 'js/katex-loader.js');
    return loadCalculatorPage(path, scripts, (window) => {
        Object.defineProperty(window, 'localStorage', { value: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, source) => storage.set(key, String(source))
        } });
        window.confirm = vi.fn(() => true);
    });
}

function shaftExample() {
    const fixture = loadCore(workflowScripts);
    const { window } = fixture;
    const projects = window.FormulaFoundryShaftProject;
    const calculate = window.FormulaFoundryShaftBearing.calculate;
    const snapshot = window.FormulaFoundryShaftReport.buildSnapshot;
    const project = window.FormulaFoundryShaftExample.create(projects);
    const solve = (configuration) => projects.solved(configuration, calculate(configuration.inputs));
    project.configurations[0] = solve(project.configurations[0]);
    return { ...fixture, project, projects, solve, snapshot };
}

it('captures a frozen analysis and refreshes report units without recalculation', () => {
    const fixture = shaftExample();
    const { window, project, projects, solve, snapshot } = fixture;
    const report = window.FormulaFoundryReport;
    try {
        const base = project.configurations[0];
        const input = (label) => snapshot(project).inputs.find((entry) => entry.label === label);
        expect(input('Material condition').value).toMatch(/cold drawn/i);
        expect(input('Young’s modulus basis').value).toMatch(/nominal|typical/i);

        const alternative = projects.duplicate(base);
        alternative.name = '45 mm alternative';
        alternative.inputs.outerDiameter = 0.045;
        project.configurations.push(solve(alternative));
        project.activeId = alternative.id;

        const current = projects.current(project.configurations[1]);
        const sweep = { configurationId: alternative.id, ...window.FormulaFoundryShaftBearing.runSweep(alternative.inputs, {
            start: 0.04, end: 0.045, count: 2
        }) };
        const before = report.addSnapshot(snapshot(project, { includeComparison: true, sweep }));
        expect(before.ok, before.error).toBe(true);
        expect(before.entry.tables).toHaveLength(5);
        expect(before.entry.chart.points).toHaveLength(before.entry.tables[2].rows.length);
        before.entry.chart.points.forEach(({ x, y }, index) => {
            expect(before.entry.tables[2].rows[index][0]).toBe(x);
            expect(before.entry.tables[2].rows[index][8]).toBe(y);
        });
        const bearingRows = before.entry.tables[1].rows;
        expect(bearingRows.find(([label]) => label.startsWith('Signed reaction Ry')).slice(1)).toEqual([960, 640]);
        expect(bearingRows.find(([label]) => label.startsWith('Signed reaction Rz')).slice(1)).toEqual([-720, -480]);
        const compare = window.FormulaFoundryShaftReport.comparisonRows(project, alternative.units);
        expect(compare.find(({ label }) => label === 'Peak nominal equivalent stress').values[1].delta)
            .toBeCloseTo(100 * ((40 / 45) ** 3 - 1), 10);
        expect(compare.find(({ label }) => label === 'Bearing A radial reaction').values[1].delta).toBe(0);

        project.configurations[1] = projects.changeUnit(project.configurations[1], 'stress', 'psi');
        expect(projects.current(project.configurations[1])).toBe(current);
        const after = snapshot(project, { includeComparison: true, sweep });
        const equivalent = (entry) => entry.outputs.find(({ label }) => label === 'Maximum nominal von Mises equivalent stress');
        expect(equivalent(before.entry).unit).toBe('MPa');
        expect(equivalent(after).unit).toBe('psi');
        expect(equivalent(after).value / equivalent(before.entry).value).toBeCloseTo(1e6 / 6894.757, 10);
        expect(after.chart.yLabel).toContain('(psi)');
        expect(after.tables[4].columns[1]).toContain('(psi)');

        project.configurations[1] = projects.edit(project.configurations[1], { ...alternative.inputs, outerDiameter: 0.05 });
        expect(snapshot(project)).toBeNull();
        expect(report.store.load().entries[0]).toEqual(before.entry);
    } finally {
        fixture.dom.window.close();
    }
});

it('retains finite shaft results when optional properties or bearing-life inputs are unavailable', () => {
    const fixture = shaftExample();
    const { window, project, projects, solve, snapshot } = fixture;
    try {
        const base = project.configurations[0];
        const inputs = projects.applyMaterial(base.inputs, '');
        project.configurations[0] = solve({ ...base, inputs: { ...inputs, speed: 0 } });
        const bearingRow = (entry, label) => entry.tables[1].rows.find(([name]) => name === label).slice(1);
        const stopped = snapshot(project);
        expect(bearingRow(stopped, 'Basic L10 (million rev)')[0]).toBeCloseTo(343, 10);
        expect(bearingRow(stopped, 'Basic L10 (h)')).toEqual(['Undefined at zero speed', 'Undefined at zero speed']);

        const zeroForce = { ...inputs.loads[0], fy: 0, fz: 0 };
        project.configurations[0] = solve({ ...base, inputs: {
            ...inputs, loads: [zeroForce], speed: 0, torque: { value: 0, start: 0, end: 0 }
        } });
        const entry = snapshot(project);
        expect(entry).not.toBeNull();
        expect(entry.inputs.find(({ label }) => label === 'Young’s modulus basis').value).toBe('Unavailable');
        expect(entry.outputs.find(({ label }) => label === 'Maximum resultant displacement (numerically located)').value).toBe('—');
        expect(bearingRow(entry, 'Basic L10 (h)')).toEqual([
            'Undefined at zero modeled radial load', 'Undefined at zero modeled radial load'
        ]);
        const report = window.FormulaFoundryReport;
        expect(report.addSnapshot(entry).ok).toBe(true);
        expect(report.parseProjectJSON(JSON.stringify(report.store.load())).ok).toBe(true);
    } finally {
        fixture.dom.window.close();
    }
});

it('imports a schema-v1 report containing shaft, legacy, Design Studies, and Fluid System Designer entries', async () => {
    const fixture = shaftExample();
    const { window, project, snapshot } = fixture;
    const sourceStorage = new Map([[reportKey, readFileSync('tests/fixtures/project-report-before-graphics-2.json', 'utf8')]]);
    const fluid = openPage('workflows/fluid-system.html', sourceStorage);
    const targetStorage = new Map();
    const reportPage = openPage('report.html', targetStorage);
    try {
        const report = window.FormulaFoundryReport;
        report.store.setStorage({
            getItem: (key) => sourceStorage.get(key) ?? null,
            setItem: (key, value) => sourceStorage.set(key, String(value))
        });
        expect(report.addSnapshot({
            calculatorId: 'moment', calculatorName: 'Moment', title: 'Lever study baseline',
            inputs: [{ label: 'Applied force', value: 120, unit: 'N' }],
            outputs: [{ label: 'Moment', value: 60, unit: 'N·m' }],
            study: { id: 'lever-study', name: 'Lever study', kind: 'scenario', scenarios: ['Baseline'], savedAt: '2026-10-04' }
        }).ok).toBe(true);

        fluid.document.getElementById('loadExample').click();
        fluid.document.getElementById('calculate').click();
        fluid.document.getElementById('addToReport').click();
        expect(report.addSnapshot(snapshot(project)).ok).toBe(true);

        const fileInput = reportPage.document.getElementById('projectFile');
        const source = sourceStorage.get(reportKey);
        const file = new reportPage.window.File([source], 'mixed-report.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fileInput.dispatchEvent(new reportPage.window.Event('change', { bubbles: true }));
        await vi.waitFor(() => expect(targetStorage.get(reportKey)).toBe(source));

        const document = reportPage.document;
        expect(document.querySelector('svg[data-diagram-id="fluid-system"]')).not.toBeNull();
        expect(document.querySelector('.report-profile-diagram.beam-interactive-diagram svg')).not.toBeNull();
        expect(document.querySelector('.report-document').textContent).toContain('Design study: Lever study');
        const shaft = document.querySelector('svg[data-diagram-id="shaft-bearing"]').closest('.report-entry');
        expect(shaft.querySelector('.report-chart svg')).not.toBeNull();
        expect(shaft.querySelector('.report-chart figcaption').textContent).toContain('torque boundary');
        expect(shaft.querySelector('.report-source-link').getAttribute('href')).toBe('workflows/shaft-bearing.html');
        expect(shaft.textContent).toContain('Governing equations');

        const invalid = JSON.parse(source);
        invalid.entries.at(-1).diagram.model.reactions.pop();
        expect(reportPage.window.FormulaFoundryReport.parseProjectJSON(JSON.stringify(invalid)).error).toMatch(/diagram model is invalid/i);
        expect(targetStorage.get(reportKey)).toBe(source);
    } finally {
        fixture.dom.window.close();
        fluid.dom.window.close();
        reportPage.dom.window.close();
    }
});
