import os
from PIL import Image

FRONTEND_DIR = r'c:\Users\Insiyah\Kaphor\kaphor-frontend'
P1 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_icons')
P2 = os.path.join(FRONTEND_DIR, 'scripts', 'preview_new_icons')

def make_catalog(p_dir, out_name):
    files = sorted([f for f in os.listdir(p_dir) if f.endswith('.png')])
    html = ["<html><head><style>body{background:#f0e9df;font-family:sans-serif;display:flex;flex-wrap:wrap;gap:12px;padding:20px;} .card{background:white;border:1px solid #aaa;border-radius:6px;padding:8px;text-align:center;width:110px;} img{max-width:80px;max-height:80px;}</style></head><body>"]
    for f in files:
        im = Image.open(os.path.join(p_dir, f))
        html.append(f"<div class='card'><img src='{f}'><br><b>{f}</b><br><small>{im.size[0]}x{im.size[1]}</small></div>")
    html.append("</body></html>")
    with open(os.path.join(p_dir, out_name), 'w') as out:
        out.write("\n".join(html))

make_catalog(P1, 'catalog.html')
make_catalog(P2, 'catalog.html')
print("Catalogs generated!")
