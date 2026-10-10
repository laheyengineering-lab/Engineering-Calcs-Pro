const THREAD_INTERNAL_DEPTH_FACTOR = 0.5413;
const THREAD_VON_MISES_SHEAR_FACTOR = 0.577;

function threadElement(id) {
    return document.getElementById(id);
}

function threadNumber(id) {
    const value = String(threadElement(id).value).trim();
    return value === "" ? NaN : Number(value);
}

function threadFormat(value, digits = 3) {
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function updateThreadMaterial(selectId, strengthId) {
    const material = threadElement(selectId).value;
    if (!material) return;

    const strengthPa = getMaterialProperty(material, "tensileStrength");
    if (Number.isFinite(strengthPa) && strengthPa > 0) {
        threadElement(strengthId).value = String(convertStressToUnit(strengthPa, threadElement("strengthUnit").value));
    }
}

function threadError(message) {
    threadElement("result").innerHTML = `<h3>Invalid Input</h3><p>${escapeHtml(message)}</p>`;
}

function calculateThreadStrength() {
    const diameter = threadNumber("majorDiameter");
    const pitchInput = threadNumber("threadPitch");
    const engagement = threadNumber("engagementLength");
    const stressArea = threadNumber("tensileStressArea");
    const force = threadNumber("appliedLoad");
    const boltStrength = threadNumber("boltStrength");
    const internalStrengthRaw = String(threadElement("internalStrength").value).trim();
    const internalStrength = internalStrengthRaw === "" ? null : Number(internalStrengthRaw);
    const distanceUnit = threadElement("distanceUnit").value;
    const pitchUnit = threadElement("pitchUnit").value;
    const areaUnit = threadElement("areaUnit").value;
    const forceUnit = threadElement("forceUnit").value;
    const strengthUnit = threadElement("strengthUnit").value;

    if (![diameter, pitchInput, engagement, stressArea, boltStrength].every(Number.isFinite) ||
        diameter <= 0 || pitchInput <= 0 || engagement <= 0 || stressArea <= 0 || boltStrength <= 0) {
        threadError("Major diameter, pitch, engagement length, tensile stress area, and fastener strength must be finite values greater than zero.");
        return;
    }
    if (!Number.isFinite(force) || force < 0) {
        threadError("Applied tensile load must be a finite value greater than or equal to zero.");
        return;
    }
    if (internalStrength !== null && (!Number.isFinite(internalStrength) || internalStrength <= 0)) {
        threadError("Internal-thread strength must be blank or a finite value greater than zero.");
        return;
    }

    const diameterM = convertDistance(diameter, distanceUnit);
    const engagementM = convertDistance(engagement, distanceUnit);
    const pitchM = pitchUnit === "TPI" ? 0.0254 / pitchInput : convertDistance(pitchInput, pitchUnit);
    const stressAreaM2 = convertArea(stressArea, areaUnit);
    const forceN = convertForce(force, forceUnit);
    const boltStrengthPa = convertStress(boltStrength, strengthUnit);
    const internalStrengthPa = internalStrength === null ? null : convertStress(internalStrength, strengthUnit);

    if (![diameterM, engagementM, pitchM, stressAreaM2, forceN, boltStrengthPa].every(Number.isFinite) ||
        (internalStrengthPa !== null && !Number.isFinite(internalStrengthPa))) {
        threadError("Check the selected units; the inputs could not be converted to finite values.");
        return;
    }
    if (pitchM >= diameterM) {
        threadError("Thread pitch must be less than the nominal major diameter.");
        return;
    }

    const boltCapacityN = stressAreaM2 * boltStrengthPa;
    const appliedStressPa = forceN / stressAreaM2;
    const internalShearAreaM2 = internalStrengthPa === null
        ? null
        : Math.PI * diameterM * engagementM * THREAD_INTERNAL_DEPTH_FACTOR;
    const internalCapacityN = internalStrengthPa === null
        ? null
        : internalShearAreaM2 * THREAD_VON_MISES_SHEAR_FACTOR * internalStrengthPa;
    const calculatedValues = [boltCapacityN, appliedStressPa, internalShearAreaM2, internalCapacityN]
        .filter((value) => value !== null);

    if (!calculatedValues.every(Number.isFinite) || boltCapacityN <= 0 ||
        (internalCapacityN !== null && internalCapacityN <= 0)) {
        threadError("The calculation produced a non-finite or non-positive capacity. Check the inputs and units.");
        return;
    }

    const boltUtilization = forceN / boltCapacityN;
    const internalUtilization = internalCapacityN === null ? null : forceN / internalCapacityN;
    if (!Number.isFinite(boltUtilization) ||
        (internalUtilization !== null && !Number.isFinite(internalUtilization))) {
        threadError("The utilization calculation is non-finite. Check the load, stress area, and strengths.");
        return;
    }
    const governingMode = internalCapacityN === null
        ? "Fastener tensile (internal-thread stripping not assessed)"
        : boltCapacityN <= internalCapacityN ? "Fastener tensile" : "Internal-thread stripping";
    const warnings = [];
    const engagementRatio = engagementM / diameterM;
    if (engagementRatio < 1 || engagementRatio > 2) {
        warnings.push("Engagement length is outside the common preliminary range of 1–2 nominal diameters; review thread engagement and joint-specific requirements.");
    }

    const capacity = (value) => threadFormat(convertForceToUnit(value, forceUnit));
    const areaOutput = convertAreaToUnit(stressAreaM2, areaUnit);
    const stressOutput = convertStressToUnit(appliedStressPa, strengthUnit);
    const internalDetails = internalCapacityN === null
        ? `<p><strong>Internal-Thread Stripping Capacity:</strong> Not assessed; provide internal-thread material strength.</p>`
        : `
            <p><strong>Approximate Internal-Thread Shear Area:</strong> ${threadFormat(convertAreaToUnit(internalShearAreaM2, areaUnit), 3)} ${escapeHtml(areaUnit)}</p>
            <p><strong>Internal-Thread Stripping Capacity:</strong> ${capacity(internalCapacityN)} ${escapeHtml(forceUnit)}</p>
            <p><strong>Internal-Thread Utilization:</strong> ${threadFormat(internalUtilization * 100, 2)}%</p>
        `;

    threadElement("result").innerHTML = `
        <h3>Result</h3>
        <div class="result-value">Governing Mode: ${escapeHtml(governingMode)}</div>
        <p><strong>Fastener Tensile Capacity:</strong> ${capacity(boltCapacityN)} ${escapeHtml(forceUnit)}</p>
        <p><strong>Applied Fastener Stress:</strong> ${threadFormat(stressOutput, 2)} ${escapeHtml(strengthUnit)}</p>
        <p><strong>Fastener Utilization:</strong> ${threadFormat(boltUtilization * 100, 2)}%</p>
        <p><strong>Entered Tensile Stress Area:</strong> ${threadFormat(areaOutput, 3)} ${escapeHtml(areaUnit)}</p>
        ${internalDetails}
        <p><strong>Applied Tensile Load:</strong> ${capacity(forceN)} ${escapeHtml(forceUnit)}</p>
        ${warnings.map((warning) => `<p class="warning"><strong>Engagement warning:</strong> ${escapeHtml(warning)}</p>`).join("")}
        <hr>
        <p><em>Preliminary nominal-capacity comparison only. No design factor is applied. Thread geometry, tolerances, incomplete threads, preload, fatigue, bending, joint separation, and load distribution are not fully modeled.</em></p>
    `;
}

function resetThreadStrengthCalculator() {
    ["majorDiameter", "threadPitch", "engagementLength", "tensileStressArea", "appliedLoad", "boltStrength", "internalStrength"]
        .forEach((id) => { threadElement(id).value = ""; });
    threadElement("boltMaterial").value = "";
    threadElement("internalMaterial").value = "";
    threadElement("distanceUnit").value = "mm";
    threadElement("pitchUnit").value = "mm";
    threadElement("areaUnit").value = "mm²";
    threadElement("forceUnit").value = "N";
    threadElement("strengthUnit").value = "MPa";
    threadElement("result").textContent = "Ready to calculate.";
}

document.addEventListener("DOMContentLoaded", () => {
    populateMaterialSelect(threadElement("boltMaterial"), { placeholderText: "-- Manual / select material --" });
    populateMaterialSelect(threadElement("internalMaterial"), { placeholderText: "-- Not provided / select material --" });
    threadElement("boltMaterial").value = "";
    threadElement("internalMaterial").value = "";
    const strengthUnit = threadElement("strengthUnit");
    let previousUnit = strengthUnit.value;
    strengthUnit.addEventListener("change", () => {
        ["boltStrength", "internalStrength"].forEach((id) => {
            const value = threadNumber(id);
            if (Number.isFinite(value) && value > 0) {
                threadElement(id).value = String(convertStressToUnit(convertStress(value, previousUnit), strengthUnit.value));
            }
        });
        previousUnit = strengthUnit.value;
    });
});
