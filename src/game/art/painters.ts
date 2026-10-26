/** Procedural Canvas2D painters (cartoon style: flat fills, cel shadow, thick ink outlines). Drawn once, cached as textures. */

export const INK = '#170b14';

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d')!];
}

export function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ink(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#9aa6b0';
  ctx.fill();
  ink(ctx, 3);
  ctx.beginPath();
  ctx.arc(x + r * 0.25, y + r * 0.25, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#6d7983';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = '#e6edf2';
  ctx.fill();
}

export interface Material {
  /** face gradient, top → bottom */
  face: string[];
  /** extrusion colour (the letter's side) */
  depth: string;
  /** bright rim on the top-left edges */
  bevel: string;
  /** dark rim on the bottom-right edges */
  rim: string;
}

export const MATERIALS: Record<string, Material> = {
  blood: { face: ['#ffb3b8', '#ff4458', '#d4102c', '#7a0418'], depth: '#4a0412', bevel: '#ffe0e3', rim: '#5a0010' },
  steel: { face: ['#ffffff', '#bff4ff', '#3ec9ee', '#0f5f86'], depth: '#0b2f48', bevel: '#ffffff', rim: '#0a3a58' },
  toxic: { face: ['#fbeaff', '#d39bff', '#9a46f0', '#4a1488'], depth: '#24063f', bevel: '#ffffff', rim: '#2e0a56' },
  slime: { face: ['#f2ffe2', '#a8f27a', '#4cc236', '#1d6a18'], depth: '#0c3a0c', bevel: '#ffffff', rim: '#134a12' },
  rust: { face: ['#fff1c8', '#ffc25a', '#f07818', '#8a3606'], depth: '#3f1602', bevel: '#fff6dc', rim: '#5a2204' },
  bone: { face: ['#ffffff', '#fbf0d8', '#e6c896', '#9c7448'], depth: '#3a1a2a', bevel: '#ffffff', rim: '#6a4a2e' },
  gold: { face: ['#fffbe0', '#ffe066', '#f5a818', '#8a5206'], depth: '#4a2a04', bevel: '#ffffff', rim: '#6a3a04' },
};

/** Canvas holding `text` filled with `fill` at (cx+dx, cy+dy). */
function glyphLayer(w: number, h: number, text: string, font: string, fill: string | CanvasGradient, cx: number, cy: number, dx = 0, dy = 0): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(text, cx + dx, cy + dy);
  return c;
}

/** Inner rim: the text in `color`, minus a copy shifted by (dx, dy). */
function rimLayer(w: number, h: number, text: string, font: string, color: string, cx: number, cy: number, dx: number, dy: number): HTMLCanvasElement {
  const c = glyphLayer(w, h, text, font, color, cx, cy);
  const ctx = c.getContext('2d')!;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(glyphLayer(w, h, text, font, '#000', cx, cy, dx, dy), 0, 0);
  return c;
}

/** Grows a silhouette by stamping it around a circle (dilation), tinted `color`. */
function dilate(src: HTMLCanvasElement, radius: number, color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  const steps = Math.max(16, Math.round(radius * 3));
  for (let r = radius; r > 0; r -= Math.max(1, radius / 3)) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export interface Text3DOptions {
  size: number;
  material: Material;
  /** extrusion length in px (down-right) */
  depth?: number;
  ink?: number;
  font?: string;
  /** extra canvas margin */
  pad?: number;
  /** liquid coating poured over the top of the face (letters "dipped" in blood / slime) */
  coat?: { colors: [string, string, string]; height: number; seed: number };
}

/**
 * Big-slot style 3D lettering: inked silhouette, stepped extrusion, gradient face,
 * bright top-left bevel, dark bottom-right rim and a glossy highlight band.
 */
export function render3DText(text: string, o: Text3DOptions): HTMLCanvasElement {
  const family = o.font ?? '"Luckiest Guy", sans-serif';
  const font = `${o.size}px ${family}`;
  const depth = o.depth ?? Math.round(o.size * 0.07);
  const inkW = o.ink ?? Math.max(5, Math.round(o.size * 0.065));
  const [, mctx] = makeCanvas(10, 10);
  mctx.font = font;
  const tw = mctx.measureText(text).width;
  const pad = o.pad ?? inkW + depth + 12;
  const w = Math.ceil(tw + pad * 2 + depth);
  const h = Math.ceil(o.size * 1.25 + pad * 2 + depth);
  const cx = w / 2 - depth / 2;
  const cy = h / 2 - depth / 2 + o.size * 0.06;

  // full silhouette = face + extrusion
  const [sil, sctx] = makeCanvas(w, h);
  for (let i = 0; i <= depth; i++) sctx.drawImage(glyphLayer(w, h, text, font, '#000', cx, cy, i * 0.55, i), 0, 0);

  const [c, ctx] = makeCanvas(w, h);
  ctx.drawImage(dilate(sil, inkW, INK), 0, inkW * 0.5);
  ctx.drawImage(dilate(sil, inkW, INK), 0, 0);
  // extrusion: stepped, darker towards the back
  for (let i = depth; i >= 1; i--) {
    ctx.drawImage(glyphLayer(w, h, text, font, o.material.depth, cx, cy, i * 0.55, i), 0, 0);
  }
  ctx.globalAlpha = 0.35;
  ctx.drawImage(glyphLayer(w, h, text, font, '#000', cx, cy, depth * 0.55, depth), 0, 0);
  ctx.globalAlpha = 1;

  // face
  const g = ctx.createLinearGradient(0, cy - o.size * 0.45, 0, cy + o.size * 0.45);
  o.material.face.forEach((col, i) => g.addColorStop(i / (o.material.face.length - 1), col));
  const face = glyphLayer(w, h, text, font, g, cx, cy);
  const fctx = face.getContext('2d')!;
  fctx.globalCompositeOperation = 'source-atop';
  const bev = Math.max(2, o.size * 0.022);
  fctx.drawImage(rimLayer(w, h, text, font, o.material.bevel, cx, cy, bev, bev * 1.2), 0, 0);
  fctx.drawImage(rimLayer(w, h, text, font, o.material.rim, cx, cy, -bev * 1.4, -bev * 1.6), 0, 0);
  // glossy band across the upper half
  const gloss = fctx.createLinearGradient(0, cy - o.size * 0.5, 0, cy);
  gloss.addColorStop(0, 'rgba(255,255,255,0.75)');
  gloss.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  fctx.fillStyle = gloss;
  fctx.beginPath();
  fctx.ellipse(cx - tw * 0.05, cy - o.size * 0.3, tw * 0.62, o.size * 0.24, -0.06, 0, Math.PI * 2);
  fctx.fill();
  if (o.coat) {
    const rnd = seeded(o.coat.seed);
    const top = cy - o.size * 0.5;
    const base = top + o.coat.height;
    const coat = () => {
      fctx.beginPath();
      fctx.moveTo(0, 0);
      fctx.lineTo(w, 0);
      fctx.lineTo(w, base);
      let x = w;
      while (x > 0) {
        const step = 18 + rnd() * 26;
        const drip = rnd() < 0.3 ? o.size * (0.05 + rnd() * 0.12) : rnd() * 6;
        const dw = Math.min(step * 0.4, 6 + rnd() * 4);
        fctx.lineTo(x - step / 2 + dw, base);
        fctx.lineTo(x - step / 2 + dw, base + drip);
        fctx.arc(x - step / 2, base + drip, dw, 0, Math.PI);
        fctx.lineTo(x - step / 2 - dw, base);
        x -= step;
      }
      fctx.lineTo(0, base);
      fctx.closePath();
    };
    fctx.globalCompositeOperation = 'source-atop';
    coat();
    fctx.lineWidth = Math.max(3, o.size * 0.02);
    fctx.strokeStyle = INK;
    fctx.stroke();
    const cg = fctx.createLinearGradient(0, top, 0, base + o.size * 0.3);
    cg.addColorStop(0, o.coat.colors[0]);
    cg.addColorStop(0.35, o.coat.colors[1]);
    cg.addColorStop(1, o.coat.colors[2]);
    coat();
    fctx.fillStyle = cg;
    fctx.fill();
    fctx.fillStyle = 'rgba(255,255,255,0.7)';
    fctx.beginPath();
    fctx.ellipse(cx - tw * 0.18, top + o.coat.height * 0.45, tw * 0.16, o.coat.height * 0.14, -0.1, 0, Math.PI * 2);
    fctx.fill();
    ctx.drawImage(face, 0, 0);
  } else ctx.drawImage(face, 0, 0);
  // thin inner ink line between face and extrusion
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1.5, o.size * 0.012);
  ctx.strokeStyle = 'rgba(23,11,20,0.55)';
  ctx.strokeText(text, cx, cy);
  ctx.restore();
  return c;
}

/** Glossy liquid drip (blood, slime…) with ink outline and specular highlights. */
export function glossyDrip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, colors: [string, string, string]): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - w * 1.8, y);
    ctx.quadraticCurveTo(x - w, y + 3, x - w, y + len * 0.45);
    ctx.lineTo(x - w * 0.95, y + len);
    ctx.arc(x, y + len, w * 1.05, Math.PI, 0, true);
    ctx.lineTo(x + w, y + len * 0.45);
    ctx.quadraticCurveTo(x + w, y + 3, x + w * 1.8, y);
    ctx.closePath();
  };
  path();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.45, colors[1]);
  g.addColorStop(1, colors[2]);
  path();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.4, y + len - w * 0.1, w * 0.28, w * 0.42, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - w * 0.45, y + len * 0.35, w * 0.16, len * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Cartoon goo drip with ink outline. */
export function goo(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, color = '#e0213a', light = '#ff7d8c'): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - w * 1.6, y);
    ctx.quadraticCurveTo(x - w, y + 2, x - w, y + len * 0.4);
    ctx.lineTo(x - w * 0.9, y + len);
    ctx.arc(x, y + len, w, Math.PI, 0, true);
    ctx.lineTo(x + w, y + len * 0.4);
    ctx.quadraticCurveTo(x + w, y + 2, x + w * 1.6, y);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = color;
  ctx.fill();
  ink(ctx, 3.5);
  ctx.beginPath();
  ctx.arc(x - w * 0.35, y + len - w * 0.15, w * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = light;
  ctx.fill();
}

/** Cartoon tendril: ink casing, red core, yellow pustules. */
function tendril(ctx: CanvasRenderingContext2D, pts: number[], width: number, rnd: () => number): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i + 3 < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 7;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#b5122f';
  ctx.lineWidth = width;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#ff5a6a';
  ctx.lineWidth = width * 0.3;
  ctx.stroke();
  for (let i = 2; i + 3 < pts.length; i += 4) {
    if (rnd() < 0.7) {
      const r = 3 + rnd() * width * 0.35;
      const x = pts[i + 2] + (rnd() - 0.5) * width * 0.8;
      const y = pts[i + 3] + (rnd() - 0.5) * width * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ink(ctx, 3);
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff6c0';
      ctx.fill();
    }
  }
}

function hazard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  rrect(ctx, x, y, w, h, h / 2);
  ctx.clip();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = INK;
  for (let sx = x - h; sx < x + w + h; sx += h * 1.6) {
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + h * 0.8, y + h);
    ctx.lineTo(sx + h * 1.6, y);
    ctx.lineTo(sx + h * 0.8, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  rrect(ctx, x, y, w, h, h / 2);
  ink(ctx, 4);
}

export interface FrameSpec {
  boardW: number;
  boardH: number;
  pad: number;
  bleed: number;
  reelX: (r: number) => number;
  cellW: number;
  reels: number;
}

/** Chunky asylum-steel cabinet frame overgrown with infected tendrils. The reel window stays transparent. */
export function paintFrame(s: FrameSpec): HTMLCanvasElement {
  const W = s.boardW + s.pad * 2;
  const H = s.boardH + s.pad * 2;
  const [c, ctx] = makeCanvas(W + s.bleed * 2, H + s.bleed * 2);
  const rnd = seeded(77);
  ctx.translate(s.bleed, s.bleed);
  const inner = { x: s.pad - 6, y: s.pad - 6, w: s.boardW + 12, h: s.boardH + 12 };

  // drop shadow (the reel window is punched back out of it)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rrect(ctx, 10, 18, W, H, 30);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  rrect(ctx, inner.x, inner.y, inner.w, inner.h, 14);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  const ring = () => {
    rrect(ctx, 0, 0, W, H, 30);
    ctx.roundRect(inner.x, inner.y, inner.w, inner.h, 14);
  };
  // steel body
  ctx.save();
  ring();
  ctx.clip('evenodd');
  ctx.fillStyle = '#3a4a55';
  ctx.fillRect(0, 0, W, H);
  // cel shadow on the lower/right part of the ring
  ctx.fillStyle = '#26323b';
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.lineTo(0, H - s.pad * 0.45);
  ctx.lineTo(W - s.pad * 0.45, H - s.pad * 0.45);
  ctx.lineTo(W - s.pad * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  // highlight band
  ctx.fillStyle = '#5d7280';
  ctx.fillRect(14, 8, W - 28, 7);
  ctx.fillRect(8, 14, 7, H - 28);
  ctx.restore();
  rrect(ctx, 0, 0, W, H, 30);
  ink(ctx, 9);
  rrect(ctx, inner.x, inner.y, inner.w, inner.h, 14);
  ink(ctx, 8);
  // inner lip glowing red
  ctx.save();
  ctx.shadowColor = '#ff3347';
  ctx.shadowBlur = 18;
  rrect(ctx, inner.x + 6, inner.y + 6, inner.w - 12, inner.h - 12, 10);
  ctx.strokeStyle = '#ff3347';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // rivets along the ring
  for (let x = 70; x < W - 60; x += 64) {
    rivet(ctx, x, s.pad / 2, 6);
    rivet(ctx, x, H - s.pad / 2 - 6, 6);
  }
  for (let y = 80; y < H - 70; y += 72) {
    rivet(ctx, s.pad / 2, y, 6);
    rivet(ctx, W - s.pad / 2, y, 6);
  }

  // hazard stripe plates bottom left/right
  hazard(ctx, 60, H - 24, 150, 18);
  hazard(ctx, W - 210, H - 24, 150, 18);

  // reel separators: steel bars with ink
  for (let r = 1; r < s.reels; r++) {
    const x = s.pad + s.reelX(r) - 5;
    rrect(ctx, x - 5, s.pad - 2, 10, s.boardH + 4, 4);
    ctx.fillStyle = '#3a4a55';
    ctx.fill();
    ink(ctx, 4);
    ctx.fillStyle = '#5d7280';
    ctx.fillRect(x - 2, s.pad + 4, 2.5, s.boardH - 8);
    rivet(ctx, x, s.pad + 14, 4.5);
    rivet(ctx, x, s.pad + s.boardH - 14, 4.5);
  }

  // corner caps
  for (const [x, y] of [
    [26, 26],
    [W - 26, 26],
    [26, H - 26],
    [W - 26, H - 26],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#26323b';
    ctx.fill();
    ink(ctx, 6);
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#f2b642';
    ctx.fill();
    ink(ctx, 4);
    ctx.beginPath();
    ctx.arc(x + 3, y + 3, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#b07a1e';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y);
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 7);
    ink(ctx, 3.5);
  }

  // tendrils
  const T = (pts: number[], w: number) => tendril(ctx, pts, w, rnd);
  T([-14, 70, 20, 40, 60, 30, 110, 22, 170, 28, 220, 30, 260, 14], 12);
  T([-8, 110, 12, 160, 8, 210, 4, 250, 16, 300], 9);
  T([W + 14, H - 80, W - 30, H - 26, W - 90, H - 22, W - 150, H - 12, W - 230, H - 20], 12);
  T([W + 8, H - 120, W - 6, H - 180, W - 2, H - 240, W - 12, H - 290], 8);
  T([W + 6, 50, W - 40, 20, W - 100, 28, W - 150, 10], 8);
  T([-6, H - 50, 40, H - 14, 90, H - 22, 130, H - 6], 8);

  // bandage tape on the top-left corner
  ctx.save();
  ctx.translate(60, 4);
  ctx.rotate(-0.5);
  rrect(ctx, -40, -10, 80, 22, 4);
  ctx.fillStyle = '#efe3c6';
  ctx.fill();
  ink(ctx, 4);
  ctx.fillStyle = '#d8c8a2';
  for (let i = -30; i < 34; i += 10) ctx.fillRect(i, -6, 3, 3);
  ctx.restore();

  // goo dripping off the bottom edge
  for (let i = 0; i < 10; i++) {
    const x = 240 + rnd() * (W - 480);
    goo(ctx, x, H - 2, 10 + rnd() * 30, 3 + rnd() * 3);
  }
  return c;
}

/** One reel column: dark asylum tiles. */
export function paintReelPanel(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const rnd = seeded(seed);
  ctx.fillStyle = '#1e1726';
  ctx.fillRect(0, 0, w, h);
  const tile = 46;
  for (let y = 0; y < h; y += tile) {
    for (let x = (y / tile) % 2 ? -tile / 2 : 0; x < w; x += tile) {
      ctx.fillStyle = rnd() < 0.5 ? '#231b2c' : '#1f1828';
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  ctx.strokeStyle = '#150f1b';
  ctx.lineWidth = 2;
  for (let y = 0; y < h; y += tile) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // a couple of cracks
  ctx.strokeStyle = '#120c17';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    let x = rnd() * w;
    let y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * 40;
      y += 10 + rnd() * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const v = ctx.createLinearGradient(0, 0, w, 0);
  v.addColorStop(0, 'rgba(0,0,0,0.45)');
  v.addColorStop(0.18, 'rgba(0,0,0,0)');
  v.addColorStop(0.82, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Top/bottom inner shadow that gives the reel window depth. */
export function paintDepthShade(h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(4, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(10,4,12,0.9)');
  g.addColorStop(0.1, 'rgba(10,4,12,0.2)');
  g.addColorStop(0.16, 'rgba(10,4,12,0)');
  g.addColorStop(0.84, 'rgba(10,4,12,0)');
  g.addColorStop(0.9, 'rgba(10,4,12,0.2)');
  g.addColorStop(1, 'rgba(10,4,12,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  return c;
}

/** Thick cartoon win frame drawn around each winning cell. */
export function paintWinFrame(w: number, h: number): HTMLCanvasElement {
  const b = 14;
  const [c, ctx] = makeCanvas(w + b * 2, h + b * 2);
  ctx.translate(b, b);
  rrect(ctx, 4, 4, w - 8, h - 8, 22);
  ink(ctx, 12);
  rrect(ctx, 4, 4, w - 8, h - 8, 22);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 6;
  ctx.stroke();
  rrect(ctx, 8, 8, w - 16, h - 16, 18);
  ctx.strokeStyle = '#fff6c0';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const [x, y] of [
    [8, 8],
    [w - 8, 8],
    [8, h - 8],
    [w - 8, h - 8],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3347';
    ctx.fill();
    ink(ctx, 4);
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  return c;
}

/** One vertical hanging chain strip. */
export function paintChain(len: number): HTMLCanvasElement {
  const lw = 26;
  const lh = 38;
  const [c, ctx] = makeCanvas(lw + 12, len);
  for (let y = 0, i = 0; y < len; y += lh - 10, i++) {
    ctx.save();
    ctx.translate(lw / 2 + 6, y + lh / 2);
    if (i % 2) {
      rrect(ctx, -3, -lh / 2, 6, lh, 3);
      ctx.fillStyle = '#4b5a66';
      ctx.fill();
      ink(ctx, 3);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, lw / 2 - 3, lh / 2 - 2, 0, 0, Math.PI * 2);
      ink(ctx, 10);
      ctx.beginPath();
      ctx.ellipse(0, 0, lw / 2 - 3, lh / 2 - 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#5d6e7a';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
  }
  return c;
}

/** Colour-preserving blur by stacking offset copies (works without ctx.filter support). */
export function softGlow(src: HTMLCanvasElement, radius = 12): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.globalCompositeOperation = 'lighter';
  for (const [r, a] of [
    [radius, 0.08],
    [radius * 0.6, 0.11],
    [radius * 0.3, 0.15],
  ]) {
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      ctx.globalAlpha = a;
      ctx.drawImage(src, Math.cos(ang) * r, Math.sin(ang) * r);
    }
  }
  ctx.globalAlpha = 0.9;
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Particle: blood droplet with ink outline. */
export function paintDrop(color = '#e0213a', light = '#ff8a96'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 64);
  ctx.translate(24, 0);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(10, 24, 18, 32, 18, 42);
  ctx.arc(0, 42, 18, 0, Math.PI);
  ctx.bezierCurveTo(-18, 32, -10, 24, 0, 6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ink(ctx, 5);
  ctx.beginPath();
  ctx.ellipse(-7, 42, 4, 7, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = light;
  ctx.fill();
  return c;
}

/** Particle: comic 4-point star. */
export function paintStar(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.translate(32, 32);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 9 : 27;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff6c0';
  ctx.fill();
  ink(ctx, 4);
  return c;
}

/** Particle: cartoon smoke puff. */
export function paintPuff(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(96, 80);
  const blobs: [number, number, number][] = [
    [30, 46, 22],
    [52, 34, 26],
    [70, 48, 20],
    [48, 56, 20],
  ];
  ctx.beginPath();
  for (const [x, y, r] of blobs) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ink(ctx, 8);
  ctx.fillStyle = '#efe6f2';
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#c9bcd2';
  ctx.beginPath();
  ctx.arc(56, 56, 18, 0, Math.PI * 2);
  ctx.arc(72, 52, 14, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Diagonal light band swept across winning symbols. */
export function paintShine(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(160, 320);
  const g = ctx.createLinearGradient(0, 0, 160, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.15)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.58, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 160, 320);
  return c;
}

/** Soft rotating star-burst placed behind a winning symbol. */
export function paintSunburst(size = 256, rays = 14): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const r = size / 2;
  ctx.translate(r, r);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = a0 + (Math.PI / rays) * 0.55;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    ctx.closePath();
  }
  ctx.fill();
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
  core.addColorStop(0, 'rgba(255,255,255,0.8)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
