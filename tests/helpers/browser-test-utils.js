import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function createDomFromHtml(relativeHtmlPath) {
    return new JSDOM(readRepoFile(relativeHtmlPath), {
        runScripts: 'outside-only',
        url: `file://${path.join(repoRoot, relativeHtmlPath)}`
    });
}

function evaluateScripts(window, scriptRelativePaths) {
    const combinedScript = scriptRelativePaths
        .map((relativePath) => `${readRepoFile(relativePath)}\n//# sourceURL=${relativePath}`)
        .join('\n\n');

    window.eval(combinedScript);
}

function dispatchDomContentLoaded(window) {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
}

export function loadCalculatorPage(htmlRelativePath, scriptRelativePaths) {
    const dom = createDomFromHtml(htmlRelativePath);
    evaluateScripts(dom.window, scriptRelativePaths);
    dispatchDomContentLoaded(dom.window);

    return {
        dom,
        window: dom.window,
        document: dom.window.document
    };
}

export function loadCore(scriptRelativePaths = ['js/engineering-units.js']) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        runScripts: 'outside-only'
    });

    evaluateScripts(dom.window, scriptRelativePaths);

    return {
        dom,
        window: dom.window,
        document: dom.window.document
    };
}

export function normalizeText(value) {
    return String(value).replace(/\s+/g, ' ').trim();
}

export function getResultText(document) {
    return normalizeText(document.getElementById('result').textContent || '');
}

export function getResultValueText(document) {
    return normalizeText(document.querySelector('#result .result-value')?.textContent || '');
}

export function parseNumber(value) {
    return Number(String(value).replace(/,/g, '').trim());
}

export function extractNumber(text, regex) {
    const match = normalizeText(text).match(regex);
    if (!match) {
        throw new Error(`Could not extract number from: ${text}`);
    }

    return parseNumber(match[1]);
}

export function extractLeadingNumber(text) {
    const matches = [...normalizeText(text).matchAll(/([-+]?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?)/gi)];
    if (matches.length === 0) {
        throw new Error(`Could not extract number from: ${text}`);
    }

    return parseNumber(matches[matches.length - 1][1]);
}

export function setInputValue(document, id, value) {
    document.getElementById(id).value = String(value);
}

export function setSelectValue(document, id, value) {
    document.getElementById(id).value = value;
}
