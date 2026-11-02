"""
A true 3D render of the temple, ray marched per pixel with numpy: a hypostyle hall in the manner of
Karnak, great painted columns under a ceiling of stars, opening on the Great Pyramid, with the moon
coming in low between the columns. The geometry is marched once into a G-buffer, then lit twice:
the moonlit night and the infected temple.

  python tools/render_temple.py [scale]       scale 0.25 is a quick look, 1 the final picture
  python tools/render_temple.py maps          only the light maps, in two minutes

It writes tools/out/court_night.png and court_infected.png, transparent where the sky shows.
tools/paint_decor.py then lays them over its sky. It prints where the props fall on screen, for
src/game/art/templeHD.ts. It also writes temple_map_a and temple_map_b into the art folder: the
normals, the depth and the colours of the surfaces, with which the game relights the picture live.
"""
import math
import sys
import time

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, 'tools')
from paint_decor import glyph, GLYPHS, fbm, smooth  # noqa: E402

W, H = 2560, 1440
FOCAL = 1400
HORIZON_Y = 880
CAM = np.array([0.0, 2.4, 0.0])

# the hall: two rows of columns either side of an open nave
ROW_NEAR = 15.5
ROW_FAR = 30.0
WALL_X = 42.0
FIRST_Z = 19.0
BAY = 11.5
BAYS = 9
SHAFT_TOP = 15.0
COL_TOP = 19.6
BEAM_Y = 20.7
ROOF_Y = 22.2
HALL_END = FIRST_Z + (BAYS - 1) * BAY + 6
# the avenue of sphinxes in the nave
SPHINX_X = 5.2
SPHINX_FIRST = 34.0
SPHINX_BAY = 12.0
SPHINX_COUNT = 5
# the Great Pyramid, past the end of the hall
PYR = np.array([0.0, 0.0, 420.0])
PYR_H = 242.6
PYR_B = 192.0
PYR_ROT = 0.62
COURSE = 1.8

# the pylon that closes the avenue, its gate of gold open on the light
PYLON_Z = 128.0
PYLON_X = 13.5
PYLON_H = 37.0
GATE_W = 3.6
GATE_H = 18.0
# the two warm lights: the slot itself, floating in the nave, and the gate at the far end
SLOT_LIGHT = (0.0, 9.0, 8.0)
GATE_LIGHT = (0.0, 7.0, PYLON_Z - 8.0)

STONE, COLUMN, SAND, ROOF, PAVING, PYRAMID, NEMES, FACE, SPHINX, PYLON, GATE = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11


def box(x, y, z, bx, by, bz):
    dx, dy, dz = np.abs(x) - bx, np.abs(y) - by, np.abs(z) - bz
    outside = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2 + np.maximum(dz, 0) ** 2)
    return outside + np.minimum(np.maximum(np.maximum(dx, dy), dz), 0)


def ellipsoid(x, y, z, rx, ry, rz):
    k0 = np.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2) + 1e-6
    k1 = np.sqrt((x / rx**2) ** 2 + (y / ry**2) ** 2 + (z / rz**2) ** 2) + 1e-6
    return k0 * (k0 - 1) / k1


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def capsule(px, py, pz, a, b, r):
    bax, bay, baz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    pax, pay, paz = px - a[0], py - a[1], pz - a[2]
    h = np.clip((pax * bax + pay * bay + paz * baz) / (bax**2 + bay**2 + baz**2), 0, 1)
    return np.sqrt((pax - bax * h) ** 2 + (pay - bay * h) ** 2 + (paz - baz * h) ** 2) - r


def ground_h(x, z):
    """Sand heaped by the wind round the foot of the columns and along the walls; beyond the hall, the desert."""
    lx, lz = row_coords(x, z)
    r = np.sqrt(lx**2 + lz**2)
    tail = np.exp(-(((lz + 2.0) / 3.4) ** 2))
    heap = np.exp(-np.maximum(r - 2.6, 0) / (1.1 + 1.5 * tail)) * (0.85 + 0.25 * np.sin(z * 0.9 + x * 0.5))
    wall = np.exp(-(np.maximum(WALL_X - np.abs(x), 0)) / 4.0) * 1.6
    far = smooth(HALL_END, HALL_END + 40, z) * (0.6 + 0.34 * np.sin(x * 0.19 + z * 0.09) + 0.26 * np.sin(x * 0.08 - z * 0.15 + 1.3))
    return heap + wall + far - 0.42


def row_coords(x, z):
    """Position relative to the nearest column of the hall."""
    a = np.abs(x)
    cx = np.where(a < (ROW_NEAR + ROW_FAR) / 2, ROW_NEAR, ROW_FAR)
    k = np.clip(np.round((z - FIRST_Z) / BAY), 0, BAYS - 1)
    return a - cx, z - FIRST_Z - k * BAY


def column(lx, y, lz):
    """A drum base, a tapering shaft, and the open papyrus of the capital under its square abacus."""
    r = np.sqrt(lx**2 + lz**2)
    t = np.clip((y - SHAFT_TOP) / (COL_TOP - SHAFT_TOP), 0, 1)
    shaft = 2.18 - 0.22 * np.clip(y / SHAFT_TOP, 0, 1)
    bell = shaft + 1.72 * t**1.7
    ring = 0.09 * np.exp(-(((y - SHAFT_TOP) / 0.28) ** 2)) + 0.06 * np.exp(-(((y - SHAFT_TOP + 0.9) / 0.2) ** 2))
    d = (r - (bell + ring)) * 0.8
    d = np.maximum(d, y - COL_TOP)
    base = np.maximum((r - 2.95) * 0.9, y - 0.95) - 0.05
    abacus = box(lx, y - (COL_TOP + 0.45), lz, 2.1, 0.46, 2.1)
    return np.minimum(np.minimum(d, base), abacus)


def sphinx(a, h, b):
    """A lion's body and a king's head, seen from the side. a runs from the paws to the tail, h is the height."""
    plinth = box(a - 3.9, h - 0.22, b, 4.3, 0.24, 1.25)
    haunch = ellipsoid(a - 6.3, h - 1.25, b, 1.75, 1.05, 1.02)
    torso = ellipsoid(a - 4.2, h - 1.4, b, 2.5, 0.92, 0.92)
    chest = ellipsoid(a - 2.35, h - 1.85, b, 0.86, 1.28, 0.84)
    neck = ellipsoid(a - 2.2, h - 3.0, b, 0.5, 0.72, 0.46)
    paw_a = capsule(a, h, b, (2.3, 0.72, 0.56), (0.25, 0.72, 0.56), 0.27)
    paw_b = capsule(a, h, b, (2.3, 0.72, -0.56), (0.25, 0.72, -0.56), 0.27)
    leg = ellipsoid(a - 6.2, h - 0.8, np.abs(b) - 0.72, 1.1, 0.42, 0.32)
    body = smin(smin(smin(smin(torso, haunch, 0.5), chest, 0.45), neck, 0.2), leg, 0.2)
    body = np.minimum(smin(body, np.minimum(paw_a, paw_b), 0.2), plinth)
    cap = ellipsoid(a - 2.15, h - 3.72, b, 0.66, 0.55, 0.62)
    cap = np.maximum(cap, -ellipsoid(a - 1.7, h - 3.5, b, 0.4, 0.48, 0.37))
    w = 0.52 + np.clip(3.55 - h, 0, 0.95) * 0.6
    wings = np.maximum(np.maximum(np.abs(b) - w, np.abs(a - 2.25) - 0.36), np.maximum(h - 3.6, 2.65 - h)) * 0.7
    wings = np.maximum(wings, -ellipsoid(a - 1.72, h - 3.2, b, 0.36, 0.65, 0.38))
    nemes = np.minimum(cap, wings)
    face = ellipsoid(a - 1.98, h - 3.42, b, 0.4, 0.5, 0.34)
    face = smin(face, ellipsoid(a - 1.58, h - 3.4, b, 0.09, 0.16, 0.07), 0.05)
    return body, nemes, face


def scene(x, y, z):
    """Distance to the nearest surface."""
    return scene_id(x, y, z)[0]


def scene_id(x, y, z):
    ids = np.full(x.shape, SAND, np.int8)
    d = (y - ground_h(x, z)) * 0.8

    def add(dist, material):
        nonlocal d, ids
        near = dist < d
        ids = np.where(near, material, ids)
        d = np.minimum(d, dist)

    # the paving, the sand lying on top of it
    add(y + 0.0, PAVING)
    # the Great Pyramid, in courses
    px, pz = x - PYR[0], z - PYR[2]
    c, s = math.cos(PYR_ROT), math.sin(PYR_ROT)
    rx, rz = px * c + pz * s, -px * s + pz * c
    level = np.floor(np.clip(y, 0, PYR_H) / COURSE) * COURSE
    half = PYR_B * (1 - level / PYR_H)
    add(np.maximum(np.maximum(np.abs(rx), np.abs(rz)) - half, y - PYR_H) * 0.62, PYRAMID)
    # the columns
    lx, lz = row_coords(x, z)
    add(column(lx, y, lz), COLUMN)
    a = np.abs(x)
    mid = (FIRST_Z + HALL_END) / 2 - 3
    length = (HALL_END - FIRST_Z) / 2 + 9
    # beams along the rows and across the aisles, the roof on them, and the outer wall
    add(box(a - ROW_NEAR, y - BEAM_Y, z - mid, 1.9, 0.8, length), STONE)
    add(box(a - ROW_FAR, y - BEAM_Y, z - mid, 1.9, 0.8, length), STONE)
    across = np.clip(np.round((z - FIRST_Z) / BAY), 0, BAYS - 1)
    add(box(a - (ROW_NEAR + WALL_X) / 2, y - BEAM_Y, z - FIRST_Z - across * BAY, (WALL_X - ROW_NEAR) / 2, 0.8, 1.2), STONE)
    add(box(a - (ROW_NEAR + WALL_X) / 2 - 1.0, y - (ROOF_Y + 0.35), z - mid, (WALL_X - ROW_NEAR) / 2 + 2.6, 0.55, length), ROOF)
    add(box(a - WALL_X, y - ROOF_Y / 2, z - mid, 1.0, ROOF_Y / 2, length), STONE)
    # the avenue
    b_k = np.clip(np.round((z - SPHINX_FIRST) / SPHINX_BAY), 0, SPHINX_COUNT - 1)
    sb, snemes, sface = sphinx(a - SPHINX_X, y, z - SPHINX_FIRST - b_k * SPHINX_BAY)
    add(sb, SPHINX)
    add(snemes, NEMES)
    add(sface, FACE)
    # the pylon: two battered towers, and the gate between them
    add(box(a - PYLON_X, y - PYLON_H / 2, z - PYLON_Z, 10.6 - y * 0.09, PYLON_H / 2, 3.6) * 0.86, PYLON)
    add(box(x, y - (GATE_H + 3.0) / 2, z - PYLON_Z, GATE_W + 1.4, (GATE_H + 3.0) / 2, 2.4), PYLON)
    add(box(x, y - GATE_H / 2, z - (PYLON_Z - 2.45), GATE_W, GATE_H / 2, 0.08), GATE)
    return d, ids


def march(ox, oy, oz, dx, dy, dz, tmax, steps):
    t = np.full(dx.shape, 0.05, np.float32)
    hit = np.zeros(dx.shape, bool)
    alive = np.arange(dx.size)
    for _ in range(steps):
        if alive.size == 0:
            break
        p = t[alive]
        d = scene(ox[alive] + dx[alive] * p, oy[alive] + dy[alive] * p, oz[alive] + dz[alive] * p)
        t[alive] = p + d * 0.92
        done = d < 0.0012 * p
        hit[alive[done]] = True
        keep = (~done) & (t[alive] < tmax)
        alive = alive[keep]
    return t, hit


def normals(x, y, z, eps):
    nx = scene(x + eps, y, z) - scene(x - eps, y, z)
    ny = scene(x, y + eps, z) - scene(x, y - eps, z)
    nz = scene(x, y, z + eps) - scene(x, y, z - eps)
    n = np.sqrt(nx**2 + ny**2 + nz**2) + 1e-9
    return nx / n, ny / n, nz / n


def soft_shadow(x, y, z, l, tmax, steps, k):
    res = np.ones(x.shape, np.float32)
    t = np.full(x.shape, 0.12, np.float32)
    alive = np.arange(x.size)
    for _ in range(steps):
        if alive.size == 0:
            break
        p = t[alive]
        d = scene(x[alive] + l[0] * p, y[alive] + l[1] * p, z[alive] + l[2] * p)
        res[alive] = np.minimum(res[alive], k * d / p)
        t[alive] = p + np.clip(d, 0.08, 6.0)
        alive = alive[(d > 0.002) & (t[alive] < tmax)]
    return np.clip(res, 0, 1)


def shadow_to(x, y, z, light, steps, k):
    """Soft shadow towards a point light."""
    lx, ly, lz = light[0] - x, light[1] - y, light[2] - z
    dist = np.sqrt(lx**2 + ly**2 + lz**2) + 1e-6
    lx, ly, lz = lx / dist, ly / dist, lz / dist
    res = np.ones(x.shape, np.float32)
    t = np.full(x.shape, 0.12, np.float32)
    alive = np.arange(x.size)
    for _ in range(steps):
        if alive.size == 0:
            break
        p = t[alive]
        d = scene(x[alive] + lx[alive] * p, y[alive] + ly[alive] * p, z[alive] + lz[alive] * p)
        res[alive] = np.minimum(res[alive], k * d / p)
        t[alive] = p + np.clip(d, 0.08, 6.0)
        alive = alive[(d > 0.002) & (t[alive] < dist[alive] - 0.2)]
    return np.clip(res, 0, 1)


def occlusion(x, y, z, nx, ny, nz):
    occ = np.zeros(x.shape, np.float32)
    w = 1.0
    for s in (0.2, 0.5, 1.0, 2.0, 3.6):
        d = scene(x + nx * s, y + ny * s, z + nz * s)
        occ += w * np.maximum(s - d, 0) / s
        w *= 0.72
    return np.clip(1 - occ * 0.42, 0, 1)


MOON_DIR = np.array([0.296, 0.524, 1.0], np.float32)
MOON_DIR /= np.linalg.norm(MOON_DIR)


def rays(w, h, scale):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = (xx / scale - W / 2) / FOCAL
    dy = (HORIZON_Y - yy / scale) / FOCAL
    dz = np.ones_like(dx)
    n = np.sqrt(dx**2 + dy**2 + dz**2)
    return (dx / n).ravel(), (dy / n).ravel(), (dz / n).ravel()


def shafts(scale):
    """The moon in the air of the hall: light scattered along each ray wherever the moon reaches."""
    k = min(scale, 1 / 6)
    w, h = int(W * k), int(H * k)
    dx, dy, dz = rays(w, h, k)
    ox, oy, oz = np.full(dx.shape, CAM[0], np.float32), np.full(dx.shape, CAM[1], np.float32), np.full(dx.shape, CAM[2], np.float32)
    t, hit = march(ox, oy, oz, dx, dy, dz, 130.0, 140)
    tend = np.where(hit, np.minimum(t, 130.0), 130.0)
    glow = np.zeros(dx.shape, np.float32)
    samples = 26
    rng = np.random.default_rng(3)
    for i in range(samples):
        s = (i + rng.random(dx.shape)) / samples * tend
        x, y, z = ox + dx * s, oy + dy * s, oz + dz * s
        vis = soft_shadow(x, y, z, MOON_DIR, 90.0, 16, 12.0)
        # the dust hangs low
        glow += vis * np.exp(-np.maximum(y, 0) / 14.0)
    glow = (glow / samples * (tend / 130.0)).reshape(h, w)
    return ndi.gaussian_filter(glow, 1.4)


def surface(ox, oy, oz, dx, dy, dz, steps, tmax, scale):
    """Marches rays and gathers what shading needs where they land."""
    t, hit = march(ox, oy, oz, dx, dy, dz, tmax, steps)
    idx = np.nonzero(hit)[0]
    x, y, z = ox[idx] + dx[idx] * t[idx], oy[idx] + dy[idx] * t[idx], oz[idx] + dz[idx] * t[idx]
    eps = np.maximum(0.002, t[idx] * 0.0009 / max(scale, 0.25))
    nx, ny, nz = normals(x, y, z, eps)
    ids = scene_id(x, y, z)[1]
    off = 0.06 + t[idx] * 0.002
    sx, sy, sz = x + nx * off, y + ny * off, z + nz * off
    shadow = soft_shadow(sx, sy, sz, MOON_DIR, 300.0, 54, 11.0)
    slot = shadow_to(sx, sy, sz, SLOT_LIGHT, 40, 9.0)
    ao = occlusion(sx, sy, sz, nx, ny, nz)
    return dict(idx=idx, t=t[idx], x=x, y=y, z=z, nx=nx, ny=ny, nz=nz, ids=ids, shadow=shadow, slot=slot, ao=ao, dx=dx[idx], dy=dy[idx], dz=dz[idx])


def gbuffer(scale):
    w, h = int(W * scale), int(H * scale)
    dx, dy, dz = rays(w, h, scale)
    ox, oy, oz = np.full(dx.shape, CAM[0], np.float32), np.full(dx.shape, CAM[1], np.float32), np.full(dx.shape, CAM[2], np.float32)
    t0 = time.time()
    g = surface(ox, oy, oz, dx, dy, dz, 320, 900.0, scale)
    g.update(w=w, h=h)
    print('marched', round(time.time() - t0), 's')
    # the polished floor sees the hall upside down
    floor = np.nonzero(g['ids'] == PAVING)[0]
    rx, ry, rz = g['dx'][floor], -g['dy'][floor], g['dz'][floor]
    px, py, pz = g['x'][floor], np.full(floor.shape, 0.03, np.float32), g['z'][floor]
    g['floor'] = floor
    g['mirror'] = surface(px, py, pz, rx, ry, rz, 200, 800.0, scale)
    g['mirror_size'] = floor.size
    print('mirrored', round(time.time() - t0), 's')
    g['vol'] = shafts(scale)
    print('shafts', round(time.time() - t0), 's')
    return g


def wrap_noise(a, b, size, seed, cells):
    """Tiled noise looked up with world coordinates."""
    tile = fbm(size, size, cells, 5, seed)
    return ndi.map_coordinates(tile, [np.mod(a, size - 1), np.mod(b, size - 1)], order=1, mode='wrap')


def glyph_sheet():
    """Columns of signs in white, cut into the stone of the shafts and walls."""
    S = 1792
    img = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(img)
    i = 0
    for row in range(8):
        for col in range(8):
            glyph(d, GLYPHS[i % len(GLYPHS)], int((col + 0.5) * S / 8), int((row + 0.5) * S / 8), 78)
            i += 1
        i += 3
    a = np.asarray(img, dtype=np.float32) / 255
    return ndi.gaussian_filter(a, 1.6)


def shade(g, infected):
    """Linear colour of the points of a surface."""
    x, y, z = g['x'], g['y'], g['z']
    nx, ny, nz = g['nx'].copy(), g['ny'].copy(), g['nz'].copy()
    ids, t = g['ids'], g['t']
    n = x.size
    alb = np.zeros((n, 3), np.float32)
    spec = np.zeros(n, np.float32)
    emit = np.zeros(n, np.float32)
    burn = np.zeros(n, np.float32)
    # lapis keeps its blue in the warm light
    blue = np.zeros(n, np.float32)
    sheet = glyph_sheet()
    S = sheet.shape[0]
    relief = np.gradient(ndi.gaussian_filter(sheet, 2.2))

    def signs(a, b, size):
        co = [np.mod(b / size, 1) * (S - 1), np.mod(a / size, 1) * (S - 1)]
        return (
            ndi.map_coordinates(sheet, co, order=1, mode='wrap'),
            ndi.map_coordinates(relief[1], co, order=1, mode='wrap'),
            ndi.map_coordinates(relief[0], co, order=1, mode='wrap'),
        )

    grain = wrap_noise(x * 9 + z * 9, y * 9, 512, 3, 60)
    blotch = wrap_noise(x * 2.5 + z * 2.5, y * 2.5, 512, 8, 90)
    fine = wrap_noise(x * 60 + z * 37, y * 60, 512, 4, 14)
    gold_c = np.array([0.95, 0.66, 0.26], np.float32)
    lapis = np.array([0.05, 0.14, 0.44], np.float32)
    red = np.array([0.5, 0.13, 0.08], np.float32)
    green = np.array([0.05, 0.24, 0.2], np.float32)
    sand_c = np.array([0.82, 0.66, 0.46], np.float32)
    lx, lz = row_coords(x, z)

    # the columns: sandstone that still carries its paint, worn in patches
    m = ids == COLUMN
    if m.any():
        th = np.arctan2(lz[m], lx[m])
        arc = th * 2.05
        yy = y[m]
        base = 0.56 + 0.8 * (grain[m] - 0.5) + 0.36 * (blotch[m] - 0.5)
        c = np.outer(base, sand_c)
        idxm = np.nonzero(m)[0]
        bump_a = np.zeros(m.sum(), np.float32)
        bump_b = np.zeros(m.sum(), np.float32)
        paint = np.clip(0.8 + 1.1 * (blotch[m] - 0.5) + 0.4 * (grain[m] - 0.5), 0, 1)[..., None]

        def tint(mask, colour):
            c[mask] = c[mask] * (1 - paint[mask] * 0.92) + colour * paint[mask] * 0.92

        # the skirt of leaves at the foot
        leaf = np.abs(np.mod(th * 7 / math.pi, 2) - 1)
        skirt = (yy > 0.95) & (yy < 3.2) & ((yy - 0.95) / 2.25 < 1 - leaf)
        tint(skirt, green)
        for y0 in (3.3, 12.6):
            for k, colour in enumerate((gold_c, red, lapis, gold_c)):
                tint((yy > y0 + k * 0.17) & (yy < y0 + (k + 1) * 0.17), colour)
        # the shaft: columns of signs, cut deep, gold on lapis panels
        s_, ga, gb = signs(arc + 2.3, yy, 9.0)
        band = (yy > 4.0) & (yy < 12.5)
        panel = band & (np.mod(arc, 1.74) < 1.3)
        tint(panel, lapis)
        carved = panel & (s_ > 0.42)
        tint(carved, gold_c)
        blue[idxm[panel & ~carved]] = 1.0
        bump_a[band] = ga[band] * 13
        bump_b[band] = gb[band] * 13
        spec[idxm[carved]] = 0.8
        emit[idxm[carved]] = 1.0
        rule = band & (np.mod(arc, 1.74) > 1.3) & (np.mod(arc, 1.74) < 1.36)
        tint(rule, gold_c)
        # the rings of the neck, the petals of the capital
        for y0, colour in ((13.5, lapis), (13.9, gold_c), (14.2, red), (14.6, gold_c)):
            tint((yy > y0) & (yy < y0 + 0.28), colour)
        cap = (yy > SHAFT_TOP) & (yy < COL_TOP)
        petal = np.sin(th * 24)
        tint(cap & (petal > 0.35), green)
        tint(cap & (petal < -0.35), lapis)
        tint(cap & (np.abs(petal) <= 0.35) & (np.abs(petal) > 0.15), gold_c)
        rim = (yy > COL_TOP - 0.34) & (yy < COL_TOP)
        c[rim] = gold_c
        spec[idxm[rim | (cap & (np.abs(petal) <= 0.35))]] = 0.9
        bump_a[cap] += (np.cos(th[cap] * 24) * 0.5).astype(np.float32)
        # dirt climbing from the sand
        dirt = np.exp(-np.maximum(yy, 0) / 2.4)[..., None]
        c = c * (1 - 0.5 * dirt)
        alb[m] = c
        # tilt the normal along the surface of the column
        tx, tz = -np.sin(th), np.cos(th)
        nx[m] += bump_a * tx
        nz[m] += bump_a * tz
        ny[m] += bump_b

    # stone of the beams and walls, in courses, carved in long inscriptions
    m = ids == STONE
    if m.any():
        wall_u = np.abs(x[m]) > WALL_X - 1.4
        along = np.where(wall_u, z[m], z[m] + x[m])
        row = np.floor(y[m] / 1.4)
        block = np.floor(along / 3.4 + 0.5 * (row % 2))
        tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
        fy = y[m] / 1.4 - row
        fx = along / 3.4 + 0.5 * (row % 2) - block
        joint = smooth(0, 0.05, fy) * smooth(0, 0.03, fx) * smooth(1, 0.97, fx)
        c = (0.42 + 0.24 * tone + 0.7 * (grain[m] - 0.5)) * (0.34 + 0.66 * joint)
        a = np.outer(c, sand_c)
        s_, _, _ = signs(along, y[m], 11.0)
        beam = y[m] > BEAM_Y - 0.82
        inscribed = (beam | wall_u) & (s_ > 0.42)
        a[beam] = a[beam] * 0.4 + lapis * 0.5
        a[inscribed] = gold_c * 0.85
        alb[m] = a
        idxm = np.nonzero(m)[0]
        spec[idxm[inscribed]] = 0.7
        emit[idxm[inscribed]] = 1.0

    # the ceiling: lapis sown with gold stars, as in the tombs
    m = ids == ROOF
    if m.any():
        fx = np.mod(x[m] / 2.0 + np.floor(z[m] / 2.0) * 0.5, 1) - 0.5
        fz = np.mod(z[m] / 2.0, 1) - 0.5
        r = np.hypot(fx, fz)
        ang = np.arctan2(fz, fx)
        star = r < 0.05 + 0.13 * np.abs(np.cos(ang * 2.5)) ** 3
        c = np.outer(0.6 + 0.8 * (grain[m] - 0.5), lapis)
        c[star] = gold_c * 0.9
        alb[m] = c
        spec[np.nonzero(m)[0][star]] = 0.6
        blue[np.nonzero(m)[0][~star]] = 0.5

    m = ids == SPHINX
    if m.any():
        alb[m] = np.outer(0.75 + 0.6 * (grain[m] - 0.5), [0.07, 0.065, 0.07])
        spec[m] = 0.6
        low = y[m] < 0.46
        a = alb[m]
        a[low] = gold_c
        alb[m] = a
        sp = spec[m]
        sp[low] = 1.0
        spec[m] = sp

    m = ids == NEMES
    if m.any():
        stripe = np.mod(y[m], 0.22) < 0.11
        c = np.zeros((m.sum(), 3), np.float32)
        c[:] = lapis
        c[stripe] = gold_c
        alb[m] = c
        spec[m] = 0.9

    m = ids == FACE
    if m.any():
        alb[m] = gold_c
        spec[m] = 1.0

    m = ids == SAND
    if m.any():
        ripple = np.sin(z[m] * 3.0 + x[m] * 0.9 + 3 * np.sin(x[m] * 0.13))
        nz[m] += ripple * 0.1 * np.clip(1 - t[m] / 80, 0, 1)
        alb[m] = np.outer(0.52 + 0.2 * (fine[m] - 0.5), [0.94, 0.74, 0.5])

    # the floor: black polished stone, slabs set with threads of gold and a lapis runner down the nave
    m = ids == PAVING
    if m.any():
        fx = np.mod(x[m] / 4.2, 1)
        fz = np.mod(z[m] / 4.2, 1)
        line = (np.minimum(fx, 1 - fx) < 0.012) | (np.minimum(fz, 1 - fz) < 0.012)
        c = np.outer(0.05 + 0.05 * grain[m] + 0.05 * (blotch[m] - 0.5), [0.95, 0.9, 0.92])
        c[line] = gold_c * 0.3
        runner = np.abs(x[m]) < 2.1
        edge = np.abs(np.abs(x[m]) - 2.1) < 0.09
        c[runner & ~line] = lapis * 0.26
        blue[np.nonzero(m)[0][runner & ~line]] = 0.5
        c[edge] = gold_c * 0.42
        # diamonds down the runner
        dz_ = np.abs(np.mod(z[m] / 4.2, 1) - 0.5) * 4.2
        c[runner & (np.abs(x[m]) + dz_ < 1.1) & (np.abs(x[m]) + dz_ > 0.98)] = gold_c * 0.42
        alb[m] = c
        spec[m] = 0.5

    m = ids == PYRAMID
    if m.any():
        px, pz = x[m] - PYR[0], z[m] - PYR[2]
        c_, s_ = math.cos(PYR_ROT), math.sin(PYR_ROT)
        rx, rz = px * c_ + pz * s_, -px * s_ + pz * c_
        along = np.where(np.abs(rx) > np.abs(rz), rz, rx)
        row = np.floor(y[m] / COURSE)
        block = np.floor(along / 2.1 + 0.5 * (row % 2))
        tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
        fy = y[m] / COURSE - row
        cc = (0.52 + 0.34 * tone + 0.7 * (grain[m] - 0.5)) * (0.4 + 0.6 * smooth(0.0, 0.2, fy))
        a = np.outer(cc, [0.92, 0.78, 0.58])
        cap = y[m] > PYR_H - 7
        a[cap] = [1.0, 0.72, 0.3]
        alb[m] = a
        sp = spec[m]
        sp[cap] = 1.0
        spec[m] = sp

    # the pylon: courses of stone, its towers carved in columns of gold on lapis
    m = ids == PYLON
    if m.any():
        row = np.floor(y[m] / 1.3)
        block = np.floor(x[m] / 3.0 + 0.5 * (row % 2))
        tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
        fy = y[m] / 1.3 - row
        c = np.outer((0.5 + 0.24 * tone + 0.6 * (grain[m] - 0.5)) * (0.4 + 0.6 * smooth(0, 0.06, fy)), sand_c)
        s_, _, _ = signs(x[m] + 40, y[m], 8.0)
        tower = np.abs(x[m]) > GATE_W + 1.3
        panel = tower & (y[m] > 3.0) & (y[m] < PYLON_H - 3.4) & (np.mod(np.abs(x[m]) - PYLON_X + 16, 5.4) < 4.2)
        c[panel] = lapis * 0.8
        inscribed = panel & (s_ > 0.42)
        c[inscribed] = gold_c
        blue[np.nonzero(m)[0][panel & ~inscribed]] = 0.8
        rim = y[m] > PYLON_H - 1.0
        c[rim] = gold_c
        # the jambs of the gate
        c[(~tower) & (np.abs(np.abs(x[m]) - GATE_W - 0.55) < 0.55) & (y[m] < GATE_H + 1)] = gold_c
        c[(~tower) & (y[m] > GATE_H) & (y[m] < GATE_H + 2.2)] = gold_c
        alb[m] = c
        idxm = np.nonzero(m)[0]
        spec[idxm[inscribed | rim]] = 0.9
        emit[idxm[inscribed]] = 1.0

    # the gate itself is light
    m = ids == GATE
    if m.any():
        gap = 1.25 - 0.45 * (y[m] / GATE_H)
        ax = np.abs(x[m])
        leaf = ax > gap
        idxm = np.nonzero(m)[0]
        s_, _, _ = signs(ax * 1.6 + 7, y[m] * 1.6, 7.0)
        c = np.outer(0.16 + 0.1 * (grain[m] - 0.5), [0.8, 0.5, 0.26])
        studs = (np.mod(y[m], 1.7) < 0.32) & (np.mod(ax + 0.2, 1.05) < 0.3)
        c[studs | (s_ > 0.45)] = gold_c * 0.9
        alb[m] = c
        spec[idxm[studs | (s_ > 0.45)]] = 0.9
        # brightest low down, where it spills out, and thin along the leaves
        burn[idxm[~leaf]] = 0.5 + 0.5 * smooth(GATE_H, 0, y[m][~leaf])
        edge = np.exp(-((ax - gap) / 0.22) ** 2)
        burn[idxm] = np.maximum(burn[idxm], edge * 0.55)

    nn = np.sqrt(nx**2 + ny**2 + nz**2) + 1e-6
    nx, ny, nz = nx / nn, ny / nn, nz / nn
    g['final_n'] = np.stack([nx, ny, nz], 1)
    g['albedo'] = alb
    view = np.stack([g['dx'], g['dy'], g['dz']], 1)
    moon = MOON_DIR
    half = moon - view
    half /= np.linalg.norm(half, axis=1, keepdims=True) + 1e-6
    ndl = np.clip(nx * moon[0] + ny * moon[1] + nz * moon[2], 0, 1)
    ndh = np.clip(nx * half[:, 0] + ny * half[:, 1] + nz * half[:, 2], 0, 1)
    sky = 0.5 + 0.5 * ny
    ao, shadow = g['ao'], g['shadow']
    if infected:
        moon_c, sky_c, fill_c = np.array([1.0, 0.16, 0.08]), np.array([0.15, 0.015, 0.02]), np.array([1.0, 0.16, 0.06])
        warm_c, gate_c = np.array([1.0, 0.13, 0.05]), np.array([1.0, 0.1, 0.04])
        moon_i, fill_i, warm_i, gate_i = 1.0, 0.1, 1.1, 2.0
    else:
        moon_c, sky_c, fill_c = np.array([0.8, 0.84, 1.0]), np.array([0.04, 0.045, 0.1]), np.array([1.0, 0.6, 0.28])
        warm_c, gate_c = np.array([1.0, 0.7, 0.4]), np.array([1.0, 0.62, 0.26])
        moon_i, fill_i, warm_i, gate_i = 0.85, 0.16, 1.25, 2.6
    light = np.outer(ndl * shadow * moon_i, moon_c) + np.outer(sky * ao * 0.8, sky_c)
    # a low light from behind the viewer: the columns keep their paint where nothing else reaches
    fill = np.clip(-(nx * view[:, 0] + ny * view[:, 1] + nz * view[:, 2]), 0, 1) ** 1.5 * np.exp(-t / 46.0)
    light += np.outer(fill * fill_i * ao, fill_c)

    def point(where, reach, strength, colour, occluded):
        """A warm light in the hall: round things turn from it, gold answers it."""
        lx, ly, lz = where[0] - x, where[1] - y, where[2] - z
        d = np.sqrt(lx**2 + ly**2 + lz**2) + 1e-6
        lx, ly, lz = lx / d, ly / d, lz / d
        fall = strength / (1 + (d / reach) ** 2)
        lit = np.clip(nx * lx + ny * ly + nz * lz, 0, 1) * occluded * fall
        hx, hy, hz = lx - view[:, 0], ly - view[:, 1], lz - view[:, 2]
        hn = np.sqrt(hx**2 + hy**2 + hz**2) + 1e-6
        gloss = np.clip((nx * hx + ny * hy + nz * hz) / hn, 0, 1) ** 44
        return np.outer(lit, colour), np.outer(spec * gloss * occluded * fall * 2.4, colour)

    warm, warm_gloss = point(SLOT_LIGHT, 26.0, warm_i, warm_c, g['slot'] * (0.4 + 0.6 * ao))
    gate, gate_gloss = point(GATE_LIGHT, 44.0, gate_i, gate_c, 0.5 + 0.5 * ao)
    light = light + warm + gate
    rgb = alb * light + warm_gloss + gate_gloss
    if not infected:
        rgb += np.outer(blue * (0.4 + 0.6 * ao), [0.003, 0.012, 0.052])
    rgb += np.outer(spec * ndh**40 * shadow * moon_i * 1.8, moon_c)
    rgb += np.outer(burn * 2.6, gate_c)
    fres = np.clip(1 + nx * view[:, 0] + ny * view[:, 1] + nz * view[:, 2], 0, 1) ** 4
    rgb += np.outer(spec * fres * 0.4 * ao, sky_c * 4)
    if infected:
        rgb += np.outer(emit, [1.0, 0.2, 0.05]) * 0.36
    # the air between here and the pyramid
    haze_c = np.array([0.1, 0.01, 0.012]) if infected else np.array([0.02, 0.022, 0.05])
    haze = 1 - np.exp(-t / 620.0)
    rgb = rgb * (1 - haze[:, None]) + haze_c * haze[:, None]
    return rgb


def compose(g, infected):
    """The picture: the surfaces, what the floor reflects, and the moon in the air."""
    rgb = shade(g, infected)
    floor = g['floor']
    if floor.size:
        sky = np.array([0.2, 0.02, 0.02]) if infected else np.array([0.016, 0.02, 0.05])
        seen = np.tile(sky, (floor.size, 1)).astype(np.float32)
        seen[g['mirror']['idx']] = shade(g['mirror'], infected)
        cos_i = np.clip(g['dy'][floor] * -1, 0, 1)
        fresnel = 0.16 + 0.84 * (1 - cos_i) ** 5
        # a floor is never a perfect mirror: scuffs break the reflection up
        wear = 0.82 + 0.18 * np.sin(g['x'][floor] * 3.1 + np.sin(g['z'][floor] * 1.7) * 2)
        rgb[floor] += seen * (fresnel * wear)[..., None]
    vol = ndi.zoom(g['vol'], (g['h'] / g['vol'].shape[0], g['w'] / g['vol'].shape[1]), order=1)
    v = vol[: g['h'], : g['w']].ravel()[g['idx']]
    moon_c = np.array([1.0, 0.16, 0.08]) if infected else np.array([0.8, 0.84, 1.0])
    # compressed: down the open nave the rays cross far more air than between the columns
    rgb += np.outer(v / (1 + 2.5 * v) * 0.26, moon_c * np.array([0.9, 0.9, 1.0]))
    rgb = np.clip((rgb * (2.51 * rgb + 0.03)) / (rgb * (2.43 * rgb + 0.59) + 0.14), 0, 1) ** (1 / 2.2)
    out = np.zeros((g['h'], g['w'], 4), np.float32)
    flat = out.reshape(-1, 4)
    flat[g['idx'], :3] = rgb
    flat[g['idx'], 3] = 1
    return out


def light_maps(g):
    """What the game needs to relight the picture: normals and depth in one image, the colours of the surfaces in the other."""
    w, h = g['w'], g['h']

    def plane(values, empty):
        flat = np.full((w * h,) + values.shape[1:], empty, np.float32)
        flat[g['idx']] = values
        return flat.reshape((h, w) + values.shape[1:])

    n = plane(g['final_n'] * 0.5 + 0.5, 0.5)
    depth = plane(np.log(np.clip(g['t'], 1, 900)) / math.log(900), 1.0)
    a = np.dstack([n[..., 0], n[..., 1], depth])
    # the floor and every far thing are dark in the picture: the colours are kept in the square root, to keep their steps
    b = np.sqrt(np.clip(plane(g['albedo'], 0.0), 0, 1))
    size = (1024, 576)
    for name, data in (('a', a), ('b', b)):
        im = Image.fromarray((np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').resize(size, Image.BILINEAR)
        # the channels of a data map are not a picture: lossy coding would smear them into each other
        im.save(f'src/game/art/egypt/temple_map_{name}.webp', 'WEBP', lossless=name == 'a', quality=100 if name == 'a' else 84, method=6)


def project(px, py, pz):
    z = pz - CAM[2]
    return (W / 2 + FOCAL * (px - CAM[0]) / z) * 0.75, (HORIZON_Y - FOCAL * (py - CAM[1]) / z) * 0.75


def main():
    if sys.argv[1:] == ['maps']:
        g = gbuffer(0.5)
        shade(g, False)
        light_maps(g)
        return
    scale = float(sys.argv[1]) if len(sys.argv) > 1 else 0.25
    # supersampled when final
    ss = 1.5 if scale >= 1 else 1
    g = gbuffer(scale * ss)
    for infected, name in ((False, 'court_night'), (True, 'court_infected')):
        img = compose(g, infected)
        im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
        im = im.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
        im.save(f'tools/out/{name}.png')
    light_maps(g)
    print('apex', project(PYR[0], PYR_H, PYR[2]))
    print('gate', project(0, GATE_H / 2, PYLON_Z - 2.45))
    c, s = math.cos(PYR_ROT), math.sin(PYR_ROT)
    for rx, rz in ((-PYR_B, -PYR_B), (PYR_B, -PYR_B), (-PYR_B, PYR_B)):
        wx, wz = rx * c - rz * s + PYR[0], rx * s + rz * c + PYR[2]
        print('corner', project(wx, 0, wz))


if __name__ == '__main__':
    main()
