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
    return loadCalculatorPage('calculators/column-buckling.html', ['js/engineering-units.js', 'js/column-buckling.js']);
}

function configureBaseInputs(document) {
    setSelectValue(document, 'sectionType', 'solid');
    setSelectValue(document, 'material', 'carbon-steel');
    setInputValue(document, 'length', 2);
    setInputValue(document, 'outerDiameter', 50);
    setSelectValue(document, 'lengthUnit', 'm');
    setSelectValue(document, 'outerDiameterUnit', 'mm');
    setSelectValue(document, 'forceUnit', 'kN');
}

describe('column buckling calculator', () => {
    it('calculates Euler load for pinned-pinned conditions', () => {
        const { document, window } = setup();
        configureBaseInputs(document);
        setSelectValue(document, 'boundaryCondition', 'pinned-pinned');

        window.calculateColumnBuckling();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(151.398, 2);
    });

    it('applies the fixed-free effective-length factor correctly', () => {
        const { document, window } = setup();
        configureBaseInputs(document);
        setSelectValue(document, 'boundaryCondition', 'fixed-free');

        window.calculateColumnBuckling();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(37.849, 2);
    });

    it('applies the fixed-fixed effective-length factor correctly', () => {
        const { document, window } = setup();
        configureBaseInputs(document);
        setSelectValue(document, 'boundaryCondition', 'fixed-fixed');

        window.calculateColumnBuckling();

        expect(extractLeadingNumber(getResultValueText(document))).toBeCloseTo(605.591, 1);
    });

    it('rejects hollow sections whose inner diameter is not smaller than the outer diameter', () => {
        const { document, window } = setup();

        setSelectValue(document, 'sectionType', 'hollow');
        window.updateColumnBucklingMode();
        setSelectValue(document, 'material', 'carbon-steel');
        setInputValue(document, 'length', 2);
        setInputValue(document, 'outerDiameter', 50);
        setInputValue(document, 'innerDiameter', 50);

        window.calculateColumnBuckling();

        expect(getResultText(document)).toContain('Invalid Input');
    });
});
