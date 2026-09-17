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
    return loadCalculatorPage('calculators/bearing-life.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/bearing-life.js']);
}

describe('bearing life calculator', () => {
    it('calculates the worked ball-bearing life example', () => {
        const { document, window } = setup();

        setSelectValue(document, 'bearingType', 'ball');
        setInputValue(document, 'dynamicLoadRating', 30);
        setInputValue(document, 'equivalentDynamicLoad', 10);
        setInputValue(document, 'speed', 1500);
        setSelectValue(document, 'dynamicLoadRatingUnit', 'kN');
        setSelectValue(document, 'equivalentDynamicLoadUnit', 'kN');
        setSelectValue(document, 'speedUnit', 'rpm');

        window.calculateBearingLife();

        const resultText = getResultText(document);
        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(27, 6);
        expect(resultText).toContain('300 h');
    });

    it('uses the roller-bearing exponent and rotational speed conversion', () => {
        const { document, window } = setup();
        const expectedLife = Math.pow(3, 10 / 3);

        setSelectValue(document, 'bearingType', 'roller');
        setInputValue(document, 'dynamicLoadRating', 30);
        setInputValue(document, 'equivalentDynamicLoad', 10);
        setInputValue(document, 'speed', 25);
        setSelectValue(document, 'dynamicLoadRatingUnit', 'kN');
        setSelectValue(document, 'equivalentDynamicLoadUnit', 'kN');
        setSelectValue(document, 'speedUnit', 'rps');

        window.calculateBearingLife();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(expectedLife, 5);
    });

    it('rejects zero or missing load inputs', () => {
        const { document, window } = setup();

        setInputValue(document, 'dynamicLoadRating', 0);
        setInputValue(document, 'equivalentDynamicLoad', 10);
        setInputValue(document, 'speed', 1500);

        window.calculateBearingLife();

        expect(getResultText(document)).toContain('Invalid Input');
    });
});
