(function (root) {
    "use strict";

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const { createSvg, add } = root.FormulaFoundryDiagram;

    const schematics = {
        "pipe-flow": ["Pipe cross-section and side view with internal diameter and mean flow direction", (d) => {
            d.circle(75, 86, 39); d.text(75, 79, "Area A"); d.arrow(39, 99, 111, 99); d.text(75, 145, "Inside D");
            d.rect(168, 52, 178, 70); d.arrow(186, 87, 325, 87);
            d.text(255, 41, "Mean velocity"); d.text(255, 148, "Direction of flow");
        }],
        "pipe-pressure-drop": ["Pipe segment from upstream to downstream with diameter, length and pressure drop", (d) => {
            d.rect(52, 66, 256, 53); d.arrow(65, 90, 293, 90);
            d.text(83, 49, "Inlet p₁"); d.text(280, 49, "Outlet p₂");
            d.line(52, 135, 308, 135); d.text(180, 156, "Length L"); d.text(328, 101, "ID D");
            d.text(180, 25, "Loss Δp = p₁ − p₂");
        }],
        "pump-hydraulic-power": ["Pump with inlet and outlet pressure, flow direction and shaft input", (d) => {
            d.circle(180, 90, 41); d.text(180, 96, "Pump"); d.arrow(27, 90, 136, 90); d.arrow(224, 90, 331, 90);
            d.arrow(180, 148, 180, 134); d.text(180, 171, "Shaft power in");
            d.text(75, 73, "Inlet flow"); d.text(288, 73, "Outlet flow"); d.text(180, 34, "Pressure rise Δp");
        }],
        "hydraulic-cylinder-speed": ["Sectional single-rod cylinder with full cap-end and rod-side annular piston areas", (d) => cylinder(d, false)],
        "pneumatic-air-consumption": ["Air supply alternately fills cap and rod chambers with an exhaust path", (d) => cylinder(d, true)],
        "multilayer-insulation": ["Layered wall cross section with heat passing through each material layer in series", (d, m) => {
            const count = m.layers || 3;
            for (let i = 0; i < count; i += 1) {
                d.rect(104 + i * 144 / count, 40, 144 / count, 96, i % 2 ? "ff-accent-body" : "ff-body");
                d.text(104 + (i + 0.5) * 144 / count, 67, String(i + 1));
            }
            d.arrow(49, 100, 309, 100); d.text(178, 163, "Material layers in series");
        }],
        "wall-heat-loss": ["Wall section between indoors and outdoors with the indicated heat transfer direction", (d, m) => {
            d.rect(148, 34, 64, 120); d.text(180, 62, "Wall");
            d.text(81, 63, "Indoors"); d.text(280, 63, "Outdoors");
            if (m.direction === "Equal") d.text(180, 171, "No temperature difference");
            else {
                const gain = m.direction === "Gain";
                d.arrow(gain ? 303 : 53, 101, gain ? 53 : 303, 101);
                d.text(180, 171, gain ? "Heat gain" : "Heat loss direction");
            }
        }],
        "wall-mounting": ["Side view showing vertical load, offset, fasteners and reactions at the wall", (d, m) => {
            d.rect(53, 27, 21, 119);
            if (m.arrangement === "Close to wall") {
                d.rect(74, 49, 56, 82); d.circle(78, 70, 4);
                d.arrow(101, 85, 101, 137); d.text(176, 136, "Vertical load W");
                d.arrow(48, 105, 48, 55); d.text(182, 73, "Fastener shear reaction");
                d.text(181, 166, "Zero horizontal offset");
                return;
            }
            d.rect(74, 53, 15, 84); d.rect(89, 53, 169, 15);
            d.circle(78, 60, 4);
            if (m.arrangement === "Symmetric two-row mount") d.circle(78, 126, 4);
            d.arrow(250, 72, 250, 132); d.text(296, 120, "Load W");
            d.arrow(95, 109, 95, 77); d.text(126, 88, "Shear");
            d.arrow(135, 47, 78, 47); d.text(141, 34, "Upper tension");
            d.arrow(80, 122, 161, 122); d.text(151, 110, "Wall bearing");
            d.line(75, 158, 250, 158); d.text(166, 176, "Offset e");
            d.line(37, 53, 37, 130); d.text(23, 95, "h");
        }]
    };

    function cylinder(d, air) {
        d.rect(57, 51, 207, 77);
        d.rect(158, 52, 13, 75, "ff-accent-body");
        d.rect(171, 82, 151, 14, "ff-accent-body");
        d.text(103, 78, "Cap end"); d.text(219, 78, "Rod end");
        d.line(98, 128, 98, 148); d.line(225, 128, 225, 148);
        d.text(98, 171, air ? "Supply / exhaust" : "Cap-end port");
        d.text(241, 171, air ? "Supply / exhaust" : "Rod-end port");
        d.text(180, 32, air ? "Fill one chamber per stroke" : "Single-rod piston");
    }

    for (const [id, [description, draw]] of Object.entries(schematics)) {
        registry.register(id, {
            caption: "Illustrative schematic. Dimensions and spacing are symbolic.",
            schema: {
                ...(id === "wall-mounting" ? { arrangement: registry.T.pick(["Close to wall", "Bracket with lower bearing", "Symmetric two-row mount"]) } : {}),
                ...(id === "wall-heat-loss" ? { direction: registry.T.pick(["Loss", "Gain", "Equal"]) } : {}),
                ...(id === "multilayer-insulation" ? { layers: registry.T.num({ min: 1, max: 6 }) } : {})
            },
            build(document, model) {
                const svg = createSvg(document, "0 0 360 185", description, description, "img");
                svg.setAttribute("class", "ff-diagram expansion-svg");
                const line = (x1, y1, x2, y2) => add(document, svg, "line", { x1, y1, x2, y2, class: "expansion-line" });
                const shapes = {
                    line,
                    arrow(x1, y1, x2, y2) {
                        line(x1, y1, x2, y2);
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        for (const turn of [-0.52, 0.52]) {
                            line(x2, y2, x2 - 9 * Math.cos(angle + turn), y2 - 9 * Math.sin(angle + turn));
                        }
                    },
                    rect(x, y, width, height, style = "ff-body") {
                        add(document, svg, "rect", { x, y, width, height, class: style });
                    },
                    circle(cx, cy, r) {
                        add(document, svg, "circle", { cx, cy, r, class: "ff-body" });
                    },
                    text(x, y, label) {
                        add(document, svg, "text", { x, y, "text-anchor": "middle", class: "expansion-label" }, label);
                    }
                };
                draw(shapes, model);
                return svg;
            }
        });
    }

    root.FormulaFoundryExpansionDiagram = function (id, input, outputs = {}) {
        const model = {};
        if (id === "wall-mounting") model.arrangement = input.arrangement ?? "Close to wall";
        if (id === "wall-heat-loss" && Number.isFinite(outputs.difference)) {
            model.direction = outputs.difference === 0 ? "Equal" : outputs.difference < 0 ? "Gain" : "Loss";
        }
        if (id === "multilayer-insulation") {
            model.layers = 1 + [2, 3, 4, 5, 6].filter((n) => input["layerMode" + n] && input["layerMode" + n] !== "Unused").length;
        }
        return { type: "calc-diagram", id, model };
    };
})(window);
