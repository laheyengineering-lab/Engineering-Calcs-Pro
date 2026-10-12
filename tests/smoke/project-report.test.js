import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

const base = ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js'];

function memoryStorage() {
    const data = {};
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

function open(page, script, storage) {
    const loaded = loadCalculatorPage(`calculators/${page}.html`, [...base, `js/${script}.js`]);
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

describe('report workspace page', () => {
    function openReport(storage) {
        const loaded = loadCalculatorPage('report.html', ['js/report-builder.js']);
        loaded.window.FormulaFoundryReport.store.setStorage(storage);
        loaded.window.confirm = () => true;
        loaded.window.print = () => { loaded.printed = true; };
        const script = loaded.document.createElement('script');
        script.textContent = fs.readFileSync('js/report-page.js', 'utf8');
        loaded.document.body.appendChild(script);
        loaded.document.dispatchEvent(new loaded.window.Event('DOMContentLoaded', { bubbles: true }));
        return loaded;
    }

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
        expect(css).toMatch(/\.report-entry\s*{[^}]*break-before: page/);
        expect(css).toMatch(/\.site-header,[\s\S]*display: none !important/);
        expect(css).toContain('@page');
        expect(window.document.querySelectorAll('.entry-controls.no-print')).toHaveLength(2);
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
