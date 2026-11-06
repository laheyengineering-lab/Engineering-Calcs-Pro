import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const scripts = [
    'js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/engineering-diagram.js',
    'js/beam-deflection-diagram.js',
    'js/cylinder-force.js', 'js/differential-thermal-expansion.js',
    'js/press-fit-calculation.js', 'js/hertzian-contact-calculation.js',
    'js/shaft-torsion-calculation.js', 'js/bolt-torque-calculation.js', 'js/moment-calculation.js', 'js/bearing-life-calculation.js', 'js/column-buckling-calculation.js', 'js/factor-of-safety-calculation.js', 'js/fillet-weld-calculation.js', 'js/spring-calculation.js', 'js/stress-strain-calculation.js', 'js/thermal-expansion-calculation.js', 'js/thick-walled-cylinder-calculation.js', 'js/thread-strength-calculation.js', 'js/beam-section-properties.js', 'js/beam-study-calculations.js',
    'js/design-study-core.js', 'js/design-study-adapters.js', 'js/design-study-context.js', 'js/study-chart.js', 'js/design-studies.js'
];

const IDS = ['cylinder-force', 'differential-thermal-expansion', 'press-fit', 'hertzian-contact', 'shaft-torsion', 'beam-bending-stress', 'beam-deflection',
    'bolt-torque', 'moment', 'bearing-life', 'column-buckling', 'factor-of-safety', 'fillet-weld', 'spring-calculations', 'stress-strain',
    'thermal-expansion', 'thick-walled-cylinder', 'thread-strength'];

function load(storageState) {
    const dom = new JSDOM(fs.readFileSync('design-studies.html', 'utf8'), { runScripts: 'dangerously', url: 'http://localhost/design-studies.html' });
    const { window } = dom;
    window.confirm = () => true;
    Object.entries(storageState || {}).forEach(([k, v]) => window.localStorage.setItem(k, v));
    scripts.forEach((file) => {
        const el = window.document.createElement('script');
        el.textContent = fs.readFileSync(file, 'utf8');
        window.document.body.appendChild(el);
    });
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    return { window, document: window.document };
}

function createStudy(window, name, calculatorId) {
    const { document } = window;
    document.getElementById('newStudyName').value = name;
    document.getElementById('newStudyCalculator').value = calculatorId;
    document.getElementById('newStudyForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

function expectSafe(markup) {
    expect(markup).not.toMatch(/NaN|Infinity|undefined|null/);
    expect(markup).not.toMatch(/<script|onerror|onload|javascript:/i);
}

describe('Design Studies engineering context', () => {
    it('shows adapter-sourced context and the matching diagram for every adapter, before any calculation', () => {
        const { window, document } = load();
        const S = window.FormulaFoundryStudies;
        IDS.forEach((id) => {
            createStudy(window, 'Study ' + id, id);
            const adapter = S.getAdapter(id);
            const theory = document.getElementById('contextTheory');
            expect(theory.textContent).toContain(adapter.method);
            adapter.assumptions.forEach((a) => expect(theory.textContent).toContain(a));
            adapter.warnings.forEach((w) => expect(theory.textContent).toContain(w));
            const equations = theory.querySelectorAll('.ctx-equation');
            if (['beam-deflection', 'factor-of-safety', 'stress-strain', 'thermal-expansion'].includes(id)) {
                expect(equations.length).toBe(0);
            } else {
                expect(equations.length).toBeGreaterThan(0);
                expect(equations[0].textContent).toMatch(/^\\\[.*\\\]$/s);
            }
            expect(theory.querySelector('.ctx-link a').getAttribute('href')).toBe(adapter.path);
            const figure = document.querySelector('#contextDiagram figure');
            expect(figure.dataset.diagram).toBe(id);
            const svg = figure.querySelector('svg');
            expect(svg.getAttribute('role')).toBe('img');
            expect(svg.getAttribute('aria-label').length).toBeGreaterThan(20);
            expect(svg.querySelector('title')).not.toBeNull();
            expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
            expect(figure.querySelector('figcaption').textContent).toMatch(/Illustrative/);
            expect(document.querySelector('.scenario-card')).toBeNull();
            expectSafe(figure.innerHTML);
        });
        expect(window.FormulaFoundryStudyContext.diagramIds.sort()).toEqual(IDS.slice().sort());
    });

    it('sits before the scenario cards in the workspace', () => {
        const { document } = load();
        const ctx = document.getElementById('studyContext');
        const scenarios = document.getElementById('scenarioList').closest('section');
        expect(ctx.compareDocumentPosition(scenarios) & 4).toBeTruthy();
    });

    it('updates the context and diagram when switching between studies of different calculators', () => {
        const { window, document } = load();
        createStudy(window, 'Cylinder', 'cylinder-force');
        createStudy(window, 'Shaft', 'shaft-torsion');
        createStudy(window, 'Beam', 'beam-deflection');
        const select = document.getElementById('studySelect');
        const ids = Array.from(select.options).filter((o) => o.value).map((o) => ({ value: o.value, text: o.textContent }));
        const seen = [];
        ['Cylinder', 'Beam', 'Shaft', 'Cylinder'].forEach((name) => {
            select.value = ids.find((o) => o.text.startsWith(name)).value;
            select.dispatchEvent(new window.Event('change', { bubbles: true }));
            seen.push(document.querySelector('#contextDiagram figure').dataset.diagram);
            expect(document.getElementById('contextDiagram').querySelectorAll('figure').length).toBe(1);
        });
        expect(seen).toEqual(['cylinder-force', 'beam-deflection', 'shaft-torsion', 'cylinder-force']);
        expect(document.getElementById('contextTheory').textContent).toContain('annular area');
        expect(document.getElementById('contextTheory').textContent).not.toContain('torque');
    });

    it('uses real inputs for the diagram, follows edits, and leaves storage and results untouched', () => {
        const { window, document } = load();
        createStudy(window, 'Cylinder', 'cylinder-force');
        document.getElementById('addScenario').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        const before = window.localStorage.getItem('formulaFoundry.designStudies');
        const inputs = Array.from(document.querySelectorAll('.scenario-card input[type=text], .scenario-card input[type=number]'));
        const bore = inputs.find((i) => i.closest('label') && i.closest('label').textContent.startsWith('Bore diameter'));
        bore.value = '100';
        bore.dispatchEvent(new window.Event('change', { bubbles: true }));
        expect(document.getElementById('contextDiagram').textContent).toContain('D = 100 mm');
        const equations = document.getElementById('contextTheory').innerHTML;
        bore.value = '120';
        bore.dispatchEvent(new window.Event('change', { bubbles: true }));
        expect(document.getElementById('contextDiagram').textContent).toContain('D = 120 mm');
        expect(document.getElementById('contextTheory').innerHTML).toBe(equations);
        const card = document.querySelector('.scenario-card');
        expect(card.querySelector('[data-role=status]').textContent).toMatch(/Inputs edited|Not calculated/);
        expect(JSON.parse(before).studies[0].scenarios[0].result).toBeNull();
        expect(JSON.parse(window.localStorage.getItem('formulaFoundry.designStudies')).studies[0].scenarios[0].result).toBeNull();
    });

    it('does not write to storage or alter adapter metadata when only rendering context', () => {
        const { window } = load();
        const S = window.FormulaFoundryStudies;
        const snapshot = JSON.stringify(IDS.map((id) => { const a = S.getAdapter(id); return [a.equations, a.assumptions, a.warnings, a.method, a.path]; }));
        IDS.forEach((id) => {
            const adapter = S.getAdapter(id);
            window.FormulaFoundryStudyContext.renderTheory(window.document, adapter, null);
            window.FormulaFoundryStudyContext.renderDiagram(window.document, adapter, null);
        });
        expect(JSON.stringify(IDS.map((id) => { const a = S.getAdapter(id); return [a.equations, a.assumptions, a.warnings, a.method, a.path]; }))).toBe(snapshot);
        expect(window.localStorage.getItem('formulaFoundry.designStudies')).toBeNull();
    });

    it('tolerates missing or malformed optional metadata', () => {
        const { window } = load();
        const C = window.FormulaFoundryStudyContext;
        const doc = window.document;
        const cases = [
            undefined, null, {}, { id: 'unknown' },
            { id: 'x', method: 42, equations: 'nope', assumptions: [1, null, '', 'ok'], warnings: {}, path: 'https://evil.example/x.html' },
            { id: 'x', path: 'calculators/../../a.html', equationsFor() { throw new Error('boom'); }, equations: ['a=b', 7] }
        ];
        cases.forEach((adapter) => {
            const wrap = C.renderTheory(doc, adapter, { inputs: {} });
            expect(wrap.querySelector('a')).toBeNull();
            const figure = C.renderDiagram(doc, adapter, undefined);
            expect(figure.querySelector('svg')).toBeNull();
            expect(figure.textContent).toMatch(/No diagram/);
        });
        const info = C.contextFor(cases[4]);
        expect(info).toMatchObject({ method: '', equations: [], assumptions: ['ok'], warnings: [], path: '' });
        expect(C.contextFor(cases[5]).equations).toEqual([]);
        expect(C.renderTheory(doc, {}, null).textContent).toBe('');
    });

    it('keeps equations aligned with diagram defaults and selected beam cases', () => {
        const { window } = load();
        const S = window.FormulaFoundryStudies;
        const C = window.FormulaFoundryStudyContext;
        const doc = window.document;
        const hertz = S.getAdapter('hertzian-contact');
        const hertzScenario = { inputs: {} };
        expect(C.contextFor(hertz, hertzScenario).equations).toEqual(hertz.equationsFor({ configuration: 'cylinders' }));
        expect(C.renderDiagram(doc, hertz, hertzScenario).querySelector('svg').getAttribute('aria-label')).toContain('parallel cylinders');

        const bending = S.getAdapter('beam-bending-stress');
        const bendingScenario = { inputs: {} };
        expect(C.contextFor(bending, bendingScenario).equations).toEqual(bending.equationsFor({ sectionType: 'rectangular', bendingAxis: 'x' }));
        expect(C.contextFor(bending, { inputs: { bendingAxis: 'y' } }).equations.at(-1)).toContain('\\sigma_y');
        expect(C.renderDiagram(doc, bending, bendingScenario).querySelector('svg').getAttribute('aria-label')).toContain('x bending axis');

        const deflection = S.getAdapter('beam-deflection');
        expect(C.contextFor(deflection, { inputs: { loadingCase: 'cant-point' } }).equations.at(-1))
            .toBe(window.FormulaFoundryBeamCalculations.cases['cant-point'].formula);
        expect(C.contextFor(deflection, { inputs: {} }).equations).toEqual([]);
    });

    it('uses the selected material strength as factor-of-safety diagram capacity', () => {
        const { window } = load();
        const adapter = window.FormulaFoundryStudies.getAdapter('factor-of-safety');
        const figure = window.FormulaFoundryStudyContext.renderDiagram(window.document, adapter, {
            inputs: { mode: 'stress', strengthSource: 'material-yield', material: 'carbon-steel', strength: 250, appliedStress: 300 },
            units: { stress: 'MPa' }
        });
        const svg = figure.querySelector('svg');
        expect(svg.textContent).toContain('Yield strength (capacity)');
        expect(svg.textContent).toContain('Yield strength = 250 MPa');
        expect(svg.querySelector('.sd-extension')).not.toBeNull();
    });

    it('labels restrained thermal stress with tensile-positive sign convention', () => {
        const { window } = load();
        const adapter = window.FormulaFoundryStudies.getAdapter('thermal-expansion');
        const equation = window.FormulaFoundryStudyContext.contextFor(adapter, { inputs: { condition: 'restrained' } }).equations.at(-1);
        expect(equation).toMatch(/= -E/);
        const figure = window.FormulaFoundryStudyContext.renderDiagram(window.document, adapter, {
            inputs: { condition: 'restrained', temperatureChange: 50 }
        });
        expect(figure.textContent).toContain('σ = −E α ΔT (tension positive)');
    });

    it('keeps diagrams safe and valid for extreme, blank and malformed inputs', () => {
        const { window } = load();
        const S = window.FormulaFoundryStudies;
        const C = window.FormulaFoundryStudyContext;
        const doc = window.document;
        const bad = [null, undefined, NaN, Infinity, -5, 0, 1e300, 1e-300, '<script>alert(1)</script>', {}, []];
        IDS.forEach((id) => {
            const adapter = S.getAdapter(id);
            const defaults = Object.fromEntries(Object.keys(adapter.groups).map((g) => [g, adapter.groups[g].default]));
            bad.forEach((value) => {
                const inputs = {};
                adapter.inputs.forEach((input) => { inputs[input.id] = input.options ? input.options[0] : value; });
                [{ inputs, units: defaults }, { inputs, units: {} }, { inputs: null, units: null }, null].forEach((scenario) => {
                    const figure = C.renderDiagram(doc, adapter, scenario);
                    expectSafe(figure.innerHTML);
                    expect(figure.querySelector('svg')).not.toBeNull();
                });
            });
        });
    });

    it('renders every categorical geometry variant', () => {
        const { window } = load();
        const S = window.FormulaFoundryStudies;
        const C = window.FormulaFoundryStudyContext;
        const doc = window.document;
        const draw = (id, inputs) => {
            const adapter = S.getAdapter(id);
            const units = Object.fromEntries(Object.keys(adapter.groups).map((g) => [g, adapter.groups[g].default]));
            const figure = C.renderDiagram(doc, adapter, { inputs, units });
            expect(figure.querySelector('svg')).not.toBeNull();
            expectSafe(figure.innerHTML);
            return figure;
        };
        ['rectangular', 'solid-circular', 'hollow-circular', 'hollow-rectangular', 'i-beam', 't-section'].forEach((sectionType) => {
            ['x', 'y'].forEach((bendingAxis) => {
                const dims = { section_width: 40, section_height: 80, section_diameter: 50, section_outerDiameter: 60, section_innerDiameter: 40,
                    section_outerWidth: 60, section_outerHeight: 90, section_wallThickness: 5, section_flangeWidth: 60, section_flangeThickness: 8, section_webThickness: 6 };
                draw('beam-bending-stress', Object.assign({ sectionType, bendingAxis, moment: -100 }, dims));
            });
        });
        ['cylinders', 'spheres'].forEach((configuration) => ['convex', 'flat', 'concave'].forEach((shape2) => {
            draw('hertzian-contact', { configuration, shape2, diameter1: 20, diameter2: 60, contactLength: 10, contactForce: 500 });
        }));
        ['solid', 'hollow'].forEach((shaftType) => draw('shaft-torsion', { shaftType, torque: -50, outerDiameter: 30, innerDiameter: 20, length: 400 }));
        Object.keys(window.FormulaFoundryBeamCalculations.cases).forEach((loadingCase) => {
            const figure = draw('beam-deflection', { loadingCase, span: 2, pointLoad: -500, uniformLoad: 200 });
            expect(figure.querySelector('svg').getAttribute('aria-label')).toBeTruthy();
        });
        const dte = draw('differential-thermal-expansion', { A1Length: 100, A2Length: 50, A3Length: 20, B1Length: 300 });
        expect(dte.querySelectorAll('svg rect').length).toBeGreaterThan(6);
        const longMember = draw('differential-thermal-expansion', { A1Length: 1000, A2Length: 10, A3Length: 10 });
        const memberSections = Array.from(longMember.querySelectorAll('svg rect')).filter((rect) =>
            Number(rect.getAttribute('y')) === 62 && ['sd-body', 'sd-body-alt'].includes(rect.getAttribute('class')));
        expect(memberSections.reduce((sum, rect) => sum + Number(rect.getAttribute('width')), 0)).toBeCloseTo(250);
        const expansionArrow = longMember.querySelector('svg line.sd-motion');
        const memberLabel = Array.from(longMember.querySelectorAll('svg text')).find((text) => text.textContent === 'Member A');
        expect(Number(expansionArrow.getAttribute('x2'))).toBeLessThan(420);
        expect(Number(memberLabel.getAttribute('x'))).toBeLessThan(420);

        const narrowHollow = draw('beam-bending-stress', {
            sectionType: 'hollow-rectangular', section_outerWidth: 5, section_outerHeight: 100, section_wallThickness: 1
        });
        const outer = narrowHollow.querySelector('svg rect.sd-body-alt');
        const inner = narrowHollow.querySelector('svg rect.sd-void');
        expect(Number(inner.getAttribute('width'))).toBeGreaterThan(0);
        expect(Number(inner.getAttribute('height'))).toBeGreaterThan(0);
        expect(Number(inner.getAttribute('width'))).toBeLessThan(Number(outer.getAttribute('width')));

        ['i-beam', 't-section'].forEach((sectionType) => {
            const shallowSection = draw('beam-bending-stress', {
                sectionType, section_flangeWidth: 100, section_height: 5, section_flangeThickness: 1, section_webThickness: 1
            });
            const points = shallowSection.querySelector('svg polygon.sd-body-alt').getAttribute('points').split(/\s+/)
                .map((pair) => pair.split(',').map(Number));
            expect(points.every(([x, y]) => x >= 55 && x <= 165 && y >= 40 && y <= 150)).toBe(true);
        });
        draw('press-fit', { interfaceDiameter: 40, hubOuterDiameter: 80, shaftBoreDiameter: 20, diametralInterference: 0.05, engagementLength: 30 });
    });
});
