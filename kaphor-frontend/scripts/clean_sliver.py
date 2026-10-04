from PIL import Image
import numpy as np

p = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian\muse_pink_banarasi.png"
im = Image.open(p).convert('RGBA')
arr = np.array(im)

# Look at left edge: x < 22 and y > 60
arr[60:, :24, 3] = 0

im_clean = Image.fromarray(arr)
bbox = im_clean.getbbox()
im_clean = im_clean.crop(bbox)
tw, th = im_clean.size
padded = Image.new('RGBA', (tw + 8, th + 8), (0, 0, 0, 0))
padded.paste(im_clean, (4, 4))
padded.save(p)
print("Pink muse left sliver cleanly removed, size:", padded.size)
