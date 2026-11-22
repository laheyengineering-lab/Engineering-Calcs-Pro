import fs from 'node:fs';
import { expect, it } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

it.each([
    ['calculators/wall-mounting.html', (id) => '#' + id, 'input'],
    ['design-studies.html', (id) => '[data-input-id="' + id + '"]', 'change']
])('%s shows the geometry note beside the active spacing input', (path, selector, event) => {
    const scripts = [...fs.readFileSync(path, 'utf8').matchAll(/<script src="(?:\.\.\/)?(js\/[^"]+)"><\/script>/g)]
        .map((match) => match[1]).filter((script) => !script.includes('katex'));
    const { dom, window, document } = loadCalculatorPage(path, scripts);
    try {
        if (path === 'design-studies.html') {
            document.getElementById('newStudyName').value = 'Mounting geometry';
            document.getElementById('newStudyCalculator').value = 'wall-mounting';
            document.getElementById('newStudyForm').dispatchEvent(new window.Event('submit', { cancelable: true }));
            document.getElementById('addScenario').click();
        }
        const spacing = document.querySelector(selector('horizontalSpacing'));
        const help = document.getElementById(spacing.getAttribute('aria-describedby'));
        const field = document.querySelector('[data-study-field="horizontalSpacing"]') ?? spacing.parentElement;
        expect(field.contains(help)).toBe(true);
        expect(field.hidden).toBe(true);
        for (const [id, value] of [['arrangement', 'Symmetric two-row mount'], ['count', '4']]) {
            const input = document.querySelector(selector(id));
            input.value = value;
            input.dispatchEvent(new window.Event(event, { bubbles: true }));
        }
        expect(field.hidden).toBe(false);
        expect(help.textContent).toContain('documents the fastener layout');
        expect(help.textContent).toContain('leaves the calculated demands unchanged');
    } finally {
        dom.window.close();
    }
});
