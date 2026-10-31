"""Paints public/og.jpg, the picture shown when the game's link is shared."""
from PIL import Image, ImageDraw, ImageFilter

W, H = 1200, 630
ART = 'src/game/art/egypt/'

sky = Image.open(ART + 'temple_night.webp').convert('RGB')
k = max(W / sky.width, H / sky.height)
sky = sky.resize((round(sky.width * k), round(sky.height * k)), Image.LANCZOS)
x = (sky.width - W) // 2
canvas = sky.crop((x, 0, x + W, H)).convert('RGBA')

# darkness behind the title, so the gold stands out
shade = Image.new('L', (W, H), 0)
ImageDraw.Draw(shade).ellipse((360, 90, 1260, 560), fill=205)
canvas.paste((5, 2, 8), (0, 0), shade.filter(ImageFilter.GaussianBlur(70)))

queen = Image.open(ART + 'cleo_full.webp').convert('RGBA')
k = 700 / queen.height
queen = queen.resize((round(queen.width * k), 700), Image.LANCZOS)
glow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
glow.paste((255, 176, 70, 150), (0, 0), queen.getchannel('A'))
canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(24)))
canvas.alpha_composite(queen, (0, 0))

logo = Image.open(ART + 'logo.webp').convert('RGBA')
k = 730 / logo.width
logo = logo.resize((730, round(logo.height * k)), Image.LANCZOS)
canvas.alpha_composite(logo, (440, 200))

canvas.convert('RGB').save('public/og.jpg', 'JPEG', quality=88, optimize=True)
