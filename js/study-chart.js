// ======================================================
// Formula Foundry - lightweight SVG line chart (no dependencies)
// Used by Design Studies and the project report.
// chart: { title, xLabel, yLabel, points: [{ x, y|null }] }
// Failed samples (y = null) break the line and are marked on the x axis;
// nothing is interpolated or extrapolated. Text is set with textContent.
// ======================================================
(function (root) {
    "use strict";

    const NS = "http://www.w3.org/2000/svg";

    function niceTicks(min, max, count) {
        if (min === max) return [min];
        const raw = (max - min) / count;
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const norm = raw / mag;
        const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
        const ticks = [];
        for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
        return ticks;
    }

    function fmt(v) {
        if (v === 0) return "0";
        const a = Math.abs(v);
        return a >= 1e5 || a < 1e-3 ? v.toExponential(2) : String(Number(v.toPrecision(5)));
    }

    function node(doc, tag, attrs, content) {
        const el = doc.createElementNS(NS, tag);
        Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, String(attrs[k])));
        if (content !== undefined) el.textContent = content;
        return el;
    }

    function createLineChart(doc, chart) {
        const W = 640;
        const H = 360;
        const m = { top: 40, right: 20, bottom: 56, left: 72 };
        const svg = node(doc, "svg", { viewBox: "0 0 " + W + " " + H, class: "study-chart", role: "img", preserveAspectRatio: "xMidYMid meet" });
        svg.appendChild(node(doc, "title", {}, chart.title + ". " + chart.yLabel + " against " + chart.xLabel + "."));
        svg.appendChild(node(doc, "text", { x: W / 2, y: 22, "text-anchor": "middle", class: "chart-title" }, chart.title));

        const xs = chart.points.map((p) => p.x);
        const ys = chart.points.filter((p) => p.y !== null).map((p) => p.y);
        let xMin = Math.min.apply(null, xs);
        let xMax = Math.max.apply(null, xs);
        if (xMin === xMax) { xMin -= 1; xMax += 1; }
        let yMin = ys.length ? Math.min.apply(null, ys) : 0;
        let yMax = ys.length ? Math.max.apply(null, ys) : 1;
        if (yMin === yMax) { const pad = Math.abs(yMin) * 0.1 || 1; yMin -= pad; yMax += pad; }
        const yPad = (yMax - yMin) * 0.05;
        yMin -= yPad; yMax += yPad;
        const sx = (x) => m.left + (x - xMin) / (xMax - xMin) * (W - m.left - m.right);
        const sy = (y) => H - m.bottom - (y - yMin) / (yMax - yMin) * (H - m.top - m.bottom);

        niceTicks(yMin, yMax, 5).forEach((t) => {
            svg.appendChild(node(doc, "line", { x1: m.left, x2: W - m.right, y1: sy(t), y2: sy(t), class: "chart-grid" }));
            svg.appendChild(node(doc, "text", { x: m.left - 6, y: sy(t) + 4, "text-anchor": "end", class: "chart-tick" }, fmt(t)));
        });
        niceTicks(xMin, xMax, 6).forEach((t) => {
            svg.appendChild(node(doc, "line", { x1: sx(t), x2: sx(t), y1: m.top, y2: H - m.bottom, class: "chart-grid" }));
            svg.appendChild(node(doc, "text", { x: sx(t), y: H - m.bottom + 16, "text-anchor": "middle", class: "chart-tick" }, fmt(t)));
        });
        svg.appendChild(node(doc, "rect", { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, class: "chart-frame" }));
        svg.appendChild(node(doc, "text", { x: (m.left + W - m.right) / 2, y: H - 10, "text-anchor": "middle", class: "chart-axis-label" }, chart.xLabel));
        svg.appendChild(node(doc, "text", { x: 16, y: (m.top + H - m.bottom) / 2, "text-anchor": "middle", class: "chart-axis-label", transform: "rotate(-90 16 " + (m.top + H - m.bottom) / 2 + ")" }, chart.yLabel));

        // Line segments only join consecutive valid samples.
        let segment = [];
        const flush = () => {
            if (segment.length > 1) svg.appendChild(node(doc, "polyline", { points: segment.map((p) => sx(p.x) + "," + sy(p.y)).join(" "), class: "chart-line", fill: "none" }));
            segment = [];
        };
        chart.points.forEach((p) => { if (p.y === null) flush(); else segment.push(p); });
        flush();

        chart.points.forEach((p) => {
            if (p.y === null) {
                const g = node(doc, "g", { class: "chart-missing" });
                g.appendChild(node(doc, "title", {}, chart.xLabel + " = " + fmt(p.x) + ": calculation failed (no data)"));
                const x = sx(p.x);
                const y = H - m.bottom;
                g.appendChild(node(doc, "path", { d: "M" + (x - 5) + " " + (y - 5) + "L" + (x + 5) + " " + (y + 5) + "M" + (x + 5) + " " + (y - 5) + "L" + (x - 5) + " " + (y + 5) }));
                svg.appendChild(g);
            } else {
                const c = node(doc, "circle", { cx: sx(p.x), cy: sy(p.y), r: 3.5, class: "chart-point" });
                c.appendChild(node(doc, "title", {}, chart.xLabel + " = " + fmt(p.x) + "; " + chart.yLabel + " = " + fmt(p.y)));
                svg.appendChild(c);
            }
        });
        if (chart.points.some((p) => p.y === null)) {
            svg.appendChild(node(doc, "text", { x: W - m.right, y: m.top - 6, "text-anchor": "end", class: "chart-tick" }, "\u00d7 = failed sample (no data)"));
        }
        return svg;
    }

    root.FormulaFoundryChart = { createLineChart };
})(window);
