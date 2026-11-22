// DOM-free engineering models. Lengths, temperatures, rates and properties
// are in coherent SI units. Adapters handle display units and model selection.
const STANDARD_GRAVITY = 9.80665;

function requireEngineeringNumber(value, label, minimum = 0, inclusive = false) {
    if (!Number.isFinite(value) || value < minimum || (!inclusive && value === minimum)) {
        throw new Error(label + (inclusive ? " must be at least " : " must be greater than ") + minimum + ".");
    }
}

function computePipeFlow({ diameter, flow, velocity, density, dynamicViscosity, kinematicViscosity }) {
    requireEngineeringNumber(diameter, "Internal diameter");
    requireEngineeringNumber(density, "Density");
    const viscosity = dynamicViscosity == null ? kinematicViscosity : dynamicViscosity / density;
    requireEngineeringNumber(viscosity, "Kinematic viscosity");
    const area = Math.PI * diameter ** 2 / 4;
    requireEngineeringNumber(area, "Flow area");
    if (flow == null) {
        requireEngineeringNumber(velocity, "Velocity", 0, true);
        flow = velocity * area;
    } else {
        requireEngineeringNumber(flow, "Flow rate", 0, true);
        velocity = flow / area;
    }
    const reynolds = velocity * diameter / viscosity;
    requireEngineeringNumber(reynolds, "Reynolds number", 0, true);
    return { area, flow, velocity, reynolds, regime: pipeFlowRegime(reynolds) };
}

function pipeFlowRegime(reynolds) {
    if (reynolds === 0) return "No flow";
    if (reynolds < 2300) return "Laminar";
    if (reynolds < 4000) return "Transitional";
    return "Turbulent";
}

// Solve for x = 1/sqrt(f_D). The Colebrook residual is strictly increasing.
function colebrookDarcyFactor(reynolds, relativeRoughness) {
    let low = 0;
    let high = 64;
    for (let iteration = 0; iteration < 55; iteration += 1) {
        const x = (low + high) / 2;
        const residual = x + 2 * Math.log10(relativeRoughness / 3.7 + 2.51 * x / reynolds);
        if (residual > 0) high = x;
        else low = x;
    }
    return (2 / (low + high)) ** 2;
}

function computePipePressureDrop({ length, roughness, minorCoefficient = 0, ...pipe }) {
    requireEngineeringNumber(length, "Pipe length", 0, true);
    requireEngineeringNumber(roughness, "Absolute roughness", 0, true);
    requireEngineeringNumber(minorCoefficient, "Total K", 0, true);
    const r = computePipeFlow(pipe);
    const relativeRoughness = roughness / pipe.diameter;
    if (relativeRoughness > 0.05) throw new Error("The model supports relative roughness up to 0.05.");
    let darcyFactor;
    if (r.reynolds >= 4000) {
        if (r.reynolds > 1e8) throw new Error("The turbulent model supports Reynolds numbers up to 100 million.");
        darcyFactor = colebrookDarcyFactor(r.reynolds, relativeRoughness);
    } else if (r.reynolds >= 2300) {
        const fraction = (r.reynolds - 2300) / 1700;
        darcyFactor = (1 - fraction) * 64 / 2300 + fraction * colebrookDarcyFactor(4000, relativeRoughness);
    } else if (r.reynolds > 0) {
        darcyFactor = 64 / r.reynolds;
    }
    const velocityPressure = pipe.density * r.velocity ** 2 / 2;
    const major = darcyFactor === undefined ? 0 : darcyFactor * (length / pipe.diameter) * velocityPressure;
    const minor = minorCoefficient * velocityPressure;
    const total = major + minor;
    return { ...r, relativeRoughness, darcyFactor, major, minor, total, headLoss: total / (pipe.density * STANDARD_GRAVITY) };
}

function computePumpPower({ flow, pressure, head, density, efficiency, duration }) {
    requireEngineeringNumber(flow, "Flow rate", 0, true);
    requireEngineeringNumber(density, "Density");
    requireEngineeringNumber(efficiency, "Efficiency");
    if (efficiency > 1) throw new Error("Efficiency must be no more than 100%.");
    if (pressure == null) {
        requireEngineeringNumber(head, "Head rise", 0, true);
        pressure = density * STANDARD_GRAVITY * head;
    } else {
        requireEngineeringNumber(pressure, "Pressure rise", 0, true);
        head = pressure / (density * STANDARD_GRAVITY);
    }
    if (duration != null) requireEngineeringNumber(duration, "Operating duration", 0, true);
    const hydraulicPower = flow * pressure;
    const shaftPower = hydraulicPower / efficiency;
    return { pressure, head, hydraulicPower, shaftPower, energy: duration == null ? undefined : shaftPower * duration };
}

function computeCylinderVolumes(bore, rod, stroke) {
    requireEngineeringNumber(stroke, "Stroke");
    const areas = computeCylinderAreas(bore, rod);
    return { ...areas, capVolume: areas.pistonArea * stroke, rodVolume: areas.annularArea * stroke };
}

function computeCylinderCycle({ bore, rod, stroke, extensionFlow, retractionFlow, extensionSpeed, retractionSpeed }) {
    const chambers = computeCylinderVolumes(bore, rod, stroke);
    function motion(flow, speed, area, label) {
        if (flow != null) {
            requireEngineeringNumber(flow, label + " flow");
            speed = flow / area;
        }
        if (speed == null) return {};
        requireEngineeringNumber(speed, label + " speed");
        return { speed, flow: speed * area, time: stroke / speed };
    }
    const ext = motion(extensionFlow, extensionSpeed, chambers.pistonArea, "Extension");
    const ret = motion(retractionFlow, retractionSpeed, chambers.annularArea, "Retraction");
    if (ext.time === undefined && ret.time === undefined) throw new Error("Enter a value for at least one stroke direction.");
    return {
        ...chambers, extensionSpeed: ext.speed, retractionSpeed: ret.speed,
        extensionFlow: ext.flow, retractionFlow: ret.flow,
        extensionTime: ext.time, retractionTime: ret.time,
        cycleTime: ext.time === undefined || ret.time === undefined ? undefined : ext.time + ret.time
    };
}

function computePneumaticConsumption({ bore, rod, stroke, gaugePressure, referencePressure, operatingTemperature, referenceTemperature, frequency }) {
    const chambers = computeCylinderVolumes(bore, rod, stroke);
    requireEngineeringNumber(gaugePressure, "Gauge pressure", 0, true);
    requireEngineeringNumber(referencePressure, "Absolute ambient/reference pressure");
    requireEngineeringNumber(operatingTemperature, "Operating temperature in kelvin");
    requireEngineeringNumber(referenceTemperature, "Reference temperature in kelvin");
    requireEngineeringNumber(frequency, "Cycle frequency", 0, true);
    const absolutePressure = gaugePressure + referencePressure;
    const sweptVolume = chambers.capVolume + chambers.rodVolume;
    const freeAir = sweptVolume * (absolutePressure / referencePressure) * (referenceTemperature / operatingTemperature);
    return { ...chambers, absolutePressure, sweptVolume, freeAir, consumptionRate: freeAir * frequency };
}

function computeInsulation({ layers, insideFilm = 0, outsideFilm = 0 }) {
    requireEngineeringNumber(insideFilm, "Interior surface resistance", 0, true);
    requireEngineeringNumber(outsideFilm, "Exterior surface resistance", 0, true);
    if (!layers.length) throw new Error("Enter at least one material layer.");
    const resistances = layers.map((layer) => {
        if (layer.resistance != null) {
            requireEngineeringNumber(layer.resistance, "Layer resistance");
            return layer.resistance;
        }
        requireEngineeringNumber(layer.thickness, "Layer thickness");
        requireEngineeringNumber(layer.conductivity, "Thermal conductivity");
        return layer.thickness / layer.conductivity;
    });
    const materialResistance = resistances.reduce((sum, value) => sum + value, 0);
    const resistance = materialResistance + insideFilm + outsideFilm;
    requireEngineeringNumber(resistance, "Assembly resistance");
    return { resistances, materialResistance, resistance, transmittance: 1 / resistance,
        contributions: resistances.map((value) => 100 * (value / resistance)) };
}

function computeWallHeatTransfer({ area, inside, outside, resistance, transmittance, duration }) {
    requireEngineeringNumber(area, "Assembly area");
    requireEngineeringNumber(inside, "Indoor temperature in kelvin");
    requireEngineeringNumber(outside, "Outdoor temperature in kelvin");
    requireEngineeringNumber(duration, "Operating duration", 0, true);
    if (transmittance == null) {
        requireEngineeringNumber(resistance, "Effective resistance");
        transmittance = 1 / resistance;
    } else {
        requireEngineeringNumber(transmittance, "Effective U-factor");
    }
    const difference = inside - outside;
    const heatRate = transmittance * area * difference;
    return { difference, heatRate, energy: heatRate * duration };
}

function computeMountingDemand({ arrangement, weight, offset = 0, count, spacing, horizontalSpacing, shearCapacity, tensionCapacity }) {
    requireEngineeringNumber(weight, "Vertical load");
    requireEngineeringNumber(offset, "Load offset", 0, true);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error("Enter a positive whole number of fasteners.");
    if (shearCapacity != null) requireEngineeringNumber(shearCapacity, "Shear working capacity");
    if (tensionCapacity != null) requireEngineeringNumber(tensionCapacity, "Tension working capacity");
    if (arrangement === "Close to wall") {
        if (offset !== 0) throw new Error("The close-to-wall model requires zero offset. Use a bearing-contact model for eccentric loads.");
    } else if (arrangement === "Bracket with lower bearing" || arrangement === "Symmetric two-row mount") {
        requireEngineeringNumber(spacing, "Vertical reaction spacing");
        if (arrangement === "Symmetric two-row mount") {
            if (count < 2 || count % 2 !== 0) throw new Error("The symmetric mount requires equal fastener counts in two rows.");
            if (count > 2) requireEngineeringNumber(horizontalSpacing, "Horizontal fastener spacing");
        }
    } else {
        throw new Error("Unsupported mounting arrangement.");
    }
    const moment = weight * offset;
    const topCount = arrangement === "Symmetric two-row mount" ? count / 2 : count;
    const compression = offset === 0 ? 0 : moment / spacing;
    const tension = compression / topCount;
    const shear = weight / count;
    return { weight, moment, shear, tension, compression,
        shearRatio: shearCapacity == null ? undefined : shear / shearCapacity,
        tensionRatio: tensionCapacity == null ? undefined : tension / tensionCapacity };
}
