import { INK, makeCanvas } from './painters';
import { dot, gloss, grunge, groundShadow, lin, line, piece, rad, type Piece } from './paint';

/**
 * Painted main character, two forms sharing one rig (400×600 design space, painted at RES×).
 * Pivots: neck (200, 262) · near shoulder (292, 300) · feet (200, 584).
 * The character is shown mirrored on screen, so the red back-light from the corridor's far end
 * lands on the art's right-hand edges.
 */
export const MW = 400;
export const MH = 600;
export const MRES = 2;

export interface MascotParts {
  body: HTMLCanvasElement;
  arm: HTMLCanvasElement;
  head: HTMLCanvasElement;
  jaw: HTMLCanvasElement;
  eyes: HTMLCanvasElement;
  lids: HTMLCanvasElement;
}

const P2 = (d: string) => new Path2D(d);

function sheet(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, ctx] = makeCanvas(MW * MRES, MH * MRES);
  ctx.scale(MRES, MRES);
  return [c, ctx];
}

const RIM = '#ff4a6a';

/** Shared piece recipe: gradient body, cel shadow, light, red rim, occlusion, ink. */
function part(ctx: CanvasRenderingContext2D, d: string | Path2D, o: Piece & { rim?: string | false; shadowPath?: string; lightPath?: string; shadowCol?: string; lightCol?: string }): void {
  const p = typeof d === 'string' ? P2(d) : d;
  const extra = o.detail;
  piece(ctx, p, {
    ink: 6,
    ao: 0.35,
    ...o,
    detail: (x) => {
      if (o.shadowPath) {
        x.fillStyle = o.shadowCol ?? 'rgba(10,6,20,0.35)';
        x.fill(P2(o.shadowPath));
      }
      if (o.lightPath) {
        x.fillStyle = o.lightCol ?? 'rgba(255,255,255,0.18)';
        x.fill(P2(o.lightPath));
      }
      extra?.(x);
      if (o.rim !== false) {
        // red back-light on the right edges
        const [r, rc] = makeCanvas(x.canvas.width, x.canvas.height);
        rc.setTransform(x.getTransform());
        rc.fillStyle = o.rim ?? RIM;
        rc.fill(p);
        rc.globalCompositeOperation = 'destination-out';
        rc.filter = 'blur(1px)';
        rc.translate(-5, 2);
        rc.fill(p);
        x.save();
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.globalAlpha = 0.85;
        x.drawImage(r, 0, 0);
        x.restore();
      }
    },
  });
}

/** Molten crack: glow, dark casing, orange body, yellow core. */
function crack(ctx: CanvasRenderingContext2D, d: string, w = 4): void {
  const p = P2(d);
  ctx.save();
  ctx.filter = 'blur(4px)';
  line(ctx, p, w * 2.8, 'rgba(255,90,40,0.5)');
  ctx.restore();
  line(ctx, p, w + 3.5, '#4a0a10');
  line(ctx, p, w, '#ff5a2a');
  line(ctx, p, Math.max(1, w * 0.38), '#ffe08a');
}

function vein(ctx: CanvasRenderingContext2D, d: string, w = 3, color = '#7a1f5a'): void {
  line(ctx, P2(d), w, color);
}

/* palette */
const HOOD = { top: '#4e5d74', base: '#3a4658', dark: '#232b38', band: '#2c3646', light: '#6a7d98' };
const JEANS = { top: '#3c4a74', base: '#2e3a5c', dark: '#1c2440', light: '#5a6ca4' };
const SKIN = { top: '#ffe6d4', base: '#efd2bd', dark: '#c99682' };
const CHAR = { top: '#4e3a52', base: '#2e2030', dark: '#170f19', light: '#6a5470' };
const BONE = { top: '#fffaf0', base: '#ece0c8', dark: '#b8a588' };

const TORSO = 'M122 278 C150 252 250 252 280 278 C298 330 296 400 284 452 C240 466 160 466 118 452 C106 400 104 330 122 278 Z';

const fabric = (seed: number, area: [number, number, number, number]) => (x: CanvasRenderingContext2D) => {
  grunge(x, seed, { color: '#0e121a', count: 60, size: [0.6, 2], alpha: 0.35, area });
  grunge(x, seed + 1, { color: '#9aaccc', count: 30, size: [0.5, 1.5], alpha: 0.25, area });
};

/* ================================================================ HUMAN */

function humanBody(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  groundShadow(ctx, 200, 584, 124, 13, 0.5);
  // legs
  for (const [d, sd, ld] of [
    ['M158 446 L150 556 L190 556 L196 446 Z', 'M178 446 L176 556 L190 556 L196 446 Z', 'M160 452 L166 452 L160 550 L154 550 Z'],
    ['M206 446 L212 556 L252 556 L244 446 Z', 'M228 446 L234 556 L252 556 L244 446 Z', 'M210 452 L216 452 L218 550 L212 550 Z'],
  ]) {
    part(ctx, d, {
      fill: lin(ctx, 0, 446, 0, 556, [[0, JEANS.top], [1, JEANS.base]]),
      shadowPath: sd,
      shadowCol: 'rgba(14,18,40,0.55)',
      lightPath: ld,
      lightCol: 'rgba(140,160,220,0.35)',
      detail: (x) => {
        grunge(x, 41, { color: '#9fb4ee', count: 40, size: [0.5, 1.4], alpha: 0.35, area: [140, 440, 120, 120] });
        x.strokeStyle = 'rgba(14,18,40,0.6)';
        x.lineWidth = 2;
        for (const y of [500, 506]) {
          x.beginPath();
          x.moveTo(150, y);
          x.quadraticCurveTo(170, y - 6, 196, y);
          x.moveTo(208, y + 4);
          x.quadraticCurveTo(228, y - 2, 250, y + 4);
          x.stroke();
        }
      },
    });
  }
  // torn knee with an infected vein
  part(ctx, 'M164 492 Q172 486 182 492 L180 506 Q172 512 164 506 Z', { fill: SKIN.base, ink: 3.5, rim: false, ao: 0 });
  vein(ctx, 'M168 496 L174 502 L178 498', 2);
  line(ctx, P2('M188 470 L186 540 M220 470 L224 540'), 2.5, '#1a2238');
  // sneakers
  for (const d of ['M144 552 Q140 578 158 582 L198 582 Q206 570 194 552 Z', 'M206 552 Q198 570 206 582 L246 582 Q264 578 258 552 Z']) {
    part(ctx, d, {
      fill: lin(ctx, 0, 552, 0, 582, [[0, '#ffffff'], [1, '#d8d6e2']]),
      shadow: '#b6b4c6',
      shadowOff: [-8, -5],
      ink: 5,
    });
  }
  line(ctx, P2('M144 574 L200 574 M206 574 L260 574'), 6, '#8a90a2');
  line(ctx, P2('M160 558 l8 0 M162 565 l8 0 M232 558 l8 0 M230 565 l8 0'), 3.5, '#e0213a');
  // far arm (sleeve)
  part(ctx, 'M128 286 C106 330 106 382 134 414 L162 404 C148 376 148 336 158 300 Z', {
    fill: lin(ctx, 106, 0, 162, 0, [[0, HOOD.top], [1, HOOD.base]]),
    shadowPath: 'M146 290 C138 340 140 380 162 404 L150 410 C128 380 126 330 136 292 Z',
    lightPath: 'M118 320 C114 350 118 380 128 400 L122 402 C110 380 108 350 114 322 Z',
    rim: false,
    detail: fabric(42, [100, 280, 70, 140]),
  });
  // collar
  part(ctx, 'M150 262 C170 236 230 236 250 262 C236 282 164 282 150 262 Z', { fill: HOOD.band, ink: 5, rim: false });
  // torso
  part(ctx, TORSO, {
    fill: rad(ctx, 170, 300, 10, 200, [[0, HOOD.top], [0.55, HOOD.base], [1, HOOD.dark]]),
    shadowPath: 'M232 256 C300 280 306 400 284 460 L200 470 C262 420 270 320 232 256 Z',
    shadowCol: 'rgba(16,20,30,0.5)',
    lightPath: 'M126 286 C114 330 112 390 120 440 L112 440 C104 390 106 330 118 286 Z',
    lightCol: 'rgba(160,180,210,0.35)',
    ao: 0.45,
    detail: (x) => {
      fabric(43, [110, 250, 180, 220])(x);
      // fabric folds
      x.strokeStyle = 'rgba(16,20,30,0.55)';
      x.lineWidth = 3;
      x.lineCap = 'round';
      for (const d of ['M140 300 Q150 330 146 356', 'M262 300 Q258 330 264 360', 'M150 440 Q170 430 186 442', 'M220 440 Q236 432 252 444']) x.stroke(P2(d));
    },
  });
  // kangaroo pocket + hem
  part(ctx, 'M150 372 Q200 384 250 372 L246 420 Q200 432 154 420 Z', {
    fill: lin(ctx, 0, 372, 0, 430, [[0, '#35414f'], [1, HOOD.band]]),
    ink: 5,
    ao: 0.2,
    rim: false,
    detail: (x) => {
      x.save();
      x.setLineDash([5, 5]);
      line(x, P2('M156 380 Q200 392 244 380'), 1.6, 'rgba(160,180,210,0.5)');
      x.restore();
    },
  });
  part(ctx, 'M118 440 C160 454 240 454 284 440 L284 458 C240 472 160 472 118 458 Z', {
    fill: HOOD.band,
    ink: 5,
    ao: 0,
    detail: (x) => {
      x.strokeStyle = 'rgba(10,14,22,0.6)';
      x.lineWidth = 1.6;
      for (let X = 124; X < 284; X += 7) {
        x.beginPath();
        x.moveTo(X, 444);
        x.lineTo(X, 466);
        x.stroke();
      }
    },
  });
  // drawstrings + aglets
  line(ctx, P2('M182 270 C180 300 180 330 176 352 M218 270 C220 296 222 322 226 344'), 7, INK);
  line(ctx, P2('M182 270 C180 300 180 330 176 352 M218 270 C220 296 222 322 226 344'), 4, '#e8e6f0');
  for (const [x, y] of [[171, 350], [221, 342]]) {
    part(ctx, new Path2D(`M${x} ${y} h10 v14 h-10 Z`), { fill: lin(ctx, x, 0, x + 10, 0, [[0, '#e9eef2'], [1, '#7d8a95']]), ink: 3, ao: 0, rim: false });
  }
  // biohazard print, cracked
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = '#7d8fa8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(200, 318, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  for (const a of [-90, 30, 150]) {
    ctx.beginPath();
    ctx.arc(200 + Math.cos((a * Math.PI) / 180) * 8, 318 + Math.sin((a * Math.PI) / 180) * 8, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // blood stain on the chest
  part(ctx, 'M244 300 C254 292 266 300 262 312 C272 316 268 330 256 326 C250 336 236 330 240 318 C230 312 234 300 244 300 Z', {
    fill: rad(ctx, 248, 312, 2, 22, [[0, '#e0213a'], [1, '#8e0f26']]),
    ink: 3.5,
    ao: 0,
    rim: false,
  });
  dot(ctx, 270, 296, 4, '#b5122f');
  dot(ctx, 236, 336, 3, '#b5122f');
  gloss(ctx, P2('M246 304 Q250 300 256 302'), 2, 0.7);
  return c;
}

function humanArm(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  part(ctx, 'M276 282 C304 300 322 350 326 410 L296 416 C292 368 282 330 262 306 Z', {
    fill: lin(ctx, 262, 0, 326, 0, [[0, HOOD.top], [1, HOOD.base]]),
    shadowPath: 'M300 300 C318 340 326 380 326 412 L312 414 C312 370 304 330 288 300 Z',
    shadowCol: 'rgba(16,20,30,0.5)',
    detail: (x) => {
      fabric(44, [260, 280, 70, 140])(x);
      line(x, P2('M290 340 Q300 344 306 356'), 2.5, 'rgba(16,20,30,0.55)');
    },
  });
  part(ctx, 'M294 404 L328 400 L330 420 L296 424 Z', { fill: HOOD.band, ink: 5, ao: 0 });
  // hand
  part(ctx, 'M298 420 C292 446 300 466 316 468 C332 470 338 452 334 424 Z', {
    fill: lin(ctx, 292, 0, 338, 0, [[0, SKIN.top], [1, SKIN.base]]),
    shadowPath: 'M320 420 C330 440 330 460 316 468 L334 468 L336 420 Z',
    shadowCol: 'rgba(160,90,80,0.45)',
    ink: 5,
  });
  // bandage wraps
  for (const d of ['M298 434 L334 430', 'M298 446 L334 442']) {
    line(ctx, P2(d), 9, INK);
    line(ctx, P2(d), 7, '#f0e6d0');
  }
  dot(ctx, 320, 438, 3, '#b5122f');
  vein(ctx, 'M306 456 L312 450 L318 458 L324 452', 2.5);
  line(ctx, P2('M304 466 l-2 8 M312 469 l0 9 M321 468 l2 8'), 4, '#3a1a2a');
  return c;
}

const humanEyeL = 'M150 164 Q168 148 188 164 Q168 176 150 164 Z';
const humanEyeR = 'M212 164 Q232 148 252 164 Q232 176 212 164 Z';
const humanHair = 'M124 152 C112 112 122 74 150 60 L146 40 L168 52 L176 30 L192 48 L206 26 L216 48 L234 32 L238 56 L258 50 C282 72 292 110 280 152 L266 128 C258 100 240 92 200 94 C160 92 142 100 134 128 Z';
const humanFace = 'M134 160 C134 104 166 78 200 78 C234 78 266 104 266 160 C266 212 236 242 200 242 C164 242 134 212 134 160 Z';
const HAIR = (ctx: CanvasRenderingContext2D) => lin(ctx, 0, 26, 0, 152, [[0, '#4a3440'], [1, '#1e1218']]);

function humanHead(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  // neck
  part(ctx, 'M178 218 L176 268 L224 268 L222 218 Z', {
    fill: lin(ctx, 0, 218, 0, 268, [[0, SKIN.dark], [1, SKIN.base]]),
    shadowPath: 'M206 218 L210 268 L224 268 L222 218 Z',
    shadowCol: 'rgba(140,70,70,0.4)',
    ink: 5,
  });
  vein(ctx, 'M186 234 L192 246 L186 258', 3);
  vein(ctx, 'M212 236 L206 250 L214 262', 2.5);
  // back hair
  part(ctx, humanHair, { fill: HAIR(ctx), ink: 7, ao: 0.2 });
  // ears
  part(ctx, 'M122 170 a12 18 0 1 0 24 0 a12 18 0 1 0 -24 0', { fill: SKIN.base, ink: 5, ao: 0, rim: false });
  part(ctx, 'M254 170 a12 18 0 1 0 24 0 a12 18 0 1 0 -24 0', { fill: SKIN.dark, ink: 5, ao: 0 });
  // face
  part(ctx, humanFace, {
    fill: rad(ctx, 176, 140, 10, 130, [[0, SKIN.top], [0.6, SKIN.base], [1, SKIN.dark]]),
    shadowPath: 'M226 80 C270 104 276 200 232 240 L200 246 C250 200 254 120 226 80 Z',
    shadowCol: 'rgba(170,96,86,0.42)',
    lightPath: 'M150 150 C150 120 162 104 178 98 C166 112 160 130 160 150 Z',
    lightCol: 'rgba(255,255,255,0.45)',
    ink: 5,
    ao: 0.25,
    detail: (x) => {
      // fringe shadow on the forehead
      x.fillStyle = 'rgba(120,60,60,0.3)';
      x.fill(P2('M136 132 C150 104 186 96 214 100 C246 104 262 116 266 136 L266 148 C240 130 170 128 136 148 Z'));
      grunge(x, 51, { color: '#c08070', count: 30, size: [0.4, 1.2], alpha: 0.3, area: [140, 90, 120, 140] });
    },
  });
  // blush + eye bags (tired, sick)
  ctx.save();
  ctx.filter = 'blur(3px)';
  ctx.fillStyle = 'rgba(255,120,140,0.4)';
  ctx.beginPath();
  ctx.ellipse(160, 194, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,60,140,0.35)';
  ctx.beginPath();
  ctx.ellipse(232, 180, 20, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(168, 178, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  line(ctx, P2('M154 176 Q168 184 186 176'), 3.5, 'rgba(110,70,120,0.6)');
  line(ctx, P2('M214 176 Q232 186 252 174'), 4.5, 'rgba(122,31,90,0.85)');
  vein(ctx, 'M248 172 L258 182 L254 194 M252 180 L264 188', 2.5);
  // eyes
  part(ctx, humanEyeL, { fill: lin(ctx, 0, 152, 0, 176, [[0, '#e8e4ec'], [1, '#ffffff']]), ink: 3.5, ao: 0, rim: false });
  dot(ctx, 170, 163, 7.5, '#5a6a7a');
  dot(ctx, 170, 163, 3.5, INK);
  dot(ctx, 172, 160, 2, '#fff');
  part(ctx, humanEyeR, { fill: lin(ctx, 0, 152, 0, 176, [[0, '#f4d4d0'], [1, '#ffeae6']]), ink: 3.5, ao: 0, rim: false });
  line(ctx, P2('M214 164 L222 162 M250 164 L242 167'), 1.8, '#e0213a');
  dot(ctx, 232, 163, 8.5, '#ff3347');
  ctx.fillStyle = INK;
  ctx.fill(P2('M232 156 Q229 163 232 170 Q235 163 232 156 Z'));
  dot(ctx, 235, 159, 2, '#fff');
  // brows, nose
  line(ctx, P2('M150 140 L184 132'), 6);
  line(ctx, P2('M216 128 L252 138'), 6);
  line(ctx, P2('M198 172 Q192 190 202 194'), 4, '#b4806e');
  // fringe
  part(ctx, 'M138 128 C150 92 186 80 214 84 C246 86 266 106 268 134 L256 118 L248 138 L236 112 L224 136 L212 108 L198 132 L186 106 L174 134 L162 112 L150 138 Z', {
    fill: HAIR(ctx),
    ink: 5,
    ao: 0,
  });
  line(ctx, P2('M176 104 L186 96 M216 98 L230 102 M246 112 L254 118'), 4, '#6a5060');
  gloss(ctx, P2('M156 66 Q170 58 184 60'), 3.5, 0.5);
  gloss(ctx, P2('M180 92 Q196 86 214 88'), 3, 0.45);
  return c;
}

function humanJaw(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  // mouth: smug grin with a fang
  ctx.fillStyle = '#5a1020';
  ctx.fill(P2('M176 206 Q200 222 226 204 Q202 214 176 206 Z'));
  line(ctx, P2('M174 206 Q200 220 228 202'), 5);
  part(ctx, 'M206 210 L212 220 L217 207 Z', { fill: '#fff', ink: 3, ao: 0, rim: false });
  line(ctx, P2('M172 204 L168 200 M230 200 L234 196'), 3.5);
  return c;
}

function humanEyes(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  dot(ctx, 232, 163, 10, '#ff3347');
  vein(ctx, 'M248 172 L258 182 L254 194 M252 180 L264 188', 3, '#ff3347');
  return c;
}

function humanLids(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  part(ctx, 'M148 164 Q168 144 190 164 Q168 180 148 164 Z', { fill: SKIN.base, ink: 3.5, ao: 0, rim: false });
  part(ctx, 'M210 164 Q232 144 254 164 Q232 180 210 164 Z', { fill: SKIN.dark, ink: 3.5, ao: 0, rim: false });
  line(ctx, P2('M150 166 Q168 174 188 166 M212 166 Q232 174 252 166'), 3.5);
  return c;
}

/* ================================================================ INHUMAN */

const CRACKS_BODY = [
  'M150 300 L160 330 L152 360 L166 392',
  'M240 290 L232 320 L246 346 L238 380',
  'M196 360 L206 386 L198 412',
  'M110 360 L104 400 L112 440 L100 480',
  'M172 488 L178 512 L172 534',
  'M228 490 L224 514 L232 536',
];
const charFill = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) =>
  lin(ctx, x0, y0, x1, y1, [[0, CHAR.top], [0.5, CHAR.base], [1, CHAR.dark]]);
const skinTex = (seed: number, area: [number, number, number, number]) => (x: CanvasRenderingContext2D) => {
  grunge(x, seed, { color: '#0a060c', count: 70, size: [0.6, 2.2], alpha: 0.5, area, scratches: 6 });
  grunge(x, seed + 1, { color: '#8a6a90', count: 30, size: [0.5, 1.4], alpha: 0.35, area });
};

function claws(ctx: CanvasRenderingContext2D, d: string): void {
  for (const seg of d.split('Z').filter((s) => s.trim())) {
    part(ctx, seg + 'Z', { fill: lin(ctx, 0, 0, 0, 600, [[0, BONE.top], [1, BONE.dark]]), ink: 3.5, ao: 0, rim: false });
  }
}

function inhumanBody(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  groundShadow(ctx, 200, 584, 130, 14, 0.55);
  // back spines
  claws(ctx, 'M160 222 L170 196 L180 226 Z M218 226 L230 194 L240 222 Z M188 214 L200 184 L212 214 Z');
  // shredded jeans
  for (const [d, sd] of [
    ['M156 446 L146 548 L188 548 L196 446 Z', 'M176 446 L174 548 L188 548 L196 446 Z'],
    ['M206 446 L214 548 L256 548 L244 446 Z', 'M228 446 L236 548 L256 548 L244 446 Z'],
  ]) {
    part(ctx, d, {
      fill: lin(ctx, 0, 446, 0, 548, [[0, JEANS.top], [1, JEANS.dark]]),
      shadowPath: sd,
      shadowCol: 'rgba(14,18,40,0.55)',
      detail: (x) => grunge(x, 61, { color: '#9fb4ee', count: 30, size: [0.5, 1.4], alpha: 0.3, area: [140, 440, 120, 110] }),
    });
  }
  for (const d of ['M152 480 L162 470 L172 484 L184 472 L190 488 L184 520 L160 524 L150 512 Z', 'M212 498 L222 488 L232 500 L244 490 L250 504 L246 530 L220 532 L212 520 Z']) {
    part(ctx, d, { fill: charFill(ctx, 150, 470, 190, 530), ink: 3.5, ao: 0, rim: false });
  }
  crack(ctx, CRACKS_BODY[4], 3);
  crack(ctx, CRACKS_BODY[5], 3);
  // clawed feet
  for (const d of ['M140 546 Q136 572 156 576 L196 576 Q202 562 190 546 Z', 'M206 546 Q200 562 206 576 L248 576 Q268 572 262 546 Z']) {
    part(ctx, d, { fill: charFill(ctx, 136, 546, 196, 576), ink: 5 });
  }
  claws(ctx, ['M140 570 L126 590 L148 578', 'M160 576 L154 596 L170 580', 'M180 576 L182 596 L192 578', 'M222 576 L218 596 L232 578', 'M244 576 L250 596 L256 576', 'M262 568 L278 588 L262 580'].join(' Z ') + ' Z');
  // far arm, long and thin
  part(ctx, 'M126 284 C100 340 88 420 92 506 L118 508 C118 430 128 360 152 302 Z', {
    fill: charFill(ctx, 88, 284, 152, 508),
    shadowPath: 'M140 290 C122 360 116 430 118 508 L108 508 C104 430 112 350 130 290 Z',
    shadowCol: 'rgba(0,0,0,0.4)',
    lightPath: 'M108 340 C98 390 96 440 98 490 L94 490 C92 440 94 380 104 340 Z',
    lightCol: 'rgba(160,120,170,0.35)',
    rim: false,
    detail: skinTex(62, [88, 284, 66, 224]),
  });
  crack(ctx, CRACKS_BODY[3], 3.5);
  part(ctx, 'M120 284 L148 296 L140 318 L128 312 L118 328 Z', { fill: HOOD.base, ink: 5, ao: 0, rim: false });
  ctx.save();
  ctx.translate(104, 508);
  ctx.rotate((14 * Math.PI) / 180);
  part(ctx, 'M-22 -4 C-26 16 -16 28 0 28 C16 28 26 16 22 -4 Z', { fill: charFill(ctx, -26, -4, 26, 28), ink: 5, ao: 0, rim: false });
  claws(ctx, 'M-18 22 L-28 70 L-8 28 Z M-4 28 L-6 80 L8 28 Z M10 26 L20 74 L20 22 Z');
  ctx.restore();
  // torso: wiry ribs under charcoal skin
  part(ctx, TORSO, {
    fill: rad(ctx, 170, 320, 10, 200, [[0, CHAR.light], [0.45, CHAR.base], [1, CHAR.dark]]),
    shadowPath: 'M232 256 C300 280 306 400 284 460 L200 470 C262 420 270 320 232 256 Z',
    shadowCol: 'rgba(0,0,0,0.45)',
    lightPath: 'M126 286 C114 330 112 390 120 440 L112 440 C104 390 106 330 118 286 Z',
    lightCol: 'rgba(170,130,180,0.35)',
    ao: 0.5,
    detail: (x) => {
      skinTex(63, [110, 250, 180, 220])(x);
      // ribs: dark groove + light ridge
      for (const d of ['M140 330 Q170 322 200 332 Q230 322 262 330', 'M146 356 Q172 348 200 358 Q228 348 256 356', 'M152 382 Q174 376 200 384 Q226 376 250 382', 'M158 406 Q178 400 200 408 Q222 400 244 406']) {
        line(x, P2(d), 5, 'rgba(8,4,10,0.75)');
        x.save();
        x.translate(0, -4);
        line(x, P2(d), 2.5, 'rgba(150,110,160,0.5)');
        x.restore();
      }
      // sternum
      line(x, P2('M200 300 L200 420'), 3, 'rgba(8,4,10,0.6)');
    },
  });
  crack(ctx, CRACKS_BODY[0]);
  crack(ctx, CRACKS_BODY[1]);
  crack(ctx, CRACKS_BODY[2]);
  // torn hoodie remains: collar and hem rags
  part(ctx, 'M122 278 C150 252 250 252 280 278 L276 300 L262 290 L250 312 L236 288 L222 306 L206 284 L190 304 L176 284 L162 306 L148 286 L132 304 Z', {
    fill: lin(ctx, 0, 256, 0, 312, [[0, HOOD.top], [1, HOOD.dark]]),
    ink: 5,
    ao: 0,
    detail: fabric(64, [120, 250, 162, 64]),
  });
  part(ctx, 'M118 420 L132 404 L146 424 L160 410 L178 432 L196 414 L214 434 L232 412 L248 430 L264 410 L284 428 L284 456 C240 470 160 470 118 456 Z', {
    fill: lin(ctx, 0, 404, 0, 468, [[0, HOOD.base], [1, HOOD.dark]]),
    ink: 5,
    ao: 0,
    detail: fabric(65, [118, 400, 166, 70]),
  });
  part(ctx, 'M140 450 L150 474 L158 452 Z', { fill: HOOD.dark, ink: 3.5, ao: 0, rim: false });
  part(ctx, 'M240 452 L248 478 L258 452 Z', { fill: HOOD.dark, ink: 3.5, ao: 0 });
  return c;
}

function inhumanArm(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  part(ctx, 'M272 282 C312 300 344 380 352 486 L326 494 C318 400 296 336 262 306 Z', {
    fill: charFill(ctx, 262, 282, 352, 494),
    shadowPath: 'M300 296 C330 340 348 420 352 488 L338 490 C334 420 318 350 290 300 Z',
    shadowCol: 'rgba(0,0,0,0.45)',
    lightPath: 'M284 300 C296 312 306 330 312 350 L306 352 C300 334 290 318 278 306 Z',
    lightCol: 'rgba(170,130,180,0.4)',
    detail: skinTex(66, [262, 282, 92, 212]),
  });
  crack(ctx, 'M296 330 L306 360 L300 392 L314 430 L310 460', 3.5);
  part(ctx, 'M268 280 L300 290 L294 316 L280 308 L270 324 Z', { fill: HOOD.base, ink: 5, ao: 0 });
  ctx.save();
  ctx.translate(340, 490);
  ctx.rotate((-10 * Math.PI) / 180);
  part(ctx, 'M-24 -4 C-28 18 -18 30 0 30 C18 30 28 18 24 -4 Z', { fill: charFill(ctx, -28, -4, 28, 30), ink: 5, ao: 0 });
  claws(ctx, 'M-20 24 L-34 78 L-10 30 Z M-6 30 L-10 92 L8 30 Z M10 28 L22 86 L22 24 Z M22 14 L42 54 L26 6 Z');
  ctx.restore();
  return c;
}

const SKULL = 'M136 150 C128 90 166 58 200 56 C236 58 274 90 266 150 C264 204 246 240 200 254 C154 240 138 204 136 150 Z';
const CRACKS_HEAD = ['M196 62 L188 90 L198 108 L190 128', 'M226 70 L236 96 L228 114', 'M150 110 L162 124 L152 138', 'M252 176 L240 192 L250 206', 'M150 176 L160 194 L148 208'];

function inhumanEyeShapes(ctx: CanvasRenderingContext2D, glowOnly = false): void {
  for (const d of ['M146 150 Q168 132 190 156 Q166 168 146 150 Z', 'M256 150 Q234 132 212 156 Q236 168 256 150 Z']) {
    if (!glowOnly) {
      ctx.save();
      ctx.filter = 'blur(6px)';
      ctx.fillStyle = 'rgba(255,190,40,0.8)';
      ctx.fill(P2(d));
      ctx.restore();
    }
    ctx.fillStyle = glowOnly ? '#ffd23f' : rad(ctx, 200, 150, 4, 70, [[0, '#ffffff'], [0.4, '#fff09a'], [1, '#ffb21a']]);
    ctx.fill(P2(d));
    line(ctx, P2(d), 4.5, '#ff3347');
  }
  line(ctx, P2('M168 142 L168 160 M234 142 L234 160'), 4);
}

function inhumanHead(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  part(ctx, 'M176 222 L172 270 L228 270 L224 222 Z', {
    fill: charFill(ctx, 172, 222, 228, 270),
    shadowPath: 'M206 222 L212 270 L228 270 L224 222 Z',
    shadowCol: 'rgba(0,0,0,0.45)',
    ink: 5,
  });
  // horns
  claws(ctx, 'M150 64 L156 40 L168 62 Z M232 62 L246 36 L252 66 Z M196 58 L200 34 L208 58 Z');
  part(ctx, SKULL, {
    fill: rad(ctx, 180, 110, 6, 170, [[0, CHAR.light], [0.5, CHAR.base], [1, CHAR.dark]]),
    shadowPath: 'M230 60 C276 92 280 200 230 248 L200 256 C254 200 260 120 230 60 Z',
    shadowCol: 'rgba(0,0,0,0.45)',
    lightPath: 'M150 140 C150 108 162 86 182 72 C166 92 160 116 160 140 Z',
    lightCol: 'rgba(190,150,200,0.45)',
    ink: 5,
    detail: skinTex(67, [130, 56, 140, 200]),
  });
  for (const d of CRACKS_HEAD) crack(ctx, d, 3.5);
  ctx.fillStyle = INK;
  ctx.fill(P2('M138 150 Q168 122 198 158 Q166 180 138 150 Z'));
  ctx.fill(P2('M264 150 Q234 122 204 158 Q236 180 264 150 Z'));
  inhumanEyeShapes(ctx);
  // maw
  part(ctx, 'M136 182 Q200 204 266 182 Q258 252 200 262 Q142 252 136 182 Z', {
    fill: rad(ctx, 200, 236, 4, 70, [[0, '#ff4a5e'], [0.45, '#8e0f26'], [1, '#2a0410']]),
    ink: 5,
    ao: 0,
    rim: false,
  });
  ctx.fillStyle = '#c4304e';
  ctx.fill(P2('M168 238 Q200 222 232 238 Q200 252 168 238 Z'));
  const teeth: string[] = [];
  [140, 154, 168, 182, 196, 210, 224, 238, 250].forEach((x, i) => {
    const y = 186 + Math.abs(i - 4) * -0.6;
    const len = i % 2 ? 16 : 24;
    teeth.push(`M${x} ${y} L${x + 7} ${y + len} L${x + 14} ${y} Z`);
  });
  claws(ctx, teeth.join(' '));
  return c;
}

function inhumanJaw(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  const teeth: string[] = [];
  [150, 164, 178, 192, 206, 220, 234].forEach((x, i) => {
    const len = i % 2 ? 14 : 22;
    teeth.push(`M${x} 244 L${x + 7} ${244 - len} L${x + 14} 244 Z`);
  });
  claws(ctx, teeth.join(' '));
  part(ctx, 'M144 236 Q200 258 258 236 Q252 272 200 282 Q148 272 144 236 Z', {
    fill: charFill(ctx, 144, 236, 258, 282),
    shadow: 'rgba(0,0,0,0.45)',
    shadowOff: [-10, -6],
    ink: 5,
    ao: 0,
    detail: skinTex(68, [144, 236, 114, 46]),
  });
  crack(ctx, 'M176 262 L186 272 L180 280', 2.5);
  // toxic drool
  part(ctx, 'M230 270 C232 284 230 294 234 304 C238 310 244 306 241 296 C239 288 239 280 238 270 Z', {
    fill: lin(ctx, 230, 0, 244, 0, [[0, '#d2ffb8'], [1, '#4fa83a']]),
    ink: 3.5,
    ao: 0,
    rim: false,
  });
  return c;
}

function inhumanEyes(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  inhumanEyeShapes(ctx, true);
  for (const d of CRACKS_HEAD) line(ctx, P2(d), 3.5, '#ff7a2a');
  for (const d of CRACKS_BODY.slice(0, 3)) line(ctx, P2(d), 4, '#ff7a2a');
  return c;
}

function inhumanLids(): HTMLCanvasElement {
  const [c, ctx] = sheet();
  part(ctx, 'M136 150 Q168 120 200 158 Q166 184 136 150 Z', { fill: CHAR.dark, ink: 3.5, ao: 0, rim: false });
  part(ctx, 'M266 150 Q234 120 202 158 Q236 184 266 150 Z', { fill: CHAR.dark, ink: 3.5, ao: 0, rim: false });
  return c;
}

export function paintMascot(): { human: MascotParts; inhuman: MascotParts } {
  return {
    human: { body: humanBody(), arm: humanArm(), head: humanHead(), jaw: humanJaw(), eyes: humanEyes(), lids: humanLids() },
    inhuman: { body: inhumanBody(), arm: inhumanArm(), head: inhumanHead(), jaw: inhumanJaw(), eyes: inhumanEyes(), lids: inhumanLids() },
  };
}
