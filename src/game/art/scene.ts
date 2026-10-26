import { INK, goo, makeCanvas, seeded } from './painters';

/**
 * The backdrop: an infected asylum corridor in one-point perspective, vanishing behind the reels.
 * World space: the front of the corridor is the screen plane (z = 0), the far wall is z = 1.
 * Side walls are the planes X = 0 / X = W, the floor Y = FLOOR, the ceiling Y = CEIL.
 */
export const W = 1920;
export const H = 1080;
const VP = { x: 960, y: 468 };
const K = 3.76; // far wall at 21 % of the screen-plane size
const FLOOR = 1000;
const CEIL = -80;
const RAIL = 610;

const f = (z: number) => 1 / (1 + z * K);
type Pt = [number, number];
const pt = (X: number, Y: number, z: number): Pt => [VP.x + (X - VP.x) * f(z), VP.y + (Y - VP.y) * f(z)];

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string | CanvasGradient, ink = 0): void {
  poly(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Quad on a side wall (X fixed) between depths z0..z1 and heights Y0..Y1. */
const wallQuad = (X: number, z0: number, z1: number, Y0: number, Y1: number): Pt[] => [pt(X, Y0, z0), pt(X, Y0, z1), pt(X, Y1, z1), pt(X, Y1, z0)];
/** Quad on the floor between X0..X1 and z0..z1. */
const floorQuad = (X0: number, X1: number, z0: number, z1: number, Y = FLOOR): Pt[] => [pt(X0, Y, z0), pt(X1, Y, z0), pt(X1, Y, z1), pt(X0, Y, z1)];

/** A tube running along the corridor (pipe, vein) projected with depth-scaled width. */
function tube(ctx: CanvasRenderingContext2D, pts3: [number, number, number][], w: number, colors: { ink: string; core: string; light?: string }): void {
  const proj = pts3.map(([X, Y, z]) => ({ p: pt(X, Y, z), s: f(z) }));
  const stroke = (width: number, color: string, dx = 0, dy = 0) => {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < proj.length - 1; i++) {
      const a = proj[i];
      const b = proj[i + 1];
      ctx.lineWidth = width * (a.s + b.s) * 0.5;
      ctx.beginPath();
      ctx.moveTo(a.p[0] + dx * a.s, a.p[1] + dy * a.s);
      ctx.lineTo(b.p[0] + dx * b.s, b.p[1] + dy * b.s);
      ctx.stroke();
    }
  };
  stroke(w + 12, colors.ink);
  stroke(w, colors.core);
  if (colors.light) stroke(w * 0.28, colors.light, -w * 0.18, -w * 0.18);
}

/** Wiggly path along a plane, sampled for tube(). */
function wiggle(seed: number, from: [number, number, number], to: [number, number, number], amp: [number, number, number], n = 24): [number, number, number][] {
  const rnd = seeded(seed);
  const ph = rnd() * 6;
  const fr = 2 + rnd() * 2;
  const out: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(t * Math.PI * fr + ph);
    out.push([from[0] + (to[0] - from[0]) * t + s * amp[0], from[1] + (to[1] - from[1]) * t + s * amp[1], from[2] + (to[2] - from[2]) * t + s * amp[2]]);
  }
  return out;
}

/** Ellipse drawn on a side wall plane (portholes). */
function wallEllipse(X: number, Yc: number, zc: number, ry: number, rz: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    out.push(pt(X, Yc + Math.sin(a) * ry, zc + Math.cos(a) * rz));
  }
  return out;
}

function sideDoor(ctx: CanvasRenderingContext2D, X: number, z0: number, z1: number, bloody: boolean): Pt[] {
  const top = 330;
  const zm = (z0 + z1) / 2;
  const s = f(zm);
  // recess (dark inner frame) then frame
  fillPoly(ctx, wallQuad(X, z0 - 0.012, z1 + 0.012, top - 40, FLOOR), '#26323c', 7 * s);
  fillPoly(ctx, wallQuad(X, z0, z1, top, FLOOR), '#121820');
  const leaves: [number, number][] = [
    [z0, zm],
    [zm, z1],
  ];
  const portholes: Pt[] = [];
  leaves.forEach(([a, b], i) => {
    const q = wallQuad(X, a + 0.002, b - 0.002, top + 6, FLOOR);
    const g = ctx.createLinearGradient(q[0][0], 0, q[1][0], 0);
    g.addColorStop(0, '#5a7584');
    g.addColorStop(1, '#3a4f5c');
    fillPoly(ctx, q, g, 6 * s);
    // edge highlight
    fillPoly(ctx, wallQuad(X, a + 0.004, a + 0.008, top + 12, FLOOR - 8), 'rgba(170,205,220,0.35)');
    // kick plate
    fillPoly(ctx, wallQuad(X, a + 0.006, b - 0.006, FLOOR - 80, FLOOR - 16), '#2b3a44', 4 * s);
    // push plate
    fillPoly(ctx, wallQuad(X, a + 0.012, b - 0.012, 640, 664), '#c9d3dc', 4 * s);
    // porthole: steel ring, glass glowing red
    const c = (a + b) / 2;
    const ring = wallEllipse(X, 470, c, 58, (b - a) * 0.36);
    fillPoly(ctx, ring, '#9aa6b0', 6 * s);
    const glass = wallEllipse(X, 470, c, 42, (b - a) * 0.26);
    const gp = pt(X, 470, c);
    const rg = ctx.createRadialGradient(gp[0], gp[1] + 10 * s, 2, gp[0], gp[1], 60 * s);
    rg.addColorStop(0, '#ffd0d6');
    rg.addColorStop(0.35, '#ff3347');
    rg.addColorStop(1, '#5a0b22');
    fillPoly(ctx, glass, rg, 5 * s);
    // silhouette of an infected behind the glass (one window only)
    if (i === 1 && bloody) {
      ctx.save();
      poly(ctx, glass);
      ctx.clip();
      ctx.fillStyle = 'rgba(20,4,10,0.85)';
      ctx.beginPath();
      ctx.ellipse(gp[0], gp[1] + 14 * s, 18 * s, 22 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(gp[0], gp[1] + 52 * s, 34 * s, 22 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff1b0';
      ctx.beginPath();
      ctx.arc(gp[0] - 6 * s, gp[1] + 10 * s, 2.6 * s, 0, Math.PI * 2);
      ctx.arc(gp[0] + 6 * s, gp[1] + 10 * s, 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(gp[0] - 12 * s, gp[1] - 16 * s, 9 * s, 4 * s, -0.7, 0, Math.PI * 2);
    ctx.fill();
    portholes.push(gp);
  });
  if (bloody) {
    // bloody hand smear on the door
    const hp = pt(X, 560, z0 + (z1 - z0) * 0.3);
    ctx.save();
    ctx.translate(hp[0], hp[1]);
    ctx.scale(s * (X > VP.x ? -0.8 : 0.8), s);
    ctx.fillStyle = '#9a0f26';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 24, 0, 0, Math.PI * 2);
    for (const [fx, fy, fr] of [[-18, -32, 7], [-5, -40, 7], [9, -38, 7], [21, -28, 6], [26, 4, 6]]) {
      ctx.moveTo(fx + fr, fy);
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    goo(ctx, hp[0], hp[1] + 18 * s, 90 * s, 5 * s, '#9a0f26', '#e0213a');
  }
  return portholes;
}

function barrel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#a87a12');
  g.addColorStop(0.3, '#ffd23f');
  g.addColorStop(0.65, '#d9a21c');
  g.addColorStop(1, '#5a3c06');
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 18);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // ribs
  for (const ry of [-h * 0.3, -h * 0.68]) {
    ctx.fillStyle = 'rgba(80,50,0,0.5)';
    ctx.fillRect(-w / 2, ry - 8, w, 16);
    ctx.fillStyle = 'rgba(255,240,170,0.6)';
    ctx.fillRect(-w / 2, ry - 8, w, 4);
    ctx.beginPath();
    ctx.moveTo(-w / 2, ry + 8);
    ctx.lineTo(w / 2, ry + 8);
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  // lid
  ctx.beginPath();
  ctx.ellipse(0, -h, w / 2, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e8b52a';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.stroke();
  // biohazard label
  ctx.beginPath();
  ctx.arc(0, -h * 0.5, w * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 6;
  for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
    ctx.beginPath();
    ctx.arc(Math.cos(a) * w * 0.07, -h * 0.5 + Math.sin(a) * w * 0.07, w * 0.08, 0, Math.PI * 2);
    ctx.stroke();
  }
  // toxic ooze over the rim
  goo(ctx, w * 0.18, -h + 8, 80, 9, '#7be05a', '#d2ffb8');
  goo(ctx, -w * 0.22, -h + 10, 46, 7, '#7be05a', '#d2ffb8');
  ctx.restore();
}

export interface Scene {
  canvas: HTMLCanvasElement;
  /** screen positions (scene px) of the hanging lamps and the glowing door windows */
  lamps: Pt[];
  portholes: Pt[];
  /** where the infection glows at the end of the corridor */
  heart: Pt;
}

export function paintScene(): Scene {
  const [c, ctx] = makeCanvas(W, H);
  const rnd = seeded(31);

  // ---------------------------------------------------------------- ceiling
  const ceil = [pt(0, CEIL, 0), pt(W, CEIL, 0), pt(W, CEIL, 1), pt(0, CEIL, 1)];
  const cg = ctx.createLinearGradient(0, 0, 0, VP.y);
  cg.addColorStop(0, '#120c18');
  cg.addColorStop(1, '#2a1f34');
  fillPoly(ctx, ceil, cg);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  for (let z = 0.04; z < 1; z += 0.07) {
    const a = pt(0, CEIL, z);
    const b = pt(W, CEIL, z);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  for (let X = 0; X <= W; X += 240) {
    const a = pt(X, CEIL, 0);
    const b = pt(X, CEIL, 1);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  // ---------------------------------------------------------------- floor
  const fl = floorQuad(0, W, 0, 1);
  fillPoly(ctx, fl, '#1c1522');
  for (let zi = 0; zi < 40; zi++) {
    const z0 = zi * 0.025;
    const z1 = z0 + 0.025;
    for (let xi = 0; xi < 16; xi++) {
      const X0 = xi * 120;
      if ((xi + zi) % 2) continue;
      fillPoly(ctx, floorQuad(X0, X0 + 120, z0, z1), rnd() < 0.3 ? '#3a3046' : '#33293e');
    }
  }
  // grime + aerial darkness toward the back
  const fg = ctx.createLinearGradient(0, VP.y + 100, 0, H);
  fg.addColorStop(0, 'rgba(18,8,22,0.7)');
  fg.addColorStop(1, 'rgba(18,8,22,0)');
  poly(ctx, fl);
  ctx.fillStyle = fg;
  ctx.fill();

  // ---------------------------------------------------------------- side walls
  for (const X of [0, W]) {
    const side = X === 0 ? 1 : -1;
    // plaster
    const up = wallQuad(X, 0, 1, CEIL, RAIL);
    const ug = ctx.createLinearGradient(X, 0, VP.x, 0);
    ug.addColorStop(0, '#4a3a5c');
    ug.addColorStop(1, '#2a2034');
    fillPoly(ctx, up, ug);
    // damp stains
    ctx.save();
    poly(ctx, up);
    ctx.clip();
    for (let i = 0; i < 9; i++) {
      const z = rnd() * 0.5;
      const p = pt(X, 120 + rnd() * 380, z);
      const r = (40 + rnd() * 90) * f(z);
      const sg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      sg.addColorStop(0, 'rgba(20,10,26,0.45)');
      sg.addColorStop(1, 'rgba(20,10,26,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
    }
    // vertical panel seams
    ctx.strokeStyle = 'rgba(16,8,22,0.55)';
    ctx.lineWidth = 4;
    for (let z = 0.035; z < 1; z += 0.09) {
      const a = pt(X, CEIL, z);
      const b = pt(X, RAIL, z);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
    // wainscot tiles
    const low = wallQuad(X, 0, 1, RAIL, FLOOR);
    fillPoly(ctx, low, '#163440');
    for (let zi = 0; zi < 50; zi++) {
      const z0 = zi * 0.02;
      for (let yi = 0; yi < 8; yi++) {
        const Y0 = RAIL + yi * 49;
        const off = yi % 2 ? 0.01 : 0;
        const q = wallQuad(X, z0 + off + 0.0015, z0 + off + 0.0185, Y0 + 3, Y0 + 46);
        const shade = rnd();
        fillPoly(ctx, q, shade < 0.15 ? '#1e4452' : shade < 0.6 ? '#2a5868' : '#2f6272');
      }
    }
    // tile crack + missing tiles near the front
    for (let i = 0; i < 4; i++) {
      const z0 = 0.02 + rnd() * 0.14;
      const Y0 = RAIL + Math.floor(rnd() * 7) * 49;
      fillPoly(ctx, wallQuad(X, z0, z0 + 0.017, Y0 + 3, Y0 + 46), '#0f1a20');
    }
    // rail
    fillPoly(ctx, wallQuad(X, 0, 1, RAIL - 18, RAIL + 4), '#4b6a76', 5);
    fillPoly(ctx, wallQuad(X, 0, 1, RAIL - 16, RAIL - 11), 'rgba(200,230,240,0.35)');
    // skirting shadow
    fillPoly(ctx, wallQuad(X, 0, 1, FLOOR - 26, FLOOR), '#0e1418');
    void side;
  }

  // ---------------------------------------------------------------- far wall: sealed infected door
  const far = [pt(0, CEIL, 1), pt(W, CEIL, 1), pt(W, FLOOR, 1), pt(0, FLOOR, 1)];
  fillPoly(ctx, far, '#1a1020');
  const fd = [pt(720, 260, 1), pt(1200, 260, 1), pt(1200, FLOOR, 1), pt(720, FLOOR, 1)];
  fillPoly(ctx, fd, '#3a0a1e', 4);

  // ---------------------------------------------------------------- pipes along the ceiling corners
  for (const [X, Y, col, r] of [
    [70, 40, '#3e5160', 26],
    [150, 70, '#5a4632', 16],
    [W - 70, 40, '#3e5160', 26],
    [W - 150, 70, '#5a4632', 16],
  ] as [number, number, string, number][]) {
    tube(ctx, [[X, Y, 0], [X, Y, 0.5], [X, Y, 1]], r * 2, { ink: INK, core: col, light: 'rgba(255,255,255,0.25)' });
    // brackets
    for (let z = 0.05; z < 0.6; z += 0.15) {
      const p = pt(X, Y, z);
      const s = f(z);
      ctx.fillStyle = '#6d8290';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.roundRect(p[0] - 8 * s, p[1] - (r + 8) * s, 16 * s, (r * 2 + 16) * s, 4 * s);
      ctx.fill();
      ctx.stroke();
    }
  }
  // toxic drip from the left pipe
  const dp = pt(150, 86, 0.08);
  goo(ctx, dp[0], dp[1], 70, 6, '#7be05a', '#d2ffb8');

  // ---------------------------------------------------------------- doors
  const portholes = [...sideDoor(ctx, 0, 0.05, 0.17, false), ...sideDoor(ctx, W, 0.07, 0.19, true)];

  // quarantine poster on the left wall (affine approximation of the wall plane)
  {
    const z0 = 0.2;
    const z1 = 0.27;
    const a = pt(0, 150, z0);
    const b = pt(0, 150, z1);
    const d = pt(0, 420, z0);
    const pw = 200;
    const ph = 270;
    ctx.save();
    ctx.setTransform((b[0] - a[0]) / pw, (b[1] - a[1]) / pw, (d[0] - a[0]) / ph, (d[1] - a[1]) / ph, a[0], a[1]);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.rect(0, 0, pw, ph);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(0, ph - 64, pw, 64);
    ctx.font = '30px "Luckiest Guy", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('QUARANTAINE', pw / 2, ph - 30);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11;
    for (const ang of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
      ctx.beginPath();
      ctx.arc(pw / 2 + Math.cos(ang) * 24, 92 + Math.sin(ang) * 24, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,20,10,0.25)';
    ctx.fillRect(0, 0, pw, 40);
    ctx.restore();
  }
  // SORTIE sign above the right door
  {
    const z0 = 0.085;
    const z1 = 0.175;
    fillPoly(ctx, wallQuad(W, z0, z1, 220, 290), '#4a0718', 6 * f(0.13));
    // the right wall runs toward the viewer from left to right, so read it from the far edge
    const a = pt(W, 222, z1);
    const b = pt(W, 222, z0);
    const d = pt(W, 288, z1);
    ctx.save();
    ctx.setTransform((b[0] - a[0]) / 200, (b[1] - a[1]) / 200, (d[0] - a[0]) / 66, (d[1] - a[1]) / 66, a[0], a[1]);
    ctx.font = '50px "Luckiest Guy", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff3347';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff6a7a';
    ctx.fillText('SORTIE', 100, 38);
    ctx.restore();
  }

  // ---------------------------------------------------------------- infection: veins from the far door
  const heart = pt(VP.x, 640, 1);
  const veins: [number, number, number][][] = [
    wiggle(1, [880, FLOOR, 1], [520, FLOOR, 0], [60, 0, 0.02]),
    wiggle(2, [1040, FLOOR, 1], [1500, FLOOR, 0], [70, 0, 0.02]),
    wiggle(3, [960, FLOOR, 1], [900, FLOOR, 0], [90, 0, 0.01]),
    wiggle(4, [0, 700, 1], [0, 760, 0], [0, 60, 0.02]),
    wiggle(5, [0, 520, 1], [0, 300, 0.2], [0, 50, 0.02]),
    wiggle(6, [W, 760, 1], [W, 820, 0], [0, 70, 0.02]),
    wiggle(7, [W, 500, 1], [W, 240, 0.3], [0, 40, 0.02]),
    wiggle(8, [700, CEIL, 1], [420, CEIL, 0.1], [50, 0, 0.02]),
    wiggle(9, [1220, CEIL, 1], [1560, CEIL, 0.1], [50, 0, 0.02]),
  ];
  ctx.save();
  ctx.filter = 'blur(10px)';
  for (const v of veins) tube(ctx, v, 26, { ink: 'rgba(255,40,70,0.35)', core: 'rgba(255,40,70,0)' });
  ctx.restore();
  for (const v of veins) tube(ctx, v, 16, { ink: INK, core: '#c4153a', light: '#ff7d8c' });
  // pustules along the floor veins
  for (const v of veins.slice(0, 3)) {
    for (const k of [6, 13, 19]) {
      const [X, Y, z] = v[k];
      const p = pt(X, Y, z);
      const r = 14 * f(z);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r + 4 * f(z), 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb21a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#fff3a0';
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------- floor details
  // blood drag trail into the corridor
  for (let i = 0; i < 14; i++) {
    const z = 0.02 + i * 0.045;
    const X = 1240 - i * 18 + Math.sin(i) * 20;
    const p = pt(X, FLOOR, z);
    const s = f(z);
    ctx.fillStyle = i % 3 ? 'rgba(140,10,34,0.85)' : 'rgba(110,6,26,0.9)';
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], (60 + rnd() * 40) * s, (14 + rnd() * 6) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // toxic puddle (left, front)
  {
    const p = pt(380, FLOOR, 0.05);
    const s = f(0.05);
    const pg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 150 * s);
    pg.addColorStop(0, '#b8ff8c');
    pg.addColorStop(0.5, '#5fd13a');
    pg.addColorStop(1, '#2a7a1a');
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], 150 * s, 30 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(p[0] - 40 * s, p[1] - 8 * s, 40 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------- hanging lamps
  const lamps: Pt[] = [];
  for (const X of [330, W - 330]) {
    const z = 0.06;
    const s = f(z);
    const top = pt(X, CEIL, z);
    const bulb = pt(X, 150, z);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.lineTo(bulb[0], bulb[1] - 60 * s);
    ctx.stroke();
    ctx.fillStyle = '#3f5a52';
    ctx.beginPath();
    ctx.moveTo(bulb[0] - 22 * s, bulb[1] - 60 * s);
    ctx.lineTo(bulb[0] + 22 * s, bulb[1] - 60 * s);
    ctx.lineTo(bulb[0] + 76 * s, bulb[1]);
    ctx.lineTo(bulb[0] - 76 * s, bulb[1]);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 6 * s;
    ctx.stroke();
    ctx.fillStyle = '#5d7e72';
    ctx.beginPath();
    ctx.moveTo(bulb[0] - 16 * s, bulb[1] - 54 * s);
    ctx.lineTo(bulb[0] - 4 * s, bulb[1] - 54 * s);
    ctx.lineTo(bulb[0] - 42 * s, bulb[1] - 6 * s);
    ctx.lineTo(bulb[0] - 62 * s, bulb[1] - 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bulb[0], bulb[1] + 2, 28 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff1b0';
    ctx.fill();
    ctx.lineWidth = 5 * s;
    ctx.stroke();
    lamps.push([bulb[0], bulb[1] + 4]);
  }

  // ---------------------------------------------------------------- foreground: toxic barrels (left)
  barrel(ctx, 120, 1010, 210, 300, -0.04);
  barrel(ctx, 300, 1050, 170, 250, 0.08);
  // caution tape across the right corner
  ctx.save();
  ctx.translate(W - 150, 60);
  ctx.rotate(0.5);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-400, -18, 800, 36);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-400, -18, 800, 36);
  ctx.clip();
  ctx.fillStyle = INK;
  for (let x = -420; x < 420; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x + 25, 18);
    ctx.lineTo(x + 50, -18);
    ctx.lineTo(x + 25, -18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(-400, -18, 800, 36);
  ctx.restore();

  // ---------------------------------------------------------------- atmosphere
  // distance haze toward the vanishing point
  const haze = ctx.createRadialGradient(VP.x, VP.y, 0, VP.x, VP.y, 620);
  haze.addColorStop(0, 'rgba(120,40,80,0.55)');
  haze.addColorStop(1, 'rgba(120,40,80,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H / 2, H * 1.02);
  v.addColorStop(0, 'rgba(10,4,12,0)');
  v.addColorStop(1, 'rgba(10,4,12,0.72)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  return { canvas: c, lamps, portholes, heart };
}
