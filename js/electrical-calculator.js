(function () {
    "use strict";

    const host = document.querySelector("[data-electrical]");
    const model = electricalModels[host.dataset.electrical];
    const byId = (id) => document.getElementById(id);
    const form = byId("electricalForm");
    const resultPanel = byId("result");
    const status = byId("electricalStatus");
    const steps = byId("electricalSteps");
    const stepList = steps.querySelector("ol");
    const fieldHost = byId("electricalInputs");
    const componentHost = byId("electricalComponents");
    const componentActions = byId("electricalComponentActions");
    const report = window.FormulaFoundryReport;
    const diagrams = window.FormulaFoundryCalculatorDiagrams;
    const fields = new Map();
    const components = new Map();
    const unitControls = new Map();
    const units = Object.fromEntries(Object.entries(model.groups).map(([id, group]) => [id, group.default]));
    const format = (value) => String(Number(value.toPrecision(7)));

    function append(parent, tag, content, className) {
        const element = document.createElement(tag);
        if (content !== undefined) element.textContent = content;
        if (className) element.className = className;
        parent.appendChild(element);
        return element;
    }

    function select(parent, id, options, selected, labels) {
        const control = append(parent, "select");
        control.id = id;
        for (const value of options) {
            const option = append(control, "option", labels?.[value] ?? value);
            option.value = value;
            option.defaultSelected = value === selected;
        }
        return control;
    }

    function values() {
        const inputs = {};
        for (const [id, { definition, control }] of fields) {
            if (control.validity.badInput) inputs[id] = NaN;
            else if (control.value !== "") inputs[id] = definition.options ? control.value : control.valueAsNumber;
        }
        return inputs;
    }

    function updateUnits(groupId, control) {
        const group = model.groups[groupId];
        const before = units[groupId];
        const after = control.value;
        if (before === after) return;
        units[groupId] = after;
        for (const otherControl of unitControls.get(groupId)) otherControl.value = after;
        for (const { definition, control: input } of fields.values()) {
            if (definition.group !== groupId || !Number.isFinite(input.valueAsNumber)) continue;
            const value = group.fromBase(group.toBase(input.valueAsNumber, before), after);
            if (Number.isFinite(value)) input.value = String(value);
        }
    }

    function unitSelect(parent, groupId, fieldId, label) {
        const group = model.groups[groupId];
        const control = select(parent, "units-" + fieldId, group.options, group.default);
        control.setAttribute("aria-label", label + " unit");
        if (!unitControls.has(groupId)) unitControls.set(groupId, []);
        unitControls.get(groupId).push(control);
        control.addEventListener("input", () => updateUnits(groupId, control));
        control.addEventListener("change", () => updateUnits(groupId, control));
        return control;
    }

    function componentContainer(index) {
        if (!components.has(index)) {
            const group = append(componentHost, "div", undefined, "electrical-component");
            group.dataset.component = index;
            components.set(index, group);
        }
        return components.get(index);
    }

    function addField(definition) {
        const parent = definition.component ? componentContainer(definition.component) : fieldHost;
        const row = append(parent, "div", undefined, "electrical-field");
        const id = definition.id;
        append(row, "label", definition.label + (definition.unit ? ` (${definition.unit})` : "")).htmlFor = id;
        let control;
        let unit;
        if (definition.options) {
            control = select(row, id, definition.options, definition.default ?? definition.options[0], definition.optionLabels);
        } else {
            const entry = append(row, "div", undefined, "electrical-entry");
            control = append(entry, "input");
            control.id = id;
            control.type = "number";
            control.step = definition.step ?? "any";
            control.defaultValue = definition.default ?? "";
            const group = model.groups[definition.group];
            if (group?.options.length > 1) {
                unit = unitSelect(entry, definition.group, id, definition.label);
            } else if (group) {
                append(entry, "span", group.default, "electrical-fixed-unit");
            }
        }
        if (definition.help) {
            const help = append(row, "small", definition.help);
            help.id = id + "-help";
            control.setAttribute("aria-describedby", help.id);
        }
        fields.set(id, { definition, row, control, unit });
    }

    function syncFields(inputs) {
        for (const { definition, control } of fields.values()) {
            if (!definition.availableOptions) continue;
            const available = definition.availableOptions(inputs);
            for (const option of control.options) {
                option.disabled = option.hidden = !available.includes(option.value);
            }
            if (!available.includes(control.value)) {
                control.value = available[0] ?? "";
                inputs[definition.id] = control.value;
            }
        }
        const active = new Set(model.activeInputs(inputs).map(({ id }) => id));
        for (const [id, field] of fields) {
            const hidden = !active.has(id);
            field.row.hidden = hidden;
            field.control.disabled = hidden;
            if (field.unit) field.unit.disabled = hidden;
            const invalid = !hidden && (field.control.validity.badInput || (!field.definition.optional && inputs[id] == null));
            if (invalid) field.control.setAttribute("aria-invalid", "true");
            else field.control.removeAttribute("aria-invalid");
        }
        for (const group of components.values()) {
            group.hidden = !Array.from(group.children).some((row) => !row.hidden);
        }
        if (countControl) {
            const index = countControl.selectedIndex;
            componentActions.hidden = countControl.disabled;
            addButton.disabled = index === countControl.options.length - 1;
            removeButton.disabled = index === 0;
        }
    }

    function addOutputUnitControls() {
        const details = byId("electricalOutputUnits");
        const container = details.querySelector("div");
        for (const id of new Set(model.outputs.map(({ group }) => group))) {
            const group = model.groups[id];
            if (!group || group.options.length < 2) continue;
            const related = [...fields.values()].filter((field) => field.definition.group === id);
            if (related.some((field) => !field.definition.active)) continue;
            const row = append(container, "div", undefined, "electrical-field");
            const label = append(row, "label", group.label);
            label.htmlFor = unitSelect(row, id, "output-" + id, group.label).id;
        }
        details.hidden = !container.children.length;
    }

    function showDiagram(figureId, snapshot) {
        const figure = byId(figureId);
        const diagramHost = figure.querySelector("[data-diagram]");
        figure.hidden = !snapshot;
        if (snapshot) {
            diagrams.mount(diagramHost, snapshot.id, snapshot.model);
            figure.querySelector("figcaption").textContent = diagrams.caption(snapshot.id);
        } else {
            diagramHost.replaceChildren();
        }
    }

    function draw(snapshot) {
        showDiagram("electricalDiagram", snapshot);
        showDiagram("electricalPlot", snapshot?.companion);
    }

    function showTable(detail) {
        const wrapper = append(resultPanel, "div", undefined, "electrical-table-scroll");
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", detail.caption);
        const table = append(wrapper, "table");
        append(table, "caption", detail.caption);
        const header = append(append(table, "thead"), "tr");
        for (const title of detail.headers) append(header, "th", title).scope = "col";
        const body = append(table, "tbody");
        for (const cells of detail.rows) {
            const row = append(body, "tr");
            append(row, "th", cells[0]).scope = "row";
            for (const cell of cells.slice(1)) append(row, "td", cell);
        }
    }

    function update() {
        const inputs = values();
        syncFields(inputs);
        report.clearResult();
        let solved;
        try {
            solved = model.calculate(inputs, units);
        } catch (error) {
            resultPanel.replaceChildren();
            append(resultPanel, "h3", "Check inputs");
            append(resultPanel, "p", error.message, "electrical-problem");
            steps.hidden = true;
            stepList.replaceChildren();
            status.textContent = error.message;
            try {
                draw(model.diagram(inputs, units));
            } catch {
                draw(null);
            }
            return;
        }

        const si = model.toSI(inputs, units);
        const diagram = model.diagram(inputs, units, solved);
        const detail = model.detailRows?.(solved.raw);
        const warnings = [...new Set([...(model.warnings || []), ...(model.warningsFor?.(inputs, units, solved) || [])])];
        const outputs = model.outputs.flatMap((item) => {
            if (Number.isFinite(solved[item.id])) {
                return [{ label: item.label, value: solved[item.id], unit: item.group ? units[item.group] : (item.unit || "") }];
            }
            const text = model.outputText?.(item, solved.raw);
            return text ? [{ label: item.label, value: text, unit: "" }] : [];
        });
        const reportInputs = model.activeInputs(inputs).filter((item) => inputs[item.id] != null).map((item) => ({
            label: item.label, value: item.optionLabels?.[inputs[item.id]] ?? inputs[item.id],
            unit: item.group ? units[item.group] : (item.unit || "")
        }));

        draw(diagram);
        resultPanel.replaceChildren();
        append(resultPanel, "h3", "Results");
        const list = append(resultPanel, "dl", undefined, "electrical-result-items");
        const formatted = (item) => [typeof item.value === "number" ? format(item.value) : item.value, item.unit].filter(Boolean).join(" ");
        for (const item of outputs) {
            const row = append(list, "div");
            append(row, "dt", item.label);
            append(row, "dd", formatted(item), "result-value");
        }
        if (warnings.length) {
            const messages = append(resultPanel, "ul", undefined, "electrical-warnings");
            for (const warning of warnings) append(messages, "li", warning);
        }
        if (detail?.rows.length) showTable(detail);

        const walkthrough = model.solutionSteps?.(si, solved.raw) || [];
        stepList.replaceChildren();
        for (const step of walkthrough) append(stepList, "li", step);
        steps.hidden = walkthrough.length === 0;
        status.textContent = outputs.length ? `${outputs[0].label} ${formatted(outputs[0])}` : "Results updated.";

        report.recordResult({
            calculatorId: model.id, calculatorName: model.name, title: model.name, path: model.path,
            inputs: reportInputs, outputs, assumptions: model.assumptions, warnings, method: model.method,
            equations: model.equationsFor?.(inputs) || model.equations, diagram,
            tables: detail?.rows.length ? [{ caption: detail.caption, columns: detail.headers, rows: detail.rows }] : []
        });
    }

    for (const definition of model.inputs) addField(definition);
    addOutputUnitControls();
    const countControl = fields.get("count")?.control;
    let addButton;
    let removeButton;
    if (countControl) {
        const noun = { "circuit-studio": "resistor", "electrical-divider": "resistor", "speaker-impedance": "speaker" }[model.id];
        addButton = append(componentActions, "button", "Add " + noun, "secondary-button");
        removeButton = append(componentActions, "button", "Remove last " + noun, "secondary-button");
        addButton.type = removeButton.type = "button";
        addButton.addEventListener("click", () => {
            countControl.selectedIndex += 1;
            update();
            components.get(Number(countControl.value))?.querySelector("input:not(:disabled), select:not(:disabled)")?.focus();
        });
        removeButton.addEventListener("click", () => {
            countControl.selectedIndex -= 1;
            update();
            if (removeButton.disabled) countControl.focus();
        });
    }

    byId("electricalMethod").textContent = model.method;
    for (const equation of model.equations) append(byId("electricalEquations"), "div", "\\[" + equation + "\\]", "formula-box");
    for (const assumption of [...model.assumptions, ...(model.warnings || [])]) append(byId("electricalAssumptions"), "li", assumption);

    report.declareStructured();
    form.addEventListener("input", update);
    form.addEventListener("change", (event) => {
        if (event.target.tagName === "SELECT") update();
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        update();
    });
    form.addEventListener("reset", () => {
        queueMicrotask(() => {
            for (const [id, group] of Object.entries(model.groups)) units[id] = group.default;
            update();
        });
    });
    update();
    window.FormulaFoundryRenderMath?.();
})();
