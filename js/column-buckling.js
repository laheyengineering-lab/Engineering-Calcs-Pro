// ======================================================
// Column Buckling Calculator (Euler)
// ======================================================

const bucklingSectionTypeSelect = document.getElementById("sectionType");
const bucklingMaterialSelect = document.getElementById("material");
const bucklingLengthInput = document.getElementById("length");
const bucklingLengthUnitSelect = document.getElementById("lengthUnit");
const bucklingOuterDiameterInput = document.getElementById("outerDiameter");
const bucklingOuterDiameterUnitSelect = document.getElementById("outerDiameterUnit");
const bucklingInnerDiameterInput = document.getElementById("innerDiameter");
const bucklingInnerDiameterUnitSelect = document.getElementById("innerDiameterUnit");
const bucklingBoundaryConditionSelect = document.getElementById("boundaryCondition");
const bucklingForceUnitSelect = document.getElementById("forceUnit");
const bucklingInertiaUnitSelect = document.getElementById("inertiaUnit");
const bucklingModulusUnitSelect = document.getElementById("modulusUnit");
const bucklingResultPanel = document.getElementById("result");

const boundaryConditionFactors = {
    "fixed-free": 2.0,
    "pinned-pinned": 1.0,
    "fixed-pinned": 0.699,
    "fixed-fixed": 0.5
};

function updateColumnBucklingMode() {
    const isHollow = bucklingSectionTypeSelect.value === "hollow";
    document.getElementById("innerDiameterContainer").style.display = isHollow ? "block" : "none";
    bucklingResultPanel.innerHTML = "Ready to calculate.";
}

function populateBucklingMaterials() {
    const materials = getMaterialListFormatted();
    bucklingMaterialSelect.innerHTML = '<option value="">-- Select Material --</option>';

    materials.forEach((material) => {
        const option = document.createElement("option");
        option.value = material.key;
        option.textContent = material.displayName;
        bucklingMaterialSelect.appendChild(option);
    });
}

function calculateColumnBuckling() {
    const sectionType = bucklingSectionTypeSelect.value;
    const material = bucklingMaterialSelect.value;
    const boundaryCondition = bucklingBoundaryConditionSelect.value;

    const length = Number(bucklingLengthInput.value);
    const outerDiameter = Number(bucklingOuterDiameterInput.value);

    if (!material) {
        bucklingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please select a material.</p>";
        return;
    }

    if (!(boundaryCondition in boundaryConditionFactors)) {
        bucklingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please select a valid boundary condition.</p>";
        return;
    }

    if (!Number.isFinite(length) || !Number.isFinite(outerDiameter) || length <= 0 || outerDiameter <= 0) {
        bucklingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter positive length and outer diameter values.</p>";
        return;
    }

    const youngsModulusPa = getMaterialProperty(material, "youngsModulus");
    if (!Number.isFinite(youngsModulusPa) || youngsModulusPa <= 0) {
        bucklingResultPanel.innerHTML = "<h3>Invalid Material Data</h3><p>Young's modulus is unavailable for the selected material.</p>";
        return;
    }

    try {
        const lengthM = convertDistance(length, bucklingLengthUnitSelect.value);
        const outerDiameterM = convertDistance(outerDiameter, bucklingOuterDiameterUnitSelect.value);

        let inertiaM4;
        let innerDiameterM = null;

        if (sectionType === "solid") {
            inertiaM4 = (Math.PI * Math.pow(outerDiameterM, 4)) / 64;
        } else {
            const innerDiameter = Number(bucklingInnerDiameterInput.value);
            if (!Number.isFinite(innerDiameter) || innerDiameter <= 0) {
                bucklingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Please enter a positive inner diameter for hollow sections.</p>";
                return;
            }

            innerDiameterM = convertDistance(innerDiameter, bucklingInnerDiameterUnitSelect.value);
            if (innerDiameterM >= outerDiameterM) {
                bucklingResultPanel.innerHTML = "<h3>Invalid Input</h3><p>Inner diameter must be less than outer diameter.</p>";
                return;
            }

            inertiaM4 = (Math.PI * (Math.pow(outerDiameterM, 4) - Math.pow(innerDiameterM, 4))) / 64;
        }

        const kFactor = boundaryConditionFactors[boundaryCondition];
        const effectiveLengthM = kFactor * lengthM;
        const criticalLoadN = (Math.PI * Math.PI * youngsModulusPa * inertiaM4) / Math.pow(effectiveLengthM, 2);

        const forceUnit = bucklingForceUnitSelect.value;
        const inertiaUnit = bucklingInertiaUnitSelect.value;
        const modulusUnit = bucklingModulusUnitSelect.value;

        const criticalLoadOutput = convertForceToUnit(criticalLoadN, forceUnit);
        const inertiaOutput = convertAreaMomentInertiaToUnit(inertiaM4, inertiaUnit);
        const effectiveLengthOutput = convertDistanceToUnit(effectiveLengthM, bucklingLengthUnitSelect.value);
        const youngsModulusOutput = convertModulusToUnit(youngsModulusPa, modulusUnit);

        const materialData = getMaterial(material);

        bucklingResultPanel.innerHTML = `
            <h3>Result</h3>
            <div class="result-value">P<sub>cr</sub> = ${criticalLoadOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${forceUnit}</div>
            <hr>
            <p><strong>Section Inertia:</strong> I = ${inertiaOutput.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${inertiaUnit}</p>
            <p><strong>Effective Length:</strong> KL = ${effectiveLengthOutput.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${bucklingLengthUnitSelect.value}</p>
            <p><strong>Effective Length Factor:</strong> K = ${kFactor}</p>
            <p><strong>Selected Material:</strong> ${materialData ? materialData.displayName : material}</p>
            <p><strong>Young's Modulus:</strong> ${youngsModulusOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${modulusUnit}</p>
            <hr>
            <p><strong>Calculation Summary</strong></p>
            <p>P<sub>cr</sub> = π²EI / (KL)²</p>
            <p>P<sub>cr</sub> = π² × ${youngsModulusPa.toLocaleString(undefined, { maximumFractionDigits: 2 })} Pa × ${inertiaM4.toExponential(6)} m⁴ / (${kFactor} × ${lengthM.toLocaleString(undefined, { maximumFractionDigits: 6 })} m)²</p>
            <p>= <strong>${criticalLoadOutput.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${forceUnit}</strong></p>
        `;
    } catch (error) {
        bucklingResultPanel.innerHTML = `<h3>Calculation Error</h3><p>${error.message}</p>`;
    }
}

function resetColumnBucklingCalculator() {
    bucklingSectionTypeSelect.value = "solid";
    bucklingMaterialSelect.value = "";
    bucklingLengthInput.value = "";
    bucklingOuterDiameterInput.value = "";
    bucklingInnerDiameterInput.value = "";
    bucklingBoundaryConditionSelect.value = "pinned-pinned";

    bucklingLengthUnitSelect.value = "m";
    bucklingOuterDiameterUnitSelect.value = "m";
    bucklingInnerDiameterUnitSelect.value = "m";
    bucklingForceUnitSelect.value = "kN";
    bucklingInertiaUnitSelect.value = "m⁴";
    bucklingModulusUnitSelect.value = "GPa";

    updateColumnBucklingMode();
    bucklingResultPanel.innerHTML = "Ready to calculate.";
}

document.addEventListener("DOMContentLoaded", function() {
    populateBucklingMaterials();
    updateColumnBucklingMode();
});
