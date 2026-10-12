import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

const NEW = ['hertzian-contact', 'differential-thermal-expansion', 'cylinder-force', 'thick-walled-cylinder'];

function homepage() {
    const page = loadCalculatorPage('index.html', ['js/calculator-data.js', 'js/homepage.js']);
    return { ...page, calculators: page.window.eval('calculators') };
}

describe('new calculator registration', () => {
    it('registers each calculator with a resolving page and no duplicate spring or thread calculators', () => {
        const { calculators } = homepage();
        NEW.forEach((id) => {
            const entry = calculators.find((c) => c.id === id);
            expect(entry, id).toBeTruthy();
            expect(entry.status).toBeUndefined();
            expect(fs.existsSync(entry.path), id).toBe(true);
            expect(fs.existsSync(`js/${id}.js`), id).toBe(true);
        });
        expect(calculators.filter((c) => /spring/i.test(c.id))).toHaveLength(1);
        expect(calculators.filter((c) => /thread/i.test(c.id))).toHaveLength(1);
    });

    it('shows the calculators on the homepage and finds them by search keyword', async () => {
        const { document } = homepage();
        const cards = [...document.querySelectorAll('.calculator-card')].map((c) => c.getAttribute('href'));
        NEW.forEach((id) => expect(cards).toContain(`calculators/${id}.html`));

        const search = (q) => {
            const input = document.getElementById('searchInput');
            input.value = q;
            input.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
            return new Promise((resolve) => setTimeout(() => resolve([...document.querySelectorAll('.calculator-card h3')].map((h) => h.textContent)), 250));
        };
        expect(await search('hertz')).toContain('Hertzian Contact Stress Calculator');
        expect(await search('hydraulic')).toContain('Hydraulic/Pneumatic Cylinder Force Calculator');
        expect(await search('lame')).toContain('Thick-Walled Cylinder Stress Analysis');
        expect(await search('valve pin')).toContain('Differential Thermal Expansion Calculator');
    });

    it.each(NEW)('page %s has theory, example, references and limitations sections and loads shared scripts', (id) => {
        const { document } = loadCalculatorPage(`calculators/${id}.html`, ['js/calculator-context.js']);
        const headings = [...document.querySelectorAll('h2, h3')].map((h) => h.textContent.trim());
        ['Governing Equations', 'Variable Definitions', 'Assumptions & Limitations', 'Worked Example', 'References', 'Engineering Considerations'].forEach((h) => expect(headings, id).toContain(h));
        expect(document.querySelector('.calculator-context .context-equation')).toBeTruthy();
        const html = fs.readFileSync(`calculators/${id}.html`, 'utf8');
        ['katex-loader.js', 'engineering-units.js', 'report-builder.js', `${id}.js`].forEach((s) => expect(html).toContain(s));
        expect(html).not.toMatch(/certif(y|ies|ied)|complies with|code compliance guaranteed/i);
    });
});
