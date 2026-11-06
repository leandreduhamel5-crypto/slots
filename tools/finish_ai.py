"""
Finishes the pictures painted by tools/paint_ai.py and writes them into the art folder.

  python tools/finish_ai.py [night] [red] [hall]

night   the painted pyramid; the left sphinx, the better one, is mirrored onto the right
red     the bonus, built from that same painting so that the place does not change: the storm of
        ai_sky over it, the stone taken down to a dark fire, the cracks and the door of the render
        burning, and their light in the wet floor
hall    the painted sanctuary, the same sphinx set along its avenue in perspective
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = 'src/game/art/egypt/'
W, H = 2048, 1152
# from the 1920 × 1080 of the game to this picture
K = W / 1920
DOOR = np.array([903, 535, 114, 193]) * K
MOON_OUT = np.array([570, 114]) * K
# the materials of tools/render_pyramid.py
OBELISK = 8
PYRAMID = 6
STATUE = (9, 10, 11)
# the eyes of the left sphinx, read on its painted face (the painter turned the head a little, so the
# sockets projected by tools/render_pyramid.py fell on the nose); the right one is its mirror
EYES = [(329.0, 557.5), (347.0, 556.5)]


def load(path, size=(W, H)):
    return np.asarray(Image.open(path).convert('RGB').resize(size, Image.LANCZOS), dtype=np.float32) / 255


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blur(a, s):
    return ndi.gaussian_filter(a, (s, s, 0) if a.ndim == 3 else s)


def save(img, name):
    """The phone gets the 2048 picture; a wide screen the 4K one, painted by `paint_ai.py upscale`."""
    im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')
    im.save(f'tools/out/{name}_2k.png')
    im.save(f'{OUT}{name}_m.webp', 'WEBP', quality=78, method=6)
    im.resize((1520, 855), Image.LANCZOS).save(f'tools/out/final_{name}.jpg', quality=90)
    print(name)


def publish(name):
    """Sets the 4K picture of a backdrop in the game."""
    from PIL import ImageFilter
    # the tiles keep the softness of the enlargement: a fine unsharp mask gives the stone its grain back
    im = Image.open(f'tools/out/{name}_2k_4k.png').convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
    im.save(f'{OUT}{name}.webp', 'WEBP', quality=84, method=6)
    im.resize((2048, 1152), Image.LANCZOS).save(f'{OUT}{name}_m.webp', 'WEBP', quality=78, method=6)
    im.resize((1520, 855), Image.LANCZOS).save(f'tools/out/final_{name}.jpg', quality=90)
    print('published', name)


def ids():
    a = np.asarray(Image.open('tools/out/pyramid_ids.png').resize((W, H), Image.NEAREST), dtype=np.int32)
    return a // 20


def ramp(v, stops):
    """A gradient map: the values of a picture read through a run of colours."""
    pos = np.array([s[0] for s in stops], np.float32)
    out = [np.interp(v, pos, [s[1][c] for s in stops]) for c in range(3)]
    return np.stack(out, -1).astype(np.float32)


def night():
    img = load('tools/out/ai_night.png')
    m = ids()
    statue = np.isin(m, STATUE)
    left = statue.copy()
    left[:, W // 2:] = False
    # the outline of the left statue, taken a little wide, and its mirror
    mask = ndi.binary_dilation(left, iterations=9)
    soft = blur(mask.astype(np.float32), 2.5)
    flipped = img[:, ::-1]
    right = soft[:, ::-1][..., None]
    img = img * (1 - right) + flipped * np.array([1.08, 1.03, 0.96]) * right
    # the ruins, in moonlight; where they stand is kept for the red repaint, as the statues are
    img, where = furnish(img, NIGHT_OBJECTS, 704, np.array([0.72, 0.7, 0.76], np.float32), mirror=0.2)
    Image.fromarray((where * 255).astype(np.uint8)).save('tools/out/night_objects.png')
    vig = 1 - 0.34 * smooth(0.5, 1.15, np.hypot((np.arange(W)[None, :] / W - 0.5) / 0.62, (np.arange(H)[:, None] / H - 0.48) / 0.72))
    return np.clip(img, 0, 1) * vig[..., None]


FIRE = [(0, (0.012, 0.004, 0.008)), (0.2, (0.1, 0.012, 0.016)), (0.42, (0.3, 0.02, 0.02)), (0.65, (0.62, 0.07, 0.03)), (0.85, (0.92, 0.26, 0.07)), (1, (1, 0.6, 0.24))]


def red(base):
    m = ids()
    lum = base @ np.array([0.3, 0.59, 0.11], np.float32)
    stone = ramp(np.clip(lum, 0, 1) ** 1.45 * 1.05, FIRE)
    # the guardians stay visible in the dark
    statue = blur(np.isin(m, STATUE).astype(np.float32), 2)[..., None]
    lit = ramp(np.clip(lum, 0, 1) ** 1.02 * 1.12, FIRE)
    stone = stone * (1 - statue) + lit * statue

    # the storm
    storm = load('tools/out/ai_sky.png', (W, int(H * 1.08)))[: H]
    value = np.maximum(storm[..., 0], storm @ np.array([0.3, 0.59, 0.11], np.float32) * 0.9)
    sky = ramp(np.clip(value, 0, 1) ** 0.9, [(0, (0.01, 0.004, 0.008)), (0.3, (0.16, 0.012, 0.018)), (0.6, (0.56, 0.03, 0.03)), (0.85, (0.95, 0.16, 0.05)), (1, (1, 0.42, 0.14))])
    open_sky = blur(ndi.binary_erosion(m == 0, iterations=3).astype(np.float32), 2)[..., None]
    img = stone * (1 - open_sky) + sky * open_sky

    # the moon, kept from the painting, in blood
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot(xx - MOON_OUT[0], yy - MOON_OUT[1])
    r = 50
    disc = smooth(r + 3, r - 3, d)[..., None]
    moon = ramp(np.clip(lum, 0, 1) ** 1.2, [(0, (0.03, 0.004, 0.004)), (0.5, (0.55, 0.05, 0.03)), (1, (1, 0.3, 0.12))])
    img = img * (1 - disc) + moon * disc
    img = img + np.exp(-np.maximum(d - r, 0) / 70)[..., None] * np.array([0.3, 0.02, 0.015]) * (1 - disc) * open_sky

    # what burns: the cracks of the render, only on the pyramid
    burn = np.asarray(Image.open('tools/out/pyramid_burn.png').resize((W, H), Image.BICUBIC), dtype=np.float32) / 255
    burn = burn * (m == PYRAMID)
    # the door, burning from below
    x, y, w, h = DOOR
    inside = smooth(x - 6, x + 6, xx) * smooth(x + w + 6, x + w - 6, xx) * smooth(y - 6, y + 6, yy) * smooth(y + h + 4, y + h - 4, yy)
    door = inside * (0.45 + 0.55 * smooth(y, y + h, yy))
    fire = np.maximum(burn, door)
    # only the deepest cuts of the obelisks catch: thin lines of fire in dark stone
    fine = np.clip((blur(lum, 0.8) - blur(lum, 5)) * 9 - 0.25, 0, 1) * blur((m == OBELISK).astype(np.float32), 2)
    fire = np.maximum(fire, fine * 0.55)
    hot = ramp(np.clip(fire, 0, 1), [(0, (0, 0, 0)), (0.3, (0.8, 0.1, 0.02)), (0.65, (1, 0.45, 0.08)), (1, (1, 0.9, 0.55))])
    img = img * (1 - np.clip(fire * 1.6, 0, 1)[..., None]) + hot

    # its light in the air, on the stone and in the wet floor
    glow = blur(fire, 6) * 0.9 + blur(fire, 22) * 0.8 + blur(fire, 70) * 0.7
    img = img + glow[..., None] * np.array([1.0, 0.16, 0.05])
    y0 = int(y + h)
    mirror = np.zeros_like(hot)
    rows = np.clip(2 * y0 - np.arange(H), 0, H - 1)
    # a wet floor stretches what it reflects downwards: long soft streaks, no sharp lines
    mirror[y0:] = ndi.gaussian_filter(hot * 0.7 + glow[..., None] * np.array([1.0, 0.16, 0.05]) * 0.5, (9, 2.5, 0))[rows[y0:]]
    floor = blur((yy > y0 - 4).astype(np.float32) * (1 - np.isin(m, STATUE)), 2)
    fade = np.clip(1 - (yy - y0) / (H - y0) * 0.75, 0, 1)
    img = img + mirror * (floor * fade)[..., None] * 0.62

    img = img + eyes(xx, yy)
    img = np.clip(img, 0, 1)
    img = img ** 1.06
    vig = 1 - 0.5 * smooth(0.5, 1.2, np.hypot((xx / W - 0.5) / 0.6, (yy / H - 0.46) / 0.72))
    return img * vig[..., None]


def eyes(xx, yy):
    """The sphinxes' eyes: almond slits along the line of the eyes, deep red with a small hot core and a
    tight glow, not lamps. The far eye of a turned head is narrower."""
    slit = np.zeros(xx.shape, np.float32)
    for (ex, ey), half in zip(EYES, (3.6, 5.2)):
        for px, tilt in ((ex, -0.12), (W - ex, 0.12)):
            u = (xx - px) * np.cos(tilt) + (yy - ey) * np.sin(tilt)
            v = -(xx - px) * np.sin(tilt) + (yy - ey) * np.cos(tilt)
            # pointed at both corners: the height shrinks towards the ends
            h = 2.0 * np.clip(1 - (u / half) ** 2, 0, 1) + 0.05
            slit = np.maximum(slit, np.exp(-((u / half) ** 6)) * np.exp(-((v / h) ** 2)))
    core = np.clip(slit * 1.6 - 0.75, 0, 1)
    return (
        slit[..., None] * np.array([1.0, 0.12, 0.04])
        + core[..., None] * np.array([0.5, 0.3, 0.06])
        + blur(slit, 2.5)[..., None] * np.array([1.0, 0.08, 0.03])
        + blur(slit, 9)[..., None] * np.array([0.9, 0.05, 0.02])
    )


# Objects painted alone on black by tools/paint_ai.py (objects mode), set into the sanctuary:
# file, the row of its base in the 1024 picture, where its foot stands in the scene, its height in
# metres, mirrored or not. The render's camera (2.4 m high, horizon at 704 here) gives each its size.
HALL_OBJECTS = [
    ('obj_chest_12', 820, (290, 1100), 2.1, False),
    ('obj_hoard_31', 840, (520, 1070), 1.2, False),
    ('obj_chest_13', 852, (1770, 1105), 2.0, False),
    ('obj_urn_32', 900, (752, 850), 2.6, False),
    ('obj_urn_32', 900, (1296, 850), 2.6, True),
]


# before the pyramid: nothing yet. Stone painted alone on black cannot be cut out (its shadows are as
# dark as the background) and small gold urns read as canisters at this distance
NIGHT_OBJECTS = []


def cutout(name, base):
    """The object without its black background and without the floor of its own picture."""
    im = load(f'tools/out/{name}.png', (1024, 1024))[:base]
    lum = im.max(axis=2)
    # its background is a lit dark grey: the threshold comes from the picture's own edges
    edges = np.concatenate([lum[0], lum[:, 0], lum[:, -1]])
    dark = lum < np.median(edges) * 1.8 + 0.02
    # the background is the dark that reaches the border; the dark inside the object stays
    labels, _ = ndi.label(dark)
    edge = np.unique(np.concatenate([labels[0], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, edge[edge > 0])
    solid = ndi.binary_closing(~bg, iterations=3)
    # only the object itself: the largest piece, without the scraps of its picture's floor
    parts, n = ndi.label(solid)
    if n > 1:
        solid = parts == 1 + int(np.argmax(ndi.sum(solid, parts, range(1, n + 1))))
    solid = ndi.binary_fill_holes(solid)
    alpha = blur(solid.astype(np.float32), 0.8)
    rows, cols = np.nonzero(alpha > 0.05)
    y0, x0, x1 = rows.min(), cols.min(), cols.max() + 1
    return im[y0:, x0:x1], alpha[y0:, x0:x1]


def furnish(img, objects, horizon, grade, mirror=0.38):
    """Sets objects on a floor: graded to its light, a contact shadow and a reflection under each (as
    strong as the floor is polished). Returns the picture and where the objects stand."""
    img = img.copy()
    where = np.zeros(img.shape[:2], np.float32)
    # the far ones first, so the near ones stand in front
    for name, base, (fx, fy), metres, flip in sorted(objects, key=lambda o: o[2][1]):
        obj, a = cutout(name, base)
        height = metres * (fy - horizon) / 2.4
        k = height / obj.shape[0]
        size = (max(2, int(obj.shape[1] * k)), max(2, int(height)))
        o = np.asarray(Image.fromarray((obj * 255).astype(np.uint8)).resize(size, Image.LANCZOS), dtype=np.float32) / 255
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize(size, Image.LANCZOS), dtype=np.float32) / 255
        if flip:
            o, a = o[:, ::-1], a[:, ::-1]
        lum = o @ np.array([0.3, 0.59, 0.11], np.float32)
        o = o * grade + (1 - lum)[..., None] * np.array([0, 0.01, 0.035])
        # the further away, the softer and the more of the air in front of it
        far = np.clip((1100 - fy) / 400, 0, 1)
        if far > 0.2:
            o = blur(o, 0.6 * far)
        h, w = a.shape
        x0, y0 = int(fx - w / 2), int(fy - h)
        xa, xb = max(0, x0), min(img.shape[1], x0 + w)
        # contact shadow
        sh = np.zeros(img.shape[:2], np.float32)
        sh[int(fy) - 3 : int(fy) + max(3, h // 16), xa:xb] = 1
        sh = blur(sh, max(2, w / 14))[..., None]
        img *= 1 - sh * 0.6
        # reflection in the polished floor, fading with distance from the foot
        rh = min(int(h * 0.6), img.shape[0] - int(fy))
        if rh > 2:
            fade = (np.linspace(mirror, 0.0, rh, dtype=np.float32) ** 1.4)[:, None]
            ra = a[::-1][:rh] * fade
            rs = blur(o[::-1][:rh], 1.6)
            region = img[int(fy) : int(fy) + rh, xa:xb]
            ra = ra[:, xa - x0 : xb - x0, None]
            img[int(fy) : int(fy) + rh, xa:xb] = region * (1 - ra) + rs[:, xa - x0 : xb - x0] * ra
        region = img[y0 : y0 + h, xa:xb]
        aa = a[:, xa - x0 : xb - x0, None]
        img[y0 : y0 + h, xa:xb] = region * (1 - aa) + o[:, xa - x0 : xb - x0] * aa
        where[y0 : y0 + h, xa:xb] = np.maximum(where[y0 : y0 + h, xa:xb], aa[..., 0])
    return img, where


def hall():
    """The sanctuary as painted, its nave clear to the gate, furnished with the temple's treasure."""
    img, _ = furnish(load('tools/out/ai_hall.png'), HALL_OBJECTS, 704, np.array([0.76, 0.7, 0.64], np.float32))
    vig = 1 - 0.3 * smooth(0.55, 1.2, np.hypot((np.arange(W)[None, :] / W - 0.5) / 0.62, (np.arange(H)[:, None] / H - 0.48) / 0.72))
    return np.clip(img, 0, 1) * vig[..., None]


def main():
    jobs = sys.argv[1:] or ['night', 'red', 'hall']
    base = None
    if 'night' in jobs or 'red' in jobs:
        base = night()
    if 'night' in jobs:
        save(base, 'pyramid_night')
    if 'red' in jobs:
        img = red(base)
        Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save('tools/out/red_base.png')
        save(img, 'pyramid_infected')
    if 'eyes' in jobs:
        # the repainted bonus keeps its fire and its sky; the guardians come back from the render, with
        # their pharaoh faces and their burning eyes where the sculpture has them
        img = load(sys.argv[sys.argv.index('eyes') + 1])
        base = load('tools/out/red_base.png')
        # the repaint left a stray spark of fire against the left head: a wider margin on that side
        guard = np.isin(ids(), STATUE) | (load('tools/out/night_objects.png')[..., 0] > 0.3)
        wide = ndi.binary_dilation(guard, iterations=12)
        wide[:, W // 2:] = False
        statue = blur((ndi.binary_dilation(guard, iterations=3) | wide).astype(np.float32), 3)[..., None]
        save(img * (1 - statue) + base * statue, 'pyramid_infected')
    if 'lava' in jobs:
        # where the painted bonus burns: its yellow veins and its door. The game breathes light into them
        img = load('tools/out/pyramid_infected_2k.png')
        r, g = img[..., 0], img[..., 1]
        lava = np.clip((g - 0.22) * 3.2, 0, 1) * np.clip((r - 0.55) * 4, 0, 1)
        lava = np.maximum(lava, blur(lava, 1.2))
        Image.fromarray((lava * 255).astype(np.uint8)).resize((1024, 576), Image.LANCZOS).convert('RGB').save(f'{OUT}pyramid_lava.webp', 'WEBP', quality=80, method=6)
        print('pyramid_lava')
    for name in ('temple_night', 'pyramid_night', 'pyramid_infected'):
        if f'publish:{name}' in jobs:
            publish(name)
    if 'hall' in jobs:
        save(hall(), 'temple_night')


if __name__ == '__main__':
    main()
