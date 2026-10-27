import { INK, makeCanvas, seeded } from './painters';
import { dot, gloss, grunge, groundShadow, lin, line, piece, rad } from './paint';
import { iconCodex as paintCodex } from './icons';

/**
 * "Le Gardien du Codex": a floating hooded wraith, the game's mascot.
 * Design space 400×600 (feet/hover point at 200, 584), painted at RES× for crisp scaling.
 * Two forms: calm (the keeper) and rage (unleashed during free spins).
 * Parts are separate so the rig can animate them: the cloak is deformed as a mesh, the face
 * (eyes, grin, jaw) lives in the hood opening, the hands bob on their own, the orb pulses.
 */
export const SW = 400;
export const SH = 600;
export const SRES = 2;

export interface SpectreParts {
  cloak: HTMLCanvasElement;
  face: HTMLCanvasElement;
  jaw: HTMLCanvasElement;
  /** painted eyes (blink by squashing this layer) and their flat additive glow */
  eyeArt: HTMLCanvasElement;
  eyes: HTMLCanvasElement;
  handL: HTMLCanvasElement;
  handR: HTMLCanvasElement;
  orb: HTMLCanvasElement;
  horns: HTMLCanvasElement;
}

const P2 = (d: string) => new Path2D(d);

function sheet(w = SW, h = SH): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, ctx] = makeCanvas(w * SRES, h * SRES);
  ctx.scale(SRES, SRES);
  return [c, ctx];
}

export const EYE_Y = 168;
export const ORB = { x: 348, y: 282 };
export const SHOULDER_L = { x: 104, y: 212 };
export const SHOULDER_R = { x: 296, y: 212 };

const CLOAK =
  'M192 6 C230 14 264 44 276 84 C290 120 292 160 300 190 C334 206 352 240 360 290 C368 360 372 440 384 520 ' +
  'L372 562 L356 530 L344 586 L320 540 L300 592 L278 546 L256 596 L232 548 L210 590 L186 544 L162 594 L140 548 L118 588 L96 538 L74 582 L56 530 L30 570 ' +
  'C30 470 34 380 42 300 C50 240 70 208 104 192 C110 160 112 120 126 86 C140 46 160 16 192 6 Z';
const OPENING = 'M200 82 C150 84 132 132 136 182 C140 232 168 262 200 266 C232 262 260 232 264 182 C268 132 250 84 200 82 Z';
const SLIT = 'M195 268 L205 268 L224 586 L176 586 Z';
const FOLDS = [
  'M118 232 C110 320 98 420 88 540',
  'M164 284 C160 360 152 450 150 560',
  'M240 288 C244 370 250 460 254 560',
  'M288 236 C298 330 314 430 328 540',
];
const HOOD_FOLDS = ['M138 104 C150 80 172 64 198 58', 'M264 112 C258 90 246 72 222 62', 'M120 150 C118 130 120 112 128 96'];
const HEM_VEINS = ['M88 566 C98 528 92 498 108 462', 'M250 580 C246 538 258 506 250 470', 'M334 566 C324 528 338 502 328 468', 'M168 586 C172 556 164 530 172 502'];
const RAGE_CRACKS = [
  'M120 300 L132 330 L122 360 L136 392',
  'M282 300 L270 334 L284 362 L272 400',
  'M96 430 L110 456 L100 486',
  'M306 440 L294 470 L308 498',
  'M150 70 L162 96 L154 118',
];

function veinStroke(ctx: CanvasRenderingContext2D, d: string, hot: boolean, w = 5): void {
  const p = P2(d);
  ctx.save();
  ctx.filter = `blur(${hot ? 5 : 3}px)`;
  line(ctx, p, w * 2.6, hot ? 'rgba(255,110,40,0.7)' : 'rgba(255,40,70,0.45)');
  ctx.restore();
  line(ctx, p, w + 3.5, '#2a0410');
  line(ctx, p, w, hot ? '#ff6a2a' : '#c4153a');
  line(ctx, p, Math.max(1, w * 0.35), hot ? '#ffe9a0' : '#ff8a9a');
}

function paintCloak(rage: boolean): HTMLCanvasElement {
  const [c, ctx] = sheet();
  groundShadow(ctx, 200, 590, 150, 12, 0.45);
  const cloth = rage
    ? { hi: '#4a3048', base: '#2a1a2c', dark: '#120a14', light: '#6e4a6a', lining: '#c4153a' }
    : { hi: '#3e4f74', base: '#28344e', dark: '#121828', light: '#5a6e98', lining: '#8e0f26' };
  const cloak = P2(CLOAK);
  piece(ctx, cloak, {
    fill: rad(ctx, 150, 180, 20, 460, [[0, cloth.hi], [0.45, cloth.base], [1, cloth.dark]]),
    shadow: cloth.dark,
    shadowOff: [-46, -10],
    shadowSoft: 6,
    light: cloth.light,
    lightOff: [12, 10],
    ao: 0.5,
    ink: 8,
    detail: (d) => {
      grunge(d, rage ? 91 : 81, { color: '#05060c', count: 220, size: [0.6, 2.4], alpha: 0.4, area: [20, 0, 370, 600], scratches: 18 });
      grunge(d, rage ? 92 : 82, { color: rage ? '#a07090' : '#8aa0cc', count: 90, size: [0.5, 1.6], alpha: 0.3, area: [20, 0, 370, 600] });
      // folds: dark groove, light ridge beside it
      for (const f of [...FOLDS, ...HOOD_FOLDS]) {
        const p = P2(f);
        d.save();
        d.filter = 'blur(3px)';
        line(d, p, 12, 'rgba(4,4,10,0.55)');
        d.restore();
        d.save();
        d.translate(-7, 0);
        d.filter = 'blur(2px)';
        line(d, p, 5, rage ? 'rgba(180,120,170,0.35)' : 'rgba(150,175,225,0.35)');
        d.restore();
        line(d, p, 2.5, 'rgba(4,4,10,0.7)');
      }
      // hem soaked with infection
      d.fillStyle = lin(d, 0, 470, 0, 600, [[0, 'rgba(140,10,34,0)'], [0.6, 'rgba(140,10,34,0.55)'], [1, 'rgba(90,4,20,0.85)']]);
      d.fillRect(0, 440, SW, 160);
      // torn holes
      const rnd = seeded(rage ? 7 : 3);
      for (let i = 0; i < 5; i++) {
        const x = 60 + rnd() * 280;
        const y = 380 + rnd() * 150;
        d.fillStyle = 'rgba(6,2,8,0.85)';
        d.beginPath();
        d.ellipse(x, y, 6 + rnd() * 8, 3 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
        d.fill();
      }
    },
  });
  // the gap where the cloak parts: something infected glows inside
  piece(ctx, P2(SLIT), {
    fill: lin(ctx, 0, 268, 0, 586, [[0, '#06030a'], [0.6, '#2a0612'], [1, rage ? '#ff5a2a' : '#8e0f26']]),
    ink: 5,
  });
  for (const v of HEM_VEINS) veinStroke(ctx, v, rage, 4.5);
  if (rage) for (const v of RAGE_CRACKS) veinStroke(ctx, v, true, 5);

  // hood opening: lined with red, a void inside
  const opening = P2(OPENING);
  ctx.save();
  ctx.filter = 'blur(2px)';
  line(ctx, opening, 26, cloth.lining);
  ctx.restore();
  piece(ctx, opening, {
    fill: rad(ctx, 200, 200, 10, 110, [[0, rage ? '#3a0610' : '#1e0812'], [0.7, '#0a0408'], [1, '#020103']]),
    ink: 9,
    detail: (d) => {
      // inner glow from the grin, under the shadow of the hood
      d.fillStyle = rad(d, 200, 230, 4, 90, [[0, rage ? 'rgba(255,60,40,0.45)' : 'rgba(255,40,70,0.22)'], [1, 'rgba(255,40,70,0)']]);
      d.fillRect(100, 80, 200, 200);
    },
  });
  // hood rim highlight
  gloss(ctx, P2('M150 98 C166 82 186 76 206 76'), 4, 0.35);
  // neck clasp with an eye gem
  const clasp = P2('M200 252 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0');
  piece(ctx, clasp, {
    fill: lin(ctx, 178, 230, 222, 274, [[0, '#fff1b0'], [0.4, '#f2b642'], [1, '#7a4f0e']]),
    shadow: '#8a5a12',
    shadowOff: [-6, -6],
    ink: 6,
  });
  const gem = P2('M186 268 Q200 254 214 268 Q200 282 186 268 Z');
  piece(ctx, gem, { fill: rad(ctx, 200, 268, 1, 14, [[0, '#fff3c4'], [0.4, '#ff3347'], [1, '#7a0418']]), ink: 3 });
  dot(ctx, 200, 268, 3.5, INK);
  dot(ctx, 204, 264, 2, '#fff');
  // cloak shoulder rim light (red back-light from the corridor)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.filter = 'blur(6px)';
  line(ctx, P2('M300 192 C336 210 354 246 362 296 C370 370 374 450 384 520'), 10, 'rgba(255,60,90,0.55)');
  ctx.restore();
  return c;
}

function eyeShape(cx: number, dir: number, rage: boolean): Path2D {
  const w = rage ? 30 : 25;
  const h = rage ? 15 : 11;
  return P2(
    `M${cx - dir * w} ${EYE_Y - 6} Q${cx} ${EYE_Y - h - 6} ${cx + dir * w * 0.8} ${EYE_Y + 6} Q${cx - dir * 4} ${EYE_Y + h + 2} ${cx - dir * w} ${EYE_Y - 6} Z`,
  );
}

function paintFace(rage: boolean): { face: HTMLCanvasElement; jaw: HTMLCanvasElement; eyeArt: HTMLCanvasElement; eyes: HTMLCanvasElement } {
  const [face, fctx] = sheet();
  const [eyeArt, actx] = sheet();
  const [jaw, jctx] = sheet();
  const [eyes, ectx] = sheet();
  const hot = rage ? ['#ffffff', '#ffb3a0', '#ff3347'] : ['#ffffff', '#fff09a', '#ff9a1a'];
  for (const dir of [-1, 1]) {
    const cx = 200 + dir * 32;
    const e = eyeShape(cx, dir, rage);
    actx.save();
    actx.filter = 'blur(9px)';
    actx.fillStyle = rage ? 'rgba(255,40,60,0.9)' : 'rgba(255,170,40,0.85)';
    actx.fill(e);
    actx.restore();
    piece(actx, e, { fill: rad(actx, cx, EYE_Y, 1, 28, [[0, hot[0]], [0.35, hot[1]], [1, hot[2]]]), ink: 0 });
    // the same shapes, flat and bright, for the additive glow layer
    ectx.fillStyle = rage ? '#ff3347' : '#ffb21a';
    ectx.fill(e);
  }
  // grin: a wide crescent of fangs
  const mouth = P2('M140 204 Q200 222 260 204 Q252 254 200 262 Q148 254 140 204 Z');
  piece(fctx, mouth, {
    fill: rad(fctx, 200, 236, 2, 70, [[0, rage ? '#ff6a4a' : '#ff3a52'], [0.4, '#8e0f26'], [1, '#1a0208']]),
    ink: 6,
  });
  const fangs = (ctx: CanvasRenderingContext2D, top: boolean) => {
    const xs = top ? [144, 156, 168, 180, 192, 204, 216, 228, 240, 250] : [152, 166, 180, 194, 208, 222, 236];
    xs.forEach((x, i) => {
      const t = (x - 140) / 120;
      const yEdge = top ? 204 + Math.sin(t * Math.PI) * 16 : 256 - Math.sin(t * Math.PI) * 4;
      const len = (i % 2 ? 12 : 20) + (top ? Math.sin(t * Math.PI) * 4 : 0);
      const w = 6;
      const p = top
        ? P2(`M${x - w} ${yEdge - 2} Q${x - 1} ${yEdge + len * 0.6} ${x + 1} ${yEdge + len} Q${x + 2} ${yEdge + len * 0.5} ${x + w} ${yEdge - 2} Z`)
        : P2(`M${x - w} ${yEdge + 4} Q${x - 1} ${yEdge - len * 0.6} ${x + 1} ${yEdge - len} Q${x + 2} ${yEdge - len * 0.5} ${x + w} ${yEdge + 4} Z`);
      piece(ctx, p, { fill: lin(ctx, 0, yEdge - 20, 0, yEdge + 20, [[0, '#fffaf0'], [1, '#d8c4a0']]), ink: 3 });
    });
  };
  fangs(fctx, true);
  fangs(jctx, false);
  // drool / blood drip from a fang on the jaw layer
  line(jctx, P2('M236 256 C238 268 236 278 239 290'), 6);
  line(jctx, P2('M236 256 C238 268 236 278 239 290'), 3.5, rage ? '#ff5a2a' : '#c4153a');
  return { face, jaw, eyeArt, eyes };
}

const BONE_HAND = { calm: ['#c9bccf', '#8a7a96', '#4a3a58'], rage: ['#d8b0b8', '#9a6070', '#4a2030'] };

/** A tapered bony finger along a quadratic curve, with knuckles and a claw at the tip. */
function finger(ctx: CanvasRenderingContext2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, rage: boolean): void {
  const col = rage ? BONE_HAND.rage : BONE_HAND.calm;
  const n = 10;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1]);
  }
  const pass = (extra: number, color: string, dx = 0, dy = 0, scale = 1) => {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      ctx.lineWidth = (w * (1 - (i / n) * 0.45)) * scale + extra;
      ctx.beginPath();
      ctx.moveTo(pts[i][0] + dx, pts[i][1] + dy);
      ctx.lineTo(pts[i + 1][0] + dx, pts[i + 1][1] + dy);
      ctx.stroke();
    }
  };
  pass(5, INK);
  pass(0, col[1]);
  pass(0, col[2], 1.5, 1.5, 0.45);
  pass(0, col[0], -1.2, -1.2, 0.35);
  for (const k of [3, 6]) {
    dot(ctx, pts[k][0], pts[k][1], w * 0.32, col[2], 0.8);
    dot(ctx, pts[k][0] - 1, pts[k][1] - 1, w * 0.16, col[0], 0.9);
  }
  // claw continuing the finger direction
  const [ex, ey] = pts[n];
  const [px, py] = pts[n - 2];
  const a = Math.atan2(ey - py, ex - px);
  const L = w * 2.1;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  piece(ctx, P2(`M-2 ${-w * 0.42} Q${L * 0.6} ${-w * 0.3} ${L} ${w * 0.5} Q${L * 0.4} ${w * 0.25} -2 ${w * 0.42} Z`), {
    fill: lin(ctx, 0, 0, L, 0, [[0, '#d8c8a8'], [1, '#fffaf0']]),
    ink: 3,
  });
  ctx.restore();
}

function palm(ctx: CanvasRenderingContext2D, d: string, rage: boolean): void {
  const col = rage ? BONE_HAND.rage : BONE_HAND.calm;
  piece(ctx, P2(d), { fill: lin(ctx, 0, 250, 0, 420, [[0, col[0]], [0.5, col[1]], [1, col[2]]]), shadow: col[2], shadowOff: [-6, -4], ink: 5 });
}

function sleeve(ctx: CanvasRenderingContext2D, d: string, rage: boolean): void {
  const cloth = rage ? ['#4a3048', '#2a1a2c', '#120a14'] : ['#3e4f74', '#28344e', '#121828'];
  piece(ctx, P2(d), {
    fill: lin(ctx, 0, 190, 0, 360, [[0, cloth[0]], [0.5, cloth[1]], [1, cloth[2]]]),
    shadow: cloth[2],
    shadowOff: [-14, -6],
    ao: 0.4,
    ink: 7,
    detail: (x) => grunge(x, 71, { color: '#05060c', count: 50, size: [0.6, 2], alpha: 0.4, area: [20, 190, 360, 170] }),
  });
}

function paintHandL(rage: boolean): HTMLCanvasElement {
  const [c, ctx] = sheet();
  sleeve(ctx, 'M98 206 C66 236 44 286 36 344 Q66 360 100 352 C104 304 114 262 132 232 Z', rage);
  // cuff opening (dark)
  piece(ctx, P2('M38 342 Q68 358 100 350 Q70 340 38 342 Z'), { fill: '#05030a', ink: 4 });
  // the Codex held against the chest
  const codex = paintCodex();
  const book = codex.base;
  book.getContext('2d')!.drawImage(codex.parts.iris, 0, 0);
  ctx.save();
  ctx.translate(74, 404);
  ctx.rotate(-0.16);
  ctx.drawImage(book, -88, -88, 176, 176);
  ctx.restore();
  // bony hand gripping the book's spine: palm behind, fingers wrapping onto the cover, thumb on top
  palm(ctx, 'M22 360 C14 380 16 420 28 440 C40 446 48 430 44 404 C42 384 40 366 22 360 Z', rage);
  finger(ctx, 34, 372, 50, 358, 66, 366, 10, rage);
  finger(ctx, 34, 392, 52, 384, 70, 392, 10, rage);
  finger(ctx, 34, 412, 52, 406, 68, 414, 9, rage);
  finger(ctx, 34, 430, 48, 428, 60, 436, 8, rage);
  return c;
}

function paintHandR(rage: boolean): HTMLCanvasElement {
  const [c, ctx] = sheet();
  sleeve(ctx, 'M302 206 C334 232 356 280 366 330 Q336 346 310 340 C304 296 292 262 272 234 Z', rage);
  piece(ctx, P2('M312 338 Q338 344 364 328 Q336 326 312 338 Z'), { fill: '#05030a', ink: 4 });
  // palm up, long fingers curling around the levitating orb
  palm(ctx, 'M318 338 C312 356 326 372 346 372 C366 372 378 356 372 336 C356 344 334 344 318 338 Z', rage);
  finger(ctx, 320, 344, 300, 320, 310, 290, 10, rage);
  finger(ctx, 334, 346, 324, 314, 330, 284, 10, rage);
  finger(ctx, 358, 346, 370, 314, 366, 284, 10, rage);
  finger(ctx, 372, 340, 392, 316, 386, 290, 9, rage);
  return c;
}

function paintOrb(rage: boolean): HTMLCanvasElement {
  const S = 120;
  const [c, ctx] = makeCanvas(S * SRES, S * SRES);
  ctx.scale(SRES, SRES);
  const col = rage ? ['#fff3c4', '#ff5a2a', '#a3102a', '#3a0410'] : ['#f0ffd0', '#8dff5a', '#2fa83a', '#0a3a10'];
  const ball = P2(`M${S / 2 + 34} ${S / 2} a34 34 0 1 0 -68 0 a34 34 0 1 0 68 0`);
  piece(ctx, ball, {
    fill: rad(ctx, S / 2 - 10, S / 2 - 12, 2, 46, [[0, col[0]], [0.35, col[1]], [0.75, col[2]], [1, col[3]]]),
    ink: 6,
    detail: (d) => {
      // swirling infection inside
      d.strokeStyle = rage ? 'rgba(255,240,180,0.7)' : 'rgba(230,255,200,0.7)';
      d.lineWidth = 3;
      d.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        d.beginPath();
        d.arc(S / 2, S / 2, 12 + i * 8, i * 2.1, i * 2.1 + 2.2);
        d.stroke();
      }
    },
  });
  gloss(ctx, P2(`M${S / 2 - 22} ${S / 2 - 8} Q${S / 2 - 18} ${S / 2 - 24} ${S / 2 - 4} ${S / 2 - 28}`), 5, 0.9);
  dot(ctx, S / 2 + 16, S / 2 + 14, 3, '#fff', 0.7);
  return c;
}

function paintHorns(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  for (const dir of [-1, 1]) {
    const x = 200 + dir * 62;
    const p = P2(
      `M${x - 16} 92 C${x + dir * 6} 60 ${x + dir * 40} 30 ${x + dir * 78} 12 C${x + dir * 50} 40 ${x + dir * 30} 70 ${x + 16} 104 Z`,
    );
    piece(ctx, p, {
      fill: lin(ctx, x, 104, x + dir * 78, 12, [[0, '#3a2a30'], [0.5, '#b8a588'], [1, '#fffaf0']]),
      shadow: 'rgba(0,0,0,0.35)',
      shadowOff: [dir * 8, -6],
      ink: 6,
      detail: (d) => {
        d.strokeStyle = 'rgba(40,20,20,0.55)';
        d.lineWidth = 2.5;
        for (let i = 1; i < 5; i++) {
          const t = i / 5;
          const px = x + dir * 78 * t;
          const py = 98 - 86 * t;
          d.beginPath();
          d.moveTo(px - 12, py + 6);
          d.lineTo(px + 12, py - 6);
          d.stroke();
        }
      },
    });
  }
  return c;
}

export function paintSpectre(): { calm: SpectreParts; rage: SpectreParts } {
  const horns = paintHorns();
  const make = (rage: boolean): SpectreParts => {
    const f = paintFace(rage);
    return {
      cloak: paintCloak(rage),
      face: f.face,
      jaw: f.jaw,
      eyeArt: f.eyeArt,
      eyes: f.eyes,
      handL: paintHandL(rage),
      handR: paintHandR(rage),
      orb: paintOrb(rage),
      horns,
    };
  };
  return { calm: make(false), rage: make(true) };
}

/** Dark cartoon smoke puff used by the cloak emitter. */
export function paintSmokePuff(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 128);
  const blob = new Path2D();
  for (const [x, y, r] of [[64, 70, 34], [42, 66, 22], [86, 64, 24], [60, 46, 22], [78, 84, 18]]) {
    blob.moveTo(x + r, y);
    blob.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.stroke(blob);
  piece(ctx, blob, { fill: '#3a2a48', shadow: '#1e1428', shadowOff: [-8, -10], light: '#5e4a72', lightOff: [6, 6], ink: 0 });
  return c;
}

