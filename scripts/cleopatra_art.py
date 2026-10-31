"""
Prepares the Cleopatra painting. Run from the repo root:  python scripts/cleopatra_art.py
Output: src/game/art/egypt/cleo_full.webp, the painting with her hair ends repainted.
The painting itself is never deformed in the game.
"""
import cv2
import numpy as np
from PIL import Image

SRC = 'src/game/art/egypt/cleopatra.webp'
OUT = 'src/game/art/egypt/'
rgba = np.asarray(Image.open(SRC).convert('RGBA')).copy()
H, W = rgba.shape[:2]


def repaint_hair():
    """
    The concept sheet's black background swallowed the ends of her black hair: the old matte left
    flat torn shapes and a straight cut. The torn ends are removed and real strands painted back,
    long tapered curves following the fall of the hair.
    """
    SS = 3
    # everything beyond this contour on the left and right of the hair goes
    keep = np.zeros((H, W), np.uint8)
    cv2.fillPoly(keep, [np.array(HAIR_CLEAN, np.int32)], 255)
    keep = cv2.GaussianBlur(keep, (0, 0), 3)
    zone = np.zeros((H, W), np.uint8)
    zone[110:420, 180:345] = 255
    zone[230:430, 590:640] = 255
    zone = cv2.GaussianBlur(zone, (0, 0), 14) / 255.0
    k = 1 - zone * (1 - keep / 255.0)
    rgba[..., 3] = (rgba[..., 3] * k).astype(np.uint8)
    layer = np.zeros((H * SS, W * SS, 4), np.uint8)
    rng = np.random.default_rng(11)

    def strand(p0, angle, length, width, bend):
        pts = []
        x, y = p0
        a = angle
        n = 18
        for i in range(n + 1):
            pts.append((x, y))
            x += np.cos(a) * length / n
            y += np.sin(a) * length / n
            a += bend / n
        v = rng.random()
        col = (10 + 14 * v, 6 + 7 * v, 7 + 6 * v, 255)
        if rng.random() < 0.1:
            col = (70, 38, 22, 255)  # a warm thread catching the torchlight
        for i in range(n):
            w = max(1, int(width * SS * (1 - i / n) ** 0.8))
            p, q = pts[i], pts[i + 1]
            cv2.line(layer, (int(p[0] * SS), int(p[1] * SS)), (int(q[0] * SS), int(q[1] * SS)), col, w, cv2.LINE_AA)

    for side, roots, ang, spread, bend in HAIR_STRANDS:
        for _ in range(side):
            t = rng.random()
            p = (roots[0][0] + (roots[1][0] - roots[0][0]) * t, roots[0][1] + (roots[1][1] - roots[0][1]) * t)
            strand(p, ang + rng.normal(0, spread) + t * 0.2, 46 + rng.random() ** 1.4 * 78, 1.2 + rng.random() * 2.4, bend + rng.normal(0, 0.18))
    small = cv2.resize(layer, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    a = small[..., 3:4]
    # under what remains of the painting: the strands grow out from behind it
    dst = rgba.astype(np.float32) / 255
    da = dst[..., 3:4]
    outa = da + a * (1 - da)
    rgb = (dst[..., :3] * da + small[..., :3] * a * (1 - da)) / np.maximum(outa, 1e-4)
    # the strands were drawn premultiplied by INTER_AREA against zero
    rgb = np.where(a * (1 - da) > 0.02, np.minimum(rgb, 1), rgb)
    rgba[..., :3] = (rgb * 255).astype(np.uint8)
    rgba[..., 3] = (outa[..., 0] * 255).astype(np.uint8)


# inner limit of the torn zone, clockwise: what is inside is kept as painted
HAIR_CLEAN = [(372, 80), (336, 140), (304, 205), (286, 250), (294, 280), (322, 286), (306, 332), (296, 420), (640, 440), (636, 350),
              (612, 330), (604, 250), (640, 150), (640, 20), (372, 20)]
# (how many, root line, direction, spread, curl)
HAIR_STRANDS = [
    (150, ((352, 130), (296, 262)), 2.05, 0.13, 0.28),
    (90, ((330, 240), (300, 285)), 1.95, 0.16, 0.2),
    (100, ((596, 255), (612, 340)), 1.25, 0.12, -0.22),
]
repaint_hair()

# the veil runs off the left of the painting: it dissolves in the air instead of ending on a cut
yy, xx = np.mgrid[:H, :W].astype(np.float32)
edge = 62 + 16 * np.sin(yy * 0.05) + 9 * np.sin(yy * 0.13 + 1)
fade = np.clip((xx - 4) / edge, 0, 1)
fade = fade * fade * (3 - 2 * fade)
band = np.clip((yy - 660) / 50, 0, 1) * np.clip((862 - yy) / 40, 0, 1)
rgba[..., 3] = (rgba[..., 3] * (1 - band * (1 - fade))).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(OUT + 'cleo_full.webp', 'WEBP', quality=94, alpha_quality=100, method=6)
