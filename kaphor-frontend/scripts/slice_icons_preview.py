import os
from PIL import Image

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
ASSETS_DIR = os.path.join(FRONTEND_DIR, 'assets')
ELEMENTS_DIR = os.path.join(ASSETS_DIR, 'elements')
PREVIEW_DIR = os.path.join(FRONTEND_DIR, 'scripts', 'preview_icons')
os.makedirs(PREVIEW_DIR, exist_ok=True)

import numpy as np
import scipy.ndimage as ndi

im = Image.open(os.path.join(ELEMENTS_DIR, 'icons.png')).convert('RGBA')
arr = np.array(im)
alpha = (arr[:, :, 3] > 25).astype(np.uint8)
struct = ndi.generate_binary_structure(2, 2)
dil = ndi.binary_dilation(alpha, structure=struct, iterations=3)
labeled, num = ndi.label(dil)
slices = ndi.find_objects(labeled)

comps = []
for idx, slc in enumerate(slices):
    if not slc: continue
    y1, y2 = slc[0].start, slc[0].stop
    x1, x2 = slc[1].start, slc[1].stop
    w = x2 - x1
    h = y2 - y1
    if w * h < 600: continue
    crop = im.crop((x1, y1, x2, y2))
    bbox = crop.getbbox()
    if bbox:
        crop = crop.crop(bbox)
        comps.append((crop, x1, y1, x2, y2))

# sort by y, then x
comps.sort(key=lambda c: (c[2] // 120, c[1]))

html_content = ["<html><body style='background:#f4ece1; font-family:monospace; display:flex; flex-wrap:wrap; gap:16px; padding:20px;'>"]
for idx, (crop, x1, y1, x2, y2) in enumerate(comps):
    filename = f"icon_{idx+1:02d}.png"
    crop.save(os.path.join(PREVIEW_DIR, filename))
    html_content.append(f"""
    <div style='background:white; border:1px solid #ccc; padding:8px; text-align:center;'>
        <img src='{filename}' style='height:64px; object-fit:contain;'><br>
        <b>#{idx+1:02d}</b><br>
        <small>{crop.size[0]}x{crop.size[1]}<br>pos: {x1},{y1}</small>
    </div>
    """)
html_content.append("</body></html>")

with open(os.path.join(PREVIEW_DIR, 'index.html'), 'w') as f:
    f.write("\n".join(html_content))

print(f"Exported {len(comps)} icons to {PREVIEW_DIR}")
