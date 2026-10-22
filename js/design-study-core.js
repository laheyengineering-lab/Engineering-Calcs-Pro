// ======================================================
// Formula Foundry - Design Studies core (shared, DOM-free)
// Versioned study/scenario data model, calculator adapter registry,
// scenario comparison, parametric sweeps and report snapshot builders.
// No backend: studies live in localStorage on this browser only.
//
// Calculators are integrated through adapters (js/design-study-adapters.js).
// An adapter wraps the calculator's own calculation function; no
// engineering formulas are implemented here.
//
// Adapter contract:
// {
//   id, name, version, path,
//   groups:  { key: { label, options[], default, toBase(v, unit), fromBase(v, unit), percentMeaningful } },
//   inputs:  [{ id, label, group|null, unit (when group is null), optional, min, minExclusive, max, sweepable, section }],
//   outputs: [{ id, label, group, quantity, optional, comparable, plottable }],
//   equations[], assumptions[], warnings[], method,
//   calculate(values{id: number|null}, units{group: unit}) -> { outputId: number }  (throws Error with a user message when invalid)
// }
// ======================================================
(function (root) {
    "use strict";

    const STORAGE_KEY = "formulaFoundry.designStudies";
    const BACKUP_KEY = "formulaFoundry.designStudies.backup";
    const SCHEMA_VERSION = 1;
    const MAX_STUDIES = 50;
    const MAX_SCENARIOS = 20;
    const MAX_SWEEPS = 20;
    const MAX_SWEEP_SAMPLES = 200;
    const MIN_SWEEP_SAMPLES = 2;
    const STATUSES = ["new", "calculated", "stale", "error"];
    const SWEEP_NOTE = "A parametric sweep is a model-based exploration: every point is the calculator's own result for the stated inputs and assumptions, not an independent physical test. Values between samples are not calculated.";

    const adapters = {};

    // ---------- Helpers ----------

    function text(value, max) {
        if (value === undefined || value === null) return "";
        return String(value).slice(0, max || 200);
    }

    function newId(prefix) {
        return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function clone(value) {
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    function isIso(value) {
        return typeof value === "string" && Number.isFinite(Date.parse(value));
    }

    function cleanNumber(value) {
        return Number(Number(value).toPrecision(12));
    }

    // ---------- Adapter registry ----------

    function registerAdapter(adapter) {
        if (!adapter || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(adapter.id || "")) throw new Error("Adapter needs a valid id.");
        ["name", "version", "path"].forEach((key) => { if (!adapter[key]) throw new Error("Adapter " + adapter.id + " needs " + key + "."); });
        if (typeof adapter.calculate !== "function") throw new Error("Adapter " + adapter.id + " needs a calculate function.");
        const groups = adapter.groups || {};
        Object.keys(groups).forEach((key) => {
            const g = groups[key];
            if (!Array.isArray(g.options) || !g.options.includes(g.default)) throw new Error("Unit group " + key + " is invalid.");
            if (typeof g.toBase !== "function" || typeof g.fromBase !== "function") throw new Error("Unit group " + key + " needs conversion functions.");
        });
        (adapter.inputs || []).forEach((input) => {
            if (input.group && !groups[input.group]) throw new Error("Input " + input.id + " uses an unknown unit group.");
        });
        (adapter.outputs || []).forEach((output) => {
            if (!groups[output.group]) throw new Error("Output " + output.id + " uses an unknown unit group.");
        });
        adapters[adapter.id] = adapter;
        return adapter;
    }

    function getAdapter(id) { return Object.prototype.hasOwnProperty.call(adapters, id) ? adapters[id] : null; }
    function listAdapters() { return Object.keys(adapters).map((id) => adapters[id]); }
    function inputDef(adapter, id) { return adapter.inputs.find((input) => input.id === id) || null; }
    function outputDef(adapter, id) { return adapter.outputs.find((output) => output.id === id) || null; }

    function defaultUnits(adapter) {
        const units = {};
        Object.keys(adapter.groups).forEach((key) => { units[key] = adapter.groups[key].default; });
        return units;
    }

    function unitOfInput(adapter, input, units) {
        return input.group ? units[input.group] : (input.unit || "");
    }

    // Converts between two units of one group; returns null when impossible.
    function convertUnit(adapter, groupKey, value, from, to) {
        const group = adapter.groups[groupKey];
        if (!group || !group.options.includes(from) || !group.options.includes(to) || !Number.isFinite(value)) return null;
        if (from === to) return value;
        const converted = group.fromBase(group.toBase(value, from), to);
        return Number.isFinite(converted) ? converted : null;
    }

    // ---------- Scenarios ----------

    function emptyInputs(adapter) {
        const inputs = {};
        adapter.inputs.forEach((input) => { inputs[input.id] = null; });
        return inputs;
    }

    function createScenario(adapter, name, inputs, units) {
        const scenario = {
            id: newId("s"),
            name: text(name, 100).trim() || "Scenario",
            calculatorId: adapter.id,
            calculatorVersion: adapter.version,
            inputs: emptyInputs(adapter),
            units: Object.assign(defaultUnits(adapter), units || {}),
            status: "new",
            error: null,
            result: null,
            updatedAt: new Date().toISOString()
        };
        Object.keys(inputs || {}).forEach((id) => {
            if (id in scenario.inputs) scenario.inputs[id] = Number.isFinite(inputs[id]) ? inputs[id] : null;
        });
        return scenario;
    }

    // Returns a new scenario; the original is never modified.
    function duplicateScenario(scenario, name) {
        const copy = clone(scenario);
        copy.id = newId("s");
        copy.name = text(name, 100).trim() || text(scenario.name, 90) + " (copy)";
        copy.updatedAt = new Date().toISOString();
        return copy;
    }

    function renameScenario(scenario, name) {
        const next = clone(scenario);
        next.name = text(name, 100).trim() || scenario.name;
        return next;
    }

    // Editing never recalculates: a previous result becomes "stale" but is retained as the saved snapshot.
    function markEdited(next) {
        next.status = next.result ? "stale" : "new";
        next.error = null;
        next.updatedAt = new Date().toISOString();
        return next;
    }

    function setScenarioInput(adapter, scenario, inputId, value) {
        if (!inputDef(adapter, inputId)) throw new Error("Unknown input: " + inputId);
        if (value !== null && !Number.isFinite(value)) throw new Error("Input values must be finite numbers or blank.");
        const next = clone(scenario);
        next.inputs[inputId] = value;
        return markEdited(next);
    }

    function setScenarioUnit(adapter, scenario, groupKey, unit) {
        const group = adapter.groups[groupKey];
        if (!group || !group.options.includes(unit)) throw new Error("Unsupported unit: " + unit);
        const next = clone(scenario);
        next.units[groupKey] = unit;
        return markEdited(next);
    }

    function buildInputSnapshot(adapter, scenario) {
        return adapter.inputs.map((input) => ({
            id: input.id,
            label: input.label,
            value: scenario.inputs[input.id],
            unit: unitOfInput(adapter, input, scenario.units)
        }));
    }

    // Runs the calculator's real calculation and returns a NEW scenario with a stored snapshot.
    function calculateScenario(adapter, scenario) {
        const next = clone(scenario);
        next.updatedAt = new Date().toISOString();
        let outputs;
        try {
            outputs = adapter.calculate(Object.assign({}, scenario.inputs), Object.assign({}, scenario.units));
        } catch (error) {
            next.status = "error";
            next.error = text(error && error.message ? error.message : "Calculation failed.", 300);
            return next;
        }
        const list = [];
        for (const def of adapter.outputs) {
            const value = outputs ? outputs[def.id] : undefined;
            if (value === undefined || value === null) {
                if (def.optional) continue;
                next.status = "error";
                next.error = "The calculation did not return " + def.label + ".";
                return next;
            }
            if (!Number.isFinite(value)) {
                next.status = "error";
                next.error = "The calculation produced a non-finite value for " + def.label + ".";
                return next;
            }
            list.push({ id: def.id, label: def.label, value, unit: scenario.units[def.group], quantity: def.quantity });
        }
        next.status = "calculated";
        next.error = null;
        next.calculatorVersion = adapter.version;
        next.result = {
            calculatedAt: next.updatedAt,
            calculatorVersion: adapter.version,
            inputs: buildInputSnapshot(adapter, scenario),
            outputs: list,
            equations: adapter.equations.slice(),
            assumptions: adapter.assumptions.slice(),
            method: adapter.method,
            warnings: (adapter.warnings || []).slice()
        };
        return next;
    }

    // ---------- Studies ----------

    function createStudy(name, calculatorId) {
        const adapter = getAdapter(calculatorId);
        if (!adapter) throw new Error("Unsupported calculator: " + calculatorId);
        const now = new Date().toISOString();
        return {
            id: newId("d"),
            name: text(name, 100).trim() || "Untitled study",
            calculatorId,
            createdAt: now,
            updatedAt: now,
            baselineId: null,
            scenarios: [],
            sweeps: []
        };
    }

    function touch(study) { study.updatedAt = new Date().toISOString(); return study; }

    function addScenario(study, scenario) {
        if (study.scenarios.length >= MAX_SCENARIOS) throw new Error("A study can hold at most " + MAX_SCENARIOS + " scenarios.");
        if (scenario.calculatorId !== study.calculatorId) throw new Error("A study holds scenarios for one calculator only.");
        const next = clone(study);
        next.scenarios.push(clone(scenario));
        if (!next.baselineId) next.baselineId = scenario.id;
        return touch(next);
    }

    function replaceScenario(study, scenario) {
        const next = clone(study);
        const index = next.scenarios.findIndex((item) => item.id === scenario.id);
        if (index < 0) throw new Error("Scenario not found.");
        next.scenarios[index] = clone(scenario);
        return touch(next);
    }

    function removeScenario(study, scenarioId) {
        const next = clone(study);
        next.scenarios = next.scenarios.filter((item) => item.id !== scenarioId);
        if (next.baselineId === scenarioId) next.baselineId = next.scenarios.length ? next.scenarios[0].id : null;
        return touch(next);
    }

    function setBaseline(study, scenarioId) {
        if (!study.scenarios.some((item) => item.id === scenarioId)) throw new Error("Scenario not found.");
        const next = clone(study);
        next.baselineId = scenarioId;
        return touch(next);
    }

    // ---------- Comparison ----------

    // Percentage change of value relative to baseline, or an explanation when undefined.
    function percentDifference(baseline, value, meaningful) {
        if (meaningful === false) return { value: null, reason: "Percentage change is not meaningful on an offset (non-absolute) scale." };
        if (!Number.isFinite(baseline) || !Number.isFinite(value)) return { value: null, reason: "Percentage change is undefined: a value is missing." };
        if (baseline === 0) return { value: null, reason: "Percentage change is undefined because the baseline value is zero." };
        return { value: (value - baseline) / Math.abs(baseline) * 100, reason: "" };
    }

    function differs(a, b) {
        const scale = Math.max(Math.abs(a), Math.abs(b));
        return scale === 0 ? false : Math.abs(a - b) > scale * 1e-9;
    }

    function compareCell(adapter, group, baseCell, cell) {
        // baseCell/cell: { value, unit } or null when absent
        if (!cell || cell.value === null || cell.value === undefined) {
            return { missing: true, value: null, unit: cell ? cell.unit : "", changed: Boolean(baseCell && baseCell.value !== null && baseCell.value !== undefined) };
        }
        const out = { missing: false, value: cell.value, unit: cell.unit, changed: false, delta: null, deltaUnit: baseCell ? baseCell.unit : cell.unit, percent: null, note: "" };
        if (!baseCell || baseCell.value === null || baseCell.value === undefined) {
            out.changed = true;
            out.note = "Not supplied in the baseline.";
            return out;
        }
        let converted = cell.value;
        if (group && cell.unit !== baseCell.unit) {
            converted = convertUnit(adapter, group, cell.value, cell.unit, baseCell.unit);
            if (converted === null) throw new Error("No valid unit conversion from " + cell.unit + " to " + baseCell.unit + ".");
        }
        out.delta = converted - baseCell.value;
        out.changed = differs(converted, baseCell.value);
        const g = group ? adapter.groups[group] : null;
        out.percent = percentDifference(baseCell.value, converted, g ? g.percentMeaningful : true);
        return out;
    }

    // scenarios: array of saved scenarios of ONE calculator. Uses saved snapshots only.
    function compareScenarios(scenarios, baselineId) {
        const fail = (error) => ({ ok: false, error });
        if (!Array.isArray(scenarios) || scenarios.length < 2) return fail("Select at least two scenarios to compare.");
        const first = scenarios[0];
        const adapter = getAdapter(first.calculatorId);
        if (!adapter) return fail("Calculator " + first.calculatorId + " is not supported for comparison.");
        const ids = new Set();
        for (const s of scenarios) {
            if (s.calculatorId !== first.calculatorId) {
                return fail("Scenarios from different calculators are not compared: their inputs, outputs and assumptions have different physical meaning.");
            }
            if (ids.has(s.id)) return fail("A scenario was selected more than once.");
            ids.add(s.id);
            if (!s.result || (s.status !== "calculated")) {
                return fail("Scenario \"" + s.name + "\" has no current saved result; recalculate it before comparing" + (s.status === "stale" ? " (its inputs were edited after the last calculation)." : "."));
            }
            if (s.result.calculatorVersion !== first.result.calculatorVersion) {
                return fail("Scenario \"" + s.name + "\" was calculated with a different calculator revision (" + s.result.calculatorVersion + " vs " + first.result.calculatorVersion + "); recalculate before comparing.");
            }
            for (const item of s.result.outputs) {
                const def = outputDef(adapter, item.id);
                if (!def || def.quantity !== item.quantity) return fail("Scenario \"" + s.name + "\" contains a result with an unrecognised physical meaning (" + item.id + ").");
                if (!adapter.groups[def.group].options.includes(item.unit)) return fail("Scenario \"" + s.name + "\" reports " + def.label + " in an incompatible unit (" + item.unit + ").");
            }
            for (const item of s.result.inputs) {
                const def = inputDef(adapter, item.id);
                if (!def) return fail("Scenario \"" + s.name + "\" contains an unknown input (" + item.id + ").");
                if (def.group && !adapter.groups[def.group].options.includes(item.unit)) return fail("Scenario \"" + s.name + "\" uses an incompatible unit (" + item.unit + ") for " + def.label + ".");
            }
        }
        const baseline = scenarios.find((s) => s.id === baselineId);
        if (!baseline) return fail("The selected baseline is not among the compared scenarios.");
        const ordered = [baseline].concat(scenarios.filter((s) => s !== baseline));
        const byId = (list, id) => list.find((item) => item.id === id) || null;
        const notes = [];

        let inputRows;
        let outputRows;
        try {
            inputRows = adapter.inputs.filter((def) => ordered.some((s) => byId(s.result.inputs, def.id) && byId(s.result.inputs, def.id).value !== null)).map((def) => ({
                id: def.id, label: def.label, section: def.section || "",
                cells: ordered.map((s, i) => compareCell(adapter, def.group, i === 0 ? null : byId(baseline.result.inputs, def.id), byId(s.result.inputs, def.id)))
            }));
            outputRows = adapter.outputs.filter((def) => ordered.some((s) => byId(s.result.outputs, def.id))).map((def) => ({
                id: def.id, label: def.label, quantity: def.quantity, comparable: def.comparable !== false,
                cells: ordered.map((s, i) => compareCell(adapter, def.group, i === 0 ? null : byId(baseline.result.outputs, def.id), byId(s.result.outputs, def.id)))
            }));
        } catch (error) {
            return fail(error.message);
        }
        // Baseline cell: show the value without delta.
        [inputRows, outputRows].forEach((rows) => rows.forEach((row) => {
            const b = row.cells[0];
            if (b && !b.missing) { b.changed = false; b.delta = null; b.percent = null; b.isBaseline = true; }
        }));

        ordered.forEach((s) => {
            if (s !== baseline) {
                adapter.outputs.forEach((def) => {
                    const inBase = Boolean(byId(baseline.result.outputs, def.id));
                    const inThis = Boolean(byId(s.result.outputs, def.id));
                    if (inBase !== inThis) notes.push("\"" + s.name + "\" " + (inThis ? "reports" : "does not report") + " " + def.label + " while the baseline " + (inBase ? "does" : "does not") + " (different configuration or optional inputs).");
                });
                Object.keys(adapter.groups).forEach((key) => {
                    if (baseline.units[key] !== s.units[key]) notes.push("\"" + s.name + "\" uses " + s.units[key] + " for " + adapter.groups[key].label + " while the baseline uses " + baseline.units[key] + "; differences are calculated after unit conversion.");
                });
                const added = s.result.assumptions.filter((a) => !baseline.result.assumptions.includes(a));
                const removed = baseline.result.assumptions.filter((a) => !s.result.assumptions.includes(a));
                added.forEach((a) => notes.push("Assumption only in \"" + s.name + "\": " + a));
                removed.forEach((a) => notes.push("Assumption only in baseline: " + a));
            }
        });
        if (!notes.length) notes.push("All compared scenarios share the same calculator, method and assumptions; only the listed input values differ.");

        return {
            ok: true,
            calculatorId: adapter.id,
            calculatorName: adapter.name,
            baselineId: baseline.id,
            scenarios: ordered.map((s) => ({ id: s.id, name: s.name, calculatedAt: s.result.calculatedAt })),
            inputRows, outputRows, notes,
            assumptions: baseline.result.assumptions.slice(),
            equations: baseline.result.equations.slice(),
            method: baseline.result.method
        };
    }

    // ---------- Parametric sweeps ----------

    // params: { inputId, start, end, mode: "step"|"count", step, count, outputId }
    function planSweep(adapter, scenario, params) {
        const errors = [];
        const input = inputDef(adapter, params && params.inputId);
        const output = outputDef(adapter, params && params.outputId);
        if (!scenario || scenario.status !== "calculated" || !scenario.result) errors.push("Select a baseline scenario with a current calculated result (recalculate it first).");
        if (!input) errors.push("Select an input to vary.");
        else if (!input.sweepable) errors.push(input.label + " cannot be varied in a sweep.");
        if (!output) errors.push("Select an output to track.");
        else if (output.plottable === false) errors.push(output.label + " is not suitable for plotting.");
        const start = params ? params.start : NaN;
        const end = params ? params.end : NaN;
        if (!Number.isFinite(start)) errors.push("Start value must be a number.");
        if (!Number.isFinite(end)) errors.push("End value must be a number.");
        if (Number.isFinite(start) && Number.isFinite(end) && start === end) errors.push("Start and end values must be different.");
        if (input) {
            [["Start", start], ["End", end]].forEach(([label, v]) => {
                if (!Number.isFinite(v)) return;
                if (input.min !== undefined && (input.minExclusive ? v <= input.min : v < input.min)) {
                    errors.push(label + " value must be " + (input.minExclusive ? "greater than " : "at least ") + input.min + " for " + input.label + ".");
                }
                if (input.max !== undefined && v > input.max) errors.push(label + " value must be at most " + input.max + " for " + input.label + ".");
            });
        }
        let n = NaN;
        let values = [];
        if (Number.isFinite(start) && Number.isFinite(end) && start !== end) {
            const span = end - start;
            const direction = span > 0 ? 1 : -1;
            if (params.mode === "count") {
                const count = params.count;
                if (!Number.isInteger(count) || count < MIN_SWEEP_SAMPLES) errors.push("Number of samples must be a whole number of at least " + MIN_SWEEP_SAMPLES + ".");
                else if (count > MAX_SWEEP_SAMPLES) errors.push("Number of samples (" + count + ") exceeds the maximum of " + MAX_SWEEP_SAMPLES + ".");
                else {
                    n = count;
                    for (let i = 0; i < n; i += 1) values.push(i === n - 1 ? end : cleanNumber(start + span * i / (n - 1)));
                }
            } else {
                const step = params.step;
                if (!Number.isFinite(step) || step <= 0) errors.push("Step size must be a positive number.");
                else if (step > Math.abs(span)) errors.push("Step size must not exceed the sweep range (" + cleanNumber(Math.abs(span)) + ").");
                else {
                    n = Math.floor(Math.abs(span) / step + 1e-9) + 1;
                    if (n > MAX_SWEEP_SAMPLES) errors.push("This step size gives " + n + " samples, which exceeds the maximum of " + MAX_SWEEP_SAMPLES + ".");
                    else for (let i = 0; i < n; i += 1) values.push(cleanNumber(start + direction * step * i));
                }
            }
        }
        if (errors.length) return { ok: false, errors };
        return { ok: true, values, input, output };
    }

    function runSweep(adapter, scenario, params) {
        const plan = planSweep(adapter, scenario, params);
        if (!plan.ok) return plan;
        const { input, output, values } = plan;
        const baseInputs = {};
        scenario.result.inputs.forEach((item) => { baseInputs[item.id] = item.value; });
        const units = Object.assign({}, scenario.units);
        const points = values.map((x) => {
            const sampleInputs = Object.assign({}, baseInputs, { [input.id]: x });
            try {
                const out = adapter.calculate(sampleInputs, units);
                const y = out ? out[output.id] : undefined;
                if (y === undefined || y === null) return { x, y: null, error: output.label + " is not available for this sample." };
                if (!Number.isFinite(y)) return { x, y: null, error: "Non-finite result." };
                return { x, y, error: null };
            } catch (error) {
                return { x, y: null, error: text(error && error.message ? error.message : "Calculation failed.", 300) };
            }
        });
        const failed = points.filter((p) => p.y === null).length;
        const xUnit = unitOfInput(adapter, input, units);
        const yUnit = units[output.group];
        return {
            ok: true,
            sweep: {
                id: newId("w"),
                name: output.label + " vs " + input.label,
                calculatorId: adapter.id,
                calculatorVersion: adapter.version,
                baselineScenarioId: scenario.id,
                baselineScenarioName: scenario.name,
                createdAt: new Date().toISOString(),
                input: { id: input.id, label: input.label, unit: xUnit },
                output: { id: output.id, label: output.label, unit: yUnit, quantity: output.quantity },
                range: { start: params.start, end: params.end, mode: params.mode === "count" ? "count" : "step", step: params.mode === "count" ? null : params.step, count: points.length },
                baseInputs: scenario.result.inputs.map((item) => ({ id: item.id, label: item.label, value: item.value, unit: item.unit })),
                points,
                failedCount: failed,
                equations: scenario.result.equations.slice(),
                assumptions: scenario.result.assumptions.slice(),
                method: scenario.result.method,
                warnings: scenario.result.warnings.slice()
            }
        };
    }

    function addSweep(study, sweep) {
        if (study.sweeps.length >= MAX_SWEEPS) throw new Error("A study can hold at most " + MAX_SWEEPS + " saved sweeps.");
        const next = clone(study);
        next.sweeps.push(clone(sweep));
        return touch(next);
    }

    function removeSweep(study, sweepId) {
        const next = clone(study);
        next.sweeps = next.sweeps.filter((s) => s.id !== sweepId);
        return touch(next);
    }

    // ---------- Validation of stored data ----------

    function sanitizeNamedList(list, validate, max, issues, label) {
        const out = [];
        const seen = new Set();
        (Array.isArray(list) ? list : []).slice(0, max).forEach((raw, index) => {
            const result = validate(raw);
            if (!result.ok) { issues.push(label + " " + (index + 1) + " was dropped: " + result.error); return; }
            if (seen.has(result.value.id)) { issues.push(label + " " + (index + 1) + " was dropped: duplicate identifier."); return; }
            seen.add(result.value.id);
            out.push(result.value);
        });
        return out;
    }

    function validUnits(adapter, rawUnits) {
        const units = defaultUnits(adapter);
        if (rawUnits === undefined || rawUnits === null) return { ok: true, units };
        if (typeof rawUnits !== "object") return { ok: false };
        for (const key of Object.keys(adapter.groups)) {
            if (rawUnits[key] === undefined) continue;
            if (!adapter.groups[key].options.includes(rawUnits[key])) return { ok: false, key, unit: rawUnits[key] };
            units[key] = rawUnits[key];
        }
        return { ok: true, units };
    }

    function validResult(adapter, raw) {
        if (!raw || typeof raw !== "object" || !isIso(raw.calculatedAt)) return null;
        if (!Array.isArray(raw.inputs) || !Array.isArray(raw.outputs) || raw.outputs.length === 0) return null;
        const inputs = [];
        for (const item of raw.inputs.slice(0, 100)) {
            const def = item && inputDef(adapter, item.id);
            if (!def || !(item.value === null || Number.isFinite(item.value))) return null;
            if (def.group ? !adapter.groups[def.group].options.includes(item.unit) : item.unit !== (def.unit || "")) return null;
            inputs.push({ id: def.id, label: def.label, value: item.value, unit: item.unit });
        }
        const outputs = [];
        for (const item of raw.outputs.slice(0, 100)) {
            const def = item && outputDef(adapter, item.id);
            if (!def || !Number.isFinite(item.value) || !adapter.groups[def.group].options.includes(item.unit)) return null;
            outputs.push({ id: def.id, label: def.label, value: item.value, unit: item.unit, quantity: def.quantity });
        }
        const strings = (list) => (Array.isArray(list) ? list.filter((s) => typeof s === "string").slice(0, 60).map((s) => s.slice(0, 5000)) : []);
        return {
            calculatedAt: new Date(Date.parse(raw.calculatedAt)).toISOString(),
            calculatorVersion: text(raw.calculatorVersion, 20),
            inputs, outputs,
            equations: strings(raw.equations).map((s) => s.slice(0, 1000)),
            assumptions: strings(raw.assumptions),
            method: text(raw.method, 5000),
            warnings: strings(raw.warnings)
        };
    }

    function validateScenario(adapter, raw) {
        if (!raw || typeof raw !== "object") return { ok: false, error: "not an object." };
        if (typeof raw.id !== "string" || !/^[\w-]{1,60}$/.test(raw.id)) return { ok: false, error: "invalid identifier." };
        if (raw.calculatorId !== adapter.id) return { ok: false, error: "calculator does not match the study." };
        const unitCheck = validUnits(adapter, raw.units);
        if (!unitCheck.ok) return { ok: false, error: "unsupported unit." };
        const inputs = emptyInputs(adapter);
        const rawInputs = raw.inputs && typeof raw.inputs === "object" ? raw.inputs : {};
        for (const id of Object.keys(rawInputs)) {
            if (!(id in inputs)) continue;
            const value = rawInputs[id];
            if (!(value === null || (typeof value === "number" && Number.isFinite(value)))) return { ok: false, error: "input " + id + " is not a finite number." };
            inputs[id] = value;
        }
        let result = raw.result === null || raw.result === undefined ? null : validResult(adapter, raw.result);
        let status = STATUSES.includes(raw.status) ? raw.status : "new";
        let error = typeof raw.error === "string" ? raw.error.slice(0, 300) : null;
        if ((status === "calculated" || status === "stale") && !result) { status = "new"; }
        if (status === "calculated" && result && result.calculatorVersion !== adapter.version) status = "stale";
        if (status === "error" && !error) error = "Calculation failed.";
        return {
            ok: true,
            value: {
                id: raw.id,
                name: text(raw.name, 100).trim() || "Scenario",
                calculatorId: adapter.id,
                calculatorVersion: text(raw.calculatorVersion, 20) || adapter.version,
                inputs, units: unitCheck.units, status, error: status === "error" ? error : null, result,
                updatedAt: isIso(raw.updatedAt) ? raw.updatedAt : new Date().toISOString()
            }
        };
    }

    function validateSweep(adapter, raw) {
        if (!raw || typeof raw !== "object") return { ok: false, error: "not an object." };
        if (typeof raw.id !== "string" || !/^[\w-]{1,60}$/.test(raw.id)) return { ok: false, error: "invalid identifier." };
        const input = raw.input && inputDef(adapter, raw.input.id);
        const output = raw.output && outputDef(adapter, raw.output.id);
        if (!input || !output) return { ok: false, error: "unknown input or output." };
        if (input.group ? !adapter.groups[input.group].options.includes(raw.input.unit) : raw.input.unit !== (input.unit || "")) return { ok: false, error: "unsupported input unit." };
        if (!adapter.groups[output.group].options.includes(raw.output.unit)) return { ok: false, error: "unsupported output unit." };
        if (!Array.isArray(raw.points) || raw.points.length === 0 || raw.points.length > MAX_SWEEP_SAMPLES) return { ok: false, error: "invalid sample list." };
        const points = [];
        for (const p of raw.points) {
            if (!p || !Number.isFinite(p.x) || !(p.y === null || Number.isFinite(p.y))) return { ok: false, error: "invalid sample." };
            points.push({ x: p.x, y: p.y, error: p.y === null ? text(p.error || "Calculation failed.", 300) : null });
        }
        const baseInputs = [];
        for (const item of Array.isArray(raw.baseInputs) ? raw.baseInputs.slice(0, 100) : []) {
            const def = item && inputDef(adapter, item.id);
            if (!def || !(item.value === null || Number.isFinite(item.value))) return { ok: false, error: "invalid baseline input." };
            baseInputs.push({ id: def.id, label: def.label, value: item.value, unit: text(item.unit, 40) });
        }
        const r = raw.range || {};
        if (!Number.isFinite(r.start) || !Number.isFinite(r.end)) return { ok: false, error: "invalid range." };
        const strings = (list) => (Array.isArray(list) ? list.filter((s) => typeof s === "string").slice(0, 60).map((s) => s.slice(0, 5000)) : []);
        return {
            ok: true,
            value: {
                id: raw.id,
                name: text(raw.name, 150) || output.label + " vs " + input.label,
                calculatorId: adapter.id,
                calculatorVersion: text(raw.calculatorVersion, 20),
                baselineScenarioId: text(raw.baselineScenarioId, 60),
                baselineScenarioName: text(raw.baselineScenarioName, 100),
                createdAt: isIso(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
                input: { id: input.id, label: input.label, unit: raw.input.unit },
                output: { id: output.id, label: output.label, unit: raw.output.unit, quantity: output.quantity },
                range: { start: r.start, end: r.end, mode: r.mode === "count" ? "count" : "step", step: Number.isFinite(r.step) ? r.step : null, count: points.length },
                baseInputs, points,
                failedCount: points.filter((p) => p.y === null).length,
                equations: strings(raw.equations).map((s) => s.slice(0, 1000)),
                assumptions: strings(raw.assumptions),
                method: text(raw.method, 5000),
                warnings: strings(raw.warnings)
            }
        };
    }

    function validateStudy(raw) {
        if (!raw || typeof raw !== "object") return { ok: false, error: "not an object.", issues: [] };
        if (typeof raw.id !== "string" || !/^[\w-]{1,60}$/.test(raw.id)) return { ok: false, error: "invalid identifier.", issues: [] };
        const adapter = getAdapter(raw.calculatorId);
        if (!adapter) return { ok: false, error: "calculator \"" + text(raw.calculatorId, 60) + "\" is not supported.", issues: [] };
        const issues = [];
        const name = text(raw.name, 100).trim() || "Untitled study";
        const scenarios = sanitizeNamedList(raw.scenarios, (s) => validateScenario(adapter, s), MAX_SCENARIOS, issues, "Scenario");
        const sweeps = sanitizeNamedList(raw.sweeps, (s) => validateSweep(adapter, s), MAX_SWEEPS, issues, "Sweep");
        const baselineId = scenarios.some((s) => s.id === raw.baselineId) ? raw.baselineId : (scenarios[0] ? scenarios[0].id : null);
        return {
            ok: true,
            issues: issues.map((message) => "Study \"" + name + "\": " + message),
            value: {
                id: raw.id, name, calculatorId: adapter.id,
                createdAt: isIso(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
                updatedAt: isIso(raw.updatedAt) ? raw.updatedAt : new Date().toISOString(),
                baselineId, scenarios, sweeps
            }
        };
    }

    // Returns { studies, issues }; invalid studies/scenarios/sweeps are dropped individually.
    function sanitizeStudies(raw) {
        const issues = [];
        if (!raw || typeof raw !== "object" || raw.schemaVersion !== SCHEMA_VERSION) {
            if (raw !== null && raw !== undefined) issues.push("Saved studies use an unsupported or outdated format and were not loaded (a backup copy was kept in this browser).");
            return { studies: [], issues, unsupported: raw !== null && raw !== undefined };
        }
        const studies = [];
        const seen = new Set();
        (Array.isArray(raw.studies) ? raw.studies : []).slice(0, MAX_STUDIES).forEach((entry, index) => {
            const result = validateStudy(entry);
            if (!result.ok) { issues.push("Study " + (index + 1) + " was dropped: " + result.error); return; }
            if (seen.has(result.value.id)) { issues.push("Study " + (index + 1) + " was dropped: duplicate identifier."); return; }
            seen.add(result.value.id);
            issues.push.apply(issues, result.issues);
            studies.push(result.value);
        });
        return { studies, issues, unsupported: false };
    }

    // ---------- Persistence ----------

    function defaultStorage() {
        try { return root.localStorage || null; } catch (error) { return null; }
    }

    function createStudyStore(initialStorage) {
        let storage = initialStorage === undefined ? defaultStorage() : initialStorage;
        let memory = null;

        function load() {
            let rawText = null;
            if (storage) {
                try { rawText = storage.getItem(STORAGE_KEY); } catch (error) { rawText = null; }
            }
            if ((rawText === null || rawText === undefined) && memory) rawText = memory;
            if (rawText === null || rawText === undefined) return { studies: [], issues: [] };
            let parsed;
            try { parsed = JSON.parse(rawText); } catch (error) {
                backup(rawText);
                return { studies: [], issues: ["Saved studies could not be read (corrupt data) and were not loaded; a backup copy was kept in this browser."] };
            }
            const result = sanitizeStudies(parsed);
            if (result.unsupported) backup(rawText);
            return { studies: result.studies, issues: result.issues };
        }

        function backup(rawText) {
            if (!storage) return;
            try { if (storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, rawText); } catch (error) { /* ignore */ }
        }

        // Returns true when written to localStorage, false when only kept in memory for the session.
        function save(studies) {
            const serialised = JSON.stringify({ schemaVersion: SCHEMA_VERSION, studies });
            if (storage) {
                try { storage.setItem(STORAGE_KEY, serialised); memory = null; return true; } catch (error) { /* quota or access */ }
            }
            memory = serialised;
            return false;
        }

        return { load, save, setStorage(next) { storage = next; memory = null; } };
    }

    // ---------- Report snapshots (immutable copies) ----------

    function fmt(value) {
        if (typeof value !== "number") return String(value);
        if (value === 0) return "0";
        return String(Number(value.toPrecision(6)));
    }

    function inputItems(list) {
        return list.map((item) => ({ label: item.label, value: item.value === null ? "not supplied" : item.value, unit: item.unit }));
    }

    function studyMeta(study, kind, names) {
        return { id: study.id, name: study.name, kind, scenarios: names.map((n) => text(n, 100)), savedAt: study.updatedAt };
    }

    function reportSnapshotBase(adapter, study, kind, names) {
        return {
            calculatorId: adapter.id,
            calculatorName: adapter.name,
            path: "design-studies.html",
            study: studyMeta(study, kind, names),
            equations: [], assumptions: [], warnings: []
        };
    }

    function scenarioReportSnapshot(study, scenario) {
        const adapter = getAdapter(study.calculatorId);
        if (!adapter) return { ok: false, error: "Unsupported calculator." };
        if (scenario.status !== "calculated" || !scenario.result) return { ok: false, error: "Scenario \"" + scenario.name + "\" has no current calculated result. Recalculate it first." };
        const r = scenario.result;
        return {
            ok: true,
            snapshot: Object.assign(reportSnapshotBase(adapter, study, "scenario", [scenario.name]), {
                title: study.name + " - " + scenario.name,
                inputs: inputItems(r.inputs),
                outputs: r.outputs.map((o) => ({ label: o.label, value: o.value, unit: o.unit })),
                equations: r.equations, assumptions: r.assumptions, method: r.method,
                warnings: r.warnings.concat(["Design study scenario calculated " + r.calculatedAt + " (calculator revision " + r.calculatorVersion + ")."])
            })
        };
    }

    function cellText(cell) {
        if (cell.missing) return "n/a";
        return fmt(cell.value) + (cell.unit ? " " + cell.unit : "");
    }

    function diffText(cell) {
        if (cell.isBaseline) return "baseline";
        if (cell.missing) return "n/a";
        if (cell.delta === null) return cell.note || "n/a";
        const sign = cell.delta > 0 ? "+" : "";
        const pct = cell.percent && cell.percent.value !== null ? " (" + (cell.percent.value > 0 ? "+" : "") + fmt(cell.percent.value) + " %)" : (cell.percent ? " (" + cell.percent.reason + ")" : "");
        return (cell.changed ? "" : "unchanged ") + sign + fmt(cell.delta) + " " + cell.deltaUnit + pct;
    }

    function comparisonTableRows(rows, comparison) {
        return rows.map((row) => {
            const cells = [row.label];
            row.cells.forEach((cell, i) => { cells.push(i === 0 ? cellText(cell) : cellText(cell) + " \u2192 " + diffText(cell)); });
            return cells;
        });
    }

    function comparisonReportSnapshot(study, scenarios, baselineId) {
        const adapter = getAdapter(study.calculatorId);
        if (!adapter) return { ok: false, error: "Unsupported calculator." };
        const cmp = compareScenarios(scenarios, baselineId);
        if (!cmp.ok) return cmp;
        const head = ["Quantity"].concat(cmp.scenarios.map((s, i) => s.name + (i === 0 ? " (baseline)" : " (difference from baseline)")));
        const baseOutputs = cmp.outputRows.find((r) => r.cells[0] && !r.cells[0].missing);
        const baseline = scenarios.find((s) => s.id === baselineId);
        return {
            ok: true,
            comparison: cmp,
            snapshot: Object.assign(reportSnapshotBase(adapter, study, "comparison", cmp.scenarios.map((s) => s.name)), {
                title: study.name + " - scenario comparison",
                inputs: [
                    { label: "Study", value: study.name, unit: "" },
                    { label: "Baseline scenario", value: baseline.name, unit: "" },
                    { label: "Scenarios compared", value: cmp.scenarios.map((s) => s.name).join("; "), unit: "" }
                ],
                outputs: baseOutputs
                    ? cmp.outputRows.filter((r) => r.cells[0] && !r.cells[0].missing).map((r) => ({ label: r.label + " (baseline)", value: r.cells[0].value, unit: r.cells[0].unit }))
                    : [{ label: "Scenarios compared", value: cmp.scenarios.length, unit: "" }],
                tables: [
                    { caption: "Input comparison (differences are relative to the baseline; no value is implied to be better or worse)", columns: head, rows: comparisonTableRows(cmp.inputRows) },
                    { caption: "Output comparison (differences are relative to the baseline; no value is implied to be better or worse)", columns: head, rows: comparisonTableRows(cmp.outputRows) }
                ],
                equations: cmp.equations, assumptions: cmp.assumptions.concat(cmp.notes), method: cmp.method,
                warnings: ["Comparison of saved scenario snapshots; differences are shown after unit conversion to the baseline's units. Percentage changes are omitted where undefined."]
            })
        };
    }

    function sweepChart(sweep) {
        return {
            type: "line",
            title: sweep.output.label + " vs " + sweep.input.label,
            xLabel: sweep.input.label + (sweep.input.unit ? " [" + sweep.input.unit + "]" : ""),
            yLabel: sweep.output.label + (sweep.output.unit ? " [" + sweep.output.unit + "]" : ""),
            points: sweep.points.map((p) => ({ x: p.x, y: p.y }))
        };
    }

    function sweepTableRows(sweep) {
        return sweep.points.map((p) => [fmt(p.x), p.y === null ? "FAILED" : fmt(p.y), p.error || "OK"]);
    }

    function sweepReportSnapshot(study, sweep) {
        const adapter = getAdapter(study.calculatorId);
        if (!adapter) return { ok: false, error: "Unsupported calculator." };
        const good = sweep.points.filter((p) => p.y !== null);
        if (!good.length) return { ok: false, error: "The sweep has no valid points to report." };
        const ys = good.map((p) => p.y);
        return {
            ok: true,
            snapshot: Object.assign(reportSnapshotBase(adapter, study, "sweep", [sweep.baselineScenarioName]), {
                title: study.name + " - " + sweep.name,
                inputs: inputItems(sweep.baseInputs).concat([
                    { label: "Baseline scenario", value: sweep.baselineScenarioName || "(removed)", unit: "" },
                    { label: "Varied input: " + sweep.input.label + " (start)", value: sweep.range.start, unit: sweep.input.unit },
                    { label: "Varied input: " + sweep.input.label + " (end)", value: sweep.range.end, unit: sweep.input.unit },
                    { label: "Number of samples", value: sweep.points.length, unit: "" }
                ]),
                outputs: [
                    { label: "Minimum " + sweep.output.label, value: Math.min.apply(null, ys), unit: sweep.output.unit },
                    { label: "Maximum " + sweep.output.label, value: Math.max.apply(null, ys), unit: sweep.output.unit },
                    { label: "Samples calculated / failed", value: good.length + " / " + sweep.failedCount, unit: "" }
                ],
                tables: [{
                    caption: "Sweep data: " + sweep.output.label + " [" + sweep.output.unit + "] against " + sweep.input.label + " [" + sweep.input.unit + "]",
                    columns: [sweep.input.label + " [" + sweep.input.unit + "]", sweep.output.label + " [" + sweep.output.unit + "]", "Status"],
                    rows: sweepTableRows(sweep)
                }],
                chart: sweepChart(sweep),
                equations: sweep.equations, assumptions: sweep.assumptions, method: sweep.method,
                warnings: [SWEEP_NOTE, "All inputs other than " + sweep.input.label + " are held at the baseline scenario values listed above."].concat(sweep.warnings)
            })
        };
    }

    root.FormulaFoundryStudies = {
        STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION, MAX_SWEEP_SAMPLES, MIN_SWEEP_SAMPLES, MAX_SCENARIOS, MAX_SWEEPS, MAX_STUDIES, SWEEP_NOTE,
        registerAdapter, getAdapter, listAdapters, convertUnit, defaultUnits, unitOfInput,
        createScenario, duplicateScenario, renameScenario, setScenarioInput, setScenarioUnit, calculateScenario,
        createStudy, addScenario, replaceScenario, removeScenario, setBaseline,
        percentDifference, compareScenarios,
        planSweep, runSweep, addSweep, removeSweep, sweepChart, sweepTableRows,
        sanitizeStudies, createStudyStore,
        scenarioReportSnapshot, comparisonReportSnapshot, sweepReportSnapshot,
        formatValue: fmt
    };
})(window);
