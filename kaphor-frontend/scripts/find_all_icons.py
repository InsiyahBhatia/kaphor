import os
from PIL import Image

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
P1 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_icons')
P2 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_new_icons')

# Let's inspect preview_new_icons/index.html and preview_icons/index.html
# We can print coordinates of icons in new-icons.png and icons.png
print(f"P1 (icons.png) has {len(os.listdir(P1))} files")
print(f"P2 (new-icons.png) has {len(os.listdir(P2))} files")
