(function () {
    "use strict";

    const host = document.querySelector("[data-expansion]");
    const adapter = expansionModels[host.dataset.expansion];
    const byId = (id) => document.getElementById(id);
    const form = byId("expansionForm");
    const resultPanel = byId("result");
    const transferAction = byId("expansionTransfer");
    const transferContext = byId("transferContext");
    const report = window.FormulaFoundryReport;
    const diagramHost = host.querySelector("[data-diagram]");
    const units = {};
    const fields = {};
    let transfer = null;
    const format = (value) => String(Number(value.toPrecision(7)));

    function append(parent, tag, content, className) {
        const element = document.createElement(tag);
        if (content !== undefined) element.textContent = content;
        if (className) element.className = className;
        parent.appendChild(element);
        return element;
    }

    function select(row, id, options, selected) {
        const element = append(row, "select", undefined, "output-select");
        element.id = id;
        for (const value of options) {
            const option = append(element, "option", value);
            option.value = value;
            option.defaultSelected = value === selected;
        }
        return element;
    }

    function values() {
        const data = {};
        for (const definition of adapter.inputs) {
            const field = fields[definition.id];
            if (field.validity.badInput) data[definition.id] = NaN;
            else if (field.value !== "") data[definition.id] = definition.options ? field.value : field.valueAsNumber;
        }
        return data;
    }

    function draw(inputs, outputs) {
        const diagram = window.FormulaFoundryExpansionDiagram(adapter.id, inputs, outputs);
        window.FormulaFoundryCalculatorDiagrams.mount(diagramHost, diagram.id, diagram.model);
        return diagram;
    }

    function refresh() {
        const inputs = values();
        const active = new Set(adapter.activeInputs(inputs).map((definition) => definition.id));
        for (const [id, field] of Object.entries(fields)) {
            field.parentElement.hidden = !active.has(id);
            field.disabled = !active.has(id);
        }
        for (const definition of adapter.inputs) {
            if (definition.group) {
                const unit = units[definition.group];
                fields[definition.id].labels[0].textContent = definition.label + " (" + unit + ")";
            }
        }
        draw(inputs);
    }

    function stale() {
        if (resultPanel.dataset.calculated) {
            resultPanel.textContent = "Inputs changed. Calculate again to update the result.";
            delete resultPanel.dataset.calculated;
        }
        transferAction.replaceChildren();
        report.clearResult();
    }

    function transferSummary(inputs) {
        if (!transfer) return "";
        const active = adapter.activeInputs(inputs);
        const items = Object.entries(transfer.values).map(([id, original]) => {
            const field = active.find((item) => item.id === id);
            const def = adapter.inputs.find((item) => item.id === id);
            const group = adapter.groups[def.group];
            const unit = units[def.group];
            const current = field && inputs[id] != null ? group.toBase(inputs[id], unit) : NaN;
            const same = Math.abs(current - original) <= Math.abs(original) * 1e-12;
            return def.label + " " + format(group.fromBase(original, unit)) + " " + unit
                + (same ? "" : " (overridden)");
        });
        const source = calculators.find((item) => item.id === transfer.source);
        return "From " + source.name + " (Re " + format(transfer.reynolds) + "). "
            + items.join(". ") + ". " + transfer.context;
    }

    append(byId("calculationMethod"), "span", adapter.method);
    for (const equation of adapter.equations) append(byId("expansionEquations"), "div", "\\[" + equation + "\\]", "formula-box");
    for (const assumption of [...adapter.assumptions, ...(adapter.warnings || [])]) append(byId("expansionAssumptions"), "li", assumption);

    for (const definition of adapter.inputs) {
        const row = append(byId("expansionInputs"), "div", undefined, "expansion-field");
        append(row, "label", definition.label + (definition.unit ? " (" + definition.unit + ")" : "")).htmlFor = definition.id;
        if (definition.options) {
            fields[definition.id] = select(row, definition.id, definition.options, definition.options[0]);
        } else {
            const element = append(row, "input");
            element.id = definition.id;
            element.type = "number";
            element.step = definition.id === "count" ? "1" : "any";
            fields[definition.id] = element;
        }
    }

    for (const [key, group] of Object.entries(adapter.groups)) {
        units[key] = group.default;
        if (group.options.length === 1) continue;
        const row = append(byId("expansionUnits"), "div", undefined, "expansion-field");
        append(row, "label", group.label).htmlFor = "units-" + key;
        const control = select(row, "units-" + key, group.options, group.default);
        control.addEventListener("input", () => {
            const before = units[key];
            units[key] = control.value;
            for (const definition of adapter.inputs) {
                if (definition.group !== key) continue;
                const element = fields[definition.id];
                if (element.value === "") continue;
                const converted = group.fromBase(group.toBase(element.valueAsNumber, before), control.value);
                element.value = Number.isFinite(converted) ? String(converted) : "";
            }
        });
    }

    function receive() {
        transfer = FluidSystemTransfer.receive(adapter.id);
        if (!transfer) return;
        if (fields.viscosityMode) fields.viscosityMode.value = "dynamicViscosity" in transfer.values ? "Dynamic" : "Kinematic";
        for (const [id, value] of Object.entries(transfer.values)) {
            const def = adapter.inputs.find((definition) => definition.id === id);
            fields[id].value = String(adapter.groups[def.group].fromBase(value, units[def.group]));
        }
        transferContext.hidden = false;
        transferContext.textContent = transferSummary(values());
    }

    function offerTransfer(inputs, outputs) {
        const route = FluidSystemTransfer.routes[adapter.id];
        if (!route) return;
        const button = append(transferAction, "button", route.label);
        button.type = "button";
        button.addEventListener("click", () => {
            try {
                const quantities = adapter.toSI(inputs, units);
                if (adapter.id === "pipe-flow") quantities.flow = adapter.groups.flow.toBase(outputs.flow, units.flow);
                else quantities.pressure = adapter.groups.pressure.toBase(outputs.total, units.pressure);
                FluidSystemTransfer.send(adapter.id, quantities, outputs.reynolds);
                window.location.assign(route.to + ".html");
            } catch {
                transferAction.replaceChildren();
                append(transferAction, "p", "Tab storage is unavailable. Enter the values manually on the linked calculator.");
            }
        });
    }

    report.declareStructured();
    form.addEventListener("input", () => {
        stale();
        refresh();
        if (transfer) transferContext.textContent = transferSummary(values());
    });
    form.addEventListener("reset", () => {
        queueMicrotask(() => {
            for (const [id, group] of Object.entries(adapter.groups)) units[id] = group.default;
            transfer = null;
            transferContext.hidden = true;
            stale();
            refresh();
            resultPanel.textContent = "Ready to calculate.";
        });
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        stale();
        const inputs = values();
        try {
            const result = adapter.calculate(inputs, units);
            const warnings = [...(adapter.warnings || []), ...(adapter.warningsFor ? adapter.warningsFor(inputs, result) : [])];
            const outputs = adapter.outputs.filter((def) => Number.isFinite(result[def.id])).map((def) => ({
                label: def.label, value: result[def.id], unit: units[def.group]
            }));
            const reportInputs = adapter.activeInputs(inputs).filter((def) => inputs[def.id] != null).map((def) => ({
                label: def.label, value: inputs[def.id], unit: def.group ? units[def.group] : (def.unit || "")
            }));
            resultPanel.replaceChildren();
            append(resultPanel, "h3", "Results");
            const list = append(resultPanel, "dl");
            for (const item of outputs) {
                append(list, "dt", item.label);
                append(list, "dd", [format(item.value), item.unit].filter(Boolean).join(" "), "result-value");
            }
            if (warnings.length) {
                const messages = append(resultPanel, "ul");
                for (const warning of warnings) append(messages, "li", warning);
            }
            resultPanel.dataset.calculated = "true";
            const provenance = transferSummary(inputs);
            report.recordResult({
                calculatorId: adapter.id, calculatorName: adapter.name, title: adapter.name, path: adapter.path,
                inputs: reportInputs, outputs, equations: adapter.equations, method: adapter.method,
                assumptions: adapter.assumptions, warnings: provenance ? [...warnings, provenance] : warnings,
                diagram: draw(inputs, result)
            });
            offerTransfer(inputs, result);
        } catch (error) {
            resultPanel.replaceChildren();
            append(resultPanel, "h3", "Check inputs");
            append(resultPanel, "p", error.message);
        }
    });

    receive();
    refresh();
    window.FormulaFoundryRenderMath?.();
})();
