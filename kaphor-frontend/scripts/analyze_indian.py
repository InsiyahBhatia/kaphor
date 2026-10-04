import os
from PIL import Image
import numpy as np

im_path = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png"
im = Image.open(im_path).convert('RGBA')
arr = np.array(im)
alpha = arr[:, :, 3]

# Check background
print("Dimensions:", im.size)
print("Alpha min/max/mean:", alpha.min(), alpha.max(), alpha.mean())

# Segment connected components
from scipy.ndimage import label, find_objects

mask = alpha > 30
labeled, num_features = label(mask)
print("Num components found:", num_features)

out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\scripts\labeled_indian"
os.makedirs(out_dir, exist_ok=True)

objs = find_objects(labeled)
saved = 0
for idx, slc in enumerate(objs):
    if slc is None:
        continue
    ymin, ymax = slc[0].start, slc[0].stop
    xmin, xmax = slc[1].start, slc[1].stop
    w = xmax - xmin
    h = ymax - ymin
    if w >= 25 and h >= 25:
        cropped = im.crop((xmin, ymin, xmax, ymax))
        cropped.save(os.path.join(out_dir, f"indian_{saved+1:03d}.png"))
        print(f"#{saved+1:03d}: bbox=({xmin},{ymin},{xmax},{ymax}) size=({w}x{h})")
        saved += 1
print(f"Total saved: {saved}")
