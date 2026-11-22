import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

function open(id) {
    const file = `calculators/${id}.html`;
    const scripts = [...fs.readFileSync(file, 'utf8').matchAll(/<script src="\.\.\/(js\/[^"\n]+)"/g)]
        .map((match) => match[1]).filter((script) => !script.includes('katex'));
    return loadCalculatorPage(file, scripts);
}

function enter({ document, window }, id, value) {
    const field = document.getElementById(id);
    field.value = String(value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function output(document, label) {
    return [...document.querySelectorAll('#result dt')].find((item) => item.textContent === label)?.nextElementSibling.textContent;
}

describe('Circuit Studio live editing', () => {
    it('recalculates series and parallel from the same independently unitized resistors', () => {
        const page = open('circuit-studio');
        const { document } = page;
        enter(page, 'r1', 100);
        enter(page, 'r2', 300);
        enter(page, 'units-r2', 'kΩ');
        expect(document.getElementById('r2').valueAsNumber).toBeCloseTo(0.3, 12);
        expect(document.getElementById('units-r1').value).toBe('Ω');
        expect(output(document, 'Equivalent resistance')).toBe('400 Ω');
        expect(output(document, 'Total current')).toBe('0.03 A');
        expect(document.querySelector('#electricalDiagram svg').textContent).toMatch(/R2\s+300 Ω/);

        enter(page, 'mode', 'parallel');
        expect(output(document, 'Equivalent resistance')).toBe('75 Ω');
        expect(output(document, 'Total current')).toBe('0.16 A');
        expect(document.querySelector('#result tbody').textContent).toContain('0.12 A');
        expect(document.querySelector('#result tbody').textContent).toContain('0.04 A');
        const steps = document.getElementById('electricalSteps');
        expect(steps.hidden).toBe(false);
        expect(steps.textContent).toContain('same node-to-node voltage');
        page.dom.window.close();
    });

    it('adds/removes up to twelve components and resets the editor and the schematic together', async () => {
        const page = open('circuit-studio');
        const { document } = page;
        const [add, remove] = document.querySelectorAll('#electricalComponentActions button');
        const symbols = () => Array.from(document.querySelectorAll('#electricalDiagram svg [data-component]'));
        expect(symbols()).toHaveLength(2);
        expect(remove.disabled).toBe(true);

        add.click();
        expect(document.activeElement.id).toBe('open3');
        expect(document.getElementById('count').value).toBe('3');
        expect(symbols().some((symbol) => symbol.dataset.component === 'R3')).toBe(true);
        for (let count = 3; count < 12; count += 1) add.click();
        expect(symbols()).toHaveLength(12);
        expect(document.querySelector('#electricalDiagram svg').textContent).toContain('R12');
        expect(add.disabled).toBe(true);
        remove.click();
        expect(symbols()).toHaveLength(11);
        expect(document.getElementById('r12').disabled).toBe(true);

        document.querySelector('#electricalForm button[type="reset"]').click();
        await Promise.resolve();
        expect(symbols()).toHaveLength(2);
        expect(document.getElementById('count').value).toBe('2');
        expect(remove.disabled).toBe(true);
        page.dom.window.close();
    });

    it('keeps open and singular diagrams legible and records only the current valid result', () => {
        const page = open('circuit-studio');
        const { document, window } = page;
        const addReport = document.querySelector('.add-to-report-button');
        const report = window.FormulaFoundryReport;
        addReport.click();
        expect(report.store.count()).toBe(1);

        enter(page, 'open2', 'open');
        expect(document.getElementById('r2').disabled).toBe(true);
        expect(document.querySelector('#electricalDiagram svg [data-component="R2"][data-symbol="open"]')).toBeTruthy();
        expect(output(document, 'Equivalent resistance')).toMatch(/open/i);
        expect(output(document, 'Total current')).toBe('0 A');
        addReport.click();
        const [closed, opened] = report.store.load().entries;
        expect(closed.outputs.find((item) => item.label === 'Equivalent resistance').value).toBe(300);
        expect(opened.inputs.find((item) => item.label === 'R2 state').value).toMatch(/open/i);
        expect(opened.tables[0].rows[1]).toContain('Open');
        expect(report.parseProjectJSON(JSON.stringify(report.store.load())).ok).toBe(true);

        enter(page, 'mode', 'parallel');
        enter(page, 'r1', 0);
        expect(document.querySelector('#result h3').textContent).toBe('Check inputs');
        expect(document.querySelector('#electricalDiagram svg [data-component="R1"][data-symbol="short"]')).toBeTruthy();
        expect(document.querySelector('#electricalDiagram svg').textContent).not.toMatch(/NaN|Infinity/);
        addReport.click();
        expect(report.store.count()).toBe(2);
        expect(document.querySelector('.report-status').textContent).toContain('calculate a valid result');
        page.dom.window.close();
    });
});

it('resets an unavailable divider tap when the resistor count shrinks', () => {
    const page = open('electrical-divider');
    const { document } = page;
    enter(page, 'mode', 'series');
    enter(page, 'count', '4');
    enter(page, 'tap', '3');
    expect(document.getElementById('tap').value).toBe('3');
    enter(page, 'count', '2');
    expect(document.getElementById('tap').value).toBe('1');
    expect(document.querySelector('#tap option[value="2"]').disabled).toBe(true);
    expect(output(document, 'Output voltage')).toBe('8 V');
    page.dom.window.close();
});
