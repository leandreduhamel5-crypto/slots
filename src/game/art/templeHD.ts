import { makeCanvas, seeded } from './painters';

/**
 * "Book of Infection" painted backdrop (1920×1080), rendered once offline into egypt/temple.webp
 * (see lab.html?only=temple). Symmetric composition: the great pyramid and its red beam rise behind
 * the logo, two colossal Anubis guardians (the same art as the symbol) frame the reels, braziers
 * underlight them, and a polished black floor mirrors the scene.
 */
export const TW = 1920;
export const TH = 1080;
export const HORIZON = 690;
export const APEX: [number, number] = [960, 150];
export const BRAZIERS: [number, number][] = [
  [330, 668],
  [1590, 668],
];
/** The guardians' eyes (scene px), lit live by the game. */
export const GUARDIAN_EYES: [number, number][] = [
  [232, 252],
  [1668, 252],
];

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ noise */

function valueNoise(seed: number, cells: number): (x: number, y: number) => number {
  const rnd = seeded(seed);
  const g = new Float32Array((cells + 1) * (cells + 1)).map(() => rnd());
  const at = (i: number, j: number) => g[(j % cells) * (cells + 1) + (i % cells)];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * cells;
    const fy = y * cells;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = s(fx - i);
    const ty = s(fy - j);
    const a = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const b = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

function fbm(seed: number, base: number, octaves: number): (x: number, y: number) => number {
  const layers = Array.from({ length: octaves }, (_, k) => valueNoise(seed + k * 101, base << k));
  return (x, y) => {
    let v = 0;
    let amp = 0.5;
    let norm = 0;
    for (const n of layers) {
      v += n(x, y) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return v / norm;
  };
}

/** Greyscale grain/stone texture, usable with 'overlay' or 'multiply'. */
function noiseTexture(w: number, h: number, seed: number, base: number, contrast = 1.6): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const n = fbm(seed, base, 5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(1, (n(x / w, y / h) - 0.5) * contrast + 0.5));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ helpers */

function glow(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, alpha = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

function gold(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff2b8');
  g.addColorStop(0.2, '#f0bc4e');
  g.addColorStop(0.5, '#8a5410');
  g.addColorStop(0.7, '#e2aa40');
  g.addColorStop(1, '#4a2804');
  return g;
}

/** Branching glowing crack. */
function crack(ctx: Ctx, x: number, y: number, ang: number, len: number, w: number, seed: number, depth = 2, alpha = 1): void {
  const rnd = seeded(seed);
  const pts: [number, number][] = [[x, y]];
  let a = ang;
  for (let i = 0; i < 9; i++) {
    a += (rnd() - 0.5) * 0.8;
    x += Math.cos(a) * (len / 9);
    y += Math.sin(a) * (len / 9);
    pts.push([x, y]);
  }
  const pass = (wm: number, col: string, blur = 0) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (blur) {
      ctx.filter = `blur(${blur}px)`;
      ctx.globalCompositeOperation = 'lighter';
    }
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.lineWidth = Math.max(0.6, w * wm * (1 - i / pts.length));
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    ctx.restore();
  };
  pass(5, 'rgba(255,30,40,0.35)', w * 2.5);
  pass(1.6, '#1a0204');
  pass(1, '#ff2a36');
  pass(0.35, '#ffd0c0');
  if (depth > 0) {
    for (let k = 0; k < 2; k++) {
      const i = 3 + Math.floor(rnd() * 5);
      crack(ctx, pts[i][0], pts[i][1], a + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.45, w * 0.6, seed * 7 + k, depth - 1, alpha);
    }
  }
}

/** Clip a texture into a path with a blend mode. */
function texturize(ctx: Ctx, clip: Path2D, tex: HTMLCanvasElement, mode: GlobalCompositeOperation, alpha: number): void {
  ctx.save();
  ctx.clip(clip);
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.drawImage(tex, 0, 0, TW, TH);
  ctx.restore();
}

/* ------------------------------------------------------------------ layers */

function sky(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, '#040103');
  g.addColorStop(0.35, '#14030a');
  g.addColorStop(0.7, '#3e0610');
  g.addColorStop(1, '#7a1216');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TW, TH);

  // volumetric clouds, lit red from the beam
  const w = 480;
  const h = 200;
  const [c, cc] = makeCanvas(w, h);
  const img = cc.createImageData(w, h);
  const dens = fbm(11, 3, 6);
  const warp = fbm(29, 2, 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const wu = u + (warp(u, v) - 0.5) * 0.25;
      const d = dens(wu * 1.6, v * 0.9);
      const cloud = Math.max(0, Math.min(1, (d - 0.42) * 3.2));
      // light from the beam: stronger near the centre top, on the cloud underside
      const dx = (u - 0.5) * 2.2;
      const dy = v - 0.15;
      const lit = Math.exp(-(dx * dx + dy * dy) * 2.2);
      const under = Math.max(0, Math.min(1, (dens(wu * 1.6, v * 0.9 + 0.03) - d) * 18 + 0.4));
      const r = 30 + 200 * lit * under + 40 * v;
      const gg = 6 + 30 * lit * under;
      const b = 10 + 20 * lit * under;
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = cloud * 235 * (1 - v * 0.35);
    }
  }
  cc.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'blur(2px)';
  ctx.drawImage(c, 0, 0, TW, (h / w) * TW);
  ctx.restore();

  // red glow behind the apex and along the horizon
  glow(ctx, APEX[0], APEX[1] + 40, 700, 420, 'rgba(255,40,40,0.55)');
  glow(ctx, TW / 2, HORIZON, 1100, 160, 'rgba(255,60,40,0.4)');

  // embers / stars
  const rnd = seeded(5);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * TW;
    const y = rnd() * HORIZON * 0.8;
    const r = rnd() * 1.6 + 0.3;
    ctx.fillStyle = `rgba(255,${150 + rnd() * 90},${110 + rnd() * 60},${0.25 + rnd() * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // distant lightning in the clouds
  for (const [x, seed] of [[260, 3], [1680, 8]] as const) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    crack(ctx, x, 0, Math.PI / 2 + (seed % 2 ? 0.25 : -0.25), 260, 2.2, seed, 2);
    ctx.restore();
    glow(ctx, x, 80, 220, 140, 'rgba(255,90,80,0.25)');
  }
}

function distant(ctx: Ctx, stone: HTMLCanvasElement): void {
  // far dunes and small pyramids, lost in red haze
  const rnd = seeded(41);
  for (const [cx, apex, half] of [[160, 520, 170], [420, 560, 120], [1500, 548, 140], [1760, 510, 190]] as const) {
    const p = new Path2D();
    p.moveTo(cx - half, HORIZON);
    p.lineTo(cx, apex);
    p.lineTo(cx + half, HORIZON);
    p.closePath();
    const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, '#4a0e12');
    g.addColorStop(0.5, '#3a0a0e');
    g.addColorStop(0.5, '#24060a');
    g.addColorStop(1, '#1c0408');
    ctx.fillStyle = g;
    ctx.fill(p);
    texturize(ctx, p, stone, 'overlay', 0.35);
  }
  for (let layer = 0; layer < 2; layer++) {
    const p = new Path2D();
    p.moveTo(0, HORIZON);
    for (let x = 0; x <= TW; x += 40) p.lineTo(x, HORIZON - 30 + layer * 18 - Math.sin(x * 0.004 + layer) * 18 - rnd() * 8);
    p.lineTo(TW, HORIZON + 10);
    p.lineTo(0, HORIZON + 10);
    p.closePath();
    ctx.fillStyle = layer ? '#2a060a' : '#3e0a0e';
    ctx.fill(p);
  }
  // haze over the far layer
  const hz = ctx.createLinearGradient(0, HORIZON - 220, 0, HORIZON + 10);
  hz.addColorStop(0, 'rgba(150,20,24,0)');
  hz.addColorStop(1, 'rgba(150,20,24,0.45)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, HORIZON - 220, TW, 230);
}

function greatPyramid(ctx: Ctx, stone: HTMLCanvasElement): void {
  const [ax, ay] = APEX;
  const base = HORIZON + 16;
  const half = 980;
  const ridge = ax + 60; // ridge between the two faces, seen slightly from the left
  const left = new Path2D();
  left.moveTo(ax, ay);
  left.lineTo(ax - half, base);
  left.lineTo(ridge, base);
  left.closePath();
  const right = new Path2D();
  right.moveTo(ax, ay);
  right.lineTo(ridge, base);
  right.lineTo(ax + half, base);
  right.closePath();
  const whole = new Path2D();
  whole.moveTo(ax, ay);
  whole.lineTo(ax - half, base);
  whole.lineTo(ax + half, base);
  whole.closePath();

  let g = ctx.createLinearGradient(0, ay, 0, base);
  g.addColorStop(0, '#9a3a24');
  g.addColorStop(0.25, '#5a1a14');
  g.addColorStop(1, '#22070a');
  ctx.fillStyle = g;
  ctx.fill(left);
  g = ctx.createLinearGradient(0, ay, 0, base);
  g.addColorStop(0, '#4a1410');
  g.addColorStop(1, '#100306');
  ctx.fillStyle = g;
  ctx.fill(right);
  texturize(ctx, whole, stone, 'overlay', 0.7);

  // block courses
  ctx.save();
  ctx.clip(whole);
  const rows = 46;
  const rnd = seeded(13);
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    const y = ay + (base - ay) * t;
    const span = half * t;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(ax - span, y, span * 2, 1.4 + t * 1.6);
    ctx.fillStyle = 'rgba(255,170,130,0.07)';
    ctx.fillRect(ax - span, y + 2 + t, span * 2, 1);
    const bw = 22 + t * 60;
    for (let x = ax - span + (i % 2) * bw * 0.5; x < ax + span; x += bw * (0.8 + rnd() * 0.4)) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y - (base - ay) / rows, 1.2 + t, (base - ay) / rows);
      if (rnd() < 0.12) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.25})`;
        ctx.fillRect(x, y - (base - ay) / rows, bw, (base - ay) / rows);
      }
    }
  }
  // the beam's light washes the top of the pyramid
  const lg = ctx.createRadialGradient(ax, ay, 0, ax, ay, 520);
  lg.addColorStop(0, 'rgba(255,170,120,0.6)');
  lg.addColorStop(0.3, 'rgba(255,60,40,0.25)');
  lg.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, TW, TH);
  ctx.globalCompositeOperation = 'source-over';
  // infection cracks raining down from the capstone
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i - 2) * 0.32 + (rnd() - 0.5) * 0.2;
    crack(ctx, ax + (rnd() - 0.5) * 20, ay + 50, a, 260 + rnd() * 200, 5, 200 + i * 9, 1, 0.9);
  }
  ctx.restore();
  // ridge highlight and edge rim light
  ctx.save();
  ctx.strokeStyle = 'rgba(255,150,110,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ridge, base);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,60,40,0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ax - half, base);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + half, base);
  ctx.stroke();
  ctx.restore();
  // gold capstone, white hot
  const cap = new Path2D();
  cap.moveTo(ax, ay);
  cap.lineTo(ax - 46, ay + 48);
  cap.lineTo(ax + 50, ay + 48);
  cap.closePath();
  ctx.fillStyle = gold(ctx, ax - 46, ay, ax + 50, ay + 48);
  ctx.fill(cap);
  glow(ctx, ax, ay + 24, 160, 160, 'rgba(255,200,150,0.9)');
  glow(ctx, ax, ay + 24, 50, 50, 'rgba(255,255,240,1)');
}

function beam(ctx: Ctx): void {
  const [ax, ay] = APEX;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a, blur] of [[340, 0.3, 70], [150, 0.5, 30], [56, 0.85, 10], [14, 1, 2]] as const) {
    const g = ctx.createLinearGradient(0, 0, 0, ay);
    g.addColorStop(0, `rgba(255,40,40,${a * 0.35})`);
    g.addColorStop(0.5, `rgba(255,80,60,${a * 0.7})`);
    g.addColorStop(1, `rgba(255,140,110,${a})`);
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ax - w * 0.12, ay + 10);
    ctx.lineTo(ax - w, -10);
    ctx.lineTo(ax + w, -10);
    ctx.lineTo(ax + w * 0.12, ay + 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // sparks rising up the beam
  const rnd = seeded(77);
  for (let i = 0; i < 60; i++) {
    const y = rnd() * ay;
    const x = ax + (rnd() - 0.5) * (40 + (ay - y) * 0.5);
    glow(ctx, x, y, 6 + rnd() * 8, 6 + rnd() * 8, 'rgba(255,200,150,0.9)', 0.6 + rnd() * 0.4);
  }
}

function floor(ctx: Ctx, stone: HTMLCanvasElement): void {
  // mirror of everything above the horizon, darkened, rippled and blurred
  const [m, mc] = makeCanvas(TW, TH - HORIZON);
  const reflectH = TH - HORIZON;
  for (let y = 0; y < reflectH; y += 2) {
    const srcY = HORIZON - y * 1.05;
    if (srcY < 0) break;
    const off = Math.sin(y * 0.09) * (1 + y * 0.02);
    mc.drawImage(ctx.canvas, 0, srcY, TW, 2, off, y, TW, 2);
  }
  ctx.save();
  ctx.filter = 'blur(2px)';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(m, 0, HORIZON);
  ctx.restore();
  const g = ctx.createLinearGradient(0, HORIZON, 0, TH);
  g.addColorStop(0, 'rgba(20,4,6,0.2)');
  g.addColorStop(0.4, 'rgba(10,2,4,0.6)');
  g.addColorStop(1, 'rgba(4,1,2,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON, TW, TH - HORIZON);
  const fl = new Path2D();
  fl.rect(0, HORIZON, TW, TH - HORIZON);
  texturize(ctx, fl, stone, 'overlay', 0.35);
  // marble slabs in perspective, gold inlay lines
  ctx.save();
  ctx.clip(fl);
  for (let i = 1; i < 10; i++) {
    const y = HORIZON + Math.pow(i / 9, 2) * (TH - HORIZON);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, y, TW, 1 + i * 0.4);
  }
  for (let k = -14; k <= 14; k++) {
    ctx.strokeStyle = k % 4 === 0 ? 'rgba(220,160,60,0.25)' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = k % 4 === 0 ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(TW / 2 + k * 40, HORIZON);
    ctx.lineTo(TW / 2 + k * 260, TH);
    ctx.stroke();
  }
  // infection spreading across the floor
  const rnd = seeded(91);
  for (let i = 0; i < 6; i++) crack(ctx, 380 + rnd() * 1160, HORIZON + 6 + rnd() * 30, Math.PI / 2 + (rnd() - 0.5) * 1.6, 160 + rnd() * 200, 3.2, 500 + i * 7, 1, 0.6);
  ctx.restore();
  // horizon line light
  glow(ctx, TW / 2, HORIZON, 900, 40, 'rgba(255,90,60,0.5)');
}

/** Pedestal block for a guardian statue. */
function pedestal(ctx: Ctx, x: number, w: number, top: number, stone: HTMLCanvasElement, inner: 1 | -1): void {
  const body = new Path2D();
  body.rect(x, top + 40, w, TH - top);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  if (inner > 0) {
    g.addColorStop(0, '#0c0306');
    g.addColorStop(0.8, '#2a0c0c');
    g.addColorStop(1, '#4a1612');
  } else {
    g.addColorStop(0, '#4a1612');
    g.addColorStop(0.2, '#2a0c0c');
    g.addColorStop(1, '#0c0306');
  }
  ctx.fillStyle = g;
  ctx.fill(body);
  texturize(ctx, body, stone, 'overlay', 0.8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let y = top + 140; y < TH; y += 120) ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = gold(ctx, 0, top, 0, TH);
  ctx.fillRect(inner > 0 ? x + w - 10 : x, top + 44, 10, TH - top);
  // cornice: gold band + dark slab
  ctx.fillStyle = '#140508';
  ctx.fillRect(x - 24, top, w + 48, 44);
  ctx.fillStyle = gold(ctx, x, top, x + w, top + 44);
  ctx.fillRect(x - 24, top + 4, w + 48, 12);
  ctx.fillRect(x - 24, top + 34, w + 48, 6);
  ctx.fillStyle = '#1e5aa8';
  for (let k = 0; k < (w + 48) / 26; k++) if (k % 2) ctx.fillRect(x - 24 + k * 26, top + 18, 26, 14);
  ctx.fillStyle = '#0a1a3a';
  for (let k = 0; k < (w + 48) / 26; k++) if (!(k % 2)) ctx.fillRect(x - 24 + k * 26, top + 18, 26, 14);
  // engraved cartouche with glowing glyphs
  const cx = x + w / 2;
  const cy = top + 170;
  ctx.save();
  ctx.strokeStyle = gold(ctx, cx - 70, cy - 110, cx + 70, cy + 110);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(cx - 62, cy - 100, 124, 200, 62);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#ff2a2a';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#ff5a4a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  // eye
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy - 54);
  ctx.quadraticCurveTo(cx, cy - 80, cx + 34, cy - 54);
  ctx.quadraticCurveTo(cx, cy - 34, cx - 34, cy - 54);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - 55, 7, 0, Math.PI * 2);
  ctx.stroke();
  // ankh
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 11, 15, 0, 0, Math.PI * 2);
  ctx.moveTo(cx - 22, cy + 22);
  ctx.lineTo(cx + 22, cy + 22);
  ctx.moveTo(cx, cy + 19);
  ctx.lineTo(cx, cy + 64);
  ctx.stroke();
  ctx.restore();
  // edge rim lights: red on the inner side from the beam
  const ex = inner > 0 ? x + w - 3 : x + 3;
  const rl = ctx.createLinearGradient(0, top, 0, TH);
  rl.addColorStop(0, 'rgba(255,80,60,0.9)');
  rl.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.fillStyle = rl;
  ctx.fillRect(ex - 3, top + 44, 6, TH - top);
}

/** Colossal guardian bust from the symbol art, lit by the braziers and the beam. */
function guardian(ctx: Ctx, art: HTMLImageElement, x: number, bottom: number, size: number, mirror: boolean, brazier: [number, number]): void {
  const [c, cc] = makeCanvas(size, size);
  cc.imageSmoothingQuality = 'high';
  cc.drawImage(art, 0, 0, size, size);
  // stone weight: darken and desaturate a touch
  cc.globalCompositeOperation = 'source-atop';
  cc.fillStyle = 'rgba(12,2,4,0.28)';
  cc.fillRect(0, 0, size, size);
  // underlight from the brazier (warm) and top light from the beam (red)
  const light = (fill: CanvasGradient, a: number) => {
    const [l, lc] = makeCanvas(size, size);
    lc.fillStyle = fill;
    lc.fillRect(0, 0, size, size);
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(c, 0, 0);
    cc.save();
    cc.globalCompositeOperation = 'lighter';
    cc.globalAlpha = a;
    cc.drawImage(l, 0, 0);
    cc.restore();
  };
  const bx = mirror ? x - brazier[0] : brazier[0] - x;
  const by = brazier[1] - (bottom - size);
  const under = cc.createRadialGradient(bx, by, 0, bx, by, size * 0.9);
  under.addColorStop(0, 'rgba(255,150,60,0.9)');
  under.addColorStop(1, 'rgba(255,90,30,0)');
  light(under, 0.5);
  const top = cc.createLinearGradient(size, 0, 0, size * 0.6);
  top.addColorStop(0, 'rgba(255,60,50,0.45)');
  top.addColorStop(1, 'rgba(255,60,50,0)');
  light(top, 0.6);
  ctx.save();
  ctx.filter = 'blur(0.6px)';
  ctx.translate(x, bottom - size);
  if (mirror) {
    ctx.scale(-1, 1);
  }
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

function brazier(ctx: Ctx, x: number, y: number): void {
  // light pool on the floor and reflection streak
  glow(ctx, x, y + 280, 220, 50, 'rgba(255,130,50,0.55)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rs = ctx.createLinearGradient(0, HORIZON, 0, TH);
  rs.addColorStop(0, 'rgba(255,140,60,0.35)');
  rs.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = rs;
  ctx.filter = 'blur(10px)';
  ctx.fillRect(x - 18, y + 300, 36, TH - y - 300);
  ctx.restore();
  // tripod stand
  ctx.fillStyle = gold(ctx, x - 26, 0, x + 26, 0);
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 30);
  ctx.lineTo(x - 30, y + 290);
  ctx.lineTo(x + 30, y + 290);
  ctx.lineTo(x + 8, y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 30);
  ctx.lineTo(x + 8, y + 30);
  ctx.lineTo(x + 30, y + 290);
  ctx.lineTo(x + 10, y + 290);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,245,200,0.6)';
  ctx.fillRect(x - 6, y + 34, 2.5, 250);
  for (const yy of [y + 110, y + 200]) {
    ctx.fillStyle = gold(ctx, x - 22, yy, x + 22, yy + 10);
    ctx.fillRect(x - 20, yy, 40, 10);
  }
  // bowl
  ctx.fillStyle = gold(ctx, x - 70, y - 10, x + 70, y + 40);
  ctx.beginPath();
  ctx.moveTo(x - 70, y - 6);
  ctx.quadraticCurveTo(x, y + 70, x + 70, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(x - 68, y - 12, 136, 8);
  // fire (static base; the game adds flicker on top)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [col, k, blur] of [['rgba(255,50,20,0.8)', 1.1, 6], ['rgba(255,150,40,0.9)', 0.8, 3], ['rgba(255,240,190,0.95)', 0.45, 1]] as const) {
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 54 * k, y - 8);
    ctx.bezierCurveTo(x - 50 * k, y - 90 * k, x - 10, y - 110 * k, x + 6, y - 170 * k);
    ctx.bezierCurveTo(x + 14, y - 110 * k, x + 54 * k, y - 80 * k, x + 54 * k, y - 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, x, y - 40, 260, 260, 'rgba(255,120,40,0.55)');
}

function grade(ctx: Ctx, grain: HTMLCanvasElement): void {
  // low red mist across the floor line
  ctx.save();
  ctx.filter = 'blur(30px)';
  ctx.fillStyle = 'rgba(160,20,30,0.28)';
  ctx.fillRect(0, HORIZON - 30, TW, 120);
  ctx.restore();
  // vignette
  const v = ctx.createRadialGradient(TW / 2, TH * 0.45, TH * 0.35, TW / 2, TH / 2, TH * 1.05);
  v.addColorStop(0, 'rgba(4,1,2,0)');
  v.addColorStop(1, 'rgba(4,1,2,0.75)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, TW, TH);
  // film grain
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.12;
  ctx.drawImage(grain, 0, 0, TW, TH);
  ctx.restore();
}

export function paintTempleHD(anubis: HTMLImageElement, anubis2: HTMLImageElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TW, TH);
  const stone = noiseTexture(960, 540, 3, 24, 2.2);
  const grain = noiseTexture(960, 540, 9, 240, 3);
  sky(ctx);
  distant(ctx, stone);
  greatPyramid(ctx, stone);
  beam(ctx);
  floor(ctx, stone);
  // guardians on their pedestals, facing the reels
  const pedTop = 600;
  pedestal(ctx, -60, 440, pedTop, stone, 1);
  pedestal(ctx, TW - 380, 440, pedTop, stone, -1);
  guardian(ctx, anubis, -150, pedTop + 30, 660, false, BRAZIERS[0]);
  guardian(ctx, anubis2, TW + 150, pedTop + 30, 660, true, BRAZIERS[1]);
  for (const [x, y] of BRAZIERS) brazier(ctx, x, y);
  grade(ctx, grain);
  return c;
}
