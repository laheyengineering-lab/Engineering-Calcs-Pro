import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

const workflow = 'workflows/fluid-system.html';
const workflowKey = 'formulaFoundry.fluidSystemProject';
const reportKey = 'formulaFoundry.projectReport';

function open(path = workflow, storage = new Map()) {
    const scripts = [...readFileSync(path, 'utf8').matchAll(/<script src="(?:\.\.\/)?(js\/[^"]+)"><\/script>/g)]
        .map((match) => match[1]).filter((script) => script !== 'js/katex-loader.js');
    const fixture = loadCalculatorPage(path, scripts, (window) => {
        Object.defineProperty(window, 'localStorage', { value: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, source) => storage.set(key, String(source))
        } });
        window.confirm = vi.fn(() => true);
    });
    const { document, window } = fixture;
    const id = (key) => document.getElementById(key);
    return {
        ...fixture, storage, id, text: (key) => id(key).textContent,
        click: (key) => id(key).click(),
        set(key, value) {
            const control = typeof key === 'string' ? id(key) : key;
            control.value = String(value);
            control.dispatchEvent(new window.Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
        },
        segment: (index, key) => document.querySelectorAll('[data-segment="' + key + '"]')[index],
        import(source, fileId = 'workflowFile') {
            const input = id(fileId);
            const file = new window.File([source], 'import.json', { type: 'application/json' });
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            input.dispatchEvent(new window.Event('change', { bubbles: true }));
        }
    };
}

it('exposes the workflow in the catalogue without adding it as a calculator', () => {
    const fixture = open('index.html');
    try {
        const { document, window } = fixture;
        expect(document.querySelector('.workflows-nav-link').getAttribute('href')).toBe(workflow);
        expect(document.querySelector('.home-workflow a').getAttribute('href')).toBe(workflow);
        const calculators = window.eval('calculators');
        expect(calculators.filter(({ status }) => status !== 'coming-soon')).toHaveLength(36);
        expect(calculators.some(({ id }) => id === 'fluid-system')).toBe(false);
    } finally {
        fixture.dom.window.close();
    }
});

it('shows meaningful draft errors, converts a segment, and clears stale annotations on edits', () => {
    const fixture = open();
    const { click, text, id, set, segment, document } = fixture;
    try {
        expect(id('elevationField').hidden).toBe(true);
        click('calculate');
        expect(id('flow').getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement.id).toBe('flow');
        expect(text('analysisErrors')).toContain('internal diameter must be greater than zero');
        expect(id('addToReport').disabled).toBe(true);
        click('loadExample');
        expect(id('elevationField').hidden).toBe(false);
        click('calculate');
        expect(text('resultHighlights')).toContain('4.95343');
        expect(text('systemDiagram')).toContain('Reservoir surfaces · Δz = +3.5 m');
        expect(text('systemDiagram')).toContain('Loss 0.1134 m');

        set('unit-diameter', 'in');
        expect(Number(segment(0, 'diameter').value)).toBeCloseTo(32 / 25.4, 12);
        expect(text('resultStatus')).toContain('Recalculate');
        expect(id('addToReport').disabled).toBe(true);
        expect(text('systemDiagram')).not.toContain('Loss 0.1134');
        set('systemType', 'closed');
        expect(id('elevationField').hidden).toBe(true);
        click('calculate');
        expect(text('systemDiagram')).toContain('Complete loop · net elevation change = 0');
        expect(text('systemDiagram')).not.toContain('reservoir');
        expect(text('resultHighlights')).toContain('1.45343');
        set(segment(1, 'roughness'), -1);
        click('calculate');
        expect(text('analysisErrors')).toContain('S2 (Service run) absolute roughness');
        expect(id('resultSummary').hidden).toBe(true);
    } finally {
        fixture.dom.window.close();
    }
});

it('duplicates, reorders and removes segments while synchronizing the keyboard schematic', () => {
    const fixture = open();
    const { click, set, segment, document, window } = fixture;
    try {
        click('loadExample');
        const action = (index, key) => document.querySelectorAll('[data-segment-action="' + key + '"]')[index];
        action(2, 'up').click();
        expect(segment(1, 'name').value).toBe('Discharge');
        expect(document.activeElement).toBe(action(1, 'up'));
        const groups = () => [...document.querySelectorAll('#systemDiagram [data-segment-index]')];
        expect(groups().map(({ dataset }) => dataset.segmentName)).toEqual(['Transfer main', 'Discharge', 'Service run']);
        const second = groups()[1];
        expect(second.getAttribute('role')).toBe('button');
        second.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(document.activeElement).toBe(segment(1, 'name'));
        action(1, 'duplicate').click();
        expect(segment(2, 'diameter').value).toBe('20');
        expect(segment(2, 'name').id).not.toBe(segment(1, 'name').id);
        action(2, 'remove').click();
        expect(groups()).toHaveLength(3);
        click('addSegment');
        expect(segment(3, 'roughness').value).toBe('');
        for (let n = 4; n < 8; n++) click('addSegment');
        expect(groups()).toHaveLength(8);
        expect(fixture.id('addSegment').disabled).toBe(true);
        expect(action(7, 'duplicate').disabled).toBe(true);
        set(segment(7, 'name'), '<img src=x onerror=alert(1)>');
        expect(groups()[7].dataset.segmentName).toBe('<img src=x onerror=alert(1)>');
        expect(fixture.id('systemDiagram').querySelector('img')).toBeNull();
    } finally {
        fixture.dom.window.close();
    }
});

it('compares edited alternatives, clears the sweep, and reloads distinct calculated and stale configurations', () => {
    const fixture = open();
    const { click, set, segment, id, text, storage } = fixture;
    let reopened;
    try {
        click('loadExample');
        click('calculate');
        const baseline = id('configSelect').value;
        click('duplicateConfig');
        set('configName', '25 mm discharge');
        set(segment(2, 'diameter'), 25);
        click('calculate');
        expect(text('comparisonTables')).toContain('Original piping (baseline)');
        expect(text('comparisonTables')).toContain('27.2959');
        expect(text('comparisonTables')).toContain('-36'); // Inverse area scaling of S3 velocity
        const seen = id('configSelect').value;
        set('sweepStart', 0);
        set('sweepEnd', 48);
        set('sweepCount', 5);
        click('runSweep');
        expect(id('sweepFigure').querySelectorAll('.chart-point')).toHaveLength(5);
        set('sweepMetric', 'shaftPower');
        expect(text('sweepFigure')).toContain('Estimated shaft power vs flow');
        set('flow', 25);
        expect(id('sweepOutput').hidden).toBe(true);
        expect(id('addToReport').disabled).toBe(true);
        click('saveWorkflow');

        reopened = open(workflow, storage);
        expect(reopened.id('configSelect').value).toBe(seen);
        expect(reopened.id('flow').value).toBe('25');
        expect(reopened.id('addToReport').disabled).toBe(true);
        expect(reopened.text('resultStatus')).toContain('Recalculate');
        reopened.set('configSelect', baseline);
        expect(reopened.id('addToReport').disabled).toBe(false);
        expect(reopened.segment(2, 'diameter').value).toBe('20');
        expect(reopened.text('resultHighlights')).toContain('29.8335');
    } finally {
        fixture.dom.window.close();
        reopened?.dom.window.close();
    }
});

it('updates output units and exports the same solved analysis and sweep in the selected units', async () => {
    const fixture = open();
    const { click, set, segment, id, text, storage, window } = fixture;
    let reportPage;
    try {
        click('loadExample');
        click('calculate');
        click('duplicateConfig');
        set('configName', '25 mm discharge');
        set(segment(2, 'diameter'), 25);
        click('calculate');
        set('sweepStart', 0);
        set('sweepEnd', 48);
        set('sweepCount', 3);
        click('runSweep');
        set('sweepMetric', 'shaftPower');
        id('includeComparison').checked = true;
        click('addToReport');

        const calculate = vi.spyOn(window.FormulaFoundryFluidSystem, 'calculate');
        const runSweep = vi.spyOn(window.FormulaFoundryFluidSystem, 'runSweep');
        set('unit-power', 'kW');
        expect(id('addToReport').disabled).toBe(false);
        expect(text('resultHighlights')).toContain('0.0272959 kW');
        expect(text('systemDiagram')).toContain('Shaft power 0.0273 kW');
        expect(text('comparisonTables')).toContain('Shaft power (kW)');
        expect(text('comparisonTables')).toContain('0.0298335');
        expect(text('sweepFigure')).toContain('Estimated shaft power (kW)');
        expect(text('sweepTable')).toContain('0.0272959');

        set('unit-pressure', 'bar');
        expect(id('addToReport').disabled).toBe(false);
        expect(text('headBalance')).toContain('0.443558 bar');
        expect(text('segmentResults')).toContain('Total loss (bar)');
        set('unit-velocity', 'ft/s');
        set('unit-area', 'mm²');
        expect(text('segmentResults')).toContain('Area (mm²)');
        expect(text('segmentResults')).toContain('Velocity (ft/s)');
        expect(text('comparisonTables')).toContain('Peak velocity (ft/s)');
        expect(id('sweepOutput').hidden).toBe(false);
        expect(calculate).not.toHaveBeenCalled();
        expect(runSweep).not.toHaveBeenCalled();
        click('addToReport');

        reportPage = open('report.html', storage);
        const reportWindow = reportPage.window;
        reportWindow.URL.createObjectURL = vi.fn(() => 'blob:report');
        reportWindow.URL.revokeObjectURL = vi.fn();
        vi.spyOn(reportWindow.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        reportPage.click('exportProject');
        const [[blob]] = reportWindow.URL.createObjectURL.mock.calls;
        const source = await new Promise((resolve, reject) => {
            const reader = new reportWindow.FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(blob);
        });
        const parsed = reportWindow.FormulaFoundryReport.parseProjectJSON(source);
        expect(parsed.ok).toBe(true);
        const [original, converted] = parsed.project.entries;
        const shaftPower = (entry) => entry.outputs.find(({ label }) => label === 'Estimated shaft power');
        const pumpPressure = (entry) => entry.outputs.find(({ label }) => label === 'Equivalent pump pressure rise');
        expect(shaftPower(original).unit).toBe('W');
        expect(pumpPressure(original).unit).toBe('kPa');
        expect(shaftPower(converted).unit).toBe('kW');
        expect(shaftPower(converted).value).toBeCloseTo(0.0272958859678, 12);
        expect(pumpPressure(converted).unit).toBe('bar');
        expect(pumpPressure(converted).value).toBeCloseTo(0.4435581469766, 12);
        expect(converted.diagram.model.powerUnit).toBe('kW');
        expect(converted.diagram.model.shaftPower).toBeCloseTo(0.0272958859678, 12);
        expect(converted.tables).toHaveLength(5);
        expect(converted.chart.yLabel).toBe('Estimated shaft power (kW)');
        expect(converted.chart.points.map(({ x }) => x)).toEqual([0, 24, 48]);
        expect(converted.chart.points[1].y).toBeCloseTo(0.0272958859678, 12);
    } finally {
        fixture.dom.window.close();
        reportPage?.dom.window.close();
    }
});

it('validates imports before replacement and keeps malformed files from touching the saved copy', async () => {
    const fixture = open();
    const { click, id, set, text, storage, window } = fixture;
    try {
        set('projectTitle', 'Current project');
        click('saveWorkflow');
        const original = storage.get(workflowKey);
        fixture.import('not json');
        await vi.waitFor(() => expect(text('saveStatus')).toMatch(/invalid JSON/));
        expect(window.confirm).not.toHaveBeenCalled();
        expect(id('projectTitle').value).toBe('Current project');
        expect(storage.get(workflowKey)).toBe(original);

        const imported = JSON.parse(original);
        imported.project.title = 'Imported trial';
        fixture.import(JSON.stringify(imported));
        await vi.waitFor(() => expect(id('projectTitle').value).toBe('Imported trial'));
        expect(storage.get(workflowKey)).toBe(original);
        click('saveWorkflow');
        expect(JSON.parse(storage.get(workflowKey)).project.title).toBe('Imported trial');
    } finally {
        fixture.dom.window.close();
    }
});

it('reports a storage write failure and leaves the project available for export', () => {
    const storage = new Map();
    storage.set = () => { throw Error('Storage quota exceeded'); };
    const fixture = open(workflow, storage);
    try {
        fixture.set('projectTitle', 'Still in the editor');
        fixture.click('saveWorkflow');
        expect(fixture.text('saveStatus')).toMatch(/could not save.*export/i);
        expect(fixture.id('projectTitle').value).toBe('Still in the editor');
    } finally {
        fixture.dom.window.close();
    }
});

it('adds a complete schema-v1 workflow snapshot alongside earlier reports and reconstructs the figure', async () => {
    const fixture = open();
    const { click, set, segment, id, storage, window } = fixture;
    let reportPage;
    try {
        const api = window.FormulaFoundryReport;
        api.addSnapshot({
            calculatorId: 'moment', title: 'Legacy calculation', inputs: [{ label: 'Force', value: 100, unit: 'N' }],
            outputs: [{ label: 'Moment', value: 200, unit: 'N·m' }]
        });
        click('loadExample');
        set(segment(0, 'notes'), 'Supply entry assumed');
        click('calculate');
        click('duplicateConfig');
        set('configName', '25 mm discharge');
        set(segment(2, 'diameter'), 25);
        click('calculate');
        set('sweepStart', 0);
        set('sweepEnd', 50);
        set('sweepCount', 5);
        click('runSweep');
        id('includeComparison').checked = true;
        click('addToReport');

        const exported = storage.get(reportKey);
        const parsed = api.parseProjectJSON(exported);
        expect(parsed.ok).toBe(true);
        expect(parsed.project.schemaVersion).toBe(1);
        expect(parsed.project.entries[0].title).toBe('Legacy calculation');
        const entry = parsed.project.entries[1];
        expect(entry.title).toContain('25 mm discharge');
        expect(entry.inputs.find(({ label }) => label === 'Design flow rate').value).toBe(24);
        expect(entry.outputs.find(({ label }) => label === 'Estimated shaft power').value).toBeCloseTo(27.29588597, 7);
        expect(entry.equations).toHaveLength(8);
        expect(entry.assumptions.join()).toMatch(/NPSH.*cavitation/);
        expect(entry.tables).toHaveLength(5);
        expect(entry.tables[0].rows[0]).toContain('Supply entry assumed');
        expect(entry.chart.points).toHaveLength(5);
        expect(entry.diagram).toMatchObject({ id: 'fluid-system', model: { mode: 'open', elevation: 3.5 } });
        const invalid = JSON.parse(exported);
        invalid.entries[1].diagram.model.heads.pop();
        expect(api.parseProjectJSON(JSON.stringify(invalid)).error).toMatch(/diagram model is invalid/);

        set('flow', 200);
        click('addToReport');
        expect(api.store.count()).toBe(2);
        expect(storage.get(reportKey)).toBe(exported);

        reportPage = open('report.html', new Map());
        reportPage.import(exported, 'projectFile');
        await vi.waitFor(() => expect(reportPage.document.querySelectorAll('.report-entry')).toHaveLength(2));
        const svg = reportPage.document.querySelector('[data-diagram-id="fluid-system"]');
        expect(svg.getAttribute('role')).toBe('img');
        expect(svg.textContent).toContain('Pump');
        expect(svg.textContent).toContain('ID 25 mm');
        expect(reportPage.document.querySelector('.report-chart svg')).not.toBeNull();
        expect(reportPage.document.querySelector('.report-source-link[href="workflows/fluid-system.html"]').textContent).toBe('Open source workflow');
        expect(reportPage.storage.get(reportKey)).toBe(exported);
    } finally {
        fixture.dom.window.close();
        reportPage?.dom.window.close();
    }
});

it('plots gaps for unsupported sensitivity samples and handles a narrow plot scale', () => {
    const fixture = open();
    const { click, set, document, text, window } = fixture;
    try {
        click('loadExample');
        click('calculate');
        set('sweepStart', 0);
        set('sweepEnd', 100000);
        set('sweepCount', 3);
        click('runSweep');
        expect(document.querySelectorAll('#sweepFigure .chart-missing')).toHaveLength(1);
        expect(text('sweepTable')).toMatch(/100 million/);
        expect(text('sweepStatus')).toMatch(/1 of 3/);

        const chart = window.FormulaFoundryChart.createLineChart(document, {
            title: 'Narrow range', xLabel: 'Flow', yLabel: 'Head',
            points: [{ x: 1e12, y: 1 }, { x: 1e12 + 0.0001220703125, y: 2 }]
        });
        expect(chart.querySelectorAll('.chart-point')).toHaveLength(2);
        expect(chart.outerHTML).not.toMatch(/NaN|Infinity/);
    } finally {
        fixture.dom.window.close();
    }
});

it('publishes a numerical Given, Find, Solution and Result example with the benchmark values', () => {
    const fixture = open();
    try {
        const example = fixture.document.querySelector('#worked-example .example-box');
        expect([...example.querySelectorAll('h3')].map(({ textContent }) => textContent)).toEqual(['Given', 'Find', 'Solution', 'Result']);
        expect(example.textContent.match(/\\\[/g)).toHaveLength(8);
        expect(example.textContent).toContain('0.000400');
        expect(example.textContent).toContain('1325.38');
        for (const value of ['0.49736', '0.81487', '1.27324', '14224.81', '4.95343', '29.8335']) {
            expect(example.textContent).toContain(value);
        }
    } finally {
        fixture.dom.window.close();
    }
});

const katexAssets = process.env.FORMULA_FOUNDRY_KATEX_DIR;
it.skipIf(!katexAssets)('renders the workflow example through the production KaTeX loader', async () => {
    const fixture = open();
    try {
        const { document, window } = fixture;
        for (const path of ['katex.min.js', 'contrib/auto-render.min.js']) {
            window.eval(readFileSync(join(katexAssets, path), 'utf8'));
        }
        window.eval(readFileSync('js/katex-loader.js', 'utf8'));
        expect(await window.FormulaFoundryRenderMath()).toBe(true);
        const example = document.querySelector('#worked-example .example-box');
        expect(example.querySelector('.katex-error')).toBeNull();
        expect(example.querySelectorAll('.katex-display')).toHaveLength(8);
        for (const node of example.querySelectorAll('annotation[encoding="application/x-tex"]')) {
            expect(() => window.katex.renderToString(node.textContent, { throwOnError: true })).not.toThrow();
        }
    } finally {
        fixture.dom.window.close();
    }
});
