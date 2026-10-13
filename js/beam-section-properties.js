(function (root) {
    "use strict";

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

    root.BeamSectionProperties = { calculate };
})(typeof window === "undefined" ? globalThis : window);
