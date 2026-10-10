# FORMULA FOUNDRY — Brand Identity (v5)

## Concept
The mark is a mirrored **FF monogram** — the two F's stand back to back
(one backwards, one forwards) with their stems separated by one bar-width
of clear space instead of shared, so the letters stay distinct at any
size. Both mid-bars are copper: the "result" band running through the
mark. Behind the letterforms sits a minimal **gear**: a symmetric 12-tooth
ring with hub, drawn at low opacity — a quiet machine-shop reference in
the spirit of the Engineers Edge logo gear, never competing with the mark.
Bold geometry, consistent 8-unit bar weights, sharp corners. No
lightbulbs.

## Color
| Token | Hex | Use |
|---|---|---|
| Graphite | `#26282B` | Primary ink on light backgrounds |
| Warm white | `#FAF7F2` | Ink on dark backgrounds / light surfaces |
| Copper | `#C05621` | Restrained accent (icon mid-bar only) |
| Muted gray | `#6F7378` | Tagline on light |
| Warm gray | `#B9B2A7` | Tagline on dark |

The identity works in full color, in monochrome (see `-mono` files), and on
both light and dark backgrounds (see `-reversed` files).

## Typography
Wordmark and tagline are set in **Archivo** (SIL Open Font License) and
converted to outlined vector paths — no font dependency in the SVG files.
- Wordmark: Archivo Bold, uppercase, +4.5% tracking
- Tagline: "WHERE CALCULATIONS BECOME ENGINEERING" — Archivo Medium,
  uppercase, +34% tracking

## Files
| File | Use |
|---|---|
| `formula-foundry-logo-horizontal.svg` | Primary lockup — website header, docs |
| `formula-foundry-logo-horizontal-reversed.svg` | Primary lockup for dark backgrounds |
| `formula-foundry-logo-stacked.svg` | Stacked lockup + tagline — report covers, title slides |
| `formula-foundry-logo-stacked-reversed.svg` | Stacked for dark backgrounds |
| `formula-foundry-icon.svg` | Icon only — app icon base, social avatar |
| `formula-foundry-icon-reversed.svg` | Icon for dark backgrounds |
| `formula-foundry-icon-mono.svg` | Single-color icon — engraving, single-ink print, fax-era resilience |
| `formula-foundry-logo-*.png` | High-res transparent PNGs of the lockups |
| `formula-foundry-icon-512.png` | 512px icon (app stores, touch icons) |
| `formula-foundry-favicon-64.png` / `-180.png` | Browser favicon / Apple touch icon |
| `formula-foundry-pattern-grid-light.svg` / `-dark.svg` | Tileable engineering grid — CSS `background-image` with `repeat` |
| `formula-foundry-hero-drafting-light.svg` / `-dark.svg` | 1600×900 hero background: grid + faint compass circles, registration marks, dimension line |
| `integration/brand.css` | Brand tokens + helper classes (grid/hero backgrounds, buttons) |
| `integration/snippets.html` | Copy/paste: favicons, header logo (dark-mode swap), hero, footer |
| `integration/COPILOT-PROMPT.md` | Ready-to-paste Copilot Chat prompt for site integration |
| `brand-sheet.png` | One-page overview of the system |

All SVGs have transparent backgrounds and tight view boxes.

## Usage rules
- **Clear space:** keep empty space around the logo equal to the icon's bar
  height (8 units) on all sides, minimum.
- **Minimum sizes:** horizontal lockup 120px wide digital / 30mm print;
  icon 16px digital / 6mm print.
- **Don'ts:** no gradients, shadows, outlines, or recoloring outside the
  palette; don't stretch, rotate, or rearrange the lockups; the copper bar
  stays copper (or goes monochrome with everything else — never another hue).
- **Monochrome:** use the `-mono` icon or set any lockup to a single ink
  color when reproduction demands it.

## Regenerating
`build/build_logo.py` rebuilds every file from scratch (needs `fontTools`
and `PIL`, fetches nothing at build time — fonts are vendored in
`build/fonts/`). Edit geometry/tokens at the top of the script and re-run.
