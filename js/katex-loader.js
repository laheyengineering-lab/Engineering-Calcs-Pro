(function() {
    const KATEX_VERSION = "0.16.11";
    const KATEX_BASE_URLS = [
        `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`,
        `https://unpkg.com/katex@${KATEX_VERSION}/dist`
    ];

    function appendStylesheet(href) {
        if (document.querySelector(`link[href="${href}"]`)) {
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.defer = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function renderAllMath() {
        if (typeof renderMathInElement !== "function") {
            return;
        }

        renderMathInElement(document.body, {
            delimiters: [
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true }
            ],
            throwOnError: false
        });
    }

    function loadFromBase(baseUrl) {
        appendStylesheet(`${baseUrl}/katex.min.css`);
        return loadScript(`${baseUrl}/katex.min.js`)
            .then(() => loadScript(`${baseUrl}/contrib/auto-render.min.js`));
    }

    loadFromBase(KATEX_BASE_URLS[0])
        .catch(() => loadFromBase(KATEX_BASE_URLS[1]))
        .then(renderAllMath)
        .catch(() => {});
})();
