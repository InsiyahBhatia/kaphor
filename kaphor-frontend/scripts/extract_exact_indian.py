import os
from PIL import Image

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian"
os.makedirs(out_dir, exist_ok=True)

def extract_element(box, name):
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

CROPS = {
    # Muses & Couture
    "muse_ivory_gajra": (0, 0, 175, 275),
    "muse_pink_banarasi": (165, 0, 360, 295),
    "royal_crimson_lehenga": (330, 80, 520, 335),
    "muse_emerald_sabyasachi": (550, 0, 785, 260),
    "groom_royal_sherwani": (980, 0, 1115, 265),
    "muse_pink_saree_full": (1180, 0, 1340, 275),

    # Royal Architecture & Palaces
    "jharokha_window_garlands": (1345, 0, 1536, 285),
    "grand_sandstone_arch": (1345, 275, 1536, 680),
    "ornate_jharokha_flowers": (1340, 700, 1536, 1010),
    "udaipur_lake_palace": (0, 650, 370, 845),
    "carved_wooden_jhula": (0, 455, 190, 680),

    # Regal Accessories & Motifs
    "royal_crimson_potli": (240, 285, 395, 450),
    "royal_zari_umbrella": (50, 265, 205, 430),
    "royal_white_elephant": (1000, 490, 1260, 700),
    "pichwai_sacred_cow": (115, 780, 375, 995),
    "banana_palm_kalash": (800, 210, 1010, 550),
    "brass_glowing_diya": (920, 450, 1025, 545),
    "royal_embroidered_mojaris": (840, 680, 1040, 860),
    "emerald_zari_cushion": (180, 500, 340, 640),
    "lotus_pink_flower": (340, 5, 465, 90),
    "royal_mirror_flowers": (840, 35, 980, 220),
    "royal_letter_envelope": (500, 760, 710, 890),
}

for name, box in CROPS.items():
    extract_element(box, name)

print("All exact Indian elements extracted!")
