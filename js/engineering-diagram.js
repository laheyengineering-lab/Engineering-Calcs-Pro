(function (root) {
    "use strict";

    const SVG_NS = "http://www.w3.org/2000/svg";

    function createSvg(document, viewBox, label, title, role = "group") {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", viewBox);
        svg.setAttribute("role", role);
        svg.setAttribute("aria-label", label);
        add(document, svg, "title", {}, title || label);
        return svg;
    }

    function add(document, parent, tag, attributes, text) {
        const element = document.createElementNS(SVG_NS, tag);
        Object.entries(attributes || {}).forEach(([name, value]) => {
            if (typeof value === "number" && !Number.isFinite(value)) {
                throw new Error("SVG coordinates and dimensions must be finite.");
            }
            element.setAttribute(name, String(value));
        });
        if (text !== undefined) element.textContent = String(text);
        parent.appendChild(element);
        return element;
    }

    function rangeAround(value, lowerFactor, upperFactor) {
        if (!Number.isFinite(value) || value <= 0
            || !Number.isFinite(lowerFactor) || lowerFactor <= 0
            || !Number.isFinite(upperFactor) || upperFactor <= lowerFactor) return null;
        const min = Math.max(Number.MIN_VALUE, value * lowerFactor);
        const max = Math.min(Number.MAX_VALUE, Math.max(Number.MIN_VALUE, value * upperFactor));
        return min < max ? { min, max } : null;
    }

    function viewBoxPoint(svg, event) {
        const values = String(svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
        if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
            throw new Error("The diagram viewBox is invalid.");
        }
        const [minX, minY, width, height] = values;
        const bounds = svg.getBoundingClientRect();
        const renderedWidth = Number(bounds.width) || width;
        const renderedHeight = Number(bounds.height) || height;
        return {
            x: minX + ((event.clientX - (Number(bounds.left) || 0)) / renderedWidth) * width,
            y: minY + ((event.clientY - (Number(bounds.top) || 0)) / renderedHeight) * height
        };
    }

    function bindSliderControl(handle, svg, options) {
        const { min, max, value, start, end, onChange, formatValue } = options;
        if (![min, max, value, start, end].every(Number.isFinite) || min >= max || start >= end) {
            throw new Error("The diagram control range is invalid.");
        }
        handle.setAttribute("role", "slider");
        handle.setAttribute("tabindex", "0");
        handle.setAttribute("aria-valuemin", String(min));
        handle.setAttribute("aria-valuemax", String(max));
        handle.setAttribute("aria-valuenow", String(value));
        const valueText = (number) => typeof formatValue === "function" ? formatValue(number) : String(number);
        handle.setAttribute("aria-valuetext", valueText(value));

        const valueAt = (x) => min + Math.max(0, Math.min(1, (x - start) / (end - start))) * (max - min);
        const report = (nextValue, event) => {
            const clamped = Math.max(min, Math.min(max, nextValue));
            handle.setAttribute("aria-valuenow", String(clamped));
            handle.setAttribute("aria-valuetext", valueText(clamped));
            if (typeof onChange === "function") onChange(clamped, event);
        };
        let active = false;
        const onPointerDown = (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            active = true;
            handle.focus();
            if (handle.setPointerCapture && event.pointerId !== undefined) handle.setPointerCapture(event.pointerId);
            if (event.preventDefault) event.preventDefault();
        };
        const onPointerUp = (event) => {
            if (!active) return;
            active = false;
            report(valueAt(viewBoxPoint(svg, event).x), event);
        };
        const onPointerCancel = () => { active = false; };
        const onKeyDown = (event) => {
            const step = (max - min) / 100;
            let nextValue;
            if (event.key === "ArrowRight" || event.key === "ArrowUp") nextValue = Number(handle.getAttribute("aria-valuenow")) + step;
            else if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextValue = Number(handle.getAttribute("aria-valuenow")) - step;
            else if (event.key === "Home") nextValue = min;
            else if (event.key === "End") nextValue = max;
            else return;
            event.preventDefault();
            report(nextValue, event);
        };
        handle.addEventListener("pointerdown", onPointerDown);
        svg.addEventListener("pointerup", onPointerUp);
        svg.addEventListener("pointercancel", onPointerCancel);
        handle.addEventListener("keydown", onKeyDown);

        return () => {
            handle.removeEventListener("pointerdown", onPointerDown);
            svg.removeEventListener("pointerup", onPointerUp);
            svg.removeEventListener("pointercancel", onPointerCancel);
            handle.removeEventListener("keydown", onKeyDown);
        };
    }

    // ------------------------------------------------------------------
    // Shared engineering-drawing primitives.
    // Styling lives in css/style.css (.ff-* classes) so that every diagram,
    // including report copies, shares one visual language. Quantities are
    // never distinguished by colour alone: arrow kind also changes line
    // weight/dash and every arrow or dimension is expected to carry a label.
    // ------------------------------------------------------------------
    let sceneCounter = 0;

    function formatNumber(value, significant = 4) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "—";
        if (value === 0) return "0";
        return String(Number(value.toPrecision(significant)));
    }

    // Plain-text label with optional subscripts/superscripts: "F_{ext}", "A_p", "d^2".
    function writeRichText(document, element, text) {
        const source = String(text);
        const pattern = /([_^])(?:\{([^}]*)\}|([\p{L}\p{N}]))/gu;
        let last = 0;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            if (match.index > last) element.appendChild(document.createTextNode(source.slice(last, match.index)));
            const span = document.createElementNS(SVG_NS, "tspan");
            span.setAttribute("baseline-shift", match[1] === "_" ? "sub" : "super");
            span.setAttribute("class", "ff-script");
            span.setAttribute("dy", match[1] === "_" ? "3" : "-5");
            span.textContent = match[2] !== undefined ? match[2] : match[3];
            element.appendChild(span);
            const reset = document.createElementNS(SVG_NS, "tspan");
            reset.setAttribute("dy", match[1] === "_" ? "-3" : "5");
            element.appendChild(reset);
            last = pattern.lastIndex;
        }
        if (last < source.length) element.appendChild(document.createTextNode(source.slice(last)));
    }

    function arrowHead(x, y, angle, length, width) {
        const back = [x - length * Math.cos(angle), y - length * Math.sin(angle)];
        const nx = -Math.sin(angle) * width / 2;
        const ny = Math.cos(angle) * width / 2;
        return [[x, y], [back[0] + nx, back[1] + ny], [back[0] - nx, back[1] - ny]];
    }

    const ARROW_KINDS = {
        force: { head: 11, width: 9 },
        reaction: { head: 11, width: 9 },
        pressure: { head: 7, width: 6 },
        stress: { head: 7, width: 6 },
        flow: { head: 8, width: 7 },
        motion: { head: 8, width: 7 }
    };

    function pointList(points) {
        return points.map((p) => p[0] + "," + p[1]).join(" ");
    }

    function makeContext(document, parent, state) {
        const ctx = {};
        const el = (tag, attrs, text) => add(document, parent, tag, attrs, text);
        ctx.el = el;
        ctx.parent = parent;
        ctx.line = (x1, y1, x2, y2, cls = "ff-outline") => el("line", { x1, y1, x2, y2, class: cls });
        ctx.rect = (x, y, width, height, cls = "ff-body", extra) => el("rect", Object.assign({ x, y, width, height, class: cls }, extra || {}));
        ctx.circle = (cx, cy, r, cls = "ff-body") => el("circle", { cx, cy, r, class: cls });
        ctx.path = (d, cls = "ff-outline") => el("path", { d, class: cls });
        ctx.polygon = (points, cls = "ff-body") => el("polygon", { points: pointList(points), class: cls });
        ctx.polyline = (points, cls = "ff-outline") => el("polyline", { points: pointList(points), class: cls });
        ctx.group = (cls, attrs) => makeContext(document, el("g", Object.assign({ class: cls }, attrs || {})), state);

        ctx.text = (x, y, text, options = {}) => {
            const attrs = { x, y, class: options.cls || "ff-label" };
            if (options.anchor) attrs["text-anchor"] = options.anchor;
            if (options.rotate) attrs.transform = "rotate(" + options.rotate + " " + x + " " + y + ")";
            const node = el("text", attrs);
            writeRichText(document, node, text);
            return node;
        };
        // Text below the drawing grows the viewBox instead of clipping, and notes stack without overlapping.
        const reserve = (baseline) => {
            state.noteBottom = Math.max(state.noteBottom || 0, baseline + 23);
            if (state.height && baseline + 10 > state.height) {
                state.height = Math.ceil(baseline + 10);
                const box = String(state.svg.getAttribute("viewBox")).split(" ");
                box[3] = String(state.height);
                state.svg.setAttribute("viewBox", box.join(" "));
            }
        };
        ctx.lines = (x, y, rows, options = {}) => {
            const nodes = rows.map((row, index) => ctx.text(x, y + index * (options.lineHeight || 21), row, options));
            reserve(y + Math.max(0, rows.length - 1) * (options.lineHeight || 21));
            return nodes;
        };

        ctx.centerline = (x1, y1, x2, y2) => ctx.line(x1, y1, x2, y2, "ff-centerline");
        ctx.construction = (x1, y1, x2, y2) => ctx.line(x1, y1, x2, y2, "ff-construction");

        ctx.hatchPattern = () => {
            if (state.hatchId) return state.hatchId;
            const id = "ff-hatch-" + state.id;
            const defs = state.svg.querySelector("defs") || state.svg.insertBefore(document.createElementNS(SVG_NS, "defs"), state.svg.firstChild.nextSibling);
            const pattern = add(document, defs, "pattern", { id, patternUnits: "userSpaceOnUse", width: 6, height: 6, patternTransform: "rotate(45)" });
            add(document, pattern, "line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "ff-hatch-line" });
            state.hatchId = id;
            return id;
        };
        ctx.hatchRect = (x, y, width, height) => {
            ctx.rect(x, y, width, height, "ff-section");
            return el("rect", { x, y, width, height, class: "ff-hatch", fill: "url(#" + ctx.hatchPattern() + ")" });
        };
        ctx.hatchPath = (d) => {
            ctx.path(d, "ff-section ff-section-path");
            return el("path", { d, class: "ff-hatch", fill: "url(#" + ctx.hatchPattern() + ")", "fill-rule": "evenodd" });
        };

        // Straight arrow whose tip is at (x2, y2). kind: force | reaction | pressure | stress | flow | motion.
        ctx.arrow = (x1, y1, x2, y2, options = {}) => {
            const kind = ARROW_KINDS[options.kind] ? options.kind : "force";
            const spec = ARROW_KINDS[kind];
            const length = Math.hypot(x2 - x1, y2 - y1);
            if (!(length > 1e-6)) return null;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const head = Math.min(spec.head, length * 0.6);
            const group = ctx.group("ff-arrow ff-arrow-" + kind);
            group.line(x1, y1, x2 - head * 0.85 * Math.cos(angle), y2 - head * 0.85 * Math.sin(angle), "ff-arrow-shaft");
            group.polygon(arrowHead(x2, y2, angle, head, spec.width * head / spec.head), "ff-arrow-head");
            if (options.label) {
                group.text(options.labelX !== undefined ? options.labelX : x1, options.labelY !== undefined ? options.labelY : y1 - 6,
                    options.label, { cls: "ff-label ff-label-" + kind, anchor: options.anchor || "middle" });
            }
            return group.parent;
        };

        // Curved moment/torque arrow. Angles are in degrees, counter-clockwise positive as seen on screen.
        ctx.momentArrow = (cx, cy, r, fromDeg, toDeg, options = {}) => {
            if (!(r > 0) || fromDeg === toDeg) return null;
            const rad = Math.PI / 180;
            const dir = toDeg > fromDeg ? 1 : -1;
            const head = 11;
            const trim = head * 0.8 / r * dir;
            const endTrim = toDeg * rad - trim;
            const ry = options.ry > 0 ? options.ry : r;
            const point = (a) => [cx + r * Math.cos(a), cy - ry * Math.sin(a)];
            const start = point(fromDeg * rad);
            const stop = point(endTrim);
            const sweepDeg = Math.abs(endTrim / rad - fromDeg);
            const group = ctx.group("ff-arrow ff-arrow-moment");
            group.path("M " + start[0] + " " + start[1] + " A " + r + " " + ry + " 0 " + (sweepDeg > 180 ? 1 : 0) + " " + (dir > 0 ? 0 : 1) + " " + stop[0] + " " + stop[1], "ff-arrow-shaft ff-arrow-arc");
            const tip = point(toDeg * rad);
            const tangent = Math.atan2(-dir * ry * Math.cos(toDeg * rad), -dir * r * Math.sin(toDeg * rad));
            group.polygon(arrowHead(tip[0], tip[1], tangent, head, 9), "ff-arrow-head");
            if (options.label) {
                group.text(options.labelX !== undefined ? options.labelX : cx, options.labelY !== undefined ? options.labelY : cy - r - 8,
                    options.label, { cls: "ff-label ff-label-moment", anchor: options.anchor || "middle" });
            }
            return group.parent;
        };

        // Dimension line between two points, offset along the left normal by `offset` (negative flips the side).
        ctx.dimension = (x1, y1, x2, y2, text, options = {}) => {
            const length = Math.hypot(x2 - x1, y2 - y1);
            if (!(length > 1e-6)) return null;
            const offset = options.offset === undefined ? 24 : options.offset;
            const ux = (x2 - x1) / length;
            const uy = (y2 - y1) / length;
            const nx = -uy * Math.sign(offset || 1);
            const ny = ux * Math.sign(offset || 1);
            const d = Math.abs(offset);
            const ax = x1 + nx * d, ay = y1 + ny * d, bx = x2 + nx * d, by = y2 + ny * d;
            const group = ctx.group("ff-dimension");
            if (options.extensions !== false) {
                const gap = 3, over = 5;
                group.line(x1 + nx * gap, y1 + ny * gap, ax + nx * over, ay + ny * over, "ff-extension");
                group.line(x2 + nx * gap, y2 + ny * gap, bx + nx * over, by + ny * over, "ff-extension");
            }
            const head = Math.min(9, length / 3);
            const angle = Math.atan2(by - ay, bx - ax);
            group.line(ax + ux * head * 0.8, ay + uy * head * 0.8, bx - ux * head * 0.8, by - uy * head * 0.8, "ff-dimension-line");
            group.polygon(arrowHead(ax, ay, angle + Math.PI, head, 5), "ff-dimension-head");
            group.polygon(arrowHead(bx, by, angle, head, 5), "ff-dimension-head");
            if (text !== undefined && text !== null && text !== "") {
                const mx = (ax + bx) / 2, my = (ay + by) / 2;
                const vertical = Math.abs(nx) > Math.abs(ny);
                if (vertical) {
                    group.text(mx + nx * 8, my + 5, text, { cls: "ff-label ff-label-dim", anchor: nx > 0 ? "start" : "end" });
                } else {
                    group.text(mx, my + (ny > 0 ? 18 : -7), text, { cls: "ff-label ff-label-dim", anchor: "middle" });
                }
            }
            return group.parent;
        };

        // Leader from a feature point (x1, y1) to text anchored at (x2, y2).
        ctx.leader = (x1, y1, x2, y2, text, options = {}) => {
            const group = ctx.group("ff-leader");
            group.line(x1, y1, x2, y2, "ff-leader-line");
            group.circle(x1, y1, 2.4, "ff-leader-dot");
            if (text) {
                const anchor = options.anchor || (x2 >= x1 ? "start" : "end");
                group.text(x2 + (anchor === "start" ? 4 : anchor === "end" ? -4 : 0), y2 + (options.dy === undefined ? 4 : options.dy), text, { cls: "ff-label", anchor });
            }
            return group.parent;
        };

        ctx.groundHatch = (x1, x2, y, direction = 1) => {
            const group = ctx.group("ff-ground");
            group.line(x1, y, x2, y, "ff-ground-line");
            for (let x = x1 + 4; x <= x2 + 0.1; x += 8) group.line(x, y, x - 6, y + 8 * direction, "ff-ground-tick");
            return group.parent;
        };
        ctx.pinSupport = (x, y, size = 14) => {
            const group = ctx.group("ff-support ff-support-pin");
            group.polygon([[x, y], [x - size, y + size * 1.5], [x + size, y + size * 1.5]], "ff-support-body");
            group.circle(x, y, 3, "ff-pivot");
            group.groundHatch(x - size * 1.5, x + size * 1.5, y + size * 1.5);
            return group.parent;
        };
        ctx.rollerSupport = (x, y, size = 14) => {
            const group = ctx.group("ff-support ff-support-roller");
            group.polygon([[x, y], [x - size, y + size * 1.3], [x + size, y + size * 1.3]], "ff-support-body");
            group.circle(x - size * 0.5, y + size * 1.3 + 4, 4, "ff-roller");
            group.circle(x + size * 0.5, y + size * 1.3 + 4, 4, "ff-roller");
            group.groundHatch(x - size * 1.5, x + size * 1.5, y + size * 1.3 + 8);
            return group.parent;
        };
        ctx.fixedSupport = (x, y1, y2, side = "left") => {
            const group = ctx.group("ff-support ff-support-fixed");
            const direction = side === "left" ? -1 : 1;
            group.line(x, y1, x, y2, "ff-wall-line");
            for (let y = y1 + 4; y <= y2 + 0.1; y += 9) group.line(x, y, x + direction * 9, y + 9 * -1, "ff-ground-tick");
            return group.parent;
        };
        ctx.pivot = (x, y, r = 5) => {
            const group = ctx.group("ff-pivot-mark");
            group.circle(x, y, r, "ff-pivot-ring");
            group.circle(x, y, 1.8, "ff-pivot");
            return group.parent;
        };
        // Small x/y direction indicator.
        ctx.axes = (x, y, xLabel = "x", yLabel = "y", size = 34) => {
            const group = ctx.group("ff-axes");
            group.arrow(x, y, x + size, y, { kind: "stress" });
            group.arrow(x, y, x, y - size, { kind: "stress" });
            group.text(x + size + 4, y + 4, xLabel, { cls: "ff-label ff-label-small" });
            group.text(x - 3, y - size - 5, yLabel, { cls: "ff-label ff-label-small", anchor: "middle" });
            return group.parent;
        };
        ctx.note = (x, y, text, anchor = "middle") => {
            const W = state.width || 520;
            const available = (anchor === "middle" ? 2 * Math.min(x, W - x) : anchor === "end" ? x : W - x) - 14;
            const perLine = Math.max(16, Math.floor(available / 6.9));
            const rows = [];
            let row = "";
            String(text).split(" ").forEach((word) => {
                if (row && (row + " " + word).length > perLine) {
                    rows.push(row);
                    row = word;
                } else {
                    row = row ? row + " " + word : word;
                }
            });
            rows.push(row);
            const first = Math.max(y, state.noteBottom || 0);
            const nodes = rows.map((part, index) => ctx.text(x, first + index * 16, part, { cls: "ff-note", anchor }));
            reserve(first + (rows.length - 1) * 16);
            return nodes.length === 1 ? nodes[0] : nodes;
        };
        return ctx;
    }

    // Creates a responsive, accessible diagram scene. `size` is [width, height] in viewBox units.
    function scene(document, options) {
        const { size, label, title, description } = options;
        if (!Array.isArray(size) || size.length !== 2 || !size.every((v) => Number.isFinite(v) && v > 0)) {
            throw new Error("The diagram size is invalid.");
        }
        const svg = createSvg(document, "0 0 " + size[0] + " " + size[1], label, title || label, "img");
        sceneCounter += 1;
        svg.setAttribute("class", "ff-diagram" + (options.className ? " " + options.className : ""));
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("focusable", "false");
        if (description) add(document, svg, "desc", {}, description);
        add(document, svg, "defs", {});
        const state = { id: sceneCounter, svg, hatchId: null };
        const ctx = makeContext(document, svg, state);
        ctx.svg = svg;
        state.width = size[0];
        state.height = size[1];
        ctx.width = size[0];
        ctx.height = size[1];
        return ctx;
    }

    // Native range inputs bound to existing calculator fields. The range never owns state:
    // it writes the existing input, then asks the calculator to run its normal pipeline.
    function bindFieldRanges(document, host, specs, onCommit) {
        const wrapper = document.createElement("div");
        wrapper.className = "ff-diagram-controls";
        const rows = specs.map((spec) => {
            const field = document.getElementById(spec.inputId);
            const row = document.createElement("div");
            row.className = "ff-diagram-control";
            const id = "ff-range-" + spec.inputId;
            const label = document.createElement("label");
            label.setAttribute("for", id);
            label.textContent = spec.label;
            const range = document.createElement("input");
            range.type = "range";
            range.id = id;
            const output = document.createElement("output");
            output.setAttribute("for", id);
            row.append(label, range, output);
            wrapper.appendChild(row);
            const sync = () => {
                const value = field ? Number(field.value) : NaN;
                const bounds = spec.bounds ? spec.bounds(value) : rangeAround(value, 0.5, 1.5);
                const usable = field && field.value.trim() !== "" && Number.isFinite(value) && bounds
                    && Number.isFinite(bounds.min) && Number.isFinite(bounds.max) && bounds.min < bounds.max;
                range.disabled = !usable;
                if (!usable) { output.textContent = "enter a value"; return; }
                const span = bounds.max - bounds.min;
                const step = spec.step || span / 200;
                range.min = String(bounds.min);
                range.max = String(bounds.max);
                range.step = String(step);
                range.value = String(Math.min(bounds.max, Math.max(bounds.min, value)));
                const shown = spec.decimals !== undefined ? value.toFixed(spec.decimals) : formatNumber(value);
                range.setAttribute("aria-valuetext", shown + (spec.unit ? " " + spec.unit() : ""));
                output.textContent = shown + (spec.unit ? " " + spec.unit() : "");
            };
            range.addEventListener("input", () => {
                if (!field) return;
                const next = Number(range.value);
                if (!Number.isFinite(next)) return;
                field.value = String(spec.decimals !== undefined ? Number(next.toFixed(spec.decimals)) : Number(next.toPrecision(6)));
                field.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
                if (typeof onCommit === "function") onCommit(spec, next);
                output.textContent = field.value + (spec.unit ? " " + spec.unit() : "");
            });
            return { sync, field };
        });
        host.appendChild(wrapper);
        const syncAll = () => rows.forEach((row) => row.sync());
        syncAll();
        return { element: wrapper, sync: syncAll };
    }

    root.FormulaFoundryDiagram = { add, bindSliderControl, bindFieldRanges, createSvg, formatNumber, rangeAround, scene };
})(window);
