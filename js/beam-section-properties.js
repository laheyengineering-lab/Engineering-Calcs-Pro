(function (root) {
    "use strict";

    const PROFILE_EQUATIONS = {
        rectangular: String.raw`A=bh,\quad \bar{x}=b/2,\quad \bar{y}=h/2,\quad I_x=bh^3/12,\quad I_y=hb^3/12`,
        "solid-circular": String.raw`A=\pi d^2/4,\quad \bar{x}=\bar{y}=d/2,\quad I_x=I_y=\pi d^4/64`,
        "hollow-circular": String.raw`A=\pi(D^2-d^2)/4,\quad \bar{x}=\bar{y}=D/2,\quad I_x=I_y=\pi(D^4-d^4)/64`,
        "hollow-rectangular": String.raw`b=B-2t,\ h=H-2t,\quad A=BH-bh,\quad I_x=(BH^3-bh^3)/12,\quad I_y=(HB^3-hb^3)/12`,
        "i-beam": String.raw`A=2Bt_f+t_w(H-2t_f),\quad \bar{x}=B/2,\ \bar{y}=H/2,\quad I_x=2\left(\frac{Bt_f^3}{12}+Bt_f\frac{(H-t_f)^2}{4}\right)+\frac{t_w(H-2t_f)^3}{12},\quad I_y=\frac{2t_fB^3}{12}+\frac{(H-2t_f)t_w^3}{12}`,
        "t-section": String.raw`A=Bt_f+t_w(H-t_f),\quad \bar{y}=\frac{Bt_f(H-t_f/2)+t_w(H-t_f)^2/2}{A},\quad I_x=\frac{Bt_f^3}{12}+Bt_f(H-t_f/2-\bar{y})^2+\frac{t_w(H-t_f)^3}{12}+t_w(H-t_f)(\bar{y}-(H-t_f)/2)^2,\quad I_y=\frac{t_fB^3}{12}+\frac{(H-t_f)t_w^3}{12}`
    };
    const PROFILE_NAMES = {
        rectangular: "Solid rectangle / square",
        "solid-circular": "Solid circle",
        "hollow-circular": "Hollow circle / tube",
        "hollow-rectangular": "Hollow rectangle / tube",
        "i-beam": "Symmetric I-beam",
        "t-section": "T-section"
    };

    function positive(name, value) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(name + " must be a positive finite dimension.");
        }
        return value;
    }

    function finish(area, centroidX, centroidY, inertiaX, inertiaY, width, height) {
        if (![area, centroidX, centroidY, inertiaX, inertiaY, width, height].every(Number.isFinite)
            || area <= 0 || inertiaX <= 0 || inertiaY <= 0
            || centroidX < 0 || centroidX > width || centroidY < 0 || centroidY > height) {
            throw new Error("The dimensions do not form a valid cross-section.");
        }
        const extremeFiberX = Math.max(centroidY, height - centroidY);
        const extremeFiberY = Math.max(centroidX, width - centroidX);
        const sectionModulusX = inertiaX / extremeFiberX;
        const sectionModulusY = inertiaY / extremeFiberY;
        if (![extremeFiberX, extremeFiberY, sectionModulusX, sectionModulusY].every(Number.isFinite)
            || extremeFiberX <= 0 || extremeFiberY <= 0 || sectionModulusX <= 0 || sectionModulusY <= 0) {
            throw new Error("The dimensions exceed the supported numerical range.");
        }
        return {
            area,
            centroidX,
            centroidY,
            inertiaX,
            inertiaY,
            extremeFiberX,
            extremeFiberY,
            sectionModulusX,
            sectionModulusY
        };
    }

    function calculate(type, dimensions) {
        let b, h, area, inertiaX, inertiaY;

        switch (type) {
            case "rectangular":
                b = positive("Width (b)", dimensions.width);
                h = positive("Height (h)", dimensions.height);
                area = b * h;
                inertiaX = b * h ** 3 / 12;
                inertiaY = h * b ** 3 / 12;
                return finish(area, b / 2, h / 2, inertiaX, inertiaY, b, h);

            case "solid-circular": {
                const d = positive("Diameter (d)", dimensions.diameter);
                const i = Math.PI * d ** 4 / 64;
                return finish(Math.PI * d ** 2 / 4, d / 2, d / 2, i, i, d, d);
            }

            case "hollow-circular": {
                const outer = positive("Outer diameter (D)", dimensions.outerDiameter);
                const inner = positive("Inner diameter (d)", dimensions.innerDiameter);
                if (inner >= outer) throw new Error("Inner diameter must be less than outer diameter.");
                const i = Math.PI * (outer ** 4 - inner ** 4) / 64;
                return finish(Math.PI * (outer ** 2 - inner ** 2) / 4, outer / 2, outer / 2, i, i, outer, outer);
            }

            case "hollow-rectangular": {
                const outerWidth = positive("Outer width (B)", dimensions.outerWidth);
                const outerHeight = positive("Outer height (H)", dimensions.outerHeight);
                const wall = positive("Wall thickness (t)", dimensions.wallThickness);
                const innerWidth = outerWidth - 2 * wall;
                const innerHeight = outerHeight - 2 * wall;
                if (innerWidth <= 0 || innerHeight <= 0) {
                    throw new Error("Wall thickness must leave positive inner width and height.");
                }
                area = outerWidth * outerHeight - innerWidth * innerHeight;
                inertiaX = (outerWidth * outerHeight ** 3 - innerWidth * innerHeight ** 3) / 12;
                inertiaY = (outerHeight * outerWidth ** 3 - innerHeight * innerWidth ** 3) / 12;
                return finish(area, outerWidth / 2, outerHeight / 2, inertiaX, inertiaY, outerWidth, outerHeight);
            }

            case "i-beam":
            case "t-section": {
                const height = positive("Overall height (H)", dimensions.height);
                const flangeWidth = positive("Flange width (B)", dimensions.flangeWidth);
                const flangeThickness = positive("Flange thickness (t_f)", dimensions.flangeThickness);
                const webThickness = positive("Web thickness (t_w)", dimensions.webThickness);
                if (webThickness > flangeWidth) throw new Error("Web thickness must not exceed flange width.");

                if (type === "i-beam") {
                    if (2 * flangeThickness >= height) {
                        throw new Error("Two flange thicknesses must be less than the overall height.");
                    }
                    const webHeight = height - 2 * flangeThickness;
                    const flangeArea = flangeWidth * flangeThickness;
                    const webArea = webThickness * webHeight;
                    area = 2 * flangeArea + webArea;
                    inertiaX = 2 * (
                        flangeWidth * flangeThickness ** 3 / 12
                        + flangeArea * ((height - flangeThickness) / 2) ** 2
                    ) + webThickness * webHeight ** 3 / 12;
                    inertiaY = 2 * flangeThickness * flangeWidth ** 3 / 12
                        + webHeight * webThickness ** 3 / 12;
                    return finish(area, flangeWidth / 2, height / 2, inertiaX, inertiaY, flangeWidth, height);
                }

                if (flangeThickness >= height) {
                    throw new Error("Flange thickness must be less than the overall height.");
                }
                const webHeight = height - flangeThickness;
                const flangeArea = flangeWidth * flangeThickness;
                const webArea = webThickness * webHeight;
                const centroidY = (flangeArea * (height - flangeThickness / 2) + webArea * (webHeight / 2))
                    / (flangeArea + webArea);
                area = flangeArea + webArea;
                inertiaX = flangeWidth * flangeThickness ** 3 / 12
                    + flangeArea * (height - flangeThickness / 2 - centroidY) ** 2
                    + webThickness * webHeight ** 3 / 12
                    + webArea * (centroidY - webHeight / 2) ** 2;
                inertiaY = flangeThickness * flangeWidth ** 3 / 12 + webHeight * webThickness ** 3 / 12;
                return finish(area, flangeWidth / 2, centroidY, inertiaX, inertiaY, flangeWidth, height);
            }

            default:
                throw new Error("Select a supported cross-section profile.");
        }
    }

    function createDiagram(document, profile, dimensions, axis) {
        const properties = calculate(profile, dimensions);
        let width, height;
        if (profile === "rectangular") {
            width = dimensions.width; height = dimensions.height;
        } else if (profile === "solid-circular") {
            width = height = dimensions.diameter;
        } else if (profile === "hollow-circular") {
            width = height = dimensions.outerDiameter;
        } else if (profile === "hollow-rectangular") {
            width = dimensions.outerWidth; height = dimensions.outerHeight;
        } else {
            width = dimensions.flangeWidth; height = dimensions.height;
        }
        const scale = Math.min(120 / width, 120 / height);
        const left = 130 - width * scale / 2;
        const right = 130 + width * scale / 2;
        const top = 95 - height * scale / 2;
        const bottom = 95 + height * scale / 2;
        const toPoint = (x, y) => `${130 + (x - width / 2) * scale},${95 + (height / 2 - y) * scale}`;
        if (!root.FormulaFoundryDiagram) throw new Error("Load the shared engineering diagram utilities before drawing a section.");
        const svg = root.FormulaFoundryDiagram.createSvg(
            document,
            "0 0 260 210",
            PROFILE_NAMES[profile] + " cross-section showing centroidal x and y axes",
            "Centroidal section axes",
            "img"
        );
        const add = (tag, attrs, parent = svg, text) => root.FormulaFoundryDiagram.add(document, parent, tag, attrs, text);
        const fill = "#dce6ee";
        const stroke = "#284b63";

        if (profile === "rectangular") {
            add("rect", { x: left, y: top, width: width * scale, height: height * scale, fill, stroke, "stroke-width": 2 });
        } else if (profile === "solid-circular" || profile === "hollow-circular") {
            const outer = profile === "solid-circular" ? dimensions.diameter : dimensions.outerDiameter;
            add("circle", { cx: 130, cy: 95, r: outer * scale / 2, fill, stroke, "stroke-width": 2 });
            if (profile === "hollow-circular") {
                add("circle", { cx: 130, cy: 95, r: dimensions.innerDiameter * scale / 2, fill: "#fff", stroke, "stroke-width": 2 });
            }
        } else if (profile === "hollow-rectangular") {
            const innerWidth = width - 2 * dimensions.wallThickness;
            const innerHeight = height - 2 * dimensions.wallThickness;
            add("path", {
                d: `M${left},${top}h${width * scale}v${height * scale}h${-width * scale}Z M${left + dimensions.wallThickness * scale},${top + dimensions.wallThickness * scale}v${innerHeight * scale}h${innerWidth * scale}v${-innerHeight * scale}Z`,
                fill, stroke, "stroke-width": 2, "fill-rule": "evenodd"
            });
        } else {
            const flangeWidth = dimensions.flangeWidth;
            const flangeThickness = dimensions.flangeThickness;
            const webThickness = dimensions.webThickness;
            const center = width / 2;
            const points = profile === "i-beam"
                ? [
                    [0, height], [flangeWidth, height], [flangeWidth, height - flangeThickness],
                    [center + webThickness / 2, height - flangeThickness],
                    [center + webThickness / 2, flangeThickness], [flangeWidth, flangeThickness],
                    [flangeWidth, 0], [0, 0], [0, flangeThickness],
                    [center - webThickness / 2, flangeThickness],
                    [center - webThickness / 2, height - flangeThickness], [0, height - flangeThickness]
                ]
                : [
                    [0, height], [flangeWidth, height], [flangeWidth, height - flangeThickness],
                    [center + webThickness / 2, height - flangeThickness],
                    [center + webThickness / 2, 0], [center - webThickness / 2, 0],
                    [center - webThickness / 2, height - flangeThickness], [0, height - flangeThickness]
                ];
            add("path", { d: "M" + points.map(([x, y]) => toPoint(x, y)).join(" L") + " Z", fill, stroke, "stroke-width": 2 });
        }

        const centroidX = 130 + (properties.centroidX - width / 2) * scale;
        const centroidY = 95 + (height / 2 - properties.centroidY) * scale;
        add("line", { class: "beam-axis" + (axis === "x" ? " selected" : ""), x1: 25, y1: centroidY, x2: 230, y2: centroidY, stroke: axis === "x" ? "#c05621" : "#7b858e", "stroke-width": axis === "x" ? 2.5 : 1.5, "stroke-dasharray": "5 4" });
        add("line", { class: "beam-axis" + (axis === "y" ? " selected" : ""), x1: centroidX, y1: 190, x2: centroidX, y2: 15, stroke: axis === "y" ? "#c05621" : "#7b858e", "stroke-width": axis === "y" ? 2.5 : 1.5, "stroke-dasharray": "5 4" });
        add("circle", { cx: centroidX, cy: centroidY, r: 3.5, fill: "#c05621" });
        add("text", { x: 233, y: centroidY - 4, fill: "#26282b", "font-size": 11 }, svg, "x (Iₓ)");
        add("text", { x: centroidX + 4, y: 15, fill: "#26282b", "font-size": 11 }, svg, "y (Iᵧ)");
        const dimensionY = Math.min(bottom + 17, 185);
        add("line", { x1: left, y1: dimensionY, x2: right, y2: dimensionY, stroke: "#555", "stroke-width": 1 });
        const widthLabel = profile === "rectangular" ? "b" : profile.includes("circular") ? "D / d" : profile === "hollow-rectangular" ? "B" : "B";
        add("text", { x: 130, y: dimensionY + 14, fill: "#26282b", "font-size": 11, "text-anchor": "middle" }, svg, widthLabel);
        const heightLabel = profile === "rectangular" ? "h"
            : profile === "hollow-rectangular" || profile === "i-beam" || profile === "t-section" ? "H" : "";
        if (heightLabel) add("text", { x: Math.max(left - 15, 3), y: 98, fill: "#26282b", "font-size": 11 }, svg, heightLabel);
        return svg;
    }

    root.BeamSectionProperties = {
        calculate,
        createDiagram,
        equations(profile) {
            if (!PROFILE_EQUATIONS[profile]) throw new Error("Select a supported cross-section profile.");
            return [PROFILE_EQUATIONS[profile]];
        }
    };
})(typeof window === "undefined" ? globalThis : window);
