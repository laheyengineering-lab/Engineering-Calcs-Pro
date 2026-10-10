# Formula Foundry Branding

Public brand: **FORMULA FOUNDRY**. Tagline: "WHERE CALCULATIONS BECOME ENGINEERING" (secondary only; used in the homepage title). The repository name and internal identifiers still say Engineering Calcs Pro and are unchanged.

## Asset layout (`assets/brand/`)

| Folder | Contents |
|---|---|
| `logos/` | Horizontal, horizontal-reversed, stacked, stacked-reversed lockups (SVG; PNG for horizontal, horizontal-reversed, stacked) |
| `icons/` | Icon (color, reversed, mono) SVGs, `icon.png`, `icon-512.png`, `favicon-64.png`, `favicon-180.png` |
| `patterns/` | Tileable grid and drafting hero backgrounds (light/dark SVG). Supplied but not currently used. |
| `reference/` | `brand-sheet.png` and the kit's integration helpers (`kit-brand.css`, `kit-snippets.html`, prompt). Reference only; do not link from pages. |
| `source/` | `build_logo.py` and the Archivo fonts used to generate the artwork. Not referenced by the site. |

`assets/brand/README.md` is the kit's original usage guide (clear space, minimum sizes, don'ts).

## Usage

- Header (dark graphite background): `logos/formula-foundry-logo-horizontal-reversed.svg`, class `brand-logo`, 274x34 intrinsic ratio, 28px high on mobile. Minimum 120px wide.
- Light backgrounds: `logos/formula-foundry-logo-horizontal.svg`.
- Favicon: `icons/formula-foundry-icon.svg`, `favicon-64.png`; Apple touch icon: `favicon-180.png`.
- Social previews: `og:image` points to `/assets/brand/logos/formula-foundry-logo-horizontal.png`. Limitation: the kit has no dedicated 1200x630 social image and the PNG is transparent; create one if richer previews are needed. Also use an absolute URL once the canonical domain is set.
- Never recolor, stretch, or recreate the logo.

## Colors

| Token | Hex | Use |
|---|---|---|
| Graphite | `#26282B` | Text, header, hero (`--color-navy-900`, `--color-text`) |
| Warm white | `#FAF7F2` | Page background (`--color-bg`) |
| Copper | `#C05621` | Restrained accent: links, buttons, focus (`--color-accent`; hover `#9C4519`) |
| Muted gray | `#6F7378` (kit) | Tagline; site body muted text uses darker `#5C6066` for contrast |

## Typography

The kit specifies Archivo (SIL OFL). The font is not bundled as a web font; `--font-sans` lists Archivo first, falling back to Segoe UI/system fonts. Logo text is outlined in the SVGs, so no font is needed for it. To self-host Archivo, copy a license-compliant webfont and add `@font-face` in `css/style.css`.
