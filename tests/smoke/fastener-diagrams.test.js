import { describe, expect, it } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

function open(id, extra = []) {
    const page = loadCalculatorPage(`calculators/${id}.html`, [
        'js/engineering-units.js', 'js/calculator-utils.js', ...extra,
        'js/engineering-diagram.js', 'js/calculator-diagrams.js', 'js/diagram-renderers-fasteners.js',
        `js/${id}-calculation.js`, `js/${id}.js`, 'js/calculator-diagram-pages.js'
    ]);
    const { document, window } = page;
    const host = document.querySelector('[data-diagram]');
    return {
        ...page,
        set(values) {
            for (const [id, value] of Object.entries(values)) {
                const field = document.getElementById(id);
                field.value = String(value);
                field.dispatchEvent(new window.Event('change', { bubbles: true }));
            }
        },
        svg: () => host.querySelector('svg'),
        snapshot: () => window.FormulaFoundryCalculatorDiagrams.snapshot(host).model
    };
}

describe('fastener and joint graphics', () => {
    it('shows calculated bolt torque in the selected unit and clears it when the output unit changes', () => {
        const page = open('bolt-torque', ['js/bolt-database.js']);
        page.set({ boltSize: 10, clampLoad: 50, loadUnit: 'kN', nutFactor: 0.2, torqueUnit: 'N·m' });
        page.window.calculateBoltTorque();
        expect(page.snapshot().torque).toBeCloseTo(100);
        expect(page.svg().textContent).toContain('Torque T = 100 N·m');
        expect(page.svg().querySelectorAll('.ff-arrow-moment')).toHaveLength(1);
        page.set({ torqueUnit: 'lbf·ft' });
        expect(page.snapshot()).not.toHaveProperty('torque');
        expect(page.svg().textContent).toContain('Torque T = —');
        expect(page.document.querySelector('.ff-diagram-status').textContent).toContain('Recalculate');
    });

    it('draws thread engagement and refreshes tensile and stripping checks independently of the applied load', () => {
        const page = open('thread-strength');
        page.set({
            majorDiameter: 0.5, distanceUnit: 'in', threadPitch: 20, pitchUnit: 'TPI', engagementLength: 0.75,
            tensileStressArea: 0.1419, areaUnit: 'in²', appliedLoad: 0, strengthUnit: 'ksi', boltStrength: 80, forceUnit: 'lbf'
        });
        page.window.calculateThreadStrength();
        expect(page.snapshot().pitch).toBeCloseTo(0.05);
        expect(page.snapshot().tensileCapacity).toBeCloseTo(11352, 3);
        expect(page.svg().textContent).toContain('Stripping capacity = not assessed');
        expect(page.svg().querySelectorAll('.ff-arrow-force, .ff-arrow-reaction')).toHaveLength(0);
        page.set({ internalStrength: 60, appliedLoad: 200 });
        expect(page.snapshot()).not.toHaveProperty('tensileCapacity');
        page.window.calculateThreadStrength();
        expect(page.snapshot().strippingCapacity).toBeGreaterThan(0);
        const svg = page.svg();
        const reaction = svg.querySelector('.ff-arrow-reaction .ff-arrow-shaft');
        expect(Number(reaction.getAttribute('y2'))).toBeGreaterThan(Number(reaction.getAttribute('y1')));
    });

    it('draws the selected weld load direction through 0–90° and clears the throat after an invalid edit', () => {
        const page = open('fillet-weld');
        page.set({ weldLeg: 6, weldLegUnit: 'mm', weldLength: 100, weldLengthUnit: 'mm', loadDirection: 0, appliedLoad: 5 });
        page.window.calculateFilletWeld();
        expect(page.snapshot().throat).toBeCloseTo(4.242);
        const force = () => page.svg().querySelector('.ff-arrow-force .ff-arrow-shaft');
        expect(force().getAttribute('y1')).toBe(force().getAttribute('y2'));
        page.set({ loadDirection: 90 });
        expect(force().getAttribute('x1')).toBe(force().getAttribute('x2'));
        expect(Number(force().getAttribute('y2'))).toBeLessThan(Number(force().getAttribute('y1')));
        expect(page.snapshot()).not.toHaveProperty('throat');
        page.set({ weldLeg: -6 });
        page.window.calculateFilletWeld();
        expect(page.svg().textContent).toContain('Calculated te = —');
        expect(page.document.querySelector('.ff-diagram-status').textContent).toContain('unavailable');
    });

    it('changes the magnified interference view and keeps solved press-fit loads out of stale and invalid states', () => {
        const page = open('press-fit');
        page.set({
            interfaceDiameter: 50, diametralInterference: 0.002, interferenceUnit: 'in',
            hubOuterDiameter: 100, shaftBoreDiameter: 20, engagementLength: 50, frictionCoefficient: 0.12,
            hubMaterial: 'carbon-steel', shaftMaterial: 'carbon-steel'
        });
        const overlap = () => page.svg().querySelector('[data-radial-overlap]');
        const start = Number(overlap().getAttribute('height'));
        page.window.calculatePressFit();
        expect(page.snapshot().relativeInterference).toBeCloseTo(0.001016);
        expect(page.snapshot().pressure).toBeGreaterThan(0);
        expect(page.snapshot().assemblyForce).toBeGreaterThan(0);

        page.set({ diametralInterference: 0.004 });
        expect(Number(overlap().getAttribute('height'))).toBeGreaterThan(start);
        expect(page.snapshot()).not.toHaveProperty('pressure');
        expect(page.svg().textContent).toContain('Contact pressure p = —');

        page.set({ diametralInterference: 0 });
        page.window.calculatePressFit();
        expect(overlap()).toBeNull();
        expect(page.svg().querySelectorAll('.ff-arrow-pressure')).toHaveLength(0);
        expect(page.document.getElementById('result').textContent).toContain('Invalid Input');
    });

    it('keeps old fit geometry readable when saved models lack the new fields', () => {
        const { window, document } = open('press-fit');
        const registry = window.FormulaFoundryCalculatorDiagrams;
        const model = {
            interface: 1, hubOuter: 1.001, bore: 0.999, distanceUnit: 'in',
            length: Number.MAX_VALUE, interference: 1e-200, interferenceUnit: 'mm', pressure: 42, pressureUnit: 'psi'
        };
        expect(registry.normalize('press-fit', model, true)).toEqual(model);
        const svg = registry.render(document, 'press-fit', model);
        expect(svg.outerHTML).not.toMatch(/NaN|Infinity|undefined/);
        expect(svg.textContent).toContain('42 psi');
        expect(svg.querySelector('[data-radial-overlap]')).not.toBeNull();
    });
});
