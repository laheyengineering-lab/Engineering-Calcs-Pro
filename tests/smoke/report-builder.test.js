import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function loadTorsionCalculator() {
    const page = loadCalculatorPage('calculators/shaft-torsion.html', [
        'js/engineering-units.js',
        'js/calculator-utils.js',
        'js/shaft-torsion.js',
        'js/calculator-data.js',
        'js/report-builder.js'
    ]);
    await new Promise((resolve) => page.window.setTimeout(resolve, 0));
    setInputValue(page.document, 'torque', 500);
    setInputValue(page.document, 'outerDiameter', 50);
    setSelectValue(page.document, 'diameterUnit', 'mm');
    setInputValue(page.document, 'length', 2);
    setInputValue(page.document, 'shearModulus', 80);
    page.window.calculateShaftTorsion();
    await Promise.resolve();
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
    it('captures displayed inputs, units, results, equation, and assumptions', async () => {
        const { window } = await loadTorsionCalculator();
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

    it('requires a successful current calculation and rejects stale results', async () => {
        const page = loadCalculatorPage('calculators/shaft-torsion.html', [
            'js/engineering-units.js',
            'js/calculator-utils.js',
            'js/shaft-torsion.js',
            'js/calculator-data.js',
            'js/report-builder.js'
        ]);
        const { window, document } = page;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
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
        await Promise.resolve();
        setInputValue(document, 'torque', 600);
        document.querySelector('.report-open-button').click();
        expect(document.querySelector('.report-status').textContent).toContain('changed after the last calculation');
        expect(document.querySelector('#formula-foundry-report[open]')).toBeFalsy();

        setInputValue(document, 'torque', 500);
        window.calculateShaftTorsion();
        await Promise.resolve();
        document.querySelector('.report-open-button').click();
        setInputValue(document, 'torque', 600);
        clickByText(document, 'button', 'Preview report');
        expect(document.getElementById('reportError').textContent).toContain('changed');
        expect(document.querySelector('.report-document').textContent).toBe('');
    });

    it('renders project text as text and never inserts user markup', async () => {
        const { document, window } = await loadTorsionCalculator();
        document.querySelector('.report-open-button').click();
        document.getElementById('reportProject').value = '<img src=x onerror=alert(1)>';
        document.getElementById('reportNotes').value = '<script>unsafe()</script>';
        clickByText(document, 'button', 'Preview report');

        const report = document.querySelector('.report-document');
        expect(report.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(report.textContent).toContain('<script>unsafe()</script>');
        expect(report.querySelector('img[onerror]')).toBeNull();
        expect(report.querySelector('script')).toBeNull();
        let printRequested = false;
        window.print = () => { printRequested = true; };
        clickByText(document, 'button', 'Print / Save as PDF');
        expect(printRequested).toBe(true);
    });

    it('includes print-only rules and provides a return path from the dialog', async () => {
        const { document } = await loadTorsionCalculator();
        document.querySelector('.report-open-button').click();

        expect(document.querySelector('dialog[aria-labelledby="report-dialog-title"]')).toBeTruthy();
        expect([...document.querySelectorAll('dialog button')].some((button) =>
            button.textContent === 'Return to calculator')).toBe(true);
        clickByText(document, 'button', 'Preview report');
        expect(document.querySelector('.report-document h2')?.textContent).not.toBe('Purpose and scope');
        expect(document.querySelector('.report-document').textContent).not.toContain('Organization');
        const css = fs.readFileSync(path.join(repoRoot, 'css/style.css'), 'utf8');
        expect(css).toContain('@media print');
        expect(css).toContain('@page');
        expect(css).toContain('#formula-foundry-report');
    });

    it('blocks a mode change until the calculator has produced new results', async () => {
        const page = loadCalculatorPage('calculators/beam-deflection.html', [
            'js/engineering-units.js',
            'js/calculator-utils.js',
            'js/beam-deflection.js',
            'js/calculator-data.js',
            'js/report-builder.js'
        ]);
        const { document, window } = page;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
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

    it('captures the selected beam mode equation and only its visible load input', async () => {
        const page = loadCalculatorPage('calculators/beam-deflection.html', [
            'js/engineering-units.js',
            'js/calculator-utils.js',
            'js/beam-deflection.js',
            'js/calculator-data.js',
            'js/report-builder.js'
        ]);
        const { document, window } = page;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        setInputValue(document, 'beamLength', 2);
        setInputValue(document, 'pointLoad', 1000);
        setInputValue(document, 'youngsModulus', 200);
        setInputValue(document, 'areaMomentOfInertia', 1e-6);
        setSelectValue(document, 'modulusUnit', 'GPa');
        setSelectValue(document, 'inertiaUnit', 'm⁴');
        window.calculateBeamDeflection();
        await Promise.resolve();
        expect(window.FormulaFoundryReport.getCurrentState().equations.join(' '))
            .toContain('\\frac{P L^3}{48 E I}');

        setSelectValue(document, 'loadingCase', 'cant-udl');
        window.updateBeamDeflectionMode();
        setInputValue(document, 'distributedLoad', 2);
        setSelectValue(document, 'distributedLoadUnit', 'N/m');
        window.calculateBeamDeflection();
        await Promise.resolve();

        const report = window.FormulaFoundryReport.getCurrentState();
        expect(report.equations.join(' ')).toContain('\\frac{w L^4}{8 E I}');
        expect(report.equations.join(' ')).not.toContain('\\frac{P L^3}{48 E I}');
        expect(report.inputs.some((input) => input.label.toLowerCase().includes('distributed load'))).toBe(true);
        expect(report.inputs.some((input) => input.label.toLowerCase().includes('point load'))).toBe(false);
        expect(report.results[0].label).toContain('Cantilever');
    });

    it('captures a new calculator from its catalog identity and active input units', async () => {
        const page = loadCalculatorPage('calculators/pin-bearing-pressure.html', [
            'js/engineering-units.js',
            'js/pin-bearing-pressure.js',
            'js/calculator-data.js',
            'js/report-builder.js'
        ]);
        const { document, window } = page;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        setInputValue(document, 'pinLoad', 10);
        setInputValue(document, 'pinDiameter', 10);
        setInputValue(document, 'plateThickness', 8);
        window.calculatePinBearingPressure();
        await Promise.resolve();

        const report = window.FormulaFoundryReport.getCurrentState();
        expect(report.title).toBe('Pin Bearing Pressure Calculator');
        expect(report.inputs).toContainEqual(expect.objectContaining({
            label: 'Pin diameter at interface',
            value: '10',
            unit: 'mm'
        }));
        expect(report.results[0].value).toContain('125 MPa');
    });
});
