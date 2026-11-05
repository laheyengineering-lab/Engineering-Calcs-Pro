(function (root) {
    "use strict";

    // Registry for calculator-specific diagram renderers.
    //
    // A renderer is a view of a small, serializable model (plain numbers, short
    // strings and number arrays). Models are built from existing calculator inputs
    // (and, where noted, results the calculator has already computed); renderers
    // never solve engineering equations. The same normalizer is used for live
    // pages and for report snapshots, so saved models re-render identically.

    const registry = Object.create(null);
    const MAX_TEXT = 40;
    const MAX_ARRAY = 64;

    const T = {
        num: (options) => Object.assign({ t: "num" }, options),
        pos: () => ({ t: "num", gt: 0 }),
        nonneg: () => ({ t: "num", min: 0 }),
        str: (max) => ({ t: "str", max: max || MAX_TEXT }),
        unit: () => ({ t: "str", max: 16 }),
        pick: (values) => ({ t: "enum", values }),
        nums: (max) => ({ t: "nums", max: max || MAX_ARRAY }),
        rows: (max, cols) => ({ t: "rows", max: max || MAX_ARRAY, cols })
    };

    function checkField(spec, value) {
        if (spec.t === "num") {
            return typeof value === "number" && Number.isFinite(value)
                && (spec.min === undefined || value >= spec.min)
                && (spec.max === undefined || value <= spec.max)
                && (spec.gt === undefined || value > spec.gt);
        }
        if (spec.t === "str") return typeof value === "string" && value.length <= spec.max;
        if (spec.t === "enum") return spec.values.includes(value);
        if (spec.t === "nums") return Array.isArray(value) && value.length <= spec.max && value.every((v) => typeof v === "number" && Number.isFinite(v));
        if (spec.t === "rows") {
            return Array.isArray(value) && value.length <= spec.max
                && value.every((row) => Array.isArray(row) && row.length === spec.cols && row.every((v) => typeof v === "number" && Number.isFinite(v)));
        }
        return false;
    }

    function register(id, definition) {
        registry[id] = definition;
    }

    function ids() {
        return Object.keys(registry);
    }

    function has(id) {
        return Object.prototype.hasOwnProperty.call(registry, id);
    }

    // Returns a clean model, or null when `strict` and any supplied field is invalid.
    // Lenient mode (live pages) drops invalid fields so a half-typed form still renders.
    function normalize(id, raw, strict) {
        if (!has(id)) return null;
        if (raw === undefined || raw === null) return strict ? null : {};
        if (typeof raw !== "object" || Array.isArray(raw)) return null;
        const schema = registry[id].schema;
        const model = {};
        for (const key of Object.keys(raw)) {
            if (!Object.prototype.hasOwnProperty.call(schema, key)) {
                if (strict) return null;
                continue;
            }
            const value = raw[key];
            if (value === undefined || value === null) continue;
            if (checkField(schema[key], value)) {
                model[key] = Array.isArray(value) ? value.map((item) => (Array.isArray(item) ? item.slice() : item)) : value;
            } else if (strict) {
                return null;
            }
        }
        return model;
    }

    const helpers = {
        clamp(value, low, high) {
            return Math.min(high, Math.max(low, value));
        },
        has(value) {
            return typeof value === "number" && Number.isFinite(value);
        },
        // Formatted value with unit, or an explicit placeholder when the input is missing.
        quantity(value, unit, placeholder) {
            const diagram = root.FormulaFoundryDiagram;
            if (!helpers.has(value)) return placeholder || "—";
            return diagram.formatNumber(value) + (unit ? " " + unit : "");
        },
        // Proportional size with clamping; `flag.clamped` records when the ratio was altered.
        ratio(value, reference, low, high, fallback, flag) {
            if (!helpers.has(value) || !helpers.has(reference) || reference <= 0) return fallback;
            const raw = value / reference;
            const clamped = helpers.clamp(raw, low, high);
            if (flag && clamped !== raw) flag.clamped = true;
            return clamped;
        }
    };

    function render(document, id, raw) {
        if (!has(id)) throw new Error("No diagram is registered for " + id + ".");
        const model = normalize(id, raw, false);
        const svg = registry[id].build(document, model || {}, helpers);
        svg.setAttribute("data-diagram-id", id);
        return svg;
    }

    function mount(host, id, raw) {
        if (!host) return null;
        const svg = render(host.ownerDocument, id, raw);
        const model = normalize(id, raw, false) || {};
        host.replaceChildren(svg);
        host.setAttribute("data-ff-diagram", id);
        host._ffDiagram = { id, model };
        return svg;
    }

    // Serializable snapshot for reports; null if the mounted model is not valid in strict mode.
    function snapshot(host) {
        const state = host && host._ffDiagram;
        if (!state) return null;
        const model = normalize(state.id, state.model, true);
        return model ? { type: "calc-diagram", id: state.id, model } : null;
    }

    // Wires a calculator page to a diagram. `options.model()` reads the existing inputs (and any results the
    // page already computed); `options.watch` lists input ids whose changes redraw the figure; `options.ranges`
    // adds native range controls bound to existing inputs (see FormulaFoundryDiagram.bindFieldRanges).
    function attach(document, hostId, id, options) {
        const host = document.getElementById(hostId);
        if (!host || !has(id)) return { update() {} };
        const settings = options || {};
        let controls = null;
        const update = () => {
            let raw = {};
            try {
                raw = settings.model ? settings.model() : {};
            } catch (error) {
                raw = {};
            }
            mount(host, id, raw);
            if (controls) controls.sync();
        };
        if (settings.ranges && settings.ranges.length && root.FormulaFoundryDiagram) {
            const holder = document.createElement("div");
            host.insertAdjacentElement("afterend", holder);
            controls = root.FormulaFoundryDiagram.bindFieldRanges(document, holder, settings.ranges, settings.onCommit);
        }
        (settings.watch || []).forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            field.addEventListener("input", update);
            field.addEventListener("change", update);
        });
        update();
        return { update, host };
    }

    function caption(id) {
        return has(id) ? registry[id].caption : "";
    }

    function title(id) {
        return has(id) ? registry[id].title : "";
    }

    root.FormulaFoundryCalculatorDiagrams = { T, attach, caption, helpers, has, ids, mount, normalize, register, render, snapshot, title };
})(window);
