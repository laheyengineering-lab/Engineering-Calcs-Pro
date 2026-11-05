import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { loadCalculatorPage, loadCore, setInputValue } from '../helpers/browser-test-utils.js';

const DIAGRAM_SCRIPTS = [
    'js/engineering-units.js',
    'js/calculator-utils.js',
    'js/engineering-diagram.js',
    'js/calculator-diagrams.js',
    'js/diagram-renderers-loads.js',
    'js/diagram-renderers-fasteners.js',
    'js/diagram-renderers-structural.js',
    'js/calculator-diagram-pages.js',
    'js/report-builder.js'
];

function memoryStorage() {
    const data = {};
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

function open(page, script, { diagrams = true, storage = memoryStorage() } = {}) {
    const scripts = diagrams ? [...DIAGRAM_SCRIPTS, `js/${script}.js`] : ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', `js/${script}.js`];
    const loaded = loadCalculatorPage(`calculators/${page}.html`, scripts);
    loaded.window.FormulaFoundryReport.store.setStorage(storage);
    return loaded;
}

function fillCylinder({ document, window }) {
    setInputValue(document, 'boreDiameter', 100);
    setInputValue(document, 'rodDiameter', 50);
    setInputValue(document, 'workingPressure', 100);
    window.calculateCylinderForce();
}

function fillThick({ document, window }) {
    setInputValue(document, 'innerDiameter', 100);
    setInputValue(document, 'outerDiameter', 200);
    setInputValue(document, 'internalPressure', 100);
    window.calculateThickCylinder();
}

describe('calculator diagram page wiring', () => {
    it('renders a static diagram on load and updates it from the existing inputs', () => {
        const page = open('cylinder-force', 'cylinder-force');
        const host = page.document.querySelector('[data-diagram="cylinder-force"]');
        expect(host.querySelector('svg')).not.toBeNull();
        const before = host.querySelector('svg').outerHTML;
        fillCylinder(page);
        const after = host.querySelector('svg');
        expect(after.outerHTML).not.toBe(before);
        expect(after.getAttribute('viewBox')).toMatch(/^0 0 [\d.]+ [\d.]+$/);
        expect(after.querySelector('title')).not.toBeNull();
    });

    it('does not alter calculation output when the diagram scripts are absent', () => {
        const withDiagrams = open('cylinder-force', 'cylinder-force');
        const without = open('cylinder-force', 'cylinder-force', { diagrams: false });
        fillCylinder(withDiagrams);
        fillCylinder(without);
        expect(withDiagrams.document.getElementById('result').textContent)
            .toBe(without.document.getElementById('result').textContent);
        expect(without.document.querySelector('[data-diagram="cylinder-force"] svg')).toBeNull();
    });

    it('range controls are labelled, bounded and drive the existing field and calculation', () => {
        const page = open('cylinder-force', 'cylinder-force');
        fillCylinder(page);
        const range = page.document.getElementById('ff-range-boreDiameter');
        expect(range).not.toBeNull();
        expect(range.type).toBe('range');
        expect(range.disabled).toBe(false);
        expect(page.document.querySelector('label[for="ff-range-boreDiameter"]').textContent.length).toBeGreaterThan(0);
        expect(Number(range.min)).toBeLessThan(100);
        expect(Number(range.max)).toBeGreaterThan(100);
        expect(range.getAttribute('aria-valuetext')).toMatch(/mm/);

        const resultBefore = page.document.getElementById('result').textContent;
        const max = Number(range.max);
        range.value = String(max);
        range.dispatchEvent(new page.window.Event('input', { bubbles: true }));
        const field = page.document.getElementById('boreDiameter');
        expect(Number(field.value)).toBeCloseTo(max, 3);
        expect(page.document.getElementById('result').textContent).not.toBe(resultBefore);
    });

    it('keeps unrestricted numeric entry: the range is disabled while the field is empty', () => {
        const page = open('cylinder-force', 'cylinder-force');
        const range = page.document.getElementById('ff-range-boreDiameter');
        expect(range.disabled).toBe(true);
        setInputValue(page.document, 'boreDiameter', 5000);
        expect(page.document.getElementById('boreDiameter').value).toBe('5000');
    });

    it('does not calculate from a range change before the user has calculated', () => {
        const page = open('cylinder-force', 'cylinder-force');
        setInputValue(page.document, 'boreDiameter', 100);
        const range = page.document.getElementById('ff-range-boreDiameter');
        range.dispatchEvent(new page.window.Event('input', { bubbles: true }));
        expect(page.document.querySelector('#result .result-value')).toBeNull();
    });
});

describe('thick-walled cylinder plot is a numerical result', () => {
    it('plots the Lamé solution samples and matches known reference values', () => {
        const page = open('thick-walled-cylinder', 'thick-walled-cylinder');
        fillThick(page);
        const snapshot = page.window.FormulaFoundryCalculatorDiagrams.snapshot(page.document.getElementById('plot'));
        expect(snapshot.id).toBe('thick-walled-cylinder-plot');
        const { samples, axial, stressUnit, distanceUnit } = snapshot.model;
        expect(stressUnit).toBe('MPa');
        expect(distanceUnit).toBe('mm');
        expect(samples.length).toBeGreaterThan(11);
        const [rInner, radialInner, hoopInner] = samples[0];
        const [rOuter, radialOuter, hoopOuter] = samples[samples.length - 1];
        // a = 50 mm, b = 100 mm, pi = 100 MPa, po = 0 (closed ends)
        expect(rInner).toBeCloseTo(50, 6);
        expect(rOuter).toBeCloseTo(100, 6);
        expect(radialInner).toBeCloseTo(-100, 6);
        expect(hoopInner).toBeCloseTo(166.6667, 3);
        expect(radialOuter).toBeCloseTo(0, 6);
        expect(hoopOuter).toBeCloseTo(66.6667, 3);
        expect(axial).toBeCloseTo(33.3333, 3);
        const svg = page.document.querySelector('#plot svg');
        expect(svg.textContent).toContain('Radius r (mm)');
        expect(svg.textContent).toContain('Stress (MPa)');
    });

    it('re-plots when the end condition changes and clears the plot on invalid input', () => {
        const page = open('thick-walled-cylinder', 'thick-walled-cylinder');
        fillThick(page);
        page.document.getElementById('endCondition').value = 'open';
        page.window.calculateThickCylinder();
        const snapshot = page.window.FormulaFoundryCalculatorDiagrams.snapshot(page.document.getElementById('plot'));
        expect(snapshot.model.axial).toBeCloseTo(0, 9);
        setInputValue(page.document, 'outerDiameter', 50);
        page.window.calculateThickCylinder();
        expect(page.document.querySelector('#plot svg')).toBeNull();
    });
});

describe('report snapshots of calculator diagrams', () => {
    const setup = () => {
        const { window } = loadCore(['js/report-builder.js']);
        return window.FormulaFoundryReport;
    };
    const base = {
        calculatorId: 'moment', calculatorName: 'Moment', path: 'calculators/moment.html', title: 'M',
        inputs: [{ label: 'F', value: 1, unit: 'N' }], outputs: [{ label: 'M', value: 1, unit: 'N·m' }],
        equations: ['M = F d'], assumptions: ['a'], method: 'm', warnings: []
    };

    it('accepts a serialisable calc-diagram model and keeps only finite values', () => {
        const api = setup();
        const result = api.validateSnapshot({ ...base, diagram: { type: 'calc-diagram', id: 'moment', model: { force: 5, distance: 2, forceUnit: 'N' } } });
        expect(result.ok).toBe(true);
        expect(result.snapshot.diagram).toEqual({ type: 'calc-diagram', id: 'moment', model: { force: 5, distance: 2, forceUnit: 'N' } });
    });

    it('rejects unknown ids, non-finite values and markup in a diagram snapshot', () => {
        const api = setup();
        const bad = [
            { type: 'calc-diagram', id: 'nope', model: {} },
            { type: 'calc-diagram', id: 'moment', model: { force: Infinity } },
            { type: 'calc-diagram', id: 'moment', model: { force: { nested: { deep: 1 } } } },
            { type: 'calc-diagram', id: 'moment', model: { force: 1 }, companion: { id: 'nope', model: {} } }
        ];
        bad.forEach((diagram) => {
            expect(api.validateSnapshot({ ...base, diagram }).ok).toBe(false);
        });
    });

    it('still accepts snapshots saved without a diagram (historical compatibility)', () => {
        const api = setup();
        const result = api.validateSnapshot(base);
        expect(result.ok).toBe(true);
        expect(result.snapshot.diagram).toBeUndefined();
    });

    function openReport(storage) {
        const loaded = loadCalculatorPage('report.html', [
            'js/report-builder.js', 'js/engineering-diagram.js', 'js/calculator-diagrams.js',
            'js/diagram-renderers-loads.js', 'js/diagram-renderers-fasteners.js', 'js/diagram-renderers-structural.js',
            'js/beam-section-properties.js', 'js/beam-deflection-diagram.js'
        ]);
        loaded.window.FormulaFoundryReport.store.setStorage(storage);
        loaded.window.confirm = () => true;
        const script = loaded.document.createElement('script');
        script.textContent = fs.readFileSync('js/report-page.js', 'utf8');
        loaded.document.body.appendChild(script);
        loaded.document.dispatchEvent(new loaded.window.Event('DOMContentLoaded', { bubbles: true }));
        return loaded;
    }

    it('re-renders saved diagrams, including the plot companion, from model data only', () => {
        const storage = memoryStorage();
        const a = open('cylinder-force', 'cylinder-force', { storage });
        fillCylinder(a);
        a.document.querySelector('.add-to-report-button').click();
        const b = open('thick-walled-cylinder', 'thick-walled-cylinder', { storage });
        fillThick(b);
        b.document.querySelector('.add-to-report-button').click();

        const entries = b.window.FormulaFoundryReport.store.load().entries;
        expect(entries[0].diagram.type).toBe('calc-diagram');
        expect(entries[0].diagram.id).toBe('cylinder-force');
        expect(entries[1].diagram.companion.id).toBe('thick-walled-cylinder-plot');
        expect(JSON.stringify(entries)).not.toMatch(/<svg|<\/g>/);

        const { document } = openReport(storage);
        const figures = document.querySelectorAll('.report-calc-diagram');
        expect(figures.length).toBe(3);
        figures.forEach((figure) => {
            const svg = figure.querySelector('svg');
            expect(svg.getAttribute('viewBox')).toMatch(/^0 0 [\d.]+ [\d.]+$/);
            expect(figure.querySelector('figcaption').textContent.length).toBeGreaterThan(20);
            expect(figure.querySelector('[role="slider"]')).toBeNull();
        });
        expect(document.querySelector('.report-calc-diagram-group')).not.toBeNull();
    });

    it('skips a stored diagram that no longer validates instead of breaking the report', () => {
        const storage = memoryStorage();
        const a = open('cylinder-force', 'cylinder-force', { storage });
        fillCylinder(a);
        a.document.querySelector('.add-to-report-button').click();
        const stored = JSON.parse(storage.data[Object.keys(storage.data)[0]]);
        stored.entries[0].diagram = { type: 'calc-diagram', id: 'cylinder-force', model: { bore: 'x' } };
        storage.data[Object.keys(storage.data)[0]] = JSON.stringify(stored);
        const { document } = openReport(storage);
        expect(document.querySelectorAll('.report-entry')).toHaveLength(1);
    });
});
