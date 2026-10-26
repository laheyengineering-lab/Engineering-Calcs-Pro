(function (root) {
    "use strict";

    const profiles = {
        rectangular: {
            name: "Solid rectangle / square",
            group: "rectSectionInputs",
            fields: [
                { key: "width", id: "rectWidth", unit: "rectWidthUnit", label: "Width (b)" },
                { key: "height", id: "rectHeight", unit: "rectHeightUnit", label: "Height (h)" }
            ]
        },
        "solid-circular": {
            name: "Solid circle",
            group: "solidCircularInputs",
            fields: [{ key: "diameter", id: "diameter", unit: "diameterUnit", label: "Diameter (d)" }]
        },
        "hollow-circular": {
            name: "Hollow circle / tube",
            group: "hollowCircularInputs",
            fields: [
                { key: "outerDiameter", id: "outerDiameter", unit: "outerDiameterUnit", label: "Outer diameter (D)" },
                { key: "innerDiameter", id: "innerDiameter", unit: "innerDiameterUnit", label: "Inner diameter (d)" }
            ]
        },
        "hollow-rectangular": {
            name: "Hollow rectangle / tube",
            group: "hollowRectInputs",
            fields: [
                { key: "outerWidth", id: "outerWidth", unit: "outerWidthUnit", label: "Outer width (B)" },
                { key: "outerHeight", id: "outerHeight", unit: "outerHeightUnit", label: "Outer height (H)" },
                { key: "wallThickness", id: "wallThickness", unit: "wallThicknessUnit", label: "Wall thickness (t)" }
            ]
        },
        "i-beam": {
            name: "Symmetric I-beam",
            group: "compositeSectionInputs",
            fields: [
                { key: "height", id: "overallHeight", unit: "overallHeightUnit", label: "Overall height (H)" },
                { key: "flangeWidth", id: "flangeWidth", unit: "flangeWidthUnit", label: "Flange width (B)" },
                { key: "flangeThickness", id: "flangeThickness", unit: "flangeThicknessUnit", label: "Flange thickness (t_f)" },
                { key: "webThickness", id: "webThickness", unit: "webThicknessUnit", label: "Web thickness (t_w)" }
            ]
        },
        "t-section": {
            name: "T-section",
            group: "compositeSectionInputs",
            fields: [
                { key: "height", id: "overallHeight", unit: "overallHeightUnit", label: "Overall height (H)" },
                { key: "flangeWidth", id: "flangeWidth", unit: "flangeWidthUnit", label: "Flange width (B)" },
                { key: "flangeThickness", id: "flangeThickness", unit: "flangeThicknessUnit", label: "Flange thickness (t_f)" },
                { key: "webThickness", id: "webThickness", unit: "webThicknessUnit", label: "Web thickness (t_w)" }
            ]
        }
    };

    const defaults = {
        rectangular: { width: 0.06, height: 0.09 },
        "solid-circular": { diameter: 0.08 },
        "hollow-circular": { outerDiameter: 0.1, innerDiameter: 0.06 },
        "hollow-rectangular": { outerWidth: 0.1, outerHeight: 0.075, wallThickness: 0.01 },
        "i-beam": { height: 0.12, flangeWidth: 0.09, flangeThickness: 0.016, webThickness: 0.012 },
        "t-section": { height: 0.12, flangeWidth: 0.09, flangeThickness: 0.016, webThickness: 0.012 }
    };

    function updateDiagram(document, profile, axis) {
        const definition = profiles[profile];
        const figure = document.getElementById("profileDiagram");
        const caption = document.getElementById("profileDiagramCaption");
        const complete = definition.fields.every((field) => document.getElementById(field.id).value.trim() !== "");
        let dimensions = { ...defaults[profile] };
        const dimensionLabels = [];

        if (complete) {
            dimensions = {};
            definition.fields.forEach((field) => {
                const input = document.getElementById(field.id);
                const unit = document.getElementById(field.unit).value;
                const raw = Number(input.value);
                dimensions[field.key] = convertDistance(raw, unit);
                dimensionLabels.push(`${field.label} = ${input.value} ${unit}`);
            });
            try {
                root.BeamSectionProperties.calculate(profile, dimensions);
            } catch (error) {
                figure.textContent = "";
                caption.textContent = "Invalid geometry — check the entered dimensions.";
                return;
            }
        }

        try {
            figure.replaceChildren(root.BeamSectionProperties.createDiagram(document, profile, dimensions, axis));
            caption.textContent = complete
                ? `${definition.name} · ${dimensionLabels.join(" · ")}`
                : `${definition.name} schematic · enter all dimensions for a proportional preview.`;
        } catch (error) {
            figure.textContent = "";
            caption.textContent = "Unable to render a valid section diagram — check the entered dimensions.";
        }
    }

    function update(document, profile, axis) {
        ["rectSectionInputs", "solidCircularInputs", "hollowCircularInputs", "hollowRectInputs"]
            .forEach((id) => { document.getElementById(id).hidden = true; });
        document.getElementById("compositeSectionInputs").hidden = !["i-beam", "t-section"].includes(profile);
        if (profiles[profile].group !== "compositeSectionInputs") {
            document.getElementById(profiles[profile].group).hidden = false;
        }
        updateDiagram(document, profile, axis);
    }

    root.BeamSectionUI = {
        profiles,
        getFields(profile) { return profiles[profile].fields; },
        getName(profile) { return profiles[profile].name; },
        update,
        updateDiagram
    };
})(window);
