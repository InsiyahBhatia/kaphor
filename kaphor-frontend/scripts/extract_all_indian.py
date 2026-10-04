import os
from PIL import Image

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian"
os.makedirs(out_dir, exist_ok=True)

# Helper function to crop, trim transparency, and save with small border
def extract_element(box, name):
    # box is (left, top, right, bottom)
    cropped = im.crop(box)
    bbox = cropped.getbbox()
    if bbox:
        trimmed = cropped.crop(bbox)
        tw, th = trimmed.size
        padded = Image.new('RGBA', (tw + 6, th + 6), (0, 0, 0, 0))
        padded.paste(trimmed, (3, 3))
        dest = os.path.join(out_dir, f"{name}.png")
        padded.save(dest)
        print(f"Extracted {name}.png -> size {padded.size}")
        return dest
    else:
        print(f"EMPTY: {name} in {box}")
        return None

# Exact bounding boxes based on the 1536x1024 grid
CROPS = {
    "muse_pink_banarasi": (108, 2, 235, 290),
    "muse_ivory_gajra": (0, 0, 112, 260),
    "muse_emerald_sabyasachi": (360, 0, 515, 255),
    "royal_crimson_lehenga": (220, 85, 340, 325),
    "jharokha_window_top": (885, 0, 1005, 280),
    "jharokha_window_ornate": (870, 720, 1005, 995),
    "grand_palace_arch": (888, 275, 1005, 630),
    "lake_palace_udaipur": (0, 660, 248, 835),
    "royal_white_elephant": (645, 480, 822, 690),
    "royal_potli_bag": (160, 290, 252, 442),
    "carved_wooden_jhula": (0, 460, 126, 680),
    "banana_palm_kalash": (525, 215, 650, 545),
    "pichwai_sacred_cow": (75, 780, 245, 990),
    "royal_zari_mojaris": (545, 680, 660, 855),
    "royal_embroidered_parasol": (28, 270, 138, 422),
    "pink_lotus_flower": (225, 5, 300, 88),
    "brass_glowing_diya": (600, 455, 672, 540),
    "emerald_zari_cushion": (120, 500, 220, 630),
    "men_royal_sherwani": (630, 0, 725, 255),
    "pink_chiffon_saree_muse": (780, 0, 885, 260)
}

for name, box in CROPS.items():
    extract_element(box, name)

print("All Indian editorial elements successfully extracted!")
