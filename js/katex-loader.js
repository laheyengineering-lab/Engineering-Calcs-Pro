(function() {
    const KATEX_VERSION = "0.16.11";
    const KATEX_BASE_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;

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

    appendStylesheet(`${KATEX_BASE_URL}/katex.min.css`);

    loadScript(`${KATEX_BASE_URL}/katex.min.js`)
        .then(() => loadScript(`${KATEX_BASE_URL}/contrib/auto-render.min.js`))
        .then(renderAllMath)
        .catch(() => {});
})();
