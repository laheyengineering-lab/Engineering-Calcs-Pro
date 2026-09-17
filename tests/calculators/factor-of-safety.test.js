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
    return loadCalculatorPage('calculators/factor-of-safety.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/factor-of-safety.js']);
}

describe('factor of safety calculator', () => {
    it('calculates stress-based factor of safety', () => {
        const { document, window } = setup();

        setSelectValue(document, 'mode', 'stress');
        window.updateFactorOfSafetyMode();
        setInputValue(document, 'strength', 250);
        setInputValue(document, 'appliedStress', 100);
        setSelectValue(document, 'strengthUnit', 'MPa');
        setSelectValue(document, 'appliedStressUnit', 'MPa');

        window.calculateFactorOfSafety();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(2.5, 6);
        expect(getResultText(document)).toContain('FoS > 1');
    });

    it('calculates load-based factor of safety across supported load units', () => {
        const { document, window } = setup();

        setSelectValue(document, 'mode', 'load');
        window.updateFactorOfSafetyMode();
        setInputValue(document, 'failureLoad', 10);
        setInputValue(document, 'appliedLoad', 5000);
        setSelectValue(document, 'failureLoadUnit', 'kN');
        setSelectValue(document, 'appliedLoadUnit', 'N');

        window.calculateFactorOfSafety();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(2, 6);
    });

    it('handles the FoS = 1 boundary exactly', () => {
        const { document, window } = setup();

        setSelectValue(document, 'mode', 'stress');
        window.updateFactorOfSafetyMode();
        setInputValue(document, 'strength', 100);
        setInputValue(document, 'appliedStress', 100);
        setSelectValue(document, 'strengthUnit', 'MPa');
        setSelectValue(document, 'appliedStressUnit', 'MPa');

        window.calculateFactorOfSafety();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(1, 6);
        expect(getResultText(document)).toContain('FoS = 1');
    });

    it('loads material strength from the centralized database', () => {
        const { document, window } = setup();

        setSelectValue(document, 'mode', 'stress');
        setSelectValue(document, 'strengthSource', 'material-yield');
        window.updateFactorOfSafetyMode();
        setSelectValue(document, 'material', 'carbon-steel');
        setSelectValue(document, 'strengthUnit', 'MPa');

        window.updateMaterialStrength();

        expect(Number(document.getElementById('strength').value)).toBeCloseTo(170, 3);
    });

    it('rejects zero applied load inputs', () => {
        const { document, window } = setup();

        setSelectValue(document, 'mode', 'load');
        window.updateFactorOfSafetyMode();
        setInputValue(document, 'failureLoad', 10);
        setInputValue(document, 'appliedLoad', 0);

        window.calculateFactorOfSafety();

        expect(getResultText(document)).toContain('Invalid Input');
    });
});
