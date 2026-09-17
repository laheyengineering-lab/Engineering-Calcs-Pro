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
    return loadCalculatorPage('calculators/stress-strain.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/stress-strain.js']);
}

describe('stress and strain calculator', () => {
    it('calculates normal stress from force and area', () => {
        const { document, window } = setup();

        setSelectValue(document, 'calculationMode', 'stress');
        setInputValue(document, 'force', 10);
        setInputValue(document, 'area', 100);
        setSelectValue(document, 'forceUnit', 'kN');
        setSelectValue(document, 'areaUnit', 'mm²');
        setSelectValue(document, 'outputUnit', 'MPa');

        window.calculateStressStrain();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(100, 6);
    });

    it('calculates engineering strain from elongation and original length', () => {
        const { document, window } = setup();

        setSelectValue(document, 'calculationMode', 'strain');
        setInputValue(document, 'deltaLength', 0.25);
        setInputValue(document, 'originalLength', 500);
        setSelectValue(document, 'deltaLengthUnit', 'mm');
        setSelectValue(document, 'lengthUnit', 'mm');

        window.calculateStressStrain();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.0005, 8);
    });

    it('calculates elastic modulus from stress and strain', () => {
        const { document, window } = setup();

        setSelectValue(document, 'calculationMode', 'youngsModulus');
        setInputValue(document, 'force', 10);
        setInputValue(document, 'area', 100);
        setInputValue(document, 'strain', 0.0005);
        setSelectValue(document, 'forceUnit', 'kN');
        setSelectValue(document, 'areaUnit', 'mm²');
        setSelectValue(document, 'outputUnit', 'GPa');

        window.calculateStressStrain();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(200, 6);
    });

    it('calculates axial elastic deformation with centralized modulus conversion', () => {
        const { document, window } = setup();

        setSelectValue(document, 'calculationMode', 'deformation');
        setInputValue(document, 'force', 10);
        setInputValue(document, 'area', 100);
        setInputValue(document, 'originalLength', 500);
        setInputValue(document, 'youngsModulus', 200);
        setSelectValue(document, 'forceUnit', 'kN');
        setSelectValue(document, 'areaUnit', 'mm²');
        setSelectValue(document, 'lengthUnit', 'mm');
        setSelectValue(document, 'modulusUnit', 'GPa');

        window.calculateStressStrain();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(0.00025, 8);
        expect(getResultText(document)).toContain('0.25 mm');
    });

    it('rejects zero area inputs instead of returning Infinity', () => {
        const { document, window } = setup();

        setSelectValue(document, 'calculationMode', 'stress');
        setInputValue(document, 'force', 10);
        setInputValue(document, 'area', 0);
        setSelectValue(document, 'forceUnit', 'kN');

        window.calculateStressStrain();

        expect(getResultText(document)).toContain('Invalid Input');
    });

    it('populates materials from the centralized database and updates modulus presets', () => {
        const { document, window } = setup();

        const materialOptions = [...document.getElementById('material').options].map((option) => option.value);
        expect(materialOptions).toContain('carbon-steel');
        expect(materialOptions).toContain('magnesium');

        setSelectValue(document, 'material', 'aluminum');
        window.updateMaterialYoungsModulus();

        expect(Number(document.getElementById('youngsModulus').value)).toBeCloseTo(69, 6);
    });
});
