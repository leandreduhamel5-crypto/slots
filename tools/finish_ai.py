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
# the eyes of the left sphinx, in this picture; the right one is its mirror
EYES = [(189, 552), (221, 552)]


def load(path, size=(W, H)):
    return np.asarray(Image.open(path).convert('RGB').resize(size, Image.LANCZOS), dtype=np.float32) / 255


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blur(a, s):
    return ndi.gaussian_filter(a, (s, s, 0) if a.ndim == 3 else s)


def save(img, name):
    im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')
    # the fine detail survives the last enlargement
    big = np.asarray(im.resize((2560, 1440), Image.LANCZOS), dtype=np.float32) / 255
    big = np.clip(big + (big - blur(big, 1.6)) * 0.55, 0, 1)
    Image.fromarray((big * 255 + 0.5).astype(np.uint8), 'RGB').save(f'{OUT}{name}.webp', 'WEBP', quality=86, method=6)
    im.save(f'{OUT}{name}_m.webp', 'WEBP', quality=76, method=6)
    im.resize((1520, 855), Image.LANCZOS).save(f'tools/out/final_{name}.jpg', quality=90)
    print(name)


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
    # the signs cut in the obelisks catch
    fine = np.clip((blur(lum, 1) - blur(lum, 9)) * 7, 0, 1) * blur((m == OBELISK).astype(np.float32), 2)
    fire = np.maximum(fire, fine * 0.85)
    # and the eyes of the sphinxes
    for ex, ey in EYES:
        for px in (ex, W - ex):
            fire = np.maximum(fire, np.exp(-(((xx - px) / 7) ** 2 + ((yy - ey) / 5) ** 2)))
    hot = ramp(np.clip(fire, 0, 1), [(0, (0, 0, 0)), (0.3, (0.8, 0.1, 0.02)), (0.65, (1, 0.45, 0.08)), (1, (1, 0.9, 0.55))])
    img = img * (1 - np.clip(fire * 1.6, 0, 1)[..., None]) + hot

    # its light in the air, on the stone and in the wet floor
    glow = blur(fire, 6) * 0.9 + blur(fire, 22) * 0.8 + blur(fire, 70) * 0.7
    img = img + glow[..., None] * np.array([1.0, 0.16, 0.05])
    y0 = int(y + h)
    mirror = np.zeros_like(hot)
    rows = np.clip(2 * y0 - np.arange(H), 0, H - 1)
    mirror[y0:] = blur(hot + glow[..., None] * np.array([1.0, 0.16, 0.05]) * 0.5, 2.2)[rows[y0:]]
    floor = blur((yy > y0 - 4).astype(np.float32) * (1 - np.isin(m, STATUE)), 2)
    fade = np.clip(1 - (yy - y0) / (H - y0) * 0.75, 0, 1)
    img = img + mirror * (floor * fade)[..., None] * 0.62

    img = np.clip(img, 0, 1)
    img = img ** 1.06
    vig = 1 - 0.5 * smooth(0.5, 1.2, np.hypot((xx / W - 0.5) / 0.6, (yy / H - 0.46) / 0.72))
    return img * vig[..., None]


def place(img, statue, alpha, x, base, height, flip, warm):
    """Sets a statue in the picture with its foot on `base`, its reflection under it in the floor."""
    k = height / statue.shape[0]
    size = (max(2, int(statue.shape[1] * k)), max(2, int(height)))
    s = np.asarray(Image.fromarray((statue * 255).astype(np.uint8)).resize(size, Image.LANCZOS), dtype=np.float32) / 255
    a = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).resize(size, Image.LANCZOS), dtype=np.float32) / 255
    if flip:
        s, a = s[:, ::-1], a[:, ::-1]
    s = s * warm
    h, w = a.shape
    x0, y0 = int(x - w / 2), int(base - h)
    # contact shadow on the floor
    sh = np.zeros(img.shape[:2], np.float32)
    x1, x2 = max(0, x0), min(img.shape[1], x0 + w)
    sh[int(base) - 2 : int(base) + max(3, h // 14), x1:x2] = 1
    sh = blur(sh, max(2, h / 22))[..., None]
    img *= 1 - sh * 0.55
    # the reflection
    ry0 = int(base)
    rh = min(h, img.shape[0] - ry0)
    if rh > 0:
        fade = np.linspace(0.42, 0.04, rh, dtype=np.float32)[:, None]
        ra = a[::-1][:rh] * fade
        rs = blur(s[::-1][:rh], 1.2)
        xa, xb = max(0, x0), min(img.shape[1], x0 + w)
        ra = ra[:, xa - x0 : xb - x0, None]
        rs = rs[:, xa - x0 : xb - x0]
        region = img[ry0 : ry0 + rh, xa:xb]
        img[ry0 : ry0 + rh, xa:xb] = region * (1 - ra) + rs * ra
    xa, xb = max(0, x0), min(img.shape[1], x0 + w)
    aa = a[:, xa - x0 : xb - x0, None]
    ss = s[:, xa - x0 : xb - x0]
    region = img[y0 : y0 + h, xa:xb]
    img[y0 : y0 + h, xa:xb] = region * (1 - aa) + ss * aa


def hall():
    """The avenue of the sanctuary is lined with the left sphinx of the pyramid picture, in perspective."""
    img = load('tools/out/ai_hall.png').copy()
    source = load('tools/out/ai_night.png')
    m = ids()
    mask = np.isin(m, STATUE)
    mask[:, W // 2:] = False
    a = blur(ndi.binary_erosion(mask, iterations=1).astype(np.float32), 0.8)
    rows, cols = np.nonzero(a > 0.02)
    y0, y1, x0, x1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
    s, a = source[y0:y1, x0:x1], a[y0:y1, x0:x1]
    cam_y, focal, horizon = 2.4, 1400 * (W / 2560), 880 * (W / 2560)
    aspect = s.shape[1] / s.shape[0]
    for z in (82.0, 66.0, 53.0, 42.0):
        foot = horizon + focal * cam_y / z
        height = focal * 6.0 / z
        offset = focal * 3.4 / z + aspect * height / 2
        # from the moonlight of its picture to the warm light of the gate, dimmer far from the viewer
        warm = np.array([1.3, 1.02, 0.72], np.float32) * (0.72 + 0.3 * (42.0 / z))
        place(img, s, a, W / 2 - offset, foot, height, False, warm)
        place(img, s, a, W / 2 + offset, foot, height, True, warm)
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
        save(red(base), 'pyramid_infected')
    if 'hall' in jobs:
        save(hall(), 'temple_night')


if __name__ == '__main__':
    main()
