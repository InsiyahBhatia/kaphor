import os
from PIL import Image

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian"
os.makedirs(out_dir, exist_ok=True)

def save_crop(box, name):
    cropped = im.crop(box)
    bbox = cropped.getbbox()
    if bbox:
        trimmed = cropped.crop(bbox)
        w, h = trimmed.size
        padded = Image.new('RGBA', (w + 8, h + 8), (0,0,0,0))
        padded.paste(trimmed, (4, 4))
        padded.save(os.path.join(out_dir, f"{name}.png"))
        print(f"Saved {name}: {padded.size}")

# Let's inspect the 1536 x 1024 sheet
# Let's save slices for:
# 1. Ivory lehenga muse: x=0..240, y=0..450
save_crop((0, 0, 245, 450), "muse_ivory_gajra")

# 2. Pink banarasi saree muse: x=240..550, y=0..450
save_crop((235, 0, 540, 460), "muse_pink_banarasi")

# 3. Royal crimson lehenga: x=580..850, y=140..550
# Wait, let's verify where the lehenga is!
# 4. Lotus flower: x=580..800, y=0..140
save_crop((580, 0, 800, 140), "lotus_pink")

# 5. Jharokha window: Let's check coordinates around x=1000..1536
# Let's search for the window in indian.png
