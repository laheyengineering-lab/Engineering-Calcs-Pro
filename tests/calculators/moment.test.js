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
    return loadCalculatorPage('calculators/moment.html', ['js/engineering-units.js', 'js/moment.js']);
}

describe('moment calculator', () => {
    it('calculates a metric example in N·mm', () => {
        const { document, window } = setup();

        setInputValue(document, 'force', 100);
        setInputValue(document, 'distance', 25);
        setSelectValue(document, 'forceUnit', 'N');
        setSelectValue(document, 'distanceUnit', 'mm');
        setSelectValue(document, 'momentUnit', 'N·mm');

        window.calculateMoment();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(2500, 6);
    });

    it('handles supported imperial units consistently', () => {
        const { document, window } = setup();

        setInputValue(document, 'force', 10);
        setInputValue(document, 'distance', 2);
        setSelectValue(document, 'forceUnit', 'lbf');
        setSelectValue(document, 'distanceUnit', 'ft');
        setSelectValue(document, 'momentUnit', 'lbf·ft');

        window.calculateMoment();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(20, 6);
    });

    it('rejects zero inputs instead of emitting a numeric result', () => {
        const { document, window } = setup();

        setInputValue(document, 'force', 0);
        setInputValue(document, 'distance', 25);
        window.calculateMoment();

        expect(getResultText(document)).toContain('Invalid Input');
    });
});
