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
    return loadCalculatorPage('calculators/thermal-expansion.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/thermal-expansion.js']);
}

describe('thermal expansion calculator', () => {
    it('calculates free expansion, final length, strain, and restrained stress', () => {
        const { document, window } = setup();

        setInputValue(document, 'alpha', 12e-6);
        setInputValue(document, 'originalLength', 2);
        setInputValue(document, 'temperatureChange', 50);
        setInputValue(document, 'youngsModulus', 200);
        setSelectValue(document, 'lengthUnit', 'm');
        setSelectValue(document, 'temperatureUnit', '°C');
        setSelectValue(document, 'modulusUnit', 'GPa');
        setSelectValue(document, 'outputLengthUnit', 'mm');
        setSelectValue(document, 'stressUnit', 'MPa');

        window.calculateThermalExpansion();

        const resultText = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(1.2, 6);
        expect(resultText).toContain('2,001.2 mm');
        expect(resultText).toContain('0.0006');
        expect(resultText).toContain('120 MPa');
    });

    it('handles Fahrenheit temperature intervals through the shared conversion core', () => {
        const { document, window } = setup();

        setInputValue(document, 'alpha', 12e-6);
        setInputValue(document, 'originalLength', 2);
        setInputValue(document, 'temperatureChange', 90);
        setSelectValue(document, 'temperatureUnit', '°F');
        setSelectValue(document, 'lengthUnit', 'm');
        setSelectValue(document, 'outputLengthUnit', 'mm');

        window.calculateThermalExpansion();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(1.2, 6);
    });

    it('rejects zero length inputs', () => {
        const { document, window } = setup();

        setInputValue(document, 'alpha', 12e-6);
        setInputValue(document, 'originalLength', 0);
        setInputValue(document, 'temperatureChange', 50);

        window.calculateThermalExpansion();

        expect(getResultText(document)).toContain('Invalid Input');
    });

    it('populates materials from the centralized database and updates alpha presets', () => {
        const { document, window } = setup();

        const materialOptions = [...document.getElementById('material').options].map((option) => option.value);
        expect(materialOptions).toContain('carbon-steel');
        expect(materialOptions).toContain('magnesium');

        setSelectValue(document, 'material', 'titanium');
        window.updateMaterialAlpha();

        expect(Number(document.getElementById('alpha').value)).toBeCloseTo(8.6e-6, 12);
    });

    it('rejects non-positive modulus when restrained stress is requested', () => {
        const { document, window } = setup();

        setInputValue(document, 'alpha', 12e-6);
        setInputValue(document, 'originalLength', 2);
        setInputValue(document, 'temperatureChange', 50);
        setInputValue(document, 'youngsModulus', -1);

        window.calculateThermalExpansion();

        expect(getResultText(document)).toContain('Young\'s modulus must be positive');
    });
});
