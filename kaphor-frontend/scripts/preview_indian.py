import os

indir = r"c:\Users\Insiyah\Kaphor\kaphor-frontend\scripts\labeled_indian"
files = sorted([f for f in os.listdir(indir) if f.endswith('.png')])

html = ['<html><head><style>body{background:#F7F4EE;font-family:sans-serif;display:flex;flex-wrap:wrap;gap:12px;padding:20px;} .card{background:white;padding:8px;border:1px solid #ccc;border-radius:6px;text-align:center;width:140px;} img{max-height:100px;max-width:120px;object-fit:contain;}</style></head><body>']

for f in files:
    html.append(f"<div class='card'><img src='{f}'><br><b>{f}</b></div>")

html.append('</body></html>')

with open(os.path.join(indir, 'index.html'), 'w') as out:
    out.write(''.join(html))

print("Created index.html with", len(files), "items")
