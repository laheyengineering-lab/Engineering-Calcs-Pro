(function (root) {
    "use strict";

    const cases = {
        "ss-point": { fixed: false, point: true, name: "Simply supported beam with center point load" },
        "ss-udl": { fixed: false, point: false, name: "Simply supported beam with full-span uniform load" },
        "cant-point": { fixed: true, point: true, name: "Cantilever with free-end point load" },
        "cant-udl": { fixed: true, point: false, name: "Cantilever with full-span uniform load" }
    };

    function render(document, state) {
        const definition = cases[state.caseId];
        const diagram = root.FormulaFoundryDiagram;
        const label = definition
            ? definition.name + "; " + (definition.fixed ? "fixed-free support" : "pin and roller supports")
            : "Unsupported beam model";
        const S = diagram.scene(document, {
            size: [600, 383],
            label,
            description: "The upper sketch shows the applied load and support reactions. The lower sketch illustrates the deflected shape."
        });
        const centered = { cls: "ff-label ff-label-small", anchor: "middle" };
        if (!definition) {
            S.text(300, 174, "Select a supported beam loading and support case", centered);
            return S.svg;
        }

        const left = 107, right = 513, middle = (left + right) / 2, y = 110;
        const span = Number.isFinite(state.span) && state.span > 0 ? state.span : null;
        const load = Number.isFinite(state.load) ? state.load : null;
        const sign = Math.sign(load || 0);
        S.text(300, 26, definition.name, { cls: "ff-label ff-label-strong", anchor: "middle" });
        S.rect(left, y - 5, right - left, 10, "ff-body");
        if (definition.fixed) {
            S.fixedSupport(left, y - 25, y + 28, "left");
            S.text(left, y + 58, "Fixed", centered);
            S.text(right, y + 58, "Free", centered);
        } else {
            S.pinSupport(left, y + 5, 13);
            S.rollerSupport(right, y + 5, 13);
            S.text(left, y + 58, "Pin", centered);
            S.text(right, y + 58, "Roller", centered);
        }
        const applied = (x) => {
            const far = definition.point ? 52 : 66;
            S.arrow(x, sign > 0 ? far : y - 8, x, sign > 0 ? y - 8 : far, { kind: "force" });
        };
        if (sign) {
            if (definition.point) {
                applied(definition.fixed ? right : middle);
            } else {
                S.line(left, 63, right, 63, "ff-accent-line");
                for (let i = 0; i <= 8; i += 1) applied(left + i * (right - left) / 8);
            }
            const reaction = (x, name) => {
                const top = 105, bottom = 151;
                S.arrow(x, sign > 0 ? bottom : top, x, sign > 0 ? top : bottom, {
                    kind: "reaction", label: name, labelX: x < left ? x - 9 : x + 11, labelY: 150, anchor: x < left ? "end" : "start"
                });
            };
            reaction(left - 36, "R_A");
            if (definition.fixed) {
                S.momentArrow(left - 55, 88, 19, sign > 0 ? 109 : 252, sign > 0 ? 252 : 109,
                    { label: "M_A", labelX: left - 67, labelY: 57 });
            } else {
                reaction(right + 29, "R_B");
            }
        }

        const symbol = definition.point ? "P" : "w";
        const loadText = load === null ? "Enter " + symbol : (state.loadLabel && state.loadLabel !== symbol
            ? state.loadLabel : symbol + " = " + diagram.formatNumber(load) + (state.loadUnit ? " " + state.loadUnit : ""));
        S.text(300, 147, loadText, { cls: "ff-label ff-label-force", anchor: "middle" });
        const spanText = span === null ? "enter span" : diagram.formatNumber(span) + (state.lengthUnit ? " " + state.lengthUnit : "");
        S.dimension(left, y + 63, right, y + 63, "L = " + spanText, { offset: 21 });

        const reference = 281, deflected = reference + sign * 35;
        S.text(24, 240, "Deflected shape · exaggerated", { cls: "ff-label ff-label-strong" });
        S.centerline(left - 9, reference, right + 9, reference);
        if (sign) {
            const curve = definition.fixed
                ? `M ${left} ${reference} C ${left + 110} ${reference} ${right - 122} ${reference + sign * (definition.point ? 19 : 23)} ${right} ${deflected}`
                : `M ${left} ${reference} C ${left + 68} ${reference + sign * (definition.point ? 20 : 22)} ${middle - 66} ${deflected} ${middle} ${deflected}
                    C ${middle + 66} ${deflected} ${right - 68} ${reference + sign * (definition.point ? 20 : 22)} ${right} ${reference}`;
            S.path(curve, "ff-mode-shape ff-mode-selected");
            const peak = definition.fixed ? right : middle;
            S.dimension(peak, Math.min(reference, deflected), peak, Math.max(reference, deflected), "|δ_{max}|", { offset: -20 });
        }
        S.text(300, 363, Number.isFinite(state.maxDeflection)
            ? "Calculated |δ_{max}| = " + diagram.formatNumber(state.maxDeflection) + (state.deflectionUnit ? " " + state.deflectionUnit : "")
            : "Calculate to show the actual maximum deflection", centered);
        return S.svg;
    }

    root.FormulaFoundryBeamDeflectionDiagram = { render };
})(window);
