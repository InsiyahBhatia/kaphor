from PIL import Image, ImageDraw, ImageFont

im = Image.open(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\assets\elements\indian.png").convert('RGBA')
draw = ImageDraw.Draw(im)

# Draw grid lines every 100px with coordinates
for x in range(0, im.width, 100):
    draw.line([(x, 0), (x, im.height)], fill=(0, 150, 255, 120), width=1)
    draw.text((x + 2, 5), str(x), fill=(0, 100, 255, 255))

for y in range(0, im.height, 100):
    draw.line([(0, y), (im.width, y)], fill=(255, 50, 0, 120), width=1)
    draw.text((5, y + 2), str(y), fill=(255, 50, 0, 255))

im.save(r"c:\Users\Insiyah\Kaphor\kaphor-frontend\scripts\indian_grid.png")
print("Saved indian_grid.png")
