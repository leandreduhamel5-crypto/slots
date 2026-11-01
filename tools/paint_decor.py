"""
Paints what the 3D render of tools/render_temple.py does not cover, into src/game/art/egypt/:

  temple_night / temple_infected   sky and moon under the rendered court
  corridor_door                    a doorway of the corridor inside the pyramid

Run from the root of the repository: python tools/paint_decor.py [sky|door]
It needs numpy, scipy and Pillow.
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

OUT = 'src/game/art/egypt/'
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


def paint_sky(infected):
    """The whole sky: a deep gradient, the Milky Way, thin clouds and a dust of stars."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    v = yy / H
    if infected:
        top, low = np.array([0.1, 0.008, 0.016]), np.array([0.62, 0.075, 0.03])
    else:
        top, low = np.array([0.012, 0.016, 0.05]), np.array([0.2, 0.09, 0.2])
    t = smooth(0.0, 0.62, v)[..., None] ** 1.5
    img = top * (1 - t) + low * t
    d = xx * 0.42 + yy * 0.9 - 1000
    cloud = fbm(H, W, 420, 6, 11)
    rift = smooth(0.46, 0.66, fbm(H, W, 150, 5, 23))
    band = np.exp(-((d + (cloud - 0.5) * 420) / 300) ** 2) * (0.3 + 1.3 * smooth(0.3, 0.75, cloud))
    band *= 1 - 0.75 * rift * np.exp(-(d / 150) ** 2)
    glow = np.exp(-((d - 40) / 150) ** 2) * smooth(0.35, 0.7, cloud)
    if infected:
        add = band[..., None] * np.array([0.26, 0.015, 0.02]) + glow[..., None] * np.array([0.44, 0.1, 0.03])
    else:
        add = band[..., None] * np.array([0.05, 0.065, 0.16]) + glow[..., None] * np.array([0.16, 0.11, 0.15])
    wisps = smooth(0.5, 0.74, fbm(H, W, 300, 6, 37))[..., None]
    add = add + wisps * (np.array([0.32, 0.03, 0.03]) if infected else np.array([0.035, 0.035, 0.07]))
    rng = np.random.default_rng(5)
    dust = (rng.random((H, W)) > 0.9994 - 0.0016 * np.clip(band, 0, 1)) * (0.2 + 0.8 * rng.random((H, W)) ** 4)
    dust = ndi.gaussian_filter(dust, 0.62) * 3.2
    add = add + dust[..., None] * (np.array([0.5, 0.2, 0.15]) if infected else np.array([0.92, 0.95, 1.0]))
    return screen(img, add)


def paint_moon(img, infected):
    cx, cy, r = 610 * K, 165 * K, 104
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
    air = np.exp(-((dist - 1) * 1.1).clip(0)) * 0.26
    tint = np.array([0.9, 0.2, 0.1]) if infected else np.array([0.5, 0.52, 0.62])
    out = screen(out, air[..., None] * tint)
    region = out[y0 : y0 + h, x0 : x0 + w]
    a = moon[..., 3:4]
    out[y0 : y0 + h, x0 : x0 + w] = region * (1 - a) + moon[..., :3] * a
    return out


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


def run_temple():
    """The sky and the moon, under the court that tools/render_temple.py has rendered."""
    for which in ('night', 'infected'):
        infected = which == 'infected'
        img = paint_moon(paint_sky(infected), infected)
        court = Image.open(f'tools/out/court_{which}.png').convert('RGBA').resize((W, H), Image.LANCZOS)
        c = np.asarray(court, dtype=np.float64) / 255
        a = c[..., 3:4]
        img = img * (1 - a) + c[..., :3] * a
        im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')
        im.save(f'{OUT}temple_{which}.webp', 'WEBP', quality=84, method=6)
        im.resize((2048, 1152), Image.LANCZOS).save(f'{OUT}temple_{which}_m.webp', 'WEBP', quality=72, method=6)
        print(which)


# ------------------------------------------------------------------------------------------ doorway


def paint_door(path):
    """Limestone courses around an opening, carved columns of gold signs, a lintel with a winged disc."""
    S = 1024
    SS = 2
    n = S * SS
    hole_pts = [(0.3, 0.86), (0.34, 0.2), (0.66, 0.2), (0.7, 0.86)]
    m = Image.new('L', (n, n), 0)
    ImageDraw.Draw(m).polygon([(x * n, y * n) for x, y in hole_pts], fill=255)
    hole = np.asarray(m, dtype=np.float64) / 255
    g = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(g)
    for cx, seq in ((0.235, ['ankh', 'eye', 'djed', 'scarab', 'was', 'sun']), (0.765, ['eye', 'ankh', 'cobra', 'lotus', 'feather', 'bird'])):
        for i, kind in enumerate(seq):
            glyph(d, kind, int(cx * n), int((0.27 + i * 0.105) * n), int(0.038 * n))
    # the winged disc of the lintel
    d.ellipse([0.47 * n, 0.128 * n, 0.53 * n, 0.188 * n], fill=255)
    for k in (-1, 1):
        for r in range(4):
            y = 0.138 + r * 0.012
            d.line([((0.5 + k * 0.03) * n, y * n), ((0.5 + k * (0.17 - r * 0.03)) * n, (y - 0.004) * n)], fill=255, width=int(0.008 * n))
    gl = ndi.gaussian_filter(np.asarray(g, dtype=np.float64) / 255, 2.5)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    row = np.floor(yy / (0.075 * n))
    fy = yy / (0.075 * n) - row
    bw = 0.17 * n
    off = (row % 2) * 0.5
    fx = (xx / bw + off) % 1
    block = np.floor(xx / bw + off)
    tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
    joint = smooth(0, 0.03, fy) * smooth(1, 0.97, fy) * smooth(0, 0.016, fx) * smooth(1, 0.984, fx)
    grain = fbm(n, n, 150, 6, 21)
    pit = fbm(n, n, 10, 3, 22)
    height = 0.7 * joint + 0.35 * (grain - 0.5) + 0.12 * (pit - 0.5) - 1.5 * ndi.gaussian_filter(gl, 5)
    gx = ndi.sobel(height, axis=1) / 8
    gy = ndi.sobel(height, axis=0) / 8
    nz = 1 / np.sqrt(1 + (gx * 9) ** 2 + (gy * 9) ** 2)
    nx, ny = -gx * 9 * nz, -gy * 9 * nz
    # the light comes from the torches of the next chamber, through the opening
    lx, ly, lz = 0.5 * n - xx, 0.56 * n - yy, np.full_like(xx, 0.26 * n)
    ln = np.sqrt(lx**2 + ly**2 + lz**2)
    dif = np.clip((nx * lx + ny * ly + nz * lz) / ln, 0, 1)
    fall = np.exp(-(((xx / n - 0.5) ** 2 + (yy / n - 0.56) ** 2) / 0.12))
    alb = (0.62 + 0.3 * tone + 0.5 * (grain - 0.5))[..., None] * np.array([0.92, 0.72, 0.5]) * joint[..., None] ** 0.6
    rgb = alb * (np.array([0.07, 0.04, 0.05]) + (dif * fall)[..., None] * np.array([1.3, 0.72, 0.36]))
    gold = np.clip(gl, 0, 1)[..., None]
    rgb = rgb * (1 - gold) + np.array([1.0, 0.7, 0.26]) * (0.16 + (dif * fall)[..., None] * 1.05) * gold
    # the thickness of the wall, dark round the opening, and a thread of firelight on its edge
    around = ndi.gaussian_filter(hole, 26)
    rgb = rgb * (1 - 0.8 * around[..., None])
    rim = np.clip(ndi.gaussian_filter(hole, 3) * (1 - hole) * 4, 0, 1)[..., None]
    rgb = rgb + rim * np.array([0.7, 0.26, 0.08])
    fade = smooth(0.5, 0.26, np.hypot(xx / n - 0.5, yy / n - 0.52))
    save_rgba(path, downsample(np.dstack([rgb, (1 - hole) * fade]), SS), 82)


def run_door():
    paint_door(f'{OUT}corridor_door.webp')


if __name__ == '__main__':
    jobs = {'sky': run_temple, 'door': run_door}
    for name in sys.argv[1:] or list(jobs):
        jobs[name]()
