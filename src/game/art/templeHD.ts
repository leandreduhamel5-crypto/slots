import { makeCanvas, seeded } from './painters';

/**
 * "Book of Infection" backdrop, painted procedurally (no bitmaps, so it stays sharp) and rendered
 * offline at RS× into two images: the night temple and its infected version for the free spins
 * (lab.html?only=temple). Logical space is 1920×1080; the game crossfades the two and adds live
 * lightning, fire and glows on top.
 */
export const TW = 1920;
export const TH = 1080;
export const RS = 4 / 3;
export const HORIZON = 760;
export const APEX: [number, number] = [960, 64];
export const MOON: [number, number, number] = [330, 230, 118];
export const BRAZIERS: [number, number][] = [
  [400, 700],
  [1520, 700],
];
export const OBELISKS = [150, 1770];

export type TempleState = 'night' | 'infected';
type Ctx = CanvasRenderingContext2D;

interface Palette {
  sky: string[];
  moon: [string, string];
  moonGlow: string;
  litFace: [string, string];
  darkFace: [string, string];
  edge: string;
  stone: [string, string];
  floorTint: string;
  haze: string;
  glyph: string;
  crack: number;
}

const PAL: Record<TempleState, Palette> = {
  night: {
    sky: ['#020309', '#070a1c', '#141433', '#33213a', '#6a3428'],
    moon: ['#fff6dc', '#d9c49a'],
    moonGlow: 'rgba(255,230,180,0.35)',
    litFace: ['#e0b878', '#6a4a2c'],
    darkFace: ['#3a2a24', '#120b0c'],
    edge: 'rgba(255,230,170,0.75)',
    stone: ['#3a2a26', '#100a0b'],
    floorTint: 'rgba(30,18,20,0.55)',
    haze: 'rgba(200,120,70,0.28)',
    glyph: '#f2c25a',
    crack: 0.25,
  },
  infected: {
    sky: ['#070103', '#1a0306', '#3e050c', '#7a0c14', '#c41c1c'],
    moon: ['#ff8a70', '#c41020'],
    moonGlow: 'rgba(255,40,40,0.55)',
    litFace: ['#a0301e', '#3a0a0a'],
    darkFace: ['#3a0a0c', '#100204'],
    edge: 'rgba(255,90,60,0.9)',
    stone: ['#3a0c0e', '#0e0204'],
    floorTint: 'rgba(40,4,8,0.5)',
    haze: 'rgba(255,40,40,0.4)',
    glyph: '#ff3a3a',
    crack: 1,
  },
};

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

function noiseTexture(w: number, h: number, seed: number, base: number, contrast: number): HTMLCanvasElement {
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

function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function goldFill(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  return lin(ctx, x0, y0, x1, y1, [[0, '#fff3c0'], [0.22, '#f0bc4e'], [0.5, '#8a5410'], [0.72, '#e6ae42'], [1, '#4a2804']]);
}

function crack(ctx: Ctx, x: number, y: number, ang: number, len: number, w: number, seed: number, depth: number, hot: number): void {
  const rnd = seeded(seed);
  const pts: [number, number][] = [[x, y]];
  let a = ang;
  for (let i = 0; i < 10; i++) {
    a += (rnd() - 0.5) * 0.7;
    x += Math.cos(a) * (len / 10);
    y += Math.sin(a) * (len / 10);
    pts.push([x, y]);
  }
  const pass = (wm: number, col: string, blur: number, add: boolean) => {
    ctx.save();
    if (blur) ctx.filter = `blur(${blur}px)`;
    if (add) ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.lineWidth = Math.max(0.5, w * wm * (1 - (i / pts.length) * 0.8));
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    ctx.restore();
  };
  pass(1.8, 'rgba(10,2,3,0.9)', 0, false);
  if (hot > 0.5) pass(5, `rgba(255,40,30,${0.4 * hot})`, w * 2.2, true);
  pass(1, hot > 0.5 ? '#ff3a24' : '#5a1810', 0, false);
  if (hot > 0.5) pass(0.4, '#ffe0b0', 0, false);
  if (depth > 0) {
    for (let k = 0; k < 2; k++) {
      const i = 3 + Math.floor(rnd() * 6);
      crack(ctx, pts[i][0], pts[i][1], a + (rnd() < 0.5 ? 0.8 : -0.8), len * 0.45, w * 0.6, seed * 7 + k, depth - 1, hot);
    }
  }
}

function bolt(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number, w: number): void {
  const rnd = seeded(seed);
  const pts: [number, number][] = [[x0, y0]];
  const n = 14;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t + (rnd() - 0.5) * 90 * (1 - Math.abs(t - 0.5)), y0 + (y1 - y0) * t]);
  }
  pts.push([x1, y1]);
  for (const [wm, col, blur] of [[8, 'rgba(255,70,70,0.45)', 16], [3, 'rgba(255,170,160,0.9)', 3], [1, '#ffffff', 0]] as const) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * wm;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ layers */

function sky(ctx: Ctx, p: Palette, state: TempleState): void {
  ctx.fillStyle = lin(ctx, 0, 0, 0, HORIZON, p.sky.map((c, i) => [i / (p.sky.length - 1), c] as [number, string]));
  ctx.fillRect(0, 0, TW, TH);
  const rnd = seeded(5);
  for (let i = 0; i < 380; i++) {
    const x = rnd() * TW;
    const y = rnd() * HORIZON * 0.75;
    const r = rnd() * rnd() * 2 + 0.4;
    const a = (state === 'night' ? 0.85 : 0.35) * (0.3 + rnd() * 0.7);
    ctx.fillStyle = state === 'night' ? `rgba(255,${235 + rnd() * 20},${210 + rnd() * 40},${a})` : `rgba(255,150,130,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // moon
  const [mx, my, mr] = MOON;
  glow(ctx, mx, my, mr * 4.5, mr * 4.5, p.moonGlow);
  const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
  mg.addColorStop(0, p.moon[0]);
  mg.addColorStop(1, p.moon[1]);
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.clip();
  const mrnd = seeded(8);
  for (let i = 0; i < 14; i++) {
    const cx = mx + (mrnd() - 0.5) * mr * 1.6;
    const cy = my + (mrnd() - 0.5) * mr * 1.6;
    const r = 6 + mrnd() * 24;
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = lin(ctx, mx - mr, my - mr, mx + mr, my + mr, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]);
  ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  ctx.restore();

  // clouds lit from below by the moon (or the infection)
  const w = 640;
  const h = 260;
  const [c, cc] = makeCanvas(w, h);
  const img = cc.createImageData(w, h);
  const dens = fbm(state === 'night' ? 11 : 13, 3, 6);
  const warp = fbm(29, 2, 3);
  const lit = state === 'night' ? [200, 170, 160] : [255, 70, 50];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const d = dens(u * 1.8 + (warp(u, v) - 0.5) * 0.3, v * 0.8);
      const cloud = Math.max(0, Math.min(1, (d - 0.47) * 3)) * (0.35 + v * 0.65);
      const under = Math.max(0, Math.min(1, (dens(u * 1.8, v * 0.8 + 0.025) - d) * 16 + 0.35));
      const i = (y * w + x) * 4;
      img.data[i] = 12 + lit[0] * under * 0.55;
      img.data[i + 1] = 8 + lit[1] * under * 0.45;
      img.data[i + 2] = 14 + lit[2] * under * 0.45;
      img.data[i + 3] = cloud * 220;
    }
  }
  cc.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'blur(3px)';
  ctx.drawImage(c, 0, 40, TW, (h / w) * TW);
  ctx.restore();
  glow(ctx, TW / 2, HORIZON, 1200, 220, p.haze);
  if (state === 'infected') bolt(ctx, 1700, 0, 1600, 210, 3, 0.8);
}

function dunes(ctx: Ctx, p: Palette): void {
  const rnd = seeded(41);
  for (const [cx, apex, half] of [[150, 600, 210], [1790, 590, 240], [1540, 650, 140]] as const) {
    const lf = new Path2D();
    lf.moveTo(cx - half, HORIZON);
    lf.lineTo(cx, apex);
    lf.lineTo(cx + half * 0.15, HORIZON);
    lf.closePath();
    const rf = new Path2D();
    rf.moveTo(cx, apex);
    rf.lineTo(cx + half, HORIZON);
    rf.lineTo(cx + half * 0.15, HORIZON);
    rf.closePath();
    ctx.fillStyle = lin(ctx, 0, apex, 0, HORIZON, [[0, p.litFace[1]], [1, p.darkFace[1]]]);
    ctx.fill(lf);
    ctx.fillStyle = p.darkFace[1];
    ctx.fill(rf);
  }
  for (let layer = 0; layer < 2; layer++) {
    const d = new Path2D();
    d.moveTo(0, HORIZON + 2);
    for (let x = 0; x <= TW; x += 30) d.lineTo(x, HORIZON - 22 + layer * 14 - Math.sin(x * 0.005 + layer * 2) * 16 - rnd() * 4);
    d.lineTo(TW, HORIZON + 4);
    d.closePath();
    ctx.fillStyle = layer ? p.stone[1] : p.darkFace[0];
    ctx.fill(d);
  }
  ctx.fillStyle = lin(ctx, 0, HORIZON - 160, 0, HORIZON + 6, [[0, 'rgba(0,0,0,0)'], [1, p.haze]]);
  ctx.fillRect(0, HORIZON - 160, TW, 166);
}

function pyramid(ctx: Ctx, p: Palette, state: TempleState, stone: HTMLCanvasElement): void {
  const [ax, ay] = APEX;
  const base = HORIZON + 6;
  const half = 960;
  const ridge = ax + 120;
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
  ctx.fillStyle = lin(ctx, ax - half * 0.5, ay, ax, base, [[0, p.litFace[0]], [1, p.litFace[1]]]);
  ctx.fill(left);
  ctx.fillStyle = lin(ctx, ax, ay, ax + half * 0.4, base, [[0, p.darkFace[0]], [1, p.darkFace[1]]]);
  ctx.fill(right);
  ctx.save();
  ctx.clip(whole);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.28;
  ctx.drawImage(stone, 0, 0, TW, TH);
  ctx.restore();

  ctx.save();
  ctx.clip(whole);
  const rows = 54;
  const rnd = seeded(13);
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    const y = ay + (base - ay) * t;
    const rowH = (base - ay) / rows;
    const span = half * t;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(ax - span, y, span * 2, 1 + t * 1.6);
    ctx.fillStyle = state === 'night' ? 'rgba(255,230,180,0.12)' : 'rgba(255,120,90,0.1)';
    ctx.fillRect(ax - span, y + 1.5 + t, span * 2, 1);
    const bw = 26 + t * 70;
    for (let x = ax - span + (i % 2) * bw * 0.5; x < ax + span; x += bw * (0.75 + rnd() * 0.5)) {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(x, y - rowH, 1 + t, rowH);
      const v = rnd();
      if (v < 0.16) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.18})`;
        ctx.fillRect(x, y - rowH, bw, rowH);
      } else if (v > 0.9) {
        ctx.fillStyle = state === 'night' ? 'rgba(255,220,160,0.08)' : 'rgba(255,90,60,0.08)';
        ctx.fillRect(x, y - rowH, bw, rowH);
      }
    }
  }
  if (state === 'night') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lin(ctx, 0, 0, ax, 0, [[0, 'rgba(255,230,180,0.18)'], [1, 'rgba(255,230,180,0)']]);
    ctx.fillRect(0, 0, TW, TH);
  }
  ctx.globalCompositeOperation = 'source-over';
  const crnd = seeded(77);
  const n = state === 'night' ? 4 : 11;
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (i / (n - 1) - 0.5) * 1.7 + (crnd() - 0.5) * 0.15;
    const len = state === 'night' ? 160 + crnd() * 140 : 340 + crnd() * 360;
    crack(ctx, ax + (crnd() - 0.5) * 20, ay + 60, a, len, state === 'night' ? 2.2 : 5, 200 + i * 9, state === 'night' ? 1 : 2, p.crack);
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax - half, base);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ridge, base);
  ctx.stroke();
  ctx.restore();
  const cap = new Path2D();
  cap.moveTo(ax, ay);
  cap.lineTo(ax - 58, ay + 38);
  cap.lineTo(ax + 64, ay + 38);
  cap.closePath();
  ctx.fillStyle = goldFill(ctx, ax - 58, ay, ax + 64, ay + 38);
  ctx.fill(cap);
  if (state === 'infected') {
    glow(ctx, ax, ay + 20, 260, 260, 'rgba(255,60,50,0.9)');
    glow(ctx, ax, ay + 20, 70, 70, 'rgba(255,240,220,1)');
  } else {
    glow(ctx, ax, ay + 20, 160, 160, 'rgba(255,220,150,0.45)');
  }
}

function beam(ctx: Ctx): void {
  const [ax, ay] = APEX;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a, blur] of [[300, 0.3, 60], [120, 0.5, 26], [44, 0.85, 8], [12, 1, 2]] as const) {
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = lin(ctx, 0, 0, 0, ay, [[0, `rgba(255,50,40,${a * 0.5})`], [1, `rgba(255,150,120,${a})`]]);
    ctx.beginPath();
    ctx.moveTo(ax - w * 0.15, ay + 12);
    ctx.lineTo(ax - w, -20);
    ctx.lineTo(ax + w, -20);
    ctx.lineTo(ax + w * 0.15, ay + 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function floor(ctx: Ctx, p: Palette, state: TempleState, stone: HTMLCanvasElement): void {
  const cv = ctx.canvas;
  const hz = Math.round(HORIZON * RS);
  const rh = cv.height - hz;
  const [m, mc] = makeCanvas(cv.width, rh);
  for (let y = 0; y < rh; y += 2) {
    const srcY = hz - y * 1.1;
    if (srcY < 0) break;
    const off = Math.sin(y * 0.07) * (1 + y * 0.02);
    mc.drawImage(cv, 0, srcY, cv.width, 2, off, y, cv.width, 2);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'blur(2px)';
  ctx.globalAlpha = 0.75;
  ctx.drawImage(m, 0, hz);
  ctx.restore();
  ctx.fillStyle = lin(ctx, 0, HORIZON, 0, TH, [[0, p.floorTint], [0.45, 'rgba(6,3,4,0.7)'], [1, 'rgba(3,1,2,0.95)']]);
  ctx.fillRect(0, HORIZON, TW, TH - HORIZON);
  const fl = new Path2D();
  fl.rect(0, HORIZON, TW, TH - HORIZON);
  ctx.save();
  ctx.clip(fl);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(stone, 0, 0, TW, TH);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  for (let i = 1; i < 9; i++) {
    const y = HORIZON + Math.pow(i / 8, 2) * (TH - HORIZON);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, y, TW, 1 + i * 0.4);
  }
  for (let k = -14; k <= 14; k++) {
    ctx.strokeStyle = k % 4 === 0 ? 'rgba(230,170,70,0.3)' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = k % 4 === 0 ? 2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(TW / 2 + (k + 0.5) * 44, HORIZON);
    ctx.lineTo(TW / 2 + (k + 0.5) * 280, TH);
    ctx.stroke();
  }
  if (state === 'infected') {
    const rnd = seeded(91);
    for (let i = 0; i < 7; i++) crack(ctx, 300 + rnd() * 1320, HORIZON + 8 + rnd() * 30, Math.PI / 2 + (rnd() - 0.5) * 1.8, 180 + rnd() * 220, 3.4, 500 + i * 7, 1, 1);
  }
  ctx.restore();
  glow(ctx, TW / 2, HORIZON, 1000, 34, state === 'night' ? 'rgba(255,190,120,0.35)' : 'rgba(255,70,50,0.55)');
}

function obelisk(ctx: Ctx, x: number, p: Palette, state: TempleState, stone: HTMLCanvasElement, flip: boolean): void {
  const base = TH + 20;
  const top = 150;
  const wB = 128;
  const wT = 86;
  const s = flip ? -1 : 1;
  const both = new Path2D();
  both.moveTo(x - wB / 2, base);
  both.lineTo(x - wT / 2, top);
  both.lineTo(x + wT / 2, top);
  both.lineTo(x + wB / 2, base);
  both.closePath();
  ctx.fillStyle = lin(ctx, 0, top, 0, base, [[0, p.stone[0]], [1, p.stone[1]]]);
  ctx.fill(both);
  ctx.save();
  ctx.clip(both);
  ctx.fillStyle = lin(ctx, x - wB / 2, 0, x + wB / 2, 0, [[0, 'rgba(255,220,170,0.16)'], [0.5, 'rgba(0,0,0,0)'], [0.52, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0.6)']]);
  ctx.fillRect(x - wB, top, wB * 2, base - top);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.6;
  ctx.drawImage(stone, 0, 0, TW, TH);
  ctx.restore();
  const rnd = seeded(x);
  ctx.save();
  if (state === 'infected') {
    ctx.shadowColor = '#ff2a2a';
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = p.glyph;
  ctx.strokeStyle = p.glyph;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.globalAlpha = state === 'night' ? 0.75 : 1;
  for (let y = top + 70; y < 900; y += 46) {
    const k = Math.floor(rnd() * 5);
    const gx = x - 4;
    if (k === 0) {
      ctx.beginPath();
      ctx.moveTo(gx - 14, y);
      ctx.quadraticCurveTo(gx, y - 12, gx + 14, y);
      ctx.quadraticCurveTo(gx, y + 9, gx - 14, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gx, y - 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (k === 1) {
      ctx.beginPath();
      ctx.ellipse(gx, y - 10, 6, 8, 0, 0, Math.PI * 2);
      ctx.moveTo(gx - 11, y);
      ctx.lineTo(gx + 11, y);
      ctx.moveTo(gx, y - 2);
      ctx.lineTo(gx, y + 18);
      ctx.stroke();
    } else if (k === 2) {
      ctx.fillRect(gx - 12, y - 6, 24, 5);
      ctx.fillRect(gx - 12, y + 4, 24, 5);
    } else if (k === 3) {
      ctx.beginPath();
      ctx.moveTo(gx - 12, y + 10);
      ctx.lineTo(gx, y - 12);
      ctx.lineTo(gx + 12, y + 10);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(gx, y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gx, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  const py = new Path2D();
  py.moveTo(x - wT / 2 - 4, top + 2);
  py.lineTo(x, top - 74);
  py.lineTo(x + wT / 2 + 4, top + 2);
  py.closePath();
  ctx.fillStyle = goldFill(ctx, x - wT / 2, top - 74, x + wT / 2, top);
  ctx.fill(py);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(x, top - 74);
  ctx.lineTo(x + wT / 2 + 4, top + 2);
  ctx.lineTo(x + s * 4, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = goldFill(ctx, x - wT / 2, top, x + wT / 2, top + 16);
  ctx.fillRect(x - wT / 2 - 6, top + 2, wT + 12, 14);
  glow(ctx, x, top - 40, state === 'night' ? 90 : 140, state === 'night' ? 90 : 140, state === 'night' ? 'rgba(255,210,120,0.35)' : 'rgba(255,40,40,0.7)');
  ctx.fillStyle = '#1e4fa0';
  ctx.fillRect(x - wB / 2 + 6, 930, wB - 12, 20);
  ctx.fillStyle = goldFill(ctx, x - wB / 2, 926, x + wB / 2, 954);
  ctx.fillRect(x - wB / 2 + 2, 924, wB - 4, 6);
  ctx.fillRect(x - wB / 2 + 2, 950, wB - 4, 6);
  // rim light along the edge that faces the pyramid
  ctx.strokeStyle = lin(ctx, 0, top, 0, base, [[0, state === 'night' ? 'rgba(255,190,120,0.6)' : 'rgba(255,60,50,0.8)'], [1, 'rgba(0,0,0,0)']]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + s * (wT / 2 - 1), top + 16);
  ctx.lineTo(x + s * (wB / 2 - 1), base);
  ctx.stroke();
}

function brazier(ctx: Ctx, x: number, y: number, state: TempleState): void {
  glow(ctx, x, y + 250, 260, 50, state === 'night' ? 'rgba(255,140,60,0.5)' : 'rgba(255,50,40,0.55)');
  ctx.fillStyle = goldFill(ctx, x - 26, 0, x + 26, 0);
  ctx.beginPath();
  ctx.moveTo(x - 9, y + 30);
  ctx.lineTo(x - 30, y + 330);
  ctx.lineTo(x + 30, y + 330);
  ctx.lineTo(x + 9, y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 30);
  ctx.lineTo(x + 9, y + 30);
  ctx.lineTo(x + 30, y + 330);
  ctx.lineTo(x + 10, y + 330);
  ctx.closePath();
  ctx.fill();
  for (const yy of [y + 120, y + 220]) {
    ctx.fillStyle = goldFill(ctx, x - 24, yy, x + 24, yy + 12);
    ctx.fillRect(x - 22, yy, 44, 12);
  }
  ctx.fillStyle = goldFill(ctx, x - 74, y - 10, x + 74, y + 44);
  ctx.beginPath();
  ctx.moveTo(x - 74, y - 6);
  ctx.quadraticCurveTo(x, y + 74, x + 74, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffb04a';
  ctx.fillRect(x - 72, y - 12, 144, 8);
  // the fire itself is live (Background.ts); paint only the embers glowing in the bowl
  glow(ctx, x, y - 6, 90, 26, state === 'night' ? 'rgba(255,170,60,0.9)' : 'rgba(255,60,40,0.9)');
  glow(ctx, x, y - 40, 220, 220, state === 'night' ? 'rgba(255,130,40,0.35)' : 'rgba(255,40,30,0.4)');
}

function grade(ctx: Ctx, grain: HTMLCanvasElement): void {
  const v = ctx.createRadialGradient(TW / 2, TH * 0.45, TH * 0.4, TW / 2, TH / 2, TH * 1.05);
  v.addColorStop(0, 'rgba(3,1,2,0)');
  v.addColorStop(1, 'rgba(3,1,2,0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, TW, TH);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.08;
  ctx.drawImage(grain, 0, 0, TW, TH);
  ctx.restore();
}

export function paintTemple(state: TempleState): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TW * RS, TH * RS);
  ctx.scale(RS, RS);
  const p = PAL[state];
  const stone = noiseTexture(1280, 720, 3, 40, 1.6);
  const grain = noiseTexture(1280, 720, 9, 320, 3);
  sky(ctx, p, state);
  dunes(ctx, p);
  pyramid(ctx, p, state, stone);
  if (state === 'infected') beam(ctx);
  floor(ctx, p, state, stone);
  OBELISKS.forEach((x, i) => obelisk(ctx, x, p, state, stone, i === 1));
  for (const [x, y] of BRAZIERS) brazier(ctx, x, y, state);
  grade(ctx, grain);
  return c;
}
