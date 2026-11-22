(function (root) {
    "use strict";

    const registry = root.FormulaFoundryCalculatorDiagrams;
    const { scene } = root.FormulaFoundryDiagram;
    const { T } = registry;
    const width = 520;
    const layerNumbers = [1, 2, 3, 4, 5, 6];
    const layerModes = ["Unused", "Thickness and conductivity", "Direct R-value"];
    const arrangements = ["Close to wall", "Bracket with lower bearing", "Symmetric two-row mount"];
    const quantity = (h, m, field, group) => h.quantity(m[field], m[group + "Unit"]);
    const units = (...groups) => Object.fromEntries(groups.map((group) => [group + "Unit", T.unit()]));

    function label(d, x, y, value, anchor = "middle", cls = "ff-label") {
        return d.text(x, y, value, { cls, anchor });
    }

    function flowArrow(d, start, end, y, flow) {
        if (flow !== 0) d.arrow(start, y, end, y, { kind: "flow" });
    }

    function drawPipeFlow(d, m, h) {
        label(d, 104, 33, "Cross-section", "middle", "ff-title");
        label(d, 349, 33, "Longitudinal section", "middle", "ff-title");
        d.circle(104, 111, 52, "ff-body-muted");
        d.circle(104, 111, 42, "ff-accent-body");
        d.centerline(41, 111, 167, 111);
        d.centerline(104, 50, 104, 172);
        d.dimension(62, 111, 146, 111, "ØD", { offset: 64 });
        d.hatchRect(203, 59, 288, 10);
        d.hatchRect(203, 153, 288, 10);
        d.rect(203, 69, 288, 84, "ff-fill-pressure");
        d.centerline(191, 111, 501, 111);
        const stopped = m.flow === 0 || m.velocity === 0;
        flowArrow(d, 223, 471, 125, stopped ? 0 : m.flow);
        label(d, 347, 97, stopped ? "No flow" : "Mean flow direction");
        label(d, 104, 223, "D = " + quantity(h, m, "diameter", "diameter"));
        label(d, 104, 247, "A = " + quantity(h, m, "area", "area"));
        label(d, 347, 199, "Volumetric flow Q = " + quantity(h, m, "flow", "flow"));
        label(d, 347, 223, "Mean speed v = " + quantity(h, m, "velocity", "velocity"));
        label(d, 347, 247, "Reynolds number = " + h.quantity(m.reynolds));
    }

    function drawPressureDrop(d, m, h) {
        const pipeStart = 84;
        const pipeEnd = 436;
        d.hatchRect(pipeStart, 85, pipeEnd - pipeStart, 9);
        d.hatchRect(pipeStart, 146, pipeEnd - pipeStart, 9);
        d.rect(pipeStart, 94, pipeEnd - pipeStart, 52, "ff-fill-pressure");
        d.centerline(69, 120, 451, 120);
        for (const [x, port] of [[pipeStart, "Inlet p_1"], [pipeEnd, "Outlet p_2"]]) {
            d.line(x, 58, x, 85, "ff-outline-thin");
            d.circle(x, 58, 4, "ff-body");
            label(d, x, 42, port);
        }
        flowArrow(d, 106, 415, 133, m.flow);
        label(d, 260, 111, m.flow === 0 ? "No flow" : "Mean flow direction");
        d.dimension(pipeEnd, 94, pipeEnd, 146, "ØD", { offset: -28 });
        d.dimension(pipeStart, 155, pipeEnd, 155, "Length L = " + quantity(h, m, "length", "distance"), { offset: 35 });
        label(d, 260, 47, "Loss Δp = p_1 − p_2", "middle", "ff-title");
        label(d, 130, 241, "D = " + quantity(h, m, "diameter", "diameter"));
        label(d, 390, 241, "v = " + quantity(h, m, "velocity", "velocity"));
        label(d, 130, 266, "Straight-pipe loss = " + quantity(h, m, "major", "pressure"));
        label(d, 390, 266, "Fitting loss = " + quantity(h, m, "minor", "pressure"));
        label(d, 130, 291, "Total loss = " + quantity(h, m, "total", "pressure"), "middle", "ff-label ff-label-accent");
        label(d, 390, 291, "Fitting sum ΣK = " + h.quantity(m.minorCoefficient ?? (m.total !== undefined ? 0 : undefined)));
    }

    function drawPump(d, m, h) {
        d.polyline([[115, 193], [260, 193], [260, 153]]);
        d.polyline([[260, 77], [260, 44], [405, 44]]);
        d.circle(260, 115, 38);
        d.polygon([[247, 104], [273, 104], [260, 78]], "ff-pivot");
        d.line(141, 115, 222, 115);
        d.line(143, 121, 222, 121, "ff-outline-thin");
        if (m.shaftPower !== 0) d.arrow(146, 99, 222, 99, { kind: "force" });
        label(d, 28, 93, "Shaft power in", "start", "ff-title");
        label(d, 28, 117, "P_s = " + quantity(h, m, "shaftPower", "power"), "start");
        label(d, 106, 165, "Suction p_s", "middle", "ff-title");
        label(d, 402, 27, "Discharge p_d", "middle", "ff-title");
        flowArrow(d, 137, 235, 181, m.flow);
        flowArrow(d, 277, 381, 56, m.flow);
        label(d, 319, 104, "Hydraulic power out", "start", "ff-title");
        label(d, 319, 128, "P_h = " + quantity(h, m, "hydraulicPower", "power"), "start");
        label(d, 260, 226, "Δp = p_d − p_s = " + quantity(h, m, "pressure", "pressure"));
        label(d, 130, 253, "Head rise H = " + quantity(h, m, "head", "distance"));
        label(d, 390, 253, (m.flow === 0 ? "No flow · " : "Flow ") + "Q = " + quantity(h, m, "flow", "flow"));
    }

    function cylinderSection(d, m, h) {
        const axisY = 111;
        const boreTop = 68;
        const boreBottom = 154;
        const boreStart = 107;
        const boreEnd = 381;
        const pistonStart = 246;
        const pistonEnd = 261;
        const halfBore = (boreBottom - boreTop) / 2;
        const rod = m.bore === undefined || m.rod < m.bore ? m.rod : undefined;
        const halfRod = rod === 0 ? 0 : halfBore * h.ratio(rod, m.bore, 0.08, 0.9, 0.38);
        const rodTop = axisY - halfRod;
        const rodBottom = axisY + halfRod;
        const leftPort = 155;
        const rightPort = 356;
        const portHalfWidth = 5;
        d.rect(boreStart, boreTop, pistonStart - boreStart, 2 * halfBore, "ff-fill-pressure");
        d.rect(pistonEnd, boreTop, boreEnd - pistonEnd, 2 * halfBore, "ff-fill-annulus");
        d.hatchRect(94, 56, 13, 110);
        d.hatchRect(boreStart, 56, boreEnd - boreStart, 12);
        d.hatchRect(boreStart, boreBottom, leftPort - portHalfWidth - boreStart, 12);
        d.hatchRect(leftPort + portHalfWidth, boreBottom, rightPort - leftPort - 2 * portHalfWidth, 12);
        d.hatchRect(rightPort + portHalfWidth, boreBottom, boreEnd - rightPort - portHalfWidth, 12);
        d.hatchRect(boreEnd, 56, 13, rodTop - 56);
        d.hatchRect(boreEnd, rodBottom, 13, 166 - rodBottom);
        d.rect(pistonStart, boreTop, pistonEnd - pistonStart, 2 * halfBore, "ff-body-muted", { "data-feature": "piston" });
        if (halfRod) d.rect(pistonEnd, rodTop, 469 - pistonEnd, 2 * halfRod, "ff-body-muted", { "data-feature": "rod" });
        d.centerline(74, axisY, 490, axisY);
        d.dimension(94, boreTop, 94, boreBottom, "ØD", { offset: 29 });
        if (halfRod) d.dimension(469, rodTop, 469, rodBottom, "Ød", { offset: -12, extensions: false });
        for (const x of [leftPort, rightPort]) {
            d.line(x - portHalfWidth, boreBottom, x - portHalfWidth, 187, "ff-outline-thin");
            d.line(x + portHalfWidth, boreBottom, x + portHalfWidth, 187, "ff-outline-thin");
        }
        label(d, 132, 38, "Cap end", "middle", "ff-title");
        label(d, 387, 38, "Rod end", "middle", "ff-title");
        d.dimension(175, 56, 322, 56, "Travel s", { offset: -23 });
        label(d, 155, 207, "Cap-end port");
        label(d, 356, 207, "Rod-end port");
        label(d, 88, 235, "ØD = " + quantity(h, m, "bore", "diameter"));
        label(d, 260, 235, "s = " + quantity(h, m, "stroke", "diameter"));
        label(d, 432, 235, "Ød = " + h.quantity(rod, m.diameterUnit));
        return halfRod / halfBore;
    }

    function drawHydraulicCylinder(d, m, h) {
        const rodRatio = cylinderSection(d, m, h);
        d.circle(117, 290, 32, "ff-accent-body");
        d.circle(403, 290, 32, "ff-accent-body");
        if (rodRatio) d.circle(403, 290, 32 * rodRatio, "ff-body-muted");
        label(d, 155, 283, "Full piston area", "start", "ff-label ff-label-small");
        label(d, 155, 303, quantity(h, m, "pistonArea", "area"), "start");
        label(d, 365, 283, "Annular area", "end", "ff-label ff-label-small");
        label(d, 365, 303, quantity(h, m, "annularArea", "area"), "end");
        if (m.status !== "error" && (m.extensionSpeed !== undefined || m.extensionFlow !== undefined)) {
            d.arrow(82, 342, 136, 342, { kind: "motion" });
        }
        if (m.status !== "error" && (m.retractionSpeed !== undefined || m.retractionFlow !== undefined)) {
            d.arrow(438, 342, 384, 342, { kind: "motion" });
        }
        label(d, 147, 347, "Extension", "start");
        label(d, 373, 347, "Retraction", "end");
        label(d, 130, 372, "Speed = " + quantity(h, m, "extensionSpeed", "velocity"));
        label(d, 390, 372, "Speed = " + quantity(h, m, "retractionSpeed", "velocity"));
        label(d, 130, 395, "Time = " + quantity(h, m, "extensionTime", "strokeTime"));
        label(d, 390, 395, "Time = " + quantity(h, m, "retractionTime", "strokeTime"));
        if (m.cycleTime !== undefined) {
            label(d, 260, 423, "Cycle time = " + quantity(h, m, "cycleTime", "strokeTime"), "middle", "ff-label ff-label-accent");
        }
    }

    function drawPneumaticCylinder(d, m, h) {
        cylinderSection(d, m, h);
        for (const [x, direction, phase] of [[133, 1, "Extension"], [387, -1, "Retraction"]]) {
            label(d, x, 270, phase, "middle", "ff-title");
            d.line(x - 79, 297, x + 79, 297, "ff-outline-thin");
            d.circle(x - 79, 297, 4, "ff-body");
            d.circle(x + 79, 297, 4, "ff-body");
            d.arrow(x - 73 * direction, 297, x - 36 * direction, 297, { kind: "pressure" });
            d.arrow(x + 36 * direction, 297, x + 73 * direction, 297, { kind: "flow" });
            d.line(x, 286, x, 309, "ff-outline");
            label(d, x - 54, 326, direction === 1 ? "Cap fills" : "Cap exhausts", "middle", "ff-label ff-label-small");
            label(d, x + 54, 326, direction === 1 ? "Rod exhausts" : "Rod fills", "middle", "ff-label ff-label-small");
        }
        label(d, 130, 357, "Cap swept volume = " + quantity(h, m, "capVolume", "volume"));
        label(d, 390, 357, "Rod swept volume = " + quantity(h, m, "rodVolume", "volume"));
        label(d, 260, 384, "Air at reference conditions", "middle", "ff-title");
        label(d, 130, 409, "Per cycle = " + quantity(h, m, "freeAir", "volume"));
        label(d, 390, 409, "Flow demand = " + quantity(h, m, "consumptionRate", "flow"));
    }

    function activeLayers(m) {
        return layerNumbers.some((n) => m["layerMode" + n]) ?
            layerNumbers.filter((n) => m["layerMode" + n] && m["layerMode" + n] !== "Unused") :
            layerNumbers.slice(0, Math.trunc(m.layers ?? 3));
    }

    function drawInsulation(d, m, h) {
        const active = activeLayers(m);
        const start = 112;
        const end = 408;
        const top = 51;
        const bottom = 151;
        const block = (end - start) / Math.max(active.length, 1);
        active.forEach((n, index) => {
            const x = start + index * block;
            if (index % 2 === 0) d.hatchRect(x, top, block, bottom - top);
            else d.rect(x, top, block, bottom - top, "ff-body-muted");
            label(d, x + block / 2, 76, String(n), "middle", "ff-label ff-label-strong");
        });
        if (m.insideFilm > 0) d.rect(start - 9, top, 9, bottom - top, "ff-accent-body");
        if (m.outsideFilm > 0) d.rect(end, top, 9, bottom - top, "ff-accent-body");
        label(d, 56, 76, "Inside");
        label(d, 464, 76, "Outside");
        d.arrow(38, 111, 482, 111, { kind: "flow" });
        label(d, 260, 136, "Reference heat-flow direction");
        label(d, 260, 31, "Layers in series", "middle", "ff-title");
        if (m.insideFilm !== undefined || m.outsideFilm !== undefined) {
            label(d, 130, 177, "Inside film = " + quantity(h, m, "insideFilm", "resistance"));
            label(d, 390, 177, "Outside film = " + quantity(h, m, "outsideFilm", "resistance"));
        }
        active.forEach((n, index) => {
            const mode = m["layerMode" + n];
            const value = m["layerResistance" + n] ?? m["resistance" + n];
            const x = index % 2 === 0 ? 22 : 278;
            const y = 203 + 26 * Math.floor(index / 2);
            const detail = value !== undefined ? "R = " + h.quantity(value, m.resistanceUnit) :
                mode === layerModes[1] ? "t = " + quantity(h, m, "thickness" + n, "diameter") : "R = —";
            label(d, x, y, "Layer " + n + " · " + detail, "start");
        });
        const totalsY = 211 + 26 * Math.ceil(active.length / 2);
        label(d, 130, totalsY, "Total R = " + quantity(h, m, "resistance", "resistance"), "middle", "ff-label ff-label-accent");
        label(d, 390, totalsY, "U-factor = " + quantity(h, m, "transmittance", "transmittance"));
    }

    function drawWallHeatLoss(d, m, h) {
        d.hatchRect(218, 49, 84, 130);
        d.line(229, 50, 229, 178, "ff-outline-thin");
        d.line(291, 50, 291, 178, "ff-outline-thin");
        label(d, 260, 32, "Effective wall assembly", "middle", "ff-title");
        label(d, 116, 66, "Indoors", "middle", "ff-title");
        label(d, 404, 66, "Outdoors", "middle", "ff-title");
        label(d, 116, 92, "T_i = " + quantity(h, m, "inside", "temperature"));
        label(d, 404, 92, "T_o = " + quantity(h, m, "outside", "temperature"));
        if (m.direction === "Loss") d.arrow(65, 126, 455, 126, { kind: "force" });
        if (m.direction === "Gain") d.arrow(455, 126, 65, 126, { kind: "force" });
        const direction = { Equal: "No temperature difference", Gain: "Heat gains indoors", Loss: "Heat leaves indoors" };
        label(d, 260, 207, direction[m.direction] || "Heat flows from warmer to cooler", "middle", "ff-title");
        label(d, 130, 236, "ΔT = " + quantity(h, m, "difference", "interval"));
        label(d, 390, 236, "Heat rate = " + quantity(h, m, "heatRate", "heatRate"));
    }

    function drawWallMounting(d, m, h) {
        const mode = m.arrangement ?? arrangements[0];
        const close = mode === arrangements[0];
        const loadX = close || m.offset === 0 ? 140 : 353;
        d.hatchRect(99, 53, 26, 165);
        d.hatchRect(125, 66, 15, 139);
        d.rect(81, 87, 63, 8, "ff-body-muted");
        d.rect(143, 83, 8, 16, "ff-body-muted");
        label(d, 257, 33, mode, "middle", "ff-title");
        if (close) {
            d.rect(140, 106, 72, 78, "ff-body-muted");
        } else {
            d.hatchRect(140, 103, 231, 15);
            d.hatchPath("M 140 118 H 295 L 140 184 Z");
            if (mode === arrangements[2]) {
                d.rect(81, 187, 63, 8, "ff-body-muted");
                d.rect(143, 183, 8, 16, "ff-body-muted");
            }
            d.dimension(81, 91, 81, 191, "h", { offset: 31 });
            if (m.offset !== 0) {
                d.line(125, 173, 125, 183, "ff-contact-line");
                d.line(125, 198, 125, 204, "ff-contact-line");
                d.arrow(206, 91, 151, 91, { kind: "reaction", label: "T", labelX: 218, labelY: 95 });
                d.arrow(151, 191, 217, 191, { kind: "reaction", label: "C", labelX: 232, labelY: 195 });
                d.momentArrow(423, 129, 31, 148, -123, { label: "M", labelX: 423, labelY: 133 });
                d.dimension(125, 219, loadX, 219, "Offset e = " + quantity(h, m, "offset", "distance"), { offset: 24 });
            } else {
                label(d, 260, 241, "Zero horizontal offset");
            }
        }
        const loadStart = close ? 153 : 119;
        d.arrow(loadX, loadStart, loadX, close ? 199 : 197,
            { kind: "force", label: "W", labelX: loadX + 18, labelY: loadStart + 25 });
        d.arrow(69, 173, 69, 120, { kind: "reaction", label: "V", labelX: 68, labelY: 108 });
        label(d, 328, 72, "W = " + quantity(h, m, "weight", "force"));
        if (close) {
            label(d, 328, 145, m.offset > 0 ? "Requires zero horizontal offset" : "Zero horizontal offset");
            label(d, 328, 175, "V per fastener = " + quantity(h, m, "shear", "force"));
            label(d, 260, 234, "Fasteners sharing shear = " + h.quantity(m.count));
            return;
        }
        label(d, 130, 290, "Reaction spacing h = " + quantity(h, m, "spacing", "distance"));
        label(d, 390, 290, "Fasteners sharing shear = " + h.quantity(m.count));
        label(d, 130, 316, "V per fastener = " + quantity(h, m, "shear", "force"));
        label(d, 390, 316, "T per upper fastener = " + quantity(h, m, "tension", "force"));
        label(d, 130, 342, "Bearing C = " + quantity(h, m, "compression", "force"));
        label(d, 390, 342, "Moment M = " + quantity(h, m, "moment", "moment"));
    }

    const cylinderSchema = {
        bore: T.pos(), rod: T.nonneg(), stroke: T.pos(), ...units("diameter")
    };
    const schematics = {
        "pipe-flow": {
            title: "Full circular pipe", description: "End and longitudinal sections with inside diameter, flow area and mean flow direction.",
            caption: "Full circular pipe with symbolic wall thickness. The arrow indicates the mean flow direction.",
            height: 263, draw: drawPipeFlow,
            schema: { diameter: T.pos(), area: T.pos(), flow: T.nonneg(), velocity: T.nonneg(), reynolds: T.nonneg(),
                ...units("diameter", "area", "flow", "velocity") }
        },
        "pipe-pressure-drop": {
            title: "Pipe friction and fitting losses", description: "Pipe segment with inlet and outlet pressure taps, mean flow, diameter and length.",
            caption: "The pressure loss combines straight-pipe friction and the sum of entered fitting losses. The geometry is schematic.",
            height: 309, draw: drawPressureDrop,
            schema: { diameter: T.pos(), length: T.nonneg(), flow: T.nonneg(), velocity: T.nonneg(), minorCoefficient: T.nonneg(),
                major: T.nonneg(), minor: T.nonneg(), total: T.nonneg(), ...units("diameter", "distance", "velocity", "pressure") }
        },
        "pump-hydraulic-power": {
            title: "Pump power transfer", description: "Pump symbol showing suction, discharge and shaft power input.",
            caption: "Symbolic pump duty point. The model uses the pressure rise across the pump and the power supplied at the shaft.",
            height: 270, draw: drawPump,
            schema: { flow: T.nonneg(), pressure: T.nonneg(), head: T.nonneg(), hydraulicPower: T.nonneg(), shaftPower: T.nonneg(),
                ...units("flow", "pressure", "distance", "power") }
        },
        "hydraulic-cylinder-speed": {
            title: "Hydraulic cylinder section", description: "Single-rod cylinder with port locations, piston travel, full-bore and annular piston areas.",
            caption: "Piston position and travel are schematic. The rod-to-bore ratio is bounded for legibility.",
            height: (m) => m.cycleTime === undefined ? 412 : 440, draw: drawHydraulicCylinder,
            schema: { ...cylinderSchema, pistonArea: T.pos(), annularArea: T.pos(), extensionFlow: T.pos(), retractionFlow: T.pos(),
                extensionSpeed: T.pos(), retractionSpeed: T.pos(), extensionTime: T.nonneg(), retractionTime: T.nonneg(), cycleTime: T.nonneg(),
                ...units("area", "velocity", "strokeTime") }
        },
        "pneumatic-air-consumption": {
            title: "Pneumatic cylinder air paths", description: "Section of double-acting single-rod cylinder with supply and exhaust during each stroke.",
            caption: "Each chamber fills and exhausts once per cycle. Travel is schematic and the rod-to-bore ratio is bounded for legibility.",
            height: 426, draw: drawPneumaticCylinder,
            schema: { ...cylinderSchema, capVolume: T.nonneg(), rodVolume: T.nonneg(), freeAir: T.nonneg(),
                consumptionRate: T.nonneg(), ...units("volume", "flow") }
        },
        "multilayer-insulation": {
            title: "Series thermal resistances", description: "Wall material layers in order from inside to outside, with optional surface films.",
            caption: "Layer and film widths are symbolic. The arrow sets the reference direction for the series thermal path.",
            height: (m) => 228 + 26 * Math.ceil(activeLayers(m).length / 2), draw: drawInsulation,
            schema: {
                layers: T.num({ min: 1, max: 6 }), insideFilm: T.nonneg(), outsideFilm: T.nonneg(),
                resistance: T.pos(), transmittance: T.pos(), ...units("diameter", "resistance", "transmittance"),
                ...Object.fromEntries(layerNumbers.flatMap((n) => [
                    ["layerMode" + n, T.pick(layerModes)], ["layerResistance" + n, T.pos()],
                    ["resistance" + n, T.pos()], ["thickness" + n, T.pos()]
                ]))
            }
        },
        "wall-heat-loss": {
            title: "Steady wall heat transfer", description: "Indoor and outdoor temperatures with signed heat transfer through an effective wall assembly.",
            caption: "Wall thickness is schematic. Positive heat rates indicate loss from indoors. Negative rates indicate gain indoors.",
            height: 253, draw: drawWallHeatLoss,
            schema: { direction: T.pick(["Loss", "Gain", "Equal"]), inside: T.num(), outside: T.num(),
                difference: T.num(), heatRate: T.num(), ...units("temperature", "interval", "heatRate") }
        },
        "wall-mounting": {
            title: "Wall mounting load path", description: "Side view of a wall mounting with vertical load, fastener shear and reactions from offset.",
            caption: "Side section through one fastener column. Spacing and eccentricity are schematic. V is shared across the fasteners, T is per upper fastener and C is total bearing.",
            height: (m) => m.arrangement && m.arrangement !== arrangements[0] ? 359 : 252, draw: drawWallMounting,
            schema: { arrangement: T.pick(arrangements), offset: T.nonneg(), spacing: T.pos(), count: T.num({ min: 1, max: Number.MAX_SAFE_INTEGER }),
                weight: T.pos(), shear: T.nonneg(), tension: T.nonneg(), compression: T.nonneg(), moment: T.nonneg(),
                ...units("distance", "force", "moment") }
        }
    };

    for (const [id, spec] of Object.entries(schematics)) {
        registry.register(id, {
            title: spec.title,
            caption: spec.caption,
            schema: { ...spec.schema, status: T.pick(["stale", "error"]) },
            build(document, model, helpers) {
                const height = typeof spec.height === "function" ? spec.height(model) : spec.height;
                const d = scene(document, { size: [width, height], label: spec.description, title: spec.title, description: spec.caption });
                spec.draw(d, model, helpers);
                if (model.status) d.note(260, height + 3,
                    model.status === "stale" ? "Inputs changed. Recalculate to refresh results." : "Check inputs to calculate results.");
                return d.svg;
            }
        });
    }

    root.FormulaFoundryExpansionDiagram = function (id, inputs, outputs = {}, selectedUnits = {}, status) {
        const adapter = expansionModels[id];
        const schema = schematics[id].schema;
        const model = { status };
        function copy(fields, data) {
            for (const field of fields) {
                if (!Object.hasOwn(schema, field.id)) continue;
                const value = data[field.id] ?? field.options?.[0];
                if (value === undefined || (typeof value === "number" && !Number.isFinite(value))) continue;
                model[field.id] = value;
                if (Object.hasOwn(schema, field.group + "Unit")) {
                    model[field.group + "Unit"] = selectedUnits[field.group] ?? adapter.groups[field.group].default;
                }
            }
        }
        copy(adapter.activeInputs(inputs), inputs);
        copy(adapter.outputs, outputs);
        if (id === "wall-heat-loss" && Number.isFinite(outputs.difference)) {
            model.direction = outputs.difference === 0 ? "Equal" : outputs.difference < 0 ? "Gain" : "Loss";
        }
        return { type: "calc-diagram", id, model: registry.normalize(id, model, false) };
    };
})(window);
