import { INK, makeCanvas, seeded } from './painters';

/**
 * Illustration toolkit for the premium symbols. Each "piece" is painted the way a cartoon
 * illustrator would: base colour → cel shadow crescent (the shape minus a copy of itself shifted
 * toward the light) → light crescent → soft ambient occlusion along the inner edge → material
 * texture → specular → thick ink outline. Everything is drawn at 512 px and downsampled.
 */
export const P = 512;

export type Paint = string | CanvasGradient | CanvasPattern;

export interface Piece {
  fill: Paint;
  /** cel shadow colour and offset of the light-side copy (larger = wider shadow) */
  shadow?: string;
  shadowOff?: [number, number];
  /** soft-edged shadow instead of a crisp cel band */
  shadowSoft?: number;
  light?: string;
  lightOff?: [number, number];
  /** inner-edge occlusion strength (0..1) */
  ao?: number;
  aoColor?: string;
  ink?: number;
  /** callback drawn clipped to the piece, after shading (texture, details) */
  detail?: (ctx: CanvasRenderingContext2D) => void;
}

export function layer(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  return makeCanvas(P, P);
}

/** Paints a shaded piece onto ctx. */
export function piece(ctx: CanvasRenderingContext2D, path: Path2D, o: Piece): void {
  const [t, tc] = layer();
  tc.fillStyle = o.fill;
  tc.fill(path);
  tc.save();
  tc.clip(path);
  if (o.shadow) {
    const [s, sc] = layer();
    sc.fillStyle = o.shadow;
    sc.fill(path);
    sc.globalCompositeOperation = 'destination-out';
    const [dx, dy] = o.shadowOff ?? [-16, -16];
    if (o.shadowSoft) sc.filter = `blur(${o.shadowSoft}px)`;
    sc.translate(dx, dy);
    sc.fill(path);
    tc.drawImage(s, 0, 0);
  }
  if (o.light) {
    const [s, sc] = layer();
    sc.fillStyle = o.light;
    sc.fill(path);
    sc.globalCompositeOperation = 'destination-out';
    const [dx, dy] = o.lightOff ?? [10, 12];
    sc.filter = 'blur(1.5px)';
    sc.translate(dx, dy);
    sc.fill(path);
    tc.drawImage(s, 0, 0);
  }
  if (o.ao) {
    tc.save();
    tc.filter = 'blur(10px)';
    tc.globalAlpha = o.ao;
    tc.strokeStyle = o.aoColor ?? '#14061a';
    tc.lineWidth = 26;
    tc.stroke(path);
    tc.restore();
  }
  o.detail?.(tc);
  tc.restore();
  if (o.ink !== 0) {
    tc.strokeStyle = INK;
    tc.lineWidth = o.ink ?? 12;
    tc.lineJoin = 'round';
    tc.lineCap = 'round';
    tc.stroke(path);
  }
  ctx.drawImage(t, 0, 0);
}

/** Plain ink line (for creases, seams, details). */
export function line(ctx: CanvasRenderingContext2D, path: Path2D, w = 6, color = INK): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  ctx.restore();
}

/** Glossy specular stroke: a soft wide pass and a crisp core. */
export function gloss(ctx: CanvasRenderingContext2D, path: Path2D, w = 10, alpha = 0.9): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`;
  ctx.lineWidth = w * 1.9;
  ctx.filter = 'blur(3px)';
  ctx.stroke(path);
  ctx.filter = 'none';
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = w;
  ctx.stroke(path);
  ctx.restore();
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#fff', alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function lin(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function rad(ctx: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Speckle / scratch texture for worn materials, drawn inside the current clip. */
export function grunge(ctx: CanvasRenderingContext2D, seed: number, o: { color: string; count: number; size: [number, number]; alpha: number; scratches?: number }): void {
  const rnd = seeded(seed);
  ctx.save();
  ctx.fillStyle = o.color;
  ctx.strokeStyle = o.color;
  for (let i = 0; i < o.count; i++) {
    ctx.globalAlpha = o.alpha * (0.4 + rnd() * 0.6);
    const r = o.size[0] + rnd() * (o.size[1] - o.size[0]);
    ctx.beginPath();
    ctx.ellipse(rnd() * P, rnd() * P, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < (o.scratches ?? 0); i++) {
    ctx.globalAlpha = o.alpha * (0.5 + rnd() * 0.5);
    ctx.lineWidth = 1.5 + rnd() * 2;
    const x = rnd() * P;
    const y = rnd() * P;
    const a = rnd() * Math.PI;
    const l = 14 + rnd() * 40;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4, y + Math.sin(a) * l * 0.5 - 4, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

/** Soft cast shadow under the symbol. */
export function groundShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alpha = 0.5): void {
  ctx.save();
  ctx.filter = 'blur(8px)';
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Blood / slime drip with glossy shading, ink outlined. */
export function drip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, c: [string, string, string] = ['#ff5a6a', '#d4102c', '#7a0418']): void {
  const p = new Path2D();
  p.moveTo(x - w / 2, y);
  p.bezierCurveTo(x - w / 2, y + len * 0.5, x - w * 0.42, y + len * 0.8, x - w * 0.62, y + len);
  p.arc(x, y + len, w * 0.62, Math.PI, 0, true);
  p.bezierCurveTo(x + w * 0.42, y + len * 0.8, x + w / 2, y + len * 0.5, x + w / 2, y);
  p.closePath();
  piece(ctx, p, {
    fill: lin(ctx, x - w, 0, x + w, 0, [[0, c[0]], [0.45, c[1]], [1, c[2]]]),
    shadow: c[2],
    shadowOff: [-w * 0.35, 0],
    ink: 8,
  });
  dot(ctx, x - w * 0.22, y + len - w * 0.1, w * 0.18, '#fff', 0.85);
}

/** Final downsample to the reel texture size. */
export function downsample(src: HTMLCanvasElement, size: number): HTMLCanvasElement {
  // two-step for quality
  const [mid, mctx] = makeCanvas(Math.round((src.width + size) / 2), Math.round((src.height + size) / 2));
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(src, 0, 0, mid.width, mid.height);
  const [c, ctx] = makeCanvas(size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mid, 0, 0, size, size);
  return c;
}

/** Path helper: build a Path2D from an SVG path string scaled from a 256 grid. */
export function svgPath(d: string, scale = P / 256): Path2D {
  const p = new Path2D();
  p.addPath(new Path2D(d), new DOMMatrix().scale(scale));
  return p;
}

/** Path helper from a callback. */
export function path(fn: (p: Path2D) => void): Path2D {
  const p = new Path2D();
  fn(p);
  return p;
}
