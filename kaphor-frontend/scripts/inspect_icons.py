import os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
ELEMENTS_DIR = os.path.join(FRONTEND_DIR, 'assets', 'elements')

def inspect_sheet(filename):
    path = os.path.join(ELEMENTS_DIR, filename)
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    im = Image.open(path).convert('RGBA')
    print(f"\n--- {filename} ({im.size[0]}x{im.size[1]}) ---")
    arr = np.array(im)
    alpha = (arr[:, :, 3] > 20).astype(np.uint8)
    struct = ndi.generate_binary_structure(2, 2)
    dil = ndi.binary_dilation(alpha, structure=struct, iterations=4)
    labeled, num = ndi.label(dil)
    slices = ndi.find_objects(labeled)
    
    components = []
    for idx, slc in enumerate(slices):
        if not slc: continue
        y1, y2 = slc[0].start, slc[0].stop
        x1, x2 = slc[1].start, slc[1].stop
        w = x2 - x1
        h = y2 - y1
        area = w * h
        if area < 500: continue
        components.append((x1, y1, x2, y2, w, h, area))
    
    # Sort primarily by y (row), then x
    components.sort(key=lambda c: (c[1] // 80, c[0]))
    print(f"Found {len(components)} components:")
    for idx, (x1, y1, x2, y2, w, h, area) in enumerate(components):
        print(f"  #{idx+1:02d}: box=({x1}, {y1}, {x2}, {y2}), size=({w}x{h}), center=({(x1+x2)//2}, {(y1+y2)//2})")

if __name__ == '__main__':
    inspect_sheet('new-icons.png')
    inspect_sheet('icons.png')
