// DOM-independent basic rating-life engine, shared by the calculator page and Design Studies.
const BEARING_LIFE_EXPONENTS = {
    ball: 3,
    roller: 10 / 3
};

const BEARING_LIFE_EQUATIONS = [
    String.raw`L_{10} = \left(\frac{C}{P}\right)^{p}\;\text{(million revolutions)},\quad p = 3\;\text{(ball)},\; p = \tfrac{10}{3}\;\text{(roller)}`,
    String.raw`L_{10h} = \frac{L_{10}\times 10^{6}}{60\,n}`
];

// The revolution count depends on C and P in N, independent of speed.
function computeBearingLifeRevolutions({ bearingType, dynamicLoadRatingN, equivalentLoadN }) {
    if (!Object.prototype.hasOwnProperty.call(BEARING_LIFE_EXPONENTS, bearingType)) {
        throw new Error("Please select a valid bearing type.");
    }
    if (![dynamicLoadRatingN, equivalentLoadN].every(Number.isFinite) ||
        dynamicLoadRatingN <= 0 || equivalentLoadN <= 0) {
        throw new Error("Please enter positive values for C and P.");
    }
    const exponent = BEARING_LIFE_EXPONENTS[bearingType];
    const lifeMillionRevolutions = Math.pow(dynamicLoadRatingN / equivalentLoadN, exponent);
    const lifeRevolutions = lifeMillionRevolutions * 1e6;
    if (![lifeMillionRevolutions, lifeRevolutions].every(Number.isFinite)) {
        throw new Error("The result is outside the supported numerical range.");
    }
    return {
        exponent, lifeMillionRevolutions, lifeRevolutions,
        loadRatio: equivalentLoadN / dynamicLoadRatingN,
        loadExceedsRating: equivalentLoadN >= dynamicLoadRatingN
    };
}

// C and P in N, speed in rpm.
function computeBearingLife({ bearingType, dynamicLoadRatingN, equivalentLoadN, speedRpm }) {
    if (!Object.prototype.hasOwnProperty.call(BEARING_LIFE_EXPONENTS, bearingType)) {
        throw new Error("Please select a valid bearing type.");
    }
    if (![dynamicLoadRatingN, equivalentLoadN, speedRpm].every(Number.isFinite) ||
        dynamicLoadRatingN <= 0 || equivalentLoadN <= 0 || speedRpm <= 0) {
        throw new Error("Please enter positive values for C, P, and rotational speed.");
    }
    const result = computeBearingLifeRevolutions({ bearingType, dynamicLoadRatingN, equivalentLoadN });
    const lifeHours = result.lifeRevolutions / (60 * speedRpm);
    if (!Number.isFinite(lifeHours)) throw new Error("The result is outside the supported numerical range.");
    return { ...result, lifeHours };
}
