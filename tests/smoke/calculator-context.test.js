import { describe, it, expect } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

describe('calculator context block', () => {
    it('is placed between header and inputs and links to theory', () => {
        const { document } = loadCalculatorPage('calculators/moment.html', ['js/calculator-context.js']);
        const header = document.querySelector('.calculator-header');
        const context = header.nextElementSibling;

        expect(context.classList.contains('calculator-context')).toBe(true);
        expect(context.querySelector('.context-equation').textContent).toContain('M = F d');
        const href = context.querySelector('.context-link').getAttribute('href');
        expect(document.querySelector(href).classList.contains('theory-column')).toBe(true);
    });

    it('omits the equation when a page has several governing equations', () => {
        const { document } = loadCalculatorPage('calculators/beam-deflection.html', ['js/calculator-context.js']);
        const context = document.querySelector('.calculator-context');

        expect(context.querySelector('.context-equation')).toBeNull();
        expect(context.querySelector('.context-inputs')).toBeTruthy();
    });
});
