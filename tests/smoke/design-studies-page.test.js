import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const scripts = [
    'js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js',
    'js/cylinder-force.js', 'js/differential-thermal-expansion.js',
    'js/design-study-core.js', 'js/design-study-adapters.js', 'js/study-chart.js', 'js/design-studies.js'
];

// Loaded from an http origin so that localStorage is available (file URLs have an opaque origin).
function load(storageState) {
    const dom = new JSDOM(fs.readFileSync('design-studies.html', 'utf8').replace(/<script src="[^"]*"><\/script>/g, ''), {
        runScripts: 'dangerously', url: 'http://localhost/design-studies.html'
    });
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

function change(window, element, value) {
    element.value = value;
    element.dispatchEvent(new window.Event(value === undefined ? 'click' : 'change', { bubbles: true }));
}

function click(window, element) {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function buttonByText(root, text) {
    return Array.from(root.querySelectorAll('button')).find((b) => b.textContent === text);
}

function inputByLabel(card, text) {
    return Array.from(card.querySelectorAll('label')).find((l) => l.textContent.startsWith(text)).querySelector('input');
}

describe('Design Studies page', () => {
    it('supports the full create / calculate / duplicate / compare / sweep / report workflow', () => {
        const { window, document } = load();
        const status = () => document.getElementById('studyStatus').textContent;

        document.getElementById('newStudyName').value = 'Actuator study';
        document.getElementById('newStudyForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        expect(document.getElementById('studyWorkspace').hidden).toBe(false);

        click(window, document.getElementById('addScenario'));
        let card = document.querySelector('.scenario-card');
        change(window, inputByLabel(card, 'Bore diameter'), '100');
        change(window, inputByLabel(card, 'Rod diameter'), '50');
        change(window, inputByLabel(card, 'Working pressure (p)'), '100');
        expect(card.querySelector('[data-role="status"]').textContent).toBe('Not calculated');
        click(window, buttonByText(card, 'Recalculate'));
        expect(card.querySelector('[data-role="status"]').textContent).toBe('Calculated');
        expect(card.textContent).toContain('78.5398');

        // duplicate, then edit only the duplicate
        click(window, buttonByText(card, 'Duplicate'));
        const cards = document.querySelectorAll('.scenario-card');
        expect(cards).toHaveLength(2);
        change(window, cards[1].querySelector('.scenario-name input'), 'High pressure');
        change(window, inputByLabel(cards[1], 'Working pressure (p)'), '150');
        expect(cards[1].querySelector('[data-role="status"]').textContent).toMatch(/recalculate/);
        expect(cards[0].textContent).toContain('78.5398');
        expect(document.getElementById('comparison').textContent).toMatch(/Not included/);
        click(window, buttonByText(cards[1], 'Recalculate'));
        const table = document.querySelectorAll('#comparison table')[1];
        expect(document.getElementById('comparison').textContent).toContain('High pressure');
        expect(table.textContent).toContain('+39.2699 kN (+50 %)');

        // add comparison to report
        click(window, buttonByText(document.getElementById('comparison'), 'Add comparison to project report'));
        expect(status()).toMatch(/Added to the project report/);
        const stored = JSON.parse(window.localStorage.getItem('formulaFoundry.projectReport'));
        expect(stored.entries[0].study.kind).toBe('comparison');

        // persisted in browser storage
        const saved = JSON.parse(window.localStorage.getItem('formulaFoundry.designStudies'));
        expect(saved.studies[0].scenarios.map((x) => x.name)).toEqual(['Baseline', 'High pressure']);

        // sweep
        const form = document.getElementById('sweepForm');
        const field = (text) => Array.from(form.querySelectorAll('label')).find((l) => l.textContent.startsWith(text)).querySelector('input,select');
        const setSelect = (text, value) => { const s = field(text); s.value = value; s.dispatchEvent(new window.Event('change', { bubbles: true })); };
        setSelect('Input to vary', 'workingPressure');
        const type = (text, value) => { const i = field(text); i.value = value; i.dispatchEvent(new window.Event('input', { bubbles: true })); };
        type('Start value', '50');
        type('End value', '150');
        type('Number of samples', '3');
        click(window, buttonByText(form, 'Run sweep'));
        const result = document.getElementById('sweepResult');
        expect(result.querySelector('svg.study-chart')).not.toBeNull();
        expect(result.textContent).toContain('model-based exploration');
        const rows = Array.from(result.querySelectorAll('tbody tr')).map((r) => r.textContent);
        expect(rows).toHaveLength(3);
        expect(rows[1]).toContain('78.5398');
        click(window, buttonByText(result, 'Save sweep to study'));
        expect(document.querySelectorAll('.saved-sweep')).toHaveLength(1);
        click(window, buttonByText(document.getElementById('savedSweeps'), 'Add to project report'));
        expect(JSON.parse(window.localStorage.getItem('formulaFoundry.projectReport')).entries[1].chart.points).toHaveLength(3);

        // invalid sweep shows an error, not a result
        type('Number of samples', '1000');
        click(window, buttonByText(form, 'Run sweep'));
        expect(document.getElementById('sweepErrors').textContent).toMatch(/exceeds the maximum of 200/);
        expect(document.getElementById('sweepResult').children).toHaveLength(0);

        // remove scenario
        click(window, buttonByText(document.querySelectorAll('.scenario-card')[1], 'Remove'));
        expect(document.querySelectorAll('.scenario-card')).toHaveLength(1);
    });

    it('reloads a saved study from browser storage and reports dropped data', () => {
        const first = load();
        first.document.getElementById('newStudyName').value = 'Kept';
        first.document.getElementById('newStudyForm').dispatchEvent(new first.window.Event('submit', { bubbles: true, cancelable: true }));
        const raw = JSON.parse(first.window.localStorage.getItem('formulaFoundry.designStudies'));
        raw.studies.push({ id: 'junk', calculatorId: 'nope' });

        const second = load({ 'formulaFoundry.designStudies': JSON.stringify(raw) });
        const options = Array.from(second.document.querySelectorAll('#studySelect option')).map((o) => o.textContent);
        expect(options.some((o) => o.startsWith('Kept'))).toBe(true);
        expect(second.document.getElementById('studyIssues').textContent).toMatch(/not supported/);
        second.document.getElementById('studySelect').value = raw.studies[0].id;
        second.document.getElementById('studySelect').dispatchEvent(new second.window.Event('change', { bubbles: true }));
        expect(second.document.getElementById('studyWorkspace').hidden).toBe(false);
    });
});
