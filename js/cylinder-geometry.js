// SI geometry for a single-rod cylinder. Diameters are in meters.
function computeCylinderAreas(bore, rod) {
    if (![bore, rod].every(Number.isFinite)) throw new Error("Bore and rod diameters must be valid numbers.");
    if (bore <= 0) throw new Error("Bore diameter must be greater than zero.");
    if (rod < 0 || rod >= bore) throw new Error("Rod diameter must be nonnegative and smaller than the bore diameter.");
    const pistonArea = Math.PI * bore * bore / 4;
    const rodArea = Math.PI * rod * rod / 4;
    const annularArea = Math.PI * (bore - rod) * (bore + rod) / 4;
    if (!Number.isFinite(pistonArea) || annularArea <= 0) throw new Error("Cylinder geometry is outside the numerical range.");
    return { pistonArea, rodArea, annularArea };
}
