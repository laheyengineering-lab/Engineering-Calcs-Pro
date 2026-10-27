// ======================================================
// Formula Foundry - Project Report workspace and printable document
// Renders the stored project (js/report-builder.js) as an editable
// on-screen workspace and a consolidated print-ready document.
// All user-supplied text is inserted with textContent (never as HTML).
// ======================================================
(function () {
    "use strict";

    const report = window.FormulaFoundryReport;
    const store = report.store;
    const doc = document;

    const META_LABELS = [
        ["title", "Project title", "text"],
        ["number", "Project / reference number", "text"],
        ["customer", "Customer or organization", "text"],
        ["preparedBy", "Prepared by", "text"],
        ["date", "Date", "date"],
        ["revision", "Revision", "text"],
        ["scope", "Scope, requirements or design basis", "textarea"],
        ["notes", "General project notes", "textarea"]
    ];

    function el(tag, className, content) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined && content !== null) node.textContent = content;
        return node;
    }

    function setStatus(message) {
        doc.getElementById("reportStatus").textContent = message;
    }

    function bindText(selector, value) {
        doc.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
    }

    function itemsTable(caption, items) {
        const wrapper = el("div", "report-table-wrap");
        const table = el("table", "report-table");
        table.appendChild(el("caption", null, caption));
        const head = el("tr");
        ["Quantity", "Value", "Unit"].forEach((name) => head.appendChild(el("th", null, name)));
        table.appendChild(el("thead")).appendChild(head);
        const body = el("tbody");
        items.forEach((item) => {
            const row = el("tr");
            row.appendChild(el("td", null, item.label));
            row.appendChild(el("td", "num", report.formatValue(item.value)));
            row.appendChild(el("td", null, item.unit));
            body.appendChild(row);
        });
        table.appendChild(body);
        wrapper.appendChild(table);
        return wrapper;
    }

    function dataTable(table) {
        const wrapper = el("div", "report-table-wrap");
        const node = el("table", "report-table report-data-table");
        node.appendChild(el("caption", null, table.caption));
        const head = el("tr");
        table.columns.forEach((name) => head.appendChild(el("th", null, name)));
        node.appendChild(el("thead")).appendChild(head);
        const body = el("tbody");
        table.rows.forEach((cells) => {
            const row = el("tr");
            cells.forEach((cell) => row.appendChild(el("td", typeof cell === "number" ? "num" : null, typeof cell === "number" ? report.formatValue(cell) : cell)));
            body.appendChild(row);
        });
        node.appendChild(body);
        wrapper.appendChild(node);
        return wrapper;
    }

    function chartSection(chart) {
        if (!chart || !window.FormulaFoundryChart) return null;
        const figure = el("figure", "report-chart");
        figure.appendChild(window.FormulaFoundryChart.createLineChart(doc, chart));
        figure.appendChild(el("figcaption", null, chart.title + ". Samples are joined only where consecutive calculations succeeded; no values between samples were calculated. The numerical data are listed in the table."));
        return figure;
    }

    function listSection(heading, items) {
        const block = el("div", "report-block");
        block.appendChild(el("h4", null, heading));
        const list = el("ul");
        items.forEach((item) => list.appendChild(el("li", null, item)));
        block.appendChild(list);
        return block;
    }

    function profileDiagramSection(diagram) {
        if (diagram && diagram.type === "beam-deflection"
            && window.FormulaFoundryBeamDeflectionDiagram
            && typeof window.FormulaFoundryBeamDeflectionDiagram.render === "function") {
            try {
                const figure = el("figure", "report-profile-diagram beam-interactive-diagram");
                figure.appendChild(window.FormulaFoundryBeamDeflectionDiagram.render(doc, {
                    caseId: diagram.caseId,
                    span: diagram.span,
                    spanDisplay: String(diagram.span),
                    lengthUnit: diagram.spanUnit,
                    load: diagram.load,
                    loadLabel: diagram.caseId.endsWith("point") ? "P" : "w",
                    maxDeflection: diagram.maxDeflection,
                    deflectionUnit: diagram.deflectionUnit
                }));
                const section = el("div", "beam-report-section");
                section.appendChild(el("h4", null, "Saved cross-section and selected bending axis"));
                section.appendChild(window.BeamSectionProperties.createDiagram(
                    doc, diagram.profile, diagram.dimensions, diagram.axis
                ));
                figure.appendChild(section);
                figure.appendChild(el("figcaption", null,
                    "Saved " + diagram.caseId + " model; applied load " + (diagram.caseId.endsWith("point") ? "P" : "w")
                    + " = " + diagram.load + " " + diagram.loadUnit + ". The deflected shape is illustrative and not to scale; actual results and section dimensions are listed in the tables."));
                return figure;
            } catch (error) {
                return null;
            }
        }
        if (!diagram || diagram.type !== "beam-section"
            || !window.BeamSectionProperties
            || typeof window.BeamSectionProperties.createDiagram !== "function") return null;
        try {
            const figure = el("figure", "report-profile-diagram");
            figure.appendChild(window.BeamSectionProperties.createDiagram(
                doc, diagram.profile, diagram.dimensions, diagram.axis
            ));
            const profileNames = {
                rectangular: "Solid rectangle / square",
                "solid-circular": "Solid circle",
                "hollow-circular": "Hollow circle / tube",
                "hollow-rectangular": "Hollow rectangle / tube",
                "i-beam": "Symmetric I-beam",
                "t-section": "T-section"
            };
            figure.appendChild(el("figcaption", null,
                profileNames[diagram.profile] + " cross-section; highlighted axis " + diagram.axis
                + " is the selected bending axis. Geometry shown proportionally; dimensions are listed above."));
            return figure;
        } catch (error) {
            return null;
        }
    }

    function buildEntry(entry, index, total) {
        const section = el("section", "report-entry");
        section.id = "entry-" + entry.id;

        const controls = el("div", "entry-controls no-print");
        const titleLabel = el("label", null, "Entry title");
        const titleInput = el("input");
        titleInput.type = "text";
        titleInput.maxLength = 200;
        titleInput.value = entry.title;
        titleInput.setAttribute("aria-label", "Entry title");
        titleInput.addEventListener("input", () => {
            store.updateEntry(entry.id, { title: titleInput.value });
            bindText('[data-entry-title="' + entry.id + '"]', titleInput.value.trim() || entry.calculatorName);
        });
        titleLabel.appendChild(titleInput);
        controls.appendChild(titleLabel);

        const notesLabel = el("label", null, "Notes for this calculation");
        const notes = el("textarea");
        notes.rows = 2;
        notes.maxLength = 5000;
        notes.value = entry.notes;
        notes.addEventListener("input", () => {
            store.updateEntry(entry.id, { notes: notes.value });
            const printed = doc.querySelector('[data-entry-notes="' + entry.id + '"]');
            printed.textContent = notes.value;
            printed.parentElement.classList.toggle("is-empty", notes.value.trim() === "");
        });
        notesLabel.appendChild(notes);
        controls.appendChild(notesLabel);

        const buttons = el("div", "button-row");
        const makeButton = (label, handler, disabled) => {
            const button = el("button", "secondary-button", label);
            button.type = "button";
            button.disabled = Boolean(disabled);
            button.addEventListener("click", handler);
            return button;
        };
        buttons.appendChild(makeButton("Move up", () => { store.moveEntry(entry.id, -1); render(); }, index === 0));
        buttons.appendChild(makeButton("Move down", () => { store.moveEntry(entry.id, 1); render(); }, index === total - 1));
        buttons.appendChild(makeButton("Remove", () => { store.removeEntry(entry.id); render(); setStatus("Entry removed."); }));
        const source = el("a", "report-source-link", "Open source calculator");
        source.href = entry.path;
        buttons.appendChild(source);
        controls.appendChild(buttons);
        section.appendChild(controls);

        const heading = el("h2");
        heading.appendChild(el("span", "entry-number", (index + 1) + ". "));
        const title = el("span", null, entry.title);
        title.setAttribute("data-entry-title", entry.id);
        heading.appendChild(title);
        section.appendChild(heading);
        const added = new Date(entry.addedAt);
        section.appendChild(el("p", "entry-meta", "Calculator: " + entry.calculatorName + " \u00b7 Added " + (Number.isNaN(added.getTime()) ? "" : added.toLocaleString())));

        if (entry.study) {
            const kinds = { scenario: "scenario", comparison: "scenario comparison", sweep: "parametric sweep" };
            section.appendChild(el("p", "entry-meta", "Design study: " + entry.study.name + " \u00b7 " + kinds[entry.study.kind]
                + (entry.study.scenarios.length ? " \u00b7 Scenarios: " + entry.study.scenarios.join(", ") : "")));
        }

        const diagram = profileDiagramSection(entry.diagram);
        if (diagram) section.appendChild(diagram);

        section.appendChild(itemsTable("Inputs", entry.inputs));
        section.appendChild(itemsTable("Results", entry.outputs));
        (entry.tables || []).forEach((table) => section.appendChild(dataTable(table)));
        const chartFigure = chartSection(entry.chart);
        if (chartFigure) section.appendChild(chartFigure);

        if (entry.equations.length) {
            const block = el("div", "report-block");
            block.appendChild(el("h4", null, "Governing equations"));
            entry.equations.forEach((tex) => block.appendChild(el("div", "formula-box", "\\[ " + tex + " \\]")));
            section.appendChild(block);
        }
        if (entry.method) {
            const block = el("div", "report-block");
            block.appendChild(el("h4", null, "Method"));
            block.appendChild(el("p", null, entry.method));
            section.appendChild(block);
        }
        if (entry.assumptions.length) section.appendChild(listSection("Assumptions and limitations", entry.assumptions));
        if (entry.warnings.length) section.appendChild(listSection("Warnings and applicability", entry.warnings));

        const notesBlock = el("div", "report-block entry-notes" + (entry.notes.trim() ? "" : " is-empty"));
        notesBlock.appendChild(el("h4", null, "Notes"));
        const notesText = el("p", "pre-wrap", entry.notes);
        notesText.setAttribute("data-entry-notes", entry.id);
        notesBlock.appendChild(notesText);
        section.appendChild(notesBlock);
        return section;
    }

    function buildCover(project) {
        const cover = el("section", "report-cover");
        const logo = el("img", "report-logo");
        logo.src = "assets/brand/logos/formula-foundry-logo-horizontal.svg";
        logo.alt = "Formula Foundry";
        logo.width = 274;
        logo.height = 34;
        cover.appendChild(logo);
        cover.appendChild(el("p", "report-tagline", "WHERE CALCULATIONS BECOME ENGINEERING"));
        const title = el("h1", "report-title", project.meta.title || "Engineering Calculation Report");
        title.setAttribute("data-meta", "title");
        title.setAttribute("data-default", "Engineering Calculation Report");
        cover.appendChild(title);

        const table = el("table", "report-meta-table");
        META_LABELS.filter(([key]) => !["title", "scope", "notes"].includes(key)).forEach(([key, label]) => {
            const row = el("tr", project.meta[key].trim() ? "" : "is-empty");
            row.appendChild(el("th", null, label));
            const cell = el("td", null, project.meta[key]);
            cell.setAttribute("data-meta", key);
            row.appendChild(cell);
            table.appendChild(row);
        });
        const generated = el("tr");
        generated.appendChild(el("th", null, "Report generated"));
        generated.appendChild(el("td", null, new Date().toLocaleDateString()));
        table.appendChild(generated);
        cover.appendChild(table);

        const scope = el("div", "report-block" + (project.meta.scope.trim() ? "" : " is-empty"));
        scope.appendChild(el("h4", null, "Scope, requirements and design basis"));
        const scopeText = el("p", "pre-wrap", project.meta.scope);
        scopeText.setAttribute("data-meta", "scope");
        scope.appendChild(scopeText);
        cover.appendChild(scope);
        return cover;
    }

    function render() {
        const project = store.load();
        const container = doc.getElementById("reportDocument");
        container.textContent = "";

        container.appendChild(buildCover(project));

        if (project.entries.length === 0) {
            const empty = el("section", "content-card report-empty no-print");
            empty.appendChild(el("h2", null, "No calculations in this project yet"));
            empty.appendChild(el("p", null, "Open a calculator, enter inputs, press Calculate, then choose \u201cAdd to Project Report\u201d."));
            const link = el("a", null, "Browse calculators");
            link.href = "index.html#catalog";
            empty.appendChild(link);
            container.appendChild(empty);
        } else {
            const toc = el("section", "report-toc");
            toc.appendChild(el("h2", null, "Calculation index"));
            const list = el("ol");
            project.entries.forEach((entry) => {
                const item = el("li");
                const link = el("a");
                link.href = "#entry-" + entry.id;
                const text = el("span", null, entry.title);
                text.setAttribute("data-entry-title", entry.id);
                link.appendChild(text);
                item.appendChild(link);
                item.appendChild(el("span", "toc-calculator", " \u2014 " + entry.calculatorName));
                list.appendChild(item);
            });
            toc.appendChild(list);
            container.appendChild(toc);
            project.entries.forEach((entry, index) => container.appendChild(buildEntry(entry, index, project.entries.length)));
        }

        const general = el("section", "report-general-notes" + (project.meta.notes.trim() ? "" : " is-empty"));
        general.appendChild(el("h2", null, "General project notes"));
        const generalText = el("p", "pre-wrap", project.meta.notes);
        generalText.setAttribute("data-meta", "notes");
        general.appendChild(generalText);
        container.appendChild(general);

        container.appendChild(el("p", "report-disclaimer", "Calculation results are preliminary and based on the stated assumptions. They do not certify a design or establish compliance with any standard or code."));

        report.updateCount();
        if (typeof window.FormulaFoundryRenderMath === "function") window.FormulaFoundryRenderMath();
    }

    function buildMetaForm() {
        const meta = store.load().meta;
        const grid = doc.getElementById("metaFields");
        META_LABELS.forEach(([key, label, type]) => {
            const wrapper = el("label", "report-field" + (type === "textarea" ? " wide" : ""), label);
            const input = type === "textarea" ? el("textarea") : el("input");
            if (type === "textarea") input.rows = 3; else input.type = type;
            input.id = "meta-" + key;
            input.value = meta[key];
            input.addEventListener("input", () => {
                store.updateMeta({ [key]: input.value });
                doc.querySelectorAll('[data-meta="' + key + '"]').forEach((node) => {
                    node.textContent = input.value || node.getAttribute("data-default") || "";
                    if (node.parentElement && node.parentElement.classList.contains("report-block")) {
                        node.parentElement.classList.toggle("is-empty", input.value.trim() === "");
                    }
                    if (node.parentElement && node.parentElement.classList.contains("report-general-notes")) {
                        node.parentElement.classList.toggle("is-empty", input.value.trim() === "");
                    }
                    if (node.parentElement && node.parentElement.closest(".report-meta-table")) {
                        node.parentElement.classList.toggle("is-empty", input.value.trim() === "");
                    }
                });
            });
            wrapper.appendChild(input);
            grid.appendChild(wrapper);
        });
    }

    function init() {
        buildMetaForm();
        render();
        doc.getElementById("printReport").addEventListener("click", () => {
            if (store.count() === 0) {
                setStatus("Add at least one calculation before printing.");
                return;
            }
            window.print();
        });
        doc.getElementById("clearReport").addEventListener("click", () => {
            if (!window.confirm("Clear the entire project (information, notes and all calculations)? This cannot be undone.")) return;
            store.clear();
            META_LABELS.forEach(([key]) => { doc.getElementById("meta-" + key).value = ""; });
            render();
            setStatus("Project cleared.");
        });
        window.addEventListener("storage", (event) => {
            if (event.key === report.STORAGE_KEY) render();
        });
    }

    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
    else init();

    window.FormulaFoundryReportPage = { render };
})();
