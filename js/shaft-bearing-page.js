(function () {
    "use strict";

    const model = window.FormulaFoundryShaftBearing;
    const projects = window.FormulaFoundryShaftProject;
    const graphics = window.FormulaFoundryShaftDiagram;
    const views = window.FormulaFoundryShaftReport;
    const reports = window.FormulaFoundryReport;
    const byId = (id) => document.getElementById(id);
    const form = byId("analysisForm");
    const loadList = byId("loadList");
    const unitGroups = projects.unitGroups;
    const missing = "—";
    const sweepMetrics = {
        equivalentStress: ["Peak nominal equivalent stress", "stress"],
        bendingStress: ["Peak nominal bending stress", "stress"],
        displacement: ["Peak resultant displacement", "deflection"],
        stiffness: ["Flexural rigidity EI", null, "N·m²"],
        mass: ["Shaft mass", "mass"]
    };

    let storage;
    try { storage = window.localStorage; } catch { /* The store exposes storage errors. */ }
    const store = projects.createStore(storage);
    const initial = store.load();
    let project = initial.project || projects.newProject();
    let dirty = false;
    let selectedLoad = null;
    let importRequest = 0;
    const sweeps = new Map();
    const sweepSettings = new Map();

    const active = () => project.configurations.find(({ id }) => id === project.activeId);
    const current = () => projects.current(active());
    const activeSweep = () => sweeps.get(project.activeId);

    function node(tag, text, className) {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        if (className) element.className = className;
        return element;
    }

    function status(id, message, kind = "") {
        const element = byId(id);
        if (element.textContent !== message) element.textContent = message;
        element.dataset.kind = kind;
    }

    function markDirty() {
        if (!dirty) status("saveStatus", "The project has unsaved changes.");
        dirty = true;
    }

    function replaceConfiguration(configuration) {
        project.configurations = project.configurations.map((item) => item.id === configuration.id ? configuration : item);
    }

    function option(value, text) {
        const element = node("option", text);
        element.value = value;
        return element;
    }

    function number(value) {
        return Number.isFinite(value) ? reports.formatValue(value) : missing;
    }

    function converted(value, group, units) {
        return group ? projects.fromSI(value, group, units[group]) : value;
    }

    function quantity(value, group, units) {
        const display = converted(value, group, units);
        return Number.isFinite(display) ? number(display) + (group ? " " + units[group] : "") : missing;
    }

    function readInput(input, units) {
        if (input.type !== "number") return input.value;
        const value = input.valueAsNumber;
        const group = input.dataset.quantity;
        const si = group ? projects.toSI(value, group, units[group]) : value;
        return Number.isFinite(si) ? si : null;
    }

    function fillInput(input, value, units) {
        const group = input.dataset.quantity;
        if (!group) {
            input.value = value ?? "";
            return;
        }
        const shown = converted(value, group, units);
        input.value = Number.isFinite(shown) ? Number(shown.toPrecision(15)) : "";
    }

    function updateUnitLabels() {
        const { units } = active();
        document.querySelectorAll("[data-unit-label]").forEach((item) => {
            item.textContent = units[item.dataset.unitLabel];
        });
    }

    function updateInputPresentation() {
        const { inputs, units } = active();
        form.querySelectorAll("[data-input]").forEach((input) => {
            const [key, child] = input.dataset.input.split(".");
            fillInput(input, child ? inputs[key][child] : inputs[key], units);
        });
        form.querySelectorAll("[data-property]").forEach((input) => fillInput(input, inputs.material[input.dataset.property], units));
        form.querySelectorAll("[data-bearing-field]").forEach((input) => {
            fillInput(input, inputs.bearings[input.dataset.bearing][input.dataset.bearingField], units);
        });
        byId("insideDiameterField").hidden = inputs.section !== "hollow";
        byId("innerDiameter").disabled = inputs.section !== "hollow";
        byId("materialId").value = inputs.materialId;
        renderMaterialBasis();
    }

    function renderMaterialBasis() {
        const { inputs } = active();
        const info = projects.materialInfo(inputs);
        const identity = [info.name, info.condition, info.productForm].filter(Boolean).join(" · ");
        const lines = [node("p", identity)];
        if (info.referenceTemperatureC !== null) {
            lines.push(node("p", "Reference temperature " + info.referenceTemperatureC + " °C.", "fluid-help"));
        }
        if (info.caveats) lines.push(node("p", info.caveats, "fluid-help"));
        byId("materialBasis").replaceChildren(...lines);
        for (const [field, property] of Object.entries(info.properties)) {
            byId("basis-" + field).textContent = property.basisLabel;
        }
        byId("resetMaterial").disabled = !inputs.materialId || !inputs.materialOverrides.length;
    }

    function labelField(input, id) {
        input.id = id;
        input.parentElement.querySelector("label").htmlFor = id;
    }

    function renderLoads() {
        const { inputs, units } = active();
        const atLimit = inputs.loads.length >= model.MAX_LOADS;
        loadList.replaceChildren();
        inputs.loads.forEach((load, index) => {
            const fieldset = byId("loadTemplate").content.firstElementChild.cloneNode(true);
            fieldset.dataset.loadId = load.id;
            fieldset.dataset.selected = String(load.id === selectedLoad);
            fieldset.querySelector("legend").textContent = load.name.trim() || "Point load " + (index + 1);
            fieldset.querySelectorAll("[data-load-field]").forEach((input) => {
                const field = input.dataset.loadField;
                labelField(input, "load-" + load.id + "-" + field);
                fillInput(input, load[field], units);
            });
            fieldset.querySelector('[data-load-action="duplicate"]').disabled = atLimit;
            fieldset.querySelector('[data-load-action="up"]').disabled = index === 0;
            fieldset.querySelector('[data-load-action="down"]').disabled = index === inputs.loads.length - 1;
            loadList.append(fieldset);
        });
        if (!inputs.loads.length) loadList.append(node("p", "No transverse point loads entered.", "fluid-help"));
        byId("addLoad").disabled = atLimit;
        updateUnitLabels();
    }

    function renderConfigurationOptions() {
        byId("configSelect").replaceChildren(...project.configurations.map((configuration) => {
            const suffix = configuration.id === project.baselineId ? " (baseline)" : "";
            return option(configuration.id, projects.name(configuration) + suffix);
        }));
        byId("configSelect").value = project.activeId;
        byId("setBaseline").disabled = project.activeId === project.baselineId;
        byId("removeConfig").disabled = project.activeId === project.baselineId;
        byId("duplicateConfig").disabled = project.configurations.length >= projects.MAX_CONFIGURATIONS;
    }

    function selectLoad(index) {
        selectedLoad = active().inputs.loads[index]?.id ?? null;
        for (const fieldset of loadList.querySelectorAll("[data-load-id]")) {
            fieldset.dataset.selected = String(fieldset.dataset.loadId === selectedLoad);
        }
        graphics.setSelection(byId("shaftDiagram"), index < 0 ? null : index);
    }

    function renderDiagram() {
        const { inputs, units } = active();
        const index = inputs.loads.findIndex(({ id }) => id === selectedLoad);
        graphics.mount(byId("shaftDiagram"), inputs, current(), units, (station) => {
            selectLoad(station);
            byId("load-" + selectedLoad + "-position")?.focus();
        }, index < 0 ? null : index);
    }

    function table(caption, columns, rows, className = "") {
        const wrapper = node("div", undefined, "fluid-table-wrap");
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", caption);
        const grid = node("table", undefined, "fluid-table " + className);
        const header = node("thead");
        const headerRow = node("tr");
        columns.forEach((value) => {
            const cell = node("th");
            cell.scope = "col";
            cell.append(value);
            headerRow.append(cell);
        });
        header.append(headerRow);
        const body = node("tbody");
        for (const row of rows) {
            const tr = node("tr");
            row.forEach((value, index) => {
                const cell = node(index ? "td" : "th");
                if (!index) cell.scope = "row";
                cell.append(value);
                tr.append(cell);
            });
            body.append(tr);
        }
        grid.append(node("caption", caption), header, body);
        wrapper.append(grid);
        return wrapper;
    }

    function highlights(result, q) {
        const { bending, combined, deflection, reactions } = result;
        const items = [
            ["Peak resultant bending moment", q(bending.maximum.resultant, "moment"), "at " + q(bending.maximum.x, "outputLength")],
            ["Peak nominal equivalent stress", q(combined.maximum.equivalentStress, "stress"), "at " + q(combined.maximum.x, "outputLength")],
            ["Peak resultant displacement", q(deflection.maximum?.resultant, "deflection"), deflection.maximum ? "at " + q(deflection.maximum.x, "outputLength") : ""],
            ["Bearing A radial reaction", q(reactions.a.resultant, "outputForce")],
            ["Bearing B radial reaction", q(reactions.b.resultant, "outputForce")],
            ["Nominal static yield ratio", number(combined.yieldRatio), combined.yieldRatio === null ? "Unavailable at zero stress or without yield strength" : "Yield strength ÷ peak nominal equivalent stress"]
        ];
        return items.map(([label, value, detail]) => {
            const card = node("div");
            card.append(node("dt", label), node("dd", value));
            if (detail) card.append(node("small", detail));
            return card;
        });
    }

    function lifeText(bearing, key) {
        if (bearing.status === "unloaded") return "Undefined at zero radial load";
        if (bearing.status === "stopped" && key === "lifeHours") return "Undefined at zero speed";
        return number(bearing[key]);
    }

    function renderBearingResults(result, q) {
        const { reactions, bearings, equilibrium } = result;
        const force = (value) => q(value, "outputForce");
        const rows = [
            ["Reaction Fy", ...["a", "b"].map((key) => force(reactions[key].fy))],
            ["Reaction Fz", ...["a", "b"].map((key) => force(reactions[key].fz))],
            ["Radial load P", ...["a", "b"].map((key) => force(bearings[key].radialLoad))],
            ["Basic L10 (million rev)", lifeText(bearings.a, "lifeMillionRevolutions"), lifeText(bearings.b, "lifeMillionRevolutions")],
            ["Basic L10 (h)", lifeText(bearings.a, "lifeHours"), lifeText(bearings.b, "lifeHours")],
            ["Required C for target life", ...["a", "b"].map((key) => force(bearings[key].requiredDynamicRating))],
            ["Basic static load ratio C₀/P₀", number(bearings.a.staticRatio), number(bearings.b.staticRatio)]
        ];
        const reactionTable = table("Bearing reactions and rating life", ["Quantity", "Bearing A", "Bearing B"], rows);
        const equilibriumTable = table("Global equilibrium residuals about Bearing A", ["Balance", "Y component", "Z component"], [
            ["Force", force(equilibrium.fy), force(equilibrium.fz)],
            ["Moment", q(equilibrium.my, "moment"), q(equilibrium.mz, "moment")]
        ]);
        byId("bearingResults").replaceChildren(reactionTable, equilibriumTable);
    }

    function renderSectionResults(result, q) {
        const { geometry, torque, bending, combined } = result;
        const max = combined.maximum;
        const rows = [
            ["Area A", q(geometry.area, "area")],
            ["Second moment I", q(geometry.inertia, "inertia")],
            ["Polar moment J", q(geometry.polarMoment, "inertia")],
            ["Section modulus Z", q(geometry.sectionModulus, "sectionModulus")],
            ["Flexural rigidity EI", Number.isFinite(geometry.stiffness) ? number(geometry.stiffness) + " N·m²" : missing],
            ["Shaft mass", q(geometry.mass, "mass")],
            ["Peak nominal bending stress", q(bending.maximum.bendingStress, "stress")],
            ["Bending stress at equivalent-stress critical section", q(max.bendingStress, "stress")],
            ["Torsional shear at equivalent-stress critical section", q(max.torsionalStress, "stress")],
            ["Critical section from A", q(max.x, "outputLength") + (max.side === "left" ? " (left limit)" : max.side === "right" ? " (right limit)" : "")],
            ["Peak nominal torsional shear", q(Math.abs(torque.shearStress), "stress")],
            ["Signed torque-path twist", q(torque.twist, "angle")]
        ];
        byId("sectionResults").replaceChildren(table("Section properties, nominal stress and twist", ["Quantity", "Value"], rows));
    }

    function renderDeflections(result, q) {
        const { maximum, slopes, stations, method } = result.deflection;
        const output = byId("deflectionResults");
        output.replaceChildren();
        if (!maximum) {
            output.append(node("p", "Enter Young’s modulus to calculate deflections and bearing slopes.", "fluid-help"));
            return;
        }
        const deflection = (value) => q(value, "deflection");
        const loadNames = new Map(active().inputs.loads.map(({ id, name }, index) => [id, name.trim() || "Point load " + (index + 1)]));
        const rows = [["Peak resultant", q(maximum.x, "outputLength"), deflection(maximum.y), deflection(maximum.z), deflection(maximum.resultant)]];
        for (const station of stations) {
            rows.push([loadNames.get(station.id) || "Point load", q(station.x, "outputLength"), deflection(station.y), deflection(station.z), deflection(station.resultant)]);
        }
        output.append(
            table("Shaft displacement", ["Station", "x from A", "Y displacement", "Z displacement", "Resultant"], rows),
            table("Bearing slopes", ["Support", "Y plane", "Z plane"], [
                ["Bearing A", q(slopes.a.y, "angle"), q(slopes.a.z, "angle")],
                ["Bearing B", q(slopes.b.y, "angle"), q(slopes.b.z, "angle")]
            ])
        );
        if (method) output.append(node("p", method, "fluid-help"));
    }

    function renderResults() {
        const result = current();
        byId("resultSummary").hidden = !result;
        byId("addReport").disabled = !result;
        byId("runSweep").disabled = !result;
        renderDiagram();
        if (!result) {
            byId("shaftPlots").replaceChildren();
            status("resultStatus", active().status === "stale"
                ? "Inputs changed. Recalculate to update the results and plots."
                : "Enter shaft and bearing inputs, then calculate the system.");
            return;
        }
        const { units } = active();
        const q = (value, group) => quantity(value, group, units);
        byId("resultHighlights").replaceChildren(...highlights(result, q));
        const warnings = byId("resultWarnings");
        warnings.replaceChildren(...result.warnings.map((message) => node("li", message)));
        warnings.hidden = !result.warnings.length;
        renderBearingResults(result, q);
        renderSectionResults(result, q);
        renderDeflections(result, q);
        graphics.renderPlots(byId("shaftPlots"), result, units);
        status("resultStatus", "Calculated for " + projects.name(active()) + ".", "success");
    }

    function renderComparison() {
        const container = byId("comparisonTables");
        if (project.configurations.length < 2) {
            container.replaceChildren(node("p", "Duplicate the configuration to compare an alternative with the baseline.", "fluid-help"));
            return;
        }
        const columns = ["Quantity", ...project.configurations.map((configuration) => {
            const item = node("span", projects.name(configuration));
            if (configuration.id === project.baselineId) item.append(node("small", "Baseline", "shaft-baseline"));
            return item;
        })];
        const rows = views.comparisonRows(project, active().units).map(({ label, unit, values }) => [
            unit ? label + " (" + unit + ")" : label,
            ...values.map(({ text, delta }) => {
                const item = node("span", text);
                if (delta !== null) item.append(node("small", (delta > 0 ? "+" : "") + number(delta) + "%", "fluid-delta"));
                return item;
            })
        ]);
        container.replaceChildren(table("Configuration comparison", columns, rows, "shaft-comparison"));
    }

    function readSweepSettings() {
        const units = active().units;
        const diameter = (id) => readInput(byId(id), units);
        return { start: diameter("sweepStart"), end: diameter("sweepEnd"), count: readInput(byId("sweepCount"), units) };
    }

    function fillSweepSettings() {
        const { inputs, units } = active();
        const { outerDiameter, innerDiameter, section } = inputs;
        const validDiameter = outerDiameter > 0 && (section !== "hollow" || outerDiameter > innerDiameter);
        const low = validDiameter ? Math.max(outerDiameter * 0.8, section === "hollow" ? (outerDiameter + innerDiameter) / 2 : 0) : null;
        const high = validDiameter ? outerDiameter * 1.3 : null;
        const settings = sweepSettings.get(project.activeId) || { start: low, end: high, count: 11 };
        fillInput(byId("sweepStart"), settings.start, units);
        fillInput(byId("sweepEnd"), settings.end, units);
        fillInput(byId("sweepCount"), settings.count, units);
    }

    function sweepLabel(metric, units) {
        const [label, group, fixedUnit] = sweepMetrics[metric];
        return label + " (" + (group ? units[group] : fixedUnit) + ")";
    }

    function renderSweep() {
        const sweep = activeSweep();
        byId("sweepOutput").hidden = !sweep;
        byId("includeSweep").disabled = !sweep;
        if (!sweep) {
            byId("sweepFigure").replaceChildren();
            byId("sweepTable").replaceChildren();
            status("sweepStatus", current() ? "Set a diameter range to calculate sensitivity." : "Calculate the active configuration before running a sweep.");
            return;
        }
        const { units } = active();
        const metric = byId("sweepMetric").value;
        const group = sweepMetrics[metric][1];
        const diameterTitle = "Outside diameter (" + units.outputDiameter + ")";
        const points = sweep.samples.map((sample) => {
            const y = converted(sample[metric], group, units);
            return { x: converted(sample.diameter, "outputDiameter", units), y: Number.isFinite(y) ? y : null };
        });
        const available = points.every(({ x }) => Number.isFinite(x)) && points.some(({ y }) => Number.isFinite(y));
        const chart = available ? window.FormulaFoundryChart.createLineChart(document, {
            title: sweepMetrics[metric][0] + " by diameter",
            xLabel: diameterTitle, yLabel: sweepLabel(metric, units), points
        }) : node("p", "This quantity is unavailable for the active material properties.", "fluid-help");
        const metrics = Object.keys(sweepMetrics);
        const rows = sweep.samples.map((sample) => [
            number(converted(sample.diameter, "outputDiameter", units)),
            ...metrics.map((key) => number(converted(sample[key], sweepMetrics[key][1], units)))
        ]);
        byId("sweepFigure").replaceChildren(chart);
        byId("sweepTable").replaceChildren(table("Diameter sensitivity samples", [diameterTitle, ...metrics.map((key) => sweepLabel(key, units))], rows));
        status("sweepStatus", sweep.samples.length + " diameters calculated.", "success");
    }

    function renderActive() {
        selectedLoad = null;
        byId("analysisErrors").replaceChildren();
        status("reportStatus", "");
        const configuration = active();
        form.querySelectorAll("[data-meta]").forEach((input) => { input.value = project[input.dataset.meta]; });
        byId("configName").value = configuration.name;
        document.querySelectorAll("[data-unit]").forEach((select) => { select.value = configuration.units[select.dataset.unit]; });
        renderConfigurationOptions();
        updateInputPresentation();
        renderLoads();
        renderResults();
        renderComparison();
        fillSweepSettings();
        renderSweep();
    }

    function editInputs(inputs, { rebuildLoads = false } = {}) {
        const configuration = active();
        if (inputs === configuration.inputs) return;
        const hadResult = Boolean(current());
        const hadSweep = sweeps.delete(project.activeId);
        replaceConfiguration(projects.edit(configuration, inputs));
        markDirty();
        byId("analysisErrors").replaceChildren();
        status("reportStatus", "");
        if (rebuildLoads) renderLoads();
        if (hadResult) renderResults();
        else renderDiagram();
        if (hadSweep || hadResult) renderSweep();
        renderComparison();
    }

    function editField(input) {
        const configuration = active();
        const { inputs, units } = configuration;
        const value = readInput(input, units);
        const { meta, input: path, property, bearing, bearingField, loadField } = input.dataset;
        if (meta) {
            if (project[meta] !== value) {
                project[meta] = value;
                markDirty();
            }
        } else if (input.id === "configName" && configuration.name !== value) {
            replaceConfiguration({ ...configuration, name: value });
            renderConfigurationOptions();
            renderComparison();
            if (current()) status("resultStatus", "Calculated for " + projects.name(active()) + ".", "success");
            markDirty();
        } else if (path) {
            const [key, field] = path.split(".");
            if (field && inputs[key][field] !== value) editInputs({ ...inputs, [key]: { ...inputs[key], [field]: value } });
            if (!field && inputs[key] !== value) editInputs({ ...inputs, [key]: value });
            if (key === "section") {
                byId("insideDiameterField").hidden = value !== "hollow";
                byId("innerDiameter").disabled = value !== "hollow";
            }
        } else if (property) {
            editInputs(projects.setMaterialProperty(inputs, property, value));
            renderMaterialBasis();
        } else if (bearingField && inputs.bearings[bearing][bearingField] !== value) {
            editInputs({ ...inputs, bearings: { ...inputs.bearings, [bearing]: { ...inputs.bearings[bearing], [bearingField]: value } } });
        } else if (loadField) {
            const fieldset = input.closest("[data-load-id]");
            const index = inputs.loads.findIndex(({ id }) => id === fieldset.dataset.loadId);
            if (index < 0 || inputs.loads[index][loadField] === value) return;
            const loads = inputs.loads.map((load, i) => i === index ? { ...load, [loadField]: value } : load);
            if (loadField === "name") fieldset.querySelector("legend").textContent = value.trim() || "Point load " + (index + 1);
            editInputs({ ...inputs, loads });
        }
    }

    function updateLoads(loads, selection) {
        selectedLoad = selection;
        editInputs({ ...active().inputs, loads }, { rebuildLoads: true });
        if (selectedLoad) byId("load-" + selectedLoad + "-position")?.focus();
        else byId("addLoad").focus();
    }

    function replaceProject(next, message) {
        project = next;
        sweeps.clear();
        sweepSettings.clear();
        renderActive();
        status("configurationStatus", "");
        status("projectLoadStatus", message, "success");
    }

    for (const [group, spec] of Object.entries(unitGroups)) {
        const field = node("div");
        const select = node("select");
        select.id = "unit-" + group;
        select.dataset.unit = group;
        select.append(...spec.options.map((value) => option(value, value)));
        const label = node("label", spec.label);
        label.htmlFor = select.id;
        field.append(label, select);
        byId(spec.output ? "outputUnits" : "inputUnits").append(field);
        select.addEventListener("change", () => {
            if (active().units[group] === select.value) return;
            replaceConfiguration(projects.changeUnit(active(), group, select.value));
            markDirty();
            updateUnitLabels();
            if (spec.output) {
                if (group === "outputDiameter") fillSweepSettings();
                renderResults();
                renderComparison();
                renderSweep();
            } else {
                updateInputPresentation();
                for (const fieldset of loadList.querySelectorAll("[data-load-id]")) {
                    const load = active().inputs.loads.find(({ id }) => id === fieldset.dataset.loadId);
                    fieldset.querySelectorAll("[data-quantity]").forEach((input) => fillInput(input, load[input.dataset.loadField], active().units));
                }
            }
        });
    }

    populateMaterialSelect(byId("materialId"), { placeholderText: "Manual properties" });
    byId("materialId").parentElement.querySelector(".material-data-note a").href = "../references.html#material-data";
    for (const bearing of ["a", "b"]) {
        const fieldset = byId("bearingTemplate").content.firstElementChild.cloneNode(true);
        fieldset.querySelector("legend").textContent = "Bearing " + bearing.toUpperCase();
        fieldset.querySelectorAll("[data-bearing-field]").forEach((input) => {
            input.dataset.bearing = bearing;
            labelField(input, "bearing-" + bearing + "-" + input.dataset.bearingField);
        });
        byId("bearingFields").append(fieldset);
    }
    byId("sweepMetric").append(...Object.entries(sweepMetrics).map(([key, [label]]) => option(key, label)));
    byId("sweepStart").dataset.quantity = "outputDiameter";
    byId("sweepEnd").dataset.quantity = "outputDiameter";

    form.addEventListener("input", (event) => editField(event.target));
    form.addEventListener("change", (event) => {
        if (event.target.matches("select[data-input], select[data-bearing-field]")) editField(event.target);
    });
    byId("materialId").addEventListener("change", () => {
        editInputs(projects.applyMaterial(active().inputs, byId("materialId").value));
        updateInputPresentation();
    });
    byId("resetMaterial").addEventListener("click", () => {
        const { inputs } = active();
        editInputs(projects.applyMaterial(projects.applyMaterial(inputs, ""), inputs.materialId));
        updateInputPresentation();
        byId("materialId").focus();
    });
    byId("configSelect").addEventListener("change", () => {
        project.activeId = byId("configSelect").value;
        markDirty();
        renderActive();
        status("configurationStatus", "");
    });

    loadList.addEventListener("focusin", (event) => {
        const fieldset = event.target.closest("[data-load-id]");
        if (fieldset) selectLoad(active().inputs.loads.findIndex(({ id }) => id === fieldset.dataset.loadId));
    });
    loadList.addEventListener("click", (event) => {
        const action = event.target.closest("[data-load-action]")?.dataset.loadAction;
        if (!action) return;
        const id = event.target.closest("[data-load-id]").dataset.loadId;
        const loads = [...active().inputs.loads];
        const index = loads.findIndex((load) => load.id === id);
        let selection = id;
        if (action === "remove") {
            loads.splice(index, 1);
            selection = loads[Math.min(index, loads.length - 1)]?.id ?? null;
        } else if (action === "duplicate" && loads.length < model.MAX_LOADS) {
            const copy = { ...loads[index], id: projects.newLoad().id };
            loads.splice(index + 1, 0, copy);
            selection = copy.id;
        } else if (action === "up" || action === "down") {
            const next = index + (action === "up" ? -1 : 1);
            if (next < 0 || next >= loads.length) return;
            loads.splice(next, 0, loads.splice(index, 1)[0]);
        } else {
            return;
        }
        updateLoads(loads, selection);
    });
    byId("addLoad").addEventListener("click", () => {
        if (active().inputs.loads.length >= model.MAX_LOADS) return;
        const load = projects.newLoad();
        updateLoads([...active().inputs.loads, load], load.id);
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const configuration = active();
        const result = model.calculate(configuration.inputs);
        replaceConfiguration(projects.solved(configuration, result));
        markDirty();
        byId("analysisErrors").replaceChildren();
        status("reportStatus", "");
        if (!result.ok) {
            sweeps.delete(project.activeId);
            const list = node("ul", undefined, "error");
            list.append(...result.errors.map(({ message }) => node("li", message)));
            byId("analysisErrors").append(list);
            byId("analysisErrors").focus();
        } else {
            byId("resultsHeading").focus();
        }
        renderResults();
        renderComparison();
        fillSweepSettings();
        renderSweep();
    });

    byId("duplicateConfig").addEventListener("click", () => {
        if (project.configurations.length >= projects.MAX_CONFIGURATIONS) return;
        const copy = projects.duplicate(active());
        project.configurations.push(copy);
        project.activeId = copy.id;
        markDirty();
        renderActive();
        status("configurationStatus", "Copy created. Edit and calculate it to compare with the baseline.", "success");
        byId("configName").focus();
        byId("configName").select();
    });
    byId("setBaseline").addEventListener("click", () => {
        project.baselineId = project.activeId;
        markDirty();
        renderConfigurationOptions();
        renderComparison();
        status("configurationStatus", projects.name(active()) + " is now the baseline.", "success");
        byId("duplicateConfig").focus({ preventScroll: true });
    });
    byId("removeConfig").addEventListener("click", () => {
        if (project.activeId === project.baselineId || !window.confirm("Delete " + projects.name(active()) + "?")) return;
        sweeps.delete(project.activeId);
        sweepSettings.delete(project.activeId);
        project.configurations = project.configurations.filter(({ id }) => id !== project.activeId);
        project.activeId = project.baselineId;
        markDirty();
        renderActive();
        status("configurationStatus", "Alternative deleted. The baseline is in the editor.", "success");
        byId("duplicateConfig").focus({ preventScroll: true });
    });

    byId("sweepForm").addEventListener("input", () => {
        sweepSettings.set(project.activeId, readSweepSettings());
        if (sweeps.delete(project.activeId)) {
            renderSweep();
            status("sweepStatus", "Sweep settings changed. Run the sweep to update the plot.");
        }
    });
    byId("sweepForm").addEventListener("submit", (event) => {
        event.preventDefault();
        if (!current()) return;
        const settings = sweepSettings.get(project.activeId) || readSweepSettings();
        const result = model.runSweep(active().inputs, settings);
        if (!result.ok) {
            sweeps.delete(project.activeId);
            renderSweep();
            status("sweepStatus", result.errors.map(({ message }) => message).join(" "), "error");
            return;
        }
        sweepSettings.set(project.activeId, settings);
        sweeps.set(project.activeId, { ...settings, configurationId: project.activeId, samples: result.samples });
        renderSweep();
    });
    byId("sweepMetric").addEventListener("change", renderSweep);

    byId("addReport").addEventListener("click", () => {
        const snapshot = views.buildSnapshot(project, {
            includeComparison: byId("includeComparison").checked,
            sweep: byId("includeSweep").checked ? activeSweep() : null
        });
        if (!snapshot) {
            status("reportStatus", "Calculate the active configuration before adding the analysis.", "error");
            return;
        }
        const saved = reports.addSnapshot(snapshot);
        if (!saved.ok) status("reportStatus", saved.error, "error");
        else if (!saved.persisted) status("reportStatus", "Browser storage is unavailable. The entry is available only in this page session.", "warning");
        else status("reportStatus", "Added shaft analysis to Project Report.", "success");
    });

    byId("saveProject").addEventListener("click", () => {
        if (store.save(project)) {
            dirty = false;
            status("saveStatus", "Project saved in this browser.", "success");
        } else {
            status("saveStatus", "Local storage is unavailable. Export the project to keep it.", "error");
        }
    });
    byId("reloadProject").addEventListener("click", () => {
        const loaded = store.load();
        if (!loaded.ok || !loaded.project) {
            status("saveStatus", loaded.error || "No shaft project is saved in this browser.", "error");
            return;
        }
        if (dirty && !window.confirm("Reload the saved project and discard unsaved changes?")) return;
        replaceProject(loaded.project, "Reloaded the saved shaft project.");
        dirty = false;
        status("saveStatus", "Reloaded the saved project.", "success");
    });
    byId("exportProject").addEventListener("click", () => {
        const file = new Blob([projects.serialize(project)], { type: "application/json" });
        const url = URL.createObjectURL(file);
        const link = node("a");
        link.href = url;
        link.download = "formula-foundry-shaft-bearing.json";
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        status("saveStatus", "Workflow JSON exported.", "success");
    });
    byId("importProject").addEventListener("change", async (event) => {
        const version = ++importRequest;
        const input = event.target;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        if (file.size > projects.MAX_FILE_BYTES) {
            status("saveStatus", "Workflow files must be 256 KiB or smaller.", "error");
            return;
        }
        try {
            const imported = projects.parse(await file.text());
            if (version !== importRequest) return;
            if (!imported.ok) {
                status("saveStatus", imported.error, "error");
                return;
            }
            if (dirty && !window.confirm("Replace this project with the imported project? Unsaved changes will be lost.")) return;
            dirty = false;
            replaceProject(imported.project, "Imported the shaft project.");
            markDirty();
            status("saveStatus", "Project imported. Save locally to keep it in this browser.", "success");
        } catch {
            if (version === importRequest) status("saveStatus", "The workflow file could not be read.", "error");
        }
    });

    byId("loadExample").addEventListener("click", () => {
        if (dirty && !window.confirm("Load the worked example and discard unsaved changes?")) return;
        dirty = false;
        replaceProject(window.FormulaFoundryShaftExample.create(projects), "Worked example loaded. Calculate the shaft system to reproduce the results.");
        markDirty();
        byId("calculate").focus();
    });

    renderActive();
    if (initial.project) status("projectLoadStatus", "Loaded the saved shaft project.", "success");
    if (!initial.ok) status("projectLoadStatus", initial.error, "error");
})();
