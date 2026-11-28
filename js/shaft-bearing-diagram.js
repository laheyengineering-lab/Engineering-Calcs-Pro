(function (root) {
    "use strict";

    const diagrams = root.FormulaFoundryCalculatorDiagrams;
    const { T } = diagrams;
    const ID = "shaft-bearing";
    const MAX_LOADS = 8;
    const caption = "Axial positions are proportional to the bearing span. Shaft, bearings and arrow lengths are illustrative. Positive transverse force points up in each projection. Torque arrows look from +x toward Bearing A.";
    const schema = {
        section: T.pick(["solid", "hollow"]),
        span: T.pos(),
        outerDiameter: T.pos(),
        innerDiameter: T.nonneg(),
        lengthUnit: T.unit(),
        diameterUnit: T.unit(),
        forceUnit: T.unit(),
        torqueUnit: T.unit(),
        loads: T.rows(MAX_LOADS, 4),
        incompleteLoads: T.nums(MAX_LOADS),
        reactions: T.rows(2, 2),
        speed: T.nonneg(),
        torque: T.nums(3),
        critical: T.nonneg()
    };
    for (let index = 0; index < MAX_LOADS; index += 1) schema["loadName" + index] = T.str(60);

    diagrams.register(ID, {
        title: "Shaft and bearing assembly",
        caption,
        schema,
        validate(model) {
            return Boolean(model.section && model.span && model.outerDiameter
                && model.innerDiameter >= 0 && model.innerDiameter < model.outerDiameter
                && (model.section === "solid" ? model.innerDiameter === 0 : model.innerDiameter > 0)
                && [model.lengthUnit, model.diameterUnit, model.forceUnit, model.torqueUnit].every(Boolean)
                && model.loads && !model.incompleteLoads?.length
                && model.loads.every(([x, , , i]) => x >= 0 && x <= model.span
                    && Number.isInteger(i) && i >= 0 && i < MAX_LOADS)
                && new Set(model.loads.map((row) => row[3])).size === model.loads.length
                && model.reactions?.length === 2
                && model.speed >= 0 && model.critical >= 0 && model.critical <= model.span
                && validTorquePath(model.torque, model.span));
        },
        build: drawAssembly
    });

    function convert(value, group, units) {
        if (!Number.isFinite(value)) return null;
        const converted = root.FormulaFoundryShaftProject.fromSI(value, group, units[group]);
        return Number.isFinite(converted) ? converted : null;
    }

    function validTorquePath(torque, span) {
        if (torque?.length !== 3 || !torque.every(Number.isFinite)) return false;
        const [value, start, end] = torque;
        return start >= 0 && end <= span && (end > start || (end === start && value === 0));
    }

    function describe(draftInputs, result, units) {
        const inputs = result?.inputs ?? draftInputs;
        const model = {
            section: inputs.section,
            span: convert(inputs.span, "outputLength", units),
            outerDiameter: convert(inputs.outerDiameter, "outputDiameter", units),
            innerDiameter: inputs.section === "solid" ? 0 : convert(inputs.innerDiameter, "outputDiameter", units),
            lengthUnit: units.outputLength,
            diameterUnit: units.outputDiameter,
            forceUnit: units.outputForce,
            torqueUnit: units.outputTorque,
            speed: inputs.speed,
            loads: [],
            incompleteLoads: []
        };
        inputs.loads.forEach((load, index) => {
            const x = convert(load.position, "outputLength", units);
            if (!(model.span > 0) || x === null || x < 0 || x > model.span) return;
            const fy = convert(load.fy, "outputForce", units);
            const fz = convert(load.fz, "outputForce", units);
            if (fy === null || fz === null) model.incompleteLoads.push(index);
            model.loads.push([x, fy ?? 0, fz ?? 0, index]);
            model["loadName" + index] = (load.name || "Load " + (index + 1)).slice(0, 60);
        });
        const { value, start, end } = inputs.torque;
        const torque = [
            convert(value, "outputTorque", units),
            convert(start, "outputLength", units),
            convert(end, "outputLength", units)
        ];
        if (validTorquePath(torque, model.span)) model.torque = torque;
        if (result?.ok) {
            model.reactions = ["a", "b"].map((key) => [
                convert(result.reactions[key].fy, "outputForce", units),
                convert(result.reactions[key].fz, "outputForce", units)
            ]);
            model.critical = convert(result.combined.maximum.x, "outputLength", units);
        }
        return model;
    }

    // Leave room between numbered targets, with leaders returning to the exact coordinates.
    function stationBadges(loads, sx, left, right) {
        const gap = 43;
        const stations = loads.map((row) => ({ row, x: sx(row[0]) })).sort((a, b) => a.x - b.x);
        stations.forEach((station, index) => {
            const min = index === 0 ? left : stations[index - 1].badgeX + gap;
            station.badgeX = Math.max(min, Math.min(station.x, right - gap * (stations.length - index - 1)));
        });
        return stations;
    }

    function circlePath(cx, cy, r) {
        return "M " + (cx - r) + " " + cy
            + " a " + r + " " + r + " 0 1 0 " + (2 * r) + " 0"
            + " a " + r + " " + r + " 0 1 0 " + (-2 * r) + " 0 Z";
    }

    function drawAssembly(document, model, helpers) {
        const left = 109;
        const right = 578;
        const yPlane = 139;
        const zPlane = 282;
        const badgeY = 211;
        const d = root.FormulaFoundryDiagram.scene(document, {
            size: [790, 378],
            title: "Shaft and bearing assembly",
            label: "Shaft and bearing assembly, " + (model.loads?.length || 0) + " transverse load stations",
            description: caption
        });
        const small = { cls: "ff-label ff-label-small" };
        const strong = { cls: "ff-label ff-label-strong" };
        const middle = { anchor: "middle" };
        const q = helpers.quantity;
        const sx = (x) => left + (model.span > 0 ? helpers.clamp(x / model.span, 0, 1) : 0) * (right - left);
        const stations = stationBadges(model.loads || [], sx, left, right);
        d.text(26, 27, "SHAFT ASSEMBLY", { cls: "ff-title" });
        d.line(610, 20, 610, 332, "ff-plot-grid");
        d.text(633, 27, "SECTION VIEW", { cls: "ff-title" });
        d.text(633, 47, "Looking from +x", small);

        const sectionX = 699;
        const sectionY = 111;
        const radius = 40;
        const hasBore = model.section === "hollow" && model.innerDiameter > 0 && model.outerDiameter > model.innerDiameter;
        const boreRadius = hasBore ? radius * model.innerDiameter / model.outerDiameter : 0;
        const outerPath = circlePath(sectionX, sectionY, radius);
        const holePath = hasBore ? circlePath(sectionX, sectionY, boreRadius) : "";
        const hatch = d.hatchPath(outerPath + " " + holePath);
        hatch.previousElementSibling.setAttribute("fill-rule", "evenodd");
        d.centerline(sectionX - 52, sectionY, sectionX + 52, sectionY);
        d.centerline(sectionX, sectionY - 49, sectionX, sectionY + 49);
        d.text(sectionX, 171, "OD  " + q(model.outerDiameter, model.diameterUnit), { ...small, ...middle });
        if (model.section === "hollow") {
            d.text(sectionX, 191, "ID  " + q(model.innerDiameter, model.diameterUnit), { ...small, ...middle });
        } else {
            d.text(sectionX, 191, "Solid section", { ...small, ...middle });
        }
        d.arrow(731, 229, 696, 229, { kind: "stress" });
        d.arrow(731, 229, 731, 204, { kind: "stress" });
        d.text(683, 233, "+z", small);
        d.text(745, 208, "+y", small);
        d.line(630, 250, 768, 250, "ff-plot-grid");
        d.text(633, 272, "Shaft speed", strong);
        d.text(633, 291, model.speed === 0 ? "Stationary (0 rpm)" : q(model.speed, "rpm"), small);
        d.text(633, 314, "Applied torque pair", strong);
        d.text(633, 333, "Input  " + q(model.torque?.[0], model.torqueUnit), small);
        const outputTorque = model.torque ? -model.torque[0] : null;
        d.text(633, 353, "Output  " + q(outputTorque, model.torqueUnit), small);

        d.text(left, 89, "Bearing A", { ...small, ...middle });
        d.text(right, 89, "Bearing B", { ...small, ...middle });
        [left, right].forEach((x) => d.construction(x, yPlane - 39, x, zPlane + 35));
        if (model.torque && model.torque[0] !== 0) {
            const [value, start, end] = model.torque;
            const startX = sx(start);
            const endX = sx(end);
            const sign = Math.sign(value);
            d.line(startX, 54, endX, 54, "ff-accent-line");
            d.construction(startX, 48, startX, 109);
            d.construction(endX, 48, endX, 109);
            const inputArrow = d.momentArrow(startX, 53, 13, sign > 0 ? 10 : 270, sign > 0 ? 270 : 10, { ry: 18 });
            const outputArrow = d.momentArrow(endX, 53, 13, sign < 0 ? 10 : 270, sign < 0 ? 270 : 10, { ry: 18 });
            root.FormulaFoundryDiagram.add(document, inputArrow, "title", {}, "Torque input at x = " + q(start, model.lengthUnit));
            root.FormulaFoundryDiagram.add(document, outputArrow, "title", {}, "Torque output at x = " + q(end, model.lengthUnit));
            d.text(startX - 15, 38, "In", { ...small, anchor: "end" });
            d.text(endX + 15, 38, "Out", small);
        }

        function projection(y, axis, column) {
            d.text(24, y - 22, "x–" + axis, strong);
            d.axes(35, y + 20, "+x", "+" + axis, 25);
            if (model.section === "hollow") d.rect(left, y - 6, right - left, 12, "ff-body-muted");
            else d.rect(left, y - 6, right - left, 12);
            d.centerline(left - 12, y, right + 12, y);
            [left, right].forEach((x, index) => {
                d.rect(x - 10, y - 17, 20, 34, "ff-outline-thin", { rx: 3 });
                d.line(x - 10, y - 9, x + 10, y - 9, "ff-outline-thin");
                d.line(x - 10, y + 9, x + 10, y + 9, "ff-outline-thin");
                const reaction = model.reactions?.[index]?.[column - 1];
                if (!reaction) return;
                const direction = -Math.sign(reaction);
                const reactionX = x + (index === 0 ? -20 : 20);
                d.construction(x, y, reactionX, y);
                const arrow = d.arrow(reactionX, y - direction * 36, reactionX, y + direction * 36, { kind: "reaction" });
                const name = index === 0 ? "A" : "B";
                root.FormulaFoundryDiagram.add(document, arrow, "title", {}, "Bearing " + name + " reaction in " + axis + ": " + q(reaction, model.forceUnit));
            });
            stations.forEach(({ row, x }, order) => {
                const component = row[column];
                if (component === 0) return;
                const direction = -Math.sign(component);
                const start = y - direction * (34 + (order % 4) * 5);
                const end = y - direction * 13;
                d.construction(x, end, x, y);
                const arrow = d.arrow(x, start, x, end, { kind: "force" });
                arrow.setAttribute("data-load-arrow", String(row[3]));
                const load = model["loadName" + row[3]] || "Load " + (row[3] + 1);
                root.FormulaFoundryDiagram.add(document, arrow, "title", {}, load + " · F" + axis + " = " + q(component, model.forceUnit));
            });
        }

        projection(yPlane, "y", 1);
        projection(zPlane, "z", 2);
        const criticalX = sx(model.critical || 0);
        if (Number.isFinite(model.critical)) {
            d.line(criticalX, zPlane - 15, criticalX, zPlane + 15, "ff-failure-line");
            const mark = d.polygon([[criticalX, 309], [criticalX + 5, 314], [criticalX, 319], [criticalX - 5, 314]], "ff-accent-body");
            root.FormulaFoundryDiagram.add(document, mark, "title", {}, "Peak equivalent stress at x = " + q(model.critical, model.lengthUnit));
            d.text(24, 353, "◇ Peak stress", { ...small, cls: "ff-label ff-label-small ff-label-accent" });
        }
        d.dimension(left, 312, right, 312, "Bearing span  " + q(model.span, model.lengthUnit), { offset: 19 });

        stations.forEach(({ row: [position, fy, fz, index], x, badgeX }) => {
            const station = d.group("shaft-load-station", { "data-load-index": index });
            const name = model["loadName" + index] || "Load " + (index + 1);
            const forceLabel = model.incompleteLoads?.includes(index)
                ? "incomplete forces"
                : "Fy " + q(fy, model.forceUnit) + ", Fz " + q(fz, model.forceUnit);
            const label = name + ", x " + q(position, model.lengthUnit) + ", " + forceLabel;
            station.el("title", {}, label);
            station.parent.setAttribute("data-load-label", label);
            station.polyline([[x, yPlane + 11], [badgeX, badgeY], [x, zPlane - 11]], "ff-construction shaft-station-guide");
            station.circle(x, yPlane, 3.5, "ff-accent-body");
            station.circle(x, zPlane, 3.5, "ff-accent-body");
            station.rect(badgeX - 20, badgeY - 19, 40, 38, "shaft-station-hit", { rx: 5, fill: "transparent" });
            station.rect(badgeX - 16, badgeY - 12, 32, 24, "ff-accent-body shaft-station-badge", { rx: 5 });
            station.text(badgeX, badgeY + 4, "L" + (index + 1), { ...small, ...middle, cls: "ff-label ff-label-small ff-label-accent" });
        });
        return d.svg;
    }

    function setSelection(host, selectedIndex) {
        if (!host) return;
        host.querySelectorAll(".shaft-load-station[role=button]").forEach((station) => {
            const selected = Number(station.dataset.loadIndex) === selectedIndex;
            station.setAttribute("aria-pressed", String(selected));
        });
        host.querySelectorAll("[data-load-arrow]").forEach((arrow) => {
            arrow.classList.toggle("shaft-arrow-selected", Number(arrow.dataset.loadArrow) === selectedIndex);
        });
    }

    function mount(host, inputs, result, units, onSelect, selectedIndex) {
        const svg = diagrams.mount(host, ID, describe(inputs, result, units));
        if (!svg || !onSelect) return svg;
        svg.setAttribute("role", "group");
        svg.querySelectorAll(".shaft-load-station").forEach((station) => {
            const index = Number(station.dataset.loadIndex);
            station.setAttribute("role", "button");
            station.setAttribute("tabindex", "0");
            station.setAttribute("aria-label", "Inspect " + station.dataset.loadLabel);
            station.addEventListener("click", () => onSelect(index));
            station.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect(index);
            });
        });
        setSelection(host, selectedIndex);
        return svg;
    }

    const plots = [
        { title: "Shear force", unit: "outputForce", lines: [["shearY", "Y plane"], ["shearZ", "Z plane"]] },
        { title: "Bending moment", unit: "moment", lines: [["momentY", "Y plane"], ["momentZ", "Z plane"], ["momentResultant", "Resultant"]] },
        { title: "Internal torque", unit: "outputTorque", lines: [["torque", "Signed torque"]] },
        { title: "Equivalent stress", unit: "stress", lines: [["equivalentStress", "von Mises"]], peak: "combined" },
        { title: "Signed deflection", unit: "deflection", lines: [["deflectionY", "Y plane"], ["deflectionZ", "Z plane"]] },
        { title: "Resultant displacement", unit: "deflection", lines: [["deflectionResultant", "Resultant"]], peak: "deflection" }
    ];

    function tick(value) {
        const abs = Math.abs(value);
        return abs >= 10000 || (abs > 0 && abs < 0.01) ? value.toExponential(2) : String(Number(value.toPrecision(3)));
    }

    function drawPlot(document, plot, result, units) {
        const x0 = 75;
        const x1 = 510;
        const y0 = 62;
        const y1 = 222;
        const xUnit = units.outputLength;
        const yUnit = units[plot.unit];
        const d = root.FormulaFoundryDiagram.scene(document, {
            size: [532, 273],
            title: plot.title,
            label: plot.title + " in " + yUnit,
            description: plot.lines.map((line) => line[1]).join(", ") + " along the shaft. Axial position in " + xUnit + "."
        });
        d.text(x0, 26, plot.title + " · " + yUnit, { cls: "ff-title" });
        const span = convert(result.inputs.span, "outputLength", units);
        const samples = plot.lines.map(([field]) => result.samples.map((point) => [
            convert(point.x, "outputLength", units), convert(point[field], plot.unit, units)
        ]));
        const ys = samples.flat().map(([, y]) => y).filter(Number.isFinite);
        if (!ys.length || !(span > 0)) {
            d.text(x0, 120, "Enter a valid Young’s modulus to calculate deflection.", { cls: "ff-note" });
            return d.svg;
        }

        const high = Math.max(0, ...ys);
        const low = Math.min(0, ...ys);
        const scale = Math.max(Math.abs(high), Math.abs(low)) || 1;
        const upper = high === low ? 1 : high / scale;
        const lower = high === low ? -1 : low / scale;
        const sx = (x) => x0 + x / span * (x1 - x0);
        const sy = (y) => y1 - (y / scale - lower) / (upper - lower) * (y1 - y0);
        const curveClasses = ["ff-curve-hoop", "ff-curve-radial", "ff-curve-axial"];
        const small = { cls: "ff-label ff-label-small" };

        d.rect(x0, y0, x1 - x0, y1 - y0, "ff-plot-frame");
        for (let index = 0; index <= 4; index += 1) {
            const xValue = span * (index / 4);
            const x = sx(xValue);
            d.line(x, y0, x, y1, "ff-plot-grid");
            d.text(x, y1 + 19, tick(xValue), { ...small, anchor: "middle" });
            const yValue = (lower + (upper - lower) * (index / 4)) * scale;
            const y = sy(yValue);
            d.line(x0, y, x1, y, "ff-plot-grid");
            d.text(x0 - 8, y + 4, tick(yValue), { ...small, anchor: "end" });
        }
        d.line(x0, sy(0), x1, sy(0), "ff-plot-zero");
        const zeroTick = -4 * lower / (upper - lower);
        if (lower < 0 && upper > 0 && Math.abs(zeroTick - Math.round(zeroTick)) > 0.12) {
            // The zero line is visible even when its value falls between labeled ticks.
            d.text(x1 - 6, sy(0) - 5, "0", { ...small, anchor: "end" });
        }
        d.text((x0 + x1) / 2, 264, "Axial position from A (" + xUnit + ")", { ...small, anchor: "middle" });

        plot.lines.forEach(([, label], index) => {
            const legendX = x0 + index * 139;
            const cls = curveClasses[index];
            d.line(legendX, 44, legendX + 21, 44, cls);
            d.text(legendX + 27, 48, label, small);
            const points = samples[index].filter((point) => point.every(Number.isFinite));
            d.polyline(points.map(([x, y]) => [sx(x), sy(y)]), cls);
        });

        const peak = plot.peak && result[plot.peak].maximum;
        if (peak) {
            const x = convert(peak.x, "outputLength", units);
            const y = convert(peak.equivalentStress ?? peak.resultant, plot.unit, units);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                const marker = d.circle(sx(x), sy(y), 4, "ff-marker-hoop");
                root.FormulaFoundryDiagram.add(document, marker, "title", {},
                    "Peak " + tick(y) + " " + yUnit + " at x = " + tick(x) + " " + xUnit);
            }
        }
        return d.svg;
    }

    function renderPlots(host, result, units) {
        if (!host) return;
        if (!result?.ok) {
            host.replaceChildren();
            return;
        }
        const document = host.ownerDocument;
        host.replaceChildren(...plots.map((plot) => {
            const figure = document.createElement("figure");
            figure.className = "shaft-plot";
            figure.tabIndex = 0;
            figure.setAttribute("aria-label", plot.title);
            figure.appendChild(drawPlot(document, plot, result, units));
            return figure;
        }));
    }

    function reportSamples(result) {
        if (!result?.ok) return [];
        const samples = result.samples;
        const stride = Math.max(1, Math.ceil(samples.length / 21));
        const critical = result.combined.maximum.x;
        return samples.filter((point, index) => {
            const previous = samples[index - 1];
            const next = samples[index + 1];
            if (previous?.x === point.x) {
                return previous.shearY !== point.shearY || previous.shearZ !== point.shearZ || previous.torque !== point.torque;
            }
            return index % stride === 0 || !next || next.x === point.x || point.x === critical
                || point.x === result.deflection.maximum?.x;
        });
    }

    function chart(result, units) {
        return {
            type: "line",
            title: "Nominal equivalent stress along the shaft",
            xLabel: "Axial position from A (" + units.outputLength + ")",
            yLabel: "von Mises stress (" + units.stress + ")",
            points: reportSamples(result).map((point) => ({
                x: convert(point.x, "outputLength", units),
                y: convert(point.equivalentStress, "stress", units)
            })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        };
    }

    root.FormulaFoundryShaftDiagram = { ID, caption, describe, mount, setSelection, renderPlots, reportSamples, chart };
})(window);
