(function (root) {
    "use strict";

    // Renderers for structural and thermal calculators plus the thick-cylinder plot.
    // Models contain existing calculator inputs or values the page has already computed.

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const diagram = root.FormulaFoundryDiagram;
    const { T } = registry;
    const q = (h, value, unit, placeholder) => h.quantity(value, unit, placeholder);
    const finite = (v) => typeof v === "number" && Number.isFinite(v);

    // ------------------------------------------------------- Column buckling
    const COLUMN_CASES = [
        { id: "fixed-free", name: "Fixed–free", k: 2.0 },
        { id: "pinned-pinned", name: "Pinned–pinned", k: 1.0 },
        { id: "fixed-pinned", name: "Fixed–pinned", k: 0.699 },
        { id: "fixed-fixed", name: "Fixed–fixed", k: 0.5 }
    ];

    // Illustrative first-mode shapes, normalised to a peak of 1. s runs from the base (0) to the top (1).
    function columnShape(id, s) {
        const kappa = 4.4934;
        if (id === "fixed-free") return 1 - Math.cos(Math.PI * s / 2);
        if (id === "pinned-pinned") return Math.sin(Math.PI * s);
        if (id === "fixed-fixed") return (1 - Math.cos(2 * Math.PI * s)) / 2;
        const raw = (x) => (1 - Math.cos(kappa * x)) - 0.2225 * (kappa * x - Math.sin(kappa * x));
        let peak = 0;
        for (let i = 0; i <= 100; i += 1) peak = Math.max(peak, Math.abs(raw(i / 100)));
        return raw(s) / peak;
    }

    registry.register("column-buckling", {
        title: "Euler column buckling and effective length",
        caption: "Idealised first buckling mode for each end condition supported by the calculator (K = 2.0, 1.0, 0.699, 0.5). The curved shapes are illustrative mode shapes, not calculated deflections; amplitude is arbitrary. KL is the effective length used in Pcr = π²EI/(KL)².",
        schema: { condition: T.pick(COLUMN_CASES.map((c) => c.id)), length: T.pos(), lengthUnit: T.unit(), critical: T.pos(), forceUnit: T.unit() },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [560, 460],
                label: "Euler column end conditions with original centreline, idealised buckled shape, unsupported length L and effective length factor K",
                description: "Four columns show fixed-free, pinned-pinned, fixed-pinned and fixed-fixed end conditions with an axial compressive load P, the straight centreline and an idealised buckled mode shape. The selected case is highlighted."
            });
            const top = 85, bottom = 267, H = bottom - top, amp = 23;
            S.text(280, 20, "Straight axis (dash-dot) and first buckling mode (solid)", { cls: "ff-label ff-label-small", anchor: "middle" });
            COLUMN_CASES.forEach((c, index) => {
                const cx = 85 + index * 130;
                const selected = c.id === m.condition;
                const labelClass = selected ? "ff-label ff-label-strong ff-label-accent" : "ff-label ff-label-small";
                if (selected) S.rect(cx - 58, 30, 116, 298, "ff-ghost-fill", { rx: 6 });
                S.centerline(cx, top - 10, cx, bottom + 1);
                const points = [];
                for (let i = 0; i <= 48; i += 1) {
                    const fraction = i / 48;
                    points.push([cx + amp * columnShape(c.id, fraction), bottom - fraction * H]);
                }
                S.polyline(points, selected ? "ff-mode-shape ff-mode-selected" : "ff-mode-shape");
                if (c.id === "pinned-pinned") {
                    S.pinSupport(cx, bottom, 9);
                } else {
                    S.groundHatch(cx - 22, cx + 22, bottom);
                }
                if (c.id === "pinned-pinned" || c.id === "fixed-pinned") {
                    S.pivot(cx, top, 5);
                } else if (c.id === "fixed-fixed") {
                    S.groundHatch(cx - 22, cx + 22, top, -1);
                }
                S.arrow(cx, top - 44, cx, top - 7, { kind: "force" });
                S.text(cx + 9, top - 27, "P", { cls: "ff-label ff-label-force", anchor: "start" });
                S.text(cx, bottom + 43, c.name, { cls: labelClass, anchor: "middle" });
                S.text(cx, bottom + 60, "K = " + c.k, { cls: labelClass, anchor: "middle" });
            });
            S.dimension(35, top, 35, bottom, "L", { offset: 9, extensions: true });

            const selected = COLUMN_CASES.find((c) => c.id === m.condition);
            const x = 64, y = 362, width = 105;
            S.text(20, y - 10, "Effective length", { cls: "ff-label ff-label-strong" });
            S.rect(x, y, width, 11, "ff-body");
            S.text(286, y + 10, "L = " + q(h, m.length, m.lengthUnit), { cls: "ff-label" });
            if (selected) {
                S.rect(x, y + 22, width * selected.k, 11, "ff-accent-body");
                S.text(286, y + 32, "KL = " + selected.k + " × L" + (finite(m.length * selected.k) ? " = " + q(h, m.length * selected.k, m.lengthUnit) : ""), { cls: "ff-label" });
            }
            S.text(20, y + 10, "L", { cls: "ff-label ff-label-small" });
            S.text(20, y + 32, "KL", { cls: "ff-label ff-label-small" });
            if (finite(m.critical)) {
                S.text(20, y + 62, "Calculated P_{cr} = " + q(h, m.critical, m.forceUnit), { cls: "ff-label ff-label-strong" });
            }
            S.note(20, 447, "Ideal elastic column. Mode amplitude is illustrative and arbitrary.", "start");
            return S.svg;
        }
    });

    // --------------------------------------------------- Beam bending stress
    function drawBendingSection(S, m, h, x, y, w, height) {
        const left = x - w / 2, right = x + w / 2;
        const top = y - height / 2, bottom = y + height / 2;
        const profile = m.profile;
        if (profile === "solid-circular" || profile === "hollow-circular") {
            const radius = w / 2;
            const ring = (r) => `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
            const inner = radius * h.ratio(m.innerDiameter, m.width, 0.07, 0.94, 0.62);
            S.hatchPath(ring(radius) + (profile === "hollow-circular" ? " " + ring(inner) : ""));
        } else if (profile === "hollow-rectangular") {
            const thickness = h.ratio(m.wallThickness, Math.min(m.width, m.height), 0.03, 0.47, 0.14) * Math.min(w, height);
            S.hatchPath(`M ${left} ${top} H ${right} V ${bottom} H ${left} Z
                M ${left + thickness} ${top + thickness} V ${bottom - thickness} H ${right - thickness} V ${top + thickness} Z`);
        } else if (profile === "i-beam" || profile === "t-section") {
            const flange = h.ratio(m.flangeThickness, m.height, 0.04, 0.47, 0.136) * height;
            const web = h.ratio(m.webThickness, m.width, 0.05, 0.94, 0.167) * w;
            const webLeft = x - web / 2, webRight = x + web / 2;
            const foot = profile === "i-beam"
                ? `V ${bottom - flange} H ${right} V ${bottom} H ${left} V ${bottom - flange} H ${webLeft}`
                : `V ${bottom} H ${webLeft}`;
            S.hatchPath(`M ${left} ${top} H ${right} V ${top + flange} H ${webRight} ${foot} V ${top + flange} H ${left} Z`);
        } else {
            S.hatchRect(left, top, w, height);
        }
    }

    registry.register("beam-bending-stress", {
        title: "Elastic bending stress",
        caption: "Equal, opposite couples show the sense of the applied bending moment. The cross-section marks the centroidal neutral axis and extreme-fiber distance c. The adjacent diagram shows the linear normal stress variation. Profile proportions may be adjusted for readability.",
        schema: {
            profile: T.pick(["rectangular", "solid-circular", "hollow-circular", "hollow-rectangular", "i-beam", "t-section"]),
            axis: T.pick(["x", "y"]), moment: T.num(), momentUnit: T.unit(), c: T.pos(), distanceUnit: T.unit(),
            centroidXRatio: T.num(), centroidYRatio: T.num(),
            width: T.pos(), height: T.pos(), innerDiameter: T.pos(), wallThickness: T.pos(), flangeThickness: T.pos(), webThickness: T.pos(),
            stress: T.num(), stressUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [600, 410],
                label: "Beam under bending moment with section neutral axis, extreme fiber distance c, and tension and compression regions",
                description: "A beam segment carries equal and opposite end moments. The section and linear normal stress profile share the same neutral axis."
            });
            const bendX = m.axis !== "y";
            const sign = finite(m.moment) ? Math.sign(m.moment) : 0;
            const x = 190, y = 224;
            const round = m.profile === "solid-circular" || m.profile === "hollow-circular";
            const aspect = h.ratio(m.width, m.height, 0.48, 2.1, 96 / 132);
            const w = round ? 124 : Math.min(158, 132 * aspect);
            const height = round ? 124 : Math.min(132, 158 / aspect);
            const top = y - height / 2, bottom = y + height / 2;
            const left = x - w / 2, right = x + w / 2;
            const nx = x + (h.clamp(m.centroidXRatio ?? 0.5, 0, 1) - 0.5) * w;
            const ny = y + (0.5 - h.clamp(m.centroidYRatio ?? 0.5, 0, 1)) * height;
            const label = { cls: "ff-label ff-label-small", anchor: "middle" };

            S.text(24, 30, "Pure bending", { cls: "ff-label ff-label-strong" });
            S.rect(88, 69, 286, 24, "ff-body");
            S.centerline(78, 81, 384, 81);
            if (sign !== 0) {
                S.momentArrow(88, 81, 24, sign > 0 ? 225 : 135, sign > 0 ? 135 : 225, { label: "M", labelX: 52, labelY: 56 });
                S.momentArrow(374, 81, 24, sign > 0 ? -45 : 45, sign > 0 ? 45 : -45, { label: "M", labelX: 413, labelY: 56 });
            }
            S.text(438, 85, "M = " + q(h, m.moment, m.momentUnit), { cls: "ff-label ff-label-strong" });

            S.text(x, 132, "Section · bending about " + (bendX ? "x" : "y"), label);
            S.text(437, 132, "Normal bending stress", label);
            drawBendingSection(S, m, h, x, y, w, height);
            S.circle(nx, ny, 3, "ff-pivot");
            const cLabel = "c" + (finite(m.c) ? " = " + q(h, m.c, m.distanceUnit) : "");
            if (bendX) {
                S.line(left - 20, ny, right + 15, ny, "ff-neutral-axis");
                S.text(left - 26, ny + 5, "x", { cls: "ff-label ff-label-small", anchor: "end" });
                const farY = ny - top >= bottom - ny ? top : bottom;
                S.dimension(left, ny, left, farY, "c", { offset: farY < ny ? -16 : 16 });
                const sx = 437;
                const maxDist = Math.max(ny - top, bottom - ny, 1);
                if (sign) {
                    const topPoint = sx - sign * 57 * (ny - top) / maxDist;
                    const bottomPoint = sx + sign * 57 * (bottom - ny) / maxDist;
                    S.polygon([[sx, top], [topPoint, top], [sx, ny]], "ff-ghost-fill");
                    S.polygon([[sx, ny], [bottomPoint, bottom], [sx, bottom]], "ff-ghost-fill");
                    S.line(topPoint, top, bottomPoint, bottom, "ff-accent-line");
                    S.text(sx, top - 9, sign > 0 ? "Compression" : "Tension", label);
                    S.text(sx, bottom + 19, sign > 0 ? "Tension" : "Compression", label);
                }
                S.line(sx, top - 3, sx, bottom + 3, "ff-outline-thin");
                S.line(right + 18, ny, 523, ny, "ff-construction");
                S.text(574, ny + 5, "σ = 0", { cls: "ff-label ff-label-small", anchor: "end" });
            } else {
                S.line(nx, top - 12, nx, bottom + 14, "ff-neutral-axis");
                S.text(nx + 8, bottom + 24, "y", { cls: "ff-label ff-label-small" });
                const farX = nx - left >= right - nx ? left : right;
                S.dimension(nx, bottom, farX, bottom, "c", { offset: farX < nx ? -32 : 32 });
                const sx = 437, sy = y, span = 102;
                const baseWest = sx - span * (nx - left) / w, baseEast = sx + span * (right - nx) / w;
                if (sign) {
                    const westY = sy + sign * 40 * (nx - left) / w;
                    const eastY = sy - sign * 40 * (right - nx) / w;
                    S.polygon([[baseWest, sy], [baseWest, westY], [sx, sy]], "ff-ghost-fill");
                    S.polygon([[sx, sy], [baseEast, eastY], [baseEast, sy]], "ff-ghost-fill");
                    S.line(baseWest, westY, baseEast, eastY, "ff-accent-line");
                    S.text(368, sy - 43, sign > 0 ? "Compression" : "Tension", label);
                    S.text(511, sy - 43, sign > 0 ? "Tension" : "Compression", label);
                }
                S.line(sx, sy - 25, sx, sy + 27, "ff-construction");
                S.line(baseWest - 14, sy, baseEast + 14, sy, "ff-outline-thin");
                S.text(sx, sy + 43, "σ = 0", label);
            }
            S.text(x, 357, cLabel, label);
            S.text(437, 330, finite(m.stress) ? "Signed Mc/I = " + q(h, m.stress, m.stressUnit)
                : (m.moment === 0 ? "Zero moment" : "Extreme fiber · σ = Mc/I"), label);
            S.note(24, 388, "Linear elastic flexure. Profile and stress diagram are schematic. The neutral axis is where σ = 0.", "start");
            return S.svg;
        }
    });

    // ----------------------------------------------------------- Stress-strain
    registry.register("stress-strain", {
        title: "Axially loaded member",
        caption: "Uniaxial member of original gauge length L₀ and cross-sectional area A under axial force F. The dashed outline is the original member; the solid member is deformed. Deformation is exaggerated and is not drawn to scale. Engineering strain ε = ΔL/L₀ is dimensionless; ΔL is a length.",
        schema: {
            mode: T.pick(["stress", "strain", "youngsModulus", "deformation"]),
            force: T.num(), area: T.pos(), areaUnit: T.unit(), length: T.pos(), lengthUnit: T.unit(),
            deltaLength: T.num(), strain: T.num(), forceUnit: T.unit(),
            stress: T.num(), stressUnit: T.unit(), modulus: T.num(), modulusUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 330],
                label: "Axial member with original and deformed length, axial force, cross-sectional area, gauge length and elongation",
                description: "A bar fixed at the left is loaded axially. A dashed outline shows the original length and a solid bar shows the exaggerated deformed length."
            });
            const deformation = m.deltaLength ?? m.strain;
            const zeroDeformation = deformation === 0;
            const sign = finite(deformation) ? Math.sign(deformation) : 0;
            const loadSign = finite(m.force) && !zeroDeformation ? Math.sign(m.force) : 0;
            const x = 62, length = 282, y = 130, halfHeight = 22;
            const originalEnd = x + length, end = originalEnd + sign * 33;
            S.text(24, 29, "Axial member", { cls: "ff-label ff-label-strong" });
            S.fixedSupport(x, y - 39, y + 39);
            S.rect(x, y - halfHeight, end - x, 2 * halfHeight, "ff-body");
            if (sign) S.rect(x, y - halfHeight, length, 2 * halfHeight, "ff-ghost");
            S.centerline(x + 5, y, 484, y);
            if (loadSign > 0) S.arrow(end + 3, y, end + 60, y, { kind: "force" });
            else if (loadSign < 0) S.arrow(end + 60, y, end + 3, y, { kind: "force" });
            if (finite(m.force)) {
                S.text(487, 91, "F = " + q(h, m.force, m.forceUnit), { cls: "ff-label ff-label-force", anchor: "end" });
            }
            if (sign) S.dimension(Math.min(originalEnd, end), y - halfHeight, Math.max(originalEnd, end), y - halfHeight, "ΔL", { offset: -32 });
            if (finite(m.length) || finite(m.deltaLength)) {
                S.dimension(x, y + halfHeight, originalEnd, y + halfHeight, "L_0 = " + q(h, m.length, m.lengthUnit), { offset: 23 });
            }
            if (m.mode !== "strain") {
                S.hatchRect(421, 199, 48, 48);
                S.text(445, 270, "Section A", { cls: "ff-label ff-label-small", anchor: "middle" });
            }
            const area = "A = " + q(h, m.area, m.areaUnit);
            const delta = "ΔL = " + q(h, m.deltaLength, m.lengthUnit);
            const strain = finite(m.strain) ? "ε = " + q(h, m.strain) + " (dimensionless)" : "ε = ΔL / L_0 (dimensionless)";
            const annotations = {
                stress: [area, "Calculated σ = " + q(h, m.stress, m.stressUnit)],
                strain: [delta, strain],
                youngsModulus: [area, strain, "Calculated E = " + q(h, m.modulus, m.modulusUnit)],
                deformation: [area, "Calculated " + delta]
            };
            S.lines(24, 236, annotations[m.mode] || [area, delta, strain], { cls: "ff-label ff-label-small", lineHeight: 21 });
            S.note(24, 317, zeroDeformation ? "Zero deformation: original and final outlines coincide."
                : sign ? "Axial deformation exaggerated. The dashed outline marks the original length."
                : "Axial deformation, when known, is drawn exaggerated. Section shape is schematic.", "start");
            return S.svg;
        }
    });

    // --------------------------------------------------------- Thermal expansion
    registry.register("thermal-expansion", {
        title: "Free versus fully restrained thermal expansion",
        caption: "A free member changes length with no thermal stress. A fully restrained member cannot change length. Heating gives compression and cooling gives tension. Restrained stress uses the standalone calculator’s compression-positive convention. Length change is exaggerated.",
        schema: {
            length: T.pos(), lengthUnit: T.unit(), deltaT: T.num(), tempUnit: T.unit(),
            deltaLength: T.num(), deltaLengthUnit: T.unit(), stress: T.num(), stressUnit: T.unit(), alpha: T.num()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 400],
                label: "Thermal expansion of a free member and of a fully restrained member with temperature change",
                description: "A free bar changes length with temperature without stress. The same bar between two rigid walls cannot change length and develops compressive stress on heating or tensile stress on cooling."
            });
            const sign = finite(m.deltaT) ? Math.sign(m.deltaT) : 0;
            const left = 86, right = 330, shift = sign * 36;
            const label = { cls: "ff-label ff-label-small" };
            S.text(20, 32, "Free member · no thermal stress", { cls: "ff-label ff-label-strong" });
            S.text(502, 32, "ΔT = " + q(h, m.deltaT, m.tempUnit), { cls: "ff-label ff-label-strong", anchor: "end" });
            S.rect(left, 99, right - left + shift, 36, "ff-body");
            if (shift) S.rect(left, 99, right - left, 36, "ff-ghost");
            S.centerline(left, 117, 465, 117);
            S.construction(left, 83, left, 146);
            S.text(left - 7, 93, "Datum", { ...label, anchor: "end" });
            if (shift) {
                S.dimension(Math.min(right, right + shift), 99, Math.max(right, right + shift), 99, "ΔL", { offset: -26 });
                S.arrow(right + 50 - 20 * sign, 117, right + 50 + 20 * sign, 117, { kind: "motion" });
            }
            S.dimension(left, 135, right, 135, "L_0 = " + q(h, m.length, m.lengthUnit), { offset: 21 });
            if (finite(m.deltaLength)) {
                S.text(499, 174, "ΔL = " + q(h, m.deltaLength, m.deltaLengthUnit || m.lengthUnit), { ...label, anchor: "end" });
            }

            S.text(20, 222, "Fully restrained member", { cls: "ff-label ff-label-strong" });
            S.fixedSupport(left, 246, 312, "left");
            S.fixedSupport(right, 246, 312, "right");
            S.rect(left, 263, right - left, 36, "ff-body");
            S.centerline(left - 42, 281, right + 52, 281);
            if (sign) {
                S.arrow(left - 26 * sign, 281, left, 281, { kind: "reaction" });
                S.arrow(right + 26 * sign, 281, right, 281, { kind: "reaction" });
                S.text(208, 256, sign > 0 ? "compressive σ" : "tensile σ", { ...label, anchor: "middle" });
                S.text(499, 341, finite(m.stress) ? "Restrained σ = " + q(h, m.stress, m.stressUnit) : "Restrained σ = EαΔT", { ...label, anchor: "end" });
            } else if (m.deltaT === 0) {
                S.text(208, 341, "ΔT = 0: no thermal deformation or stress", { ...label, anchor: "middle" });
            }
            S.note(20, 381, "Length change exaggerated. Restrained walls are rigid and ΔT is uniform.", "start");
            return S.svg;
        }
    });

    // ------------------------------------ Differential thermal expansion
    registry.register("differential-thermal-expansion", {
        title: "Differential thermal expansion of two members",
        caption: "Members A and B are each built from up to three series sections and expand freely and independently from a common datum on the left, so no restraint or thermal stress is modelled. Each section's drawn growth is exaggerated using its thermal strain αΔT, which keeps relative sizes consistent but is not to scale. The bar chart compares the calculated length changes to the same scale.",
        schema: {
            a: T.rows(3, 2), b: T.rows(3, 2), lengthUnit: T.unit(),
            expA: T.num(), expB: T.num(), diff: T.num()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 420],
                label: "Members A and B in series sections with free thermal expansion and differential movement between members",
                description: "Two members start at a common datum. Each member is made of one to three series sections, each expanding by its own thermal strain. A bar chart compares the resulting length changes of Member A and Member B and their difference."
            });
            const rows = (r) => Array.isArray(r) ? r.filter((x) => x[0] > 0) : [];
            const A = rows(m.a), B = rows(m.b);
            const maxLength = Math.max(Number.MIN_VALUE, ...A.concat(B).map((x) => x[0]));
            const total = Math.max(1, ...[A, B].map((rows) => rows.reduce((sum, row) => sum + row[0] / maxLength, 0)));
            const scale = 280 / total;
            const maxStrain = Math.max(1e-12, ...A.concat(B).map((x) => Math.abs(x[1])));
            const x0 = 90;
            const member = (name, secs, y) => {
                S.text(20, y + 24, name, { cls: "ff-label ff-label-strong", anchor: "start" });
                let x = x0;
                let xo = x0;
                secs.forEach((s, i) => {
                    const w = s[0] / maxLength * scale;
                    const grown = w * (1 + 0.14 * (s[1] / maxStrain));
                    S.rect(xo, y, w, 36, "ff-ghost-fill ff-dashed");
                    S.rect(x, y, grown, 36, i % 2 ? "ff-body" : "ff-accent-body");
                    S.rect(x, y, grown, 36, "ff-outline");
                    if (grown >= 29) S.text(x + grown / 2, y + 23, String(i + 1), { cls: "ff-label ff-label-small", anchor: "middle" });
                    x += grown;
                    xo += w;
                });
                S.line(xo, y - 8, xo, y + 44, "ff-construction");
            };
            S.construction(x0, 41, x0, 190);
            member("A", A, 56);
            member("B", B, 126);
            S.text(x0 + 4, 32, "Common datum · each member changes length freely", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(x0 + 4, 208, "Dashed: original length · solid: exaggerated final length", { cls: "ff-label ff-label-small", anchor: "start" });

            // bar chart
            const mid = 250;
            const peak = Math.max(Number.MIN_VALUE, Math.abs(m.expA || 0), Math.abs(m.expB || 0), Math.abs(m.diff || 0));
            const bar = (label, value, y, cls) => {
                const w = finite(value) ? Math.min(80, Math.abs(value) / peak * 80) : 0;
                const dir = finite(value) && value < 0 ? -1 : 1;
                S.rect(dir > 0 ? mid : mid - w, y, w, 16, cls);
                S.text(20, y + 13, label, { cls: "ff-label ff-label-small", anchor: "start" });
                S.text(500, y + 13, q(h, value, m.lengthUnit, "—"), { cls: "ff-label ff-label-small", anchor: "end" });
            };
            S.line(mid, 244, mid, 372, "ff-outline-thin");
            S.text(20, 238, "Calculated length changes (same scale)", { cls: "ff-label ff-label-strong", anchor: "start" });
            bar("ΔL_A", m.expA, 252, "ff-accent-body");
            bar("ΔL_B", m.expB, 282, "ff-body");
            bar("ΔL_A − ΔL_B", m.diff, 312, "ff-body-muted");
            S.note(20, 402, "Free expansion only: no restraint, no thermal stress. Section growth exaggerated.", "start");
            return S.svg;
        }
    });

    // --------------------------------------------------------- Factor of safety
    registry.register("factor-of-safety", {
        title: "Factor of safety: capacity compared with demand",
        caption: "Both bars start from zero and share the same scale. The factor of safety divides capacity by demand. The required ratio depends on the applicable code, load assumptions and consequences of failure.",
        schema: { mode: T.pick(["stress", "load"]), capacity: T.pos(), demand: T.pos(), unit: T.unit(), factor: T.pos() },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 300],
                label: "Capacity and applied demand compared on one scale",
                description: "Bars share a common zero and scale so either the capacity or the demand can be larger."
            });
            const stress = m.mode !== "load";
            const x = 46, width = 428;
            const peak = Math.max(m.capacity || 0, m.demand || 0, Number.MIN_VALUE);
            const bar = (label, value, y, cls) => {
                S.text(x, y - 12, label, { cls: "ff-label ff-label-strong" });
                S.text(x + width, y - 12, q(h, value, m.unit), { anchor: "end" });
                S.line(x, y + 25, x + width, y + 25, "ff-construction");
                if (finite(value)) S.rect(x, y, width * (value / peak), 25, cls);
            };
            bar(stress ? "Material strength (capacity)" : "Failure load (capacity)", m.capacity, 56, "ff-body-muted");
            bar(stress ? "Applied stress (demand)" : "Applied load (demand)", m.demand, 134, "ff-accent-body");
            S.line(x, 50, x, 172, "ff-outline-thin");
            S.text(x, 190, "0", { anchor: "middle", cls: "ff-label ff-label-small" });
            S.text(x + width, 190, peak > Number.MIN_VALUE ? q(h, peak, m.unit) : "—", { anchor: "end", cls: "ff-label ff-label-small" });
            S.text(260, 230, "FoS = capacity ÷ demand" + (finite(m.factor) ? " = " + q(h, m.factor) : ""), { cls: "ff-label ff-label-strong", anchor: "middle" });
            S.note(20, 270, "The ratio is not a pass/fail verdict. Verify the required factor for the application.", "start");
            return S.svg;
        }
    });

    // ------------------------------------------------------------ Hertz contact
    registry.register("hertzian-contact", {
        title: "Hertzian contact of two bodies",
        caption: "Normal force F produces a narrow strip of contact in the parallel-cylinder model or a circular contact patch in the sphere model. Body 2 may be convex, flat or concave. The contact footprints are enlarged for clarity.",
        schema: {
            config: T.pick(["cylinders", "spheres"]), shape2: T.pick(["convex", "flat", "concave"]),
            d1: T.pos(), d2: T.nonneg(), length: T.pos(), distanceUnit: T.unit(), force: T.pos(), forceUnit: T.unit(),
            contact: T.pos(), contactUnit: T.unit(), pressure: T.pos(), pressureUnit: T.unit()
        },
        build(document, m, h) {
            const cylinder = m.config !== "spheres";
            const shape = m.shape2 || "convex";
            const S = diagram.scene(document, {
                size: [560, 424],
                label: cylinder ? "Parallel cylinders in line contact" : "Spheres in point contact",
                description: "A section shows the loaded bodies and a detail shows the enlarged contact footprint."
            });
            const x = 139, y = 177, r = 45;
            const radius = r * h.ratio(m.d2, m.d1, shape === "concave" ? 1.18 : 0.47, 1.65, shape === "concave" ? 1.4 : 1);
            const bottom = shape === "convex" ? y + radius * 2 : y + 45;
            S.text(x, 24, "Normal section", { cls: "ff-label ff-label-strong", anchor: "middle" });
            if (shape === "convex") {
                S.circle(x, y + radius, radius, "ff-body-muted");
            } else if (shape === "concave") {
                const rim = y - radius;
                S.hatchPath(`M ${x - radius - 18} ${rim} H ${x - radius} A ${radius} ${radius} 0 0 0 ${x + radius} ${rim}
                    H ${x + radius + 18} V ${bottom} H ${x - radius - 18} Z`);
            } else {
                S.hatchRect(x - 87, y, 174, 45);
            }
            S.circle(x, y - r, r, "ff-body");
            S.centerline(x, 38, x, bottom + 33);
            if (finite(m.force)) {
                S.arrow(x, 40, x, y - r * 2 - 3, { kind: "force", label: "F", labelX: x + 15, labelY: 55 });
                S.arrow(x, bottom + 31, x, bottom + 3, { kind: "reaction", label: "Reaction", labelX: x + 12, labelY: bottom + 27, anchor: "start" });
            }
            S.line(x - 11, y, x + 11, y, "ff-contact-line");
            S.construction(x + 13, y, 288, y);
            S.lines(25, 374, [
                "d_1 = " + q(h, m.d1, m.distanceUnit),
                shape === "flat" ? "Body 2 · flat plate" : (shape === "concave" ? "Seat d_2 = " : "d_2 = ") + q(h, m.d2, m.distanceUnit)
            ], { cls: "ff-label ff-label-small", lineHeight: 22 });
            S.text(26, 350, "F = " + q(h, m.force, m.forceUnit), { cls: "ff-label ff-label-strong" });

            const center = 421;
            S.text(center, 24, "Enlarged contact footprint", { cls: "ff-label ff-label-strong", anchor: "middle" });
            if (cylinder) {
                const left = 334, right = 508;
                S.rect(left, 149, right - left, 56, "ff-body-muted");
                S.rect(left, y - 9, right - left, 18, "ff-accent-body");
                S.centerline(left - 12, y, right + 12, y);
                S.dimension(right, y - 9, right, y + 9, "2b", { offset: -16 });
                S.dimension(left, 205, right, 205, "L = " + q(h, m.length, m.distanceUnit), { offset: 19 });
            } else {
                S.circle(center, y, 59, "ff-body-muted");
                S.circle(center, y, 26, "ff-accent-body");
                S.centerline(center - 69, y, center + 69, y);
                S.centerline(center, y - 69, center, y + 69);
                const diagonal = 26 / Math.sqrt(2);
                S.arrow(center, y, center + diagonal, y - diagonal, { kind: "stress" });
                S.text(center + 25, y - 23, "a", { cls: "ff-label ff-label-small" });
            }
            const size = finite(m.contact)
                ? q(h, cylinder ? m.contact * 2 : m.contact, m.contactUnit || m.distanceUnit) : "—";
            S.lines(318, 350, [
                (cylinder ? "Contact width 2b = " : "Contact radius a = ") + size,
                "Peak pressure p_{max} = " + q(h, m.pressure, m.pressureUnit)
            ], { cls: "ff-label ff-label-small", lineHeight: 22 });
            return S.svg;
        }
    });

    // ------------------------------------------------------ Thick-walled cylinder
    registry.register("thick-walled-cylinder", {
        title: "Thick-walled cylinder under pressure",
        caption: "The section shows where internal and external pressures act and the orientations of radial and hoop stress. The side section shows the selected axial end condition. The companion Lamé plot gives stress signs and magnitudes.",
        schema: {
            inner: T.pos(), outer: T.pos(), distanceUnit: T.unit(), pi: T.nonneg(), po: T.nonneg(),
            pressureUnit: T.unit(), end: T.pick(["closed", "open"])
        },
        build(document, m, h) {
            const flag = {};
            const ratio = m.inner < m.outer ? h.ratio(m.inner, m.outer, 0.24, 0.87, 0.5, flag) : 0.5;
            const S = diagram.scene(document, {
                size: [560, 360],
                label: "Thick-walled cylinder transverse and longitudinal sections with inward and outward pressure arrows",
                description: "The annular section marks the radial and tangential directions. The side section distinguishes the open bore from sealed end closures."
            });
            const x = 146, y = 159, outer = 87, inner = outer * ratio;
            const ring = (r) => `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
            S.text(x, 24, "Transverse section", { cls: "ff-label ff-label-strong", anchor: "middle" });
            S.hatchPath(ring(outer) + " " + ring(inner));
            S.centerline(x - outer - 13, y, x + outer + 13, y);
            S.centerline(x, y - outer - 13, x, y + outer + 13);
            [25, 95, 165, 235, 305].forEach((degrees) => {
                const angle = degrees * Math.PI / 180;
                const pressure = (start, end) => S.arrow(x + start * Math.cos(angle), y - start * Math.sin(angle),
                    x + end * Math.cos(angle), y - end * Math.sin(angle), { kind: "pressure" });
                if (m.pi > 0) pressure(inner * 0.42, inner - 2);
                if (m.po > 0) pressure(outer + 22, outer + 2);
            });
            S.arrow(x, y, x - inner / Math.sqrt(2), y - inner / Math.sqrt(2), { kind: "stress" });
            S.text(x - inner * 0.51 + 4, y - inner * 0.51 - 4, "a", { cls: "ff-label ff-label-small" });
            S.arrow(x, y, x + outer / Math.sqrt(2), y + outer / Math.sqrt(2), { kind: "stress" });
            S.text(x + 57, y + 79, "b", { cls: "ff-label ff-label-small" });

            const sx = 333, sy = 103, right = 518, wallY = 29, axis = sy + 57;
            S.text(423, 24, "Longitudinal section", { cls: "ff-label ff-label-strong", anchor: "middle" });
            S.hatchRect(sx, sy, right - sx, wallY);
            S.hatchRect(sx, axis + 28, right - sx, wallY);
            if (m.end === "closed") {
                S.hatchRect(sx, sy + wallY, 12, 56);
                S.hatchRect(right - 12, sy + wallY, 12, 56);
                if (m.pi > 0) {
                    S.arrow(sx + 46, axis, sx + 14, axis, { kind: "pressure" });
                    S.arrow(right - 46, axis, right - 14, axis, { kind: "pressure" });
                }
            }
            S.centerline(sx - 12, axis, right + 12, axis);
            S.text(425, 246, m.end === "open" ? "Open ends · σ_z = 0"
                : m.end === "closed" ? "Closed ends · pressure on closures" : "Select an end condition", { cls: "ff-label ff-label-small", anchor: "middle" });

            const ex = 426, ey = 292;
            S.arrow(ex, ey, ex + 47, ey, { kind: "stress", label: "Radial r", labelX: ex + 54, labelY: ey + 5, anchor: "start" });
            S.arrow(ex, ey, ex, ey - 31, { kind: "stress", label: "Hoop θ", labelX: ex - 9, labelY: ey - 21, anchor: "end" });
            S.lines(24, 284, [
                "a = " + q(h, finite(m.inner) ? m.inner / 2 : undefined, m.distanceUnit),
                "b = " + q(h, finite(m.outer) ? m.outer / 2 : undefined, m.distanceUnit)
            ], { cls: "ff-label ff-label-small", lineHeight: 20 });
            S.text(146, 282, "p_i = " + q(h, m.pi, m.pressureUnit), { cls: "ff-label ff-label-pressure" });
            S.text(146, 302, "p_o = " + q(h, m.po, m.pressureUnit), { cls: "ff-label ff-label-pressure" });
            S.note(24, 340, "Pressure arrows show direction. The longitudinal wall thickness and arrow lengths are schematic.", "start");
            return S.svg;
        }
    });

    function niceStep(range, targetTicks) {
        const raw = range / targetTicks;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const f = raw / pow;
        return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
    }

    registry.register("thick-walled-cylinder-plot", {
        title: "Lamé stress distribution through the wall",
        caption: "Calculated stress versus radius from the Lamé solution at evenly spaced radii between r = a and r = b. Tension is positive and compression negative. Solid line: hoop stress σθ; dashed: radial stress σᵣ; dotted: axial stress σz (uniform, from the end condition).",
        schema: {
            samples: T.rows(64, 3), axial: T.num(), distanceUnit: T.unit(), stressUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [560, 360],
                label: "Radial, hoop and axial stress versus radius through the cylinder wall",
                description: "Plot of Lamé radial, hoop and axial stress against radius with tension positive and a labelled zero line."
            });
            const rows = Array.isArray(m.samples) ? m.samples : [];
            if (rows.length < 2) {
                S.text(280, 180, "No calculated stress data", { cls: "ff-label", anchor: "middle" });
                return S.svg;
            }
            const left = 82, right = 22, top = 24, bottom = 84, W = 560, H = 360;
            const axial = finite(m.axial) ? m.axial : 0;
            const xs = rows.map((r) => r[0]);
            const stresses = rows.flatMap((r) => [r[1], r[2]]).concat(axial);
            const xScale = xs.some((x) => Math.abs(x) > 1e250) ? 1e250 : 1;
            const yScale = stresses.some((y) => Math.abs(y) > 1e250) ? 1e250 : 1;
            const xMin = Math.min(...xs) / xScale, xMax = Math.max(...xs) / xScale;
            let yMin = Math.min(0, ...stresses) / yScale, yMax = Math.max(0, ...stresses) / yScale;
            if (yMax - yMin < 1e-12) { yMax = yMin + 1; }
            const step = niceStep(yMax - yMin, 5);
            yMin = Math.floor(yMin / step) * step;
            yMax = Math.ceil(yMax / step) * step;
            const px = (x) => left + (x - xMin) / (xMax - xMin || 1) * (W - left - right);
            const py = (y) => top + (yMax - y) / (yMax - yMin) * (H - top - bottom);
            const count = Math.round((yMax - yMin) / step);
            for (let index = 0; index <= count; index += 1) {
                const y = yMin + index * step;
                const v = Math.abs(y) < step * 1e-9 ? 0 : y;
                S.line(left, py(v), W - right, py(v), v === 0 ? "ff-plot-zero" : "ff-plot-grid");
                if (finite(v * yScale)) S.text(left - 8, py(v) + 5, diagram.formatNumber(v * yScale, 3), { cls: "ff-label ff-label-small", anchor: "end" });
            }
            S.line(left, top, left, H - bottom, "ff-plot-axis");
            S.text(W - right, py(0) - 6, "σ = 0", { cls: "ff-label ff-label-small", anchor: "end" });
            const xTicks = [xMin, (xMin + xMax) / 2, xMax];
            xTicks.forEach((x, i) => S.text(px(x), H - bottom + 20, diagram.formatNumber(x * xScale, 4), { cls: "ff-label ff-label-small", anchor: i === 0 ? "start" : i === 2 ? "end" : "middle" }));
            S.line(px(xMin), H - bottom, px(xMax), H - bottom, "ff-plot-axis");
            S.text(px(xMin), H - bottom + 36, "r = a", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(px(xMax), H - bottom + 36, "r = b", { cls: "ff-label ff-label-small", anchor: "end" });
            S.text((left + W - right) / 2, H - bottom + 54, "Radius r (" + (m.distanceUnit || "") + ")", { cls: "ff-label", anchor: "middle" });
            S.text(18, (top + H - bottom) / 2, "Stress (" + (m.stressUnit || "") + ")  tension +", { cls: "ff-label", anchor: "middle", rotate: -90 });
            const series = (i) => rows.map((r) => [px(r[0] / xScale), py(r[i] / yScale)]);
            S.polyline([[px(xMin), py(axial / yScale)], [px(xMax), py(axial / yScale)]], "ff-curve-axial");
            S.polyline(series(1), "ff-curve-radial");
            S.polyline(series(2), "ff-curve-hoop");
            const ly = H - 12;
            S.line(left, ly - 4, left + 26, ly - 4, "ff-curve-hoop");
            S.text(left + 32, ly, "Hoop σ_θ", { cls: "ff-label ff-label-small", anchor: "start" });
            S.line(left + 120, ly - 4, left + 146, ly - 4, "ff-curve-radial");
            S.text(left + 152, ly, "Radial σ_r", { cls: "ff-label ff-label-small", anchor: "start" });
            S.line(left + 250, ly - 4, left + 276, ly - 4, "ff-curve-axial");
            S.text(left + 282, ly, "Axial σ_z", { cls: "ff-label ff-label-small", anchor: "start" });
            return S.svg;
        }
    });
})(window);
