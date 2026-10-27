(function (root) {
    "use strict";

    const SVG_NS = "http://www.w3.org/2000/svg";

    function createSvg(document, viewBox, label, title, role = "group") {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", viewBox);
        svg.setAttribute("role", role);
        svg.setAttribute("aria-label", label);
        add(document, svg, "title", {}, title || label);
        return svg;
    }

    function add(document, parent, tag, attributes, text) {
        const element = document.createElementNS(SVG_NS, tag);
        Object.entries(attributes || {}).forEach(([name, value]) => {
            if (typeof value === "number" && !Number.isFinite(value)) {
                throw new Error("SVG coordinates and dimensions must be finite.");
            }
            element.setAttribute(name, String(value));
        });
        if (text !== undefined) element.textContent = String(text);
        parent.appendChild(element);
        return element;
    }

    function rangeAround(value, lowerFactor, upperFactor) {
        if (!Number.isFinite(value) || value <= 0
            || !Number.isFinite(lowerFactor) || lowerFactor <= 0
            || !Number.isFinite(upperFactor) || upperFactor <= lowerFactor) return null;
        const min = Math.max(Number.MIN_VALUE, value * lowerFactor);
        const max = Math.min(Number.MAX_VALUE, Math.max(Number.MIN_VALUE, value * upperFactor));
        return min < max ? { min, max } : null;
    }

    function viewBoxPoint(svg, event) {
        const values = String(svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
        if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
            throw new Error("The diagram viewBox is invalid.");
        }
        const [minX, minY, width, height] = values;
        const bounds = svg.getBoundingClientRect();
        const renderedWidth = Number(bounds.width) || width;
        const renderedHeight = Number(bounds.height) || height;
        return {
            x: minX + ((event.clientX - (Number(bounds.left) || 0)) / renderedWidth) * width,
            y: minY + ((event.clientY - (Number(bounds.top) || 0)) / renderedHeight) * height
        };
    }

    function bindSliderControl(handle, svg, options) {
        const { min, max, value, start, end, onChange, formatValue } = options;
        if (![min, max, value, start, end].every(Number.isFinite) || min >= max || start >= end) {
            throw new Error("The diagram control range is invalid.");
        }
        handle.setAttribute("role", "slider");
        handle.setAttribute("tabindex", "0");
        handle.setAttribute("aria-valuemin", String(min));
        handle.setAttribute("aria-valuemax", String(max));
        handle.setAttribute("aria-valuenow", String(value));
        const valueText = (number) => typeof formatValue === "function" ? formatValue(number) : String(number);
        handle.setAttribute("aria-valuetext", valueText(value));

        const valueAt = (x) => min + Math.max(0, Math.min(1, (x - start) / (end - start))) * (max - min);
        const report = (nextValue, event) => {
            const clamped = Math.max(min, Math.min(max, nextValue));
            handle.setAttribute("aria-valuenow", String(clamped));
            handle.setAttribute("aria-valuetext", valueText(clamped));
            if (typeof onChange === "function") onChange(clamped, event);
        };
        let active = false;
        const onPointerDown = (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            active = true;
            handle.focus();
            if (handle.setPointerCapture && event.pointerId !== undefined) handle.setPointerCapture(event.pointerId);
            if (event.preventDefault) event.preventDefault();
        };
        const onPointerUp = (event) => {
            if (!active) return;
            active = false;
            report(valueAt(viewBoxPoint(svg, event).x), event);
        };
        const onPointerCancel = () => { active = false; };
        const onKeyDown = (event) => {
            const step = (max - min) / 100;
            let nextValue;
            if (event.key === "ArrowRight" || event.key === "ArrowUp") nextValue = Number(handle.getAttribute("aria-valuenow")) + step;
            else if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextValue = Number(handle.getAttribute("aria-valuenow")) - step;
            else if (event.key === "Home") nextValue = min;
            else if (event.key === "End") nextValue = max;
            else return;
            event.preventDefault();
            report(nextValue, event);
        };
        handle.addEventListener("pointerdown", onPointerDown);
        svg.addEventListener("pointerup", onPointerUp);
        svg.addEventListener("pointercancel", onPointerCancel);
        handle.addEventListener("keydown", onKeyDown);

        return () => {
            handle.removeEventListener("pointerdown", onPointerDown);
            svg.removeEventListener("pointerup", onPointerUp);
            svg.removeEventListener("pointercancel", onPointerCancel);
            handle.removeEventListener("keydown", onKeyDown);
        };
    }

    root.FormulaFoundryDiagram = { add, bindSliderControl, createSvg, rangeAround };
})(window);
