import { describe, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const { document, window } = loadCore([
    'js/engineering-diagram.js', 'js/calculator-diagrams.js', 'js/diagram-renderers-structural.js'
]);
const registry = window.FormulaFoundryCalculatorDiagrams;
const render = (id, model) => registry.render(document, id, model);

describe('structural diagram conventions', () => {
    it('draws the pinned lower column end as a hinge support and keeps the selected mode illustrative', () => {
        const svg = render('column-buckling', {
            condition: 'pinned-pinned', length: 12, lengthUnit: 'ft', critical: 7, forceUnit: 'kip'
        });
        expect(svg.querySelectorAll('.ff-support-pin')).toHaveLength(1);
        expect(svg.querySelectorAll('.ff-mode-selected')).toHaveLength(1);
        expect(svg.textContent).toContain('Calculated Pcr = 7 kip');
        expect(svg.textContent).toContain('Mode amplitude is illustrative');
    });

    it('changes bending section dimensions with the existing inputs and reverses the end moments', () => {
        const model = { profile: 'hollow-rectangular', width: 60, height: 100, wallThickness: 3, moment: 10 };
        const positive = render('beam-bending-stress', model);
        const negative = render('beam-bending-stress', { ...model, wallThickness: 6, moment: -10 });
        const zero = render('beam-bending-stress', { ...model, moment: 0 });
        expect(positive.querySelector('.ff-section-path').getAttribute('d'))
            .not.toBe(negative.querySelector('.ff-section-path').getAttribute('d'));
        expect(positive.querySelector('.ff-arrow-arc').getAttribute('d'))
            .not.toBe(negative.querySelector('.ff-arrow-arc').getAttribute('d'));
        expect(zero.querySelector('.ff-arrow-moment')).toBeNull();
    });

    it('compares demand and capacity on one scale even when demand exceeds capacity', () => {
        const svg = render('factor-of-safety', { mode: 'load', demand: 50, capacity: 25, unit: 'kip' });
        const demand = Number(svg.querySelector('rect.ff-accent-body').getAttribute('width'));
        const capacity = Number(svg.querySelector('rect.ff-body-muted').getAttribute('width'));
        expect(demand / capacity).toBe(2);
        const incomplete = render('factor-of-safety', { mode: 'load' });
        expect(incomplete.querySelector('rect.ff-accent-body')).toBeNull();
    });

    it('distinguishes line width from point radius using solved values and their native units', () => {
        const line = { config: 'cylinders', shape2: 'concave', contact: 0.02, distanceUnit: 'mm', contactUnit: 'in', pressure: 60, pressureUnit: 'ksi' };
        const point = { ...line, config: 'spheres' };
        expect(render('hertzian-contact', line).textContent).toContain('Contact width 2b = 0.04 in');
        expect(render('hertzian-contact', point).textContent).toContain('Contact radius a = 0.02 in');
        expect(render('hertzian-contact', line).textContent).toContain('Peak pressure pmax = 60 ksi');
        const legacy = { ...line };
        delete legacy.contactUnit;
        expect(registry.normalize('hertzian-contact', legacy, true)).toEqual(legacy);
        expect(render('hertzian-contact', legacy).textContent).toContain('Contact width 2b = 0.04 mm');
    });

    it('keeps the plotted SVG finite for legacy Lamé data at extreme magnitudes', () => {
        const model = { samples: [[1e308, -1e308, 1e308], [1.4e308, -9e307, 9e307]], axial: 7e307, distanceUnit: 'in', stressUnit: 'psi' };
        expect(registry.normalize('thick-walled-cylinder-plot', model, true)).toEqual(model);
        const svg = render('thick-walled-cylinder-plot', model);
        expect(svg.outerHTML).not.toMatch(/NaN|Infinity/);
        expect(svg.querySelectorAll('polyline')).toHaveLength(3);
        expect(svg.textContent).toContain('1.4e+308');
    });
});
