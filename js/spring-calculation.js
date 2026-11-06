// DOM-independent round-wire helical compression spring engine (SI: m, N, Pa),
// shared by the calculator page and Design Studies.
const SPRING_EQUATIONS = [
    String.raw`C=\frac{D}{d},\quad k=\frac{G d^4}{8 D^3 N_a},\quad \delta=\frac{F}{k}`,
    String.raw`K_W=\frac{4C-1}{4C-4}+\frac{0.615}{C},\quad \tau_{\max}=K_W\frac{8FD}{\pi d^3}`
];

function computeSpring({ wireDiameterM, meanDiameterM, activeCoils, forceN, shearModulusPa }) {
    const d = wireDiameterM;
    const D = meanDiameterM;
    if (![d, D, activeCoils, shearModulusPa].every(Number.isFinite) ||
        d <= 0 || D <= 0 || activeCoils <= 0 || shearModulusPa <= 0) {
        throw new Error("Wire diameter, mean coil diameter, active coils, and shear modulus must be finite values greater than zero.");
    }
    if (!Number.isFinite(forceN) || forceN < 0) {
        throw new Error("Applied axial force must be a finite value greater than or equal to zero.");
    }
    if (D <= d) {
        throw new Error("Check the selected units and geometry; mean coil diameter must be greater than wire diameter.");
    }

    const index = D / d;
    if (!Number.isFinite(index) || index <= 1) throw new Error("Spring geometry produces an invalid spring index.");

    const rateNPerM = shearModulusPa * Math.pow(d, 4) / (8 * Math.pow(D, 3) * activeCoils);
    const deflectionM = forceN / rateNPerM;
    const wahlFactor = (4 * index - 1) / (4 * index - 4) + 0.615 / index;
    const shearStressPa = wahlFactor * 8 * forceN * D / (Math.PI * Math.pow(d, 3));

    if (![rateNPerM, deflectionM, wahlFactor, shearStressPa].every(Number.isFinite) ||
        rateNPerM <= 0 || deflectionM < 0 || shearStressPa < 0) {
        throw new Error("The calculation produced a non-finite result. Check the inputs and units.");
    }
    return {
        index, rateNPerM, deflectionM, wahlFactor, shearStressPa,
        indexOutsideTypicalRange: index < 4 || index > 16
    };
}
