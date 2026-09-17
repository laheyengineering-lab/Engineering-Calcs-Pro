import { describe, it, expect } from 'vitest';
import {
    loadCalculatorPage,
    getResultText,
    getResultValueText,
    extractLeadingNumber,
    setInputValue,
    setSelectValue
} from '../helpers/browser-test-utils.js';

function setup() {
    return loadCalculatorPage('calculators/beam-bending-stress.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/beam-bending-stress.js']);
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
});
