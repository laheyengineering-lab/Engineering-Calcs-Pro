// View data shared by the workspace and schema-v1 report snapshots.
(function (root) {
    "use strict";

    const model = root.FormulaFoundryFluidSystem;
    const projects = root.FormulaFoundryFluidProject;

    function display(value, group, units) {
        if (!Number.isFinite(value)) return "—";
        const converted = group ? model.fromSI(value, group, units[group]) : value;
        return Number.isFinite(converted) ? converted : "—";
    }

    function column(label, group, units) {
        return group ? label + " (" + units[group] + ")" : label;
    }

    function totals(result, units) {
        const rows = [
            ["major", "Total major pressure loss", "pressure"],
            ["minor", "Total minor pressure loss", "pressure"],
            ["frictionPressure", "Total frictional pressure loss", "pressure"],
            ["frictionHead", "Total friction head", "distance"],
            ["elevation", result.systemType === "open" ? "Reservoir elevation change" : "Net loop elevation change", "distance"],
            ["systemHead", "Net system head", "distance"],
            ["pumpHead", "Required pump head", "distance"],
            ["pumpPressure", "Equivalent pump pressure rise", "pressure"],
            ["hydraulicPower", "Hydraulic output power", "power"],
            ["shaftPower", "Estimated shaft power", "power"]
        ];
        return rows.map(([key, label, group]) => ({
            key, label, value: display(key === "elevation" ? result.conditions.elevation : result.totals[key], group, units),
            unit: units[group]
        }));
    }

    function segmentTables(result, units) {
        const tag = (segment, index) => "S" + (index + 1) + " · " + segment.name;
        return [
            {
                caption: "Segment flow states",
                columns: ["Segment", column("Area", "area", units), column("Velocity", "velocity", units), "Reynolds number",
                    "Flow regime", "Relative roughness", "Darcy factor"],
                rows: result.segments.map((segment, index) => [
                    tag(segment, index), display(segment.area, "area", units), display(segment.velocity, "velocity", units),
                    segment.reynolds, segment.regime, segment.relativeRoughness, segment.darcyFactor ?? "—"
                ])
            },
            {
                caption: "Segment losses",
                columns: ["Segment", column("Major loss", "pressure", units), column("Minor loss", "pressure", units),
                    column("Total loss", "pressure", units), column("Head loss", "distance", units)],
                rows: result.segments.map((segment, index) => [
                    tag(segment, index), display(segment.major, "pressure", units), display(segment.minor, "pressure", units),
                    display(segment.total, "pressure", units), display(segment.headLoss, "distance", units)
                ])
            }
        ];
    }

    function comparisonTable(project, units, showDeltas = false) {
        const baseline = project.configurations.find(({ id }) => id === project.baselineId);
        const reference = projects.current(baseline)?.totals;
        const metric = (totals, key, group) => {
            const value = display(totals[key], group, units);
            return showDeltas ? { value, percent: projects.percent(reference?.[key], totals[key]) } : value;
        };
        return {
            caption: "Configurations compared with " + projects.name(baseline),
            columns: ["Configuration", "System", column("Flow", "flow", units),
                column("Friction head", "distance", units), column("Pump head", "distance", units),
                column("Shaft power", "power", units), column("Peak velocity", "velocity", units), "Max. Reynolds"],
            rows: project.configurations.map((configuration) => {
                const result = projects.current(configuration);
                const label = projects.name(configuration) + (configuration.id === project.baselineId ? " (baseline)" : "");
                const system = configuration.inputs.systemType === "open" ? "Open transfer" : "Closed loop";
                if (!result) return [label, system + " · " + (configuration.status === "stale" ? "Edited" : "Draft"), ...Array(6).fill("—")];
                return [
                    label, system, display(result.conditions.flow, "flow", units),
                    metric(result.totals, "frictionHead", "distance"), metric(result.totals, "pumpHead", "distance"),
                    metric(result.totals, "shaftPower", "power"),
                    display(Math.max(...result.segments.map(({ velocity }) => velocity)), "velocity", units),
                    Math.max(...result.segments.map(({ reynolds }) => reynolds))
                ];
            })
        };
    }

    function comparisonSegments(configuration, baseline, units) {
        const active = projects.current(configuration);
        const reference = projects.current(baseline);
        if (!active || !reference || configuration === baseline) return null;
        const baseSegments = new Map(reference.segments.map((segment, index) => [segment.id, { ...segment, index }]));
        return {
            caption: "Segment comparison · " + projects.name(configuration) + " vs " + projects.name(baseline),
            columns: ["Active segment", "Baseline segment", column("Active velocity", "velocity", units),
                column("Baseline velocity", "velocity", units), "Δ velocity (%)", "Active Reynolds", "Baseline Reynolds", "Δ Reynolds (%)"],
            rows: active.segments.map((segment, index) => {
                const base = baseSegments.get(segment.id);
                return [
                    "S" + (index + 1) + " · " + segment.name, base ? "S" + (base.index + 1) + " · " + base.name : "New segment",
                    display(segment.velocity, "velocity", units), display(base?.velocity, "velocity", units),
                    projects.percent(base?.velocity, segment.velocity) ?? "—", segment.reynolds, base?.reynolds ?? "—",
                    projects.percent(base?.reynolds, segment.reynolds) ?? "—"
                ];
            })
        };
    }

    function sweepTable(sweep, units) {
        return {
            caption: "Sensitivity samples · " + sweep.samples.length + " flow rates",
            columns: [column("Flow", "flow", units), column("Friction head", "distance", units),
                column("Net system head", "distance", units), column("Pump head", "distance", units),
                column("Shaft power", "power", units), "Sample status"],
            rows: sweep.samples.map((sample) => [
                sample.flow, display(sample.frictionHead, "distance", units), display(sample.systemHead, "distance", units),
                display(sample.pumpHead, "distance", units), display(sample.shaftPower, "power", units),
                sample.errors?.join(" ") || sample.warnings?.join(" ") || "Calculated"
            ])
        };
    }

    const sweepMetrics = {
        pumpHead: ["Required pump head", "distance"],
        frictionHead: ["Total friction head", "distance"],
        shaftPower: ["Estimated shaft power", "power"]
    };

    function sweepChart(sweep, metric, units) {
        const [label, group] = sweepMetrics[metric];
        return {
            type: "line", title: label + " vs flow", xLabel: column("Design flow", "flow", units), yLabel: column(label, group, units),
            points: sweep.samples.map((sample) => {
                const y = display(sample[metric], group, units);
                return { x: sample.flow, y: typeof y === "number" ? y : null };
            })
        };
    }

    function buildSnapshot(project, { includeComparison = false, sweep = null, metric = "pumpHead" } = {}) {
        const configuration = project.configurations.find(({ id }) => id === project.activeId);
        const result = projects.current(configuration);
        if (!result) return null;
        const { inputs } = configuration;
        // Edits replace the input object. A sweep belongs only to the inputs that produced it.
        const currentSweep = sweep?.basis === inputs ? sweep : null;
        const { units } = inputs;
        const condition = result.conditions;
        const reportInputs = [
            { label: "Analysis model", value: model.systems[result.systemType].label },
            { label: "Workflow model revision", value: result.modelVersion },
            { label: "Design flow rate", value: inputs.flow, unit: units.flow },
            { label: "Fluid density", value: inputs.density, unit: units.density },
            { label: model.unitGroups[inputs.viscosityMode].label + " (entered)", value: inputs[inputs.viscosityMode], unit: units[inputs.viscosityMode] },
            { label: "Pump efficiency", value: inputs.efficiency, unit: "%" },
            { label: "Standard gravity", value: STANDARD_GRAVITY, unit: "m/s²" }
        ];
        if (result.systemType === "open") {
            reportInputs.push({ label: "Signed reservoir elevation change", value: inputs.elevation, unit: units.distance });
        }
        reportInputs.push(inputs.viscosityMode === "dynamicViscosity"
            ? { label: "Equivalent kinematic viscosity", value: condition.kinematicViscosity, unit: "m²/s" }
            : { label: "Equivalent dynamic viscosity", value: condition.dynamicViscosity, unit: "Pa·s" });
        const tables = [{
            caption: "Pipe segments in flow order · " + projects.name(configuration),
            columns: ["Segment", column("Internal diameter", "diameter", units), column("Straight length", "distance", units),
                column("Absolute roughness", "diameter", units), "Fitting ΣK", "Notes"],
            rows: inputs.segments.map((segment, index) => [
                "S" + (index + 1) + " · " + result.segments[index].name, segment.diameter,
                segment.length, segment.roughness, segment.minorCoefficient, segment.notes
            ])
        }, ...segmentTables(result, units)];
        if (includeComparison && project.configurations.length > 1) tables.push(comparisonTable(project, units));
        if (currentSweep) tables.push(sweepTable(currentSweep, units));
        const title = project.title.trim() || "Untitled fluid project";
        return {
            calculatorId: model.ID, calculatorName: "Fluid System Designer", title: title + " — " + projects.name(configuration),
            path: "workflows/fluid-system.html",
            inputs: reportInputs, outputs: totals(result, units),
            tables,
            ...(currentSweep ? { chart: sweepChart(currentSweep, metric, units) } : {}),
            diagram: { type: "calc-diagram", id: model.ID, model: root.FormulaFoundryFluidDiagram.describe(inputs, result) },
            equations: [
                "A_i=\\frac{\\pi D_i^2}{4},\\quad v_i=\\frac{Q}{A_i},\\quad \\mathrm{Re}_i=\\frac{v_iD_i}{\\nu},\\quad \\nu=\\frac{\\mu}{\\rho}",
                "f_D=\\frac{64}{\\mathrm{Re}}\\quad(0<\\mathrm{Re}<2300)",
                "\\frac{1}{\\sqrt{f_D}}=-2\\log_{10}\\!\\left(\\frac{\\epsilon}{3.7D}+\\frac{2.51}{\\mathrm{Re}\\sqrt{f_D}}\\right)",
                "\\Delta p_{m,i}= f_{D,i}\\frac{L_i}{D_i}\\frac{\\rho v_i^2}{2},\\qquad \\Delta p_{K,i}=\\sum K_i\\frac{\\rho v_i^2}{2}",
                "h_f=\\frac{\\sum_i(\\Delta p_{m,i}+\\Delta p_{K,i})}{\\rho g}",
                result.systemType === "open" ? "H_{\\mathrm{net}}=h_f+(z_{\\mathrm{out}}-z_{\\mathrm{in}})" : "H_{\\mathrm{net}}=h_f\\quad(\\Delta z_{\\mathrm{loop}}=0)",
                "H_p=\\max(0,H_{\\mathrm{net}}),\\qquad \\Delta p_p=\\rho g H_p",
                "P_h = Q\\Delta p_p,\\qquad P_s = \\frac{P_h}{\\eta}"
            ],
            method: "Convert the entered quantities to SI. The Pipe Pressure Drop engine calls Pipe Flow for each segment, calculates Darcy and fitting losses, and returns the equivalent head. Sum the losses, apply the selected elevation balance, and pass the resulting nonnegative head requirement to Pump Hydraulic Power.",
            assumptions: [
                ...(project.description.trim() ? ["Project application — " + project.description.trim()] : []),
                ...(project.notes.trim() ? ["Operating notes — " + project.notes.trim()] : []),
                model.systems[result.systemType].assumption, ...model.assumptions, ...model.limitations
            ],
            warnings: [
                ...result.warnings,
                ...(currentSweep ? ["The sensitivity chart samples system requirements with the same assumed efficiency and geometry at each flow. Pump performance requires a manufacturer curve."] : [])
            ]
        };
    }

    root.FormulaFoundryFluidReport = {
        display, totals, segmentTables, comparisonTable, comparisonSegments, sweepTable, sweepChart, buildSnapshot
    };
})(window);
