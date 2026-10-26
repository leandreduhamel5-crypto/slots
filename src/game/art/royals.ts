import { INK, MATERIALS, glossyDrip, render3DText, seeded } from './painters';
import { P, dot, gloss, grunge, groundShadow, layer, lin, line, path, piece, rad } from './paint';
import { biohazard, smoke } from './premium';

/**
 * Royals (A K Q J 10): 3D lettering over a themed emblem that gives each one its own silhouette
 * and colour block, the way premium slots dress their low symbols. Painted at 512, downsampled.
 */
const C = P / 2;

function letter(ctx: CanvasRenderingContext2D, text: string, size: number, material: string, dx = 0, dy = 0): { w: number; h: number } {
  const l = render3DText(text, { size, material: MATERIALS[material] });
  ctx.drawImage(l, C - l.width / 2 + dx, C - l.height / 2 + dy);
  return { w: l.width, h: l.height };
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  piece(ctx, path((p) => p.arc(x, y, r, 0, Math.PI * 2)), {
    fill: lin(ctx, x - r, y - r, x + r, y + r, [[0, '#ffffff'], [0.4, '#b8c4ce'], [1, '#4a5662']]),
    ink: 4,
  });
}

/* ------------------------------------------------------------------ A: blood splash */
function royalA(ctx: CanvasRenderingContext2D): void {
  const rnd = seeded(5);
  const splash = path((p) => {
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = i % 2 ? 128 + rnd() * 14 : 168 + rnd() * 34;
      const x = C + Math.cos(a) * r;
      const y = C + 6 + Math.sin(a) * r * 0.92;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
  });
  piece(ctx, splash, {
    fill: rad(ctx, C - 30, C - 40, 10, 200, [[0, '#9a1430'], [0.6, '#5a0a1e'], [1, '#2e0410']]),
    shadow: '#24030c',
    shadowOff: [-18, -18],
    light: '#c43656',
    lightOff: [8, 8],
    ink: 10,
  });
  for (const [x, y, r] of [[C + 196, C - 120, 14], [C - 200, C + 90, 10], [C + 170, C + 150, 8], [C - 150, C - 170, 9]]) {
    piece(ctx, path((p) => p.arc(x, y, r, 0, Math.PI * 2)), { fill: '#7a0a22', ink: 6 });
  }
  letter(ctx, 'A', 330, 'blood', 0, 4);
  glossyDrip(ctx, C - 78, C + 118, 52, 11, ['#ff8a96', '#e0213a', '#7a0418']);
  glossyDrip(ctx, C + 92, C + 118, 76, 12, ['#ff8a96', '#e0213a', '#7a0418']);
  glossyDrip(ctx, C + 6, C + 26, 30, 7, ['#ff8a96', '#e0213a', '#7a0418']);
}

/* ------------------------------------------------------------------ K: cracked steel shield + bone crown */
function royalK(ctx: CanvasRenderingContext2D): void {
  const shield = path((p) => {
    p.moveTo(C - 150, C - 150);
    p.quadraticCurveTo(C, C - 190, C + 150, C - 150);
    p.bezierCurveTo(C + 160, C + 10, C + 110, C + 140, C, C + 200);
    p.bezierCurveTo(C - 110, C + 140, C - 160, C + 10, C - 150, C - 150);
    p.closePath();
  });
  piece(ctx, shield, {
    fill: lin(ctx, 0, C - 190, 0, C + 200, [[0, '#4e6e82'], [0.5, '#2a4050'], [1, '#14222c']]),
    shadow: '#0e1820',
    shadowOff: [-26, -14],
    light: '#7ea2b8',
    lightOff: [10, 10],
    ao: 0.5,
    ink: 11,
    detail: (d) => {
      grunge(d, 15, { color: '#05090c', count: 120, size: [1, 4], alpha: 0.5, scratches: 16 });
      // inner bevel line
      d.strokeStyle = 'rgba(160,200,220,0.35)';
      d.lineWidth = 4;
      d.save();
      d.translate(C, C);
      d.scale(0.84, 0.84);
      d.translate(-C, -C);
      d.stroke(shield);
      d.restore();
      // crack
      line(d, path((p) => { p.moveTo(C + 120, C - 140); p.lineTo(C + 92, C - 96); p.lineTo(C + 112, C - 70); p.lineTo(C + 80, C - 30); }), 5);
    },
  });
  for (const [x, y] of [[C - 120, C - 128], [C + 120, C - 128], [C - 104, C + 60], [C + 104, C + 60], [C, C + 162]]) rivet(ctx, x, y, 10);
  letter(ctx, 'K', 300, 'steel', 6, 22);
  // bandage across the leg of the K
  ctx.save();
  ctx.translate(C + 34, C + 76);
  ctx.rotate(-0.6);
  piece(ctx, path((p) => p.roundRect(-92, -22, 184, 44, 12)), {
    fill: lin(ctx, 0, -22, 0, 22, [[0, '#fff6e2'], [1, '#d8c49c']]),
    shadow: '#b8a07a',
    shadowOff: [-6, -6],
    ink: 7,
    detail: (d) => {
      d.fillStyle = '#c9b086';
      d.fillRect(-26, -20, 52, 40);
      d.fillStyle = '#a88c60';
      for (let i = -18; i <= 18; i += 12) for (let j = -10; j <= 10; j += 10) d.fillRect(i, j, 4, 4);
      dot(d, 6, 2, 8, '#e0213a');
    },
  });
  ctx.restore();
  // bone crown on top
  const crown = path((p) => {
    p.moveTo(C - 92, C - 112);
    p.lineTo(C - 100, C - 178);
    p.lineTo(C - 62, C - 140);
    p.lineTo(C - 30, C - 196);
    p.lineTo(C, C - 146);
    p.lineTo(C + 34, C - 200);
    p.lineTo(C + 64, C - 140);
    p.lineTo(C + 104, C - 178);
    p.lineTo(C + 96, C - 112);
    p.closePath();
  });
  ctx.save();
  ctx.translate(C, C - 150);
  ctx.rotate(0.12);
  ctx.translate(-C, -(C - 150));
  piece(ctx, crown, {
    fill: lin(ctx, 0, C - 200, 0, C - 112, [[0, '#fffaf0'], [1, '#c8b48e']]),
    shadow: '#a8946e',
    shadowOff: [-12, -8],
    ink: 8,
    detail: (d) => grunge(d, 16, { color: '#6a5a3a', count: 40, size: [1, 3], alpha: 0.4 }),
  });
  for (const x of [C - 54, C, C + 54]) {
    piece(ctx, path((p) => p.ellipse(x, C - 124, 11, 9, 0, 0, Math.PI * 2)), {
      fill: rad(ctx, x - 3, C - 128, 1, 12, [[0, '#ffb3bd'], [0.5, '#e0213a'], [1, '#6a0418']]),
      ink: 4,
    });
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ Q: toxic cloud + eyeball in the counter */
function royalQ(ctx: CanvasRenderingContext2D): void {
  smoke(
    ctx,
    [
      [C - 110, C + 40, 82],
      [C - 40, C - 80, 96],
      [C + 70, C - 60, 92],
      [C + 120, C + 50, 76],
      [C + 10, C + 110, 86],
      [C - 120, C - 60, 60],
    ],
    ['#7a4aa0', '#4a2468', '#28103c'],
  );
  letter(ctx, 'Q', 320, 'toxic', 0, 8);
  // an eyeball bulging out of the Q's hole, glancing sideways
  const ex = C - 16;
  const ey = C - 20;
  piece(ctx, path((p) => p.arc(ex, ey, 40, 0, Math.PI * 2)), {
    fill: rad(ctx, ex - 12, ey - 14, 4, 46, [[0, '#ffffff'], [0.7, '#f0dcef'], [1, '#b890b0']]),
    shadow: 'rgba(120,60,120,0.5)',
    shadowOff: [-8, -8],
    ink: 7,
    detail: (d) => {
      d.strokeStyle = '#e0213a';
      d.lineWidth = 2.5;
      for (const v of [[ex - 40, ey + 6, ex - 20, ey + 2], [ex + 40, ey - 6, ex + 26, ey - 2], [ex - 26, ey - 30, ex - 14, ey - 18]]) {
        d.beginPath();
        d.moveTo(v[0], v[1]);
        d.quadraticCurveTo((v[0] + v[2]) / 2 + 4, (v[1] + v[3]) / 2 - 6, v[2], v[3]);
        d.stroke();
      }
    },
  });
  piece(ctx, path((p) => p.arc(ex + 13, ey + 3, 21, 0, Math.PI * 2)), {
    fill: rad(ctx, ex + 13, ey + 3, 2, 22, [[0, '#ffe08a'], [0.4, '#b46bff'], [1, '#4a1488']]),
    ink: 5,
  });
  dot(ctx, ex + 13, ey + 3, 8, INK);
  dot(ctx, ex + 19, ey - 4, 5, '#fff');
  // stitches across the cheek of the Q
  line(ctx, path((p) => { p.moveTo(C - 104, C + 70); p.quadraticCurveTo(C - 60, C + 96, C - 14, C + 84); }), 6);
  for (let i = 0; i < 5; i++) {
    const x = C - 96 + i * 20;
    const y = C + 74 + Math.sin((i / 4) * Math.PI) * 14;
    line(ctx, path((p) => { p.moveTo(x - 6, y - 12); p.lineTo(x + 6, y + 12); }), 5);
  }
  glossyDrip(ctx, C + 108, C + 120, 60, 11, ['#efd6ff', '#a85cf0', '#4a1488']);
  glossyDrip(ctx, C - 50, C + 128, 36, 9, ['#efd6ff', '#a85cf0', '#4a1488']);
  for (const [x, y, r] of [[C + 130, C - 120, 13], [C + 160, C - 80, 8], [C - 150, C - 130, 7]]) {
    piece(ctx, path((p) => p.arc(x, y, r, 0, Math.PI * 2)), { fill: 'rgba(230,200,255,0.5)', ink: 4 });
    dot(ctx, x - r * 0.35, y - r * 0.35, r * 0.3, '#fff');
  }
}

/* ------------------------------------------------------------------ J: radioactive hazard disc */
function royalJ(ctx: CanvasRenderingContext2D): void {
  const R = 172;
  const disc = path((p) => p.arc(C, C, R, 0, Math.PI * 2));
  piece(ctx, disc, {
    fill: '#ffcf33',
    ink: 11,
    detail: (d) => {
      // hazard stripes on the outer ring
      d.save();
      d.translate(C, C);
      for (let i = 0; i < 24; i++) {
        d.rotate((Math.PI * 2) / 24);
        if (i % 2) continue;
        d.fillStyle = INK;
        d.beginPath();
        d.moveTo(0, 0);
        d.lineTo(R + 10, -26);
        d.lineTo(R + 10, 26);
        d.closePath();
        d.fill();
      }
      d.restore();
    },
  });
  const inner = path((p) => p.arc(C, C, R - 30, 0, Math.PI * 2));
  piece(ctx, inner, {
    fill: rad(ctx, C - 40, C - 50, 10, R, [[0, '#3a7a2a'], [0.6, '#1d4a18'], [1, '#0c240a']]),
    shadow: '#081a06',
    shadowOff: [-20, -20],
    ink: 9,
    detail: (d) => {
      d.globalAlpha = 0.35;
      biohazard(d, C, C, 110, '#7be05a', 0);
      d.globalAlpha = 1;
      grunge(d, 17, { color: '#020a02', count: 80, size: [1, 4], alpha: 0.5 });
    },
  });
  gloss(ctx, path((p) => p.arc(C, C, R - 14, Math.PI * 1.1, Math.PI * 1.45)), 7, 0.6);
  letter(ctx, 'J', 320, 'slime', -6, 6);
  glossyDrip(ctx, C - 70, C + 92, 56, 11, ['#e2ffcc', '#6fd04a', '#1d6a18']);
  glossyDrip(ctx, C + 34, C + 120, 84, 12, ['#e2ffcc', '#6fd04a', '#1d6a18']);
  glossyDrip(ctx, C + 40, C - 128, 30, 8, ['#e2ffcc', '#6fd04a', '#1d6a18']);
}

/* ------------------------------------------------------------------ 10: rusty sawblade */
function royalTen(ctx: CanvasRenderingContext2D): void {
  const teeth = 16;
  const blade = path((p) => {
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.62) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      const pt = (a: number, r: number) => [C + Math.cos(a) * r, C + Math.sin(a) * r] as const;
      const [x0, y0] = pt(a0, 150);
      const [x1, y1] = pt(a1, 188);
      const [x2, y2] = pt(a2, 150);
      if (i === 0) p.moveTo(x0, y0);
      p.lineTo(x1, y1);
      p.lineTo(x2, y2);
    }
    p.closePath();
  });
  piece(ctx, blade, {
    fill: lin(ctx, C - 180, C - 180, C + 180, C + 180, [[0, '#d8dee4'], [0.35, '#8a96a2'], [1, '#3a4450']]),
    shadow: '#2a3038',
    shadowOff: [-16, -16],
    ink: 10,
    detail: (d) => {
      // rust patches and grime
      const rnd = seeded(23);
      for (let i = 0; i < 14; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 40 + rnd() * 130;
        d.fillStyle = `rgba(${150 + rnd() * 40},${60 + rnd() * 30},10,${0.4 + rnd() * 0.3})`;
        d.beginPath();
        d.ellipse(C + Math.cos(a) * r, C + Math.sin(a) * r, 12 + rnd() * 26, 8 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
        d.fill();
      }
      grunge(d, 24, { color: '#1a0e06', count: 100, size: [1, 3], alpha: 0.5, scratches: 20 });
      // concentric machining rings
      d.strokeStyle = 'rgba(255,255,255,0.18)';
      d.lineWidth = 2;
      for (const r of [70, 96, 122]) {
        d.beginPath();
        d.arc(C, C, r, 0, Math.PI * 2);
        d.stroke();
      }
    },
  });
  // blood on a couple of teeth
  for (const a of [-0.5, -0.1, 2.4]) {
    const x = C + Math.cos(a) * 170;
    const y = C + Math.sin(a) * 170;
    piece(ctx, path((p) => p.arc(x, y, 14, 0, Math.PI * 2)), { fill: '#b5122f', ink: 0 });
  }
  gloss(ctx, path((p) => p.arc(C, C, 136, Math.PI * 1.08, Math.PI * 1.42)), 6, 0.7);
  letter(ctx, '10', 270, 'rust', -2, 10);
  for (const [x, y] of [[C - 120, C - 92], [C + 132, C + 84]]) rivet(ctx, x, y, 11);
  glossyDrip(ctx, C + 40, C + 112, 62, 11, ['#ffe0a8', '#f08a2a', '#7a3006']);
}

const PAINTERS: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  a: royalA,
  k: royalK,
  q: royalQ,
  j: royalJ,
  ten: royalTen,
};

export function paintRoyal(key: string): HTMLCanvasElement {
  const [c, ctx] = layer();
  groundShadow(ctx, C, P - 40, 150, 14, 0.45);
  // keep everything inside a slightly smaller box so drips and crowns fit the cell
  ctx.save();
  ctx.translate(C, C);
  ctx.scale(1, 1);
  ctx.translate(-C, -C);
  PAINTERS[key](ctx);
  ctx.restore();
  return c;
}

