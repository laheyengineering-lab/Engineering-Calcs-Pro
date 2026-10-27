const PRESS_FIT_EQUATIONS = [
    String.raw`p=\frac{\Delta r}{c\left(\frac{(b^2+c^2)/(b^2-c^2)+\nu_h}{E_h}+\frac{(c^2+a^2)/(c^2-a^2)-\nu_s}{E_s}\right)}`,
    String.raw`\sigma_{\theta,h}=p\frac{b^2+c^2}{b^2-c^2},\quad \sigma_{\theta,s}=-p\frac{c^2+a^2}{c^2-a^2}`,
    String.raw`F=\mu p\pi dL,\quad T=\frac{\mu p\pi d^2L}{2}`
];

function getPressFitMaterial(materialKey, label) {
    if (!materialKey || !getMaterial(materialKey)) {
        throw new Error(`Please select a valid ${label} material.`);
    }

    const youngsModulus = getMaterialProperty(materialKey, "youngsModulus");
    const poissonRatio = getMaterialProperty(materialKey, "poissonRatio");
    const yieldStrength = getMaterialProperty(materialKey, "yieldStrength");

    if (!Number.isFinite(youngsModulus) || youngsModulus <= 0) {
        throw new Error(`The ${label} material is missing a valid Young's modulus.`);
    }
    if (!Number.isFinite(poissonRatio) || poissonRatio <= 0 || poissonRatio >= 0.5) {
        throw new Error(`The ${label} material is missing a valid Poisson's ratio (expected 0 < ν < 0.5).`);
    }

    return {
        E: youngsModulus,
        nu: poissonRatio,
        Sy: Number.isFinite(yieldStrength) && yieldStrength > 0 ? yieldStrength : null
    };
}

function computePressFit({ d, deltaDiametral, D, di, L, mu, hub, shaft }) {
    const c = d / 2;
    const b = D / 2;
    const a = di / 2;
    const deltaR = deltaDiametral / 2;

    const hubFactor = (b * b + c * c) / (b * b - c * c);
    const shaftFactor = (c * c + a * a) / (c * c - a * a);

    const hubCompliance = (hubFactor + hub.nu) / hub.E;
    const shaftCompliance = (shaftFactor - shaft.nu) / shaft.E;
    const p = deltaR / (c * (hubCompliance + shaftCompliance));

    const hubHoop = p * hubFactor;
    const shaftHoop = -p * shaftFactor;

    const pressForce = mu * p * Math.PI * d * L;
    const torqueCapacity = mu * p * Math.PI * d * d * L / 2;

    const fosHub = hub.Sy ? hub.Sy / hubHoop : null;
    const fosShaft = shaft.Sy ? shaft.Sy / Math.abs(shaftHoop) : null;
    const fosValues = [fosHub, fosShaft].filter((value) => value !== null);
    const fosControlling = fosValues.length ? Math.min(...fosValues) : null;

    return { p, hubHoop, shaftHoop, pressForce, torqueCapacity, fosHub, fosShaft, fosControlling };
}
