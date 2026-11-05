(function (root) {
    "use strict";

    // Renderers for load-and-motion calculators: Moment, Bearing Life, Cylinder Force,
    // Helical Spring and Shaft Torsion. Each renderer draws from a small model of
    // existing calculator inputs; none of them solves an engineering equation.

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const diagram = root.FormulaFoundryDiagram;
    const { T } = registry;
    const unitless = (text) => text;

    function q(h, value, unit) {
        return h.quantity(value, unit);
    }

    // ---------------------------------------------------------------- Moment
    registry.register("moment", {
        title: "Moment of a force about a pivot",
        caption: "Schematic of M = F·d. The calculator takes d as the perpendicular distance from the pivot to the line of action of F; the force direction is illustrative.",
        schema: { force: T.num(), forceUnit: T.unit(), distance: T.pos(), distanceUnit: T.unit(), moment: T.num(), momentUnit: T.unit() },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 300],
                label: "Moment of a force about a pivot with perpendicular distance",
                description: "A lever pivots at O. A force F acts perpendicular to the lever at distance d, producing moment M."
            });
            const sense = m.force < 0 ? -1 : 1;
            const O = [100, 145], A = [360, 145];
            S.rect(O[0], O[1] - 7, A[0] - O[0], 14, "ff-body-muted");
            S.polygon([[O[0], O[1] - 7], [O[0] - 16, O[1] + 24], [O[0] + 16, O[1] + 24]], "ff-support-body");
            S.groundHatch(O[0] - 26, O[0] + 26, O[1] + 24);
            S.pivot(O[0], O[1], 6);
            S.text(O[0] - 6, O[1] - 48, "O (pivot)", { anchor: "start" });
            S.arrow(A[0], 62, A[0], A[1] - 8, { kind: "force" });
            S.text(A[0] + 14, 78, "F = " + q(h, m.force, m.forceUnit), { cls: "ff-label ff-label-force" });
            S.momentArrow(O[0], O[1], 36, sense > 0 ? 25 : 255, sense > 0 ? 255 : 25, { label: "M", labelX: O[0] - 44, labelY: O[1] + 52 });
            S.dimension(O[0], O[1] + 12, A[0], A[1] + 12, "d = " + q(h, m.distance, m.distanceUnit), { offset: 56, extensions: true });
            S.note(20, 270, "M = F·d; d is measured perpendicular to the force line.", "start");
            return S.svg;
        }
    });

    // --------------------------------------------------------- Bearing life
    registry.register("bearing-life", {
        title: "Rolling-element bearing rating life",
        caption: "Axial section through a rolling-element bearing (schematic). The calculator evaluates only the basic rating-life relation L10 = (C/P)^p, with C the catalogue dynamic load rating and P the equivalent dynamic load you supply; contact stress, lubrication, fatigue modification and combined radial/axial loading are not analysed.",
        schema: {
            bearingType: T.pick(["ball", "roller"]),
            rating: T.pos(), ratingUnit: T.unit(), load: T.pos(), loadUnit: T.unit(),
            speed: T.pos(), speedUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 400],
                label: "Rolling-element bearing section with equivalent dynamic load P and dynamic load rating C",
                description: "Axial section of a bearing showing the outer race, rolling elements, inner race and shaft. The equivalent dynamic load P acts through the bearing and is compared with the dynamic load rating C in the life equation."
            });
            const roller = m.bearingType === "roller";
            const cx = 280;
            const ax = 170;
            S.centerline(24, ax, 496, ax);
            S.hatchRect(64, ax - 30, 392, 60);
            [[0, -1], [1, 1]].forEach(([, side]) => {
                const outerY = side < 0 ? ax - 108 : ax + 80;
                const innerY = side < 0 ? ax - 58 : ax + 30;
                const elementY = side < 0 ? ax - 70 : ax + 70;
                S.hatchRect(cx - 62, outerY, 124, 28);
                S.hatchRect(cx - 62, innerY, 124, 28);
                if (roller) S.rect(cx - 22, elementY - 12, 44, 24, "ff-accent-body", { rx: 4 });
                else S.circle(cx, elementY, 12, "ff-accent-body");
            });
            S.arrow(cx, 20, cx, ax - 108, { kind: "force" });
            S.text(cx + 12, 40, "P", { cls: "ff-label ff-label-force" });
            S.construction(cx, ax - 108, cx, ax + 108);
            S.arrow(cx, 354 - 40, cx, ax + 108 + 2, { kind: "reaction" });
            S.text(cx + 12, 334 - 20, "reaction", { cls: "ff-label ff-label-reaction ff-label-small" });
            S.momentArrow(466, ax, 14, 60, 300, { ry: 44, label: "n", labelX: 496, labelY: ax + 4 });

            S.leader(cx - 40, ax - 94, 130, ax - 118, "outer race");
            S.leader(cx - (roller ? 22 : 12), ax - 70, 130, ax - 92, roller ? "cylindrical roller" : "ball");
            S.leader(cx - 40, ax - 44, 130, ax - 66, "inner race");
            S.leader(100, ax + 12, 56, ax + 46, "shaft", { anchor: "start" });

            S.lines(20, 360, [
                "C = " + q(h, m.rating, m.ratingUnit) + "  basic dynamic load rating (catalogue capacity)",
                "P = " + q(h, m.load, m.loadUnit) + "  equivalent dynamic load (your duty)"
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 396, "n = " + q(h, m.speed, m.speedUnit) + ".  Basic rating life only; schematic.", "start");
            return S.svg;
        }
    });

    // -------------------------------------------------------- Cylinder force
    registry.register("cylinder-force", {
        title: "Double-acting single-rod cylinder",
        caption: "Sectional schematic. The bore-to-rod diameter ratio d/D is drawn to scale (limited to a 0.92 maximum for legibility); lengths are not. Extension pressurises the full piston area Aₚ; retraction pressurises only the rod-side annular area Aₐ = Aₚ − Aᵣ. Zero back pressure is assumed. Any efficiency scales the calculated force, never the geometry.",
        schema: {
            bore: T.pos(), rod: T.nonneg(), distanceUnit: T.unit(), pressure: T.pos(), pressureUnit: T.unit(),
            efficiency: { t: "num", gt: 0, max: 100 }
        },
        build(document, m, h) {
            const flag = {};
            const ratio = h.ratio(m.rod, m.bore, 0, 0.92, 0.4, flag);
            const S = diagram.scene(document, {
                size: [520, 400],
                label: "Hydraulic cylinder sections showing full piston area for extension and annular area for retraction",
                description: "Two sectional views of a single-rod cylinder. In extension, pressure acts on the full piston face. In retraction, pressure acts on the rod-side annulus only. End views show the full piston area and the annular area."
            });
            const hb = 38;
            const hr = hb * ratio;
            const draw = (yc, mode) => {
                const ext = mode === "extension";
                const x0 = 62, x1 = 74, g0 = 306, g1 = 318, p0 = 168, p1 = 184, rodEnd = 352;
                if (ext) S.rect(x1, yc - hb, p0 - x1, 2 * hb, "ff-fill-pressure");
                else {
                    S.rect(p1, yc - hb, g0 - p1, hb - hr, "ff-fill-pressure");
                    S.rect(p1, yc + hr, g0 - p1, hb - hr, "ff-fill-pressure");
                }
                S.hatchRect(x0, yc - hb - 11, g1 - x0, 11);
                S.hatchRect(x0, yc + hb, g1 - x0, 11);
                S.hatchRect(x0, yc - hb, x1 - x0, 2 * hb);
                S.hatchRect(g0, yc - hb, g1 - g0, hb - hr);
                S.hatchRect(g0, yc + hr, g1 - g0, hb - hr);
                S.rect(p1, yc - hr, rodEnd - p1, 2 * hr || 0.01, "ff-body");
                S.hatchRect(p0, yc - hb, p1 - p0, 2 * hb);
                S.centerline(x0 - 8, yc, rodEnd + 10, yc);
                if (ext) {
                    [-26, -13, 0, 13, 26].forEach((dy) => S.arrow(110, yc + dy, p0 - 2, yc + dy, { kind: "pressure" }));
                    S.text(112, yc - hb + 12, "p on A_p", { cls: "ff-label ff-label-pressure ff-label-small" });
                    S.arrow(rodEnd, yc, rodEnd + 44, yc, { kind: "force" });
                    S.text(rodEnd + 8, yc - 14, "F_ext", { cls: "ff-label ff-label-force" });
                } else {
                    [0.25, 0.75].forEach((k) => [-1, 1].forEach((side) => {
                        const y = yc + side * (hr + (hb - hr) * k);
                        S.arrow(236, y, p1 + 2, y, { kind: "pressure" });
                    }));
                    S.text(194, yc + hb + 28, "p on A_a only", { cls: "ff-label ff-label-pressure ff-label-small" });
                    S.arrow(rodEnd + 44, yc, rodEnd + 2, yc, { kind: "force" });
                    S.text(rodEnd + 12, yc - 14, "F_ret", { cls: "ff-label ff-label-force" });
                }
                S.dimension(x0, yc - hb, x0, yc + hb, "D", { offset: 16, extensions: false });
                S.text(x0, yc - hb - 22, ext ? "Extension: cap side pressurised" : "Retraction: rod side pressurised", { cls: "ff-label ff-label-strong", anchor: "start" });
            };
            draw(100, "extension");
            draw(272, "retraction");
            // End views aligned with each mode
            const endView = (cy, annular) => {
                const R = 42, cx = 462;
                S.circle(cx, cy, R, annular ? "ff-fill-annulus" : "ff-fill-pressure");
                S.circle(cx, cy, R, "ff-outline");
                if (ratio > 0.001) {
                    S.circle(cx, cy, R * ratio, annular ? "ff-section" : "ff-ghost");
                    if (annular) S.circle(cx, cy, R * ratio, "ff-outline");
                }
                S.text(cx, cy + R + 20, annular ? "A_a = A_p − A_r" : "A_p (full bore)", { anchor: "middle", cls: "ff-label ff-label-strong" });
            };
            endView(100, false);
            endView(272, true);
            S.lines(20, 370, [
                "D = " + q(h, m.bore, m.distanceUnit) + ",  d = " + q(h, m.rod, m.distanceUnit) + ",  p = " + q(h, m.pressure, m.pressureUnit) + " (gauge)",
                m.efficiency !== undefined ? "Efficiency η = " + q(h, m.efficiency, "%") + " (user estimate; scales force only, geometry unchanged)" : "Theoretical force: no efficiency applied."
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 392, flag.clamped ? "Rod diameter capped at 0.92 D in the drawing. Lengths not to scale." : "d/D drawn to scale; lengths not to scale.", "start");
            return S.svg;
        }
    });

    // ------------------------------------------------------------- Spring
    function helixPoints(cx, R, y0, pitch, turns, steps) {
        const points = [];
        const total = Math.round(turns * steps);
        for (let i = 0; i <= total; i += 1) {
            const t = i / steps;
            points.push([cx + R * Math.sin(2 * Math.PI * t), y0 + pitch * t]);
        }
        return points;
    }

    registry.register("spring-calculations", {
        title: "Helical compression spring",
        caption: "Schematic of a round-wire helical compression spring. d/D is drawn to scale (within drawing limits); the number of coils drawn is limited for legibility, and the loaded compression is exaggerated and not to scale. Free length is not a calculator input. Coil bind, nonlinear behaviour and buckling are not modelled.",
        schema: {
            wire: T.pos(), coil: T.pos(), coils: T.pos(), force: T.nonneg(), distanceUnit: T.unit(),
            forceUnit: T.unit(), deflection: T.nonneg()
        },
        build(document, m, h) {
            const flag = {};
            const ratio = h.ratio(m.wire, m.coil, 0.04, 0.45, 0.12, flag);
            const S = diagram.scene(document, {
                size: [520, 420],
                label: "Helical compression spring in free and loaded states with wire diameter, mean coil diameter, active coils, force and deflection",
                description: "Two views of a helical compression spring. The free spring shows wire diameter d, mean coil diameter D, outside diameter and free length. The loaded spring shows axial force F compressing the spring by an exaggerated deflection."
            });
            const R = 46;
            const wire = h.clamp(2 * R * ratio, 4, 22);
            const turns = h.has(m.coils) ? h.clamp(Math.round(m.coils), 3, 8) : 5;
            const pitch = wire + 9;
            const free = turns * pitch;
            const compress = h.has(m.force) && m.force > 0 ? 0.3 : 0;
            const loadedPitch = Math.max(wire + 1.5, pitch * (1 - compress));
            const top = 100;
            const platesAt = (cx, height, ghostTop) => {
                S.rect(cx - R - 26, top - 12, 2 * R + 52, 10, "ff-body-muted");
                S.rect(cx - R - 26, top + height + 2, 2 * R + 52, 10, "ff-body-muted");
                S.groundHatch(cx - R - 26, cx + R + 26, top + height + 12);
                if (ghostTop !== undefined) S.line(cx - R - 26, ghostTop, cx + R + 26, ghostTop, "ff-ghost");
            };
            const spring = (cx, pitchPx) => {
                const points = helixPoints(cx, R, top + wire / 2 + 1, pitchPx, turns, 28);
                const height = turns * pitchPx + wire / 2;
                const d = "M " + points.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ");
                S.path(d, "ff-wire-outline").setAttribute("stroke-width", String(wire + 3));
                S.path(d, "ff-wire-core").setAttribute("stroke-width", String(Math.max(1.5, wire - 1.5)));
                return height;
            };
            const freeCx = 150;
            const freeH = spring(freeCx, pitch);
            platesAt(freeCx, freeH);
            S.centerline(freeCx, top - 24, freeCx, top + freeH + 28);
            S.dimension(freeCx - R, top - 12, freeCx + R, top - 12, "D", { offset: -22, extensions: true });
            S.dimension(freeCx - R - wire / 2, top + freeH + 12, freeCx + R + wire / 2, top + freeH + 12, "OD = D + d", { offset: 46, extensions: true });
            S.dimension(freeCx - R - 40, top - 2, freeCx - R - 40, top + freeH + 2, "L_f", { offset: 10, extensions: false });
            S.leader(freeCx - R, top + wire / 2 + 1 + pitch * 0.75, freeCx - R - 36, top + freeH / 2 - 14, "d");
            S.text(freeCx, top - 56, "Free", { cls: "ff-label ff-label-strong", anchor: "middle" });

            const loadedCx = 390;
            const loadedH = spring(loadedCx, loadedPitch);
            platesAt(loadedCx, loadedH, top + free + 2);
            S.centerline(loadedCx, top - 24, loadedCx, top + free + 28);
            S.arrow(loadedCx, top - 60, loadedCx, top - 14, { kind: "force" });
            S.text(loadedCx + 12, top - 36, "F = " + q(h, m.force, m.forceUnit), { cls: "ff-label ff-label-force" });
            S.text(loadedCx, top - 74, "Loaded (compression exaggerated)", { cls: "ff-label ff-label-strong", anchor: "middle" });
            if (compress > 0) {
                S.dimension(loadedCx + R + 30, top - 2, loadedCx + R + 30, top + (free - loadedH) - 2, h.has(m.deflection) ? "δ = " + q(h, m.deflection, m.distanceUnit) : "δ", { offset: -8, extensions: false });
            }
            const annotationY = Math.max(300, top + freeH + 108, top + loadedH + 108);
            S.lines(20, annotationY, [
                "d = " + q(h, m.wire, m.distanceUnit) + ",  D = " + q(h, m.coil, m.distanceUnit),
                "Active coils N_a = " + q(h, m.coils) + " (" + turns + " drawn)"
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, annotationY + 54, "Free length L_f is not an input. Deflection drawn is illustrative.", "start");
            S.note(20, annotationY + 74, "Elastic, static round-wire spring only; no coil-bind or buckling check.", "start");
            return S.svg;
        }
    });

    // ------------------------------------------------------- Shaft torsion
    registry.register("shaft-torsion", {
        title: "Circular shaft in torsion",
        caption: "Schematic of a solid or hollow circular shaft carrying a constant torque T, with an equal and opposite reaction torque at the other end. The twist drawn is exaggerated. Shear stress varies linearly with radius: from zero at the centre of a solid shaft, or from nonzero τ_inner at the inner wall of a hollow shaft, to τ_max at the outer surface, per τ = Tr/J.",
        schema: {
            shaftType: T.pick(["solid", "hollow"]), torque: T.num(), torqueUnit: T.unit(),
            outer: T.pos(), inner: T.nonneg(), diameterUnit: T.unit(), length: T.pos(), lengthUnit: T.unit(),
            twist: T.num(), twistUnit: T.unit(), tauMax: T.num(), stressUnit: T.unit()
        },
        build(document, m, h) {
            const flag = {};
            const hollow = m.shaftType === "hollow";
            const ratio = hollow ? h.ratio(m.inner, m.outer, 0.1, 0.9, 0.5, flag) : 0;
            const S = diagram.scene(document, {
                size: [560, 372],
                label: "Circular shaft with equal and opposite end torques, angle of twist and linear shear stress distribution",
                description: "A side view shows a shaft of length L with torque T at one end and an equal and opposite reaction torque at the other, plus an exaggerated twist of a surface line. An end view shows shear stress rising linearly with radius to the maximum at the outer surface."
            });
            const sense = m.torque < 0 ? -1 : 1;
            const x0 = 56, x1 = 316, cy = 130, hh = 44;
            S.centerline(x0 - 16, cy, x1 + 70, cy);
            S.path("M " + x0 + " " + (cy - hh) + " L " + x1 + " " + (cy - hh) + " A 12 " + hh + " 0 0 1 " + x1 + " " + (cy + hh) + " L " + x0 + " " + (cy + hh) + " A 12 " + hh + " 0 0 1 " + x0 + " " + (cy - hh) + " Z", "ff-body");
            S.path("M " + x0 + " " + (cy - hh) + " A 12 " + hh + " 0 0 0 " + x0 + " " + (cy + hh), "ff-outline");
            if (hollow) {
                const hi = hh * ratio;
                S.line(x0, cy - hi, x1, cy - hi, "ff-construction");
                S.line(x0, cy + hi, x1, cy + hi, "ff-construction");
            }
            const twistShift = sense * 20;
            S.line(x0, cy - hh * 0.55, x1, cy - hh * 0.55, "ff-ghost");
            S.path("M " + x0 + " " + (cy - hh * 0.55) + " C " + (x0 + 90) + " " + (cy - hh * 0.55) + " " + (x1 - 90) + " " + (cy - hh * 0.55 - twistShift) + " " + x1 + " " + (cy - hh * 0.55 - twistShift), "ff-accent-line");
            S.text((x0 + x1) / 2, cy - hh - 16, "surface line twists by θ (exaggerated)", { cls: "ff-label ff-label-small", anchor: "middle" });
            S.momentArrow(x1 + 14, cy, 24, sense > 0 ? -75 : 75, sense > 0 ? 75 : -75, { ry: 66, label: "T", labelX: x1 + 58, labelY: cy - 70 });
            S.momentArrow(x0 - 14, cy, 24, sense > 0 ? 105 : 255, sense > 0 ? 255 : 105, { ry: 66, label: "T", labelX: x0 - 38, labelY: cy - 70 });
            S.text(x0 - 26, cy + 82, "reaction torque", { cls: "ff-label ff-label-reaction ff-label-small", anchor: "start" });
            S.text(x1 + 14, cy + 82, "applied torque", { cls: "ff-label ff-label-force ff-label-small", anchor: "start" });
            S.dimension(x0, cy + hh, x1, cy + hh, "L = " + q(h, m.length, m.lengthUnit), { offset: 62, extensions: true });

            // End view
            const ex = 456, ey = 150, R = 58;
            S.circle(ex, ey, R, "ff-body");
            if (hollow) S.circle(ex, ey, R * ratio, "ff-section");
            if (hollow) S.circle(ex, ey, R * ratio, "ff-outline");
            S.centerline(ex - R - 12, ey, ex + R + 12, ey);
            S.centerline(ex, ey - R - 12, ex, ey + R + 12);
            const r0 = hollow ? R * ratio : 0;
            S.line(ex + r0, ey - 38 * (r0 / R) * sense, ex + R, ey - 38 * sense, "ff-construction");
            if (hollow) {
                const innerStress = 38 * r0 / R;
                S.arrow(ex + r0, ey, ex + r0, ey - innerStress * sense, { kind: "stress" });
                S.text(ex + r0 - 8, ey - innerStress * sense - 8, "τ_inner", { cls: "ff-label ff-label-small", anchor: "end" });
            }
            for (let k = 1; k <= 3; k += 1) {
                const r = hollow ? r0 + (R - r0) * k / 3 : R * k / 3;
                const len = 38 * (r / R) * sense;
                if (Math.abs(len) > 4) S.arrow(ex + r, ey, ex + r, ey - len, { kind: "stress" });
            }
            S.text(ex + R + 10, ey - 38 * sense - (sense > 0 ? 2 : -14), "τ_max", { cls: "ff-label ff-label-accent", anchor: "start" });
            S.momentArrow(ex, ey, R + 14, 40 * sense + 90, -40 * sense + 90, { label: "T", labelX: ex, labelY: ey - R - 26 });
            S.dimension(ex - R, ey + R, ex + R, ey + R, "D = " + q(h, m.outer, m.diameterUnit), { offset: 22, extensions: true });
            if (hollow) S.leader(ex - R * ratio * 0.7, ey - R * ratio * 0.7, ex - R - 24, ey - R * 0.9, "D_i = " + q(h, m.inner, m.diameterUnit), { anchor: "end" });
            S.lines(20, 296, [
                "T = " + q(h, m.torque, m.torqueUnit) + (h.has(m.twist) ? ",  θ = " + q(h, m.twist, m.twistUnit) : ""),
                h.has(m.tauMax) ? "Calculated τ_max = " + q(h, m.tauMax, m.stressUnit) + " at the outer surface" : "τ_max = T·c / J at the outer surface (c = D/2)"
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 346, "Elastic torsion of a uniform circular shaft; sign gives torque sense only. Twist exaggerated.", "start");
            return S.svg;
        }
    });
})(window);
