import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadCalculatorPage } from '../helpers/browser-test-utils.js';

const scripts = [
    'engineering-units', 'beam-section-properties', 'beam-study-calculations',
    'shaft-torsion-calculation', 'bearing-life-calculation', 'factor-of-safety-calculation',
    'shaft-bearing-core', 'shaft-bearing-project', 'shaft-bearing-example'
].map((script) => `js/${script}.js`);
const katexAssets = process.env.FORMULA_FOUNDRY_KATEX_DIR;
let page, model, input;

beforeAll(() => {
    page = loadCalculatorPage('workflows/shaft-bearing.html', scripts);
    const { FormulaFoundryShaftBearing, FormulaFoundryShaftProject, FormulaFoundryShaftExample } = page.window;
    model = FormulaFoundryShaftBearing;
    input = FormulaFoundryShaftExample.create(FormulaFoundryShaftProject).configurations[0].inputs;
});

afterAll(() => page?.dom.window.close());

function compare(result, references) {
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    for (const [path, reference] of Object.entries(references)) {
        const value = path.split('.').reduce((object, key) => object[key], result);
        expect(value / reference, path).toBeCloseTo(1, 8);
    }
}

it('reproduces the published gear load case in SI from independent closed forms', () => {
    // The reactions are 60%/40% of the opposite applied force vector (a/L = 0.4).
    // Roark's single point load gives M_max = 2000*(.24)*(.36)/.60. Circular
    // section geometry and TC/J then give the same-station stress and twist.
    // Deflection uses the textbook one-load branch to the right of the force,
    // with its stationary point at L - sqrt((L² - a²)/3). ISO 281 gives
    // 7³ = 343 and 8^(10/3) = 1024 in million revolutions before conversion.
    compare(model.calculate(input), {
        'geometry.area': 0.0012566370614359172,
        'geometry.inertia': 1.2566370614359172e-7,
        'geometry.polarMoment': 2.5132741228718345e-7,
        'geometry.sectionModulus': 6.283185307179586e-6,
        'geometry.mass': 5.933840204100401,
        'reactions.a.fy': 960,
        'reactions.a.fz': -720,
        'reactions.a.resultant': 1200,
        'reactions.b.fy': 640,
        'reactions.b.fz': -480,
        'reactions.b.resultant': 800,
        'bending.maximum.x': 0.24,
        'bending.maximum.momentY': 230.4,
        'bending.maximum.momentZ': -172.8,
        'bending.maximum.resultant': 288,
        'bending.maximum.bendingStress': 45836623.61046586,
        'combined.maximum.x': 0.24,
        'combined.maximum.equivalentStress': 48279068.957427815,
        'combined.yieldRatio': 7.6637766218371715,
        'deflection.stations.0.y': -0.00025757946536222767,
        'deflection.stations.0.z': 0.00019318459902167073,
        'deflection.maximum.x': 0.2825098426722491,
        'deflection.maximum.resultant': 0.000331280448423473,
        'deflection.slopes.a.y': -0.0014309970297901537,
        'deflection.slopes.a.z': 0.0010732477723426153,
        'deflection.slopes.b.y': 0.0012521224010663846,
        'deflection.slopes.b.z': -0.0009390918007997884,
        'torque.twist': 0.002297799490889239,
        'torque.shearStress': 8753521.870054245,
        'bearings.a.lifeMillionRevolutions': 343,
        'bearings.b.lifeMillionRevolutions': 1024,
        'bearings.a.lifeHours': 6351.851851851852,
        'bearings.b.lifeHours': 18962.962962962964,
        'bearings.a.requiredDynamicRating': 9771.903419741664,
        'bearings.b.requiredDynamicRating': 5282.118194937422,
        'bearings.a.staticRatio': 5,
        'bearings.b.staticRatio': 12
    });
});

it('matches the published 50 mm comparison while keeping applied loads unchanged', () => {
    // Section modulus scales with D³; I and J with D⁴; mass with D².
    compare(model.calculate({ ...input, outerDiameter: 0.05 }), {
        'geometry.mass': 9.271625318906878,
        'reactions.a.resultant': 1200,
        'reactions.b.resultant': 800,
        'bending.maximum.resultant': 288,
        'combined.maximum.equivalentStress': 24718883.306203038,
        'combined.yieldRatio': 14.968313714525728,
        'deflection.maximum.resultant': 0.00013569247167425448,
        'torque.twist': 0.0009411786714682321,
        'bearings.a.lifeHours': 6351.851851851852,
        'bearings.b.lifeHours': 18962.962962962964
    });
});

it('publishes the verified numerical results with worked display equations', () => {
    const example = page.document.querySelector('#worked-example .example-box');
    expect([...example.querySelectorAll('h3')].map((heading) => heading.textContent)).toEqual([
        'Given', 'Find', 'Solution', 'Result'
    ]);
    expect(example.textContent.match(/\\\[[\s\S]+?\\\]/g)).toHaveLength(11);
    for (const display of [
        '288', '45.837', '8.754', '48.279', '7.664', '0.33128', '282.51', '0.13165',
        '6351.85', '18962.96', '24.719', '0.13569', '0.05393', '5.934', '9.272'
    ]) expect(example.textContent).toContain(display);
    expect(page.document.querySelector('#worked-example #loadExample').type).toBe('button');
});

it.skipIf(!katexAssets)('renders the display equations used in the shaft worked example', () => {
    const { window, document } = page;
    for (const asset of ['katex.min.js', 'contrib/auto-render.min.js']) {
        window.eval(readFileSync(join(katexAssets, asset), 'utf8'));
    }
    const example = document.querySelector('#worked-example .example-box');
    window.renderMathInElement(example, {
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }]
    });
    expect(example.querySelectorAll('.katex-display')).toHaveLength(11);
    expect(example.querySelector('.katex-error')).toBeNull();
});
