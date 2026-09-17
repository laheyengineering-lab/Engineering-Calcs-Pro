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
    return loadCalculatorPage('calculators/shaft-torsion.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/shaft-torsion.js']);
}

describe('shaft torsion calculator', () => {
    it('calculates solid-shaft polar moment, shear stress, and angle of twist', () => {
        const { document, window } = setup();

        setSelectValue(document, 'shaftType', 'solid');
        setInputValue(document, 'torque', 500);
        setInputValue(document, 'outerDiameter', 50);
        setInputValue(document, 'length', 2);
        setInputValue(document, 'shearModulus', 80);
        setSelectValue(document, 'torqueUnit', 'N·m');
        setSelectValue(document, 'diameterUnit', 'mm');
        setSelectValue(document, 'lengthUnit', 'm');
        setSelectValue(document, 'modulusUnit', 'GPa');
        setSelectValue(document, 'stressUnit', 'MPa');

        window.calculateShaftTorsion();

        const resultText = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(20.372, 3);
        expect(Math.abs(extractNumber(resultText, /J = ([\d.,e+-]+) m⁴/i) - 6.135923e-7)).toBeLessThan(5e-9);
        expect(extractNumber(resultText, /= ([\d.,e+-]+) rad/i)).toBeCloseTo(0.020372, 5);
    });

    it('calculates hollow-shaft behavior with the implemented formula set', () => {
        const { document, window } = setup();

        const expectedJ = Math.PI * (Math.pow(0.06, 4) - Math.pow(0.04, 4)) / 32;
        const expectedStressMpa = ((300 * 0.03) / expectedJ) / 1e6;

        setSelectValue(document, 'shaftType', 'hollow');
        window.updateShaftTorsionMode();
        setInputValue(document, 'torque', 300);
        setInputValue(document, 'outerDiameter', 60);
        setInputValue(document, 'innerDiameter', 40);
        setInputValue(document, 'length', 1.5);
        setInputValue(document, 'shearModulus', 77);
        setSelectValue(document, 'torqueUnit', 'N·m');
        setSelectValue(document, 'diameterUnit', 'mm');
        setSelectValue(document, 'innerDiameterUnit', 'mm');
        setSelectValue(document, 'lengthUnit', 'm');
        setSelectValue(document, 'modulusUnit', 'GPa');
        setSelectValue(document, 'stressUnit', 'MPa');

        window.calculateShaftTorsion();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(expectedStressMpa, 3);
    });

    it('rejects invalid hollow geometry before dividing by a bad polar moment', () => {
        const { document, window } = setup();

        setSelectValue(document, 'shaftType', 'hollow');
        window.updateShaftTorsionMode();
        setInputValue(document, 'torque', 300);
        setInputValue(document, 'outerDiameter', 40);
        setInputValue(document, 'innerDiameter', 40);
        setInputValue(document, 'length', 1.5);
        setInputValue(document, 'shearModulus', 77);

        window.calculateShaftTorsion();

        expect(getResultText(document)).toContain('Invalid Input');
    });

    it('populates materials from the centralized database and updates shear modulus presets', () => {
        const { document, window } = setup();

        const materialOptions = [...document.getElementById('material').options].map((option) => option.value);
        expect(materialOptions).toContain('carbon-steel');
        expect(materialOptions).toContain('magnesium');

        setSelectValue(document, 'material', 'stainless-steel');
        window.updateMaterialShearModulus();

        expect(Number(document.getElementById('shearModulus').value)).toBeCloseTo(77, 6);
    });
});
