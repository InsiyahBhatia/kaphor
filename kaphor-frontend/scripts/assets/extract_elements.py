#!/usr/bin/env python3
"""Repeatable sticker-sheet extraction for the Kaphor editorial assets.

Sub-commands
  crop       Cut one named object out of a dense sheet by bounding box.
  build      Run scripts/assets/manifest.json (all shipped editorial art).
  segment    Cut every object out of a sticker sheet (background removed with a
             feathered alpha, neighbouring pieces split into separate files).
  contact    Build labelled contact sheets of a folder of PNGs (review aid).
  icons      Normalise cut-outs to square, consistently padded icon canvases.
  fit        Downscale / recompress PNGs so shipped art stays small.
  audit      Report size, alpha and edge-touch problems for a folder of PNGs.

See scripts/assets/README.md. Requires: pillow numpy scipy opencv-python-headless.
"""
import argparse
import glob
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


# --------------------------------------------------------------------------
# Foreground detection
# --------------------------------------------------------------------------
def foreground_mask(rgb, edge_thr=24.0, close=5, bg_delta=22.0, min_hole=400):
    """Boolean mask of illustrated objects on a smooth / blurry sheet background.

    1. Objects have inked outlines, the background is a smooth gradient, so the
       background is whatever is reachable from the border without crossing a
       strong Lab edge.
    2. Enclosed smooth regions (gaps inside wheels, racks, ribbons) are dropped
       too when their colour matches the extrapolated background colour.
    """
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    b = cv2.GaussianBlur(lab, (0, 0), 0.8)
    gx = cv2.Sobel(b, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(b, cv2.CV_32F, 0, 1, ksize=3)
    g = np.sqrt((gx ** 2 + gy ** 2).sum(2))
    edge = (g > edge_thr).astype(np.uint8)
    edge = cv2.morphologyEx(edge, cv2.MORPH_CLOSE, np.ones((close, close), np.uint8))
    smooth = edge == 0
    lbl, n = ndi.label(smooth)
    border = np.unique(np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]]))
    border = border[border != 0]
    bg = np.isin(lbl, border)

    # extrapolated background colour from exterior pixels
    w = bg.astype(np.float32)
    num = cv2.GaussianBlur(lab * w[..., None], (0, 0), 40)
    den = cv2.GaussianBlur(w, (0, 0), 40)[..., None] + 1e-4
    bg_est = num / den
    dist = np.sqrt(((lab - bg_est) ** 2).sum(2))
    idx = np.arange(1, n + 1)
    sizes = ndi.sum(smooth, lbl, index=idx)
    means = ndi.mean(dist, lbl, index=idx)
    borderset = set(border.tolist())
    for i in range(n):
        if (i + 1) in borderset:
            continue
        if sizes[i] >= min_hole and means[i] < bg_delta:
            bg |= lbl == (i + 1)
    return ~bg


def refine_alpha(mask, feather=0.9, erode=1):
    """Hard mask -> soft alpha: fill small pinholes, shave the fringe, feather."""
    filled = ndi.binary_fill_holes(mask)
    holes = filled & ~mask
    lbl, n = ndi.label(holes)
    m = mask.copy()
    if n:
        sizes = ndi.sum(holes, lbl, index=np.arange(1, n + 1))
        small = [i + 1 for i, s in enumerate(sizes) if s < 900]
        m |= np.isin(lbl, small)
    m = m.astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    if erode:
        m = cv2.erode(m, np.ones((3, 3), np.uint8), iterations=erode)
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), feather)
    return np.clip((a - 0.25) / 0.6, 0, 1)


def defringe(rgb, alpha):
    """Replace colour of semi-transparent edge pixels with the nearest solid colour."""
    solid = alpha > 0.95
    if not solid.any():
        return rgb
    idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    near = rgb[idx[0], idx[1]]
    edge = (alpha < 0.95)[..., None]
    return np.where(edge, near, rgb)


# --------------------------------------------------------------------------
# segment
# --------------------------------------------------------------------------
def load_sheet(path, alpha_thr=90, ignore_alpha=False):
    """Return (rgb, alpha-or-None). Alpha only counts when the sheet really has a
    transparent background (>25% of the pixels), not a few stray transparent corners."""
    im = Image.open(path)
    alpha = None
    if im.mode == "RGBA" and not ignore_alpha:
        al = np.array(im)[:, :, 3]
        if (al < 10).mean() > 0.25:
            alpha = (al >= alpha_thr).astype(np.uint8) * 255
    return np.array(im.convert("RGB")), alpha


def auto_objects(rgb, alpha, edge=24.0, bg_delta=22.0, merge=9, min_side=30, min_area=600):
    """Auto-segment a sparse sheet. Returns [(slice, keep-mask, centre)] in reading order."""
    mask = (alpha > 128) if alpha is not None else foreground_mask(rgb, edge_thr=edge, bg_delta=bg_delta)
    grouped = cv2.dilate(mask.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (merge, merge)))
    lbl, n = ndi.label(grouped)
    out = []
    for i, sl in enumerate(ndi.find_objects(lbl), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        keep = lbl[sl] == i
        if max(h, w) < min_side or (keep & mask[sl]).sum() < min_area:
            continue
        out.append((sl, keep, (sl[1].start + w / 2, sl[0].start + h / 2)))
    return mask, out


def cmd_segment(a):
    rgb, alpha = load_sheet(a.sheet)
    mask = (alpha > 128) if alpha is not None else foreground_mask(rgb, edge_thr=a.edge, bg_delta=a.bg_delta)
    grouped = cv2.dilate(mask.astype(np.uint8), cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (a.merge, a.merge)))
    lbl, n = ndi.label(grouped)
    objs = ndi.find_objects(lbl)
    os.makedirs(a.out, exist_ok=True)
    alpha_full = refine_alpha(mask)
    rgb_clean = defringe(rgb, alpha_full)
    found = []
    for i, sl in enumerate(objs, 1):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        keep = lbl[sl] == i
        if max(h, w) < a.min_side or keep.sum() < a.min_area:
            continue
        # touching the sheet border => the source itself is cut off there
        touches = (sl[0].start == 0 or sl[1].start == 0 or
                   sl[0].stop == rgb.shape[0] or sl[1].stop == rgb.shape[1])
        al = alpha_full[sl] * cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8))
        rgba = np.dstack([rgb_clean[sl], (al * 255).astype(np.uint8)])
        img = Image.fromarray(rgba, "RGBA")
        pad = a.pad
        canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
        canvas.paste(img, (pad, pad))
        found.append((sl[0].start, sl[1].start, canvas, touches, (sl[1].start + w // 2, sl[0].start + h // 2)))
    found.sort(key=lambda t: (round(t[0] / a.row_band), t[1]))
    for k, (_, _, im, touches, c) in enumerate(found, 1):
        name = f"{a.prefix}_{k:03d}_x{c[0]}y{c[1]}{'_cut' if touches else ''}.png"
        im.save(os.path.join(a.out, name), optimize=True)
    print(f"{a.sheet}: {len(found)} objects -> {a.out}")



# --------------------------------------------------------------------------
# crop: one named object out of a (possibly dense) sheet
# --------------------------------------------------------------------------
def cut_object(rgb, edge_thr=24.0, bg_delta=22.0, keep_frac=0.25, pad=6, merge=9, alpha_in=None, exclude=(), close=0):
    """Cut the main object out of a loose crop. Pieces that are not connected to the
    biggest object are dropped unless they are larger than keep_frac of it."""
    if alpha_in is not None:
        mask = alpha_in > 128
    else:
        mask = foreground_mask(rgb, edge_thr=edge_thr, bg_delta=bg_delta) if bg_delta > 0 else             foreground_mask(rgb, edge_thr=edge_thr, bg_delta=1e9, min_hole=10 ** 9)
    mask = mask.copy()
    for (ex0, ey0, ex1, ey1) in exclude:
        mask[max(0, ey0):ey1, max(0, ex0):ex1] = False
    if close:  # seal outline gaps, then fill every enclosed hole (glossy / transparent-looking objects)
        mask = ndi.binary_fill_holes(cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE,
                                                      np.ones((close, close), np.uint8)).astype(bool))
    m8 = mask.astype(np.uint8)
    strict, n = ndi.label(cv2.dilate(m8, np.ones((3, 3), np.uint8)))
    if n == 0:
        return None
    group, _ = ndi.label(cv2.dilate(m8, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (merge, merge))))
    idx = np.arange(1, n + 1)
    areas = ndi.sum(mask, strict, index=idx)
    big_i = int(np.argmax(areas)) + 1
    big = areas.max()
    main_group = group[strict == big_i][0]
    H, W = strict.shape
    border = set()
    for i, sl in enumerate(ndi.find_objects(strict), 1):
        if sl is None:
            continue
        if sl[0].start <= 4 or sl[1].start <= 4 or sl[0].stop >= H - 4 or sl[1].stop >= W - 4:
            border.add(i)
    gl = ndi.maximum(group, strict, index=idx)  # group label of every strict component
    ok = []
    for i, a_, g_ in zip(idx.tolist(), areas, gl):
        if i == big_i:
            ok.append(i)
        elif i in border:
            continue  # neighbour fragment cut by the crop box
        elif g_ == main_group or a_ >= keep_frac * big:
            ok.append(i)
    keep = np.isin(strict, ok)
    alpha = refine_alpha(mask) * cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8))
    rgb2 = defringe(rgb, alpha)
    rgba = np.dstack([rgb2, (alpha * 255).astype(np.uint8)])
    img = trim(Image.fromarray(rgba, "RGBA"), 6)
    canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad))
    return canvas


def cmd_crop(a):
    rgb, alpha_in = load_sheet(a.sheet, a.alpha_thr, a.ignore_alpha)
    x0, y0, x1, y1 = [int(v) for v in a.box.split(",")]
    sub = rgb[y0:y1, x0:x1]
    sub_a = None if alpha_in is None else alpha_in[y0:y1, x0:x1]
    out = cut_object(sub, a.edge, a.bg_delta, a.keep_frac, a.pad, a.merge, sub_a)
    if out is None:
        sys.exit("nothing found")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    out.save(a.out, optimize=True)
    print(f"{a.out}: {out.width}x{out.height}")



# --------------------------------------------------------------------------
# build: run manifest.json
# --------------------------------------------------------------------------
def save_png(img, path, tries=5):
    """PNG save with retries (file watchers / antivirus on Windows occasionally lock the target)."""
    import time
    for k in range(tries):
        try:
            img.save(path, optimize=True)
            return
        except OSError:
            if k == tries - 1:
                raise
            time.sleep(0.4)


def cmd_build(a):
    import json
    man = json.load(open(a.manifest, encoding="utf8"))
    sheets_dir = a.sheets
    cache = {}
    ok = 0
    for e in man["items"]:
        if a.only and not any(o in e["out"] for o in a.only):
            continue
        if "from_file" in e:  # already-clean cut-out: just normalise
            img = Image.open(os.path.join(a.src_root, e["from_file"])).convert("RGBA")
            img = to_square(img, a.icon_size, e.get("box_frac", 0.9)) if e.get("kind") == "icon" else img
            out = os.path.join(a.out, e["out"])
            os.makedirs(os.path.dirname(out), exist_ok=True)
            save_png(img, out)
            ok += 1
            print(f"{e['out']}: {img.width}x{img.height} {os.path.getsize(out) // 1024}KB")
            continue
        sheet = e["sheet"]
        if sheet not in cache:
            path = os.path.join(sheets_dir, sheet if sheet.endswith(".png") else sheet + ".png")
            cache[sheet] = load_sheet(path, e.get("alpha_thr", 90), e.get("ignore_alpha", False))
        rgb, alpha = cache[sheet]
        if e.get("auto"):  # sparse sheet: whole-sheet segmentation, pick object nearest to `at`
            key = (sheet, "auto", e.get("merge", 5))
            if key not in cache:
                mask, objs = auto_objects(rgb, alpha, merge=e.get("merge", 5), min_side=25, min_area=300)
                af = refine_alpha(mask)
                cache[key] = (objs, af, defringe(rgb, af))
            objs, af, rc = cache[key]
            cx, cy = e["at"]
            sl, keep, c = min(objs, key=lambda o: (o[2][0] - cx) ** 2 + (o[2][1] - cy) ** 2)
            al = af[sl] * cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8))
            im0 = trim(Image.fromarray(np.dstack([rc[sl], (al * 255).astype(np.uint8)]), "RGBA"), 6)
            pad = e.get("pad", 6)
            img = Image.new("RGBA", (im0.width + 2 * pad, im0.height + 2 * pad), (0, 0, 0, 0))
            img.paste(im0, (pad, pad))
            if e.get("kind") == "icon":
                img = to_square(img, a.icon_size, e.get("box_frac", 0.9))
            out = os.path.join(a.out, e["out"])
            os.makedirs(os.path.dirname(out), exist_ok=True)
            save_png(img, out)
            ok += 1
            print(f"{e['out']}: {img.width}x{img.height} {os.path.getsize(out) // 1024}KB")
            continue
        if "box" in e:
            x0, y0, x1, y1 = e["box"]
        else:
            cx, cy = e["at"]
            r = e.get("r", 58)
            rw, rh = (r, r) if isinstance(r, int) else r
            x0, y0, x1, y1 = cx - rw, cy - rh, cx + rw, cy + rh
        x0, y0 = max(0, x0), max(0, y0)
        y1, x1 = min(rgb.shape[0], y1), min(rgb.shape[1], x1)
        sub = rgb[y0:y1, x0:x1]
        sub_a = None if alpha is None or e.get("ignore_alpha") else alpha[y0:y1, x0:x1]
        excl = [(b[0] - x0, b[1] - y0, b[2] - x0, b[3] - y0) for b in e.get("exclude", [])]
        img = cut_object(sub, e.get("edge", 24.0), e.get("bg_delta", 22.0), e.get("keep_frac", 0.25),
                         e.get("pad", 6), e.get("merge", 9), sub_a, excl, e.get("close", 0))
        if img is not None and e.get("flip"):
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        if img is None:
            print("EMPTY", e["out"])
            continue
        if e.get("kind") == "icon":
            img = to_square(img, a.icon_size, e.get("box_frac", 0.9))
        else:
            mx = e.get("max_side", a.max_side)
            if max(img.size) > mx:
                sc = mx / max(img.size)
                img = img.resize((round(img.width * sc), round(img.height * sc)), Image.LANCZOS)
        out = os.path.join(a.out, e["out"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        save_png(img, out)
        ok += 1
        print(f"{e['out']}: {img.width}x{img.height} {os.path.getsize(out) // 1024}KB")
    print(f"{ok} files written")


# --------------------------------------------------------------------------
# contact sheets
# --------------------------------------------------------------------------
def cmd_contact(a):
    files = sorted(glob.glob(os.path.join(a.folder, "*.png")))
    cols, cell = a.cols, a.cell
    for n in range(0, len(files), a.per):
        chunk = files[n:n + a.per]
        rows = (len(chunk) + cols - 1) // cols
        S = Image.new("RGB", (cols * cell, rows * (cell + 16)), (110, 110, 110))
        d = ImageDraw.Draw(S)
        for i, f in enumerate(chunk):
            im = Image.open(f).convert("RGBA")
            sc = min((cell - 8) / im.width, (cell - 8) / im.height)
            im2 = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
            x, y = (i % cols) * cell, (i // cols) * (cell + 16)
            tile = Image.new("RGB", (cell, cell), tuple(int(c) for c in a.bg.split(",")))
            tile.paste(im2, ((cell - im2.width) // 2, (cell - im2.height) // 2), im2)
            S.paste(tile, (x, y + 16))
            d.text((x + 2, y + 2), f"{os.path.basename(f)} {im.width}x{im.height}", fill=(255, 255, 255))
        out = f"{a.out}_{n // a.per}.png"
        S.save(out)
        print(out)


# --------------------------------------------------------------------------
# icons / fit / audit
# --------------------------------------------------------------------------
def trim(im, thr=8):
    bb = im.getchannel("A").point(lambda v: 255 if v > thr else 0).getbbox()
    return im.crop(bb) if bb else im


def to_square(im, size=256, box=0.9):
    im = trim(im.convert("RGBA"))
    sc = size * box / max(im.size)
    im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return c


def cmd_icons(a):
    os.makedirs(a.out, exist_ok=True)
    for f in glob.glob(os.path.join(a.src, "*.png")):
        o = to_square(Image.open(f), a.size, a.box)
        o.save(os.path.join(a.out, os.path.basename(f)), optimize=True)
        print(os.path.basename(f))


def cmd_fit(a):
    for f in glob.glob(os.path.join(a.folder, "**", "*.png"), recursive=True):
        im = Image.open(f)
        before = os.path.getsize(f)
        if max(im.size) > a.max_side:
            sc = a.max_side / max(im.size)
            im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
            im.save(f, optimize=True)
        if os.path.getsize(f) > a.max_kb * 1024 and im.mode == "RGBA":
            q = im.quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
            q.save(f, optimize=True)
        print(f"{f}: {before // 1024}KB -> {os.path.getsize(f) // 1024}KB")


def cmd_audit(a):
    for f in sorted(glob.glob(os.path.join(a.folder, "**", "*.png"), recursive=True)):
        im = Image.open(f).convert("RGBA")
        al = np.array(im)[:, :, 3]
        edge = np.concatenate([al[0], al[-1], al[:, 0], al[:, -1]])
        print(f"{f}\t{im.width}x{im.height}\t{os.path.getsize(f) // 1024}KB\t"
              f"transparent={float((al < 10).mean()):.2f}\tedgeOpaque={float((edge > 40).mean()):.2f}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = p.add_subparsers(dest="cmd", required=True)
    q = s.add_parser("segment")
    q.add_argument("sheet")
    q.add_argument("out")
    q.add_argument("--prefix", default="obj")
    q.add_argument("--edge", type=float, default=24.0)
    q.add_argument("--bg-delta", type=float, default=22.0)
    q.add_argument("--merge", type=int, default=9)
    q.add_argument("--min-side", type=int, default=40)
    q.add_argument("--min-area", type=int, default=1500)
    q.add_argument("--pad", type=int, default=6)
    q.add_argument("--row-band", type=int, default=120)
    q.set_defaults(fn=cmd_segment)
    q = s.add_parser("crop")
    q.add_argument("sheet")
    q.add_argument("out")
    q.add_argument("--box", required=True, help="x0,y0,x1,y1 in sheet pixels")
    q.add_argument("--edge", type=float, default=24.0)
    q.add_argument("--bg-delta", type=float, default=22.0)
    q.add_argument("--merge", type=int, default=9)
    q.add_argument("--keep-frac", type=float, default=0.25)
    q.add_argument("--pad", type=int, default=6)
    q.add_argument("--ignore-alpha", action="store_true")
    q.add_argument("--alpha-thr", type=int, default=90)
    q.set_defaults(fn=cmd_crop)
    q = s.add_parser("build", help="run a manifest.json of crops (the repeatable pipeline)")
    q.add_argument("--manifest", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "manifest.json"))
    q.add_argument("--sheets", default="assets/_source/elements")
    q.add_argument("--out", default="assets")
    q.add_argument("--src-root", default="assets/_source")
    q.add_argument("--icon-size", type=int, default=256)
    q.add_argument("--max-side", type=int, default=1200)
    q.add_argument("--only", nargs="*")
    q.set_defaults(fn=cmd_build)
    q = s.add_parser("contact")
    q.add_argument("folder")
    q.add_argument("out")
    q.add_argument("--per", type=int, default=20)
    q.add_argument("--cols", type=int, default=5)
    q.add_argument("--cell", type=int, default=240)
    q.add_argument("--bg", default="255,0,255")
    q.set_defaults(fn=cmd_contact)
    q = s.add_parser("icons")
    q.add_argument("src")
    q.add_argument("out")
    q.add_argument("--size", type=int, default=256)
    q.add_argument("--box", type=float, default=0.9)
    q.set_defaults(fn=cmd_icons)
    q = s.add_parser("fit")
    q.add_argument("folder")
    q.add_argument("--max-side", type=int, default=1200)
    q.add_argument("--max-kb", type=int, default=300)
    q.set_defaults(fn=cmd_fit)
    q = s.add_parser("audit")
    q.add_argument("folder")
    q.set_defaults(fn=cmd_audit)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
