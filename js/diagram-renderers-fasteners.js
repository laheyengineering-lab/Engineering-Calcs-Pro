(function (root) {
    "use strict";

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const diagram = root.FormulaFoundryDiagram;
    const { T } = registry;
    const small = "ff-label ff-label-small";

    function viewHeading(S, x, right, y, title) {
        S.text(x, y, title, { cls: "ff-title", anchor: "start" });
        S.line(x, y + 10, right, y + 10, "ff-extension");
    }

    registry.register("bolt-torque", {
        title: "Bolted joint: tightening torque, preload and clamp load",
        caption: "Section through a bolt, two clamped members, and a nut. Torque T acts about the bolt axis. Bolt tension and member compression have the same magnitude F. The highlighted thread and bearing interfaces contribute to the lumped nut factor K. Joint proportions are schematic.",
        schema: {
            diameter: T.pos(), diameterUnit: T.unit(), clamp: T.pos(), clampUnit: T.unit(),
            nutFactor: T.pos(), torque: T.num(), torqueUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [540, 367],
                label: "Bolted joint section with torque, bolt tension, member compression and friction interfaces",
                description: "A clearance hole passes through two hatched plates. Copper arrows pull the shank ends apart, while graphite arrows compress the plates. Tightening torque acts about the nut axis. Accents locate the nut bearing face and engaged threads."
            });
            viewHeading(S, 20, 520, 25, "Joint section");
            const axis = 181, left = axis - 19, right = axis + 19;
            const top = 110, split = 149, bottom = 188;
            for (const [from, to] of [[top, split], [split, bottom]]) {
                S.hatchRect(81, from, left - 5 - 81, to - from);
                S.hatchRect(right + 5, from, 289 - right - 5, to - from);
            }
            S.polygon([[left, top], [142, top], [142, 95], [151, 84], [211, 84], [220, 95], [220, top], [right, top],
                [right, 233], [right - 6, 240], [left + 6, 240], [left, 233]], "ff-body-muted");
            S.line(143, 96, 219, 96, "ff-outline-thin");
            S.hatchPath(`M ${left} ${bottom} H 145 L 139 194 V 215 L 145 222 H ${left} Z`);
            S.hatchPath(`M ${right} ${bottom} H 217 L 223 194 V 215 L 217 222 H ${right} Z`);
            for (let y = 181; y < 229; y += 8) S.line(left, y + 4, right, y, "ff-thread-line");
            S.centerline(axis, 67, axis, 269);
            S.line(145, bottom, left - 6, bottom, "ff-contact-line");
            S.line(right + 6, bottom, 217, bottom, "ff-contact-line");
            S.line(right, 190, right, 221, "ff-failure-line");

            S.leader(216, 91, 318, 70, "Bolt head");
            S.leader(280, 131, 318, 122, "Clamped members");
            S.leader(214, bottom, 318, 174, "Bearing friction at nut face");
            S.leader(right, 209, 318, 215, "Friction at engaged threads");
            S.momentArrow(axis, 249, 50, 195, 8, { ry: 15, label: "T", labelX: 246, labelY: 253 });
            S.text(322, 255, "Tightening torque about axis", { cls: small, anchor: "start" });

            if (m.clamp > 0) {
                S.arrow(axis, split - 4, axis, top + 8, { kind: "force" });
                S.arrow(axis, split + 4, axis, bottom - 9, { kind: "force" });
                S.arrow(53, top - 16, 53, top + 8, { kind: "reaction" });
                S.arrow(53, bottom + 17, 53, bottom - 8, { kind: "reaction" });
            }
            S.text(20, 146, "Clamp F", { cls: small, anchor: "start" });
            S.text(322, 144, "Bolt preload F in shank", { cls: small, anchor: "start" });
            S.dimension(left, 242, right, 242, "ØD", { offset: 42 });

            S.line(20, 316, 520, 316, "ff-extension");
            S.lines(20, 336, [
                "ØD = " + h.quantity(m.diameter, m.diameterUnit),
                "F = " + h.quantity(m.clamp, m.clampUnit)
            ], { cls: small, lineHeight: 18 });
            S.lines(270, 336, [
                "Nut factor K = " + h.quantity(m.nutFactor),
                "Torque T = " + h.quantity(m.torque, m.torqueUnit)
            ], { cls: small, lineHeight: 18 });
            return S.svg;
        }
    });

    registry.register("thread-strength", {
        title: "Threaded engagement: stripping versus tensile failure",
        caption: "The transverse dashed line locates a fastener tensile failure plane across the threaded section. The axial dashed lines trace the approximate internal-thread stripping surface at the major diameter. The number and shape of the interlocking teeth are schematic. The tensile check uses the entered stress area, and the stripping check requires an internal-thread material strength.",
        schema: {
            diameter: T.pos(), diameterUnit: T.unit(), engagement: T.pos(), engagementUnit: T.unit(),
            pitch: T.nonneg(), load: T.nonneg(), loadUnit: T.unit(),
            tensileCapacity: T.pos(), strippingCapacity: T.pos()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [540, 419],
                label: "Engaged threads, axial load, tensile failure plane and internal-thread stripping surface",
                description: "A threaded fastener is shown in axial section engaged with a hatched internal member. Tension pulls the fastener upward; the supporting member is held downward. Dashed lines identify the transverse failure plane and the approximate cylindrical stripping surface."
            });
            viewHeading(S, 20, 520, 25, "Thread engagement");
            const cx = 170, minor = 24, major = 35, top = 151, bottom = 271;
            const count = Math.round(h.ratio(m.engagement, m.pitch, 3, 10, 6));
            const step = (bottom - top) / count;
            const profile = [[minor, top]];
            for (let i = 0; i < count; i++) {
                const y = top + step * i;
                profile.push([minor, y + step * 0.20], [major, y + step * 0.39], [major, y + step * 0.62],
                    [minor, y + step * 0.81], [minor, y + step]);
            }
            const left = profile.map(([x, y]) => [cx - x, y]);
            const right = profile.map(([x, y]) => [cx + x, y]);
            const blockLeft = 84, blockRight = 256;
            S.hatchPath(`M ${blockLeft} ${top} L ${left.map((p) => p.join(" ")).join(" ")} H ${blockLeft} Z`);
            S.hatchPath(`M ${blockRight} ${top} L ${right.map((p) => p.join(" ")).join(" ")} H ${blockRight} Z`);
            S.polygon([[cx - minor, 96], [cx + minor, 96], ...right, [cx + minor, 281], [cx - minor, 281], ...left.reverse()], "ff-body-muted");
            S.centerline(cx, 51, cx, 297);

            if (m.load > 0) {
                S.arrow(cx, 92, cx, 54, { kind: "force" });
                S.arrow(102, bottom + 3, 102, bottom + 27, { kind: "reaction" });
                S.arrow(238, bottom + 3, 238, bottom + 27, { kind: "reaction" });
                S.text(275, 294, "Support reactions", { cls: small, anchor: "start" });
            }
            S.text(188, 72, "Axial load F = " + h.quantity(m.load, m.loadUnit), { cls: "ff-label ff-label-force", anchor: "start" });

            const tensileY = top + step * 0.17;
            S.line(cx - minor, tensileY, cx + minor, tensileY, "ff-failure-line");
            S.line(cx - major, top, cx - major, bottom, "ff-failure-line");
            S.line(cx + major, top, cx + major, bottom, "ff-failure-line");
            S.leader(cx + minor, tensileY, 286, 125, "Fastener tensile plane (A_t)");
            S.leader(cx + major, 225, 286, 220, "Internal-thread stripping surface");
            S.dimension(blockLeft, top, blockLeft, bottom, "L_e", { offset: 26 });
            S.dimension(cx - major, bottom + 5, cx + major, bottom + 5, "ØD", { offset: 36 });

            S.line(20, 339, 520, 339, "ff-extension");
            S.lines(20, 359, [
                "Major ØD = " + h.quantity(m.diameter, m.diameterUnit),
                "Engagement L_e = " + h.quantity(m.engagement, m.engagementUnit),
                "Pitch p = " + h.quantity(m.pitch, m.diameterUnit)
            ], { cls: small, lineHeight: 23 });
            S.lines(272, 359, [
                "Tensile capacity = " + h.quantity(m.tensileCapacity, m.loadUnit),
                "Stripping capacity = " + h.quantity(m.strippingCapacity, m.loadUnit, h.has(m.tensileCapacity) ? "not assessed" : "—")
            ], { cls: small, lineHeight: 23 });
            return S.svg;
        }
    });

    registry.register("fillet-weld", {
        title: "Fillet weld: leg size, effective throat and load direction",
        caption: "The equal-leg section shows the effective throat measured perpendicular to the theoretical weld face. The plan view measures θ from the weld axis for the weld-metal strength check. The drawing represents one idealized weld, with schematic proportions.",
        schema: {
            leg: T.pos(), legUnit: T.unit(), length: T.pos(), lengthUnit: T.unit(),
            angle: T.num({ min: 0, max: 90 }), load: T.nonneg(), loadUnit: T.unit(), throat: T.pos()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [540, 333],
                label: "Weld section showing equal legs and effective throat, and plan view showing load angle",
                description: "The section shows the shortest line from the weld root to the theoretical face. In plan, the selected force direction is measured from the longitudinal weld axis. Zero degrees is longitudinal and ninety degrees is transverse."
            });
            viewHeading(S, 20, 246, 25, "Weld cross-section");
            viewHeading(S, 272, 520, 25, "Weld in plan");
            const x = 108, y = 190, leg = 70;
            S.hatchRect(33, y, 192, 23);
            S.hatchRect(x - 28, 80, 28, y - 80);
            S.polygon([[x, y], [x + leg, y], [x, y - leg]], "ff-weld");
            S.dimension(x - 28, y, x - 28, y - leg, "w", { offset: -32 });
            S.dimension(x, y + 23, x + leg, y + 23, "w = " + h.quantity(m.leg, m.legUnit), { offset: 21 });

            const fx = x + leg / 2, fy = y - leg / 2;
            S.line(x, y, fx, fy, "ff-accent-line");
            S.polyline([[fx - 6, fy + 6], [fx - 12, fy], [fx - 6, fy - 6]], "ff-outline-thin");
            S.leader(fx - 21, fy + 21, 176, 109, "", { anchor: "start" });
            S.text(182, 113, "t_e", { cls: "ff-label ff-label-accent" });
            S.lines(20, 276, [
                "effective throat t_e ≈ 0.707 w",
                "Calculated t_e = " + h.quantity(m.throat, m.legUnit)
            ], { cls: small, lineHeight: 20 });

            const start = 296, end = 496, weldY = 181;
            S.rect(279, 116, 233, 97, "ff-body-muted");
            S.rect(start, weldY - 21, end - start, 16, "ff-body");
            S.rect(start, weldY - 5, end - start, 10, "ff-weld");
            S.centerline(start - 11, weldY, end + 11, weldY);
            S.dimension(start, 213, end, 213, "L = " + h.quantity(m.length, m.lengthUnit), { offset: 21 });

            if (h.has(m.angle)) {
                const a = m.angle * Math.PI / 180;
                const dx = Math.cos(a), dy = -Math.sin(a);
                const originX = 385, originY = weldY - 13;
                const tipX = originX + 64 * dx, tipY = originY + 64 * dy;
                if (m.angle > 0) {
                    S.construction(originX, originY, originX + 70, originY);
                    S.path(`M ${originX + 26} ${originY} A 26 26 0 0 0 ${originX + 26 * dx} ${originY + 26 * dy}`, "ff-outline-thin");
                    S.text(originX + 36 * Math.cos(a / 2), originY + 36 * -Math.sin(a / 2) + 4, "θ", { cls: small, anchor: "middle" });
                }
                if (m.load > 0) {
                    S.arrow(originX, originY, tipX, tipY, { kind: "force", label: "P", labelX: tipX + 10, labelY: tipY - 12, anchor: "start" });
                } else {
                    S.construction(originX, originY, tipX, tipY);
                }
            }
            S.lines(272, 276, [
                "Load angle θ = " + (h.has(m.angle) ? diagram.formatNumber(m.angle) + "°" : "—"),
                "Applied force P = " + h.quantity(m.load, m.loadUnit),
                "0° longitudinal  ·  90° transverse"
            ], { cls: small, lineHeight: 20 });
            return S.svg;
        }
    });

    registry.register("press-fit", {
        title: "Interference fit: shaft in hub",
        caption: "End and longitudinal sections show the shaft and hub meeting at diameter d over length L. In the magnified pre-assembly detail, the shaft radius exceeds the hub bore radius by half the diametral interference. Pressure arrows indicate equal and opposite interface tractions. Friction over the contact area gives the idealized assembly force and torque capacity; all geometry is schematic.",
        schema: {
            interface: T.pos(), hubOuter: T.pos(), bore: T.nonneg(), length: T.pos(), distanceUnit: T.unit(),
            interference: T.nonneg(), interferenceUnit: T.unit(), relativeInterference: T.nonneg(), friction: T.nonneg(),
            pressure: T.nonneg(), pressureUnit: T.unit(), assemblyForce: T.nonneg(), assemblyForceUnit: T.unit(),
            torqueCapacity: T.nonneg(), torqueCapacityUnit: T.unit()
        },
        build(document, m, h) {
            const S = diagram.scene(document, {
                size: [540, 438],
                label: "Press-fit end and longitudinal sections with interface traction and an exaggerated pre-assembly overlap",
                description: "The shaft inside the hatched hub shares its contact surface. Pressure pushes radially into each part away from the interface. The detail shows the free shaft surface and hub bore before assembly and the radial overlap between them."
            });
            viewHeading(S, 20, 246, 25, "End view");
            viewHeading(S, 264, 520, 25, "Longitudinal section");

            const cx = 125, cy = 128, outer = 64;
            const validOuter = h.has(m.hubOuter) && m.interface < m.hubOuter && h.has(m.interface);
            const hollow = m.bore > 0 && (!h.has(m.interface) || m.bore < m.interface);
            const shaft = outer * (validOuter ? h.ratio(m.interface, m.hubOuter, 0.3, 0.84, 0.55) : 0.55);
            const bore = hollow ? shaft * h.ratio(m.bore, m.interface, 0.06, 0.80, 0.48) : 0;
            S.hatchPath(`M ${cx - outer} ${cy} a ${outer} ${outer} 0 1 1 ${2 * outer} 0 a ${outer} ${outer} 0 1 1 ${-2 * outer} 0 Z`);
            S.circle(cx, cy, shaft, "ff-body-muted");
            if (bore) S.circle(cx, cy, bore, "ff-body");
            S.centerline(cx - outer - 10, cy, cx + outer + 10, cy);
            S.centerline(cx, cy - outer - 10, cx, cy + outer + 5);
            S.dimension(cx - outer, cy, cx + outer, cy, "Hub ØD = " + h.quantity(m.hubOuter, m.distanceUnit), { offset: 90 });

            const hubHalfLength = 40 + 18 * h.ratio(m.length, m.interface, 0.35, 2, 0.8);
            const hubLeft = 405 - hubHalfLength, hubRight = 405 + hubHalfLength;
            const shaftLeft = 316, shaftRight = 510;
            S.hatchRect(hubLeft, cy - outer, hubRight - hubLeft, outer - shaft);
            S.hatchRect(hubLeft, cy + shaft, hubRight - hubLeft, outer - shaft);
            if (bore) {
                S.rect(shaftLeft, cy - shaft, shaftRight - shaftLeft, shaft - bore, "ff-body-muted");
                S.rect(shaftLeft, cy + bore, shaftRight - shaftLeft, shaft - bore, "ff-body-muted");
            } else {
                S.rect(shaftLeft, cy - shaft, shaftRight - shaftLeft, 2 * shaft, "ff-body-muted");
            }
            S.centerline(267, cy, 523, cy);
            S.leader(hubLeft + 8, cy - outer + 6, 335, 60, "Hub", { anchor: "end" });
            S.leader(500, cy - shaft, 478, 58, "Shaft", { anchor: "end" });
            S.arrow(277, cy + 24, shaftLeft - 8, cy + 24, { kind: "motion" });
            S.text(290, cy + 44, "Press-in", { cls: small, anchor: "middle" });

            if (validOuter && h.has(m.bore) && (m.bore === 0 || hollow) && m.interference > 0) {
                for (const direction of [-1, 1]) {
                    const contactY = cy + direction * shaft;
                    S.line(hubLeft, contactY, hubRight, contactY, "ff-contact-line");
                    for (const x of [386, 426]) {
                        S.arrow(x, contactY, x, contactY + direction * Math.min(16, outer - shaft - 1), { kind: "pressure" });
                        S.arrow(x + 10, contactY, x + 10, contactY - direction * Math.min(16, shaft - bore - 1), { kind: "pressure" });
                    }
                }
            }
            S.dimension(hubLeft, cy + outer, hubRight, cy + outer, "L = " + h.quantity(m.length, m.distanceUnit), { offset: 26 });

            S.text(20, 269, "Interface Ød = " + h.quantity(m.interface, m.distanceUnit), { cls: small });
            S.text(264, 269, m.bore === 0 ? "Solid shaft" : "Shaft bore Ød_i = " + h.quantity(m.bore, m.distanceUnit), { cls: small });

            viewHeading(S, 20, 520, 300, "Radial overlap before assembly");
            const left = 22, right = 170, contact = 363;
            let overlap = 0;
            if (m.interference > 0) {
                const sameUnits = m.interferenceUnit === m.distanceUnit;
                const relative = m.relativeInterference ?? (sameUnits && m.interface > 0 ? m.interference / m.interface : 0.001);
                overlap = h.clamp(6 + 6 * Math.log10(1 + relative * 1000), 6, 21);
            }
            S.hatchRect(left, 327, right - left, contact - 327);
            S.rect(left, contact, right - left, 34, "ff-body-muted");
            if (overlap) S.rect(left, contact - overlap, right - left, overlap, "ff-accent-body", { "data-radial-overlap": "" });
            S.leader(right, contact - overlap, 185, 337, "Free shaft OD");
            S.leader(right, contact, 185, 382, "Hub bore");
            S.text(20, 418, "δ = " + h.quantity(m.interference, m.interferenceUnit) + "  ·  δ/2 radial (magnified)", { cls: small });

            S.lines(310, 335, [
                "Friction μ = " + h.quantity(m.friction),
                "Contact pressure p = " + h.quantity(m.pressure, m.pressureUnit),
                "Assembly force = " + h.quantity(m.assemblyForce, m.assemblyForceUnit),
                "Torque capacity = " + h.quantity(m.torqueCapacity, m.torqueCapacityUnit)
            ], { cls: small, lineHeight: 21 });
            return S.svg;
        }
    });
})(window);
