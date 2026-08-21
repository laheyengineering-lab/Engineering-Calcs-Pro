// ======================================================
// Engineering Calcs Pro
// Comprehensive Engineering Units Database
// All unit conversions to SI base units
// ======================================================

// ========== UNIT CONVERSION SYSTEMS ==========

// ========== FORCE (Base: Newtons) ==========
const forceUnits = {
    N: 1,
    kN: 1000,
    lbf: 4.4482216152605
};

function convertForce(value, fromUnit) {
    // Returns value in Newtons (SI)
    return value * forceUnits[fromUnit];
}

// ========== DISTANCE/LENGTH (Base: Meters) ==========
const distanceUnits = {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    in: 0.0254,
    ft: 0.3048
};

function convertDistance(value, fromUnit) {
    // Returns value in Meters (SI)
    return value * distanceUnits[fromUnit];
}

// ========== MOMENT/TORQUE (Base: Newton-Meters) ==========
const momentUnits = {
    "N·mm": 0.001,
    "N·m": 1,
    "kN·m": 1000,
    "lbf·in": 0.112984829,
    "lbf·ft": 1.35581795
};

function convertMoment(value, fromUnit) {
    // Returns value in N·m (SI)
    return value * momentUnits[fromUnit];
}

// ========== STRESS/PRESSURE (Base: Pascals) ==========
const stressUnits = {
    Pa: 1,
    MPa: 1e6,
    GPa: 1e9,
    psi: 6894.757,
    ksi: 6894757
};

function convertStress(value, fromUnit) {
    // Returns value in Pascals (SI)
    return value * stressUnits[fromUnit];
}

// Alias for Young's modulus, Shear modulus, and other elastic properties (same units as stress)
function convertModulus(value, fromUnit) {
    // Returns value in Pascals (SI)
    return convertStress(value, fromUnit);
}

// ========== TEMPERATURE (Base: Celsius/Kelvin increment) ==========
function convertTemperatureChange(value, fromUnit) {
    // Returns temperature change in Celsius (equivalent to Kelvin increment)
    if (fromUnit === "°F") {
        // Convert Fahrenheit interval to Celsius interval (divide by 1.8)
        return value / 1.8;
    }
    // °C and K intervals are equivalent (1 K increment = 1 °C increment)
    return value;
}

// ========== AREA MOMENT OF INERTIA (Base: Meters^4) ==========
const inertiaUnits = {
    "mm⁴": 1e-12,      // (0.001)^4
    "cm⁴": 1e-8,       // (0.01)^4
    "m⁴": 1,
    "in⁴": 4.1623e-7   // (0.0254)^4
};

function convertAreaMomentInertia(value, fromUnit) {
    // Returns value in m^4 (SI)
    return value * inertiaUnits[fromUnit];
}

// ========== DISTRIBUTED LOAD (Base: Newtons per Meter) ==========
// This is a composite unit: Force per Distance
const distributedLoadUnits = {
    "N/m": 1,
    "kN/m": 1000,
    "lbf/ft": 14.5939
};

function convertDistributedLoad(value, fromUnit) {
    // Returns value in N/m (SI)
    return value * distributedLoadUnits[fromUnit];
}

// ========== REVERSE CONVERSIONS (FROM SI TO OUTPUT UNIT) ==========

function convertForceToUnit(valueSI, toUnit) {
    // Takes value in Newtons, converts to output unit
    return valueSI / forceUnits[toUnit];
}

function convertDistanceToUnit(valueSI, toUnit) {
    // Takes value in Meters, converts to output unit
    return valueSI / distanceUnits[toUnit];
}

function convertMomentToUnit(valueSI, toUnit) {
    // Takes value in N·m, converts to output unit
    return valueSI / momentUnits[toUnit];
}

function convertStressToUnit(valueSI, toUnit) {
    // Takes value in Pascals, converts to output unit
    return valueSI / stressUnits[toUnit];
}

function convertModulusToUnit(valueSI, toUnit) {
    // Takes value in Pascals, converts to output unit (same as stress)
    return convertStressToUnit(valueSI, toUnit);
}

function convertAreaMomentInertiaToUnit(valueSI, toUnit) {
    // Takes value in m^4, converts to output unit
    return valueSI / inertiaUnits[toUnit];
}

function convertDistributedLoadToUnit(valueSI, toUnit) {
    // Takes value in N/m, converts to output unit
    return valueSI / distributedLoadUnits[toUnit];
}

// ======================================================
// MATERIAL PROPERTY DATABASE
// Organized by Material
// All values in SI base units (Pa for stress, 1/°C for thermal)
// ======================================================

const materialDatabase = {
    
    // ========== CARBON STEEL ==========
    "carbon-steel": {
        displayName: "Carbon Steel (ASTM A36)",
        density: 7850,                          // kg/m³
        youngsModulus: 200e9,                   // Pa
        shearModulus: 80e9,                     // Pa
        poissonRatio: 0.27,                     // dimensionless
        thermalExpansionCoefficient: 12.0e-6,   // 1/°C
        tensileStrength: 250e6,                 // Pa (typical)
        yieldStrength: 170e6,                   // Pa (typical)
        elongationAtBreak: 0.23,                // % (as decimal: 23%)
        hardness: 110,                          // Brinell hardness
        thermalConductivity: 50                 // W/(m·K)
    },
    
    // ========== STAINLESS STEEL 304 ==========
    "stainless-steel": {
        displayName: "Stainless Steel 304",
        density: 8000,                          // kg/m³
        youngsModulus: 193e9,                   // Pa
        shearModulus: 77e9,                     // Pa
        poissonRatio: 0.305,                    // dimensionless
        thermalExpansionCoefficient: 15.9e-6,   // 1/°C
        tensileStrength: 515e6,                 // Pa (typical)
        yieldStrength: 205e6,                   // Pa (typical)
        elongationAtBreak: 0.40,                // % (as decimal: 40%)
        hardness: 217,                          // Brinell hardness
        thermalConductivity: 16                 // W/(m·K)
    },
    
    // ========== ALUMINUM 6061 ==========
    "aluminum": {
        displayName: "Aluminum 6061-T6",
        density: 2700,                          // kg/m³
        youngsModulus: 69e9,                    // Pa
        shearModulus: 26e9,                     // Pa
        poissonRatio: 0.33,                     // dimensionless
        thermalExpansionCoefficient: 23.6e-6,   // 1/°C
        tensileStrength: 310e6,                 // Pa (T6 temper)
        yieldStrength: 275e6,                   // Pa (T6 temper)
        elongationAtBreak: 0.12,                // % (as decimal: 12%)
        hardness: 95,                           // Brinell hardness
        thermalConductivity: 167                // W/(m·K)
    },
    
    // ========== COPPER ==========
    "copper": {
        displayName: "Copper (Pure)",
        density: 8960,                          // kg/m³
        youngsModulus: 110e9,                   // Pa
        shearModulus: 44e9,                     // Pa
        poissonRatio: 0.34,                     // dimensionless
        thermalExpansionCoefficient: 16.5e-6,   // 1/°C
        tensileStrength: 220e6,                 // Pa (annealed)
        yieldStrength: 33e6,                    // Pa (annealed)
        elongationAtBreak: 0.45,                // % (as decimal: 45%)
        hardness: 40,                           // Brinell hardness
        thermalConductivity: 401                // W/(m·K)
    },
    
    // ========== BRASS ==========
    "brass": {
        displayName: "Brass (Cu-30Zn)",
        density: 8470,                          // kg/m³
        youngsModulus: 100e9,                   // Pa
        shearModulus: 37e9,                     // Pa
        poissonRatio: 0.34,                     // dimensionless
        thermalExpansionCoefficient: 19.0e-6,   // 1/°C
        tensileStrength: 330e6,                 // Pa (typical)
        yieldStrength: 170e6,                   // Pa (typical)
        elongationAtBreak: 0.35,                // % (as decimal: 35%)
        hardness: 120,                          // Brinell hardness
        thermalConductivity: 111                // W/(m·K)
    },
    
    // ========== TITANIUM GRADE 2 ==========
    "titanium": {
        displayName: "Titanium Grade 2",
        density: 4510,                          // kg/m³
        youngsModulus: 103e9,                   // Pa
        shearModulus: 39e9,                     // Pa
        poissonRatio: 0.32,                     // dimensionless
        thermalExpansionCoefficient: 8.6e-6,    // 1/°C
        tensileStrength: 345e6,                 // Pa (typical)
        yieldStrength: 275e6,                   // Pa (typical)
        elongationAtBreak: 0.18,                // % (as decimal: 18%)
        hardness: 160,                          // Brinell hardness
        thermalConductivity: 16.4               // W/(m·K)
    },
    
    // ========== MILD STEEL ==========
    "mild-steel": {
        displayName: "Mild Steel (Low Carbon)",
        density: 7850,                          // kg/m³
        youngsModulus: 210e9,                   // Pa
        shearModulus: 80e9,                     // Pa
        poissonRatio: 0.27,                     // dimensionless
        thermalExpansionCoefficient: 11.0e-6,   // 1/°C
        tensileStrength: 340e6,                 // Pa
        yieldStrength: 240e6,                   // Pa
        elongationAtBreak: 0.25,                // % (as decimal: 25%)
        hardness: 130,                          // Brinell hardness
        thermalConductivity: 50                 // W/(m·K)
    },
    
    // ========== HIGH STRENGTH STEEL ==========
    "high-strength-steel": {
        displayName: "High Strength Steel (ASTM A514)",
        density: 7850,                          // kg/m³
        youngsModulus: 207e9,                   // Pa
        shearModulus: 80e9,                     // Pa
        poissonRatio: 0.27,                     // dimensionless
        thermalExpansionCoefficient: 12.0e-6,   // 1/°C
        tensileStrength: 1380e6,                // Pa
        yieldStrength: 1170e6,                  // Pa
        elongationAtBreak: 0.11,                // % (as decimal: 11%)
        hardness: 380,                          // Brinell hardness
        thermalConductivity: 50                 // W/(m·K)
    },
    
    // ========== CAST IRON ==========
    "cast-iron": {
        displayName: "Cast Iron (Gray)",
        density: 7200,                          // kg/m³
        youngsModulus: 100e9,                   // Pa
        shearModulus: 45e9,                     // Pa
        poissonRatio: 0.21,                     // dimensionless
        thermalExpansionCoefficient: 10.5e-6,   // 1/°C
        tensileStrength: 200e6,                 // Pa
        yieldStrength: 150e6,                   // Pa
        elongationAtBreak: 0.005,               // % (as decimal: 0.5%, very brittle)
        hardness: 200,                          // Brinell hardness
        thermalConductivity: 50                 // W/(m·K)
    },
    
    // ========== MAGNESIUM ==========
    "magnesium": {
        displayName: "Magnesium AZ91D",
        density: 1810,                          // kg/m³
        youngsModulus: 45e9,                    // Pa
        shearModulus: 17e9,                     // Pa
        poissonRatio: 0.35,                     // dimensionless
        thermalExpansionCoefficient: 26e-6,     // 1/°C
        tensileStrength: 230e6,                 // Pa
        yieldStrength: 160e6,                   // Pa
        elongationAtBreak: 0.03,                // % (as decimal: 3%)
        hardness: 80,                           // Brinell hardness
        thermalConductivity: 51                 // W/(m·K)
    }
};

// ========== MATERIAL DATABASE UTILITY FUNCTIONS ==========

/**
 * Gets a specific material from the database
 * @param {string} materialKey - Key from materialDatabase (e.g., "carbon-steel")
 * @returns {object} Material properties object
 */
function getMaterial(materialKey) {
    return materialDatabase[materialKey] || null;
}

/**
 * Gets a specific property from a material
 * @param {string} materialKey - Key from materialDatabase
 * @param {string} propertyName - Property name (e.g., "tensileStrength", "youngsModulus")
 * @returns {number} Property value in SI units, or null if not found
 */
function getMaterialProperty(materialKey, propertyName) {
    const material = materialDatabase[materialKey];
    if (!material || !material[propertyName]) {
        return null;
    }
    return material[propertyName];
}

/**
 * Gets all available material keys
 * @returns {array} Array of material keys
 */
function getMaterialList() {
    return Object.keys(materialDatabase);
}

/**
 * Gets formatted material list for dropdown/select elements
 * @returns {array} Array of {key, displayName} objects
 */
function getMaterialListFormatted() {
    const materials = [];
    for (const key in materialDatabase) {
        materials.push({
            key: key,
            displayName: materialDatabase[key].displayName
        });
    }
    return materials;
}

/**
 * Converts a material property from user's selected unit to SI
 * @param {number} value - Value entered by user
 * @param {string} fromUnit - Unit user selected
 * @param {string} propertyType - Type of property: "stress", "modulus", "thermal", "density"
 * @returns {number} Value in SI units
 */
function convertMaterialProperty(value, fromUnit, propertyType) {
    if (propertyType === "stress" || propertyType === "modulus" || propertyType === "strength") {
        return convertStress(value, fromUnit);
    } else if (propertyType === "thermal") {
        // Thermal expansion coefficient is typically already in 1/°C
        return value;
    } else if (propertyType === "density") {
        // Convert kg/m³ - typically already in SI
        return value;
    } else if (propertyType === "conductivity") {
        // Thermal conductivity W/(m·K) - already in SI
        return value;
    }
    return value;
}

// ========== COMMON PROPERTY LISTS ==========

/**
 * Common stress/strength property keys
 * Useful for populating UI fields
 */
const stressProperties = [
    "tensileStrength",
    "yieldStrength",
    "shearStrength"
];

/**
 * Common elastic property keys
 */
const elasticProperties = [
    "youngsModulus",
    "shearModulus",
    "poissonRatio"
];

/**
 * Common thermal property keys
 */
const thermalProperties = [
    "thermalExpansionCoefficient",
    "thermalConductivity"
];
