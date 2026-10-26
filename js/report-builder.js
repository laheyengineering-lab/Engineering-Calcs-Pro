// ======================================================
// Formula Foundry - Project Report Builder (shared)
// Browser-local project storage, calculation snapshots and the
// "Add to Project Report" action used by every calculator page.
// No backend: data lives in localStorage on this browser only.
//
// Snapshot structure (kept deliberately small):
// {
//   id, calculatorId, calculatorName, path, title, addedAt, notes,
//   inputs:  [{ label, value, unit }],   value = finite number or text
//   outputs: [{ label, value, unit }],
//   equations: [TeX string], assumptions: [string], method: string,
//   warnings: [string]
// }
// ======================================================
(function (root) {
    "use strict";

    const STORAGE_KEY = "formulaFoundry.projectReport";
    const SCHEMA_VERSION = 1;
    const MAX_ENTRIES = 100;
    const MAX_ITEMS = 60;
    const META_FIELDS = ["title", "number", "customer", "preparedBy", "date", "revision", "scope", "notes"];
    const LIMITS = { short: 200, long: 5000, tex: 1000 };

    // ---------- Sanitising / validation ----------

    function text(value, max) {
        if (value === undefined || value === null) return "";
        return String(value).slice(0, max || LIMITS.short);
    }

    function cleanList(list, max) {
        if (!Array.isArray(list)) return [];
        return list.slice(0, MAX_ITEMS)
            .filter((item) => typeof item === "string" && item.trim() !== "")
            .map((item) => item.slice(0, max || LIMITS.long));
    }

    function cleanItems(list) {
        if (!Array.isArray(list)) return null;
        const out = [];
        for (const item of list.slice(0, MAX_ITEMS)) {
            if (!item || typeof item !== "object") return null;
            const label = text(item.label);
            if (label.trim() === "") return null;
            let value = item.value;
            if (typeof value === "number") {
                if (!Number.isFinite(value)) return null;
            } else if (typeof value === "string") {
                if (value.trim() === "" || /\b(NaN|Infinity)\b/.test(value)) return null;
                value = value.slice(0, LIMITS.long);
            } else {
                return null;
            }
            out.push({ label, value, unit: text(item.unit, 40) });
        }
        return out;
    }

    function cleanDiagram(raw) {
        if (raw === undefined || raw === null) return null;
        if (raw && raw.type === "beam-deflection") {
            const pointCases = ["ss-point", "cant-point"];
            const distributedCases = ["ss-udl", "cant-udl"];
            const caseValid = pointCases.includes(raw.caseId) || distributedCases.includes(raw.caseId);
            const loadUnits = pointCases.includes(raw.caseId) ? ["N", "kN", "lbf"] : ["N/m", "kN/m", "lbf/ft"];
            const section = cleanDiagram({
                type: "beam-section",
                profile: raw.profile,
                dimensions: raw.dimensions,
                axis: raw.axis,
                unit: raw.sectionUnit
            });
            if (!caseValid || !section || !Number.isFinite(raw.span) || raw.span <= 0
                || !["mm", "cm", "m", "in", "ft"].includes(raw.spanUnit)
                || !Number.isFinite(raw.load) || raw.load === 0 || !loadUnits.includes(raw.loadUnit)
                || !Number.isFinite(raw.maxDeflection) || raw.maxDeflection < 0
                || !["mm", "m", "in"].includes(raw.deflectionUnit)) return null;
            return {
                type: "beam-deflection",
                caseId: raw.caseId,
                span: raw.span,
                spanUnit: raw.spanUnit,
                load: raw.load,
                loadUnit: raw.loadUnit,
                profile: section.profile,
                dimensions: section.dimensions,
                axis: section.axis,
                sectionUnit: section.unit,
                maxDeflection: raw.maxDeflection,
                deflectionUnit: raw.deflectionUnit
            };
        }
        const profiles = {
            rectangular: ["width", "height"],
            "solid-circular": ["diameter"],
            "hollow-circular": ["outerDiameter", "innerDiameter"],
            "hollow-rectangular": ["outerWidth", "outerHeight", "wallThickness"],
            "i-beam": ["height", "flangeWidth", "flangeThickness", "webThickness"],
            "t-section": ["height", "flangeWidth", "flangeThickness", "webThickness"]
        };
        if (!raw || raw.type !== "beam-section" || !profiles[raw.profile]
            || !["x", "y"].includes(raw.axis)
            || !["µm", "mm", "cm", "m", "in", "ft"].includes(raw.unit)
            || !raw.dimensions || typeof raw.dimensions !== "object") return null;
        const dimensions = {};
        for (const key of profiles[raw.profile]) {
            const value = raw.dimensions[key];
            if (!Number.isFinite(value) || value <= 0) return null;
            dimensions[key] = value;
        }
        if (raw.profile === "hollow-circular" && dimensions.innerDiameter >= dimensions.outerDiameter) return null;
        if (raw.profile === "hollow-rectangular"
            && (2 * dimensions.wallThickness >= dimensions.outerWidth || 2 * dimensions.wallThickness >= dimensions.outerHeight)) return null;
        if (["i-beam", "t-section"].includes(raw.profile)
            && (dimensions.webThickness > dimensions.flangeWidth
                || (raw.profile === "i-beam" && 2 * dimensions.flangeThickness >= dimensions.height)
                || (raw.profile === "t-section" && dimensions.flangeThickness >= dimensions.height))) return null;
        return { type: "beam-section", profile: raw.profile, dimensions, axis: raw.axis, unit: raw.unit };
    }

    // Optional generic tables (Design Studies): { caption, columns[], rows[][] } with text/finite-number cells.
    function cleanTables(raw) {
        if (raw === undefined || raw === null) return [];
        if (!Array.isArray(raw) || raw.length > 5) return null;
        const tables = [];
        for (const table of raw) {
            if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) return null;
            if (table.columns.length < 1 || table.columns.length > 12 || table.rows.length > 250) return null;
            const columns = table.columns.map((c) => text(c, 150));
            const rows = [];
            for (const row of table.rows) {
                if (!Array.isArray(row) || row.length !== columns.length) return null;
                const cells = [];
                for (const cell of row) {
                    if (typeof cell === "number") {
                        if (!Number.isFinite(cell)) return null;
                        cells.push(cell);
                    } else if (typeof cell === "string") {
                        cells.push(cell.slice(0, 400));
                    } else {
                        return null;
                    }
                }
                rows.push(cells);
            }
            tables.push({ caption: text(table.caption, 300), columns, rows });
        }
        return tables;
    }

    // Optional line chart (Design Studies sweeps): points with y = null are failed samples.
    function cleanChart(raw) {
        if (raw === undefined || raw === null) return null;
        if (!raw || raw.type !== "line" || !Array.isArray(raw.points) || raw.points.length < 1 || raw.points.length > 250) return false;
        const points = [];
        for (const p of raw.points) {
            if (!p || !Number.isFinite(p.x) || !(p.y === null || Number.isFinite(p.y))) return false;
            points.push({ x: p.x, y: p.y });
        }
        return { type: "line", title: text(raw.title), xLabel: text(raw.xLabel), yLabel: text(raw.yLabel), points };
    }

    function cleanStudy(raw) {
        if (!raw || typeof raw !== "object") return null;
        return {
            id: text(raw.id, 60),
            name: text(raw.name, 100),
            kind: ["scenario", "comparison", "sweep"].includes(raw.kind) ? raw.kind : "scenario",
            scenarios: Array.isArray(raw.scenarios) ? raw.scenarios.slice(0, 20).map((n) => text(n, 100)) : [],
            savedAt: text(raw.savedAt, 40)
        };
    }

    // Returns { ok, snapshot } or { ok: false, error }
    function validateSnapshot(raw) {
        if (!raw || typeof raw !== "object") return { ok: false, error: "No calculation result is available." };
        const calculatorId = text(raw.calculatorId, 80);
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(calculatorId)) return { ok: false, error: "The calculation has no valid calculator identifier." };
        const inputs = cleanItems(raw.inputs);
        if (!inputs || inputs.length === 0) return { ok: false, error: "The calculation has missing or invalid input values." };
        const outputs = cleanItems(raw.outputs);
        if (!outputs || outputs.length === 0) return { ok: false, error: "The calculation has missing or non-finite results." };
        const diagram = cleanDiagram(raw.diagram);
        if (raw.diagram !== undefined && raw.diagram !== null && !diagram) {
            return { ok: false, error: "The diagram snapshot is invalid." };
        }
        const tables = cleanTables(raw.tables);
        if (!tables) return { ok: false, error: "The result table data is invalid." };
        const chart = cleanChart(raw.chart);
        if (chart === false) return { ok: false, error: "The chart data is invalid." };
        const study = cleanStudy(raw.study);
        const calculatorName = text(raw.calculatorName) || calculatorId;
        const added = Date.parse(raw.addedAt);
        return {
            ok: true,
            snapshot: {
                id: typeof raw.id === "string" && /^[\w-]{1,60}$/.test(raw.id) ? raw.id : newId(),
                calculatorId,
                calculatorName,
                path: /^[\w\-./]+\.html$/.test(text(raw.path, 200)) && !text(raw.path, 200).includes("..") ? raw.path : "calculators/" + calculatorId + ".html",
                title: text(raw.title) || calculatorName,
                addedAt: Number.isFinite(added) ? new Date(added).toISOString() : new Date().toISOString(),
                notes: text(raw.notes, LIMITS.long),
                inputs,
                outputs,
                equations: cleanList(raw.equations, LIMITS.tex),
                assumptions: cleanList(raw.assumptions),
                method: text(raw.method, LIMITS.long),
                ...(diagram ? { diagram } : {}),
                ...(tables.length ? { tables } : {}),
                ...(chart ? { chart } : {}),
                ...(study ? { study } : {}),
                warnings: cleanList(raw.warnings)
            }
        };
    }

    function newId() {
        return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function emptyProject() {
        const meta = {};
        META_FIELDS.forEach((field) => { meta[field] = ""; });
        return { schemaVersion: SCHEMA_VERSION, meta, entries: [] };
    }

    // Validates stored data; invalid entries are dropped individually.
    function sanitizeProject(raw) {
        const project = emptyProject();
        if (!raw || typeof raw !== "object" || raw.schemaVersion !== SCHEMA_VERSION) return project;
        if (raw.meta && typeof raw.meta === "object") {
            META_FIELDS.forEach((field) => {
                project.meta[field] = text(raw.meta[field], field === "notes" || field === "scope" ? LIMITS.long : LIMITS.short);
            });
        }
        if (Array.isArray(raw.entries)) {
            const seen = new Set();
            raw.entries.slice(0, MAX_ENTRIES).forEach((entry) => {
                const result = validateSnapshot(entry);
                if (result.ok && !seen.has(result.snapshot.id)) {
                    seen.add(result.snapshot.id);
                    project.entries.push(result.snapshot);
                }
            });
        }
        return project;
    }

    // ---------- Project store ----------

    function defaultStorage() {
        try {
            return root.localStorage || null;
        } catch (error) {
            return null;
        }
    }

    function createProjectStore(initialStorage) {
        let storage = initialStorage === undefined ? defaultStorage() : initialStorage;
        let memory = null;

        function load() {
            if (storage) {
                try {
                    const raw = storage.getItem(STORAGE_KEY);
                    if (raw === null || raw === undefined) return emptyProject();
                    return sanitizeProject(JSON.parse(raw));
                } catch (error) {
                    return memory ? sanitizeProject(memory) : emptyProject();
                }
            }
            return memory ? sanitizeProject(memory) : emptyProject();
        }

        function save(project) {
            const serialised = JSON.stringify(project);
            if (storage) {
                try {
                    storage.setItem(STORAGE_KEY, serialised);
                    return true;
                } catch (error) {
                    // Quota or access error: keep a session-only copy.
                }
            }
            memory = JSON.parse(serialised);
            return false;
        }

        function addEntry(rawSnapshot) {
            const result = validateSnapshot(Object.assign({}, rawSnapshot, { id: undefined, addedAt: new Date().toISOString(), notes: "" }));
            if (!result.ok) return result;
            const project = load();
            if (project.entries.length >= MAX_ENTRIES) {
                return { ok: false, error: "The project report is full (" + MAX_ENTRIES + " calculations)." };
            }
            project.entries.push(result.snapshot);
            save(project);
            return { ok: true, entry: result.snapshot, count: project.entries.length };
        }

        function mutateEntries(fn) {
            const project = load();
            const changed = fn(project.entries);
            if (changed) save(project);
            return changed;
        }

        return {
            load,
            save,
            addEntry,
            count: () => load().entries.length,
            removeEntry: (id) => mutateEntries((entries) => {
                const index = entries.findIndex((entry) => entry.id === id);
                if (index < 0) return false;
                entries.splice(index, 1);
                return true;
            }),
            // direction: -1 moves earlier, +1 moves later
            moveEntry: (id, direction) => mutateEntries((entries) => {
                const index = entries.findIndex((entry) => entry.id === id);
                const target = index + direction;
                if (index < 0 || target < 0 || target >= entries.length) return false;
                [entries[index], entries[target]] = [entries[target], entries[index]];
                return true;
            }),
            updateEntry: (id, changes) => mutateEntries((entries) => {
                const entry = entries.find((item) => item.id === id);
                if (!entry || !changes) return false;
                if (typeof changes.title === "string") entry.title = text(changes.title).trim() || entry.calculatorName;
                if (typeof changes.notes === "string") entry.notes = text(changes.notes, LIMITS.long);
                return true;
            }),
            updateMeta(changes) {
                const project = load();
                META_FIELDS.forEach((field) => {
                    if (changes && typeof changes[field] === "string") {
                        project.meta[field] = text(changes[field], field === "notes" || field === "scope" ? LIMITS.long : LIMITS.short);
                    }
                });
                save(project);
                return project.meta;
            },
            clear() {
                memory = null;
                if (storage) {
                    try { storage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
                }
            },
            setStorage(next) { storage = next; memory = null; }
        };
    }

    // ---------- Formatting ----------

    function formatValue(value) {
        if (typeof value === "number") {
            if (value === 0) return "0";
            return String(Number(value.toPrecision(6)));
        }
        return String(value);
    }

    // ---------- Calculator-page integration ----------

    const store = createProjectStore();
    let pending = null;
    let structured = false;
    let statusElement = null;

    function formRoot() {
        const doc = root.document;
        return doc.querySelector(".calculator-column") || doc.getElementById("main") || doc.body;
    }

    function fingerprint() {
        return Array.from(formRoot().querySelectorAll("input, select, textarea"))
            .map((element) => (element.id || element.name || "") + "=" + (element.type === "checkbox" || element.type === "radio" ? element.checked : element.value))
            .join("|");
    }

    function resultPanel() {
        return root.document.getElementById("result");
    }

    function resultSignature() {
        const panel = resultPanel();
        return panel ? panel.textContent.replace(/\s+/g, " ").trim() : "";
    }

    function pageSlug() {
        const match = String(root.location && root.location.pathname).match(/([^/]+)\.html$/);
        return match ? match[1] : "";
    }

    // Structured calculators call this AFTER writing their result panel.
    function recordResult(snapshot) {
        const checked = validateSnapshot(snapshot);
        pending = checked.ok ? { snapshot, fingerprint: fingerprint(), signature: resultSignature() } : null;
        setStatus("");
        return checked;
    }

    function clearResult() {
        pending = null;
        setStatus("");
    }

    function addCurrentResult() {
        if (!pending) {
            return fail("Nothing to add yet: calculate a valid result first.");
        }
        if (pending.fingerprint !== fingerprint() || pending.signature !== resultSignature()) {
            return fail("The inputs or result have changed since the last calculation. Press Calculate again before adding to the report.");
        }
        // The snapshot object was captured when the calculation ran, so later
        // edits to the form cannot change what is stored.
        const result = store.addEntry(pending.snapshot);
        if (!result.ok) return fail(result.error);
        updateCount();
        setStatus("Added to the project report (" + result.count + " " + (result.count === 1 ? "calculation" : "calculations") + ").", false);
        return result;
    }

    function fail(message) {
        setStatus(message, true);
        return { ok: false, error: message };
    }

    function setStatus(message, isError) {
        if (!statusElement) return;
        statusElement.textContent = message;
        statusElement.classList.toggle("is-error", Boolean(isError));
    }

    function updateCount() {
        const count = store.count();
        root.document.querySelectorAll(".report-count").forEach((badge) => { badge.textContent = String(count); });
    }

    function installNavLink() {
        const nav = root.document.querySelector(".site-nav");
        if (!nav || nav.querySelector(".report-nav-link")) return;
        const inCalculators = /\/calculators\/[^/]*$/.test(String(root.location && root.location.pathname));
        const link = root.document.createElement("a");
        link.className = "report-nav-link";
        link.href = (inCalculators ? "../" : "") + "report.html";
        link.appendChild(root.document.createTextNode("Project Report "));
        const badge = root.document.createElement("span");
        badge.className = "report-count";
        badge.setAttribute("aria-label", "calculations in report");
        link.appendChild(badge);
        if (/\/report\.html$/.test(String(root.location && root.location.pathname))) link.setAttribute("aria-current", "page");
        nav.appendChild(link);
        if (!nav.querySelector(".studies-nav-link")) {
            const studies = root.document.createElement("a");
            studies.className = "studies-nav-link";
            studies.href = (inCalculators ? "../" : "") + "design-studies.html";
            studies.textContent = "Design Studies";
            if (/\/design-studies\.html$/.test(String(root.location && root.location.pathname))) studies.setAttribute("aria-current", "page");
            nav.insertBefore(studies, link);
        }
    }

    function installAddButton() {
        const row = root.document.querySelector(".calculator-column .button-row");
        if (!row || !resultPanel() || row.querySelector(".add-to-report-button")) return;
        const button = root.document.createElement("button");
        button.type = "button";
        button.className = "secondary-button add-to-report-button";
        button.textContent = "Add to Project Report";
        button.addEventListener("click", addCurrentResult);
        row.appendChild(button);
        statusElement = root.document.createElement("p");
        statusElement.className = "report-status";
        statusElement.setAttribute("role", "status");
        row.insertAdjacentElement("afterend", statusElement);
    }

    // ----- Fallback for calculators that do not provide a structured snapshot -----

    function texOf(box) {
        const annotation = box.querySelector('annotation[encoding="application/x-tex"]');
        let tex = annotation ? annotation.textContent : box.textContent;
        tex = tex.trim().replace(/^\\\[|\\\]$/g, "").trim();
        return tex;
    }

    function labelFor(element) {
        const doc = root.document;
        if (element.id) {
            const explicit = doc.querySelector('label[for="' + element.id + '"]');
            if (explicit) return explicit.textContent.trim();
        }
        let node = element.closest(".input-row") || element;
        while (node && (node = node.previousElementSibling)) {
            if (node.classList.contains("input-label")) return node.textContent.trim();
        }
        return element.id || "Input";
    }

    function scrapeSnapshot() {
        const doc = root.document;
        const slug = pageSlug();
        const heading = doc.querySelector("h1");
        const name = heading ? heading.textContent.trim() : slug;
        const inputs = [];
        formRoot().querySelectorAll("input, select").forEach((element) => {
            if (element.closest("#result")) return;
            const isSelect = element.tagName === "SELECT";
            const value = isSelect ? (element.selectedOptions[0] ? element.selectedOptions[0].textContent.trim() : "") : element.value.trim();
            if (value === "") return;
            const row = element.closest(".input-row");
            let unit = "";
            if (!isSelect && row) {
                const unitSelect = row.querySelector("select");
                if (unitSelect) unit = unitSelect.value;
            } else if (isSelect && row && row.querySelector("input")) {
                return; // unit selector already attached to its input
            }
            inputs.push({ label: labelFor(element), value, unit });
        });
        const outputs = [];
        const panel = resultPanel();
        panel.querySelectorAll(".result-value, p, li").forEach((node) => {
            const line = node.textContent.replace(/\s+/g, " ").trim();
            if (!line) return;
            if (node.classList.contains("result-value")) {
                outputs.push({ label: "Primary result", value: line, unit: "" });
                return;
            }
            const split = line.match(/^([^:]{1,80}):\s*(.+)$/);
            if (split) outputs.push({ label: split[1], value: split[2], unit: "" });
        });
        const theory = doc.querySelector(".theory-column");
        const equations = [];
        const assumptions = [];
        let method = "";
        if (theory) {
            theory.querySelectorAll(".formula-box").forEach((box) => {
                const tex = texOf(box);
                if (tex) equations.push(tex);
            });
            theory.querySelectorAll("h3").forEach((h3) => {
                if (/assumption|limitation/i.test(h3.textContent)) {
                    let sibling = h3.nextElementSibling;
                    while (sibling && sibling.tagName !== "H3") {
                        if (sibling.tagName === "UL") sibling.querySelectorAll("li").forEach((li) => assumptions.push(li.textContent.replace(/\s+/g, " ").trim()));
                        sibling = sibling.nextElementSibling;
                    }
                }
            });
            const firstParagraph = theory.querySelector("p");
            method = firstParagraph ? firstParagraph.textContent.replace(/\s+/g, " ").trim() : "";
        }
        return {
            calculatorId: slug,
            calculatorName: name,
            path: "calculators/" + slug + ".html",
            title: name,
            inputs,
            outputs,
            equations,
            assumptions,
            method,
            warnings: ["Captured from the calculator page display; values are shown as formatted on screen."]
        };
    }

    function observeResultPanel() {
        const panel = resultPanel();
        if (!panel || typeof root.MutationObserver !== "function") return;
        new root.MutationObserver(() => {
            if (structured) return;
            const heading = panel.querySelector("h2, h3");
            const valid = panel.querySelector(".result-value")
                && !(heading && /invalid|error/i.test(heading.textContent))
                && !/\b(NaN|Infinity)\b/.test(panel.textContent);
            if (!valid) {
                pending = null;
                return;
            }
            const snapshot = scrapeSnapshot();
            const checked = validateSnapshot(snapshot);
            pending = checked.ok ? { snapshot, fingerprint: fingerprint(), signature: resultSignature() } : null;
        }).observe(panel, { childList: true, subtree: true, characterData: true });
    }

    function initPage() {
        installNavLink();
        installAddButton();
        updateCount();
        if (statusElement) observeResultPanel();
        root.addEventListener("storage", updateCount);
        root.addEventListener("pageshow", updateCount);
    }

    if (root.document.readyState === "loading") {
        root.document.addEventListener("DOMContentLoaded", initPage);
    } else {
        initPage();
    }

    root.FormulaFoundryReport = {
        STORAGE_KEY,
        SCHEMA_VERSION,
        MAX_ENTRIES,
        META_FIELDS,
        store,
        createProjectStore,
        validateSnapshot,
        sanitizeProject,
        emptyProject,
        formatValue,
        recordResult,
        clearResult,
        addCurrentResult,
        updateCount,
        declareStructured() { structured = true; },
        scrapeSnapshot,
        addSnapshot: (snapshot) => {
            const result = store.addEntry(snapshot);
            if (result.ok) updateCount();
            return result;
        }
    };
})(window);
