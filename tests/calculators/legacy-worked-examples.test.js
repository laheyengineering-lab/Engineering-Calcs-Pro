import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const scripts = [
    'engineering-units', 'beam-section-properties', 'beam-study-calculations', 'bearing-life-calculation',
    'bolt-torque-calculation', 'column-buckling-calculation', 'cylinder-geometry', 'cylinder-force',
    'differential-thermal-expansion', 'factor-of-safety-calculation', 'fillet-weld-calculation',
    'hertzian-contact-calculation', 'moment-calculation', 'press-fit-calculation', 'shaft-torsion-calculation',
    'spring-calculation', 'stress-strain-calculation', 'thermal-expansion-calculation',
    'thick-walled-cylinder-calculation', 'thread-strength-calculation'
];

// Inputs to these production functions are SI except where the API specifies
// otherwise. Scales convert engineering results to the precision on the page.
const references = [
    ['Bolt Torque', 'computeBoltTorque', { diameterM: 0.010, clampLoadN: 50000, nutFactor: 0.20 },
        { torqueNm: '100' }],
    ['Moment', 'computeMoment', { forceN: 100, distanceM: 0.025 }, { momentNm: ['2500', 1000] }],
    ['Shaft Torsion', 'computeShaftTorsion',
        { shaftType: 'solid', torqueNm: 500, outerDiameterM: 0.050, lengthM: 2, modulusPa: 80e9 },
        { J: ['6.136', 1e7], tauMaxPa: ['20.37', 1e-6], thetaRadians: '0.0204', thetaDegrees: '1.17' }],
    ['Beam Bending Stress (rectangle)', 'FormulaFoundryBeamCalculations.computeBendingStress',
        { sectionType: 'rectangular', dimensions: { width: 0.050, height: 0.100 }, momentNm: 5000, axis: 'x' },
        { inertiaM4: ['4166667', 1e12], cM: ['50', 1000], stressPa: ['60', 1e-6] }],
    ['Beam Bending Stress (T-section)', 'FormulaFoundryBeamCalculations.computeBendingStress',
        { sectionType: 't-section', dimensions: { height: 0.120, flangeWidth: 0.080, flangeThickness: 0.010,
            webThickness: 0.008 }, momentNm: 5000, axis: 'x' },
        { 'properties.area': ['1680', 1e6], 'properties.centroidY': ['83.5714', 1000],
            inertiaM4: ['2402571', 1e12], 'properties.inertiaY': ['431360', 1e12], stressPa: ['173.921', 1e-6] }],
    ['Beam Deflection', 'FormulaFoundryBeamCalculations.computeDeflection',
        { caseId: 'ss-point', spanM: 3, modulusPa: 200e9, inertiaM4: 5e-5, loadSI: 10000 },
        { maxDeflectionM: ['0.5625', 1000], maxMomentNm: '7500' }],
    ['Bearing Life', 'computeBearingLife', { bearingType: 'ball', dynamicLoadRatingN: 30000,
        equivalentLoadN: 10000, speedRpm: 1500 }, { lifeMillionRevolutions: '27', lifeHours: '300' }],
    ['Column Buckling', 'computeColumnBuckling', { sectionType: 'solid', boundaryCondition: 'pinned-pinned',
        lengthM: 2, outerDiameterM: 0.050, youngsModulusPa: 200e9 }, { criticalLoadN: ['151.4', 1e-3] }],
    ['Cylinder Force', 'computeCylinderForce', { bore: 0.100, rod: 0.050, pressure: 10e6, efficiency: 0.90 },
        { extensionForce: ['78.54', 1e-3], retractionForce: ['58.90', 1e-3],
            usableExtension: ['70.69', 1e-3], usableRetraction: ['53.01', 1e-3] }],
    ['Fillet Weld', 'computeFilletWeldChecked', { legM: 0.25 * 0.0254, lengthM: 12 * 0.0254,
        electrode: 'E70XX', angleDeg: 0, method: 'ASD', loadN: 20 * 4448.2216152605 },
        { areaM2: ['2.121', 1 / 0.0254 ** 2], nominalN: ['89.082', 1 / 4448.2216152605],
            lrfdN: ['66.81', 1 / 4448.2216152605], asdN: ['44.54', 1 / 4448.2216152605],
            requiredLegM: ['0.1123', 1 / 0.0254] }],
    ['Hertzian Contact (spheres)', 'computeHertzContact', { configuration: 'spheres',
        diameter1: 0.050, diameter2: 0.050, force: 1000, E1: 200e9, E2: 200e9, nu1: 0.30, nu2: 0.30 },
        { contactRadius: ['0.4402', 1000], maxPressure: ['2464', 1e-6], approach: ['0.0155', 1000] }],
    ['Hertzian Contact (cylinders)', 'computeHertzContact', { configuration: 'cylinders',
        diameter1: 0.1, diameter2: 0.1, length: 0.040, force: 20000, E1: 200e9, E2: 200e9, nu1: 0.30, nu2: 0.30 },
        { lineLoad: ['500', 1e-3], halfWidth: ['0.3806', 1000], maxPressure: ['836.4', 1e-6] }],
    ['Spring Calculations', 'computeSpring', { wireDiameterM: 0.005, meanDiameterM: 0.040,
        activeCoils: 10, forceN: 500, shearModulusPa: 80e9 },
        { index: '8', rateNPerM: ['9.7656', 1e-3], deflectionM: ['51.20', 1000],
            wahlFactor: '1.1840', shearStressPa: ['482.4', 1e-6] }],
    ['Stress & Strain (stress)', 'computeStressStrain', { mode: 'stress', forceN: 10000, areaM2: 1e-4 },
        { stressPa: ['100', 1e-6] }],
    ['Stress & Strain (deformation)', 'computeStressStrain', { mode: 'deformation',
        forceN: 10000, areaM2: 1e-4, originalLengthM: 0.5, modulusPa: 200e9 }, { deltaLengthM: ['0.25', 1000] }],
    ['Stress & Strain (strain)', 'computeStressStrain', { mode: 'strain', deltaLengthM: 0.00025,
        originalLengthM: 0.5 }, { strain: '0.0005' }],
    ['Thermal Expansion', 'computeThermalExpansion',
        { alpha: 12e-6, originalLengthM: 2, deltaTC: 50, modulusPa: 200e9 },
        { deltaLM: ['1.2', 1000], finalLengthM: '2.0012', thermalStrain: '0.0006', thermalStressPa: ['120', 1e-6] }],
    ['Thick-Walled Cylinder (internal)', 'computeThickCylinder', { innerRadius: 0.050,
        outerRadius: 0.100, internalPressure: 100e6, externalPressure: 0 },
        { 'inner.radial': ['-100', 1e-6], 'inner.hoop': ['166.67', 1e-6], 'outer.radial': ['0', 1e-6],
            'outer.hoop': ['66.67', 1e-6], axial: ['33.33', 1e-6] }],
    ['Thick-Walled Cylinder (external)', 'computeThickCylinder', { innerRadius: 0.050,
        outerRadius: 0.100, internalPressure: 0, externalPressure: 100e6 },
        { 'inner.radial': ['0', 1e-6], 'inner.hoop': ['-266.67', 1e-6], 'outer.radial': ['-100', 1e-6],
            'outer.hoop': ['-166.67', 1e-6] }],
    ['Thread Strength', 'computeThreadStrength', { diameterM: 0.010, pitchM: 0.0015, engagementM: 0.015,
        stressAreaM2: 61.2e-6, forceN: 10000, boltStrengthPa: 400e6, internalStrengthPa: 400e6 },
        { boltCapacityN: ['24.48', 1e-3], appliedStressPa: ['163.4', 1e-6], boltUtilization: ['40.85', 100],
            internalShearAreaM2: ['255.1', 1e6], internalCapacityN: ['58.9', 1e-3] }]
];

let core;
beforeAll(() => { core = loadCore(scripts.map((script) => 'js/' + script + '.js')); });
afterAll(() => core.dom.window.close());

function checkRounded(actual, expected) {
    for (const [key, reference] of Object.entries(expected)) {
        const [display, scale = 1] = Array.isArray(reference) ? reference : [reference];
        const result = key.split('.').reduce((state, property) => state[property], actual) * scale;
        const decimals = display.split('.')[1]?.length ?? 0;
        expect(Number(result.toFixed(decimals)) + 0, key).toBe(Number(display));
    }
}

it.each(references)('%s reproduces the reference calculation', (_name, fn, input, expected) => {
    checkRounded(core.window.eval(fn)(input), expected);
});

it('Press Fit and Factor of Safety use the current A36 plate preset', () => {
    const steel = core.window.getPressFitMaterial('carbon-steel', 'example');
    expect(steel).toEqual({ E: 200e9, nu: 0.26, Sy: 250e6 });
    expect(core.window.getMaterialPropertyBasis('carbon-steel', 'yieldStrength')).toBe('specified-minimum');
    const fit = core.window.computePressFit({ d: 0.050, deltaDiametral: 0.05e-3, D: 0.100,
        di: 0, L: 0.050, mu: 0.12, hub: steel, shaft: steel });
    checkRounded(fit, { p: ['75', 1e-6], hubHoop: ['125', 1e-6], shaftHoop: ['-75', 1e-6],
        pressForce: ['70.686', 1e-3], torqueCapacity: '1767.15', fosHub: '2.00', fosShaft: '3.33',
        fosControlling: '2.00' });
    expect(core.window.computeFactorOfSafety({ mode: 'stress', strengthPa: steel.Sy,
        appliedStressPa: 100e6 }).factorOfSafety).toBe(2.5);
});

it('Differential Thermal Expansion compares the entered free expansions in millimeters', () => {
    const steel = { alpha: 12e-6, tInitial: 20 };
    const result = core.window.computeDifferentialExpansion([{ ...steel, length: 500, tFinal: 100 }],
        [{ alpha: 23e-6, length: 300, tInitial: 20, tFinal: 100 }, { ...steel, length: 200, tFinal: 60 }]);
    checkRounded(result, { 'memberA.expansion': '0.480', 'memberB.expansion': '0.648', differential: '-0.168' });
});
