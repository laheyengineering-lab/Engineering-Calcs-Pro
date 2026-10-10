#!/usr/bin/env python3
"""FORMULA FOUNDRY identity builder.

Builds the full logo system as true vector SVG (text converted to outlined
paths via fontTools) and renders high-res PNG previews with PIL using the
same layout code, so previews match the vectors exactly.

Run:  python3 build/build_logo.py
"""
import os
import math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "build", "fonts")

# ---- Brand tokens -----------------------------------------------------------
GRAPHITE = "#26282B"     # deep graphite ink
WARM_WHITE = "#FAF7F2"    # warm white ink (reversed)
COPPER = "#C05621"       # burnt-orange / copper accent
MUTED = "#6F7378"        # tagline gray on light
WARM_GRAY = "#B9B2A7"    # tagline gray on dark

WORDMARK = "FORMULA FOUNDRY"
TAGLINE = "WHERE CALCULATIONS BECOME ENGINEERING"

# Icon v5: back-to-back mirrored F's (left F backwards, right F forwards)
# with the stems separated by one bar-width gap — nothing touches. 64x40
# grid, 8-unit bar system. Behind the letterforms sits a minimal symmetric
# gear ring: 12 evenly spaced trapezoid teeth, hub ring, low opacity.
# Roles: ink / accent.
ICON_RECTS = [
    (20, 0, 8, 40, "ink"),      # F1 stem (right side — mirrored F)
    (0, 0, 28, 8, "ink"),       # F1 top bar (extends left)
    (6, 16, 22, 8, "accent"),   # F1 mid bar, copper
    (36, 0, 8, 40, "ink"),      # F2 stem (left side)
    (36, 0, 28, 8, "ink"),      # F2 top bar (extends right)
    (36, 16, 22, 8, "accent"),  # F2 mid bar, copper
]
ICON_W, ICON_H = 64.0, 40.0
# Speed square triangle, local coords (right angle at top-left, like the tool).
# Legs 80 — clearly larger than the 64x40 mark so it reads as a background
# element sweeping across the logo, hypotenuse at 45 deg.
# Gear ring behind the mark: symmetric 12-tooth ring like the
# Engineers Edge logo gear (researched 2026-10-10).
GEAR_TEETH, GEAR_R_TIP, GEAR_R_ROOT, GEAR_R_HUB = 12, 36.0, 29.5, 16.0
GEAR_CX, GEAR_CY = 32.0, 20.0  # gear center = mark center

_fonts = {}


def get_font(weight):
    if weight not in _fonts:
        _fonts[weight] = TTFont(os.path.join(FONTS, f"Archivo-{weight}.ttf"))
    return _fonts[weight]


def ttf_path(weight):
    return os.path.join(FONTS, f"Archivo-{weight}.ttf")


def shaped(weight, text, tracking_em):
    """Shape text -> list of (char, glyph_name, path_d, bounds, pen_x, advance)."""
    font = get_font(weight)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    track = tracking_em * upm
    out, pen = [], 0.0
    for ch in text:
        if ch == " ":
            adv = hmtx["space"][0]
            out.append((ch, None, None, None, pen, adv))
            pen += adv + track
            continue
        name = cmap[ord(ch)]
        sp = SVGPathPen(gs)
        gs[name].draw(sp)
        bp = BoundsPen(gs)
        gs[name].draw(bp)
        adv = hmtx[name][0]
        out.append((ch, name, sp.getCommands(), bp.bounds, pen, adv))
        pen += adv + track
    return out, pen - track  # drop trailing tracking


# ---- Scene model (shared by SVG + PNG renderers) ----------------------------
def rect_item(x, y, w, h, fill):
    return {"type": "rect", "x": x, "y": y, "w": w, "h": h, "fill": fill}


def text_item(weight, text, cap_h, tracking_em, x, baseline_y, fill):
    font = get_font(weight)
    s = cap_h / font["OS/2"].sCapHeight  # user-units per font unit
    glyphs, total_adv = shaped(weight, text, tracking_em)
    return {"type": "text", "weight": weight, "glyphs": glyphs, "s": s,
            "x": x, "baseline": baseline_y, "fill": fill,
            "width": total_adv * s}


def _place(x0, y0, scale, pt):
    return (x0 + pt[0] * scale, y0 + pt[1] * scale)


def _filled_poly(x0, y0, scale, corners, fill, fill_opacity):
    return {"type": "poly",
            "pts": [_place(x0, y0, scale, p) for p in corners],
            "fill": fill, "fill_opacity": fill_opacity,
            "stroke": None, "stroke_width": 0, "stroke_opacity": 0}


def gear_items(x0, y0, scale, ink):
    """Symmetric toothed gear ring behind the letterforms, low opacity."""
    n, rt, rr = GEAR_TEETH, GEAR_R_TIP, GEAR_R_ROOT
    pitch = 2 * math.pi / n
    tip_half, root_half = 0.42 * pitch / 2, 0.72 * pitch / 2
    outline = []
    for i in range(n):
        a = i * pitch
        for ang, r in ((a - root_half, rr), (a - tip_half, rt),
                       (a + tip_half, rt), (a + root_half, rr)):
            outline.append((GEAR_CX + r * math.cos(ang),
                            GEAR_CY + r * math.sin(ang)))
    items = [{
        "type": "poly",
        "pts": [_place(x0, y0, scale, p) for p in outline],
        "fill": ink, "fill_opacity": 0.05,
        "stroke": ink, "stroke_width": 2.5, "stroke_opacity": 0.28,
    }]
    hub = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        hub.append((GEAR_CX + GEAR_R_HUB * math.cos(a),
                    GEAR_CY + GEAR_R_HUB * math.sin(a)))
    items.append({
        "type": "poly",
        "pts": [_place(x0, y0, scale, p) for p in hub],
        "fill": None, "fill_opacity": 0,
        "stroke": ink, "stroke_width": 2.0, "stroke_opacity": 0.28,
    })
    return items


def icon_items(x0, y0, scale, ink, accent):
    items = gear_items(x0, y0, scale, ink)  # background, behind letters
    for (x, y, w, h, role) in ICON_RECTS:
        items.append(rect_item(x0 + x * scale, y0 + y * scale,
                               w * scale, h * scale,
                               ink if role == "ink" else accent))
    return items


def scene_bbox(items):
    xs, ys = [], []
    for it in items:
        if it["type"] == "rect":
            xs += [it["x"], it["x"] + it["w"]]
            ys += [it["y"], it["y"] + it["h"]]
        elif it["type"] == "poly":
            for (px, py) in it["pts"]:
                xs.append(px)
                ys.append(py)
        else:
            s = it["s"]
            for (_ch, _n, _d, b, pen, _a) in it["glyphs"]:
                if b is None:
                    continue
                xs += [it["x"] + s * (pen + b[0]), it["x"] + s * (pen + b[2])]
                ys += [it["baseline"] - s * b[3], it["baseline"] - s * b[1]]
    return (min(xs), min(ys), max(xs), max(ys))


def f2(v):
    s = f"{v:.2f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


# ---- Lockup composers -------------------------------------------------------
def horizontal(ink, accent, tag_fill):
    s = 1.3  # icon height 52 vs 40 cap height
    items = icon_items(0, 0, s, ink, accent)
    cap_h, gap = 40.0, 22.0
    icon_h = ICON_H * s
    baseline = icon_h / 2 + cap_h / 2  # cap block optically centered on icon
    items.append(text_item(700, WORDMARK, cap_h, 0.045,
                           ICON_W * s + gap, baseline, ink))
    return items


def stacked(ink, accent, tag_fill):
    s = 1.2
    icon_h = ICON_H * s
    cap_h, tag_cap = 38.0, 10.5
    word = text_item(700, WORDMARK, cap_h, 0.045, 0, icon_h + 26 + cap_h, ink)
    tag = text_item(500, TAGLINE, tag_cap, 0.34, 0,
                    icon_h + 26 + cap_h + 22 + tag_cap, tag_fill)
    W = max(ICON_W * s, word["width"], tag["width"])
    dx_icon = (W - ICON_W * s) / 2
    word["x"] = (W - word["width"]) / 2
    tag["x"] = (W - tag["width"]) / 2
    return icon_items(dx_icon, 0, s, ink, accent) + [word, tag]


def icon_only(ink, accent):
    return icon_items(0, 0, 1.0, ink, accent)


# ---- SVG writer -------------------------------------------------------------
def to_svg(items, title="Formula Foundry logo"):
    x0, y0, x1, y1 = scene_bbox(items)
    W, H = x1 - x0, y1 - y0
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{f2(x0)} {f2(y0)} {f2(W)} {f2(H)}" role="img">',
        f"<title>{title}</title>",
    ]
    # background polys first (own attributes each), then grouped rects/text
    for it in items:
        if it["type"] != "poly":
            continue
        attrs = []
        if it.get("fill"):
            attrs.append(f'fill="{it["fill"]}"')
            attrs.append(f'fill-opacity="{it.get("fill_opacity", 1)}"')
        else:
            attrs.append('fill="none"')
        if it.get("stroke"):
            attrs.append(f'stroke="{it["stroke"]}"')
            attrs.append(f'stroke-width="{f2(it["stroke_width"])}"')
            attrs.append(f'stroke-opacity="{it.get("stroke_opacity", 1)}"')
            attrs.append('stroke-linejoin="round"')
        pts = " ".join(f"{f2(px)},{f2(py)}" for (px, py) in it["pts"])
        parts.append(f'<polygon points="{pts}" {" ".join(attrs)}/>')
    by_fill = {}
    for it in items:
        if it["type"] == "rect":
            by_fill.setdefault(("rect", it["fill"]), []).append(it)
        elif it["type"] != "poly":
            by_fill.setdefault(("text", it["fill"]), []).append(it)
    for (kind, fill), group in by_fill.items():
        parts.append(f'<g fill="{fill}">')
        for it in group:
            if kind == "rect":
                parts.append(
                    f'<rect x="{f2(it["x"])}" y="{f2(it["y"])}" '
                    f'width="{f2(it["w"])}" height="{f2(it["h"])}"/>')
            else:
                s = it["s"]
                for (_ch, _n, d, _b, pen, _a) in it["glyphs"]:
                    if d is None:
                        continue
                    tx = it["x"] + pen * s
                    parts.append(
                        f'<path transform="translate({f2(tx)} {f2(it["baseline"])}) '
                        f'scale({s:.6f} {-s:.6f})" d="{d}"/>')
        parts.append("</g>")
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


# ---- PNG renderer (same layout code, PIL rasterization) ---------------------
def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def render_png(items, scale, bg=None):
    """Rasterize a scene with PIL. Glyph x-positions come straight from the
    shaped pen data (tracking included), so PNG matches the SVG exactly."""
    x0, y0, x1, y1 = scene_bbox(items)
    W = int(math.ceil((x1 - x0) * scale))
    H = int(math.ceil((y1 - y0) * scale))
    img = Image.new("RGBA", (W, H),
                    (0, 0, 0, 0) if bg is None else hex_to_rgb(bg) + (255,))
    ox, oy = -x0 * scale, -y0 * scale
    # ruler polygons first, on their own layer behind everything
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for it in items:
        if it["type"] != "poly":
            continue
        pts = [(ox + px * scale, oy + py * scale) for (px, py) in it["pts"]]
        if it.get("fill"):
            od.polygon(pts, fill=hex_to_rgb(it["fill"]) +
                       (int(it["fill_opacity"] * 255),))
        if it.get("stroke"):
            wpx = max(1, int(round(it["stroke_width"] * scale)))
            col = hex_to_rgb(it["stroke"]) + (int(it["stroke_opacity"] * 255),)
            for i in range(len(pts)):
                od.line([pts[i], pts[(i + 1) % len(pts)]],
                        fill=col, width=wpx, joint="curve")
    img = Image.alpha_composite(img, overlay)
    dr = ImageDraw.Draw(img)
    for it in items:
        if it["type"] == "poly":
            continue
        elif it["type"] == "rect":
            dr.rectangle([ox + it["x"] * scale, oy + it["y"] * scale,
                          ox + (it["x"] + it["w"]) * scale,
                          oy + (it["y"] + it["h"]) * scale],
                         fill=hex_to_rgb(it["fill"]))
        else:
            upm = get_font(it["weight"])["head"].unitsPerEm
            size = max(1, int(round(it["s"] * upm * scale)))
            pf = ImageFont.truetype(ttf_path(it["weight"]), size)
            asc, _desc = pf.getmetrics()
            base_y = oy + it["baseline"] * scale - asc
            for (ch, _n, _d, _b, pen_u, _adv_u) in it["glyphs"]:
                if ch == " ":
                    continue
                x_px = ox + (it["x"] + pen_u * it["s"]) * scale
                dr.text((x_px, base_y), ch, font=pf, anchor="la",
                        fill=hex_to_rgb(it["fill"]))
    return img


# ---- Build ------------------------------------------------------------------
def save_svg(name, items, title):
    path = os.path.join(ROOT, name)
    with open(path, "w") as f:
        f.write(to_svg(items, title))
    print("wrote", path)


def save_png(name, items, scale, bg=None):
    path = os.path.join(ROOT, name)
    render_png(items, scale, bg).save(path)
    print("wrote", path)


def paste_centered(sheet, img, cx, top, max_w=None, max_h=None):
    w, h = img.size
    if max_w and w > max_w:
        img = img.resize((max_w, int(h * max_w / w)), Image.LANCZOS)
        w, h = img.size
    if max_h and h > max_h:
        img = img.resize((int(w * max_h / h), max_h), Image.LANCZOS)
        w, h = img.size
    sheet.alpha_composite(img, (int(cx - w / 2), int(top)))


def caption(sheet, dr, text, cx, y, fill, size=30, tracking=0.32):
    pf = ImageFont.truetype(ttf_path(500), size)
    widths = [pf.getlength(c) for c in text]
    total = sum(widths) + tracking * size * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        dr.text((x, y), ch, font=pf, anchor="la", fill=hex_to_rgb(fill))
        x += w + tracking * size


def fit_box(img, max_w, max_h):
    w, h = img.size
    r = min(max_w / w, max_h / h)
    if r < 1:
        img = img.resize((int(w * r), int(h * r)), Image.LANCZOS)
    return img


def brand_sheet(scenes):
    S = 3  # supersample
    W, H = 2200, 1560
    sheet = Image.new("RGBA", (W * S, H * S), hex_to_rgb(WARM_WHITE) + (255,))
    dr = ImageDraw.Draw(sheet)
    # dark lower band
    dr.rectangle([0, 1060 * S, W * S, H * S], fill=hex_to_rgb(GRAPHITE))

    def place(key, scale, cx, top, max_w, max_h, box_top=None, box_h=None):
        img = fit_box(render_png(scenes[key], scale), max_w * S, max_h * S)
        w, h = img.size
        y = top * S if box_top is None else box_top * S + (box_h * S - h) / 2
        sheet.alpha_composite(img, (int(cx * S - w / 2), int(y)))

    # --- light section ---
    place("horizontal", 6, 1100, 120, 1560, 220)
    caption(sheet, dr, "PRIMARY LOCKUP", W * S / 2, 380 * S, MUTED, size=30 * S)

    place("stacked", 6, 660, 500, 920, 360)
    caption(sheet, dr, "STACKED + TAGLINE", 660 * S, 940 * S, MUTED, size=30 * S)
    place("icon", 12, 1540, 520, 360, 360)
    caption(sheet, dr, "ICON", 1540 * S, 940 * S, MUTED, size=30 * S)

    # --- dark section: three cells vertically centered in a 260px box ---
    place("horizontal_rev", 6, 400, 0, 620, 120, box_top=1140, box_h=260)
    place("stacked_rev", 6, 1100, 0, 560, 220, box_top=1140, box_h=260)
    place("icon_rev", 12, 1800, 0, 200, 200, box_top=1140, box_h=260)
    caption(sheet, dr, "REVERSED / DARK BACKGROUNDS", W * S / 2, 1470 * S,
            "#8E9297", size=30 * S)

    sheet = sheet.resize((W, H), Image.LANCZOS)
    sheet.convert("RGB").save(os.path.join(ROOT, "brand-sheet.png"))
    print("wrote", os.path.join(ROOT, "brand-sheet.png"))


def main():
    scenes = {
        "horizontal": horizontal(GRAPHITE, COPPER, MUTED),
        "horizontal_rev": horizontal(WARM_WHITE, COPPER, WARM_GRAY),
        "stacked": stacked(GRAPHITE, COPPER, MUTED),
        "stacked_rev": stacked(WARM_WHITE, COPPER, WARM_GRAY),
        "icon": icon_only(GRAPHITE, COPPER),
        "icon_rev": icon_only(WARM_WHITE, COPPER),
        "icon_mono": icon_only(GRAPHITE, GRAPHITE),
    }
    save_svg("formula-foundry-logo-horizontal.svg", scenes["horizontal"],
             "Formula Foundry logo")
    save_svg("formula-foundry-logo-horizontal-reversed.svg",
             scenes["horizontal_rev"], "Formula Foundry logo (reversed)")
    save_svg("formula-foundry-logo-stacked.svg", scenes["stacked"],
             "Formula Foundry stacked logo")
    save_svg("formula-foundry-logo-stacked-reversed.svg", scenes["stacked_rev"],
             "Formula Foundry stacked logo (reversed)")
    save_svg("formula-foundry-icon.svg", scenes["icon"], "Formula Foundry icon")
    save_svg("formula-foundry-icon-reversed.svg", scenes["icon_rev"],
             "Formula Foundry icon (reversed)")
    save_svg("formula-foundry-icon-mono.svg", scenes["icon_mono"],
             "Formula Foundry icon (monochrome)")

    save_png("formula-foundry-logo-horizontal.png", scenes["horizontal"], 6)
    save_png("formula-foundry-logo-horizontal-reversed.png",
             scenes["horizontal_rev"], 6)
    save_png("formula-foundry-logo-stacked.png", scenes["stacked"], 6)
    save_png("formula-foundry-icon.png", scenes["icon"], 12)

    # favicons
    icon = scenes["icon"]
    render_png(icon, 1).resize((64, 64), Image.LANCZOS).save(
        os.path.join(ROOT, "formula-foundry-favicon-64.png"))
    render_png(icon, 4).resize((180, 180), Image.LANCZOS).save(
        os.path.join(ROOT, "formula-foundry-favicon-180.png"))
    render_png(icon, 8).save(
        os.path.join(ROOT, "formula-foundry-icon-512.png"))
    print("wrote favicons")

    brand_sheet(scenes)


if __name__ == "__main__":
    main()

