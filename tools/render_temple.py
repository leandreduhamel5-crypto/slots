"""
A true 3D render of the temple, ray marched per pixel with numpy: a court of Osiride colossi and
painted columns leading to the Great Pyramid, with real perspective, cast shadows and occlusion.
The geometry is marched once into a G-buffer, then lit twice: the moonlit night and the infected temple.

  python tools/render_temple.py [scale]       scale 0.25 is a quick look, 1 the final picture

It writes tools/out/court_night.png and court_infected.png, transparent where the sky shows.
tools/paint_decor.py then lays them over its sky. It prints where the props fall on screen, for
src/game/art/templeHD.ts.
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

# the court
ROW_X = 21.0  # the lines of colossi, either side of the axis
BAY = 15.0  # distance from one colossus to the next
FIRST_Z = 28.0
BAYS = 7
PIER_H = 19.0
BEAM_H = 2.4
# the avenue of sphinxes: they lie either side of the paving, facing each other across it
SPHINX_X = 5.2
SPHINX_FIRST = 34.0
SPHINX_BAY = 12.0
SPHINX_COUNT = 5
# the Great Pyramid
PYR = np.array([0.0, 0.0, 230.0])
PYR_H = 134.0
PYR_B = 106.0
PYR_ROT = 0.62
COURSE = 1.0
BRAZIER_X = 17.0
BRAZIER_Z = 22.0
BRAZIER_H = 3.6

STONE, BASALT, SAND, GOLD, PAVING, PYRAMID, NEMES, FACE, SPHINX = 1, 2, 3, 4, 5, 6, 7, 8, 9


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


def ground_h(x, z):
    """Pavement down the axis, sand blown over it, and dunes outside the walls."""
    wave = 0.4 * np.sin(x * 0.17 + z * 0.08) + 0.3 * np.sin(x * 0.07 - z * 0.13 + 1.3) + 0.16 * np.sin(x * 0.41 + z * 0.23)
    drift = smooth(5.0, 13.0, np.abs(x) + 2.2 * np.sin(z * 0.11 + x * 0.3) + 1.3 * np.sin(z * 0.37))
    out = smooth(ROW_X + 8, ROW_X + 40, np.abs(x)) * (2.6 + 2.2 * np.sin(z * 0.045 + np.sign(x)))
    return drift * (0.55 + wave) + out


def capsule(px, py, pz, a, b, r):
    bax, bay, baz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    pax, pay, paz = px - a[0], py - a[1], pz - a[2]
    h = np.clip((pax * bax + pay * bay + paz * baz) / (bax**2 + bay**2 + baz**2), 0, 1)
    return np.sqrt((pax - bax * h) ** 2 + (pay - bay * h) ** 2 + (paz - baz * h) ** 2) - r


def colossus(u, y, v):
    """A black and gold guardian against his pier, wrapped, arms crossed on crook and flail, in the striped nemes. u points to the axis."""
    pier = np.minimum(box(u + 2.2, y - PIER_H / 2, v, 2.1, PIER_H / 2, 2.1), box(u + 1.6, y - 0.45, v, 3.0, 0.45, 2.7))
    t = np.clip(y / 11.0, 0, 1)
    rz = 0.92 + 0.3 * t + 0.62 * smooth(0.72, 0.92, t)
    ru = 0.72 + 0.14 * t + 0.28 * smooth(0.72, 0.92, t)
    body = (np.sqrt((v / rz) ** 2 + ((u - 0.75) / ru) ** 2) - 1.0) * np.minimum(rz, ru) * 0.8
    body = np.maximum(body, np.maximum(y - 10.95, 0.9 - y))
    body = smin(body, ellipsoid(u - 0.75, y - 10.65, v, 1.02, 0.5, 1.92), 0.3)
    # forearms folded flat on the chest, under the shroud
    body = smin(body, ellipsoid(u - 1.42, y - 8.95, v - 0.42, 0.34, 0.3, 1.0), 0.35)
    body = smin(body, ellipsoid(u - 1.42, y - 8.45, v + 0.42, 0.34, 0.3, 1.0), 0.35)
    # crook and flail, held across the chest
    crook = capsule(u, y, v, (2.08, 9.2, 0.45), (1.95, 10.85, -0.72), 0.075)
    flail = capsule(u, y, v, (2.08, 9.1, -0.45), (1.95, 10.85, 0.72), 0.075)
    collar = np.maximum(ellipsoid(u - 0.82, y - 10.78, v, 1.2, 0.62, 1.86) - 0.02, 10.25 - y)
    # the face: a mask, with its nose and lips
    face = ellipsoid(u - 1.12, y - 12.33, v, 0.62, 0.8, 0.56)
    face = smin(face, ellipsoid(u - 1.72, y - 12.3, v, 0.13, 0.24, 0.1), 0.08)
    face = smin(face, ellipsoid(u - 1.66, y - 11.92, v, 0.08, 0.06, 0.2), 0.05)
    neck = box(u - 0.9, y - 11.3, v, 0.42, 0.42, 0.4)
    beard = capsule(u, y, v, (1.62, 11.72, 0.0), (1.72, 10.95, 0.0), 0.12)
    # the nemes: a cap over the head, wings falling to the shoulders, two lappets on the chest
    cap = ellipsoid(u - 0.82, y - 12.72, v, 0.98, 0.82, 0.94)
    cap = np.maximum(cap, -(ellipsoid(u - 1.42, y - 12.3, v, 0.6, 0.72, 0.56)))
    w = 0.8 + np.clip(12.25 - y, 0, 1.4) * 0.86
    wings = np.maximum(np.maximum(np.abs(v) - w, np.abs(u - 0.7) - 0.55), np.maximum(y - 12.4, 10.85 - y)) * 0.7
    wings = np.maximum(wings, -(ellipsoid(u - 1.4, y - 12.0, v, 0.55, 1.0, 0.58)))
    lappet = box(u - 1.35, y - 10.05, np.abs(v) - 0.74, 0.14, 0.92, 0.19)
    nemes = np.minimum(np.minimum(cap, wings), lappet)
    uraeus = capsule(u, y, v, (1.72, 12.95, 0.0), (1.82, 13.32, 0.0), 0.085)
    gold = np.minimum(np.minimum(np.minimum(crook, flail), uraeus), collar)
    return pier, smin(body, neck, 0.15), nemes, np.minimum(face, beard), gold


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
    # nemes and mask, turned toward the avenue
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

    # paving of the axis, a thin slab lost under the sand at its edges
    add(box(x, y + 0.5, z - 140, 9.0, 0.56, 150), PAVING)
    # the Great Pyramid, in courses
    px, py, pz = x - PYR[0], y, z - PYR[2]
    c, s = math.cos(PYR_ROT), math.sin(PYR_ROT)
    rx, rz = px * c + pz * s, -px * s + pz * c
    level = np.floor(np.clip(py, 0, PYR_H) / COURSE) * COURSE
    half = PYR_B * (1 - level / PYR_H)
    pyr = np.maximum(np.maximum(np.abs(rx), np.abs(rz)) - half, py - PYR_H)
    add(pyr * 0.62, PYRAMID)
    # the two rows
    u = ROW_X - np.abs(x)
    k = np.clip(np.round((z - FIRST_Z) / BAY), 0, BAYS - 1)
    v = z - FIRST_Z - k * BAY
    pier, body, nemes, face, gold = colossus(u, y, v)
    add(pier, STONE)
    add(body, BASALT)
    add(nemes, NEMES)
    add(face, FACE)
    add(gold, GOLD)
    # the great beam on the piers, and the wall behind them
    span = (FIRST_Z + (BAYS - 1) * BAY + FIRST_Z) / 2
    half_len = ((BAYS - 1) * BAY) / 2 + 8
    add(box(u + 2.2, y - (PIER_H + BEAM_H / 2), z - span, 2.5, BEAM_H / 2, half_len), STONE)
    add(box(u + 7.5, y - (PIER_H + BEAM_H) / 2, z - span, 0.9, (PIER_H + BEAM_H) / 2, half_len), STONE)
    # roof slabs between beam and wall
    add(box(u + 5.2, y - (PIER_H + BEAM_H + 0.3), z - span, 3.4, 0.5, half_len), STONE)
    # the avenue
    b_k = np.clip(np.round((z - SPHINX_FIRST) / SPHINX_BAY), 0, SPHINX_COUNT - 1)
    sb, snemes, sface = sphinx(np.abs(x) - SPHINX_X, y, z - SPHINX_FIRST - b_k * SPHINX_BAY)
    add(sb, SPHINX)
    add(snemes, NEMES)
    add(sface, FACE)
    # gold bowls of the braziers on their stands
    bx, bz = np.abs(x) - BRAZIER_X, z - BRAZIER_Z
    r = np.sqrt(bx**2 + bz**2)
    stand = np.maximum(r - (0.26 + 0.3 * np.exp(-((y - 0.3) ** 2) * 2)), y - BRAZIER_H)
    bowl = np.maximum(np.abs(np.sqrt(r**2 + (y - (BRAZIER_H + 1.1)) ** 2) - 1.15) - 0.05, y - (BRAZIER_H + 0.75))
    add(np.minimum(stand, bowl) * 0.9, GOLD)
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


def occlusion(x, y, z, nx, ny, nz):
    occ = np.zeros(x.shape, np.float32)
    w = 1.0
    for s in (0.2, 0.5, 1.0, 2.0, 3.6):
        d = scene(x + nx * s, y + ny * s, z + nz * s)
        occ += w * np.maximum(s - d, 0) / s
        w *= 0.72
    return np.clip(1 - occ * 0.42, 0, 1)


def gbuffer(scale):
    w, h = int(W * scale), int(H * scale)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = (xx / scale - W / 2) / FOCAL
    dy = (HORIZON_Y - yy / scale) / FOCAL
    dz = np.ones_like(dx)
    n = np.sqrt(dx**2 + dy**2 + dz**2)
    dx, dy, dz = (dx / n).ravel(), (dy / n).ravel(), (dz / n).ravel()
    ox, oy, oz = np.full(dx.shape, CAM[0], np.float32), np.full(dx.shape, CAM[1], np.float32), np.full(dx.shape, CAM[2], np.float32)
    t0 = time.time()
    t, hit = march(ox, oy, oz, dx, dy, dz, 900.0, 320)
    print('marched', round(time.time() - t0), 's')
    idx = np.nonzero(hit)[0]
    x, y, z = ox[idx] + dx[idx] * t[idx], oy[idx] + dy[idx] * t[idx], oz[idx] + dz[idx] * t[idx]
    eps = np.maximum(0.002, t[idx] * 0.0009 / max(scale, 0.25))
    nx, ny, nz = normals(x, y, z, eps)
    ids = scene_id(x, y, z)[1]
    moon_dir = np.array([0.34, 0.66, -0.67], np.float32)
    moon_dir /= np.linalg.norm(moon_dir)
    off = 0.06 + t[idx] * 0.002
    sx, sy, sz = x + nx * off, y + ny * off, z + nz * off
    shadow = soft_shadow(sx, sy, sz, moon_dir, 260.0, 46, 9.0)
    ao = occlusion(sx, sy, sz, nx, ny, nz)
    print('lit', round(time.time() - t0), 's')
    return dict(w=w, h=h, idx=idx, t=t[idx], x=x, y=y, z=z, nx=nx, ny=ny, nz=nz, ids=ids, shadow=shadow, ao=ao, moon=moon_dir, dx=dx[idx], dy=dy[idx], dz=dz[idx])


def wrap_noise(a, b, size, seed, cells):
    """Tiled noise looked up with world coordinates."""
    tile = fbm(size, size, cells, 5, seed)
    return ndi.map_coordinates(tile, [np.mod(a, size - 1), np.mod(b, size - 1)], order=1, mode='wrap')


def glyph_sheet():
    """Rows of signs in white, for the walls, beams and piers."""
    S = 1536
    img = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(img)
    i = 0
    for row in range(8):
        for col in range(8):
            glyph(d, GLYPHS[i % len(GLYPHS)], int((col + 0.5) * S / 8), int((row + 0.5) * S / 8), 66)
            i += 1
        i += 3
    a = np.asarray(img, dtype=np.float32) / 255
    return ndi.gaussian_filter(a, 1.0)


def shade(g, infected):
    x, y, z, nx, ny, nz, ids, t = g['x'], g['y'], g['z'], g['nx'], g['ny'], g['nz'], g['ids'], g['t']
    n = x.size
    alb = np.zeros((n, 3), np.float32)
    spec = np.zeros(n, np.float32)
    emit = np.zeros(n, np.float32)
    sheet = glyph_sheet()
    S = sheet.shape[0]

    def signs(a, b, size):
        return ndi.map_coordinates(sheet, [np.mod(b / size, 1) * (S - 1), np.mod(a / size, 1) * (S - 1)], order=1, mode='wrap')

    v_all = z - FIRST_Z - np.clip(np.round((z - FIRST_Z) / BAY), 0, BAYS - 1) * BAY
    grain = wrap_noise(x * 9 + z * 9, y * 9, 512, 3, 60)
    fine = wrap_noise(x * 60 + z * 37, y * 60, 512, 4, 14)
    u = ROW_X - np.abs(x)

    def relief(mask, strength):
        """Blocks and pits catch the light: a touch of bump on the flat stone."""
        amp = strength * (fine[mask] - 0.5) * np.clip(1.2 - t[mask] / 160, 0.1, 1)
        ny[mask] += amp
        nx[mask] += amp * 0.6

    # stone: sandstone in courses, its blocks each a little different
    m = ids == STONE
    if m.any():
        along = z[m]
        row = np.floor(y[m] / 1.3)
        block = np.floor(along / 3.2 + 0.5 * (row % 2))
        tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
        fy = y[m] / 1.3 - row
        fx = along / 3.2 + 0.5 * (row % 2) - block
        joint = smooth(0, 0.05, fy) * smooth(0, 0.03, fx) * smooth(1, 0.97, fx)
        c = (0.5 + 0.28 * tone + 0.8 * (grain[m] - 0.5)) * (0.34 + 0.66 * joint)
        a = np.outer(c, [0.84, 0.64, 0.44])
        relief(m, 0.5)
        # the great beam and the wall carry a long inscription in gold, with a lapis ground
        s = signs(along, y[m], 9.0)
        beam = (y[m] > PIER_H) & (y[m] < PIER_H + BEAM_H) & (np.abs(u[m] - 0.3) < 0.5)
        pier = (y[m] > 1.2) & (y[m] < PIER_H - 0.6) & (u[m] > -0.2) & (np.abs(v_all[m]) < 1.9)
        wall = ((y[m] > 3) & (y[m] < 17) & (u[m] < -6.0)) | pier
        lapis = beam
        a[lapis] = np.outer(0.5 + 0.5 * grain[m][lapis], [0.05, 0.12, 0.42])
        gold = (beam | wall) & (s > 0.45)
        a[gold] = [0.95, 0.66, 0.24]
        spec[np.nonzero(m)[0][gold]] = 0.7
        emit[np.nonzero(m)[0][beam | wall]] = (s[beam | wall] > 0.45) * 1.0
        alb[m] = a

    k = np.clip(np.round((z - FIRST_Z) / BAY), 0, BAYS - 1)
    v = z - FIRST_Z - k * BAY
    side = np.sign(x)

    # basalt, polished: inscribed down the front
    m = ids == BASALT
    if m.any():
        c = np.outer(0.75 + 0.5 * (grain[m] - 0.5), [0.055, 0.052, 0.06])
        s_ = signs(y[m] * 1.0 + k[m] * 3.1, v[m] * 1.0 + 4.0, 3.2)
        band = (np.abs(v[m]) < 0.34) & (y[m] < 8.3) & (y[m] > 1.0) & (u[m] > 0.9)
        rim = (np.abs(np.abs(v[m]) - 0.34) < 0.03) & (y[m] < 8.3) & (y[m] > 1.0) & (u[m] > 0.9)
        gold_mask = (band & (s_ > 0.4)) | rim
        c[band] = [0.05, 0.12, 0.42]
        c[gold_mask] = [1.0, 0.72, 0.28]
        foot = (y[m] < 1.5)
        c[foot] = [1.0, 0.72, 0.28]
        alb[m] = c
        idxm = np.nonzero(m)[0]
        spec[idxm] = 0.55
        spec[idxm[gold_mask | foot]] = 1.0
        emit[idxm[gold_mask]] = 1.0

    # the striped nemes: gold and lapis
    m = ids == NEMES
    if m.any():
        stripe = np.mod(y[m] + 0.04 * np.abs(v[m]), 0.3) < 0.15
        c = np.zeros((m.sum(), 3), np.float32)
        c[:] = [0.04, 0.11, 0.42]
        c[stripe] = [1.0, 0.72, 0.28]
        alb[m] = c
        idxm = np.nonzero(m)[0]
        spec[idxm] = 0.7
        spec[idxm[stripe]] = 1.0

    # the face: a mask of beaten gold, with eyes of black stone and a lapis brow
    m = ids == FACE
    if m.any():
        c = np.zeros((m.sum(), 3), np.float32)
        c[:] = [1.0, 0.72, 0.3]
        vv, yy = np.abs(v[m]), y[m]
        eye = ((vv - 0.25) / 0.17) ** 2 + ((yy - 12.5) / 0.065) ** 2 < 1
        white = ((vv - 0.25) / 0.2) ** 2 + ((yy - 12.5) / 0.09) ** 2 < 1
        brow = (np.abs(yy - 12.68 - 0.04 * vv) < 0.04) & (vv < 0.48) & (vv > 0.05)
        c[white] = [0.9, 0.86, 0.74]
        c[eye] = [0.01, 0.01, 0.015]
        c[brow] = [0.04, 0.11, 0.42]
        beard = yy < 11.76
        c[beard & (np.mod(yy, 0.13) < 0.065)] = [0.04, 0.11, 0.42]
        alb[m] = c
        spec[m] = 1.0

    m = ids == SPHINX
    if m.any():
        alb[m] = np.outer(0.75 + 0.6 * (grain[m] - 0.5), [0.07, 0.065, 0.07])
        spec[m] = 0.6
        low = y[m] < 0.46
        a = alb[m]
        a[low] = [1.0, 0.72, 0.28]
        alb[m] = a
        sp = spec[m]
        sp[low] = 1.0
        spec[m] = sp

    # sand
    m = ids == SAND
    if m.any():
        ripple = np.sin((z[m] * 2.6 + x[m] * 0.8 + 3 * np.sin(x[m] * 0.13)) * 1.0)
        nz2 = nz[m] + ripple * 0.09 * np.clip(1 - t[m] / 90, 0, 1)
        nn = np.sqrt(nx[m] ** 2 + ny[m] ** 2 + nz2**2)
        nz[m] = nz2 / nn
        nx[m] = nx[m] / nn
        ny[m] = ny[m] / nn
        alb[m] = np.outer(0.82 + 0.2 * (fine[m] - 0.5), [0.96, 0.74, 0.5])

    # the paving of the avenue
    m = ids == PAVING
    if m.any():
        fx = np.mod(x[m] / 3.0, 1)
        fz = np.mod(z[m] / 3.0, 1)
        joint = smooth(0, 0.03, fx) * smooth(1, 0.97, fx) * smooth(0, 0.03, fz) * smooth(1, 0.97, fz)
        alb[m] = np.outer((0.2 + 0.24 * grain[m]) * (0.4 + 0.6 * joint), [0.84, 0.72, 0.6])
        spec[m] = 0.3

    # the pyramid: limestone courses, worn; each block its own stone
    m = ids == PYRAMID
    if m.any():
        px, pz = x[m] - PYR[0], z[m] - PYR[2]
        c, s = math.cos(PYR_ROT), math.sin(PYR_ROT)
        rx, rz = px * c + pz * s, -px * s + pz * c
        along = np.where(np.abs(rx) > np.abs(rz), rz, rx)
        row = np.floor(y[m] / COURSE)
        block = np.floor(along / 2.1 + 0.5 * (row % 2))
        tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
        fy = y[m] / COURSE - row
        cc = (0.52 + 0.34 * tone + 0.7 * (grain[m] - 0.5)) * (0.4 + 0.6 * smooth(0.0, 0.2, fy))
        alb[m] = np.outer(cc, [0.92, 0.78, 0.58])
        cap = y[m] > PYR_H - 7
        a = alb[m]
        a[cap] = [1.0, 0.72, 0.3]
        alb[m] = a
        sp = spec[m]
        sp[cap] = 1.0
        spec[m] = sp

    m = ids == GOLD
    if m.any():
        alb[m] = [1.0, 0.7, 0.3]
        spec[m] = 1.0

    # the light
    moon = g['moon']
    half = moon - np.stack([g['dx'], g['dy'], g['dz']], 1)
    half /= np.linalg.norm(half, axis=1, keepdims=True) + 1e-6
    ndl = np.clip(nx * moon[0] + ny * moon[1] + nz * moon[2], 0, 1)
    ndh = np.clip(nx * half[:, 0] + ny * half[:, 1] + nz * half[:, 2], 0, 1)
    sky = 0.5 + 0.5 * ny
    ao, shadow = g['ao'], g['shadow']
    if infected:
        moon_c, sky_c, fire_c = np.array([1.0, 0.12, 0.07]), np.array([0.11, 0.012, 0.014]), np.array([1.0, 0.2, 0.05])
        moon_i, fire_i = 0.24, 0.95
    else:
        moon_c, sky_c, fire_c = np.array([0.62, 0.72, 1.0]), np.array([0.028, 0.032, 0.075]), np.array([1.0, 0.46, 0.14])
        moon_i, fire_i = 0.2, 1.0
    nn = np.sqrt(nx**2 + ny**2 + nz**2) + 1e-6
    nx, ny, nz = nx / nn, ny / nn, nz / nn
    ndl = np.clip(nx * moon[0] + ny * moon[1] + nz * moon[2], 0, 1)
    light = np.outer(ndl * shadow * moon_i, moon_c) + np.outer(sky * ao * 0.75, sky_c)
    view = np.stack([g['dx'], g['dy'], g['dz']], 1)
    fire_spec = np.zeros(n, np.float32)
    # the fires of the two braziers: warm pools that climb the colossi
    for sign in (-1, 1):
        fx, fy, fz = sign * BRAZIER_X - x, BRAZIER_H + 1.6 - y, BRAZIER_Z - z
        d2 = fx**2 + fy**2 + fz**2
        d = np.sqrt(d2)
        ndf = np.clip((nx * fx + ny * fy + nz * fz) / d, 0, 1)
        fall = 60.0 / (d2 + 30.0)
        light += np.outer(ndf * fall * fire_i * (0.45 + 0.55 * ao), fire_c)
        hx, hy, hz = fx / d - view[:, 0], fy / d - view[:, 1], fz / d - view[:, 2]
        hn = np.sqrt(hx**2 + hy**2 + hz**2) + 1e-6
        fire_spec += np.clip((nx * hx + ny * hy + nz * hz) / hn, 0, 1) ** 26 * fall
    rgb = alb * light
    rgb += np.outer(spec * ndh**40 * shadow * moon_i * 2.2, moon_c)
    rgb += np.outer(spec * fire_spec * fire_i * 1.1, fire_c)
    # a rim of sky on what turns away: it is what separates dark stone from the dark
    fres = np.clip(1 + nx * view[:, 0] + ny * view[:, 1] + nz * view[:, 2], 0, 1) ** 4
    rgb += np.outer(spec * fres * 0.5 * ao, sky_c * 4)
    if infected:
        rgb += np.outer(emit, [1.0, 0.2, 0.05]) * 0.5
    else:
        rgb += np.outer(emit * 0.035, [1.0, 0.62, 0.24])
    # the gold capstone holds the last of the light
    top = (ids == PYRAMID) & (y > PYR_H - 7)
    rgb[top] += np.array([1.0, 0.56, 0.2]) * (0.3 if not infected else 0.2)
    # the air between here and the pyramid
    haze_c = np.array([0.1, 0.01, 0.012]) if infected else np.array([0.018, 0.02, 0.05])
    haze = 1 - np.exp(-t / 620.0)
    rgb = rgb * (1 - haze[:, None]) + haze_c * haze[:, None]
    # filmic curve
    rgb = rgb * 1.0
    rgb = np.clip((rgb * (2.51 * rgb + 0.03)) / (rgb * (2.43 * rgb + 0.59) + 0.14), 0, 1) ** (1 / 2.2)
    out = np.zeros((g['h'], g['w'], 4), np.float32)
    flat = out.reshape(-1, 4)
    flat[g['idx'], :3] = rgb
    flat[g['idx'], 3] = 1
    return out


def project(px, py, pz):
    z = pz - CAM[2]
    return (W / 2 + FOCAL * (px - CAM[0]) / z) * 0.75, (HORIZON_Y - FOCAL * (py - CAM[1]) / z) * 0.75


def main():
    scale = float(sys.argv[1]) if len(sys.argv) > 1 else 0.25
    # supersampled when final
    ss = 1.5 if scale >= 1 else 1
    g = gbuffer(scale * ss)
    for infected, name in ((False, 'court_night'), (True, 'court_infected')):
        img = shade({k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in g.items()}, infected)
        im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
        im = im.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
        im.save(f'tools/out/{name}.png')
    print('apex', project(PYR[0], PYR_H, PYR[2]))
    for sign in (-1, 1):
        print('brazier', project(sign * BRAZIER_X, BRAZIER_H + 0.7, BRAZIER_Z))
        print('crown', project(sign * (ROW_X - 0.8), 13.4, FIRST_Z))
        print('foot', project(sign * (ROW_X - 0.8), 0, FIRST_Z))
    c, s = math.cos(PYR_ROT), math.sin(PYR_ROT)
    for rx, rz in ((-PYR_B, -PYR_B), (PYR_B, -PYR_B), (-PYR_B, PYR_B)):
        wx, wz = rx * c - rz * s + PYR[0], rx * s + rz * c + PYR[2]
        print('corner', project(wx, 0, wz))


if __name__ == '__main__':
    main()
