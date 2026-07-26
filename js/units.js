// ======================================================
// Engineering Calcs Pro
// Universal Unit Conversions
// ======================================================


// Force
const forceUnits = {

    N: 1,

    kN: 1000,

    lbf: 4.4482216152605

};


// Distance
const distanceUnits = {

    mm: 0.001,

    cm: 0.01,

    m: 1,

    in: 0.0254,

    ft: 0.3048

};


// Moment
const momentUnits = {

    "N·mm": 0.001,

    "N·m": 1,

    "kN·m": 1000,

    "lbf·in": 0.112984829,

    "lbf·ft": 1.35581795

};


// ---------- Generic Conversion Functions ----------

function convertForce(value, unit) {

    return value * forceUnits[unit];

}


function convertDistance(value, unit) {

    return value * distanceUnits[unit];

}


function convertMoment(valueInNm, outputUnit) {

    return valueInNm / momentUnits[outputUnit];

}