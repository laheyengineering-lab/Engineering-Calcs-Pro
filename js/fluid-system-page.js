(function () {
    "use strict";

    const doc = document;
    const model = window.FormulaFoundryFluidSystem;
    const projects = window.FormulaFoundryFluidProject;
    const views = window.FormulaFoundryFluidReport;
    const diagrams = window.FormulaFoundryCalculatorDiagrams;
    const report = window.FormulaFoundryReport;
    const byId = (id) => doc.getElementById(id);
    const form = byId("analysisForm");
    const segmentList = byId("segmentList");
    const format = report.formatValue;

    let storage;
    try { storage = window.localStorage; } catch { /* The store reports access errors. */ }
    const store = projects.createStore(storage);
    const initial = store.load();
    let project = initial.project || projects.newProject();
    let dirty = false;
    let sweep = null;
    let importRequest = 0;

    function active() {
        return project.configurations.find(({ id }) => id === project.activeId);
    }

    function baseline() {
        return project.configurations.find(({ id }) => id === project.baselineId);
    }

    function replaceConfiguration(configuration) {
        project.configurations = project.configurations.map((item) => item.id === configuration.id ? configuration : item);
    }

    function element(tag, className, text) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function status(id, message, kind = "") {
        const node = byId(id);
        if (node.textContent !== message) node.textContent = message;
        node.dataset.kind = kind;
    }

    function markDirty() {
        dirty = true;
        status("saveStatus", "Project changes are in this page. Save locally or export the project to keep them.");
    }

    function option(value, label = value) {
        const node = element("option", null, label);
        node.value = value;
        return node;
    }

    function segmentFieldId(id, field) {
        return "segment-" + id + "-" + field;
    }

    function inputValue(input) {
        return input.type === "number" ? (Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null) : input.value;
    }

    function handledInputValue(input, value) {
        const text = value ?? "";
        if (input.value !== String(text)) input.value = text;
    }

    function initializeChoices() {
        const pipeUnits = byId("pipeUnits");
        for (const [key, group] of Object.entries(model.unitGroups)) {
            let select = byId("unit-" + key);
            if (!select) {
                const field = element("div");
                select = element("select");
                select.id = "unit-" + key;
                select.dataset.unit = key;
                const label = element("label", null, group.label);
                label.htmlFor = select.id;
                field.append(label, select);
                pipeUnits.appendChild(field);
            }
            select.append(...group.options.map((unit) => option(unit, unit === "GPM" ? "GPM (US)" : unit)));
        }
        byId("systemType").append(...Object.entries(model.systems).map(([key, system]) => option(key, system.label)));
    }

    function updateUnitLabels() {
        const { units } = active().inputs;
        doc.querySelectorAll("[data-unit-label]").forEach((label) => {
            label.textContent = units[label.dataset.unitLabel];
        });
    }

    function renderConfigurationOptions() {
        const select = byId("configSelect");
        select.replaceChildren(...project.configurations.map((config) => option(config.id,
            projects.name(config) + (config.id === project.baselineId ? " (baseline)" : ""))));
        select.value = project.activeId;
        const baseIsActive = project.activeId === project.baselineId;
        byId("setBaseline").disabled = baseIsActive;
        byId("removeConfig").disabled = baseIsActive;
        byId("duplicateConfig").disabled = project.configurations.length >= projects.MAX_CONFIGURATIONS;
        byId("includeComparison").disabled = project.configurations.length < 2;
    }

    function renderSystemInputs() {
        const { inputs, name } = active();
        handledInputValue(byId("configName"), name);
        form.querySelectorAll("[data-system]").forEach((field) => handledInputValue(field, inputs[field.dataset.system]));
        form.querySelectorAll("[data-unit]").forEach((field) => handledInputValue(field, inputs.units[field.dataset.unit]));
        byId("systemBasis").textContent = model.systems[inputs.systemType].assumption;
        byId("elevationField").hidden = inputs.systemType !== "open";
        byId("dynamicViscosityField").hidden = inputs.viscosityMode !== "dynamicViscosity";
        byId("kinematicViscosityField").hidden = inputs.viscosityMode !== "kinematicViscosity";
    }

    function renderSegments() {
        const { segments } = active().inputs;
        const template = byId("segmentTemplate");
        const full = segments.length === model.MAX_SEGMENTS;
        const cards = segments.map((segment, index) => {
            const card = template.content.firstElementChild.cloneNode(true);
            const tag = "S" + (index + 1);
            card.dataset.segmentId = segment.id;
            card.querySelector("legend").textContent = "Segment " + (index + 1);
            card.querySelectorAll("input[data-segment]").forEach((input) => {
                const field = input.dataset.segment;
                input.id = segmentFieldId(segment.id, field);
                const label = card.querySelector('[data-label="' + field + '"]');
                label.htmlFor = input.id;
                input.value = segment[field] ?? "";
            });
            const actions = {
                duplicate: ["Duplicate " + tag, full],
                up: ["Move " + tag + " up", index === 0],
                down: ["Move " + tag + " down", index === segments.length - 1],
                remove: ["Remove " + tag, segments.length === 1]
            };
            card.querySelectorAll("[data-segment-action]").forEach((button) => {
                const [label, disabled] = actions[button.dataset.segmentAction];
                button.setAttribute("aria-label", label);
                button.disabled = disabled;
            });
            return card;
        });
        segmentList.replaceChildren(...cards);
        byId("addSegment").disabled = full;
        updateUnitLabels();
    }

    function refreshSegmentValues() {
        for (const segment of active().inputs.segments) {
            for (const field of ["diameter", "length", "roughness"]) {
                handledInputValue(byId(segmentFieldId(segment.id, field)), segment[field]);
            }
        }
    }

    function clearErrors() {
        const summary = byId("analysisErrors");
        summary.replaceChildren();
        summary.className = "";
        form.querySelectorAll('[aria-invalid="true"]').forEach((node) => node.removeAttribute("aria-invalid"));
    }

    function showErrors(errors) {
        const summary = byId("analysisErrors");
        const heading = element("strong", null, "Check the analysis inputs");
        const list = element("ul");
        let firstField = null;
        for (const { field, segmentId, message } of errors) {
            const control = field && byId(segmentId ? segmentFieldId(segmentId, field) : field);
            if (control) {
                control.setAttribute("aria-invalid", "true");
                firstField ||= control;
            }
            list.appendChild(element("li", null, message));
        }
        summary.className = "error";
        summary.append(heading, list);
        (firstField || summary).focus();
    }

    function tableView({ caption, columns, rows }, extraClass = "") {
        const wrapper = element("div", "fluid-table-wrap");
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", caption);
        const table = element("table", ("fluid-table " + extraClass).trim());
        const head = table.createTHead().insertRow();
        for (const heading of columns) {
            const cell = element("th", null, heading);
            cell.scope = "col";
            head.appendChild(cell);
        }
        table.createCaption().textContent = caption;
        const body = table.createTBody();
        for (const cells of rows) {
            const row = body.insertRow();
            cells.forEach((value, index) => {
                const metric = typeof value === "object" ? value : null;
                const displayed = metric ? metric.value : value;
                const number = typeof displayed === "number";
                const cell = element(index === 0 ? "th" : "td", number ? "fluid-cell-number" : "", format(displayed));
                if (index === 0) cell.scope = "row";
                if (metric) {
                    const delta = metric.percent;
                    const sign = delta > 0 ? "+" : "";
                    const percent = delta === null ? "—" : sign + Number(delta.toPrecision(4)) + "%";
                    cell.appendChild(element("small", "fluid-delta", percent));
                }
                row.appendChild(cell);
            });
        }
        wrapper.appendChild(table);
        return wrapper;
    }

    function renderDiagram(inputs, result) {
        const drawing = window.FormulaFoundryFluidDiagram.describe(inputs, result);
        const svg = diagrams.mount(byId("systemDiagram"), model.ID, drawing);
        svg.setAttribute("role", "group");
        svg.removeAttribute("focusable");
        svg.querySelectorAll("[data-segment-index]").forEach((node) => {
            const index = Number(node.dataset.segmentIndex);
            const { id } = inputs.segments[index];
            const editSegment = () => byId(segmentFieldId(id, "name")).focus();
            node.setAttribute("role", "button");
            node.setAttribute("tabindex", "0");
            node.setAttribute("aria-label", "Edit S" + (index + 1) + " " + node.dataset.segmentName);
            node.addEventListener("click", editSegment);
            node.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                editSegment();
            });
        });
    }

    function readout({ label, value, unit }) {
        const box = element("div");
        const number = element("dd", null, format(value) + " ");
        number.appendChild(element("small", null, unit));
        box.append(element("dt", null, label), number);
        return box;
    }

    function renderResults() {
        const configuration = active();
        const { inputs } = configuration;
        const { units } = inputs;
        const result = projects.current(configuration);
        const canUseResults = Boolean(result);
        byId("resultSummary").hidden = !canUseResults;
        byId("resultBreakdown").hidden = !canUseResults;
        byId("runSweep").disabled = !canUseResults;
        byId("addToReport").disabled = !canUseResults;
        byId("modelLimits").replaceChildren(...[
            model.systems[inputs.systemType].assumption, ...model.assumptions, ...model.limitations
        ].map((item) => element("li", null, item)));
        renderDiagram(inputs, result);
        if (!result) {
            const message = configuration.status === "stale" ? "Inputs changed. Recalculate to update the results." : "Calculate the system to see losses and pump duty.";
            status("resultStatus", message, configuration.status === "stale" ? "warning" : "");
            status("reportStatus", "Calculate the active configuration before adding it to a report.");
            return;
        }

        status("resultStatus", "");
        status("reportStatus", "Active calculation ready to add to the report.");
        const viscosity = inputs.viscosityMode === "dynamicViscosity" ? "μ" : "ν";
        byId("resultBasis").textContent = [
            projects.name(configuration), model.systems[result.systemType].label,
            format(inputs.flow) + " " + units.flow,
            "ρ " + format(inputs.density) + " " + units.density,
            viscosity + " " + format(inputs[inputs.viscosityMode]) + " " + units[inputs.viscosityMode],
            format(inputs.efficiency) + "% pump efficiency"
        ].join(" · ");
        const totals = views.totals(result, units);
        const highlighted = ["frictionHead", "pumpHead", "shaftPower"];
        byId("resultHighlights").replaceChildren(...highlighted.map((key) => readout(totals.find((row) => row.key === key))));
        byId("headBalance").replaceChildren(...totals.filter(({ key }) => !highlighted.includes(key)).map(readout));
        const warnings = byId("resultWarnings");
        warnings.hidden = !result.warnings.length;
        warnings.replaceChildren(...result.warnings.map((warning) => element("li", null, warning)));
        byId("segmentResults").replaceChildren(...views.segmentTables(result, units).map((table) => tableView(table)));
    }

    function renderComparison() {
        const configuration = active();
        const base = baseline();
        const table = byId("comparisonTables");
        const hasAlternatives = project.configurations.length > 1;
        byId("comparisonBasis").hidden = !hasAlternatives;
        if (!hasAlternatives) {
            table.replaceChildren(element("p", "fluid-help", "The project has one baseline configuration. Duplicate it to start a comparison."));
            return;
        }
        const units = configuration.inputs.units;
        const segments = views.comparisonSegments(configuration, base, units);
        table.replaceChildren(tableView(views.comparisonTable(project, units, true), "fluid-comparison-table"), ...(segments ? [tableView(segments, "fluid-comparison-table fluid-segment-comparison")] : []));
    }

    function renderSweep() {
        byId("sweepOutput").hidden = !sweep;
        if (!sweep) return;
        const { units } = active().inputs;
        const chart = views.sweepChart(sweep, byId("sweepMetric").value, units);
        const figure = byId("sweepFigure");
        figure.tabIndex = 0;
        figure.replaceChildren(window.FormulaFoundryChart.createLineChart(doc, chart));
        byId("sweepTable").replaceChildren(tableView(views.sweepTable(sweep, units)));
    }

    function clearSweep(resetRange = false) {
        sweep = null;
        if (resetRange) {
            byId("sweepStart").value = "";
            byId("sweepEnd").value = "";
        }
        renderSweep();
        status("sweepStatus", projects.current(active())
            ? "Set a flow range and run a sweep for the active configuration."
            : "Calculate the active configuration before running a sweep.");
    }

    function renderActive() {
        renderConfigurationOptions();
        renderSystemInputs();
        renderSegments();
        clearErrors();
        renderResults();
        renderComparison();
        clearSweep(true);
    }

    function renderProject() {
        form.querySelectorAll("[data-meta]").forEach((field) => { field.value = project[field.dataset.meta]; });
        renderActive();
        status("configurationStatus", "");
    }

    function editInputs(inputs, resetRange = false) {
        replaceConfiguration(projects.edit(active(), inputs));
        clearErrors();
        clearSweep(resetRange);
        renderResults();
        renderComparison();
        markDirty();
    }

    function editSegmentList(segments, focusId, focusAction) {
        editInputs({ ...active().inputs, segments });
        renderSegments();
        const target = byId(segmentFieldId(focusId, "name"));
        const action = focusAction && target?.closest("fieldset")?.querySelector('[data-segment-action="' + focusAction + '"]');
        (action && !action.disabled ? action : target || byId("addSegment")).focus();
    }

    form.addEventListener("input", (event) => {
        const field = event.target;
        const { meta, system, segment } = field.dataset;
        if (meta) {
            project[meta] = field.value;
            markDirty();
        } else if (field.id === "configName") {
            replaceConfiguration({ ...active(), name: field.value });
            renderConfigurationOptions();
            renderResults();
            renderComparison();
            markDirty();
        } else if (system && field.tagName !== "SELECT") {
            editInputs({ ...active().inputs, [system]: inputValue(field) });
        } else if (segment) {
            const id = field.closest("fieldset").dataset.segmentId;
            const inputs = active().inputs;
            const segments = inputs.segments.map((row) => row.id === id
                ? { ...row, [segment]: inputValue(field) } : row);
            editInputs({ ...inputs, segments });
        }
    });

    form.addEventListener("change", (event) => {
        const { target } = event;
        if (target.id === "configSelect") {
            project.activeId = target.value;
            renderActive();
            markDirty();
        } else if (target.dataset.unit) {
            const group = target.dataset.unit;
            try {
                const inputs = model.changeUnits(active().inputs, group, target.value);
                if (inputs === active().inputs) return;
                editInputs(inputs, group === "flow");
                renderSystemInputs();
                refreshSegmentValues();
                updateUnitLabels();
            } catch (error) {
                target.value = active().inputs.units[group];
                showErrors([{ message: error.message }]);
            }
        } else if (target.dataset.system && target.tagName === "SELECT") {
            editInputs({ ...active().inputs, [target.dataset.system]: target.value });
            renderSystemInputs();
        }
    });

    byId("addSegment").addEventListener("click", () => {
        const segments = active().inputs.segments;
        if (segments.length >= model.MAX_SEGMENTS) return;
        const segment = projects.newSegment();
        editSegmentList([...segments, segment], segment.id);
    });

    segmentList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-segment-action]");
        if (!button || button.disabled) return;
        const segments = [...active().inputs.segments];
        const id = button.closest("fieldset").dataset.segmentId;
        const index = segments.findIndex((segment) => segment.id === id);
        const action = button.dataset.segmentAction;
        let focusId = id;
        if (action === "remove") {
            segments.splice(index, 1);
            focusId = segments[Math.min(index, segments.length - 1)].id;
        } else if (action === "duplicate") {
            const duplicate = { ...segments[index], id: projects.newSegment().id };
            segments.splice(index + 1, 0, duplicate);
            focusId = duplicate.id;
        } else {
            const destination = index + (action === "up" ? -1 : 1);
            [segments[index], segments[destination]] = [segments[destination], segments[index]];
        }
        editSegmentList(segments, focusId, action === "up" || action === "down" ? action : null);
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearErrors();
        const result = model.calculate(active().inputs);
        replaceConfiguration(projects.solved(active(), result));
        renderResults();
        renderComparison();
        markDirty();
        if (!result.ok) {
            clearSweep();
            showErrors(result.errors);
            return;
        }
        if (!sweep) clearSweep();
        status("configurationStatus", "");
        byId("resultsHeading").focus();
    });

    byId("duplicateConfig").addEventListener("click", () => {
        if (project.configurations.length >= projects.MAX_CONFIGURATIONS) return;
        const configuration = projects.duplicate(active());
        project.configurations = [...project.configurations, configuration];
        project.activeId = configuration.id;
        renderActive();
        markDirty();
        byId("configName").focus();
        byId("configName").select();
        status("configurationStatus", "Copy created. Edit its inputs, then calculate to compare it with the baseline.", "success");
    });

    byId("setBaseline").addEventListener("click", () => {
        project.baselineId = project.activeId;
        renderConfigurationOptions();
        renderComparison();
        markDirty();
        status("configurationStatus", projects.name(active()) + " is now the baseline.", "success");
        byId("duplicateConfig").focus({ preventScroll: true });
    });

    byId("removeConfig").addEventListener("click", () => {
        if (project.activeId === project.baselineId || !window.confirm("Remove " + projects.name(active()) + " from this project?")) return;
        project.configurations = project.configurations.filter(({ id }) => id !== project.activeId);
        project.activeId = project.baselineId;
        renderActive();
        markDirty();
        status("configurationStatus", "Alternative removed. The baseline is in the editor.", "success");
        byId("duplicateConfig").focus();
    });

    const sweepForm = byId("sweepForm");
    sweepForm.addEventListener("input", () => {
        if (sweep) {
            clearSweep();
            status("sweepStatus", "Sweep settings changed. Run the sweep to update the plot.");
        }
    });
    sweepForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!projects.current(active())) return;
        const result = model.runSweep(active().inputs, {
            start: inputValue(byId("sweepStart")), end: inputValue(byId("sweepEnd")), count: inputValue(byId("sweepCount"))
        });
        if (!result.ok) {
            clearSweep();
            status("sweepStatus", result.error, "error");
            return;
        }
        sweep = result;
        renderSweep();
        const failures = sweep.samples.filter(({ errors }) => errors).length;
        const message = failures ? failures + " of " + sweep.samples.length + " samples could not be calculated. See the sample table."
            : sweep.samples.length + " system requirements calculated.";
        status("sweepStatus", message, failures ? "warning" : "success");
    });
    byId("sweepMetric").addEventListener("change", renderSweep);

    byId("addToReport").addEventListener("click", () => {
        const snapshot = views.buildSnapshot(project, {
            includeComparison: byId("includeComparison").checked, sweep, metric: byId("sweepMetric").value
        });
        if (!snapshot) {
            status("reportStatus", "Recalculate the active configuration before adding it to a report.", "error");
            return;
        }
        const result = report.addSnapshot(snapshot);
        if (!result.ok) status("reportStatus", result.error, "error");
        else if (!result.persisted) status("reportStatus", "Browser storage is unavailable. The entry is available only in this page session.", "warning");
        else status("reportStatus", "Analysis added to Project Report.", "success");
    });

    function replaceProject(next, message) {
        project = next;
        renderProject();
        dirty = true;
        status("projectLoadStatus", message);
        status("saveStatus", "Project is open in this page. Save locally or export it to keep it.");
    }

    byId("loadExample").addEventListener("click", () => {
        if ((dirty || initial.project) && !window.confirm("Replace the project in this editor with the worked example?")) return;
        replaceProject(projects.exampleProject(), "Worked example loaded. Calculate the system to check the published result.");
        byId("projectTitle").focus();
    });

    byId("newWorkflow").addEventListener("click", () => {
        if ((dirty || initial.project) && !window.confirm("Start a new project in this editor?")) return;
        replaceProject(projects.newProject(), "New fluid project opened.");
        byId("projectTitle").focus();
    });

    byId("saveWorkflow").addEventListener("click", () => {
        const saved = store.save(project);
        if (saved) dirty = false;
        status("saveStatus", saved ? "Project saved in this browser." : "Browser storage could not save the project. Export a workflow JSON file to keep it.",
            saved ? "success" : "error");
    });

    byId("exportWorkflow").addEventListener("click", () => {
        const link = element("a");
        let url;
        try {
            const file = new Blob([projects.serialize(project) + "\n"], { type: "application/json" });
            const name = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64).replace(/^-|-$/g, "");
            url = URL.createObjectURL(file);
            link.href = url;
            link.download = (name || "fluid-system") + ".workflow.json";
            link.hidden = true;
            doc.body.appendChild(link);
            link.click();
            status("saveStatus", "Workflow JSON download started.", "success");
        } catch {
            status("saveStatus", "The browser could not start the workflow download.", "error");
        } finally {
            link.remove();
            if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    });

    const fileInput = byId("workflowFile");
    byId("importWorkflow").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        fileInput.value = "";
        if (!file) return;
        const request = ++importRequest;
        if (file.size > projects.MAX_FILE_BYTES) {
            status("saveStatus", "The workflow file is too large. The import limit is 256 KiB.", "error");
            return;
        }
        let source;
        try {
            source = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reader.onabort = reject;
                reader.readAsText(file);
            });
        } catch {
            if (request === importRequest) status("saveStatus", "The workflow file could not be read.", "error");
            return;
        }
        if (request !== importRequest) return;
        const parsed = projects.parse(source);
        if (!parsed.ok) {
            status("saveStatus", parsed.error, "error");
            return;
        }
        if (!window.confirm("Replace the project in this editor with the imported workflow?")) {
            status("saveStatus", "Workflow import canceled.");
            return;
        }
        replaceProject(parsed.project, "Workflow file imported.");
        status("saveStatus", "Workflow imported. Save locally to reopen this project after reload.", "success");
    });

    initializeChoices();
    renderProject();
    if (!initial.ok) status("projectLoadStatus", initial.error, "error");
    else if (initial.project) status("projectLoadStatus", "Opened the project saved in this browser.");
})();
