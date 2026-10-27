import { makeCanvas, seeded } from './painters';

/**
 * "Book of Infection" backdrop: an Egyptian temple at night, swallowed by a red infection.
 * Painted in layers with atmospheric perspective (far = hazy red, near = dark with red rim light),
 * no ink outlines, so it sits behind the painted symbols. 1920×1080; the reels cover the middle.
 */
export const W = 1920;
export const H = 1080;
const HORIZON = 690;

type Pt = [number, number];

export interface Scene {
  canvas: HTMLCanvasElement;
  /** braziers (fire glows) */
  lamps: Pt[];
  portholes: Pt[];
  /** pulsing infection source (the pyramid's capstone) */
  heart: Pt;
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Glowing branching crack. */
function crack(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, seed: number, depth = 2): void {
  const rnd = seeded(seed);
  const pts: Pt[] = [[x, y]];
  let a = ang;
  for (let i = 0; i < 8; i++) {
    a += (rnd() - 0.5) * 0.9;
    x += Math.cos(a) * (len / 8);
    y += Math.sin(a) * (len / 8);
    pts.push([x, y]);
  }
  const stroke = (width: number, color: string, blur = 0) => {
    ctx.save();
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.lineWidth = width * (1 - i / pts.length);
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    ctx.restore();
  };
  stroke(w * 4, 'rgba(255,30,40,0.35)', w * 2);
  stroke(w, '#ff2a36');
  stroke(w * 0.4, '#ffb0a0');
  if (depth > 0) {
    const k = 3 + Math.floor(rnd() * 3);
    crack(ctx, pts[k][0], pts[k][1], ang + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.5, w * 0.6, seed + 7, depth - 1);
  }
}

/** Pyramid with two shaded faces, block courses, glowing cracks and a burning capstone. */
function pyramid(ctx: CanvasRenderingContext2D, cx: number, apexY: number, half: number, baseY: number, tone: number, seed: number, cracks: number): void {
  const apex: Pt = [cx, apexY];
  const midX = cx + half * 0.18; // the edge between the faces, seen slightly from the left
  const left: Pt[] = [apex, [cx - half, baseY], [midX, baseY]];
  const right: Pt[] = [apex, [midX, baseY], [cx + half, baseY]];
  const shade = (k: number) => `rgb(${Math.round(70 * k * tone)},${Math.round(22 * k * tone)},${Math.round(26 * k * tone)})`;
  // left face catches the red sky, right face in shadow
  let g = ctx.createLinearGradient(cx, apexY, cx, baseY);
  g.addColorStop(0, shade(1.5));
  g.addColorStop(1, shade(0.75));
  poly(ctx, left);
  ctx.fillStyle = g;
  ctx.fill();
  g = ctx.createLinearGradient(cx, apexY, cx, baseY);
  g.addColorStop(0, shade(0.75));
  g.addColorStop(1, shade(0.35));
  poly(ctx, right);
  ctx.fillStyle = g;
  ctx.fill();
  // block courses
  ctx.save();
  poly(ctx, [apex, [cx - half, baseY], [cx + half, baseY]]);
  ctx.clip();
  const rnd = seeded(seed);
  const rows = Math.round((baseY - apexY) / 14);
  for (let i = 1; i < rows; i++) {
    const y = apexY + ((baseY - apexY) * i) / rows;
    const span = (half * (y - apexY)) / (baseY - apexY);
    ctx.strokeStyle = `rgba(0,0,0,${0.35 * tone})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - span, y);
    ctx.lineTo(cx + span, y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,140,120,${0.08 * tone})`;
    ctx.beginPath();
    ctx.moveTo(cx - span, y + 1.5);
    ctx.lineTo(midX, y + 1.5);
    ctx.stroke();
    for (let x = cx - span + ((i % 2) * 14); x < cx + span; x += 26 + rnd() * 10) {
      ctx.strokeStyle = `rgba(0,0,0,${0.25 * tone})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - (baseY - apexY) / rows);
      ctx.stroke();
    }
  }
  // the infection crawls down from the capstone
  for (let i = 0; i < cracks; i++) {
    crack(ctx, cx + (rnd() - 0.5) * 20, apexY + 30 + rnd() * 40, Math.PI / 2 + (rnd() - 0.5) * 1.4, (baseY - apexY) * (0.4 + rnd() * 0.5), 3.5 * tone, seed + i * 13);
  }
  ctx.restore();
  // edge highlight
  ctx.strokeStyle = `rgba(255,120,110,${0.4 * tone})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(midX, baseY);
  ctx.stroke();
}

function column(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, w: number, tone: number, broken = 0): void {
  const c = (k: number) => `rgb(${Math.round(36 * k * tone)},${Math.round(14 * k * tone)},${Math.round(16 * k * tone)})`;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, c(1.6));
  g.addColorStop(0.35, c(1));
  g.addColorStop(1, c(0.45));
  ctx.fillStyle = g;
  // shaft (slightly tapered), with a broken jagged top if asked
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, bottom);
  if (broken) {
    ctx.lineTo(x - w * 0.46, top + broken);
    ctx.lineTo(x - w * 0.15, top + broken - 22);
    ctx.lineTo(x + w * 0.05, top + broken + 8);
    ctx.lineTo(x + w * 0.3, top + broken - 30);
    ctx.lineTo(x + w * 0.46, top + broken - 6);
  } else {
    ctx.lineTo(x - w * 0.44, top + w * 0.6);
    ctx.lineTo(x + w * 0.44, top + w * 0.6);
  }
  ctx.lineTo(x + w * 0.5, bottom);
  ctx.closePath();
  ctx.fill();
  // flutes
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * w * 0.16, top + (broken ? broken + 10 : w * 0.7));
    ctx.lineTo(x + k * w * 0.17, bottom - 10);
    ctx.stroke();
  }
  // gold hieroglyph band
  const by = bottom - (bottom - top) * 0.32;
  const bg = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  bg.addColorStop(0, `rgba(255,214,120,${0.75 * tone})`);
  bg.addColorStop(0.4, `rgba(190,130,40,${0.6 * tone})`);
  bg.addColorStop(1, `rgba(60,30,10,${0.6 * tone})`);
  ctx.fillStyle = bg;
  ctx.fillRect(x - w * 0.49, by, w * 0.98, w * 0.22);
  ctx.fillStyle = `rgba(40,16,6,${0.7 * tone})`;
  for (let k = -3; k <= 3; k++) ctx.fillRect(x + k * w * 0.12 - 2, by + w * 0.05, 4, w * 0.12);
  if (!broken) {
    // lotus capital
    const cg = ctx.createLinearGradient(x - w, 0, x + w, 0);
    cg.addColorStop(0, c(1.7));
    cg.addColorStop(1, c(0.5));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.44, top + w * 0.62);
    ctx.quadraticCurveTo(x - w * 0.9, top + w * 0.2, x - w * 0.75, top);
    ctx.lineTo(x + w * 0.75, top);
    ctx.quadraticCurveTo(x + w * 0.9, top + w * 0.2, x + w * 0.44, top + w * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - w * 0.82, top - w * 0.16, w * 1.64, w * 0.18);
  }
  // red rim light on the right edge
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,40,50,${0.35 * tone})`;
  ctx.fillRect(x + w * 0.38, top + (broken ? broken : w * 0.7), w * 0.1, bottom - top - (broken ? broken : w * 0.7));
  ctx.restore();
}

function obelisk(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, w: number, tone: number): void {
  const c = (k: number) => `rgb(${Math.round(40 * k * tone)},${Math.round(14 * k * tone)},${Math.round(18 * k * tone)})`;
  poly(ctx, [[x - w * 0.5, baseY], [x - w * 0.36, baseY - h], [x, baseY - h - w * 0.5], [x, baseY]]);
  ctx.fillStyle = c(1.4);
  ctx.fill();
  poly(ctx, [[x, baseY], [x, baseY - h - w * 0.5], [x + w * 0.36, baseY - h], [x + w * 0.5, baseY]]);
  ctx.fillStyle = c(0.6);
  ctx.fill();
  // glowing glyphs down the lit face
  ctx.fillStyle = `rgba(255,60,60,${0.55 * tone})`;
  for (let k = 0; k < 7; k++) ctx.fillRect(x - w * 0.24, baseY - h * 0.9 + k * h * 0.12, w * 0.16, h * 0.05);
  // gold pyramidion
  poly(ctx, [[x - w * 0.36, baseY - h], [x, baseY - h - w * 0.5], [x + w * 0.36, baseY - h]]);
  ctx.fillStyle = `rgba(255,200,90,${0.85 * tone})`;
  ctx.fill();
}

function brazier(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // stand
  const g = ctx.createLinearGradient(x - 30 * s, 0, x + 30 * s, 0);
  g.addColorStop(0, '#ffd27a');
  g.addColorStop(0.4, '#b8781e');
  g.addColorStop(1, '#3a1e06');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 8 * s, y);
  ctx.lineTo(x - 22 * s, y + 140 * s);
  ctx.lineTo(x + 22 * s, y + 140 * s);
  ctx.lineTo(x + 8 * s, y);
  ctx.closePath();
  ctx.fill();
  // bowl
  ctx.beginPath();
  ctx.moveTo(x - 46 * s, y - 20 * s);
  ctx.quadraticCurveTo(x, y + 40 * s, x + 46 * s, y - 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff9a2a';
  ctx.fillRect(x - 44 * s, y - 24 * s, 88 * s, 6 * s);
  // flame
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [col, k] of [['rgba(255,60,20,0.9)', 1], ['rgba(255,170,40,0.9)', 0.7], ['rgba(255,240,180,0.9)', 0.4]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 34 * s * k, y - 22 * s);
    ctx.bezierCurveTo(x - 30 * s * k, y - 70 * s * k, x - 6 * s, y - 80 * s * k, x + 4 * s, y - 120 * s * k);
    ctx.bezierCurveTo(x + 10 * s, y - 80 * s * k, x + 34 * s * k, y - 60 * s * k, x + 34 * s * k, y - 22 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function paintScene(): Scene {
  const [c, ctx] = makeCanvas(W, H);
  const rnd = seeded(77);

  // ---------------------------------------------------------------- sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#050206');
  sky.addColorStop(0.45, '#1c0610');
  sky.addColorStop(0.8, '#4a0c14');
  sky.addColorStop(1, '#7a1418');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 330, 300, 620, 'rgba(255,40,40,0.55)');
  glow(ctx, 1600, 420, 500, 'rgba(200,20,40,0.35)');
  // heavy clouds lit from below
  ctx.save();
  ctx.filter = 'blur(18px)';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = 40 + rnd() * 300;
    const rx = 140 + rnd() * 260;
    const ry = 30 + rnd() * 50;
    ctx.fillStyle = `rgba(${10 + rnd() * 20},4,8,${0.55 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(200,30,40,${0.12 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, y + ry * 0.6, rx * 0.8, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // stars of embers
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,${120 + rnd() * 100},${100 + rnd() * 60},${0.3 + rnd() * 0.5})`;
    ctx.fillRect(rnd() * W, rnd() * 420, 1.6, 1.6);
  }

  // ---------------------------------------------------------------- far layer (hazy)
  pyramid(ctx, 1180, 470, 260, HORIZON, 0.55, 3, 1);
  pyramid(ctx, 1660, 430, 300, HORIZON, 0.6, 5, 2);
  pyramid(ctx, 760, 520, 190, HORIZON, 0.5, 9, 0);
  // red mist over the horizon
  const mist = ctx.createLinearGradient(0, HORIZON - 120, 0, HORIZON + 40);
  mist.addColorStop(0, 'rgba(160,20,30,0)');
  mist.addColorStop(1, 'rgba(160,20,30,0.25)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, HORIZON - 120, W, 160);

  // ---------------------------------------------------------------- the great pyramid and its beam
  const apex: Pt = [330, 250];
  // beam into the sky
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[90, 0.25], [40, 0.45], [12, 0.9]] as const) {
    const bg = ctx.createLinearGradient(0, 0, 0, apex[1]);
    bg.addColorStop(0, 'rgba(255,40,40,0)');
    bg.addColorStop(1, `rgba(255,60,50,${a})`);
    ctx.fillStyle = bg;
    ctx.filter = `blur(${w * 0.4}px)`;
    ctx.beginPath();
    ctx.moveTo(apex[0] - w * 0.15, apex[1]);
    ctx.lineTo(apex[0] - w, 0);
    ctx.lineTo(apex[0] + w, 0);
    ctx.lineTo(apex[0] + w * 0.15, apex[1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  pyramid(ctx, apex[0], apex[1], 420, HORIZON + 30, 1, 11, 6);
  glow(ctx, apex[0], apex[1] + 8, 140, 'rgba(255,60,50,1)', 0.9);
  glow(ctx, apex[0], apex[1] + 8, 40, 'rgba(255,230,200,1)', 0.9);

  // temple pylon at the foot of the pyramid, with a glowing doorway
  {
    const px = 360;
    const py = HORIZON + 40;
    const pw = 360;
    const ph = 210;
    const pc = (k: number) => `rgb(${Math.round(48 * k)},${Math.round(18 * k)},${Math.round(20 * k)})`;
    for (const side of [-1, 1]) {
      const g = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
      g.addColorStop(0, pc(1.3));
      g.addColorStop(1, pc(0.5));
      ctx.fillStyle = g;
      poly(ctx, [
        [px + side * 46, py],
        [px + side * 52, py - ph],
        [px + side * (pw / 2 - 26), py - ph + 20],
        [px + side * (pw / 2), py],
      ]);
      ctx.fill();
      // gold cornice
      ctx.fillStyle = 'rgba(220,150,50,0.75)';
      ctx.fillRect(Math.min(px + side * 52, px + side * (pw / 2 - 26)), py - ph - 8, Math.abs(pw / 2 - 26 - 52), 10);
    }
    // doorway
    const dg = ctx.createLinearGradient(0, py - 150, 0, py);
    dg.addColorStop(0, '#2a0306');
    dg.addColorStop(0.55, '#a00818');
    dg.addColorStop(1, '#ff4a3a');
    ctx.fillStyle = dg;
    ctx.fillRect(px - 40, py - 150, 80, 150);
    glow(ctx, px, py - 30, 200, 'rgba(255,40,30,1)', 0.45);
    // winged sun over the door
    ctx.fillStyle = 'rgba(255,200,90,0.9)';
    ctx.beginPath();
    ctx.arc(px, py - 172, 12, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(px + side * 12, py - 176);
      ctx.quadraticCurveTo(px + side * 60, py - 196, px + side * 90, py - 178);
      ctx.quadraticCurveTo(px + side * 60, py - 170, px + side * 12, py - 166);
      ctx.closePath();
      ctx.fill();
    }
  }

  // obelisks on the right
  obelisk(ctx, 1500, HORIZON + 50, 330, 54, 0.9);
  obelisk(ctx, 1820, HORIZON + 40, 260, 46, 0.8);

  // ---------------------------------------------------------------- ground: dark plaza and a lake of blood
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#1e070a');
  ground.addColorStop(1, '#080305');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON + 30, W, H - HORIZON);
  // perspective flagstones
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = HORIZON + 34 + Math.pow(i / 8, 1.8) * (H - HORIZON);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let k = -12; k <= 12; k++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + k * 60, HORIZON + 34);
    ctx.lineTo(W / 2 + k * 260, H);
    ctx.stroke();
  }
  // blood lake reflecting the beam
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(380, HORIZON + 140, 360, 64, 0, 0, Math.PI * 2);
  const lg = ctx.createLinearGradient(0, HORIZON + 80, 0, HORIZON + 210);
  lg.addColorStop(0, '#a01020');
  lg.addColorStop(1, '#3a0208');
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const rg = ctx.createLinearGradient(330, 0, 430, 0);
  rg.addColorStop(0, 'rgba(255,60,50,0)');
  rg.addColorStop(0.5, 'rgba(255,120,90,0.8)');
  rg.addColorStop(1, 'rgba(255,60,50,0)');
  ctx.fillStyle = rg;
  for (let i = 0; i < 9; i++) ctx.fillRect(310 + (rnd() - 0.5) * 40, HORIZON + 86 + i * 12, 120 - i * 6, 4);
  ctx.restore();
  // infection veins across the plaza
  for (let i = 0; i < 9; i++) {
    crack(ctx, 200 + rnd() * 1500, HORIZON + 60 + rnd() * 80, Math.PI / 2 + (rnd() - 0.5) * 1.8, 160 + rnd() * 200, 4.5, 300 + i * 7);
  }

  // ---------------------------------------------------------------- foreground columns, braziers
  column(ctx, 70, 120, H + 20, 150, 1);
  column(ctx, 1860, 260, H + 20, 130, 0.9, 40);
  column(ctx, 230, 420, H + 20, 90, 0.7, 30);
  const lamps: Pt[] = [
    [520, 760],
    [1420, 760],
  ];
  for (const [x, y] of lamps) brazier(ctx, x, y, 1);

  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(6,2,4,0)');
  v.addColorStop(1, 'rgba(6,2,4,0.8)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  return { canvas: c, lamps: lamps.map(([x, y]) => [x, y - 50] as Pt), portholes: [], heart: apex };
}
