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
  /** antique Egyptian gold: deeper, more contrast */
  pharaoh: { face: ['#fff4c8', '#f2c25a', '#b0701c', '#5a3008'], depth: '#2a1404', bevel: '#fff8e0', rim: '#3a1c04' },
  /** fresh infected blood */
  infection: { face: ['#ff7a72', '#ee1c28', '#a80614', '#4a0008'], depth: '#260004', bevel: '#ffd0c8', rim: '#3a0006' },
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
  const family = o.font ?? 'Cinzel, "Luckiest Guy", serif';
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
  // gold four-point glint (replaces the comic star): soft halo + sharp cross
  const [c, ctx] = makeCanvas(64, 64);
  const halo = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  halo.addColorStop(0, 'rgba(255,230,160,0.9)');
  halo.addColorStop(0.35, 'rgba(255,170,60,0.35)');
  halo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, '#fff0b0');
  g.addColorStop(1, '#f2a020');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 2);
  ctx.quadraticCurveTo(35, 29, 62, 32);
  ctx.quadraticCurveTo(35, 35, 32, 62);
  ctx.quadraticCurveTo(29, 35, 2, 32);
  ctx.quadraticCurveTo(29, 29, 32, 2);
  ctx.closePath();
  ctx.fill();
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
