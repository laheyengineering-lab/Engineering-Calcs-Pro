// Deterministic series-flow analysis. Inputs carry display units; all solved quantities are SI.
(function (root) {
    "use strict";

    const ID = "fluid-system";
    const MODEL_VERSION = 1;
    const MAX_SEGMENTS = 8;
    const MAX_SWEEP_SAMPLES = 100;
    const systems = {
        closed: {
            label: "Closed recirculating loop",
            assumption: "The circuit returns to its starting point. Its net elevation contribution is zero and the pump offsets the summed hydraulic losses."
        },
        open: {
            label: "Open reservoir-to-reservoir transfer",
            assumption: "The reservoir free surfaces share the same reference pressure and have negligible velocity. Elevation is outlet minus inlet and can be negative."
        }
    };
    const assumptions = [
        "Steady, fully developed single-phase incompressible flow in full circular pipes. The same flow and fluid properties apply throughout the single series path.",
        "Use operating-condition density and viscosity. Each fitting K is referenced to the velocity in its own segment. Include applicable entrance, exit and diameter-change losses in the supplied K values.",
        "Darcy–Weisbach uses 64/Re for laminar flow and Colebrook–White for turbulent flow. Between Re 2,300 and 4,000, the solver interpolates the endpoint Darcy factors. Transition depends on disturbances and geometry.",
        "The model supports relative roughness up to 0.05 and turbulent Reynolds number up to 100 million. Head uses standard gravity (9.80665 m/s²).",
        "Pump efficiency is an input at the target duty. Shaft power excludes motor and drive losses."
    ];
    const limitations = [
        "The model covers a single series path. Branches, parallel paths, leakage and distributed withdrawals are outside its scope.",
        "The model assumes uniform liquid properties. Compressible gas flow, two-phase flow, temperature variation and water hammer or other transients are outside its scope.",
        "Fittings are represented by supplied K values. The model does not resolve individual valve or fitting geometries.",
        "Pump duty is a requirement at the specified flow. Pump curves, the actual operating point, suction pressure, NPSH and cavitation require separate analysis."
    ];

    function group(label, defaultUnit, factors, options = Object.keys(factors)) {
        return { label, defaultUnit, factors, options };
    }

    const unitGroups = {
        flow: group("Flow rate", "L/min", fluidThermalUnits.flow, ["L/min", "m³/s", "GPM"]),
        density: group("Fluid density", "kg/m³", fluidThermalUnits.density),
        dynamicViscosity: group("Dynamic viscosity", "mPa·s", fluidThermalUnits.dynamicViscosity),
        kinematicViscosity: group("Kinematic viscosity", "cSt", fluidThermalUnits.kinematicViscosity),
        diameter: group("Diameter and roughness", "mm", distanceUnits, ["mm", "m", "in", "ft"]),
        distance: group("Length, elevation and head", "m", distanceUnits, ["m", "ft"]),
        pressure: group("Pressure", "kPa", stressUnits, ["kPa", "Pa", "bar", "psi"]),
        power: group("Power", "W", fluidThermalUnits.power),
        velocity: group("Velocity", "m/s", fluidThermalUnits.velocity),
        area: group("Area", "m²", fluidThermalUnits.area, ["m²", "mm²", "in²", "ft²"])
    };

    const segmentGroups = { diameter: "diameter", roughness: "diameter", length: "distance" };

    function defaultUnits() {
        return Object.fromEntries(Object.entries(unitGroups).map(([key, spec]) => [key, spec.defaultUnit]));
    }

    function validUnit(key, unit) {
        return Object.hasOwn(unitGroups, key) && unitGroups[key].options.includes(unit);
    }

    function toSI(value, key, unit) {
        return validUnit(key, unit) && Number.isFinite(value) ? value * unitGroups[key].factors[unit] : NaN;
    }

    function fromSI(value, key, unit) {
        return validUnit(key, unit) && Number.isFinite(value) ? value / unitGroups[key].factors[unit] : NaN;
    }

    function changeUnits(inputs, key, unit) {
        if (!validUnit(key, unit)) throw new Error("Select a supported unit.");
        const oldUnit = inputs.units[key];
        if (unit === oldUnit) return inputs;
        const next = { ...inputs, units: { ...inputs.units, [key]: unit } };
        function convert(value) {
            if (value === null) return null;
            // Use the direct scale ratio so a draft can change units independently of the solver.
            const factors = unitGroups[key].factors;
            const converted = value * (factors[oldUnit] / factors[unit]);
            if (!Number.isFinite(converted) || (value !== 0 && converted === 0)) {
                throw new Error("This value cannot be represented in the selected unit.");
            }
            return converted;
        }
        if (Object.hasOwn(inputs, key)) next[key] = convert(inputs[key]);
        if (key === "distance") next.elevation = convert(inputs.elevation);
        if (key === "diameter" || key === "distance") {
            next.segments = inputs.segments.map((segment) => {
                const updated = { ...segment };
                for (const [field, groupKey] of Object.entries(segmentGroups)) {
                    if (groupKey === key) updated[field] = convert(segment[field]);
                }
                return updated;
            });
        }
        return next;
    }

    function segmentName(segment, index) {
        return typeof segment.name === "string" && segment.name.trim() || "Segment " + (index + 1);
    }

    function calculate(inputs) {
        const errors = [];
        const fail = (message, field, segmentId) => errors.push({ message, field, segmentId });
        function read(value, field, label, { key, min = 0, positive = false, segmentId } = {}) {
            if (!Number.isFinite(value) || value < min || (positive && value === 0)) {
                const range = positive ? "greater than zero" : min === 0 ? "zero or greater" : "a signed number";
                fail(label + " must be " + range + ".", field, segmentId);
                return NaN;
            }
            const converted = key ? toSI(value, key, inputs.units?.[key]) : value;
            if (!Number.isFinite(converted) || (value !== 0 && converted === 0)) {
                fail(label + " cannot be converted to SI. Check the value and units.", field, segmentId);
            }
            return converted;
        }

        const systemType = inputs?.systemType;
        if (!Object.keys(systems).includes(systemType)) fail("Select a supported system type.", "systemType");
        if (!inputs || !Array.isArray(inputs.segments) || inputs.segments.length < 1 || inputs.segments.length > MAX_SEGMENTS) {
            fail("Enter between 1 and " + MAX_SEGMENTS + " sequential pipe segments.", "segments");
            return { ok: false, errors };
        }
        if (Object.keys(unitGroups).some((key) => !validUnit(key, inputs.units?.[key]))) {
            fail("Select supported engineering units.", "units");
        }
        const flow = read(inputs.flow, "flow", "Design flow rate", { key: "flow" });
        const density = read(inputs.density, "density", "Fluid density", { key: "density", positive: true });
        const viscosityMode = inputs.viscosityMode;
        let viscosity;
        if (["dynamicViscosity", "kinematicViscosity"].includes(viscosityMode)) {
            viscosity = read(inputs[viscosityMode], viscosityMode, unitGroups[viscosityMode].label,
                { key: viscosityMode, positive: true });
        } else {
            fail("Select dynamic or kinematic viscosity.", "viscosityMode");
        }
        const efficiency = Number.isFinite(inputs.efficiency) ? inputs.efficiency / 100 : NaN;
        if (!(efficiency > 0 && efficiency <= 1) || inputs.efficiency > 100) {
            fail("Pump efficiency must be greater than 0% and no more than 100%.", "efficiency");
        }
        const elevation = systemType === "open"
            ? read(inputs.elevation, "elevation", "Reservoir elevation change", { key: "distance", min: -Infinity }) : 0;
        const pipeInputs = inputs.segments.map((segment, index) => {
            const segmentId = segment?.id;
            segment = segment || {};
            const name = segmentName(segment, index);
            const readSegment = (field, label, positive) =>
                read(segment[field], field, "S" + (index + 1) + " (" + name + ") " + label,
                    { key: segmentGroups[field], positive, segmentId });
            return {
                id: segmentId, name, notes: segment.notes || "",
                diameter: readSegment("diameter", "internal diameter", true),
                length: readSegment("length", "straight-pipe length"),
                roughness: readSegment("roughness", "absolute roughness"),
                minorCoefficient: readSegment("minorCoefficient", "sum of fitting K")
            };
        });
        if (errors.length) return { ok: false, errors };

        const dynamicViscosity = viscosityMode === "dynamicViscosity" ? viscosity : viscosity * density;
        const kinematicViscosity = viscosityMode === "kinematicViscosity" ? viscosity : viscosity / density;
        if (![dynamicViscosity, kinematicViscosity].every((value) => Number.isFinite(value) && value > 0)) {
            fail("The equivalent viscosity is outside the numerical range. Check viscosity and density.", viscosityMode);
            return { ok: false, errors };
        }
        const conditions = { flow, density, viscosityMode, dynamicViscosity, kinematicViscosity, efficiency, elevation };
        const warnings = [];
        const fitsDisplay = (value, group) => Number.isFinite(fromSI(value, group, inputs.units[group]));
        const segments = pipeInputs.map((pipe, index) => {
            try {
                // Pressure Drop calls the shared Pipe Flow engine for area, velocity, Reynolds and regime.
                const result = computePipePressureDrop({ ...pipe, flow, density, [viscosityMode]: viscosity });
                if (![result.major, result.minor, result.total, result.headLoss, result.velocity].every(Number.isFinite)
                    || (flow > 0 && !(result.reynolds > 0 && Number.isFinite(result.darcyFactor)))
                    || !fitsDisplay(result.headLoss, "distance")) {
                    throw new Error("The solution is outside the numerical range. Check the units and geometry.");
                }
                if (result.regime === "Transitional") {
                    warnings.push("S" + (index + 1) + " (" + pipe.name + "): transitional flow. Friction uses an interpolation and is approximate.");
                }
                return { ...pipe, ...result, darcyFactor: result.darcyFactor ?? null };
            } catch (error) {
                fail("S" + (index + 1) + " (" + pipe.name + "): " + error.message, null, pipe.id);
                return null;
            }
        });
        if (errors.length) return { ok: false, errors };

        const major = segments.reduce((sum, segment) => sum + segment.major, 0);
        const minor = segments.reduce((sum, segment) => sum + segment.minor, 0);
        const frictionPressure = major + minor;
        const weightDensity = density * STANDARD_GRAVITY;
        const frictionHead = frictionPressure / weightDensity;
        const systemHead = frictionHead + elevation;
        if (![weightDensity, frictionPressure, systemHead].every(Number.isFinite)) {
            fail("The system balance is outside the numerical range. Check the entered values and units.");
            return { ok: false, errors };
        }
        const pump = computePumpPower({ flow, density, head: Math.max(0, systemHead), efficiency });
        const totals = {
            major, minor, frictionPressure, frictionHead, systemHead,
            pumpHead: pump.head, pumpPressure: pump.pressure, hydraulicPower: pump.hydraulicPower, shaftPower: pump.shaftPower
        };
        if (!Object.values(totals).every(Number.isFinite)
            || !fitsDisplay(systemHead, "distance") || !fitsDisplay(frictionHead, "distance")) {
            fail("The system balance is outside the numerical range. Check the entered values and units.");
            return { ok: false, errors };
        }
        if (flow === 0) {
            warnings.push("Zero design flow: friction, hydraulic power and estimated shaft power are zero. Darcy factors are undefined. Static lift can still require pressure, and actual pump shutoff behavior is outside this model.");
        }
        if (systemHead < 0) {
            warnings.push("Gravity-assisted duty: the elevation drop exceeds the modeled losses at this flow. Required added pump head and power are zero. Excess head would need to be dissipated to hold the target flow.");
        } else if (systemHead === 0) {
            warnings.push("The energy balance requires zero added head at this flow.");
        }
        if (systemHead <= 0) {
            warnings.push("The target flow is an input. Actual flow depends on the system and any control or pump operating point.");
        }
        return { ok: true, workflowId: ID, modelVersion: MODEL_VERSION, systemType, conditions, segments, totals, warnings };
    }

    function runSweep(inputs, { start, end, count }) {
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start
            || !Number.isInteger(count) || count < 2 || count > MAX_SWEEP_SAMPLES) {
            return { ok: false, error: "Enter a nonnegative start flow, a higher end flow, and 2–" + MAX_SWEEP_SAMPLES + " samples." };
        }
        const flows = Array.from({ length: count }, (_, index) =>
            index === count - 1 ? end : start + (end - start) * (index / (count - 1)));
        if (flows.some((flow, index) => index > 0 && flow <= flows[index - 1])) {
            return { ok: false, error: "The range is too narrow for that many distinct samples. Use a wider range or fewer samples." };
        }
        const samples = flows.map((flow) => {
            const result = calculate({ ...inputs, flow });
            if (!result.ok) return { flow, errors: result.errors.map(({ message }) => message) };
            const { frictionHead, systemHead, pumpHead, shaftPower } = result.totals;
            return { flow, frictionHead, systemHead, pumpHead, shaftPower, warnings: result.warnings };
        });
        return { ok: true, samples, basis: inputs };
    }

    root.FormulaFoundryFluidSystem = {
        ID, MODEL_VERSION, MAX_SEGMENTS, MAX_SWEEP_SAMPLES, systems, assumptions, limitations,
        unitGroups, defaultUnits, validUnit, toSI, fromSI, changeUnits, segmentName, calculate, runSweep
    };
})(window);
