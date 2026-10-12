import { describe, expect, it } from 'vitest';
import { getResultText, loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

function loadCombinedStress() {
    return loadCalculatorPage('calculators/combined-stress.html', [
        'js/engineering-units.js',
        'js/combined-stress.js'
    ]);
}

describe('combined axial and bending stress calculator', () => {
    it('matches the independently evaluated 20 kN, 2 kN·m rectangular section example', () => {
        const { document, window } = loadCombinedStress();
        setInputValue(document, 'axialForce', 20);
        setInputValue(document, 'bendingMoment', 2);
        setInputValue(document, 'sectionWidth', 100);
        setInputValue(document, 'sectionHeight', 200);
        window.calculateCombinedStress();

        const output = getResultText(document);
        expect(output).toContain('Top fiber: -2 MPa');
        expect(output).toContain('bottom fiber: 4 MPa');
        expect(output).toContain('20,000 mm²');
        expect(output).toContain('66,666,666.6667 mm⁴');
    });

    it('uses centralized force and length conversions and has a zero-moment limit', () => {
        const { document, window } = loadCombinedStress();
        setInputValue(document, 'axialForce', 1000);
        setInputValue(document, 'bendingMoment', 0);
        setInputValue(document, 'sectionWidth', 1);
        setInputValue(document, 'sectionHeight', 25.4);
        setSelectValue(document, 'forceUnit', 'lbf');
        setSelectValue(document, 'momentUnit', 'lbf·in');
        setSelectValue(document, 'lengthUnit', 'in');
        setSelectValue(document, 'heightUnit', 'mm');
        window.calculateCombinedStress();

        const output = getResultText(document);
        expect(output).toContain('Top fiber: 6.8948 MPa');
        expect(output).toContain('bottom fiber: 6.8948 MPa');
    });

    it('rejects missing loads and non-positive dimensions', () => {
        const { document, window } = loadCombinedStress();
        window.calculateCombinedStress();
        expect(getResultText(document)).toContain('Invalid Input');

        setInputValue(document, 'axialForce', 0);
        setInputValue(document, 'bendingMoment', 0);
        setInputValue(document, 'sectionWidth', 100);
        setInputValue(document, 'sectionHeight', 0);
        window.calculateCombinedStress();
        expect(getResultText(document)).toContain('positive section dimensions');
    });
});
