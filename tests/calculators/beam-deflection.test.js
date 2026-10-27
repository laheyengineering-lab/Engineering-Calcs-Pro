import { describe, it, expect } from 'vitest';
import {
    loadCalculatorPage,
    getResultText,
    getResultValueText,
    extractLeadingNumber,
    extractNumber,
    setInputValue,
    setSelectValue
} from '../helpers/browser-test-utils.js';

function setup() {
    return loadCalculatorPage('calculators/beam-deflection.html', [
        'js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js',
        'js/engineering-diagram.js', 'js/beam-section-properties.js', 'js/beam-section-ui.js',
        'js/beam-deflection-diagram.js', 'js/beam-deflection.js'
    ]);
}

function configureCommonInputs(document) {
    setInputValue(document, 'beamLength', 2);
    setInputValue(document, 'youngsModulus', 200);
    setInputValue(document, 'rectWidth', 100);
    setInputValue(document, 'rectHeight', 100);
    setSelectValue(document, 'lengthUnit', 'm');
    setSelectValue(document, 'modulusUnit', 'GPa');
    setSelectValue(document, 'rectWidthUnit', 'mm');
    setSelectValue(document, 'rectHeightUnit', 'mm');
    setSelectValue(document, 'inertiaUnit', 'mm⁴');
    setSelectValue(document, 'deflectionUnit', 'mm');
}

describe('beam deflection calculator', () => {
    it('calculates simply supported center point load response', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 1000);
        setSelectValue(document, 'loadUnit', 'N');

        window.calculateBeamDeflection();

        const resultText = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.1, 3);
        expect(extractNumber(resultText, /Maximum bending moment: Mmax = ([\d.,-]+) N·m/i)).toBeCloseTo(500, 6);

        setInputValue(document, 'pointLoad', 1);
        setSelectValue(document, 'loadUnit', 'kN');
        window.calculateBeamDeflection();
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.1, 3);
    });

    it('calculates simply supported uniform-load response', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-udl');
        setInputValue(document, 'distributedLoad', 1000);
        setSelectValue(document, 'distributedLoadUnit', 'N/m');

        window.calculateBeamDeflection();

        const resultText = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.125, 3);
        expect(extractNumber(resultText, /Maximum bending moment: Mmax = ([\d.,-]+) N·m/i)).toBeCloseTo(500, 6);
    });

    it('calculates cantilever end-point load response', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'cant-point');
        setInputValue(document, 'pointLoad', 1000);
        setSelectValue(document, 'loadUnit', 'N');

        window.calculateBeamDeflection();

        const resultText = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(1.6, 3);
        expect(extractNumber(resultText, /Maximum bending moment: Mmax = ([\d.,-]+) N·m/i)).toBeCloseTo(2000, 6);
    });

    it('calculates cantilever uniform-load response', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'cant-udl');
        setInputValue(document, 'distributedLoad', 1000);
        setSelectValue(document, 'distributedLoadUnit', 'N/m');

        window.calculateBeamDeflection();

        const resultText = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(1.2, 3);
        expect(extractNumber(resultText, /Maximum bending moment: Mmax = ([\d.,-]+) N·m/i)).toBeCloseTo(2000, 6);
    });

    it('rejects missing load inputs for the selected case', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 0);

        window.calculateBeamDeflection();

        expect(getResultText(document)).toContain('Invalid Input');
    });

    it('scales deflection inversely with E and I and proportionally with applied load', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 1000);
        window.calculateBeamDeflection();
        const base = extractLeadingNumber(getResultValueText(document));

        setInputValue(document, 'youngsModulus', 400);
        window.calculateBeamDeflection();
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(base / 2, 5);

        setInputValue(document, 'youngsModulus', 200);
        setInputValue(document, 'pointLoad', 2000);
        window.calculateBeamDeflection();
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(base * 2, 5);

        setInputValue(document, 'pointLoad', 1000);
        setInputValue(document, 'rectWidth', 200);
        setInputValue(document, 'rectHeight', 200);
        window.calculateBeamDeflection();
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(base / 16, 5);
    });

    it('populates Young’s modulus from a material and allows a manual override', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 1000);
        setSelectValue(document, 'modulusUnit', 'MPa');

        const materialSelect = document.getElementById('material');
        expect([...materialSelect.options].map((option) => option.value)).toContain('carbon-steel');
        setSelectValue(document, 'material', 'carbon-steel');
        materialSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
        expect(Number(document.getElementById('youngsModulus').value)).toBeCloseTo(200000, 6);

        setInputValue(document, 'youngsModulus', 175000);
        window.calculateBeamDeflection();
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.1 * 200 / 175, 6);
    });

    it('uses the shared hollow-section properties and bending axis', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'sectionType', 'hollow-rectangular');
        window.updateBeamDeflectionMode();
        setInputValue(document, 'outerWidth', 100);
        setInputValue(document, 'outerHeight', 80);
        setInputValue(document, 'wallThickness', 10);
        setInputValue(document, 'pointLoad', 1000);
        setSelectValue(document, 'loadingCase', 'ss-point');
        window.calculateBeamDeflection();
        const xResult = extractLeadingNumber(getResultValueText(document));
        expect(getResultText(document)).toContain('Iₓ = 2,826,670 mm⁴');
        expect(xResult).toBeCloseTo(0.294811, 5);

        setSelectValue(document, 'bendingAxis', 'y');
        window.updateBeamDeflectionMode();
        window.calculateBeamDeflection();
        const yResult = extractLeadingNumber(getResultValueText(document));
        expect(getResultText(document)).toContain('vertical y-axis (Iᵧ)');
        expect(yResult).toBeLessThan(xResult);
    });

    it('rejects invalid profile dimensions and unsupported loading cases', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'sectionType', 'hollow-rectangular');
        window.updateBeamDeflectionMode();
        setInputValue(document, 'outerWidth', 20);
        setInputValue(document, 'outerHeight', 30);
        setInputValue(document, 'wallThickness', 10);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 1000);
        window.calculateBeamDeflection();
        expect(getResultText(document)).toContain('Invalid Input');

        setSelectValue(document, 'sectionType', 'rectangular');
        window.updateBeamDeflectionMode();
        setSelectValue(document, 'loadingCase', 'unsupported');
        window.calculateBeamDeflection();
        expect(getResultText(document)).toContain('supported load/support cases');
    });

    it('uses the calculated I-beam inertia in its supported deflection model', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'sectionType', 'i-beam');
        window.updateBeamDeflectionMode();
        setInputValue(document, 'overallHeight', 200);
        setInputValue(document, 'flangeWidth', 100);
        setInputValue(document, 'flangeThickness', 12);
        setInputValue(document, 'webThickness', 8);
        setInputValue(document, 'pointLoad', 1000);
        window.calculateBeamDeflection();

        const expected = 1000 * 2 ** 3 / (48 * 200e9 * 24869717.3333333e-12) * 1000;
        expect(getResultText(document)).toContain('Iₓ = 24,869,700 mm⁴');
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(expected, 4);
    });

    it('stores a complete immutable report snapshot with profile diagram and deflection method', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'sectionType', 't-section');
        window.updateBeamDeflectionMode();
        setInputValue(document, 'overallHeight', 120);
        setInputValue(document, 'flangeWidth', 80);
        setInputValue(document, 'flangeThickness', 10);
        setInputValue(document, 'webThickness', 8);
        setInputValue(document, 'pointLoad', 1000);
        setSelectValue(document, 'loadingCase', 'cant-point');
        window.calculateBeamDeflection();
        document.querySelector('.add-to-report-button').click();

        const store = window.FormulaFoundryReport.store;
        const entry = store.load().entries[0];
        expect(entry.calculatorId).toBe('beam-deflection');
        expect(entry.inputs.find((item) => item.label === 'Cross-section profile').value).toBe('T-section');
        expect(entry.inputs.find((item) => item.label === 'Beam span (L)').value).toBe(2);
        expect(entry.outputs.find((item) => item.label === 'Centroid ȳ').value).toBeCloseTo(83.5714, 3);
        expect(entry.outputs.find((item) => item.label === 'Maximum deflection magnitude').value).toBeGreaterThan(0);
        expect(entry.diagram).toMatchObject({ type: 'beam-deflection', caseId: 'cant-point', profile: 't-section', axis: 'x' });
        expect(entry.equations).toContain(String.raw`\delta_{\max}=\frac{PL^3}{3EI}`);
        expect(entry.assumptions.join(' ')).toContain('shear deformation');
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(
            1000 * 2 ** 3 / (3 * 200e9 * 2402571.4285714e-12) * 1000, 3
        );

        setInputValue(document, 'overallHeight', 200);
        window.calculateBeamDeflection();
        expect(store.load().entries[0].diagram.dimensions.height).toBeCloseTo(0.12, 12);
    });

    it('uses the same section selector and diagram for all six profiles', () => {
        const { document, window } = setup();
        const profiles = Object.keys(window.BeamSectionUI.profiles);
        expect([...document.querySelectorAll('#sectionType option')].map((option) => option.value)).toEqual(profiles);
        profiles.forEach((profile) => {
            setSelectValue(document, 'sectionType', profile);
            window.updateBeamDeflectionMode();
            expect(document.querySelector('#profileDiagram svg').getAttribute('role')).toBe('img');
            expect(document.querySelector('#profileDiagram svg').getAttribute('aria-label')).toContain('cross-section');
            expect(document.querySelector('.profile-inputs:not([hidden])')).toBeTruthy();
        });
    });

    it('renders the selected beam model and refreshes its dimensions from numeric inputs', () => {
        const { document, window } = setup();
        const svg = document.querySelector('#beamDiagram svg');
        expect(svg).toBeTruthy();
        expect(svg.getAttribute('aria-label')).toContain('pin and roller supports');
        expect(svg.textContent).toContain('Simply supported beam with center point load');
        expect(svg.textContent).toContain('Deflected shape illustrative — not to scale');

        setInputValue(document, 'beamLength', 3.125);
        document.getElementById('beamLength').dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.querySelector('#beamDiagram svg').textContent).toContain('L = 3.125 m');
        expect(document.getElementById('beamSpanSlider').disabled).toBe(false);

        setSelectValue(document, 'loadingCase', 'cant-udl');
        window.updateBeamDeflectionMode();
        const cantilever = document.querySelector('#beamDiagram svg');
        expect(cantilever.getAttribute('aria-label')).toContain('fixed-free support');
        expect(cantilever.textContent).toContain('Cantilever with full-span uniform load');
    });

    it('synchronizes the span slider with the field and calculation', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 1000);
        document.getElementById('beamLength').dispatchEvent(new window.Event('change', { bubbles: true }));
        window.calculateBeamDeflection();

        const slider = document.getElementById('beamSpanSlider');
        expect(Number(slider.min)).toBe(1);
        expect(Number(slider.max)).toBe(3);
        slider.value = '3';
        slider.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.getElementById('beamLength').value).toBe('3');
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.3375, 4);
        expect(document.querySelector('#beamDiagram svg .beam-diagram-dimension-label').textContent).toContain('L = 3 m');
        expect(document.querySelector('#beamDiagram svg [role="slider"]')).toBeNull();
    });

    it('synchronizes the point-load magnitude slider with the input and calculation', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 1000);
        document.getElementById('pointLoad').dispatchEvent(new window.Event('input', { bubbles: true }));
        window.calculateBeamDeflection();

        const slider = document.getElementById('pointLoadSlider');
        expect(slider.disabled).toBe(false);
        expect(Number(slider.min)).toBe(500);
        expect(Number(slider.max)).toBe(1500);
        slider.value = '1200';
        slider.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.getElementById('pointLoad').value).toBe('1200');
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.12, 6);
        expect(document.querySelector('#beamDiagram svg').textContent).toContain('Simply supported beam with center point load');
        document.querySelector('.add-to-report-button').click();
        expect(window.FormulaFoundryReport.store.load().entries[0].inputs.find((input) => input.label === 'Point load (P)').value).toBe(1200);

        setInputValue(document, 'pointLoad', -1000);
        document.getElementById('pointLoad').dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(Number(slider.value)).toBe(1000);
        slider.value = '750';
        slider.dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.getElementById('pointLoad').value).toBe('-750');
        expect(document.querySelector('#beamDiagram .beam-diagram-load').getAttribute('y1')).toBe('184');
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(-0.075, 6);

        setSelectValue(document, 'loadingCase', 'ss-udl');
        window.updateBeamDeflectionMode();
        expect(document.getElementById('pointLoadSliderContainer').hidden).toBe(true);
        expect(slider.disabled).toBe(true);
    });

    it('refreshes results after a complete numeric input change and hides stale outputs while editing', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setInputValue(document, 'pointLoad', 1000);
        window.calculateBeamDeflection();

        setInputValue(document, 'beamLength', 3);
        document.getElementById('beamLength').dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(getResultText(document)).toContain('Inputs changed');
        expect(getResultValueText(document)).toBe('');

        document.getElementById('beamLength').dispatchEvent(new window.Event('change', { bubbles: true }));
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.3375, 4);
        expect(document.querySelector('#beamDiagram svg').textContent).toContain('L = 3 m');
    });

    it('removes calculated deflection from the diagram when modulus or section inputs become stale', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setInputValue(document, 'pointLoad', 1000);
        window.calculateBeamDeflection();

        expect(document.querySelector('#beamDiagram svg').textContent).toContain('Calculated |δmax|');
        setInputValue(document, 'youngsModulus', 180);
        document.getElementById('youngsModulus').dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(getResultText(document)).toContain('Inputs changed');
        expect(document.querySelector('#beamDiagram svg').textContent).not.toContain('Calculated |δmax|');

        document.getElementById('youngsModulus').dispatchEvent(new window.Event('change', { bubbles: true }));
        expect(document.querySelector('#beamDiagram svg').textContent).toContain('Calculated |δmax|');
        setInputValue(document, 'rectHeight', '');
        document.getElementById('rectHeight').dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.querySelector('#beamDiagram svg').textContent).not.toContain('Calculated |δmax|');
    });

    it('recalculates and records the result after a bending-axis change', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setInputValue(document, 'pointLoad', 1000);
        window.calculateBeamDeflection();

        const axisSelect = document.getElementById('bendingAxis');
        setSelectValue(document, 'bendingAxis', 'y');
        axisSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(getResultValueText(document)).not.toBe('');
        expect(getResultText(document)).toContain('vertical y-axis (Iᵧ)');
        document.querySelector('.add-to-report-button').click();
        expect(window.FormulaFoundryReport.store.load().entries[0].diagram.axis).toBe('y');
    });

    it('keeps the SVG dimension illustrative rather than presenting a second span control', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setInputValue(document, 'pointLoad', 1000);
        document.getElementById('beamLength').dispatchEvent(new window.Event('change', { bubbles: true }));
        window.calculateBeamDeflection();

        const svg = document.querySelector('#beamDiagram svg');
        expect(svg.querySelector('.beam-diagram-dimension')).toBeTruthy();
        expect(svg.querySelector('[role="slider"]')).toBeNull();
        expect(Number(document.getElementById('beamLength').value)).toBe(2);
    });

    it('draws negative uniform loads below the beam with upward-pointing arrows', () => {
        const { document, window } = setup();
        setSelectValue(document, 'loadingCase', 'ss-udl');
        window.updateBeamDeflectionMode();
        setInputValue(document, 'distributedLoad', -1000);
        document.getElementById('distributedLoad').dispatchEvent(new window.Event('input', { bubbles: true }));
        const loadElements = [...document.querySelectorAll('#beamDiagram .beam-diagram-load')];
        expect(loadElements[0].getAttribute('y1')).toBe('193');
        expect(loadElements[1].getAttribute('y1')).toBe('186');
        expect(loadElements[1].getAttribute('y2')).toBe('133');
        expect(document.querySelector('#beamDiagram .beam-diagram-deflection').getAttribute('d')).toContain('58');
    });

    it('keeps invalid span geometry non-interactive and free of non-finite SVG coordinates', () => {
        const { document, window } = setup();
        setInputValue(document, 'beamLength', 0);
        document.getElementById('beamLength').dispatchEvent(new window.Event('input', { bubbles: true }));
        const svg = document.querySelector('#beamDiagram svg');
        expect(document.getElementById('beamSpanSlider').disabled).toBe(true);
        expect(svg.querySelector('[role="slider"]')).toBeNull();
        expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);

        window.calculateBeamDeflection();
        expect(getResultText(document)).toContain('Invalid Input');

        setSelectValue(document, 'loadingCase', 'unsupported');
        window.updateBeamDeflectionMode();
        const unsupported = document.querySelector('#beamDiagram svg');
        expect(unsupported.getAttribute('aria-label')).toBe('Unsupported beam model');
        expect(unsupported.querySelector('.beam-diagram-member')).toBeNull();
    });

    it('keeps SVG and slider range coordinates finite for extreme span values', () => {
        const { document, window } = setup();
        const framework = window.FormulaFoundryDiagram;
        expect(framework.rangeAround(Number.MAX_VALUE, 0.5, 1.5)).toEqual({
            min: Number.MAX_VALUE * 0.5,
            max: Number.MAX_VALUE
        });
        expect(framework.rangeAround(Number.MIN_VALUE, 0.5, 1.5).min).toBe(Number.MIN_VALUE);
        expect(framework.rangeAround(0, 0.5, 1.5)).toBeNull();

        setInputValue(document, 'beamLength', '1e308');
        document.getElementById('beamLength').dispatchEvent(new window.Event('input', { bubbles: true }));
        expect(document.querySelector('#beamDiagram svg').outerHTML).not.toMatch(/NaN|Infinity/);
        expect(Number.isFinite(Number(document.getElementById('beamSpanSlider').max))).toBe(true);
    });

    it('stores and prints the calculated beam-model snapshot from its saved state', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'sectionType', 't-section');
        window.updateBeamDeflectionMode();
        setInputValue(document, 'overallHeight', 120);
        setInputValue(document, 'flangeWidth', 80);
        setInputValue(document, 'flangeThickness', 10);
        setInputValue(document, 'webThickness', 8);
        setInputValue(document, 'pointLoad', 1000);
        setSelectValue(document, 'loadingCase', 'cant-point');
        window.calculateBeamDeflection();
        document.querySelector('.add-to-report-button').click();

        const entry = window.FormulaFoundryReport.store.load().entries[0];
        expect(entry.diagram).toMatchObject({
            type: 'beam-deflection', caseId: 'cant-point', span: 2, spanUnit: 'm',
            profile: 't-section', axis: 'x', maxDeflection: expect.any(Number)
        });
        const reportPage = loadCalculatorPage('report.html', [
            'js/report-builder.js', 'js/engineering-diagram.js', 'js/beam-section-properties.js',
            'js/beam-deflection-diagram.js', 'js/report-page.js'
        ]);
        reportPage.window.FormulaFoundryReport.store.addEntry(entry);
        reportPage.window.FormulaFoundryReportPage.render();
        const reportSvg = reportPage.document.querySelector('.report-entry svg');
        expect(reportSvg).toBeTruthy();
        expect(reportSvg.textContent).toContain('Calculated |δmax|');
        expect(reportPage.document.querySelectorAll('.report-entry svg')).toHaveLength(2);
        expect(reportPage.document.querySelector('.report-entry figcaption').textContent).toContain('illustrative and not to scale');
    });
});
