(function (root) {
    "use strict";

    const diagrams = root.FormulaFoundryCalculatorDiagrams;
    const { scene } = root.FormulaFoundryDiagram;
    const { T } = diagrams;
    const WIDTH = 390;
    const COMPONENT_LIMIT = 12;
    const SAMPLE_LIMIT = 61;
    const OPEN = 1;
    const NO_VOLTAGE = 2;
    const NO_CURRENT = 4;
    const NO_VALUE = 8;
    const UNKNOWN = [0, 0, 0, NO_VALUE | NO_VOLTAGE | NO_CURRENT];
    const PREFIXES = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]];

    function quantity(value, unit) {
        if (!Number.isFinite(value)) return "—";
        const magnitude = Math.abs(value);
        const prefix = magnitude && unit && unit !== "°" && magnitude < 1e12 && PREFIXES.find(([scale]) => magnitude >= scale);
        const num = prefix ? value / prefix[0] : value;
        const shown = num === 0 || Math.abs(num) >= 0.001 && Math.abs(num) < 1000
            ? String(Number(num.toPrecision(4)))
            : num.toExponential(2);
        return shown.replace(/^-/, "−") + (unit === "°" ? unit : unit ? " " + (prefix ? prefix[1] : "") + unit : "");
    }

    function label(d, x, y, text, anchor = "middle", cls = "ff-label ff-label-small") {
        return d.text(x, y, text, { anchor, cls });
    }

    function drawing(document, height, title, description) {
        return scene(document, { size: [WIDTH, height], label: title, title, description, className: "electrical-svg" });
    }

    function node(d, x, y) {
        d.circle(x, y, 3.5, "ff-pivot");
    }

    function ground(d, x, y) {
        d.line(x, y, x, y + 9);
        d.line(x - 10, y + 9, x + 10, y + 9);
        d.line(x - 7, y + 13, x + 7, y + 13);
        d.line(x - 3, y + 17, x + 3, y + 17);
    }

    // Component symbols are drawn on a local horizontal axis, then turned to match the wire.
    function symbol(d, name, x, y, turn = 0, id = null) {
        const s = d.group("electrical-symbol", {
            transform: "translate(" + x + " " + y + ") rotate(" + turn + ")",
            "data-symbol": name,
            ...(id ? { "data-component": id } : {})
        });
        const lead = (begin, end) => s.line(begin, 0, end, 0);
        if (name === "resistor") {
            s.polyline([[-40, 0], [-29, 0], [-24, -8], [-15, 8], [-5, -8], [5, 8], [15, -8], [24, 8], [29, 0], [40, 0]]);
        } else if (name === "short") {
            lead(-40, 40);
        } else if (name === "open") {
            lead(-40, -13);
            lead(13, 40);
            s.circle(-10, 0, 3);
            s.circle(10, 0, 3);
        } else if (name === "capacitor") {
            lead(-40, -5);
            lead(5, 40);
            s.line(-5, -13, -5, 13);
            s.line(5, -13, 5, 13);
        } else if (name === "inductor") {
            lead(-40, -24);
            s.path("M -24 0 a 6 8 0 0 1 12 0 a 6 8 0 0 1 12 0 a 6 8 0 0 1 12 0 a 6 8 0 0 1 12 0");
            lead(24, 40);
        } else if (name === "speaker") {
            lead(-40, -8);
            lead(8, 40);
            s.rect(-8, -6, 16, 12);
            s.polyline([[-8, -6], [-15, -19], [15, -19], [8, -6]]);
        } else {
            lead(-40, -15);
            lead(15, 40);
            s.circle(0, 0, 15);
            if (name === "current-source") s.arrow(9, 0, -9, 0, { kind: "stress" });
            if (name === "ac-source") s.path("M -10 0 C -6 -11, -4 -11, 0 0 S 6 11, 10 0", "ff-outline-thin");
            if (name === "dc-source") {
                s.line(-10, 0, -4, 0, "ff-outline-thin");
                s.line(-7, -3, -7, 3, "ff-outline-thin");
                s.line(4, 0, 10, 0, "ff-outline-thin");
            }
        }
        return s;
    }

    function wireComponent(d, name, x1, y1, x2, y2, id) {
        const x = (x1 + x2) / 2;
        const y = (y1 + y2) / 2;
        const dx = Math.sign(x2 - x1);
        const dy = Math.sign(y2 - y1);
        const angle = dy ? dy * 90 : dx < 0 ? 180 : 0;
        d.line(x1, y1, x - dx * 40, y - dy * 40);
        d.line(x + dx * 40, y + dy * 40, x2, y2);
        return symbol(d, name, x, y, angle, id);
    }

    function polarity(d, x, y, vertical) {
        label(d, vertical ? x - 13 : x - 31, vertical ? y - 22 : y - 10, "+");
        label(d, vertical ? x - 13 : x + 31, vertical ? y + 24 : y - 10, "−");
    }

    // Reversible arrows follow conventional current. Reference arrows are held fixed
    // where the result is intentionally signed against the stated branch reference.
    function currentArrow(d, x1, y1, x2, y2, current, reference = false) {
        if (!reference && (!Number.isFinite(current) || current === 0)) return;
        const direction = !reference && current < 0 ? [x2, y2, x1, y1] : [x1, y1, x2, y2];
        d.arrow(...direction, { kind: "force" }).setAttribute("data-current-direction",
            reference ? "reference" : current < 0 ? "reverse" : "forward");
    }

    function component(row, index, speaker = false) {
        const [value, voltage, current, flags] = row;
        const id = (speaker ? "SP" : "R") + (index + 1);
        const open = Boolean(flags & OPEN);
        return {
            id,
            name: speaker ? "speaker" : open ? "open" : value === 0 && !(flags & NO_VALUE) ? "short" : "resistor",
            valueLabel: id + "  " + (open ? "Open" : quantity(flags & NO_VALUE ? undefined : value, "Ω")),
            voltage: flags & NO_VOLTAGE ? undefined : voltage,
            current: flags & NO_CURRENT ? undefined : current
        };
    }

    function seriesNetwork(document, m, title, { speaker = false, ohm = false } = {}) {
        const rows = m.components?.length ? m.components : Array(ohm ? 1 : 2).fill(UNKNOWN);
        const tap = Number.isInteger(m.tap) && m.tap > 0 && m.tap < rows.length ? m.tap : 0;
        const pitch = 84;
        const top = 70;
        const bottom = top + rows.length * pitch + (tap ? 28 : 0);
        const d = drawing(document, bottom + 53, title,
            "One loop with a common current through all components. The source reference polarity is positive at the top.");
        const left = 36;
        const right = 153;
        const source = speaker ? "ac-source" : "dc-source";
        wireComponent(d, source, left, top, left, bottom);
        d.line(left, top, right, top);
        d.line(right, bottom, left, bottom);
        label(d, 56, (top + bottom) / 2 - 7, speaker ? "Amp (RMS)" : "Source", "start");
        label(d, 56, (top + bottom) / 2 + 13, quantity(m.sourceVoltage, "V"), "start");
        if (!speaker) ground(d, right, bottom);
        label(d, 195, 32, "Loop current  " + quantity(Math.abs(m.totalCurrent), "A") + (speaker ? " RMS" : ""));
        if (!speaker) currentArrow(d, 72, 51, 118, 51, m.totalCurrent);
        let rowTop = top;
        rows.forEach((row, i) => {
            const c = component(row, i, speaker);
            const y = rowTop + pitch / 2;
            wireComponent(d, c.name, right, rowTop, right, rowTop + pitch, c.id);
            if (!speaker) polarity(d, right, y, true);
            label(d, 175, y - 3, c.valueLabel, "start", "ff-label ff-label-strong");
            label(d, 175, y + 19, "V  " + quantity(c.voltage, "V") + "    I  " + quantity(Math.abs(c.current), "A"), "start");
            rowTop += pitch;
            if (i + 1 === tap) {
                d.line(right, rowTop, right, rowTop + 28);
                d.line(right, rowTop + 12, 185, rowTop + 12);
                node(d, right, rowTop + 12);
                label(d, 191, rowTop + 16, "Output  " + quantity(m.outputVoltage, "V"), "start", "ff-label ff-label-accent");
                rowTop += 28;
            }
        });
        node(d, right, top);
        node(d, right, bottom);
        if (!speaker) label(d, 160, bottom + 17, "0 V reference", "start");
        return d.svg;
    }

    function parallelNetwork(document, m, title, { speaker = false, divider = false } = {}) {
        const rows = m.components?.length ? m.components : [UNKNOWN, UNKNOWN];
        const left = 39;
        const right = 351;
        const top = 50;
        const first = 136;
        const pitch = 85;
        const bottom = first + pitch * (rows.length - 1);
        const d = drawing(document, bottom + 63, title,
            "The branches connect the same two nodes, so they share the voltage between the left and right rails.");
        wireComponent(d, speaker ? "ac-source" : divider ? "current-source" : "dc-source", left, top, right, top);
        label(d, 195, 24, speaker ? "Amp  " + quantity(m.sourceVoltage, "V") + " RMS"
            : divider ? "Source  " + quantity(m.totalCurrent, "A")
            : "Source  " + quantity(m.sourceVoltage, "V"));
        d.line(left, top, left, bottom);
        d.line(right, top, right, bottom);
        if (!speaker) {
            currentArrow(d, 59, 61, 59, 94, m.totalCurrent);
            ground(d, right, bottom);
        }
        label(d, 261, 83, "Total  " + quantity(Math.abs(m.totalCurrent), "A") + (speaker ? " RMS" : ""));
        rows.forEach((row, i) => {
            const c = component(row, i, speaker);
            const y = first + i * pitch;
            const x = 142;
            d.line(left, y, x - 40, y);
            d.line(x + 40, y, right, y);
            symbol(d, c.name, x, y, 0, c.id);
            node(d, left, y);
            node(d, right, y);
            if (!speaker) {
                polarity(d, x, y, false);
                currentArrow(d, 240, y + 15, 294, y + 15, c.current);
            }
            label(d, x, y - (speaker ? 26 : 34), c.valueLabel, "middle", "ff-label ff-label-strong");
            label(d, x, y + 25, "V  " + quantity(c.voltage, "V"));
            label(d, 267, y - 10, "I  " + quantity(Math.abs(c.current), "A"));
        });
        if (!speaker) label(d, right, bottom + 42, "0 V reference", "end");
        return d.svg;
    }

    function kirchhoff(document, m) {
        const d = drawing(document, 318, "Two-loop DC circuit with a shared center resistor",
            "R1 and R3 reference currents point toward node B, and the R2 reference current points from B to ground. Negative values indicate actual current opposite the arrow.");
        const left = 40;
        const center = 195;
        const right = 350;
        const top = 87;
        const bottom = 276;
        const rows = m.components?.length === 3 ? m.components : [UNKNOWN, UNKNOWN, UNKNOWN];
        const [r1, r2, r3] = rows.map((row, index) => component(row, index));
        wireComponent(d, "dc-source", left, top, left, bottom);
        wireComponent(d, "dc-source", right, top, right, bottom);
        wireComponent(d, r1.name, left, top, center, top, r1.id);
        wireComponent(d, r3.name, center, top, right, top, r3.id);
        wireComponent(d, r2.name, center, top, center, bottom, r2.id);
        d.line(left, bottom, right, bottom);
        [left, center, right].forEach((x) => node(d, x, top));
        node(d, center, bottom);
        ground(d, center, bottom);
        label(d, 45, 32, "A  " + quantity(m.leftVoltage, "V"));
        label(d, center, 32, "B  " + quantity(m.centerVoltage, "V"));
        label(d, 345, 32, "C  " + quantity(m.rightVoltage, "V"));
        label(d, center + 21, 300, "0 V reference", "start");

        const lx = (left + center) / 2;
        const rx = (right + center) / 2;
        polarity(d, lx, top, false);
        label(d, rx - 31, top - 10, "−");
        label(d, rx + 31, top - 10, "+");
        label(d, lx, top - 27, r1.valueLabel);
        label(d, rx, top - 27, r3.valueLabel);
        label(d, lx, top + 24, "V  " + quantity(r1.voltage, "V"));
        label(d, rx, top + 24, "V  " + quantity(r3.voltage, "V"));
        currentArrow(d, lx - 24, top + 42, lx + 24, top + 42, r1.current, true);
        currentArrow(d, rx + 24, top + 42, rx - 24, top + 42, r3.current, true);
        label(d, lx, top + 65, "I₁  " + quantity(r1.current, "A"));
        label(d, rx, top + 65, "I₃  " + quantity(r3.current, "A"));

        const cy = (top + bottom) / 2;
        polarity(d, center, cy, true);
        currentArrow(d, center - 31, cy - 14, center - 31, cy + 19, r2.current, true);
        label(d, center + 18, cy - 7, r2.valueLabel, "start");
        label(d, center + 18, cy + 15, "V  " + quantity(r2.voltage, "V"), "start");
        label(d, center + 18, cy + 37, "I₂  " + quantity(r2.current, "A"), "start");
        label(d, left + 14, cy + 32, "Source A", "start");
        label(d, right - 14, cy + 32, "Source C", "end");
        return d.svg;
    }

    function loadedDivider(document, m) {
        const d = drawing(document, 316, "Loaded voltage divider with R2 and the load in parallel",
            "R1 leads to the output node, and R2 and the load resistance return separately from the output to the common reference.");
        const [r1, r2] = (m.components?.length === 2 ? m.components : [UNKNOWN, UNKNOWN]).map((row, i) => component(row, i));
        wireComponent(d, "dc-source", 43, 61, 43, 268);
        wireComponent(d, "resistor", 43, 61, 205, 61, r1.id);
        d.line(205, 61, 205, 141);
        d.line(145, 141, 311, 141);
        wireComponent(d, "resistor", 145, 141, 145, 268, r2.id);
        wireComponent(d, "resistor", 311, 141, 311, 268, "RL");
        d.line(43, 268, 311, 268);
        [[145, 141], [205, 141], [311, 141], [145, 268], [311, 268]].forEach(([x, y]) => node(d, x, y));
        ground(d, 205, 268);
        label(d, 19, 203, quantity(m.sourceVoltage, "V"), "start");
        label(d, 124, 36, r1.valueLabel);
        polarity(d, 124, 61, false);
        label(d, 124, 88, "I  " + quantity(r1.current, "A"));
        polarity(d, 145, 204, true);
        polarity(d, 311, 204, true);
        label(d, 161, 193, r2.valueLabel, "start");
        label(d, 161, 217, "I  " + quantity(r2.current, "A"), "start");
        label(d, 290, 193, "Load  " + quantity(m.loadResistance, "Ω"), "end");
        label(d, 290, 239, "I  " + quantity(m.loadCurrent, "A"), "end");
        label(d, 204, 130, "Output  " + quantity(m.outputVoltage, "V"), "middle", "ff-label ff-label-accent");
        return d.svg;
    }

    function wireDrop(document, m) {
        const d = drawing(document, 244, "DC wire run with separate outgoing and return conductors",
            "The source and load are joined through two equal conductor resistances, one on the outgoing path and one on the return path.");
        wireComponent(d, "dc-source", 49, 58, 49, 184);
        wireComponent(d, "resistor", 49, 58, 336, 58, "outgoing");
        wireComponent(d, "resistor", 336, 58, 336, 184, "load");
        wireComponent(d, "resistor", 49, 184, 336, 184, "return");
        label(d, 190, 33, "Outgoing conductor  " + quantity(m.oneWayResistance, "Ω"));
        label(d, 190, 211, "Return conductor  " + quantity(m.oneWayResistance, "Ω"));
        label(d, 74, 113, "Supply", "start");
        label(d, 74, 134, quantity(m.sourceVoltage, "V"), "start");
        label(d, 307, 113, "Load terminals", "end");
        label(d, 307, 134, quantity(m.loadVoltage, "V"), "end");
        currentArrow(d, 163, 81, 217, 81, m.totalCurrent);
        label(d, 190, 104, quantity(m.totalCurrent, "A"));
        return d.svg;
    }

    function reactiveLoop(document, m, kind) {
        const ac = kind === "rlc";
        const rc = kind === "rc";
        const hasC = rc || ac;
        const d = drawing(document, 238, ac ? "Series RLC circuit" : rc ? "Series RC circuit" : "Series RL circuit",
            ac ? "An AC source drives R, L and C in one series loop."
                : "After the source step, the resistor and reactive component carry the same loop current. Polarity marks define the signed voltages.");
        const top = 70;
        const bottom = 182;
        const left = 44;
        const right = 256;
        wireComponent(d, ac ? "ac-source" : "dc-source", left, top, left, bottom);
        wireComponent(d, "resistor", left, top, right, top, "R");
        wireComponent(d, hasC ? "capacitor" : "inductor", right, top, right, bottom, hasC ? "C" : "L");
        if (ac) wireComponent(d, "inductor", left, bottom, right, bottom, "L");
        else d.line(left, bottom, right, bottom);
        label(d, 150, 39, "R  " + quantity(m.resistance, "Ω"), "middle", "ff-label ff-label-strong");
        label(d, right + 21, 121, (hasC ? "C  " + quantity(m.capacitance, "F") : "L  " + quantity(m.inductance, "H")), "start");
        if (ac) {
            label(d, 150, 213, "L  " + quantity(m.inductance, "H"));
            label(d, 65, 120, quantity(m.sourceVoltage, "V") + " RMS", "start");
            label(d, 65, 140, quantity(m.frequency, "Hz"), "start");
            label(d, 65, 160, "I  " + quantity(m.totalCurrent, "A") + " RMS", "start");
        } else {
            polarity(d, 150, top, false);
            polarity(d, right, 126, true);
            label(d, 150, 94, "Vᵣ  " + quantity(m.resistorVoltage, "V"));
            label(d, right + 21, 145, "V  " + quantity(m.reactiveVoltage, "V"), "start");
            label(d, 64, 130, "Vₛ", "start");
            currentArrow(d, 126, 119, 174, 119, m.totalCurrent);
            label(d, 150, 145, "I  " + quantity(Math.abs(m.totalCurrent), "A"));
            label(d, 18, 216, "Step source  " + quantity(m.sourceVoltage, "V"), "start");
            label(d, 370, 216, "At t = " + quantity(m.time, "s"), "end");
            ground(d, right, bottom);
        }
        return d.svg;
    }

    function powerTriangle(document, m) {
        const d = drawing(document, 242, "Single-phase AC power triangle",
            "Real power is horizontal, positive reactive power points up and negative reactive power points down. Apparent power is the magnitude of the diagonal.");
        const x = 78;
        const y = 113;
        d.line(55, y, 323, y, "ff-construction");
        d.line(x, 31, x, 193, "ff-construction");
        label(d, 327, y + 4, "P", "start");
        label(d, x, 26, "+Q");
        label(d, x, 207, "−Q");
        if (m.apparentPower > 0 && Number.isFinite(m.realPower) && Number.isFinite(m.reactivePower)) {
            const p = Math.max(0, Math.min(1, m.realPower / m.apparentPower));
            const q = Math.max(-1, Math.min(1, m.reactivePower / m.apparentPower));
            const dx = 190 * p;
            const dy = 190 * q;
            const scale = Math.min(1, 77 / Math.max(1, Math.abs(dy)));
            const endX = x + dx * scale;
            const endY = y - dy * scale;
            d.line(x, y, endX, y, "ff-outline");
            d.line(endX, y, endX, endY, "ff-ghost");
            d.arrow(x, y, endX, endY, { kind: "force" });
            node(d, endX, y);
            if (Math.abs(q) > 0.14 && p > 0.14) d.momentArrow(x, y, 27, 0, Math.atan2(q, p) * 180 / Math.PI);
        } else {
            node(d, x, y);
        }
        label(d, 178, 24, "P  " + quantity(m.realPower, "W"));
        label(d, 320, 24, "Q  " + quantity(m.reactivePower, "var"));
        label(d, 178, 224, "S  " + quantity(m.apparentPower, "VA"));
        // Angle labels remain legible for unity power factor and nearly vertical triangles.
        label(d, 320, 224, "φ  " + quantity(m.phase === undefined ? undefined : m.phase * 180 / Math.PI, "°"));
        return d.svg;
    }

    function chartPanel(d, offset, xAxis, rows, selected, xProp, yProps, logX) {
        const left = 71;
        const right = 367;
        const top = offset + 36;
        const bottom = offset + 144;
        const unitY = yProps[0].unit;
        const values = rows.concat(selected ? [selected] : []).flatMap((row) => yProps.map((series) => row[series.col]));
        const low = Math.min(0, ...values);
        const high = Math.max(0, ...values);
        const scale = Math.max(Math.abs(low), Math.abs(high)) || 1;
        const minY = low / scale;
        const maxY = high / scale;
        const fraction = (value) => high === low ? 0.5 : (value / scale - minY) / (maxY - minY);
        const px = (value) => {
            const x = logX ? Math.log(value) : value;
            return left + (right - left) * ((x - xAxis.min) / (xAxis.max - xAxis.min));
        };
        const py = (value) => bottom - (bottom - top) * fraction(value);

        for (const f of (high === low ? [0.5] : [0, 0.5, 1])) {
            const tickVal = (minY * (1 - f) + maxY * f) * scale;
            d.line(left, py(tickVal), right, py(tickVal), tickVal === 0 ? "ff-plot-zero" : "ff-plot-grid");
            label(d, left - 6, py(tickVal) + 4, quantity(tickVal, unitY), "end");
        }
        if (low < 0 && high > 0) d.line(left, py(0), right, py(0), "ff-plot-zero");
        d.line(left, top, left, bottom, "ff-plot-axis");
        d.line(left, bottom, right, bottom, "ff-plot-axis");
        for (const [i, t] of [0, 0.5, 1].entries()) {
            const tick = xAxis.min * (1 - t) + xAxis.max * t;
            const x = left + (right - left) * t;
            d.line(x, bottom, x, bottom + 4, "ff-plot-axis");
            label(d, x, bottom + 19, quantity(logX ? Math.exp(tick) : tick, xProp.unit),
                i === 0 ? "start" : i === 2 ? "end" : "middle");
        }
        if (selected) d.line(px(selected[0]), top, px(selected[0]), bottom, "ff-construction").setAttribute("data-selected-x", "true");
        yProps.forEach((series, i) => {
            const line = i ? "ff-curve-radial" : "ff-curve-hoop";
            const dot = i ? "ff-marker-radial" : "ff-marker-hoop";
            const legendX = left + i * 147;
            d.line(legendX, offset + 15, legendX + 24, offset + 15, line);
            label(d, legendX + 30, offset + 19, series.label, "start");
            if (rows.length > 1) d.polyline(rows.map((row) => [px(row[0]), py(row[series.col])]), line);
            if (selected) {
                const marker = d.circle(px(selected[0]), py(selected[series.col]), 4.5, dot);
                marker.setAttribute("data-selected-series", series.label);
                marker.setAttribute("data-selected-value", String(selected[series.col]));
            }
        });
    }

    function responseChart(document, m, kind) {
        const rlc = kind === "rlc";
        const rc = kind === "rc";
        const title = rlc ? "Impedance magnitude by frequency" : "Time response and selected time";
        const d = drawing(document, rlc ? 214 : 398, title,
            rlc ? "The frequency axis is logarithmic. The dot marks the source frequency."
                : "Separate panels use volts and amperes. Dots mark the selected time on each curve.");
        const rows = (m.points || []).filter((row) => rlc ? row[0] > 0 : row[0] >= 0);
        const selected = m.selected?.[0];
        if (rows.length < 2 || !(m.maxX > m.minX) || (rlc && !(m.minX > 0))) {
            label(d, WIDTH / 2, 90, "Response samples are unavailable.");
            return d.svg;
        }
        const min = rlc ? Math.log(m.minX) : m.minX;
        const max = rlc ? Math.log(m.maxX) : m.maxX;
        if (!(max > min)) {
            label(d, WIDTH / 2, 90, "The display range is too narrow.");
            return d.svg;
        }
        const xAxis = { min, max };
        const xProp = { unit: rlc ? "Hz" : "s" };
        const visibleRows = rows.filter((row) => row[0] >= m.minX && row[0] <= m.maxX);
        const point = selected && selected[0] >= m.minX && selected[0] <= m.maxX ? selected : undefined;
        if (rlc) {
            chartPanel(d, 8, xAxis, visibleRows, point, xProp, [{ col: 1, label: "|Z|", unit: "Ω" }], true);
            label(d, 220, 205, "Frequency (log scale)");
        } else {
            chartPanel(d, 8, xAxis, visibleRows, point, xProp, [
                { col: 1, label: rc ? "Capacitor voltage" : "Inductor voltage", unit: "V" },
                { col: 2, label: "Resistor voltage", unit: "V" }
            ], false);
            chartPanel(d, 191, xAxis, visibleRows, point, xProp, [{ col: 3, label: "Loop current", unit: "A" }], false);
            label(d, 220, 388, "Time after source step");
        }
        return d.svg;
    }

    const networkSchema = {
        mode: T.pick(["series", "parallel", "voltage", "loaded", "current"]),
        sourceVoltage: T.num(),
        totalCurrent: T.num(),
        tap: T.num({ min: 1, max: 11 }),
        outputVoltage: T.num(),
        loadResistance: T.pos(),
        loadCurrent: T.num(),
        components: T.rows(COMPONENT_LIMIT, 4)
    };
    const reactiveSchema = {
        resistance: T.nonneg(), capacitance: T.pos(), inductance: T.pos(),
        sourceVoltage: T.num(), totalCurrent: T.num(), time: T.nonneg(), frequency: T.pos(),
        resistorVoltage: T.num(), reactiveVoltage: T.num()
    };

    function register(id, caption, schema, build) {
        diagrams.register(id, { caption, schema, build });
    }

    register("ohms-law", "Reference polarity is marked across the ideal source and resistor.", networkSchema,
        (document, m) => seriesNetwork(document, m, "Voltage source and a single resistor", { ohm: true }));
    register("circuit-studio", "Arrows show conventional current for nonzero currents. Voltage labels follow the marked reference polarities.", networkSchema,
        (document, m) => m.mode === "parallel" ? parallelNetwork(document, m, "Parallel resistor circuit")
            : seriesNetwork(document, m, "Series resistor circuit"));
    register("kirchhoff-circuit", "A and C are fixed by the ideal sources. Negative currents flow opposite the marked reference arrows.", {
        leftVoltage: T.num(), centerVoltage: T.num(), rightVoltage: T.num(), components: T.rows(3, 4)
    }, kirchhoff);
    register("electrical-divider", "Voltage is measured from the output to the common reference. A current source sets the total branch current in current-divider mode.", networkSchema,
        (document, m) => m.mode === "current" ? parallelNetwork(document, m, "Parallel current divider", { divider: true })
            : m.mode === "loaded" ? loadedDivider(document, m)
                : seriesNetwork(document, m, "Series voltage divider"));
    register("dc-wire-voltage-drop", "Each conductor contributes its own series resistance between source and load.", {
        sourceVoltage: T.num(), loadVoltage: T.num(), oneWayResistance: T.nonneg(), totalCurrent: T.num()
    }, wireDrop);
    register("speaker-impedance", "Wiring and computed RMS values use the selected series or parallel network of nominal speaker impedances.", networkSchema,
        (document, m) => m.mode === "parallel" ? parallelNetwork(document, m, "Parallel speaker wiring", { speaker: true })
            : seriesNetwork(document, m, "Series speaker wiring", { speaker: true }));
    register("ac-power-factor", "The triangle applies to a single-phase sinusoidal load under the indicated phase convention.", {
        realPower: T.num(), reactivePower: T.num(), apparentPower: T.nonneg(), phase: T.num()
    }, powerTriangle);

    for (const [kind, id] of [["rc", "rc-transients"], ["rl", "rl-transients"], ["rlc", "rlc-impedance"]]) {
        register(id, kind === "rlc" ? "The source voltage and current are RMS quantities." : "Polarity marks define signed component voltages. The current arrow shows the actual direction at the selected time.",
            reactiveSchema, (document, m) => reactiveLoop(document, m, kind));
        const columns = kind === "rlc" ? 2 : 4;
        register(id + "-response",
            kind === "rlc" ? "Impedance samples are bounded in frequency. The marker indicates the selected source frequency."
                : "The dashed time marker and dots identify the selected instant.",
            { minX: T.nonneg(), maxX: T.pos(), points: T.rows(SAMPLE_LIMIT, columns), selected: T.rows(1, columns) },
            (document, m) => responseChart(document, m, kind));
    }

    // Missing and open quantities stay explicit in the flat portable diagram model.
    function componentRow(value, voltage, current, open = false) {
        const flags = (open ? OPEN : Number.isFinite(value) ? 0 : NO_VALUE)
            | (Number.isFinite(voltage) ? 0 : NO_VOLTAGE)
            | (Number.isFinite(current) ? 0 : NO_CURRENT);
        return [Number.isFinite(value) ? value : 0, Number.isFinite(voltage) ? voltage : 0,
            Number.isFinite(current) ? current : 0, flags];
    }

    function networkModel(input, result, speaker = false) {
        const values = input.resistances || input.impedances || [];
        const rows = result.components ? result.components.map((c) => {
            const value = speaker ? c.impedance : c.resistance;
            return componentRow(value, c.voltage, c.current, !speaker && value === null);
        }) : values.map((value) => componentRow(value, undefined, undefined, !speaker && value === null));
        return {
            mode: input.mode,
            sourceVoltage: result.rmsVoltage ?? result.sourceVoltage ?? input.sourceVoltage,
            totalCurrent: result.totalCurrent ?? input.sourceCurrent,
            components: rows.slice(0, COMPONENT_LIMIT)
        };
    }

    function responseModel(response, fields, resonance) {
        const all = response.points.map((point) => fields.map((field) => point[field]))
            .filter((row) => row.every(Number.isFinite));
        const selected = response.selected && fields.map((field) => response.selected[field]);
        let points = all;
        if (all.length > SAMPLE_LIMIT) {
            const retained = new Set([0, all.length - 1]);
            const indexOf = (x) => all.findIndex((row) => row[0] === x);
            const selectedIndex = indexOf(selected?.[0]);
            const resonanceIndex = indexOf(resonance);
            if (selectedIndex >= 0) retained.add(selectedIndex);
            // Retain the exact resonance and neighboring samples when narrowing a saved plot.
            if (resonanceIndex >= 0) {
                for (let i = Math.max(0, resonanceIndex - 4); i <= Math.min(all.length - 1, resonanceIndex + 4); i += 1) {
                    retained.add(i);
                }
            }
            const remaining = SAMPLE_LIMIT - retained.size;
            for (let i = 1; i <= remaining; i += 1) retained.add(Math.round(i * (all.length - 1) / (remaining + 1)));
            points = all.filter((_, i) => retained.has(i));
        }
        return {
            minX: response.minX, maxX: response.maxX, points,
            ...(selected && selected.every(Number.isFinite) ? { selected: [selected] } : {})
        };
    }

    function clean(model) {
        return Object.fromEntries(Object.entries(model).filter(([, value]) => value !== undefined && value !== null));
    }

    root.FormulaFoundryElectricalDiagram = function (id, input, result = {}) {
        let model;
        let companion;
        switch (id) {
            case "ohms-law":
                model = {
                    sourceVoltage: result.voltage ?? input.voltage, totalCurrent: result.current ?? input.current,
                    components: [componentRow(result.resistance ?? input.resistance, result.voltage, result.current)]
                };
                break;
            case "circuit-studio":
            case "speaker-impedance":
                model = networkModel(input, result, id === "speaker-impedance");
                break;
            case "kirchhoff-circuit":
                model = {
                    leftVoltage: input.leftVoltage, centerVoltage: result.nodes?.center, rightVoltage: input.rightVoltage,
                    components: result.branches?.map((c) => componentRow(c.resistance, c.voltage, c.current))
                        ?? [input.leftResistance, input.centerResistance, input.rightResistance].map((value) => componentRow(value))
                };
                break;
            case "electrical-divider":
                model = {
                    ...networkModel(input, result), tap: input.mode === "series" ? input.tap : input.mode === "voltage" ? 1 : undefined,
                    outputVoltage: result.outputVoltage, loadResistance: input.loadResistance, loadCurrent: result.loadCurrent
                };
                break;
            case "dc-wire-voltage-drop":
                model = {
                    sourceVoltage: input.supplyVoltage, totalCurrent: input.loadCurrent,
                    loadVoltage: result.loadVoltage, oneWayResistance: result.oneWayResistance
                };
                break;
            case "rc-transients":
            case "rl-transients":
            case "rlc-impedance": {
                const ac = id === "rlc-impedance";
                const rc = id === "rc-transients";
                const reactiveVoltage = rc ? "capacitorVoltage" : "inductorVoltage";
                model = {
                    resistance: input.resistance, capacitance: input.capacitance, inductance: input.inductance,
                    sourceVoltage: ac ? input.voltage : input.sourceVoltage, totalCurrent: result.current,
                    frequency: input.frequency, time: input.time,
                    resistorVoltage: result.resistorVoltage, reactiveVoltage: result[reactiveVoltage]
                };
                if (result.response) {
                    const fields = ac ? ["frequency", "impedanceMagnitude"] : ["time", reactiveVoltage, "resistorVoltage", "current"];
                    companion = { id: id + "-response", model: responseModel(result.response, fields, result.resonantFrequency) };
                }
                break;
            }
            case "ac-power-factor":
                model = { realPower: result.realPower, reactivePower: result.reactivePower, apparentPower: result.apparentPower, phase: result.phase };
                break;
            default:
                return null;
        }

        return { type: "calc-diagram", id, model: clean(model), ...(companion ? { companion } : {}) };
    };
})(window);
