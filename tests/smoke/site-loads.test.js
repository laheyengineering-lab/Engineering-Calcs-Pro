import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

const calculatorPages = [
    ['calculators/moment.html', ['js/engineering-units.js', 'js/moment.js']],
    ['calculators/bolt-torque.html', ['js/engineering-units.js', 'js/bolt-database.js', 'js/bolt-torque.js']],
    ['calculators/stress-strain.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/stress-strain.js']],
    ['calculators/shaft-torsion.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/shaft-torsion.js']],
    ['calculators/thermal-expansion.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/thermal-expansion.js']],
    ['calculators/beam-deflection.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/engineering-diagram.js', 'js/beam-section-properties.js', 'js/beam-section-ui.js', 'js/beam-deflection-diagram.js', 'js/beam-deflection.js']],
    ['calculators/column-buckling.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/column-buckling.js']],
    ['calculators/beam-bending-stress.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/engineering-diagram.js', 'js/beam-section-properties.js', 'js/beam-section-ui.js', 'js/beam-bending-stress.js']],
    ['calculators/bearing-life.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/bearing-life.js']],
    ['calculators/factor-of-safety.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/factor-of-safety.js']],
    ['calculators/spring-calculations.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/spring-calculations.js']],
    ['calculators/thread-strength.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/thread-strength.js']],
    ['calculators/hertzian-contact.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/hertzian-contact.js']],
    ['calculators/differential-thermal-expansion.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/differential-thermal-expansion.js']],
    ['calculators/cylinder-force.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/cylinder-force.js']],
    ['calculators/thick-walled-cylinder.html', ['js/engineering-units.js', 'js/calculator-utils.js', 'js/thick-walled-cylinder.js']]
];

describe('page smoke tests', () => {
    it('loads the homepage and renders calculator cards', () => {
        const { document } = loadCalculatorPage('index.html', ['js/calculator-data.js', 'js/homepage.js']);

        expect(document.querySelectorAll('.calculator-card').length).toBeGreaterThan(0);
    });

    it.each(calculatorPages)('loads %s without breaking script initialization', (pagePath, scripts) => {
        const { document } = loadCalculatorPage(pagePath, scripts);

        expect(document.getElementById('result')).toBeTruthy();
        expect(document.title).toContain('Formula Foundry');
    });

    it('keeps beam SVGs responsive and avoids a fixed mobile diagram width', () => {
        const css = fs.readFileSync('css/style.css', 'utf8');
        expect(css).toMatch(/\.beam-interactive-diagram\s*{[^}]*width:\s*min\(100%, 680px\)/s);
        expect(css).toMatch(/\.beam-interactive-diagram svg\s*{[^}]*width:\s*100%;[^}]*height:\s*auto/s);
        expect(css).toMatch(/\.beam-span-slider\s*{[^}]*width:\s*100%/s);
    });

    it.each(['about.html', 'references.html', 'methodology.html'])('loads supplemental page %s with shared navigation', (pagePath) => {
        const { document } = loadCalculatorPage(pagePath, []);

        expect(document.querySelector('h1')).toBeTruthy();
        expect(document.title).toContain('Formula Foundry');
        ['about.html', 'references.html', 'methodology.html'].forEach((href) => {
            expect(document.querySelector(`.site-nav a[href="${href}"]`)).toBeTruthy();
            expect(document.querySelector(`.site-footer a[href="${href}"]`)).toBeTruthy();
        });
    });
});
