import { describe, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const { document, window } = loadCore([
    'js/engineering-diagram.js',
    'js/calculator-diagrams.js',
    'js/electrical-diagrams.js'
]);
const registry = window.FormulaFoundryCalculatorDiagrams;
const snapshot = window.FormulaFoundryElectricalDiagram;

function render({ id, model }) {
    expect(registry.normalize(id, model, true)).not.toBeNull();
    const svg = registry.render(document, id, model);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.querySelector('title').textContent).toBeTruthy();
    expect(svg.querySelector('desc').textContent).toBeTruthy();
    expect(svg.outerHTML).not.toMatch(/NaN|Infinity|undefined/);
    return svg;
}

describe('electrical schematic SVGs', () => {
    it('labels all 12 branches and distinguishes short and open connections', () => {
        const input = { mode: 'parallel', sourceVoltage: -12, resistances: [null, 0, ...Array(10).fill(2200)] };
        const svg = render(snapshot('circuit-studio', input));
        expect(svg.querySelectorAll('[data-component]')).toHaveLength(12);
        expect(svg.querySelector('[data-component="R1"]').dataset.symbol).toBe('open');
        expect(svg.querySelector('[data-component="R2"]').dataset.symbol).toBe('short');
        expect(svg.querySelector('[data-component="R12"]').dataset.symbol).toBe('resistor');
        expect(svg.textContent).toMatch(/R1\s+Open/);
        expect(svg.textContent).toMatch(/R12\s+2\.2 kΩ/);
        expect(svg.textContent).toContain('−12 V');
    });

    it('shows the actual current direction and keeps the signed voltage reference', () => {
        const input = { mode: 'parallel', sourceVoltage: -3, resistances: [100, 200] };
        const result = {
            totalCurrent: -0.045,
            components: [{ resistance: 100, voltage: -3, current: -0.03 }, { resistance: 200, voltage: -3, current: -0.015 }]
        };
        const svg = render(snapshot('circuit-studio', input, result));
        expect(svg.querySelectorAll('[data-current-direction="reverse"]')).toHaveLength(3);
        expect(svg.textContent).toContain('V  −3 V');
        expect(svg.textContent).toContain('I  30 mA');
        expect(svg.textContent).toContain('I  15 mA');
    });

    it('keeps Kirchhoff branch arrows as references even when a current is negative', () => {
        const input = { leftResistance: 0, centerResistance: 100, rightResistance: 200, leftVoltage: 4, rightVoltage: 2 };
        const result = {
            nodes: { center: 4 },
            branches: [{ resistance: 0, voltage: 0, current: 0.05 }, { resistance: 100, voltage: 4, current: 0.04 },
                { resistance: 200, voltage: -2, current: -0.01 }]
        };
        const svg = render(snapshot('kirchhoff-circuit', input, result));
        expect(svg.querySelectorAll('[data-current-direction="reference"]')).toHaveLength(3);
        expect(svg.querySelector('[data-component="R1"]').dataset.symbol).toBe('short');
        expect(svg.textContent).toContain('I₃  −10 mA');
        expect(svg.textContent).toContain('B  4 V');
    });

    it('draws a tapped divider and two independent conductor wires', () => {
        const divider = render(snapshot('electrical-divider', {
            mode: 'series', tap: 2, sourceVoltage: 12, resistances: [1000, 1000, 1000]
        }, { outputVoltage: 4 }));
        expect(divider.querySelectorAll('[data-component]')).toHaveLength(3);
        expect(divider.textContent).toContain('Output  4 V');
        const wire = render(snapshot('dc-wire-voltage-drop', { supplyVoltage: 12, loadCurrent: 2 }, {
            loadVoltage: 11, oneWayResistance: 0.25
        }));
        expect(wire.querySelectorAll('[data-component]')).toHaveLength(3);
        expect(wire.textContent).toContain('Outgoing conductor  250 mΩ');
        expect(wire.textContent).toContain('Return conductor  250 mΩ');
    });

    it('draws differently wired speaker symbols and nominal labels', () => {
        for (const mode of ['series', 'parallel']) {
            const svg = render(snapshot('speaker-impedance', { mode, impedances: [4, 8] }, { rmsVoltage: 20 }));
            expect(svg.querySelectorAll('[data-symbol="speaker"]')).toHaveLength(2);
            const transform = svg.querySelector('[data-component="SP2"]').getAttribute('transform');
            expect(transform).toContain(mode === 'series' ? 'rotate(90)' : 'rotate(0)');
            expect(svg.textContent).toContain('SP2  8 Ω');
        }
    });

    it('keeps three transient markers and separate current and voltage panels through JSON', () => {
        const points = [
            { time: 0, capacitorVoltage: 0, resistorVoltage: 5, current: 0.005 },
            { time: 0.001, capacitorVoltage: 3.16, resistorVoltage: 1.84, current: 0.00184 },
            { time: 0.005, capacitorVoltage: 4.97, resistorVoltage: 0.03, current: 0.00003 }
        ];
        const circuit = snapshot('rc-transients', {
            resistance: 1000, capacitance: 1e-6, sourceVoltage: 5, time: 0.001
        }, { response: { minX: 0, maxX: 0.005, points, selected: points[1] } });
        expect(render(circuit).querySelectorAll('[data-symbol="capacitor"]')).toHaveLength(1);
        const chart = render(JSON.parse(JSON.stringify(circuit.companion)));
        const markers = [...chart.querySelectorAll('[data-selected-series]')];
        expect(markers.map((marker) => Number(marker.dataset.selectedValue))).toEqual([3.16, 1.84, 0.00184]);
        expect(new Set(markers.map((marker) => marker.getAttribute('cx'))).size).toBe(1);
        expect(chart.querySelectorAll('[data-selected-x]')).toHaveLength(2);
        expect(chart.textContent).toContain('Loop current');
    });

    it('retains exact selection and resonance in a bounded log-frequency response snapshot', () => {
        const points = Array.from({ length: 110 }, (_, i) => ({
            frequency: 100 + i * 10, impedanceMagnitude: 10 + Math.abs(i - 30)
        }));
        const input = { resistance: 10, capacitance: 1e-6, inductance: 0.1, voltage: 10, frequency: 230 };
        const result = {
            resonantFrequency: 400,
            response: { minX: 100, maxX: 1190, points, selected: points[13] }
        };
        const circuit = snapshot('rlc-impedance', input, result);
        expect(circuit.companion.model.points.length).toBeLessThanOrEqual(61);
        expect(circuit.companion.model.points).toContainEqual([400, 10]);
        expect(circuit.companion.model.points).toContainEqual([230, 27]);
        const chart = render(circuit.companion);
        const marker = chart.querySelector('[data-selected-series="|Z|"]');
        const labelX = Number(marker.getAttribute('cx'));
        const expectedX = 71 + (367 - 71) * Math.log(230 / 100) / Math.log(1190 / 100);
        expect(labelX).toBeCloseTo(expectedX, 10);
        expect(chart.textContent).toContain('Frequency (log scale)');
    });

    it('draws the reactive leg below the real axis for leading power factor', () => {
        const svg = render(snapshot('ac-power-factor', {}, { realPower: 300, reactivePower: -400, apparentPower: 500, phase: -Math.atan2(4, 3) }));
        const reactive = svg.querySelector('line.ff-ghost');
        expect(Number(reactive.getAttribute('y2'))).toBeGreaterThan(Number(reactive.getAttribute('y1')));
        expect(svg.textContent).toContain('−400 var');
    });
});
