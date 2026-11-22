(function (root) {
    "use strict";

    const diagrams = root.FormulaFoundryCalculatorDiagrams;
    const { T } = diagrams;
    const ID = "fluid-system";
    const MAX_SEGMENTS = 8;
    const schema = {
        mode: T.pick(["closed", "open"]), rows: T.rows(MAX_SEGMENTS, 3), heads: T.nums(MAX_SEGMENTS),
        flow: T.nonneg(), elevation: T.num(), pumpHead: T.nonneg(), shaftPower: T.nonneg(),
        diameterUnit: T.unit(), distanceUnit: T.unit(), flowUnit: T.unit(), powerUnit: T.unit()
    };
    for (let index = 1; index <= MAX_SEGMENTS; index += 1) schema["name" + index] = T.str(50);

    diagrams.register(ID, {
        title: "Fluid system schematic",
        caption: "Series flow path at an illustrative scale. ID is internal diameter, L is straight length, and the double tick marks a segment with a supplied fitting K.",
        schema,
        validate(model) {
            return Boolean(model.mode && model.rows?.length && model.rows.length === model.heads?.length
                && model.rows.every(([diameter, length, k]) => diameter > 0 && length >= 0 && k >= 0)
                && model.heads.every((head) => head >= 0)
                && ["flow", "elevation", "pumpHead", "shaftPower"].every((key) => Number.isFinite(model[key]))
                && (model.mode === "open" || model.elevation === 0)
                && ["diameterUnit", "distanceUnit", "flowUnit", "powerUnit"].every((key) => model[key]));
        },
        build: drawSystem
    });

    function drawSystem(document, model, helpers) {
        const rows = model.rows || [];
        const open = model.mode === "open";
        const twoRows = rows.length > 4;
        const firstY = 148;
        const secondY = 281;
        const returnY = twoRows ? (open ? 386 : secondY) : 254;
        const summaryY = twoRows ? 422 : 288;
        const d = root.FormulaFoundryDiagram.scene(document, {
            size: [796, summaryY + 24],
            title: open ? "Reservoir-to-reservoir piping" : "Closed recirculating circuit",
            label: "Fluid system schematic, " + rows.length + " pipe segments",
            description: "The pump and numbered pipe segments share one series path. "
                + (open ? "The dimension refers to reservoir free surfaces." : "Net elevation change around the circuit is zero.")
        });
        const quantity = helpers.quantity;
        const middle = { anchor: "middle" };
        const small = { ...middle, cls: "ff-label ff-label-small" };
        const left = 82;
        const right = 711;
        const start = 172;
        const end = 668;
        const pump = 124;

        function reservoir(x, surface, label) {
            d.rect(x - 41, surface, 82, 29, "ff-fill-pressure");
            d.polyline([[x - 41, surface - 10], [x - 41, surface + 29], [x + 41, surface + 29], [x + 41, surface - 10]]);
            d.line(x - 40, surface, x + 40, surface, "ff-outline-thin");
            d.text(x, surface - 17, label, small);
        }

        d.line(left, firstY, twoRows ? end : right, firstY);
        if (twoRows) d.polyline([[end, firstY], [end, secondY], [open ? start : left, secondY]]);
        if (open) {
            const sign = Math.sign(model.elevation || 0);
            const inletY = 79 + 15 * sign;
            const outletY = 79 - 15 * sign;
            reservoir(left, inletY, "Supply reservoir");
            reservoir(right, outletY, "Receiving reservoir");
            d.line(left, inletY + 29, left, firstY);
            if (twoRows) d.polyline([[start, secondY], [start, returnY], [right, returnY], [right, outletY + 29]]);
            else d.line(right, firstY, right, outletY + 29);
            if (sign) {
                d.construction(754, inletY, 780, inletY);
                d.construction(754, outletY, 780, outletY);
                d.dimension(776, inletY, 776, outletY, "", { offset: 0, extensions: false });
            }
            const elevation = model.elevation > 0 ? "+" : "";
            d.text(398, 89, "Reservoir surfaces · Δz = " + elevation + quantity(model.elevation, model.distanceUnit), middle);
        } else {
            if (!twoRows) d.polyline([[right, firstY], [right, returnY], [left, returnY]]);
            d.line(left, returnY, left, firstY);
            d.text(398, 89, "Complete loop · net elevation change = 0", middle);
            if (!twoRows && model.flow !== 0) d.arrow(418, returnY, 378, returnY, { kind: "flow" });
        }
        const flowLabel = model.flow === 0 ? "Zero design flow" : "Design flow Q = " + quantity(model.flow, model.flowUnit);
        d.text(398, 61, flowLabel, { ...middle, cls: "ff-label ff-label-strong" });
        d.circle(pump, firstY, 18, "ff-accent-body");
        d.polygon([[pump - 7, firstY - 8], [pump - 7, firstY + 8], [pump + 9, firstY]], "ff-pivot");
        d.text(pump, firstY + 37, "Pump", small);

        function drawBank(bank, startIndex, y, direction) {
            if (!bank.length) return;
            const span = (end - start) / bank.length;
            bank.forEach(([diameter, length, k], offset) => {
                const index = startIndex + offset;
                const x = direction > 0 ? start + span * (offset + 0.5) : end - span * (offset + 0.5);
                const name = model["name" + (index + 1)] || "Segment " + (index + 1);
                const characters = Array.from(name);
                const shortName = characters.length > 15 ? characters.slice(0, 14).join("") + "…" : name;
                const group = d.group("fluid-system-segment", { "data-segment-index": index, "data-segment-name": name });
                group.rect(x - 59, y - 48, 118, 138, "fluid-diagram-hit-area", { fill: "transparent" });
                group.rect(x - 45, y - 7, 90, 14, "ff-body fluid-diagram-pipe");
                if (k > 0) {
                    group.line(x + 26, y - 11, x + 26, y + 11, "ff-outline-thin");
                    group.line(x + 31, y - 11, x + 31, y + 11, "ff-outline-thin");
                }
                if (model.flow !== 0) group.arrow(x - 17 * direction, y - 17, x + 17 * direction, y - 17, { kind: "flow" });
                group.text(x, y - 30, "S" + (index + 1), { ...middle, cls: "ff-label ff-label-strong" });
                const nameBox = group.el("svg", { x: x - 57, y: y + 12, width: 114, height: 20, overflow: "hidden" });
                root.FormulaFoundryDiagram.add(document, nameBox, "text",
                    { x: 57, y: 15, "text-anchor": "middle", class: "ff-label ff-label-small" }, shortName);
                group.text(x, y + 45, "ID " + quantity(diameter > 0 ? diameter : null, model.diameterUnit), small);
                group.text(x, y + 63, "L " + quantity(length >= 0 ? length : null, model.distanceUnit), small);
                if (model.heads) {
                    group.text(x, y + 81, "Loss " + quantity(model.heads[index], model.distanceUnit),
                        { ...middle, cls: "ff-label ff-label-small ff-label-accent" });
                }
            });
        }

        drawBank(rows.slice(0, 4), 0, firstY, 1);
        drawBank(rows.slice(4), 4, secondY, -1);
        if (model.pumpHead !== undefined) {
            d.text(398, summaryY, "Required pump head " + quantity(model.pumpHead, model.distanceUnit)
                + " · Shaft power " + quantity(model.shaftPower, model.powerUnit), { ...middle, cls: "ff-label ff-label-strong" });
        } else {
            d.text(398, summaryY, "Calculate to annotate segment losses and pump duty.", { ...middle, cls: "ff-note" });
        }
        return d.svg;
    }

    // Display values are supplied by the editor and solver. The SVG never calculates a loss.
    function describe(inputs, result) {
        const { units, segments } = inputs;
        const model = {
            mode: inputs.systemType, diameterUnit: units.diameter, distanceUnit: units.distance,
            flowUnit: units.flow, powerUnit: units.power,
            rows: segments.map(({ diameter, length, minorCoefficient }) => [diameter ?? -1, length ?? -1, minorCoefficient ?? -1])
        };
        if (inputs.flow >= 0 && inputs.flow !== null) model.flow = inputs.flow;
        const elevation = inputs.systemType === "closed" ? 0 : inputs.elevation;
        if (elevation !== null) model.elevation = elevation;
        segments.forEach((segment, index) => {
            model["name" + (index + 1)] = root.FormulaFoundryFluidSystem.segmentName(segment, index);
        });
        if (result) {
            const fromSI = root.FormulaFoundryFluidSystem.fromSI;
            model.heads = result.segments.map(({ headLoss }) => fromSI(headLoss, "distance", units.distance));
            model.pumpHead = fromSI(result.totals.pumpHead, "distance", units.distance);
            model.shaftPower = fromSI(result.totals.shaftPower, "power", units.power);
        }
        return model;
    }

    root.FormulaFoundryFluidDiagram = { describe };
})(window);
