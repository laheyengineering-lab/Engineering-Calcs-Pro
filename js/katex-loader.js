(function() {
    if (window.FormulaFoundryRenderMath && window.FormulaFoundryRenderMath.__ffLoader) {
        return;
    }

    const KATEX_VERSION = "0.16.11";
    const KATEX_BASE_URLS = [
        `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`,
        `https://unpkg.com/katex@${KATEX_VERSION}/dist`
    ];
    const RENDER_OPTIONS = {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
        ],
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
        throwOnError: false
    };

    const scriptPromises = new Map();
    let readyPromise = null;
    let renderQueued = false;
    let renderPromise = null;
    let warnedUnavailable = false;

    function warn(message, detail) {
        if (window.console && typeof window.console.warn === "function") {
            window.console.warn(`[FormulaFoundry KaTeX] ${message}`, detail || "");
        }
    }

    function appendStylesheet(href) {
        const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
        if (existing) {
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.onload = () => resolve(true);
            link.onerror = () => {
                link.remove();
                warn("Stylesheet failed to load", href);
                resolve(false);
            };
            document.head.appendChild(link);
        });
    }

    function isGlobalReady(src) {
        if (src.endsWith("/katex.min.js")) {
            return Boolean(window.katex && typeof window.katex.render === "function");
        }
        return typeof window.renderMathInElement === "function";
    }

    // Resolves only after the script has actually executed; a pending script is awaited, never assumed ready.
    function loadScript(src) {
        if (isGlobalReady(src)) {
            return Promise.resolve();
        }
        if (scriptPromises.has(src)) {
            return scriptPromises.get(src);
        }

        const promise = new Promise((resolve, reject) => {
            let script = document.querySelector(`script[src="${src}"]`);
            if (!script) {
                script = document.createElement("script");
                script.src = src;
                script.async = false;
                document.head.appendChild(script);
            }
            script.addEventListener("load", () => resolve(), { once: true });
            script.addEventListener("error", () => {
                script.remove();
                reject(new Error(`Failed to load ${src}`));
            }, { once: true });
        }).catch((error) => {
            scriptPromises.delete(src);
            throw error;
        });

        scriptPromises.set(src, promise);
        return promise;
    }

    function loadFromBase(baseUrl) {
        const isLast = baseUrl === KATEX_BASE_URLS[KATEX_BASE_URLS.length - 1];
        // Stylesheet loading never blocks rendering; if it fails, the last CDN's stylesheet is tried.
        appendStylesheet(`${baseUrl}/katex.min.css`).then((loaded) => {
            if (!loaded && !isLast) {
                appendStylesheet(`${KATEX_BASE_URLS[KATEX_BASE_URLS.length - 1]}/katex.min.css`);
            }
        });
        return loadScript(`${baseUrl}/katex.min.js`)
            .then(() => loadScript(`${baseUrl}/contrib/auto-render.min.js`));
    }

    function domReady() {
        if (document.readyState !== "loading") {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
        });
    }

    function ensureReady() {
        if (readyPromise) {
            return readyPromise;
        }

        readyPromise = KATEX_BASE_URLS.reduce((chain, baseUrl, index) => chain.catch((error) => {
            if (error) {
                warn(`Falling back to ${baseUrl} after load failure`, error.message || error);
            }
            return loadFromBase(baseUrl);
        }), Promise.reject(null)).then(() => true).catch((error) => {
            warn("KaTeX unavailable; equations will be shown as plain text", error && error.message);
            return false;
        });

        return readyPromise;
    }

    function renderNow() {
        if (typeof window.renderMathInElement !== "function") {
            return false;
        }
        try {
            window.renderMathInElement(document.body, RENDER_OPTIONS);
            return true;
        } catch (error) {
            warn("Equation rendering failed", error && error.message);
            return false;
        }
    }

    // Safe at any time: requests made before readiness are queued and coalesced into one render pass
    // that runs after DOM readiness and KaTeX loading, so content inserted meanwhile is included.
    function renderAllMath() {
        renderQueued = true;
        if (renderPromise) {
            return renderPromise;
        }

        renderPromise = Promise.all([domReady(), ensureReady()]).then(([, available]) => {
            renderPromise = null;
            if (!renderQueued) {
                return false;
            }
            renderQueued = false;
            if (!available) {
                if (!warnedUnavailable) {
                    warnedUnavailable = true;
                    warn("Skipping math rendering because KaTeX did not load");
                }
                return false;
            }
            return renderNow();
        });

        return renderPromise;
    }

    renderAllMath.__ffLoader = true;
    window.FormulaFoundryRenderMath = renderAllMath;
    window.FormulaFoundryMathReady = ensureReady;

    renderAllMath();
})();
