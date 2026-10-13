import { describe, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const sectionProperties = () => loadCore(['js/beam-section-properties.js']).window.BeamSectionProperties;
const mm = (value) => value / 1000;
const mmArea = (value) => value * 1e6;
const mmInertia = (value) => value * 1e12;

describe('beam cross-section properties', () => {
    it('matches independently calculated rectangle and square properties', () => {
        const calculate = sectionProperties().calculate;
        const rectangle = calculate('rectangular', { width: mm(50), height: mm(100) });
        expect(mmArea(rectangle.area)).toBeCloseTo(5000, 8);
        expect(convert(rectangle.centroidX)).toBeCloseTo(25, 8);
        expect(convert(rectangle.centroidY)).toBeCloseTo(50, 8);
        expect(mmInertia(rectangle.inertiaX)).toBeCloseTo(4166666.6666667, 5);
        expect(mmInertia(rectangle.inertiaY)).toBeCloseTo(1041666.6666667, 5);

        const square = calculate('rectangular', { width: mm(40), height: mm(40) });
        expect(mmInertia(square.inertiaX)).toBeCloseTo(213333.3333333, 5);
        expect(mmInertia(square.inertiaX)).toBeCloseTo(mmInertia(square.inertiaY), 8);
    });

    it('matches solid and hollow circle properties', () => {
        const calculate = sectionProperties().calculate;
        const solid = calculate('solid-circular', { diameter: mm(60) });
        expect(mmArea(solid.area)).toBeCloseTo(Math.PI * 60 ** 2 / 4, 8);
        expect(mmInertia(solid.inertiaX)).toBeCloseTo(Math.PI * 60 ** 4 / 64, 5);
        expect(solid.inertiaX).toBeCloseTo(solid.inertiaY, 14);

        const hollow = calculate('hollow-circular', { outerDiameter: mm(100), innerDiameter: mm(80) });
        expect(mmArea(hollow.area)).toBeCloseTo(Math.PI * (100 ** 2 - 80 ** 2) / 4, 8);
        expect(mmInertia(hollow.inertiaX)).toBeCloseTo(2898119.222936584, 5);
        expect(hollow.inertiaX).toBeCloseTo(hollow.inertiaY, 14);
    });

    it('matches hollow rectangle properties calculated from outer dimensions and wall thickness', () => {
        const section = sectionProperties().calculate('hollow-rectangular', {
            outerWidth: mm(100), outerHeight: mm(80), wallThickness: mm(10)
        });
        expect(mmArea(section.area)).toBeCloseTo(3200, 8);
        expect(convert(section.centroidX)).toBeCloseTo(50, 8);
        expect(convert(section.centroidY)).toBeCloseTo(40, 8);
        expect(mmInertia(section.inertiaX)).toBeCloseTo(2826666.6666667, 5);
        expect(mmInertia(section.inertiaY)).toBeCloseTo(4106666.6666667, 5);
    });

    it('independently verifies the I-beam centroid and both inertias by rectangle decomposition', () => {
        const section = sectionProperties().calculate('i-beam', {
            height: mm(200), flangeWidth: mm(100), flangeThickness: mm(12), webThickness: mm(8)
        });
        expect(mmArea(section.area)).toBeCloseTo(3808, 8);
        expect(convert(section.centroidX)).toBeCloseTo(50, 8);
        expect(convert(section.centroidY)).toBeCloseTo(100, 8);
        expect(mmInertia(section.inertiaX)).toBeCloseTo(24869717.3333333, 4);
        expect(mmInertia(section.inertiaY)).toBeCloseTo(2007509.3333333, 4);
    });

    it('independently verifies the non-symmetric T-section centroid and inertias', () => {
        const section = sectionProperties().calculate('t-section', {
            height: mm(120), flangeWidth: mm(80), flangeThickness: mm(10), webThickness: mm(8)
        });
        expect(mmArea(section.area)).toBeCloseTo(1680, 8);
        expect(convert(section.centroidX)).toBeCloseTo(40, 8);
        expect(convert(section.centroidY)).toBeCloseTo(83.5714285714, 8);
        expect(mmInertia(section.inertiaX)).toBeCloseTo(2402571.4285714, 4);
        expect(mmInertia(section.inertiaY)).toBeCloseTo(431360, 5);
        expect(section.centroidY).not.toBeCloseTo(mm(60), 6);
        expect(section.sectionModulusX).toBeCloseTo(section.inertiaX / section.extremeFiberX, 14);
        expect(section.sectionModulusY).toBeCloseTo(section.inertiaY / section.extremeFiberY, 14);
    });

    it.each([
        ['invalid rectangle', 'rectangular', { width: mm(50), height: 0 }],
        ['invalid circle', 'solid-circular', { diameter: Infinity }],
        ['inner circle equals outer circle', 'hollow-circular', { outerDiameter: mm(80), innerDiameter: mm(80) }],
        ['wall closes hollow rectangle', 'hollow-rectangular', { outerWidth: mm(20), outerHeight: mm(30), wallThickness: mm(10) }],
        ['web exceeds flange', 'i-beam', { height: mm(200), flangeWidth: mm(80), flangeThickness: mm(10), webThickness: mm(90) }],
        ['flanges leave no web depth', 'i-beam', { height: mm(20), flangeWidth: mm(80), flangeThickness: mm(10), webThickness: mm(8) }],
        ['T flange consumes height', 't-section', { height: mm(20), flangeWidth: mm(80), flangeThickness: mm(20), webThickness: mm(8) }]
    ])('rejects %s', (label, type, dimensions) => {
        expect(() => sectionProperties().calculate(type, dimensions)).toThrow();
    });
});

function convert(value) {
    return value * 1000;
}
