// Field definitions are shared by standalone forms and Design Studies.
const expansionGroups = {};
for (const [id, label, defaultUnit, table] of [
    ["diameter", "Diameter, stroke and roughness", "mm", distanceUnits],
    ["distance", "Length and head", "m", distanceUnits],
    ["area", "Area", "m²", fluidThermalUnits.area],
    ["flow", "Volumetric flow", "L/min", fluidThermalUnits.flow],
    ["velocity", "Velocity", "m/s", fluidThermalUnits.velocity],
    ["density", "Density", "kg/m³", fluidThermalUnits.density],
    ["dynamicViscosity", "Dynamic viscosity", "mPa·s", fluidThermalUnits.dynamicViscosity],
    ["kinematicViscosity", "Kinematic viscosity", "cSt", fluidThermalUnits.kinematicViscosity],
    ["pressure", "Pressure", "kPa", stressUnits],
    ["power", "Power", "kW", fluidThermalUnits.power],
    ["energy", "Energy", "kWh", fluidThermalUnits.energy],
    ["volume", "Volume", "L", fluidThermalUnits.volume],
    ["duration", "Operating duration", "h", fluidThermalUnits.duration],
    ["strokeTime", "Stroke and cycle time", "s", fluidThermalUnits.duration],
    ["frequency", "Cycle frequency", "cycles/min", fluidThermalUnits.frequency],
    ["conductivity", "Thermal conductivity", "W/(m·K)", fluidThermalUnits.conductivity],
    ["resistance", "Area-normalized resistance", "m²·K/W", fluidThermalUnits.resistance],
    ["transmittance", "U-factor", "W/(m²·K)", fluidThermalUnits.transmittance],
    ["heatRate", "Heat-transfer rate", "W", fluidThermalUnits.heatRate],
    ["interval", "Temperature difference", "K", fluidThermalUnits.temperatureInterval],
    ["force", "Force", "N", forceUnits],
    ["moment", "Moment", "N·m", momentUnits]
]) {
    expansionGroups[id] = {
        label, options: Object.keys(table), default: defaultUnit, percentMeaningful: true,
        toBase: (value, unit) => value * table[unit],
        fromBase: (value, unit) => value / table[unit]
    };
}
expansionGroups.temperature = {
    label: "Temperature scale", options: ["°C", "°F", "K"], default: "°C",
    toBase: convertAbsoluteTemperature, fromBase: convertAbsoluteTemperatureToUnit, percentMeaningful: false
};

const expansionModels = (() => {
    const input = (id, label, group, settings = {}) => ({ id, label, group, sweepable: true, ...settings });
    const choice = (id, label, options) => ({ id, label, options, group: null, sweepable: false });
    function output(id, label, group, settings = {}) {
        // Fixed reporting units are treated as single-option identity groups.
        if (!group) {
            const unit = settings.unit || "";
            group = "fixed:" + unit;
            expansionGroups[group] ??= {
                label: unit, options: [unit], default: unit, percentMeaningful: true,
                toBase: (value) => value, fromBase: (value) => value
            };
        }
        return { id, label, group, quantity: id, ...settings };
    }
    const optional = { optional: true };
    const when = (key, value) => ({ active: (values) => values[key] === value });
    const flow = input("flow", "Volumetric flow", "flow");
    const density = input("density", "Fluid density at operating conditions", "density");
    const pipe = [
        input("diameter", "Internal diameter", "diameter"), density,
        choice("viscosityMode", "Viscosity supplied", ["Dynamic", "Kinematic"]),
        input("dynamicViscosity", "Dynamic viscosity", "dynamicViscosity", when("viscosityMode", "Dynamic")),
        input("kinematicViscosity", "Kinematic viscosity", "kinematicViscosity", when("viscosityMode", "Kinematic"))
    ];
    const cylinder = [input("bore", "Bore diameter", "diameter"), input("rod", "Rod diameter", "diameter"),
        input("stroke", "Stroke length", "diameter")];
    const chambers = [output("capVolume", "Cap-end swept volume", "volume"), output("rodVolume", "Rod-end swept volume", "volume")];
    const pipeEquations = ["A=\\pi D^2/4,\\quad Q=A\\bar v", "\\mathrm{Re}=\\bar vD/\\nu,\\quad \\nu=\\mu/\\rho"];
    const pipeAssumptions = ["Steady incompressible flow in a full circular pipe using the internal diameter.",
        "Enter density and viscosity at operating conditions. Viscosity can vary substantially with temperature.",
        "Reynolds thresholds near 2,300 and 4,000 are approximate. Inlet disturbances and geometry can shift transition."];
    const cylinderEquations = ["A_p=\\pi D^2/4,\\quad A_a=\\pi(D^2-d^2)/4", "V_c=A_ps,\\quad V_r=A_as"];
    const layers = [1, 2, 3, 4, 5, 6];
    const models = {
        "pipe-flow": {
            inputs: [choice("flowMode", "Input mode", ["Flow rate", "Average velocity"]), ...pipe,
                { ...flow, ...when("flowMode", "Flow rate") },
                input("velocity", "Average velocity", "velocity", when("flowMode", "Average velocity"))],
            outputs: [output("area", "Flow area", "area"), output("flow", "Volumetric flow", "flow"),
                output("velocity", "Average velocity", "velocity"), output("reynolds", "Reynolds number", null)],
            equations: pipeEquations, assumptions: pipeAssumptions,
            method: "Apply continuity across the pipe cross-section and classify the mean-flow Reynolds number.",
            warningsFor: (_values, out) => ["Approximate flow regime: " + pipeFlowRegime(out.reynolds) + "."],
            engine: computePipeFlow
        },
        "pipe-pressure-drop": {
            inputs: [...pipe, flow, input("length", "Pipe length", "distance"),
                input("roughness", "Absolute roughness (zero for smooth)", "diameter"),
                input("minorCoefficient", "Sum of fitting K values (optional)", null, optional)],
            outputs: [output("velocity", "Average velocity", "velocity"), output("reynolds", "Reynolds number", null),
                output("relativeRoughness", "Relative roughness", null), output("darcyFactor", "Darcy friction factor", null, optional),
                output("major", "Major loss", "pressure"), output("minor", "Fitting loss", "pressure"),
                output("total", "Total frictional pressure loss", "pressure"), output("headLoss", "Equivalent head loss", "distance")],
            equations: [...pipeEquations, "f_D=64/\\mathrm{Re}\\quad\\text{(laminar)}", "\\Delta p_m=f_D\\frac{L}{D}\\frac{\\rho\\bar v^2}{2}",
                "\\Delta p_K=\\sum K\\frac{\\rho\\bar v^2}{2},\\quad h_L=\\frac{\\Delta p_{total}}{\\rho g}",
                "\\frac{1}{\\sqrt{f_D}}=-2\\log_{10}\\left(\\frac{\\epsilon}{3.7D}+\\frac{2.51}{\\mathrm{Re}\\sqrt{f_D}}\\right)"],
            assumptions: [...pipeAssumptions, "Straight-pipe friction assumes fully developed flow. Fitting K values refer to the entered pipe velocity.",
                "Elevation, developing flow and compressibility are excluded. Relative roughness is limited to 0.05 and turbulent Reynolds number to 100 million."],
            method: "Use Darcy 64/Re for laminar flow and bisect Colebrook–White for turbulent flow. Interpolate Darcy factors between the regime endpoints in transition.",
            warningsFor: (_values, out) => {
                const regime = pipeFlowRegime(out.reynolds);
                if (regime === "Transitional") return ["Transitional flow: interpolated friction is an estimate. Actual friction can vary with inlet conditions."];
                if (regime === "No flow") return ["Zero flow gives zero loss. The Darcy friction factor is undefined."];
                return ["Approximate flow regime: " + regime + "."];
            },
            engine: computePipePressureDrop
        },
        "pump-hydraulic-power": {
            inputs: [choice("riseMode", "Rise supplied", ["Pressure rise", "Head rise"]), flow,
                input("pressure", "Pressure rise", "pressure", when("riseMode", "Pressure rise")),
                input("head", "Hydraulic head rise", "distance", when("riseMode", "Head rise")),
                { ...density, label: "Fluid density for head conversion" },
                input("efficiency", "Pump efficiency", null, { unit: "%" }), input("duration", "Operating duration (optional)", "duration", optional)],
            outputs: [output("pressure", "Pressure rise", "pressure"), output("head", "Equivalent head rise", "distance"),
                output("hydraulicPower", "Hydraulic output power", "power"), output("shaftPower", "Required shaft power", "power"),
                output("energy", "Shaft energy", "energy", optional)],
            equations: ["\\Delta p=\\rho gH,\\quad P_h=Q\\Delta p", "P_s=P_h/\\eta,\\quad E_s=P_st"],
            assumptions: ["Steady incompressible flow and user-supplied efficiency at the intended duty point.",
                "Shaft energy excludes motor and drive losses. Hydraulic head uses standard gravity (9.80665 m/s²)."],
            warnings: ["Pump selection requires an operating point, pump curve and full system curve. A transferred segment loss covers only that segment’s friction."],
            method: "Multiply flow by pressure rise and divide hydraulic output by pump efficiency.",
            engine: (values) => computePumpPower({ ...values, efficiency: values.efficiency / 100 })
        },
        "hydraulic-cylinder-speed": {
            inputs: [choice("motionMode", "Input mode", ["Flow", "Speed"]), ...cylinder,
                input("extensionFlow", "Extension flow", "flow", { ...when("motionMode", "Flow"), optional: true }),
                input("retractionFlow", "Retraction flow", "flow", { ...when("motionMode", "Flow"), optional: true }),
                input("extensionSpeed", "Extension speed", "velocity", { ...when("motionMode", "Speed"), optional: true }),
                input("retractionSpeed", "Retraction speed", "velocity", { ...when("motionMode", "Speed"), optional: true })],
            outputs: [output("pistonArea", "Cap-end piston area", "area"), output("annularArea", "Rod-side annular area", "area"), ...chambers,
                output("extensionSpeed", "Extension speed", "velocity", optional), output("retractionSpeed", "Retraction speed", "velocity", optional),
                output("extensionFlow", "Extension flow", "flow", optional), output("retractionFlow", "Retraction flow", "flow", optional),
                output("extensionTime", "Extension time", "strokeTime", optional), output("retractionTime", "Retraction time", "strokeTime", optional),
                output("cycleTime", "Full theoretical cycle time", "strokeTime", optional)],
            equations: [...cylinderEquations, "v=Q/A,\\quad t=s/v,\\quad t_{cycle}=t_e+t_r"],
            assumptions: ["Double-acting single-rod cylinder with constant flow or speed during each stroke. Enter either stroke direction or both.",
                "Travel time excludes dwell, acceleration, compressibility, leakage, pressure-dependent effects and line losses."],
            method: "Apply continuity to the full piston area during extension and the annular area during retraction.",
            engine: computeCylinderCycle
        },
        "pneumatic-air-consumption": {
            inputs: [...cylinder, input("gaugePressure", "Operating gauge pressure", "pressure"),
                input("referencePressure", "Ambient and free-air reference pressure (absolute)", "pressure"),
                input("operatingTemperature", "Operating air temperature", "temperature"),
                input("referenceTemperature", "Free-air reference temperature", "temperature"),
                input("frequency", "Full cycle frequency", "frequency")],
            outputs: [...chambers, output("sweptVolume", "Swept volume per cycle at cylinder conditions", "volume"),
                output("absolutePressure", "Cylinder absolute pressure", "pressure"),
                output("freeAir", "Reference-condition volume per cycle", "volume"), output("consumptionRate", "Reference-condition flow demand", "flow")],
            equations: [...cylinderEquations, "p_{abs}=p_{gauge}+p_{ref}",
                "V_{ref}=(V_c+V_r)\\frac{p_{abs}}{p_{ref}}\\frac{T_{ref}}{T_{op}},\\quad Q_{ref}=nV_{ref}"],
            assumptions: ["Reference pressure is also local ambient pressure. Enter both air temperatures for conversion to kelvin.",
                "Each chamber fills once at the entered operating temperature and exhausts once per cycle, without recovery.",
                "Dead volume, line and valve volume, leakage, humidity, compression heating transients and exhaust dynamics are excluded."],
            warnings: ["Reference flow applies at the entered pressure and temperature. Compressor sizing also requires peak demand, duty cycle, leakage and system losses."],
            method: "Convert cylinder swept volumes to an explicit free-air reference with ideal-gas mass conservation.",
            engine: computePneumaticConsumption
        },
        "multilayer-insulation": {
            inputs: [...layers.flatMap((n) => [
                choice("layerMode" + n, "Layer " + n + " method", n === 1 ? ["Thickness and conductivity", "Direct R-value"] : ["Unused", "Thickness and conductivity", "Direct R-value"]),
                input("thickness" + n, "Layer " + n + " thickness", "diameter", when("layerMode" + n, "Thickness and conductivity")),
                input("conductivity" + n, "Layer " + n + " conductivity", "conductivity", when("layerMode" + n, "Thickness and conductivity")),
                input("resistance" + n, "Layer " + n + " material R-value", "resistance", when("layerMode" + n, "Direct R-value"))
            ]), input("insideFilm", "Interior surface resistance (optional)", "resistance", optional),
                input("outsideFilm", "Exterior surface resistance (optional)", "resistance", optional)],
            outputs: [output("materialResistance", "Series material resistance", "resistance"),
                output("resistance", "Total assembly R-value", "resistance"),
                output("resistanceSI", "Total assembly R-value (SI)", null, { unit: "m²·K/W" }),
                output("resistanceUS", "Total assembly R-value (US customary)", null, { unit: "h·ft²·°F/BTU" }),
                output("transmittance", "Assembly U-factor", "transmittance"),
                ...layers.flatMap((n) => [
                    output("layerResistance" + n, "Layer " + n + " resistance", "resistance", optional),
                    output("contribution" + n, "Layer " + n + " share of total R", null, { optional: true, unit: "%" })
                ])],
            equations: ["R_i=t_i/k_i,\\quad R_{mat}=\\sum R_i", "R_{total}=R_{si}+R_{mat}+R_{se},\\quad U=1/R_{total}"],
            assumptions: ["Steady one-dimensional conduction through planar layers of uniform area and constant properties.",
                "Enter material-only R-values. Supply each surface film once, separately, when required.",
                "Framing, gaps, moisture, thermal bridges and installation quality affect whole-wall performance."],
            method: "Sum series material and surface resistances. Layer shares use total assembly resistance as the denominator.",
            engine(values) {
                const active = layers.filter((n) => values["layerMode" + n] !== "Unused");
                const material = active.map((n) => values["layerMode" + n] === "Direct R-value"
                    ? { resistance: values["resistance" + n] }
                    : { thickness: values["thickness" + n], conductivity: values["conductivity" + n] });
                const r = computeInsulation({ layers: material, insideFilm: values.insideFilm, outsideFilm: values.outsideFilm });
                const result = { ...r, resistanceSI: r.resistance,
                    resistanceUS: r.resistance / fluidThermalUnits.resistance["h·ft²·°F/BTU"] };
                active.forEach((n, i) => {
                    result["layerResistance" + n] = r.resistances[i];
                    result["contribution" + n] = r.contributions[i];
                });
                return result;
            }
        },
        "wall-heat-loss": {
            inputs: [choice("thermalMode", "Thermal property supplied", ["Effective R-value", "Effective U-factor"]),
                input("resistance", "Effective assembly R-value", "resistance", when("thermalMode", "Effective R-value")),
                input("transmittance", "Effective assembly U-factor", "transmittance", when("thermalMode", "Effective U-factor")),
                input("area", "Assembly area", "area"), input("inside", "Indoor temperature", "temperature"),
                input("outside", "Outdoor temperature", "temperature"), input("duration", "Operating duration", "duration")],
            outputs: [output("difference", "Indoor minus outdoor temperature", "interval"),
                output("heatRate", "Heat-transfer rate (+ loss, − gain)", "heatRate"), output("energyKwh", "Transferred energy", null, { unit: "kWh" }),
                output("energyBtu", "Transferred energy", null, { unit: "BTU" })],
            equations: ["\\Delta T=T_i-T_o,\\quad \\dot Q=UA\\Delta T", "U=1/R,\\quad E=\\dot Qt"],
            assumptions: ["Positive results are heat loss from indoors. Negative results are heat gain indoors.",
                "Area, effective thermal properties and indoor/outdoor temperatures are constant over the duration.",
                "Excludes infiltration, ventilation, solar gain, moisture, equipment loads and thermal storage."],
            warnings: ["This steady-state transmission estimate covers the stated period. Complete HVAC loads and seasonal energy require additional models and inputs."],
            method: "Multiply effective assembly U-factor, area and signed temperature difference. Multiply the rate by duration for energy.",
            engine(values) {
                const r = computeWallHeatTransfer(values);
                return { ...r, energyKwh: r.energy / fluidThermalUnits.energy.kWh, energyBtu: r.energy / fluidThermalUnits.energy.BTU };
            }
        },
        "wall-mounting": {
            inputs: [choice("arrangement", "Mounting arrangement", ["Close to wall", "Bracket with lower bearing", "Symmetric two-row mount"]),
                input("weight", "Object and payload weight (force)", "force"),
                input("offset", "Horizontal load offset (zero for close-to-wall)", "distance"),
                input("count", "Total equally shear-sharing fasteners", null, { sweepable: false }),
                input("spacing", "Vertical distance from top row to bearing reaction", "distance", {
                    active: (values) => values.arrangement !== "Close to wall"
                }),
                input("horizontalSpacing", "Horizontal center-to-center spacing between adjacent fasteners", "distance", {
                    active: (values) => values.arrangement === "Symmetric two-row mount" && values.count > 2,
                    sweepable: false
                }),
                input("shearCapacity", "Manufacturer shear working capacity per fastener (optional)", "force", optional),
                input("tensionCapacity", "Manufacturer tension working capacity per fastener (optional)", "force", optional)],
            outputs: [output("weight", "Applied vertical load", "force"), output("moment", "Overturning moment", "moment"),
                output("shear", "Idealized shear per fastener", "force"), output("tension", "Idealized top-row tension per fastener", "force"),
                output("compression", "Total lower bearing reaction", "force"),
                output("shearRatio", "Shear demand / working capacity", null, optional),
                output("tensionRatio", "Tension demand / working capacity", null, optional)],
            equations: ["M=We,\\quad V=W/n", "C=M/h,\\quad T=C/n_{top}"],
            assumptions: ["Centered static vertical load on a rigid, snug mount with equal shear sharing. Close-to-wall mode requires zero offset.",
                "Bracket mode has one fastener row above a lower wall bearing point. Two-row mode has equal row counts and lower bearing at the bottom row.",
                "Only the upper row takes idealized tension. The wall supplies the balancing lower compression reaction.",
                "In two-row mode, align equally spaced fasteners in symmetric rows. Horizontal spacing describes this layout and does not affect the centered-load equations.",
                "Nonvertical or laterally eccentric loads, prying, impact, unknown contact, uneven support and flexible mounts are outside this model."],
            warnings: ["Each ratio checks one component against the entered working capacity. Follow manufacturer interaction, substrate, embedment, spacing, edge distance, direction and installation requirements.",
                "Wall-system capacity also depends on the bracket, wall bearing, substrate condition and framing attachments."],
            method: "Balance the vertical load and overturning moment using an idealized upper tension row and lower wall bearing reaction.",
            engine: computeMountingDemand
        }
    };

    return Object.fromEntries(Object.entries(models).map(([id, model]) => {
        const item = calculators.find((calculator) => calculator.id === id);
        const groups = {};
        for (const field of [...model.inputs, ...model.outputs]) {
            if (field.group) groups[field.group] = expansionGroups[field.group];
        }
        function activeInputs(values) {
            const selections = { ...values };
            for (const field of model.inputs) {
                if (field.options) selections[field.id] = values[field.id] ?? field.options[0];
            }
            return model.inputs.filter((field) => !field.active || field.active(selections));
        }
        function toSI(values, units) {
            const base = {};
            for (const field of activeInputs(values)) {
                const value = values[field.id];
                if (field.options) {
                    base[field.id] = value ?? field.options[0];
                    if (!field.options.includes(base[field.id])) throw new Error("Select a valid option for " + field.label + ".");
                } else if (value != null) {
                    base[field.id] = field.group ? groups[field.group].toBase(value, units[field.group]) : value;
                    if (!Number.isFinite(base[field.id])) throw new Error("Enter a valid value for " + field.label + ".");
                } else if (!field.optional) {
                    throw new Error("Enter " + field.label + ".");
                }
            }
            return base;
        }
        function calculate(values, units) {
            const base = toSI(values, units);
            const result = model.engine(base);
            const outputs = {};
            for (const field of model.outputs) {
                const value = result[field.id];
                if (value == null && field.optional) continue;
                const display = field.group ? groups[field.group].fromBase(value, units[field.group]) : value;
                if (!Number.isFinite(display)) throw new Error(field.label + " is outside the numerical range.");
                outputs[field.id] = display;
            }
            return outputs;
        }
        return [id, { ...model, id, name: item.name, path: item.path, version: "1", groups, activeInputs, toSI, calculate }];
    }));
})();
