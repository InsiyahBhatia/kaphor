import os
from PIL import Image
import numpy as np
from scipy.ndimage import label

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
arr = np.array(im)
alpha = arr[:, :, 3]

out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian"
os.makedirs(out_dir, exist_ok=True)

def save_clean_component(box, seed_point, name, extra_mask_boxes=[]):
    """
    box: (left, top, right, bottom)
    seed_point: (x, y) guaranteed to belong to target component
    """
    sub_arr = arr[box[1]:box[3], box[0]:box[2]].copy()
    sub_alpha = sub_arr[:, :, 3]
    
    # zero out any extra_mask_boxes (relative to sub_arr)
    for mbox in extra_mask_boxes:
        sub_arr[mbox[1]:mbox[3], mbox[0]:mbox[2], 3] = 0
        sub_alpha[mbox[1]:mbox[3], mbox[0]:mbox[2]] = 0

    # find connected component that includes seed_point
    mask = sub_alpha > 20
    labeled, num_features = label(mask)
    
    rel_x = seed_point[0] - box[0]
    rel_y = seed_point[1] - box[1]
    
    target_label = labeled[rel_y, rel_x]
    if target_label == 0:
        # try 3x3 search
        y_slice = slice(max(0, rel_y-5), min(sub_arr.shape[0], rel_y+5))
        x_slice = slice(max(0, rel_x-5), min(sub_arr.shape[1], rel_x+5))
        vals = labeled[y_slice, x_slice]
        nonzero = vals[vals > 0]
        if len(nonzero) > 0:
            target_label = nonzero[0]
            
    if target_label > 0:
        sub_arr[labeled != target_label, 3] = 0
    
    # Save trimmed image
    sub_im = Image.fromarray(sub_arr)
    bbox = sub_im.getbbox()
    if bbox:
        trimmed = sub_im.crop(bbox)
        tw, th = trimmed.size
        padded = Image.new('RGBA', (tw + 8, th + 8), (0, 0, 0, 0))
        padded.paste(trimmed, (4, 4))
        dest = os.path.join(out_dir, f"{name}.png")
        padded.save(dest)
        print(f"Pristine saved {name}.png: size={padded.size}")
        return dest
    else:
        print(f"FAILED to extract {name}")
        return None

# 1. Pink Banarasi Muse (center at x=200, y=150)
# Cut off right petal (x > 225, y < 100) and bottom lehenga tip
save_clean_component(
    box=(110, 0, 240, 290),
    seed_point=(190, 150),
    name="muse_pink_banarasi",
    extra_mask_boxes=[(115, 0, 130, 150), (105, 240, 130, 290)]
)

# 2. Ivory Gajra Muse (center at x=50, y=120)
save_clean_component(
    box=(0, 0, 115, 265),
    seed_point=(55, 120),
    name="muse_ivory_gajra"
)

# 3. Royal Crimson Bridal Lehenga (center at x=290, y=210)
save_clean_component(
    box=(235, 60, 360, 325),
    seed_point=(290, 210),
    name="royal_crimson_lehenga",
    extra_mask_boxes=[(0, 0, 30, 150), (0, 240, 40, 265)]
)

# 4. Royal Sandstone Jharokha Window (center at x=940, y=140)
save_clean_component(
    box=(885, 0, 1005, 285),
    seed_point=(940, 140),
    name="jharokha_window_garlands",
    extra_mask_boxes=[(0, 150, 15, 285)]
)

# 5. Grand Sandstone Arch (center at x=950, y=450)
save_clean_component(
    box=(888, 275, 1005, 630),
    seed_point=(950, 450),
    name="grand_palace_arch"
)

# 6. Royal Crimson Potli Bag (center at x=200, y=360)
save_clean_component(
    box=(160, 290, 252, 442),
    seed_point=(205, 365),
    name="royal_crimson_potli"
)

# 7. Royal White Caparisoned Elephant (center at x=730, y=590)
save_clean_component(
    box=(650, 485, 822, 695),
    seed_point=(735, 595),
    name="royal_white_elephant"
)

# 8. Udaipur Lake Palace (center at x=120, y=750)
save_clean_component(
    box=(0, 680, 245, 835),
    seed_point=(120, 750),
    name="udaipur_lake_palace",
    extra_mask_boxes=[(0, 0, 150, 40), (140, 0, 245, 70)]
)

# 9. Pichwai Sacred Cow (center at x=170, y=890)
save_clean_component(
    box=(75, 780, 245, 990),
    seed_point=(170, 890),
    name="pichwai_sacred_cow"
)

# 10. Banana Palm in Brass Kalash (center at x=590, y=370)
save_clean_component(
    box=(525, 210, 650, 545),
    seed_point=(590, 370),
    name="banana_palm_kalash"
)

# 11. Pink Lotus Flower (center at x=265, y=45)
save_clean_component(
    box=(225, 5, 300, 88),
    seed_point=(265, 45),
    name="pink_lotus_flower"
)

# 12. Glowing Brass Diya (center at x=635, y=500)
save_clean_component(
    box=(600, 455, 672, 545),
    seed_point=(635, 500),
    name="brass_glowing_diya"
)

print("Segmentation complete!")
