import fs from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { getResultText, loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

const base = ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js'];

function memoryStorage() {
    const data = {};
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

function open(page, script, storage) {
    const calculationScripts = {
        'cylinder-force': ['js/cylinder-geometry.js'],
        'hertzian-contact': ['js/hertzian-contact-calculation.js'],
        'press-fit': ['js/press-fit-calculation.js'],
        'thick-walled-cylinder': ['js/thick-walled-cylinder-calculation.js']
    };
    const loaded = loadCalculatorPage(`calculators/${page}.html`, [...base, ...(calculationScripts[script] || []), `js/${script}.js`]);
    loaded.window.FormulaFoundryReport.store.setStorage(storage);
    return loaded;
}

const addButton = (document) => document.querySelector('.add-to-report-button');
const status = (document) => document.querySelector('.report-status').textContent;

function fillCylinder({ document, window }, bore = 100) {
    setInputValue(document, 'boreDiameter', bore);
    setInputValue(document, 'rodDiameter', 50);
    setInputValue(document, 'workingPressure', 100);
    window.calculateCylinderForce();
}

function openWithPageScripts(page, storage) {
    const scripts = [...fs.readFileSync(page, 'utf8').matchAll(/<script src="(?:\.\.\/)?(js\/[^"]+)"><\/script>/g)]
        .map((match) => match[1])
        .filter((script) => script !== 'js/katex-loader.js');
    const loaded = loadCalculatorPage(page, scripts);
    loaded.window.FormulaFoundryReport.store.setStorage(storage);
    loaded.window.FormulaFoundryReportPage?.render();
    return loaded;
}

function setupShaft(storage = memoryStorage()) {
    const loaded = openWithPageScripts('calculators/shaft-torsion.html', storage);
    const { document } = loaded;
    setInputValue(document, 'torque', 0.00001);
    setSelectValue(document, 'torqueUnit', 'N·mm');
    setInputValue(document, 'outerDiameter', 2);
    setSelectValue(document, 'diameterUnit', 'mm');
    setInputValue(document, 'length', 30);
    setSelectValue(document, 'lengthUnit', 'mm');
    setInputValue(document, 'shearModulus', 80);
    return loaded;
}

function expectTorsionOutputs(outputs, stressUnit, expectedValues) {
    expect(outputs.map(({ label, unit }) => [label, unit])).toEqual([
        ['Polar moment of inertia (J)', 'm⁴'],
        ['Maximum shear stress (signed)', stressUnit],
        ['Angle of twist (signed)', 'rad'],
        ['Angle of twist (signed)', '°'],
        ['Torsional stiffness', 'N·m/rad']
    ]);
    outputs.forEach(({ value }, index) => {
        expect(typeof value).toBe('number');
        expect(value / expectedValues[index]).toBeCloseTo(1, 12);
    });
}

describe('Add to Project Report integration', () => {
    it('adds a button and navigation link with a count to every calculator page', () => {
        fs.readdirSync('calculators').filter((f) => f.endsWith('.html')).forEach((page) => {
            const html = fs.readFileSync('calculators/' + page, 'utf8');
            expect(html, page).toContain('../js/report-builder.js');
        });
        const { document } = open('cylinder-force', 'cylinder-force', memoryStorage());
        expect(addButton(document)).toBeTruthy();
        const link = document.querySelector('.site-nav .report-nav-link');
        expect(link.getAttribute('href')).toBe('../report.html');
        expect(link.querySelector('.report-count').textContent).toBe('0');
    });

    it('refuses to add before a valid calculation exists, and after an invalid one', () => {
        const storage = memoryStorage();
        const loaded = open('cylinder-force', 'cylinder-force', storage);
        addButton(loaded.document).click();
        expect(status(loaded.document)).toMatch(/calculate a valid result first/i);
        setInputValue(loaded.document, 'boreDiameter', 50);
        setInputValue(loaded.document, 'rodDiameter', 60);
        setInputValue(loaded.document, 'workingPressure', 10);
        loaded.window.calculateCylinderForce();
        addButton(loaded.document).click();
        expect(status(loaded.document)).toMatch(/calculate a valid result first/i);
        expect(loaded.window.FormulaFoundryReport.store.count()).toBe(0);
    });

    it('adds a snapshot that preserves inputs and outputs, and rejects stale results', () => {
        const storage = memoryStorage();
        const loaded = open('cylinder-force', 'cylinder-force', storage);
        fillCylinder(loaded);
        addButton(loaded.document).click();
        const store = loaded.window.FormulaFoundryReport.store;
        expect(store.count()).toBe(1);
        expect(loaded.document.querySelector('.report-count').textContent).toBe('1');

        const entry = store.load().entries[0];
        expect(entry.calculatorId).toBe('cylinder-force');
        expect(entry.inputs.find((i) => i.label.startsWith('Bore')).value).toBe(100);
        expect(entry.outputs.find((o) => o.label.includes('extension')).value).toBeCloseTo(78.5398, 3);
        expect(entry.equations.length).toBeGreaterThan(0);
        expect(entry.assumptions.length).toBeGreaterThan(0);

        // Changing inputs makes the pending result stale; the saved entry is unaffected.
        setInputValue(loaded.document, 'boreDiameter', 200);
        addButton(loaded.document).click();
        expect(status(loaded.document)).toMatch(/changed since the last calculation/i);
        expect(store.count()).toBe(1);
        expect(store.load().entries[0].inputs.find((i) => i.label.startsWith('Bore')).value).toBe(100);

        // Recalculating with the new inputs allows a second, distinct snapshot.
        loaded.window.calculateCylinderForce();
        addButton(loaded.document).click();
        const entries = store.load().entries;
        expect(entries).toHaveLength(2);
        expect(entries[1].inputs.find((i) => i.label.startsWith('Bore')).value).toBe(200);
        expect(entries[0].outputs.find((o) => o.label.includes('extension')).value).toBeCloseTo(78.5398, 3);
    });

    it('collects different calculators into one project through shared storage', () => {
        const storage = memoryStorage();
        const a = open('cylinder-force', 'cylinder-force', storage);
        fillCylinder(a);
        addButton(a.document).click();

        const b = open('thick-walled-cylinder', 'thick-walled-cylinder', storage);
        setInputValue(b.document, 'innerDiameter', 100);
        setInputValue(b.document, 'outerDiameter', 200);
        setInputValue(b.document, 'internalPressure', 100);
        b.window.calculateThickCylinder();
        addButton(b.document).click();

        const c = open('hertzian-contact', 'hertzian-contact', storage);
        ['diameter1', 'diameter2'].forEach((id) => setInputValue(c.document, id, 50));
        setSelectValue(c.document, 'configuration', 'spheres');
        c.window.updateHertzConfiguration();
        setInputValue(c.document, 'contactForce', 1000);
        ['modulus1', 'modulus2'].forEach((id) => setInputValue(c.document, id, 200));
        ['poisson1', 'poisson2'].forEach((id) => setInputValue(c.document, id, 0.3));
        c.window.calculateHertzContact();
        addButton(c.document).click();

        const d = open('differential-thermal-expansion', 'differential-thermal-expansion', storage);
        ['Length', 'Alpha', 'Ti', 'Tf'].forEach((f, i) => setInputValue(d.document, 'secA1' + f, [500, 12, 20, 100][i]));
        d.window.calculateDifferentialThermalExpansion();
        addButton(d.document).click();

        const entries = d.window.FormulaFoundryReport.store.load().entries;
        expect(entries.map((e) => e.calculatorId)).toEqual(['cylinder-force', 'thick-walled-cylinder', 'hertzian-contact', 'differential-thermal-expansion']);
        expect(entries[1].outputs.find((o) => o.label === 'Inner surface hoop stress (σθ)').value).toBeCloseTo(166.667, 2);
        expect(entries[2].outputs.find((o) => o.label.startsWith('Maximum contact pressure')).value).toBeCloseTo(2463.77, 1);
        expect(entries[3].outputs.find((o) => o.label === 'Member A total expansion').value).toBeCloseTo(0.48, 6);
    });

    it('captures existing calculators through the generic result scraper', async () => {
        const storage = memoryStorage();
        const loaded = open('press-fit', 'press-fit', storage);
        const { document, window } = loaded;
        await new Promise((resolve) => setTimeout(resolve, 20));
        ['interfaceDiameter:50', 'diametralInterference:0.05', 'hubOuterDiameter:100', 'shaftBoreDiameter:0', 'engagementLength:50', 'frictionCoefficient:0.12'].forEach((p) => {
            const [id, v] = p.split(':');
            setInputValue(document, id, v);
        });
        setSelectValue(document, 'hubMaterial', 'carbon-steel');
        setSelectValue(document, 'shaftMaterial', 'carbon-steel');
        window.calculatePressFit();
        await new Promise((resolve) => setTimeout(resolve, 0));
        addButton(document).click();
        const entry = window.FormulaFoundryReport.store.load().entries[0];
        expect(entry.calculatorId).toBe('press-fit');
        expect(entry.inputs.length).toBeGreaterThan(5);
        expect(entry.outputs.length).toBeGreaterThan(0);
        expect(entry.equations.length).toBeGreaterThan(0);
        expect(entry.assumptions.length).toBeGreaterThan(0);

        // An invalid recalculation cannot be added.
        setInputValue(document, 'interfaceDiameter', -1);
        window.calculatePressFit();
        await new Promise((resolve) => setTimeout(resolve, 0));
        addButton(document).click();
        expect(window.FormulaFoundryReport.store.count()).toBe(1);
    });
});

describe('Shaft Torsion Project Report snapshots', () => {
    it('stores and renders tiny solid-shaft results that round to zero in the calculator display', () => {
        const storage = memoryStorage();
        const { document, window } = setupShaft(storage);
        setInputValue(document, 'innerDiameter', 123); // Hidden, unused by the solid calculation.
        window.calculateShaftTorsion();
        expect(getResultText(document)).toContain('J = 0 m⁴');
        expect(getResultText(document)).toContain('= 0 rad');
        addButton(document).click();

        const stored = JSON.parse(storage.getItem(window.FormulaFoundryReport.STORAGE_KEY));
        expect(stored.schemaVersion).toBe(1);
        expect(stored.entries).toHaveLength(1);
        const [entry] = stored.entries;
        expect(entry).toMatchObject({ calculatorId: 'shaft-torsion', path: 'calculators/shaft-torsion.html' });
        expect(entry.inputs).toEqual([
            { label: 'Shaft type', value: 'solid', unit: '' },
            { label: 'Applied torque', value: 0.00001, unit: 'N·mm' },
            { label: 'Outer diameter', value: 2, unit: 'mm' },
            { label: 'Shaft length', value: 30, unit: 'mm' },
            { label: 'Shear modulus (G)', value: 80, unit: 'GPa' }
        ]);
        expectTorsionOutputs(entry.outputs, 'MPa', [
            1.5707963267948965e-12, 6.366197723675813e-6, 2.38732414637843e-9,
            1.3678359791715598e-7, 4.188790204786391
        ]);
        expect(entry.equations.join(' ')).toContain(String.raw`k=\frac{GJ}{L}`);
        expect(entry.assumptions).toContain('Small angle of twist and no warping (classical torsion theory).');
        expect(entry.diagram).toMatchObject({ type: 'calc-diagram', id: 'shaft-torsion', model: { shaftType: 'solid' } });

        const report = openWithPageScripts('report.html', storage);
        expect(report.window.FormulaFoundryReport.store.load().entries[0]).toEqual(entry);
        const rendered = report.document.querySelector('.report-entry');
        expect(rendered.textContent).toContain('1.5708e-12');
        expect(rendered.querySelector('.report-calc-diagram svg')).toBeTruthy();
    });

    it('captures mixed units, the selected material, manual modulus, and signed hollow-shaft results', () => {
        const { document, window } = setupShaft();
        setSelectValue(document, 'shaftType', 'hollow');
        window.updateShaftTorsionMode();
        setInputValue(document, 'torque', -0.3);
        setSelectValue(document, 'torqueUnit', 'kN·m');
        setInputValue(document, 'outerDiameter', 6);
        setSelectValue(document, 'diameterUnit', 'cm');
        setInputValue(document, 'innerDiameter', 40);
        setSelectValue(document, 'innerDiameterUnit', 'mm');
        setInputValue(document, 'length', 1500);
        setInputValue(document, 'shearModulus', '');
        setSelectValue(document, 'material', 'stainless-steel');
        window.updateMaterialShearModulus();
        setInputValue(document, 'shearModulus', 78000);
        setSelectValue(document, 'modulusUnit', 'MPa');
        setSelectValue(document, 'stressUnit', 'GPa');
        window.calculateShaftTorsion();
        addButton(document).click();

        const [entry] = window.FormulaFoundryReport.store.load().entries;
        expect(entry.inputs).toEqual([
            { label: 'Shaft type', value: 'hollow', unit: '' },
            { label: 'Applied torque', value: -0.3, unit: 'kN·m' },
            { label: 'Outer diameter', value: 6, unit: 'cm' },
            { label: 'Inner diameter', value: 40, unit: 'mm' },
            { label: 'Shaft length', value: 1500, unit: 'mm' },
            { label: 'Shear modulus (G)', value: 78000, unit: 'MPa' },
            { label: 'Selected material', value: 'Stainless Steel 304', unit: '' }
        ]);
        expectTorsionOutputs(entry.outputs, 'GPa', [
            1.0210176124166828e-6, -0.008814735309704972, -0.005650471352374982,
            -0.3237481607506651, 53092.91584566751
        ]);
        expect(entry.diagram.model).toMatchObject({ shaftType: 'hollow', outer: 6, inner: 4, diameterUnit: 'cm' });
    });

    it('rejects stale form values and result text, including after the result observer runs', async () => {
        const { document, window } = setupShaft();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const report = window.FormulaFoundryReport;
        window.calculateShaftTorsion();
        addButton(document).click();
        const original = report.store.load().entries[0];
        expect(original).toBeTruthy();

        setSelectValue(document, 'stressUnit', 'Pa');
        addButton(document).click();
        expect(status(document)).toMatch(/changed since the last calculation/i);

        window.calculateShaftTorsion();
        document.querySelector('#result .result-value').textContent = 'Edited result';
        await Promise.resolve();
        addButton(document).click();
        expect(status(document)).toMatch(/changed since the last calculation/i);
        expect(report.store.load().entries).toEqual([original]);
    });

    it('clears pending results on invalid input, engine failure, mode change, and reset', () => {
        const { document, window } = setupShaft();
        const calculate = window.calculateShaftTorsion;
        const expectNothingToAdd = () => {
            addButton(document).click();
            expect(status(document)).toMatch(/calculate a valid result first/i);
        };
        expectNothingToAdd();
        calculate();
        setInputValue(document, 'torque', 0);
        calculate();
        expect(getResultText(document)).toContain('Invalid Input');
        expectNothingToAdd();

        setInputValue(document, 'torque', 1);
        calculate();
        setInputValue(document, 'outerDiameter', '1e100');
        calculate();
        expect(getResultText(document)).toContain('Calculation Error');
        expectNothingToAdd();

        setInputValue(document, 'outerDiameter', 2);
        calculate();
        setSelectValue(document, 'shaftType', 'hollow');
        window.updateShaftTorsionMode();
        expectNothingToAdd();
        setSelectValue(document, 'innerDiameterUnit', 'mm');
        setInputValue(document, 'innerDiameter', 0);
        calculate();
        addButton(document).click();
        const report = window.FormulaFoundryReport;
        expect(report.store.load().entries[0].inputs).toContainEqual({ label: 'Inner diameter', value: 0, unit: 'mm' });

        setInputValue(document, 'innerDiameter', 2);
        calculate();
        expect(getResultText(document)).toContain('inner diameter must be less than outer diameter');
        expectNothingToAdd();

        setInputValue(document, 'innerDiameter', 0);
        calculate();
        window.resetShaftTorsionCalculator();
        expectNothingToAdd();
        expect(report.store.count()).toBe(1);
    });

    it('requires an explicit bore diameter for a hollow-shaft report entry', async () => {
        const { document, window } = setupShaft();
        await new Promise((resolve) => setTimeout(resolve, 0));
        setSelectValue(document, 'shaftType', 'hollow');
        window.updateShaftTorsionMode();
        window.calculateShaftTorsion();
        expect(document.querySelector('#result .result-value')).toBeTruthy();
        await Promise.resolve();
        addButton(document).click();
        expect(status(document)).toMatch(/calculate a valid result first/i);
        expect(window.FormulaFoundryReport.store.count()).toBe(0);
    });
});

describe('report workspace page', () => {
    function openReport(storage) {
        const loaded = loadCalculatorPage('report.html', [
            'js/report-builder.js', 'js/engineering-diagram.js', 'js/beam-section-properties.js',
            'js/beam-deflection-diagram.js', 'js/study-chart.js'
        ]);
        loaded.window.FormulaFoundryReport.store.setStorage(storage);
        loaded.window.confirm = () => true;
        loaded.window.print = () => { loaded.printed = true; };
        const script = loaded.document.createElement('script');
        script.textContent = fs.readFileSync('js/report-page.js', 'utf8');
        loaded.document.body.appendChild(script);
        loaded.document.dispatchEvent(new loaded.window.Event('DOMContentLoaded', { bubbles: true }));
        return loaded;
    }

    function portableProject(report) {
        const project = report.emptyProject();
        Object.assign(project.meta, {
            title: 'Pump skid / QA', number: 'P-42', customer: 'Test lab', preparedBy: 'Engineer',
            date: '2026-11-21', revision: 'B', scope: 'Check the skid.', notes: 'Review before release.'
        });
        const common = {
            addedAt: '2026-11-19T12:00:00.000Z', notes: 'Entry notes',
            inputs: [{ label: 'Force', value: 25, unit: 'lbf' }, { label: 'Length', value: 50, unit: 'mm' }],
            outputs: [{ label: 'Deflection', value: 1.234567890123456e-23, unit: 'm' }],
            equations: ['M = Fd'], assumptions: ['Static loading'], warnings: ['Review limits'], method: 'Use the saved model.'
        };
        project.entries = [
            report.validateSnapshot({
                ...common, id: 'study-1', calculatorId: 'moment', title: 'Sweep',
                study: { id: 's1', name: 'Arm study', kind: 'sweep', scenarios: ['Base'], savedAt: common.addedAt },
                tables: [{ caption: 'Sweep results', columns: ['x [mm]', 'y [m]'], rows: [[50, common.outputs[0].value], [60, 'FAILED']] }],
                chart: { type: 'line', title: 'Deflection', xLabel: 'mm', yLabel: 'm', points: [{ x: 50, y: common.outputs[0].value }, { x: 60, y: null }] }
            }).snapshot,
            report.validateSnapshot({
                ...common, id: 'beam-1', calculatorId: 'beam-bending-stress', title: 'Beam sizing',
                diagram: { type: 'beam-section', profile: 'rectangular', dimensions: { width: 0.05, height: 0.1 }, axis: 'x', unit: 'mm' }
            }).snapshot
        ];
        return project;
    }

    async function chooseProject(loaded, file) {
        const { document, window } = loaded;
        const picker = document.getElementById('projectFile');
        const importButton = document.getElementById('importProject');
        const openPicker = vi.spyOn(picker, 'click');
        importButton.click();
        expect(openPicker).toHaveBeenCalledOnce();
        openPicker.mockRestore();
        Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
        picker.dispatchEvent(new window.Event('change'));
        await vi.waitFor(() => expect(importButton.disabled).toBe(false));
    }

    it('reconstructs a Beam Deflection study recorded in mixed units', () => {
        const storage = memoryStorage();
        const { window, document } = openWithPageScripts('design-studies.html', storage);
        let reportPage;
        try {
            setInputValue(document, 'newStudyName', 'Tooling beam');
            setSelectValue(document, 'newStudyCalculator', 'beam-deflection');
            document.getElementById('newStudyForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
            document.getElementById('addScenario').click();

            const card = document.querySelector('.scenario-card');
            const set = (selector, value) => {
                const field = card.querySelector(selector);
                field.value = String(value);
                field.dispatchEvent(new window.Event('change', { bubbles: true }));
            };
            for (const [group, unit] of Object.entries({ span: 'cm', distance: 'in', force: 'kN', modulus: 'GPa', deflection: 'mm' })) {
                set('[data-unit-group="' + group + '"] select', unit);
            }
            for (const [id, value] of Object.entries({
                loadingCase: 'cant-point', span: 200, pointLoad: -1, youngsModulus: 200,
                sectionType: 'rectangular', section_width: 4, section_height: 4, bendingAxis: 'x'
            })) {
                set('[data-input-id="' + id + '"]', value);
            }
            const action = (label) => [...card.querySelectorAll('button')].find((button) => button.textContent === label);
            action('Recalculate').click();
            expect(card.querySelector('[data-role="status"]').textContent).toBe('Calculated');
            action('Add to project report').click();

            reportPage = openWithPageScripts('report.html', storage);
            const report = reportPage.window.FormulaFoundryReport;
            const project = report.store.load();
            const [entry] = project.entries;
            expect(entry.study.kind).toBe('scenario');
            expect(entry.diagram).toMatchObject({
                type: 'beam-deflection', caseId: 'cant-point', span: 2, spanUnit: 'm', load: -1000, loadUnit: 'N',
                profile: 'rectangular', dimensions: { width: 0.1016, height: 0.1016 }, sectionUnit: 'm', deflectionUnit: 'mm'
            });
            const exactDeflection = 1000 * 2 ** 3 / (3 * 200e9 * (0.1016 ** 4 / 12));
            expect(entry.diagram.maxDeflection).toBeCloseTo(exactDeflection * 1000, 10);
            expect(report.parseProjectJSON(JSON.stringify(project)).project).toEqual(project);
            expect(reportPage.document.querySelectorAll('.report-profile-diagram svg')).toHaveLength(2);
        } finally {
            window.close();
            reportPage?.window.close();
        }
    });

    it('imports a pre-modernization schema-v1 export and reconstructs all stored figures', async () => {
        // Produced by the unmodified PR #41 calculator pages using their report export data.
        const json = fs.readFileSync('tests/fixtures/project-report-before-graphics-2.json', 'utf8');
        const expected = JSON.parse(json);
        const loaded = openWithPageScripts('report.html', memoryStorage());
        const { window, document } = loaded;
        window.confirm = () => true;
        try {
            await chooseProject(loaded, new window.File([json], 'pre-modernization.json'));
            expect(window.FormulaFoundryReport.store.load()).toEqual(expected);

            for (const entry of expected.entries) {
                const rendered = document.getElementById('entry-' + entry.id);
                expect(rendered, entry.calculatorId).toBeTruthy();
                const { diagram } = entry;
                if (diagram.type === 'beam-deflection') {
                    expect(rendered.querySelectorAll('.report-profile-diagram svg')).toHaveLength(2);
                    expect(rendered.querySelector('.report-profile-diagram figcaption').textContent).toContain('cant-point');
                } else {
                    const ids = Array.from(rendered.querySelectorAll('.report-calc-diagram svg'), (svg) => svg.dataset.diagramId);
                    expect(ids).toEqual([diagram.id, ...(diagram.companion ? [diagram.companion.id] : [])]);
                }
                expect(rendered.querySelector('.report-profile-diagram').innerHTML).not.toMatch(/NaN|Infinity|undefined/);
                expect(rendered.querySelector('.report-profile-diagram input[type=range]')).toBeNull();
            }
            const plot = document.querySelector('[data-diagram-id="thick-walled-cylinder-plot"]');
            expect(plot.textContent).toContain('Radius r (in)');
            expect(plot.textContent).toContain('Stress (psi)');
            expect(plot.querySelector('.ff-curve-axial')).toBeTruthy();
        } finally {
            window.close();
        }
    });

    function readBlob(window, blob) {
        return new Promise((resolve, reject) => {
            const reader = new window.FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(blob);
        });
    }

    it('downloads readable JSON and restores the complete project in another browser store', async () => {
        const source = openReport(memoryStorage());
        const report = source.window.FormulaFoundryReport;
        const project = portableProject(report);
        report.store.save(project);
        source.window.URL.createObjectURL = vi.fn(() => 'blob:project');
        source.window.URL.revokeObjectURL = vi.fn();
        let filename;
        vi.spyOn(source.window.HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            filename = this.download;
            expect(this.getAttribute('href')).toBe('blob:project');
        });
        source.document.getElementById('exportProject').click();
        expect(filename).toBe('project-pump-skid-qa.json');
        const [blob] = source.window.URL.createObjectURL.mock.calls[0];
        expect(blob.type).toBe('application/json');
        const json = await readBlob(source.window, blob);
        expect(json).toContain('\n  "schemaVersion": 1');
        expect(JSON.parse(json)).toEqual(project);

        const target = openReport(memoryStorage());
        const confirm = vi.spyOn(target.window, 'confirm');
        await chooseProject(target, new target.window.File([json], filename));
        expect(confirm).toHaveBeenCalledOnce();
        expect(target.window.FormulaFoundryReport.store.load()).toEqual(project);
        const { document } = target;
        expect(document.getElementById('meta-title').value).toBe(project.meta.title);
        expect(document.querySelector('.report-title').textContent).toBe(project.meta.title);
        expect([...document.querySelectorAll('.report-toc a')].map((link) => link.textContent)).toEqual(['Sweep', 'Beam sizing']);
        expect(document.querySelector('.report-count').textContent).toBe('2');
        expect(document.querySelector('.report-entry').textContent).toContain('Design study: Arm study');
        expect(document.querySelector('.report-data-table tbody tr').textContent).toContain('1.23457e-23');
        expect(document.querySelector('.report-chart svg')).toBeTruthy();
        expect(document.querySelector('.report-profile-diagram svg')).toBeTruthy();
        expect(document.getElementById('exportProject').closest('.report-screen')).toBeTruthy();
        expect(document.getElementById('importProject').closest('.report-screen')).toBeTruthy();
        document.getElementById('printReport').click();
        expect(target.printed).toBe(true);
    });

    it.each([
        ['malformed JSON', () => '{', /valid JSON/i],
        ['unsupported version', (p) => { p.schemaVersion = 2; }, /schema version/i],
        ['invalid result', (p) => { p.entries[1].outputs[0].value = null; }, /Calculation 2.*results/i],
        ['duplicate ID', (p) => { p.entries[1].id = p.entries[0].id; }, /duplicate entry ID/i],
        ['unsupported structure', (p) => { p.entries[1].study = { kind: 'unsupported' }; }, /Calculation 2.*unsupported/i],
        ['oversized file', () => ' '.repeat(32 * 1024 * 1024 + 1), /32 MiB/],
        ['hostile source link', (p) => { p.entries[1].path = '//example.com/malicious.html'; }, /Calculation 2.*unsupported/i],
        ['unknown executable payload', (p) => { p.entries[1].script = '<script>window.executed = true</script>'; }, /Calculation 2.*unsupported/i],
        ['prototype key', (p) => { Object.defineProperty(p.entries[1], '__proto__', { value: {}, enumerable: true }); }, /Calculation 2.*unsupported/i]
    ])('rejects %s before confirmation or mutation', async (_label, change, message) => {
        const storage = memoryStorage();
        seed(storage);
        const loaded = openReport(storage);
        const before = { ...storage.data };
        const confirm = vi.spyOn(loaded.window, 'confirm');
        const project = portableProject(loaded.window.FormulaFoundryReport);
        const json = change(project) ?? JSON.stringify(project);
        await chooseProject(loaded, new loaded.window.File([json], 'project.json'));
        expect(status(loaded.document)).toMatch(message);
        expect(confirm).not.toHaveBeenCalled();
        expect(storage.data).toEqual(before);
        expect(loaded.document.querySelector('.report-count').textContent).toBe('2');
    });

    it('keeps the original project when the user declines replacement', async () => {
        const storage = memoryStorage();
        seed(storage);
        const loaded = openReport(storage);
        const before = { ...storage.data };
        const confirm = vi.spyOn(loaded.window, 'confirm').mockReturnValue(false);
        const project = portableProject(loaded.window.FormulaFoundryReport);
        await chooseProject(loaded, new loaded.window.File([JSON.stringify(project)], 'project.json'));
        expect(confirm).toHaveBeenCalledOnce();
        expect(status(loaded.document)).toMatch(/import canceled/i);
        expect(storage.data).toEqual(before);
        expect(loaded.document.querySelector('.report-title').textContent).toBe('Engineering Calculation Report');
    });

    it('renders imported text literally and keeps the project visible when storage writes fail', async () => {
        const storage = memoryStorage();
        seed(storage);
        const loaded = openReport(storage);
        const before = { ...storage.data };
        const write = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
        const report = loaded.window.FormulaFoundryReport;
        const project = portableProject(report);
        project.entries.pop();
        project.meta.title = '<img src=x onerror="window.executed=true">';
        await chooseProject(loaded, new loaded.window.File([JSON.stringify(project)], 'project.json'));
        expect(status(loaded.document)).toMatch(/session only/i);
        expect(storage.data).toEqual(before);
        expect(report.store.load()).toEqual(project);
        expect(loaded.document.querySelector('.report-count').textContent).toBe('1');
        expect(loaded.document.querySelector('.report-title').textContent).toBe(project.meta.title);
        expect(loaded.document.querySelector('img[src="x"]')).toBeNull();
        expect(loaded.window.executed).toBeUndefined();

        write.mockRestore();
        expect(report.store.save(project)).toBe(true);
        expect(report.createProjectStore(storage).load()).toEqual(project);
    });

    function seed(storage) {
        const a = open('cylinder-force', 'cylinder-force', storage);
        fillCylinder(a);
        addButton(a.document).click();
        const b = open('thick-walled-cylinder', 'thick-walled-cylinder', storage);
        setInputValue(b.document, 'innerDiameter', 100);
        setInputValue(b.document, 'outerDiameter', 200);
        setInputValue(b.document, 'internalPressure', 100);
        b.window.calculateThickCylinder();
        addButton(b.document).click();
    }

    it('shows an empty state with no calculations', () => {
        const { document } = openReport(memoryStorage());
        expect(document.querySelector('.report-empty')).toBeTruthy();
        expect(document.querySelectorAll('.report-entry')).toHaveLength(0);
    });

    it('renders one consolidated document with index, sections, metadata and print structure', () => {
        const storage = memoryStorage();
        seed(storage);
        const { document, window } = openReport(storage);
        expect(document.querySelectorAll('.report-entry')).toHaveLength(2);
        expect(document.querySelectorAll('.report-toc li')).toHaveLength(2);
        expect(document.querySelector('.report-cover .report-tagline').textContent).toBe('WHERE CALCULATIONS BECOME ENGINEERING');
        const first = document.querySelector('.report-entry');
        expect(first.textContent).toContain('Inputs');
        expect(first.textContent).toContain('Governing equations');
        expect(first.textContent).toContain('Assumptions and limitations');
        expect(first.querySelectorAll('.formula-box').length).toBeGreaterThan(0);
        expect(document.querySelector('.report-count').textContent).toBe('2');

        const css = fs.readFileSync('css/report.css', 'utf8');
        expect(css).toContain('@media print');
        expect(css).toMatch(/\.report-entry\s*{[^}]*break-inside: auto/);
        expect(css).not.toMatch(/\.report-entry\s*{[^}]*break-before:\s*page/);
        expect(css).not.toMatch(/\.report-cover\s*{[^}]*break-after:\s*page/);
        expect(css).not.toMatch(/\.report-toc\s*{[^}]*break-after:\s*page/);
        expect(css).toMatch(/\.site-header,[\s\S]*display: none !important/);
        expect(css).toContain('@page');
        expect(window.document.querySelectorAll('.entry-controls.no-print')).toHaveLength(2);
    });

    it('renders three entries with long content in natural report flow', () => {
        const storage = memoryStorage();
        seed(storage);
        const { document, window } = openReport(storage);
        const added = window.FormulaFoundryReport.store.addEntry({
            calculatorId: 'moment',
            calculatorName: 'Moment',
            path: 'calculators/moment.html',
            title: 'Moment verification',
            inputs: [{ label: 'Force', value: 10, unit: 'N' }],
            outputs: [{ label: 'Moment', value: 20, unit: 'N·m' }],
            diagram: {
                type: 'beam-section',
                profile: 't-section',
                dimensions: { height: 0.12, flangeWidth: 0.08, flangeThickness: 0.01, webThickness: 0.008 },
                axis: 'x',
                unit: 'mm'
            },
            equations: ['M = F d'],
            assumptions: ['Static loading'],
            method: 'A short calculation which can share a printed page.'
        });
        expect(added.ok).toBe(true);
        window.FormulaFoundryReportPage.render();

        expect(document.querySelectorAll('.report-entry')).toHaveLength(3);
        expect(document.querySelectorAll('.report-toc li')).toHaveLength(3);
        expect(document.querySelectorAll('.report-entry .report-table')).toHaveLength(6);
        expect(document.querySelectorAll('.report-entry .formula-box').length).toBeGreaterThanOrEqual(3);
        expect(document.querySelectorAll('.report-profile-diagram')).toHaveLength(1);
        expect(document.querySelector('.report-profile-diagram svg').getAttribute('role')).toBe('img');
        expect(document.querySelector('.report-empty')).toBeNull();
        expect(document.querySelector('.report-general-notes').classList.contains('is-empty')).toBe(true);
        expect(document.querySelectorAll('.report-meta-table tr.is-empty')).toHaveLength(5);
        const longNotes = 'Extended design basis. '.repeat(120);
        const noteInput = document.querySelector('.entry-controls textarea');
        noteInput.value = longNotes;
        noteInput.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.querySelector('[data-entry-notes]').textContent).toBe(longNotes);
        expect(window.FormulaFoundryReport.store.load().entries[0].notes).toBe(longNotes);

        const css = fs.readFileSync('css/report.css', 'utf8');
        expect(css).not.toMatch(/\.report-entry\s*{[^}]*break-before:\s*page/);
        expect(css).not.toMatch(/\.report-cover\s*{[^}]*break-after:\s*page/);
        expect(css).not.toMatch(/\.report-toc\s*{[^}]*break-after:\s*page/);
        expect(css).toMatch(/\.report-entry\s*{[^}]*break-inside: auto/);
        expect(css).not.toMatch(/height:\s*\d+(?:px|vh)/);
        expect(css).toContain('overflow: visible !important');
        expect(css).not.toContain('position: fixed');
        expect(document.querySelector('.print-running-header')).toBeNull();
    });

    it('lets the user rename, annotate, reorder, remove and clear', () => {
        const storage = memoryStorage();
        seed(storage);
        const { document, window } = openReport(storage);
        const store = window.FormulaFoundryReport.store;

        const title = document.querySelector('.entry-controls input');
        title.value = 'Hydraulic ram';
        title.dispatchEvent(new window.Event('input', { bubbles: true }));
        const notes = document.querySelector('.entry-controls textarea');
        notes.value = 'Check rod buckling';
        notes.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(store.load().entries[0]).toMatchObject({ title: 'Hydraulic ram', notes: 'Check rod buckling' });
        expect(document.querySelector('.report-toc li a').textContent).toBe('Hydraulic ram');

        const meta = document.getElementById('meta-title');
        meta.value = 'Pump skid';
        meta.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(store.load().meta.title).toBe('Pump skid');
        expect(document.querySelector('.report-title').textContent).toBe('Pump skid');

        const customer = document.getElementById('meta-customer');
        const customerRow = document.querySelector('[data-meta="customer"]').parentElement;
        expect(customerRow.classList.contains('is-empty')).toBe(true);
        customer.value = 'Acme Engineering';
        customer.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(customerRow.classList.contains('is-empty')).toBe(false);

        const buttonsOf = (entry) => [...entry.querySelectorAll('.entry-controls button')];
        const moveDown = buttonsOf(document.querySelector('.report-entry')).find((b) => b.textContent === 'Move down');
        moveDown.click();
        expect(store.load().entries.map((e) => e.calculatorId)).toEqual(['thick-walled-cylinder', 'cylinder-force']);
        expect(document.querySelector('.report-entry h2').textContent).toContain('Thick-walled');

        const remove = buttonsOf(document.querySelector('.report-entry')).find((b) => b.textContent === 'Remove');
        remove.click();
        expect(store.count()).toBe(1);

        document.getElementById('clearReport').click();
        expect(store.count()).toBe(0);
        expect(store.load().meta.title).toBe('');
        expect(document.querySelector('.report-empty')).toBeTruthy();
    });

    it('does not clear the project when the confirmation is declined', () => {
        const storage = memoryStorage();
        seed(storage);
        const loaded = openReport(storage);
        loaded.window.confirm = () => false;
        loaded.document.getElementById('clearReport').click();
        expect(loaded.window.FormulaFoundryReport.store.count()).toBe(2);
    });

    it('prints only when there is something to print', () => {
        const empty = openReport(memoryStorage());
        empty.document.getElementById('printReport').click();
        expect(empty.printed).toBeUndefined();
        const storage = memoryStorage();
        seed(storage);
        const full = openReport(storage);
        full.document.getElementById('printReport').click();
        expect(full.printed).toBe(true);
    });

    it('renders user text as text, not HTML', () => {
        const storage = memoryStorage();
        seed(storage);
        const { document, window } = openReport(storage);
        const meta = document.getElementById('meta-customer');
        meta.value = '<img src=x onerror=alert(1)>';
        meta.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.querySelector('.report-document img[src="x"]')).toBeNull();
        expect(document.querySelector('[data-meta="customer"]').textContent).toBe('<img src=x onerror=alert(1)>');
    });
});
