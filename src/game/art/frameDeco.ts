import { INK, seeded } from './painters';
import { dot, gloss, lin, line, path, piece, rad } from './paint';

/**
 * Ornaments painted over the reel frame: brass corner brackets each holding an infected eye,
 * veins creeping around the corners with pustules, a pressure gauge in the red on the left and a
 * hazard lamp on the right. `ox, oy, w, h` is the frame's outer rectangle on the canvas.
 */
export function decorateFrame(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number): void {
  const corners: [number, number, number, number][] = [
    [ox, oy, 1, 1],
    [ox + w, oy, -1, 1],
    [ox, oy + h, 1, -1],
    [ox + w, oy + h, -1, -1],
  ];

  // veins first, so brackets sit on top of them
  const rnd = seeded(9);
  for (const [cx, cy, sx, sy] of corners) {
    for (const [len, along] of [[150 + rnd() * 80, 'x'], [110 + rnd() * 70, 'y']] as const) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const wob = Math.sin(t * 9 + cx * 0.01) * 7 * (1 - t * 0.5);
        pts.push(along === 'x' ? [cx + sx * (30 + t * len), cy + sy * (14 + wob)] : [cx + sx * (14 + wob), cy + sy * (30 + t * len)]);
      }
      const p = path((q) => pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))));
      ctx.save();
      ctx.filter = 'blur(5px)';
      line(ctx, p, 16, 'rgba(255,40,70,0.45)');
      ctx.restore();
      line(ctx, p, 13);
      line(ctx, p, 7, '#c4153a');
      ctx.save();
      ctx.translate(-1.5, -1.5);
      line(ctx, p, 2.5, '#ff8a9a');
      ctx.restore();
      for (const k of [5, 10]) {
        const [x, y] = pts[k];
        piece(ctx, path((q) => q.arc(x, y, 7, 0, Math.PI * 2)), { fill: rad(ctx, x - 2, y - 2, 1, 8, [[0, '#fff3a0'], [1, '#ffb21a']]), ink: 3.5 });
      }
    }
  }

  // corner brackets with an infected eye
  for (const [cx, cy, sx, sy] of corners) {
    const arm = 92;
    const t = 30;
    const bracket = path((q) => {
      q.moveTo(cx - sx * 6, cy - sy * 6);
      q.lineTo(cx + sx * arm, cy - sy * 6);
      q.lineTo(cx + sx * (arm - 14), cy + sy * t);
      q.lineTo(cx + sx * t, cy + sy * t);
      q.lineTo(cx + sx * t, cy + sy * (arm - 14));
      q.lineTo(cx - sx * 6, cy + sy * arm);
      q.closePath();
    });
    piece(ctx, bracket, {
      fill: lin(ctx, cx - sx * 6, cy - sy * 6, cx + sx * arm, cy + sy * arm, [[0, '#fff1b0'], [0.3, '#f2b642'], [0.75, '#b07a1e'], [1, '#6e4608']]),
      shadow: '#7a4f0e',
      shadowOff: [-8, -8],
      ink: 7,
    });
    for (const [bx, by] of [[cx + sx * (arm - 30), cy + sy * 12], [cx + sx * 12, cy + sy * (arm - 30)]]) {
      piece(ctx, path((q) => q.arc(bx, by, 6, 0, Math.PI * 2)), { fill: lin(ctx, bx - 6, by - 6, bx + 6, by + 6, [[0, '#ffffff'], [1, '#6e4608']]), ink: 3 });
    }
    // eye socket hub
    const ex = cx + sx * 16;
    const ey = cy + sy * 16;
    piece(ctx, path((q) => q.arc(ex, ey, 30, 0, Math.PI * 2)), {
      fill: lin(ctx, ex - 30, ey - 30, ex + 30, ey + 30, [[0, '#d8e0e6'], [0.5, '#8a96a2'], [1, '#3a4450']]),
      shadow: '#2a3038',
      shadowOff: [-6, -6],
      ink: 7,
    });
    const almond = path((q) => {
      q.moveTo(ex - 20, ey);
      q.quadraticCurveTo(ex, ey - 18, ex + 20, ey);
      q.quadraticCurveTo(ex, ey + 18, ex - 20, ey);
      q.closePath();
    });
    piece(ctx, almond, { fill: '#fff4e4', ink: 4 });
    piece(ctx, path((q) => q.arc(ex, ey, 9, 0, Math.PI * 2)), { fill: rad(ctx, ex, ey, 1, 10, [[0, '#ffd0d6'], [0.5, '#ff3347'], [1, '#7a0418']]), ink: 0 });
    piece(ctx, path((q) => q.ellipse(ex, ey, 2.5, 8, 0, 0, Math.PI * 2)), { fill: INK, ink: 0 });
    dot(ctx, ex + 3, ey - 3, 2.5, '#fff');
  }

  // pressure gauge, left side, needle in the red
  {
    const gx = ox + 8;
    const gy = oy + h / 2;
    piece(ctx, path((q) => q.arc(gx, gy, 40, 0, Math.PI * 2)), {
      fill: lin(ctx, gx - 40, gy - 40, gx + 40, gy + 40, [[0, '#fff1b0'], [0.4, '#f2b642'], [1, '#6e4608']]),
      ink: 7,
    });
    piece(ctx, path((q) => q.arc(gx, gy, 31, 0, Math.PI * 2)), { fill: '#fff8ec', ink: 5 });
    ctx.save();
    ctx.lineCap = 'round';
    // scale: green → yellow → red
    for (const [a0, a1, col] of [[-3.6, -2.2, '#5fd13a'], [-2.2, -1.2, '#ffd23f'], [-1.2, 0.4, '#e0213a']] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(gx, gy, 24, a0, a1);
      ctx.stroke();
    }
    ctx.restore();
    line(ctx, path((q) => { q.moveTo(gx, gy); q.lineTo(gx + Math.cos(-0.5) * 24, gy + Math.sin(-0.5) * 24); }), 4, '#170b14');
    dot(ctx, gx, gy, 5, INK);
    gloss(ctx, path((q) => q.arc(gx, gy, 26, Math.PI * 1.1, Math.PI * 1.45)), 3, 0.7);
  }

  // hazard lamp, right side
  {
    const lx = ox + w - 8;
    const ly = oy + h / 2;
    piece(ctx, path((q) => q.roundRect(lx - 30, ly + 10, 60, 26, 6)), {
      fill: lin(ctx, 0, ly + 10, 0, ly + 36, [[0, '#8a96a2'], [1, '#3a4450']]),
      ink: 6,
    });
    const dome = path((q) => {
      q.moveTo(lx - 26, ly + 12);
      q.bezierCurveTo(lx - 26, ly - 30, lx + 26, ly - 30, lx + 26, ly + 12);
      q.closePath();
    });
    ctx.save();
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(255,90,40,0.7)';
    ctx.fill(dome);
    ctx.restore();
    piece(ctx, dome, {
      fill: rad(ctx, lx - 6, ly - 8, 2, 34, [[0, '#fff3c4'], [0.35, '#ffb21a'], [1, '#e04a10']]),
      ink: 6,
      detail: (d) => {
        d.strokeStyle = 'rgba(120,40,0,0.5)';
        d.lineWidth = 3;
        for (const x of [-12, 0, 12]) {
          d.beginPath();
          d.moveTo(lx + x, ly - 20);
          d.lineTo(lx + x, ly + 12);
          d.stroke();
        }
      },
    });
    gloss(ctx, path((q) => { q.moveTo(lx - 14, ly - 4); q.quadraticCurveTo(lx - 12, ly - 16, lx - 2, ly - 20); }), 4, 0.9);
  }
}
