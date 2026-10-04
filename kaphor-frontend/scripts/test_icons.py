import os
from PIL import Image

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
P1 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_icons')
P2 = os.path.join(FRONTEND_DIR, 'scripts', 'labeled_new_icons')

# Let's inspect where scissors and sewing are
# Let's write a small script that copies the preview images into a quick reference HTML
with open(os.path.join(FRONTEND_DIR, 'scripts', 'all_icons.txt'), 'w') as out:
    for i in range(1, 86):
        fn = f"icon_{i:02d}.png"
        p = os.path.join(P1, fn)
        if os.path.exists(p):
            im = Image.open(p)
            out.write(f"{fn}: {im.size}\n")

print("Done writing icon list")
