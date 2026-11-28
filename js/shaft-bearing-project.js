// Portable shaft projects store physical inputs in base units. Display preferences
// can change without re-solving the model or rounding the saved physical inputs.
(function (root) {
    "use strict";

    const model = root.FormulaFoundryShaftBearing;
    const SCHEMA_VERSION = 1;
    const STORAGE_KEY = "formulaFoundry.shaftBearingProject";
    const MAX_FILE_BYTES = 256 * 1024;
    const MAX_CONFIGURATIONS = 8;
    const limits = { title: 100, description: 400, notes: 800, configuration: 70, load: 50, loadNotes: 160 };

    function group(label, defaultUnit, options, factors, output = false) {
        return { label, defaultUnit, options, factors, output };
    }

    const sectionModulusUnits = { "mm³": distanceUnits.mm ** 3, "m³": 1, "in³": distanceUnits.in ** 3 };
    const sectionInertiaUnits = { "mm⁴": inertiaUnits["mm⁴"], "m⁴": 1, "in⁴": distanceUnits.in ** 4 };
    const lengthOptions = ["m", "mm", "ft", "in"];
    const diameterOptions = ["mm", "m", "in"];
    const forceOptions = ["N", "kN", "lbf"];
    const torqueOptions = ["N·m", "N·mm", "kN·m", "lbf·in", "lbf·ft"];
    const strengthOptions = ["MPa", "Pa", "psi", "ksi"];
    const unitGroups = {
        length: group("Span and station position", "m", lengthOptions, distanceUnits),
        diameter: group("Shaft diameter", "mm", diameterOptions, distanceUnits),
        force: group("Load and bearing rating", "N", forceOptions, forceUnits),
        torque: group("Applied torque", "N·m", torqueOptions, momentUnits),
        modulus: group("Elastic modulus", "GPa", ["GPa", "MPa", "Pa", "ksi", "psi"], stressUnits),
        strength: group("Yield strength", "MPa", strengthOptions, stressUnits),
        density: group("Density", "kg/m³", ["kg/m³", "lb/ft³"], fluidThermalUnits.density),
        speed: group("Shaft speed", "rpm", ["rpm", "rps"], rotationalSpeedUnits),
        outputLength: group("Span and station position", "m", lengthOptions, distanceUnits, true),
        outputDiameter: group("Shaft diameter", "mm", diameterOptions, distanceUnits, true),
        outputForce: group("Force and bearing rating", "N", forceOptions, forceUnits, true),
        outputTorque: group("Torque", "N·m", torqueOptions, momentUnits, true),
        stress: group("Stress", "MPa", strengthOptions, stressUnits, true),
        deflection: group("Deflection", "mm", ["mm", "µm", "m", "in"], distanceUnits, true),
        moment: group("Bending moment", "N·m", torqueOptions, momentUnits, true),
        area: group("Area", "mm²", ["mm²", "m²", "in²"], areaUnits, true),
        inertia: group("Second and polar moments of area", "mm⁴", Object.keys(sectionInertiaUnits), sectionInertiaUnits, true),
        sectionModulus: group("Section modulus", "mm³", Object.keys(sectionModulusUnits), sectionModulusUnits, true),
        mass: group("Mass", "kg", ["kg", "lb"], { kg: 1, lb: 0.45359237 }, true),
        angle: group("Angle", "°", ["°", "rad"], { "°": Math.PI / 180, rad: 1 }, true)
    };

    function defaultUnits() {
        return Object.fromEntries(Object.entries(unitGroups).map(([key, spec]) => [key, spec.defaultUnit]));
    }

    function validUnit(groupKey, unit) {
        return Object.hasOwn(unitGroups, groupKey) && unitGroups[groupKey].options.includes(unit);
    }

    function toSI(value, groupKey, unit) {
        return validUnit(groupKey, unit) && Number.isFinite(value) ? value * unitGroups[groupKey].factors[unit] : NaN;
    }

    function fromSI(value, groupKey, unit) {
        return validUnit(groupKey, unit) && Number.isFinite(value) ? value / unitGroups[groupKey].factors[unit] : NaN;
    }

    function changeUnit(configuration, groupKey, unit) {
        if (!validUnit(groupKey, unit)) throw new Error("Select a supported unit.");
        if (configuration.units[groupKey] === unit) return configuration;
        return { ...configuration, units: { ...configuration.units, [groupKey]: unit } };
    }

    const materialFields = {
        youngModulus: "youngsModulus",
        shearModulus: "shearModulus",
        yieldStrength: "yieldStrength",
        density: "density"
    };
    const propertyKeys = Object.keys(materialFields);

    function validMaterialId(id) {
        return id === "" || getMaterialList().includes(id);
    }

    function presetProperty(id, field) {
        const property = materialFields[field];
        const value = id ? getMaterialProperty(id, property) : null;
        const basis = id ? getMaterialPropertyBasis(id, property) : null;
        return {
            value: Number.isFinite(value) && value > 0 && basis !== "unverified" ? value : null,
            basis
        };
    }

    function applyMaterial(inputs, materialId) {
        if (!validMaterialId(materialId)) throw new Error("Select a supported material.");
        if (inputs.materialId === materialId) return inputs;
        return {
            ...inputs,
            materialId,
            material: Object.fromEntries(propertyKeys.map((field) => [field, presetProperty(materialId, field).value])),
            materialOverrides: []
        };
    }

    function setMaterialProperty(inputs, field, value) {
        if (!Object.hasOwn(materialFields, field) || !isValue(value)) throw new Error("Enter a valid material property.");
        if (inputs.material[field] === value) return inputs;
        const overrides = new Set(inputs.materialOverrides);
        if (value === presetProperty(inputs.materialId, field).value) overrides.delete(field);
        else overrides.add(field);
        return {
            ...inputs, material: { ...inputs.material, [field]: value },
            materialOverrides: propertyKeys.filter((key) => overrides.has(key))
        };
    }

    function materialInfo(inputs) {
        const id = inputs.materialId;
        const preset = id && getMaterial(id);
        const metadata = id && getMaterialMetadata(id);
        const properties = Object.fromEntries(propertyKeys.map((field) => {
            const value = inputs.material[field];
            const override = inputs.materialOverrides.includes(field);
            const { basis: referenceBasis } = presetProperty(id, field);
            let basis = referenceBasis || "reference";
            let basisLabel = MATERIAL_PROPERTY_BASES[basis] || "Reference value";
            if (value === null) {
                basis = "unavailable";
                if (override) basisLabel = "Unavailable (cleared manually)";
                else if (referenceBasis === "unverified") basisLabel = "Unavailable (reference value unverified)";
                else basisLabel = "Unavailable";
            } else if (override || !id) {
                basis = "manual";
                basisLabel = "User-entered value";
            }
            return [field, { value, basis, basisLabel }];
        }));
        return {
            id, name: preset?.displayName || "Manual properties", designation: metadata?.designation || "",
            condition: metadata?.condition || "", productForm: metadata?.productForm || "",
            referenceTemperatureC: metadata?.referenceTemperatureC ?? null,
            caveats: metadata?.caveats || "", sources: id ? getMaterialSources(id) : [], properties
        };
    }

    function newId() {
        return root.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    }

    function newLoad() {
        return { id: newId(), name: "", position: null, fy: 0, fz: 0, notes: "" };
    }

    function newProject() {
        const id = newId();
        const bearing = { type: "ball", dynamicRating: null, staticRating: null, targetHours: null };
        const inputs = {
            span: null, section: "solid", outerDiameter: null, innerDiameter: null, materialId: "",
            material: Object.fromEntries(propertyKeys.map((field) => [field, null])), materialOverrides: [],
            speed: 0, torque: { value: 0, start: 0, end: 0 }, loads: [],
            bearings: { a: { ...bearing }, b: { ...bearing } }
        };
        return {
            title: "", description: "", notes: "", activeId: id, baselineId: id,
            configurations: [{ id, name: "Baseline", inputs, units: defaultUnits(), status: "draft", result: null }]
        };
    }

    function duplicate(configuration) {
        const { inputs } = configuration;
        return {
            id: newId(), name: configuration.name.slice(0, limits.configuration - 7) + " (copy)",
            units: { ...configuration.units },
            inputs: {
                ...inputs, material: { ...inputs.material }, materialOverrides: [...inputs.materialOverrides],
                torque: { ...inputs.torque }, loads: inputs.loads.map((load) => ({ ...load })),
                bearings: { a: { ...inputs.bearings.a }, b: { ...inputs.bearings.b } }
            },
            status: "draft", result: null
        };
    }

    function edit(configuration, inputs) {
        if (inputs === configuration.inputs) return configuration;
        return { ...configuration, inputs, status: configuration.status === "draft" ? "draft" : "stale", result: null };
    }

    function solved(configuration, result) {
        if (!result.ok) {
            return { ...configuration, status: configuration.status === "draft" ? "draft" : "stale", result: null };
        }
        return { ...configuration, status: "calculated", result };
    }

    function current(configuration) {
        return configuration?.status === "calculated" && configuration.result?.ok
            && configuration.result.modelVersion === model.MODEL_VERSION ? configuration.result : null;
    }

    function name(configuration) {
        return configuration.name.trim() || "Unnamed configuration";
    }

    function percent(reference, value) {
        if (!Number.isFinite(reference) || reference === 0 || !Number.isFinite(value)) return null;
        const difference = (value - reference) / Math.abs(reference) * 100;
        return Number.isFinite(difference) ? difference : null;
    }

    function hasShape(value, keys) {
        return value !== null && typeof value === "object" && !Array.isArray(value)
            && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
    }

    const isText = (value, max) => typeof value === "string" && value.length <= max;
    const isValue = (value) => value === null || Number.isFinite(value);
    const isId = (value) => typeof value === "string" && /^[a-z0-9-]{1,60}$/i.test(value);
    const numericFields = ["span", "outerDiameter", "innerDiameter", "speed"];
    const unitKeys = Object.keys(unitGroups);

    function validInputs(inputs) {
        if (!hasShape(inputs, [...numericFields, "section", "materialId", "material", "materialOverrides", "torque", "loads", "bearings"])
            || !["solid", "hollow"].includes(inputs.section) || !numericFields.every((field) => isValue(inputs[field]))
            || !validMaterialId(inputs.materialId) || !hasShape(inputs.material, propertyKeys)
            || !Array.isArray(inputs.materialOverrides)) return false;

        const overrides = new Set(inputs.materialOverrides);
        if (overrides.size !== inputs.materialOverrides.length
            || [...overrides].some((field) => typeof field !== "string" || !Object.hasOwn(materialFields, field))) {
            return false;
        }
        if (!propertyKeys.every((field) => isValue(inputs.material[field])
            && (overrides.has(field) || inputs.material[field] === presetProperty(inputs.materialId, field).value))) return false;

        const torqueFields = ["value", "start", "end"];
        if (!hasShape(inputs.torque, torqueFields) || !torqueFields.every((field) => isValue(inputs.torque[field]))
            || !Array.isArray(inputs.loads) || inputs.loads.length > model.MAX_LOADS || !hasShape(inputs.bearings, ["a", "b"])) return false;

        const ratings = ["dynamicRating", "staticRating", "targetHours"];
        if (!Object.values(inputs.bearings).every((bearing) => hasShape(bearing, ["type", ...ratings])
            && ["ball", "roller"].includes(bearing.type) && ratings.every((field) => isValue(bearing[field])))) return false;

        const ids = new Set();
        const loadValues = ["position", "fy", "fz"];
        return inputs.loads.every((load) => {
            if (!hasShape(load, ["id", "name", "notes", ...loadValues]) || !isId(load.id) || ids.has(load.id)
                || !isText(load.name, limits.load) || !isText(load.notes, limits.loadNotes)
                || !loadValues.every((field) => isValue(load[field]))) return false;
            ids.add(load.id);
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
        let envelope;
        try {
            envelope = JSON.parse(source);
        } catch {
            return failure("The workflow file is invalid JSON.");
        }

        if (!hasShape(envelope, ["workflowId", "schemaVersion", "modelVersion", "project"]) || envelope.workflowId !== model.ID) {
            return failure("Select a Formula Foundry Shaft & Bearing System Designer project file.");
        }
        if (envelope.schemaVersion !== SCHEMA_VERSION || envelope.modelVersion !== model.MODEL_VERSION) {
            return failure("This workflow schema or calculation model version is unsupported.");
        }

        const project = envelope.project;
        if (!hasShape(project, ["title", "description", "notes", "activeId", "baselineId", "configurations"])
            || !["title", "description", "notes"].every((key) => isText(project[key], limits[key]))
            || !Array.isArray(project.configurations) || project.configurations.length < 1
            || project.configurations.length > MAX_CONFIGURATIONS) return failure("The workflow project structure is invalid.");

        const ids = new Set();
        const configurations = [];
        for (const [index, configuration] of project.configurations.entries()) {
            const label = "Configuration " + (index + 1);
            if (!hasShape(configuration, ["id", "name", "status", "inputs", "units"])
                || !isId(configuration.id) || ids.has(configuration.id) || !isText(configuration.name, limits.configuration)
                || !["draft", "stale", "calculated"].includes(configuration.status) || !validInputs(configuration.inputs)
                || !hasShape(configuration.units, unitKeys) || !unitKeys.every((key) => validUnit(key, configuration.units[key]))) {
                return failure(label + " contains invalid inputs, units or records.");
            }
            ids.add(configuration.id);
            if (configuration.status === "calculated") {
                const result = model.calculate(configuration.inputs);
                if (!result.ok) return failure(label + " could not be recalculated. " + result.errors[0].message);
                configurations.push(solved(configuration, result));
            } else {
                configurations.push({ ...configuration, result: null });
            }
        }
        if (!ids.has(project.activeId) || !ids.has(project.baselineId)) {
            return failure("The saved active configuration or baseline is missing.");
        }
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

    root.FormulaFoundryShaftProject = {
        STORAGE_KEY, MAX_FILE_BYTES, MAX_CONFIGURATIONS, limits,
        newLoad, newProject, duplicate, edit, solved, current, name, percent, serialize, parse, createStore,
        unitGroups, defaultUnits, validUnit, toSI, fromSI, changeUnit, applyMaterial, setMaterialProperty, materialInfo
    };
})(window);
