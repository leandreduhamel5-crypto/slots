import { makeCanvas } from './painters';

/**
 * Cleopatra, the side character: a waist-up portrait painted in layers so the rig can animate
 * each part — back hair, body with the broad collar, head (face, front hair, diadem with the
 * uraeus), eyes (whites, irises that look around, lids that blink), earrings that swing, the
 * arm holding a golden cobra staff, and the cobra's head and jaw. Every layer shares the same
 * CW×CH frame (painted at CRES×), so the rig only stacks them and sets pivots.
 */
export const CW = 580;
/** the figure sits right of the staff */
const BX = 56;
export const CH = 700;
export const CRES = 2;

/** pivots and anchor points in the frame */
const EYE0: [number, number][] = [
  [228, 212],
  [298, 212],
];
export const NECK: [number, number] = [262 + BX, 300];
export const EYES_C: [number, number][] = EYE0.map(([x, y]) => [x + BX, y]);
export const EARRINGS: [number, number][] = [
  [178 + BX, 262],
  [346 + BX, 262],
];
export const HAND: [number, number] = [92, 478];
/** the cobra head is drawn in its own small space (neck at 88,118) and enlarged onto the staff */
const COBRA_SCALE = 1.35;
const cobraPt = ([x, y]: [number, number]): [number, number] => [88 + (x - 88) * COBRA_SCALE, 150 + (y - 118) * COBRA_SCALE];
export const COBRA_NECK: [number, number] = [88, 150];
export const COBRA_EYE: [number, number] = cobraPt([58, 70]);
export const COBRA_MOUTH: [number, number] = cobraPt([32, 86]);
export const COBRA_HINGE: [number, number] = cobraPt([72, 84]);

type Ctx = CanvasRenderingContext2D;

function layer(): [HTMLCanvasElement, Ctx] {
  const [c, ctx] = makeCanvas(CW * CRES, CH * CRES);
  ctx.scale(CRES, CRES);
  return [c, ctx];
}

function lg(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function rg(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

const GOLD: [number, string][] = [
  [0, '#fff6cf'],
  [0.2, '#f6c95a'],
  [0.5, '#a86a14'],
  [0.75, '#f0bf58'],
  [1, '#5a3206'],
];
const gold = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => lg(ctx, x0, y0, x1, y1, GOLD);
const LAPIS = '#1d3e9e';
const CARNELIAN = '#c4301c';
const TURQ = '#2aa0a0';
const SKIN_HI = '#f4c79a';
const SKIN = '#d29468';
const SKIN_MID = '#b27048';
const SKIN_LO = '#7a4428';
const LINE = '#2a120a';

/**
 * Painted shape: base fill, a soft form shadow (the shape minus a copy shifted toward the
 * light, blurred), a rim light on the lit edge, and a fine dark outline.
 */
function shape(
  ctx: Ctx,
  p: Path2D,
  o: { fill: string | CanvasGradient; shade?: string; shadeOff?: [number, number]; shadeBlur?: number; rim?: string; rimOff?: [number, number]; line?: number; lineColor?: string; detail?: (c: Ctx) => void },
): void {
  const [t, tc] = makeCanvas(ctx.canvas.width, ctx.canvas.height);
  tc.setTransform(ctx.getTransform());
  tc.fillStyle = o.fill;
  tc.fill(p);
  tc.save();
  tc.clip(p);
  const cut = (col: string, off: [number, number], blur: number) => {
    const [s, sc] = makeCanvas(ctx.canvas.width, ctx.canvas.height);
    sc.setTransform(ctx.getTransform());
    sc.fillStyle = col;
    sc.fill(p);
    sc.globalCompositeOperation = 'destination-out';
    sc.translate(off[0], off[1]);
    sc.fillStyle = '#000';
    sc.fill(p);
    tc.save();
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.filter = `blur(${blur * CRES}px)`;
    tc.drawImage(s, 0, 0);
    tc.restore();
  };
  if (o.shade) cut(o.shade, o.shadeOff ?? [10, -8], o.shadeBlur ?? 6);
  if (o.rim) cut(o.rim, o.rimOff ?? [-3, 3], 1.2);
  o.detail?.(tc);
  tc.restore();
  if (o.line !== 0) {
    tc.strokeStyle = o.lineColor ?? LINE;
    tc.lineWidth = o.line ?? 1.6;
    tc.lineJoin = 'round';
    tc.stroke(p);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(t, 0, 0);
  ctx.restore();
}

/** Tapered capsule between two joints (a limb segment). */
function limb(a: [number, number], ra: number, b: [number, number], rb: number): Path2D {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ang = Math.atan2(dy, dx);
  const d = Math.hypot(dx, dy);
  const t = Math.acos((ra - rb) / d);
  const p = new Path2D();
  p.arc(a[0], a[1], ra, ang + t, ang - t + Math.PI * 2);
  p.arc(b[0], b[1], rb, ang - t, ang + t);
  p.closePath();
  return p;
}

function path(fn: (p: Path2D) => void): Path2D {
  const p = new Path2D();
  fn(p);
  return p;
}

/* ================================================================== parts */

function hairBack(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(BX, 0);
  // long black bob falling behind the shoulders, with gold-tipped braids
  const hair = path((p) => {
    p.moveTo(262, 66);
    p.bezierCurveTo(352, 64, 398, 126, 400, 210);
    p.lineTo(406, 372);
    p.bezierCurveTo(372, 388, 340, 386, 312, 380);
    p.lineTo(212, 380);
    p.bezierCurveTo(184, 386, 152, 388, 120, 372);
    p.lineTo(126, 210);
    p.bezierCurveTo(128, 126, 172, 64, 262, 66);
    p.closePath();
  });
  shape(ctx, hair, {
    fill: lg(ctx, 0, 60, 0, 390, [[0, '#2a2236'], [0.5, '#120c18'], [1, '#050308']]),
    shade: 'rgba(0,0,0,0.6)',
    shadeOff: [-14, 0],
    rim: 'rgba(140,150,220,0.35)',
    rimOff: [6, 4],
    line: 1.4,
    lineColor: '#050308',
    detail: (x) => {
      // fine braids: vertical strands with a soft sheen
      x.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const sx = 128 + i * 11;
        x.strokeStyle = i % 2 ? 'rgba(90,90,150,0.18)' : 'rgba(0,0,0,0.45)';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(sx, 150);
        x.quadraticCurveTo(sx + (i - 13) * 0.6, 260, sx + (i - 13) * 1.2, 384);
        x.stroke();
      }
      x.fillStyle = lg(x, 0, 120, 0, 240, [[0, 'rgba(160,170,255,0.18)'], [1, 'rgba(160,170,255,0)']]);
      x.fillRect(120, 100, 300, 160);
    },
  });
  // gold braid caps along the hem
  for (let i = 0; i < 24; i++) {
    const x = 132 + i * 11.5;
    const y = 372 + Math.sin(i * 0.9) * 3 + (Math.abs(i - 11.5) < 4 ? 8 : 0);
    ctx.fillStyle = gold(ctx, x - 4, y - 6, x + 4, y + 8);
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 4, 8, 13, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,4,0.8)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  return c;
}

function body(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(BX, 0);
  // shoulders and chest
  const torso = path((p) => {
    p.moveTo(232, 290);
    p.lineTo(292, 290);
    p.bezierCurveTo(296, 320, 300, 340, 330, 356);
    p.bezierCurveTo(390, 372, 438, 390, 452, 440);
    p.lineTo(470, 700);
    p.lineTo(54, 700);
    p.lineTo(72, 440);
    p.bezierCurveTo(86, 390, 134, 372, 194, 356);
    p.bezierCurveTo(224, 340, 228, 320, 232, 290);
    p.closePath();
  });
  shape(ctx, torso, {
    fill: lg(ctx, 120, 300, 400, 600, [[0, SKIN_HI], [0.35, SKIN], [0.8, SKIN_MID], [1, SKIN_LO]]),
    shade: 'rgba(90,40,20,0.55)',
    shadeOff: [-18, -6],
    shadeBlur: 10,
    rim: 'rgba(255,220,180,0.6)',
    rimOff: [5, 3],
    line: 1.4,
  });
  // neck shadow under the jaw
  ctx.save();
  ctx.clip(torso);
  ctx.fillStyle = rg(ctx, 262, 292, 4, 70, [[0, 'rgba(70,30,14,0.7)'], [1, 'rgba(70,30,14,0)']]);
  ctx.fillRect(180, 280, 170, 90);
  ctx.restore();
  // pleated linen dress with a gold-trimmed neckline
  const dress = path((p) => {
    p.moveTo(64, 470);
    p.bezierCurveTo(150, 520, 374, 520, 460, 470);
    p.lineTo(470, 700);
    p.lineTo(54, 700);
    p.closePath();
  });
  shape(ctx, dress, {
    fill: lg(ctx, 0, 470, 0, 700, [[0, '#d8cbb2'], [0.5, '#b8a586'], [1, '#7a6a52']]),
    shade: 'rgba(80,60,40,0.45)',
    shadeOff: [-16, 0],
    line: 1.2,
    detail: (x) => {
      x.strokeStyle = 'rgba(120,96,64,0.35)';
      x.lineWidth = 1.2;
      for (let i = 0; i < 30; i++) {
        const sx = 70 + i * 13.5;
        x.beginPath();
        x.moveTo(sx, 480 + Math.sin(((sx - 64) / 396) * Math.PI) * 34);
        x.lineTo(sx + (i - 15) * 1.6, 700);
        x.stroke();
      }
    },
  });
  // broad usekh collar: rows of lapis, gold, carnelian, turquoise beads, teardrop fringe
  const collar = path((p) => {
    p.moveTo(140, 368);
    p.bezierCurveTo(170, 352, 210, 344, 232, 340);
    p.bezierCurveTo(248, 356, 276, 356, 292, 340);
    p.bezierCurveTo(314, 344, 354, 352, 384, 368);
    p.bezierCurveTo(412, 420, 380, 488, 262, 506);
    p.bezierCurveTo(144, 488, 112, 420, 140, 368);
    p.closePath();
  });
  shape(ctx, collar, {
    fill: gold(ctx, 140, 340, 384, 506),
    shade: 'rgba(40,16,2,0.5)',
    shadeOff: [-12, -10],
    line: 1.4,
    lineColor: '#3a1a04',
    detail: (x) => {
      const rows = [LAPIS, '#e8b440', CARNELIAN, '#e8b440', TURQ, '#e8b440', LAPIS];
      rows.forEach((col, i) => {
        const k = i / rows.length;
        x.strokeStyle = col;
        x.lineWidth = 9;
        x.beginPath();
        x.ellipse(262, 330, 62 + k * 132, 30 + k * 150, 0, 0.06 * Math.PI, 0.94 * Math.PI);
        x.stroke();
        if (col !== '#e8b440') {
          x.strokeStyle = 'rgba(20,8,2,0.4)';
          x.lineWidth = 1;
          const rx = 62 + k * 132;
          const ry = 30 + k * 150;
          for (let a = 0.08; a < 0.92; a += 0.03 + (1 - k) * 0.03) {
            const t = a * Math.PI;
            const cx = 262 + Math.cos(t) * rx;
            const cy = 330 + Math.sin(t) * ry;
            x.beginPath();
            x.moveTo(cx - Math.cos(t) * 4.5, cy - Math.sin(t) * 4.5);
            x.lineTo(cx + Math.cos(t) * 4.5, cy + Math.sin(t) * 4.5);
            x.stroke();
          }
        }
      });
      x.fillStyle = lg(x, 140, 340, 384, 500, [[0, 'rgba(255,255,255,0)'], [0.35, 'rgba(255,250,225,0.3)'], [0.45, 'rgba(255,255,255,0)']]);
      x.fillRect(0, 0, CW, CH);
    },
  });
  // teardrop fringe
  for (let a = 0.1; a < 0.92; a += 0.04) {
    const t = a * Math.PI;
    const cx = 262 + Math.cos(t) * 146;
    const cy = 338 + Math.sin(t) * 166;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t - Math.PI / 2);
    ctx.fillStyle = gold(ctx, -4, -4, 4, 12);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(6, 0, 5, 9, 0, 11);
    ctx.bezierCurveTo(-5, 9, -6, 0, 0, -5);
    ctx.fill();
    ctx.restore();
  }
  // the figure dissolves into mist toward the bottom
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = lg(ctx, 0, 560, 0, 700, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
  ctx.fillRect(0, 560, CW, 140);
  ctx.restore();
  // central scarab pectoral
  const sc = path((p) => p.ellipse(262, 452, 17, 22, 0, 0, Math.PI * 2));
  shape(ctx, sc, { fill: rg(ctx, 256, 444, 2, 24, [[0, '#ff8a6a'], [0.5, CARNELIAN], [1, '#4a0804']]), line: 1.6, lineColor: '#3a1a04' });
  ctx.strokeStyle = gold(ctx, 240, 430, 284, 474);
  ctx.lineWidth = 3;
  ctx.stroke(sc);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(256, 442, 4, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function face(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(BX, 0);
  // ears (mostly hidden by hair) and face
  const faceP = path((p) => {
    p.moveTo(262, 120);
    p.bezierCurveTo(312, 120, 336, 156, 336, 206);
    p.bezierCurveTo(336, 252, 312, 290, 262, 306);
    p.bezierCurveTo(212, 290, 188, 252, 188, 206);
    p.bezierCurveTo(188, 156, 212, 120, 262, 120);
    p.closePath();
  });
  shape(ctx, faceP, {
    fill: lg(ctx, 200, 130, 330, 300, [[0, SKIN_HI], [0.4, SKIN], [1, SKIN_MID]]),
    shade: 'rgba(110,50,24,0.5)',
    shadeOff: [-14, -8],
    shadeBlur: 9,
    rim: 'rgba(255,224,190,0.55)',
    rimOff: [4, 4],
    line: 1.4,
    detail: (x) => {
      // cheek blush and soft cheekbone light
      x.fillStyle = rg(x, 222, 248, 2, 30, [[0, 'rgba(220,90,70,0.28)'], [1, 'rgba(220,90,70,0)']]);
      x.fillRect(180, 210, 90, 80);
      x.fillStyle = rg(x, 304, 248, 2, 28, [[0, 'rgba(220,90,70,0.22)'], [1, 'rgba(220,90,70,0)']]);
      x.fillRect(270, 210, 80, 80);
      x.fillStyle = rg(x, 236, 232, 2, 22, [[0, 'rgba(255,236,210,0.35)'], [1, 'rgba(255,236,210,0)']]);
      x.fillRect(200, 200, 80, 70);
      // under-brow shading
      x.fillStyle = 'rgba(110,50,24,0.18)';
      x.beginPath();
      x.ellipse(228, 204, 26, 10, 0, 0, Math.PI * 2);
      x.ellipse(298, 204, 26, 10, 0, 0, Math.PI * 2);
      x.fill();
    },
  });
  // nose: soft ridge light and nostril shadows
  ctx.save();
  ctx.filter = `blur(${2}px)`;
  ctx.fillStyle = 'rgba(120,56,28,0.45)';
  ctx.beginPath();
  ctx.moveTo(270, 214);
  ctx.bezierCurveTo(274, 236, 278, 252, 276, 262);
  ctx.bezierCurveTo(270, 266, 264, 266, 262, 264);
  ctx.bezierCurveTo(268, 248, 268, 232, 270, 214);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,236,210,0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(258, 218);
  ctx.quadraticCurveTo(256, 240, 256, 254);
  ctx.stroke();
  ctx.fillStyle = 'rgba(70,26,12,0.75)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(262 + sx * 8, 264, 4, 2.2, sx * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // lips: deep red, full, with a highlight
  const upper = path((p) => {
    p.moveTo(238, 282);
    p.bezierCurveTo(246, 274, 256, 272, 262, 277);
    p.bezierCurveTo(268, 272, 278, 274, 286, 282);
    p.bezierCurveTo(272, 285, 252, 285, 238, 282);
    p.closePath();
  });
  const lower = path((p) => {
    p.moveTo(240, 283);
    p.bezierCurveTo(252, 286, 272, 286, 284, 283);
    p.bezierCurveTo(278, 298, 246, 298, 240, 283);
    p.closePath();
  });
  shape(ctx, upper, { fill: lg(ctx, 0, 272, 0, 286, [[0, '#c8283a'], [1, '#7a0a1c']]), line: 1, lineColor: '#4a0610' });
  shape(ctx, lower, { fill: lg(ctx, 0, 283, 0, 298, [[0, '#a4162a'], [1, '#d23446']]), line: 1, lineColor: '#4a0610', detail: (x) => {
    x.fillStyle = 'rgba(255,230,230,0.6)';
    x.beginPath();
    x.ellipse(264, 290, 8, 2.4, 0, 0, Math.PI * 2);
    x.fill();
  } });
  ctx.strokeStyle = '#4a0610';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(240, 283);
  ctx.bezierCurveTo(252, 286, 272, 286, 284, 283);
  ctx.stroke();
  // eyebrows: long elegant arches
  for (const s of [-1, 1]) {
    const cx = 262 + s * 36;
    ctx.fillStyle = '#1a0c10';
    ctx.beginPath();
    ctx.moveTo(cx - s * 26, 196);
    ctx.bezierCurveTo(cx - s * 12, 182, cx + s * 14, 180, cx + s * 34, 192);
    ctx.bezierCurveTo(cx + s * 14, 186, cx - s * 10, 188, cx - s * 26, 199);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Eye sockets: lapis eyeshadow, whites and the kohl liner with its famous wing. */
function eyesBase(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(BX, 0);
  for (const [i, [ex, ey]] of EYE0.entries()) {
    const s = i === 0 ? -1 : 1; // outer corner direction
    // lapis eyeshadow up to the brow
    ctx.save();
    ctx.filter = 'blur(3px)';
    ctx.fillStyle = 'rgba(40,90,200,0.55)';
    ctx.beginPath();
    ctx.ellipse(ex + s * 4, ey - 9, 24, 11, s * -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // gold shimmer on the lid
    ctx.fillStyle = 'rgba(255,220,140,0.35)';
    ctx.beginPath();
    ctx.ellipse(ex, ey - 7, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const almond = path((p) => {
      p.moveTo(ex - s * 20, ey + 2);
      p.bezierCurveTo(ex - s * 8, ey - 10, ex + s * 10, ey - 10, ex + s * 20, ey);
      p.bezierCurveTo(ex + s * 8, ey + 8, ex - s * 8, ey + 8, ex - s * 20, ey + 2);
      p.closePath();
    });
    ctx.fillStyle = lg(ctx, 0, ey - 8, 0, ey + 8, [[0, '#d8ccc0'], [0.4, '#fbf6ee'], [1, '#e8dccc']]);
    ctx.fill(almond);
    // kohl: thick upper line ending in a long wing, thinner lower line
    ctx.fillStyle = '#0c0608';
    ctx.beginPath();
    ctx.moveTo(ex - s * 22, ey + 3);
    ctx.bezierCurveTo(ex - s * 8, ey - 13, ex + s * 12, ey - 13, ex + s * 22, ey - 1);
    ctx.lineTo(ex + s * 40, ey - 9);
    ctx.lineTo(ex + s * 24, ey + 2);
    ctx.bezierCurveTo(ex + s * 10, ey - 7, ex - s * 8, ey - 7, ex - s * 22, ey + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0c0608';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ex - s * 20, ey + 3);
    ctx.bezierCurveTo(ex - s * 8, ey + 9, ex + s * 10, ey + 8, ex + s * 22, ey + 1);
    ctx.lineTo(ex + s * 32, ey + 4);
    ctx.stroke();
  }
  return c;
}

/** Iris + pupil + catchlight, centred on each eye; the rig moves this layer to look around. */
function irises(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(BX, 0);
  for (const [ex, ey] of EYE0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey - 1, 8, 0, Math.PI * 2);
    ctx.fillStyle = rg(ctx, ex, ey - 1, 1, 8, [[0, '#f6c040'], [0.55, '#b0681a'], [1, '#3a1a06']]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex, ey - 1, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = '#080404';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - 2.6, ey - 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

/** Closed lids (shown for a blink). */
function lids(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(BX, 0);
  for (const [i, [ex, ey]] of EYE0.entries()) {
    const s = i === 0 ? -1 : 1;
    const lid = path((p) => {
      p.moveTo(ex - s * 22, ey + 3);
      p.bezierCurveTo(ex - s * 8, ey - 13, ex + s * 12, ey - 13, ex + s * 22, ey - 1);
      p.bezierCurveTo(ex + s * 10, ey + 9, ex - s * 8, ey + 9, ex - s * 22, ey + 3);
      p.closePath();
    });
    ctx.fillStyle = lg(ctx, 0, ey - 12, 0, ey + 8, [[0, '#4a70c8'], [0.6, SKIN_MID], [1, SKIN]]);
    ctx.fill(lid);
    ctx.strokeStyle = '#0c0608';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - s * 22, ey + 4);
    ctx.bezierCurveTo(ex - s * 8, ey + 8, ex + s * 10, ey + 8, ex + s * 24, ey + 1);
    ctx.lineTo(ex + s * 40, ey - 9);
    ctx.stroke();
  }
  return c;
}

/** Front hair (blunt bangs and side curtains) and the gold diadem with the rearing uraeus. */
function hairFront(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(BX, 0);
  const hair = path((p) => {
    p.moveTo(262, 70);
    p.bezierCurveTo(342, 70, 384, 120, 388, 196);
    p.lineTo(392, 352);
    p.lineTo(346, 352);
    p.bezierCurveTo(340, 300, 338, 230, 334, 170);
    p.lineTo(190, 170);
    p.bezierCurveTo(186, 230, 184, 300, 178, 352);
    p.lineTo(132, 352);
    p.lineTo(136, 196);
    p.bezierCurveTo(140, 120, 182, 70, 262, 70);
    p.closePath();
  });
  shape(ctx, hair, {
    fill: lg(ctx, 0, 70, 0, 352, [[0, '#2e2640'], [0.45, '#150e1c'], [1, '#07040a']]),
    shade: 'rgba(0,0,0,0.55)',
    shadeOff: [-10, -4],
    rim: 'rgba(150,160,235,0.4)',
    rimOff: [5, 3],
    line: 1.4,
    lineColor: '#050308',
    detail: (x) => {
      x.lineCap = 'round';
      // braided strands
      for (let i = 0; i < 30; i++) {
        const sx = 136 + i * 8.6;
        if (sx > 190 && sx < 334) {
          // bangs: short vertical strands
          x.strokeStyle = i % 2 ? 'rgba(110,110,170,0.22)' : 'rgba(0,0,0,0.5)';
          x.lineWidth = 2.6;
          x.beginPath();
          x.moveTo(sx, 96);
          x.lineTo(sx, 170);
          x.stroke();
        } else {
          x.strokeStyle = i % 2 ? 'rgba(110,110,170,0.2)' : 'rgba(0,0,0,0.5)';
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(sx, 140);
          x.lineTo(sx, 352);
          x.stroke();
        }
      }
      // glossy band across the crown
      x.fillStyle = lg(x, 0, 80, 0, 140, [[0, 'rgba(170,180,255,0.3)'], [1, 'rgba(170,180,255,0)']]);
      x.beginPath();
      x.ellipse(262, 104, 110, 26, 0, 0, Math.PI * 2);
      x.fill();
    },
  });
  // bangs' blunt edge shadow on the forehead
  ctx.save();
  ctx.filter = 'blur(4px)';
  ctx.fillStyle = 'rgba(60,24,10,0.45)';
  ctx.fillRect(194, 170, 136, 8);
  ctx.restore();
  // gold side tubes on the hair curtains
  for (const x0 of [155, 369]) {
    for (let k = 0; k < 3; k++) {
      const y = 250 + k * 34;
      ctx.fillStyle = gold(ctx, x0 - 14, y, x0 + 14, y + 10);
      ctx.beginPath();
      ctx.roundRect(x0 - 16, y, 32, 9, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,4,0.8)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  // diadem band
  const band = path((p) => {
    p.moveTo(140, 150);
    p.bezierCurveTo(180, 120, 344, 120, 384, 150);
    p.lineTo(384, 164);
    p.bezierCurveTo(344, 136, 180, 136, 140, 164);
    p.closePath();
  });
  shape(ctx, band, {
    fill: gold(ctx, 140, 120, 384, 164),
    shade: 'rgba(60,30,4,0.5)',
    shadeOff: [-6, -4],
    line: 1.2,
    lineColor: '#3a1a04',
    detail: (x) => {
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        const px = 152 + t * 220;
        const py = 147 - Math.sin(t * Math.PI) * 18;
        x.fillStyle = i % 3 === 0 ? CARNELIAN : i % 3 === 1 ? LAPIS : TURQ;
        x.beginPath();
        x.ellipse(px, py, 4, 3, 0, 0, Math.PI * 2);
        x.fill();
      }
    },
  });
  // uraeus: rearing cobra on the brow
  const hood = path((p) => {
    p.moveTo(262, 66);
    p.bezierCurveTo(284, 72, 286, 104, 274, 132);
    p.lineTo(250, 132);
    p.bezierCurveTo(238, 104, 240, 72, 262, 66);
    p.closePath();
  });
  shape(ctx, hood, {
    fill: gold(ctx, 240, 66, 286, 132),
    shade: 'rgba(60,30,4,0.55)',
    shadeOff: [-5, -3],
    line: 1.2,
    lineColor: '#3a1a04',
    detail: (x) => {
      x.fillStyle = LAPIS;
      x.beginPath();
      x.ellipse(262, 100, 8, 18, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = CARNELIAN;
      x.beginPath();
      x.ellipse(262, 100, 3.5, 10, 0, 0, Math.PI * 2);
      x.fill();
    },
  });
  shape(ctx, path((p) => p.ellipse(262, 62, 8, 11, 0, 0, Math.PI * 2)), { fill: gold(ctx, 254, 51, 270, 73), line: 1.2, lineColor: '#3a1a04' });
  // sun disc behind the cobra's head
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = rg(ctx, 262, 50, 2, 26, [[0, '#ffe080'], [0.6, '#f0a020'], [1, '#8a4a08']]);
  ctx.beginPath();
  ctx.arc(262, 50, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return c;
}

/** One earring (gold hoop + carnelian drop), centred on its hook so it can swing. */
function earring(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40 * CRES, 70 * CRES);
  ctx.scale(CRES, CRES);
  ctx.strokeStyle = gold(ctx, 6, 0, 34, 40);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(20, 18, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rg(ctx, 18, 48, 1, 12, [[0, '#ff9070'], [0.5, CARNELIAN], [1, '#4a0804']]);
  ctx.beginPath();
  ctx.moveTo(20, 32);
  ctx.bezierCurveTo(30, 42, 30, 58, 20, 62);
  ctx.bezierCurveTo(10, 58, 10, 42, 20, 32);
  ctx.fill();
  ctx.strokeStyle = gold(ctx, 10, 32, 30, 62);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(17, 44, 2, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** The golden staff rod (below the cobra's neck). */
function staff(): HTMLCanvasElement {
  const [c, ctx] = layer();
  const rod = path((p) => {
    p.moveTo(82, 150);
    p.lineTo(96, 150);
    p.lineTo(100, 700);
    p.lineTo(80, 700);
    p.closePath();
  });
  shape(ctx, rod, {
    fill: lg(ctx, 80, 0, 100, 0, [[0, '#6a3a06'], [0.3, '#ffe48a'], [0.55, '#d89a2a'], [1, '#5a3006']]),
    line: 1.2,
    lineColor: '#3a1a04',
  });
  // the cobra's body coiling down the rod
  ctx.lineCap = 'round';
  const coil: [number, number][] = [];
  for (let y = 160; y < 430; y += 4) coil.push([90 + Math.sin((y - 160) * 0.05) * 18, y]);
  const strokeCoil = (w: number, col: string | CanvasGradient) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    coil.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  strokeCoil(16, '#3a1a04');
  strokeCoil(13, gold(ctx, 70, 130, 110, 420));
  ctx.strokeStyle = 'rgba(30,60,160,0.85)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  coil.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
  // rings
  for (const y of [440, 560, 660]) {
    shape(ctx, path((p) => p.roundRect(76, y, 28, 14, 5)), { fill: gold(ctx, 76, y, 104, y + 14), line: 1, lineColor: '#3a1a04' });
  }
  return c;
}

/** Cobra head with spread hood (pivot at COBRA_NECK), facing left toward the reels. */
function cobraHead(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(88, 150);
  ctx.scale(COBRA_SCALE, COBRA_SCALE);
  ctx.translate(-88, -118);
  const hood = path((p) => {
    p.moveTo(88, 128);
    p.bezierCurveTo(60, 120, 48, 70, 70, 36);
    p.bezierCurveTo(92, 20, 128, 34, 130, 70);
    p.bezierCurveTo(130, 100, 112, 124, 96, 132);
    p.closePath();
  });
  shape(ctx, hood, {
    fill: gold(ctx, 50, 30, 130, 132),
    shade: 'rgba(60,30,4,0.55)',
    shadeOff: [-8, -4],
    line: 1.4,
    lineColor: '#3a1a04',
    detail: (x) => {
      // inlaid hood markings
      x.fillStyle = LAPIS;
      x.beginPath();
      x.ellipse(92, 82, 14, 30, 0.1, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = CARNELIAN;
      x.beginPath();
      x.ellipse(92, 82, 6, 18, 0.1, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = 'rgba(255,240,200,0.6)';
      x.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        x.beginPath();
        x.moveTo(70 + i * 9, 50 + i * 2);
        x.lineTo(74 + i * 9, 116);
        x.stroke();
      }
    },
  });
  // head and snout, pointing left
  const head = path((p) => {
    p.moveTo(84, 54);
    p.bezierCurveTo(70, 44, 44, 52, 26, 70);
    p.bezierCurveTo(22, 78, 28, 84, 38, 82);
    p.lineTo(70, 82);
    p.bezierCurveTo(84, 82, 92, 66, 84, 54);
    p.closePath();
  });
  shape(ctx, head, {
    fill: gold(ctx, 24, 48, 92, 84),
    shade: 'rgba(60,30,4,0.5)',
    shadeOff: [-4, -4],
    rim: 'rgba(255,250,220,0.7)',
    rimOff: [0, 3],
    line: 1.4,
    lineColor: '#3a1a04',
    detail: (x) => {
      x.strokeStyle = 'rgba(60,30,4,0.6)';
      x.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        x.beginPath();
        x.moveTo(40 + i * 9, 60 - i);
        x.lineTo(44 + i * 9, 78);
        x.stroke();
      }
    },
  });
  // eye socket (the glowing eye is live)
  ctx.fillStyle = '#1a0204';
  ctx.beginPath();
  ctx.ellipse(58, 70, 5.5, 3.6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Lower jaw with fangs (pivot near the hinge so it can open). */
function cobraJaw(): HTMLCanvasElement {
  const [c, ctx] = layer();
  ctx.translate(88, 150);
  ctx.scale(COBRA_SCALE, COBRA_SCALE);
  ctx.translate(-88, -118);
  const jaw = path((p) => {
    p.moveTo(70, 82);
    p.lineTo(38, 82);
    p.bezierCurveTo(30, 84, 30, 92, 40, 94);
    p.bezierCurveTo(56, 96, 70, 92, 74, 86);
    p.closePath();
  });
  shape(ctx, jaw, { fill: gold(ctx, 30, 82, 74, 96), shade: 'rgba(60,30,4,0.5)', shadeOff: [-3, -3], line: 1.2, lineColor: '#3a1a04' });
  // mouth interior and fangs (seen when open)
  ctx.fillStyle = '#5a0410';
  ctx.beginPath();
  ctx.moveTo(40, 82);
  ctx.lineTo(66, 82);
  ctx.lineTo(60, 86);
  ctx.lineTo(42, 86);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6e0';
  for (const fx of [40, 48]) {
    ctx.beginPath();
    ctx.moveTo(fx, 81);
    ctx.lineTo(fx + 3, 81);
    ctx.lineTo(fx + 1.5, 74);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Arm reaching to the staff, with the hand wrapped around it and gold armbands. */
function arm(): HTMLCanvasElement {
  const [c, ctx] = layer();
  const skinFill = lg(ctx, 100, 380, 200, 600, [[0, SKIN_HI], [0.45, SKIN], [1, SKIN_MID]]);
  const upper = limb([150, 412], 29, [122, 568], 20);
  shape(ctx, upper, { fill: skinFill, shade: 'rgba(100,44,20,0.5)', shadeOff: [-10, -4], rim: 'rgba(255,224,190,0.6)', rimOff: [4, 2], line: 1.4 });
  const fore = limb([122, 568], 19, [100, 494], 13);
  shape(ctx, fore, { fill: skinFill, shade: 'rgba(100,44,20,0.55)', shadeOff: [-8, 4], rim: 'rgba(255,224,190,0.6)', rimOff: [3, 3], line: 1.4 });
  // armband
  shape(ctx, path((p) => {
    p.moveTo(116, 456);
    p.bezierCurveTo(134, 450, 156, 452, 172, 460);
    p.lineTo(170, 476);
    p.bezierCurveTo(154, 468, 134, 466, 114, 472);
    p.closePath();
  }), { fill: gold(ctx, 114, 450, 172, 476), line: 1, lineColor: '#3a1a04', detail: (x) => {
    x.fillStyle = LAPIS;
    x.beginPath();
    x.ellipse(143, 462, 6, 4, 0, 0, Math.PI * 2);
    x.fill();
  } });
  // hand gripping the staff: fingers wrap over the rod
  const hand = path((p) => {
    p.moveTo(104, 462);
    p.bezierCurveTo(90, 456, 74, 462, 72, 476);
    p.bezierCurveTo(70, 492, 78, 504, 94, 506);
    p.bezierCurveTo(108, 506, 122, 498, 122, 484);
    p.bezierCurveTo(122, 472, 114, 464, 104, 462);
    p.closePath();
  });
  shape(ctx, hand, {
    fill: lg(ctx, 70, 460, 122, 506, [[0, SKIN_HI], [0.5, SKIN], [1, SKIN_MID]]),
    shade: 'rgba(100,44,20,0.5)',
    shadeOff: [-6, -4],
    line: 1.3,
  });
  ctx.strokeStyle = 'rgba(90,40,20,0.7)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(76 + i * 2, 474 + i * 9);
    ctx.quadraticCurveTo(92, 470 + i * 9, 108, 476 + i * 9);
    ctx.stroke();
  }
  // bracelet
  shape(ctx, limb([104, 500], 14, [116, 522], 14), { fill: gold(ctx, 94, 490, 130, 530), line: 1, lineColor: '#3a1a04' });
  return c;
}

/** Molten cracks spreading over a layer (clipped to it): [core, glow]. */
export function paintCracksOver(target: HTMLCanvasElement, seeds: [number, number, number, number][], seed: number): [HTMLCanvasElement, HTMLCanvasElement] {
  const w = target.width;
  const h = target.height;
  let st = seed;
  const rnd = () => ((st = (st * 16807) % 2147483647) / 2147483647);
  const lines: [number, number][][] = [];
  const grow = (x: number, y: number, a: number, len: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    for (let i = 0; i < 8; i++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * (len / 8);
      y += Math.sin(a) * (len / 8);
      pts.push([x, y]);
    }
    lines.push(pts);
    if (depth > 0) for (let k = 0; k < 2; k++) {
      const q = pts[2 + Math.floor(rnd() * 5)];
      grow(q[0], q[1], a + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.5, depth - 1);
    }
  };
  for (const [x, y, a, l] of seeds) grow(x * CRES, y * CRES, a, l * CRES, 2);
  const stroke = (ctx: Ctx, wd: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pts of lines) {
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.lineWidth = Math.max(0.8, wd * CRES * (1 - i / pts.length));
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
    }
  };
  const [core, cc] = makeCanvas(w, h);
  stroke(cc, 3.2, 'rgba(40,0,2,0.9)');
  stroke(cc, 1.8, '#ff3a24');
  stroke(cc, 0.7, '#ffd0a0');
  const [sharp, sc] = makeCanvas(w, h);
  stroke(sc, 8, 'rgba(255,40,30,0.9)');
  const [glow, gc] = makeCanvas(w, h);
  gc.filter = `blur(${5 * CRES}px)`;
  gc.drawImage(sharp, 0, 0);
  for (const ctx of [cc, gc]) {
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(target, 0, 0);
  }
  return [core, glow];
}

export interface CleopatraArt {
  hairBack: HTMLCanvasElement;
  body: HTMLCanvasElement;
  face: HTMLCanvasElement;
  eyes: HTMLCanvasElement;
  irises: HTMLCanvasElement;
  lids: HTMLCanvasElement;
  hairFront: HTMLCanvasElement;
  earring: HTMLCanvasElement;
  staff: HTMLCanvasElement;
  cobraHead: HTMLCanvasElement;
  cobraJaw: HTMLCanvasElement;
  arm: HTMLCanvasElement;
  /** everything flattened (for the aura silhouette and the floor reflection) */
  flat: HTMLCanvasElement;
}

export function paintCleopatra(): CleopatraArt {
  const parts = {
    hairBack: hairBack(),
    body: body(),
    face: face(),
    eyes: eyesBase(),
    irises: irises(),
    lids: lids(),
    hairFront: hairFront(),
    earring: earring(),
    staff: staff(),
    cobraHead: cobraHead(),
    cobraJaw: cobraJaw(),
    arm: arm(),
  };
  const [flat, f] = makeCanvas(CW * CRES, CH * CRES);
  for (const k of ['hairBack', 'body', 'face', 'eyes', 'irises', 'hairFront', 'staff', 'cobraHead', 'cobraJaw', 'arm'] as const) f.drawImage(parts[k], 0, 0);
  return { ...parts, flat };
}
