"""
Cuts the symbol sheet (transparent background) into src/game/art/egypt/<name>.webp.
Each symbol is centred on a 512 px square; edge pixels take the colour of the nearest solid paint
so no light fringe shows on the dark reels. Run from the repo root: python scripts/cut_symbols.py
"""
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ni

SHEET = np.asarray(Image.open('scripts/symbols_sheet.webp').convert('RGBA')).copy()
A = SHEET[..., 3]
lab, n = ni.label(A > 12)
boxes = [(s, int((lab[s] == i + 1).sum()), i + 1) for i, s in enumerate(ni.find_objects(lab))]
boxes = [b for b in boxes if b[1] > 1000]
assert len(boxes) == 10, len(boxes)
# reading order: two rows, left to right
boxes.sort(key=lambda b: (b[0][0].start > 450, b[0][1].start))
NAMES = ['pyramid', 'pharaoh', 'anubis', 'scarab', 'horus', 'a', 'k', 'q', 'j', 'ten']
SIZE, FIT = 512, 484

for name, (sl, _, idx) in zip(NAMES, boxes):
    a = np.where(lab == idx, A, 0)
    # defringe: colour of the nearest solid pixel in the soft edge
    solid = a > 235
    ind = ni.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    rgb = SHEET[..., :3][ind[0], ind[1]]
    rgba = np.dstack([rgb, a])[sl[0].start - 2:sl[0].stop + 2, sl[1].start - 2:sl[1].stop + 2]
    h, w = rgba.shape[:2]
    k = FIT / max(w, h)
    im = Image.fromarray(rgba.astype(np.uint8), 'RGBA').resize((round(w * k), round(h * k)), Image.LANCZOS)
    c = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    c.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    c.save(f'src/game/art/egypt/{name}.webp', 'WEBP', quality=95, alpha_quality=100, method=6)
    print(name, im.size)

# the bonus symbol is its own painting: a framed tile, cut out of the checkerboard it came on
tile = Image.open('scripts/bonus_source.webp').convert('RGBA').crop((101, 114, 1153, 1142))
disc = Image.new('L', (tile.width, tile.height), 0)
ImageDraw.Draw(disc).rounded_rectangle((0, 0, tile.width - 1, tile.height - 1), 14, fill=255)
tile.putalpha(disc)
# edge to edge: on the reels it fills the whole cell
c = tile.resize((SIZE, SIZE), Image.LANCZOS)
c.save('src/game/art/egypt/pyramid.webp', 'WEBP', quality=95, alpha_quality=100, method=6)
