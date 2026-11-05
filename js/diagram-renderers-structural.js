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
                size: [520, 440],
                label: "Euler column end conditions with original centreline, idealised buckled shape, unsupported length L and effective length factor K",
                description: "Four columns show fixed-free, pinned-pinned, fixed-pinned and fixed-fixed end conditions with an axial compressive load P, the straight centreline and an idealised buckled mode shape. The selected case is highlighted."
            });
            const top = 80, bottom = 270, H = bottom - top, amp = 20;
            COLUMN_CASES.forEach((c, index) => {
                const cx = 70 + index * 127;
                const on = c.id === m.condition;
                const cls = on ? "ff-accent-line" : "ff-outline-thin";
                S.centerline(cx, top - 26, cx, bottom + 8);
                const pts = [];
                for (let i = 0; i <= 48; i += 1) {
                    const s = i / 48;
                    pts.push([cx + amp * columnShape(c.id, s), bottom - s * H]);
                }
                S.polyline(pts, on ? "ff-mode-shape ff-mode-selected" : "ff-mode-shape");
                const baseFixed = true;
                if (baseFixed) {
                    S.line(cx - 22, bottom, cx + 22, bottom, "ff-wall-line");
                    S.groundHatch(cx - 22, cx + 22, bottom);
                }
                if (c.id === "pinned-pinned") {
                    S.pivot(cx, bottom, 4);
                    S.pivot(cx, top, 4);
                } else if (c.id === "fixed-pinned") {
                    S.pivot(cx + amp * columnShape(c.id, 1), top, 4);
                } else if (c.id === "fixed-fixed") {
                    S.line(cx - 18, top, cx + 18, top, "ff-wall-line");
                    S.line(cx - 18, top - 4, cx + 18, top - 4, "ff-wall-line");
                }
                S.arrow(cx + amp * columnShape(c.id, 1), top - 44, cx + amp * columnShape(c.id, 1), top - 4, { kind: "force" });
                S.text(cx + amp * columnShape(c.id, 1) + 8, top - 26, "P", { cls: "ff-label ff-label-force", anchor: "start" });
                S.text(cx, bottom + 28, c.name, { cls: on ? "ff-label ff-label-strong ff-label-accent" : "ff-label ff-label-small", anchor: "middle" });
                S.text(cx, bottom + 46, "K = " + c.k, { cls: on ? "ff-label ff-label-strong ff-label-accent" : "ff-label ff-label-small", anchor: "middle" });
            });
            S.dimension(14, top, 14, bottom, "L", { offset: -2, extensions: false });
            S.text(260, top - 62, "Original centreline (dash-dot) and idealised buckled shape", { cls: "ff-label ff-label-small", anchor: "middle" });

            const sel = COLUMN_CASES.find((c) => c.id === m.condition);
            const baseX = 90, barY = 352;
            S.text(20, barY - 14, "Effective length for the selected end condition", { cls: "ff-label ff-label-strong", anchor: "start" });
            const unit = 110;
            S.rect(baseX, barY, unit, 12, "ff-body");
            S.text(baseX + unit + 8, barY + 11, "L = " + q(h, m.length, m.lengthUnit), { cls: "ff-label ff-label-small", anchor: "start" });
            if (sel) {
                S.rect(baseX, barY + 24, unit * sel.k, 12, "ff-accent-body");
                S.text(baseX + unit * sel.k + 8, barY + 35, "KL = " + sel.k + " × L" + (finite(m.length) ? " = " + q(h, m.length * sel.k, m.lengthUnit) : ""), { cls: "ff-label ff-label-small", anchor: "start" });
            }
            S.text(20, barY + 11, "L", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(20, barY + 35, "KL", { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 424, "Euler (ideal, elastic, slender) column; mode shapes illustrative, not calculated.", "start");
            return S.svg;
        }
    });

    // --------------------------------------------------- Beam bending stress
    registry.register("beam-bending-stress", {
        title: "Elastic bending stress",
        caption: "Elastic flexure σ = M·c / I for the selected section and bending axis. The stress distribution is linear about the neutral axis (zero stress there); sections and proportions are schematic, and the extreme-fiber distance c is measured perpendicular to the bending axis. Moment sense is illustrative.",
        schema: {
            profile: T.pick(["rectangular", "solid-circular", "hollow-circular", "hollow-rectangular", "i-beam", "t-section"]),
            axis: T.pick(["x", "y"]), moment: T.num(), momentUnit: T.unit(), c: T.pos(), distanceUnit: T.unit(),
            stress: T.num(), stressUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [600, 380],
                label: "Beam under bending moment with section neutral axis, extreme fiber distance c, and tension and compression regions",
                description: "A beam segment carries equal and opposite end moments. A cross-section shows the neutral axis, the bending axis, tension and compression regions and the maximum bending stress at the extreme fiber."
            });
            const bendX = m.axis !== "y";
            const sign = m.moment < 0 ? -1 : 1;
            // Beam side view
            S.rect(60, 70, 220, 26, "ff-body");
            S.centerline(48, 83, 292, 83);
            S.momentArrow(60, 83, 28, 130, 230, { label: "M", labelX: 20, labelY: 52 });
            S.momentArrow(280, 83, 28, 50, -50, { label: "M", labelX: 310, labelY: 52 });
            S.text(170, 56, "Beam segment under pure bending", { anchor: "middle", cls: "ff-label ff-label-small" });

            // Section
            const cx = 190, cy = 224, w = 96, ht = 132;
            const p = m.profile || "rectangular";
            const rw = bendX ? w : ht * 0.8;
            const rh = bendX ? ht : w * 0.9;
            const half = bendX ? rh / 2 : rw / 2;
            if (p === "solid-circular" || p === "hollow-circular") {
                S.circle(cx, cy, 62, "ff-section");
                S.circle(cx, cy, 62, "ff-outline");
                if (p === "hollow-circular") {
                    S.circle(cx, cy, 38, "ff-ghost-fill");
                    S.circle(cx, cy, 38, "ff-outline");
                }
            } else if (p === "hollow-rectangular") {
                S.hatchPath(`M ${cx - rw / 2} ${cy - rh / 2} h ${rw} v ${rh} h ${-rw} Z M ${cx - rw / 2 + 14} ${cy - rh / 2 + 14} v ${rh - 28} h ${rw - 28} v ${-(rh - 28)} Z`);
            } else if (p === "i-beam" || p === "t-section") {
                const fw = bendX ? 96 : 120, ft = bendX ? 18 : 18, wt = 16;
                const yTop = cy - rh / 2, yBot = cy + rh / 2;
                if (bendX) {
                    const d = p === "i-beam"
                        ? `M ${cx - fw / 2} ${yTop} h ${fw} v ${ft} h ${-(fw - wt) / 2} v ${rh - 2 * ft} h ${(fw - wt) / 2} v ${ft} h ${-fw} v ${-ft} h ${(fw - wt) / 2} v ${-(rh - 2 * ft)} h ${-(fw - wt) / 2} Z`
                        : `M ${cx - fw / 2} ${yTop} h ${fw} v ${ft} h ${-(fw - wt) / 2} v ${rh - ft} h ${-wt} v ${-(rh - ft)} h ${-(fw - wt) / 2} Z`;
                    S.hatchPath(d);
                } else {
                    S.hatchRect(cx - fw / 2, cy - 11, fw, 22);
                    S.hatchRect(cx - fw / 2, cy - 40, 18, 80);
                    S.hatchRect(cx + fw / 2 - 18, cy - 40, 18, 80);
                }
            } else {
                S.hatchRect(cx - rw / 2, cy - rh / 2, rw, rh);
            }
            const reach = p === "solid-circular" || p === "hollow-circular" ? 62 : half;
            const nlen = bendX ? Math.max(80, (p === "solid-circular" || p === "hollow-circular") ? 74 : rw / 2 + 28) : Math.max(80, rh / 2 + 28);
            if (bendX) S.line(cx - nlen - 14, cy, cx + nlen + 14, cy, "ff-neutral-axis");
            else S.line(cx, cy - ht / 2 - 28, cx, cy + ht / 2 + 28, "ff-neutral-axis");
            S.text(bendX ? cx + nlen + 20 : cx + 8, bendX ? cy - 6 : cy + ht / 2 + 44, "neutral axis (σ = 0)", { cls: "ff-label ff-label-small", anchor: "start" });

            if (bendX) {
                S.dimension(cx + (p.endsWith("circular") ? 62 : rw / 2), cy, cx + (p.endsWith("circular") ? 62 : rw / 2), cy - reach, "c", { offset: -34, extensions: true });
                const top = sign > 0 ? "Compression" : "Tension";
                const bot = sign > 0 ? "Tension" : "Compression";
                S.text(cx - nlen - 10, cy - reach / 2, top, { anchor: "end", cls: "ff-label ff-label-small" });
                S.text(cx - nlen - 10, cy + reach / 2, bot, { anchor: "end", cls: "ff-label ff-label-small" });
                S.leader(cx, cy + reach, cx + 40, cy + reach + 26, "σ_max at extreme fiber", { anchor: "start" });
            } else {
                S.dimension(cx, cy + 4 + (ht / 2 + 24), cx + reach, cy + 4 + (ht / 2 + 24), "c", { offset: 12, extensions: false });
                S.text(cx - 10, cy - ht / 2 - 38, "Compression", { anchor: "end", cls: "ff-label ff-label-small" });
                S.text(cx + 10, cy - ht / 2 - 38, "Tension", { anchor: "start", cls: "ff-label ff-label-small" });
                S.leader(cx + reach, cy + 40, cx + reach + 24, cy + 70, "σ_max at extreme fiber", { anchor: "start" });
            }
            S.text(cx, cy + 118, "Bending about the " + (bendX ? "x (horizontal)" : "y (vertical)") + " centroidal axis", { anchor: "middle", cls: "ff-label ff-label-small" });
            S.lines(430, 150, [
                "M = " + q(h, m.moment, m.momentUnit),
                "c = " + q(h, m.c, m.distanceUnit),
                finite(m.stress) ? "σ_max = " + q(h, m.stress, m.stressUnit) : "σ_max = M·c / I"
            ], { cls: "ff-label", anchor: "start" });
            S.note(20, 372, "Linear elastic, prismatic beam. Section drawing is schematic.", "start");
            return S.svg;
        }
    });

    // ----------------------------------------------------------- Stress-strain
    registry.register("stress-strain", {
        title: "Axially loaded member",
        caption: "Uniaxial member of original gauge length L₀ and cross-sectional area A under axial force F. The dashed outline is the original member; the solid member is deformed. Deformation is exaggerated and is not drawn to scale. Engineering strain ε = ΔL/L₀ is dimensionless; ΔL is a length.",
        schema: {
            force: T.num(), area: T.pos(), areaUnit: T.unit(), length: T.pos(), lengthUnit: T.unit(),
            deltaLength: T.num(), strain: T.num(), forceUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 330],
                label: "Axial member with original and deformed length, axial force, cross-sectional area, gauge length and elongation",
                description: "A bar fixed at the left is loaded axially. A dashed outline shows the original length and a solid bar shows the exaggerated deformed length."
            });
            let sign = 1;
            if (finite(m.deltaLength) && m.deltaLength !== 0) sign = Math.sign(m.deltaLength);
            else if (finite(m.strain) && m.strain !== 0) sign = Math.sign(m.strain);
            else if (finite(m.force) && m.force !== 0) sign = Math.sign(m.force);
            const x0 = 70, L = 250, y = 140, hh = 28;
            const dx = sign * 34;
            S.line(x0, y - hh - 24, x0, y + hh + 24, "ff-wall-line");
            for (let yy = y - hh - 20; yy <= y + hh + 24; yy += 9) S.line(x0, yy, x0 - 9, yy + 9, "ff-ground-tick");
            S.rect(x0, y - hh, L, 2 * hh, "ff-ghost-fill ff-dashed");
            S.centerline(x0 - 14, y, x0 + L + dx + 90, y);
            S.rect(x0, y - hh * (1 - sign * 0.07), L + dx, 2 * hh * (1 - sign * 0.07), "ff-section");
            S.rect(x0, y - hh * (1 - sign * 0.07), L + dx, 2 * hh * (1 - sign * 0.07), "ff-outline");
            const endX = x0 + L + dx;
            if (sign > 0) S.arrow(endX, y, endX + 66, y, { kind: "force" });
            else S.arrow(endX + 66, y, endX, y, { kind: "force" });
            S.text(endX + 28, y - 14, "F = " + q(h, m.force, m.forceUnit), { cls: "ff-label ff-label-force", anchor: "start" });
            S.dimension(x0, y + hh + 10, x0 + L, y + hh + 10, "L₀ = " + q(h, m.length, m.lengthUnit), { offset: 20, extensions: true });
            S.dimension(x0 + L, y - hh - 8, endX, y - hh - 8, "ΔL" + (finite(m.deltaLength) ? " = " + q(h, m.deltaLength, m.lengthUnit) : ""), { offset: -22, extensions: true });
            S.text(x0 + L / 2, y + 5, "A = " + q(h, m.area, m.areaUnit), { cls: "ff-label ff-label-strong", anchor: "middle" });
            // Cross-section inset
            S.rect(420, 232, 44, 44, "ff-section");
            S.rect(420, 232, 44, 44, "ff-outline");
            S.text(442, 292, "section A", { anchor: "middle", cls: "ff-label ff-label-small" });
            S.lines(20, 262, [
                "σ = F / A     ε = ΔL / L₀ (dimensionless)",
                finite(m.strain) ? "ε = " + q(h, m.strain) : "ε = ΔL / L₀"
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 318, "Deformation exaggerated — not to scale. " + (sign > 0 ? "Tension: elongation." : "Compression: shortening."), "start");
            return S.svg;
        }
    });

    // --------------------------------------------------------- Thermal expansion
    registry.register("thermal-expansion", {
        title: "Free versus fully restrained thermal expansion",
        caption: "Top: a free member changes length by ΔL = αL₀ΔT and develops no thermal stress. Bottom: the same member fully restrained between rigid walls cannot change length, so a thermal stress σ = EαΔT (if E is entered) and an equal internal force result. Length change is exaggerated and not to scale. The calculator uses ΔT only (not separate initial and final temperatures).",
        schema: {
            length: T.pos(), lengthUnit: T.unit(), deltaT: T.num(), tempUnit: T.unit(),
            deltaLength: T.num(), stress: T.num(), stressUnit: T.unit(), alpha: T.num()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 400],
                label: "Thermal expansion of a free member and of a fully restrained member with temperature change",
                description: "A free bar changes length with temperature without stress. The same bar between two rigid walls cannot change length and develops compressive stress on heating or tensile stress on cooling."
            });
            const sign = finite(m.deltaT) && m.deltaT < 0 ? -1 : 1;
            const x0 = 110, L = 220, hh = 22;
            const dx = sign * 30;
            // Free
            S.text(20, 36, "Free member (no thermal stress)", { cls: "ff-label ff-label-strong", anchor: "start" });
            S.line(x0, 66, x0, 150, "ff-wall-line");
            for (let y = 70; y <= 150; y += 9) S.line(x0, y, x0 - 9, y + 9, "ff-ground-tick");
            S.rect(x0, 94, L, 2 * hh, "ff-ghost-fill ff-dashed");
            S.rect(x0, 94, L + dx, 2 * hh, "ff-section");
            S.rect(x0, 94, L + dx, 2 * hh, "ff-outline");
            S.arrow(x0 + L + dx + 4, 116, x0 + L + dx + 44, 116, { kind: "motion" });
            if (sign < 0) { S.arrow(x0 + L + dx + 44, 116, x0 + L + dx + 4, 116, { kind: "motion" }); }
            S.dimension(x0, 94 + 2 * hh, x0 + L, 94 + 2 * hh, "L₀ = " + q(h, m.length, m.lengthUnit), { offset: 16, extensions: true });
            S.dimension(x0 + L, 94, x0 + L + dx, 94, "ΔL" + (finite(m.deltaLength) ? " = " + q(h, m.deltaLength, m.lengthUnit) : ""), { offset: -22, extensions: true });
            S.text(x0 + L / 2, 121, "ΔT = " + q(h, m.deltaT, m.tempUnit), { cls: "ff-label ff-label-strong", anchor: "middle" });

            // Restrained
            S.text(20, 206, "Fully restrained member (stress develops)", { cls: "ff-label ff-label-strong", anchor: "start" });
            S.line(x0, 232, x0, 320, "ff-wall-line");
            S.line(x0 + L, 232, x0 + L, 320, "ff-wall-line");
            for (let y = 236; y <= 320; y += 9) {
                S.line(x0, y, x0 - 9, y + 9, "ff-ground-tick");
                S.line(x0 + L, y, x0 + L + 9, y + 9, "ff-ground-tick");
            }
            S.rect(x0, 264, L, 2 * hh, "ff-section");
            S.rect(x0, 264, L, 2 * hh, "ff-outline");
            if (sign > 0) {
                S.arrow(x0 - 30, 286, x0 - 2, 286, { kind: "reaction" });
                S.arrow(x0 + L + 30, 286, x0 + L + 2, 286, { kind: "reaction" });
            } else {
                S.arrow(x0 + 2, 286, x0 - 30, 286, { kind: "reaction" });
                S.arrow(x0 + L - 2, 286, x0 + L + 30, 286, { kind: "reaction" });
            }
            S.text(x0 + L / 2, 291, sign > 0 ? "compressive σ" : "tensile σ", { cls: "ff-label ff-label-strong", anchor: "middle" });
            S.text(x0 + L / 2, 342, finite(m.stress) ? "σ = EαΔT = " + q(h, m.stress, m.stressUnit) : "σ = EαΔT (enter E to evaluate)", { cls: "ff-label", anchor: "middle" });
            S.note(20, 386, "Length change exaggerated. Walls assumed rigid; ΔT assumed uniform.", "start");
            return S.svg;
        }
    });

    // ------------------------------------ Differential thermal expansion
    registry.register("differential-thermal-expansion", {
        title: "Differential thermal expansion of two members",
        caption: "Members A and B are each built from up to three series sections and expand freely and independently from a common datum on the left, so no restraint or thermal stress is modelled. Each section's drawn growth is exaggerated using its thermal strain αΔT, which keeps relative sizes consistent but is not to scale. The bar chart compares the calculated length changes to the same scale.",
        schema: {
            a: T.rows(3, 3), b: T.rows(3, 3), lengthUnit: T.unit(),
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
            const total = Math.max(1e-12, ...[A, B].map((r) => r.reduce((s, x) => s + x[0], 0)));
            const scale = 280 / total;
            const maxStrain = Math.max(1e-12, ...A.concat(B).map((x) => Math.abs(x[1])));
            const f = 0.14 / maxStrain;
            const x0 = 90;
            const fills = ["ff-section", "ff-body", "ff-section"];
            const member = (name, secs, y) => {
                S.text(20, y + 24, name, { cls: "ff-label ff-label-strong", anchor: "start" });
                let x = x0;
                let xo = x0;
                secs.forEach((s, i) => {
                    const w = s[0] * scale;
                    const grown = w * (1 + f * s[1]);
                    S.rect(xo, y, w, 36, "ff-ghost-fill ff-dashed");
                    S.rect(x, y, grown, 36, i % 2 ? "ff-body" : "ff-accent-body");
                    S.rect(x, y, grown, 36, "ff-outline");
                    S.text(x + grown / 2, y + 23, "§" + (i + 1), { cls: "ff-label ff-label-small", anchor: "middle" });
                    x += grown;
                    xo += w;
                });
                S.line(xo, y - 8, xo, y + 44, "ff-construction");
                return { x, xo };
            };
            S.line(x0, 40, x0, 190, "ff-wall-line");
            for (let y = 44; y <= 190; y += 9) S.line(x0, y, x0 - 9, y + 9, "ff-ground-tick");
            member("A", A, 56);
            member("B", B, 126);
            S.text(x0 + 4, 32, "common datum — free ends expand to the right", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(x0 + 4, 208, "dashed = original length;  solid = exaggerated expanded length", { cls: "ff-label ff-label-small", anchor: "start" });

            // bar chart
            const mid = 210;
            const peak = Math.max(1e-12, Math.abs(m.expA || 0), Math.abs(m.expB || 0), Math.abs(m.diff || 0));
            const bar = (label, value, y, cls) => {
                const w = finite(value) ? Math.min(220, Math.abs(value) / peak * 220) : 0;
                const dir = finite(value) && value < 0 ? -1 : 1;
                S.rect(dir > 0 ? mid : mid - w, y, w, 16, cls);
                S.text(20, y + 13, label, { cls: "ff-label ff-label-small", anchor: "start" });
                S.text(dir > 0 ? mid + w + 8 : mid - w - 8, y + 13, q(h, value, m.lengthUnit, "—"), { cls: "ff-label ff-label-small", anchor: dir > 0 ? "start" : "end" });
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
        caption: "Factor of safety is a ratio of capacity to demand: FoS = strength / applied stress (stress basis) or failure load / applied load (load basis). It is not a pass/fail verdict; the required value depends on the code, consequence of failure, uncertainty and loading.",
        schema: { mode: T.pick(["stress", "load"]), capacity: T.pos(), demand: T.pos(), unit: T.unit(), factor: T.pos() },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 330],
                label: "Bars comparing capacity and applied demand to show factor of safety as a ratio",
                description: "A long bar shows capacity (strength or failure load) and a shorter bar shows the applied demand. Their ratio is the factor of safety."
            });
            const stress = m.mode !== "load";
            const x0 = 40, W = 420;
            const ratio = finite(m.capacity) && finite(m.demand) && m.capacity > 0 ? m.demand / m.capacity : 0.5;
            const dw = Math.min(W, Math.max(8, W * (finite(ratio) ? ratio : 0.5)));
            const over = ratio > 1;
            S.text(x0, 50, stress ? "Material strength (capacity)" : "Failure load (capacity)", { cls: "ff-label ff-label-strong", anchor: "start" });
            S.rect(x0, 60, W, 34, "ff-body-muted");
            S.rect(x0, 60, W, 34, "ff-outline");
            S.text(x0 + W - 8, 83, finite(m.capacity) ? q(h, m.capacity, m.unit) : "capacity", { cls: "ff-label", anchor: "end" });
            S.text(x0, 140, stress ? "Applied stress (demand)" : "Applied load (demand)", { cls: "ff-label ff-label-strong", anchor: "start" });
            S.rect(x0, 150, dw, 34, "ff-accent-body");
            S.rect(x0, 150, dw, 34, "ff-outline");
            S.text(x0 + Math.min(dw, W) + (dw > W - 100 ? -8 : 8), 173, finite(m.demand) ? q(h, m.demand, m.unit) : "demand", { cls: "ff-label", anchor: dw > W - 100 ? "end" : "start" });
            S.construction(x0 + W, 56, x0 + W, 190);
            S.text(x0 + W, 206, "capacity", { cls: "ff-label ff-label-small", anchor: "end" });
            if (over) S.text(x0 + W, 218, "demand exceeds capacity: FoS < 1 (bar capped)", { cls: "ff-label ff-label-small", anchor: "end" });
            S.rect(x0, 236, 440, 36, "ff-ghost-fill");
            S.text(x0 + 220, 260, "FoS = capacity ÷ demand" + (finite(m.factor) ? " = " + q(h, m.factor) : ""), { cls: "ff-label ff-label-strong", anchor: "middle" });
            S.note(20, 304, "Ratio only — not a pass/fail verdict. Required FoS depends on code and consequence.", "start");
            return S.svg;
        }
    });

    // ------------------------------------------------------------ Hertz contact
    registry.register("hertzian-contact", {
        title: "Hertzian contact of two bodies",
        caption: "Elastic Hertz contact under normal force F: two cylinders give line contact of width 2b along length L; two spheres give point contact within a circle of radius a. The contact patch is drawn enlarged. The semi-elliptical (or hemispherical) pressure profile is the qualitative Hertz shape scaled to the calculated peak pressure; plasticity and non-Hertzian contact are not modelled.",
        schema: {
            config: T.pick(["cylinders", "spheres"]), shape2: T.pick(["convex", "flat", "concave"]),
            d1: T.pos(), d2: T.nonneg(), length: T.pos(), distanceUnit: T.unit(), force: T.pos(), forceUnit: T.unit(),
            contact: T.pos(), pressure: T.pos(), pressureUnit: T.unit()
        },
        build(document, m, h) {
            const flag = {};
            const cyl = m.config !== "spheres";
            const shape2 = m.shape2 || "convex";
            const S = diagram.scene(document, {
                size: [520, 420],
                label: cyl ? "Two cylinders in line contact with force, contact width and pressure profile" : "Two spheres in point contact with force, contact radius and pressure profile",
                description: "Two bodies are pressed together by a normal force F. A small contact region forms. An inset shows the qualitative Hertz pressure distribution across the contact."
            });
            const body = cyl ? "cylinder" : "sphere";
            const cx = 150, r1 = 56;
            const r2 = shape2 === "flat" ? 0 : shape2 === "concave" ? h.clamp(h.ratio(m.d2, m.d1, 1.1, 1.8, 1.4, flag) * r1, r1 + 8, 96) : h.clamp(h.ratio(m.d2, m.d1, 0.4, 1.8, 1, flag) * r1, 28, 90);
                        const contactY = 210;
            S.circle(cx, contactY - r1, r1, "ff-section");
            S.circle(cx, contactY - r1, r1, "ff-outline");
            if (shape2 === "flat") {
                S.hatchRect(cx - 100, contactY, 200, 48);
            } else if (shape2 === "convex") {
                S.circle(cx, contactY + r2, r2, "ff-section");
                S.circle(cx, contactY + r2, r2, "ff-outline");
            } else {
                // Concave seat: hatched block with a spherical or cylindrical bowl that body 1 sits in.
                const R = r2;
                const rim = contactY - R;
                S.hatchPath(`M ${cx - R - 24} ${rim} H ${cx - R} A ${R} ${R} 0 0 0 ${cx + R} ${rim} H ${cx + R + 24} V ${contactY + 30} H ${cx - R - 24} Z`);
                S.circle(cx, contactY - r1, r1, "ff-section");
                S.circle(cx, contactY - r1, r1, "ff-outline");
            }
            S.centerline(cx, 40, cx, contactY + 110);
            S.arrow(cx, 30, cx, contactY - 2 * r1 - 4, { kind: "force" });
            S.text(cx + 10, 40, "F = " + q(h, m.force, m.forceUnit), { cls: "ff-label ff-label-force", anchor: "start" });
            S.arrow(cx, contactY + 128, cx, contactY + 100, { kind: "reaction" });
            S.text(cx + 10, contactY + 120, "F", { cls: "ff-label ff-label-reaction", anchor: "start" });
            S.text(12, contactY - 2 * r1 - 12, body + " 1 (d₁ = " + q(h, m.d1, m.distanceUnit) + ")", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(cx + 66, contactY + 36, shape2 === "flat" ? "flat surface" : (shape2 === "convex" ? body + " 2" : "concave seat") + (shape2 !== "flat" && finite(m.d2) && m.d2 > 0 ? " (d₂ = " + q(h, m.d2, m.distanceUnit) + ")" : ""), { cls: "ff-label ff-label-small", anchor: "start" });
            // Contact marker
            S.line(cx - 10, contactY, cx + 10, contactY, "ff-contact-line");
            S.leader(cx + 10, contactY, 264, contactY - 22, cyl ? "contact width 2b (enlarged)" : "contact circle radius a (enlarged)", { anchor: "start" });

            // Pressure inset
            const ix = 300, iy = 132, iw = 190;
            S.text(ix, 44, "Qualitative Hertz pressure profile", { cls: "ff-label ff-label-small", anchor: "start" });
            S.line(ix, iy, ix + iw, iy, "ff-outline");
            const pts = [];
            for (let i = 0; i <= 40; i += 1) {
                const s = -1 + i / 20;
                pts.push([ix + iw / 2 + s * iw / 2, iy - 48 * Math.sqrt(Math.max(0, 1 - s * s))]);
            }
            S.polygon(pts.concat([[ix + iw, iy], [ix, iy]]), "ff-fill-pressure");
            S.polyline(pts, "ff-curve-hoop");
            S.dimension(ix, iy, ix + iw, iy, cyl ? "2b = " + q(h, finite(m.contact) ? 2 * m.contact : undefined, m.distanceUnit, "2b") : "2a = " + q(h, finite(m.contact) ? 2 * m.contact : undefined, m.distanceUnit, "2a"), { offset: 18, extensions: true });
            S.text(ix + iw / 2 + 8, iy - 54, "p_max" + (finite(m.pressure) ? " = " + q(h, m.pressure, m.pressureUnit) : ""), { cls: "ff-label ff-label-small", anchor: "start" });

            // Footprint
            if (cyl) {
                S.rect(ix, 290, iw, 54, "ff-body-muted");
                S.rect(ix, 314, iw, 6, "ff-accent-body");
                S.dimension(ix, 344, ix + iw, 344, "L = " + q(h, m.length, m.distanceUnit), { offset: 14, extensions: true });
                S.text(ix, 282, "Line contact: width 2b over length L", { cls: "ff-label ff-label-small", anchor: "start" });
            } else {
                S.circle(ix + iw / 2, 314, 30, "ff-body-muted");
                S.circle(ix + iw / 2, 314, 12, "ff-accent-body");
                S.text(ix, 268, "Point contact: circular patch radius a", { cls: "ff-label ff-label-small", anchor: "start" });
            }
            S.note(20, 400, "Elastic Hertz theory only. Contact patch enlarged; pressure profile qualitative.", "start");
            return S.svg;
        }
    });

    // ------------------------------------------------------ Thick-walled cylinder
    registry.register("thick-walled-cylinder", {
        title: "Thick-walled cylinder under pressure",
        caption: "Cross-section of a long thick-walled cylinder (Lamé) with inner radius a, outer radius b, internal pressure pᵢ and external pressure pₒ. Radial stress σᵣ acts along the radius and hoop stress σθ acts tangentially; axial stress σz follows the selected end condition. Arrow sizes are schematic, not proportional to stress.",
        schema: {
            inner: T.pos(), outer: T.pos(), distanceUnit: T.unit(), pi: T.nonneg(), po: T.nonneg(),
            pressureUnit: T.unit(), end: T.pick(["closed", "open"])
        },
        build(document, m, h) {
            const flag = {};
            const ratio = h.ratio(m.inner, m.outer, 0.2, 0.85, 0.5, flag);
            const S = diagram.scene(document, {
                size: [520, 390],
                label: "Thick-walled cylinder cross-section with internal and external pressure, radial stress and hoop stress, and axial end condition",
                description: "An annular cross-section shows inner radius a and outer radius b with pressures acting on the inner and outer surfaces. A small element shows radial and hoop stress directions. A side view shows closed or open ends."
            });
            const cx = 140, cy = 150, Ro = 100, Ri = Ro * ratio;
            S.circle(cx, cy, Ro, "ff-section");
            S.circle(cx, cy, Ro, "ff-outline");
            S.circle(cx, cy, Ri, "ff-ghost-fill");
            S.circle(cx, cy, Ri, "ff-outline");
            S.centerline(cx - Ro - 12, cy, cx + Ro + 12, cy);
            S.centerline(cx, cy - Ro - 12, cx, cy + Ro + 12);
            if (m.pi > 0 || m.pi === undefined) {
                [0, 60, 120, 180, 240, 300].forEach((deg) => {
                    const a = (deg + 30) * Math.PI / 180;
                    S.arrow(cx + Ri * 0.2 * Math.cos(a), cy - (Ri * 0.2) * Math.sin(a), cx + (Ri - 2) * Math.cos(a), cy - (Ri - 2) * Math.sin(a), { kind: "pressure" });
                });
                S.text(cx, cy + 5, "p_i", { cls: "ff-label ff-label-pressure ff-label-strong", anchor: "middle" });
            }
            if (m.po > 0) {
                [20, 80, 140, 200, 260, 320].forEach((deg) => {
                    const a = deg * Math.PI / 180;
                    S.arrow(cx + (Ro + 26) * Math.cos(a), cy - (Ro + 26) * Math.sin(a), cx + (Ro + 2) * Math.cos(a), cy - (Ro + 2) * Math.sin(a), { kind: "pressure" });
                });
                S.text(cx + Ro + 28, cy - Ro - 4, "p_o", { cls: "ff-label ff-label-pressure ff-label-strong", anchor: "start" });
            } else {
                S.text(cx + Ro + 8, cy - Ro - 4, "p_o = 0", { cls: "ff-label ff-label-small", anchor: "start" });
            }
            S.leader(cx + Ri * 0.5, cy, cx + Ro + 36, cy + 24, "a = " + q(h, m.inner !== undefined ? m.inner / 2 : undefined, m.distanceUnit), { anchor: "start" });
            S.leader(cx + Ro * 0.85, cy, cx + Ro + 36, cy + 44, "b = " + q(h, m.outer !== undefined ? m.outer / 2 : undefined, m.distanceUnit), { anchor: "start" });

            // Stress element near the 45° position in the wall
            const ang = -45 * Math.PI / 180;
            const rm = (Ri + Ro) / 2;
            const ex = cx + rm * Math.cos(ang), ey = cy - rm * Math.sin(ang);
            S.arrow(ex, ey, ex + 34 * Math.cos(ang), ey - 34 * Math.sin(ang), { kind: "stress", label: "σ_r", labelX: ex + 38 * Math.cos(ang), labelY: ey - 38 * Math.sin(ang) + 12 });
            S.arrow(ex, ey, ex + 34 * Math.sin(ang) * -1, ey - 34 * Math.cos(ang), { kind: "stress", label: "σ_θ", labelX: ex - 34 * Math.sin(ang) - 16, labelY: ey - 34 * Math.cos(ang) - 8 });

            // Side view of end condition
            const sx = 300, sy = 274, sl = 150, sh = 40;
            S.rect(sx, sy - sh, sl, sh * 2, "ff-section");
            S.rect(sx, sy - sh, sl, sh * 2, "ff-outline");
            S.rect(sx, sy - sh * ratio, sl, sh * 2 * ratio, "ff-ghost-fill");
            if (m.end === "open") {
                S.text(sx + sl / 2, sy + sh + 24, "Open ends: σ_z = 0", { cls: "ff-label ff-label-small", anchor: "middle" });
            } else {
                S.rect(sx - 8, sy - sh, 8, sh * 2, "ff-body");
                S.rect(sx + sl, sy - sh, 8, sh * 2, "ff-body");
                S.arrow(sx + sl + 8, sy, sx + sl + 46, sy, { kind: "stress", label: "σ_z", labelX: sx + sl + 30, labelY: sy - 10 });
                S.text(sx + sl / 2, sy + sh + 24, "Closed ends: pressure on end closures", { cls: "ff-label ff-label-small", anchor: "middle" });
            }
            S.text(sx, sy - sh - 12, "Axial boundary condition (side view)", { cls: "ff-label ff-label-small", anchor: "start" });
            S.lines(20, 356, [
                "p_i = " + q(h, m.pi, m.pressureUnit) + ",  p_o = " + q(h, m.po, m.pressureUnit),
                "Tension positive, compression negative; σ_r = −p at a loaded surface."
            ], { cls: "ff-label ff-label-small", anchor: "start", lineHeight: 26 });
            S.note(20, 400, "Schematic: arrow lengths are not proportional to stress.", "start");
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
            const xMin = Math.min(...xs), xMax = Math.max(...xs);
            const all = rows.flatMap((r) => [r[1], r[2]]).concat(axial);
            let yMin = Math.min(0, ...all), yMax = Math.max(0, ...all);
            if (yMax - yMin < 1e-12) { yMax = yMin + 1; }
            const step = niceStep(yMax - yMin, 5);
            yMin = Math.floor(yMin / step) * step;
            yMax = Math.ceil(yMax / step) * step;
            const px = (x) => left + (x - xMin) / (xMax - xMin || 1) * (W - left - right);
            const py = (y) => top + (yMax - y) / (yMax - yMin) * (H - top - bottom);
            for (let y = yMin; y <= yMax + step / 2; y += step) {
                const v = Math.abs(y) < step * 1e-9 ? 0 : y;
                S.line(left, py(v), W - right, py(v), v === 0 ? "ff-plot-zero" : "ff-plot-grid");
                S.text(left - 8, py(v) + 5, diagram.formatNumber(v, 3), { cls: "ff-label ff-label-small", anchor: "end" });
            }
            S.line(left, top, left, H - bottom, "ff-plot-axis");
            S.text(W - right, py(0) - 6, "σ = 0", { cls: "ff-label ff-label-small", anchor: "end" });
            const xTicks = [xMin, (xMin + xMax) / 2, xMax];
            xTicks.forEach((x, i) => S.text(px(x), H - bottom + 20, diagram.formatNumber(x, 4), { cls: "ff-label ff-label-small", anchor: i === 0 ? "start" : i === 2 ? "end" : "middle" }));
            S.line(px(xMin), H - bottom, px(xMax), H - bottom, "ff-plot-axis");
            S.text(px(xMin), H - bottom + 36, "r = a", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(px(xMax), H - bottom + 36, "r = b", { cls: "ff-label ff-label-small", anchor: "end" });
            S.text((left + W - right) / 2, H - bottom + 54, "Radius r (" + (m.distanceUnit || "") + ")", { cls: "ff-label", anchor: "middle" });
            S.text(18, (top + H - bottom) / 2, "Stress (" + (m.stressUnit || "") + ")  tension +", { cls: "ff-label", anchor: "middle", rotate: -90 });
            const series = (i) => rows.map((r) => [px(r[0]), py(r[i])]);
            S.polyline([[px(xMin), py(axial)], [px(xMax), py(axial)]], "ff-curve-axial");
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
