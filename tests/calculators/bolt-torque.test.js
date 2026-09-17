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
    return loadCalculatorPage('calculators/bolt-torque.html', [
        'js/engineering-units.js',
        'js/bolt-database.js',
        'js/bolt-torque.js'
    ]);
}

describe('bolt torque calculator', () => {
    it('calculates the worked metric torque relation T = KDF', () => {
        const { document, window } = setup();

        setSelectValue(document, 'unitSystem', 'metric');
        window.updateBoltCalculator();
        setSelectValue(document, 'boltSize', '10');
        setInputValue(document, 'clampLoad', 50);
        setInputValue(document, 'nutFactor', 0.2);
        setSelectValue(document, 'loadUnit', 'kN');
        setSelectValue(document, 'torqueUnit', 'N·m');

        window.calculateBoltTorque();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(100, 6);
    });

    it('changes torque proportionally when nut factor changes', () => {
        const { document, window } = setup();

        setSelectValue(document, 'unitSystem', 'metric');
        window.updateBoltCalculator();
        setSelectValue(document, 'boltSize', '10');
        setInputValue(document, 'clampLoad', 50);
        setInputValue(document, 'nutFactor', 0.3);
        setSelectValue(document, 'loadUnit', 'kN');
        setSelectValue(document, 'torqueUnit', 'N·m');

        window.calculateBoltTorque();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(150, 6);
    });

    it('supports imperial selections from the shared bolt database', () => {
        const { document, window } = setup();

        setSelectValue(document, 'unitSystem', 'imperial');
        window.updateBoltCalculator();
        setSelectValue(document, 'boltSize', '0.5');
        setInputValue(document, 'clampLoad', 1000);
        setInputValue(document, 'nutFactor', 0.2);
        setSelectValue(document, 'loadUnit', 'lbf');
        setSelectValue(document, 'torqueUnit', 'lbf·in');

        window.calculateBoltTorque();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(100, 6);
    });

    it('rejects missing bolt selection and zero load inputs', () => {
        const { document, window } = setup();

        setInputValue(document, 'clampLoad', 0);
        setInputValue(document, 'nutFactor', 0.2);
        window.calculateBoltTorque();

        expect(getResultText(document)).toContain('Invalid Input');
    });
});
