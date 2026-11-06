// ======================================================
// Formula Foundry
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
    "µm": 0.000001,
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

// ========== AREA (Base: Square Meters) ==========
const areaUnits = {
    "mm²": 1e-6,
    "cm²": 1e-4,
    "m²": 1,
    "in²": 6.4516e-4
};

function convertArea(value, fromUnit) {
    // Returns value in Square Meters (SI)
    return value * areaUnits[fromUnit];
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
    kPa: 1e3,
    bar: 1e5,
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

// ========== ROTATIONAL SPEED (Base: Revolutions per Minute) ==========
const rotationalSpeedUnits = {
    rpm: 1,
    rps: 60
};

function convertRotationalSpeed(value, fromUnit) {
    // Returns value in rpm
    return value * rotationalSpeedUnits[fromUnit];
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

function convertAreaToUnit(valueSI, toUnit) {
    // Takes value in Square Meters, converts to output unit
    return valueSI / areaUnits[toUnit];
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

function convertRotationalSpeedToUnit(valueSI, toUnit) {
    // Takes value in rpm, converts to output unit
    return valueSI / rotationalSpeedUnits[toUnit];
}

// ======================================================
// MATERIAL PROPERTY DATABASE
// Organized by Material
// All values in SI base units (Pa for stress, 1/°C for thermal,
// kg/m³ for density, W/(m·K) for conductivity, Brinell hardness as HB,
// elongation as a decimal fraction).
//
// Property values are REFERENCE properties at room temperature (see
// metadata.referenceTemperatureC), not certified design allowables.
// A property that could not be established for a material is OMITTED
// (never 0). Consumers must treat a missing property as "unavailable".
//
// Optional metadata (backward-compatible; flat property keys are unchanged):
//   metadata.family, designation, grade, condition, productForm,
//   metadata.referenceTemperatureC, metadata.caveats, metadata.sources
//   metadata.propertyBasis[property] is one of MATERIAL_PROPERTY_BASES.
// Full inventory, provenance and corrections: docs/material-reference.md
// ======================================================

const MATERIAL_PROPERTY_BASES = {
    typical: "Typical (published average) value",
    nominal: "Nominal handbook / reference value",
    "specified-minimum": "Minimum required by the governing specification (lower bound, not a typical value)",
    unverified: "Legacy value retained without a confirmed source; do not rely on it"
};

const materialReferences = {
    "astm-a36": { title: "ASTM A36/A36M, Standard Specification for Carbon Structural Steel", publisher: "ASTM International", identifier: "ASTM A36/A36M" },
    "azom-a36": { title: "ASTM A36 Mild/Low Carbon Steel (physical and mechanical properties)", publisher: "AZoM", url: "https://www.azom.com/article.aspx?ArticleId=6117" },
    "astm-a514": { title: "ASTM A514/A514M, Standard Specification for High-Yield-Strength, Quenched and Tempered Alloy Steel Plate, Suitable for Welding", publisher: "ASTM International", identifier: "ASTM A514/A514M" },
    "ssab-a514b": { title: "ASTM A514 Grade B product data (minimum yield 100 ksi / 690 MPa)", publisher: "SSAB", url: "https://www.ssab.com/en-us/brands-and-products/commercial-steel/structural-steel/astm-a514/grade-b" },
    "astm-a240": { title: "ASTM A240/A240M, Standard Specification for Chromium and Chromium-Nickel Stainless Steel Plate, Sheet, and Strip", publisher: "ASTM International", identifier: "ASTM A240/A240M" },
    "aalco-304": { title: "Stainless Steel 304 datasheet (flat-rolled ASTM A240/A240M products)", publisher: "Aalco Metals", url: "https://www.farnell.com/datasheets/33229.pdf" },
    "roymech-304": { title: "304 Stainless Steel data sheet", publisher: "RoyMech (secondary compilation)", url: "https://www.roymech.co.uk/material-properties/metals/ferrous-metals/304-Stainless-Steel-Q0006Q" },
    "astm-a48": { title: "ASTM A48/A48M, Standard Specification for Gray Iron Castings", publisher: "ASTM International", identifier: "ASTM A48/A48M" },
    "penticton-a48-30": { title: "Gray Iron ASTM A48 Class 30 Data Sheet", publisher: "Penticton Foundry", url: "https://www.pentictonfoundry.com/news/gray-iron-astm-a48-class-30/" },
    "astm-b265": { title: "ASTM B265, Standard Specification for Titanium and Titanium Alloy Strip, Sheet, and Plate", publisher: "ASTM International", identifier: "ASTM B265" },
    "matweb-ti64-annealed": { title: "Titanium Ti-6Al-4V (Grade 5), Annealed (MatWeb/ASM data sheet MTP641)", publisher: "MatWeb", url: "https://asm.matweb.com/search/SpecificMaterial.asp?bassnum=MTP641&lang=en&lang=en" },
    "astm-a564": { title: "ASTM A564/A564M, Standard Specification for Hot-Rolled and Cold-Finished Age-Hardening Stainless Steel Bars and Shapes", publisher: "ASTM International", identifier: "ASTM A564/A564M" },
    "tpm-17-4ph": { title: "17-4PH Stainless Machining Datasheet (H900: UTS 190 ksi, yield 170 ksi, E 28.5 Msi)", publisher: "True Precision Machining", url: "https://www.trueprecisionmachining.com/engineering/datasheets/stainless-17-4ph/" },
    "mechcodex-17-4ph": { title: "17-4 PH (H900) Properties", publisher: "MechCodex (secondary compilation)", url: "https://mechcodex.com/materials/17-4-ph-stainless-steel" },
    "metals4u-316": { title: "1.4401 Grade 316 Stainless Steel Properties (ASTM A240 minimums, ASM-type physical data)", publisher: "metals4U", url: "https://www.metals4u.co.uk/blog/316-stainless-steel" },
    "roymech-316": { title: "316 Stainless Steel data sheet", publisher: "RoyMech", url: "https://www.roymech.co.uk/material-properties/metals/ferrous-metals/316-Stainless-Steel-Q000dQ" },
    "matweb-1018-cd": { title: "AISI 1018 Steel, cold drawn (MatWeb data sheet)", publisher: "MatWeb", url: "https://apm.matweb.com/search/DataSheet.aspx?MatGUID=3a9cc570fbb24d119f08db22a53e2421" },
    "matweb-4140-annealed": { title: "AISI 4140 steel, annealed at 815 °C, furnace cooled to 665 °C, air cooled, 25 mm round (MatWeb data sheet)", publisher: "MatWeb (as reproduced by Xometry)", url: "https://s3.amazonaws.com/xometry.craft/files/specsheets/datasheet-AISI-4140-steel.pdf" },
    "efunda-4140": { title: "Properties of Alloy Steel AISI 4140", publisher: "eFunda", url: "https://www.efunda.com/Materials/alloys/alloy_steels/show_alloy.cfm?ID=AISI_4140&show_prop=all&Page_Title=AISI%204140" },
    "asm-6061-t6": { title: "Aluminum 6061-T6; 6061-T651 (ASM Material Data Sheet; Aluminum Association typical values)", publisher: "ASM International / MatWeb", url: "https://s3.amazonaws.com/xometry.craft/files/specsheets/ASM-Aluminum-6061-T6-Material-Data-Sheet.pdf" },
    "aa-6061-o": { title: "Aluminum 6061-O (Aluminum Association typical values)", publisher: "Aerospace Metals / MatWeb", url: "https://www.aerospacemetals.com/wp-content/uploads/2023/06/Aluminum-6061-O.pdf" },
    "aa-2024-t3": { title: "2024-T3 Aluminum Alloy Properties (typical values citing Aluminum Association and ASM)", publisher: "Components.ca", url: "https://www.components.ca/knowledge/aluminum-alloys/2024-t3" },
    "vtech-7075-t6": { title: "Technical Data Sheet TDS-AL-7075-T6-QQA250, Aluminum 7075-T6 (screening values)", publisher: "VTECH", url: "https://vtechadvanced.com/wp-content/uploads/datasheets/TDS-AL-7075-T6-QQA250_RevA.pdf" },
    "cda-c11000": { title: "Copper C11000 (ETP) annealed (O60) properties", publisher: "Copper Development Association values as tabulated by Online Metals", url: "https://www.onlinemetals.com/en/product-guide/alloy/110" },
    "cda-c26000": { title: "Alloy 260 (C26000 cartridge brass) product guide", publisher: "Online Metals", url: "https://www.onlinemetals.com/en/product-guide/alloy/260" },
    "azom-az91d": { title: "Magnesium AZ91D-F Alloy (UNS M11916)", publisher: "AZoM", url: "https://www.azom.com/article.aspx?ArticleID=8670" },
    "sdmetals-gr2": { title: "Titanium Grade 2 data sheet (ASTM B265/B348 minimums)", publisher: "S+D Metals", url: "https://sd-metals.bibus.com/de-en/materials/itm/Titanium-Grade-2/" }
};

const materialDatabase = {
    
    // ========== CARBON STEEL ==========
    "carbon-steel": {
        displayName: "Carbon Steel (ASTM A36)",
        density: 7850,                          // kg/m³
        youngsModulus: 200e9,                   // Pa
        shearModulus: 79.3e9,                   // Pa
        poissonRatio: 0.26,                     // dimensionless
        thermalExpansionCoefficient: 11.7e-6,   // 1/°C
        tensileStrength: 400e6,                 // Pa (lower bound of the 400-550 MPa specified range)
        yieldStrength: 250e6,                   // Pa (specified minimum)
        elongationAtBreak: 0.23,                // fraction (specified minimum, 50 mm gauge)
        thermalConductivity: 50,                // W/(m·K)
        metadata: {
            family: "Carbon steel",
            designation: "ASTM A36/A36M",
            grade: "A36",
            condition: "As-rolled plate, thickness up to 203 mm (8 in)",
            productForm: "Structural plate, thickness up to 203 mm (8 in)",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "nominal", shearModulus: "nominal", poissonRatio: "nominal",
                thermalExpansionCoefficient: "nominal", tensileStrength: "specified-minimum",
                yieldStrength: "specified-minimum", elongationAtBreak: "specified-minimum", thermalConductivity: "nominal"
            },
            sources: ["astm-a36", "azom-a36"],
            caveats: "Strengths are specification minimums (tensile range 400-550 MPa); typical as-rolled yield is higher. Elongation is 23% minimum in 50 mm (20% in 200 mm). A36 has no hardness requirement."
        }
    },
    
    // ========== STAINLESS STEEL 304 ==========
    "stainless-steel": {
        displayName: "Stainless Steel 304",
        density: 8000,                          // kg/m³
        youngsModulus: 193e9,                   // Pa
        shearModulus: 77e9,                     // Pa
        poissonRatio: 0.29,                     // dimensionless
        thermalExpansionCoefficient: 17.2e-6,   // 1/°C (0-100 °C mean)
        tensileStrength: 515e6,                 // Pa (specified minimum)
        yieldStrength: 205e6,                   // Pa (specified minimum, 0.2% offset)
        elongationAtBreak: 0.40,                // fraction (specified minimum)
        thermalConductivity: 16.2,              // W/(m·K) at 100 °C
        metadata: {
            family: "Stainless steel",
            designation: "AISI 304 (UNS S30400)",
            grade: "304",
            condition: "Annealed (ASTM A240 plate, sheet and strip)",
            productForm: "Plate, sheet, strip",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "nominal", shearModulus: "nominal", poissonRatio: "typical",
                thermalExpansionCoefficient: "typical", tensileStrength: "specified-minimum",
                yieldStrength: "specified-minimum", elongationAtBreak: "specified-minimum", thermalConductivity: "typical"
            },
            sources: ["astm-a240", "aalco-304", "roymech-304"],
            caveats: "Strengths are ASTM A240 annealed minimums. Thermal expansion is the 0-100 °C mean and conductivity is quoted at 100 °C (about 15 W/(m·K) at 20 °C in EN data). Cold-worked 304 is stronger. Hardness omitted: A240 gives only a maximum (201 HBW)."
        }
    },
    
    // ========== ALUMINUM 6061 ==========
    "aluminum": {
        displayName: "Aluminum 6061-T6",
        density: 2700,                          // kg/m³
        youngsModulus: 68.9e9,                  // Pa
        shearModulus: 26e9,                     // Pa
        poissonRatio: 0.33,                     // dimensionless
        thermalExpansionCoefficient: 23.6e-6,   // 1/°C
        tensileStrength: 310e6,                 // Pa (typical)
        yieldStrength: 276e6,                   // Pa (typical)
        elongationAtBreak: 0.12,                // fraction (typical)
        hardness: 95,                           // Brinell hardness (typical)
        thermalConductivity: 167,               // W/(m·K)
        metadata: {
            family: "Aluminum alloy",
            designation: "AA 6061 (UNS A96061)",
            grade: "6061",
            condition: "T6 temper (solution heat treated and artificially aged)",
            productForm: "Extrusion, plate, bar and sheet",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "typical", shearModulus: "typical", poissonRatio: "typical",
                thermalExpansionCoefficient: "typical", tensileStrength: "typical", yieldStrength: "typical",
                elongationAtBreak: "typical", hardness: "typical", thermalConductivity: "typical"
            },
            sources: ["asm-6061-t6"],
            caveats: "Typical (Aluminum Association) values, not minimums; ASTM B221/B209 minimums are lower (for example about 240 MPa yield). Properties drop markedly in weld heat-affected zones and above about 150 °C. Elongation depends on product thickness (8-17%)."
        }
    },
    
    // ========== COPPER ==========
    "copper": {
        displayName: "Copper C11000 (ETP), annealed",
        density: 8900,                          // kg/m³
        youngsModulus: 117e9,                   // Pa
        shearModulus: 43.5e9,                   // Pa
        poissonRatio: 0.34,                     // dimensionless
        thermalExpansionCoefficient: 16.9e-6,   // 1/°C (20-300 °C mean)
        tensileStrength: 220e6,                 // Pa (typical, annealed)
        yieldStrength: 69e6,                    // Pa (typical, annealed)
        elongationAtBreak: 0.45,                // fraction (typical, annealed)
        thermalConductivity: 391,               // W/(m·K)
        metadata: {
            family: "Copper alloy",
            designation: "UNS C11000 (ETP copper)",
            grade: "C11000",
            condition: "Annealed (O60 soft anneal)",
            productForm: "Sheet and bar",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "nominal", shearModulus: "nominal", poissonRatio: "nominal",
                thermalExpansionCoefficient: "typical", tensileStrength: "typical", yieldStrength: "typical",
                elongationAtBreak: "typical", thermalConductivity: "typical"
            },
            sources: ["cda-c11000"],
            caveats: "Applies only to annealed ETP copper; cold-worked tempers are several times stronger in yield. Hardness omitted: the annealed reference is quoted on the Rockwell F scale (about HRF 40), not Brinell. Thermal conductivity is a CDA value for C11000, below the pure-element 401 W/(m·K)."
        }
    },
    
    // ========== BRASS ==========
    "brass": {
        displayName: "Brass (Cu-30Zn), temper not specified",
        density: 8530,                          // kg/m³
        youngsModulus: 110e9,                   // Pa
        shearModulus: 40e9,                     // Pa
        poissonRatio: 0.38,                     // dimensionless
        thermalExpansionCoefficient: 19.0e-6,   // 1/°C (unverified legacy value)
        tensileStrength: 330e6,                 // Pa (unverified legacy value)
        yieldStrength: 170e6,                   // Pa (unverified legacy value)
        elongationAtBreak: 0.35,                // fraction (unverified legacy value)
        hardness: 120,                          // Brinell hardness (unverified legacy value)
        thermalConductivity: 120,               // W/(m·K)
        metadata: {
            family: "Copper alloy",
            designation: "Cu-30Zn cartridge brass (UNS C26000)",
            grade: "C26000",
            condition: "Temper not specified",
            productForm: "Flat products",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "nominal", shearModulus: "nominal", poissonRatio: "typical",
                thermalExpansionCoefficient: "unverified", tensileStrength: "unverified", yieldStrength: "unverified",
                elongationAtBreak: "unverified", hardness: "unverified", thermalConductivity: "typical"
            },
            sources: ["cda-c26000"],
            caveats: "Brass strength depends strongly on temper (annealed yield is roughly 115-125 MPa; half-hard about 250 MPa). The legacy strength, elongation, hardness and expansion values have no confirmed temper or source: use a direct entry for strength-critical work."
        }
    },
    
    // ========== TITANIUM GRADE 2 ==========
    "titanium": {
        displayName: "Titanium Grade 2",
        density: 4510,                          // kg/m³
        youngsModulus: 103e9,                   // Pa
        shearModulus: 39e9,                     // Pa
        poissonRatio: 0.32,                     // dimensionless
        thermalExpansionCoefficient: 8.6e-6,    // 1/°C
        tensileStrength: 345e6,                 // Pa (specified minimum)
        yieldStrength: 275e6,                   // Pa (specified minimum, 0.2% offset)
        elongationAtBreak: 0.20,                // fraction (specified minimum)
        thermalConductivity: 16.4,              // W/(m·K)
        metadata: {
            family: "Titanium alloy",
            designation: "ASTM Grade 2 (UNS R50400), commercially pure",
            grade: "Grade 2",
            condition: "Annealed (ASTM B265 minimums)",
            productForm: "Strip, sheet, plate",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "nominal", shearModulus: "unverified", poissonRatio: "unverified",
                thermalExpansionCoefficient: "typical", tensileStrength: "specified-minimum",
                yieldStrength: "specified-minimum", elongationAtBreak: "specified-minimum", thermalConductivity: "typical"
            },
            sources: ["astm-b265", "sdmetals-gr2"],
            caveats: "Strengths are specification minimums (yield limit 275-450 MPa); actual annealed Grade 2 varies with oxygen content. Published modulus ranges 103-107 GPa. Shear modulus and Poisson's ratio are legacy values. Hardness omitted: no verified value."
        }
    },
    
    // ========== MILD STEEL ==========
    "mild-steel": {
        displayName: "Mild Steel (generic low-carbon, unspecified)",
        density: 7850,                          // kg/m³
        youngsModulus: 210e9,                   // Pa
        shearModulus: 80e9,                     // Pa
        poissonRatio: 0.27,                     // dimensionless
        thermalExpansionCoefficient: 11.0e-6,   // 1/°C
        tensileStrength: 340e6,                 // Pa
        yieldStrength: 240e6,                   // Pa
        elongationAtBreak: 0.25,                // fraction
        hardness: 130,                          // Brinell hardness
        thermalConductivity: 50,                // W/(m·K)
        metadata: {
            family: "Carbon steel",
            designation: "Generic low-carbon steel (no standard)",
            grade: "Unspecified",
            condition: "Unspecified",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "unverified", shearModulus: "unverified", poissonRatio: "unverified",
                thermalExpansionCoefficient: "unverified", tensileStrength: "unverified", yieldStrength: "unverified",
                elongationAtBreak: "unverified", hardness: "unverified", thermalConductivity: "unverified"
            },
            sources: [],
            caveats: "Generic legacy entry retained for compatibility with saved work. It has no grade, condition or traceable source. Prefer ASTM A36, AISI 1018 or AISI 4140 for specific work."
        }
    },
    
    // ========== HIGH STRENGTH STEEL ==========
    "high-strength-steel": {
        displayName: "High Strength Steel (ASTM A514)",
        density: 7850,                          // kg/m³
        youngsModulus: 207e9,                   // Pa
        shearModulus: 80e9,                     // Pa
        poissonRatio: 0.27,                     // dimensionless
        thermalExpansionCoefficient: 12.0e-6,   // 1/°C
        tensileStrength: 760e6,                 // Pa (lower bound of the 760-895 MPa specified range)
        yieldStrength: 690e6,                   // Pa (specified minimum, thickness up to 65 mm)
        elongationAtBreak: 0.18,                // fraction (specified minimum, thickness up to 65 mm)
        thermalConductivity: 50,                // W/(m·K)
        metadata: {
            family: "Alloy steel",
            designation: "ASTM A514/A514M",
            grade: "Grade B",
            condition: "Quenched and tempered plate, up to 65 mm (2.5 in) thick",
            productForm: "Plate",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "unverified", shearModulus: "unverified", poissonRatio: "unverified",
                thermalExpansionCoefficient: "unverified", tensileStrength: "specified-minimum",
                yieldStrength: "specified-minimum", elongationAtBreak: "specified-minimum", thermalConductivity: "unverified"
            },
            sources: ["astm-a514", "ssab-a514b"],
            caveats: "Strengths are specification minimums (tensile range 760-895 MPa). Minimum yield drops to 620 MPa for plate over 65 mm. Elastic and thermal values are generic steel values retained from the legacy entry. Hardness omitted: A514 has no hardness requirement."
        }
    },
    
    // ========== CAST IRON ==========
    "cast-iron": {
        displayName: "Cast Iron (Gray, ASTM A48 Class 30)",
        density: 7150,                          // kg/m³
        youngsModulus: 100e9,                   // Pa
        shearModulus: 40e9,                     // Pa
        poissonRatio: 0.26,                     // dimensionless
        thermalExpansionCoefficient: 10.5e-6,   // 1/°C
        tensileStrength: 207e6,                 // Pa (specified minimum, 30 ksi)
        thermalConductivity: 53,                // W/(m·K) at 100 °C
        metadata: {
            family: "Cast iron",
            designation: "ASTM A48/A48M Class 30 gray iron",
            grade: "Class 30",
            condition: "As-cast (separately cast test bar)",
            productForm: "Casting",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "unverified", shearModulus: "unverified", poissonRatio: "unverified",
                thermalExpansionCoefficient: "unverified", tensileStrength: "specified-minimum", thermalConductivity: "typical"
            },
            sources: ["astm-a48", "penticton-a48-30"],
            caveats: "Gray iron has no yield point (nonlinear stress-strain curve from the origin) and is far stronger in compression than in tension, so yield strength and elongation are intentionally omitted. Modulus varies with stress level and section. Typical hardness is 174-210 HB. Strength depends on section thickness."
        }
    },
    
    // ========== MAGNESIUM ==========
    "magnesium": {
        displayName: "Magnesium AZ91D",
        density: 1810,                          // kg/m³
        youngsModulus: 45e9,                    // Pa
        shearModulus: 17e9,                     // Pa
        poissonRatio: 0.35,                     // dimensionless
        thermalExpansionCoefficient: 26e-6,     // 1/°C (0-100 °C mean)
        tensileStrength: 230e6,                 // Pa (typical)
        yieldStrength: 150e6,                   // Pa (typical, 0.2% offset)
        elongationAtBreak: 0.03,                // fraction (typical)
        hardness: 63,                           // Brinell hardness (typical)
        thermalConductivity: 72.7,              // W/(m·K)
        metadata: {
            family: "Magnesium alloy",
            designation: "AZ91D (UNS M11916)",
            grade: "AZ91D",
            condition: "As-cast (F), high-pressure die cast",
            productForm: "Die casting",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "typical", shearModulus: "typical", poissonRatio: "typical",
                thermalExpansionCoefficient: "typical", tensileStrength: "typical", yieldStrength: "typical",
                elongationAtBreak: "typical", hardness: "typical", thermalConductivity: "typical"
            },
            sources: ["azom-az91d"],
            caveats: "Die-cast properties depend on wall thickness and casting porosity. Published yield strength ranges 150-160 MPa. Properties degrade above about 120 °C."
        }
    },

    // ========== ALUMINUM 6061-O ==========
    "aluminum-6061-o": {
        displayName: "Aluminum 6061-O (annealed)",
        density: 2700,
        youngsModulus: 68.9e9,
        shearModulus: 26e9,
        poissonRatio: 0.33,
        tensileStrength: 124e6,
        yieldStrength: 55.2e6,
        elongationAtBreak: 0.25,
        hardness: 30,
        metadata: {
            family: "Aluminum alloy",
            designation: "AA 6061 (UNS A96061)",
            grade: "6061",
            condition: "O temper (annealed)",
            productForm: "Sheet, plate, extrusion",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "typical", shearModulus: "typical", poissonRatio: "typical",
                tensileStrength: "typical", yieldStrength: "typical", elongationAtBreak: "typical", hardness: "typical"
            },
            sources: ["aa-6061-o"],
            caveats: "Aluminum Association typical values (not for design). Elongation is 25% for 1.6 mm sheet and 30% for 12.7 mm round. Poisson's ratio is estimated from similar aluminum alloys. Thermal expansion and conductivity omitted: not stated in the cited sheet."
        }
    },

    // ========== ALUMINUM 2024-T3 ==========
    "aluminum-2024-t3": {
        displayName: "Aluminum 2024-T3",
        density: 2780,
        youngsModulus: 73.1e9,
        poissonRatio: 0.33,
        thermalExpansionCoefficient: 23.2e-6,
        tensileStrength: 483e6,
        yieldStrength: 345e6,
        elongationAtBreak: 0.18,
        hardness: 120,
        thermalConductivity: 121,
        metadata: {
            family: "Aluminum alloy",
            designation: "AA 2024 (UNS A92024)",
            grade: "2024",
            condition: "T3 temper (solution heat treated, cold worked, naturally aged)",
            productForm: "Sheet and plate",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "typical", poissonRatio: "typical",
                thermalExpansionCoefficient: "typical", tensileStrength: "typical", yieldStrength: "typical",
                elongationAtBreak: "typical", hardness: "typical", thermalConductivity: "typical"
            },
            sources: ["aa-2024-t3"],
            caveats: "Typical values; specification minimums are lower and depend on product form and thickness. Poor weldability and corrosion resistance (often clad). Expansion is the 20-100 °C mean; sources quote conductivity of 121-126 W/(m·K). Shear modulus omitted: sources disagree (27.6-28 GPa)."
        }
    },

    // ========== ALUMINUM 7075-T6 ==========
    "aluminum-7075-t6": {
        displayName: "Aluminum 7075-T6",
        density: 2810,
        youngsModulus: 71.7e9,
        poissonRatio: 0.33,
        thermalExpansionCoefficient: 23.6e-6,
        tensileStrength: 572e6,
        yieldStrength: 503e6,
        elongationAtBreak: 0.11,
        hardness: 150,
        thermalConductivity: 130,
        metadata: {
            family: "Aluminum alloy",
            designation: "AA 7075 (UNS A97075)",
            grade: "7075",
            condition: "T6 temper (solution heat treated and artificially aged)",
            productForm: "Plate, sheet, bar",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "typical", poissonRatio: "typical",
                thermalExpansionCoefficient: "typical", tensileStrength: "typical", yieldStrength: "typical",
                elongationAtBreak: "typical", hardness: "typical", thermalConductivity: "typical"
            },
            sources: ["vtech-7075-t6"],
            caveats: "Typical screening values; AMS/ASTM minimums depend on product form and thickness. Susceptible to stress-corrosion cracking; limited weldability. Shear modulus omitted: not confirmed in the cited source. Conductivity is quoted as 130-150 W/(m·K) by different sources."
        }
    },

    // ========== STAINLESS STEEL 316 ==========
    "stainless-316": {
        displayName: "Stainless Steel 316 (annealed)",
        density: 8000,
        youngsModulus: 193e9,
        shearModulus: 77e9,
        poissonRatio: 0.30,
        thermalExpansionCoefficient: 15.9e-6,
        tensileStrength: 515e6,
        yieldStrength: 205e6,
        elongationAtBreak: 0.40,
        thermalConductivity: 16.3,
        metadata: {
            family: "Stainless steel",
            designation: "AISI 316 (UNS S31600)",
            grade: "316",
            condition: "Annealed (ASTM A240 plate, sheet and strip)",
            productForm: "Plate, sheet, strip",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "nominal", shearModulus: "nominal", poissonRatio: "typical",
                thermalExpansionCoefficient: "typical", tensileStrength: "specified-minimum",
                yieldStrength: "specified-minimum", elongationAtBreak: "specified-minimum", thermalConductivity: "typical"
            },
            sources: ["astm-a240", "metals4u-316", "roymech-316"],
            caveats: "Strengths are ASTM A240 annealed minimums. Expansion is the 0-100 °C mean and conductivity is at 100 °C. Hardness omitted: A240 gives only a maximum (217 HBW). Cold-worked 316 is stronger."
        }
    },

    // ========== 17-4 PH H900 ==========
    "stainless-17-4ph-h900": {
        displayName: "Stainless Steel 17-4 PH (H900)",
        density: 7800,
        youngsModulus: 196e9,
        poissonRatio: 0.27,
        thermalExpansionCoefficient: 10.8e-6,
        tensileStrength: 1310e6,
        yieldStrength: 1170e6,
        elongationAtBreak: 0.10,
        metadata: {
            family: "Stainless steel",
            designation: "17-4 PH (UNS S17400, Type 630)",
            grade: "17-4 PH",
            condition: "Condition H900 (aged 482 °C / 900 °F)",
            productForm: "Bar and shapes",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "nominal", youngsModulus: "nominal", poissonRatio: "nominal",
                thermalExpansionCoefficient: "typical", tensileStrength: "specified-minimum",
                yieldStrength: "specified-minimum", elongationAtBreak: "specified-minimum"
            },
            sources: ["astm-a564", "tpm-17-4ph", "mechcodex-17-4ph"],
            caveats: "Strengths are ASTM A564 H900 minimums (hardness 40 HRC minimum). Density spans 7750-7806 kg/m³ across sources. Expansion is the 20-100 °C mean. Shear modulus and conductivity omitted: only secondary single-source values were found. Low toughness in H900."
        }
    },

    // ========== AISI 1018 COLD DRAWN ==========
    "steel-1018-cold-drawn": {
        displayName: "Steel AISI 1018 (cold drawn)",
        density: 7870,
        youngsModulus: 205e9,
        shearModulus: 80e9,
        poissonRatio: 0.29,
        thermalExpansionCoefficient: 11.7e-6,
        tensileStrength: 440e6,
        yieldStrength: 370e6,
        elongationAtBreak: 0.15,
        hardness: 126,
        thermalConductivity: 51.9,
        metadata: {
            family: "Carbon steel",
            designation: "AISI 1018 (UNS G10180)",
            grade: "1018",
            condition: "Cold drawn",
            productForm: "Bar",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "nominal", shearModulus: "nominal", poissonRatio: "nominal",
                thermalExpansionCoefficient: "unverified", tensileStrength: "typical", yieldStrength: "typical",
                elongationAtBreak: "typical", hardness: "typical", thermalConductivity: "typical"
            },
            sources: ["matweb-1018-cd"],
            caveats: "Typical values for cold-drawn bar; yield and hardness fall with bar size. Modulus is the typical-for-steel value (MatWeb lists 200-205 GPa). Expansion is the generic low-carbon steel 20-100 °C value and is not stated in the cited record."
        }
    },

    // ========== AISI 4140 ANNEALED ==========
    "steel-4140-annealed": {
        displayName: "Steel AISI 4140 (annealed)",
        density: 7850,
        youngsModulus: 205e9,
        shearModulus: 80e9,
        poissonRatio: 0.29,
        tensileStrength: 655e6,
        yieldStrength: 415e6,
        elongationAtBreak: 0.257,
        hardness: 197,
        thermalConductivity: 42.6,
        metadata: {
            family: "Alloy steel",
            designation: "AISI 4140 (UNS G41400)",
            grade: "4140",
            condition: "Annealed at 815 °C, furnace cooled to 665 °C, air cooled; 25 mm round",
            productForm: "Bar (25 mm round)",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "nominal", shearModulus: "nominal", poissonRatio: "nominal",
                tensileStrength: "typical", yieldStrength: "typical",
                elongationAtBreak: "typical", hardness: "typical", thermalConductivity: "typical"
            },
            sources: ["matweb-4140-annealed", "efunda-4140"],
            caveats: "Applies only to the stated annealed condition and 25 mm section; quenched-and-tempered 4140 is much stronger and is not covered. Expansion (20-100 °C) and conductivity (100 °C) come from eFunda and a different heat treatment of 4140."
        }
    },

    // ========== Ti-6Al-4V GRADE 5 ANNEALED ==========
    "titanium-grade-5": {
        displayName: "Titanium Ti-6Al-4V (Grade 5, annealed)",
        density: 4430,
        youngsModulus: 113.8e9,
        poissonRatio: 0.342,
        tensileStrength: 895e6,
        yieldStrength: 828e6,
        elongationAtBreak: 0.10,
        metadata: {
            family: "Titanium alloy",
            designation: "Ti-6Al-4V Grade 5 (UNS R56400)",
            grade: "Grade 5",
            condition: "Annealed (ASTM B265 minimums)",
            productForm: "Sheet and plate",
            referenceTemperatureC: 20,
            propertyBasis: {
                density: "typical", youngsModulus: "typical", poissonRatio: "typical",
                tensileStrength: "specified-minimum", yieldStrength: "specified-minimum", elongationAtBreak: "specified-minimum"
            },
            sources: ["astm-b265", "matweb-ti64-annealed"],
            caveats: "Strengths are ASTM B265 annealed minimums; typical annealed values are about 950 MPa tensile and 880 MPa yield (36 HRC). Solution-treated-and-aged Grade 5 is stronger and not covered. Shear modulus, thermal expansion and conductivity omitted: not confirmed in the cited record."
        }
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
    if (!material || !(propertyName in material)) {
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
 * Gets the optional descriptive metadata (family, grade, condition, sources,
 * caveats, propertyBasis) for a material
 * @param {string} materialKey - Key from materialDatabase
 * @returns {object|null} Metadata object, or null if unavailable
 */
function getMaterialMetadata(materialKey) {
    const material = materialDatabase[materialKey];
    return material && material.metadata ? material.metadata : null;
}

/**
 * Gets how a property value is classified (see MATERIAL_PROPERTY_BASES)
 * @returns {string|null} "typical", "nominal", "specified-minimum", "unverified", or null
 */
function getMaterialPropertyBasis(materialKey, propertyName) {
    const metadata = getMaterialMetadata(materialKey);
    return metadata && metadata.propertyBasis && metadata.propertyBasis[propertyName] || null;
}

/**
 * Gets the source records cited by a material
 * @returns {array} Array of {title, publisher, identifier?, url?} objects
 */
function getMaterialSources(materialKey) {
    const metadata = getMaterialMetadata(materialKey);
    return ((metadata && metadata.sources) || []).map((id) => materialReferences[id]).filter(Boolean);
}

/**
 * Gets materials grouped by family for grouped selectors. Materials without
 * metadata fall into "Other". Group and item order follow the database order.
 * @returns {array} Array of {family, materials: [{key, displayName}]}
 */
function getMaterialListGrouped() {
    const groups = [];
    for (const key in materialDatabase) {
        const metadata = materialDatabase[key].metadata;
        const family = metadata && metadata.family ? metadata.family : "Other";
        let group = groups.find((item) => item.family === family);
        if (!group) {
            group = { family: family, materials: [] };
            groups.push(group);
        }
        group.materials.push({ key: key, displayName: materialDatabase[key].displayName });
    }
    return groups;
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
