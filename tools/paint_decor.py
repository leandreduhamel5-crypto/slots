"""
Paints the decor of the game offline, per pixel, into src/game/art/egypt/:

  temple_night / temple_infected   the temple with a richer sky, a real moon, a new pyramid and new obelisks
  dunes_back / dunes_front         two banks of sand rendered from a height field
  palm_{a,b}_{trunk,crown}         two date palms, trunk and crown apart so the crown can move
  ruin_column                      a broken column of the temple

Run from the root of the repository: python tools/paint_decor.py [sky|obelisks|dunes|palms]
It needs numpy, scipy and Pillow, and starts from the 3D renders of commit BASE.
"""
import io
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

OUT = 'src/game/art/egypt/'
BASE = 'e192d0a'
W, H = 2560, 1440
K = 4 / 3  # from the game's 1920 units to these pixels


def noise(h, w, cell, seed):
    """Smooth value noise in 0..1."""
    rng = np.random.default_rng(seed)
    gh, gw = int(h / cell) + 4, int(w / cell) + 4
    g = ndi.zoom(rng.random((gh, gw)), (cell, cell), order=3)
    return np.clip(g[:h, :w], 0, 1)


def fbm(h, w, cell, octaves, seed, gain=0.5):
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for i in range(octaves):
        c = max(1.0, cell / 2**i)
        out += amp * noise(h, w, c, seed + i * 7)
        total += amp
        amp *= gain
    return out / total


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def screen(a, b):
    return 1 - (1 - a) * (1 - np.clip(b, 0, 1))


def base_image(name):
    raw = subprocess.check_output(['git', 'show', f'{BASE}:{OUT}{name}.webp'])
    return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=np.float64) / 255


def save_rgba(path, a, quality=86):
    img = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    img.save(path, 'WEBP', quality=quality, alpha_quality=90, method=6)


def downsample(a, n):
    """Premultiplied box filter, for clean edges."""
    h, w = a.shape[0] // n, a.shape[1] // n
    a = a[: h * n, : w * n]
    rgb = a[..., :3] * a[..., 3:4]
    al = a[..., 3]
    rgb = rgb.reshape(h, n, w, n, 3).mean((1, 3))
    al = al.reshape(h, n, w, n).mean((1, 3))
    out = np.dstack([rgb / np.maximum(al[..., None], 1e-4), al])
    return out


# ------------------------------------------------------------------------------------- sky and moon


def sky_mask():
    """1 in the open sky, 0 on the pyramid; fades out toward the horizon."""
    m = Image.new('L', (W, H), 255)
    d = ImageDraw.Draw(m)
    apex = (960 * K, 57 * K)
    d.polygon([(13 * K, 915 * K), apex, (2110 * K, 938 * K), (W + 200, H), (-200, H)], fill=0)
    a = np.asarray(m, dtype=np.float64) / 255
    a = ndi.gaussian_filter(a, 2.5)
    y = np.arange(H)[:, None] / H
    return a * (1 - smooth(0.5, 0.72, y))


def paint_sky(img, infected):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    # the Milky Way crosses the sky behind the pyramid
    d = (xx * 0.36 + yy * 0.93 - 900) / 1
    cloud = fbm(H, W, 420, 6, 11)
    rift = smooth(0.46, 0.66, fbm(H, W, 150, 5, 23))
    band = np.exp(-((d + (cloud - 0.5) * 420) / 340) ** 2) * (0.35 + 1.3 * smooth(0.3, 0.75, cloud))
    band *= 1 - 0.75 * rift * np.exp(-(d / 170) ** 2)
    glow = np.exp(-((d - 40) / 170) ** 2) * smooth(0.35, 0.7, cloud)
    if infected:
        add = band[..., None] * np.array([0.36, 0.03, 0.03]) + glow[..., None] * np.array([0.5, 0.13, 0.04])
    else:
        add = band[..., None] * np.array([0.08, 0.1, 0.22]) + glow[..., None] * np.array([0.22, 0.15, 0.19])
    # a dust of very small stars, thicker in the band
    rng = np.random.default_rng(5)
    dust = (rng.random((H, W)) > 0.9994 - 0.0016 * np.clip(band, 0, 1)) * (0.2 + 0.8 * rng.random((H, W)) ** 4)
    dust = ndi.gaussian_filter(dust, 0.62) * 3.2
    tint = np.array([1.0, 0.45, 0.35]) if infected else np.array([0.92, 0.95, 1.0])
    add = add + dust[..., None] * tint * (0.5 if infected else 1)
    mask = sky_mask()[..., None]
    return screen(img, add * mask)


def paint_moon(img, infected):
    cx, cy, r = 500 * K, 273 * K, 136
    pad = 12
    x0, y0 = int(cx - r - pad), int(cy - r - pad)
    n = (r + pad) * 2 * 2
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    u, v = (xx / 2 + x0 - cx) / r, (yy / 2 + y0 - cy) / r
    rr = u * u + v * v
    z = np.sqrt(np.clip(1 - rr, 0, 1))
    # seas and highlands, seen on a sphere
    sx = (u / (0.55 + 0.45 * z) * 0.5 + 0.5) * (n - 1)
    sy = (v / (0.55 + 0.45 * z) * 0.5 + 0.5) * (n - 1)
    sea = fbm(n, n, 190, 6, 3)
    hi = fbm(n, n, 22, 4, 9)
    sampled = ndi.map_coordinates(sea, [sy, sx], order=1, mode='reflect')
    fine = ndi.map_coordinates(hi, [sy, sx], order=1, mode='reflect')
    alb = 0.93 - 0.27 * smooth(0.42, 0.66, sampled) - 0.12 * (fine - 0.5)
    # craters with bright rays
    rng = np.random.default_rng(14)
    for _ in range(46):
        a, b = rng.uniform(-0.95, 0.95, 2)
        if a * a + b * b > 0.9:
            continue
        s = rng.uniform(0.012, 0.05)
        dist = np.hypot(u - a, v - b) / s
        alb += 0.1 * np.exp(-(((dist - 1) / 0.28) ** 2)) - 0.08 * np.exp(-((dist / 0.8) ** 2))
        if s > 0.038:
            ang = np.arctan2(v - b, u - a)
            alb += 0.06 * np.exp(-dist / 5) * (0.5 + 0.5 * np.sin(ang * 13 + a * 40))
    light = np.array([-0.42, -0.34, 0.84])
    lit = np.clip(u * light[0] + v * light[1] + z * light[2], 0, 1) ** 0.75
    shade = 0.16 + 0.95 * lit
    colour = np.array([1.0, 0.27, 0.13]) if infected else np.array([1.0, 0.97, 0.88])
    rgb = alb[..., None] * shade[..., None] * colour
    if not infected:
        rgb = rgb + (1 - lit[..., None]) * np.array([0.03, 0.05, 0.11])
    alpha = smooth(1.0, 0.985, np.sqrt(rr))
    moon = downsample(np.dstack([rgb, alpha]), 2)
    h, w = moon.shape[:2]
    out = img.copy()
    # its light in the air around it
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    dist = np.hypot(xx - cx, yy - cy) / r
    air = np.exp(-((dist - 1) * 1.1).clip(0)) * 0.26 * sky_mask()
    tint = np.array([0.9, 0.2, 0.1]) if infected else np.array([0.5, 0.52, 0.62])
    out = screen(out, air[..., None] * tint)
    region = out[y0 : y0 + h, x0 : x0 + w]
    a = moon[..., 3:4]
    out[y0 : y0 + h, x0 : x0 + w] = region * (1 - a) + moon[..., :3] * a
    return out


# ------------------------------------------------------------------------------------------ obelisks


def glyph(d, kind, cx, cy, s):
    """A hieroglyph drawn in white, in a box of half-size s."""
    t = int(s * 0.17)
    line = lambda pts, w=t: d.line(pts, fill=255, width=w, joint='curve')

    def ellipse(x0, y0, x1, y1, width=t):
        d.ellipse([cx + x0 * s, cy + y0 * s, cx + x1 * s, cy + y1 * s], outline=255, width=width)

    def disc(x0, y0, x1, y1):
        d.ellipse([cx + x0 * s, cy + y0 * s, cx + x1 * s, cy + y1 * s], fill=255)

    P = lambda *pts: [(cx + x * s, cy + y * s) for x, y in pts]
    if kind == 'ankh':
        ellipse(-0.42, -1, 0.42, -0.1)
        line(P((-0.7, 0.08), (0.7, 0.08)))
        line(P((0, -0.14), (0, 1)))
    elif kind == 'eye':
        d.arc([cx - s, cy - 0.75 * s, cx + s, cy + 0.65 * s], 200, 340, fill=255, width=t)
        d.arc([cx - s, cy - 0.85 * s, cx + s, cy + 0.45 * s], 25, 155, fill=255, width=t)
        disc(-0.3, -0.42, 0.3, 0.18)
        line(P((-1, -0.62), (-0.2, -0.86), (0.75, -0.72), (1.05, -0.5)), int(t * 0.7))
        line(P((-0.12, 0.34), (-0.26, 0.92)), int(t * 0.8))
        line(P((0.28, 0.32), (0.46, 0.66), (0.86, 0.72), (0.84, 0.46)), int(t * 0.8))
    elif kind == 'scarab':
        ellipse(-0.62, -0.5, 0.62, 0.92)
        disc(-0.36, -0.92, 0.36, -0.42)
        line(P((0, -0.42), (0, 0.9)), int(t * 0.6))
        for k in (-1, 1):
            line(P((k * 0.6, -0.2), (k * 1, -0.5)), int(t * 0.7))
            line(P((k * 0.62, 0.2), (k * 1, 0.2)), int(t * 0.7))
            line(P((k * 0.55, 0.6), (k * 0.95, 0.92)), int(t * 0.7))
    elif kind == 'was':
        line(P((0.05, -0.62), (0, 1)))
        line(P((0, 1), (-0.34, 0.76)), int(t * 0.8))
        line(P((0, 1), (0.34, 0.76)), int(t * 0.8))
        d.polygon(P((-0.2, -0.56), (0.28, -0.84), (0.8, -0.74), (0.3, -0.52), (0.2, -0.38), (-0.14, -0.4)), fill=255)
        line(P((0.0, -0.8), (-0.3, -1)), int(t * 0.7))
    elif kind == 'djed':
        line(P((0, -1), (0, 1)), int(t * 1.9))
        for y in (-0.82, -0.56, -0.3, -0.04):
            line(P((-0.72, y), (0.72, y)), int(t * 0.82))
    elif kind == 'cobra':
        line(P((-0.5, 1), (0.42, 0.94), (0.5, 0.64), (-0.3, 0.46), (-0.34, 0.22), (0.22, 0.02), (0.14, -0.42)))
        d.polygon(P((-0.36, -0.46), (0.1, -0.98), (0.58, -0.44), (0.3, -0.06), (-0.08, -0.08)), fill=255)
    elif kind == 'feather':
        d.polygon(P((-0.08, 1), (0.12, 1), (0.16, 0.2), (0.46, -0.64), (0.08, -1), (-0.26, -0.36)), fill=255)
    elif kind == 'sun':
        ellipse(-0.72, -0.82, 0.72, 0.62)
        disc(-0.2, -0.3, 0.2, 0.1)
        line(P((-0.92, 0.86), (0.92, 0.86)))
    elif kind == 'water':
        for y in (-0.56, 0, 0.56):
            pts = []
            for i in range(25):
                f = i / 24
                pts.append((cx + (f * 2 - 1) * s, cy + (y + 0.2 * math.sin(f * math.pi * 8)) * s))
            line(pts, int(t * 0.9))
    elif kind == 'lotus':
        d.polygon(P((0, -1), (0.28, -0.1), (0, 0.46), (-0.28, -0.1)), fill=255)
        for k in (-1, 1):
            d.polygon(P((k * 0.14, 0.46), (k * 0.86, -0.62), (k * 0.62, 0.16), (k * 0.2, 0.62)), fill=255)
        line(P((0, 0.48), (0, 1)))
    else:  # bird
        d.polygon(P((-0.86, 0.2), (-0.2, -0.46), (0.3, -0.48), (0.6, -0.1), (0.2, 0.42), (-0.42, 0.46)), fill=255)
        disc(0.1, -0.96, 0.62, -0.44)
        d.polygon(P((0.56, -0.84), (1, -0.66), (0.56, -0.56)), fill=255)
        line(P((-0.06, 0.4), (-0.1, 1)), int(t * 0.7))
        line(P((0.18, 0.36), (0.22, 1)), int(t * 0.7))


GLYPHS = ['eye', 'ankh', 'scarab', 'cobra', 'djed', 'sun', 'was', 'bird', 'lotus', 'water', 'feather', 'ankh', 'eye', 'djed', 'scarab', 'sun']


def obelisk_face(seed, side, infected):
    """The carved face: RGB and height, side is +1 when the fire stands to the right of the face."""
    tw, th = 480, 3000
    m = Image.new('L', (tw, th), 0)
    d = ImageDraw.Draw(m)
    y = 210
    i = seed
    size = 136
    while y < th - 160:
        glyph(d, GLYPHS[i % len(GLYPHS)], tw // 2, y, size)
        y += int(size * 2.72)
        i += 1
    gl = np.asarray(m, dtype=np.float64) / 255
    gl = ndi.gaussian_filter(gl, 1.4)
    hh, uu = np.mgrid[0:th, 0:tw].astype(np.float64)
    u, v = uu / tw, hh / th
    # a sunk panel for the column of signs, a groove down each side, lapis and gold at the top
    panel = smooth(0.1, 0.115, u) * smooth(0.9, 0.885, u) * smooth(0.012, 0.016, v) * smooth(0.992, 0.988, v)
    border = np.exp(-(((u - 0.1) / 0.008) ** 2)) + np.exp(-(((u - 0.9) / 0.008) ** 2))
    bevel = ndi.gaussian_filter(gl, 7)
    height = -0.25 * panel - 2.4 * bevel
    grain = fbm(th, tw, 90, 6, seed + 40)
    streak = ndi.gaussian_filter(np.random.default_rng(seed).random((th, tw)), (70, 1.4)) * 30
    streak = (streak - streak.mean()) / (streak.std() + 1e-6)
    speck = np.random.default_rng(seed + 1).random((th, tw))
    speck = ndi.gaussian_filter(speck, 0.8)
    speck = (speck - speck.mean()) / speck.std()
    height += 0.05 * (grain - 0.5) + 0.012 * speck
    # broken corners and chips
    chips = smooth(0.66, 0.74, fbm(th, tw, 46, 4, seed + 50)) * (1 - panel * 0.85)
    height -= 0.35 * chips
    gx = ndi.sobel(height, axis=1) / 8
    gy = ndi.sobel(height, axis=0) / 8
    nz = 1 / np.sqrt(1 + (gx * 7) ** 2 + (gy * 7) ** 2)
    nx, ny = -gx * 7 * nz, -gy * 7 * nz
    # rose granite with black and pale crystals, weathered in long streaks
    alb = np.array([0.5, 0.36, 0.33]) * (0.8 + 0.42 * (grain - 0.5))[..., None]
    alb = alb * (1 + 0.055 * streak[..., None]) + 0.05 * np.clip(speck, 0, 3)[..., None] - 0.05 * np.clip(-speck, 0, 3)[..., None]
    alb = alb * (1 - 0.3 * chips[..., None])
    gold = gl[..., None] * (0.8 + 0.2 * panel[..., None])
    band = smooth(0.03, 0.028, v) + smooth(0.97, 0.972, v)
    lapis = np.array([0.03, 0.07, 0.27]) * (0.7 + 0.6 * grain[..., None])
    alb = alb * (1 - band[..., None]) + lapis * band[..., None]
    moon_l = np.array([-0.55 * -side, -0.5, 0.66])
    moon_l /= np.linalg.norm(moon_l)
    half = moon_l + np.array([0, 0, 1])
    half /= np.linalg.norm(half)
    dif = np.clip(nx * moon_l[0] + ny * moon_l[1] + nz * moon_l[2], 0, 1)
    spec = np.clip(nx * half[0] + ny * half[1] + nz * half[2], 0, 1) ** 44
    # the fire of the brazier climbs the stone from below, on its own side
    across = 0.5 + 0.5 * side * (u * 2 - 1)
    fire = (0.1 + 1.25 * v**2.6) * (0.5 + 0.7 * across) * np.clip(nz + 0.3 * side * nx - 0.28 * ny, 0, 1.4)
    if infected:
        moon_c, fire_c, amb = np.array([1.0, 0.16, 0.1]), np.array([1.0, 0.25, 0.08]), np.array([0.2, 0.03, 0.03])
    else:
        moon_c, fire_c, amb = np.array([0.66, 0.74, 1.0]), np.array([1.0, 0.56, 0.22]), np.array([0.11, 0.1, 0.17])
    light = amb + dif[..., None] * moon_c * 0.72 + fire[..., None] * fire_c
    rgb = alb * light + spec[..., None] * moon_c * 0.2
    # gold in the carved signs
    gold_c = np.array([1.0, 0.72, 0.28])
    # the gold is hollowed: its near walls catch the light, its bottom stays deep
    hollow = np.clip(0.3 + 3.2 * (nx * moon_l[0] + ny * moon_l[1]) + 2.2 * (-ny * 0.6 + side * nx * 0.5) * (0.4 + fire), 0, 1.6)
    gold_rgb = gold_c * (0.1 + hollow[..., None] * (0.42 + 0.5 * fire[..., None]) + 1.2 * spec[..., None])
    rgb = rgb * (1 - gold) + gold_rgb * gold
    rim = np.clip(border, 0, 1)[..., None] * (1 - band[..., None])
    rgb = rgb * (1 - rim * 0.8) + gold_c * (0.25 + 0.6 * fire[..., None]) * rim * 0.8
    for y in (0.03, 0.97):
        line = np.exp(-(((v - y) / 0.0022) ** 2))[..., None]
        rgb = rgb * (1 - line) + gold_c * (0.5 + fire[..., None]) * line
    if infected:
        # the signs burn, and the stone cracks with it
        rng = np.random.default_rng(seed + 60)
        cr = Image.new('L', (tw, th), 0)
        dc = ImageDraw.Draw(cr)
        for _ in range(9):
            x, y = rng.uniform(0, tw), rng.uniform(100, th - 300)
            pts = [(x, y)]
            for _ in range(14):
                x += rng.uniform(-48, 48)
                y += rng.uniform(24, 110)
                pts.append((x, y))
            dc.line(pts, fill=255, width=5)
        crack = np.asarray(cr, dtype=np.float64) / 255
        fire_em = ndi.gaussian_filter(gl + crack, 2) + 0.65 * ndi.gaussian_filter(gl + crack, 22)
        rgb = screen(rgb, fire_em[..., None] * np.array([1.0, 0.28, 0.06]) * 1.1)
    else:
        rgb = screen(rgb, ndi.gaussian_filter(gl, 16)[..., None] * (0.1 + 0.5 * fire[..., None]) * np.array([1.0, 0.6, 0.22]))
    return np.clip(rgb, 0, 1)


def homography(src, dst):
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vh = np.linalg.svd(np.array(a))
    return vh[-1].reshape(3, 3)


def warp_quad(img, tex, quad):
    """Draws tex over the quad tl, tr, br, bl of img, antialiased."""
    SS = 3
    qx = [p[0] for p in quad]
    qy = [p[1] for p in quad]
    x0, x1 = int(min(qx)) - 2, int(max(qx)) + 3
    y0, y1 = int(min(qy)) - 2, int(max(qy)) + 3
    th, tw = tex.shape[:2]
    Hm = homography(quad, [(0, 0), (tw - 1, 0), (tw - 1, th - 1), (0, th - 1)])
    ys, xs = np.mgrid[0 : (y1 - y0) * SS, 0 : (x1 - x0) * SS].astype(np.float64)
    px, py = xs / SS + x0, ys / SS + y0
    w = Hm[2, 0] * px + Hm[2, 1] * py + Hm[2, 2]
    tu = (Hm[0, 0] * px + Hm[0, 1] * py + Hm[0, 2]) / w
    tv = (Hm[1, 0] * px + Hm[1, 1] * py + Hm[1, 2]) / w
    inside = (tu >= 0) & (tu <= tw - 1) & (tv >= 0) & (tv <= th - 1)
    out = [ndi.map_coordinates(tex[..., c], [tv, tu], order=1, mode='nearest') for c in range(3)]
    rgba = np.dstack(out + [inside.astype(np.float64)])
    res = downsample(rgba, SS)
    h, w2 = res.shape[:2]
    a = res[..., 3:4]
    region = img[y0 : y0 + h, x0 : x0 + w2]
    img[y0 : y0 + h, x0 : x0 + w2] = region * (1 - a) + res[..., :3] * a


def gold_cap(shape, infected, side):
    """The sheet of gold of the pyramidion: a vertical ramp of light with a hot streak."""
    h, w = shape
    v, u = np.mgrid[0:h, 0:w].astype(np.float64)
    v, u = v / h, u / w
    hammer = fbm(h, w, 12, 3, 8)
    ramp = 0.3 + 0.62 * v + 1.0 * np.exp(-(((u - 0.5 + 0.28 * side) / 0.13) ** 2)) + 0.3 * (hammer - 0.5)
    colour = np.array([1.0, 0.45, 0.2]) if infected else np.array([1.0, 0.76, 0.34])
    return np.clip(ramp[..., None] * colour, 0, 1)


def paint_obelisk(img, side, infected):
    """side -1 is the obelisk on the left, its face turned toward the middle of the screen."""
    def m(p):
        return (p[0], p[1]) if side < 0 else (W - p[0], p[1])

    tl, tr, br, bl = (264, 160), (327, 168), (299, 1264), (168, 1272)
    sr_t, sr_b = (342, 170), (333, 1258)
    tip = (311, 82)
    cap_l, cap_r = (262, 161), (343, 168)
    fire_side = -side  # the brazier stands on the side of the middle of the screen
    tex = obelisk_face(3 if side < 0 else 8, 1 if side < 0 else -1, infected)
    if side > 0:
        tex = tex[:, ::-1]
    # the texture is minified a lot near the top: a little blur keeps the signs from shimmering
    tex = ndi.gaussian_filter(tex, (2.2, 1.6, 0))
    side_tex = tex[:, :60] * np.array([0.42, 0.42, 0.5]) + fbm(tex.shape[0], 60, 40, 3, 4)[..., None] * 0.03
    if side < 0:
        warp_quad(img, tex, [m(tl), m(tr), m(br), m(bl)])
        warp_quad(img, side_tex, [m(tr), m(sr_t), m(sr_b), m(br)])
    else:
        warp_quad(img, tex, [m(tr), m(tl), m(bl), m(br)])
        warp_quad(img, side_tex, [m(sr_t), m(tr), m(br), m(sr_b)])
    # the collar and the two faces of gold
    capt = gold_cap((360, 200), infected, 0.5 * side)
    a, b = m(tip), m(tip)
    if side < 0:
        warp_quad(img, capt, [(a[0] - 0.5, a[1]), (b[0] + 0.5, b[1]), m(tr), m(cap_l)])
        warp_quad(img, capt * 0.5, [(a[0] - 0.5, a[1]), (b[0] + 0.5, b[1]), m(cap_r), m(tr)])
    else:
        warp_quad(img, capt, [(a[0] - 0.5, a[1]), (b[0] + 0.5, b[1]), m(cap_l), m(tr)])
        warp_quad(img, capt * 0.5, [(a[0] - 0.5, a[1]), (b[0] + 0.5, b[1]), m(tr), m(cap_r)])
    return fire_side


def pyramid_face(img, infected, a, b, c, lit, seed, source):
    """One face, from its apex a and its base corners b and c, course by course."""
    N = 118  # far more courses than the 3D model: this is what makes it read as huge
    SS = 2
    ys, xs = np.mgrid[0 : H * SS, 0 : W * SS].astype(np.float64)
    px, py = xs / SS - a[0], ys / SS - a[1]
    del xs, ys
    # each point is apex + t * (a point u of the way along the base)
    b1, b2 = b[0] - a[0], b[1] - a[1]
    c1, c2 = c[0] - a[0], c[1] - a[1]
    det = b1 * c2 - b2 * c1
    alpha = (px * c2 - py * c1) / det
    beta = (b1 * py - b2 * px) / det
    t = np.maximum(alpha + beta, 1e-6)
    u = beta / t
    # the courses grow a little toward the camera
    t = t**1.12
    row = np.floor(t * N)
    fy = t * N - row
    blocks = np.maximum(3, np.floor(row * 1.15 + 5))
    shift = np.modf(np.sin(row * 12.9898) * 43758.5453)[0]
    pos = u * blocks + shift
    col = np.floor(pos)
    fx = pos - col

    def rand(k):
        return np.abs(np.modf(np.sin(row * 12.9898 + col * 78.233 + k * 37.7) * 43758.5453)[0])

    tone = rand(1)
    # every course steps back: an edge of shadow under the one above, a worn lip below
    riser = smooth(0.0, 0.2, fy) * (0.74 + 0.26 * smooth(0.98, 0.72, fy))
    joint = smooth(0.0, 0.035, fx) * smooth(1.0, 0.965, fx)
    grain = fbm(H, W, 260, 6, seed)
    pit = fbm(H, W, 7, 3, seed + 1)
    grain = ndi.zoom(grain, SS, order=1)
    pit = ndi.zoom(pit, SS, order=1)
    stone = (0.7 + 0.42 * tone) * riser * (0.45 + 0.55 * joint) * (0.68 + 0.64 * grain) * (0.84 + 0.32 * pit)
    gone = rand(2) > 0.996
    stone = np.where(gone, stone * 0.5, stone)
    h = (t * 0.9 + 0.1)
    y_light = lit * (1.0 - 0.28 * t) + (1 - lit) * 0.16
    # the brazier in front of each face warms its foot
    near = np.exp(-(((u - (0.82 if lit > 0.5 else 0.12)) / 0.3) ** 2)) * np.clip(t - 0.4, 0, 1) ** 2 * 1.5
    glow = np.exp(-(t / 0.2) ** 2) * 0.5
    stack = []
    if infected:
        key, warm, amb = np.array([0.95, 0.12, 0.09]), np.array([1.0, 0.2, 0.06]), np.array([0.2, 0.02, 0.02])
    else:
        key, warm, amb = np.array([0.9, 0.9, 1.02]), np.array([1.0, 0.5, 0.18]), np.array([0.13, 0.12, 0.2])
    alb = np.array([0.88, 0.76, 0.58]) if not infected else np.array([0.7, 0.6, 0.55])
    for i in range(3):
        stack.append(stone * alb[i] * (amb[i] + y_light * key[i] * 0.8 + near * warm[i] + glow * warm[i]))
    rgb = np.dstack(stack)
    # the courses narrow in steps up the outer edge, so the silhouette is stepped; the middle edge stays sharp
    inset = 0.55 / blocks
    outer = u > inset if lit > 0.5 else u < 1 - inset
    inner = u < 1 if lit > 0.5 else u > 0
    mask = (t > 0.018) & (t < 1) & outer & inner & (u > -0.1) & (u < 1.1)
    res = downsample(np.dstack([rgb, mask.astype(np.float64)]), SS)
    al = res[..., 3:4]
    out = img * (1 - al) + res[..., :3] * al
    if infected:
        # the burning veins of the 3D render are kept, on the new stone
        burn = smooth(0.2, 0.5, source[..., 1])[..., None] * source
        out = screen(out, burn * al)
    return out


def paint_pyramid(img, infected, source):
    apex = (960 * K, 57 * K)
    # the outer corners go a little past the old silhouette, to cover it
    left, front, right = (2 * K, 917 * K), (546 * K, 1090 * K), (2128 * K, 941 * K)
    img = pyramid_face(img, infected, apex, left, front, 1.0, 31, source)
    return pyramid_face(img, infected, apex, front, right, 0.0, 47, source)


def paint_temple(which, sky=True, obelisks=True):
    infected = which == 'temple_infected'
    src = base_image(which)
    night = base_image('temple_night')
    img = src.copy()
    if sky:
        img = paint_sky(img, infected)
        img = paint_moon(img, infected)
        img = paint_pyramid(img, infected, src)
    if obelisks:
        for side in (-1, 1):
            paint_obelisk(img, side, infected)
        # the bowls of the braziers stand in front of the obelisks
        goldish = (night[..., 0] > 1.75 * night[..., 2]) & (night[..., 0] > 0.3)
        box = np.zeros((H, W), bool)
        box[880:H, 270:600] = True
        box[880:H, W - 600 : W - 270] = True
        keep = ndi.binary_closing(goldish & box, iterations=5)
        keep = ndi.gaussian_filter(keep.astype(np.float64), 1.1)[..., None]
        img = img * (1 - keep) + src * keep
    return np.clip(img, 0, 1)


def run_temple():
    for which in ('temple_night', 'temple_infected'):
        im = Image.fromarray((paint_temple(which) * 255 + 0.5).astype(np.uint8), 'RGB')
        im.save(f'{OUT}{which}.webp', 'WEBP', quality=84, method=6)
        im.resize((1600, 900), Image.LANCZOS).save(f'{OUT}{which}_m.webp', 'WEBP', quality=72, method=6)
        print(which)


# --------------------------------------------------------------------------------------------- dunes


def render_dunes(seed, width, height, crest, amp, light_k, far_haze, shadow_k):
    """A height field drawn front to back, column by column, lit by the moon and by the braziers."""
    SS = 2
    ws, hs = width * SS, height * SS
    nz = 700
    z = np.linspace(0, 1, nz)
    rng = np.random.default_rng(seed)
    xx = np.arange(ws)[None, :] / ws
    zz = z[:, None]
    wander = fbm(nz, ws, 900, 2, seed + 1) - 0.5
    # long dunes: a gentle windward back and a sharper crest, whose lines wander slowly
    terrain = np.zeros((nz, ws))
    for f, g, a in ((1.7, 1.25, 1.0), (3.6, 2.1, 0.34)):
        p = xx * f + zz * g + wander * 0.9 + rng.random()
        w = p - np.floor(p)
        terrain += a * np.minimum(w / 0.74, (1 - w) / 0.26) ** 1.25
    terrain = ndi.gaussian_filter(terrain, (3, 14), mode='nearest')
    terrain = (terrain - terrain.min()) / (terrain.max() - terrain.min())
    gx = np.gradient(terrain, axis=1) * ws / 150
    gz = np.gradient(terrain, axis=0) * nz / 300
    # the wind's ripples follow the ground, closer together with distance
    ground = hs + amp * SS - z**0.85 * (hs + amp * SS - crest * SS)
    fade = np.gradient(ground)[:, None]
    phase = np.cumsum(np.full(nz, 1.0) / (5 + 22 * (1 - z) ** 1.5))[:, None] + terrain * 7 + wander * 16 + xx * 3
    ripple = np.sin(phase * 2 * np.pi)
    calm = smooth(1.5, 0.3, np.abs(gx))
    gzr = gz + ripple * 0.3 * calm
    n = 1 / np.sqrt(1 + gx**2 + gzr**2)
    nx, ny, nn = -gx * n, -gzr * n, n
    moon = np.array([-0.74, 0.3, 0.6])
    moon /= np.linalg.norm(moon)
    dif = np.clip(nx * moon[0] + ny * moon[1] + nn * moon[2], 0, 1)
    # the shadows the crests throw, along the moon
    lift = xx * 1.05
    reach = np.maximum.accumulate(terrain + lift, axis=1) - lift
    shadow = ndi.gaussian_filter(smooth(0.0, 0.03, reach - terrain), (1, 7))
    dif = dif * (1 - shadow_k * shadow)
    fires = np.zeros((nz, ws))
    for fx in (0.135, 0.865):
        fires += np.exp(-(((xx - fx) / 0.24) ** 2)) * np.exp(-(((1 - zz) / 0.75) ** 2))
    fire = fires * (0.45 + 0.55 * (1 - shadow))
    grain = np.random.default_rng(seed + 9).normal(0, 1, (nz, ws))
    grain = ndi.gaussian_filter(grain, (0.7, 0.9))
    grain = grain / grain.std()
    sand = np.array([1.0, 0.78, 0.52])
    sky = np.array([0.14, 0.12, 0.24])
    col = sand * (sky + dif[..., None] * np.array([1.0, 0.93, 0.8]) * 1.15 * light_k + fire[..., None] * np.array([1.0, 0.52, 0.18]) * 0.55)
    col = col * (1 + 0.045 * grain[..., None])
    # the edge of each crest is a thread of light
    edge = smooth(0.35, 0.9, np.abs(gx)) * (1 - shadow) * smooth(0, 0.3, -gx)
    col = col + edge[..., None] * np.array([0.14, 0.13, 0.1]) * light_k
    col = col + ((grain > 3.0) * dif)[..., None] * 0.5
    haze = (zz**1.6 * far_haze)[..., None]
    col = col * (1 - haze) + np.array([0.2, 0.15, 0.22]) * haze
    # drawn near to far: the nearest ground covers what lies behind it
    buf = np.zeros((hs, ws, 4))
    ymin = np.full(ws, hs)
    scale = (1 - 0.5 * z) * amp * SS
    for i in range(nz):
        y = np.clip((ground[i] - terrain[i] * scale[i]).astype(np.int64), 0, hs)
        vis = np.nonzero(y < ymin)[0]
        if len(vis) == 0:
            continue
        top, bot = int(y[vis].min()), int(ymin[vis].max())
        rows = np.arange(top, bot)[:, None]
        mask = (rows >= y[None, vis]) & (rows < ymin[None, vis])
        r, c = np.nonzero(mask)
        buf[r + top, vis[c], :3] = col[i, vis[c]]
        buf[r + top, vis[c], 3] = 1
        ymin[vis] = y[vis]
    return downsample(buf, SS)


def run_dunes():
    save_rgba(f'{OUT}dunes_back.webp', render_dunes(41, 2560, 560, 190, 130, 0.58, 0.55, 0.6))
    save_rgba(f'{OUT}dunes_front.webp', render_dunes(77, 2560, 560, 345, 110, 0.8, 0.2, 0.9))


# --------------------------------------------------------------------------------------------- palms


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def paint_crown(seed, path):
    SS = 3
    w, h = 900, 640
    img = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed)
    cx, cy = w / 2, h * 0.44
    fronds = []
    count = 19
    for i in range(count):
        # a fan of fronds, each with its own weight: no two arch alike
        a = -math.pi * 1.04 + (i + 0.5) / count * math.pi * 1.08 + rng.uniform(-0.09, 0.09)
        fronds.append((rng.random(), a, rng.uniform(300, 430), rng.uniform(0.55, 1.15)))
    for _ in range(7):
        fronds.append((rng.uniform(0.0, 0.5), rng.uniform(0.35, math.pi - 0.35), rng.uniform(190, 260), 0.5))
    fronds.sort(key=lambda f: f[0])
    night_dark = (7, 20, 24)
    night_mid = (20, 48, 44)
    moonlit = (178, 206, 196)
    fire = (240, 150, 64)
    for depth, a, L, weight in fronds:
        steps = 40
        pts = []
        for s in range(steps + 1):
            t = s / steps
            x = cx + math.cos(a) * L * t
            y = cy + math.sin(a) * L * 0.8 * t + weight * L * t * t * 0.74
            pts.append((x, y))
        for s in range(1, steps):
            t = s / steps
            x, y = pts[s]
            tx, ty = pts[s + 1][0] - pts[s - 1][0], pts[s + 1][1] - pts[s - 1][1]
            ang = math.atan2(ty, tx)
            leaf = 92 * math.sin(math.pi * min(1, t * 0.9 + 0.06)) ** 0.7 * (L / 380)
            for sgn in (-1, 1):
                # a leaflet here and there is torn away
                if rng.random() < 0.07:
                    continue
                aa = ang + sgn * (0.9 - 0.42 * t) + rng.uniform(-0.07, 0.07)
                lx = x + math.cos(aa) * leaf
                ly = y + math.sin(aa) * leaf + leaf * 0.36
                mx = x + math.cos(aa) * leaf * 0.5
                my = y + math.sin(aa) * leaf * 0.5 + leaf * 0.09
                bx, by = -math.sin(aa) * 2.3 * (1 - t * 0.5), math.cos(aa) * 2.3 * (1 - t * 0.5)
                up = ly < y
                colour = lerp(night_dark, night_mid, depth)
                # the moon, up and to the left, whitens the top of what faces it
                facing = (0.5 - 0.5 * (x - cx) / 430) * (1 if up else 0.25)
                glint = rng.random() ** 2.4
                colour = lerp(colour, moonlit, min(1, facing * glint * (0.3 + 0.95 * depth)))
                # the fires below warm the underside, on the right
                under = (0.5 + 0.5 * (x - cx) / 430) * (0 if up else 1)
                colour = lerp(colour, fire, 0.5 * under * glint * depth)
                poly = [(x + bx, y + by), (mx + bx, my + by), (lx, ly), (mx - bx, my - by), (x - bx, y - by)]
                d.polygon([(px * SS, py * SS) for px, py in poly], fill=tuple(int(c) for c in colour) + (255,))
        rib = lerp((12, 26, 24), (150, 160, 120), depth * 0.75)
        d.line([(px * SS, py * SS) for px, py in pts[:-3]], fill=tuple(int(c) for c in rib) + (255,), width=int(2.6 * SS), joint='curve')
    # bunches of dates hanging under the heart of the crown
    for k in (-1, 1):
        for i in range(30):
            x = cx + k * rng.uniform(16, 58)
            y = cy + rng.uniform(16, 70) + abs(x - cx) * 0.2
            s = rng.uniform(3.6, 5.6)
            c = lerp((74, 32, 14), (232, 140, 44), rng.random() ** 2.2)
            d.ellipse([(x - s) * SS, (y - s * 1.35) * SS, (x + s) * SS, (y + s * 1.35) * SS], fill=tuple(int(q) for q in c) + (255,))
    a = np.asarray(img, dtype=np.float64) / 255
    save_rgba(path, downsample(a, SS), 84)


def paint_trunk(seed, path, bend):
    w, h = 170, 820
    SS = 2
    ws, hs = w * SS, h * SS
    yy, xx = np.mgrid[0:hs, 0:ws].astype(np.float64)
    t = yy / hs  # 0 at the crown, 1 at the foot
    cx = ws / 2 + bend * SS * (t - 1) ** 2 * 1.0 - bend * SS * 0.0 - bend * SS / 2 * 0
    width = (22 + 24 * t**1.6 + 13 * np.exp(-((1 - t) / 0.06)) ) * SS
    rings = np.sin(yy / SS / 15 * 2 * np.pi + (fbm(hs, ws, 60, 2, seed) - 0.5) * 7)
    ragged = 0.5 + 0.5 * np.sign(rings) * np.abs(rings) ** 0.45
    u = (xx - cx) / (width * (1 + 0.075 * ragged))
    z = np.sqrt(np.clip(1 - u * u, 0, 1))
    bark = fbm(hs, ws, 16, 4, seed + 1)
    fibre = ndi.gaussian_filter(np.random.default_rng(seed).random((hs, ws)), (7, 0.9))
    fibre = (fibre - fibre.mean()) / fibre.std()
    albedo = (0.2 + 0.06 * ragged + 0.12 * (bark - 0.5))[..., None] * np.array([1.0, 0.74, 0.5])
    albedo = albedo * (1 + 0.1 * fibre[..., None])
    moon = np.clip(-u * 0.82 + z * 0.56, 0, 1) ** 1.3
    fire = np.clip(u * 0.8 + z * 0.3, 0, 1) ** 1.5 * (0.28 + 1.1 * t**1.5)
    light = np.array([0.16, 0.15, 0.24]) + moon[..., None] * np.array([0.72, 0.84, 1.14]) * 1.5 + fire[..., None] * np.array([1.0, 0.54, 0.2]) * 1.6
    rgb = albedo * light
    alpha = smooth(1.0, 0.94, np.abs(u))
    # the old leaf bases just under the crown
    alpha = alpha * smooth(0.0, 0.008, t)
    save_rgba(path, downsample(np.dstack([rgb, alpha]), SS), 84)


def paint_column(seed, path):
    """A broken column of the temple, fluted, with a band of signs, standing in the sand."""
    w, h = 300, 640
    SS = 2
    ws, hs = w * SS, h * SS
    m = Image.new('L', (ws, hs), 0)
    d = ImageDraw.Draw(m)
    y = 330 * SS
    for i, kind in enumerate(['eye', 'ankh', 'scarab']):
        glyph(d, kind, ws // 2 + (i - 1) * 74 * SS, y, 30 * SS)
    gl = ndi.gaussian_filter(np.asarray(m, dtype=np.float64) / 255, 1.5 * SS)
    yy, xx = np.mgrid[0:hs, 0:ws].astype(np.float64)
    u = (xx - ws / 2) / (ws * 0.42)
    z = np.sqrt(np.clip(1 - u * u, 0, 1))
    flutes = np.cos(np.arcsin(np.clip(u, -1, 1)) * 16)
    band = smooth(0.415, 0.425, yy / hs) * smooth(0.605, 0.595, yy / hs)
    nu = u + 0.42 * flutes * (1 - band)
    moon = np.clip(-nu * 0.8 + z * 0.6, 0, 1)
    fire = np.clip(nu * 0.8 + z * 0.3, 0, 1) ** 1.6 * (0.3 + 0.9 * (yy / hs) ** 1.5)
    weather = fbm(hs, ws, 34, 6, seed, 0.62)
    alb = (0.6 + 0.9 * (weather - 0.5))[..., None] * np.array([0.92, 0.78, 0.58])
    rgb = alb * (np.array([0.13, 0.12, 0.2]) + moon[..., None] * np.array([0.85, 0.86, 1.0]) + fire[..., None] * np.array([1.0, 0.5, 0.18]) * 1.2)
    gold = gl[..., None]
    rgb = rgb * (1 - gold) + np.array([1.0, 0.72, 0.28]) * (0.2 + 0.7 * moon[..., None] + fire[..., None]) * gold
    for y0, y1 in ((0.42, 0.45), (0.57, 0.6)):
        ring = (smooth(y0 - 0.002, y0, yy / hs) * smooth(y1 + 0.002, y1, yy / hs))[..., None]
        rgb = rgb * (1 - ring) + np.array([1.0, 0.72, 0.3]) * (0.14 + 0.75 * moon[..., None] + fire[..., None]) * ring
    # the top is broken off
    x = np.arange(ws) / ws
    rough = fbm(1, ws, 40, 5, seed + 3)[0]
    top = (0.1 + 0.62 * (x * 0.8 + 0.1) ** 1.4 + 0.2 * (rough - 0.5)) * 0.42 * hs + 0.02 * hs
    alpha = smooth(1.0, 0.97, np.abs(u)) * smooth(0, 3, yy - top[None, :])
    save_rgba(path, downsample(np.dstack([rgb, alpha]), SS), 84)


def run_palms():
    paint_crown(5, f'{OUT}palm_a_crown.webp')
    paint_trunk(5, f'{OUT}palm_a_trunk.webp', 46)
    paint_crown(12, f'{OUT}palm_b_crown.webp')
    paint_trunk(12, f'{OUT}palm_b_trunk.webp', -30)
    paint_column(3, f'{OUT}ruin_column.webp')


if __name__ == '__main__':
    jobs = {'sky': run_temple, 'dunes': run_dunes, 'palms': run_palms}
    for name in sys.argv[1:] or list(jobs):
        jobs[name]()
