# `js/engineering-units.js` — Engineering Core Reference

## Overview

`js/engineering-units.js` is the shared engineering foundation for **Engineering Calcs Pro**. Every calculator in the repository loads this file first, before its own logic runs. It provides a single, authoritative source of truth for:

- Unit conversion tables and conversion helper functions
- An engineering material property database
- Material utility functions for populating UI dropdowns and reading property values

Rather than scattering unit conversion logic or material constants across individual calculator scripts, this file centralizes those concerns in one place. Every calculator can rely on consistent behavior, and improvements to the core benefit all calculators simultaneously.

---

## What It Contains

### 1. Unit Conversion Tables

Each unit category is defined as a plain JavaScript object whose keys are unit symbols and whose values are the multiplication factor needed to convert that unit into its SI base unit.

| Category | SI Base Unit | Supported Units |
|---|---|---|
| Force | Newton (N) | `N`, `kN`, `lbf` |
| Distance / Length | Meter (m) | `mm`, `cm`, `m`, `in`, `ft` |
| Moment / Torque | Newton-meter (N·m) | `N·mm`, `N·m`, `kN·m`, `lbf·in`, `lbf·ft` |
| Stress / Pressure | Pascal (Pa) | `Pa`, `MPa`, `GPa`, `psi`, `ksi` |
| Area Moment of Inertia | m⁴ | `mm⁴`, `cm⁴`, `m⁴`, `in⁴` |
| Distributed Load | N/m | `N/m`, `kN/m`, `lbf/ft` |
| Temperature Change | °C / K increment | `°C`, `K`, `°F` |

Temperature changes are handled separately because converting a *temperature interval* (e.g., a 10 °F rise) is different from converting an *absolute temperature*. A Fahrenheit interval is divided by 1.8 to convert to a Celsius interval; Kelvin intervals are already equal to Celsius intervals.

**Example — Force conversion table:**

```javascript
const forceUnits = {
    N: 1,
    kN: 1000,
    lbf: 4.4482216152605
};
```

---

### 2. Conversion Helper Functions

Each unit category has a corresponding conversion function. These functions accept a numeric value and the unit it is expressed in, and return the equivalent value in SI base units.

| Function | Returns |
|---|---|
| `convertForce(value, fromUnit)` | Newtons (N) |
| `convertDistance(value, fromUnit)` | Meters (m) |
| `convertMoment(value, fromUnit)` | Newton-meters (N·m) |
| `convertStress(value, fromUnit)` | Pascals (Pa) |
| `convertModulus(value, fromUnit)` | Pascals (Pa) — alias for `convertStress` |
| `convertAreaMomentInertia(value, fromUnit)` | Meters⁴ (m⁴) |
| `convertDistributedLoad(value, fromUnit)` | Newtons per meter (N/m) |
| `convertTemperatureChange(value, fromUnit)` | Celsius increment (°C) |
| `convertMaterialProperty(value, fromUnit, propertyType)` | SI units (varies by property type) |

**Example — Converting a user-entered force:**

```javascript
// User entered 500 lbf
const forceInNewtons = convertForce(500, "lbf");
// forceInNewtons === 2224.11
```

Calculator scripts call these functions to normalize user inputs to SI before performing calculations. If a result needs to be displayed in a different unit, the calculator divides by the target unit's conversion factor.

---

### 3. Material Property Database

The `materialDatabase` object contains engineering property data for ten common structural and mechanical materials. Each material is keyed by a short identifier string and includes the following properties, all stored in SI units:

| Property | SI Unit | Description |
|---|---|---|
| `displayName` | — | Human-readable name for UI display |
| `density` | kg/m³ | Mass per unit volume |
| `youngsModulus` | Pa | Elastic (tensile) modulus |
| `shearModulus` | Pa | Shear modulus of rigidity |
| `poissonRatio` | dimensionless | Lateral-to-axial strain ratio |
| `thermalExpansionCoefficient` | 1/°C | Linear coefficient of thermal expansion |
| `tensileStrength` | Pa | Ultimate tensile strength |
| `yieldStrength` | Pa | 0.2% offset yield strength |
| `elongationAtBreak` | decimal fraction | Ductility (e.g., 0.25 = 25%) |
| `hardness` | Brinell (HB) | Surface hardness |
| `thermalConductivity` | W/(m·K) | Ability to conduct heat |

**Materials currently in the database:**

| Key | Display Name |
|---|---|
| `carbon-steel` | Carbon Steel (AISI 1020) |
| `stainless-steel` | Stainless Steel (304) |
| `aluminum` | Aluminum (6061-T6) |
| `copper` | Copper (C11000) |
| `brass` | Brass (Cu-30Zn) |
| `titanium` | Titanium Grade 2 |
| `mild-steel` | Mild Steel (Low Carbon) |
| `high-strength-steel` | High Strength Steel (ASTM A514) |
| `cast-iron` | Cast Iron (Gray) |
| `magnesium` | Magnesium AZ91D |

---

### 4. Material Utility Functions

Four helper functions provide clean access to the material database for calculator scripts and UI components.

#### `getMaterial(materialKey)`

Returns the full property object for a given material key, or `null` if the key is not found.

```javascript
const props = getMaterial("aluminum");
// props.youngsModulus === 68.9e9 (Pa)
```

#### `getMaterialProperty(materialKey, propertyName)`

Returns a single property value from a material, or `null` if either the material or the property does not exist.

```javascript
const E = getMaterialProperty("carbon-steel", "youngsModulus");
// E === 200e9 (Pa)
```

#### `getMaterialList()`

Returns an array of all material key strings. Useful for iteration.

```javascript
const keys = getMaterialList();
// ["carbon-steel", "stainless-steel", "aluminum", ...]
```

#### `getMaterialListFormatted()`

Returns an array of `{ key, displayName }` objects, ready to be used for populating `<select>` dropdowns in calculator pages.

```javascript
const items = getMaterialListFormatted();
// [{ key: "carbon-steel", displayName: "Carbon Steel (AISI 1020)" }, ...]
```

---

## How It Is Used by Calculators

Every calculator page in `calculators/` loads `engineering-units.js` as the first script tag, before any calculator-specific files. This guarantees that the conversion functions and material database are available in the global scope when the calculator's own logic executes.

**Example — script loading order in `bolt-torque.html`:**

```html
<script src="../js/engineering-units.js"></script>
<script src="../js/bolt-database.js"></script>
<script src="../js/bolt-torque.js"></script>
```

**Example — script loading order in `thermal-expansion.html`:**

```html
<script src="../js/engineering-units.js"></script>
<script src="../js/thermal-expansion.js"></script>
```

Inside the calculator scripts, the pattern is consistent:

1. Read the user's input value from a form field
2. Read the user's selected unit from a dropdown
3. Call the appropriate conversion function to get an SI value
4. Perform the calculation in SI
5. Convert the result back to the user's chosen output unit for display

**Example — unit conversion inside a calculator script:**

```javascript
const rawForce = parseFloat(document.getElementById("force").value);
const forceUnit = document.getElementById("forceUnit").value;

// Normalize to SI
const forceN = convertForce(rawForce, forceUnit);

// Perform calculation...
const momentNm = forceN * armLengthM;

// Convert result to user's output unit
const outputUnit = document.getElementById("momentUnit").value;
const resultDisplay = momentNm / momentUnits[outputUnit];
```

---

## How It Connects to the Rest of the App

```
index.html  (homepage)
    └── js/calculator-data.js     (catalog metadata, no engineering-units dependency)
    └── js/homepage.js            (search/display, no engineering-units dependency)

calculators/moment.html
    └── js/engineering-units.js   ← shared core
    └── js/moment.js

calculators/bolt-torque.html
    └── js/engineering-units.js   ← shared core
    └── js/bolt-database.js       (bolt size tables, uses DOM but not engineering-units directly)
    └── js/bolt-torque.js

calculators/stress-strain.html
    └── js/engineering-units.js   ← shared core
    └── js/stress-strain.js

calculators/shaft-torsion.html
    └── js/engineering-units.js   ← shared core
    └── js/shaft-torsion.js

calculators/beam-deflection.html
    └── js/engineering-units.js   ← shared core
    └── js/beam-deflection.js

calculators/thermal-expansion.html
    └── js/engineering-units.js   ← shared core
    └── js/thermal-expansion.js
```

`engineering-units.js` has no dependencies of its own. It does not import or reference any other file in the repository. All other calculator scripts depend on it, but it depends on nothing. This makes it the stable base layer of the app.

---

## Why Centralizing These Utilities Is Beneficial

### Consistency
All calculators use the same conversion factors. There is no risk of one calculator using a slightly different value for `lbf` to Newtons while another uses a rounded version.

### Maintainability
If a conversion factor or material property needs to be updated, it is changed in exactly one place. All calculators pick up the change automatically.

### Reduced duplication
Without a shared file, each calculator page would need to redefine the same `forceUnits` object, the same `convertDistance` function, and its own copy of material data. That creates drift and inconsistency over time.

### Easier onboarding
A new calculator author only needs to load `engineering-units.js` and they immediately have access to the full unit system and material database. There is no need to understand or copy existing conversion logic.

### Testability
A centralized file can be tested independently of any calculator page. A future test suite could import `engineering-units.js` and verify every conversion factor and material property without loading a browser or any HTML.

---

## How It Can Scale Into a Future Engineering Core Library

`engineering-units.js` is already structured in a way that makes it straightforward to extend. The following directions are natural next steps as the calculator collection grows.

### Add More Unit Categories

The existing conversion tables all follow the same pattern. Adding support for new physical quantities means adding a new constant object and a new conversion function in the same style:

- `velocityUnits` (m/s base) — for flow and dynamics calculators
- `powerUnits` (W base) — for motor and energy calculators
- `energyUnits` (J base) — for thermodynamic calculators
- `pressureDropUnits` — for fluid system calculators
- `angularUnits` (rad base) — for rotation and gear calculators
- `viscosityUnits` — for lubrication and fluid film calculators
- `frequencyUnits` (Hz base) — for vibration and fatigue calculators

### Expand the Material Database

The `materialDatabase` object can grow to include additional material classes:

- **Structural:** concrete, timber, masonry, fiber composites
- **Polymers:** PEEK, nylon, ABS, polycarbonate, UHMW
- **Alloys:** tool steels, superalloys (Inconel, Hastelloy), duplex stainless steels
- **Fastener grades:** SAE grades, metric property classes (8.8, 10.9, 12.9)
- **Custom materials:** project-specific entries defined by the user

### Add Temperature-Dependent Properties

Engineering material properties change with temperature. The database could be extended to include property arrays indexed by temperature, allowing calculators to interpolate at the operating temperature:

```javascript
"carbon-steel": {
    youngsModulusVsTemp: [
        { tempC: 20,  value: 200e9 },
        { tempC: 200, value: 193e9 },
        { tempC: 400, value: 178e9 }
    ]
}
```

### Add Standard Identifiers

Properties like ASTM designation, ISO grade, and UNS number could be added to each material entry. This would allow calculators to display standard references alongside calculated results, which is important for engineering documentation.

### Support Allowable Stress Tables

Pressure vessel, piping, and structural calculators often need allowable stress values at temperature from code tables (ASME, AISC, Eurocode). These tables could be added as additional nested objects in the material entries.

### Create Calculator-Specific Views

Different calculators only need a subset of material properties. A lightweight helper function can extract only the fields needed by a given calculator type, reducing the cognitive load for calculator authors:

```javascript
function getMaterialForBeamCalc(key) {
    const m = getMaterial(key);
    return m ? { youngsModulus: m.youngsModulus, density: m.density } : null;
}
```

### Modularize for Larger Projects

If the repository grows significantly, `engineering-units.js` could be split into focused modules and reassembled through a central entry point:

```
js/
├── core/
│   ├── units/
│   │   ├── force.js
│   │   ├── length.js
│   │   ├── moment.js
│   │   ├── stress.js
│   │   └── temperature.js
│   ├── materials/
│   │   ├── steels.js
│   │   ├── aluminum.js
│   │   └── index.js
│   └── engineering-units.js    ← re-exports everything from submodules
```

Calculator pages would still load a single `engineering-units.js`, but the internal structure would be more maintainable as the codebase grows.

---

## Summary

`js/engineering-units.js` is the engineering core of the app. It is:

- **Loaded first** — before any calculator-specific logic
- **Globally available** — all conversion functions and material data are in scope for every calculator
- **Self-contained** — no dependencies on other files in the repository
- **Extensible** — new units, materials, and properties can be added in the existing pattern without changing the API that calculator scripts rely on

It is the single point of truth for how this application understands engineering units and materials, and it is the right place to grow as the calculator library expands.
