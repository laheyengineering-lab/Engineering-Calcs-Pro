// Browser-independent project state. Portable projects store inputs and calculation
// status; a calculated configuration is solved again when it is loaded.
(function (root) {
    "use strict";

    const model = root.FormulaFoundryFluidSystem;
    const SCHEMA_VERSION = 1;
    const STORAGE_KEY = "formulaFoundry.fluidSystemProject";
    const MAX_FILE_BYTES = 256 * 1024;
    const MAX_CONFIGURATIONS = 8;
    const limits = { title: 100, description: 400, notes: 800, configuration: 70, segment: 50, segmentNotes: 160 };

    function newId() {
        return root.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    }

    function newSegment() {
        return { id: newId(), name: "", diameter: null, length: null, roughness: null, minorCoefficient: null, notes: "" };
    }

    function newProject() {
        const id = newId();
        const inputs = {
            systemType: "closed", flow: null, density: null, viscosityMode: "dynamicViscosity",
            dynamicViscosity: null, kinematicViscosity: null, efficiency: null, elevation: null,
            units: model.defaultUnits(), segments: [newSegment()]
        };
        return {
            title: "", description: "", notes: "", activeId: id, baselineId: id,
            configurations: [{ id, name: "Baseline", inputs, status: "draft", result: null }]
        };
    }

    function exampleProject() {
        const project = newProject();
        project.title = "Wash-water transfer";
        project.description = "Transfer water from a supply tank to an elevated wash-water reservoir.";
        project.notes = "Water properties near 20 °C. Geometry, roughness, and aggregate K values are example inputs.";
        const base = project.configurations[0];
        base.name = "Original piping";
        Object.assign(base.inputs, {
            systemType: "open", flow: 24, density: 998, dynamicViscosity: 1, efficiency: 65, elevation: 3.5,
            segments: [
                { ...newSegment(), name: "Transfer main", diameter: 32, length: 8, roughness: 0.045, minorCoefficient: 1.5 },
                { ...newSegment(), name: "Service run", diameter: 25, length: 14, roughness: 0.045, minorCoefficient: 4 },
                { ...newSegment(), name: "Discharge", diameter: 20, length: 4, roughness: 0.045, minorCoefficient: 2 }
            ]
        });
        return project;
    }

    function duplicate(configuration) {
        const inputs = configuration.inputs;
        return {
            id: newId(), name: configuration.name.slice(0, limits.configuration - 7) + " (copy)",
            inputs: { ...inputs, units: { ...inputs.units }, segments: inputs.segments.map((segment) => ({ ...segment })) },
            status: "draft", result: null
        };
    }

    function edit(configuration, inputs) {
        const status = configuration.status === "draft" ? "draft" : "stale";
        return { ...configuration, inputs, status, result: null };
    }

    function solved(configuration, result) {
        if (!result.ok) return edit(configuration, configuration.inputs);
        return { ...configuration, status: "calculated", result };
    }

    function current(configuration) {
        return configuration?.status === "calculated" && configuration.result?.modelVersion === model.MODEL_VERSION
            ? configuration.result : null;
    }

    function name(configuration) {
        return configuration.name.trim() || "Unnamed configuration";
    }

    function percent(reference, value) {
        if (!(reference > 0) || !Number.isFinite(value)) return null;
        const difference = (value / reference - 1) * 100;
        return Number.isFinite(difference) ? difference : null;
    }

    function hasShape(value, keys) {
        return value !== null && typeof value === "object" && !Array.isArray(value)
            && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
    }

    const isText = (value, max) => typeof value === "string" && value.length <= max;
    const isValue = (value) => value === null || Number.isFinite(value);
    const isId = (value) => typeof value === "string" && /^[a-z0-9-]{1,60}$/i.test(value);
    const inputFields = ["flow", "density", "dynamicViscosity", "kinematicViscosity", "efficiency", "elevation"];
    const segmentFields = ["diameter", "length", "roughness", "minorCoefficient"];

    function validInputs(inputs) {
        const unitKeys = Object.keys(model.unitGroups);
        if (!hasShape(inputs, [...inputFields, "systemType", "viscosityMode", "units", "segments"])
            || !Object.keys(model.systems).includes(inputs.systemType)
            || !["dynamicViscosity", "kinematicViscosity"].includes(inputs.viscosityMode)
            || !inputFields.every((field) => isValue(inputs[field]))
            || !hasShape(inputs.units, unitKeys) || !unitKeys.every((key) => model.validUnit(key, inputs.units[key]))
            || !Array.isArray(inputs.segments) || inputs.segments.length < 1 || inputs.segments.length > model.MAX_SEGMENTS) return false;
        const ids = new Set();
        return inputs.segments.every((segment) => {
            if (!hasShape(segment, ["id", "name", "notes", ...segmentFields]) || !isId(segment.id) || ids.has(segment.id)
                || !isText(segment.name, limits.segment) || !isText(segment.notes, limits.segmentNotes)
                || !segmentFields.every((field) => isValue(segment[field]))) return false;
            ids.add(segment.id);
            return true;
        });
    }

    function serialize(project) {
        const configurations = project.configurations.map(({ result, ...configuration }) => configuration);
        return JSON.stringify({
            workflowId: model.ID, schemaVersion: SCHEMA_VERSION, modelVersion: model.MODEL_VERSION,
            project: { ...project, configurations }
        }, null, 2);
    }

    function parse(source) {
        const failure = (error) => ({ ok: false, error });
        if (typeof source !== "string" || source.length > MAX_FILE_BYTES || new Blob([source]).size > MAX_FILE_BYTES) {
            return failure("Workflow files must be 256 KiB or smaller.");
        }
        let raw;
        try {
            raw = JSON.parse(source);
        } catch {
            return failure("The workflow file is invalid JSON.");
        }
        if (!hasShape(raw, ["workflowId", "schemaVersion", "modelVersion", "project"]) || raw.workflowId !== model.ID) {
            return failure("Select a Formula Foundry Fluid System Designer project file.");
        }
        if (raw.schemaVersion !== SCHEMA_VERSION || raw.modelVersion !== model.MODEL_VERSION) {
            return failure("This workflow schema or calculation model version is unsupported.");
        }

        const project = raw.project;
        if (!hasShape(project, ["title", "description", "notes", "activeId", "baselineId", "configurations"])
            || !["title", "description", "notes"].every((key) => isText(project[key], limits[key]))
            || !Array.isArray(project.configurations) || project.configurations.length < 1
            || project.configurations.length > MAX_CONFIGURATIONS) return failure("The workflow project structure is invalid.");

        const ids = new Set();
        const configurations = [];
        for (const [index, configuration] of project.configurations.entries()) {
            const label = "Configuration " + (index + 1);
            if (!hasShape(configuration, ["id", "name", "status", "inputs"]) || !isId(configuration.id) || ids.has(configuration.id)
                || !isText(configuration.name, limits.configuration) || !["draft", "stale", "calculated"].includes(configuration.status)
                || !validInputs(configuration.inputs)) return failure(label + " contains invalid inputs, units or records.");
            ids.add(configuration.id);
            if (configuration.status === "calculated") {
                const result = model.calculate(configuration.inputs);
                if (!result.ok) return failure(label + " could not be recalculated. " + result.errors[0].message);
                configurations.push(solved(configuration, result));
            } else {
                configurations.push({ ...configuration, result: null });
            }
        }
        if (!ids.has(project.activeId) || !ids.has(project.baselineId)) return failure("The saved active configuration or baseline is missing.");
        return { ok: true, project: { ...project, configurations } };
    }

    function createStore(storage) {
        return {
            load() {
                try {
                    const source = storage.getItem(STORAGE_KEY);
                    return source === null ? { ok: true, project: null } : parse(source);
                } catch {
                    return { ok: false, error: "Browser storage is unavailable. Export a workflow file to keep this project." };
                }
            },
            save(project) {
                try {
                    storage.setItem(STORAGE_KEY, serialize(project));
                    return true;
                } catch {
                    return false;
                }
            }
        };
    }

    root.FormulaFoundryFluidProject = {
        STORAGE_KEY, MAX_FILE_BYTES, MAX_CONFIGURATIONS, limits, newSegment, newProject, exampleProject,
        duplicate, edit, solved, current, name, percent, serialize, parse, createStore
    };
})(window);
