# Copilot prompt — integrate the Formula Foundry brand

Paste this into Copilot Chat (VS Code) with your website project open.
Prerequisite: copy the `assets/brand/` files and `integration/brand.css`
into your project first (see steps below).

---

I have a brand kit in `assets/brand/` for FORMULA FOUNDRY with these files:

- `formula-foundry-logo-horizontal.svg` / `-reversed.svg` (header lockup, light/dark)
- `formula-foundry-logo-stacked.svg` / `-reversed.svg` (stacked + tagline)
- `formula-foundry-icon.svg` / `-reversed.svg` / `-mono.svg` (icon only)
- `formula-foundry-pattern-grid-light.svg` / `-dark.svg` (tileable grid bg)
- `formula-foundry-hero-drafting-light.svg` / `-dark.svg` (hero bg)
- `formula-foundry-favicon-64.png`, `formula-foundry-favicon-180.png`

Brand tokens (already in `integration/brand.css` — merge into my stylesheet
or link that file):
graphite #26282B, warm white #FAF7F2, copper #C05621 (accent only),
muted #6F7378. Font stack: Archivo, Inter, system-ui.

Do the following in my vanilla HTML/CSS/JS site, no frameworks:

1. Add the favicon `<link>` tags to `<head>` (see `integration/snippets.html`).
2. Replace the site header wordmark/logo with the horizontal logo SVG.
   Support dark mode: use the `<picture>` + `prefers-color-scheme` approach
   from the snippets (or my existing `data-theme` toggle if I have one —
   check first and match it).
3. Give the hero section the drafting background (`.ff-hero` / `.ff-hero-dark`
   classes from brand.css, matching the page theme).
4. Use the tileable grid (`.ff-bg-grid`) on one content section where a
   subtle engineering texture fits — keep it to one or two sections max,
   restrained.
5. Use copper ONLY for small accents (buttons, links on hover, key highlights).
   Never recolor the logo files themselves.
6. Add the stacked lockup to the footer.

Keep changes minimal and consistent with the existing code style. Show me a
diff-style summary of every file you touched. Do not add build tools,
frameworks, or external font CDN calls unless I ask.
