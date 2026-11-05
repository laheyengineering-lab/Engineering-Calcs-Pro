(function (root) {
    "use strict";

    // Renderers for joint calculators: Bolt Torque, Thread Strength, Fillet Weld Strength and Press Fit.
    // They draw from small models of existing calculator inputs and never solve equations.

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const diagram = root.FormulaFoundryDiagram;
    const { T } = registry;
    const q = (h, value, unit) => h.quantity(value, unit);

    // ----------------------------------------------------------- Bolt torque
    registry.register("bolt-torque", {
        title: "Bolted joint: tightening torque, preload and clamp load",
        caption: "Conceptual section of a bolted joint for the lumped nut-factor model T = K·D·F. Torque T is a moment applied to the nut or head; it is not an axial force. The bolt carries tension F (preload) and the clamped members carry an equal compressive clamp force. The nut factor K lumps thread and bearing-surface friction together; the calculator does not compute their split, joint stiffness or grip length.",
        schema: {
            diameter: T.pos(), diameterUnit: T.unit(), clamp: T.pos(), clampUnit: T.unit(),
            nutFactor: T.pos(), torque: T.num(), torqueUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [600, 420],
                label: "Bolted joint section with tightening torque, bolt tension, clamp force, thread friction and bearing friction",
                description: "A bolt passes through two clamped plates and is tightened with a nut. Torque acts as a moment about the bolt axis. The bolt shank is in tension while the plates between the head and nut are in compression. Friction acts at the threads and under the nut face."
            });
            const cx = 270, shank = 22;
            const top = 118, mid = 190, bot = 262;
            S.hatchRect(cx - 120, top, 240, mid - top);
            S.hatchRect(cx - 120, mid, 240, bot - mid);
            S.line(cx - 120, mid, cx + 120, mid, "ff-outline-thin");
            // Bolt: head (above), shank through holes, nut below.
            S.rect(cx - shank / 2, top - 28, shank, bot - top + 28 + 44, "ff-body");
            S.polygon([[cx - 40, top], [cx - 34, top - 28], [cx + 34, top - 28], [cx + 40, top]], "ff-body");
            S.rect(cx - 36, bot, 72, 30, "ff-accent-body");
            for (let y = bot + 4; y < bot + 48; y += 7) {
                S.line(cx - shank / 2, y, cx + shank / 2, y + 3, "ff-thread-line");
            }
            S.centerline(cx, top - 54, cx, bot + 70);
            S.text(cx + 48, top - 10, "bolt head", { anchor: "start", cls: "ff-label ff-label-small" });

            // Torque on the nut: arc about the axis
            S.momentArrow(cx, bot + 15, 62, 200, -20, { ry: 16, label: "T", labelX: cx + 78, labelY: bot + 30 });
            S.text(cx - 40, bot + 78, "applied torque", { anchor: "end", cls: "ff-label ff-label-moment ff-label-small" });

            // Bolt tension (in shank) vs clamp force (on plates)
            S.arrow(cx + 5, top - 28, cx + 5, top - 60, { kind: "force" });
            S.text(cx + 14, top - 48, "F (bolt tension = preload)", { cls: "ff-label ff-label-force ff-label-small", anchor: "start" });
            S.arrow(cx - 134, top - 34, cx - 134, top - 2, { kind: "reaction" });
            S.arrow(cx - 134, bot + 30, cx - 134, bot + 2, { kind: "reaction" });
            S.text(cx - 144, mid - 6, "clamp force", { anchor: "end", cls: "ff-label ff-label-reaction ff-label-small" });
            S.text(cx - 144, mid + 12, "(compression)", { anchor: "end", cls: "ff-label ff-label-reaction ff-label-small" });

            // Friction interfaces
            S.leader(cx + 36, bot + 2, 400, bot - 34, "bearing friction (nut face)", { anchor: "start" });
            S.leader(cx + shank / 2, bot + 38, 400, bot + 50, "thread friction", { anchor: "start" });
            S.leader(cx + 110, top + 30, 400, top + 20, "clamped members", { anchor: "start" });
            S.dimension(cx - shank / 2, bot + 62, cx + shank / 2, bot + 62, "D = " + q(h, m.diameter, m.diameterUnit), { offset: 12, extensions: false });

            S.lines(20, 352, [
                "F = " + q(h, m.clamp, m.clampUnit) + ",  K = " + q(h, m.nutFactor),
                h.has(m.torque) ? "Calculated T = K·D·F = " + q(h, m.torque, m.torqueUnit) : "T = K·D·F"
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 400, "Conceptual only: K lumps all friction. Grip length is not an input.", "start");
            return S.svg;
        }
    });

    // --------------------------------------------------------- Thread strength
    registry.register("thread-strength", {
        title: "Threaded engagement: stripping versus tensile failure",
        caption: "Section through an external thread (bolt) engaged in an internal thread (nut or tapped hole). Two different failure checks are made: fastener tensile failure across the tensile stress area, and internal-thread stripping across an approximate cylindrical shear area over the engagement length. Thread-by-thread load distribution is not modelled. Thread form is drawn schematically.",
        schema: {
            diameter: T.pos(), diameterUnit: T.unit(), engagement: T.pos(), engagementUnit: T.unit(),
            pitch: T.nonneg(), load: T.nonneg(), loadUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [600, 420],
                label: "Threaded engagement with axial tensile load, tensile failure plane and internal thread stripping surface",
                description: "A bolt is threaded into an internal thread of length Le. Axial load F pulls the bolt out. The fastener can fail in tension across its stress area, or the internal threads can strip along a shear surface at about the nominal diameter over the engagement length."
            });
            const cx = 210, R = 34;
            const x0 = cx - R - 54, x1 = cx + R + 54;
            const engTop = 170, engBot = 290;
            // Internal member
            S.hatchRect(x0, engTop, x1 - x0, engBot - engTop);
            // bolt shank
            S.rect(cx - R, 62, 2 * R, engBot + 26 - 62, "ff-body");
            const tooth = 6;
            for (let y = engTop; y < engBot - 2; y += 12) {
                S.polygon([[cx - R, y], [cx - R - tooth, y + 6], [cx - R, y + 12]], "ff-body");
                S.polygon([[cx + R, y], [cx + R + tooth, y + 6], [cx + R, y + 12]], "ff-body");
            }
            S.centerline(cx, 40, cx, engBot + 40);
            S.line(cx - R, 62, cx + R, 62, "ff-outline");
            // Applied load
            S.arrow(cx, 100, cx, 44, { kind: "force" });
            S.text(cx + 12, 60, "F = " + q(h, m.load, m.loadUnit), { cls: "ff-label ff-label-force", anchor: "start" });
            S.arrow(x0 + 20, engBot + 30, x0 + 20, engBot + 2, { kind: "reaction" });
            S.arrow(x1 - 20, engBot + 30, x1 - 20, engBot + 2, { kind: "reaction" });
            S.text(x0 + 26, engBot + 44, "support reaction (schematic)", { cls: "ff-label ff-label-reaction ff-label-small", anchor: "start" });

            // Failure concepts
            S.line(cx - R - 8, 130, cx + R + 8, 130, "ff-failure-line");
            S.leader(cx + R + 8, 130, 330, 120, "fastener tensile failure plane (A_t)", { anchor: "start" });
            S.line(cx + R + tooth + 1, engTop, cx + R + tooth + 1, engBot, "ff-failure-line");
            S.line(cx - R - tooth - 1, engTop, cx - R - tooth - 1, engBot, "ff-failure-line");
            S.leader(cx + R + tooth + 1, (engTop + engBot) / 2, 330, (engTop + engBot) / 2, "thread stripping shear surface", { anchor: "start" });
            S.dimension(x0, engTop, x0, engBot, "L_e = " + q(h, m.engagement, m.engagementUnit), { offset: 22, extensions: true });
            S.dimension(cx - R, 56, cx + R, 56, "D = " + q(h, m.diameter, m.diameterUnit), { offset: -10, extensions: false });
            if (h.has(m.pitch) && m.pitch > 0) {
                S.text(x1 + 6, engTop - 8, "pitch p = " + q(h, m.pitch, m.diameterUnit), { cls: "ff-label ff-label-small", anchor: "start" });
            }
            S.lines(20, 366, [
                "Tensile check uses the entered tensile stress area A_t.",
                "Stripping check uses an approximate shear area π·D·L_e·0.5413."
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 408, "Distinct failure modes; no thread-by-thread load distribution. Thread form schematic.", "start");
            return S.svg;
        }
    });

    // ------------------------------------------------------------ Fillet weld
    registry.register("fillet-weld", {
        title: "Fillet weld: leg size, effective throat and load direction",
        caption: "Left: cross-section of an equal-leg fillet weld, showing the weld leg w and the effective throat tₑ = 0.707·w measured perpendicular to the hypotenuse (the throat is not the leg). Right: plan view of a weld of length L with the applied load at angle θ to the weld axis (0° longitudinal, 90° transverse), as in the AISC J2.4 directional-strength relation used by the calculator. Weld length is not to scale.",
        schema: {
            leg: T.pos(), legUnit: T.unit(), length: T.pos(), lengthUnit: T.unit(),
            angle: T.num({ min: 0, max: 90 }), load: T.nonneg(), loadUnit: T.unit(), throat: T.pos()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [520, 400],
                label: "Fillet weld cross-section with legs and effective throat, and plan view with load direction",
                description: "A cross-section shows two plates at right angles joined by an equal-leg triangular fillet weld, with leg size w and effective throat measured perpendicular to the hypotenuse. A plan view shows weld length L and the load direction angle."
            });
            // Cross-section
            const ox = 90, oy = 190, w = 80;
            S.hatchRect(ox - 80, oy, 220, 30);        // base plate
            S.hatchRect(ox, oy - 110, 30, 110);        // stem plate
            // weld triangle: corner at (ox+30, oy), legs along plate faces
            const c = [ox + 30, oy];
            S.polygon([c, [c[0] + w, oy], [c[0], oy - w]], "ff-weld");
            S.line(c[0], c[1], c[0] + w, c[1], "ff-outline-thin");
            S.line(c[0] + w, oy, c[0], oy - w, "ff-outline");
            // Throat: perpendicular from corner to hypotenuse
            const mid = [c[0] + w / 2, oy - w / 2];
            S.line(c[0], c[1], mid[0], mid[1], "ff-accent-line");
            S.dimension(c[0], c[1], c[0] + w, c[1], "w", { offset: 20, extensions: true });
            S.dimension(c[0], c[1], c[0], c[1] - w, "w", { offset: -22, extensions: true });
            S.leader(mid[0] - 10, mid[1] + 10, 200, 126, "effective throat t_e ≈ 0.707 w", { anchor: "start" });
            S.text(20, 62, "Section: leg w vs throat t_e", { cls: "ff-label ff-label-strong", anchor: "start" });
            S.text(ox - 70, oy + 22, "plate", { cls: "ff-label ff-label-small", anchor: "start" });

            // Plan view
            const px = 276, py = 210, len = 200;
            S.text(px, 62, "Plan view", { cls: "ff-label ff-label-strong", anchor: "start" });
            S.rect(px, py - 70, len, 70, "ff-body-muted");
            S.rect(px, py, len, 70, "ff-body-muted");
            S.rect(px, py - 7, len, 14, "ff-weld");
            S.centerline(px - 14, py, px + len + 14, py);
            S.dimension(px, py + 70, px + len, py + 70, "L = " + q(h, m.length, m.lengthUnit), { offset: 20, extensions: true });
            const theta = h.has(m.angle) ? m.angle : 90;
            const a = theta * Math.PI / 180;
            const fx = px + len / 2, fy = py - 36;
            const L = 66;
            S.arrow(fx - Math.cos(a) * L, fy + Math.sin(a) * L, fx, fy, { kind: "force" });
            S.arrow(fx, fy, fx + Math.cos(a) * L, fy - Math.sin(a) * L, { kind: "force" });
            S.text(fx + Math.cos(a) * L + 6, fy - Math.sin(a) * L - 4, "P", { cls: "ff-label ff-label-force", anchor: "start" });
            S.construction(fx, fy, fx + 52, fy);
            S.momentArrow(fx, fy, 38, 0, Math.max(6, theta), { label: "θ = " + q(h, theta, "°", "—"), labelX: fx + 46, labelY: fy + 24, anchor: "start" });
            S.lines(20, 346, [
                "w = " + q(h, m.leg, m.legUnit) + (h.has(m.throat) ? ",  throat t_e = " + q(h, m.throat, m.legUnit) : ""),
                "θ measured from the weld axis (0° longitudinal, 90° transverse)",
                h.has(m.load) && m.load > 0 ? "Applied load = " + q(h, m.load, m.loadUnit) + " (resultant; throat area = t_e · L)" : "Resistance acts on the effective throat area t_e · L."
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 386, "Equal-leg fillet, weld metal strength only. Base-metal checks are not performed.", "start");
            return S.svg;
        }
    });

    // --------------------------------------------------------------- Press fit
    registry.register("press-fit", {
        title: "Interference fit: shaft in hub",
        caption: "Shaft pressed into a hub with diametral interference δ. The interference is drawn greatly magnified in the inset and is never to scale. Contact pressure p acts at the interface diameter d (Lamé thick-cylinder model for both parts; the solid shaft case has no bore). Axial retention and torque capacity use friction μ·p over the contact area; plastic yielding is not modelled.",
        schema: {
            interface: T.pos(), hubOuter: T.pos(), bore: T.nonneg(), length: T.pos(), distanceUnit: T.unit(),
            interference: T.nonneg(), interferenceUnit: T.unit(), friction: T.nonneg(),
            pressure: T.nonneg(), pressureUnit: T.unit()
        },
        build(document, m, h) {
            const flag = {};
            const hubRatio = h.ratio(m.interface, m.hubOuter, 0.2, 0.9, 0.5, flag);
            const boreRatio = h.has(m.bore) && m.bore > 0 ? h.ratio(m.bore, m.interface, 0.05, 0.9, 0.5, flag) : 0;
            const S = diagram.scene(document, {
                size: [520, 420],
                label: "Press fit end view and section showing shaft, hub, interface pressure and magnified interference",
                description: "An end view shows a shaft inside a hub with pressure acting radially at the interface. A section shows the shaft pressed axially into the hub. A magnified inset shows the diametral interference between the mating diameters."
            });
            const cx = 120, cy = 130, Ro = 78;
            const Ri = Ro * hubRatio;
            S.circle(cx, cy, Ro, "ff-section");
            S.circle(cx, cy, Ro, "ff-outline");
            S.circle(cx, cy, Ri, "ff-body");
            S.circle(cx, cy, Ri, "ff-outline");
            if (boreRatio > 0) {
                S.circle(cx, cy, Ri * boreRatio, "ff-ghost-fill");
                S.circle(cx, cy, Ri * boreRatio, "ff-outline-thin");
            }
            S.centerline(cx - Ro - 12, cy, cx + Ro + 12, cy);
            S.centerline(cx, cy - Ro - 12, cx, cy + Ro + 12);
            [30, 150, 270].forEach((deg) => {
                const r = deg * Math.PI / 180;
                S.arrow(cx + (Ri - 26) * Math.cos(r), cy - (Ri - 26) * Math.sin(r), cx + (Ri - 1) * Math.cos(r), cy - (Ri - 1) * Math.sin(r), { kind: "pressure" });
                S.arrow(cx + (Ri + 26) * Math.cos(r + 0.5), cy - (Ri + 26) * Math.sin(r + 0.5), cx + (Ri + 1) * Math.cos(r + 0.5), cy - (Ri + 1) * Math.sin(r + 0.5), { kind: "pressure" });
            });
            S.text(cx + Ri * 0.55, cy - Ri * 0.55 - 30, "p", { cls: "ff-label ff-label-pressure" });
            S.leader(cx - Ro * 0.72, cy - Ro * 0.72, 22, 40, "hub", { anchor: "start" });
            S.leader(cx - Ri * 0.5, cy + Ri * 0.2, 22, cy + Ro + 26, "shaft", { anchor: "start" });
            S.dimension(cx - Ro, cy + Ro, cx + Ro, cy + Ro, "D_o = " + q(h, m.hubOuter, m.distanceUnit), { offset: 28, extensions: true });

            // Section
            const sx = 280, sy = 130, hubL = 90, hh = 62, sh = 38;
            S.hatchRect(sx + 20, sy - hh, hubL, hh - sh);
            S.hatchRect(sx + 20, sy + sh, hubL, hh - sh);
            S.rect(sx - 40, sy - sh, 220, 2 * sh, "ff-body");
            S.line(sx + 20, sy - sh, sx + 20 + hubL, sy - sh, "ff-accent-line");
            S.line(sx + 20, sy + sh, sx + 20 + hubL, sy + sh, "ff-accent-line");
            S.centerline(sx - 52, sy, sx + 192, sy);
            S.arrow(sx - 38, sy - 14, sx + 2, sy - 14, { kind: "motion" });
            S.text(sx - 40, sy - 24, "press-in direction", { cls: "ff-label ff-label-small", anchor: "start" });
            S.dimension(sx + 20, sy - hh, sx + 20 + hubL, sy - hh, "L = " + q(h, m.length, m.distanceUnit), { offset: -16, extensions: true });
            S.text(sx + 20 + hubL / 2, sy + hh + 20, "contact interface (d = " + q(h, m.interface, m.distanceUnit) + ")", { cls: "ff-label ff-label-small", anchor: "middle" });

            // Magnified interference inset
            const ix = 300, iy = 300;
            S.rect(ix - 40, iy - 34, 160, 68, "ff-ghost-fill");
            S.rect(ix - 40, iy - 34, 160, 68, "ff-outline-thin");
            S.rect(ix - 40, iy - 34, 160, 34, "ff-body");
            S.hatchRect(ix - 40, iy + 8, 160, 26);
            S.path("M " + (ix - 40) + " " + iy + " L " + (ix + 120) + " " + iy, "ff-ghost");
            S.rect(ix - 40, iy - 8, 160, 8, "ff-accent-body");
            S.text(ix - 36, iy - 40, "Magnified interference (not to scale)", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(ix + 128, iy - 12, "shaft surface", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(ix + 128, iy + 24, "hub bore", { cls: "ff-label ff-label-small", anchor: "start" });
            S.text(ix + 40, iy + 5, "δ/2 per side", { cls: "ff-label ff-label-small", anchor: "middle" });

            S.lines(20, 322, [
                "d = " + q(h, m.interface, m.distanceUnit) + ",  δ = " + q(h, m.interference, m.interferenceUnit),
                h.has(m.bore) && m.bore > 0 ? "Hollow shaft bore = " + q(h, m.bore, m.distanceUnit) : "Solid shaft (no bore).",
                h.has(m.pressure) ? "Interface pressure p = " + q(h, m.pressure, m.pressureUnit) : "Interface pressure p (Lamé thick-cylinder)",
                "Friction μ = " + q(h, m.friction) + " → axial force F = μ·p·π·d·L"
            ], { cls: "ff-label ff-label-small", anchor: "start" });
            S.note(20, 410, "Proportions of hub and bore are schematic; interference shown magnified.", "start");
            return S.svg;
        }
    });
})(window);
