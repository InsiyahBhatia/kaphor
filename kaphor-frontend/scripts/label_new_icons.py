import os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
ASSETS_DIR = os.path.join(FRONTEND_DIR, 'assets')
ELEMENTS_DIR = os.path.join(ASSETS_DIR, 'elements')
OUT_DIR = os.path.join(FRONTEND_DIR, 'scripts', 'labeled_new_icons')
os.makedirs(OUT_DIR, exist_ok=True)

im = Image.open(os.path.join(ELEMENTS_DIR, 'new-icons.png')).convert('RGBA')
arr = np.array(im)
alpha = (arr[:, :, 3] > 20).astype(np.uint8)

# Find connected components with a small dilation
struct = ndi.generate_binary_structure(2, 2)
dil = ndi.binary_dilation(alpha, structure=struct, iterations=2)
labeled, num = ndi.label(dil)
slices = ndi.find_objects(labeled)

items = []
for idx, slc in enumerate(slices):
    if not slc: continue
    y1, y2 = slc[0].start, slc[0].stop
    x1, x2 = slc[1].start, slc[1].stop
    w = x2 - x1
    h = y2 - y1
    if w * h < 400: continue
    # crop exact alpha bbox inside slice
    patch = im.crop((x1, y1, x2, y2))
    bbox = patch.getbbox()
    if not bbox: continue
    actual_box = (x1 + bbox[0], y1 + bbox[1], x1 + bbox[2], y1 + bbox[3])
    actual_crop = im.crop(actual_box)
    aw, ah = actual_crop.size
    items.append((actual_crop, actual_box, aw, ah))

# Sort top-to-bottom, left-to-right
items.sort(key=lambda it: (it[1][1] // 70, it[1][0]))

html = ["<html><head><style>body{background:#eee;font-family:sans-serif;display:flex;flex-wrap:wrap;gap:8px;} .card{background:white;padding:4px;border:1px solid #999;text-align:center;width:120px;} img{max-height:80px;max-width:80px;}</style></head><body>"]

print(f"Total detected items in new-icons.png: {len(items)}")
for idx, (crop, box, w, h) in enumerate(items):
    fname = f"item_{idx+1:03d}.png"
    crop.save(os.path.join(OUT_DIR, fname))
    html.append(f"""
    <div class='card'>
        <img src='{fname}'><br>
        <b>#{idx+1:03d}</b><br>
        <small>{box[0]},{box[1]}<br>{box[2]},{box[3]}<br>({w}x{h})</small>
    </div>
    """)

html.append("</body></html>")
with open(os.path.join(OUT_DIR, 'index.html'), 'w') as f:
    f.write("\n".join(html))

print(f"Saved to {OUT_DIR}")
