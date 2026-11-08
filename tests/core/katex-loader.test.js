import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(path.resolve(__dirname, '../../js/katex-loader.js'), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));

// Simulates a CDN: handler(src, el) decides when/if each element loads or errors.
function setup({ html = '<body><p id="m">\\(x\\)</p></body>', handler, loading = false } = {}) {
    const dom = new JSDOM(`<!doctype html><html><head></head>${html}</html>`, { runScripts: 'outside-only' });
    const { window } = dom;
    const requested = [];
    const renderSpy = vi.fn();
    const origAppend = window.document.head.appendChild.bind(window.document.head);
    window.console.warn = vi.fn();
    window.document.head.appendChild = (node) => {
        const result = origAppend(node);
        const src = node.src || node.href;
        requested.push(src);
        if (node.tagName === 'SCRIPT') {
            handler(src, {
                load() {
                    if (src.endsWith('/katex.min.js')) window.katex = { render() {} };
                    else window.renderMathInElement = (...a) => renderSpy(...a);
                    node.dispatchEvent(new window.Event('load'));
                },
                error() { node.dispatchEvent(new window.Event('error')); }
            });
        } else if (node.tagName === 'LINK') {
            handler(src, {
                load() { node.onload && node.onload(); },
                error() { node.onerror && node.onerror(); }
            });
        }
        return result;
    };
    if (loading) Object.defineProperty(window.document, 'readyState', { get: () => 'loading', configurable: true });
    const run = () => window.eval(source);
    return { window, requested, renderSpy, run };
}

const ok = (_src, h) => queueMicrotask(h.load);

describe('katex-loader', () => {
    it('cold load loads core before auto-render and renders once', async () => {
        const t = setup({ handler: ok });
        t.run();
        await t.window.FormulaFoundryRenderMath();
        const scripts = t.requested.filter((s) => s.endsWith('.js'));
        expect(scripts).toEqual([
            expect.stringContaining('jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js'),
            expect.stringContaining('jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js')
        ]);
        expect(t.renderSpy).toHaveBeenCalledTimes(1);
        expect(t.renderSpy.mock.calls[0][1].delimiters).toHaveLength(4);
    });

    it('waits for slow script loading before rendering', async () => {
        let release;
        const t = setup({ handler: (src, h) => { if (src.endsWith('katex.min.js')) release = h.load; else queueMicrotask(h.load); } });
        t.run();
        const p = t.window.FormulaFoundryRenderMath();
        await flush();
        expect(t.renderSpy).not.toHaveBeenCalled();
        release();
        await p;
        expect(t.renderSpy).toHaveBeenCalledTimes(1);
    });

    it('does not treat an existing still-loading script as ready', async () => {
        const fresh = setup({ handler: () => {} });
        const pending = fresh.window.document.createElement('script');
        pending.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
        fresh.window.document.head.appendChild(pending);
        fresh.run();
        const p = fresh.window.FormulaFoundryRenderMath();
        await flush();
        expect(fresh.renderSpy).not.toHaveBeenCalled();
        fresh.window.katex = { render() {} };
        pending.dispatchEvent(new fresh.window.Event('load'));
        await flush();
        // auto-render requested next; complete it
        const ar = fresh.window.document.querySelector('script[src$="auto-render.min.js"]');
        fresh.window.renderMathInElement = (...a) => fresh.renderSpy(...a);
        ar.dispatchEvent(new fresh.window.Event('load'));
        await p;
        expect(fresh.renderSpy).toHaveBeenCalledTimes(1);
        expect(fresh.window.document.querySelectorAll('script[src$="katex.min.js"]')).toHaveLength(1);
    });

    it('coalesces simultaneous requests and loads each script once', async () => {
        const t = setup({ handler: ok });
        t.run();
        const ps = [1, 2, 3, 4].map(() => t.window.FormulaFoundryRenderMath());
        await Promise.all(ps);
        expect(t.renderSpy).toHaveBeenCalledTimes(1);
        expect(t.requested.filter((s) => s.endsWith('.js'))).toHaveLength(2);
    });

    it('defers the initial render until DOM is ready', async () => {
        const t = setup({ handler: ok, loading: true });
        const listeners = [];
        t.window.document.addEventListener = (type, fn) => { if (type === 'DOMContentLoaded') listeners.push(fn); };
        t.run();
        await flush();
        expect(t.renderSpy).not.toHaveBeenCalled();
        listeners.forEach((fn) => fn());
        await flush();
        expect(t.renderSpy).toHaveBeenCalledTimes(1);
    });

    it('renders dynamically inserted equations on explicit calls', async () => {
        const t = setup({ handler: ok });
        t.run();
        await t.window.FormulaFoundryRenderMath();
        const div = t.window.document.createElement('div');
        div.textContent = '\\[ y \\]';
        t.window.document.body.appendChild(div);
        await t.window.FormulaFoundryRenderMath();
        expect(t.renderSpy).toHaveBeenCalledTimes(2);
        expect(t.renderSpy.mock.calls[1][0]).toBe(t.window.document.body);
    });

    it('falls back to the secondary CDN when the primary fails', async () => {
        const t = setup({ handler: (src, h) => queueMicrotask(src.includes('jsdelivr') ? h.error : h.load) });
        t.run();
        await t.window.FormulaFoundryRenderMath();
        expect(t.requested.some((s) => s.includes('unpkg.com') && s.endsWith('auto-render.min.js'))).toBe(true);
        expect(t.renderSpy).toHaveBeenCalledTimes(1);
        expect(t.window.console.warn).toHaveBeenCalled();
        expect(t.window.document.querySelectorAll('link[href*="jsdelivr"]')).toHaveLength(0);
        expect(t.window.document.querySelectorAll('link[href*="unpkg"]')).toHaveLength(1);
    });

    it('falls back to the secondary stylesheet when the primary stylesheet fails', async () => {
        const t = setup({ handler: (src, h) => queueMicrotask(src.endsWith('.css') && src.includes('jsdelivr') ? h.error : h.load) });
        t.run();
        await t.window.FormulaFoundryRenderMath();
        await flush();
        expect(t.requested.some((s) => s.includes('unpkg.com') && s.endsWith('katex.min.css'))).toBe(true);
    });

    it('survives complete CDN failure without throwing and leaves text intact', async () => {
        const t = setup({ handler: (_s, h) => queueMicrotask(h.error) });
        t.run();
        await expect(t.window.FormulaFoundryRenderMath()).resolves.toBe(false);
        await expect(t.window.FormulaFoundryRenderMath()).resolves.toBe(false);
        expect(t.window.document.getElementById('m').textContent).toBe('\\(x\\)');
        expect(t.window.console.warn).toHaveBeenCalled();
    });

    it('repeated rendering is stable and a second load is a no-op', async () => {
        const t = setup({ handler: ok });
        t.run();
        await t.window.FormulaFoundryRenderMath();
        const first = t.window.FormulaFoundryRenderMath;
        t.run();
        expect(t.window.FormulaFoundryRenderMath).toBe(first);
        await first();
        await first();
        expect(t.requested.filter((s) => s.endsWith('.js'))).toHaveLength(2);
        expect(t.window.document.getElementById('m').textContent).toBe('\\(x\\)');
    });
});
