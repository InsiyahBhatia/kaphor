from PIL import Image
import numpy as np

p = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian\royal_crimson_lehenga.png"
im = Image.open(p).convert('RGBA')
arr = np.array(im)

# Remove green tassel on left: x < 45, y < 140
arr[:140, :45, 3] = 0
# Remove bottom medal: y > 220, x < 65
arr[220:, :65, 3] = 0
# Remove top petal: y < 25
arr[:25, :, 3] = 0

im_clean = Image.fromarray(arr)
bbox = im_clean.getbbox()
im_clean = im_clean.crop(bbox)
tw, th = im_clean.size
padded = Image.new('RGBA', (tw + 8, th + 8), (0, 0, 0, 0))
padded.paste(im_clean, (4, 4))
padded.save(p)
print("Royal crimson lehenga cleanly isolated, size:", padded.size)
