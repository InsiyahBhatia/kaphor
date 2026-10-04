import os
from PIL import Image
import numpy as np

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
w, h = im.size
print("Indian image size:", w, h)

# Let's inspect coordinates for the key figures:
# 1. Muse Ivory Lehenga (top left): x around 0..220, y around 0..450
# 2. Muse Pink Banarasi (top center-left): x around 240..600, y around 0..500
# 3. Crimson Bridal Lehenga (top right): x around 600..950, y around 100..600
# 4. Lotus flower: around x=650..850, y=0..120
# 5. Jharokha window: around x=1350..1536, y=280..750 or so
# 6. Lake Palace: around x=0..600, y=680..950
# 7. Jhula swing: around x=0..450, y=420..800
# 8. Potli bag: around x=400..700, y=650..950
# 9. Diya / Samai / Banana palm: around x=650..1200, y=200..850
# 10. Pichwai cow: around x=200..600, y=700..980

# Let's write a script to detect and save individual clean crops
out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian"
os.makedirs(out_dir, exist_ok=True)

# Helper to crop by bbox and trim transparent padding
def crop_and_trim(box, name):
    cropped = im.crop(box)
    bbox = cropped.getbbox()
    if bbox:
        trimmed = cropped.crop(bbox)
        # Pad 4px
        tw, th = trimmed.size
        padded = Image.new('RGBA', (tw + 8, th + 8), (0,0,0,0))
        padded.paste(trimmed, (4, 4))
        padded.save(os.path.join(out_dir, f"{name}.png"))
        print(f"Saved {name}.png: size={padded.size}")
        return padded
    return None

# Let's test some manual and auto crops
