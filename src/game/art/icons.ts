import { INK, seeded } from './painters';
import { goldGrad, redCrack } from './egyptFrame';
import { layer, lin, path, piece, rad } from './paint';

/** Painted premium symbol: base layer, animated parts (same frame), and the emissive bits for the glow. */
export interface PaintedSymbol {
  base: HTMLCanvasElement;
  parts: Record<string, HTMLCanvasElement>;
  glow: HTMLCanvasElement;
}

/**
 * Clean "premium slot" icons: one strong silhouette, two or three colours, smooth volume,
 * one big glossy highlight, a coloured back-light on the bottom-right edge, a clean thick outline.
 * No grunge, no text, no tiny details — everything must read at 150 px.
 */

const OUT = 11;

interface Vol {
  /** light → mid → dark */
  c: [string, string, string];
  /** gradient direction: from (x0,y0) light to (x1,y1) dark */
  g: [number, number, number, number];
  rim?: string;
  rimW?: number;
  ink?: number;
  /** thin bright top-left edge strength */
  hi?: number;
  /** inner occlusion */
  ao?: number;
}

/** Smooth volumetric shape. */
function vol(ctx: CanvasRenderingContext2D, p: Path2D, o: Vol): void {
  const [x0, y0, x1, y1] = o.g;
  piece(ctx, p, {
    fill: lin(ctx, x0, y0, x1, y1, [[0, o.c[0]], [0.45, o.c[1]], [1, o.c[2]]]),
    // the "shadow" crescent here is the coloured back-light on the bottom-right edge
    shadow: o.rim,
    shadowOff: [-(o.rimW ?? 7), -(o.rimW ?? 7)],
    shadowSoft: o.rim ? 3 : 0,
    light: o.hi ? `rgba(255,255,255,${o.hi})` : undefined,
    lightOff: [4, 5],
    ao: o.ao ?? 0.3,
    aoColor: '#0a0210',
    ink: o.ink ?? OUT,
  });
}

/** Big soft specular streak. */
function spec(ctx: CanvasRenderingContext2D, p: Path2D, w: number, a = 0.85): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.filter = 'blur(2px)';
  ctx.strokeStyle = `rgba(255,255,255,${a})`;
  ctx.lineWidth = w;
  ctx.stroke(p);
  ctx.restore();
}

function glowBlob(ctx: CanvasRenderingContext2D, p: Path2D, color: string, blur: number, alpha = 1): void {
  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.fill(p);
  ctx.restore();
}

const circle = (x: number, y: number, r: number) => path((q) => q.arc(x, y, r, 0, Math.PI * 2));
const ellipse = (x: number, y: number, rx: number, ry: number, rot = 0) => path((q) => q.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2));

/* ================================================================== CODEX (wild) */

export function iconCodex(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  const [irisC, ictx] = layer();
  const [lidC, lctx] = layer();
  const T = (x: CanvasRenderingContext2D) => {
    x.translate(256, 256);
    x.rotate(-0.07);
    x.translate(-256, -256);
  };
  T(ctx);
  T(gctx);
  const EDGE = 5;

  // red infection halo behind the book
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(26px)';
  ctx.fillStyle = 'rgba(255,30,40,0.55)';
  ctx.beginPath();
  ctx.roundRect(110, 70, 300, 390, 30);
  ctx.fill();
  ctx.restore();

  const book = (dx: number, dy: number) => path((q) => q.roundRect(96 + dx, 52 + dy, 316, 408, [14, 26, 26, 14]));
  // back board and gilded page block
  vol(ctx, book(24, 18), { c: ['#5a0814', '#3a040c', '#160004'], g: [100, 60, 440, 480], ink: EDGE });
  ctx.save();
  ctx.fillStyle = goldGrad(ctx, 400, 70, 440, 470);
  ctx.beginPath();
  ctx.roundRect(112, 66, 310, 402, [12, 24, 24, 12]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,36,4,0.6)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    ctx.beginPath();
    ctx.moveTo(414 + k * 1.2, 80);
    ctx.lineTo(414 + k * 1.2, 460);
    ctx.stroke();
  }
  ctx.restore();

  // front cover: deep blood-red leather, cracked, with glowing veins in the cracks
  const cover = book(0, 0);
  vol(ctx, cover, { c: ['#c81a30', '#7a0618', '#2a0006'], g: [140, 60, 380, 470], rim: '#ff4a5a', rimW: 6, hi: 0.45, ao: 0.55, ink: EDGE });
  ctx.save();
  ctx.clip(cover);
  const rnd = seeded(17);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,170,170,0.06)';
    ctx.beginPath();
    ctx.ellipse(96 + rnd() * 316, 52 + rnd() * 408, 1 + rnd() * 4, 1 + rnd() * 2.5, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    redCrack(ctx, 256 + Math.cos(a) * 112, 256 + Math.sin(a) * 112, a, 70 + rnd() * 70, 3, 60 + i * 9);
  }
  ctx.restore();
  // gold tooled border
  ctx.save();
  ctx.strokeStyle = goldGrad(ctx, 130, 80, 400, 440);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(150, 78, 236, 356, 8);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(162, 90, 212, 332, 6);
  ctx.stroke();
  ctx.restore();

  // spine with gold bands
  vol(ctx, path((q) => q.roundRect(96, 52, 50, 408, [14, 0, 0, 14])), { c: ['#8a0c20', '#5a0414', '#240006'], g: [96, 0, 146, 0], ink: EDGE });
  for (const y of [110, 402]) {
    const band = path((q) => q.roundRect(88, y - 14, 66, 28, 8));
    ctx.fillStyle = goldGrad(ctx, 88, y - 14, 154, y + 14);
    ctx.fill(band);
    ctx.strokeStyle = 'rgba(40,18,2,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke(band);
  }
  // gold corners with a red gem
  for (const [x, y, sx, sy] of [[412, 52, -1, 1], [412, 460, -1, -1]] as const) {
    const corner = path((q) => {
      q.moveTo(x, y + sy * 14);
      q.quadraticCurveTo(x, y, x + sx * 14, y);
      q.lineTo(x + sx * 86, y);
      q.quadraticCurveTo(x + sx * 38, y + sy * 38, x, y + sy * 86);
      q.closePath();
    });
    ctx.fillStyle = goldGrad(ctx, x + sx * 86, y, x, y + sy * 86);
    ctx.fill(corner);
    ctx.strokeStyle = 'rgba(40,18,2,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke(corner);
    const gx = x + sx * 24;
    const gy = y + sy * 24;
    ctx.fillStyle = rad(ctx, gx - 3, gy - 3, 1, 9, [[0, '#ffd0c8'], [0.4, '#ff2a36'], [1, '#5a0008']]);
    ctx.beginPath();
    ctx.arc(gx, gy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // gold medallion holding the eye
  ctx.fillStyle = goldGrad(ctx, 160, 160, 352, 352);
  ctx.beginPath();
  ctx.arc(256, 256, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,2,0.95)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // engraved ticks round the medallion
  ctx.strokeStyle = 'rgba(70,36,4,0.7)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * 88, 256 + Math.sin(a) * 88);
    ctx.lineTo(256 + Math.cos(a) * 96, 256 + Math.sin(a) * 96);
    ctx.stroke();
  }
  vol(ctx, circle(256, 256, 82), { c: ['#3a0610', '#1a0206', '#080002'], g: [0, 174, 0, 338], ink: 4 });
  const almond = (k: number) =>
    path((q) => {
      q.moveTo(256 - 72 * k, 256);
      q.bezierCurveTo(256 - 34 * k, 256 - 56 * k, 256 + 34 * k, 256 - 56 * k, 256 + 72 * k, 256);
      q.bezierCurveTo(256 + 34 * k, 256 + 54 * k, 256 - 34 * k, 256 + 54 * k, 256 - 72 * k, 256);
      q.closePath();
    });
  vol(ctx, almond(1), { c: ['#fff6ee', '#f0d0c8', '#b87070'], g: [0, 212, 0, 300], ink: 4 });
  ctx.save();
  ctx.clip(almond(1));
  ctx.strokeStyle = 'rgba(220,30,50,0.75)';
  ctx.lineWidth = 1.5;
  for (const [x0, y0, x1, y1] of [[186, 256, 214, 248], [326, 256, 298, 262], [196, 240, 220, 244], [316, 270, 292, 266]]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 - 6, x1, y1);
    ctx.stroke();
  }
  ctx.restore();
  // cover sheen
  ctx.save();
  ctx.clip(cover);
  spec(ctx, path((q) => { q.moveTo(160, 66); q.lineTo(330, 62); }), 8, 0.45);
  ctx.restore();

  // iris part
  const iris = circle(256, 256, 42);
  glowBlob(ictx, iris, 'rgba(255,120,20,1)', 14, 0.7);
  vol(ictx, iris, { c: ['#fff0a0', '#ff7a14', '#b80a10'], g: [256, 214, 256, 300], ink: 4 });
  ictx.save();
  ictx.clip(iris);
  ictx.strokeStyle = 'rgba(120,0,10,0.4)';
  ictx.lineWidth = 1.3;
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    ictx.beginPath();
    ictx.moveTo(256 + Math.cos(a) * 12, 256 + Math.sin(a) * 12);
    ictx.lineTo(256 + Math.cos(a) * 40, 256 + Math.sin(a) * 40);
    ictx.stroke();
  }
  ictx.restore();
  vol(ictx, path((q) => { q.moveTo(256, 220); q.quadraticCurveTo(243, 256, 256, 292); q.quadraticCurveTo(269, 256, 256, 220); q.closePath(); }), {
    c: ['#3a0008', '#1a0004', '#0a0002'],
    g: [0, 220, 0, 292],
    ink: 0,
  });
  ictx.fillStyle = 'rgba(255,255,255,0.95)';
  ictx.fill(ellipse(273, 237, 11, 7, -0.5));

  // lid part
  vol(lctx, almond(1.05), { c: ['#c81a30', '#7a0618', '#3a0008'], g: [0, 196, 0, 316], ink: 4 });
  lctx.save();
  lctx.strokeStyle = '#1a0004';
  lctx.lineWidth = 5;
  lctx.lineCap = 'round';
  lctx.beginPath();
  lctx.moveTo(186, 258);
  lctx.quadraticCurveTo(256, 288, 326, 258);
  lctx.stroke();
  lctx.restore();

  // emissive
  gctx.fillStyle = '#ff7a14';
  gctx.fill(circle(256, 256, 42));
  gctx.strokeStyle = '#f2c25a';
  gctx.lineWidth = 6;
  gctx.stroke(circle(256, 256, 100));
  return { base: c, parts: { iris: irisC, lid: lidC }, glow: g };
}

/* ================================================================== L'INFECTÉ */

export function iconInfected(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  const [jawC, jctx] = layer();

  // horns for a strong silhouette
  for (const s of [-1, 1]) {
    const horn = path((q) => {
      q.moveTo(256 + s * 96, 112);
      q.bezierCurveTo(256 + s * 130, 72, 256 + s * 150, 40, 256 + s * 196, 26);
      q.bezierCurveTo(256 + s * 176, 64, 256 + s * 160, 104, 256 + s * 136, 146);
      q.closePath();
    });
    vol(ctx, horn, { c: ['#fffaf0', '#e8d8b8', '#9a8460'], g: [256 + s * 196, 26, 256 + s * 100, 140], ink: 9 });
  }
  // hood
  const hood = path((q) => {
    q.moveTo(256, 44);
    q.bezierCurveTo(372, 52, 446, 170, 448, 300);
    q.bezierCurveTo(450, 400, 420, 470, 400, 488);
    q.lineTo(112, 488);
    q.bezierCurveTo(92, 470, 62, 400, 64, 300);
    q.bezierCurveTo(66, 170, 140, 52, 256, 44);
    q.closePath();
  });
  vol(ctx, hood, { c: ['#8a58e0', '#40207a', '#120626'], g: [150, 60, 380, 480], rim: '#b88aff', rimW: 9, hi: 0.7, ao: 0.45 });
  // face opening
  const opening = path((q) => {
    q.moveTo(256, 112);
    q.bezierCurveTo(338, 116, 386, 200, 384, 294);
    q.bezierCurveTo(382, 380, 334, 440, 256, 446);
    q.bezierCurveTo(178, 440, 130, 380, 128, 294);
    q.bezierCurveTo(126, 200, 174, 116, 256, 112);
    q.closePath();
  });
  ctx.save();
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#c4143e';
  ctx.stroke(opening);
  ctx.restore();
  vol(ctx, opening, { c: ['#2a1438', '#120818', '#05020a'], g: [0, 112, 0, 446], ink: 9 });
  // the grin glows from inside and lights the darkness
  const mouth = path((q) => {
    q.moveTo(166, 318);
    q.quadraticCurveTo(256, 356, 346, 318);
    q.quadraticCurveTo(330, 412, 256, 418);
    q.quadraticCurveTo(182, 412, 166, 318);
    q.closePath();
  });
  glowBlob(ctx, mouth, 'rgba(255,90,30,1)', 26, 0.55);
  vol(ctx, mouth, { c: ['#ffb04a', '#ff3a1a', '#8a0418'], g: [0, 330, 0, 418], ink: 7 });
  // upper teeth
  const teeth = (cx: CanvasRenderingContext2D, ys: (x: number) => number, xs: number[], len: (i: number) => number, dir: 1 | -1) => {
    xs.forEach((x, i) => {
      const w = 10;
      const y = ys(x);
      const l = len(i);
      const t = path((q) => {
        q.moveTo(x - w, y);
        q.quadraticCurveTo(x - w * 0.4, y + dir * l * 0.7, x, y + dir * l);
        q.quadraticCurveTo(x + w * 0.4, y + dir * l * 0.7, x + w, y);
        q.closePath();
      });
      vol(cx, t, { c: ['#ffffff', '#fff2d8', '#d8bc8c'], g: [x - w, y, x + w, y + dir * l], ink: 4.5 });
    });
  };
  const upperY = (x: number) => 318 + Math.sin(((x - 166) / 180) * Math.PI) * 19;
  teeth(ctx, upperY, [184, 204, 224, 244, 268, 288, 308, 328], (i) => (i === 1 || i === 6 ? 46 : 28), 1);
  // eyes
  const eyes: Path2D[] = [];
  for (const s of [-1, 1]) {
    const e = path((q) => {
      q.moveTo(256 + s * 92, 226);
      q.quadraticCurveTo(256 + s * 50, 204, 256 + s * 18, 248);
      q.quadraticCurveTo(256 + s * 60, 262, 256 + s * 92, 226);
      q.closePath();
    });
    eyes.push(e);
    glowBlob(ctx, e, 'rgba(255,190,40,1)', 16, 0.9);
    vol(ctx, e, { c: ['#ffffff', '#fff07a', '#ffa21a'], g: [0, 210, 0, 262], ink: 0 });
  }
  spec(ctx, path((q) => { q.moveTo(126, 230); q.bezierCurveTo(130, 160, 170, 100, 230, 82); }), 10, 0.5);

  // jaw part: lower teeth
  teeth(jctx, (x) => 412 - Math.sin(((x - 166) / 180) * Math.PI) * 8, [196, 218, 240, 272, 294, 316], (i) => (i === 1 || i === 4 ? 34 : 22), -1);

  // emissive
  gctx.fillStyle = '#ffb21a';
  for (const e of eyes) gctx.fill(e);
  gctx.fillStyle = '#ff5a1a';
  gctx.fill(mouth);
  return { base: c, parts: { jaw: jawC }, glow: g };
}

/* ================================================================== MASQUE À GAZ */

export function iconMask(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  // strap stubs
  for (const s of [-1, 1]) {
    vol(ctx, path((q) => q.roundRect(s > 0 ? 400 : 28, 196, 84, 40, 14)), { c: ['#6a5a4a', '#3e3228', '#1e1814'], g: [0, 196, 0, 236], ink: 9 });
  }
  const face = path((q) => {
    q.moveTo(256, 54);
    q.bezierCurveTo(360, 54, 428, 130, 428, 230);
    q.bezierCurveTo(428, 330, 360, 420, 256, 436);
    q.bezierCurveTo(152, 420, 84, 330, 84, 230);
    q.bezierCurveTo(84, 130, 152, 54, 256, 54);
    q.closePath();
  });
  vol(ctx, face, { c: ['#4e8a64', '#1e4a32', '#081a10'], g: [150, 60, 380, 430], rim: '#6aff8a', rimW: 9, hi: 0.6, ao: 0.5 });
  const eyes: Path2D[] = [];
  for (const s of [-1, 1]) {
    const cx = 256 + s * 82;
    const cy = 208;
    vol(ctx, circle(cx, cy, 66), { c: ['#fff4b8', '#ffc23a', '#a8680a'], g: [cx - 60, cy - 60, cx + 60, cy + 60], rim: '#ffe8a0', rimW: 5 });
    vol(ctx, circle(cx, cy, 48), { c: ['#5a0a1e', '#2a0410', '#0a0206'], g: [0, cy - 48, 0, cy + 48], ink: 7 });
    const e = ellipse(cx - s * 2, cy + 6, 26, 15, s * 0.25);
    eyes.push(e);
    glowBlob(ctx, e, 'rgba(255,40,60,1)', 14, 1);
    vol(ctx, e, { c: ['#ffffff', '#ff8a96', '#ff1a3a'], g: [0, cy - 10, 0, cy + 22], ink: 0 });
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill(ellipse(cx - 18, cy - 24, 14, 7, -0.6));
  }
  // filter canister seen front-on
  vol(ctx, circle(256, 346, 78), { c: ['#ffffff', '#b8c4ce', '#4a5662'], g: [190, 280, 320, 420], rim: '#ffffff', rimW: 5 });
  vol(ctx, circle(256, 346, 56), { c: ['#3a4450', '#232a32', '#12161a'], g: [0, 290, 0, 400], ink: 7 });
  ctx.save();
  ctx.strokeStyle = 'rgba(160,180,190,0.5)';
  ctx.lineWidth = 5;
  for (const r of [18, 36]) ctx.stroke(circle(256, 346, r));
  ctx.restore();
  vol(ctx, circle(256, 346, 10), { c: ['#ffffff', '#b8c4ce', '#4a5662'], g: [246, 336, 266, 356], ink: 4 });
  spec(ctx, path((q) => { q.moveTo(118, 190); q.bezierCurveTo(124, 130, 170, 84, 228, 72); }), 12, 0.55);
  gctx.fillStyle = '#ff2a44';
  for (const e of eyes) gctx.fill(e);
  return { base: c, parts: {}, glow: g };
}

/* ================================================================== ANTIDOTE (vial) */

export function iconAntidote(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  for (const x of [ctx, gctx]) {
    x.translate(256, 256);
    x.rotate(-0.22);
    x.translate(-256, -256);
  }
  const glass = path((q) => {
    q.moveTo(222, 128);
    q.lineTo(290, 128);
    q.lineTo(290, 170);
    q.bezierCurveTo(360, 186, 382, 230, 382, 300);
    q.lineTo(382, 400);
    q.quadraticCurveTo(382, 462, 320, 462);
    q.lineTo(192, 462);
    q.quadraticCurveTo(130, 462, 130, 400);
    q.lineTo(130, 300);
    q.bezierCurveTo(130, 230, 152, 186, 222, 170);
    q.closePath();
  });
  glowBlob(ctx, glass, 'rgba(40,210,255,1)', 40, 0.7);
  // glass body (back)
  vol(ctx, glass, { c: ['rgba(230,250,255,0.55)', 'rgba(150,220,240,0.35)', 'rgba(60,120,150,0.55)'], g: [130, 0, 382, 0], ink: 0 });
  // liquid
  const liquid = path((q) => {
    q.moveTo(142, 262);
    q.bezierCurveTo(200, 240, 300, 284, 370, 254);
    q.lineTo(370, 400);
    q.quadraticCurveTo(370, 450, 320, 450);
    q.lineTo(192, 450);
    q.quadraticCurveTo(142, 450, 142, 400);
    q.closePath();
  });
  vol(ctx, liquid, { c: ['#c8ffff', '#38dcff', '#0a5aa0'], g: [0, 250, 0, 450], ink: 0 });
  ctx.save();
  ctx.clip(liquid);
  ctx.fillStyle = rad(ctx, 240, 360, 4, 120, [[0, 'rgba(230,255,255,0.75)'], [1, 'rgba(120,240,255,0)']]);
  ctx.fillRect(130, 240, 260, 230);
  for (const [x, y, r] of [[200, 400, 14], [300, 330, 9], [240, 300, 6]] as const) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.stroke(circle(x, y, r));
  }
  ctx.restore();
  // red cross badge
  vol(ctx, circle(256, 372, 42), { c: ['#ffffff', '#f2f6f8', '#c4ced6'], g: [0, 330, 0, 414], ink: 7 });
  vol(ctx, path((q) => { q.roundRect(244, 346, 24, 52, 5); q.roundRect(230, 360, 52, 24, 5); }), { c: ['#ff6a7a', '#e0213a', '#8a0418'], g: [0, 346, 0, 398], ink: 0 });
  // glass front: outline and big highlight
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUT;
  ctx.lineJoin = 'round';
  ctx.stroke(glass);
  ctx.restore();
  spec(ctx, path((q) => { q.moveTo(160, 300); q.bezierCurveTo(158, 250, 176, 210, 214, 196); }), 14, 0.85);
  spec(ctx, path((q) => { q.moveTo(162, 340); q.lineTo(162, 400); }), 10, 0.7);
  // cap
  vol(ctx, path((q) => q.roundRect(206, 70, 100, 66, 16)), { c: ['#ffffff', '#9ab8c8', '#3a5468'], g: [206, 0, 306, 0], rim: '#e0f6ff', rimW: 5 });
  vol(ctx, path((q) => q.roundRect(200, 118, 112, 22, 10)), { c: ['#5ae6ff', '#1aa8d8', '#0a5a80'], g: [0, 118, 0, 140], ink: 8 });
  gctx.fillStyle = '#38dcff';
  gctx.fill(liquid);
  return { base: c, parts: {}, glow: g };
}

/* ================================================================== POCHE DE SANG */

export function iconBlood(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  for (const x of [ctx, gctx]) {
    x.translate(256, 256);
    x.rotate(0.08);
    x.translate(-256, -256);
  }
  // tube curling out of the bottom
  const tube = path((q) => {
    q.moveTo(256, 430);
    q.bezierCurveTo(256, 486, 330, 494, 372, 470);
    q.bezierCurveTo(410, 448, 440, 456, 452, 486);
  });
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 30;
  ctx.stroke(tube);
  ctx.strokeStyle = '#c4143e';
  ctx.lineWidth = 18;
  ctx.stroke(tube);
  ctx.strokeStyle = 'rgba(255,190,200,0.85)';
  ctx.lineWidth = 5;
  ctx.translate(-4, -4);
  ctx.stroke(tube);
  ctx.restore();
  // hanger tab
  vol(ctx, path((q) => q.roundRect(206, 30, 100, 76, 22)), { c: ['#ffffff', '#e4ecf0', '#a8b8c4'], g: [0, 30, 0, 106], ink: 9 });
  vol(ctx, path((q) => q.roundRect(234, 48, 44, 22, 11)), { c: ['#3a2430', '#1e1018', '#0a0408'], g: [0, 48, 0, 70], ink: 6 });
  const bag = path((q) => q.roundRect(110, 90, 292, 350, [40, 40, 70, 70]));
  // plastic (top) and blood (bottom)
  vol(ctx, bag, { c: ['#ffffff', '#f0e6ec', '#c8b4c0'], g: [0, 90, 0, 240], ink: 0 });
  const blood = path((q) => {
    q.moveTo(100, 196);
    q.bezierCurveTo(180, 172, 250, 220, 330, 194);
    q.bezierCurveTo(370, 182, 400, 186, 412, 190);
    q.lineTo(412, 450);
    q.lineTo(100, 450);
    q.closePath();
  });
  ctx.save();
  ctx.clip(bag);
  vol(ctx, blood, { c: ['#ff5a6e', '#d4102c', '#5a0010'], g: [0, 190, 0, 440], rim: '#ff8a9a', rimW: 9, ink: 0 });
  ctx.strokeStyle = 'rgba(255,170,180,0.9)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(100, 196);
  ctx.bezierCurveTo(180, 172, 250, 220, 330, 194);
  ctx.bezierCurveTo(370, 182, 400, 186, 412, 190);
  ctx.stroke();
  ctx.restore();
  // a clean white drop emblem
  const drop = path((q) => {
    q.moveTo(256, 236);
    q.bezierCurveTo(232, 276, 210, 300, 210, 330);
    q.arc(256, 330, 46, Math.PI, 0, true);
    q.bezierCurveTo(302, 300, 280, 276, 256, 236);
    q.closePath();
  });
  vol(ctx, drop, { c: ['#ffffff', '#fff0f2', '#f0c4cc'], g: [0, 236, 0, 376], ink: 8 });
  vol(ctx, path((q) => { q.roundRect(248, 300, 16, 52, 4); q.roundRect(230, 318, 52, 16, 4); }), { c: ['#ff5a6e', '#e0213a', '#8a0418'], g: [0, 300, 0, 352], ink: 0 });
  // outline, top seal and big highlights
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUT;
  ctx.stroke(bag);
  ctx.restore();
  vol(ctx, path((q) => q.roundRect(122, 102, 268, 20, 10)), { c: ['#ffffff', '#e8eef2', '#b8c4cc'], g: [0, 102, 0, 122], ink: 0 });
  spec(ctx, path((q) => { q.moveTo(140, 160); q.lineTo(140, 380); }), 16, 0.8);
  spec(ctx, path((q) => { q.moveTo(372, 230); q.lineTo(372, 300); }), 8, 0.5);
  gctx.save();
  gctx.clip(bag);
  gctx.fillStyle = '#ff2a44';
  gctx.fill(blood);
  gctx.restore();
  return { base: c, parts: {}, glow: g };
}

export const ICONS: Record<string, () => PaintedSymbol> = {
  codex: iconCodex,
  zero: iconInfected,
  mask: iconMask,
  antidote: iconAntidote,
  blood: iconBlood,
};

