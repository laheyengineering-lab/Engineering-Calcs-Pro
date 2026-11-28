import { describe, expect, it, vi } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

function setup() {
    const { document, window } = loadCore([
        'js/engineering-units.js',
        'js/beam-section-properties.js',
        'js/beam-study-calculations.js',
        'js/shaft-torsion-calculation.js',
        'js/factor-of-safety-calculation.js',
        'js/bearing-life-calculation.js',
        'js/shaft-bearing-core.js',
        'js/shaft-bearing-project.js',
        'js/shaft-bearing-example.js',
        'js/engineering-diagram.js',
        'js/calculator-diagrams.js',
        'js/shaft-bearing-diagram.js'
    ]);
    const model = window.FormulaFoundryShaftBearing;
    const project = window.FormulaFoundryShaftProject;
    const example = window.FormulaFoundryShaftExample.create(project).configurations[0];
    const diagram = window.FormulaFoundryShaftDiagram;
    return { document, window, model, example, diagram, registry: window.FormulaFoundryCalculatorDiagrams };
}

describe('shaft workflow graphics', () => {
    it('retains individual, keyboard-operable stations even at the same coordinate', () => {
        const { document, window, model, example, diagram, registry } = setup();
        const { inputs, units } = example;
        inputs.loads.push({ ...inputs.loads[0], id: 'second-station', name: 'Second load' });
        const result = model.calculate(inputs);
        expect(result.ok).toBe(true);
        const host = document.createElement('div');
        const select = vi.fn();
        const svg = diagram.mount(host, inputs, result, units, select);
        const buttons = [...svg.querySelectorAll('[role="button"]')];
        expect(svg.getAttribute('role')).toBe('group');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].querySelector('.shaft-station-badge').getAttribute('x'))
            .not.toBe(buttons[1].querySelector('.shaft-station-badge').getAttribute('x'));
        expect(buttons[0].querySelector('circle').getAttribute('cx'))
            .toBe(buttons[1].querySelector('circle').getAttribute('cx'));
        expect(buttons[1].getAttribute('aria-label')).toContain('Second load');
        expect(buttons[1].getAttribute('tabindex')).toBe('0');
        buttons[1].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        buttons[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        expect(select.mock.calls).toEqual([[1], [0]]);
        diagram.setSelection(host, 1);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
        expect(registry.snapshot(host)?.id).toBe('shaft-bearing');
    });

    it('reconstructs a hollow, zero-torque report schematic in the selected output units', () => {
        const { document, model, example, diagram, registry } = setup();
        const inputs = {
            ...example.inputs, section: 'hollow', innerDiameter: 0.02,
            torque: { value: 0, start: 0, end: 0 }
        };
        const units = { ...example.units, outputDiameter: 'in', outputLength: 'in', outputForce: 'lbf' };
        const result = model.calculate(inputs);
        expect(result.ok).toBe(true);
        const modelData = JSON.parse(JSON.stringify(diagram.describe(inputs, result, units)));
        expect(registry.normalize('shaft-bearing', modelData, true)).not.toBeNull();
        expect(modelData.outerDiameter).toBeCloseTo(1.5748, 4);
        expect(modelData.span).toBeCloseTo(23.622, 3);
        const svg = registry.render(document, 'shaft-bearing', modelData);
        expect(svg.getAttribute('role')).toBe('img');
        expect(svg.querySelectorAll('[role="button"]')).toHaveLength(0);
        expect(svg.querySelectorAll('.ff-section[fill-rule="evenodd"]')).toHaveLength(1);
        expect(svg.textContent).toContain('Output  0 N·m');
        expect(svg.outerHTML).not.toMatch(/(?:NaN|Infinity|undefined)/);
    });

    it('retains exact left and right torque-path samples and redraws plots after a unit change', () => {
        const { document, model, example, diagram } = setup();
        const { inputs, units } = example;
        const result = model.calculate(inputs);
        expect(result.ok).toBe(true);
        const samples = diagram.reportSamples(result);
        expect(samples.filter((point) => point.x === inputs.torque.start).map((point) => point.torque)).toEqual([0, 110]);
        expect(samples.filter((point) => point.x === inputs.torque.end).map((point) => point.torque)).toEqual([110, 0]);
        expect(samples.some((point) => point.x === result.combined.maximum.x)).toBe(true);
        expect(diagram.chart(result, units).points).toHaveLength(samples.length);

        const host = document.createElement('div');
        diagram.renderPlots(host, result, { ...units, outputForce: 'lbf', outputLength: 'in', stress: 'ksi' });
        expect(host.querySelectorAll('figure > svg')).toHaveLength(6);
        expect(host.textContent).toContain('Shear force · lbf');
        expect(host.textContent).toContain('Equivalent stress · ksi');
        expect(host.textContent).toContain('Axial position from A (in)');
        expect(host.outerHTML).not.toMatch(/(?:NaN|Infinity|undefined)/);
        diagram.renderPlots(host, null, units);
        expect(host.childElementCount).toBe(0);
    });
});
