import fs from 'node:fs';
import { VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

function open(path, setup, options) {
    const source = fs.readFileSync(path, 'utf8');
    const scripts = [...source.matchAll(/<script src="(?:\.\.\/)?(js\/[^"]+)"><\/script>/g)]
        .map((match) => match[1]).filter((script) => !script.includes('katex'));
    return loadCalculatorPage(path, scripts, setup, options);
}

function enter(page, values) {
    for (const [id, value] of Object.entries(values)) {
        const field = page.document.getElementById(id);
        field.value = String(value);
        field.dispatchEvent(new page.window.Event('input', { bubbles: true }));
    }
}

function calculate(page) {
    page.document.querySelector('button[type=submit]').click();
    return page.document.querySelector('#result').textContent;
}

function tabStorage() {
    const data = new Map();
    return (window) => Object.defineProperty(window, 'sessionStorage', { value: {
        getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key)
    } });
}

const cases = [
    ['pipe-flow', { diameter: 100, density: 1000, dynamicViscosity: 1, flow: 3 * Math.PI }, 'Laminar', 'diameter'],
    ['pipe-pressure-drop', { diameter: 100, density: 1000, dynamicViscosity: 1, flow: 3 * Math.PI, length: 10,
        roughness: 0, minorCoefficient: 2 }, '0.00104 kPa', 'roughness'],
    ['pump-hydraulic-power', { flow: 60, pressure: 200, density: 1000, efficiency: 80, duration: 2 }, '0.5 kWh', 'efficiency'],
    ['hydraulic-cylinder-speed', { bore: 100, rod: 60, stroke: 200, extensionFlow: 6, retractionFlow: 6 }, '25.76106 s', 'bore'],
    ['pneumatic-air-consumption', { bore: 100, rod: 60, stroke: 200, gaugePressure: 500, referencePressure: 100,
        operatingTemperature: 20, referenceTemperature: 20, frequency: 10 }, '154.5664 L/min', 'referencePressure'],
    ['multilayer-insulation', { thickness1: 100, conductivity1: 0.04, layerMode2: 'Direct R-value', resistance2: 0.2,
        insideFilm: 0.13, outsideFilm: 0.04 }, '2.87 m²·K/W', 'conductivity1'],
    ['wall-heat-loss', { resistance: 2, area: 20, inside: 0, outside: 20, duration: 1 }, '-200 W', 'area'],
    ['wall-mounting', { arrangement: 'Symmetric two-row mount', weight: 200, offset: 0.3, spacing: 0.15, horizontalSpacing: 0.2, count: 4 }, '200 N', 'spacing']
];

const legacyModels = {
    'wall-heat-loss': { direction: 'Gain' },
    'wall-mounting': { arrangement: 'Symmetric two-row mount' },
    'multilayer-insulation': { layers: 2 }
};

describe.each(cases)('%s standalone page', (id, values, expected, invalidField) => {
    it('calculates, labels the diagram, captures a portable structured snapshot and clears invalid results', () => {
        const page = open('calculators/' + id + '.html');
        const { document, window } = page;
        const report = window.FormulaFoundryReport;
        enter(page, values);
        expect(calculate(page)).toContain(expected);
        const svg = document.querySelector('[data-diagram] svg[role=img]');
        expect(svg.getAttribute('data-diagram-id')).toBe(id);
        expect(svg.getAttribute('aria-label')).toBeTruthy();
        document.querySelector('.add-to-report-button').click();
        const project = report.store.load();
        expect(project.schemaVersion).toBe(1);
        const [snapshot] = project.entries;
        expect(snapshot.diagram.id).toBe(id);
        expect(snapshot.equations.length).toBeGreaterThan(0);
        expect(snapshot.assumptions.length).toBeGreaterThan(0);
        expect(snapshot.outputs.every(({ value }) => Number.isFinite(value))).toBe(true);
        const imported = report.parseProjectJSON(JSON.stringify(project));
        expect(imported.ok, imported.error).toBe(true);
        expect(imported.project.entries[0].diagram).toEqual(snapshot.diagram);
        expect(snapshot.diagram.model).not.toEqual(legacyModels[id] ?? {});
        const oldProject = JSON.parse(JSON.stringify(project));
        oldProject.entries[0].diagram.model = legacyModels[id] ?? {};
        const legacy = report.parseProjectJSON(JSON.stringify(oldProject));
        expect(legacy.ok, legacy.error).toBe(true);
        const graphics = window.FormulaFoundryCalculatorDiagrams;
        const rebuilt = graphics.render(document, id, legacy.project.entries[0].diagram.model);
        expect(rebuilt.querySelector('desc')).toBeTruthy();
        expect(rebuilt.outerHTML).not.toMatch(/NaN|Infinity|undefined/);

        enter(page, { [invalidField]: -1 });
        const drawing = () => document.querySelector('[data-diagram] svg');
        expect(drawing().textContent).toContain('Inputs changed. Recalculate to refresh results.');
        expect(calculate(page)).toContain('Check inputs');
        expect(drawing().textContent).toContain('Check inputs to calculate results.');
        document.querySelector('.add-to-report-button').click();
        expect(report.store.count()).toBe(1);
        expect(document.querySelector('#expansionTransfer').children).toHaveLength(0);
        page.dom.window.close();
    });
});

it('uses current Design Study units and saved results for heat-flow annotations', () => {
    const { window, document } = open('design-studies.html');
    const studies = window.FormulaFoundryStudies;
    const context = window.FormulaFoundryStudyContext;
    const report = window.FormulaFoundryReport;
    const adapter = studies.getAdapter('wall-heat-loss');
    const draft = studies.createScenario(adapter, 'Cold room', {
        thermalMode: 'Effective R-value', resistance: 2, area: 20, inside: 32, outside: 68, duration: 1
    }, { temperature: '°F', interval: '°F' });
    const current = studies.calculateScenario(adapter, draft);
    const study = studies.addScenario(studies.createStudy('Wall heat transfer', adapter.id), current);
    const store = studies.createStudyStore(null);
    store.save([study]);
    const saved = store.load().studies[0].scenarios[0];
    const diagram = (scenario) => context.renderDiagram(document, adapter, scenario).querySelector('svg');

    try {
        expect(saved.status).toBe('calculated');
        const gain = diagram(saved);
        expect(gain.textContent).toContain('Ti = 32 °F');
        expect(gain.textContent).toContain('ΔT = -36 °F');
        expect(gain.textContent).toContain('Heat rate = -200 W');
        expect(gain.textContent).toContain('Heat gains indoors');

        const snapshot = studies.scenarioReportSnapshot(study, saved);
        expect(snapshot.ok).toBe(true);
        expect(snapshot.snapshot.diagram.model).toMatchObject({ inside: 32, outside: 68, temperatureUnit: '°F', intervalUnit: '°F', direction: 'Gain' });
        expect(report.addSnapshot(snapshot.snapshot).ok).toBe(true);
        const imported = report.parseProjectJSON(JSON.stringify(report.store.load()));
        expect(imported.ok, imported.error).toBe(true);
        expect(imported.project.entries[0].outputs).toEqual(snapshot.snapshot.outputs);

        const stale = studies.setScenarioInput(adapter, saved, 'outside', 14);
        expect(stale.status).toBe('stale');
        expect(stale.result).toEqual(saved.result);
        const pending = diagram(stale);
        expect(pending.textContent).toContain('To = 14 °F');
        expect(pending.textContent).toContain('Heat rate = —');
        expect(pending.querySelector('.ff-arrow-force')).toBeNull();
        expect(studies.scenarioReportSnapshot(study, stale).ok).toBe(false);

        const loss = diagram(studies.calculateScenario(adapter, stale));
        expect(loss.textContent).toContain('Heat leaves indoors');
        expect(loss.textContent).toContain('Heat rate = 100 W');
        expect(report.store.load().entries[0].diagram.model.direction).toBe('Gain');
    } finally {
        window.close();
    }
});

it('transfers canonical flow and pressure, permits edits, and retains provenance in report JSON', () => {
    const setup = tabStorage();
    const upstream = open('calculators/pipe-flow.html', setup);
    enter(upstream, { 'units-flow': 'GPM', diameter: 100, density: 1000, dynamicViscosity: 1, flow: 3 * Math.PI / 3.785411784 });
    expect(calculate(upstream)).toContain('Laminar');
    upstream.window.eval('FluidSystemTransfer.send("pipe-flow", { diameter: 0.1, density: 1000, dynamicViscosity: 0.001, flow: 0.00015707963267948966 }, 2000)');
    const segment = open('calculators/pipe-pressure-drop.html', setup);
    expect(Number(segment.document.getElementById('flow').value)).toBeCloseTo(9.42477796076938, 12);
    expect(segment.document.getElementById('length').value).toBe('');
    expect(segment.document.getElementById('transferContext').textContent).toContain('Pipe Flow & Reynolds Number');
    enter(segment, { length: 10, roughness: 0, minorCoefficient: 2 });
    expect(calculate(segment)).toContain('0.00104 kPa');
    segment.window.eval('FluidSystemTransfer.send("pipe-pressure-drop", { density: 1000, flow: 0.00015707963267948966, pressure: 1.04 }, 2000)');
    const pump = open('calculators/pump-hydraulic-power.html', setup);
    expect(Number(pump.document.getElementById('pressure').value)).toBeCloseTo(0.00104, 12);
    expect(pump.document.getElementById('efficiency').value).toBe('');
    enter(pump, { 'units-pressure': 'Pa' });
    expect(Number(pump.document.getElementById('pressure').value)).toBeCloseTo(1.04, 12);
    enter(pump, { pressure: 200000, flow: 60, efficiency: 80 });
    expect(pump.document.getElementById('transferContext').textContent).toContain('overridden');
    expect(calculate(pump)).toContain('0.25 kW');
    pump.document.querySelector('.add-to-report-button').click();
    const [snapshot] = pump.window.FormulaFoundryReport.store.load().entries;
    expect(snapshot.warnings.join(' ')).toContain('From Pipe Pressure Drop & Fittings');
    expect(snapshot.warnings.join(' ')).toContain('overridden');
    for (const page of [upstream, segment, pump]) page.dom.window.close();
});

it('hands off both calculated results through the transfer buttons, with GPM, kinematic viscosity and overrides', () => {
    const setup = tabStorage();
    const virtualConsole = new VirtualConsole();
    const errors = [];
    virtualConsole.on('jsdomError', (error) => errors.push(error.message));
    const pages = [];
    const openInTab = (id) => {
        const page = open('calculators/' + id + '.html', setup, { virtualConsole });
        pages.push(page);
        return page;
    };

    try {
        const upstream = openInTab('pipe-flow');
        enter(upstream, { 'units-flow': 'GPM', diameter: 100, density: 1000,
            viscosityMode: 'Kinematic', kinematicViscosity: 2, flow: 2 });
        expect(calculate(upstream)).toContain('Laminar');
        const sendFlow = upstream.document.querySelector('#expansionTransfer button');
        expect(sendFlow.textContent).toBe('Send flow and fluid properties to Pipe Pressure Drop');
        sendFlow.click();

        // jsdom reports cross-document navigation without loading the destination.
        // Open that page against the same tab storage to exercise the receive path.
        const segment = openInTab('pipe-pressure-drop');
        const field = (id) => segment.document.getElementById(id);
        expect(field('units-flow').value).toBe('L/min');
        expect(field('flow').valueAsNumber).toBeCloseTo(7.570823568, 10);
        expect(field('diameter').valueAsNumber).toBe(100);
        expect(field('density').valueAsNumber).toBe(1000);
        expect(field('viscosityMode').value).toBe('Kinematic');
        expect(field('kinematicViscosity').valueAsNumber).toBe(2);
        expect(field('dynamicViscosity').disabled).toBe(true);
        expect(field('length').value).toBe('');
        expect(field('transferContext').textContent).toContain('From Pipe Flow & Reynolds Number');

        enter(segment, { flow: 12, kinematicViscosity: 4, length: 10, roughness: 0 });
        expect(field('transferContext').textContent).toContain('Volumetric flow 7.570824 L/min (overridden)');
        expect(field('transferContext').textContent).toContain('Kinematic viscosity 2 cSt (overridden)');
        expect(calculate(segment)).toContain('0.003259493 kPa');
        const sendPressure = segment.document.querySelector('#expansionTransfer button');
        expect(sendPressure.textContent).toBe('Use segment loss as pump pressure rise');
        sendPressure.click();

        const pump = openInTab('pump-hydraulic-power');
        expect(pump.document.getElementById('flow').valueAsNumber).toBeCloseTo(12, 10);
        expect(pump.document.getElementById('pressure').valueAsNumber).toBeCloseTo(0.00325949323452, 12);
        expect(pump.document.getElementById('efficiency').value).toBe('');
        enter(pump, { 'units-pressure': 'Pa', pressure: 50000, efficiency: 80 });
        expect(pump.document.getElementById('transferContext').textContent).toMatch(/From Pipe Pressure Drop & Fittings.*Pressure rise .*Pa \(overridden\)/);
        expect(calculate(pump)).toContain('0.0125 kW');
        expect(errors).toEqual(Array(2).fill('Not implemented: navigation to another Document'));
    } finally {
        for (const page of pages) page.dom.window.close();
    }
});

it('combines the category filter with catalog search', async () => {
    const page = open('index.html');
    page.document.querySelector('#categoryFilter').value = 'Fluid Power';
    page.document.querySelector('#categoryFilter').dispatchEvent(new page.window.Event('change'));
    expect(page.document.querySelectorAll('.calculator-card')).toHaveLength(2);
    enter(page, { searchInput: 'pneumatic' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(page.document.querySelectorAll('.calculator-card')).toHaveLength(1);
    expect(page.document.querySelector('.calculator-card').href).toContain('pneumatic-air-consumption.html');
    page.dom.window.close();
});

it('shows current pipe diameter, the stopped case and only fresh computed area', () => {
    const page = open('calculators/pipe-flow.html');
    const drawing = () => page.document.querySelector('[data-diagram] svg');
    expect(drawing().textContent).toContain('A = —');
    enter(page, { diameter: 100, density: 1000, dynamicViscosity: 1, flow: 0 });
    expect(calculate(page)).toContain('No flow');
    expect(drawing().querySelectorAll('.ff-arrow-flow')).toHaveLength(0);
    expect(drawing().textContent).toContain('A = 0.007854 m²');
    enter(page, { 'units-diameter': 'in', diameter: 2 });
    expect(drawing().textContent).toContain('D = 2 in');
    expect(drawing().textContent).toContain('A = —');
    enter(page, { diameter: 1e-9, flow: 1e-23 });
    calculate(page);
    expect(drawing().textContent).toContain('D = 1e-9 in');
    expect(drawing().outerHTML).not.toMatch(/NaN|Infinity|undefined/);
    enter(page, { diameter: Number.MAX_VALUE });
    expect(drawing().outerHTML).not.toMatch(/NaN|Infinity|undefined/);
    page.dom.window.close();
});

it('updates the hydraulic rod section and shows only the entered stroke in speed mode', () => {
    const page = open('calculators/hydraulic-cylinder-speed.html');
    const drawing = () => page.document.querySelector('[data-diagram] svg');
    const rodHeight = () => Number(drawing().querySelector('[data-feature="rod"]').getAttribute('height'));
    enter(page, { bore: 100, rod: 20, stroke: 200, extensionFlow: 6, retractionFlow: 6 });
    const narrow = rodHeight();
    enter(page, { rod: 80, motionMode: 'Speed', retractionSpeed: 0.1 });
    expect(rodHeight()).toBeGreaterThan(narrow);
    calculate(page);
    expect(drawing().querySelectorAll('.ff-arrow-motion')).toHaveLength(1);
    expect(drawing().textContent).toContain('Speed = 0.1 m/s');
    expect(drawing().textContent).toContain('Time = 2 s');
    enter(page, { rod: 120 });
    expect(calculate(page)).toContain('must be smaller than the bore');
    expect(drawing().textContent).toContain('Ød = —');
    expect(drawing().querySelectorAll('.ff-arrow-motion')).toHaveLength(0);
    expect(drawing().textContent).toContain('Time = —');
    page.dom.window.close();
});

it('preserves configured layer numbers and the distinction between layer and film resistances', () => {
    const page = open('calculators/multilayer-insulation.html');
    const drawing = () => page.document.querySelector('[data-diagram] svg');
    enter(page, { thickness1: 100, conductivity1: 0.04, layerMode6: 'Direct R-value', resistance6: 0.2, insideFilm: 0.13 });
    expect(drawing().textContent).toContain('Layer 6 · R = 0.2 m²·K/W');
    expect(drawing().textContent).not.toContain('Layer 2');
    calculate(page);
    expect(drawing().textContent).toContain('Layer 1 · R = 2.5 m²·K/W');
    expect(drawing().textContent).toContain('Inside film = 0.13 m²·K/W');
    expect(drawing().textContent).toContain('Total R = 2.83 m²·K/W');
    page.dom.window.close();
});
