// Run from the repository root with Node 24 and Chromium.
// FORMULA_FOUNDRY_KATEX_DIR=/path/to/katex/dist node tests/browser/shaft-bearing.mjs /tmp/shaft-bearing-review
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const output = resolve(process.argv[2] || '/tmp/shaft-bearing-review');
const katex = process.env.FORMULA_FOUNDRY_KATEX_DIR;
assert(katex, 'Set FORMULA_FOUNDRY_KATEX_DIR to the pinned KaTeX dist directory including fonts.');
const workflowPage = 'workflows/shaft-bearing.html';
await mkdir(output, { recursive: true });
const downloads = await mkdtemp(join(output, 'downloads-'));

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
const profile = await mkdtemp(join(tmpdir(), 'ff-shaft-bearing-chromium-'));
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
    await click('.site-nav .workflows-nav-link');
    await waitFor(() => evaluate('location.pathname.includes("/workflows/")'), 'Workflows navigation did not open.');
    await click('a[href$="shaft-bearing.html"]');
    await ready(workflowPage);

    await click('#loadExample');
    assert.equal(await value('#projectTitle'), 'Packaging conveyor drive shaft');
    assert.equal(await value('#outerDiameter'), '40');
    assert.equal(await value(loadField(1, 'name')), 'Drive gear');
    await click('#calculate');
    assert(!await disabled('#addReport'), 'The worked example did not calculate.');
    assert.match(await contents('#resultSummary'), /48[.,]279|48[.,]28/);
    assert.match(await contents('#resultSummary'), /0[.,]331/);
    assert.match(await contents('#resultSummary'), /1,200|1200/);
    assert.match(await contents('#resultSummary'), /288/);
    assert.match(await contents('#resultSummary'), /45[.,]83|45[.,]84/);
    assert.match(await contents('#resultSummary'), /8[.,]75/);
    assert.match(await contents('#resultSummary'), /7[.,]66/);
    assert.match(await contents('#resultSummary'), /0[.,]1316|0[.,]132/);
    assert.match(await contents('#resultSummary'), /343/);
    assert.match(await contents('#resultSummary'), /1,024|1024/);
    assert(await count('#shaftPlots svg') >= 6, 'Expected the six engineering plots.');
    await noPageOverflow();
    await assertDiagramBounds();
    await capture('assembly', '#shaftDiagram');
    await capture('results', '#resultSummary', '#bearingResults');
    await capture('plots', '#shaftPlots');
    assert(await count('#worked-example .katex-display') >= 10, 'Expected the worked example calculations to render.');
    assert.equal(await count('#worked-example .katex-error'), 0);
    await capture('worked-example', '#worked-example');

    await click('#addLoad');
    await enter({
        [loadField(2, 'name')]: 'Fixture test', [loadField(2, 'position')]: 0.45,
        [loadField(2, 'fy')]: 120, [loadField(2, 'fz')]: -90,
        [loadField(2, 'notes')]: 'Temporary point load to test the editor and solver.'
    });
    assert(await disabled('#addReport'), 'Editing a load left stale results eligible for reporting.');
    assert.equal(await count('#shaftPlots svg'), 0);
    await click(loadAction(2, 'duplicate'));
    assert.equal(await value(loadField(3, 'position')), '0.45');
    await click(loadAction(3, 'up'));
    assert.match(await value(loadField(2, 'name')), /Fixture test/);
    await click(loadAction(2, 'remove'));
    await click('#calculate');
    assert(!await disabled('#addReport'));
    assert.doesNotMatch(await contents('#resultSummary'), /48[.,](279|28)/);
    await click(loadAction(2, 'remove'));
    await click('#calculate');
    assert.match(await contents('#resultSummary'), /48[.,](279|28)/);

    await click('#duplicateConfig');
    await enter({ '#configName': '50 mm alternative', '#outerDiameter': 50 });
    assert(await disabled('#addReport'));
    await click('#calculate');
    assert.match(await contents('#comparisonTables'), /40 mm baseline.*50 mm alternative/s);
    assert.match(await contents('#comparisonTables'), /24[.,](718|719|72)/);
    assert.match(await contents('#comparisonTables'), /0[.,]135[67]/);
    await enter({ '#sweepStart': 38, '#sweepEnd': 62, '#sweepCount': 9 });
    await click('#runSweep');
    assert(await count('#sweepOutput svg'), 'The diameter sweep did not render.');
    await capture('comparison-and-sweep', '#comparison', '#sweepFigure');

    const beforePresentation = await contents('#sweepOutput');
    await enter({ '#unit-stress': 'ksi', '#unit-deflection': 'in' });
    assert(!await disabled('#addReport'), 'An output unit change invalidated the calculation.');
    assert.match(await contents('#resultSummary'), /ksi/);
    const afterPresentation = await contents('#sweepOutput');
    assert.match(afterPresentation, /ksi/);
    assert.notEqual(afterPresentation, beforePresentation, 'The current sweep was not presented in the changed units.');
    await click('#saveProject');
    await send('Page.reload');
    await ready(workflowPage);
    assert.equal(await value('#configName'), '50 mm alternative');
    assert.equal(await value('#outerDiameter'), '50');
    assert.equal(await value('#unit-stress'), 'ksi');
    assert(!await disabled('#addReport'), 'The saved calculated configuration did not recalculate.');
    await click('#reloadProject');
    assert.equal(await value('#outerDiameter'), '50');

    await click('#exportProject');
    const workflowFile = await downloadedJSON();
    assert.equal(workflowFile.data.workflowId, 'shaft-bearing');
    assert.equal(workflowFile.data.schemaVersion, 1);
    assert.deepEqual(workflowFile.data.project.configurations.map(({ inputs }) => inputs.outerDiameter), [0.04, 0.05]);
    const malformed = join(output, 'malformed.workflow.json');
    await writeFile(malformed, '{"project":');
    await chooseFile('#importProject', malformed);
    await waitFor(async () => /invalid|malformed/i.test(await contents('#saveStatus')), 'Malformed workflow was not rejected.');
    assert.equal(await value('#outerDiameter'), '50');
    await enter({ '#projectTitle': 'Uncommitted verification edit' });
    await chooseFile('#importProject', workflowFile.path);
    await waitFor(async () => (await value('#projectTitle')) === 'Packaging conveyor drive shaft', 'Workflow import did not restore the project.');
    assert(!await disabled('#addReport'));

    // Sweeps are page-local, so run the same range again in the saved input units.
    await enter({ '#sweepStart': 38, '#sweepEnd': 62, '#sweepCount': 9 });
    await click('#runSweep');
    if (await count('#includeComparison') && !await evaluate('document.querySelector("#includeComparison").checked')) {
        await click('#includeComparison');
    }
    await click('#addReport');
    await open('report.html');
    await waitFor(() => count('.report-entry [data-diagram-id="shaft-bearing"]'), 'Project Report did not reconstruct the shaft schematic.');
    await waitFor(() => count('.report-entry .katex-display'), 'Report equations did not render.');
    assert.equal(await count('.report-entry .katex-error'), 0);
    assert.match(await contents('.report-entry'), /50 mm alternative/);
    assert.match(await contents('.report-entry'), /ksi/);
    assert.equal(await count('.report-entry .report-chart svg'), 1);
    await evaluate('document.fonts.ready.then(() => true)');
    await capture('report', '.report-entry > h2', '.report-entry .report-calc-diagram');

    await click('#exportProject');
    const reportFile = await downloadedJSON(workflowFile.path);
    assert.equal(reportFile.data.schemaVersion, 1);
    assert.equal(reportFile.data.entries.length, 1);
    assert.equal(reportFile.data.entries[0].diagram.id, 'shaft-bearing');
    const [entry] = reportFile.data.entries;
    assert.equal(entry.tables.length, 5);
    const stress = entry.outputs.find(({ label }) => /maximum nominal von mises/i.test(label));
    assert.equal(stress.unit, 'ksi');
    assert(Math.abs(stress.value - 3.58512) < 0.0005, 'The report captured an unexpected converted equivalent stress.');
    await click('#clearReport');
    await waitFor(async () => await count('.report-entry') === 0, 'Report did not clear in the test profile.');
    await chooseFile('#projectFile', reportFile.path);
    await waitFor(() => count('.report-entry [data-diagram-id="shaft-bearing"]'), 'Imported report did not reconstruct.');
    assert.deepEqual(JSON.parse(await evaluate('localStorage.getItem("formulaFoundry.projectReport")')), reportFile.data);
    await waitFor(() => count('.report-entry .katex-display'), 'Imported report equations did not render.');
    await evaluate('window.print = () => { window.workflowPrintRequested = true; }');
    await click('#printReport');
    assert.equal(await evaluate('window.workflowPrintRequested'), true);
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#reportControls")).display'), 'none');
    const pdf = await send('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, preferCSSPageSize: true });
    assert(Buffer.from(pdf.data, 'base64').length > 20_000, 'The generated report PDF is unexpectedly small.');
    await writeFile(join(output, 'shaft-bearing-report.pdf'), Buffer.from(pdf.data, 'base64'));
    await send('Emulation.setEmulatedMedia', { media: 'screen' });

    await resize(375);
    await open(workflowPage);
    await noPageOverflow();
    assert.equal(await count('#worked-example .katex-error'), 0);
    await captureMobile('mobile-assembly', '#results');
    const diagramOverflow = await evaluate('shaftDiagram.scrollWidth - shaftDiagram.clientWidth');
    assert(diagramOverflow > 0, 'The schematic must retain its readable scale on mobile.');
    await evaluate('shaftDiagram.scrollLeft = shaftDiagram.scrollWidth');
    await captureMobile('mobile-assembly-scrolled', '#results');
    await captureMobile('mobile-results', '#resultSummary');
    await captureMobile('mobile-plots', '#shaftPlots');
    await captureMobile('mobile-worked-example', '#worked-example h4:first-of-type');
    const loadControl = '#shaftDiagram [role="button"]';
    assert(await count(loadControl), 'No keyboard-accessible load station was found.');
    await evaluate('document.querySelector(' + JSON.stringify(loadControl) + ').focus()');
    await key('Enter', 'Enter', 13);
    assert.match(await evaluate('document.activeElement.closest("#loadList")?.id'), /loadList/);

    // Exercise the maximum number of stations and coincident positions.
    await resize(1440);
    for (let station = 2; station <= 8; station++) {
        await click('#addLoad');
        await enter({
            [loadField(station, 'name')]: 'Auxiliary load ' + station,
            [loadField(station, 'position')]: station % 2 === 0 ? 0.24 : 0.25,
            [loadField(station, 'fy')]: 20 * station, [loadField(station, 'fz')]: -10 * station
        });
    }
    assert.equal(await count('#loadList fieldset'), 8);
    assert(await disabled('#addLoad'));
    await click('#calculate');
    assert(!await disabled('#addReport'));
    assert.equal(await count(loadControl), 8);
    await noPageOverflow();
    await assertDiagramBounds();
    await capture('assembly-eight-loads', '#shaftDiagram');
    await resize(375);
    await noPageOverflow();

    assert.deepEqual(errors, [], 'Uncaught browser errors or missing KaTeX assets.');
    console.log('Chromium QA passed at 1440 and 375 px. Verified the worked example, keyboard load editing, comparison, sweep, units, workflow and report JSON, and A4 printing.');
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
    if (page === workflowPage) {
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

function loadField(index, field) {
    return '#loadList fieldset:nth-child(' + index + ') [data-load-field="' + field + '"]';
}

function loadAction(index, action) {
    return '#loadList fieldset:nth-child(' + index + ') [data-load-action="' + action + '"]';
}

function value(selector) {
    return evaluate('document.querySelector(' + JSON.stringify(selector) + ').value');
}

function disabled(selector) {
    return evaluate('document.querySelector(' + JSON.stringify(selector) + ').disabled');
}

async function downloadedJSON(previousPath) {
    const name = await waitFor(async () => (await readdir(downloads)).find(
        (name) => name.endsWith('.json') && join(downloads, name) !== previousPath
    ), 'JSON download did not complete.');
    const path = join(downloads, name);
    return { path, data: JSON.parse(await download(path)) };
}

async function captureMobile(name, selector) {
    await evaluate('document.querySelector(' + JSON.stringify(selector) + ').scrollIntoView({ block: "start" });'
        + 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const screenshot = await send('Page.captureScreenshot', { format: 'webp', quality: 90, captureBeyondViewport: false });
    await writeFile(join(output, name + '.webp'), Buffer.from(screenshot.data, 'base64'));
}

async function assertDiagramBounds() {
    const clipped = await evaluate('(' + (() => {
        const svg = document.querySelector('#shaftDiagram svg');
        const bounds = svg.getBoundingClientRect();
        return [...svg.querySelectorAll('text')].filter((node) => {
            const { left, right, top, bottom } = node.getBoundingClientRect();
            return left < bounds.left - 1 || right > bounds.right + 1 || top < bounds.top - 1 || bottom > bounds.bottom + 1;
        }).map((node) => node.textContent);
    }).toString() + ')()');
    assert.deepEqual(clipped, [], 'The schematic clipped text labels.');
}
