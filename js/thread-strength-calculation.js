// DOM-independent preliminary thread strength engine (SI: m, m², N, Pa), shared by the
// calculator page and Design Studies.
const THREAD_INTERNAL_DEPTH_FACTOR = 0.5413;
const THREAD_VON_MISES_SHEAR_FACTOR = 0.577;

const THREAD_STRENGTH_EQUATIONS = [
    String.raw`F_{\mathrm{fastener}} = A_t S_{u},\quad \sigma_{\mathrm{applied}} = \frac{F}{A_t}`,
    String.raw`A_{s,\mathrm{int}} = 0.5413\,\pi D L_e,\quad F_{\mathrm{strip}} = 0.577\,S_{\mathrm{int}}\,A_{s,\mathrm{int}}`,
    String.raw`U = \frac{F}{F_{\mathrm{capacity}}}`
];

// internalStrengthPa = null skips the internal-thread stripping check.
function computeThreadStrength({ diameterM, pitchM, engagementM, stressAreaM2, forceN, boltStrengthPa, internalStrengthPa = null }) {
    if (![diameterM, pitchM, engagementM, stressAreaM2, boltStrengthPa].every(Number.isFinite) ||
        diameterM <= 0 || pitchM <= 0 || engagementM <= 0 || stressAreaM2 <= 0 || boltStrengthPa <= 0) {
        throw new Error("Major diameter, pitch, engagement length, tensile stress area, and fastener strength must be finite values greater than zero.");
    }
    if (!Number.isFinite(forceN) || forceN < 0) {
        throw new Error("Applied tensile load must be a finite value greater than or equal to zero.");
    }
    if (internalStrengthPa !== null && (!Number.isFinite(internalStrengthPa) || internalStrengthPa <= 0)) {
        throw new Error("Internal-thread strength must be blank or a finite value greater than zero.");
    }
    if (pitchM >= diameterM) throw new Error("Thread pitch must be less than the nominal major diameter.");

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
        throw new Error("The calculation produced a non-finite or non-positive capacity. Check the inputs and units.");
    }

    const boltUtilization = forceN / boltCapacityN;
    const internalUtilization = internalCapacityN === null ? null : forceN / internalCapacityN;
    if (!Number.isFinite(boltUtilization) ||
        (internalUtilization !== null && !Number.isFinite(internalUtilization))) {
        throw new Error("The utilization calculation is non-finite. Check the load, stress area, and strengths.");
    }
    const governingMode = internalCapacityN === null
        ? "Fastener tensile (internal-thread stripping not assessed)"
        : boltCapacityN <= internalCapacityN ? "Fastener tensile" : "Internal-thread stripping";
    const engagementRatio = engagementM / diameterM;
    return {
        boltCapacityN, appliedStressPa, internalShearAreaM2, internalCapacityN,
        boltUtilization, internalUtilization, governingMode,
        governingCapacityN: internalCapacityN === null ? boltCapacityN : Math.min(boltCapacityN, internalCapacityN),
        engagementRatio,
        engagementOutsideTypicalRange: engagementRatio < 1 || engagementRatio > 2
    };
}
