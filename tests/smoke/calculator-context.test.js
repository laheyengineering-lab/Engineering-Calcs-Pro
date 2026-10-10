import fs from 'node:fs';
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

    it('shows an equation and main inputs on every calculator', () => {
        const pages = fs.readdirSync('calculators').filter((f) => f.endsWith('.html'));
        expect(pages.length).toBeGreaterThan(0);
        pages.forEach((page) => {
            const { document } = loadCalculatorPage('calculators/' + page, ['js/calculator-context.js']);
            const context = document.querySelector('.calculator-context');
            expect(context.querySelector('.context-equation').textContent, page).toContain('\\[');
            expect(context.querySelectorAll('ul.context-inputs li').length, page).toBeGreaterThan(1);
        });
    });

    it('shows the default-case equation for multi-case pages', () => {
        const { document } = loadCalculatorPage('calculators/beam-deflection.html', ['js/calculator-context.js']);
        const text = document.querySelector('.context-equation').textContent;
        expect(text).toContain('48 E I');
        expect(document.querySelector('.context-inputs')).toBeTruthy();
    });
});
