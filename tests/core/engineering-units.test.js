import { describe, it, expect, beforeEach } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

describe('engineering-units core conversions', () => {
    let window;

    beforeEach(() => {
        ({ window } = loadCore());
    });

    it('converts representative length units', () => {
        expect(window.convertDistance(25, 'mm')).toBeCloseTo(0.025, 12);
        expect(window.convertDistanceToUnit(0.0254, 'mm')).toBeCloseTo(25.4, 12);
        expect(window.convertDistanceToUnit(window.convertDistance(2, 'in'), 'mm')).toBeCloseTo(50.8, 10);
    });

    it('converts representative force units', () => {
        expect(window.convertForce(5, 'kN')).toBeCloseTo(5000, 12);
        expect(window.convertForceToUnit(5000, 'kN')).toBeCloseTo(5, 12);
        expect(window.convertForce(1000, 'lbf')).toBeCloseTo(4448.2216152605, 9);
    });

    it('converts stress and modulus units including the GPa regression path', () => {
        expect(window.convertStress(100, 'MPa')).toBeCloseTo(100e6, 6);
        expect(window.convertStressToUnit(200e9, 'GPa')).toBeCloseTo(200, 12);
        expect(window.convertStressToUnit(200e9, 'MPa')).toBeCloseTo(200000, 6);
        expect(window.convertStressToUnit(window.convertStress(30000, 'psi'), 'MPa')).toBeCloseTo(206.84271, 5);
    });

    it('converts torque, distributed load, temperature change, and rotational speed units', () => {
        expect(window.convertMoment(2500, 'N·mm')).toBeCloseTo(2.5, 12);
        expect(window.convertMomentToUnit(2.5, 'N·mm')).toBeCloseTo(2500, 12);
        expect(window.convertMomentToUnit(window.convertMoment(10, 'lbf·ft'), 'N·m')).toBeCloseTo(13.5581795, 7);
        expect(window.convertDistributedLoad(10, 'lbf/ft')).toBeCloseTo(145.939, 3);
        expect(window.convertTemperatureChange(90, '°F')).toBeCloseTo(50, 12);
        expect(window.convertRotationalSpeedToUnit(window.convertRotationalSpeed(25, 'rps'), 'rpm')).toBeCloseTo(1500, 12);
    });

    it('converts area moment of inertia units', () => {
        expect(window.convertAreaMomentInertia(8.333e6, 'mm⁴')).toBeCloseTo(8.333e-6, 12);
        expect(window.convertAreaMomentInertiaToUnit(8.333e-6, 'mm⁴')).toBeCloseTo(8.333e6, 1);
    });
});
