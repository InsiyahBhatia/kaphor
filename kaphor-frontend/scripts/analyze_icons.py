import os
from PIL import Image

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
P1 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_icons')

files = sorted([f for f in os.listdir(P1) if f.startswith('icon_') and f.endswith('.png')])
print(f"Total icons: {len(files)}")
for f in files:
    im = Image.open(os.path.join(P1, f))
    # compute dominant color
    colors = im.getcolors(maxcolors=256000)
    # filter out transparent
    opaque_colors = [c for c in colors if len(c[1]) == 4 and c[1][3] > 50]
    total_opaque = sum(c[0] for c in opaque_colors)
    print(f"{f}: size={im.size}, opaque_pixels={total_opaque}")
