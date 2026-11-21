import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

const fixtures = [
    ['pipe-flow', { flowMode: 'Average velocity', diameter: 100, density: 1000, viscosityMode: 'Kinematic',
        kinematicViscosity: 1, velocity: 0.02 }, 'reynolds', 2000, 'velocity'],
    ['pipe-pressure-drop', { diameter: 100, density: 1000, dynamicViscosity: 1, flow: 3 * Math.PI,
        length: 10, roughness: 0, minorCoefficient: 2 }, 'total', 0.00104, 'length'],
    ['pump-hydraulic-power', { flow: 60, pressure: 200, density: 1000, efficiency: 80, duration: 2 }, 'shaftPower', 0.25, 'flow'],
    ['hydraulic-cylinder-speed', { bore: 100, rod: 60, stroke: 200, extensionFlow: 6, retractionFlow: 6 },
        'cycleTime', 25.7610597594363, 'stroke'],
    ['pneumatic-air-consumption', { bore: 100, rod: 60, stroke: 200, gaugePressure: 500, referencePressure: 100,
        operatingTemperature: 20, referenceTemperature: 20, frequency: 10 }, 'consumptionRate', 154.566358556618, 'frequency'],
    ['multilayer-insulation', { thickness1: 100, conductivity1: 0.04, layerMode2: 'Direct R-value', resistance2: 0.20,
        insideFilm: 0.13, outsideFilm: 0.04 }, 'resistanceSI', 2.87, 'thickness1'],
    ['wall-heat-loss', { thermalMode: 'Effective U-factor', transmittance: 0.3, area: 20, inside: 20, outside: 0, duration: 10 },
        'energyKwh', 1.2, 'area'],
    ['wall-mounting', { arrangement: 'Bracket with lower bearing', weight: 200, offset: 0.3, count: 2, spacing: 0.15,
        shearCapacity: 150, tensionCapacity: 400 }, 'tension', 200, 'weight']
];

const imperial = {
    diameter: ['in', 1 / 25.4], distance: ['ft', 1 / 0.3048], area: ['ft²', 1 / 0.09290304],
    flow: ['GPM', 1 / 3.785411784], velocity: ['ft/s', 1 / 0.3048],
    density: ['lb/ft³', 0.0624279605761446], dynamicViscosity: ['lbf·s/ft²', 0.0000208854342331501],
    kinematicViscosity: ['ft²/s', 0.0000107639104167097], pressure: ['psi', 1000 / 6894.757],
    power: ['hp', 1000 / 745.69987158227], volume: ['US gal', 1 / 3.785411784],
    conductivity: ['BTU/(h·ft·°F)', 0.577789318],
    resistance: ['h·ft²·°F/BTU', 5.678263337], transmittance: ['BTU/(h·ft²·°F)', 0.1761101838],
    temperature: ['°F', 1.8, 32], force: ['lbf', 1 / 4.4482216152605]
};

let page, studies, models, engines;
beforeAll(() => {
    page = loadCore(['js/engineering-units.js', 'js/calculator-data.js', 'js/cylinder-geometry.js', 'js/fluid-thermal-calculations.js',
        'js/expansion-models.js', 'js/design-study-core.js', 'js/engineering-diagram.js', 'js/calculator-diagrams.js',
        'js/expansion-diagrams.js', 'js/expansion-study-adapters.js', 'js/report-builder.js']);
    studies = page.window.FormulaFoundryStudies;
    models = page.window.eval('expansionModels');
    engines = page.window;
});
afterAll(() => page.dom.window.close());

describe.each(fixtures)('%s', (id, values, output, expected, varying) => {
    it('matches an independently calculated SI reference and equivalent imperial entries', () => {
        const adapter = studies.getAdapter(id);
        const units = studies.defaultUnits(adapter);
        expect(adapter.calculate(values, units)[output] / expected).toBeCloseTo(1, 10);
        const alternate = { ...values };
        for (const def of adapter.inputs) {
            const equivalent = imperial[def.group];
            if (equivalent && typeof values[def.id] === 'number') {
                const [unit, factor, offset = 0] = equivalent;
                units[def.group] = unit;
                alternate[def.id] = values[def.id] * factor + offset;
            }
        }
        const group = adapter.outputs.find((item) => item.id === output).group;
        const displayFactor = imperial[group]?.[0] === units[group] ? (imperial[group]?.[1] || 1) : 1;
        expect(adapter.calculate(alternate, units)[output] / (expected * displayFactor)).toBeCloseTo(1, 8);
        expect(() => adapter.calculate({ ...values, [varying]: NaN }, studies.defaultUnits(adapter))).toThrow();
    });

    it('saves, duplicates, compares, sweeps and reports the same model', () => {
        const adapter = studies.getAdapter(id);
        const scenario = studies.calculateScenario(adapter, studies.createScenario(adapter, 'Baseline', values));
        expect(scenario.status, scenario.error).toBe('calculated');
        const copy = studies.duplicateScenario(scenario, 'Option');
        const comparison = studies.compareScenarios([scenario, copy], scenario.id);
        expect(comparison.ok).toBe(true);
        let study = studies.createStudy('Expansion project', id);
        study = studies.addScenario(studies.addScenario(study, scenario), copy);
        const store = studies.createStudyStore(null);
        store.save([study]);
        expect(store.load().studies[0].scenarios.some((item) => item.id === copy.id)).toBe(true);

        const sweep = studies.runSweep(adapter, scenario, { inputId: varying, outputId: output,
            start: values[varying], end: values[varying] * 1.1, count: 3, mode: 'count' });
        expect(sweep.ok, sweep.errors?.join(', ')).toBe(true);
        expect(sweep.sweep.points.every((point) => Number.isFinite(point.y))).toBe(true);
        expect(sweep.sweep.points[0].y / expected).toBeCloseTo(1, 10);
        const report = studies.scenarioReportSnapshot(study, scenario);
        expect(report.snapshot.diagram.id).toBe(id);
        expect(page.window.FormulaFoundryReport.validateSnapshot(report.snapshot).ok).toBe(true);
    });
});

describe('engineering modes and boundaries', () => {
    const fluid = { diameter: 0.1, density: 1000, dynamicViscosity: 0.001 };
    it('applies continuity and separates stopped, laminar, transitional and turbulent flow', () => {
        expect(engines.computePipeFlow({ ...fluid, velocity: 0 }).regime).toBe('No flow');
        expect(engines.computePipeFlow({ ...fluid, velocity: 0.02 }).flow).toBeCloseTo(0.00015707963267949, 14);
        expect(engines.pipeFlowRegime(2299)).toBe('Laminar');
        expect(engines.pipeFlowRegime(2300)).toBe('Transitional');
        expect(engines.pipeFlowRegime(3999)).toBe('Transitional');
        expect(engines.pipeFlowRegime(4000)).toBe('Turbulent');
        expect(() => engines.computePipeFlow({ ...fluid, velocity: -1 })).toThrow();
        expect(() => engines.computePipeFlow({ ...fluid, velocity: 1, diameter: 0 })).toThrow();
        expect(() => engines.computePipeFlow({ ...fluid, velocity: 1, dynamicViscosity: 0 })).toThrow();
    });

    it('matches independently solved Colebrook roots, and handles zero and transition', () => {
        const segment = { ...fluid, velocity: 1, length: 10 };
        const smooth = engines.computePipePressureDrop({ ...segment, roughness: 0 });
        const rough = engines.computePipePressureDrop({ ...segment, roughness: 0.0001 });
        expect(smooth.darcyFactor).toBeCloseTo(0.01798977308427384, 13);
        expect(rough.darcyFactor).toBeCloseTo(0.02217453594451508, 13);
        expect(rough.total).toBeCloseTo(1108.726797225754, 9);
        expect(rough.headLoss).toBeCloseTo(0.1130586680697, 8);
        const stopped = engines.computePipePressureDrop({ ...segment, velocity: 0, roughness: 0 });
        expect(stopped.darcyFactor).toBeUndefined();
        expect(stopped.total).toBe(0);
        expect(engines.computePipePressureDrop({ ...segment, velocity: 0.03, roughness: 0 }).regime).toBe('Transitional');
        expect(() => engines.computePipePressureDrop({ ...segment, roughness: 0.006 })).toThrow();
        expect(() => engines.computePipePressureDrop({ ...segment, roughness: 0, minorCoefficient: -1 })).toThrow();
    });

    it('converts head to pressure and checks efficiency and zero work', () => {
        const input = { flow: 0.001, head: 10, density: 1000, efficiency: 1, duration: 3600 };
        const pump = engines.computePumpPower(input);
        expect(pump.pressure).toBeCloseTo(98066.5, 8);
        expect(pump.hydraulicPower).toBeCloseTo(98.0665, 8);
        expect(pump.shaftPower).toBe(pump.hydraulicPower);
        expect(pump.energy).toBeCloseTo(353039.4, 7);
        expect(engines.computePumpPower({ ...input, head: 0 }).energy).toBe(0);
        expect(() => engines.computePumpPower({ ...input, efficiency: 0 })).toThrow();
        expect(() => engines.computePumpPower({ ...input, efficiency: 1.01 })).toThrow();
    });

    it('uses cap and annular areas, supports one stroke and rejects impossible geometry', () => {
        const geometry = { bore: 0.1, rod: 0.06, stroke: 0.2 };
        const cycle = engines.computeCylinderCycle({ ...geometry, extensionSpeed: 0.5 });
        expect(cycle.extensionTime).toBe(0.4);
        expect(cycle.extensionFlow).toBeCloseTo(0.00392699081698724, 14);
        expect(cycle.cycleTime).toBeUndefined();
        const balanced = engines.computeCylinderCycle({ ...geometry, rod: 0, extensionFlow: 0.001, retractionFlow: 0.001 });
        expect(balanced.capVolume).toBe(balanced.rodVolume);
        expect(balanced.extensionTime).toBe(balanced.retractionTime);
        expect(() => engines.computeCylinderCycle({ ...geometry, rod: 0.1, extensionSpeed: 0.5 })).toThrow();
        expect(() => engines.computeCylinderCycle({ ...geometry, extensionFlow: 0 })).toThrow();
    });

    it('uses absolute pressure and temperature ratios with explicit zero-frequency behavior', () => {
        const args = { bore: 0.1, rod: 0.06, stroke: 0.2, gaugePressure: 0, referencePressure: 100000,
            operatingTemperature: 600, referenceTemperature: 300, frequency: 0 };
        const r = engines.computePneumaticConsumption(args);
        expect(r.freeAir).toBeCloseTo(0.00128805298797182, 13);
        expect(r.consumptionRate).toBe(0);
        expect(() => engines.computePneumaticConsumption({ ...args, operatingTemperature: 0 })).toThrow();
        expect(() => engines.computePneumaticConsumption({ ...args, referencePressure: 0 })).toThrow();
    });

    it('accounts for the film denominator and rejects invalid layers', () => {
        const r = engines.computeInsulation({ layers: [{ resistance: 2 }, { thickness: 0.1, conductivity: 0.1 }], insideFilm: 1 });
        expect(r.materialResistance).toBe(3);
        expect(r.resistance).toBe(4);
        expect(r.transmittance).toBe(0.25);
        expect(r.contributions).toEqual([50, 25]);
        expect(() => engines.computeInsulation({ layers: [{ thickness: 0, conductivity: 0.1 }] })).toThrow();
        expect(() => engines.computeInsulation({ layers: [] })).toThrow();
    });

    it('reports heat gain as negative and zero energy at zero duration', () => {
        const args = { area: 20, inside: 273.15, outside: 293.15, resistance: 2, duration: 100 };
        expect(engines.computeWallHeatTransfer(args)).toEqual({ difference: -20, heatRate: -200, energy: -20000 });
        expect(engines.computeWallHeatTransfer({ ...args, duration: 0 }).energy).toBeCloseTo(0, 10);
        expect(() => engines.computeWallHeatTransfer({ ...args, resistance: 0 })).toThrow();
    });

    it('restricts eccentric tension to the upper row and rejects unknown bearing arrangements', () => {
        const args = { arrangement: 'Symmetric two-row mount', weight: 200, offset: 0.3, count: 4, spacing: 0.15, horizontalSpacing: 0.2,
            shearCapacity: 100, tensionCapacity: 250 };
        const r = engines.computeMountingDemand(args);
        expect(r.moment).toBe(60);
        expect(r.shear).toBe(50);
        expect(r.tension).toBe(200);
        expect(r.compression).toBe(400);
        expect(r.shearRatio).toBe(0.5);
        expect(r.tensionRatio).toBe(0.8);
        expect(engines.computeMountingDemand({ ...args, arrangement: 'Close to wall', offset: 0 }).tension).toBe(0);
        expect(() => engines.computeMountingDemand({ ...args, count: 3 })).toThrow();
        expect(() => engines.computeMountingDemand({ ...args, arrangement: 'Close to wall' })).toThrow();
        expect(() => engines.computeMountingDemand({ ...args, spacing: 0 })).toThrow();
        expect(() => engines.computeMountingDemand({ ...args, horizontalSpacing: 0 })).toThrow();
        expect(engines.computeMountingDemand({ ...args, horizontalSpacing: 0.4 }).tension).toBe(r.tension);
    });

    it('keeps inactive inputs and categorical selections out of sweeps', () => {
        const model = models['pipe-flow'];
        const values = { ...fixtures[0][1], flow: 100 };
        const baseline = studies.calculateScenario(model, studies.createScenario(model, 'Velocity mode', values));
        for (const inputId of ['flow', 'flowMode']) {
            expect(studies.runSweep(model, baseline, { inputId, outputId: 'reynolds', start: 1, end: 2, count: 2, mode: 'count' }).ok).toBe(false);
        }
    });
});
