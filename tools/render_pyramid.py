"""
The Great Pyramid from the sands, ray marched with the machinery of tools/render_temple.py and seen
by the same camera, so that the game can relight it with the same code. Out of the sanctuary the
player stands on the causeway: two great sphinxes, two obelisks, and at the end the gate of the
pyramid. By night its door is open behind the leaves the game slides apart; in the bonus the
infection has split the stone from the capstone down.

  python tools/render_pyramid.py [scale]      scale 0.5 is a look, 1 the final picture

It writes tools/out/out_night.png and out_infected.png, then tools/paint_decor.py lays them over the
sky. It also writes pyramid_door.webp and the light maps into the art folder.
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, 'tools')
import render_temple as rt  # noqa: E402
from render_temple import box, sphinx, wrap_noise, glyph_sheet, row_coords  # noqa: F401,E402
from paint_decor import GLYPHS, glyph, smooth  # noqa: E402

PYR = np.array([0.0, 0.0, 150.0])
PYR_H = 88.2
PYR_B = 84.0
PYR_ROT = 0.68
COURSE = 1.5
# the gate of the pyramid: a pylon set into its base, square to the causeway
PORCH_Z = 37.0
PORCH_H = 10.0
DOOR_W = 2.0
DOOR_H = 6.8
OBELISK_X = 25.0
OBELISK_Z = 37.0
OBELISK_H = 22.0
SPHINX_X = 17.0
SPHINX_Z = 20.0
SPHINX_K = 1.45
ROAD = 15.0
MOON_DIR = np.array([-0.62, 0.6, -0.42], np.float32)
MOON_DIR /= np.linalg.norm(MOON_DIR)
DOOR_LIGHT = (0.0, 6.0, PORCH_Z - 6.0)

STONE, SAND, PAVING, PYRAMID, GOLD, OBELISK, NEMES, FACE, SPHINX, DOOR = 1, 3, 5, 6, 7, 8, 9, 10, 11, 12


def ground_h(x, z):
    """Dunes on both sides of the causeway, heaped against the foot of the pyramid."""
    a = np.abs(x)
    side = smooth(ROAD, ROAD + 12, a)
    swell = 1.5 + 1.1 * np.sin(x * 0.09 + z * 0.05) + 0.7 * np.sin(x * 0.04 - z * 0.11 + 1.3) + 0.25 * np.sin(x * 0.31 + z * 0.17)
    return side * swell - 0.25 * (1 - side) - 0.05


def scene_id(x, y, z):
    ids = np.full(x.shape, SAND, np.int8)
    d = (y - ground_h(x, z)) * 0.8

    def add(dist, material):
        nonlocal d, ids
        near = dist < d
        ids = np.where(near, material, ids)
        d = np.minimum(d, dist)

    a = np.abs(x)
    add(np.maximum(y, a - (ROAD + 6)), PAVING)
    px, pz = x - PYR[0], z - PYR[2]
    c, s = math.cos(PYR_ROT), math.sin(PYR_ROT)
    rx, rz = px * c + pz * s, -px * s + pz * c
    level = np.floor(np.clip(y, 0, PYR_H) / COURSE) * COURSE
    half = PYR_B * (1 - level / PYR_H)
    add(np.maximum(np.maximum(np.abs(rx), np.abs(rz)) - half, y - PYR_H) * 0.62, PYRAMID)
    # the porch: its towers lean back like those of the sanctuary, a gate of gold between them
    tower = box(a - (DOOR_W + 2.0), y - PORCH_H / 2, z - (PORCH_Z + 8), 2.0 - y * 0.05, PORCH_H / 2, 8.0) * 0.9
    add(tower, STONE)
    add(box(x, y - (PORCH_H - 1.4), z - (PORCH_Z + 8), DOOR_W + 0.4, 1.4, 8.0), STONE)
    add(box(a - DOOR_W - 0.2, y - DOOR_H / 2, z - (PORCH_Z - 0.1), 0.22, DOOR_H / 2, 0.22), GOLD)
    add(box(x, y - (DOOR_H + 0.26), z - (PORCH_Z - 0.1), DOOR_W + 0.42, 0.26, 0.22), GOLD)
    add(box(x, y - DOOR_H / 2, z - (PORCH_Z + 0.7), DOOR_W, DOOR_H / 2, 0.1), DOOR)
    # the obelisks
    fall = np.clip(y / OBELISK_H, 0, 1)
    ob = box(a - OBELISK_X, y - OBELISK_H / 2, z - OBELISK_Z, 1.75 - fall * 0.72, OBELISK_H / 2, 1.75 - fall * 0.72) * 0.9
    add(ob, OBELISK)
    tip = np.maximum(np.abs(a - OBELISK_X) + np.abs(z - OBELISK_Z) + (y - OBELISK_H) * 0.7 - 1.45, OBELISK_H - y) * 0.6
    add(tip, GOLD)
    add(box(a - OBELISK_X, y - 0.75, z - OBELISK_Z, 3.0, 0.75, 3.0), STONE)
    # the two great sphinxes, keeping the causeway
    sb, snemes, sface = sphinx(z - SPHINX_Z, y, a - SPHINX_X, SPHINX_K)
    add(sb, SPHINX)
    add(snemes, NEMES)
    add(sface, FACE)
    return d, ids


def cracks():
    """The stone split from the capstone down: forking lines on a sheet of the two faces."""
    S = 2048
    img = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(23)

    def run(x, y, ang, life, width):
        pts = [(x, y)]
        for _ in range(life):
            ang += rng.normal(0, 0.28)
            step = rng.uniform(16, 42)
            x += math.sin(ang) * step
            y += math.cos(ang) * step
            pts.append((x, y))
            if width > 1.6 and rng.random() < 0.09:
                run(x, y, ang + rng.choice([-1, 1]) * rng.uniform(0.5, 1.0), int(life * 0.45), width * 0.6)
        d.line(pts, fill=255, width=max(1, int(width)))

    for k in range(9):
        run(S / 2 + rng.uniform(-14, 14), 6, (k - 4) * 0.13 + rng.normal(0, 0.02), 70, 8)
    a = np.asarray(img, dtype=np.float32) / 255
    return a, ndi.gaussian_filter(a, 2.5), ndi.gaussian_filter(a, 11)


CRACKS = None


def shade(g, infected):
    global CRACKS
    x, y, z = g['x'], g['y'], g['z']
    nx, ny, nz = g['nx'].copy(), g['ny'].copy(), g['nz'].copy()
    ids, t = g['ids'], g['t']
    n = x.size
    alb = np.zeros((n, 3), np.float32)
    spec = np.zeros(n, np.float32)
    burn = np.zeros(n, np.float32)
    glow = np.zeros(n, np.float32)
    sheet = glyph_sheet()
    S = sheet.shape[0]

    def signs(a, b, size):
        return ndi.map_coordinates(sheet, [np.mod(b / size, 1) * (S - 1), np.mod(a / size, 1) * (S - 1)], order=1, mode='wrap')

    grain = wrap_noise(x * 9 + z * 9, y * 9, 512, 3, 60)
    blotch = wrap_noise(x * 2.5 + z * 2.5, y * 2.5, 512, 8, 90)
    fine = wrap_noise(x * 60 + z * 37, y * 60, 512, 4, 14)
    gold_c = np.array([0.95, 0.66, 0.26], np.float32)
    lapis = np.array([0.05, 0.14, 0.44], np.float32)
    stone_c = np.array([0.8, 0.68, 0.52], np.float32)

    m = ids == PYRAMID
    if m.any():
        px, pz = x[m] - PYR[0], z[m] - PYR[2]
        c_, s_ = math.cos(PYR_ROT), math.sin(PYR_ROT)
        rx, rz = px * c_ + pz * s_, -px * s_ + pz * c_
        left = np.abs(rx) > np.abs(rz)
        along = np.where(left, rz, rx)
        row = np.floor(y[m] / COURSE)
        block = np.floor(along / 2.6 + 0.5 * (row % 2))
        tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
        fy = y[m] / COURSE - row
        fx = along / 2.6 + 0.5 * (row % 2) - block
        joint = smooth(0.0, 0.14, fy) * smooth(0, 0.05, fx) * smooth(1, 0.95, fx)
        cc = (0.5 + 0.3 * tone + 0.6 * (grain[m] - 0.5)) * (0.42 + 0.58 * joint)
        a = np.outer(cc, [0.95, 0.74, 0.54])
        cap = y[m] > PYR_H - 9
        a[cap] = gold_c
        idxm = np.nonzero(m)[0]
        spec[idxm[cap]] = 1.0
        if infected:
            CRACKS = CRACKS or cracks()
            hair, line, halo = CRACKS
            span = np.maximum(1 - y[m] / PYR_H, 0.02)
            u = np.clip(along / (PYR_B * span), -1, 1) * span * 0.5 + 0.5
            v = np.clip((PYR_H - y[m]) / PYR_H, 0, 1)
            # each face has its own lines
            co = [v * 2047, np.mod(u + left * 0.31, 1) * 2047]
            h_ = ndi.map_coordinates(hair, co, order=1)
            l_ = ndi.map_coordinates(line, co, order=1)
            w_ = ndi.map_coordinates(halo, co, order=1)
            burn[idxm] = np.clip(h_ * 1.6 + l_ * 0.7, 0, 1.4)
            glow[idxm] = np.clip(w_ * 1.8, 0, 0.5)
            a[h_ > 0.3] = gold_c
        alb[m] = a

    m = ids == STONE
    if m.any():
        row = np.floor(y[m] / 1.1)
        along = x[m] + z[m]
        block = np.floor(along / 2.4 + 0.5 * (row % 2))
        tone = np.abs(np.modf(np.sin(row * 12.9898 + block * 78.233) * 43758.5453)[0])
        fy = y[m] / 1.1 - row
        cc = (0.5 + 0.22 * tone + 0.6 * (grain[m] - 0.5)) * (0.4 + 0.6 * smooth(0, 0.06, fy))
        a = np.outer(cc, stone_c)
        s_ = signs(x[m] + 40, y[m], 4.4)
        panel = (np.abs(x[m]) > DOOR_W + 0.8) & (np.abs(x[m]) < DOOR_W + 3.3) & (y[m] > 1.2) & (y[m] < PORCH_H - 1.2)
        a[panel] = lapis * 0.8
        inscribed = panel & (s_ > 0.42)
        a[inscribed] = gold_c
        idxm = np.nonzero(m)[0]
        spec[idxm[inscribed]] = 0.9
        alb[m] = a

    m = ids == GOLD
    if m.any():
        alb[m] = gold_c
        spec[m] = 1.0

    m = ids == OBELISK
    if m.any():
        along = np.where(np.abs(nx[m]) > np.abs(nz[m]), z[m], x[m])
        c = np.outer(0.5 + 0.5 * (grain[m] - 0.5) + 0.3 * (blotch[m] - 0.5), [0.7, 0.34, 0.26])
        s_ = signs(along * 1.6 + 3, y[m], 13.0)
        inscribed = (s_ > 0.42) & (np.abs(np.mod(along * 1.6 + 3, 13.0) / 13.0 * 8 % 1 - 0.5) < 0.5)
        c[inscribed] = gold_c
        alb[m] = c
        idxm = np.nonzero(m)[0]
        spec[idxm[inscribed]] = 0.9
        if infected:
            burn[idxm[inscribed]] = 0.8

    m = ids == SPHINX
    if m.any():
        rock = 0.62 + 0.55 * (grain[m] - 0.5) + 0.6 * (blotch[m] - 0.5) + 0.08 * np.sin(y[m] * 8 + 4 * (blotch[m] - 0.5))
        alb[m] = np.outer(rock, stone_c)

    m = ids == NEMES
    if m.any():
        rock = 0.66 + 0.5 * (grain[m] - 0.5) + 0.5 * (blotch[m] - 0.5)
        c = np.outer(rock, stone_c)
        worn = np.clip((blotch[m] - 0.42) * 3.2, 0, 1)[..., None] * 0.6
        stripe = np.mod(y[m] * 5.0, 2) < 1
        c[stripe] = c[stripe] * (1 - worn[stripe]) + lapis * worn[stripe]
        alb[m] = c

    m = ids == FACE
    if m.any():
        alb[m] = np.outer(0.68 + 0.44 * (grain[m] - 0.5) + 0.3 * (blotch[m] - 0.5), [0.84, 0.66, 0.48])

    m = ids == SAND
    if m.any():
        ripple = np.sin(z[m] * 2.6 + x[m] * 0.8 + 3 * np.sin(x[m] * 0.13))
        nz[m] += ripple * 0.1 * np.clip(1 - t[m] / 60, 0, 1)
        alb[m] = np.outer(0.6 + 0.2 * (fine[m] - 0.5), [0.94, 0.72, 0.48])

    # the causeway: the black polished stone of the sanctuary, with its threads of gold
    m = ids == PAVING
    if m.any():
        fx = np.mod(x[m] / 4.2, 1)
        fz = np.mod(z[m] / 4.2, 1)
        line = (np.minimum(fx, 1 - fx) < 0.012) | (np.minimum(fz, 1 - fz) < 0.012)
        c = np.outer(0.05 + 0.05 * grain[m] + 0.05 * (blotch[m] - 0.5), [0.95, 0.9, 0.92])
        c[line] = gold_c * 0.3
        alb[m] = c
        spec[m] = 0.5

    m = ids == DOOR
    if m.any():
        if infected:
            burn[m] = 0.3 + 0.7 * smooth(DOOR_H, 0, y[m])

    nn = np.sqrt(nx**2 + ny**2 + nz**2) + 1e-6
    nx, ny, nz = nx / nn, ny / nn, nz / nn
    g['final_n'] = np.stack([nx, ny, nz], 1)
    g['albedo'] = alb
    if infected and 'burn' not in g:
        g['burn'] = burn
    view = np.stack([g['dx'], g['dy'], g['dz']], 1)
    moon = MOON_DIR
    half_v = moon - view
    half_v /= np.linalg.norm(half_v, axis=1, keepdims=True) + 1e-6
    ndl = np.clip(nx * moon[0] + ny * moon[1] + nz * moon[2], 0, 1)
    ndh = np.clip(nx * half_v[:, 0] + ny * half_v[:, 1] + nz * half_v[:, 2], 0, 1)
    sky = 0.5 + 0.5 * ny
    ao, shadow = g['ao'], g['shadow']
    if infected:
        moon_c, sky_c = np.array([1.0, 0.13, 0.06]), np.array([0.34, 0.02, 0.02])
        moon_i = 1.5
    else:
        moon_c, sky_c = np.array([0.84, 0.86, 1.0]), np.array([0.07, 0.08, 0.17])
        moon_i = 1.5
    light = np.outer(ndl * shadow * moon_i, moon_c) + np.outer(sky * ao, sky_c)
    # the face away from the moon is not lost in the dark: the sky lights its blocks
    pyr = ids == PYRAMID
    light[pyr] += np.outer(np.clip(nx[pyr] * 0.5 + ny[pyr] * 0.3 - nz[pyr] * 0.8, 0, 1) * 0.36, moon_c * 0.5 + sky_c * 3)
    rgb = alb * light
    rgb += np.outer(spec * ndh**40 * shadow * moon_i * 1.8, moon_c)
    hot = np.array([1.0, 0.3, 0.08])
    rgb += np.outer(burn * 2.0, hot) + np.outer(glow, np.array([1.0, 0.1, 0.03]))
    haze_c = np.array([0.34, 0.02, 0.02]) if infected else np.array([0.03, 0.035, 0.08])
    haze = 1 - np.exp(-t / 330.0)
    return rgb * (1 - haze[:, None]) + haze_c * haze[:, None]


def save_layers(g):
    """For tools/finish_ai.py: what each pixel is, and how much of it burns."""
    w, h = g['w'], g['h']

    def plane(values, empty, kind):
        flat = np.full(w * h, empty, kind)
        flat[g['idx']] = values
        return flat.reshape(h, w)

    Image.fromarray(plane(g['ids'], 0, np.uint8) * 20).save('tools/out/pyramid_ids.png')
    Image.fromarray((np.clip(plane(g['burn'], 0, np.float32), 0, 1) * 255).astype(np.uint8)).save('tools/out/pyramid_burn.png')


def paint_leaf(path):
    """One leaf of the door of the pyramid: bronze studded with gold, a column of signs down it."""
    w, h = 256, 736
    img = Image.new('L', (w * 2, h * 2), 0)
    d = ImageDraw.Draw(img)
    for i in range(6):
        glyph(d, GLYPHS[(i * 5 + 2) % len(GLYPHS)], w, int((i + 0.75) * h * 2 / 6.6), 84)
    signs = ndi.gaussian_filter(np.asarray(img.resize((w, h), Image.LANCZOS), dtype=np.float64) / 255, 0.8)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    from paint_decor import fbm
    grain = fbm(h, w, 40, 5, 31)
    bronze = (0.3 + 0.34 * (grain - 0.5))[..., None] * np.array([0.92, 0.6, 0.32])
    rim = (np.minimum(np.minimum(xx, w - xx), np.minimum(yy, h - yy)) < 12)
    rgb = bronze.copy()
    gold = np.array([0.8, 0.56, 0.22])
    rgb[signs > 0.4] = gold
    rgb[rim] = gold * 0.86
    stud = (np.hypot(np.mod(xx, 46) - 23, np.mod(yy, 46) - 23) < 6) & ((xx < 62) | (xx > w - 62))
    rgb[stud] = gold
    shade_ = 0.5 + 0.5 * (1 - yy / h)
    rgb = rgb * shade_[..., None] * np.array([0.8, 0.84, 1.0])
    Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, 'WEBP', quality=84, method=6)


def main():
    only_maps = sys.argv[1:] == ['maps']
    scale = 0.5 if only_maps else float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
    # the machinery of the hall, with this scene, this moon and this light
    rt.scene_id = scene_id
    rt.scene = lambda x, y, z: scene_id(x, y, z)[0]
    rt.shade = shade
    rt.MOON_DIR = MOON_DIR
    rt.SLOT_LIGHT = DOOR_LIGHT
    rt.ROOF_Y = 1e6
    rt.COL_TOP = 1e6
    rt.TMAX = 600.0
    ss = 1.5 if scale >= 1 else 1
    g = rt.gbuffer(scale * ss)
    if only_maps:
        shade(g, True)
        rt.light_maps(g, 'pyramid')
        save_layers(g)
        return
    for infected, name in ((False, 'out_night'), (True, 'out_infected')):
        img = rt.compose(g, infected)
        im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
        im = im.resize((int(rt.W * scale), int(rt.H * scale)), Image.LANCZOS)
        im.save(f'tools/out/{name}.png')
    rt.light_maps(g, 'pyramid')
    paint_leaf('src/game/art/egypt/pyramid_door.webp')
    print('apex', rt.project(PYR[0], PYR_H, PYR[2]))
    print('door top-left', rt.project(-DOOR_W, DOOR_H, PORCH_Z - 0.1))
    print('door bottom-right', rt.project(DOOR_W, 0, PORCH_Z - 0.1))


if __name__ == '__main__':
    main()
