// Run from the repository root. The first argument is an unpacked pre-change checkout.
// node tests/browser/engineering-graphics.mjs /tmp/graphics-before /tmp/graphics-review
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { cases } from './graphics-cases.mjs';

const [beforeRoot, output] = process.argv.slice(2);
assert(beforeRoot && output, 'Provide a baseline checkout and an output directory.');
const format = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const captureDir = resolve(output);
await mkdir(captureDir, { recursive: true });

async function serve(root) {
    const server = createServer(async (request, response) => {
        const path = join(root, new URL(request.url, 'http://127.0.0.1').pathname);
        try {
            const data = await readFile(path);
            response.writeHead(200, { 'Content-Type': format[extname(path)] ?? 'application/octet-stream' });
            response.end(data);
        } catch {
            response.writeHead(404).end();
        }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

async function waitFor(read, message) {
    for (let i = 0; i < 180; i++) {
        const value = await read();
        if (value) return value;
        await pause(50);
    }
    assert.fail(message);
}

async function connect(socketUrl) {
    const socket = new WebSocket(socketUrl);
    await once(socket, 'open');
    let counter = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        if (message.method === 'Runtime.exceptionThrown') {
            errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
        }
        if (!message.id) return;
        const callback = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) callback.reject(Error(message.error.message));
        else callback.resolve(message.result);
    });
    function send(method, params = {}) {
        const id = ++counter;
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            socket.send(JSON.stringify({ id, method, params }));
        });
    }
    return { socket, send, errors };
}

const previous = await serve(resolve(beforeRoot));
const current = await serve(process.cwd());
const profile = await mkdtemp(join(tmpdir(), 'ff-chromium-'));
const browser = spawn(process.env.CHROMIUM ?? 'chromium', [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--no-sandbox', '--disable-dev-shm-usage', '--lang=en-US', '--force-device-scale-factor=1',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
], { stdio: 'ignore' });
let launchError;
browser.on('error', (error) => { launchError = error; });
let cdp;

try {
    const port = await waitFor(async () => {
        if (launchError) throw launchError;
        if (browser.exitCode !== null) throw Error('Chromium exited at launch.');
        return readFile(join(profile, 'DevToolsActivePort'), 'utf8').then((ports) => ports.split('\n')[0], () => undefined);
    }, 'Chromium DevTools endpoint did not start.');
    const [tab] = await fetch('http://127.0.0.1:' + port + '/json/list').then((res) => res.json());
    cdp = await connect(tab.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setScrollbarsHidden', { hidden: true });
    const diagnostics = {};
    const mobileOverflow = new Set();
    const before = await review(previous.origin, 'before');
    const after = await review(current.origin, 'after');
    assert.deepEqual(after.entries.map(engineeringValues), before.entries.map(engineeringValues),
        'Report numerical results differ from the pre-change checkout');
    await verifyReports(after, before);
    await verifyStudies();
    await verifyKeyboard();
    await verifyAlternateStates();
    assert.deepEqual(cdp.errors, [], 'Uncaught page script errors');
    await writeFile(join(captureDir, 'layout.json'), JSON.stringify(diagnostics, null, 2));
    console.log(`Reviewed ${cases.length} calculators at 1440 px and 390 px. ${mobileOverflow.size} existing pages had baseline-level page overflow.`);
    console.log(`Checked ${after.entries.length} current and legacy report entries, print output, Design Studies, keyboard controls and alternate inputs.`);

    async function evaluate(source) {
        const result = await cdp.send('Runtime.evaluate', { expression: source, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
        return result.result.value;
    }

    async function resize(width) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width, height: 980, deviceScaleFactor: 1, mobile: false
        });
    }

    async function open(origin, page) {
        const url = origin + '/' + page;
        const navigation = await cdp.send('Page.navigate', { url });
        assert.equal(navigation.errorText, undefined, url);
        await waitFor(() => evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`), 'Page did not load: ' + url);
    }

    async function enter(values) {
        await evaluate(`Object.entries(${JSON.stringify(values)}).forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (!field) throw Error('No field: ' + id);
            field.value = String(value);
            if (field.value !== String(value)) throw Error('Missing option: ' + id + ' = ' + value);
            for (const event of ['input', 'change']) field.dispatchEvent(new Event(event, { bubbles: true }));
        })`);
    }

    async function calculate() {
        await evaluate(`document.querySelector('#expansionForm button[type=submit], button[onclick^="calculate"]').click()`);
    }

    function findSvg(selector) {
        return `[...document.querySelectorAll(${JSON.stringify(selector)})].find(node => node.getBoundingClientRect().width > 0)`;
    }

    async function inspect(selector) {
        return evaluate(`(() => {
            const svg = ${findSvg(selector)};
            if (!svg) throw Error('Missing visible SVG ' + ${JSON.stringify(selector)});
            const { x, y, width, height } = svg.viewBox.baseVal;
            const text = [...svg.querySelectorAll('text')].map(node => {
                const box = node.getBBox();
                const transform = svg.getCTM().inverse().multiply(node.getCTM());
                const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height],
                    [box.x + box.width, box.y + box.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(transform));
                return { label: node.textContent, left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
                    top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
            }).filter(box => box.right > box.left && box.bottom > box.top);
            const clipped = text.filter(box => box.left < x - 1 || box.top < y - 1 || box.right > x + width + 1 || box.bottom > y + height + 1);
            const overlap = text.flatMap((a, i) => text.slice(i + 1).filter(b => {
                const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                return overlapX > 3 && overlapY > 3 && overlapY / Math.min(a.bottom - a.top, b.bottom - b.top) > 0.34;
            }).map(b => [a.label, b.label]));
            const host = svg.closest('.ff-diagram-host, .expansion-diagram, .beam-interactive-diagram') ?? svg.parentElement;
            return { markup: svg.outerHTML, clipped: clipped.map(box => box.label), overlap, hostOverflow: host.scrollWidth - host.clientWidth,
                pageOverflow: document.documentElement.scrollWidth - innerWidth };
        })()`);
    }

    async function capture(selector, name, mobile = false) {
        const clip = await evaluate(`(async () => {
            const svg = ${findSvg(selector)};
            const node = ${mobile} ? (svg.closest('.ff-diagram-host') ?? svg.closest('figure') ?? svg.parentElement) : svg;
            node.scrollIntoView({ block: 'center', inline: 'nearest' });
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const { left, top, width, height } = node.getBoundingClientRect();
            return { x: Math.max(0, left + scrollX), y: Math.max(0, top + scrollY), width: Math.floor(width), height: Math.ceil(height), scale: 1 };
        })()`);
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
        await writeFile(join(captureDir, name + '.png'), Buffer.from(screenshot.data, 'base64'));
    }

    function safe({ markup }, id) {
        assert.doesNotMatch(markup, /\b(?:NaN|Infinity|undefined)\b/, id + ': invalid SVG');
        assert.match(markup, /viewBox="[^"]+"/, id + ': missing viewBox');
    }

    function clearLabels({ overlap, clipped }, id) {
        assert.deepEqual(clipped, [], id + ': clipped text');
        assert.deepEqual(overlap, [], id + ': overlapping SVG text');
    }

    async function review(origin, stage) {
        const records = diagnostics[stage] = {};
        for (const [id, values, selector = '[data-diagram] svg'] of cases) {
            await resize(1440);
            await open(origin, 'calculators/' + id + '.html');
            const initial = await inspect(selector);
            safe(initial, id);
            await enter(values);
            await calculate();
            const solved = await inspect(selector);
            safe(solved, id);
            if (stage === 'after' || !solved.markup.includes('expansion-svg')) {
                assert(solved.markup !== initial.markup, id + ': diagram did not reflect input');
            }
            const stored = await evaluate(`(() => {
                const report = FormulaFoundryReport.store;
                const count = report.count();
                document.querySelector('.add-to-report-button').click();
                return { added: report.count() > count, text: document.querySelector('#result').textContent.trim().slice(0, 125) };
            })()`);
            assert(stored.added, id + ': valid result did not save to report. ' + stored.text);
            await capture(selector, stage + '-' + id);
            if (id === 'thick-walled-cylinder') {
                safe(await inspect('#plot svg'), id + ' plot');
                await capture('#plot svg', stage + '-thick-walled-cylinder-plot');
            }
            await resize(390);
            await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
            const mobile = await inspect(selector);
            if (stage === 'before' && mobile.pageOverflow > 1) mobileOverflow.add(id);
            if (stage === 'after') {
                clearLabels(solved, id + ' desktop');
                clearLabels(mobile, id + ' mobile');
                assert(mobile.pageOverflow <= (diagnostics.before[id].pageOverflow + 1),
                    `${id}: whole-page overflow increased from ${diagnostics.before[id].pageOverflow} to ${mobile.pageOverflow}px`);
            }
            records[id] = { overlap: solved.overlap, clipped: solved.clipped, mobileOverlap: mobile.overlap, mobileClipped: mobile.clipped,
                hostOverflow: mobile.hostOverflow, pageOverflow: mobile.pageOverflow };
            await capture(selector, stage + '-mobile-' + id, true);
            if (stage === 'after' && ['cylinder-force', 'wall-mounting'].includes(id)) {
                const scroll = await evaluate(`(() => {
                    const host = (${findSvg(selector)}).closest('.ff-diagram-host');
                    host.scrollLeft = host.scrollWidth;
                    return host.scrollLeft;
                })()`);
                assert(scroll > 0, id + ': narrow figure does not scroll');
                await capture(selector, stage + '-mobile-' + id + '-end', true);
            }
        }
        const project = await evaluate('FormulaFoundryReport.store.load()');
        assert.equal(project.schemaVersion, 1);
        assert.equal(project.entries.length, cases.length);
        await writeFile(join(captureDir, stage + '-project.json'), JSON.stringify(project, null, 2));
        return project;
    }

    function engineeringValues({ calculatorId, inputs, outputs }) {
        return { calculatorId, inputs, outputs };
    }

    async function verifyReports(after, before) {
        await resize(1440);
        await open(current.origin, 'report.html');
        const figures = () => evaluate(`document.querySelectorAll('.report-profile-diagram svg').length`);
        const count = await figures();
        assert.equal(count, cases.length + 2, 'Current report schematic count, including the Lamé plot and the Beam Deflection section');
        await capture('.report-calc-diagram svg', 'report-current');
        await evaluate(`(() => {
            window.confirm = () => true;
            const transfer = new DataTransfer();
            transfer.items.add(new File([${JSON.stringify(JSON.stringify(before))}], 'legacy-project.json', { type: 'application/json' }));
            const picker = document.getElementById('projectFile');
            picker.files = transfer.files;
            picker.dispatchEvent(new Event('change', { bubbles: true }));
        })()`);
        await waitFor(() => evaluate(`document.getElementById('reportStatus').textContent.includes('imported and saved')`),
            'The report page failed to import the schema-v1 baseline file.');
        const loaded = await evaluate('FormulaFoundryReport.store.load().entries');
        assert.deepEqual(loaded.map(engineeringValues), after.entries.map(engineeringValues), 'Legacy reports preserve engineering results');
        assert.equal(await figures(), count,
            'Legacy report lost figures during schema-v1 reconstruction');
        await capture('.report-calc-diagram svg', 'report-legacy');
        const pdf = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
        assert(pdf.data.startsWith('JVBER'), 'Report did not print to PDF');
        await writeFile(join(captureDir, 'report-legacy.pdf'), Buffer.from(pdf.data, 'base64'));
    }

    async function verifyStudies() {
        await open(current.origin, 'design-studies.html');
        for (const [id] of cases) {
            await enter({ newStudyName: 'Graphics review ' + id, newStudyCalculator: id });
            await evaluate(`document.querySelector('#newStudyForm button[type=submit]').click()`);
            safe(await inspect('#contextDiagram svg'), id + ' design study');
            assert.equal(await evaluate(`document.querySelector('#contextDiagram figure').dataset.diagram`), id);
        }
        await capture('#contextDiagram svg', 'design-study');
        await open(current.origin, 'report.html');
        await open(current.origin, 'design-studies.html');
        assert.equal(await evaluate(`document.querySelector('#studySelect').options.length`), cases.length + 1);
    }

    async function verifyKeyboard() {
        for (const [id, range, numeric] of [
            ['cylinder-force', 'ff-range-boreDiameter', 'boreDiameter'],
            ['beam-deflection', 'beamSpanSlider', 'beamLength']
        ]) {
            await open(current.origin, 'calculators/' + id + '.html');
            const [, values, selector = '[data-diagram] svg'] = cases.find(([fixture]) => fixture === id);
            await enter(values);
            await calculate();
            const svg = (await inspect(selector)).markup;
            const prior = await evaluate(`document.getElementById('${numeric}').value`);
            await evaluate(`document.getElementById('${range}').focus()`);
            assert.equal(await evaluate('document.activeElement.id'), range);
            for (const type of ['keyDown', 'keyUp']) {
                await cdp.send('Input.dispatchKeyEvent', { type, key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
            }
            assert.notEqual(await evaluate(`document.getElementById('${numeric}').value`), prior, 'Native keyboard input did not update the field');
            assert.notEqual((await inspect(selector)).markup, svg, 'Native keyboard input did not update the drawing');
        }
    }

    async function verifyAlternateStates() {
        await open(current.origin, 'calculators/shaft-torsion.html');
        const shaft = '[data-diagram] svg';
        await enter({ outerDiameter: 2, diameterUnit: 'in', length: 20, lengthUnit: 'in', torque: 600, torqueUnit: 'lbf·in', shearModulus: 80 });
        await calculate();
        const solved = await inspect(shaft);
        assert.match(solved.markup, /lbf·in/);
        assert.match(solved.markup, /τ/);
        const shearStress = 'FormulaFoundryCalculatorDiagrams.snapshot(document.getElementById("calcDiagram")).model.tauMax';
        assert(Number.isFinite(await evaluate(shearStress)));
        await enter({ torque: -600 });
        const stale = await inspect(shaft);
        assert(stale.markup !== solved.markup, 'A torque sign change did not redraw the shaft');
        assert.match(await evaluate(`document.querySelector('.ff-diagram-status').textContent`), /recalculate/i);
        assert.equal(await evaluate(shearStress), undefined, 'A stale shear stress was kept in the drawing');
        for (const torque of ['', 0, 1e-10, 1e12]) {
            await enter({ torque });
            const drawing = await inspect(shaft);
            safe(drawing, 'shaft torque ' + torque);
            clearLabels(drawing, 'shaft torque ' + torque);
        }
        await enter({ torque: 0 });
        await calculate();
        assert.match(await evaluate(`document.querySelector('.ff-diagram-status').textContent`), /unavailable/i);
        safe(await inspect(shaft), 'invalid shaft calculation');

        await open(current.origin, 'calculators/hertzian-contact.html');
        await enter({ ...cases.find(([id]) => id === 'hertzian-contact')[1], configuration: 'spheres', shape2: 'flat' });
        await calculate();
        const contact = '#sphereDiagramHost svg';
        safe(await inspect(contact), 'sphere on flat contact');
        await capture(contact, 'alternate-hertzian-contact');

        await open(current.origin, 'calculators/thick-walled-cylinder.html');
        await enter({ innerDiameter: 100, outerDiameter: 200, internalPressure: 0, externalPressure: 15, endCondition: 'open' });
        await calculate();
        const plot = '#plot svg';
        safe(await inspect(plot), 'open ends and external pressure');
        await enter({ externalPressure: 12 });
        assert.equal(await evaluate(`document.querySelector(${JSON.stringify(plot)}) === null`), true, 'An edited pressure left a stale stress plot');
        await calculate();
        safe(await inspect(plot), 'stress plot after recalculation');
    }
} finally {
    cdp?.socket.close();
    previous.server.close();
    current.server.close();
    if (browser.pid && browser.exitCode === null) {
        const exited = once(browser, 'exit');
        browser.kill();
        await exited;
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}
