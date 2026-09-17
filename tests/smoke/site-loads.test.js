import { describe, it, expect } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

const calculatorPages = [
    ['calculators/moment.html', ['js/engineering-units.js', 'js/moment.js']],
    ['calculators/bolt-torque.html', ['js/engineering-units.js', 'js/bolt-database.js', 'js/bolt-torque.js']],
    ['calculators/stress-strain.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/stress-strain.js']],
    ['calculators/shaft-torsion.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/shaft-torsion.js']],
    ['calculators/thermal-expansion.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/thermal-expansion.js']],
    ['calculators/beam-deflection.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/beam-deflection.js']],
    ['calculators/column-buckling.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/column-buckling.js']],
    ['calculators/beam-bending-stress.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/beam-bending-stress.js']],
    ['calculators/bearing-life.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/bearing-life.js']],
    ['calculators/factor-of-safety.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/factor-of-safety.js']]
];

describe('page smoke tests', () => {
    it('loads the homepage and renders calculator cards', () => {
        const { document } = loadCalculatorPage('index.html', ['js/calculator-data.js', 'js/homepage.js']);

        expect(document.querySelectorAll('.calculator-card').length).toBeGreaterThan(0);
    });

    it.each(calculatorPages)('loads %s without breaking script initialization', (pagePath, scripts) => {
        const { document } = loadCalculatorPage(pagePath, scripts);

        expect(document.getElementById('result')).toBeTruthy();
        expect(document.title).toContain('Engineering Calcs Pro');
    });
});
