(function (root) {
    "use strict";

    const cases = {
        "ss-point": {
            name: "Simply supported, center point load",
            support: "Simply supported (pin and roller)",
            formula: String.raw`\delta_{\max}=\frac{PL^3}{48EI}`,
            moment: (load, span) => load * span / 4,
            locationFraction: 0.5,
            location: "Midspan (L/2)"
        },
        "ss-udl": {
            name: "Simply supported, full-span uniform load",
            support: "Simply supported (pin and roller)",
            formula: String.raw`\delta_{\max}=\frac{5wL^4}{384EI}`,
            moment: (load, span) => load * span ** 2 / 8,
            locationFraction: 0.5,
            location: "Midspan (L/2)"
        },
        "cant-point": {
            name: "Cantilever, point load at free end",
            support: "Cantilever (fixed root, free end)",
            formula: String.raw`\delta_{\max}=\frac{PL^3}{3EI}`,
            moment: (load, span) => load * span,
            locationFraction: 1,
            location: "Free end (L)"
        },
        "cant-udl": {
            name: "Cantilever, full-span uniform load",
            support: "Cantilever (fixed root, free end)",
            formula: String.raw`\delta_{\max}=\frac{wL^4}{8EI}`,
            moment: (load, span) => load * span ** 2 / 2,
            locationFraction: 1,
            location: "Free end (L)"
        }
    };

    function bendingEquation(axis) {
        return axis === "x"
            ? String.raw`\sigma_x=\frac{M_x c_x}{I_x},\quad S_x=\frac{I_x}{c_x}`
            : String.raw`\sigma_y=\frac{M_y c_y}{I_y},\quad S_y=\frac{I_y}{c_y}`;
    }

    function bendingEquations(sectionType, axis) {
        return root.BeamSectionProperties.equations(sectionType).concat([bendingEquation(axis)]);
    }

    function computeBendingStress({ sectionType, dimensions, momentNm, axis }) {
        if (!Number.isFinite(momentNm)) throw new Error("Bending moment must be finite.");
        if (axis !== "x" && axis !== "y") throw new Error("Select a supported bending axis.");
        const properties = root.BeamSectionProperties.calculate(sectionType, dimensions);
        const inertiaM4 = axis === "x" ? properties.inertiaX : properties.inertiaY;
        const cM = axis === "x" ? properties.extremeFiberX : properties.extremeFiberY;
        const stressPa = momentNm * cM / inertiaM4;
        if (!Number.isFinite(stressPa)) throw new Error("The resulting bending stress is outside the supported numerical range.");
        return { properties, inertiaM4, cM, stressPa };
    }

    function computeDeflection({ caseId, spanM, modulusPa, inertiaM4, loadSI }) {
        const caseDefinition = cases[caseId];
        if (!caseDefinition) throw new Error("Select one of the supported load/support cases.");
        if (![spanM, modulusPa, inertiaM4, loadSI].every(Number.isFinite)
            || spanM <= 0 || modulusPa <= 0 || inertiaM4 <= 0 || loadSI === 0) {
            throw new Error("Beam span, modulus, inertia, and non-zero load must be finite and physical.");
        }
        const flexuralRigidity = modulusPa * inertiaM4;
        if (!Number.isFinite(flexuralRigidity) || flexuralRigidity <= 0) {
            throw new Error("The flexural rigidity is outside the supported numerical range.");
        }
        let maxDeflectionM;
        if (caseId === "ss-point") maxDeflectionM = loadSI * spanM ** 3 / (48 * flexuralRigidity);
        else if (caseId === "ss-udl") maxDeflectionM = 5 * loadSI * spanM ** 4 / (384 * flexuralRigidity);
        else if (caseId === "cant-point") maxDeflectionM = loadSI * spanM ** 3 / (3 * flexuralRigidity);
        else maxDeflectionM = loadSI * spanM ** 4 / (8 * flexuralRigidity);
        const maxMomentNm = caseDefinition.moment(loadSI, spanM);
        if (!Number.isFinite(maxDeflectionM) || !Number.isFinite(maxMomentNm)) {
            throw new Error("The result is outside the supported numerical range.");
        }
        return {
            caseDefinition,
            flexuralRigidity,
            maxDeflectionM,
            maxMomentNm,
            locationM: spanM * caseDefinition.locationFraction
        };
    }

    root.FormulaFoundryBeamCalculations = { cases, bendingEquation, bendingEquations, computeBendingStress, computeDeflection };
})(window);
