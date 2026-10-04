import os
from PIL import Image, ImageDraw, ImageFont

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
P1 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_icons')

def make_sheets(src_dir, prefix):
    files = sorted([f for f in os.listdir(src_dir) if f.endswith('.png') and not f.startswith('sheet')])
    cols = 10
    cell_w, cell_h = 100, 110
    total = len(files)
    per_sheet = 30
    
    for s_idx in range(0, total, per_sheet):
        batch = files[s_idx:s_idx+per_sheet]
        rows = (len(batch) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * cell_w, rows * cell_h), (245, 240, 230, 255))
        draw = ImageDraw.Draw(sheet)
        
        for idx, f in enumerate(batch):
            r = idx // cols
            c = idx % cols
            x = c * cell_w
            y = r * cell_h
            
            im = Image.open(os.path.join(src_dir, f))
            # resize maintaining aspect
            im.thumbnail((cell_w - 20, cell_h - 35), Image.Resampling.LANCZOS)
            iw, ih = im.size
            ox = x + (cell_w - iw) // 2
            oy = y + 5 + (cell_h - 35 - ih) // 2
            sheet.paste(im, (ox, oy), im)
            
            num_str = f[len(prefix):-4]
            draw.text((x + 10, y + cell_h - 22), num_str, fill=(40, 40, 40, 255))
            draw.rectangle([x, y, x + cell_w - 1, y + cell_h - 1], outline=(200, 190, 180, 255))
        
        out_path = os.path.join(FRONTEND_DIR, 'scripts', f'{prefix}_sheet_{s_idx//per_sheet + 1}.png')
        sheet.save(out_path)
        print(f"Saved {out_path}")

make_sheets(P1, 'icon_')
make_sheets(os.path.join(FRONTEND_DIR, 'scripts', 'labeled_new_icons'), 'item_')
