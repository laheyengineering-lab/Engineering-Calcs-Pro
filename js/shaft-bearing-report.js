// Shared comparison display and schema-v1 shaft and bearing snapshots.
(function (root) {
    "use strict";

    const model = root.FormulaFoundryShaftBearing;
    const projects = root.FormulaFoundryShaftProject;
    const graphics = root.FormulaFoundryShaftDiagram;
    const report = root.FormulaFoundryReport;
    const EMPTY = "—";
    const sectionName = (inputs) => inputs.section === "hollow" ? "Hollow circular" : "Solid circular";

    function display(value, group, units) {
        if (!Number.isFinite(value)) return EMPTY;
        const converted = group ? projects.fromSI(value, group, units[group]) : value;
        return Number.isFinite(converted) ? converted : EMPTY;
    }

    function heading(label, group, units) {
        return group ? label + " (" + units[group] + ")" : label;
    }

    function item(label, value, group, units) {
        return { label, value: typeof value === "string" ? value : display(value, group, units), unit: group ? units[group] : "" };
    }

    function bearingLife(bearing, field) {
        if (bearing.status === "unloaded") return "Undefined at zero modeled radial load";
        if (bearing.status === "stopped" && field === "lifeHours") return "Undefined at zero speed";
        return bearing[field];
    }

    function comparisonRows(project, units) {
        const configurations = project.configurations.map((configuration) => ({
            inputs: configuration.inputs,
            result: projects.current(configuration),
            material: projects.materialInfo(configuration.inputs),
            status: configuration.status
        }));
        const baselineIndex = project.configurations.findIndex(({ id }) => id === project.baselineId);
        const definitions = [
            ["Status", null, ({ result, status }) => result ? "Calculated" : status === "stale" ? "Edited" : "Draft"],
            ["Shaft section", null, ({ inputs }) => sectionName(inputs)],
            ["Bearing span", "outputLength", ({ inputs }) => inputs.span],
            ["Outside diameter", "outputDiameter", ({ inputs }) => inputs.outerDiameter],
            ["Inside diameter", "outputDiameter", ({ inputs }) => inputs.section === "hollow" ? inputs.innerDiameter : 0],
            ["Material condition", null, ({ material }) => [material.name, material.condition].filter(Boolean).join(" · ")],
            ["Bearing A radial reaction", "outputForce", ({ result }) => result?.reactions.a.resultant],
            ["Bearing B radial reaction", "outputForce", ({ result }) => result?.reactions.b.resultant],
            ["Peak resultant bending moment", "moment", ({ result }) => result?.bending.maximum.resultant],
            ["Peak nominal equivalent stress", "stress", ({ result }) => result?.combined.maximum.equivalentStress],
            ["Nominal static yield ratio", null, ({ result }) => result?.combined.yieldRatio],
            ["Peak resultant displacement", "deflection", ({ result }) => result?.deflection.maximum?.resultant],
            ["Twist magnitude across torque path", "angle", ({ result }) => Number.isFinite(result?.torque.twist) ? Math.abs(result.torque.twist) : null],
            ["Bearing A L10 (million rev)", null, ({ result }) => result && bearingLife(result.bearings.a, "lifeMillionRevolutions")],
            ["Bearing B L10 (million rev)", null, ({ result }) => result && bearingLife(result.bearings.b, "lifeMillionRevolutions")],
            ["Bearing A L10 (h)", null, ({ result }) => result && bearingLife(result.bearings.a, "lifeHours")],
            ["Bearing B L10 (h)", null, ({ result }) => result && bearingLife(result.bearings.b, "lifeHours")],
            ["Shaft mass", "mass", ({ result }) => result?.geometry.mass]
        ];
        return definitions.map(([label, group, read]) => {
            const raw = configurations.map(read);
            const base = raw[baselineIndex];
            const values = raw.map((quantity, index) => {
                const value = typeof quantity === "string" ? quantity : display(quantity, group, units);
                const change = projects.percent(base, quantity);
                return {
                    value,
                    text: report.formatValue(value),
                    delta: index !== baselineIndex && Number.isFinite(change) ? change : null
                };
            });
            return { label, unit: group ? units[group] : "", values };
        });
    }

    function comparisonTable(project, units) {
        return {
            caption: "Configuration comparison (percentage change from baseline where defined)",
            columns: ["Quantity", ...project.configurations.map((configuration) =>
                projects.name(configuration) + (configuration.id === project.baselineId ? " (baseline)" : ""))],
            rows: comparisonRows(project, units).map(({ label, unit, values }) => [
                unit ? label + " (" + unit + ")" : label,
                ...values.map(({ value, text, delta }) => delta === null
                    ? value
                    : text + " (" + (delta > 0 ? "+" : "") + report.formatValue(delta) + "%)")
            ])
        };
    }

    function loadTable(inputs, result, units) {
        const displacements = new Map(result.deflection.stations.map((point) => [point.id, point]));
        return {
            caption: "Applied point loads and displacement at each station",
            columns: ["Load", heading("x from A", "outputLength", units), heading("Fy", "outputForce", units),
                heading("Fz", "outputForce", units), heading("δy", "deflection", units),
                heading("δz", "deflection", units), heading("Resultant δ", "deflection", units), "Description"],
            rows: inputs.loads.map((load, index) => {
                const station = displacements.get(load.id);
                return [
                    load.name.trim() || "Load " + (index + 1),
                    display(load.position, "outputLength", units), display(load.fy, "outputForce", units),
                    display(load.fz, "outputForce", units), display(station?.y, "deflection", units),
                    display(station?.z, "deflection", units), display(station?.resultant, "deflection", units), load.notes
                ];
            })
        };
    }

    function bearingTable(inputs, result, units) {
        const bearings = ["a", "b"].map((key) => ({
            input: inputs.bearings[key], reaction: result.reactions[key], bearing: result.bearings[key]
        }));
        const definitions = [
            ["Bearing type", null, ({ input }) => input.type === "ball" ? "Ball" : "Roller"],
            ["Dynamic rating C", "outputForce", ({ input }) => input.dynamicRating],
            ["Static rating C₀", "outputForce", ({ input }) => input.staticRating],
            ["Target rating life (h)", null, ({ input }) => input.targetHours],
            ["Signed reaction Ry", "outputForce", ({ reaction }) => reaction.fy],
            ["Signed reaction Rz", "outputForce", ({ reaction }) => reaction.fz],
            ["Radial reaction magnitude P", "outputForce", ({ reaction }) => reaction.resultant],
            ["Life exponent p", null, ({ bearing }) => bearing.exponent],
            ["Basic L10 (million rev)", null, ({ bearing }) => bearingLife(bearing, "lifeMillionRevolutions")],
            ["Basic L10 (h)", null, ({ bearing }) => bearingLife(bearing, "lifeHours")],
            ["Required C for target life", "outputForce", ({ bearing }) => bearing.requiredDynamicRating],
            ["Static radial load ratio C₀/P", null, ({ bearing }) => bearing.staticRatio]
        ];
        return {
            caption: "Radial reactions, bearing ratings and individual basic rating life",
            columns: ["Quantity", "Bearing A", "Bearing B"],
            rows: definitions.map(([label, group, read]) => [
                heading(label, group, units),
                ...bearings.map((bearing) => {
                    const value = read(bearing);
                    return typeof value === "string" ? value : display(value, group, units);
                })
            ])
        };
    }

    function profileTable(result, units) {
        const samples = graphics.reportSamples(result);
        return {
            caption: "Shaft profile samples (L and R mark the left and right limits)",
            columns: [heading("x", "outputLength", units), "Side", heading("Vy", "outputForce", units),
                heading("Vz", "outputForce", units), heading("M [Y]", "moment", units),
                heading("M [Z]", "moment", units), heading("Resultant M", "moment", units),
                heading("Torque", "outputTorque", units), heading("Equivalent stress", "stress", units),
                heading("Resultant δ", "deflection", units)],
            rows: samples.map((sample, index) => {
                const split = samples[index - 1]?.x === sample.x || samples[index + 1]?.x === sample.x;
                return [
                    display(sample.x, "outputLength", units), split ? sample.side[0].toUpperCase() : EMPTY,
                    display(sample.shearY, "outputForce", units), display(sample.shearZ, "outputForce", units),
                    display(sample.momentY, "moment", units), display(sample.momentZ, "moment", units),
                    display(sample.momentResultant, "moment", units), display(sample.torque, "outputTorque", units),
                    display(sample.equivalentStress, "stress", units), display(sample.deflectionResultant, "deflection", units)
                ];
            })
        };
    }

    function sweepTable(sweep, units) {
        return {
            caption: "Outside diameter sensitivity (inside diameter fixed for a hollow shaft)",
            columns: [heading("Outside diameter", "outputDiameter", units),
                heading("Peak nominal equivalent stress", "stress", units), heading("Peak displacement", "deflection", units),
                "Flexural rigidity EI (N·m²)", heading("Mass", "mass", units)],
            rows: sweep.samples.map((sample) => [
                display(sample.diameter, "outputDiameter", units), display(sample.equivalentStress, "stress", units),
                display(sample.displacement, "deflection", units), display(sample.stiffness), display(sample.mass, "mass", units)
            ])
        };
    }

    function buildSnapshot(project, { includeComparison = false, sweep = null } = {}) {
        const configuration = project.configurations.find(({ id }) => id === project.activeId);
        const result = projects.current(configuration);
        if (!result) return null;
        const { units } = configuration;
        const { inputs } = result;
        const material = projects.materialInfo(inputs);
        const { geometry, torque, bending, combined, deflection, equilibrium } = result;
        const title = project.title.trim() || "Untitled shaft project";
        const input = (label, value, group) => item(label, value, group, units);
        const property = (key, label, group) =>
            [input(label, material.properties[key].value, group), input(label + " basis", material.properties[key].basisLabel)];
        const tables = [loadTable(inputs, result, units), bearingTable(inputs, result, units), profileTable(result, units)];
        if (includeComparison && project.configurations.length > 1) tables.push(comparisonTable(project, units));
        if (sweep?.configurationId === configuration.id && sweep.samples.length) tables.push(sweepTable(sweep, units));
        return {
            calculatorId: model.ID,
            calculatorName: "Shaft & Bearing System Designer",
            title: title + " — " + projects.name(configuration),
            path: "workflows/shaft-bearing.html",
            inputs: [
                input("Analysis model", "Uniform circular shaft on two ideal radial supports"),
                input("Workflow model revision", result.modelVersion),
                input("Configuration role", configuration.id === project.baselineId ? "Baseline" : "Alternative"),
                input("Shaft section", sectionName(inputs)),
                input("Bearing span", inputs.span, "length"),
                input("Outside diameter", inputs.outerDiameter, "diameter"),
                input("Inside diameter", inputs.section === "hollow" ? inputs.innerDiameter : 0, "diameter"),
                input("Material", material.name),
                ...(material.designation ? [input("Material designation", material.designation)] : []),
                ...(material.condition ? [input("Material condition", material.condition)] : []),
                ...(material.productForm ? [input("Material product form", material.productForm)] : []),
                ...(Number.isFinite(material.referenceTemperatureC) ? [{ label: "Material reference temperature", value: material.referenceTemperatureC, unit: "°C" }] : []),
                ...property("youngModulus", "Young’s modulus", "modulus"),
                ...property("shearModulus", "Shear modulus", "modulus"),
                ...property("yieldStrength", "Yield strength", "strength"),
                ...property("density", "Density", "density"),
                input("Shaft speed", inputs.speed, "speed"),
                input("Applied introduction torque (+X sign reference)", torque.value, "torque"),
                input("Applied extraction torque (+X sign reference)", -torque.value, "torque"),
                input("Introduction station x", torque.start, "length"),
                input("Extraction station x", torque.end, "length"),
                input("Torque path length", torque.length, "length")
            ],
            outputs: [
                input("Area", geometry.area, "area"),
                input("Second moment of area I", geometry.inertia, "inertia"),
                input("Polar moment of area J", geometry.polarMoment, "inertia"),
                input("Elastic section modulus Z", geometry.sectionModulus, "sectionModulus"),
                { label: "Flexural rigidity EI", value: display(geometry.stiffness), unit: "N·m²" },
                input("Shaft mass", geometry.mass, "mass"),
                input("Force residual Fy", equilibrium.fy, "outputForce"),
                input("Force residual Fz", equilibrium.fz, "outputForce"),
                input("Moment residual My", equilibrium.my, "moment"),
                input("Moment residual Mz", equilibrium.mz, "moment"),
                input("Maximum resultant bending moment", bending.maximum.resultant, "moment"),
                input("Peak bending station x", bending.maximum.x, "outputLength"),
                input("Bending moment in Y load plane at peak resultant", bending.maximum.momentY, "moment"),
                input("Bending moment in Z load plane at peak resultant", bending.maximum.momentZ, "moment"),
                input("Maximum nominal elastic bending stress", bending.maximum.bendingStress, "stress"),
                input("Peak nominal torsional shear stress", torque.shearStress, "stress"),
                input("Signed introduction-to-extraction twist", torque.twist, "angle"),
                input("Critical equivalent stress station x", combined.maximum.x, "outputLength"),
                input("Critical stress station side", combined.maximum.side || EMPTY),
                input("Nominal bending stress at critical station", combined.maximum.bendingStress, "stress"),
                input("Nominal torsional shear at critical station", combined.maximum.torsionalStress, "stress"),
                input("Maximum nominal von Mises equivalent stress", combined.maximum.equivalentStress, "stress"),
                input("Nominal static yield ratio Sy/σeq", combined.yieldRatio),
                input("Maximum resultant displacement (numerically located)", deflection.maximum?.resultant, "deflection"),
                input("Peak displacement station x", deflection.maximum?.x, "outputLength"),
                input("Signed δy at peak displacement", deflection.maximum?.y, "deflection"),
                input("Signed δz at peak displacement", deflection.maximum?.z, "deflection"),
                input("Bearing A slope in Y plane", deflection.slopes?.a.y, "angle"),
                input("Bearing A slope in Z plane", deflection.slopes?.a.z, "angle"),
                input("Bearing B slope in Y plane", deflection.slopes?.b.y, "angle"),
                input("Bearing B slope in Z plane", deflection.slopes?.b.z, "angle")
            ],
            tables,
            chart: graphics.chart(result, units),
            diagram: { type: "calc-diagram", id: model.ID, model: graphics.describe(inputs, result, units) },
            equations: model.EQUATIONS,
            method: "Solve force and moment equilibrium separately in the two transverse planes. Integrate the signed beam moment for simple-support deflections, and combine moments and stresses at the same axial station. Evaluate both sides at concentrated loads and torque path bounds. Form the radial reaction magnitude at each support and calculate that bearing’s individual basic rating life. " + (deflection.method || ""),
            assumptions: [
                ...(project.description.trim() ? ["Application — " + project.description.trim()] : []),
                ...(project.notes.trim() ? ["Operating notes — " + project.notes.trim()] : []),
                "Use +X from Bearing A to Bearing B and signed forces along the fixed +Y and +Z axes. Moments in the Y and Z load planes correspond to global +Mz and −My respectively.",
                ...model.ASSUMPTIONS,
                "Use P equal to the radial reaction magnitude for the simplified radial-only bearing case. The same P is the static equivalent load in the reported C₀/P ratio.",
                ...(material.caveats ? [material.caveats] : []),
                ...material.sources.map((source) => "Material reference — " + source.title + " (" + source.publisher + ")")
            ],
            warnings: [
                "The nominal static yield ratio compares capacity with demand at the critical station. A zero stress demand leaves the ratio undefined.",
                ...result.warnings
            ]
        };
    }

    root.FormulaFoundryShaftReport = { comparisonRows, buildSnapshot };
})(window);
