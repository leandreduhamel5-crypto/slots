import { INK, seeded } from './painters';
import { dot, drip, gloss, grunge, groundShadow, layer, lin, line, path, piece, rad } from './paint';
import type { PaintedSymbol } from './premium';

/* ================================================================== shared helpers */

/** Additive light spill (e.g. a glowing eye lighting the surface around it), optionally clipped. */
function spill(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number, clip?: Path2D): void {
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Raised bevel along a path: light edge toward the top-left, dark edge toward the bottom-right. */
function emboss(ctx: CanvasRenderingContext2D, p: Path2D, w: number, light = 'rgba(255,200,200,0.45)', dark = 'rgba(20,0,8,0.6)'): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(-w * 0.35, -w * 0.35);
  ctx.strokeStyle = light;
  ctx.lineWidth = w;
  ctx.stroke(p);
  ctx.translate(w * 0.7, w * 0.7);
  ctx.strokeStyle = dark;
  ctx.stroke(p);
  ctx.restore();
}

/** A curved, tapered tooth from a base segment to a tip. */
function fang(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, tx: number, ty: number, bend: number): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const p = path((q) => {
    q.moveTo(x0, y0);
    q.quadraticCurveTo(mx + (tx - mx) * 0.4 - bend, my + (ty - my) * 0.6, tx, ty);
    q.quadraticCurveTo(mx + (tx - mx) * 0.5 + bend * 0.4, my + (ty - my) * 0.45, x1, y1);
    q.closePath();
  });
  piece(ctx, p, {
    fill: lin(ctx, mx, my, tx, ty, [[0, '#d9c4a0'], [0.45, '#fff6e2'], [1, '#fffdf6']]),
    shadow: 'rgba(120,80,60,0.55)',
    shadowOff: [3, 0],
    ink: 3,
  });
}

/** Organic tapered vein bulging under a surface: shadow below, dark body, glowing core, highlight. */
function vein(ctx: CanvasRenderingContext2D, pts: [number, number][], w0: number, glow = true): void {
  const seg = (fn: (i: number, w: number) => void) => {
    for (let i = 0; i < pts.length - 1; i++) fn(i, w0 * (1 - (i / (pts.length - 1)) * 0.85));
  };
  const stroke = (color: string, scale: number, dx = 0, dy = 0, blur = 0) => {
    ctx.save();
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    seg((i, w) => {
      ctx.lineWidth = w * scale;
      ctx.beginPath();
      ctx.moveTo(pts[i][0] + dx, pts[i][1] + dy);
      ctx.lineTo(pts[i + 1][0] + dx, pts[i + 1][1] + dy);
      ctx.stroke();
    });
    ctx.restore();
  };
  stroke('rgba(20,0,8,0.55)', 1.5, 3, 4, 3);
  if (glow) stroke('rgba(255,50,70,0.5)', 2.6, 0, 0, 6);
  stroke('#3a0414', 1.25);
  stroke('#a8102e', 1);
  if (glow) stroke('#ff3a50', 0.45);
  stroke('rgba(255,190,200,0.75)', 0.22, -w0 * 0.22, -w0 * 0.22);
}

/** Wiggly branch generator for veins. */
function branch(x: number, y: number, ang: number, len: number, seed: number, n = 10): [number, number][] {
  const rnd = seeded(seed);
  const out: [number, number][] = [[x, y]];
  let a = ang;
  for (let i = 1; i <= n; i++) {
    a += (rnd() - 0.5) * 0.55;
    x += Math.cos(a) * (len / n);
    y += Math.sin(a) * (len / n);
    out.push([x, y]);
  }
  return out;
}

/* ================================================================== CODEX INFECTA (wild / scatter) */

const CW = 324;
const CH = 404;
/** cover space → screen: slight 3/4 turn; the eye (CW/2, EYE_V) lands on the canvas centre for the blink rig */
const EYE_V = 190;
/** the eye group is drawn 15 % larger around its centre */
const EK = 1.15;
const eyeSpace = (ctx: CanvasRenderingContext2D) => {
  ctx.translate(CW / 2, EYE_V);
  ctx.scale(EK, EK);
  ctx.translate(-CW / 2, -EYE_V);
};
const M = { a: 0.95, b: -0.07, c: 0.09, d: 0.97 };
const E = 256 - (M.a * (CW / 2) + M.c * EYE_V);
const F = 256 - (M.b * (CW / 2) + M.d * EYE_V);
const cover = (ctx: CanvasRenderingContext2D, dx = 0, dy = 0) => ctx.setTransform(M.a, M.b, M.c, M.d, E + dx, F + dy);
const toScreen = (u: number, v: number): [number, number] => [M.a * u + M.c * v + E, M.b * u + M.d * v + F];
const DEPTH: [number, number] = [20, 17];

function filigree(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number): void {
  // ornate gold corner: plate + scroll curls + a ruby
  const plate = path((q) => {
    q.moveTo(x, y);
    q.lineTo(x + sx * 84, y);
    q.bezierCurveTo(x + sx * 70, y + sy * 14, x + sx * 52, y + sy * 18, x + sx * 40, y + sy * 26);
    q.bezierCurveTo(x + sx * 30, y + sy * 34, x + sx * 22, y + sy * 52, x + sx * 14, y + sy * 70);
    q.bezierCurveTo(x + sx * 8, y + sy * 78, x, y + sy * 84, x, y + sy * 84);
    q.closePath();
  });
  piece(ctx, plate, {
    fill: lin(ctx, x, y, x + sx * 84, y + sy * 84, [[0, '#fff4c0'], [0.3, '#f2c04a'], [0.65, '#b8801c'], [1, '#6a4206']]),
    shadow: 'rgba(90,50,0,0.6)',
    shadowOff: [-sx * 7, -sy * 7],
    light: 'rgba(255,250,220,0.9)',
    lightOff: [sx * 4, sy * 4],
    ink: 5,
    detail: (d) => grunge(d, 61, { color: '#5a3606', count: 30, size: [0.5, 1.6], alpha: 0.5, area: [x - 90, y - 90, 180, 180] }),
  });
  // scroll curls engraved
  ctx.save();
  ctx.lineCap = 'round';
  for (const [r, cx, cy] of [[10, x + sx * 30, y + sy * 14], [8, x + sx * 14, y + sy * 34]] as const) {
    ctx.strokeStyle = 'rgba(80,40,0,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 1, r, Math.PI, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.restore();
  const gx = x + sx * 22;
  const gy = y + sy * 22;
  piece(ctx, path((q) => q.arc(gx, gy, 9, 0, Math.PI * 2)), {
    fill: rad(ctx, gx - 3, gy - 3, 1, 10, [[0, '#ffd0d8'], [0.4, '#ff2a44'], [1, '#5a0010']]),
    ink: 3.5,
  });
  dot(ctx, gx - 3, gy - 3, 2.5, '#fff');
}

export function paintCodex(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  const [irisC, ictx] = layer();
  const [lidC, lctx] = layer();
  groundShadow(ctx, 268, 482, 165, 18, 0.55);

  const coverShape = path((q) => q.roundRect(0, 0, CW, CH, [14, 22, 22, 14]));

  // ---- back board and page block (seen past the right and bottom edges)
  cover(ctx, DEPTH[0], DEPTH[1]);
  piece(ctx, coverShape, { fill: '#3a0614', ink: 9 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const [tr, br, bl] = [toScreen(CW - 6, 10), toScreen(CW - 6, CH - 8), toScreen(14, CH - 6)];
  const pageSide = path((q) => {
    q.moveTo(tr[0], tr[1]);
    q.lineTo(tr[0] + DEPTH[0] - 3, tr[1] + DEPTH[1] - 2);
    q.lineTo(br[0] + DEPTH[0] - 3, br[1] + DEPTH[1] - 3);
    q.lineTo(br[0], br[1]);
    q.closePath();
  });
  const pageBottom = path((q) => {
    q.moveTo(bl[0], bl[1]);
    q.lineTo(br[0], br[1]);
    q.lineTo(br[0] + DEPTH[0] - 3, br[1] + DEPTH[1] - 3);
    q.lineTo(bl[0] + DEPTH[0] - 3, bl[1] + DEPTH[1] - 3);
    q.closePath();
  });
  for (const [p, a0, a1] of [[pageSide, tr, br], [pageBottom, bl, br]] as const) {
    piece(ctx, p, {
      // gilded page edges
      fill: lin(ctx, a0[0], a0[1], a1[0] + 20, a1[1] + 20, [[0, '#fff0b0'], [0.4, '#e8b240'], [1, '#8a5a10']]),
      ink: 4,
      detail: (d) => {
        d.strokeStyle = 'rgba(110,70,10,0.55)';
        d.lineWidth = 1.2;
        for (let k = 1; k < 7; k++) {
          const t = k / 7;
          d.beginPath();
          d.moveTo(a0[0] + (DEPTH[0] - 3) * t, a0[1] + (DEPTH[1] - 3) * t);
          d.lineTo(a1[0] + (DEPTH[0] - 3) * t, a1[1] + (DEPTH[1] - 3) * t);
          d.stroke();
        }
      },
    });
  }

  // ---- clasp strap wrapping from the back over the right edge
  cover(ctx);
  const strapBack = path((q) => q.roundRect(CW - 18, CH * 0.44, 46, 54, 8));
  piece(ctx, strapBack, { fill: lin(ctx, 0, CH * 0.44, 0, CH * 0.44 + 54, [[0, '#5a3218'], [1, '#2a1408']]), ink: 6 });

  // ---- front cover: tooled crimson leather
  piece(ctx, coverShape, {
    fill: rad(ctx, CW * 0.3, CH * 0.22, 20, CH * 0.95, [[0, '#c02248'], [0.35, '#8a1232'], [0.75, '#560820'], [1, '#300312']]),
    shadow: 'rgba(40,0,12,0.55)',
    shadowOff: [-26, -20],
    shadowSoft: 8,
    ao: 0.55,
    aoColor: '#1a0208',
    ink: 0,
    detail: (d) => {
      // pebbled leather grain
      grunge(d, 71, { color: '#2a0410', count: 900, size: [0.5, 1.8], alpha: 0.35, area: [0, 0, CW, CH] });
      grunge(d, 72, { color: '#ff8aa0', count: 380, size: [0.4, 1.2], alpha: 0.18, area: [0, 0, CW, CH] });
      grunge(d, 73, { color: '#1a0208', count: 40, size: [2, 7], alpha: 0.35, area: [0, 0, CW, CH], scratches: 26 });
      // blind-tooled border (pressed groove)
      const border = path((q) => q.roundRect(40, 22, CW - 62, CH - 44, 10));
      emboss(d, border, 5, 'rgba(255,150,170,0.35)', 'rgba(20,0,8,0.7)');
      const inner = path((q) => q.roundRect(52, 34, CW - 86, CH - 68, 6));
      d.save();
      d.setLineDash([2, 7]);
      d.strokeStyle = 'rgba(242,182,66,0.75)';
      d.lineWidth = 2.5;
      d.lineCap = 'round';
      d.stroke(inner);
      d.restore();
      // top-left sheen
      d.globalCompositeOperation = 'screen';
      d.fillStyle = rad(d, CW * 0.25, CH * 0.12, 4, CW * 0.7, [[0, 'rgba(255,170,190,0.35)'], [1, 'rgba(255,170,190,0)']]);
      d.fillRect(0, 0, CW, CH);
      d.globalCompositeOperation = 'source-over';
    },
  });

  // ---- spine with raised bands
  const spine = path((q) => q.roundRect(0, 0, 34, CH, [14, 0, 0, 14]));
  piece(ctx, spine, {
    fill: lin(ctx, 0, 0, 34, 0, [[0, '#2e0410'], [0.45, '#7a1030'], [1, '#4a0618']]),
    ink: 0,
    detail: (d) => grunge(d, 74, { color: '#1a0208', count: 120, size: [0.5, 1.6], alpha: 0.4, area: [0, 0, 34, CH] }),
  });
  for (const v of [60, 144, 262, 346]) {
    const band = path((q) => q.roundRect(-6, v - 9, 44, 18, 8));
    piece(ctx, band, {
      fill: lin(ctx, 0, v - 9, 0, v + 9, [[0, '#fff0b0'], [0.4, '#e2a83a'], [1, '#6e4608']]),
      ink: 4,
    });
  }

  // ---- veins bulging under the leather, spreading from the eye
  const eyeU = CW / 2;
  const veinSet: [number, number][][] = [];
  for (const [ang, len, , seed] of [
    [-2.2, 150, 9, 3], [-1.15, 150, 9, 5], [-0.2, 120, 8, 7], [0.5, 150, 9, 9],
    [1.45, 170, 10, 11], [2.25, 140, 8, 13], [2.95, 110, 7, 15], [-2.85, 100, 7, 17],
  ] as const) {
    const pts = branch(eyeU + Math.cos(ang) * 74, EYE_V + Math.sin(ang) * 56, ang, len, seed, 12);
    veinSet.push(pts);
    // a small side branch
    const k = 5;
    veinSet.push(branch(pts[k][0], pts[k][1], ang + (seed % 2 ? 0.9 : -0.9), len * 0.4, seed + 50, 6));
  }
  ctx.save();
  ctx.clip(coverShape);
  veinSet.forEach((pts, i) => vein(ctx, pts, i % 2 ? 6.5 : 12));
  ctx.restore();

  // ---- eye socket: fleshy bulge with wrinkles and stitches
  ctx.save();
  eyeSpace(ctx);
  const socket = path((q) => q.ellipse(eyeU, EYE_V, 92, 70, 0, 0, Math.PI * 2));
  piece(ctx, socket, {
    fill: rad(ctx, eyeU - 20, EYE_V - 26, 6, 100, [[0, '#ff8a9c'], [0.45, '#c4304e'], [1, '#5a0820']]),
    shadow: 'rgba(60,0,16,0.6)',
    shadowOff: [-14, -14],
    shadowSoft: 4,
    ink: 7,
    detail: (d) => {
      d.strokeStyle = 'rgba(70,0,20,0.55)';
      d.lineWidth = 2.5;
      d.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI * 0.95 + k * 0.32;
        d.beginPath();
        d.moveTo(eyeU + Math.cos(a) * 84, EYE_V + Math.sin(a) * 62);
        d.quadraticCurveTo(eyeU + Math.cos(a) * 76, EYE_V + Math.sin(a) * 52 + 4, eyeU + Math.cos(a) * 68, EYE_V + Math.sin(a) * 48);
        d.stroke();
      }
    },
  });
  // cross-stitches of black thread round the bottom of the socket
  for (let k = 0; k < 6; k++) {
    const a = 0.45 + k * 0.42;
    const x = eyeU + Math.cos(a) * 92;
    const y = EYE_V + Math.sin(a) * 70;
    const X = path((q) => { q.moveTo(x - 6, y - 6); q.lineTo(x + 6, y + 6); q.moveTo(x + 6, y - 6); q.lineTo(x - 6, y + 6); });
    line(ctx, X, 5, '#120406');
    ctx.save();
    ctx.translate(-0.8, -0.8);
    line(ctx, X, 1.6, 'rgba(255,200,200,0.5)');
    ctx.restore();
  }

  // ---- sclera: wet, shaded, with capillaries
  const almond = (k: number) =>
    path((q) => {
      q.moveTo(eyeU - 72 * k, EYE_V);
      q.bezierCurveTo(eyeU - 36 * k, EYE_V - 60 * k, eyeU + 36 * k, EYE_V - 60 * k, eyeU + 72 * k, EYE_V);
      q.bezierCurveTo(eyeU + 36 * k, EYE_V + 58 * k, eyeU - 36 * k, EYE_V + 58 * k, eyeU - 72 * k, EYE_V);
      q.closePath();
    });
  const sclera = almond(1);
  piece(ctx, sclera, {
    fill: rad(ctx, eyeU, EYE_V + 8, 6, 80, [[0, '#fffaf2'], [0.6, '#f6dccc'], [1, '#c87a7a']]),
    ink: 0,
    detail: (d) => {
      d.fillStyle = lin(d, 0, EYE_V - 50, 0, EYE_V - 10, [[0, 'rgba(80,0,20,0.55)'], [1, 'rgba(80,0,20,0)']]);
      d.fillRect(0, 0, CW, CH);
      for (const [ang, seed] of [[3.1, 1], [2.8, 2], [-0.1, 3], [0.25, 4], [3.5, 5], [-0.4, 6]] as const) {
        const sx = eyeU + Math.cos(ang) * 70;
        const sy = EYE_V + Math.sin(ang) * 22;
        const pts = branch(sx, sy, ang + Math.PI, 34, seed + 80, 6);
        d.strokeStyle = 'rgba(210,30,50,0.85)';
        d.lineWidth = 1.6;
        d.beginPath();
        pts.forEach(([x, y], i) => (i ? d.lineTo(x, y) : d.moveTo(x, y)));
        d.stroke();
      }
    },
  });
  line(ctx, sclera, 6);
  ctx.restore();

  // ---- iris part: fibrous, glowing, slit pupil, wet highlights
  cover(ictx);
  eyeSpace(ictx);
  const iris = path((q) => q.arc(eyeU, EYE_V, 40, 0, Math.PI * 2));
  piece(ictx, iris, {
    fill: rad(ictx, eyeU, EYE_V, 2, 42, [[0, '#fff0a0'], [0.25, '#ffb21a'], [0.6, '#ff3a1a'], [0.9, '#9a0a18'], [1, '#3a0008']]),
    ink: 4,
    detail: (d) => {
      const rnd = seeded(91);
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2 + rnd() * 0.05;
        const r0 = 10 + rnd() * 4;
        const r1 = 30 + rnd() * 9;
        d.strokeStyle = k % 3 ? 'rgba(120,0,10,0.45)' : 'rgba(255,230,140,0.5)';
        d.lineWidth = k % 3 ? 1.4 : 1;
        d.beginPath();
        d.moveTo(eyeU + Math.cos(a) * r0, EYE_V + Math.sin(a) * r0);
        d.lineTo(eyeU + Math.cos(a + 0.05) * r1, EYE_V + Math.sin(a + 0.05) * r1);
        d.stroke();
      }
      // limbal ring
      d.strokeStyle = 'rgba(40,0,6,0.85)';
      d.lineWidth = 5;
      d.beginPath();
      d.arc(eyeU, EYE_V, 38, 0, Math.PI * 2);
      d.stroke();
      // caustic: light pooled on the lower iris
      d.fillStyle = rad(d, eyeU + 6, EYE_V + 22, 1, 20, [[0, 'rgba(255,240,160,0.8)'], [1, 'rgba(255,240,160,0)']]);
      d.fillRect(eyeU - 40, EYE_V - 40, 80, 80);
    },
  });
  const pupil = path((q) => {
    q.moveTo(eyeU, EYE_V - 34);
    q.bezierCurveTo(eyeU - 13, EYE_V - 12, eyeU - 13, EYE_V + 12, eyeU, EYE_V + 34);
    q.bezierCurveTo(eyeU + 13, EYE_V + 12, eyeU + 13, EYE_V - 12, eyeU, EYE_V - 34);
    q.closePath();
  });
  piece(ictx, pupil, { fill: '#0a0004', ink: 0 });
  // window highlight + small sparkle
  piece(ictx, path((q) => q.ellipse(eyeU + 16, EYE_V - 17, 11, 7, -0.5, 0, Math.PI * 2)), { fill: 'rgba(255,255,255,0.95)', ink: 0 });
  dot(ictx, eyeU - 15, EYE_V + 16, 4, '#fff', 0.85);

  // ---- lid part (closed eyelid, shown during the blink)
  cover(lctx);
  eyeSpace(lctx);
  piece(lctx, almond(1.06), {
    fill: lin(lctx, 0, EYE_V - 64, 0, EYE_V + 62, [[0, '#d63c5e'], [0.5, '#9a1a3a'], [1, '#5a0820']]),
    light: 'rgba(255,150,170,0.7)',
    lightOff: [0, 10],
    ink: 6,
    detail: (d) => grunge(d, 77, { color: '#3a0414', count: 60, size: [0.5, 1.5], alpha: 0.4, area: [eyeU - 80, EYE_V - 70, 160, 140] }),
  });
  line(lctx, path((q) => { q.moveTo(eyeU - 70, EYE_V + 2); q.quadraticCurveTo(eyeU, EYE_V + 30, eyeU + 70, EYE_V + 2); }), 5);
  for (let k = 0; k < 9; k++) {
    const t = (k + 0.5) / 9;
    const x = eyeU - 64 + t * 128;
    const y = EYE_V + 2 + Math.sin(t * Math.PI) * 14;
    line(lctx, path((q) => { q.moveTo(x, y); q.quadraticCurveTo(x + (t - 0.5) * 10, y + 10, x + (t - 0.5) * 18, y + 15); }), 2.5);
  }

  // ---- glowing runes around the socket
  ctx.save();
  ctx.font = '700 21px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const runes = 'ᚠᛟᚦᛉᚱᛞᚹᛇᛗᛒ';
  for (let k = 0; k < runes.length; k++) {
    const a = -Math.PI / 2 + (k / runes.length) * Math.PI * 2;
    const x = eyeU + Math.cos(a) * 128;
    const y = EYE_V + Math.sin(a) * 108;
    if (y > CH - 30 || x < 50 || x > CW - 30) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    ctx.shadowColor = '#ff2a44';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffc4cc';
    ctx.fillText(runes[k], 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // ---- corners and clasp
  filigree(ctx, CW, 0, -1, 1);
  filigree(ctx, CW, CH, -1, -1);
  const strap = path((q) => q.roundRect(CW - 42, CH * 0.44, 50, 54, 8));
  piece(ctx, strap, {
    fill: lin(ctx, 0, CH * 0.44, 0, CH * 0.44 + 54, [[0, '#7a4a28'], [1, '#3a1e0c']]),
    ink: 5,
    detail: (d) => {
      d.save();
      d.setLineDash([4, 4]);
      d.strokeStyle = 'rgba(240,210,160,0.6)';
      d.lineWidth = 1.5;
      d.strokeRect(CW - 38, CH * 0.44 + 5, 42, 44);
      d.restore();
    },
  });
  const lock = path((q) => q.roundRect(CW - 34, CH * 0.44 + 9, 34, 36, 8));
  piece(ctx, lock, {
    fill: lin(ctx, CW - 34, CH * 0.44 + 9, CW, CH * 0.44 + 45, [[0, '#fff4c0'], [0.35, '#f2c04a'], [1, '#6a4206']]),
    shadow: 'rgba(90,50,0,0.6)',
    shadowOff: [-5, -5],
    ink: 5,
  });
  piece(ctx, path((q) => { q.arc(CW - 17, CH * 0.44 + 22, 5, 0, Math.PI * 2); q.rect(CW - 19, CH * 0.44 + 24, 4, 12); }), { fill: '#1a0a04', ink: 0 });

  // ---- light: the eye glows onto the leather; leather edge rim light; outline
  ctx.save();
  ctx.clip(coverShape);
  spill(ctx, eyeU, EYE_V, 190, 'rgba(255,80,40,1)', 0.22);
  // depth: the cover darkens toward its far edges
  ctx.fillStyle = rad(ctx, eyeU, EYE_V, 120, 300, [[0, 'rgba(20,0,8,0)'], [1, 'rgba(20,0,8,0.55)']]);
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
  emboss(ctx, coverShape, 4, 'rgba(255,170,190,0.55)', 'rgba(0,0,0,0)');
  line(ctx, coverShape, 8);
  gloss(ctx, path((q) => { q.moveTo(52, 10); q.lineTo(170, 6); }), 4, 0.55);
  gloss(ctx, path((q) => { q.moveTo(eyeU - 50, EYE_V - 40); q.quadraticCurveTo(eyeU - 20, EYE_V - 56, eyeU + 14, EYE_V - 54); }), 3, 0.6);

  // ---- blood dripping off the bottom edge (screen space)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const [d0x, d0y] = toScreen(104, CH - 4);
  const [d1x, d1y] = toScreen(220, CH - 4);
  const [d2x, d2y] = toScreen(160, CH - 4);
  drip(ctx, d0x, d0y, 34, 22);
  drip(ctx, d1x, d1y, 22, 17);
  drip(ctx, d2x, d2y, 10, 12);

  // ---- emissive layer
  cover(gctx);
  veinSet.forEach((pts, i) => {
    gctx.strokeStyle = '#ff2a44';
    gctx.lineCap = 'round';
    gctx.lineWidth = i % 2 ? 2 : 4;
    gctx.beginPath();
    pts.forEach(([x, y], k) => (k ? gctx.lineTo(x, y) : gctx.moveTo(x, y)));
    gctx.stroke();
  });
  eyeSpace(gctx);
  gctx.fillStyle = '#ff5a2a';
  gctx.fill(iris);
  return { base: c, parts: { iris: irisC, lid: lidC }, glow: g };
}


/* ================================================================== L'INFECTÉ (top symbol) */

const SKIN = { hi: '#bca6c8', base: '#806c92', mid: '#5a4870', dark: '#2a1e36' };
const HOOD = { hi: '#4e6a88', base: '#2c3c52', dark: '#111a26' };

export function paintInfected(): PaintedSymbol {
  const [c, ctx] = layer();
  const [g, gctx] = layer();
  const [jawC, jctx] = layer();
  groundShadow(ctx, 256, 500, 190, 10, 0.4);

  // ---- bone spikes tearing out of the shoulders (behind the hood)
  for (const [x, y, a, l, w] of [
    [100, 400, -2.25, 128, 34], [76, 452, -2.7, 92, 28], [130, 330, -2.0, 120, 26],
    [412, 400, -0.89, 128, 34], [436, 452, -0.44, 92, 28], [382, 330, -1.14, 120, 26],
  ] as const) {
    const tx = x + Math.cos(a) * l;
    const ty = y + Math.sin(a) * l;
    const nx = -Math.sin(a) * w * 0.5;
    const ny = Math.cos(a) * w * 0.5;
    const sp = path((q) => {
      q.moveTo(x - nx, y - ny);
      q.quadraticCurveTo((x + tx) / 2 - nx * 0.6 + Math.cos(a + 1.2) * 8, (y + ty) / 2 - ny * 0.6, tx, ty);
      q.quadraticCurveTo((x + tx) / 2 + nx * 0.5, (y + ty) / 2 + ny * 0.5, x + nx, y + ny);
      q.closePath();
    });
    piece(ctx, sp, {
      fill: lin(ctx, x, y, tx, ty, [[0, '#6a5440'], [0.45, '#d8c4a0'], [1, '#fffaf0']]),
      shadow: 'rgba(60,40,20,0.5)',
      shadowOff: [nx * 0.4, ny * 0.4],
      ink: 5,
    });
  }

  // ---- mantle / shoulders
  const mantle = path((q) => {
    q.moveTo(22, 512);
    q.bezierCurveTo(30, 448, 84, 404, 164, 388);
    q.lineTo(348, 388);
    q.bezierCurveTo(428, 404, 482, 448, 490, 512);
    q.closePath();
  });
  piece(ctx, mantle, {
    fill: lin(ctx, 0, 388, 0, 512, [[0, HOOD.base], [1, HOOD.dark]]),
    shadow: HOOD.dark,
    shadowOff: [-50, -8],
    shadowSoft: 6,
    ink: 9,
    detail: (d) => {
      grunge(d, 31, { color: '#05080c', count: 140, size: [0.6, 2.2], alpha: 0.45, area: [20, 380, 472, 132], scratches: 10 });
      d.fillStyle = 'rgba(150,10,34,0.7)';
      for (const [x, y, r] of [[120, 470, 20], [150, 488, 9], [98, 494, 7], [392, 478, 14]]) {
        d.beginPath();
        d.arc(x, y, r, 0, Math.PI * 2);
        d.fill();
      }
    },
  });

  // ---- hood
  const hood = path((q) => {
    q.moveTo(70, 470);
    q.bezierCurveTo(34, 300, 86, 70, 256, 34);
    q.bezierCurveTo(426, 70, 478, 300, 442, 470);
    q.bezierCurveTo(370, 500, 142, 500, 70, 470);
    q.closePath();
  });
  piece(ctx, hood, {
    fill: rad(ctx, 196, 120, 20, 400, [[0, HOOD.hi], [0.4, HOOD.base], [1, HOOD.dark]]),
    shadow: HOOD.dark,
    shadowOff: [-46, -18],
    shadowSoft: 6,
    light: '#7a9ec0',
    lightOff: [14, 16],
    ao: 0.4,
    ink: 10,
    detail: (d) => {
      grunge(d, 32, { color: '#04070b', count: 260, size: [0.6, 2.4], alpha: 0.4, area: [40, 30, 432, 470], scratches: 16 });
      grunge(d, 33, { color: '#a6c4e0', count: 90, size: [0.5, 1.4], alpha: 0.25, area: [40, 30, 432, 470] });
      for (const f of ['M110 400 C96 320 104 220 150 140', 'M402 400 C418 320 410 220 364 140', 'M180 70 C220 52 270 48 320 62', 'M90 300 C92 250 104 210 124 176']) {
        const fp = new Path2D(f);
        d.save();
        d.filter = 'blur(3px)';
        line(d, fp, 14, 'rgba(4,6,10,0.6)');
        d.restore();
        d.save();
        d.translate(7, 0);
        d.filter = 'blur(2px)';
        line(d, fp, 5, 'rgba(160,190,220,0.35)');
        d.restore();
      }
    },
  });
  // cold rim light on the left edge, red back-light on the right
  ctx.save();
  ctx.clip(hood);
  ctx.filter = 'blur(5px)';
  line(ctx, path((q) => { q.moveTo(66, 440); q.bezierCurveTo(36, 300, 88, 80, 250, 40); }), 10, 'rgba(120,220,255,0.45)');
  line(ctx, path((q) => { q.moveTo(446, 440); q.bezierCurveTo(476, 300, 424, 80, 262, 40); }), 12, 'rgba(255,50,70,0.5)');
  ctx.restore();
  line(ctx, hood, 10);

  // ---- hood opening: deep shadow
  const opening = path((q) => {
    q.moveTo(126, 446);
    q.bezierCurveTo(104, 300, 140, 128, 256, 110);
    q.bezierCurveTo(372, 128, 408, 300, 386, 446);
    q.bezierCurveTo(330, 470, 182, 470, 126, 446);
    q.closePath();
  });
  piece(ctx, opening, { fill: rad(ctx, 256, 300, 20, 200, [[0, '#1a1024'], [1, '#05030a']]), ink: 8 });

  // ---- skull / face
  const face = path((q) => {
    q.moveTo(256, 138);
    q.bezierCurveTo(322, 140, 368, 190, 370, 258);
    q.bezierCurveTo(372, 300, 360, 330, 350, 352);
    q.lineTo(162, 352);
    q.bezierCurveTo(152, 330, 140, 300, 142, 258);
    q.bezierCurveTo(144, 190, 190, 140, 256, 138);
    q.closePath();
  });
  piece(ctx, face, {
    fill: rad(ctx, 236, 230, 10, 170, [[0, SKIN.hi], [0.45, SKIN.base], [0.85, SKIN.mid], [1, SKIN.dark]]),
    shadow: 'rgba(20,10,30,0.55)',
    shadowOff: [-24, -10],
    shadowSoft: 6,
    ao: 0.5,
    aoColor: '#0a0610',
    ink: 0,
    detail: (d) => {
      grunge(d, 41, { color: '#1a1022', count: 300, size: [0.5, 2], alpha: 0.45, area: [140, 136, 232, 220] });
      grunge(d, 42, { color: '#d8c4e8', count: 90, size: [0.4, 1.3], alpha: 0.3, area: [140, 136, 232, 220] });
      // cheek hollows and cheekbones
      d.save();
      d.filter = 'blur(10px)';
      d.fillStyle = 'rgba(20,10,32,0.7)';
      for (const dir of [-1, 1]) {
        d.beginPath();
        d.ellipse(256 + dir * 82, 300, 24, 34, dir * 0.3, 0, Math.PI * 2);
        d.fill();
      }
      d.fillStyle = 'rgba(210,190,230,0.45)';
      for (const dir of [-1, 1]) {
        d.beginPath();
        d.ellipse(256 + dir * 74, 262, 26, 12, -dir * 0.4, 0, Math.PI * 2);
        d.fill();
      }
      d.restore();
      // hood casts shadow over the top of the head
      d.fillStyle = lin(d, 0, 136, 0, 200, [[0, 'rgba(5,3,10,0.9)'], [1, 'rgba(5,3,10,0)']]);
      d.fillRect(130, 130, 260, 80);
      // veins on the temples
      for (const v of ['M162 236 C172 222 168 206 180 192', 'M350 236 C340 222 344 206 332 192', 'M158 276 C170 270 172 258 184 254']) {
        line(d, new Path2D(v), 3, 'rgba(90,20,70,0.85)');
      }
    },
  });
  line(ctx, face, 7);

  // ---- molten cracks
  const cracks = ['M248 150 L240 172 L254 186 L244 206', 'M300 158 L310 180 L298 196', 'M196 300 L208 312 L198 330', 'M330 296 L320 312 L332 328'];
  for (const d of cracks) {
    const p = new Path2D(d);
    ctx.save();
    ctx.filter = 'blur(5px)';
    line(ctx, p, 14, 'rgba(255,110,40,0.55)');
    ctx.restore();
    line(ctx, p, 8, '#2a0408');
    line(ctx, p, 5, '#ff6a2a');
    line(ctx, p, 2, '#fff0a8');
  }

  // ---- brow ridge (angry V) and its shadow over the eyes
  const brow = path((q) => {
    q.moveTo(160, 206);
    q.quadraticCurveTo(206, 214, 256, 246);
    q.quadraticCurveTo(306, 214, 352, 206);
    q.quadraticCurveTo(356, 226, 340, 236);
    q.quadraticCurveTo(300, 236, 256, 266);
    q.quadraticCurveTo(212, 236, 172, 236);
    q.quadraticCurveTo(156, 226, 160, 206);
    q.closePath();
  });
  ctx.save();
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = 'rgba(8,4,14,0.75)';
  ctx.translate(0, 12);
  ctx.fill(brow);
  ctx.restore();
  // eye sockets
  const sockets: Path2D[] = [];
  for (const dir of [-1, 1]) {
    const cx = 256 + dir * 54;
    const s = path((q) => {
      q.moveTo(cx - dir * 46, 238);
      q.quadraticCurveTo(cx, 226, cx + dir * 42, 262);
      q.quadraticCurveTo(cx, 290, cx - dir * 46, 238);
      q.closePath();
    });
    sockets.push(s);
    piece(ctx, s, { fill: '#08040c', ink: 0 });
  }
  piece(ctx, brow, {
    fill: lin(ctx, 0, 206, 0, 266, [[0, SKIN.hi], [0.6, SKIN.base], [1, SKIN.mid]]),
    light: 'rgba(230,214,240,0.8)',
    lightOff: [0, 6],
    ink: 6,
    detail: (d) => grunge(d, 43, { color: '#1a1022', count: 60, size: [0.5, 1.6], alpha: 0.45, area: [156, 200, 200, 70] }),
  });

  // ---- burning eyes
  const eyes: Path2D[] = [];
  for (const dir of [-1, 1]) {
    const cx = 256 + dir * 56;
    const e = path((q) => {
      q.moveTo(cx - dir * 34, 244);
      q.quadraticCurveTo(cx - dir * 2, 236, cx + dir * 30, 262);
      q.quadraticCurveTo(cx - dir * 4, 274, cx - dir * 34, 244);
      q.closePath();
    });
    eyes.push(e);
    ctx.save();
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(255,170,30,0.9)';
    ctx.fill(e);
    ctx.restore();
    piece(ctx, e, { fill: rad(ctx, cx - dir * 4, 252, 1, 32, [[0, '#ffffff'], [0.3, '#fff3a0'], [0.7, '#ffb21a'], [1, '#ff4a10']]), ink: 0 });
    // tiny pupil slit
    piece(ctx, path((q) => q.ellipse(cx - dir * 4, 252, 2.5, 8, dir * 0.3, 0, Math.PI * 2)), { fill: '#2a0400', ink: 0 });
    // the eye lights the brow underside and the cheek
    spill(ctx, cx, 254, 70, 'rgba(255,170,40,1)', 0.3, face);
  }

  // ---- nasal cavity
  const nose = path((q) => {
    q.moveTo(256, 276);
    q.bezierCurveTo(244, 286, 236, 304, 246, 310);
    q.quadraticCurveTo(256, 304, 266, 310);
    q.bezierCurveTo(276, 304, 268, 286, 256, 276);
    q.closePath();
  });
  piece(ctx, nose, { fill: '#0c0612', ink: 4 });
  line(ctx, path((q) => { q.moveTo(256, 280); q.lineTo(256, 306); }), 2.5, SKIN.mid);

  // ---- the grin: mouth interior, gums, upper fangs (base layer)
  const lipY = (x: number) => 336 - Math.pow((x - 256) / 112, 2) * 30;
  const mouth = path((q) => {
    q.moveTo(140, lipY(140) - 4);
    for (let x = 150; x <= 372; x += 10) q.lineTo(x, lipY(x));
    q.lineTo(372, lipY(372) - 4);
    q.bezierCurveTo(366, 400, 320, 452, 256, 456);
    q.bezierCurveTo(192, 452, 146, 400, 140, lipY(140) - 4);
    q.closePath();
  });
  piece(ctx, mouth, {
    fill: rad(ctx, 256, 410, 4, 120, [[0, '#ffb04a'], [0.18, '#ff4a2a'], [0.5, '#8e0820'], [1, '#1a0006']]),
    ink: 7,
    detail: (d) => {
      // throat glow and tongue
      d.fillStyle = rad(d, 266, 420, 2, 46, [[0, 'rgba(255,240,170,0.9)'], [1, 'rgba(255,120,40,0)']]);
      d.fillRect(200, 360, 140, 100);
      piece(d, path((q) => q.ellipse(276, 432, 52, 20, -0.12, 0, Math.PI * 2)), {
        fill: lin(d, 0, 412, 0, 452, [[0, '#ff6a7a'], [1, '#a0142e']]),
        shadow: '#6a0a1e',
        shadowOff: [-6, -6],
        ink: 4,
      });
    },
  });
  // gums along the upper lip
  ctx.save();
  ctx.clip(mouth);
  ctx.strokeStyle = '#5a0818';
  ctx.lineWidth = 16;
  ctx.beginPath();
  for (let x = 140; x <= 372; x += 6) (x === 140 ? ctx.moveTo(x, lipY(x)) : ctx.lineTo(x, lipY(x)));
  ctx.stroke();
  ctx.restore();
  // irregular upper fangs, big canines
  const upper: [number, number, number][] = [
    [150, 12, 18], [164, 14, 24], [180, 18, 54], [200, 12, 26], [214, 12, 30], [228, 12, 24], [242, 12, 28],
    [256, 12, 22], [270, 12, 28], [284, 12, 24], [298, 12, 30], [312, 18, 58], [332, 14, 26], [348, 12, 20], [362, 10, 14],
  ];
  for (const [x, w, l] of upper) {
    const y0 = lipY(x - w / 2) + 4;
    const y1 = lipY(x + w / 2) + 4;
    const bend = (x - 256) * 0.06;
    fang(ctx, x - w / 2, y0, x + w / 2, y1, x + bend, Math.max(y0, y1) + l, bend);
  }
  // saliva strands and split corners
  ctx.save();
  ctx.clip(mouth);
  for (const [x, len] of [[206, 70], [290, 80], [236, 50]] as const) {
    const y = lipY(x) + 18;
    const sp = path((q) => { q.moveTo(x, y); q.quadraticCurveTo(x + 4, y + len * 0.6, x - 2, y + len); });
    line(ctx, sp, 3.5, 'rgba(255,230,220,0.55)');
    dot(ctx, x + 1, y + len * 0.55, 3, 'rgba(255,255,255,0.7)');
  }
  ctx.restore();
  for (const dir of [-1, 1]) {
    const x = 256 + dir * 116;
    line(ctx, path((q) => { q.moveTo(x, lipY(x) - 4); q.lineTo(x + dir * 14, lipY(x) - 16); q.lineTo(x + dir * 20, lipY(x) - 12); }), 4);
  }
  // mouth light on the teeth and lower face
  spill(ctx, 256, 410, 150, 'rgba(255,90,30,1)', 0.25);

  // ---- jaw part: chin with lower fangs
  const jaw = path((q) => {
    q.moveTo(172, 412);
    q.bezierCurveTo(196, 428, 316, 428, 340, 412);
    q.bezierCurveTo(338, 448, 302, 476, 256, 478);
    q.bezierCurveTo(210, 476, 174, 448, 172, 412);
    q.closePath();
  });
  const lower: [number, number, number][] = [[196, 15, 26], [216, 16, 42], [236, 13, 24], [256, 13, 28], [276, 13, 24], [296, 16, 44], [316, 15, 26]];
  for (const [x, w, l] of lower) {
    const y = 420 + Math.pow((x - 256) / 84, 2) * -6;
    fang(jctx, x - w / 2, y + 4, x + w / 2, y + 4, x - (x - 256) * 0.05, y - l, (x - 256) * -0.05);
  }
  piece(jctx, jaw, {
    fill: lin(jctx, 0, 412, 0, 478, [[0, SKIN.base], [1, SKIN.dark]]),
    shadow: 'rgba(10,6,16,0.55)',
    shadowOff: [-16, -6],
    ink: 7,
    detail: (d) => {
      grunge(d, 44, { color: '#1a1022', count: 80, size: [0.5, 1.8], alpha: 0.45, area: [170, 410, 172, 70] });
      d.fillStyle = 'rgba(255,120,40,0.35)';
      d.fillRect(170, 410, 172, 10);
      // chin cleft, cheek shadow and a cold rim on the chin
      line(d, new Path2D('M256 448 Q252 462 256 474'), 3, 'rgba(20,10,30,0.7)');
      d.save();
      d.filter = 'blur(4px)';
      line(d, new Path2D('M190 450 Q220 474 256 476'), 6, 'rgba(160,220,255,0.35)');
      d.restore();
    },
  });
  // toxic drool hanging off the chin
  piece(jctx, path((q) => {
    q.moveTo(300, 462);
    q.bezierCurveTo(302, 480, 298, 494, 304, 504);
    q.arc(300, 504, 6, 0, Math.PI, false);
    q.bezierCurveTo(292, 494, 294, 480, 292, 464);
    q.closePath();
  }), { fill: lin(jctx, 292, 0, 306, 0, [[0, '#d2ffb8'], [1, '#4fa83a']]), ink: 3.5 });

  // ---- emissive
  gctx.fillStyle = '#ffb21a';
  for (const e of eyes) gctx.fill(e);
  gctx.strokeStyle = '#ff6a2a';
  gctx.lineWidth = 6;
  gctx.lineCap = 'round';
  for (const d of cracks) gctx.stroke(new Path2D(d));
  gctx.fillStyle = 'rgba(255,90,30,0.8)';
  gctx.beginPath();
  gctx.ellipse(262, 418, 50, 26, 0, 0, Math.PI * 2);
  gctx.fill();
  void sockets;
  void INK;
  return { base: c, parts: { jaw: jawC }, glow: g };
}
