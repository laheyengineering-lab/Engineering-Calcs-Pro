import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadHomepage() {
    const page = loadCalculatorPage('index.html', ['js/calculator-data.js', 'js/homepage.js']);
    return {
        ...page,
        calculators: page.window.eval('calculators')
    };
}

describe('calculator metadata registry', () => {
    it('has complete unique metadata and valid related IDs and paths', () => {
        const { calculators, window } = loadHomepage();
        const ids = calculators.map((calculator) => calculator.id);

        expect(calculators).toHaveLength(17);
        expect(new Set(ids).size).toBe(ids.length);
        expect(window.validateCalculatorData(calculators)).toBe(true);

        calculators.forEach((calculator) => {
            expect('link' in calculator).toBe(false);
            expect(calculator.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
            ['name', 'shortDescription', 'description', 'category', 'path'].forEach((field) => {
                expect(typeof calculator[field]).toBe('string');
                expect(calculator[field].length).toBeGreaterThan(0);
            });
            expect(Array.isArray(calculator.related)).toBe(true);
            expect(Array.isArray(calculator.keywords)).toBe(true);
            expect(new Set(calculator.keywords).size).toBe(calculator.keywords.length);
            calculator.related.forEach((relatedId) => expect(ids).toContain(relatedId));

            if (calculator.status === 'coming-soon') {
                expect(fs.existsSync(path.join(repoRoot, calculator.path))).toBe(false);
            } else {
                expect(fs.existsSync(path.join(repoRoot, calculator.path))).toBe(true);
            }
        });
    });

    it('reports malformed metadata without throwing', () => {
        const { window } = loadHomepage();
        const logError = vi.spyOn(window.console, 'error').mockImplementation(() => {});
        const invalid = [
            {
                id: 'Invalid ID',
                name: 'Invalid Calculator',
                shortDescription: 'Short',
                description: 'Full',
                category: 'Mechanical',
                path: 'calculators/invalid.html',
                related: ['missing-calculator'],
                keywords: []
            },
            {
                id: 'Invalid ID',
                name: 'Duplicate ID',
                shortDescription: 'Short',
                description: 'Full',
                category: 'Mechanical',
                path: 'calculators/duplicate.html',
                related: [],
                keywords: []
            },
            { id: 'incomplete-calculator' }
        ];

        expect(window.validateCalculatorData(invalid)).toBe(false);
        expect(logError).toHaveBeenCalled();
        logError.mockRestore();
    });

    it('renders every calculator and makes Coming Soon cards non-clickable', () => {
        const { document } = loadHomepage();
        const cards = [...document.querySelectorAll('.calculator-card')];

        expect(cards).toHaveLength(17);
        expect(cards.filter((card) => card.tagName === 'A')).toHaveLength(14);
        expect(cards.filter((card) => card.tagName === 'DIV')).toHaveLength(3);

        const momentCard = cards.find((card) => card.querySelector('h3').textContent === 'Moment Calculator');
        expect(momentCard.querySelector('p').textContent).toBe('Calculate torque from force and perpendicular distance.');
        expect(momentCard.getAttribute('href')).toBe('calculators/moment.html');
    });

    it.each([
        ['Moment Calculator', 'moment'],
        ['perpendicular distance', 'moment'],
        ["Young's modulus", 'stress-strain'],
        ['spring rate', 'spring-calculations'],
        ['thread stripping', 'thread-strength']
    ])('searches calculator metadata for "%s"', (searchTerm, expectedId) => {
        const { document, window } = loadHomepage();

        window.buildHomepage(searchTerm);

        const visibleNames = [...document.querySelectorAll('.calculator-card h3')].map((heading) => heading.textContent);
        const expectedCalculator = window.eval('calculators').find((calculator) => calculator.id === expectedId);
        expect(visibleNames).toContain(expectedCalculator.name);
    });
});
