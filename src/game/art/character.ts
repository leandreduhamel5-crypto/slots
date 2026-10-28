import { makeCanvas, seeded } from './painters';
import { dot, rad } from './paint';

/**
 * Side character built from a painted bust (by default the Anubis of the concept sheet):
 * the art is mirrored so it faces the reels, and the layers the live rig needs are derived
 * from it — a soft silhouette for the energy aura, molten cracks clipped to the art for the
 * infected form, the glyph ring of its summoning circle and a glowing iris.
 */
export const CS = 512;
/** eyes in the mirrored art (main eye first), in art pixels */
export const CHAR_EYES: [number, number, number][] = [
  [214, 220, 1],
  [139, 218, 0.55],
];
/** where the head turns around (fake 3D) and the feet the rig stands on */
export const CHAR_HEAD: [number, number] = [210, 250];
export const CHAR_FEET: [number, number] = [256, 504];
export const RING_R = 236;

type Ctx = CanvasRenderingContext2D;
const PRES = 2;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const [c, ctx] = makeCanvas(w * PRES, h * PRES);
  ctx.scale(PRES, PRES);
  return [c, ctx];
}

const GOLD: [number, string][] = [
  [0, '#fff3c0'],
  [0.18, '#f4c44c'],
  [0.45, '#c08420'],
  [0.7, '#7a460a'],
  [1, '#3c1e04'],
];
const gold = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of GOLD) g.addColorStop(o, c);
  return g;
};

function crackLine(ctx: Ctx, rnd: () => number, x: number, y: number, ang: number, len: number, w: number, depth: number, out: [number, number][][]): void {
  const pts: [number, number][] = [[x, y]];
  let a = ang;
  for (let i = 0; i < 8; i++) {
    a += (rnd() - 0.5) * 0.8;
    x += Math.cos(a) * (len / 8);
    y += Math.sin(a) * (len / 8);
    pts.push([x, y]);
  }
  out.push(pts);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = Math.max(0.6, w * (1 - i / pts.length));
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.stroke();
  }
  if (depth > 0) {
    for (let k = 0; k < 2; k++) {
      const p = pts[2 + Math.floor(rnd() * 5)];
      crackLine(ctx, rnd, p[0], p[1], a + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.5, w * 0.6, depth - 1, out);
    }
  }
}

const GLYPHS = 'ankh eye scarab feather wave sun reed ankh eye feather sun wave reed scarab'.split(' ');

function glyph(ctx: Ctx, kind: string): void {
  ctx.beginPath();
  switch (kind) {
    case 'ankh':
      ctx.ellipse(0, -8, 5, 7, 0, 0, Math.PI * 2);
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.moveTo(0, -1);
      ctx.lineTo(0, 15);
      break;
    case 'eye':
      ctx.moveTo(-11, 0);
      ctx.quadraticCurveTo(0, -10, 11, 0);
      ctx.quadraticCurveTo(0, 7, -11, 0);
      ctx.moveTo(2, 0);
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.moveTo(-2, 5);
      ctx.lineTo(-5, 13);
      break;
    case 'scarab':
      ctx.ellipse(0, 2, 6, 9, 0, 0, Math.PI * 2);
      ctx.moveTo(-6, 0);
      ctx.lineTo(-12, -6);
      ctx.moveTo(6, 0);
      ctx.lineTo(12, -6);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, -12);
      break;
    case 'feather':
      ctx.moveTo(0, 14);
      ctx.quadraticCurveTo(-8, -2, 2, -14);
      ctx.quadraticCurveTo(6, 0, 0, 14);
      break;
    case 'wave':
      for (let i = 0; i < 2; i++) {
        ctx.moveTo(-11, -4 + i * 8);
        for (let k = 0; k < 4; k++) ctx.lineTo(-11 + k * 6 + 3, (k % 2 ? -7 : -1) + i * 8);
      }
      break;
    case 'sun':
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.moveTo(2, 0);
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      break;
    default:
      ctx.moveTo(0, 14);
      ctx.lineTo(0, -12);
      ctx.moveTo(0, -12);
      ctx.quadraticCurveTo(8, -6, 2, 2);
  }
  ctx.stroke();
}

function paintRing(): HTMLCanvasElement {
  const S = RING_R * 2 + 60;
  const [c, ctx] = canvas(S, S);
  const cx = S / 2;
  ctx.translate(cx, cx);
  const band = (r: number, w: number) => {
    ctx.strokeStyle = gold(ctx, -r, -r, r, r);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,16,2,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r - w / 2, 0, Math.PI * 2);
    ctx.arc(0, 0, r + w / 2, 0, Math.PI * 2);
    ctx.stroke();
  };
  band(RING_R - 22, 4);
  band(RING_R + 22, 4);
  // dark lapis band between the rails carrying the glyphs
  ctx.strokeStyle = 'rgba(14,24,70,0.55)';
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.arc(0, 0, RING_R, 0, Math.PI * 2);
  ctx.stroke();
  const n = GLYPHS.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -RING_R);
    ctx.strokeStyle = '#ffd77a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    glyph(ctx, GLYPHS[i]);
    ctx.restore();
    // separators
    ctx.save();
    ctx.rotate(a + Math.PI / n);
    dot(ctx, 0, -RING_R, 3, '#f6c95a');
    ctx.restore();
  }
  return c;
}

export interface CharacterArt {
  art: HTMLCanvasElement;
  silhouette: HTMLCanvasElement;
  cracks: HTMLCanvasElement;
  cracksGlow: HTMLCanvasElement;
  ring: HTMLCanvasElement;
  iris: HTMLCanvasElement;
}

function mirrored(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(CS, CS);
  ctx.translate(CS, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, w, h, 0, 0, CS, CS);
  return c;
}

/** White silhouette, blurred: tinted and distorted live it becomes the energy aura. */
function silhouette(art: HTMLCanvasElement, blur: number): HTMLCanvasElement {
  const pad = blur * 3;
  const [c, ctx] = makeCanvas(CS + pad * 2, CS + pad * 2);
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(art, pad, pad);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function paintCracks(art: HTMLCanvasElement): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, ctx] = makeCanvas(CS, CS);
  const [g, gctx] = makeCanvas(CS, CS);
  const rnd = seeded(47);
  const all: [number, number][][] = [];
  const [ex, ey] = CHAR_EYES[0];
  const seeds: [number, number, number, number][] = [
    [ex, ey, Math.PI * 0.75, 110],
    [ex, ey, -Math.PI * 0.6, 120],
    [ex, ey, Math.PI * 0.15, 90],
    [ex + 30, ey + 60, Math.PI * 0.5, 140],
    [300, 140, Math.PI * 0.6, 160],
    [180, 380, Math.PI * 0.4, 120],
    [330, 420, Math.PI * 0.6, 90],
    [120, 300, Math.PI * 0.5, 150],
  ];
  ctx.strokeStyle = '#1a0202';
  for (const [x, y, a, l] of seeds) crackLine(ctx, rnd, x, y, a, l, 4.5, 2, all);
  const strokeAll = (cx: Ctx, w: number, col: string) => {
    cx.strokeStyle = col;
    cx.lineCap = 'round';
    cx.lineJoin = 'round';
    for (const pts of all) {
      for (let i = 0; i < pts.length - 1; i++) {
        cx.lineWidth = Math.max(0.6, w * (1 - i / pts.length));
        cx.beginPath();
        cx.moveTo(pts[i][0], pts[i][1]);
        cx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        cx.stroke();
      }
    }
  };
  strokeAll(ctx, 2.4, '#ff3a24');
  strokeAll(ctx, 0.9, '#ffb894');
  gctx.filter = 'blur(6px)';
  strokeAll(gctx, 10, 'rgba(255,40,30,0.9)');
  gctx.filter = 'none';
  strokeAll(gctx, 3, 'rgba(255,90,60,1)');
  for (const x of [ctx, gctx]) {
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(art, 0, 0);
  }
  return [c, g];
}

function paintIris(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = rad(ctx, 32, 32, 0, 32, [
    [0, 'rgba(255,255,255,1)'],
    [0.22, 'rgba(255,250,220,1)'],
    [0.45, 'rgba(255,170,90,0.95)'],
    [0.75, 'rgba(255,80,40,0.35)'],
    [1, 'rgba(255,60,30,0)'],
  ]);
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

export function paintCharacter(img: HTMLImageElement | HTMLCanvasElement): CharacterArt {
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const art = mirrored(img, w, h);
  const [cracks, cracksGlow] = paintCracks(art);
  return { art, silhouette: silhouette(art, 14), cracks, cracksGlow, ring: paintRing(), iris: paintIris() };
}
