// ======================================================
// Engineering Calcs Pro
// Materials Database
// ======================================================
// 
// Reference values for common engineering materials
// These are TYPICAL/APPROXIMATE values at room temperature
// Not exact for all grades, heat treatments, or conditions
//
// Source: Standard engineering references (AISC, MatWeb, etc.)
// Always verify material properties for critical applications
//
// Units: 
//   E, G = MPa (megapascals)
//   alpha = 1/°C (coefficient of linear thermal expansion)
// ======================================================

const materialsDatabase = {
    
    // STEELS
    "Carbon Steel (Mild)": {
        E: 200,
        G: 80,
        alpha: 12.0e-6,
        description: "Typical carbon steel, room temperature"
    },
    
    "Stainless Steel (304)": {
        E: 193,
        G: 77,
        alpha: 15.9e-6,
        description: "Austenitic stainless steel, room temperature"
    },
    
    "Steel (High Strength)": {
        E: 210,
        G: 84,
        alpha: 11.0e-6,
        description: "High-strength steel, room temperature"
    },
    
    // ALUMINUM
    "Aluminum 6061-T6": {
        E: 69,
        G: 26,
        alpha: 23.6e-6,
        description: "Common aluminum alloy, room temperature"
    },
    
    "Aluminum 7075-T6": {
        E: 72,
        G: 27,
        alpha: 23.4e-6,
        description: "High-strength aluminum alloy, room temperature"
    },
    
    // COPPER & ALLOYS
    "Copper (Pure)": {
        E: 117,
        G: 44,
        alpha: 16.5e-6,
        description: "Pure copper, room temperature"
    },
    
    "Brass (60/40)": {
        E: 100,
        G: 37,
        alpha: 19.0e-6,
        description: "Common brass alloy, room temperature"
    },
    
    // TITANIUM
    "Titanium (Grade 2)": {
        E: 103,
        G: 39,
        alpha: 8.6e-6,
        description: "Pure titanium, room temperature"
    },
    
    // CAST IRON
    "Cast Iron (Gray)": {
        E: 110,
        G: 44,
        alpha: 10.0e-6,
        description: "Gray cast iron, room temperature"
    },
    
    // MAGNESIUM
    "Magnesium Alloy": {
        E: 45,
        G: 17,
        alpha: 26.0e-6,
        description: "Typical magnesium alloy, room temperature"
    }
    
};

// Get ordered list of material names for dropdown
function getMaterialNames() {
    return Object.keys(materialsDatabase).sort();
}

// Get material properties by name
function getMaterialProperties(materialName) {
    return materialsDatabase[materialName] || null;
}

// Get Young's Modulus (E) in MPa
function getMaterialYoungsModulus(materialName) {
    const material = materialsDatabase[materialName];
    return material ? material.E : null;
}

// Get Shear Modulus (G) in MPa
function getMaterialShearModulus(materialName) {
    const material = materialsDatabase[materialName];
    return material ? material.G : null;
}

// Get Thermal Expansion Coefficient (alpha) in 1/°C
function getMaterialThermalCoefficient(materialName) {
    const material = materialsDatabase[materialName];
    return material ? material.alpha : null;
}
