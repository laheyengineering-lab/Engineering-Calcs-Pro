import { describe, it, expect } from 'vitest';
import {
    loadCalculatorPage,
    getResultText,
    getResultValueText,
    extractNumber,
    extractLeadingNumber,
    setInputValue,
    setSelectValue
} from '../helpers/browser-test-utils.js';

function setup() {
    return loadCalculatorPage('calculators/beam-bending-stress.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/beam-section-properties.js', 'js/beam-bending-stress.js']);
}

describe('beam bending stress calculator', () => {
    it('calculates rectangular-section bending stress', () => {
        const { document, window } = setup();

        setSelectValue(document, 'sectionType', 'rectangular');
        setInputValue(document, 'moment', 1000);
        setInputValue(document, 'rectWidth', 50);
        setInputValue(document, 'rectHeight', 100);
        setSelectValue(document, 'momentUnit', 'N·m');
        setSelectValue(document, 'rectWidthUnit', 'mm');
        setSelectValue(document, 'rectHeightUnit', 'mm');
        setSelectValue(document, 'stressUnit', 'MPa');

        window.calculateBeamBendingStress();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(12, 3);
    });

    it('calculates solid-circular bending stress', () => {
        const { document, window } = setup();

        setSelectValue(document, 'sectionType', 'solid-circular');
        window.updateBeamBendingStressMode();
        setInputValue(document, 'moment', 500);
        setInputValue(document, 'diameter', 60);
        setSelectValue(document, 'momentUnit', 'N·m');
        setSelectValue(document, 'diameterUnit', 'mm');
        setSelectValue(document, 'stressUnit', 'MPa');

        window.calculateBeamBendingStress();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(23.579, 3);
    });

    it('rejects impossible hollow geometry', () => {
        const { document, window } = setup();

        setSelectValue(document, 'sectionType', 'hollow-circular');
        window.updateBeamBendingStressMode();
        setInputValue(document, 'moment', 500);
        setInputValue(document, 'outerDiameter', 60);
        setInputValue(document, 'innerDiameter', 60);

        window.calculateBeamBendingStress();

        expect(getResultText(document)).toContain('Invalid Input');
    });

    it('calculates rectangle stress about either centroidal axis and accepts zero moment', () => {
        const { document, window } = setup();
        setInputValue(document, 'moment', 1000);
        setInputValue(document, 'rectWidth', 50);
        setInputValue(document, 'rectHeight', 100);
        window.calculateBeamBendingStress();
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(12, 3);

        setSelectValue(document, 'bendingAxis', 'y');
        window.calculateBeamBendingStress();
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(24, 3);

        setInputValue(document, 'moment', 0);
        window.calculateBeamBendingStress();
        expect(extractLeadingNumber(getResultValueText(document))).toBe(0);
    });

    it('supports profile-specific dimensions, selected axes, and a live centroid diagram', () => {
        const { document, window } = setup();
        setSelectValue(document, 'sectionType', 'hollow-rectangular');
        window.updateBeamBendingStressMode();
        expect(document.getElementById('hollowRectInputs').hidden).toBe(false);
        expect(document.getElementById('rectSectionInputs').hidden).toBe(true);
        setInputValue(document, 'moment', 1000);
        setInputValue(document, 'outerWidth', 100);
        setInputValue(document, 'outerHeight', 80);
        setInputValue(document, 'wallThickness', 10);
        window.calculateBeamBendingStress();
        expect(getResultText(document)).toContain('Iₓ = 2,826,700 mm⁴');
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(14.151, 2);

        setSelectValue(document, 'sectionType', 't-section');
        window.updateBeamBendingStressMode();
        setInputValue(document, 'overallHeight', 120);
        setInputValue(document, 'flangeWidth', 80);
        setInputValue(document, 'flangeThickness', 10);
        setInputValue(document, 'webThickness', 8);
        window.calculateBeamBendingStress();
        expect(extractNumber(getResultText(document), /ȳ = ([\d.,]+) mm/)).toBeCloseTo(83.5714, 3);
        expect(getResultText(document)).toContain('Iₓ = 2,402,600 mm⁴');
        expect(getResultText(document)).toContain('centroidal x-axis');
        expect(document.querySelector('#profileDiagram svg').getAttribute('aria-label')).toContain('T-section');
        expect(document.querySelector('.beam-axis.selected')).toBeTruthy();
    });

    it('records all section properties as an immutable project-report snapshot', () => {
        const { document, window } = setup();
        setSelectValue(document, 'sectionType', 'solid-circular');
        window.updateBeamBendingStressMode();
        setInputValue(document, 'moment', 500);
        setInputValue(document, 'diameter', 60);
        window.calculateBeamBendingStress();
        document.querySelector('.add-to-report-button').click();
        const store = window.FormulaFoundryReport.store;
        expect(store.count()).toBe(1);
        const entry = store.load().entries[0];
        expect(entry.inputs.find((item) => item.label === 'Cross-section profile').value).toBe('Solid circle');
        expect(entry.outputs.find((item) => item.label === 'Second moment of area (Iₓ)').value).toBeCloseTo(636172.5, 1);
        expect(entry.outputs.find((item) => item.label === 'Bending stress').value).toBeCloseTo(23.5785, 3);
        expect(entry.equations).toContain('σ_x = M_x c_x / I_x; S_x = I_x / c_x');

        setInputValue(document, 'diameter', 120);
        window.calculateBeamBendingStress();
        expect(store.load().entries[0].outputs.find((item) => item.label === 'Bending stress').value).toBeCloseTo(23.5785, 3);
    });
});
