import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

const scripts = [
    'js/engineering-units.js', 'js/cylinder-force.js', 'js/differential-thermal-expansion.js', 'js/report-builder.js', 'js/design-study-core.js',
    'js/design-study-adapters.js', 'js/study-chart.js', 'js/report-page.js'
];

describe('report page rendering of Design Studies entries', () => {
    it('prints sweep data tables, a labelled chart and study metadata', () => {
        const { window, document } = loadCalculatorPage('report.html', scripts.filter((s) => s !== 'js/report-page.js'));
        const S = window.FormulaFoundryStudies;
        const cyl = S.getAdapter('cylinder-force');
        const base = S.calculateScenario(cyl, S.createScenario(cyl, 'Base', { boreDiameter: 100, rodDiameter: 50, workingPressure: 100 }));
        const study = S.addScenario(S.createStudy('Rod study', 'cylinder-force'), base);
        const sweep = S.runSweep(cyl, base, { inputId: 'rodDiameter', outputId: 'retractionForce', start: 0, end: 120, mode: 'step', step: 40 }).sweep;
        const memory = {};
        window.FormulaFoundryReport.store.setStorage({ getItem: (k) => memory[k] ?? null, setItem: (k, v) => { memory[k] = v; }, removeItem: (k) => { delete memory[k]; } });
        expect(window.FormulaFoundryReport.addSnapshot(S.sweepReportSnapshot(study, sweep).snapshot).ok).toBe(true);

        const page = document.createElement('script');
        page.textContent = fs.readFileSync('js/report-page.js', 'utf8');
        document.body.appendChild(page);
        document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

        const entry = document.querySelector('.report-entry');
        expect(entry.textContent).toContain('Design study: Rod study');
        expect(entry.querySelector('svg.study-chart')).not.toBeNull();
        expect(entry.querySelector('svg.study-chart').textContent).toMatch(/retraction force \[kN\]/);
        const dataRows = Array.from(entry.querySelectorAll('.report-data-table tbody tr')).map((r) => r.textContent);
        expect(dataRows).toHaveLength(4);
        expect(dataRows[3]).toContain('FAILED');
        expect(entry.textContent).toContain('model-based exploration');
    });
});
