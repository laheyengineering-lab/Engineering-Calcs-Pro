// DOM-independent moment engine (SI: N, m, N·m), shared by the calculator page and Design Studies.
const MOMENT_EQUATIONS = [
    String.raw`M = F\,d`
];

// The moment keeps the sign of the entered force; the distance is a positive perpendicular distance.
function computeMoment({ forceN, distanceM }) {
    if (!Number.isFinite(forceN) || forceN === 0 || !Number.isFinite(distanceM) || distanceM <= 0) {
        throw new Error("Please enter both a force and a distance.");
    }
    const momentNm = forceN * distanceM;
    if (!Number.isFinite(momentNm)) throw new Error("The result is outside the supported numerical range.");
    return { momentNm };
}
