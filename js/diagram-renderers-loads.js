(function (root) {
    "use strict";

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const diagram = root.FormulaFoundryDiagram;
    const { T } = registry;

    const quantity = (h, value, unit) => h.quantity(value, unit);
    const small = { cls: "ff-label ff-label-small" };
    const heading = { cls: "ff-label ff-label-strong" };
    const centered = { anchor: "middle" };

    registry.register("moment", {
        title: "Moment of a force about a pivot",
        caption: "Schematic of M = F·d. The input distance is the perpendicular moment arm. In this view, positive force acts upward on the right of the pivot and gives a counter-clockwise moment.",
        schema: { force: T.num(), forceUnit: T.unit(), distance: T.pos(), distanceUnit: T.unit(), moment: T.num(), momentUnit: T.unit() },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 300],
                label: "Moment of a force about a pivot with perpendicular distance",
                description: "The lever extends to the right of the pivot. The sign of force sets the direction of the force arrow and the corresponding sense of rotation."
            });
            const x = 116, y = 123, arm = 355;
            S.construction(x, y - 21, x, y + 70);
            S.construction(arm, 48, arm, y + 70);
            S.rect(x, y - 7, arm - x, 14, "ff-body-muted");
            S.pinSupport(x, y + 6, 14);
            S.pivot(x, y, 6);
            S.circle(arm, y, 4, "ff-body");
            S.text(x + 25, y + 34, "O (pivot)", small);
            if (m.force > 0 || m.force < 0) {
                const positive = m.force > 0;
                S.arrow(arm, y + (positive ? -5 : -64), arm, y + (positive ? -64 : -5), { kind: "force", label: "F", labelX: arm + 17, labelY: 64 });
                S.momentArrow(x, y, 48, positive ? 17 : 176, positive ? 176 : 17, { label: "M", labelX: x, labelY: 61 });
            }
            S.dimension(x, y + 47, arm, y + 47, "d = " + quantity(h, m.distance, m.distanceUnit), { offset: 30 });
            S.text(22, 247, "F = " + quantity(h, m.force, m.forceUnit), heading);
            if (h.has(m.moment)) S.text(260, 247, "M = " + quantity(h, m.moment, m.momentUnit), heading);
            S.note(22, 278, "Positive M is counter-clockwise. The arm d is perpendicular to F.", "start");
            return S.svg;
        }
    });

    // The raceways are mirrored about the shaft axis in this axial section.
    function bearingRace(S, yc, side, roller, outer) {
        const face = (height) => yc + height * side;
        const outside = outer ? 101 : 29;
        const edge = roller ? (outer ? 82 : 48) : (outer ? 79 : 51);
        const raceway = roller ? "H 190"
            : "H 270 Q 242 " + face(outer ? 89 : 41) + " 214 " + face(edge) + " H 190";
        S.hatchPath("M 190 " + face(outside) + " H 308 V " + face(edge) + " " + raceway + " Z");
    }

    registry.register("bearing-life", {
        title: "Rolling-element bearing rating life",
        caption: "Axial section of a representative radial bearing. C is the catalog dynamic load rating. P is the equivalent dynamic load used in the rating-life equation. The arrow shows its radial reference direction and does not describe a load distribution across the rolling elements.",
        schema: {
            bearingType: T.pick(["ball", "roller"]),
            rating: T.pos(), ratingUnit: T.unit(), load: T.pos(), loadUnit: T.unit(),
            speed: T.pos(), speedUnit: T.unit(), lifeMillions: T.nonneg(), lifeHours: T.nonneg()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [560, 397],
                label: "Rolling-element bearing axial section and basic rating life quantities",
                description: "A sectional shaft and paired raceways surround the rolling elements. The load arrow denotes the equivalent radial load used for the basic rating life calculation."
            });
            const roller = m.bearingType === "roller";
            const y = 165;
            S.text(22, 28, roller ? "Roller bearing · axial section" : "Ball bearing · axial section", heading);
            S.hatchRect(79, y - 29, 372, 58);
            [-1, 1].forEach((side) => {
                bearingRace(S, y, side, roller, true);
                bearingRace(S, y, side, roller, false);
                const centerY = y + side * 65;
                S.rect(207, centerY - 8, 81, 16, "ff-body-muted");
                if (roller) S.rect(222, centerY - 17, 42, 34, "ff-accent-body", { rx: 2 });
                else S.circle(242, centerY, 19, "ff-accent-body");
            });
            S.centerline(59, y, 476, y);
            const spin = S.momentArrow(452, y, 20, -70, 160, { ry: 43 });
            spin.setAttribute("class", "ff-arrow ff-arrow-motion");
            S.text(477, y - 43, "n", small);
            if (h.has(m.load)) {
                S.arrow(285, 33, 285, y - 104, { kind: "force", label: "P", labelX: 302, labelY: 47 });
            }
            S.leader(195, y - 90, 158, 72, "Outer race");
            S.leader(roller ? 225 : 229, y - 70, 151, 101, roller ? "Roller" : "Ball");
            S.leader(195, y - 38, 151, 126, "Inner race");
            S.leader(132, y + 20, 100, 212, "Shaft");
            S.lines(22, 299, [
                "C = " + quantity(h, m.rating, m.ratingUnit) + " · Basic dynamic load rating",
                "P = " + quantity(h, m.load, m.loadUnit) + " · Equivalent dynamic load",
                "n = " + quantity(h, m.speed, m.speedUnit) + " · Shaft speed"
            ], small);
            if (h.has(m.lifeMillions) || h.has(m.lifeHours)) {
                S.text(22, 374, "L_{10} = " + quantity(h, m.lifeMillions, "million rev") + "   /   " + quantity(h, m.lifeHours, "h"), heading);
            }
            return S.svg;
        }
    });

    registry.register("cylinder-force", {
        title: "Double-acting single-rod cylinder",
        caption: "The cap-end chamber acts on the full piston face during extension. The rod-end chamber acts on the annulus during retraction. The opposite chamber is at zero gauge pressure in each case. The drawing limits extreme diameter ratios and uses schematic stroke and port lengths.",
        schema: {
            bore: T.pos(), rod: T.nonneg(), distanceUnit: T.unit(), pressure: T.pos(), pressureUnit: T.unit(),
            efficiency: { t: "num", gt: 0, max: 100 },
            pistonArea: T.nonneg(), annularArea: T.nonneg(), areaUnit: T.unit(),
            extensionForce: T.nonneg(), retractionForce: T.nonneg(), forceUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [560, 474],
                label: "Cylinder force sections and effective piston faces in extension and retraction",
                description: "A single-rod piston is shown with the cap-end chamber active for extension and the rod-end chamber active for retraction. Separate end views show the full and annular loaded faces."
            });
            const validDimensions = h.has(m.bore) && h.has(m.rod) && m.rod < m.bore;
            const impossibleGeometry = h.has(m.bore) && h.has(m.rod) && !validDimensions;
            const flag = {};
            const ratio = validDimensions ? h.ratio(m.rod, m.bore, m.rod > 0 ? 0.035 : 0, 0.92, 0.45, flag) : 0.45;
            const halfBore = 35, halfRod = halfBore * ratio;
            const left = 64, right = 318, end = 368, wall = 10, ring = 42, faceX = 473;
            const draw = (yc, extension) => {
                const piston = 185, capPort = 104, rodPort = 276, pistonWidth = 19;
                const top = yc - halfBore, bottom = yc + halfBore;
                const activePort = extension ? capPort : rodPort;
                const capFace = piston, rodFace = piston + pistonWidth;
                const bubble = extension ? "Extension · cap end" : "Retraction · rod end";
                S.text(22, yc - 81, bubble, heading);

                const lowX = extension ? left + wall : rodFace;
                const highX = extension ? capFace : right - wall;
                S.rect(lowX, top, highX - lowX, 2 * halfBore, "ff-fill-pressure");
                // Wall segments leave open gaps at the two ports.
                S.hatchRect(left, top - wall, capPort - 6 - left, wall);
                S.hatchRect(capPort + 6, top - wall, rodPort - capPort - 12, wall);
                S.hatchRect(rodPort + 6, top - wall, right - rodPort - 6, wall);
                S.hatchRect(left, bottom, right - left, wall);
                S.hatchRect(left, top, wall, 2 * halfBore);
                S.hatchRect(right - wall, top, wall, halfBore - halfRod);
                S.hatchRect(right - wall, yc + halfRod, wall, halfBore - halfRod);
                [capPort, rodPort].forEach((port) => {
                    if (activePort === port) S.rect(port - 6, top - 25, 12, 25, "ff-fill-pressure");
                    S.line(port - 6, top - 23, port - 6, top - wall);
                    S.line(port + 6, top - 23, port + 6, top - wall);
                });
                if (ratio > 0) S.rect(rodFace, yc - halfRod, end - rodFace, 2 * halfRod, "ff-body");
                S.hatchRect(piston, top + 1, pistonWidth, 2 * halfBore - 2);
                S.line(piston + 6, top + 2, piston + 6, top + 10, "ff-outline");
                S.line(piston + 6, bottom - 10, piston + 6, bottom - 2, "ff-outline");
                S.centerline(left - 9, yc, end + 40, yc);
                S.dimension(left, top, left, bottom, "D", { offset: 25 });
                if (ratio > 0) S.leader(end - 18, yc + halfRod, end - 4, yc + 46, "d");
                if (!impossibleGeometry) {
                    const tip = ratio > 0 ? end : right;
                    if (extension) {
                        [-21, -10, 10, 21].forEach((dy) => S.arrow(capFace - 51, yc + dy, capFace - 2, yc + dy, { kind: "pressure" }));
                        S.arrow(tip + 3, yc, tip + 43, yc, { kind: "force" });
                    } else {
                        const gap = (halfRod + halfBore) / 2;
                        [-gap, gap].forEach((dy) => S.arrow(rodFace + 51, yc + dy, rodFace + 2, yc + dy, { kind: "pressure" }));
                        S.arrow(tip + 43, yc, tip + 3, yc, { kind: "force" });
                    }
                }
                S.text(end + 6, yc - 14, extension ? "F_{ext}" : "F_{ret}", { cls: "ff-label ff-label-force" });

                S.circle(faceX, yc, ring, "ff-fill-pressure");
                S.circle(faceX, yc, ring, "ff-outline");
                if (!extension && ratio > 0) S.circle(faceX, yc, ring * ratio, "ff-body");
                S.centerline(faceX - 49, yc, faceX + 49, yc);
                S.centerline(faceX, yc - 49, faceX, yc + 49);
                S.text(faceX, yc + 66, extension ? "A_p · full face" : "A_a · annulus", { ...heading, ...centered });
                const area = extension ? m.pistonArea : m.annularArea;
                const force = extension ? m.extensionForce : m.retractionForce;
                if (h.has(area)) S.text(faceX, yc + 90, quantity(h, area, m.areaUnit), { ...small, ...centered });
                if (h.has(force)) S.text(left, yc + 71, (extension ? "F_{ext}" : "F_{ret}") + " = " + quantity(h, force, m.forceUnit) + " theoretical", heading);
            };
            draw(106, true);
            draw(288, false);
            S.lines(22, 403, [
                "D = " + quantity(h, m.bore, m.distanceUnit) + "   d = " + quantity(h, m.rod, m.distanceUnit),
                "p = " + quantity(h, m.pressure, m.pressureUnit) + " gauge"
                    + (h.has(m.efficiency) ? "   ·   Assumed efficiency η = " + quantity(h, m.efficiency, "%") : "")
            ], small);
            const geometryNote = impossibleGeometry ? "Enter a rod diameter smaller than the bore."
                : flag.clamped ? "Rod diameter exaggerated or capped for legibility."
                : validDimensions ? "Diameters proportional. Axial lengths schematic." : "Enter bore and rod diameters to scale the section.";
            S.note(22, 455, geometryNote, "start");
            return S.svg;
        }
    });

    // An orthographic projection keeps the front and back half-turns distinct without perspective.
    function drawSpring(S, cx, top, travel, turns, wire, radius) {
        const projection = (t) => {
            const angle = t * 2 * Math.PI;
            return [cx - radius * Math.cos(angle), top + t * travel / turns];
        };
        const paths = [];
        for (let start = 0; start < turns; start += 0.5) {
            const span = Math.min(0.5, turns - start);
            const points = [];
            for (let i = 0; i <= 20; i += 1) {
                points.push(projection(start + i * span / 20));
            }
            paths.push("M " + points.map(([x, y]) => x.toFixed(1) + " " + y.toFixed(1)).join(" L "));
        }
        [1, 0].forEach((side) => {
            const group = S.group(side === 1 ? "ff-helix-rear" : "ff-helix-front", side === 1 ? { opacity: 0.62 } : {});
            paths.forEach((path, index) => {
                if (index % 2 === side) {
                    group.path(path, "ff-wire-outline").setAttribute("stroke-width", String(wire + 2));
                    group.path(path, "ff-wire-core").setAttribute("stroke-width", String(Math.max(1, wire - 1)));
                }
            });
        });
    }

    registry.register("spring-calculations", {
        title: "Helical compression spring",
        caption: "Round-wire compression spring with symbolic end seats and active coil turns. Wire and turn count have drawing limits. The change in seat position illustrates calculated axial deflection at an exaggerated scale. The calculator models a static elastic spring.",
        schema: {
            wire: T.pos(), coil: T.pos(), coils: T.pos(), force: T.nonneg(), distanceUnit: T.unit(),
            forceUnit: T.unit(), deflection: T.nonneg()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [560, 399],
                label: "Compression spring with mean coil diameter, wire diameter and axial deflection",
                description: "The unloaded and loaded spring share a lower seat. The upper seat moves down when a positive deflection is available. A ghost line marks its unloaded position."
            });
            const radius = 50, first = 144, second = 407, seat = 279, freeTop = 100;
            const validDiameters = h.has(m.wire) && h.has(m.coil) && m.coil > m.wire;
            const turns = h.has(m.coils) ? h.clamp(m.coils, 2, 8) : 5;
            const displacement = m.deflection > 0 && m.force !== 0 ? 32 : 0;
            const loadedTop = freeTop + displacement;
            // Leave visible space between turns at all drawing sizes. This is no coil-bind check.
            const wireLimit = Math.min(20, (seat - loadedTop - 4 * turns) / (turns + 1));
            const wire = validDiameters ? h.ratio(m.wire, m.coil, 0.038, wireLimit / (2 * radius), 0.09) * 2 * radius : 9;
            function elevation(cx, top, fixed) {
                S.centerline(cx, freeTop - 17, cx, seat + 21);
                drawSpring(S, cx, top + wire / 2, seat - top - wire, turns, wire, radius);
                S.rect(cx - 67, top - 8, 134, 8, "ff-body-muted");
                S.rect(cx - 67, seat, 134, 8, "ff-body-muted");
                if (fixed) S.groundHatch(cx - 67, cx + 67, seat + 8);
            }

            S.text(first, 29, "Unloaded reference", { ...heading, ...centered });
            S.text(second, 29, "Under axial load", { ...heading, ...centered });
            elevation(first, freeTop, false);
            elevation(second, loadedTop, true);

            S.dimension(first - radius, freeTop - 9, first + radius, freeTop - 9, "D", { offset: -26 });
            S.leader(first - radius, freeTop + wire / 2 + (seat - freeTop - wire) / turns, 57, 186, "d");
            if (m.force > 0) {
                S.arrow(second, 48, second, loadedTop - 10, { kind: "force", label: "F", labelX: second + 16, labelY: 67 });
            }
            if (displacement) {
                S.line(second - 68, freeTop - 8, second + 67, freeTop - 8, "ff-ghost");
                S.dimension(second + 67, freeTop - 8, second + 67, loadedTop - 8, "δ", { offset: -20 });
            }
            S.lines(22, 325, [
                "Wire d = " + quantity(h, m.wire, m.distanceUnit),
                "Mean diameter D = " + quantity(h, m.coil, m.distanceUnit),
                "Active coils N_a = " + quantity(h, m.coils)
            ], small);
            S.lines(290, 325, [
                "F = " + quantity(h, m.force, m.forceUnit),
                "Axial deflection δ = " + quantity(h, m.deflection, m.distanceUnit)
            ], small);
            let note = displacement ? "Seat displacement exaggerated; free length is unspecified."
                : m.deflection === 0 ? "Zero axial deflection; free length is unspecified."
                    : "Free length is unspecified. Seat displacement requires a calculated result.";
            if (h.has(m.wire) && h.has(m.coil) && !validDiameters) note = "Mean coil diameter must exceed wire diameter.";
            if (validDiameters && h.has(m.coils) && turns !== m.coils) note += " The drawing limits the visible number of turns.";
            S.note(22, 375, note, "start");
            return S.svg;
        }
    });

    registry.register("shaft-torsion", {
        title: "Circular shaft in torsion",
        caption: "Uniform circular shaft with opposed applied and reaction torques. Positive torque is counter-clockwise as viewed from the loaded end. Surface twist is exaggerated. In the end view shear is tangential, rising from the centre of a solid shaft, or from nonzero τ_inner at the wall of a hollow shaft, to its peak at the outer surface.",
        schema: {
            shaftType: T.pick(["solid", "hollow"]), torque: T.num(), torqueUnit: T.unit(),
            outer: T.pos(), inner: T.nonneg(), diameterUnit: T.unit(), length: T.pos(), lengthUnit: T.unit(),
            twist: T.num(), twistUnit: T.unit(), tauMax: T.num(), stressUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [560, 377],
                label: "Circular shaft with opposing torques and tangential shear at the loaded end",
                description: "The side elevation shows applied and reaction torques and the shape of an illustrative surface trace. The end section distinguishes solid and hollow geometry. The longest shear arrow is at the outer surface."
            });
            const flag = {};
            const hollow = m.shaftType === "hollow";
            const boreValid = hollow && h.has(m.outer) && h.has(m.inner) && m.inner < m.outer;
            const invalidBore = hollow && h.has(m.outer) && h.has(m.inner) && m.inner >= m.outer;
            const ratio = boreValid ? h.ratio(m.inner, m.outer, m.inner > 0 ? 0.04 : 0, 0.93, 0.5, flag) : hollow ? 0.5 : 0;
            const sense = Math.sign(m.torque || 0);
            const x0 = 79, x1 = 315, y = 135, r = 37, ex = 456, endRadius = 54;
            S.text(23, 28, hollow ? "Hollow shaft · elevation" : "Solid shaft · elevation", heading);
            S.text(ex, 28, "Loaded-end section", { ...heading, ...centered });
            S.path("M " + x0 + " " + (y - r) + " H " + x1 + " A 10 37 0 0 1 " + x1 + " " + (y + r) + " H " + x0
                + " A 10 37 0 0 1 " + x0 + " " + (y - r) + " Z", "ff-body");
            S.path("M " + x1 + " " + (y - r) + " A 10 37 0 0 0 " + x1 + " " + (y + r), "ff-outline");
            if (ratio > 0) {
                S.construction(x0, y - r * ratio, x1, y - r * ratio);
                S.construction(x0, y + r * ratio, x1, y + r * ratio);
            }
            S.centerline(x0 - 24, y, x1 + 34, y);
            S.dimension(x0, y + r, x1, y + r, "L = " + quantity(h, m.length, m.lengthUnit), { offset: 54 });
            const trace = y - 9;
            S.line(x0 + 5, trace, x1 - 5, trace, "ff-ghost");
            if (sense && !invalidBore) {
                const twistSense = h.has(m.twist) ? Math.sign(m.twist) : sense;
                if (twistSense) S.path("M " + (x0 + 5) + " " + trace + " Q 205 " + trace + " " + (x1 - 5) + " " + (trace - 16 * twistSense), "ff-accent-line");
                const reaction = S.momentArrow(x0 - 18, y, 15, sense > 0 ? 245 : 115, sense > 0 ? 115 : 245, { ry: 52 });
                reaction.setAttribute("class", "ff-arrow ff-arrow-reaction");
                S.momentArrow(x1 + 13, y, 14, sense > 0 ? -63 : 63, sense > 0 ? 63 : -63, { ry: 52 });
                S.text(33, 63, "Reaction −T", { cls: "ff-label ff-label-reaction" });
                S.text(286, 63, "Applied T", { cls: "ff-label ff-label-force" });
            }
            S.text(197, 196, "Surface trace", { ...small, ...centered });

            S.hatchPath("M " + (ex - endRadius) + " " + y + " a 54 54 0 1 0 108 0 a 54 54 0 1 0 -108 0 Z");
            if (ratio > 0) S.circle(ex, y, endRadius * ratio, "ff-section");
            S.centerline(ex - endRadius - 11, y, ex + endRadius + 26, y);
            S.centerline(ex, y - endRadius - 12, ex, y + endRadius + 12);
            if (sense && !invalidBore) {
                const innerRadius = endRadius * ratio;
                const fanHeight = 39;
                S.construction(ex + innerRadius, y - fanHeight * ratio * sense, ex + endRadius, y - fanHeight * sense);
                // Keep tangential shear arrows within the material stations shown on the horizontal radius.
                const stations = ratio ? [innerRadius, (innerRadius + endRadius) / 2, endRadius] : [18, 36, endRadius];
                stations.forEach((station) => {
                    S.arrow(ex + station, y, ex + station, y - fanHeight * station / endRadius * sense, { kind: "stress" });
                });
                S.text(531, y - fanHeight * sense + 5, "τ_{max}", { ...small, ...centered });
                if (ratio > 0) S.text(ex + 17, sense > 0 ? y + 70 : y - 73, "τ_{inner}", { ...small, ...centered });
            }
            S.dimension(ex - endRadius, y + endRadius, ex + endRadius, y + endRadius, "D_o", { offset: 35 });
            if (ratio > 0) S.leader(ex - ratio * endRadius * 0.7, y - ratio * endRadius * 0.7, 417, 69, "D_i", { anchor: "end" });

            S.lines(22, 275, [
                "T = " + quantity(h, m.torque, m.torqueUnit),
                "θ = " + quantity(h, m.twist, m.twistUnit),
                "Outer-surface τ_{max} = " + quantity(h, m.tauMax, m.stressUnit)
            ], small);
            S.lines(367, 275, [
                "D_o = " + quantity(h, m.outer, m.diameterUnit),
                ...(hollow ? ["D_i = " + quantity(h, m.inner, m.diameterUnit)] : [])
            ], small);
            const note = invalidBore ? "Inner diameter must be smaller than outer diameter."
                : flag.clamped ? "Twist exaggerated. Bore ratio adjusted for legibility."
                : boreValid && !ratio ? "Zero inner diameter gives a solid section. Twist exaggerated."
                : "Twist exaggerated. Positive torque is counter-clockwise viewed from the loaded end.";
            S.note(22, 349, note, "start");
            return S.svg;
        }
    });
})(window);
