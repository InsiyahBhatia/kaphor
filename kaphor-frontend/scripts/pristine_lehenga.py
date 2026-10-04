from PIL import Image
import numpy as np
from scipy.ndimage import label

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
arr = np.array(im)

# Bounding box around lehenga
# x=348..505, y=75..325
sub = arr[75:325, 348:505].copy()

# Zero out top flower petal (y < 20 and x < 40)
sub[:18, :40, 3] = 0
# Zero out bottom-left medal (y > 230 and x < 25)
sub[230:, :22, 3] = 0
# Zero out bottom medal (y > 238 and x in 40..80)
sub[238:, 35:90, 3] = 0

mask = sub[:, :, 3] > 20
labeled, num_features = label(mask)

# Find label at center of lehenga
lehenga_label = labeled[100, 75]
sub[labeled != lehenga_label, 3] = 0

clean = Image.fromarray(sub)
bbox = clean.getbbox()
clean = clean.crop(bbox)
tw, th = clean.size
padded = Image.new('RGBA', (tw + 8, th + 8), (0, 0, 0, 0))
padded.paste(clean, (4, 4))
dest = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\editorial\indian\royal_crimson_lehenga.png"
padded.save(dest)
print("Pristine royal_crimson_lehenga saved:", padded.size)
