"""
Lifts the frame (scripts/frame_source.webp, on pure black) onto transparency: every large black
area is background, the small dark shapes enclosed in the gold stay opaque. Edge pixels take the
colour of the nearest solid paint. Run from the repo root: python scripts/cut_frame.py
"""
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ni

rgb = np.asarray(Image.open('scripts/frame_source.webp').convert('RGB'))
dark = rgb.max(axis=2) < 16
lab, n = ni.label(dark)
sizes = ni.sum(dark, lab, range(1, n + 1))
bg = np.isin(lab, 1 + np.where(sizes > 220)[0])
alpha = 1 - cv2.GaussianBlur(bg.astype(np.float32), (0, 0), 0.9)
alpha = np.clip((alpha - 0.25) / 0.6, 0, 1)
solid = alpha > 0.98
ind = ni.distance_transform_edt(~solid, return_distances=False, return_indices=True)
out = np.dstack([rgb[ind[0], ind[1]], (alpha * 255).astype(np.uint8)])
Image.fromarray(out, 'RGBA').save('src/game/art/egypt/frame.webp', 'WEBP', quality=95, alpha_quality=100, method=6)
