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
    return loadCalculatorPage('calculators/beam-deflection.html', ['js/engineering-units.js', 'js/beam-deflection.js']);
}

function configureCommonInputs(document) {
    setInputValue(document, 'beamLength', 2);
    setInputValue(document, 'youngsModulus', 200);
    setInputValue(document, 'areamomentinertia', 8.333e6);
    setSelectValue(document, 'lengthUnit', 'm');
    setSelectValue(document, 'modulusUnit', 'GPa');
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
        expect(extractNumber(resultText, /Maximum Moment: Mmax = [^=]+ = ([\d.,-]+) N·m/i)).toBeCloseTo(500, 6);
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
        expect(extractNumber(resultText, /Maximum Moment: Mmax = [^=]+ = ([\d.,-]+) N·m/i)).toBeCloseTo(500, 6);
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
        expect(extractNumber(resultText, /Maximum Moment: Mmax = [^=]+ = ([\d.,-]+) N·m/i)).toBeCloseTo(2000, 6);
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
        expect(extractNumber(resultText, /Maximum Moment: Mmax = [^=]+ = ([\d.,-]+) N·m/i)).toBeCloseTo(2000, 6);
    });

    it('rejects missing load inputs for the selected case', () => {
        const { document, window } = setup();
        configureCommonInputs(document);
        setSelectValue(document, 'loadingCase', 'ss-point');
        setInputValue(document, 'pointLoad', 0);

        window.calculateBeamDeflection();

        expect(getResultText(document)).toContain('Invalid Input');
    });
});
