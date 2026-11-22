import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { loadCalculatorPage, loadCore, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

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
    const engine = script === 'spring-calculations' ? 'spring-calculation' : `${script}-calculation`;
    const calc = script === 'cylinder-force' ? ['js/cylinder-geometry.js'] : fs.existsSync(`js/${engine}.js`) ? [`js/${engine}.js`] : [];
    const scripts = diagrams ? [...DIAGRAM_SCRIPTS, ...calc, `js/${script}.js`] : ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', ...calc, `js/${script}.js`];
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

    it('shows current cylinder areas and forces, then drops them on output unit or geometry edits', () => {
        const page = open('cylinder-force', 'cylinder-force');
        const { window, document } = page;
        const model = () => window.FormulaFoundryReport.currentCalcDiagram().model;
        fillCylinder(page);
        expect(model()).toMatchObject({ forceUnit: 'kN', areaUnit: 'cm²' });
        expect(model().pistonArea).toBeCloseTo(78.539816);
        expect(model().extensionForce).toBeCloseTo(78.539816);
        expect(model().retractionForce).toBeCloseTo(58.904862);
        setSelectValue(document, 'forceUnit', 'lbf');
        expect(model().extensionForce).toBeUndefined();
        expect(document.querySelector('.ff-diagram-status').textContent).toMatch(/Recalculate/);
        window.calculateCylinderForce();
        expect(model().forceUnit).toBe('lbf');
        expect(model().extensionForce).toBeGreaterThan(17000);
        setInputValue(document, 'rodDiameter', 150);
        window.calculateCylinderForce();
        expect(model().annularArea).toBeUndefined();
        expect(document.querySelector('.ff-diagram-status').textContent).toMatch(/unavailable/);
    });

    it('refreshes signed Moment and rating-life labels only after a new calculation', () => {
        const moment = open('moment', 'moment');
        const model = (page) => page.window.FormulaFoundryReport.currentCalcDiagram().model;
        setInputValue(moment.document, 'force', -120);
        setInputValue(moment.document, 'distance', 0.5);
        expect(model(moment).moment).toBeUndefined();
        moment.window.calculateMoment();
        expect(model(moment)).toMatchObject({ moment: -60, momentUnit: 'N·m' });
        setInputValue(moment.document, 'force', 0);
        moment.window.calculateMoment();
        expect(model(moment)).toMatchObject({ force: 0 });
        expect(model(moment).moment).toBeUndefined();
        moment.window.resetMomentCalculator();
        expect(moment.document.querySelector('.ff-diagram-status').hidden).toBe(true);

        const bearing = open('bearing-life', 'bearing-life');
        setInputValue(bearing.document, 'dynamicLoadRating', 50);
        setInputValue(bearing.document, 'equivalentDynamicLoad', 10);
        setInputValue(bearing.document, 'speed', 1200);
        bearing.window.calculateBearingLife();
        expect(model(bearing).lifeMillions).toBeCloseTo(125);
        expect(model(bearing).lifeHours).toBeCloseTo(125e6 / 72000);
        setSelectValue(bearing.document, 'bearingType', 'roller');
        expect(model(bearing)).toMatchObject({ bearingType: 'roller' });
        expect(model(bearing).lifeMillions).toBeUndefined();
    });

    it('clears spring deflection and shaft stress and twist on modulus edits', () => {
        const spring = open('spring-calculations', 'spring-calculations');
        const model = (page) => page.window.FormulaFoundryReport.currentCalcDiagram().model;
        setInputValue(spring.document, 'wireDiameter', 5);
        setInputValue(spring.document, 'meanCoilDiameter', 36);
        setInputValue(spring.document, 'activeCoils', 7.5);
        setInputValue(spring.document, 'appliedForce', 180);
        setInputValue(spring.document, 'shearModulus', 79);
        spring.window.calculateSpring();
        expect(model(spring).deflection).toBeCloseTo(10.21);
        setInputValue(spring.document, 'shearModulus', 80);
        expect(model(spring).deflection).toBeUndefined();
        expect(spring.document.querySelector('#calcDiagram .ff-ghost')).toBeNull();
        setInputValue(spring.document, 'appliedForce', 0);
        spring.window.calculateSpring();
        expect(model(spring).deflection).toBe(0);

        const shaft = open('shaft-torsion', 'shaft-torsion');
        setSelectValue(shaft.document, 'shaftType', 'hollow');
        setInputValue(shaft.document, 'torque', -350);
        setInputValue(shaft.document, 'outerDiameter', 50);
        setSelectValue(shaft.document, 'diameterUnit', 'mm');
        setInputValue(shaft.document, 'innerDiameter', 1);
        setSelectValue(shaft.document, 'innerDiameterUnit', 'in');
        setInputValue(shaft.document, 'length', 0.5);
        setInputValue(shaft.document, 'shearModulus', 80);
        shaft.window.calculateShaftTorsion();
        expect(model(shaft).twist).toBeLessThan(0);
        expect(model(shaft).tauMax).toBeLessThan(0);
        expect(model(shaft).inner).toBeCloseTo(25.4);
        setInputValue(shaft.document, 'shearModulus', 81);
        expect(model(shaft).twist).toBeUndefined();
        expect(model(shaft).tauMax).toBeUndefined();
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

    it('converts independently selected dimensions and filters inactive stress-strain fields', () => {
        const shaft = open('shaft-torsion', 'shaft-torsion');
        setSelectValue(shaft.document, 'shaftType', 'hollow');
        setInputValue(shaft.document, 'outerDiameter', 50);
        setSelectValue(shaft.document, 'diameterUnit', 'mm');
        setInputValue(shaft.document, 'innerDiameter', 1);
        setSelectValue(shaft.document, 'innerDiameterUnit', 'in');
        shaft.window.FormulaFoundryCalculatorDiagramPage.update();
        const shaftModel = shaft.window.FormulaFoundryCalculatorDiagrams.snapshot(shaft.document.getElementById('calcDiagram')).model;
        expect(shaftModel.inner).toBeCloseTo(25.4, 6);
        expect(shaftModel.diameterUnit).toBe('mm');

        const thread = open('thread-strength', 'thread-strength');
        setInputValue(thread.document, 'majorDiameter', 10);
        setInputValue(thread.document, 'engagementLength', 10);
        setInputValue(thread.document, 'threadPitch', 1.5);
        setSelectValue(thread.document, 'distanceUnit', 'in');
        setSelectValue(thread.document, 'pitchUnit', 'mm');
        thread.window.FormulaFoundryCalculatorDiagramPage.update();
        let threadModel = thread.window.FormulaFoundryCalculatorDiagrams.snapshot(thread.document.getElementById('calcDiagram')).model;
        expect(threadModel.pitch).toBeCloseTo(1.5 / 25.4, 8);
        setInputValue(thread.document, 'threadPitch', 20);
        setSelectValue(thread.document, 'pitchUnit', 'TPI');
        thread.window.FormulaFoundryCalculatorDiagramPage.update();
        threadModel = thread.window.FormulaFoundryCalculatorDiagrams.snapshot(thread.document.getElementById('calcDiagram')).model;
        expect(threadModel.pitch).toBeCloseTo(0.05, 8);

        const strain = open('stress-strain', 'stress-strain');
        setSelectValue(strain.document, 'calculationMode', 'strain');
        setInputValue(strain.document, 'originalLength', 1);
        setSelectValue(strain.document, 'lengthUnit', 'm');
        setInputValue(strain.document, 'deltaLength', 1);
        setSelectValue(strain.document, 'deltaLengthUnit', 'mm');
        strain.window.FormulaFoundryCalculatorDiagramPage.update();
        let strainModel = strain.window.FormulaFoundryCalculatorDiagrams.snapshot(strain.document.getElementById('calcDiagram')).model;
        expect(strainModel.deltaLength).toBeCloseTo(0.001, 9);
        expect(strainModel.force).toBeUndefined();
        setSelectValue(strain.document, 'calculationMode', 'stress');
        strain.window.FormulaFoundryCalculatorDiagramPage.update();
        strainModel = strain.window.FormulaFoundryCalculatorDiagrams.snapshot(strain.document.getElementById('calcDiagram')).model;
        expect(strainModel.deltaLength).toBeUndefined();
        expect(strainModel.strain).toBeUndefined();
    });

    it('passes centroid geometry to the T-section diagram using calculator units', () => {
        const page = loadCalculatorPage('calculators/beam-bending-stress.html', [
            'js/engineering-units.js', 'js/calculator-utils.js', 'js/engineering-diagram.js',
            'js/beam-section-properties.js', 'js/beam-study-calculations.js', 'js/beam-section-ui.js',
            'js/calculator-diagrams.js', 'js/diagram-renderers-loads.js', 'js/diagram-renderers-fasteners.js',
            'js/diagram-renderers-structural.js', 'js/calculator-diagram-pages.js', 'js/report-builder.js',
            'js/beam-bending-stress.js'
        ]);
        setSelectValue(page.document, 'sectionType', 't-section');
        setInputValue(page.document, 'overallHeight', 120);
        setInputValue(page.document, 'flangeWidth', 80);
        setInputValue(page.document, 'flangeThickness', 10);
        setInputValue(page.document, 'webThickness', 8);
        page.window.FormulaFoundryCalculatorDiagramPage.update();
        const model = page.window.FormulaFoundryCalculatorDiagrams.snapshot(page.document.getElementById('calcDiagram')).model;
        expect(model.centroidYRatio).toBeCloseTo(83.5714 / 120, 4);
        expect(model.c).toBeCloseTo(83.5714, 3);
        expect(model.distanceUnit).toBe('mm');
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

    it('hides the saved stress plot on edit until recalculated and preserves the recorded report', () => {
        const page = open('thick-walled-cylinder', 'thick-walled-cylinder');
        const { window, document } = page;
        const report = window.FormulaFoundryReport;
        const diagrams = window.FormulaFoundryCalculatorDiagrams;
        const plot = document.getElementById('plot');
        fillThick(page);
        expect(report.addCurrentResult().ok).toBe(true);
        const saved = report.store.load().entries[0];
        expect(saved.diagram.companion.model.axial).toBeCloseTo(100 / 3);

        setSelectValue(document, 'stressUnit', 'psi');
        document.getElementById('stressUnit').dispatchEvent(new window.Event('change', { bubbles: true }));
        expect(plot.querySelector('svg')).toBeNull();
        expect(diagrams.snapshot(plot)).toBeNull();
        expect(document.getElementById('result').textContent).toContain('Calculate again');
        expect(report.addCurrentResult().ok).toBe(false);

        window.calculateThickCylinder();
        expect(diagrams.snapshot(plot).model.stressUnit).toBe('psi');
        expect(diagrams.snapshot(plot).model.samples[0][1]).toBeCloseTo(-100);
        expect(report.store.load().entries).toEqual([saved]);

        setInputValue(document, 'outerDiameter', '');
        document.getElementById('outerDiameter').dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(diagrams.snapshot(plot)).toBeNull();
        window.calculateThickCylinder();
        expect(document.getElementById('result').textContent).toContain('Invalid Input');
        expect(diagrams.snapshot(plot)).toBeNull();
        window.close();
    });

    it('handles out-of-range stress computations without rendering non-finite plot data', () => {
        for (const diagrams of [true, false]) {
            const { window, document } = open('thick-walled-cylinder', 'thick-walled-cylinder', { diagrams });
            setInputValue(document, 'innerDiameter', 1e200);
            setInputValue(document, 'outerDiameter', 2e200);
            setInputValue(document, 'internalPressure', 100);
            window.calculateThickCylinder();
            expect(document.getElementById('result').textContent).toContain('supported numerical range');
            expect(document.querySelector('#plot svg')).toBeNull();
            expect(window.FormulaFoundryReport.addCurrentResult().ok).toBe(false);
            window.close();
        }
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

    it('omits diagram sliders from report inputs and ignores them in freshness fingerprints', () => {
        const page = open('spring-calculations', 'spring-calculations');
        setInputValue(page.document, 'wireDiameter', 2);
        setInputValue(page.document, 'meanCoilDiameter', 16);
        setInputValue(page.document, 'activeCoils', 8);
        setInputValue(page.document, 'appliedForce', 100);
        page.window.FormulaFoundryCalculatorDiagramPage.update();
        const snapshot = page.window.FormulaFoundryReport.scrapeSnapshot();
        expect(snapshot.inputs.filter((input) => input.label === 'Wire Diameter (d)')).toHaveLength(1);
        const range = page.document.querySelector('.ff-diagram-controls input[type="range"]');
        expect(range).not.toBeNull();
        page.document.getElementById('result').textContent = 'Calculated result';
        page.window.FormulaFoundryReport.recordResult({
            calculatorId: 'spring-calculations', calculatorName: 'Spring', path: 'calculators/spring-calculations.html',
            title: 'Spring', inputs: [{ label: 'Wire', value: 2, unit: 'mm' }],
            outputs: [{ label: 'Load', value: 100, unit: 'N' }], equations: ['F = kδ'], assumptions: ['Static loading'],
            method: 'Spring calculation', warnings: []
        });
        range.value = String(Number(range.value) + 1);
        expect(page.window.FormulaFoundryReport.addCurrentResult().ok).toBe(true);
    });
});
