import os
from PIL import Image

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
out_dir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian"

# Crop pink banarasi muse:
# Looking at top_x_150_300.png:
# x starts at 155 (to avoid the ivory muse's left border)
# x ends at 310
# y starts at 5, ends at 285
cropped = im.crop((150, 0, 310, 285))
bbox = cropped.getbbox()
if bbox:
    trimmed = cropped.crop(bbox)
    tw, th = trimmed.size
    padded = Image.new('RGBA', (tw + 8, th + 8), (0, 0, 0, 0))
    padded.paste(trimmed, (4, 4))
    padded.save(os.path.join(out_dir, "muse_pink_banarasi.png"))
    print("Clean muse_pink_banarasi saved:", padded.size)

# Also royal crimson lehenga:
# Looking at top_x_300_450 and top_x_450_600:
# Lehenga starts at x=340, ends at x=500
# y starts at 85, ends at 325
lehenga = im.crop((345, 80, 500, 325))
lbbox = lehenga.getbbox()
if lbbox:
    trimmed_l = lehenga.crop(lbbox)
    lw, lh = trimmed_l.size
    padded_l = Image.new('RGBA', (lw + 8, lh + 8), (0, 0, 0, 0))
    padded_l.paste(trimmed_l, (4, 4))
    padded_l.save(os.path.join(out_dir, "royal_crimson_lehenga.png"))
    print("Clean royal_crimson_lehenga saved:", padded_l.size)

# Jharokha window with garlands:
# x=1355 to 1536, y=0 to 285
jharokha = im.crop((1355, 0, 1536, 285))
jbbox = jharokha.getbbox()
if jbbox:
    trimmed_j = jharokha.crop(jbbox)
    jw, jh = trimmed_j.size
    padded_j = Image.new('RGBA', (jw + 8, jh + 8), (0, 0, 0, 0))
    padded_j.paste(trimmed_j, (4, 4))
    padded_j.save(os.path.join(out_dir, "jharokha_window_garlands.png"))
    print("Clean jharokha_window_garlands saved:", padded_j.size)

print("Crops updated!")
