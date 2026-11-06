# Material Reference

Reference documentation for the shared `materialDatabase` in `js/engineering-units.js`.

> **Built-in values are reference properties, not certified design allowables.** They are intended for preliminary calculation. Verify every value against the governing specification, mill certificate or supplier data for the actual product, condition, size and temperature before relying on a result. Use the calculator's manual entry fields when you hold better data.

All values are SI (Pa, kg/m³, 1/°C, W/(m·K)); hardness is Brinell (HB); elongation is stored as a decimal fraction and shown here as %. The tables below show GPa/MPa for readability.

## Property classification

Each material's `metadata.propertyBasis` classifies every property it contains:

| Basis | Meaning |
|---|---|
| `typical` (T) | Published typical/average value for the stated condition |
| `nominal` (N) | Handbook/reference value (physical properties such as density, moduli) |
| `specified-minimum` (Min) | Lower bound required by the governing specification. It is **not** a typical value; actual material is usually stronger |
| `unverified` (U?) | Legacy value kept without a confirmed source. Do not rely on it |

A property that could not be established is **omitted** (shown as *unavailable*), never set to 0 or derived from unrelated properties. Consumers receive `null` from `getMaterialProperty()` and leave the manual field unchanged.

Optional `metadata` fields: `family`, `designation`, `grade`, `condition`, `productForm`, `referenceTemperatureC`, `propertyBasis`, `sources` (IDs from the source registry), `caveats`. Helpers: `getMaterialMetadata`, `getMaterialPropertyBasis`, `getMaterialSources`, `getMaterialListGrouped`.

## Summary of corrected legacy values

Existing keys are unchanged, so saved studies and reports still resolve. Saved Design Studies keep their stored result snapshots; adapters that use material reference values are now revision 2. Historical results remain visible and are flagged for explicit recalculation before current reference values are used or compared.

| Key | Property | Before | After | Reason / reference |
|---|---|---|---|---|
| `carbon-steel` (A36) | Yield | 170 MPa | 250 MPa (specified min.) | ASTM A36 plate, thickness ≤203 mm (8 in); thicker plate has a lower minimum |
| | UTS | 250 MPa | 400 MPa (lower bound of 400–550) | ASTM A36 |
| | G / ν / α | 80 GPa / 0.27 / 12.0 | 79.3 GPa / 0.26 / 11.7 | AZoM A36 data |
| | Hardness | 110 HB | removed | A36 has no hardness requirement; value unverified |
| `stainless-steel` (304) | α | 15.9 | 17.2 | 15.9 is the 316 value; 304 is 17.2 |
| | ν / k | 0.305 / 16 | 0.29 / 16.2 | Typical 304 data |
| | Hardness | 217 HB | removed | Exceeds ASTM A240 maximum (201 HB) for annealed 304 |
| `aluminum` (6061-T6) | E / Sy | 69 GPa / 275 MPa | 68.9 GPa / 276 MPa | Aluminum Association typical values |
| `copper` (C11000, annealed) | ρ / E / G | 8960 / 110 GPa / 44 GPa | 8900 / 117 GPa / 43.5 GPa | CDA values |
| | α / k | 16.5 / 401 | 16.9 / 391 | CDA values |
| | Yield | 33 MPa | 69 MPa | O60 temper |
| | Hardness | 40 HB | removed | 40 is a Rockwell F value, not Brinell |
| `brass` (Cu-30Zn) | ρ / E / G / ν / k | 8470 / 100 / 37 / 0.34 / 111 | 8530 / 110 / 40 / 0.38 / 120 | C26000 data. Strengths, α, elongation and hardness are temper-dependent and retained as **unverified** |
| `titanium` (Grade 2) | Elongation | 18% | 20% (specified min.) | ASTM B265. Hardness (160 HB) removed (unverified) |
| `high-strength-steel` (A514) | Yield | 1170 MPa | 690 MPa (specified min.) | ASTM A514 Grade B plate, thickness ≤65 mm (2.5 in) |
| | UTS | 1380 MPa | 760 MPa (lower bound of 760–895) | ASTM A514 Grade B, thickness ≤65 mm (2.5 in) |
| | Elongation | 11% | 18% (specified min.) | Plate specification |
| | Hardness | 380 HB | removed | Unverified |
| `cast-iron` (gray, A48 Class 30) | Yield | 150 MPa | removed | Gray iron has no yield point. Use UTS (tension) and compressive strength |
| | UTS / ρ / G / ν / k | 200 / 7200 / 45 / 0.21 / 50 | 207 MPa / 7150 / 40 GPa / 0.26 / 53 | ASTM A48 Class 30. Elongation and hardness removed (not meaningful as single values) |
| `magnesium` (AZ91D) | Yield / hardness / k | 160 MPa / 80 HB / 51 | 150 MPa / 63 HB / 72.7 | AZoM AZ91D data |
| `mild-steel` | all | — | unchanged | Generic, unspecified legacy entry: kept and labelled unverified |

Display names changed for `copper` ("Copper C11000 (ETP), annealed"), `brass` ("…, temper not specified"), `mild-steel` ("…generic low-carbon, unspecified") and `cast-iron` ("…Gray, ASTM A48 Class 30"); keys are unchanged.

Calculated results that change as a consequence (equations unchanged): any A36 calculation using yield, UTS, G, ν or α (e.g. factor of safety with A36 yield now uses 250 MPa; free thermal expansion of A36 is 2.5% smaller; Hertz pressures shift slightly with ν = 0.26) and A514 strength-based calculations. Tests mark these as intentional data corrections.

The A36 strength values in the entry apply to plate no thicker than 203 mm (8 in); do not apply the 250 MPa yield minimum to thicker plate or to other A36 product forms without checking the governing specification. The A514 entry is specifically Grade B plate no thicker than 65 mm (2.5 in), not a value for all A514 grades or thicknesses. Its minimum yield strength is lower for thicker plate.

## Deferred candidates (not added)

| Candidate | Reason |
|---|---|
| 303 annealed | No confidently established full property set found |
| 1045 normalized | Property values vary with section size/normalizing temperature; no traceable single set |
| 4140 quenched and tempered | Properties depend on tempering temperature; no defined condition could be sourced |
| A2 tool steel, hardened and tempered | Properties depend on austenitizing/tempering schedule; no defined condition could be sourced |
| Acetal (POM), nylon 6/6, PEEK | Polymer properties are grade-, moisture-, temperature- and rate-dependent; a complete, consistent property set (including ν and G) was not established, and the isotropic elastic-metal model used by the calculators is not appropriate without that context |

## Known data gaps

- Many properties are intentionally unavailable (see inventory). Examples: no G for 2024-T3, 7075-T6 and Ti-6Al-4V; no α or k for 6061-O; no α for 4140 annealed; no k for 17-4 PH H900; no hardness for A36, 304, 316, copper, titanium and A514.
- Values are at room temperature (reference temperature per material). Temperature dependence is not modelled.
- Values were compiled from standards and datasheets available at the time. Paywalled standard texts (ASTM) were cited by identifier; the specification minimums quoted are those published in public datasheets.
- Several 17-4 PH, 2024-T3 and 7075-T6 values come from supplier or secondary compilations and are marked accordingly in the source registry.

## Material inventory

### `carbon-steel` — Carbon Steel (ASTM A36 plate)

- Family: Carbon steel; designation: ASTM A36/A36M; grade: A36
- Condition: As-rolled plate, thickness up to 203 mm (8 in)
- Product form: Structural plate up to 203 mm (8 in); reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 7850 | N |
| E GPa | 200 | N |
| G GPa | 79.3 | N |
| ν | 0.26 | N |
| α 1e-6/°C | 11.7 | N |
| UTS MPa | 400 | Min |
| Sy MPa | 250 | Min |
| Elong. % | 23 | Min |
| HB | *unavailable* | — |
| k W/m·K | 50 | N |

Sources: [astm-a36] ASTM International; [azom-a36] AZoM

Caveats: Strengths are specification minimums for the stated plate thickness (tensile range 400-550 MPa); thicker plate has a 220 MPa minimum yield. Typical as-rolled yield is higher. Elongation is 23% minimum in 50 mm (20% in 200 mm). A36 has no hardness requirement.

### `stainless-steel` — Stainless Steel 304

- Family: Stainless steel; designation: AISI 304 (UNS S30400); grade: 304
- Condition: Annealed (ASTM A240 plate, sheet and strip)
- Product form: Plate, sheet, strip; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 8000 | N |
| E GPa | 193 | N |
| G GPa | 77 | N |
| ν | 0.29 | T |
| α 1e-6/°C | 17.2 | T |
| UTS MPa | 515 | Min |
| Sy MPa | 205 | Min |
| Elong. % | 40 | Min |
| HB | *unavailable* | — |
| k W/m·K | 16.2 | T |

Sources: [astm-a240] ASTM International; [metals4u-316] metals4U

Caveats: Strengths are ASTM A240 annealed minimums. Thermal expansion is the 0-100 °C mean and conductivity is quoted at 100 °C (about 15 W/(m·K) at 20 °C in EN data). Cold-worked 304 is stronger. Hardness omitted: A240 gives only a maximum (201 HBW).

### `aluminum` — Aluminum 6061-T6

- Family: Aluminum alloy; designation: AA 6061 (UNS A96061); grade: 6061
- Condition: T6 temper (solution heat treated and artificially aged)
- Product form: Extrusion, plate, bar and sheet; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 2700 | T |
| E GPa | 68.9 | T |
| G GPa | 26 | T |
| ν | 0.33 | T |
| α 1e-6/°C | 23.6 | T |
| UTS MPa | 310 | T |
| Sy MPa | 276 | T |
| Elong. % | 12 | T |
| HB | 95 | T |
| k W/m·K | 167 | T |

Sources: [asm-6061-t6] ASM International / MatWeb

Caveats: Typical (Aluminum Association) values, not minimums; ASTM B221/B209 minimums are lower (for example about 240 MPa yield). Properties drop markedly in weld heat-affected zones and above about 150 °C. Elongation depends on product thickness (8-17%).

### `copper` — Copper C11000 (ETP), annealed

- Family: Copper alloy; designation: UNS C11000 (ETP copper); grade: C11000
- Condition: Annealed (O60 soft anneal)
- Product form: Sheet and bar; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 8900 | N |
| E GPa | 117 | N |
| G GPa | 43.5 | N |
| ν | 0.34 | N |
| α 1e-6/°C | 16.9 | T |
| UTS MPa | 220 | T |
| Sy MPa | 69 | T |
| Elong. % | 45 | T |
| HB | *unavailable* | — |
| k W/m·K | 391 | T |

Sources: [cda-c11000] Copper Development Association values as tabulated by Online Metals

Caveats: Applies only to annealed ETP copper; cold-worked tempers are several times stronger in yield. Hardness omitted: the annealed reference is quoted on the Rockwell F scale (about HRF 40), not Brinell. Thermal conductivity is a CDA value for C11000, below the pure-element 401 W/(m·K).

### `brass` — Brass (Cu-30Zn), temper not specified

- Family: Copper alloy; designation: Cu-30Zn cartridge brass (UNS C26000); grade: C26000
- Condition: Temper not specified
- Product form: Flat products; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 8530 | N |
| E GPa | 110 | N |
| G GPa | 40 | N |
| ν | 0.38 | T |
| α 1e-6/°C | 19 | U? |
| UTS MPa | 330 | U? |
| Sy MPa | 170 | U? |
| Elong. % | 35 | U? |
| HB | 120 | U? |
| k W/m·K | 120 | T |

Sources: [cda-c26000] Online Metals

Caveats: Brass strength depends strongly on temper (annealed yield is roughly 115-125 MPa; half-hard about 250 MPa). The legacy strength, elongation, hardness and expansion values have no confirmed temper or source: use a direct entry for strength-critical work.

### `titanium` — Titanium Grade 2

- Family: Titanium alloy; designation: ASTM Grade 2 (UNS R50400), commercially pure; grade: Grade 2
- Condition: Annealed (ASTM B265 minimums)
- Product form: Strip, sheet, plate; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 4510 | N |
| E GPa | 103 | N |
| G GPa | 39 | U? |
| ν | 0.32 | U? |
| α 1e-6/°C | 8.6 | T |
| UTS MPa | 345 | Min |
| Sy MPa | 275 | Min |
| Elong. % | 20 | Min |
| HB | *unavailable* | — |
| k W/m·K | 16.4 | T |

Sources: [astm-b265] ASTM International; [sdmetals-gr2] S+D Metals

Caveats: Strengths are specification minimums (yield limit 275-450 MPa); actual annealed Grade 2 varies with oxygen content. Published modulus ranges 103-107 GPa. Shear modulus and Poisson's ratio are legacy values. Hardness omitted: no verified value.

### `mild-steel` — Mild Steel (generic low-carbon, unspecified)

- Family: Carbon steel; designation: Generic low-carbon steel (no standard); grade: Unspecified
- Condition: Unspecified
- Product form: n/a; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 7850 | N |
| E GPa | 210 | U? |
| G GPa | 80 | U? |
| ν | 0.27 | U? |
| α 1e-6/°C | 11 | U? |
| UTS MPa | 340 | U? |
| Sy MPa | 240 | U? |
| Elong. % | 25 | U? |
| HB | 130 | U? |
| k W/m·K | 50 | U? |

Sources: none (unverified legacy entry)

Caveats: Generic legacy entry retained for compatibility with saved work. It has no grade, condition or traceable source. Prefer ASTM A36, AISI 1018 or AISI 4140 for specific work.

### `high-strength-steel` — High Strength Steel (ASTM A514)

- Family: Alloy steel; designation: ASTM A514/A514M; grade: Grade B
- Condition: Quenched and tempered plate, up to 65 mm (2.5 in) thick
- Product form: Plate; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 7850 | N |
| E GPa | 207 | U? |
| G GPa | 80 | U? |
| ν | 0.27 | U? |
| α 1e-6/°C | 12 | U? |
| UTS MPa | 760 | Min |
| Sy MPa | 690 | Min |
| Elong. % | 18 | Min |
| HB | *unavailable* | — |
| k W/m·K | 50 | U? |

Sources: [astm-a514] ASTM International; [ssab-a514b] SSAB

Caveats: Strengths are Grade B specification minimums for plate up to 65 mm (tensile range 760-895 MPa). Do not apply these strengths to other A514 grades or thicker plate; minimum yield drops to 620 MPa over 65 mm. Elastic and thermal values are generic steel values retained from the legacy entry. Hardness omitted: A514 has no hardness requirement.

## Elastic-property consistency

The isotropic linear-elastic relation \(G=E/[2(1+\nu)]\) is a useful consistency check, not a requirement to replace independently reported values. With the rounded database values, the largest discrepancies are 304 stainless (given 77 GPa vs 74.8 GPa implied, 2.9%), 316 stainless (77 vs 74.2 GPa implied, 3.7%), and the generic mild-steel entry (80 vs 82.7 GPa implied, 3.2%). A514 is 1.8% low and AZ91D is 2.0% high. The stainless values are retained as independently sourced nominal moduli and typical Poisson ratios (RoyMech); the generic mild-steel values are explicitly unverified. Other entries differ by no more than 2% (rounding/independent tabulation). These are reference properties, not fitted isotropic constants.

### `cast-iron` — Cast Iron (Gray, ASTM A48 Class 30)

- Family: Cast iron; designation: ASTM A48/A48M Class 30 gray iron; grade: Class 30
- Condition: As-cast (separately cast test bar)
- Product form: Casting; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 7150 | T |
| E GPa | 100 | U? |
| G GPa | 40 | U? |
| ν | 0.26 | U? |
| α 1e-6/°C | 10.5 | U? |
| UTS MPa | 207 | Min |
| Sy MPa | *unavailable* | — |
| Elong. % | *unavailable* | — |
| HB | *unavailable* | — |
| k W/m·K | 53 | T |

Sources: [astm-a48] ASTM International; [penticton-a48-30] Penticton Foundry

Caveats: Gray iron has no yield point (nonlinear stress-strain curve from the origin) and is far stronger in compression than in tension, so yield strength and elongation are intentionally omitted. Modulus varies with stress level and section. Typical hardness is 174-210 HB. Strength depends on section thickness.

### `magnesium` — Magnesium AZ91D

- Family: Magnesium alloy; designation: AZ91D (UNS M11916); grade: AZ91D
- Condition: As-cast (F), high-pressure die cast
- Product form: Die casting; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 1810 | T |
| E GPa | 45 | T |
| G GPa | 17 | T |
| ν | 0.35 | T |
| α 1e-6/°C | 26 | T |
| UTS MPa | 230 | T |
| Sy MPa | 150 | T |
| Elong. % | 3 | T |
| HB | 63 | T |
| k W/m·K | 72.7 | T |

Sources: [azom-az91d] AZoM

Caveats: Die-cast properties depend on wall thickness and casting porosity. Published yield strength ranges 150-160 MPa. Properties degrade above about 120 °C.

### `aluminum-6061-o` — Aluminum 6061-O (annealed)

- Family: Aluminum alloy; designation: AA 6061 (UNS A96061); grade: 6061
- Condition: O temper (annealed)
- Product form: Sheet, plate, extrusion; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 2700 | T |
| E GPa | 68.9 | T |
| G GPa | 26 | T |
| ν | 0.33 | T |
| α 1e-6/°C | *unavailable* | — |
| UTS MPa | 124 | T |
| Sy MPa | 55.2 | T |
| Elong. % | 25 | T |
| HB | 30 | T |
| k W/m·K | *unavailable* | — |

Sources: [aa-6061-o] Aerospace Metals / MatWeb

Caveats: Aluminum Association typical values (not for design). Elongation is 25% for 1.6 mm sheet and 30% for 12.7 mm round. Poisson's ratio is estimated from similar aluminum alloys. Thermal expansion and conductivity omitted: not stated in the cited sheet.

### `aluminum-2024-t3` — Aluminum 2024-T3

- Family: Aluminum alloy; designation: AA 2024 (UNS A92024); grade: 2024
- Condition: T3 temper (solution heat treated, cold worked, naturally aged)
- Product form: Sheet and plate; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 2780 | T |
| E GPa | 73.1 | T |
| G GPa | *unavailable* | — |
| ν | 0.33 | T |
| α 1e-6/°C | 23.2 | T |
| UTS MPa | 483 | T |
| Sy MPa | 345 | T |
| Elong. % | 18 | T |
| HB | 120 | T |
| k W/m·K | 121 | T |

Sources: [aa-2024-t3] Components.ca

Caveats: Typical values; specification minimums are lower and depend on product form and thickness. Poor weldability and corrosion resistance (often clad). Expansion is the 20-100 °C mean; sources quote conductivity of 121-126 W/(m·K). Shear modulus omitted: sources disagree (27.6-28 GPa).

### `aluminum-7075-t6` — Aluminum 7075-T6

- Family: Aluminum alloy; designation: AA 7075 (UNS A97075); grade: 7075
- Condition: T6 temper (solution heat treated and artificially aged)
- Product form: Plate, sheet, bar; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 2810 | T |
| E GPa | 71.7 | T |
| G GPa | *unavailable* | — |
| ν | 0.33 | T |
| α 1e-6/°C | 23.6 | T |
| UTS MPa | 572 | T |
| Sy MPa | 503 | T |
| Elong. % | 11 | T |
| HB | 150 | T |
| k W/m·K | 130 | T |

Sources: [vtech-7075-t6] VTECH

Caveats: Typical screening values; AMS/ASTM minimums depend on product form and thickness. Susceptible to stress-corrosion cracking; limited weldability. Shear modulus omitted: not confirmed in the cited source. Conductivity is quoted as 130-150 W/(m·K) by different sources.

### `stainless-316` — Stainless Steel 316 (annealed)

- Family: Stainless steel; designation: AISI 316 (UNS S31600); grade: 316
- Condition: Annealed (ASTM A240 plate, sheet and strip)
- Product form: Plate, sheet, strip; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 8000 | N |
| E GPa | 193 | N |
| G GPa | 77 | N |
| ν | 0.3 | T |
| α 1e-6/°C | 15.9 | T |
| UTS MPa | 515 | Min |
| Sy MPa | 205 | Min |
| Elong. % | 40 | Min |
| HB | *unavailable* | — |
| k W/m·K | 16.3 | T |

Sources: [astm-a240] ASTM International; [metals4u-316] metals4U; [roymech-316] RoyMech

Caveats: Strengths are ASTM A240 annealed minimums. Expansion is the 0-100 °C mean and conductivity is at 100 °C. Hardness omitted: A240 gives only a maximum (217 HBW). Cold-worked 316 is stronger.

### `stainless-17-4ph-h900` — Stainless Steel 17-4 PH (H900)

- Family: Stainless steel; designation: 17-4 PH (UNS S17400, Type 630); grade: 17-4 PH
- Condition: Condition H900 (aged 482 °C / 900 °F)
- Product form: Bar and shapes; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 7800 | N |
| E GPa | 196 | N |
| G GPa | *unavailable* | — |
| ν | 0.27 | N |
| α 1e-6/°C | 10.8 | T |
| UTS MPa | 1310 | Min |
| Sy MPa | 1170 | Min |
| Elong. % | 10 | Min |
| HB | *unavailable* | — |
| k W/m·K | *unavailable* | — |

Sources: [astm-a564] ASTM International; [tpm-17-4ph] True Precision Machining; [mechcodex-17-4ph] MechCodex (secondary compilation)

Caveats: Strengths are ASTM A564 H900 minimums (hardness 40 HRC minimum). Density spans 7750-7806 kg/m³ across sources. Expansion is the 20-100 °C mean. Shear modulus and conductivity omitted: only secondary single-source values were found. Low toughness in H900.

### `steel-1018-cold-drawn` — Steel AISI 1018 (cold drawn)

- Family: Carbon steel; designation: AISI 1018 (UNS G10180); grade: 1018
- Condition: Cold drawn
- Product form: Bar; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 7870 | T |
| E GPa | 205 | N |
| G GPa | 80 | N |
| ν | 0.29 | N |
| α 1e-6/°C | 11.7 | U? |
| UTS MPa | 440 | T |
| Sy MPa | 370 | T |
| Elong. % | 15 | T |
| HB | 126 | T |
| k W/m·K | 51.9 | T |

Sources: [matweb-1018-cd] MatWeb

Caveats: Typical values for cold-drawn bar; yield and hardness fall with bar size. Modulus is the typical-for-steel value (MatWeb lists 200-205 GPa). Expansion is the generic low-carbon steel 20-100 °C value and is not stated in the cited record.

### `steel-4140-annealed` — Steel AISI 4140 (annealed)

- Family: Alloy steel; designation: AISI 4140 (UNS G41400); grade: 4140
- Condition: Annealed at 815 °C, furnace cooled to 665 °C, air cooled; 25 mm round
- Product form: Bar (25 mm round); reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 7850 | T |
| E GPa | 205 | N |
| G GPa | 80 | N |
| ν | 0.29 | N |
| α 1e-6/°C | *unavailable* | — |
| UTS MPa | 655 | T |
| Sy MPa | 415 | T |
| Elong. % | 25.7 | T |
| HB | 197 | T |
| k W/m·K | 42.6 | T |

Sources: [matweb-4140-annealed] MatWeb (as reproduced by Xometry); [efunda-4140] eFunda

Caveats: Applies only to the stated annealed condition and 25 mm section; quenched-and-tempered 4140 is much stronger and is not covered. Conductivity (100 °C) comes from eFunda and a different heat treatment of 4140. Thermal expansion is omitted because no value was established for the stated condition.

### `titanium-grade-5` — Titanium Ti-6Al-4V (Grade 5, annealed)

- Family: Titanium alloy; designation: Ti-6Al-4V Grade 5 (UNS R56400); grade: Grade 5
- Condition: Annealed (ASTM B265 minimums)
- Product form: Sheet and plate; reference temperature: 20 °C

| Property | Value | Basis |
|---|---|---|
| ρ kg/m³ | 4430 | T |
| E GPa | 113.8 | T |
| G GPa | *unavailable* | — |
| ν | 0.342 | T |
| α 1e-6/°C | *unavailable* | — |
| UTS MPa | 895 | Min |
| Sy MPa | 828 | Min |
| Elong. % | 10 | Min |
| HB | *unavailable* | — |
| k W/m·K | *unavailable* | — |

Sources: [astm-b265] ASTM International; [matweb-ti64-annealed] MatWeb

Caveats: Strengths are ASTM B265 annealed minimums; typical annealed values are about 950 MPa tensile and 880 MPa yield (36 HRC). Solution-treated-and-aged Grade 5 is stronger and not covered. Shear modulus, thermal expansion and conductivity omitted: not confirmed in the cited record.

## Source registry

ASTM identifiers below identify the governing specifications, but the paywalled standard text was not directly reviewed in this audit; the quoted minimums are cross-referenced to the public provider records listed alongside them. Public producer/supplier datasheets (including Aalco, SSAB, Penticton Foundry, S+D Metals and True Precision Machining) are distinct from secondary property compilations. MatWeb values reproduced by Xometry, Components.ca, MechCodex, Metals4U, RoyMech, AZoM and eFunda are compilations, not ASTM or Aluminum Association specifications. A listed source does not imply that every property in an entry comes from that source; the condition, property basis and caveats above constrain how each value should be used.

| ID | Title | Publisher | Location |
|---|---|---|---|
| `astm-a36` | ASTM A36/A36M, Standard Specification for Carbon Structural Steel | ASTM International | ASTM A36/A36M |
| `azom-a36` | ASTM A36 Mild/Low Carbon Steel (physical and mechanical properties) | AZoM | https://www.azom.com/article.aspx?ArticleId=6117 |
| `astm-a514` | ASTM A514/A514M, Standard Specification for High-Yield-Strength, Quenched and Tempered Alloy Steel Plate, Suitable for Welding | ASTM International | ASTM A514/A514M |
| `ssab-a514b` | ASTM A514 Grade B product data (minimum yield 100 ksi / 690 MPa) | SSAB | https://www.ssab.com/en-us/brands-and-products/commercial-steel/structural-steel/astm-a514/grade-b |
| `astm-a240` | ASTM A240/A240M, Standard Specification for Chromium and Chromium-Nickel Stainless Steel Plate, Sheet, and Strip | ASTM International | ASTM A240/A240M |
| `astm-a48` | ASTM A48/A48M, Standard Specification for Gray Iron Castings | ASTM International | ASTM A48/A48M |
| `penticton-a48-30` | Gray Iron ASTM A48 Class 30 Data Sheet | Penticton Foundry | https://www.pentictonfoundry.com/news/gray-iron-astm-a48-class-30/ |
| `astm-b265` | ASTM B265, Standard Specification for Titanium and Titanium Alloy Strip, Sheet, and Plate | ASTM International | ASTM B265 |
| `matweb-ti64-annealed` | Titanium Ti-6Al-4V (Grade 5), Annealed (MatWeb/ASM data sheet MTP641) | MatWeb | https://asm.matweb.com/search/SpecificMaterial.asp?bassnum=MTP641&lang=en&lang=en |
| `astm-a564` | ASTM A564/A564M, Standard Specification for Hot-Rolled and Cold-Finished Age-Hardening Stainless Steel Bars and Shapes | ASTM International | ASTM A564/A564M |
| `tpm-17-4ph` | 17-4PH Stainless Machining Datasheet (H900: UTS 190 ksi, yield 170 ksi, E 28.5 Msi) | True Precision Machining | https://www.trueprecisionmachining.com/engineering/datasheets/stainless-17-4ph/ |
| `mechcodex-17-4ph` | 17-4 PH (H900) Properties | MechCodex (secondary compilation) | https://mechcodex.com/materials/17-4-ph-stainless-steel |
| `aalco-304` | Stainless Steel 304 datasheet (flat-rolled ASTM A240/A240M products) | Aalco Metals | https://www.farnell.com/datasheets/33229.pdf |
| `metals4u-316` | 1.4401 Grade 316 Stainless Steel Properties (ASTM A240 minimums, ASM-type physical data) | metals4U (secondary compilation) | https://www.metals4u.co.uk/blog/316-stainless-steel |
| `roymech-304` | 304 Stainless Steel data sheet | RoyMech (secondary compilation) | https://www.roymech.co.uk/material-properties/metals/ferrous-metals/304-Stainless-Steel-Q0006Q |
| `roymech-316` | 316 Stainless Steel data sheet | RoyMech (secondary compilation) | https://www.roymech.co.uk/material-properties/metals/ferrous-metals/316-Stainless-Steel-Q000dQ |
| `matweb-1018-cd` | AISI 1018 Steel, cold drawn (MatWeb data sheet) | MatWeb | https://apm.matweb.com/search/DataSheet.aspx?MatGUID=3a9cc570fbb24d119f08db22a53e2421 |
| `matweb-4140-annealed` | AISI 4140 steel, annealed at 815 °C, furnace cooled to 665 °C, air cooled, 25 mm round (MatWeb data sheet) | MatWeb (as reproduced by Xometry) | https://s3.amazonaws.com/xometry.craft/files/specsheets/datasheet-AISI-4140-steel.pdf |
| `efunda-4140` | Properties of Alloy Steel AISI 4140 | eFunda | https://www.efunda.com/Materials/alloys/alloy_steels/show_alloy.cfm?ID=AISI_4140&show_prop=all&Page_Title=AISI%204140 |
| `asm-6061-t6` | Aluminum 6061-T6; 6061-T651 (ASM Material Data Sheet; Aluminum Association typical values) | ASM International / MatWeb | https://s3.amazonaws.com/xometry.craft/files/specsheets/ASM-Aluminum-6061-T6-Material-Data-Sheet.pdf |
| `aa-6061-o` | Aluminum 6061-O (Aluminum Association typical values) | Aerospace Metals / MatWeb | https://www.aerospacemetals.com/wp-content/uploads/2023/06/Aluminum-6061-O.pdf |
| `aa-2024-t3` | 2024-T3 Aluminum Alloy Properties (typical values citing Aluminum Association and ASM) | Components.ca | https://www.components.ca/knowledge/aluminum-alloys/2024-t3 |
| `vtech-7075-t6` | Technical Data Sheet TDS-AL-7075-T6-QQA250, Aluminum 7075-T6 (screening values) | VTECH | https://vtechadvanced.com/wp-content/uploads/datasheets/TDS-AL-7075-T6-QQA250_RevA.pdf |
| `cda-c11000` | Copper C11000 (ETP) annealed (O60) properties | Copper Development Association values as tabulated by Online Metals | https://www.onlinemetals.com/en/product-guide/alloy/110 |
| `cda-c26000` | Alloy 260 (C26000 cartridge brass) product guide | Online Metals | https://www.onlinemetals.com/en/product-guide/alloy/260 |
| `azom-az91d` | Magnesium AZ91D-F Alloy (UNS M11916) | AZoM | https://www.azom.com/article.aspx?ArticleID=8670 |
| `sdmetals-gr2` | Titanium Grade 2 data sheet (ASTM B265/B348 minimums) | S+D Metals | https://sd-metals.bibus.com/de-en/materials/itm/Titanium-Grade-2/ |
