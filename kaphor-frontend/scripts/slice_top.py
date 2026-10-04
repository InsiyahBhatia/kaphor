import os
from PIL import Image

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')

# Let's crop strips:
# Top row: y=0 to 350, x in slices of 200
out = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\scripts\slices"
os.makedirs(out, exist_ok=True)

for i, x in enumerate(range(0, 1536, 150)):
    crop = im.crop((x, 0, min(1536, x+150), 320))
    crop.save(os.path.join(out, f"top_x_{x}_{x+150}.png"))

print("Top row slices created")
