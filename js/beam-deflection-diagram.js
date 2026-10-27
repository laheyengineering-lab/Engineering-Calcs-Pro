(function (root) {
    "use strict";

    const cases = {
        "ss-point": { support: "simply-supported", load: "point", pointFraction: 0.5, name: "Simply supported beam with center point load" },
        "ss-udl": { support: "simply-supported", load: "distributed", name: "Simply supported beam with full-span uniform load" },
        "cant-point": { support: "cantilever", load: "point", pointFraction: 1, name: "Cantilever with free-end point load" },
        "cant-udl": { support: "cantilever", load: "distributed", name: "Cantilever with full-span uniform load" }
    };

    function render(document, state) {
        const definition = cases[state.caseId];
        const diagram = root.FormulaFoundryDiagram;
        const label = definition
            ? definition.name + "; " + (definition.support === "cantilever" ? "fixed-free support" : "pin and roller supports")
            : "Unsupported beam model";
        const svg = diagram.createSvg(
            document,
            "0 0 600 300",
            label,
            "Beam model and illustrative deflected shape"
        );
        const add = (tag, attrs, text) => diagram.add(document, svg, tag, attrs, text);
        if (!definition) {
            add("text", { x: 300, y: 150, class: "beam-diagram-note", "text-anchor": "middle" }, "Select a supported beam loading and support case");
            return svg;
        }
        const left = 60;
        const right = 540;
        const beamY = 126;
        const span = Number.isFinite(state.span) && state.span > 0 ? state.span : null;
        const load = Number.isFinite(state.load) ? state.load : null;
        const validLoad = load !== null && load !== 0;
        const sign = validLoad && load < 0 ? -1 : 1;

        add("text", { x: 300, y: 24, class: "beam-diagram-heading", "text-anchor": "middle" }, definition.name);
        add("line", { x1: left, y1: beamY, x2: right, y2: beamY, class: "beam-diagram-member" });

        if (definition.support === "cantilever") {
            add("rect", { x: 39, y: 91, width: 18, height: 70, class: "beam-diagram-fixed-support" });
            for (let y = 94; y <= 151; y += 10) add("line", { x1: 39, y1: y, x2: 29, y2: y + 10, class: "beam-diagram-hatch" });
            add("text", { x: 48, y: 178, class: "beam-diagram-label", "text-anchor": "middle" }, "fixed");
        } else {
            add("polygon", { points: `${left},${beamY} ${left - 16},${beamY + 23} ${left + 16},${beamY + 23}`, class: "beam-diagram-support" });
            add("polygon", { points: `${right},${beamY} ${right - 16},${beamY + 23} ${right + 16},${beamY + 23}`, class: "beam-diagram-support" });
            add("circle", { cx: right, cy: beamY + 29, r: 5, class: "beam-diagram-roller" });
            add("text", { x: left, y: 178, class: "beam-diagram-label", "text-anchor": "middle" }, "pin");
            add("text", { x: right, y: 178, class: "beam-diagram-label", "text-anchor": "middle" }, "roller");
        }

        if (definition.load === "point") {
            const loadX = left + (right - left) * definition.pointFraction;
            const direction = sign > 0 ? 1 : -1;
            const startY = beamY - direction * 58;
            const endY = beamY - direction * 7;
            add("line", { x1: loadX, y1: startY, x2: loadX, y2: endY, class: "beam-diagram-load" });
            const headY = endY - direction * 2;
            add("polygon", {
                points: `${loadX},${endY} ${loadX - 7},${headY - direction * 10} ${loadX + 7},${headY - direction * 10}`,
                class: "beam-diagram-load"
            });
            add("text", { x: loadX + 12, y: startY + 5, class: "beam-diagram-load-label" }, state.loadLabel || "P");
        } else {
            const loadLineY = sign > 0 ? 59 : 193;
            const arrowStartY = sign > 0 ? 66 : 186;
            add("line", { x1: left + 12, y1: loadLineY, x2: right - 12, y2: loadLineY, class: "beam-diagram-load" });
            for (let x = left + 24; x <= right - 24; x += 64) {
                const direction = sign > 0 ? 1 : -1;
                const endY = beamY - direction * 7;
                add("line", { x1: x, y1: arrowStartY, x2: x, y2: endY, class: "beam-diagram-load" });
                add("polygon", {
                    points: `${x},${endY} ${x - 5},${endY - direction * 8} ${x + 5},${endY - direction * 8}`,
                    class: "beam-diagram-load"
                });
            }
            add("text", { x: right - 8, y: sign > 0 ? 52 : 210, class: "beam-diagram-load-label", "text-anchor": "end" }, state.loadLabel || "w");
        }

        if (validLoad) {
            const curveOffset = sign * 34;
            const curve = definition.support === "cantilever"
                ? `M ${left} ${beamY} C ${left + 170} ${beamY} ${right - 170} ${beamY + curveOffset * 0.45} ${right} ${beamY + curveOffset}`
                : `M ${left} ${beamY} Q 300 ${beamY + curveOffset * 2} ${right} ${beamY}`;
            add("path", { d: curve, class: "beam-diagram-deflection" });
        }
        add("text", { x: 300, y: 194, class: "beam-diagram-note", "text-anchor": "middle" }, "Deflected shape illustrative — not to scale");
        add("line", { x1: left, y1: 230, x2: right, y2: 230, class: "beam-diagram-dimension" });
        add("line", { x1: left, y1: 224, x2: left, y2: 236, class: "beam-diagram-dimension" });
        add("line", { x1: right, y1: 224, x2: right, y2: 236, class: "beam-diagram-dimension" });
        add("text", { x: 300, y: 220, class: "beam-diagram-dimension-label", "text-anchor": "middle" },
            "L = " + (state.spanDisplay || (span === null ? "enter span" : String(span))) + (state.lengthUnit ? " " + state.lengthUnit : ""));
        if (state.maxDeflection !== undefined && Number.isFinite(state.maxDeflection)) {
            add("text", { x: 300, y: 276, class: "beam-diagram-result", "text-anchor": "middle" },
                "Calculated |δmax| = " + state.maxDeflection + " " + (state.deflectionUnit || ""));
        } else {
            add("text", { x: 300, y: 276, class: "beam-diagram-note", "text-anchor": "middle" }, "Calculate to show the actual maximum deflection");
        }

        return svg;
    }

    root.FormulaFoundryBeamDeflectionDiagram = { render };
})(window);
