import { describe, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const SCRIPTS = [
    'js/engineering-units.js',
    'js/engineering-diagram.js',
    'js/calculator-diagrams.js',
    'js/diagram-renderers-loads.js',
    'js/diagram-renderers-fasteners.js',
    'js/diagram-renderers-structural.js'
];

const MODELS = {
    moment: [{ force: 120, forceUnit: 'N', distance: 0.5, distanceUnit: 'm', moment: 60, momentUnit: 'N·m' }, { force: -50, distance: 2 }],
    'bearing-life': [{ bearingType: 'ball', rating: 30000, ratingUnit: 'N', load: 5000, loadUnit: 'N', speed: 1500, speedUnit: 'rpm' }, { bearingType: 'roller' }],
    'cylinder-force': [{ bore: 63, rod: 36, distanceUnit: 'mm', pressure: 16, pressureUnit: 'MPa', efficiency: 90 }, { bore: 50, rod: 0 }, { bore: 50, rod: 49 }, { bore: 50, rod: 80 }],
    'spring-calculations': [{ wire: 2, coil: 16, coils: 8, force: 100, distanceUnit: 'mm', forceUnit: 'N', deflection: 12 }, { wire: 3, coil: 3.2, coils: 40 }, { force: 0 }],
    'shaft-torsion': [
        { shaftType: 'solid', torque: 500, torqueUnit: 'N·m', outer: 40, diameterUnit: 'mm', length: 1, lengthUnit: 'm', twist: 1.2, twistUnit: '°', tauMax: 40, stressUnit: 'MPa' },
        { shaftType: 'hollow', torque: -500, outer: 40, inner: 30, length: 1 }, { shaftType: 'hollow', torque: 10, outer: 40, inner: 39.9, length: 1 }
    ],
    'bolt-torque': [{ diameter: 12, diameterUnit: 'mm', clamp: 30, clampUnit: 'kN', nutFactor: 0.2, torque: 72, torqueUnit: 'N·m' }, {}],
    'thread-strength': [{ diameter: 10, diameterUnit: 'mm', engagement: 10, engagementUnit: 'mm', pitch: 1.5, load: 20, loadUnit: 'kN' }, {}],
    'fillet-weld': [{ leg: 6, legUnit: 'mm', length: 100, lengthUnit: 'mm', angle: 0, load: 20, loadUnit: 'kN', throat: 4.24 }, { angle: 90 }, { angle: 45 }, {}],
    'press-fit': [{ interface: 50, hubOuter: 100, bore: 0, length: 40, distanceUnit: 'mm', interference: 0.05, interferenceUnit: 'mm', friction: 0.12, pressure: 60, pressureUnit: 'MPa' }, { interface: 50, hubOuter: 60, bore: 30 }, {}],
    'column-buckling': ['fixed-free', 'pinned-pinned', 'fixed-pinned', 'fixed-fixed'].map((condition) => ({ condition, length: 2, lengthUnit: 'm', critical: 1000, forceUnit: 'kN' })).concat([{}]),
    'beam-bending-stress': ['rectangular', 'solid-circular', 'hollow-circular', 'hollow-rectangular', 'i-beam', 't-section'].flatMap((profile) => ['x', 'y'].map((axis) => ({ profile, axis, moment: 1000, momentUnit: 'N·m', c: 0.05, distanceUnit: 'm', stress: 120, stressUnit: 'MPa' }))).concat([{ moment: -5 }, {}]),
    'stress-strain': [{ force: 10, area: 100, areaUnit: 'mm²', length: 200, lengthUnit: 'mm', deltaLength: 0.1 }, { force: -10, strain: -0.001 }, {}],
    'thermal-expansion': [{ length: 1, lengthUnit: 'm', deltaT: 50, tempUnit: '°C', deltaLength: 0.0006, stress: -120, stressUnit: 'MPa' }, { deltaT: -40 }, { deltaT: 0 }, {}],
    'differential-thermal-expansion': [
        { a: [[1, 0.0012], [0.5, 0.0008]], b: [[1.5, 0.0002]], lengthUnit: 'm', expA: 0.0016, expB: 0.0003, diff: 0.0013 },
        { a: [[1, 0]], b: [[1, 0]], expA: 0, expB: 0, diff: 0 }, { a: [[1, -0.001]], b: [[1, 0.001]], diff: -0.002 }, {}
    ],
    'factor-of-safety': [{ mode: 'stress', capacity: 250, demand: 100, unit: 'MPa', factor: 2.5 }, { mode: 'load', capacity: 50, demand: 80, unit: 'kN', factor: 0.625 }, {}],
    'hertzian-contact': ['cylinders', 'spheres'].flatMap((config) => ['convex', 'flat', 'concave'].map((shape2) => ({ config, shape2, d1: 50, d2: 80, length: 20, distanceUnit: 'mm', force: 1000, forceUnit: 'N', contact: 0.1, pressure: 800, pressureUnit: 'MPa' }))).concat([{}]),
    'thick-walled-cylinder': [{ inner: 100, outer: 200, distanceUnit: 'mm', pi: 50, po: 0, pressureUnit: 'MPa', end: 'closed' }, { inner: 100, outer: 120, pi: 0, po: 10, end: 'open' }, {}],
    'thick-walled-cylinder-plot': [
        { samples: [[50, -50, 83], [75, -20, 53], [100, 0, 33]], axial: 16, distanceUnit: 'mm', stressUnit: 'MPa' },
        { samples: [[1, 0, 0], [2, 0, 0]], axial: 0 }, { samples: [[1, -5, -9], [2, -1, -2]], axial: -3 }, { samples: [] }, {}
    ]
};

describe('calculator diagram renderers', () => {
    const { document, window } = loadCore(SCRIPTS);
    const registry = window.FormulaFoundryCalculatorDiagrams;

    it('registers a renderer for every calculator graphic', () => {
        expect(registry.ids().sort()).toEqual(Object.keys(MODELS).sort());
    });

    Object.entries(MODELS).forEach(([id, models]) => {
        it(`${id} renders finite, labelled, accessible SVG for typical and edge models`, () => {
            models.forEach((model) => {
                const svg = registry.render(document, id, model);
                expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
                expect(svg.getAttribute('role')).toBe('img');
                expect(svg.getAttribute('aria-label')).toBeTruthy();
                expect(svg.querySelector('title')).not.toBeNull();
                expect(svg.querySelector('desc')).not.toBeNull();
                expect(svg.hasAttribute('width')).toBe(false);
                const markup = svg.outerHTML;
                expect(markup).not.toMatch(/NaN|Infinity|undefined/);
                expect(svg.querySelectorAll('text').length).toBeGreaterThan(0);
            });
        });
    });

    it('reads units and values into labels', () => {
        const text = registry.render(document, 'cylinder-force', MODELS['cylinder-force'][0]).textContent;
        expect(text).toContain('63 mm');
        expect(text).toContain('16 MPa');
        expect(text).toContain('Ap');
        expect(text).toContain('Aa');
    });

    it('maps cylinder bore and rod to proportional end-view geometry', () => {
        const svg = registry.render(document, 'cylinder-force', { bore: 100, rod: 50 });
        const radii = [...svg.querySelectorAll('circle')].map((c) => Number(c.getAttribute('r')));
        expect(radii).toContain(42);
        expect(radii.some((r) => Math.abs(r - 21) < 1e-6)).toBe(true);
    });

    it('draws the supported column end conditions and highlights the selected one', () => {
        const svg = registry.render(document, 'column-buckling', { condition: 'fixed-pinned', length: 2, lengthUnit: 'm' });
        const text = svg.textContent;
        ['Fixed–free', 'Pinned–pinned', 'Fixed–pinned', 'Fixed–fixed', 'K = 2', 'K = 1', 'K = 0.699', 'K = 0.5'].forEach((s) => expect(text).toContain(s));
        expect(text).toContain('KL = 0.699 × L = 1.398 m');
        expect(svg.querySelectorAll('.ff-mode-selected').length).toBe(1);
    });

    it('shows the fillet weld throat as distinct from the leg', () => {
        const text = registry.render(document, 'fillet-weld', MODELS['fillet-weld'][0]).textContent;
        expect(text).toContain('effective throat');
        expect(text).toContain('0.707');
    });

    it('states the exaggeration disclosure for stress-strain and thermal diagrams', () => {
        expect(registry.render(document, 'stress-strain', { force: 1, area: 1, length: 1 }).textContent).toMatch(/exaggerated/i);
        expect(registry.render(document, 'thermal-expansion', { length: 1, deltaT: 5 }).textContent).toMatch(/exaggerated/i);
    });

    it('renders zero strain and zero temperature change without deformation or stress indicators', () => {
        const strain = registry.render(document, 'stress-strain', { force: 10, area: 2, length: 1, deltaLength: 0 });
        expect(strain.textContent).toContain('Zero deformation');
        expect(strain.querySelectorAll('.ff-arrow-force')).toHaveLength(0);
        const thermal = registry.render(document, 'thermal-expansion', { length: 1, deltaT: 0, deltaLength: 0, stress: 120 });
        expect(thermal.textContent).toContain('no thermal deformation or stress');
        expect(thermal.querySelectorAll('.ff-arrow-motion, .ff-arrow-reaction')).toHaveLength(0);
        expect(thermal.textContent).not.toContain('compressive σ');
        expect(thermal.textContent).not.toContain('tensile σ');
    });

    it('keeps the moment graphic schematic and the T-section topology and centroid consistent', () => {
        const moment = registry.render(document, 'moment', { force: 5, forceUnit: 'N', distance: 2, distanceUnit: 'm' });
        expect(moment.getAttribute('viewBox')).toBe('0 0 520 300');
        expect(moment.textContent).not.toMatch(/position vector|line of action/);
        const xAxis = registry.render(document, 'beam-bending-stress', {
            profile: 't-section', axis: 'x', moment: 10, momentUnit: 'N·m', centroidXRatio: 0.5, centroidYRatio: 0.7, c: 0.08, distanceUnit: 'm'
        });
        const yAxis = registry.render(document, 'beam-bending-stress', {
            profile: 't-section', axis: 'y', moment: -10, momentUnit: 'N·m', centroidXRatio: 0.5, centroidYRatio: 0.7, c: 0.05, distanceUnit: 'm'
        });
        expect(xAxis.querySelector('.ff-section-path').getAttribute('d')).toBe(yAxis.querySelector('.ff-section-path').getAttribute('d'));
        expect(Number(xAxis.querySelector('.ff-neutral-axis').getAttribute('y1'))).toBeCloseTo(197.6, 1);
        expect(xAxis.textContent).toContain('c = 0.08 m');
        expect(yAxis.textContent).toMatch(/Tension/);
        expect(yAxis.textContent).toMatch(/Compression/);
    });

    it('does not imply thermal stress for free expansion and flags no restraint in DTE', () => {
        expect(registry.render(document, 'thermal-expansion', { deltaT: 5 }).textContent).toContain('no thermal stress');
        expect(registry.render(document, 'differential-thermal-expansion', MODELS['differential-thermal-expansion'][0]).textContent).toContain('no thermal stress');
    });

    it('accepts two-column thermal member rows and keeps negative peak chart labels in view', () => {
        const model = { a: [[1, -0.001]], b: [[1, 0.001]], expA: -0.002, expB: 0.001, diff: -0.003, lengthUnit: 'm' };
        expect(registry.normalize('differential-thermal-expansion', model, true)).toEqual(model);
        const svg = registry.render(document, 'differential-thermal-expansion', model);
        const values = [...svg.querySelectorAll('text')].filter((node) => /-0\.00[23] m/.test(node.textContent));
        expect(values.length).toBeGreaterThan(0);
        values.forEach((node) => expect(Number(node.getAttribute('x'))).toBeGreaterThanOrEqual(0));
    });

    it('places spring annotations below the longest drawn spring and shows hollow-shaft inner-wall stress', () => {
        const spring = registry.render(document, 'spring-calculations', { wire: 6, coil: 18, coils: 8, force: 100, distanceUnit: 'mm', forceUnit: 'N' });
        const height = Number(spring.getAttribute('viewBox').split(' ')[3]);
        const annotations = [...spring.querySelectorAll('text')].filter((node) => /Active coils|Free length|Elastic, static/.test(node.textContent));
        expect(height).toBeGreaterThan(420);
        expect(Math.min(...annotations.map((node) => Number(node.getAttribute('y'))))).toBeGreaterThan(350);
        const shaft = registry.render(document, 'shaft-torsion', { shaftType: 'hollow', torque: 5, outer: 40, inner: 20, diameterUnit: 'mm', length: 1 });
        expect(shaft.textContent).toContain('τinner');
        expect(registry.caption('shaft-torsion')).toContain('nonzero τ_inner');
    });

    it('describes factor of safety as a ratio, not a verdict', () => {
        expect(registry.render(document, 'factor-of-safety', MODELS['factor-of-safety'][0]).textContent).toMatch(/not a pass\/fail verdict/);
    });

    it('plots thick-cylinder samples as a labelled zero-line chart with all three curves', () => {
        const svg = registry.render(document, 'thick-walled-cylinder-plot', MODELS['thick-walled-cylinder-plot'][0]);
        expect(svg.querySelector('.ff-curve-hoop')).not.toBeNull();
        expect(svg.querySelector('.ff-curve-radial')).not.toBeNull();
        expect(svg.querySelector('.ff-curve-axial')).not.toBeNull();
        expect(svg.querySelector('.ff-plot-zero')).not.toBeNull();
        expect(svg.textContent).toContain('Radius r (mm)');
        expect(svg.textContent).toContain('Stress (MPa)');
        expect(svg.textContent).toContain('σ = 0');
    });

    it('normalizes models and rejects invalid ones in strict mode', () => {
        expect(registry.normalize('moment', { force: 'x', distance: 2 }, false)).toEqual({ distance: 2 });
        expect(registry.normalize('moment', { force: 'x' }, true)).toBeNull();
        expect(registry.normalize('moment', { bogus: 1 }, true)).toBeNull();
        expect(registry.normalize('moment', { force: Infinity }, true)).toBeNull();
        expect(registry.normalize('unknown', {}, true)).toBeNull();
    });

    it('mount stores a serialisable snapshot', () => {
        const host = document.createElement('div');
        registry.mount(host, 'moment', { force: 5, distance: 2 });
        expect(host.querySelector('svg')).not.toBeNull();
        expect(registry.snapshot(host)).toEqual({ type: 'calc-diagram', id: 'moment', model: { force: 5, distance: 2 } });
    });
});
