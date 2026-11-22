// Run from the repository root with Node 24 and Chromium.
// FORMULA_FOUNDRY_KATEX_DIR=/path/to/katex/dist node tests/browser/fluid-system.mjs /tmp/fluid-review
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const output = resolve(process.argv[2] || '/tmp/fluid-review');
const katex = process.env.FORMULA_FOUNDRY_KATEX_DIR;
assert(katex, 'Set FORMULA_FOUNDRY_KATEX_DIR to the pinned KaTeX dist directory including fonts.');
const downloads = join(output, 'downloads');
await mkdir(downloads, { recursive: true });

const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://127.0.0.1');
        const file = await readFile(join(process.cwd(), url.pathname));
        response.writeHead(200, { 'Content-Type': mime[extname(url.pathname)] ?? 'application/octet-stream' }).end(file);
    } catch {
        response.writeHead(404).end();
    }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
const profile = await mkdtemp(join(tmpdir(), 'ff-fluid-chromium-'));
const browser = spawn(process.env.CHROMIUM || 'chromium', [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--lang=en-US', '--force-device-scale-factor=1', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
], { stdio: 'ignore' });
let socket;
let launchError;
browser.on('error', (error) => { launchError = error; });

async function waitFor(read, message) {
    for (let attempt = 0; attempt < 200; attempt++) {
        const value = await read();
        if (value) return value;
        await pause(50);
    }
    assert.fail(message);
}

const errors = [];
const confirm = [];
let send;

try {
    const port = await waitFor(async () => {
        if (launchError) throw launchError;
        if (browser.exitCode !== null) throw Error('Chromium exited at launch.');
        return readFile(join(profile, 'DevToolsActivePort'), 'utf8').then((ports) => ports.split('\n')[0], () => null);
    }, 'Chromium DevTools endpoint did not start.');
    const [tab] = await fetch('http://127.0.0.1:' + port + '/json/list').then((response) => response.json());
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await once(socket, 'open');
    const pending = new Map();
    let requestId = 0;
    send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++requestId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('message', async ({ data }) => {
        const { id, result, method, params, error } = JSON.parse(data);
        if (id) {
            const callback = pending.get(id);
            pending.delete(id);
            if (error) callback.reject(Error(error.message));
            else callback.resolve(result);
        } else if (method === 'Runtime.exceptionThrown') {
            errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
        } else if (method === 'Page.javascriptDialogOpening') {
            confirm.push(params.message);
            await send('Page.handleJavaScriptDialog', { accept: params.type === 'confirm' });
        } else if (method === 'Fetch.requestPaused') {
            const path = new URL(params.request.url).pathname.split('/dist/')[1];
            try {
                assert(path && /^(contrib\/|fonts\/)?[\w.-]+$/.test(path));
                const data = await readFile(join(katex, path));
                await send('Fetch.fulfillRequest', {
                    requestId: params.requestId, responseCode: 200, body: data.toString('base64'),
                    responseHeaders: [
                        { name: 'Content-Type', value: mime[extname(path)] ?? 'application/octet-stream' },
                        { name: 'Access-Control-Allow-Origin', value: '*' }
                    ]
                });
            } catch (error) {
                errors.push(String(error));
                await send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' });
            }
        }
    });
    for (const domain of ['Page', 'Runtime', 'DOM']) await send(domain + '.enable');
    await send('Fetch.enable', { patterns: ['https://cdn.jsdelivr.net/npm/katex@*/dist/*', 'https://unpkg.com/katex@*/dist/*'].map((urlPattern) => ({ urlPattern })) });
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await resize(1440);

    await open('index.html');
    await click('.home-workflow a');
    await ready('workflows/fluid-system.html');
    await enter({
        '#projectTitle': 'Wash-water transfer', '#projectDescription': 'Send wash water to an elevated reservoir.',
        '#systemType': 'open', '#flow': 24, '#density': 998, '#dynamicViscosity': 1, '#efficiency': 65, '#elevation': 3.5,
        '#configName': 'Original piping', '#projectNotes': 'Water properties near 20 °C. K values use local segment velocities.'
    });
    for (const [index, values] of [
        ['Transfer main', 32, 8, 0.045, 1.5], ['Service run', 25, 14, 0.045, 4], ['Discharge', 20, 4, 0.045, 2]
    ].entries()) {
        if (index) await click('#addSegment');
        await fillSegment(index, values);
    }
    await capture('workspace', '.site-header', '#project');
    await click('#calculate');
    assert.match(await contents('#resultHighlights'), /1\.45343.*4\.95343.*29\.8335/s);
    assert.match(await contents('#segmentResults'), /Service run.*20331\.1.*Turbulent/s);
    assert.match(await contents('#systemDiagram'), /Δz = \+3\.5 m.*Loss 0\.6481 m/s);
    await verifyLabels();
    await capture('open-transfer', '#results', '.fluid-figure');

    await click('#duplicateConfig');
    await enter({ '#configName': '25 mm discharge', '#segmentList fieldset:nth-child(3) [data-segment="diameter"]': 25 });
    await click('#calculate');
    assert.match(await contents('#comparisonTables'), /Original piping \(baseline\).*25 mm discharge.*27\.2959.*-36/s);
    await sweepFlow();
    assert.equal(await count('#sweepFigure .chart-point'), 9);
    assert.match(await contents('#sweepFigure'), /Required pump head vs flow/);
    await capture('comparison', '#comparison', '#sweepFigure');
    await click('#saveWorkflow');
    assert.match(await contents('#saveStatus'), /saved in this browser/i);
    await send('Page.reload');
    await ready('workflows/fluid-system.html');
    await waitFor(async () => /Opened the project saved/.test(await contents('#projectLoadStatus')), 'Local workflow did not reload.');
    assert.equal(await evaluate('document.querySelector("#projectTitle").value'), 'Wash-water transfer');
    assert.equal(await evaluate('document.querySelector("#configName").value'), '25 mm discharge');
    assert.match(await contents('#resultHighlights'), /27\.2959/);

    await rm(join(downloads, 'wash-water-transfer.workflow.json'), { force: true });
    await click('#exportWorkflow');
    const workflowFile = join(downloads, 'wash-water-transfer.workflow.json');
    const workflow = JSON.parse(await download(workflowFile));
    assert.equal(workflow.schemaVersion, 1);
    assert.equal(workflow.project.configurations.length, 2);
    assert.equal(workflow.project.configurations[0].inputs.segments[2].diameter, 20);
    assert.equal(workflow.project.configurations[1].inputs.segments[2].diameter, 25);
    const malformed = join(output, 'malformed.workflow.json');
    await writeFile(malformed, '{"project":');
    await chooseFile('#workflowFile', malformed);
    await waitFor(async () => /invalid JSON/.test(await contents('#saveStatus')), 'Malformed workflow was not rejected.');
    assert.equal(confirm.length, 0, 'A malformed file asked for replacement confirmation.');
    await enter({ '#projectTitle': 'Unsaved edit' });
    await chooseFile('#workflowFile', workflowFile);
    await waitFor(async () => /Workflow imported/.test(await contents('#saveStatus')), 'Workflow import did not finish.');
    assert.equal(await evaluate('document.querySelector("#projectTitle").value'), 'Wash-water transfer');
    assert.match(await contents('#resultHighlights'), /27\.2959/);

    // A sweep is session state. Recompute it after reloading/importing the saved inputs.
    await sweepFlow();
    await click('#includeComparison');
    await click('#addToReport');
    assert.match(await contents('#reportStatus'), /analysis added/i);
    await click('#report .fluid-action-link');
    await ready('report.html');
    assert.equal(await count('.report-entry'), 1);
    assert.equal(await count('.report-entry [data-diagram-id="fluid-system"]'), 1);
    assert.equal(await count('.report-entry .report-chart svg'), 1);
    await waitFor(async () => await count('.report-entry .katex-display') === 8, 'Report equations did not render.');
    await evaluate('document.fonts.ready.then(() => true)');
    assert.match(await contents('.report-entry'), /25 mm discharge.*4\.5321.*27\.2959.*Original piping/s);
    await evaluate('window.print = () => { window.workflowPrintRequested = true; }');
    await click('#printReport');
    assert.equal(await evaluate('window.workflowPrintRequested'), true);
    const pdf = await send('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69 });
    assert(Buffer.from(pdf.data, 'base64').length > 20000, 'Chromium report PDF is unexpectedly small.');
    await writeFile(join(output, 'fluid-system-report.pdf'), Buffer.from(pdf.data, 'base64'));
    const reportFile = join(downloads, 'formula-foundry-project.json');
    await rm(reportFile, { force: true });
    await click('#exportProject');
    const report = JSON.parse(await download(reportFile));
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.entries[0].tables.length, 5);
    assert.equal(report.entries[0].diagram.model.rows.length, 3);
    await click('#clearReport');
    await waitFor(async () => await count('.report-entry') === 0, 'Report was not cleared in the test browser.');
    await chooseFile('#projectFile', reportFile);
    await waitFor(async () => await count('.report-entry [data-diagram-id="fluid-system"]') === 1, 'The imported analysis did not reconstruct.');
    assert.deepEqual(JSON.parse(await evaluate('localStorage.getItem("formulaFoundry.projectReport")')), report);
    assert.equal(await count('.report-entry .report-chart .chart-point'), 9);
    await capture('report-round-trip', '.report-entry > h2', '.report-entry .report-calc-diagram + .report-table-wrap + .report-table-wrap');

    await resize(375);
    await open('workflows/fluid-system.html');
    await noPageOverflow();
    const localOverflow = await evaluate('systemDiagram.scrollWidth - systemDiagram.clientWidth');
    assert(localOverflow > 200, 'Diagram does not scroll within the mobile figure.');
    assert.equal(await count('#worked-example .katex-display'), 8);
    assert.equal(await count('#worked-example .katex-error'), 0);
    const overflowingEquations = await evaluate(`[...document.querySelectorAll('#worked-example .katex-display')]
        .filter((line) => line.scrollWidth > line.clientWidth + 2)
        .map((line) => [line.clientWidth, line.scrollWidth, line.querySelector('annotation').textContent.trim()])`);
    assert.deepEqual(overflowingEquations, [], 'Worked-example equations overflowed at 375 px.');
    await capture('mobile-results', '#results', '.fluid-figure');
    await evaluate('document.getElementById("systemDiagram").scrollLeft = document.getElementById("systemDiagram").scrollWidth');
    await capture('mobile-diagram-scroll', '.fluid-figure');
    await capture('mobile-worked-example', '#worked-example .example-box h3:nth-of-type(3)', '#worked-example .example-box h3:nth-of-type(4)');

    await evaluate('document.querySelector("#systemDiagram [data-segment-index=\\"1\\"]").focus()');
    await key('Enter', 'Enter', 13);
    assert.equal(await evaluate('document.activeElement.dataset.segment'), 'name');
    assert.equal(await evaluate('document.activeElement.value'), 'Service run');
    await evaluate('document.querySelector("[aria-label=\\"Move S2 up\\"]").focus()');
    await key(' ', 'Space', 32);
    assert.match(await contents('#systemDiagram'), /S1Service run.*S2Transfer main/s);
    assert.equal(await evaluate('document.getElementById("addToReport").disabled'), true);
    await evaluate('document.getElementById("addSegment").focus()');
    await key('Tab', 'Tab', 9);
    assert.equal(await evaluate('document.activeElement.id'), 'calculate');
    await key(' ', 'Space', 32);
    assert.equal(await evaluate('document.activeElement.id'), 'resultsHeading');

    await resize(1440);
    await enter({ '#systemType': 'closed' });
    for (let index = 3; index < 8; index++) {
        await click('#addSegment');
        await fillSegment(index, ['Return run ' + (index - 2), 32, 2, 0.045, 0.5]);
    }
    await click('#calculate');
    assert.match(await contents('#systemDiagram'), /Complete loop · net elevation change = 0/);
    assert.equal(await count('#systemDiagram [data-segment-index]'), 8);
    await verifyLabels();
    await capture('closed-loop-eight-segments', '#results', '.fluid-figure');
    await resize(375);
    await noPageOverflow();
    await enter({ '#systemType': 'open', '#elevation': -10 });
    await resize(1440);
    await click('#calculate');
    assert.match(await contents('#systemDiagram'), /Δz = -10 m/);
    assert.match(await contents('#resultWarnings'), /Gravity-assisted/);
    await verifyLabels();
    await noPageOverflow();

    assert.deepEqual(errors, [], 'Uncaught browser errors or missing KaTeX assets');
    console.log('Chromium QA passed at 1440 and 375 px. Verified the complete workflow, keyboard editing, 8-segment layouts, KaTeX and report JSON/print.');
} finally {
    socket?.close();
    server.close();
    if (browser.pid && browser.exitCode === null) {
        const exited = once(browser, 'exit');
        browser.kill();
        await exited;
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}

async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
}

async function resize(width) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 980, deviceScaleFactor: 1, mobile: false });
}

async function open(page) {
    const result = await send('Page.navigate', { url: origin + '/' + page });
    assert.equal(result.errorText, undefined);
    await ready(page);
}

async function ready(page) {
    await waitFor(() => evaluate('location.href === ' + JSON.stringify(origin + '/' + page) + ' && document.readyState === "complete"'), page + ' did not load.');
    if (page !== 'index.html') {
        await waitFor(() => evaluate('Boolean(document.querySelector(".katex")) || document.title.startsWith("Project Report")'), 'KaTeX did not render.');
        await evaluate('document.fonts.ready.then(() => true)');
    }
}

async function click(selector) {
    await evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
}
async function count(selector) {
    return evaluate('document.querySelectorAll(' + JSON.stringify(selector) + ').length');
}
async function contents(selector) {
    return evaluate('document.querySelector(' + JSON.stringify(selector) + ').textContent');
}

async function enter(fields) {
    await evaluate('Object.entries(' + JSON.stringify(fields) + ').forEach(([selector, value]) => {' +
        'const field = document.querySelector(selector); field.value = String(value);' +
        'if (field.value !== String(value)) throw Error("Missing choice: " + selector);' +
        'field.dispatchEvent(new Event(field.tagName === "SELECT" ? "change" : "input", { bubbles: true })); })');
}

async function fillSegment(index, values) {
    const selector = '#segmentList fieldset:nth-child(' + (index + 1) + ')';
    const keys = ['name', 'diameter', 'length', 'roughness', 'minorCoefficient'];
    await enter(Object.fromEntries(keys.map((key, i) => [selector + ' [data-segment="' + key + '"]', values[i]])));
}

async function sweepFlow() {
    await enter({ '#sweepStart': 0, '#sweepEnd': 48, '#sweepCount': 9 });
    await click('#runSweep');
}

async function chooseFile(selector, file) {
    const { root } = await send('DOM.getDocument');
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
    await send('DOM.setFileInputFiles', { nodeId, files: [file] });
}

async function download(file) {
    return waitFor(() => readFile(file, 'utf8').catch(() => null), 'Download did not complete: ' + file);
}

async function key(key, code, windowsVirtualKeyCode) {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { key, code, type, windowsVirtualKeyCode });
}

async function noPageOverflow() {
    const overflow = await evaluate('document.documentElement.scrollWidth - innerWidth');
    assert(overflow <= 1, 'Page overflowed by ' + overflow + ' px.');
}

async function verifyLabels() {
    const diagnostics = await evaluate('(' + (() => {
        const svg = document.querySelector('#systemDiagram > svg');
        const bounds = svg.getBoundingClientRect();
        const labels = [...svg.querySelectorAll('text')].map((node) => {
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height, text: node.textContent };
        });
        const clipped = labels.filter((a) => a.x < bounds.x || a.y < bounds.y || a.x + a.width > bounds.right || a.y + a.height > bounds.bottom);
        const overlaps = labels.flatMap((a, index) => labels.slice(index + 1).filter((b) =>
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 4
            && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 4
        ).map((b) => [a.text, b.text]));
        return { clipped: clipped.map(({ text }) => text), overlaps };
    }).toString() + ')()');
    assert.deepEqual(diagnostics, { clipped: [], overlaps: [] }, 'Schematic label overlap or clipping.');
}

async function capture(name, top, bottom = top) {
    await evaluate('window.scrollTo(0, 0); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const clip = await evaluate('(' + ((top, bottom) => {
        const first = document.querySelector(top).getBoundingClientRect();
        const last = document.querySelector(bottom).getBoundingClientRect();
        const x = Math.max(0, Math.floor(first.left) - 8);
        const y = Math.max(0, Math.floor(first.top + scrollY) - 8);
        return {
            x, y, width: Math.ceil(Math.min(innerWidth, first.right + 8) - x),
            height: Math.ceil(last.bottom + scrollY) - y + 8, scale: 1
        };
    }).toString() + ')(' + JSON.stringify(top) + ',' + JSON.stringify(bottom) + ')');
    const result = await send('Page.captureScreenshot', { format: 'webp', quality: 90, captureBeyondViewport: true, clip });
    await writeFile(join(output, name + '.webp'), Buffer.from(result.data, 'base64'));
}
