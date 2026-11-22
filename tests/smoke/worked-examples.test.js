import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCalculatorPage, loadCore } from '../helpers/browser-test-utils.js';
import { electricalCases, fluidThermalCases, resultValues } from '../fixtures/worked-examples.js';

const legacyIds = new Set([
    'beam-bending-stress', 'beam-deflection', 'bearing-life', 'bolt-torque', 'column-buckling',
    'cylinder-force', 'differential-thermal-expansion', 'factor-of-safety', 'fillet-weld',
    'hertzian-contact', 'moment', 'press-fit', 'shaft-torsion', 'spring-calculations',
    'stress-strain', 'thermal-expansion', 'thick-walled-cylinder', 'thread-strength'
]);
const headings = ['Given', 'Find', 'Solution', 'Result'];
const scripts = ['engineering-units', 'calculator-data', 'cylinder-geometry',
    'fluid-thermal-calculations', 'expansion-models', 'electrical-dc-calculations',
    'electrical-practical-calculations', 'electrical-transient-ac-calculations', 'electrical-models'];
const cases = [...fluidThermalCases, ...electricalCases];
const verifiedIds = new Set(cases.map(([id]) => id));

function displayEquations(text) {
    return [...text.matchAll(/\\\[([\s\S]+?)\\\]/g)].map(([, math]) => math);
}

function numbers(text) {
    const normalized = text.replaceAll('{,}', '').replace(/(\d),(?=\d{3}\b)/g, '$1')
        .replace(/\\[,;!]/g, '').replaceAll('−', '-');
    return [...normalized.matchAll(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/g)]
        .map(([value]) => Number(value));
}

function getSections(box) {
    const sections = new Map();
    let current;
    for (const node of box.children) {
        const label = (node.matches('h3, h4') ? node.textContent
            : node.querySelector(':scope > strong:first-child')?.textContent)?.trim().replace(/:$/, '');
        if (headings.includes(label) && !sections.has(label)) {
            current = label;
            sections.set(label, node.matches('h3, h4') ? '' : node.textContent);
        } else if (current) {
            sections.set(current, sections.get(current) + '\n' + node.textContent);
        }
    }
    return sections;
}

let core, active, expansion, electrical;
const published = new Map();
const markup = new Map();
beforeAll(() => {
    core = loadCore(scripts.map((script) => 'js/' + script + '.js'));
    active = core.window.eval('calculators').filter(({ status }) => status !== 'coming-soon');
    expansion = core.window.eval('expansionModels');
    electrical = core.window.eval('electricalModels');
    for (const { id, path } of active) {
        const { dom, document } = loadCalculatorPage(path, []);
        const heading = [...document.querySelectorAll('h2')]
            .find((node) => /^worked examples?$/i.test(node.textContent.trim()));
        const box = heading?.nextElementSibling;
        if (box?.matches('.example-box')) {
            published.set(id, getSections(box));
            markup.set(id, box.outerHTML);
        }
        dom.window.close();
    }
});
afterAll(() => core.dom.window.close());

it('publishes ordered Given, Find, Solution and Result sections for every active calculator', () => {
    for (const { id } of active) {
        const sections = published.get(id);
        expect(sections, id).toBeDefined();
        expect([...sections.keys()], id).toEqual(headings);
        for (const section of headings) {
            expect(sections.get(section).replace(new RegExp('^' + section + ':?'), '').trim(), id)
                .not.toBe('');
        }
        if (!legacyIds.has(id)) expect(verifiedIds.has(id), id + ' needs a worked-example fixture').toBe(true);
    }
});

it.each([...verifiedIds])('%s shows several substantive mathematical steps and final values', (id) => {
    const sections = published.get(id);
    const displays = displayEquations(sections.get('Solution'));
    expect(displays.length).toBeGreaterThanOrEqual(3);
    const substitutions = displays.filter((math) => {
        const calculation = math.replace(/\\(?:mathrm|text)\{[^}]*\}/g, '')
            .replace(/_(?:\{[^}]*\}|[\p{L}\d])/gu, '').replace(/\{,\}/g, '');
        return /[=]|\\approx/.test(calculation) && numbers(calculation).length >= 2
            && /\\frac|\\sqrt|[-+*/()]|\\times|\)\s*\(/.test(calculation);
    });
    expect(substitutions.length).toBeGreaterThanOrEqual(2);
    expect(numbers(sections.get('Result'))).toEqual(expect.arrayContaining(resultValues[id]));
});

describe.each(cases)('%s published calculation', (id, inputs, expected, units = {}) => {
    it('matches independent outputs and shows the inputs and intermediate results', () => {
        const model = expansion[id] ?? electrical[id];
        const selectedUnits = Object.fromEntries(Object.entries(model.groups)
            .map(([group, definition]) => [group, units[group] ?? definition.default]));
        const actual = model.calculate(inputs, selectedUnits);
        const sections = published.get(id);
        const given = numbers(sections.get('Given'));
        const solution = numbers(sections.get('Solution'));
        expect(given).toEqual(expect.arrayContaining(Object.values(inputs).filter(Number.isFinite)));
        for (const [key, reference] of Object.entries(expected)) {
            // Optional scale converts an SI result to the units shown in the example.
            const [display, scale = 1] = Array.isArray(reference) ? reference : [reference];
            const value = key.split('.').reduce((state, property) => state[property], actual) * scale;
            const decimals = display.split('.')[1]?.length ?? 0;
            expect(value.toFixed(decimals), key).toBe(display);
            expect(solution, key).toContain(Number(display));
        }
    });
});

it('reproduces the published series RLC resonance case', () => {
    // At resonance LC = 1e-5 s² gives omega = sqrt(100000) rad/s and Z = R.
    const frequency = Math.sqrt(100000) / (2 * Math.PI);
    const { impedanceMagnitude, current, realPower, phase } = electrical['rlc-impedance']
        .calculate({ resistance: 10, inductance: 100, capacitance: 100, frequency, voltage: 10 });
    expect(impedanceMagnitude).toBeCloseTo(10, 10);
    expect(current).toBeCloseTo(1, 10);
    expect(realPower).toBeCloseTo(10, 10);
    expect(phase).toBeCloseTo(0, 10);
    expect(numbers(published.get('rlc-impedance').get('Result')))
        .toEqual(expect.arrayContaining([50.33, 1, 10]));
});

it.each([
    ['beam-deflection', [10000, 3, 200], [0.5625, 7500]],
    ['fillet-weld', [12, 70, 20], [89.08, 66.81, 44.54, 0.1123]],
    ['press-fit', [50, 0.05, 100, 0.12], [75, 125, 2, 3.33]]
])('%s publishes the verified legacy inputs and corrected results', (id, inputs, results) => {
    const sections = published.get(id);
    expect(numbers(sections.get('Given'))).toEqual(expect.arrayContaining(inputs));
    expect(numbers(sections.get('Result'))).toEqual(expect.arrayContaining(results));
});

const katexAssets = process.env.FORMULA_FOUNDRY_KATEX_DIR;
it.skipIf(!katexAssets)('renders every example with the production KaTeX loader', async () => {
    const { dom, document, window } = loadCore([]);
    try {
        document.body.innerHTML = [...markup.values()].join('\n');
        const boxes = [...document.querySelectorAll('.example-box')];
        const expected = boxes.map((box) => {
            const raw = box.textContent;
            return {
                inline: [...raw.matchAll(/\\\([\s\S]+?\\\)/g)].length,
                display: displayEquations(raw).length
            };
        });
        for (const path of ['katex.min.js', 'contrib/auto-render.min.js']) {
            window.eval(readFileSync(join(katexAssets, path), 'utf8'));
        }
        window.eval(readFileSync(new URL('../../js/katex-loader.js', import.meta.url), 'utf8'));
        expect(await window.FormulaFoundryRenderMath()).toBe(true);

        for (const [index, [id]] of [...markup.entries()].entries()) {
            const box = boxes[index];
            const { inline, display } = expected[index];
            expect(inline + display, id).toBeGreaterThan(0);
            expect(box.querySelectorAll('.katex-display'), id).toHaveLength(display);
            expect(box.querySelectorAll('.katex math'), id).toHaveLength(inline + display);
            expect(box.querySelector('.katex-error'), id).toBeNull();
            for (const source of box.querySelectorAll('annotation[encoding="application/x-tex"]')) {
                expect(() => window.katex.renderToString(source.textContent, { throwOnError: true }), id)
                    .not.toThrow();
            }
            const content = box.cloneNode(true);
            content.querySelectorAll('.katex').forEach((element) => element.remove());
            expect(content.textContent, id).not.toMatch(/\\[\[\]()]/);
        }
    } finally {
        dom.window.close();
    }
}, 15000);
