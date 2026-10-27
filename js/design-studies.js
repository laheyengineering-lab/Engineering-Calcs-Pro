// ======================================================
// Formula Foundry - Design Studies workspace (UI)
// All user-supplied text is inserted with textContent (never as HTML).
// Calculation, comparison and sweep logic lives in design-study-core.js
// and the calculators' own functions (via design-study-adapters.js).
// ======================================================
(function () {
    "use strict";

    const S = window.FormulaFoundryStudies;
    const doc = document;
    const store = S.createStudyStore();

    let studies = [];
    let currentId = null;
    let draftSweep = null;
    let sweepForm = { baselineId: null, inputId: "", start: "", end: "", mode: "count", step: "", count: "11", outputId: "" };

    const $ = (id) => doc.getElementById(id);

    function el(tag, className, content) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined && content !== null) node.textContent = content;
        return node;
    }

    function button(label, handler, className) {
        const b = el("button", className || "secondary-button", label);
        b.type = "button";
        b.addEventListener("click", handler);
        return b;
    }

    function status(message, isError) {
        const node = $("studyStatus");
        node.textContent = message || "";
        node.classList.toggle("is-error", Boolean(isError));
    }

    function current() { return studies.find((s) => s.id === currentId) || null; }
    function adapterOf(study) { return S.getAdapter(study.calculatorId); }

    function persist() {
        const ok = store.save(studies);
        status(ok ? "Saved in this browser." : "Could not write to browser storage; changes are kept for this session only.", !ok);
    }

    function update(study) {
        studies = studies.map((s) => (s.id === study.id ? study : s));
    }

    // ---------- Study selection ----------

    function renderStudySelect() {
        const select = $("studySelect");
        select.textContent = "";
        const placeholder = el("option", null, studies.length ? "-- Select a study --" : "No saved studies");
        placeholder.value = "";
        select.appendChild(placeholder);
        studies.forEach((s) => {
            const o = el("option", null, s.name + " (" + adapterOf(s).name + ")");
            o.value = s.id;
            select.appendChild(o);
        });
        select.value = currentId || "";
    }

    function openStudy(id) {
        currentId = id || null;
        draftSweep = null;
        const study = current();
        sweepForm = { baselineId: study ? study.baselineId : null, inputId: "", start: "", end: "", mode: "count", step: "", count: "11", outputId: "" };
        renderAll();
    }

    function renderAll() {
        renderStudySelect();
        const study = current();
        $("studyWorkspace").hidden = !study;
        if (!study) return;
        renderScenarios();
        renderComparison();
        renderSweepForm();
        renderSweepResult();
        renderSavedSweeps();
    }

    // ---------- Scenarios ----------

    function statusLabel(scenario) {
        return { new: "Not calculated", calculated: "Calculated", stale: "Inputs edited: recalculate", error: "Error" }[scenario.status];
    }

    function renderScenarios() {
        const study = current();
        const adapter = adapterOf(study);
        const list = $("scenarioList");
        list.textContent = "";
        if (!study.scenarios.length) {
            list.appendChild(el("p", null, "No scenarios yet. Add a baseline scenario to begin."));
            return;
        }
        study.scenarios.forEach((scenario) => list.appendChild(buildScenarioCard(study, adapter, scenario)));
    }

    function buildScenarioCard(study, adapter, scenario) {
        const isBaseline = study.baselineId === scenario.id;
        const card = el("article", "scenario-card" + (isBaseline ? " is-baseline" : ""));
        card.dataset.scenarioId = scenario.id;

        const head = el("div", "scenario-head");
        const nameLabel = el("label", "scenario-name", "Scenario name");
        const name = el("input");
        name.type = "text";
        name.maxLength = 100;
        name.value = scenario.name;
        name.addEventListener("change", () => {
            mutateScenario(scenario.id, (s) => S.renameScenario(s, name.value));
            renderComparison(); renderSweepForm(); renderSavedSweeps();
        });
        nameLabel.appendChild(name);
        head.appendChild(nameLabel);
        const radioLabel = el("label", "baseline-choice");
        const radio = el("input");
        radio.type = "radio";
        radio.name = "baseline";
        radio.checked = isBaseline;
        radio.addEventListener("change", () => {
            update(S.setBaseline(current(), scenario.id));
            sweepForm.baselineId = scenario.id;
            persist();
            renderScenarios(); renderComparison(); renderSweepForm();
        });
        radioLabel.appendChild(radio);
        radioLabel.appendChild(doc.createTextNode(" Baseline"));
        head.appendChild(radioLabel);
        const badge = el("span", "status-badge is-" + scenario.status, statusLabel(scenario));
        badge.dataset.role = "status";
        head.appendChild(badge);
        card.appendChild(head);

        // Units
        const unitRow = el("div", "unit-row");
        Object.keys(adapter.groups).forEach((key) => {
            const group = adapter.groups[key];
            const label = el("label", null, group.label.charAt(0).toUpperCase() + group.label.slice(1) + " unit");
            const select = el("select", "output-select");
            group.options.forEach((u) => { const o = el("option", null, u); o.value = u; select.appendChild(o); });
            select.value = scenario.units[key];
            select.addEventListener("change", () => {
                mutateScenario(scenario.id, (s) => S.setScenarioUnit(adapter, s, key, select.value));
                refreshCardStatus(card, scenario.id);
            });
            label.appendChild(select);
            unitRow.appendChild(label);
        });
        card.appendChild(unitRow);
        card.appendChild(el("p", "unit-note", "Changing a unit keeps the numbers you typed and re-labels them in the new unit; recalculate to update the saved results."));

        // Inputs, grouped by section when the adapter defines sections
        const sections = [];
        adapter.inputs.forEach((input) => {
            const key = input.section || "";
            let group = sections.find((g) => g.key === key);
            if (!group) { group = { key, inputs: [] }; sections.push(group); }
            group.inputs.push(input);
        });
        sections.forEach((group) => {
            const grid = el("div", "scenario-inputs");
            group.inputs.forEach((input) => grid.appendChild(buildInputField(adapter, scenario, input, card)));
            if (group.key) {
                const details = el("details");
                details.open = group.inputs.some((i) => !i.optional || scenario.inputs[i.id] !== null);
                details.appendChild(el("summary", null, group.key + (group.inputs[0].optional ? " (optional)" : " (required)")));
                details.appendChild(grid);
                card.appendChild(details);
            } else {
                card.appendChild(grid);
            }
        });

        const results = el("div", "scenario-results");
        results.dataset.role = "results";
        card.appendChild(results);

        const actions = el("div", "button-row");
        actions.appendChild(button("Recalculate", () => {
            mutateScenario(scenario.id, (s) => S.calculateScenario(adapter, s));
            refreshCardStatus(card, scenario.id);
        }, "primary-button"));
        actions.appendChild(button("Duplicate", () => {
            const copy = S.duplicateScenario(find(scenario.id));
            try { update(S.addScenario(current(), copy)); } catch (error) { status(error.message, true); return; }
            persist(); renderScenarios(); renderComparison(); renderSweepForm();
        }));
        actions.appendChild(button("Remove", () => {
            if (!window.confirm("Remove scenario \"" + find(scenario.id).name + "\"? This cannot be undone.")) return;
            update(S.removeScenario(current(), scenario.id));
            if (sweepForm.baselineId === scenario.id) sweepForm.baselineId = current().baselineId;
            persist(); renderScenarios(); renderComparison(); renderSweepForm(); renderSavedSweeps();
        }));
        actions.appendChild(button("Add to project report", () => {
            const result = S.scenarioReportSnapshot(current(), find(scenario.id));
            addToReport(result);
        }));
        card.appendChild(actions);
        paintCard(card, scenario.id);
        return card;
    }

    function buildInputField(adapter, scenario, input, card) {
        const label = el("label", null, input.label + (input.optional ? " (optional)" : ""));
        const row = el("div", "input-row");
        const field = el(input.options ? "select" : "input", input.options ? "output-select" : null);
        field.dataset.inputId = input.id;
        if (input.options) {
            const placeholder = el("option", null, "-- Select --");
            placeholder.value = "";
            field.appendChild(placeholder);
            input.options.forEach((value) => {
                const option = el("option", null, input.optionLabels && input.optionLabels[value] || value);
                option.value = value;
                field.appendChild(option);
            });
            field.value = scenario.inputs[input.id] || "";
        } else {
            field.type = "number";
            field.step = "any";
            field.value = scenario.inputs[input.id] === null ? "" : String(scenario.inputs[input.id]);
        }
        field.addEventListener("change", () => {
            const raw = field.value.trim();
            const value = input.options ? (raw || null) : (raw === "" ? null : Number(raw));
            if (!input.options && value !== null && !Number.isFinite(value)) { status("Enter a valid number for " + input.label + ".", true); return; }
            mutateScenario(scenario.id, (s) => {
                let next = S.setScenarioInput(adapter, s, input.id, value);
                const materialBinding = value && (adapter.materialBindings || []).find((binding) => binding.selectionId === input.id);
                if (materialBinding) {
                    materialBinding.inputs.forEach((binding) => {
                        const materialValue = getMaterialProperty(value, binding.property);
                        if (!Number.isFinite(materialValue)) return;
                        const target = adapter.inputs.find((item) => item.id === binding.id);
                        const displayedValue = target && target.group
                            ? adapter.groups[target.group].fromBase(materialValue, next.units[target.group])
                            : materialValue;
                        if (Number.isFinite(displayedValue)) {
                            next = S.setScenarioInput(adapter, next, binding.id, displayedValue);
                            const targetField = Array.from(card.querySelectorAll("[data-input-id]"))
                                .find((element) => element.dataset.inputId === binding.id);
                            if (targetField) targetField.value = String(displayedValue);
                        }
                    });
                }
                return next;
            });
            refreshCardStatus(card, scenario.id);
        });
        row.appendChild(field);
        if (!input.options) {
            const unit = el("span", "input-unit", S.unitOfInput(adapter, input, scenario.units));
            unit.dataset.inputUnit = input.id;
            row.appendChild(unit);
        }
        label.appendChild(row);
        return label;
    }

    function find(id) { return current().scenarios.find((s) => s.id === id); }

    function mutateScenario(id, fn) {
        const study = current();
        update(S.replaceScenario(study, fn(find(id))));
        persist();
    }

    // Updates the badge, unit labels and saved-result summary without rebuilding the form (keeps focus).
    function refreshCardStatus(card, id) {
        paintCard(card, id);
        renderComparison();
        renderSweepForm();
    }

    function paintCard(card, id) {
        const scenario = find(id);
        const adapter = adapterOf(current());
        const badge = card.querySelector('[data-role="status"]');
        badge.className = "status-badge is-" + scenario.status;
        badge.textContent = statusLabel(scenario);
        adapter.inputs.forEach((input) => {
            const unit = card.querySelector('[data-input-unit="' + input.id + '"]');
            if (unit) unit.textContent = S.unitOfInput(adapter, input, scenario.units);
        });
        const results = card.querySelector('[data-role="results"]');
        results.textContent = "";
        if (scenario.status === "error") results.appendChild(el("p", "scenario-error", "Calculation failed: " + scenario.error));
        if (scenario.status === "stale") results.appendChild(el("p", "scenario-error", "Inputs or units were edited after the last calculation. The results below are the previously saved snapshot; press Recalculate to update them."));
        if (scenario.result) {
            const wrap = el("div", "table-scroll");
            const table = el("table", "study-table");
            table.appendChild(el("caption", null, "Saved results (calculated " + new Date(scenario.result.calculatedAt).toLocaleString() + ")"));
            const head = el("tr");
            ["Output", "Value", "Unit"].forEach((h) => head.appendChild(el("th", null, h)));
            table.appendChild(el("thead")).appendChild(head);
            const body = el("tbody");
            scenario.result.outputs.forEach((o) => {
                const row = el("tr");
                row.appendChild(el("td", null, o.label));
                row.appendChild(el("td", "num", S.formatValue(o.value)));
                row.appendChild(el("td", null, o.unit));
                body.appendChild(row);
            });
            table.appendChild(body);
            wrap.appendChild(table);
            results.appendChild(wrap);
        }
    }

    // ---------- Comparison ----------

    function cellContent(cell, td) {
        if (cell.missing) { td.textContent = "not available"; return; }
        td.className = "num" + (cell.changed ? " is-changed" : "");
        td.appendChild(doc.createTextNode(S.formatValue(cell.value) + (cell.unit ? " " + cell.unit : "")));
        if (cell.isBaseline) return;
        const diff = el("span", "diff");
        if (cell.delta === null) {
            diff.textContent = cell.note || "";
        } else if (!cell.changed) {
            diff.textContent = "no change";
        } else {
            const sign = cell.delta > 0 ? "+" : "";
            let line = "\u0394 " + sign + S.formatValue(cell.delta) + " " + cell.deltaUnit;
            line += cell.percent && cell.percent.value !== null
                ? " (" + (cell.percent.value > 0 ? "+" : "") + S.formatValue(cell.percent.value) + " %)"
                : " (" + (cell.percent ? cell.percent.reason : "") + ")";
            diff.textContent = line;
        }
        if (diff.textContent) td.appendChild(diff);
    }

    function comparisonTable(caption, rows, comparison) {
        const wrap = el("div", "table-scroll");
        const table = el("table", "study-table");
        table.appendChild(el("caption", null, caption));
        const head = el("tr");
        head.appendChild(el("th", null, "Quantity"));
        comparison.scenarios.forEach((s, i) => head.appendChild(el("th", null, s.name + (i === 0 ? " (baseline)" : ""))));
        table.appendChild(el("thead")).appendChild(head);
        const body = el("tbody");
        rows.forEach((row) => {
            const tr = el("tr");
            tr.appendChild(el("th", null, row.label));
            row.cells.forEach((cell) => { const td = el("td"); cellContent(cell, td); tr.appendChild(td); });
            body.appendChild(tr);
        });
        table.appendChild(body);
        wrap.appendChild(table);
        return wrap;
    }

    function renderComparison() {
        const study = current();
        const host = $("comparison");
        host.textContent = "";
        if (!study) return;
        const ready = study.scenarios.filter((s) => s.status === "calculated");
        const notReady = study.scenarios.filter((s) => s.status !== "calculated");
        host.appendChild(el("p", null, "Compares the saved, calculated snapshots of this study's scenarios against the selected baseline. Highlighted cells (\u0394) differ from the baseline; a difference is not an indication of better or worse."));
        if (notReady.length) host.appendChild(el("p", "scenario-error", "Not included (recalculate first): " + notReady.map((s) => s.name).join(", ")));
        if (ready.length < 2) { host.appendChild(el("p", null, "Calculate at least two scenarios to compare them.")); return; }
        const baselineId = ready.some((s) => s.id === study.baselineId) ? study.baselineId : ready[0].id;
        if (baselineId !== study.baselineId) host.appendChild(el("p", "scenario-error", "The selected baseline is not calculated; \"" + ready[0].name + "\" is used for this comparison until you recalculate the baseline."));
        const cmp = S.compareScenarios(ready, baselineId);
        if (!cmp.ok) { host.appendChild(el("p", "scenario-error", cmp.error)); return; }
        host.appendChild(comparisonTable("Inputs", cmp.inputRows, cmp));
        host.appendChild(comparisonTable("Outputs", cmp.outputRows, cmp));
        const notes = el("div");
        notes.appendChild(el("h3", null, "Configuration and assumption differences"));
        const ul = el("ul");
        cmp.notes.forEach((n) => ul.appendChild(el("li", null, n)));
        notes.appendChild(ul);
        host.appendChild(notes);
        const actions = el("div", "button-row");
        actions.appendChild(button("Add comparison to project report", () => addToReport(S.comparisonReportSnapshot(study, ready, baselineId))));
        host.appendChild(actions);
    }

    // ---------- Sweep ----------

    function renderSweepForm() {
        const study = current();
        const host = $("sweepForm");
        host.textContent = "";
        $("sweepLimit").textContent = String(S.MAX_SWEEP_SAMPLES);
        if (!study) return;
        const adapter = adapterOf(study);
        const calculated = study.scenarios.filter((s) => s.status === "calculated");
        if (!calculated.length) {
            host.appendChild(el("p", null, "Calculate a baseline scenario to enable sweeps."));
            return;
        }
        if (!calculated.some((s) => s.id === sweepForm.baselineId)) sweepForm.baselineId = (calculated.find((s) => s.id === study.baselineId) || calculated[0]).id;
        const base = calculated.find((s) => s.id === sweepForm.baselineId);

        const field = (labelText, control) => {
            const label = el("label", null, labelText);
            label.appendChild(control);
            host.appendChild(label);
            return control;
        };
        const select = (options, value, key, rerender) => {
            const s = el("select", "output-select");
            options.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; s.appendChild(o); });
            s.value = value;
            s.addEventListener("change", () => { sweepForm[key] = s.value; if (rerender) renderSweepForm(); });
            return s;
        };
        const number = (key) => {
            const i = el("input");
            i.type = "number";
            i.step = "any";
            i.value = sweepForm[key];
            i.addEventListener("input", () => { sweepForm[key] = i.value; });
            return i;
        };

        field("Baseline scenario", select(calculated.map((s) => [s.id, s.name]), sweepForm.baselineId, "baselineId", true));
        const inputs = adapter.inputs.filter((i) => i.sweepable && base.result.inputs.some((r) => r.id === i.id && r.value !== null));
        if (!inputs.some((i) => i.id === sweepForm.inputId)) sweepForm.inputId = inputs[0].id;
        const outputs = adapter.outputs.filter((o) => o.plottable !== false && (!o.optional || base.result.outputs.some((r) => r.id === o.id)));
        if (!outputs.some((o) => o.id === sweepForm.outputId)) sweepForm.outputId = outputs[0].id;
        const inputDef = inputs.find((i) => i.id === sweepForm.inputId);
        field("Input to vary", select(inputs.map((i) => [i.id, i.label]), sweepForm.inputId, "inputId", true));
        const unit = S.unitOfInput(adapter, inputDef, base.units);
        field("Start value [" + unit + "]", number("start"));
        field("End value [" + unit + "]", number("end"));
        field("Sample spacing", select([["count", "Number of samples"], ["step", "Step size"]], sweepForm.mode, "mode", true));
        field(sweepForm.mode === "count" ? "Number of samples (2\u2013" + S.MAX_SWEEP_SAMPLES + ")" : "Step size [" + unit + "]", number(sweepForm.mode === "count" ? "count" : "step"));
        field("Output to track", select(outputs.map((o) => [o.id, o.label + " [" + base.units[o.group] + "]"]), sweepForm.outputId, "outputId", false));
        const actions = el("div", "button-row");
        actions.appendChild(button("Run sweep", runSweep, "primary-button"));
        host.appendChild(actions);
    }

    function runSweep() {
        const study = current();
        const adapter = adapterOf(study);
        const base = study.scenarios.find((s) => s.id === sweepForm.baselineId);
        const errors = $("sweepErrors");
        errors.textContent = "";
        const parse = (v) => (String(v).trim() === "" ? NaN : Number(v));
        const result = S.runSweep(adapter, base, {
            inputId: sweepForm.inputId, outputId: sweepForm.outputId,
            start: parse(sweepForm.start), end: parse(sweepForm.end),
            mode: sweepForm.mode, step: parse(sweepForm.step), count: parse(sweepForm.count)
        });
        if (!result.ok) {
            draftSweep = null;
            const ul = el("ul");
            result.errors.forEach((e) => ul.appendChild(el("li", null, e)));
            errors.appendChild(ul);
            renderSweepResult();
            return;
        }
        draftSweep = result.sweep;
        renderSweepResult();
    }

    function sweepTable(sweep) {
        const wrap = el("div", "table-scroll");
        const table = el("table", "study-table");
        table.appendChild(el("caption", null, "Sweep data (" + sweep.points.length + " samples" + (sweep.failedCount ? ", " + sweep.failedCount + " failed" : "") + ")"));
        const head = el("tr");
        [sweep.input.label + " [" + sweep.input.unit + "]", sweep.output.label + " [" + sweep.output.unit + "]", "Status"].forEach((h) => head.appendChild(el("th", null, h)));
        table.appendChild(el("thead")).appendChild(head);
        const body = el("tbody");
        sweep.points.forEach((p) => {
            const row = el("tr");
            row.appendChild(el("td", "num", S.formatValue(p.x)));
            row.appendChild(el("td", p.y === null ? "num is-failed" : "num", p.y === null ? "failed" : S.formatValue(p.y)));
            row.appendChild(el("td", p.y === null ? "is-failed" : null, p.y === null ? p.error : "OK"));
            body.appendChild(row);
        });
        table.appendChild(body);
        wrap.appendChild(table);
        return wrap;
    }

    function sweepView(sweep, host) {
        host.appendChild(el("p", null, "Baseline scenario: " + (sweep.baselineScenarioName || "(removed)") + ". All other inputs are held at the baseline values."));
        const layout = el("div", "sweep-layout");
        layout.appendChild(window.FormulaFoundryChart.createLineChart(doc, S.sweepChart(sweep)));
        layout.appendChild(sweepTable(sweep));
        host.appendChild(layout);
        host.appendChild(el("p", null, S.SWEEP_NOTE));
        if (sweep.failedCount) host.appendChild(el("p", "scenario-error", sweep.failedCount + " sample(s) could not be calculated and are shown as gaps in the chart; no values were interpolated."));
    }

    function renderSweepResult() {
        const host = $("sweepResult");
        host.textContent = "";
        if (!draftSweep) return;
        sweepView(draftSweep, host);
        const actions = el("div", "button-row sweep-actions");
        actions.appendChild(button("Save sweep to study", () => {
            try { update(S.addSweep(current(), draftSweep)); } catch (error) { status(error.message, true); return; }
            persist();
            draftSweep = null;
            $("sweepErrors").textContent = "";
            renderSweepResult(); renderSavedSweeps();
        }));
        actions.appendChild(button("Add sweep to project report", () => addToReport(S.sweepReportSnapshot(current(), draftSweep))));
        host.appendChild(actions);
    }

    function renderSavedSweeps() {
        const study = current();
        const host = $("savedSweeps");
        host.textContent = "";
        if (!study) return;
        if (!study.sweeps.length) { host.appendChild(el("p", null, "No saved sweeps.")); return; }
        study.sweeps.forEach((sweep) => {
            const row = el("div", "saved-sweep");
            row.appendChild(el("span", null, sweep.name + " \u00b7 baseline: " + (sweep.baselineScenarioName || "(removed)") + " \u00b7 " + sweep.points.length + " samples"));
            const actions = el("div", "button-row");
            actions.appendChild(button("View", () => { draftSweep = null; $("sweepResult").textContent = ""; sweepView(sweep, $("sweepResult")); }));
            actions.appendChild(button("Add to project report", () => addToReport(S.sweepReportSnapshot(current(), sweep))));
            actions.appendChild(button("Remove", () => {
                if (!window.confirm("Remove the saved sweep \"" + sweep.name + "\"?")) return;
                update(S.removeSweep(current(), sweep.id));
                persist(); renderSavedSweeps();
            }));
            row.appendChild(actions);
            host.appendChild(row);
        });
    }

    // ---------- Report ----------

    function addToReport(result) {
        if (!result.ok) { status(result.error, true); return; }
        const added = window.FormulaFoundryReport.addSnapshot(result.snapshot);
        if (!added.ok) { status(added.error, true); return; }
        status("Added to the project report as a snapshot (" + added.count + " " + (added.count === 1 ? "entry" : "entries") + "). Later changes to this study will not alter it.");
    }

    // ---------- Init ----------

    function init() {
        const calcSelect = $("newStudyCalculator");
        const supported = $("supportedList");
        S.listAdapters().forEach((a) => {
            const o = el("option", null, a.name);
            o.value = a.id;
            calcSelect.appendChild(o);
            const li = el("li");
            const link = el("a", null, a.name);
            link.href = a.path;
            li.appendChild(link);
            supported.appendChild(li);
        });
        const loaded = store.load();
        studies = loaded.studies;
        const issues = $("studyIssues");
        loaded.issues.forEach((m) => issues.appendChild(el("li", null, m)));
        $("newStudyForm").addEventListener("submit", (event) => {
            event.preventDefault();
            const name = $("newStudyName").value.trim();
            if (!name) { status("Enter a name for the study.", true); return; }
            const study = S.createStudy(name, calcSelect.value);
            studies.push(study);
            $("newStudyName").value = "";
            persist();
            openStudy(study.id);
        });
        $("studySelect").addEventListener("change", (event) => openStudy(event.target.value));
        $("saveStudy").addEventListener("click", () => { if (!current()) { status("Open or create a study first.", true); return; } persist(); });
        $("deleteStudy").addEventListener("click", () => {
            const study = current();
            if (!study) { status("Open a study first.", true); return; }
            if (!window.confirm("Delete study \"" + study.name + "\" and all its scenarios and sweeps? Report entries already added are not affected.")) return;
            studies = studies.filter((s) => s.id !== study.id);
            persist();
            openStudy(null);
        });
        $("addScenario").addEventListener("click", () => {
            const study = current();
            const adapter = adapterOf(study);
            const base = study.scenarios.find((s) => s.id === study.baselineId);
            const scenario = base
                ? S.duplicateScenario(base, "Scenario " + (study.scenarios.length + 1))
                : S.createScenario(adapter, "Baseline");
            try { update(S.addScenario(study, scenario)); } catch (error) { status(error.message, true); return; }
            persist(); renderScenarios(); renderComparison(); renderSweepForm();
        });
        renderAll();
    }

    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
    else init();

    window.FormulaFoundryStudiesPage = { renderAll };
})();
