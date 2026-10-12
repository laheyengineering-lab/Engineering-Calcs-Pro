import { describe, expect, it } from 'vitest';
import { getResultText, loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

function loadToleranceStack() {
    return loadCalculatorPage('calculators/tolerance-stack-up.html', [
        'js/engineering-units.js',
        'js/calculator-utils.js',
        'js/tolerance-stack-up.js'
    ]);
}

describe('tolerance stack-up calculator', () => {
    it('matches the independent worst-case and RSS example', () => {
        const { document, window } = loadToleranceStack();
        setInputValue(document, 'tolerance1', 0.1);
        setInputValue(document, 'tolerance2', 0.2);
        setInputValue(document, 'tolerance3', 0.15);
        window.calculateToleranceStackUp();

        const output = getResultText(document);
        expect(output).toContain('±0.45 mm');
        expect(output).toContain('±0.269258 mm');
        expect(output).toContain('3');
    });

    it('combines mixed units in SI and converts outputs to the selected unit', () => {
        const { document, window } = loadToleranceStack();
        setInputValue(document, 'tolerance1', 0.1);
        setInputValue(document, 'tolerance2', 0.0002);
        setSelectValue(document, 'toleranceUnit2', 'm');
        setSelectValue(document, 'outputUnit', 'µm');
        window.calculateToleranceStackUp();

        const output = getResultText(document);
        expect(output).toContain('±300 µm');
        expect(output).toContain('±223.606798 µm');
    });

    it('accepts a zero boundary contribution and rejects empty or negative inputs', () => {
        const { document, window } = loadToleranceStack();
        setInputValue(document, 'tolerance1', 0);
        window.calculateToleranceStackUp();
        expect(getResultText(document)).toContain('±0 mm');

        setInputValue(document, 'tolerance1', '');
        window.calculateToleranceStackUp();
        expect(getResultText(document)).toContain('at least one');

        setInputValue(document, 'tolerance1', -0.1);
        window.calculateToleranceStackUp();
        expect(getResultText(document)).toContain('non-negative');
    });
});
