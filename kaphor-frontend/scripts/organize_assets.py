import os
import shutil
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
ASSETS_DIR = os.path.join(FRONTEND_DIR, 'assets')
ELEMENTS_DIR = os.path.join(ASSETS_DIR, 'elements')
EDITORIAL_DIR = os.path.join(ASSETS_DIR, 'editorial')

ICONS_DIR = os.path.join(EDITORIAL_DIR, 'icons')
FASHION_DIR = os.path.join(EDITORIAL_DIR, 'fashion')
BOTANICAL_DIR = os.path.join(EDITORIAL_DIR, 'botanical')
RIBBONS_DIR = os.path.join(EDITORIAL_DIR, 'ribbons')
COUTURE_DIR = os.path.join(EDITORIAL_DIR, 'couture')
ACCENTS_DIR = os.path.join(EDITORIAL_DIR, 'accents')

for d in [ICONS_DIR, FASHION_DIR, BOTANICAL_DIR, RIBBONS_DIR, COUTURE_DIR, ACCENTS_DIR]:
    os.makedirs(d, exist_ok=True)

new_icons_img = Image.open(os.path.join(ELEMENTS_DIR, 'new-icons.png'))

def extract_and_trim(im, box, save_path, pad=3):
    crop = im.crop(box)
    bbox = crop.getbbox()
    if bbox:
        crop = crop.crop(bbox)
        w, h = crop.size
        padded = Image.new('RGBA', (w + pad*2, h + pad*2), (0, 0, 0, 0))
        padded.paste(crop, (pad, pad))
        crop = padded
    crop.save(save_path)
    return crop.size

# --- 1. Cleanly extracted editorial icons from new-icons.png ---
icon_boxes = {
    'home': (12, 10, 130, 130),
    'search': (145, 8, 250, 130),
    'hanger': (265, 12, 385, 115),
    'dress': (390, 2, 518, 240),
    'stack': (505, 10, 625, 125),
    'tote': (635, 8, 755, 130),
    'bag': (765, 8, 875, 130),
    'cart': (885, 20, 1000, 125),
    'heart': (1015, 20, 1105, 115),
    'heart_filled': (1115, 20, 1205, 115),
    'bookmark': (1220, 18, 1295, 120),
    'bell': (1320, 12, 1410, 120),
    'mail': (1420, 18, 1555, 115),
    'profile': (1565, 12, 1680, 120),
    'gear': (1685, 12, 1770, 118),
    'recycle': (5, 360, 115, 475),
    'leaf': (370, 365, 485, 475),
    'thread': (980, 365, 1080, 480),
    'scissors': (1150, 360, 1270, 480),
    'sewing': (1260, 365, 1405, 475),
    'chat': (385, 495, 490, 595),
    'camera': (915, 495, 1020, 585),
    'upload': (1135, 490, 1225, 590),
    'check': (640, 600, 735, 695),
    'close': (1215, 600, 1315, 695),
    'plus': (1090, 600, 1185, 695),
    'filter': (1515, 600, 1625, 690),
    'grid': (1665, 605, 1770, 705),
    'swap': (880, 700, 985, 785),
    'sparkle': (1250, 815, 1345, 887),
    'tag': (450, 125, 545, 240),
    'shoe': (545, 125, 655, 240),
    'sunglasses': (655, 130, 780, 235),
    'ring': (780, 125, 885, 235),
    'hat': (880, 140, 1005, 235),
    'clock': (1165, 125, 1270, 235),
    'wallet': (1290, 130, 1415, 235),
    'star': (1560, 120, 1665, 235),
}

for name, box in icon_boxes.items():
    sz = extract_and_trim(new_icons_img, box, os.path.join(ICONS_DIR, f'{name}.png'))
    print(f'Icon {name}: {sz}')

# --- 2. High Fashion Muse Hero from Watercolour Muse ---
muse_src = Image.open(os.path.join(ELEMENTS_DIR, 'Watercolour Fashion Muse with Flowing Ribbons.png'))
bbox = muse_src.getbbox()
muse_hero = muse_src.crop(bbox)
muse_hero.save(os.path.join(FASHION_DIR, 'muse_hero.png'))
print(f'Saved muse_hero.png: {muse_hero.size}')

# Also crop the left floral branch & flowing ribbon accents from muse
# Muse center is roughly around x: 600 to 1100
left_accent = muse_src.crop((0, 0, 580, 900))
l_bbox = left_accent.getbbox()
if l_bbox:
    left_accent = left_accent.crop(l_bbox)
    left_accent.save(os.path.join(RIBBONS_DIR, 'flowing_ribbon_left.png'))
    print('Saved flowing_ribbon_left.png')

right_accent = muse_src.crop((1050, 0, 1536, 1024))
r_bbox = right_accent.getbbox()
if r_bbox:
    right_accent = right_accent.crop(r_bbox)
    right_accent.save(os.path.join(RIBBONS_DIR, 'flowing_ribbon_right.png'))
    print('Saved flowing_ribbon_right.png')

# --- 3. Extract botanical, couture, ribbon, and fashion elements from collages ---
def extract_connected(src_img_path, target_dir, prefix, min_area=3500, max_area=500000, alpha_thresh=30, dil_iter=3):
    im = Image.open(src_img_path)
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    arr = np.array(im)
    alpha = (arr[:, :, 3] > alpha_thresh).astype(np.uint8)
    struct = ndi.generate_binary_structure(2, 2)
    dil = ndi.binary_dilation(alpha, structure=struct, iterations=dil_iter)
    labeled, num = ndi.label(dil)
    slices = ndi.find_objects(labeled)
    
    saved = 0
    for idx, slc in enumerate(slices):
        if not slc: continue
        y1, y2 = slc[0].start, slc[0].stop
        x1, x2 = slc[1].start, slc[1].stop
        w = x2 - x1
        h = y2 - y1
        area = w * h
        if area < min_area or area > max_area: continue
        if np.sum(arr[y1:y2, x1:x2, 3] > alpha_thresh) < min_area * 0.2: continue
        
        crop = im.crop((max(0, x1-4), max(0, y1-4), min(arr.shape[1], x2+4), min(arr.shape[0], y2+4)))
        c_bbox = crop.getbbox()
        if not c_bbox: continue
        crop = crop.crop(c_bbox)
        
        save_file = os.path.join(target_dir, f'{prefix}_{saved+1:02d}.png')
        crop.save(save_file)
        saved += 1
    print(f'{prefix}: extracted {saved} elements from {os.path.basename(src_img_path)}')
    return saved

# Botanical elements from Vintage Thrift Sticker Collection
extract_connected(
    os.path.join(ELEMENTS_DIR, 'Vintage Thrift Sticker Collection.png'),
    BOTANICAL_DIR,
    'botanical_vintage',
    min_area=4000,
    dil_iter=3
)

# Couture & tailoring elements from sheet_b94 & sustainable
extract_connected(
    os.path.join(ELEMENTS_DIR, 'b942910d-9d7d-42a0-97bf-94439cb01c18.png'),
    COUTURE_DIR,
    'couture_item',
    min_area=4500,
    dil_iter=3
)

# Fashion figures from sheet_76d and sheet_a47
extract_connected(
    os.path.join(ELEMENTS_DIR, '76d5efc9-6b18-4169-a3f9-816158f076ae.png'),
    FASHION_DIR,
    'fashion_figure',
    min_area=8000,
    dil_iter=4
)

extract_connected(
    os.path.join(ELEMENTS_DIR, 'a47ec907-27a4-4eb1-8aeb-30391b836241.png'),
    ACCENTS_DIR,
    'editorial_accent',
    min_area=6000,
    dil_iter=3
)

# Ribbons & bows from all styles
extract_connected(
    os.path.join(ELEMENTS_DIR, 'Vintage Thrift Fashion Sticker Collage.png'),
    RIBBONS_DIR,
    'editorial_sticker',
    min_area=5000,
    dil_iter=3
)

print("Done organizing editorial assets!")
