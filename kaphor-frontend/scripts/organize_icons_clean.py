import os
import shutil
from PIL import Image

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
SRC_DIR = os.path.join(FRONTEND_DIR, 'scripts', 'labeled_new_icons')
DEST_DIR = os.path.join(FRONTEND_DIR, 'assets', 'editorial', 'icons')
os.makedirs(DEST_DIR, exist_ok=True)

# Perfect mapping from item_XXX.png to EditorialIconName
MAPPING = {
    'home': 'item_001.png',
    'search': 'item_002.png',
    'hanger': 'item_003.png',
    'dress': 'item_016.png',          # Clean red dress on hanger
    'stack': 'item_005.png',          # Stack of folded clothes
    'tote': 'item_006.png',           # Canvas tote with heart
    'bag': 'item_007.png',            # Paper shopping bag with heart
    'cart': 'item_008.png',           # Wire shopping cart
    'heart': 'item_009.png',          # Heart outline
    'heartFilled': 'item_010.png',    # Red heart filled
    'bookmark': 'item_011.png',       # Red bookmark ribbon
    'bell': 'item_012.png',           # Golden bell with red dot
    'mail': 'item_013.png',           # Envelope with flowers
    'profile': 'item_014.png',        # Mannequin avatar with flower
    'gear': 'item_015.png',           # Wooden gear cog
    'shoe': 'item_026.png',           # Red high-top sneaker
    'boots': 'item_021.png',          # Black platform boots
    'bow': 'item_023.png',            # Silk pink ribbon bow
    'ring': 'item_024.png',           # Pearl necklace with heart
    'clock': 'item_025.png',          # Vintage leather wrist watch
    'rental': 'item_098.png',         # Calendar with heart for rental booking
    'hat': 'item_027.png',            # Cap with flower
    'sunglasses': 'item_028.png',     # Tortoiseshell sunglasses
    'handbag': 'item_030.png',        # Leather handbag
    'tag': 'item_037.png',            # Price tags with heart & %
    'scissors': 'item_044.png',       # Tailor shears with ribbon
    'recycle': 'item_046.png',        # Green leaf recycle symbol
    'leaf': 'item_049.png',           # Green botanical leaf
    'swap': 'item_050.png',           # Circular swap arrows with green leaf
    'thread': 'item_055.png',         # Wooden spool of thread
    'buttons': 'item_056.png',        # Buttons
    'sewing': 'item_058.png',         # Vintage sewing machine
    'tape': 'item_059.png',           # Measuring tape
    'yarn': 'item_060.png',           # Yarn with knitting needles
    'chat': 'item_067.png',           # Speech bubble
    'help': 'item_068.png',           # Question bubble
    'camera': 'item_072.png',         # Retro camera
    'upload': 'item_074.png',         # Cloud upload
    'wallet': 'item_078.png',         # Leather wallet
    'card': 'item_079.png',           # Credit card with flower
    'verified': 'item_084.png',       # Verified ribbon seal
    'shield': 'item_085.png',         # Shield with checkmark
    'check': 'item_110.png',          # Green circular checkmark badge
    'close': 'item_109.png',          # Red circular X button
    'plus': 'item_107.png',           # Plus button
    'minus': 'item_108.png',          # Minus button
    'filter': 'item_112.png',         # Filter slider
    'grid': 'item_111.png',           # Menu / grid bars
    'sparkle': 'item_127.png',        # Golden sparkle star
    'star': 'item_064.png',           # Golden star
}

def clean_and_pad(src_path, dest_path, pad=2):
    im = Image.open(src_path).convert('RGBA')
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    padded = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    padded.paste(im, (pad, pad))
    padded.save(dest_path)
    return padded.size

print("Cropping and organizing all editorial icons...")
for name, item_fn in MAPPING.items():
    src_file = os.path.join(SRC_DIR, item_fn)
    if not os.path.exists(src_file):
        print(f"WARNING: {src_file} does not exist!")
        continue
    dest_file = os.path.join(DEST_DIR, f"{name}.png")
    sz = clean_and_pad(src_file, dest_file)
    print(f"  {name}.png ({item_fn}) -> {sz}")

# Also ensure heart_filled.png is mapped
if os.path.exists(os.path.join(DEST_DIR, 'heartFilled.png')):
    shutil.copyfile(os.path.join(DEST_DIR, 'heartFilled.png'), os.path.join(DEST_DIR, 'heart_filled.png'))

print("All editorial icons cleanly extracted and saved!")
