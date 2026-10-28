import { makeCanvas, seeded } from './painters';
import { dot, gloss, lin, path, piece, rad } from './paint';

/**
 * "Le Pharaon" — the side character: a floating golden death mask (nemes, broad collar, braided
 * beard) painted procedurally at PRES× so it stays sharp at any size. The jaw is a separate piece
 * so the mask can open its mouth on light; the eyes are empty sockets, their glowing irises are
 * live sprites. A cracks layer (and its glow) is crossfaded in for the infected free-spins form.
 */
export const PW = 400;
export const PH = 520;
export const PRES = 2;
export const EYES: [number, number][] = [
  [172, 199],
  [228, 199],
];
export const MOUTH: [number, number] = [200, 270];
export const URAEUS: [number, number] = [200, 104];
export const RING_R = 236;

const GOLD: [number, string][] = [
  [0, '#fff3c0'],
  [0.18, '#f4c44c'],
  [0.45, '#c08420'],
  [0.7, '#7a460a'],
  [1, '#3c1e04'],
];
const LAPIS = '#1d3c9a';
const LAPIS_D = '#0e1f5a';
const CARNELIAN = '#c4301c';
const TURQ = '#2aa6a0';

type Ctx = CanvasRenderingContext2D;

function canvas(w = PW, h = PH): [HTMLCanvasElement, Ctx] {
  const [c, ctx] = makeCanvas(w * PRES, h * PRES);
  ctx.scale(PRES, PRES);
  return [c, ctx];
}

const gold = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => lin(ctx, x0, y0, x1, y1, GOLD);

/* ------------------------------------------------------------------ shapes */

const NEMES = path((p) => {
  p.moveTo(200, 34);
  p.bezierCurveTo(288, 34, 320, 98, 322, 170);
  p.lineTo(358, 336);
  p.bezierCurveTo(360, 356, 346, 366, 328, 366);
  p.lineTo(72, 366);
  p.bezierCurveTo(54, 366, 40, 356, 42, 336);
  p.lineTo(78, 170);
  p.bezierCurveTo(80, 98, 112, 34, 200, 34);
  p.closePath();
});

const COLLAR = path((p) => {
  p.moveTo(26, 318);
  p.bezierCurveTo(30, 430, 120, 492, 200, 494);
  p.bezierCurveTo(280, 492, 370, 430, 374, 318);
  p.bezierCurveTo(330, 300, 300, 300, 270, 302);
  p.bezierCurveTo(250, 340, 150, 340, 130, 302);
  p.bezierCurveTo(100, 300, 70, 300, 26, 318);
  p.closePath();
});

const lappet = (s: number) =>
  path((p) => {
    const x = (v: number) => 200 + s * v;
    p.moveTo(x(70), 214);
    p.lineTo(x(104), 214);
    p.lineTo(x(110), 418);
    p.bezierCurveTo(x(104), 430, x(70), 430, x(64), 418);
    p.closePath();
  });

const FACE = path((p) => {
  p.moveTo(200, 116);
  p.bezierCurveTo(250, 116, 267, 152, 267, 200);
  p.bezierCurveTo(267, 256, 243, 296, 200, 302);
  p.bezierCurveTo(157, 296, 133, 256, 133, 200);
  p.bezierCurveTo(133, 152, 150, 116, 200, 116);
  p.closePath();
});

const CAVITY = path((p) => {
  p.moveTo(178, 266);
  p.bezierCurveTo(190, 271, 210, 271, 222, 266);
  p.bezierCurveTo(230, 284, 222, 302, 200, 305);
  p.bezierCurveTo(178, 302, 170, 284, 178, 266);
  p.closePath();
});

const CHIN = path((p) => {
  p.moveTo(175, 265);
  p.bezierCurveTo(188, 272, 212, 272, 225, 265);
  p.bezierCurveTo(232, 285, 224, 305, 200, 308);
  p.bezierCurveTo(176, 305, 168, 285, 175, 265);
  p.closePath();
});

const BEARD = path((p) => {
  p.moveTo(186, 300);
  p.lineTo(214, 300);
  p.lineTo(217, 372);
  p.bezierCurveTo(217, 384, 183, 384, 183, 372);
  p.closePath();
});

const HEADBAND = path((p) => {
  p.moveTo(134, 150);
  p.bezierCurveTo(160, 128, 240, 128, 266, 150);
  p.lineTo(266, 162);
  p.bezierCurveTo(240, 140, 160, 140, 134, 162);
  p.closePath();
});

const eyeShape = (s: number) =>
  path((p) => {
    const [ex, ey] = EYES[s > 0 ? 0 : 1];
    const o = 22 * s; // outer corner direction: toward the temple
    p.moveTo(ex - o, ey + 1);
    p.bezierCurveTo(ex - o * 0.5, ey - 12, ex + o * 0.55, ey - 11, ex + o * 0.95, ey + 1);
    p.bezierCurveTo(ex + o * 0.5, ey + 9, ex - o * 0.5, ey + 10, ex - o, ey + 1);
    p.closePath();
  });

const brow = (s: number) =>
  path((p) => {
    const x = (v: number) => 200 - s * v;
    p.moveTo(x(54), 186);
    p.bezierCurveTo(x(46), 168, x(16), 166, x(4), 176);
    p.lineTo(x(6), 182);
    p.bezierCurveTo(x(18), 174, x(44), 176, x(52), 192);
    p.closePath();
  });

const ear = (s: number) =>
  path((p) => {
    const cx = 200 + s * 70;
    p.ellipse(cx, 214, 11, 26, s * 0.12, 0, Math.PI * 2);
  });

/* ------------------------------------------------------------------ helpers */

function stripes(ctx: Ctx, clip: Path2D, y0: number, y1: number, step: number, bow: number, colors: string[]): void {
  ctx.save();
  ctx.clip(clip);
  let k = 0;
  for (let y = y0; y < y1; y += step, k++) {
    ctx.strokeStyle = colors[k % colors.length];
    ctx.lineWidth = step * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, y + bow);
    ctx.quadraticCurveTo(200, y - bow, 400, y + bow);
    ctx.stroke();
  }
  ctx.restore();
}

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

/* ------------------------------------------------------------------ painters */

export interface PharaohArt {
  body: HTMLCanvasElement;
  jaw: HTMLCanvasElement;
  cracks: HTMLCanvasElement;
  cracksGlow: HTMLCanvasElement;
  ring: HTMLCanvasElement;
  iris: HTMLCanvasElement;
}

function paintBody(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  // nemes, back silhouette
  piece(ctx, NEMES, {
    fill: gold(ctx, 60, 40, 340, 360),
    shadow: 'rgba(40,18,2,0.7)',
    shadowOff: [-26, -14],
    shadowSoft: 10,
    light: 'rgba(255,248,210,0.7)',
    lightOff: [14, 12],
    ao: 0.6,
    aoColor: '#1a0a02',
    ink: 3,
    detail: (x) => {
      stripes(x, NEMES, 40, 380, 17, 10, [LAPIS, 'rgba(0,0,0,0)']);
      // a sheen sweeping across the stripes (polished metal and glass)
      x.fillStyle = lin(x, 60, 60, 300, 300, [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,250,220,0.35)'], [0.42, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0)']]);
      x.fillRect(0, 0, PW, PH);
      // depth: darker toward the bottom and the sides
      x.fillStyle = lin(x, 0, 120, 0, 366, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(10,4,20,0.45)']]);
      x.fillRect(0, 0, PW, PH);
    },
  });
  // broad usekh collar: concentric bead rows
  piece(ctx, COLLAR, {
    fill: gold(ctx, 30, 300, 370, 494),
    shadow: 'rgba(30,12,2,0.65)',
    shadowOff: [-18, -20],
    shadowSoft: 8,
    ao: 0.5,
    aoColor: '#1a0a02',
    ink: 3,
    detail: (x) => {
      const rows = [LAPIS, '#e8b440', CARNELIAN, '#e8b440', TURQ, '#e8b440', LAPIS, '#e8b440', CARNELIAN];
      rows.forEach((col, i) => {
        const k = i / rows.length;
        x.strokeStyle = col;
        x.lineWidth = 9;
        x.beginPath();
        x.ellipse(200, 300, 92 + k * 168, 38 + k * 160, 0, 0.02 * Math.PI, 0.98 * Math.PI);
        x.stroke();
        // bead separators
        if (col !== '#e8b440') {
          x.strokeStyle = 'rgba(20,8,2,0.45)';
          x.lineWidth = 1.2;
          const rx = 92 + k * 168;
          const ry = 38 + k * 160;
          for (let a = 0.05; a < 0.96; a += 0.022 + (1 - k) * 0.02) {
            const t = a * Math.PI;
            const cx = 200 + Math.cos(t) * rx;
            const cy = 300 + Math.sin(t) * ry;
            x.beginPath();
            x.moveTo(cx - Math.cos(t) * 4.5, cy - Math.sin(t) * 4.5);
            x.lineTo(cx + Math.cos(t) * 4.5, cy + Math.sin(t) * 4.5);
            x.stroke();
          }
        }
      });
      // teardrop beads on the outer edge
      for (let a = 0.06; a < 0.95; a += 0.032) {
        const t = a * Math.PI;
        const cx = 200 + Math.cos(t) * 270;
        const cy = 300 + Math.sin(t) * 178;
        x.save();
        x.translate(cx, cy);
        x.rotate(t - Math.PI / 2);
        x.fillStyle = gold(x, -5, -6, 5, 10);
        x.beginPath();
        x.moveTo(0, -6);
        x.bezierCurveTo(7, 0, 5, 9, 0, 11);
        x.bezierCurveTo(-5, 9, -7, 0, 0, -6);
        x.fill();
        x.restore();
      }
      x.fillStyle = lin(x, 0, 300, 0, 494, [[0, 'rgba(0,0,0,0.4)'], [0.3, 'rgba(0,0,0,0)'], [1, 'rgba(10,4,20,0.45)']]);
      x.fillStyle = lin(x, 60, 330, 340, 470, [[0, 'rgba(255,255,255,0)'], [0.35, 'rgba(255,250,220,0.3)'], [0.45, 'rgba(255,255,255,0)']]);
      x.fillRect(0, 0, PW, PH);
      x.fillStyle = lin(x, 0, 300, 0, 494, [[0, 'rgba(0,0,0,0.4)'], [0.3, 'rgba(0,0,0,0)'], [1, 'rgba(10,4,20,0.45)']]);
      x.fillRect(0, 0, PW, PH);
    },
  });
  // front lappets of the nemes, falling over the collar
  for (const s of [-1, 1]) {
    const lp = lappet(s);
    piece(ctx, lp, {
      fill: gold(ctx, 200 + s * 60, 214, 200 + s * 110, 430),
      shadow: 'rgba(40,16,2,0.55)',
      shadowOff: [s * -8, -6],
      ink: 3,
      detail: (x) => stripes(x, lp, 214, 440, 15, 3, [LAPIS, 'rgba(0,0,0,0)']),
    });
  }
  // ears
  for (const s of [-1, 1]) piece(ctx, ear(s), { fill: gold(ctx, 190 + s * 60, 190, 210 + s * 80, 240), shadow: 'rgba(70,36,4,0.6)', shadowOff: [s * 5, -3], ink: 2.5 });
  // face
  piece(ctx, FACE, {
    fill: lin(ctx, 150, 120, 250, 300, [[0, '#fff0b8'], [0.3, '#f2c050'], [0.7, '#b77a18'], [1, '#6a3c08']]),
    shadow: 'rgba(80,36,4,0.7)',
    shadowOff: [-20, -12],
    shadowSoft: 10,
    light: 'rgba(255,252,230,0.75)',
    lightOff: [10, 10],
    ao: 0.55,
    aoColor: '#5a3006',
    ink: 3,
    detail: (x) => {
      // cheekbones and temples
      x.fillStyle = rad(x, 158, 236, 0, 40, [[0, 'rgba(255,240,190,0.35)'], [1, 'rgba(255,240,190,0)']]);
      x.fillRect(100, 180, 120, 120);
      x.fillStyle = rad(x, 200, 300, 0, 60, [[0, 'rgba(80,40,4,0.35)'], [1, 'rgba(80,40,4,0)']]);
      x.fillRect(120, 240, 160, 80);
    },
  });
  // nose: soft ridge with a shadowed flank, nostrils
  ctx.save();
  ctx.clip(FACE);
  ctx.fillStyle = 'rgba(110,60,8,0.45)';
  ctx.filter = 'blur(3px)';
  ctx.beginPath();
  ctx.moveTo(203, 196);
  ctx.bezierCurveTo(206, 214, 212, 232, 214, 244);
  ctx.bezierCurveTo(210, 249, 204, 250, 200, 248);
  ctx.bezierCurveTo(204, 230, 202, 214, 203, 196);
  ctx.fill();
  ctx.filter = 'none';
  ctx.restore();
  gloss(ctx, path((p) => (p.moveTo(197, 202), p.quadraticCurveTo(195, 224, 193, 238))), 2.5, 0.55);
  for (const s of [-1, 1]) {
    ctx.fillStyle = 'rgba(60,28,2,0.75)';
    ctx.beginPath();
    ctx.ellipse(200 + s * 7, 247, 4, 2.2, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // mouth cavity hidden under the jaw piece
  ctx.fillStyle = rad(ctx, 200, 280, 0, 34, [[0, '#2a0604'], [1, '#0c0202']]);
  ctx.fill(CAVITY);
  // upper lip
  const lip = path((p) => {
    p.moveTo(176, 265);
    p.bezierCurveTo(186, 257, 196, 258, 200, 261);
    p.bezierCurveTo(204, 258, 214, 257, 224, 265);
    p.bezierCurveTo(212, 268, 188, 268, 176, 265);
    p.closePath();
  });
  piece(ctx, lip, { fill: lin(ctx, 0, 256, 0, 268, [[0, '#e8a848'], [1, '#a86418']]), ink: 2 });
  // eyes: kohl-lined empty sockets, wings toward the temples
  for (const s of [1, -1]) {
    const e = eyeShape(s);
    const [ex, ey] = EYES[s > 0 ? 0 : 1];
    ctx.fillStyle = rad(ctx, ex, ey, 0, 22, [[0, '#2a0a06'], [1, '#080202']]);
    ctx.fill(e);
    ctx.save();
    ctx.strokeStyle = '#0a0606';
    ctx.lineWidth = 4.5;
    ctx.lineJoin = 'round';
    ctx.stroke(e);
    // kohl wing
    ctx.fillStyle = '#0a0606';
    ctx.beginPath();
    ctx.moveTo(ex - 22 * s, ey - 1);
    ctx.lineTo(ex - 46 * s, ey + 1);
    ctx.lineTo(ex - 44 * s, ey + 5);
    ctx.lineTo(ex - 20 * s, ey + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,236,170,0.55)';
    ctx.lineWidth = 1.6;
    ctx.translate(0, -5);
    ctx.stroke(e);
    ctx.restore();
    piece(ctx, brow(s), { fill: lin(ctx, 0, 166, 0, 192, [[0, '#3a62d0'], [1, LAPIS_D]]), ink: 2.5, detail: (x) => gloss(x, path((p) => (p.moveTo(200 - s * 46, 176), p.quadraticCurveTo(200 - s * 30, 168, 200 - s * 10, 174))), 1.5, 0.5) });
  }
  // headband and uraeus cobra
  piece(ctx, HEADBAND, { fill: gold(ctx, 130, 104, 270, 170), shadow: 'rgba(60,30,4,0.5)', shadowOff: [-6, -5], ink: 2.5 });
  const hood = path((p) => {
    p.moveTo(200, 74);
    p.bezierCurveTo(216, 80, 218, 108, 210, 130);
    p.lineTo(190, 130);
    p.bezierCurveTo(182, 108, 184, 80, 200, 74);
    p.closePath();
  });
  piece(ctx, hood, {
    fill: gold(ctx, 186, 74, 214, 130),
    shadow: 'rgba(60,30,4,0.55)',
    shadowOff: [-4, -4],
    ink: 2.5,
    detail: (x) => {
      x.fillStyle = LAPIS;
      x.beginPath();
      x.ellipse(200, 106, 6, 13, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = CARNELIAN;
      x.beginPath();
      x.ellipse(200, 106, 2.6, 7, 0, 0, Math.PI * 2);
      x.fill();
    },
  });
  piece(ctx, path((p) => p.ellipse(200, 72, 7, 9, 0, 0, Math.PI * 2)), { fill: gold(ctx, 193, 63, 207, 81), ink: 2.5 });
  // bright specular rim along the top of the nemes
  gloss(ctx, path((p) => (p.moveTo(120, 80), p.bezierCurveTo(150, 46, 200, 40, 230, 44))), 3, 0.45);
  // subtle wear
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const rnd = seeded(7);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(60,30,4,${0.05 + rnd() * 0.1})`;
    ctx.beginPath();
    ctx.arc(rnd() * PW, rnd() * PH, 0.6 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return c;
}

function paintJaw(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  piece(ctx, BEARD, {
    fill: gold(ctx, 183, 300, 217, 384),
    shadow: 'rgba(40,16,2,0.55)',
    shadowOff: [-5, 0],
    ink: 2.5,
    detail: (x) => {
      x.strokeStyle = LAPIS;
      x.lineWidth = 3.4;
      for (let y = 302; y < 384; y += 8) {
        x.beginPath();
        x.moveTo(182, y);
        x.lineTo(200, y + 5);
        x.lineTo(218, y);
        x.stroke();
      }
    },
  });
  piece(ctx, CHIN, {
    fill: lin(ctx, 170, 266, 230, 308, [[0, '#ffe7a4'], [0.5, '#e2a940'], [1, '#8a5610']]),
    shadow: 'rgba(100,54,6,0.55)',
    shadowOff: [-8, -8],
    shadowSoft: 4,
    ink: 2.5,
    detail: (x) => {
      // lower lip
      x.fillStyle = lin(x, 0, 266, 0, 278, [[0, '#c27a26'], [1, '#e8b050']]);
      x.beginPath();
      x.moveTo(180, 267);
      x.bezierCurveTo(190, 280, 210, 280, 220, 267);
      x.bezierCurveTo(210, 271, 190, 271, 180, 267);
      x.fill();
      gloss(x, path((p) => (p.moveTo(190, 288), p.quadraticCurveTo(200, 292, 210, 288))), 2, 0.4);
    },
  });
  return c;
}

function paintCracks(): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, ctx] = canvas();
  const [g, gctx] = canvas();
  const rnd = seeded(31);
  const seeds: [number, number, number, number][] = [
    [EYES[0][0] - 10, EYES[0][1] + 8, Math.PI * 0.62, 70],
    [EYES[1][0] + 10, EYES[1][1] + 8, Math.PI * 0.38, 70],
    [EYES[0][0] - 24, EYES[0][1], Math.PI * 1.1, 60],
    [EYES[1][0] + 24, EYES[1][1], -Math.PI * 0.1, 60],
    [200, 128, -Math.PI * 0.75, 90],
    [200, 128, -Math.PI * 0.25, 90],
    [200, 300, Math.PI * 0.7, 110],
    [200, 300, Math.PI * 0.3, 110],
    [110, 140, Math.PI * 0.55, 140],
    [290, 140, Math.PI * 0.45, 140],
  ];
  const all: [number, number][][] = [];
  for (const [x, y, a, l] of seeds) {
    ctx.strokeStyle = '#1a0202';
    crackLine(ctx, rnd, x, y, a, l, 4, 1, all);
  }
  // bright molten cores drawn along the same lines
  const strokeAll = (cx: Ctx, w: number, col: string) => {
    cx.strokeStyle = col;
    cx.lineCap = 'round';
    cx.lineJoin = 'round';
    for (const pts of all) {
      for (let i = 0; i < pts.length - 1; i++) {
        cx.lineWidth = Math.max(0.5, w * (1 - i / pts.length));
        cx.beginPath();
        cx.moveTo(pts[i][0], pts[i][1]);
        cx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        cx.stroke();
      }
    }
  };
  strokeAll(ctx, 2.4, '#ff3a24');
  strokeAll(ctx, 0.8, '#ffb894');
  gctx.filter = 'blur(5px)';
  strokeAll(gctx, 9, 'rgba(255,40,30,0.9)');
  gctx.filter = 'none';
  strokeAll(gctx, 3, 'rgba(255,90,60,1)');
  // keep the cracks on the mask
  const body = paintBodyMask();
  for (const x of [ctx, gctx]) {
    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(body, 0, 0);
    x.restore();
  }
  return [c, g];
}

function paintBodyMask(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#fff';
  ctx.fill(NEMES);
  ctx.fill(COLLAR);
  ctx.fill(FACE);
  return c;
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

function paintIris(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = rad(ctx, 32, 32, 0, 32, [
    [0, 'rgba(255,255,255,1)'],
    [0.22, 'rgba(255,250,220,1)'],
    [0.45, 'rgba(255,200,90,0.95)'],
    [0.75, 'rgba(255,140,40,0.35)'],
    [1, 'rgba(255,120,30,0)'],
  ]);
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

export function paintPharaoh(): PharaohArt {
  const [cracks, cracksGlow] = paintCracks();
  return { body: paintBody(), jaw: paintJaw(), cracks, cracksGlow, ring: paintRing(), iris: paintIris() };
}

