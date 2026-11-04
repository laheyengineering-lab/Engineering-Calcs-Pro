// ======================================================
// Formula Foundry - Design Studies engineering context
// Presentation only: renders the adapter's existing method, equations,
// assumptions and warnings, plus an illustrative SVG of the system.
// Nothing here calculates or validates engineering results; scenario
// inputs only set the (clamped) proportions of the schematic.
//
// Load AFTER js/engineering-diagram.js, js/beam-deflection-diagram.js and
// js/design-study-adapters.js.
// ======================================================
(function (root) {
    "use strict";

    const CALCULATOR_PATH = /^calculators\/[A-Za-z0-9_-]+\.html$/;
    const SCHEMATIC_NOTE = "Illustrative schematic, not to scale. Proportions follow the selected scenario's inputs where entered, limited for legibility.";

    // ---------- Adapter metadata (read-only) ----------

    function strings(value) {
        return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
    }

    function contextFor(adapter, scenario) {
        const source = adapter && typeof adapter === "object" ? adapter : {};
        let equations = source.equations;
        if (typeof source.equationsFor === "function") {
            const inputs = scenario && scenario.inputs && typeof scenario.inputs === "object" ? scenario.inputs : {};
            try { equations = source.equationsFor(inputs); } catch (error) { equations = []; }
        }
        return {
            name: typeof source.name === "string" ? source.name : "",
            method: typeof source.method === "string" ? source.method.trim() : "",
            equations: strings(equations),
            assumptions: strings(source.assumptions),
            warnings: strings(source.warnings),
            path: typeof source.path === "string" && CALCULATOR_PATH.test(source.path) ? source.path : ""
        };
    }

    // ---------- Scenario value access ----------

    function fmt(value) {
        return String(Number(value.toPrecision(4)));
    }

    function reader(adapter, scenario) {
        const inputs = scenario && scenario.inputs && typeof scenario.inputs === "object" ? scenario.inputs : {};
        const units = scenario && scenario.units && typeof scenario.units === "object" ? scenario.units : {};
        const groups = adapter && adapter.groups ? adapter.groups : {};
        const def = (id) => (adapter.inputs || []).find((input) => input.id === id);
        const raw = (id) => (typeof inputs[id] === "number" && Number.isFinite(inputs[id]) ? inputs[id] : null);
        const unitOf = (id) => {
            const input = def(id);
            if (!input) return "";
            if (input.group && groups[input.group]) return units[input.group] || groups[input.group].default || "";
            return input.unit || "";
        };
        // Single-unit (SI) value, used only for proportions.
        const si = (id) => {
            const value = raw(id);
            if (value === null) return null;
            const input = def(id);
            if (input && input.group && groups[input.group]) {
                try {
                    const base = groups[input.group].toBase(value, unitOf(id));
                    return Number.isFinite(base) ? base : null;
                } catch (error) { return null; }
            }
            return value;
        };
        return {
            raw,
            si,
            pos: (id) => { const v = si(id); return v !== null && v > 0 ? v : null; },
            text: (id) => (typeof inputs[id] === "string" && inputs[id] ? inputs[id] : null),
            unitOf,
            show(id, symbol) {
                const value = raw(id);
                if (value === null) return null;
                const unit = unitOf(id);
                return (symbol ? symbol + " = " : "") + fmt(value) + (unit ? " " + unit : "");
            }
        };
    }

    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function ratio(numerator, denominator, min, max, fallback) {
        return numerator && denominator ? clamp(numerator / denominator, min, max) : fallback;
    }

    // ---------- Drawing helpers ----------

    function canvas(document, viewBox, label, title) {
        const D = root.FormulaFoundryDiagram;
        const svg = D.createSvg(document, viewBox, label, title, "img");
        svg.setAttribute("class", "study-diagram-svg");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        D.add(document, svg, "desc", {}, label);
        const add = (tag, attributes, text) => D.add(document, svg, tag, attributes, text);
        const api = {
            svg,
            add,
            rect: (x, y, width, height, cls) => add("rect", { x, y, width, height, class: cls || "sd-body" }),
            circle: (cx, cy, r, cls) => add("circle", { cx, cy, r, class: cls || "sd-body" }),
            line: (x1, y1, x2, y2, cls) => add("line", { x1, y1, x2, y2, class: cls || "sd-dim" }),
            poly: (points, cls) => add("polygon", { points: points.map((p) => p.join(",")).join(" "), class: cls || "sd-body" }),
            text: (x, y, content, cls, anchor) => add("text", { x, y, class: cls || "sd-label", "text-anchor": anchor || "start" }, content),
            arrow(x1, y1, x2, y2, cls) {
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const head = (offset) => [x2 - 9 * Math.cos(angle + offset), y2 - 9 * Math.sin(angle + offset)]
                    .map((n) => Number(n.toFixed(2))).join(",");
                api.line(x1, y1, x2, y2, cls || "sd-load");
                add("polygon", { points: `${x2},${y2} ${head(0.4)} ${head(-0.4)}`, class: (cls || "sd-load") + " sd-head" });
            },
            // Circular moment arrow around (cx, cy), about 230 degrees; clockwise when `cw`.
            moment(cx, cy, r, cw, cls) {
                const sweep = 4;
                const start = cw ? -2.2 : -0.94;
                const end = cw ? start + sweep : start - sweep;
                const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)].map((n) => Number(n.toFixed(2)));
                const [sx, sy] = p(start);
                const [ex, ey] = p(end);
                add("path", { d: `M ${sx} ${sy} A ${r} ${r} 0 1 ${cw ? 1 : 0} ${ex} ${ey}`, class: (cls || "sd-load") + " sd-curve" });
                const tangent = end + (cw ? Math.PI / 2 : -Math.PI / 2);
                const h = (off) => [ex - 9 * Math.cos(tangent + off), ey - 9 * Math.sin(tangent + off)].map((n) => Number(n.toFixed(2))).join(",");
                add("polygon", { points: `${ex},${ey} ${h(0.4)} ${h(-0.4)}`, class: (cls || "sd-load") + " sd-head" });
            }
        };
        return api;
    }

    function result(c, description, items) {
        return { svg: c.svg, description, items: items.filter(Boolean) };
    }

    // ---------- Renderers: (document, adapter, read) -> { svg, description, items } ----------

    function cylinderForce(document, adapter, v) {
        const description = "Double-acting single-rod cylinder: a piston inside a barrel of bore D with a rod of diameter d. Pressure p acts on the piston face to extend (full piston area) and on the rod side to retract (annular area).";
        const c = canvas(document, "0 0 420 240", description, "Hydraulic or pneumatic cylinder schematic");
        const bore = 80;
        const rod = bore * ratio(v.pos("rodDiameter"), v.pos("boreDiameter"), 0.1, 0.85, 0.3);
        const cy = 105;
        c.rect(70, cy - bore / 2, 220, bore, "sd-body");
        c.rect(170, cy - bore / 2 + 2, 12, bore - 4, "sd-body-alt");
        c.rect(182, cy - rod / 2, 188, rod, "sd-body-alt");
        c.rect(72, cy - bore / 2 + 2, 98, bore - 4, "sd-fluid");
        [-22, 0, 22].forEach((dy) => c.arrow(90, cy + dy, 160, cy + dy, "sd-load"));
        c.text(120, cy - bore / 2 - 8, "pressure p acts on piston", "sd-label", "middle");
        c.text(230, cy + bore / 2 + 14, "rod side (annulus)", "sd-note", "middle");
        c.line(50, cy - bore / 2, 50, cy + bore / 2, "sd-dim");
        c.text(50, cy + bore / 2 + 16, v.show("boreDiameter", "D") || "D", "sd-dim-label", "middle");
        c.text(330, cy - rod / 2 - 6, v.show("rodDiameter", "d") || "d", "sd-dim-label", "middle");
        c.arrow(300, 190, 360, 190, "sd-motion");
        c.text(330, 207, "Extension", "sd-label", "middle");
        c.arrow(120, 190, 60, 190, "sd-motion");
        c.text(90, 207, "Retraction", "sd-label", "middle");
        c.text(210, 232, "Extension acts on full piston area; retraction on piston minus rod area.", "sd-note", "middle");
        return result(c, description, [v.show("boreDiameter", "Bore diameter D"), v.show("rodDiameter", "Rod diameter d"), v.show("workingPressure", "Working pressure p")]);
    }

    function differentialThermalExpansion(document, adapter, v) {
        const description = "Two members of one or more sections in series, each fixed at the left wall. Heating makes each free end move to the right, shown as dashed extension outlines; the differential movement is between the free ends.";
        const c = canvas(document, "0 0 420 240", description, "Differential thermal expansion schematic");
        const members = ["A", "B"].map((name) => {
            const sections = [];
            for (let n = 1; n <= 3; n += 1) {
                const length = v.pos(name + n + "Length");
                if (length) sections.push({ id: name + n, length, shown: v.show(name + n + "Length") });
            }
            return { name, sections };
        });
        if (!members[0].sections.length) members[0].sections.push({ id: "A1", length: 1, shown: null });
        const totals = members.map((m) => m.sections.reduce((sum, s) => sum + s.length, 0));
        const longest = Math.max(...totals);
        c.rect(40, 36, 12, 168, "sd-wall");
        for (let y = 40; y < 200; y += 12) c.line(40, y + 10, 52, y, "sd-hatch");
        const items = [];
        members.forEach((member, index) => {
            if (!member.sections.length) {
                c.text(60, 168, "Member B: no sections defined", "sd-note");
                return;
            }
            const top = index === 0 ? 62 : 142;
            let x = 52;
            member.sections.forEach((section, i) => {
                const width = 44 + (250 - 44 * member.sections.length) * (section.length / longest);
                c.rect(x, top, width, 36, i % 2 ? "sd-body-alt" : "sd-body");
                const label = width >= 80 && section.shown ? section.id + ": " + section.shown : section.id;
                c.text(x + width / 2, top + 22, label, "sd-label", "middle");
                if (section.shown) items.push("Section " + section.id + " initial length " + section.shown);
                x += width;
            });
            c.rect(x, top, 14, 36, "sd-extension");
            c.arrow(x + 18, top + 18, x + 52, top + 18, "sd-motion");
            c.text(x + 58, top + 22, "Member " + member.name, "sd-label");
        });
        c.text(210, 232, "Dashed outline and arrows: free expansion direction on heating (not scaled).", "sd-note", "middle");
        return result(c, description, items);
    }

    function pressFit(document, adapter, v) {
        const description = "Shaft pressed into a hub. The end view shows the hub outside diameter D, the interface diameter d and an optional shaft bore; the half-section shows the engagement length L and the radial interference at the interface (exaggerated).";
        const c = canvas(document, "0 0 420 250", description, "Press-fit shaft and hub schematic");
        const cx = 95;
        const cy = 112;
        const hubR = 76;
        const shaftR = hubR * ratio(v.pos("interfaceDiameter"), v.pos("hubOuterDiameter"), 0.25, 0.8, 0.5);
        const hollow = v.pos("shaftBoreDiameter") && v.pos("interfaceDiameter");
        c.circle(cx, cy, hubR, "sd-body");
        c.circle(cx, cy, shaftR, "sd-body-alt");
        c.add("circle", { cx, cy, r: shaftR + 4, class: "sd-interference" });
        if (hollow) c.circle(cx, cy, shaftR * ratio(v.pos("shaftBoreDiameter"), v.pos("interfaceDiameter"), 0.05, 0.85, 0.5), "sd-void");
        c.text(cx, 16, "End view", "sd-note", "middle");
        c.text(cx + shaftR + 7, cy - 2, "δ", "sd-dim-label");

        const hubOuter = 62;
        const shaftHalf = hubOuter * (shaftR / hubR);
        const mid = 112;
        const hubLeft = 250;
        const hubRight = 350;
        c.rect(hubLeft, mid - hubOuter, hubRight - hubLeft, hubOuter - shaftHalf, "sd-body");
        c.rect(hubLeft, mid + shaftHalf, hubRight - hubLeft, hubOuter - shaftHalf, "sd-body");
        c.rect(215, mid - shaftHalf, 170, shaftHalf * 2, "sd-body-alt");
        if (hollow) {
            const boreHalf = shaftHalf * ratio(v.pos("shaftBoreDiameter"), v.pos("interfaceDiameter"), 0.05, 0.85, 0.5);
            c.rect(215, mid - boreHalf, 170, boreHalf * 2, "sd-void");
        }
        c.line(hubLeft, mid + hubOuter + 12, hubRight, mid + hubOuter + 12, "sd-dim");
        c.text((hubLeft + hubRight) / 2, mid + hubOuter + 27, v.show("engagementLength", "L") || "L", "sd-dim-label", "middle");
        c.text(300, 16, "Half-section", "sd-note", "middle");
        c.text(300, mid - (hubOuter + shaftHalf) / 2 + 4, "hub", "sd-label", "middle");
        c.text(300, mid + 4, "shaft", "sd-label", "middle");

        const legend = [v.show("hubOuterDiameter", "D (hub OD)"), v.show("interfaceDiameter", "d (interface)"),
            v.show("diametralInterference", "Δd (interference, exaggerated)"), hollow ? v.show("shaftBoreDiameter", "dᵢ (bore)") : "Solid shaft"];
        legend.filter(Boolean).forEach((line, i) => c.text(20, 204 + i * 12, line, "sd-note"));
        return result(c, description, legend.concat([v.show("engagementLength", "Engagement length L")]));
    }

    function hertzianContact(document, adapter, v) {
        const spheres = v.text("configuration") === "spheres";
        const shape = ["flat", "concave"].includes(v.text("shape2")) ? v.text("shape2") : "convex";
        const description = (spheres ? "Two spheres in point contact" : "Two parallel cylinders in line contact, seen end-on")
            + (shape === "flat" ? ", body 2 a flat plate" : shape === "concave" ? ", body 1 inside a larger concave body 2" : ", both bodies convex")
            + ". Equal and opposite normal forces F press the bodies together; the small contact region is exaggerated.";
        const c = canvas(document, "0 0 420 250", description, "Hertzian contact schematic");
        const r1 = 36;
        const sizeRatio = ratio(v.pos("diameter2"), v.pos("diameter1"), 0.4, 3, 1);
        const px = 190;
        let py;
        if (shape === "concave") {
            const r2 = clamp(r1 * Math.max(sizeRatio, 1.3), 46, 80);
            py = 12 + 2 * r2;
            c.circle(px, py - r2, r2, "sd-body");
            c.circle(px, py - r1, r1, "sd-body-alt");
            c.arrow(px, py - 2 * r1 - 18, px, py - 2 * r1 + 2, "sd-load");
            c.text(px + 8, py - 2 * r1 - 6, "F", "sd-dim-label");
            c.arrow(px, py + 30, px, py + 4, "sd-load");
            c.text(px + 8, py + 24, "F", "sd-dim-label");
            c.text(px + r2 + 12, py - r2, "Body 2 (concave)", "sd-label");
            c.text(px + r1 + 8, py - r1 + 4, "Body 1", "sd-label");
        } else {
            const r2 = clamp(r1 * sizeRatio, 18, 48);
            py = 44 + 2 * r1;
            c.circle(px, py - r1, r1, "sd-body-alt");
            if (shape === "flat") c.rect(px - 110, py, 220, 40, "sd-body");
            else c.circle(px, py + r2, r2, "sd-body");
            const bottom = shape === "flat" ? py + 40 : py + 2 * r2;
            c.arrow(px, 6, px, 38, "sd-load");
            c.text(px + 8, 22, "F", "sd-dim-label");
            c.arrow(px, bottom + 32, px, bottom + 2, "sd-load");
            c.text(px + 8, bottom + 24, "F", "sd-dim-label");
            c.text(px + r1 + 10, py - r1, "Body 1", "sd-label");
            if (shape === "flat") c.text(px - 104, py + 34, "Body 2 (flat)", "sd-label");
            else c.text(px + r2 + 10, py + r2, "Body 2", "sd-label");
        }
        if (spheres) c.circle(px, py, 4, "sd-contact");
        else c.rect(px - 9, py - 2, 18, 4, "sd-contact");
        c.line(px + 34, py + 10, px + 4, py + 2, "sd-dim");
        c.text(px + 38, py + 14, "contact region (exaggerated)", "sd-note");
        c.text(300, 236, spheres ? "Point contact" : "Line contact: axes normal to page, length L", "sd-note", "middle");
        const items = [spheres ? "Two spheres (point contact)" : "Two cylinders (line contact)", "Body 2 shape: " + shape,
            v.show("diameter1", "Body 1 diameter"), shape === "flat" ? null : v.show("diameter2", "Body 2 diameter"),
            spheres ? null : v.show("contactLength", "Contact length L"), v.show("contactForce", "Normal force F")];
        return result(c, description, items);
    }

    function shaftTorsion(document, adapter, v) {
        const hollow = v.text("shaftType") === "hollow";
        const description = (hollow ? "Hollow" : "Solid") + " circular shaft of length L fixed at the left end with torque T applied at the free right end. The end view shows the outer diameter" + (hollow ? " and inner bore." : ".");
        const c = canvas(document, "0 0 420 240", description, "Shaft torsion schematic");
        const height = 70;
        const cy = 95;
        const length = clamp(height * ratio(v.pos("length"), v.pos("outerDiameter"), 1.2, 3.8, 2.8), 110, 220);
        const left = 56;
        const innerRatio = ratio(v.pos("innerDiameter"), v.pos("outerDiameter"), 0.15, 0.85, 0.55);
        c.rect(40, cy - 50, 12, 100, "sd-wall");
        for (let y = cy - 46; y < cy + 46; y += 12) c.line(40, y + 10, 52, y, "sd-hatch");
        c.rect(left, cy - height / 2, length, height, "sd-body-alt");
        if (hollow) {
            c.line(left, cy - height * innerRatio / 2, left + length, cy - height * innerRatio / 2, "sd-hidden");
            c.line(left, cy + height * innerRatio / 2, left + length, cy + height * innerRatio / 2, "sd-hidden");
        }
        c.text(left + length + 8, cy - height / 2 - 8, "T applied at free end", "sd-dim-label");
        const dimY = cy + height / 2 + 22;
        c.line(left, dimY, left + length, dimY, "sd-dim");
        c.text(left + length / 2, dimY + 15, v.show("length", "L") || "L", "sd-dim-label", "middle");

        const ex = 350;
        const ey = 160;
        const er = 34;
        c.circle(ex, ey, er, "sd-body-alt");
        if (hollow) c.circle(ex, ey, er * innerRatio, "sd-void");
        c.moment(ex, ey, er + 12, true, "sd-load");
        c.text(ex, ey + er + 30, "End view", "sd-note", "middle");
        c.text(ex + er + 12, ey - er, "T", "sd-dim-label");
        const legend = [v.show("torque", "T"), v.show("outerDiameter", "Outer diameter"), hollow ? v.show("innerDiameter", "Inner diameter") : null];
        legend.filter(Boolean).forEach((line, i) => c.text(20, 188 + i * 13, line, "sd-note"));
        c.text(20, 234, "Torque direction and shaft proportions are illustrative.", "sd-note");
        return result(c, description, [hollow ? "Hollow shaft" : "Solid shaft"].concat(legend, [v.show("length", "Length L")]));
    }

    const SECTION_FIELDS = {
        rectangular: ["width", "height"],
        "solid-circular": ["diameter"],
        "hollow-circular": ["outerDiameter", "innerDiameter"],
        "hollow-rectangular": ["outerWidth", "outerHeight", "wallThickness"],
        "i-beam": ["height", "flangeWidth", "flangeThickness", "webThickness"],
        "t-section": ["height", "flangeWidth", "flangeThickness", "webThickness"]
    };

    function sectionShape(c, type, v, cx, cy) {
        const box = 110;
        const dim = (key) => v.pos("section_" + key);
        const fit = (w, h) => {
            const s = box / Math.max(w, h);
            return [w * s, h * s];
        };
        if (type === "solid-circular") {
            c.circle(cx, cy, box / 2, "sd-body-alt");
        } else if (type === "hollow-circular") {
            c.circle(cx, cy, box / 2, "sd-body-alt");
            c.circle(cx, cy, box / 2 * ratio(dim("innerDiameter"), dim("outerDiameter"), 0.1, 0.9, 0.7), "sd-void");
        } else if (type === "hollow-rectangular") {
            const [w, h] = fit(dim("outerWidth") || 2, dim("outerHeight") || 3);
            const base = Math.min(w, h);
            const maxThickness = base * 0.4;
            const t = clamp(dim("wallThickness") ? base * dim("wallThickness") / Math.min(dim("outerWidth") || 2, dim("outerHeight") || 3) : base * 0.12,
                Math.min(3, maxThickness), maxThickness);
            c.rect(cx - w / 2, cy - h / 2, w, h, "sd-body-alt");
            c.rect(cx - w / 2 + t, cy - h / 2 + t, w - 2 * t, h - 2 * t, "sd-void");
        } else if (type === "i-beam" || type === "t-section") {
            const [w, h] = fit(dim("flangeWidth") || 2, dim("height") || 3);
            const H = dim("height") || 3;
            const maxFlangeThickness = h * 0.35;
            const maxWebThickness = w * 0.7;
            const tf = clamp((dim("flangeThickness") || H * 0.12) * h / H, Math.min(3, maxFlangeThickness), maxFlangeThickness);
            const tw = clamp((dim("webThickness") || H * 0.08) * h / H, Math.min(3, maxWebThickness), maxWebThickness);
            const x0 = cx - w / 2;
            const y0 = cy - h / 2;
            const web = [cx - tw / 2, cx + tw / 2];
            const points = type === "i-beam"
                ? [[x0, y0], [x0 + w, y0], [x0 + w, y0 + tf], [web[1], y0 + tf], [web[1], y0 + h - tf], [x0 + w, y0 + h - tf],
                    [x0 + w, y0 + h], [x0, y0 + h], [x0, y0 + h - tf], [web[0], y0 + h - tf], [web[0], y0 + tf], [x0, y0 + tf]]
                : [[x0, y0], [x0 + w, y0], [x0 + w, y0 + tf], [web[1], y0 + tf], [web[1], y0 + h], [web[0], y0 + h], [web[0], y0 + tf], [x0, y0 + tf]];
            c.poly(points, "sd-body-alt");
        } else {
            const [w, h] = fit(dim("width") || 2, dim("height") || 3);
            c.rect(cx - w / 2, cy - h / 2, w, h, "sd-body-alt");
        }
    }

    function sectionItems(adapter, v, type) {
        return (SECTION_FIELDS[type] || []).map((key) => {
            const input = (adapter.inputs || []).find((item) => item.id === "section_" + key);
            const label = input && typeof input.label === "string" ? input.label.split(" — ").pop() : key;
            return v.show("section_" + key, label);
        });
    }

    function beamBending(document, adapter, v) {
        const type = SECTION_FIELDS[v.text("sectionType")] ? v.text("sectionType") : "rectangular";
        const axis = v.text("bendingAxis") === "y" ? "y" : "x";
        const description = "Cross-section with its centroidal " + axis + " bending axis marked, next to a beam segment carrying bending moment M at both ends. Extreme fibers farthest from the bending axis carry the largest bending stress.";
        const c = canvas(document, "0 0 420 250", description, "Beam bending cross-section schematic");
        const cx = 110;
        const cy = 95;
        sectionShape(c, type, v, cx, cy);
        if (axis === "x") {
            c.line(cx - 72, cy, cx + 72, cy, "sd-axis");
            c.text(cx + 74, cy + 4, "x", "sd-dim-label");
        } else {
            c.line(cx, cy - 72, cx, cy + 72, "sd-axis");
            c.text(cx + 5, cy - 74, "y", "sd-dim-label");
        }
        c.text(20, 14, "Cross-section", "sd-note");
        c.text(20, 178, "Bending about the centroidal " + axis + " axis" + (type === "t-section" ? " (axis position schematic)" : ""), "sd-note");

        c.rect(240, 86, 150, 20, "sd-body-alt");
        c.moment(240, 96, 18, false, "sd-load");
        c.moment(390, 96, 18, true, "sd-load");
        c.text(315, 138, "M", "sd-dim-label", "middle");
        c.text(315, 50, "Beam segment under moment", "sd-note", "middle");

        const items = sectionItems(adapter, v, type);
        items.filter(Boolean).forEach((line, i) => c.text(20, 194 + i * 13, line, "sd-note"));
        return result(c, description, ["Cross-section: " + type, "Bending axis: " + axis].concat(items, [v.show("moment", "Bending moment M")]));
    }

    function beamDeflection(document, adapter, v) {
        const caseId = v.text("loadingCase") || "";
        const point = caseId.endsWith("point");
        const loadRaw = v.raw(point ? "pointLoad" : "uniformLoad");
        const spanRaw = v.raw("span");
        const span = spanRaw !== null && spanRaw > 0 ? spanRaw : null;
        const label = point ? "P" : "w";
        const svg = root.FormulaFoundryBeamDeflectionDiagram.render(document, {
            caseId,
            span,
            spanDisplay: span === null ? undefined : fmt(span),
            lengthUnit: v.unitOf("span"),
            load: loadRaw,
            loadLabel: loadRaw === null ? label : v.show(point ? "pointLoad" : "uniformLoad", label)
        });
        const description = svg.getAttribute("aria-label") || "Beam deflection schematic";
        svg.setAttribute("role", "img");
        svg.setAttribute("class", "study-diagram-svg");
        const items = [description, v.show("span", "Span L"), v.show(point ? "pointLoad" : "uniformLoad", point ? "Point load P" : "Uniform load w")];
        return { svg, description: description + " with illustrative deflected shape.", items: items.filter(Boolean) };
    }

    const RENDERERS = {
        "cylinder-force": cylinderForce,
        "differential-thermal-expansion": differentialThermalExpansion,
        "press-fit": pressFit,
        "hertzian-contact": hertzianContact,
        "shaft-torsion": shaftTorsion,
        "beam-bending-stress": beamBending,
        "beam-deflection": beamDeflection
    };

    // ---------- Public rendering ----------

    function el(document, tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function renderDiagram(document, adapter, scenario) {
        const figure = el(document, "figure", "study-diagram");
        const adapterId = adapter && adapter.id;
        const draw = RENDERERS[adapterId];
        if (!draw || !root.FormulaFoundryDiagram) {
            figure.appendChild(el(document, "p", "sd-fallback", "No diagram is available for this calculator."));
            return figure;
        }
        figure.dataset.diagram = adapterId;
        let drawn;
        try {
            drawn = draw(document, adapter, reader(adapter, scenario));
        } catch (error) {
            figure.appendChild(el(document, "p", "sd-fallback", "The diagram could not be drawn for the current inputs."));
            return figure;
        }
        figure.appendChild(drawn.svg);
        const caption = el(document, "figcaption");
        caption.appendChild(el(document, "p", "sd-caption", SCHEMATIC_NOTE));
        const details = el(document, "details", "sd-text-alt");
        details.appendChild(el(document, "summary", null, "Diagram description"));
        details.appendChild(el(document, "p", null, drawn.description));
        if (drawn.items.length) {
            const list = el(document, "ul");
            drawn.items.forEach((item) => list.appendChild(el(document, "li", null, item)));
            details.appendChild(list);
        }
        caption.appendChild(details);
        figure.appendChild(caption);
        return figure;
    }

    function section(document, title, open) {
        const details = el(document, "details", "ctx-section");
        details.open = Boolean(open);
        details.appendChild(el(document, "summary", null, title));
        return details;
    }

    function bulletList(document, items) {
        const list = el(document, "ul");
        items.forEach((item) => list.appendChild(el(document, "li", null, item)));
        return list;
    }

    // Theory column only (no diagram); the page keeps the diagram in its own host so it can refresh on input edits.
    function renderTheory(document, adapter, scenario) {
        const info = contextFor(adapter, scenario);
        const wrap = el(document, "div", "ctx-theory");
        if (info.method) {
            const method = el(document, "p", "ctx-method");
            method.appendChild(el(document, "strong", null, "Engineering method: "));
            method.appendChild(document.createTextNode(info.method));
            wrap.appendChild(method);
        }
        if (info.equations.length) {
            const equations = section(document, "Governing equations", true);
            info.equations.forEach((equation) => equations.appendChild(el(document, "div", "ctx-equation", "\\[" + equation + "\\]")));
            wrap.appendChild(equations);
        }
        if (info.assumptions.length) {
            const assumptions = section(document, "Assumptions", false);
            assumptions.appendChild(bulletList(document, info.assumptions));
            wrap.appendChild(assumptions);
        }
        if (info.warnings.length) {
            const warnings = section(document, "Model limitations and warnings", true);
            warnings.appendChild(bulletList(document, info.warnings));
            wrap.appendChild(warnings);
        }
        if (info.path) {
            const link = el(document, "a", null, "Open the " + (info.name || "original") + " calculator");
            link.href = info.path;
            const p = el(document, "p", "ctx-link");
            p.appendChild(link);
            wrap.appendChild(p);
        }
        return wrap;
    }

    root.FormulaFoundryStudyContext = { contextFor, renderDiagram, renderTheory, diagramIds: Object.keys(RENDERERS) };
})(window);
