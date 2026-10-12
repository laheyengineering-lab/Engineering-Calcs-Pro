(function() {
    const REPORT_ID = "formula-foundry-report";
    const resultPanel = document.getElementById("result");
    const calculatorColumn = document.querySelector(".calculator-column");
    const calculatorTitle = document.querySelector(".calculator-header h1");

    if (!resultPanel || !calculatorColumn || !calculatorTitle || document.getElementById(REPORT_ID)) {
        return;
    }

    const slug = window.location.pathname.split("/").pop().replace(/\.html$/, "");
    const catalogEntry = typeof calculators !== "undefined"
        ? calculators.find((calculator) => calculator.id === slug)
        : null;
    const title = catalogEntry?.name || calculatorTitle.textContent.trim();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button report-open-button";
    button.textContent = "Generate Report";
    button.setAttribute("aria-haspopup", "dialog");
    resultPanel.insertAdjacentElement("afterend", button);

    const status = document.createElement("p");
    status.className = "report-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    button.insertAdjacentElement("afterend", status);

    const dialog = document.createElement("dialog");
    dialog.id = REPORT_ID;
    dialog.className = "report-dialog";
    dialog.setAttribute("aria-labelledby", "report-dialog-title");
    const form = document.createElement("form");
    form.className = "report-form";
    form.addEventListener("submit", (event) => event.preventDefault());
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    let reportSnapshot = null;
    let reportDocument = null;
    let reportState = null;
    const adapters = window.FormulaFoundryReport?.adapters || {};

    function text(element) {
        return (element?.textContent || "").replace(/\s+/g, " ").trim();
    }

    function isVisible(element) {
        for (let node = element; node && node !== document.body; node = node.parentElement) {
            if (node.hidden || node.getAttribute("aria-hidden") === "true" ||
                (node.style && node.style.display === "none")) {
                return false;
            }
        }
        return true;
    }

    function controlLabel(control) {
        if (control.id) {
            const associated = [...document.querySelectorAll("label[for]")]
                .find((label) => label.htmlFor === control.id);
            if (associated) return text(associated);
        }
        const row = control.closest(".input-row");
        const preceding = row?.previousElementSibling;
        if (preceding?.matches("label")) return text(preceding);
        if (row?.parentElement?.previousElementSibling?.matches("label")) {
            return text(row.parentElement.previousElementSibling);
        }
        if (control.previousElementSibling?.matches("label")) return text(control.previousElementSibling);
        if (control.previousElementSibling?.matches("h3")) return text(control.previousElementSibling);
        return control.getAttribute("aria-label") || "";
    }

    function selectedText(select) {
        return select.selectedOptions?.[0]?.textContent?.trim() || select.value;
    }

    function getInputs() {
        const controls = [...calculatorColumn.querySelectorAll("input, select, textarea")]
            .filter((control) => !["button", "submit", "reset", "hidden"].includes(control.type))
            .filter((control) => !(control.tagName === "SELECT" &&
                control.closest(".input-row")?.querySelector("input, textarea")));
        return controls.map((control) => {
            const label = controlLabel(control);
            const row = control.closest(".input-row");
            const unitSelect = row && control.tagName !== "SELECT"
                ? [...row.querySelectorAll("select")].find((select) => select !== control)
                : null;
            const value = control.tagName === "SELECT" ? selectedText(control) : control.value.trim();
            return {
                label: label || control.name || control.id || "Input",
                value: value || "Not entered",
                unit: unitSelect ? selectedText(unitSelect) : "",
                visible: isVisible(control)
            };
        }).filter((input) => input.visible && input.label);
    }

    function equationText(formula) {
        const annotations = [...formula.querySelectorAll('annotation[encoding="application/x-tex"]')];
        const source = annotations.map((annotation) => annotation.textContent.trim()).filter(Boolean);
        if (source.length) return source;
        const raw = text(formula).replace(/^\\\[\s*/, "").replace(/\s*\\\]$/, "")
            .replace(/^\\\(\s*/, "").replace(/\s*\\\)$/, "").trim();
        return raw ? [raw] : [];
    }

    function extractListAfterHeading(root, headingPattern) {
        const heading = [...root.querySelectorAll("h2, h3, h4")]
            .find((candidate) => headingPattern.test(text(candidate)));
        const list = heading?.nextElementSibling;
        if (!list || !["UL", "OL"].includes(list.tagName)) return [];
        return [...list.querySelectorAll(":scope > li")].map(text).filter(Boolean);
    }

    function getTheory() {
        const theory = document.querySelector(".theory-column");
        if (!theory) return { equations: [], methodology: [], assumptions: [], references: [] };
        const equations = [...theory.querySelectorAll(".formula-box")]
            .flatMap(equationText).filter(Boolean);
        const methodology = [...theory.querySelectorAll("p")]
            .map(text).filter((paragraph) => paragraph && !/^[=\\\s]*$/.test(paragraph)).slice(0, 3);
        const referencesHeading = [...document.querySelectorAll("h2, h3")]
            .find((heading) => /^references$/i.test(text(heading)));
        const references = referencesHeading?.nextElementSibling
            ? [...referencesHeading.nextElementSibling.querySelectorAll("li")].map(text).filter(Boolean)
            : [];
        return {
            equations,
            methodology,
            assumptions: extractListAfterHeading(theory, /assumptions|limitations/i),
            references
        };
    }

    function isCalculated() {
        const heading = resultPanel.querySelector("h3");
        const value = resultPanel.querySelector(".result-value");
        return /^result(?:\b|\s*-)/i.test(text(heading)) && Boolean(text(value));
    }

    function captureDefaultState() {
        const inputs = getInputs();
        const result = text(resultPanel);
        const resultValue = text(resultPanel.querySelector(".result-value"));
        const theory = getTheory();
        const controls = [...calculatorColumn.querySelectorAll("input, select, textarea")]
            .filter((control) => !["button", "submit", "reset", "hidden"].includes(control.type))
            .map((control) => [control.id || control.name || control.tagName, control.value]);
        return {
            id: slug,
            title,
            equations: theory.equations,
            inputs,
            results: [{ label: text(resultPanel.querySelector("h3")) || "Calculated result", value: resultValue }],
            resultDetails: result,
            methodology: theory.methodology,
            assumptions: theory.assumptions,
            references: theory.references,
            controls,
            result
        };
    }

    function captureState() {
        const state = captureDefaultState();
        const provider = adapters[slug];
        if (typeof provider !== "function") return state;
        const adapted = provider(state);
        return adapted && typeof adapted === "object"
            ? { ...state, ...adapted, controls: state.controls, result: state.result }
            : state;
    }

    function stateSignature(state) {
        return JSON.stringify({
            controls: state.controls,
            equations: state.equations,
            result: state.result
        });
    }

    function makeElement(tag, className, content) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content !== undefined) element.textContent = content;
        return element;
    }

    function addField(parent, label, name, type = "text") {
        const wrapper = makeElement("div", "report-field");
        const inputLabel = makeElement("label", "", label);
        inputLabel.htmlFor = name;
        const input = document.createElement(type === "textarea" ? "textarea" : "input");
        input.id = name;
        input.name = name;
        if (type !== "textarea") input.type = type;
        wrapper.append(inputLabel, input);
        parent.appendChild(wrapper);
        return input;
    }

    function addButton(parent, label, className, action) {
        const control = makeElement("button", className, label);
        control.type = "button";
        control.addEventListener("click", action);
        parent.appendChild(control);
        return control;
    }

    function showPreparation() {
        form.replaceChildren();
        const heading = makeElement("h2", "", "Prepare calculation report");
        heading.id = "report-dialog-title";
        const explanation = makeElement("p", "report-intro",
            "Calculated values are taken from the current calculator result. Project details and notes stay in this browser session.");
        const error = makeElement("p", "report-error");
        error.id = "reportError";
        error.setAttribute("role", "alert");
        form.append(heading, explanation, error);

        const metadata = makeElement("div", "report-fields");
        addField(metadata, "Project name (optional)", "reportProject");
        addField(metadata, "Component or assembly (optional)", "reportComponent");
        addField(metadata, "Prepared by (optional)", "reportPreparedBy");
        addField(metadata, "Organization (optional)", "reportOrganization");
        const date = addField(metadata, "Report date", "reportDate", "date");
        date.value = new Date().toISOString().slice(0, 10);
        addField(metadata, "Revision or report ID (optional)", "reportRevision");
        const purpose = addField(metadata, "Objective or purpose (optional)", "reportPurpose", "textarea");
        purpose.rows = 2;
        const notes = addField(metadata, "Notes or conclusion (optional)", "reportNotes", "textarea");
        notes.rows = 4;
        form.appendChild(metadata);

        const actions = makeElement("div", "button-row report-controls");
        addButton(actions, "Preview report", "report-preview-button", previewReport);
        addButton(actions, "Return to calculator", "secondary-button", closeDialog);
        form.appendChild(actions);

        const preview = makeElement("section", "report-preview-panel");
        preview.id = "reportPreviewPanel";
        preview.hidden = true;
        const previewActions = makeElement("div", "button-row report-controls");
        addButton(previewActions, "Back to report details", "secondary-button", () => {
            preview.hidden = true;
            metadata.hidden = false;
            actions.hidden = false;
            document.getElementById("reportProject").focus();
        });
        addButton(previewActions, "Print / Save as PDF", "report-print-button", printReport);
        preview.appendChild(previewActions);
        reportDocument = makeElement("article", "report-document");
        preview.appendChild(reportDocument);
        form.appendChild(preview);
        dialog.showModal ? dialog.showModal() : dialog.setAttribute("open", "");
        document.getElementById("reportProject").focus();
    }

    function addTable(parent, caption, headers, rows) {
        parent.appendChild(makeElement("h3", "", caption));
        const table = document.createElement("table");
        table.className = "report-table";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headers.forEach((header) => headerRow.appendChild(makeElement("th", "", header)));
        thead.appendChild(headerRow);
        const tbody = document.createElement("tbody");
        rows.forEach((row) => {
            const tr = document.createElement("tr");
            row.forEach((cell) => tr.appendChild(makeElement("td", "", cell)));
            tbody.appendChild(tr);
        });
        table.append(thead, tbody);
        parent.appendChild(table);
    }

    function renderReport(state) {
        reportDocument.replaceChildren();
        const header = makeElement("header", "report-header");
        const logo = document.createElement("img");
        logo.src = "../assets/brand/logos/formula-foundry-logo-horizontal.png";
        logo.alt = "Formula Foundry";
        logo.className = "report-logo";
        header.appendChild(logo);
        header.appendChild(makeElement("p", "report-kicker", "ENGINEERING CALCULATION REPORT"));
        header.appendChild(makeElement("h1", "", state.title));
        const reportId = document.getElementById("reportRevision").value.trim();
        header.appendChild(makeElement("p", "report-identification",
            [reportId && `Report ID: ${reportId}`, `Calculator: ${state.title}`].filter(Boolean).join(" · ")));
        reportDocument.appendChild(header);

        const projectRows = [
            ["Project", document.getElementById("reportProject").value.trim()],
            ["Component / assembly", document.getElementById("reportComponent").value.trim()],
            ["Prepared by", document.getElementById("reportPreparedBy").value.trim()],
            ["Organization", document.getElementById("reportOrganization").value.trim()],
            ["Report date", document.getElementById("reportDate").value]
        ].filter((row) => row[1]);
        if (projectRows.length) addTable(reportDocument, "Report identification", ["Field", "Details"], projectRows);

        const purpose = document.getElementById("reportPurpose").value.trim();
        if (purpose) {
            const section = makeElement("section", "report-section");
            section.appendChild(makeElement("h2", "", "Purpose and scope"));
            section.appendChild(makeElement("p", "", purpose));
            reportDocument.appendChild(section);
        }

        if (state.equations.length) {
            const section = makeElement("section", "report-section report-equations");
            section.appendChild(makeElement("h2", "", "Governing equations"));
            state.equations.forEach((equation) => {
                section.appendChild(makeElement("div", "report-equation", `\\[ ${equation} \\]`));
            });
            reportDocument.appendChild(section);
        }

        addTable(reportDocument, "Inputs", ["Input", "Current value", "Unit"], state.inputs.map((input) =>
            [input.label, input.value, input.unit]));
        addTable(reportDocument, "Calculated results", ["Result", "Calculated value"], state.results.map((result) =>
            [result.label, result.value]));

        const details = makeElement("section", "report-section");
        details.appendChild(makeElement("h2", "", "Displayed calculation details"));
        details.appendChild(makeElement("p", "report-detail-text", state.resultDetails));
        reportDocument.appendChild(details);

        if (state.methodology.length) {
            const section = makeElement("section", "report-section");
            section.appendChild(makeElement("h2", "", "Methodology and theory"));
            state.methodology.forEach((paragraph) => section.appendChild(makeElement("p", "", paragraph)));
            reportDocument.appendChild(section);
        }
        if (state.assumptions.length) {
            const section = makeElement("section", "report-section");
            section.appendChild(makeElement("h2", "", "Assumptions and limitations"));
            const list = document.createElement("ul");
            state.assumptions.forEach((assumption) => list.appendChild(makeElement("li", "", assumption)));
            section.appendChild(list);
            reportDocument.appendChild(section);
        }
        const notes = document.getElementById("reportNotes").value.trim();
        if (notes) {
            const section = makeElement("section", "report-section");
            section.appendChild(makeElement("h2", "", "Notes or conclusion"));
            section.appendChild(makeElement("p", "", notes));
            reportDocument.appendChild(section);
        }
        if (state.references.length) {
            const section = makeElement("section", "report-section report-references");
            section.appendChild(makeElement("h2", "", "References"));
            const list = document.createElement("ul");
            state.references.forEach((reference) => list.appendChild(makeElement("li", "", reference)));
            section.appendChild(list);
            reportDocument.appendChild(section);
        }
        const footer = makeElement("footer", "report-footer",
            `${state.title} · ${document.getElementById("reportDate").value || "Undated"} · For engineering reference; independently verify critical designs.`);
        reportDocument.appendChild(footer);
        if (typeof window.renderMathInElement === "function") {
            window.renderMathInElement(reportDocument, {
                delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }],
                throwOnError: false
            });
        }
    }

    function currentStateError() {
        if (!isCalculated()) {
            return "Complete a valid calculation before preparing a report.";
        }
        const current = captureState();
        if (!reportSnapshot || stateSignature(current) !== reportSnapshot) {
            return "Calculator values or results changed. Calculate again before previewing or printing.";
        }
        return "";
    }

    function previewReport() {
        const error = currentStateError();
        const errorElement = document.getElementById("reportError");
        errorElement.textContent = error;
        if (error) return;
        reportState = captureState();
        renderReport(reportState);
        document.getElementById("reportPreviewPanel").hidden = false;
        form.querySelector(".report-fields").hidden = true;
        form.querySelector(":scope > .button-row").hidden = true;
        document.getElementById("reportPreviewPanel").scrollIntoView?.({ block: "start" });
    }

    function printReport() {
        const error = currentStateError();
        if (error) {
            const errorElement = document.getElementById("reportError");
            errorElement.textContent = error;
            return;
        }
        document.documentElement.dataset.reportPrintValid = "true";
        window.print();
    }

    function closeDialog() {
        if (dialog.close) dialog.close();
        else dialog.removeAttribute("open");
        status.textContent = "";
        button.focus();
    }

    button.addEventListener("click", () => {
        if (!isCalculated()) {
            status.textContent = "Complete a valid calculation before preparing a report.";
            return;
        }
        reportState = captureState();
        reportSnapshot = stateSignature(reportState);
        status.textContent = "";
        showPreparation();
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog();
    });
    window.addEventListener("beforeprint", () => {
        document.documentElement.dataset.reportPrintValid = currentStateError() ? "false" : "true";
    });
    window.addEventListener("afterprint", () => {
        delete document.documentElement.dataset.reportPrintValid;
    });

    window.FormulaFoundryReport = window.FormulaFoundryReport || {};
    window.FormulaFoundryReport.adapters = adapters;
    window.FormulaFoundryReport.registerAdapter = function(adapterId, provider) {
        if (typeof adapterId === "string" && typeof provider === "function") {
            adapters[adapterId] = provider;
        }
    };
    window.FormulaFoundryReport.getCurrentState = captureState;
})();
