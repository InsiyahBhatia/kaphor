import os
from PIL import Image
import numpy as np

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian"
os.makedirs(out_dir, exist_ok=True)

# Helper: check pixel transparency and cut exactly
def clean_crop(box, dest_name):
    cropped = im.crop(box)
    bbox = cropped.getbbox()
    if bbox:
        trimmed = cropped.crop(bbox)
        # Check if any edges need alpha clearing
        w, h = trimmed.size
        padded = Image.new('RGBA', (w + 8, h + 8), (0,0,0,0))
        padded.paste(trimmed, (4, 4))
        padded.save(os.path.join(out_dir, f"{dest_name}.png"))
        print(f"Clean saved {dest_name}: {padded.size}")

# 1. Ivory gajra muse (bridal back pose)
clean_crop((0, 0, 225, 305), "indian_muse_ivory")

# 2. Pink banarasi muse
clean_crop((235, 0, 520, 340), "indian_muse_pink")

# 3. Crimson royal bridal lehenga
clean_crop((510, 80, 830, 400), "indian_bridal_lehenga")

# 4. Lotus flower
clean_crop((520, 0, 750, 85), "indian_lotus")

# 5. Red royal umbrella (parasol)
clean_crop((0, 310, 300, 480), "indian_umbrella")

# 6. Carved wooden jhula (swing)
clean_crop((0, 420, 220, 680), "indian_jhula")

# 7. Emerald cushion
clean_crop((200, 520, 400, 680), "indian_emerald_cushion")

# 8. Royal crimson potli bag
clean_crop((280, 330, 480, 520), "indian_potli_bag")

# 9. Palace reflection (lake palace / jal mahal)
clean_crop((0, 680, 420, 840), "indian_lake_palace")

# 10. Sacred pichwai cow
clean_crop((80, 810, 380, 1020), "indian_pichwai_cow")

# 11. Royal Jharokha arched window
# Let's find coordinates of the window
# Looking at the earlier crop indian_052: x around 1341..1536, y around 650..1019?
# Wait! Let's find where the jharokha window is!
