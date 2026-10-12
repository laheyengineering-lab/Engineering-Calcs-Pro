import { describe, expect, it } from 'vitest';
import { getResultText, loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

function loadPinBearing() {
    return loadCalculatorPage('calculators/pin-bearing-pressure.html', [
        'js/engineering-units.js',
        'js/pin-bearing-pressure.js'
    ]);
}

describe('pin bearing pressure calculator', () => {
    it('matches the 10 kN load on a 10 mm pin through an 8 mm plate example', () => {
        const { document, window } = loadPinBearing();
        setInputValue(document, 'pinLoad', 10);
        setInputValue(document, 'pinDiameter', 10);
        setInputValue(document, 'plateThickness', 8);
        window.calculatePinBearingPressure();

        const output = getResultText(document);
        expect(output).toContain('125 MPa');
        expect(output).toContain('80 mm²');
    });

    it('converts force and each dimension independently', () => {
        const { document, window } = loadPinBearing();
        setInputValue(document, 'pinLoad', 10);
        setInputValue(document, 'pinDiameter', 1);
        setInputValue(document, 'plateThickness', 25.4);
        setSelectValue(document, 'forceUnit', 'lbf');
        setSelectValue(document, 'diameterUnit', 'in');
        setSelectValue(document, 'thicknessUnit', 'mm');
        window.calculatePinBearingPressure();

        expect(getResultText(document)).toContain('0.06895 MPa');
    });

    it('rejects missing, zero, and negative geometry or load', () => {
        const { document, window } = loadPinBearing();
        window.calculatePinBearingPressure();
        expect(getResultText(document)).toContain('Invalid Input');

        setInputValue(document, 'pinLoad', 100);
        setInputValue(document, 'pinDiameter', 0);
        setInputValue(document, 'plateThickness', 8);
        window.calculatePinBearingPressure();
        expect(getResultText(document)).toContain('positive finite');
    });
});
