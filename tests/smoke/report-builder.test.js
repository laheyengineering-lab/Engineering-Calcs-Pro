import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadTorsionCalculator() {
    const page = loadCalculatorPage('calculators/shaft-torsion.html', [
        'js/engineering-units.js',
        'js/calculator-utils.js',
        'js/shaft-torsion.js',
        'js/calculator-data.js',
        'js/report-builder.js'
    ]);
    setInputValue(page.document, 'torque', 500);
    setInputValue(page.document, 'outerDiameter', 50);
    setSelectValue(page.document, 'diameterUnit', 'mm');
    setInputValue(page.document, 'length', 2);
    setInputValue(page.document, 'shearModulus', 80);
    page.window.calculateShaftTorsion();
    return page;
}

function clickByText(document, selector, label) {
    const button = [...document.querySelectorAll(selector)]
        .find((element) => element.textContent.trim() === label);
    expect(button).toBeTruthy();
    button.click();
    return button;
}

describe('calculator report builder', () => {
    it('captures displayed inputs, units, results, equation, and assumptions', () => {
        const { window } = loadTorsionCalculator();
        const report = window.FormulaFoundryReport.getCurrentState();

        expect(report.id).toBe('shaft-torsion');
        expect(report.title).toBe('Shaft Torsion Calculator');
        expect(report.inputs).toContainEqual(expect.objectContaining({
            label: 'Outer Diameter (D)',
            value: '50',
            unit: 'mm'
        }));
        expect(report.results[0].value).toContain('20.372 MPa');
        expect(report.resultDetails).toContain('Torsional Stiffness');
        expect(report.equations.join(' ')).toContain('\\tau =');
        expect(report.assumptions.join(' ')).toContain('Linear elastic material');
    });

    it('requires a successful current calculation and rejects stale results', () => {
        const { window, document } = loadCalculatorPage('calculators/shaft-torsion.html', [
            'js/engineering-units.js',
            'js/calculator-utils.js',
            'js/shaft-torsion.js',
            'js/calculator-data.js',
            'js/report-builder.js'
        ]);
        window.calculateShaftTorsion();
        document.querySelector('.report-open-button').click();
        expect(document.querySelector('.report-status').textContent).toContain('valid calculation');
        expect(document.querySelector('#formula-foundry-report[open]')).toBeFalsy();

        setInputValue(document, 'torque', 500);
        setInputValue(document, 'outerDiameter', 50);
        setSelectValue(document, 'diameterUnit', 'mm');
        setInputValue(document, 'length', 2);
        setInputValue(document, 'shearModulus', 80);
        window.calculateShaftTorsion();
        document.querySelector('.report-open-button').click();
        setInputValue(document, 'torque', 600);
        clickByText(document, 'button', 'Preview report');
        expect(document.getElementById('reportError').textContent).toContain('changed');
        expect(document.querySelector('.report-document').textContent).toBe('');
    });

    it('renders project text as text and never inserts user markup', () => {
        const { document } = loadTorsionCalculator();
        document.querySelector('.report-open-button').click();
        document.getElementById('reportProject').value = '<img src=x onerror=alert(1)>';
        document.getElementById('reportNotes').value = '<script>unsafe()</script>';
        clickByText(document, 'button', 'Preview report');

        const report = document.querySelector('.report-document');
        expect(report.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(report.textContent).toContain('<script>unsafe()</script>');
        expect(report.querySelector('img[onerror]')).toBeNull();
        expect(report.querySelector('script')).toBeNull();
    });

    it('includes print-only rules and provides a return path from the dialog', () => {
        const { document } = loadTorsionCalculator();
        document.querySelector('.report-open-button').click();

        expect(document.querySelector('dialog[aria-labelledby="report-dialog-title"]')).toBeTruthy();
        expect([...document.querySelectorAll('dialog button')].some((button) =>
            button.textContent === 'Return to calculator')).toBe(true);
        const css = fs.readFileSync(path.join(repoRoot, 'css/style.css'), 'utf8');
        expect(css).toContain('@media print');
        expect(css).toContain('@page');
        expect(css).toContain('#formula-foundry-report');
    });

    it('blocks a mode change until the calculator has produced new results', () => {
        const { document, window } = loadCalculatorPage('calculators/beam-deflection.html', [
            'js/engineering-units.js',
            'js/calculator-utils.js',
            'js/beam-deflection.js',
            'js/calculator-data.js',
            'js/report-builder.js'
        ]);
        setInputValue(document, 'beamLength', 2);
        setInputValue(document, 'pointLoad', 1000);
        setInputValue(document, 'youngsModulus', 200);
        setInputValue(document, 'areaMomentOfInertia', 1e-6);
        setSelectValue(document, 'modulusUnit', 'GPa');
        setSelectValue(document, 'inertiaUnit', 'm⁴');
        window.calculateBeamDeflection();
        setSelectValue(document, 'loadingCase', 'cant-udl');
        window.updateBeamDeflectionMode();

        document.querySelector('.report-open-button').click();
        expect(document.querySelector('.report-status').textContent).toContain('valid calculation');
        expect(document.querySelector('#formula-foundry-report[open]')).toBeFalsy();
    });
});
