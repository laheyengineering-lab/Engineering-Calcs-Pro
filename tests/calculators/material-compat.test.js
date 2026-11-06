import { describe, it, expect } from 'vitest';
import { loadCore, loadCalculatorPage, setInputValue, setSelectValue } from '../helpers/browser-test-utils.js';

const studyScripts = [
    'js/engineering-units.js', 'js/calculator-utils.js',
    'js/press-fit-calculation.js', 'js/hertzian-contact-calculation.js', 'js/shaft-torsion-calculation.js',
    'js/bolt-torque-calculation.js', 'js/moment-calculation.js', 'js/bearing-life-calculation.js', 'js/column-buckling-calculation.js',
    'js/factor-of-safety-calculation.js', 'js/fillet-weld-calculation.js', 'js/spring-calculation.js', 'js/stress-strain-calculation.js',
    'js/thermal-expansion-calculation.js', 'js/thick-walled-cylinder-calculation.js', 'js/thread-strength-calculation.js',
    'js/beam-section-properties.js', 'js/beam-study-calculations.js', 'js/cylinder-force.js', 'js/differential-thermal-expansion.js',
    'js/report-builder.js', 'js/design-study-core.js', 'js/design-study-adapters.js'
];

describe('material selectors', () => {
    it('groups options by family, keeps every key selectable and shows one concise data note', () => {
        const { document } = loadCalculatorPage('calculators/stress-strain.html', [
            'js/engineering-units.js', 'js/calculator-utils.js', 'js/stress-strain-calculation.js', 'js/report-builder.js', 'js/stress-strain.js'
        ]);
        const select = document.getElementById('material');
        const optionValues = [...select.options].map((option) => option.value);
        expect(optionValues).toEqual(expect.arrayContaining(['carbon-steel', 'aluminum', 'cast-iron', 'titanium-grade-5']));
        expect(select.querySelectorAll('optgroup').length).toBeGreaterThan(3);
        expect(document.querySelectorAll('.material-data-note')).toHaveLength(1);
        expect(document.querySelector('.material-data-note').textContent).toMatch(/not certified design allowables/);
    });

    it('marks unavailable properties in shaft and thermal selector labels', () => {
        const shaft = loadCalculatorPage('calculators/shaft-torsion.html', [
            'js/engineering-units.js', 'js/calculator-utils.js', 'js/shaft-torsion-calculation.js', 'js/shaft-torsion.js'
        ]);
        const shaftOption = shaft.document.querySelector('#material option[value="titanium-grade-5"]');
        expect(shaftOption.textContent).toMatch(/G unavailable; enter manually/);
        expect(shaftOption.textContent).not.toMatch(/NaN/);

        const thermal = loadCalculatorPage('calculators/thermal-expansion.html', [
            'js/engineering-units.js', 'js/calculator-utils.js', 'js/thermal-expansion-calculation.js', 'js/thermal-expansion.js'
        ]);
        const thermalOption = thermal.document.querySelector('#material option[value="aluminum-6061-o"]');
        expect(thermalOption.textContent).toMatch(/α unavailable; enter manually/);
        expect(thermalOption.textContent).not.toMatch(/NaN/);

        const differential = loadCalculatorPage('calculators/differential-thermal-expansion.html', [
            'js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/differential-thermal-expansion.js'
        ]);
        const differentialOption = differential.document.querySelector('#secA1Material option[value="aluminum-6061-o"]');
        expect(differentialOption.textContent).toMatch(/α unavailable; enter manually/);
        expect(differentialOption.textContent).not.toMatch(/NaN/);
    });
});

describe('missing material properties are handled safely', () => {
    it('Hertzian contact keeps the manual value instead of writing 0 for a missing modulus or Poisson ratio', () => {
        const { document, window } = loadCalculatorPage('calculators/hertzian-contact.html', [
            'js/engineering-units.js', 'js/calculator-utils.js', 'js/hertzian-contact-calculation.js', 'js/report-builder.js', 'js/hertzian-contact.js'
        ]);
        window.eval("delete materialDatabase['aluminum'].poissonRatio");
        setInputValue(document, 'poisson1', 0.31);
        setSelectValue(document, 'material1', 'aluminum');
        window.applyHertzMaterial('1');
        expect(Number(document.getElementById('modulus1').value)).toBeCloseTo(68.9, 6);
        expect(Number(document.getElementById('poisson1').value)).toBe(0.31);
    });

    it('differential thermal expansion leaves the entered coefficient when a material has none', () => {
        const { document, window } = loadCalculatorPage('calculators/differential-thermal-expansion.html', [
            'js/engineering-units.js', 'js/calculator-utils.js', 'js/report-builder.js', 'js/differential-thermal-expansion.js'
        ]);
        expect(window.getMaterialProperty('aluminum-6061-o', 'thermalExpansionCoefficient')).toBeNull();
        setInputValue(document, 'secA1Alpha', 23);
        setSelectValue(document, 'secA1Material', 'aluminum-6061-o');
        window.applyDteMaterial('secA1');
        expect(Number(document.getElementById('secA1Alpha').value)).toBe(23);
    });

    it('Design Studies adapters report a missing strength instead of using zero', () => {
        const { window } = loadCore(studyScripts);
        const S = window.FormulaFoundryStudies;
        const adapter = S.getAdapter('factor-of-safety');
        const scenario = S.calculateScenario(adapter, S.createScenario(adapter, 'Cast iron yield', {
            mode: 'stress', strengthSource: 'material-yield', material: 'cast-iron', appliedStress: 50
        }));
        expect(scenario.status).toBe('error');
        const tensile = S.calculateScenario(adapter, S.createScenario(adapter, 'Cast iron UTS', {
            mode: 'stress', strengthSource: 'material-tensile', material: 'cast-iron', appliedStress: 69
        }));
        // ASTM A48 Class 30 minimum tensile strength 207 MPa
        expect(tensile.result.outputs.find((o) => o.id === 'stressFactor').value).toBeCloseTo(3, 9);
    });

    it('does not label a partial press-fit yield screening as controlling', () => {
        const { window } = loadCore(studyScripts);
        const S = window.FormulaFoundryStudies;
        const adapter = S.getAdapter('press-fit');
        expect(adapter.version).toBe('3');
        const scenario = S.calculateScenario(adapter, S.createScenario(adapter, 'Cast iron hub', {
            interfaceDiameter: 50, diametralInterference: 0.05, hubOuterDiameter: 100,
            shaftBoreDiameter: 0, engagementLength: 50, frictionCoefficient: 0.12,
            hubMaterial: 'cast-iron', shaftMaterial: 'carbon-steel'
        }));
        expect(scenario.status).toBe('calculated');
        expect(scenario.result.outputs.find((output) => output.id === 'shaftFos')).toBeTruthy();
        expect(scenario.result.outputs.find((output) => output.id === 'hubFos')).toBeUndefined();
        expect(scenario.result.outputs.find((output) => output.id === 'controllingFos')).toBeUndefined();
        expect(scenario.result.warnings.join(' ')).toMatch(/hub.*no overall controlling factor/i);
    });
});

describe('manual overrides and saved Design Studies', () => {
    it('lets an entered modulus override a corrected material preset', () => {
        const { window } = loadCore(studyScripts);
        const S = window.FormulaFoundryStudies;
        const adapter = S.getAdapter('stress-strain');
        const run = (extra) => S.calculateScenario(adapter, S.createScenario(adapter, 'Override', {
            mode: 'deformation', force: 10, area: 100, originalLength: 1000, material: 'aluminum', ...extra
        }, { force: 'kN', area: 'mm²', length: 'mm', modulus: 'GPa' }));
        const preset = run({}).result.outputs.find((o) => o.id === 'elongation').value;
        const overridden = run({ youngsModulus: 100 }).result.outputs.find((o) => o.id === 'elongation').value;
        expect(preset).toBeCloseTo(10e3 * 1 / (100e-6 * 68.9e9) * 1000, 6); // dL = F L / (A E), in mm
        expect(overridden).toBeCloseTo(1, 6);
    });

    it('does not rewrite a saved scenario snapshot when the database value later changes', () => {
        const { window } = loadCore(studyScripts);
        const S = window.FormulaFoundryStudies;
        const adapter = S.getAdapter('thermal-expansion');
        const saved = S.calculateScenario(adapter, S.createScenario(adapter, 'Legacy', {
            condition: 'free', material: 'carbon-steel', originalLength: 2000, temperatureChange: 50
        }));
        const before = JSON.stringify(saved.result);
        const reloaded = JSON.parse(JSON.stringify(saved));
        window.eval("materialDatabase['carbon-steel'].thermalExpansionCoefficient = 12.0e-6");
        expect(JSON.stringify(reloaded.result)).toBe(before);
        // An explicit recalculation is the only way the new data is used.
        const recalculated = S.calculateScenario(adapter, S.createScenario(adapter, 'Recalc', {
            condition: 'free', material: 'carbon-steel', originalLength: 2000, temperatureChange: 50
        }));
        expect(recalculated.result.outputs.find((o) => o.id === 'expansion').value).toBeCloseTo(1.2, 9);
        expect(saved.result.outputs.find((o) => o.id === 'expansion').value).toBeCloseTo(1.17, 9);
    });

    it('keeps stored material selections valid for every legacy key', () => {
        const { window } = loadCore(studyScripts);
        ['carbon-steel', 'stainless-steel', 'aluminum', 'copper', 'brass', 'titanium',
            'mild-steel', 'high-strength-steel', 'cast-iron', 'magnesium'].forEach((key) => {
            expect(window.getMaterial(key), key).not.toBeNull();
            expect(window.getMaterialProperty(key, 'youngsModulus'), key).toBeGreaterThan(0);
        });
    });
});
