import os
from PIL import Image

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
P1 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_icons')

# Let's inspect each icon and check which one is:
# - scissors
# - sewing / tape / thread / needle
# - camera
# - chat / speech bubble
# - glasses
# - hat
# - ring
# - wallet
# - check / checkmark
# - close / x
# - plus / add
# - filter
# - grid
# - recycle
# - leaf
# - sparkle
for i in range(27, 83):
    fn = f"icon_{i:02d}.png"
    p = os.path.join(P1, fn)
    if os.path.exists(p):
        im = Image.open(p)
        print(f"{fn}: size={im.size}")
