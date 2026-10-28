import { makeCanvas, seeded } from './painters';

/**
 * Egyptian reel frame for "Book of Infection": carved dark stone, double gold mouldings, gold
 * corner bosses holding red gems, winged suns on the sides, and red infection cracks in the stone.
 * Painted (no ink outlines) to sit with the painted symbols. The reel window stays transparent.
 */
export interface EgyptFrameSpec {
  boardW: number;
  boardH: number;
  pad: number;
  bleed: number;
}

export function goldGrad(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff2b8');
  g.addColorStop(0.18, '#f2c25a');
  g.addColorStop(0.45, '#9a5e14');
  g.addColorStop(0.62, '#e8b24a');
  g.addColorStop(0.85, '#6a3a08');
  g.addColorStop(1, '#c48a2a');
  return g;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Thin glowing crack. */
export function redCrack(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, seed: number): void {
  const rnd = seeded(seed);
  const pts: [number, number][] = [[x, y]];
  let a = ang;
  for (let i = 0; i < 7; i++) {
    a += (rnd() - 0.5) * 1;
    x += Math.cos(a) * (len / 7);
    y += Math.sin(a) * (len / 7);
    pts.push([x, y]);
  }
  for (const [width, color, blur] of [[w * 4, 'rgba(255,30,40,0.35)', w * 2], [w, '#ff2a36', 0], [w * 0.4, '#ffc0b0', 0]] as const) {
    ctx.save();
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.lineWidth = width * (1 - i / pts.length);
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function gem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  halo.addColorStop(0, 'rgba(255,40,50,0.7)');
  halo.addColorStop(1, 'rgba(255,40,50,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad(ctx, x - r, y - r, x + r, y + r);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffd0c8');
  g.addColorStop(0.3, '#ff3040');
  g.addColorStop(1, '#5a0010');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Winged sun disc, centred on (x, y), wingspan 2*span. */
export function wingedSun(ctx: CanvasRenderingContext2D, x: number, y: number, span: number): void {
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const len = span * (1 - k * 0.16);
      const yo = k * span * 0.07;
      ctx.beginPath();
      ctx.moveTo(x + side * span * 0.12, y - span * 0.06 + yo);
      ctx.quadraticCurveTo(x + side * len * 0.6, y - span * 0.2 + yo, x + side * len, y - span * 0.1 + yo);
      ctx.quadraticCurveTo(x + side * len * 0.62, y - span * 0.02 + yo * 1.3, x + side * span * 0.12, y + span * 0.06 + yo);
      ctx.closePath();
      ctx.fillStyle = goldGrad(ctx, x, y - span * 0.2, x + side * len, y + span * 0.2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,4,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  gem(ctx, x, y, span * 0.14);
}

export function paintEgyptFrame(s: EgyptFrameSpec): HTMLCanvasElement {
  const W = s.boardW + s.pad * 2;
  const H = s.boardH + s.pad * 2;
  const [c, ctx] = makeCanvas(W + s.bleed * 2, H + s.bleed * 2);
  ctx.translate(s.bleed, s.bleed);
  const inner = { x: s.pad - 6, y: s.pad - 6, w: s.boardW + 12, h: s.boardH + 12 };
  const ring = () => {
    rr(ctx, 0, 0, W, H, 18);
    ctx.roundRect(inner.x, inner.y, inner.w, inner.h, 8);
  };

  // drop shadow outside the frame
  ctx.save();
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  rr(ctx, 6, 16, W, H, 18);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 8);
  ctx.fill();
  ctx.restore();

  // carved stone body
  ctx.save();
  ring();
  ctx.clip('evenodd');
  const stone = ctx.createLinearGradient(0, 0, 0, H);
  stone.addColorStop(0, '#3a1e1c');
  stone.addColorStop(0.5, '#24100f');
  stone.addColorStop(1, '#140808');
  ctx.fillStyle = stone;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(91);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,200,170,0.05)';
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 2 + rnd() * 10, 1 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // engraved hieroglyph-like marks along top and bottom bands
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let x = 70; x < W - 70; x += 34) {
    for (const y of [12, H - 28]) {
      const k = Math.floor(rnd() * 4);
      if (k === 0) ctx.fillRect(x, y + 2, 6, 14);
      else if (k === 1) {
        ctx.beginPath();
        ctx.arc(x + 6, y + 9, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (k === 2) ctx.fillRect(x - 2, y + 7, 18, 4);
      else {
        ctx.beginPath();
        ctx.moveTo(x, y + 16);
        ctx.lineTo(x + 7, y + 2);
        ctx.lineTo(x + 14, y + 16);
        ctx.fill();
      }
    }
  }
  // red infection cracks through the stone
  for (let i = 0; i < 14; i++) {
    const side = i % 4;
    const x = side < 2 ? rnd() * W : side === 2 ? rnd() * s.pad : W - rnd() * s.pad;
    const y = side === 0 ? rnd() * s.pad : side === 1 ? H - rnd() * s.pad : rnd() * H;
    redCrack(ctx, x, y, rnd() * Math.PI * 2, 40 + rnd() * 70, 2.6, 400 + i * 11);
  }
  ctx.restore();

  // gold mouldings: outer edge and inner window lip
  const moulding = (x: number, y: number, w: number, h: number, r: number, t: number) => {
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.lineWidth = t;
    ctx.strokeStyle = goldGrad(ctx, x, y, x + w * 0.15, y + h);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(40,18,2,0.85)';
    rr(ctx, x - t / 2, y - t / 2, w + t, h + t, r + t / 2);
    ctx.stroke();
    rr(ctx, x + t / 2, y + t / 2, w - t, h - t, Math.max(1, r - t / 2));
    ctx.stroke();
    ctx.restore();
  };
  moulding(4, 4, W - 8, H - 8, 16, 7);
  moulding(inner.x - 5, inner.y - 5, inner.w + 10, inner.h + 10, 10, 9);
  moulding(14, 14, W - 28, H - 28, 12, 2.5);

  // inner bevel shadow (the reels sit deeper than the frame)
  ctx.save();
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 8);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.filter = 'blur(8px)';
  ctx.lineWidth = 22;
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 8);
  ctx.stroke();
  ctx.restore();

  // corner bosses
  for (const [x, y] of [[s.pad / 2 - 2, s.pad / 2 - 2], [W - s.pad / 2 + 2, s.pad / 2 - 2], [s.pad / 2 - 2, H - s.pad / 2 + 2], [W - s.pad / 2 + 2, H - s.pad / 2 + 2]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = goldGrad(ctx, -30, -30, 30, 30);
    rr(ctx, -27, -27, 54, 54, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(50,24,2,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    gem(ctx, x, y, 13);
  }
  // winged suns on the side posts and centre of the bottom rail
  for (const [x, y, span] of [[s.pad / 2 - 2, H / 2, 46], [W - s.pad / 2 + 2, H / 2, 46], [W / 2, H - s.pad / 2 + 2, 120]] as const) {
    wingedSun(ctx, x, y, span);
  }
  return c;
}

/** Dark engraved stone behind one reel column. */
export function paintStonePanel(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1e0e0e');
  g.addColorStop(0.5, '#160909');
  g.addColorStop(1, '#0c0505');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rnd = seeded(seed);
  // stone blocks
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 92) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    const off = (y / 92) % 2 ? w * 0.4 : w * 0.8;
    ctx.beginPath();
    ctx.moveTo(off, y);
    ctx.lineTo(off, y + 92);
    ctx.stroke();
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = rnd() < 0.6 ? 'rgba(0,0,0,0.25)' : 'rgba(255,190,160,0.035)';
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, 2 + rnd() * 9, 1 + rnd() * 4, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // faint engraved eye of Horus, one per panel
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = '#f2c25a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const ey = h * (0.3 + rnd() * 0.4);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, ey);
  ctx.quadraticCurveTo(w * 0.5, ey - 34, w * 0.78, ey);
  ctx.quadraticCurveTo(w * 0.5, ey + 30, w * 0.22, ey);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.5, ey, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // a faint red crack
  ctx.globalAlpha = 0.5;
  redCrack(ctx, rnd() * w, rnd() * h, rnd() * Math.PI * 2, 60 + rnd() * 60, 1.6, seed + 3);
  ctx.globalAlpha = 1;
  // side shading so columns read as recessed
  const sg = ctx.createLinearGradient(0, 0, w, 0);
  sg.addColorStop(0, 'rgba(0,0,0,0.45)');
  sg.addColorStop(0.12, 'rgba(0,0,0,0)');
  sg.addColorStop(0.88, 'rgba(0,0,0,0)');
  sg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  // thin gold separator on the right edge
  ctx.fillStyle = goldGrad(ctx, w - 4, 0, w, h);
  ctx.fillRect(w - 3, 0, 3, h);
  return c;
}

/** Gold coin for the win showers: milled rim, stamped Eye of Horus, glossy highlight (128 px). */
export function paintCoin(): HTMLCanvasElement {
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  const m = S / 2;
  ctx.beginPath();
  ctx.arc(m, m, 60, 0, Math.PI * 2);
  ctx.fillStyle = '#2a1404';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(m, m, 57, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad(ctx, 10, 10, 118, 118);
  ctx.fill();
  // milled edge
  ctx.strokeStyle = 'rgba(70,36,4,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(m + Math.cos(a) * 50, m + Math.sin(a) * 50);
    ctx.lineTo(m + Math.cos(a) * 56, m + Math.sin(a) * 56);
    ctx.stroke();
  }
  // inner field
  ctx.beginPath();
  ctx.arc(m, m, 46, 0, Math.PI * 2);
  const f = ctx.createRadialGradient(m - 14, m - 16, 4, m, m, 48);
  f.addColorStop(0, '#fff2c0');
  f.addColorStop(0.5, '#e8b44a');
  f.addColorStop(1, '#8a5410');
  ctx.fillStyle = f;
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,4,0.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // stamped Eye of Horus (engraved: dark stroke + light offset)
  const eye = (dx: number, dy: number, col: string, w: number) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(m - 30, m - 4);
    ctx.quadraticCurveTo(m, m - 26, m + 30, m - 4);
    ctx.quadraticCurveTo(m, m + 16, m - 30, m - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(m, m - 5, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m - 30, m - 20);
    ctx.quadraticCurveTo(m, m - 34, m + 32, m - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m - 4, m + 8);
    ctx.lineTo(m - 8, m + 30);
    ctx.moveTo(m + 8, m + 6);
    ctx.quadraticCurveTo(m + 24, m + 30, m + 8, m + 30);
    ctx.stroke();
    ctx.restore();
  };
  eye(1.5, 1.5, 'rgba(255,240,190,0.7)', 4);
  eye(0, 0, 'rgba(70,34,2,0.85)', 4);
  // gloss
  ctx.save();
  ctx.beginPath();
  ctx.arc(m, m, 57, 0, Math.PI * 2);
  ctx.clip();
  const gl = ctx.createLinearGradient(0, 0, S, S);
  gl.addColorStop(0, 'rgba(255,255,255,0.55)');
  gl.addColorStop(0.3, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  return c;
}

/** Anticipation column: infected light rising up the reel, glowing cracks, gold edge lines. */
export function paintRisingColumn(w: number, h: number): HTMLCanvasElement {
  // a curtain of light rising from the bottom of the reel: bright rims, soft haze, no hard edges
  const [c, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 at the top, 1 at the bottom
    const fadeV = Math.pow(v, 1.6);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) * 2; // 0 centre, 1 edges
      const rim = Math.pow(u, 6) * 1.0 + Math.pow(u, 2) * 0.25;
      const haze = 0.16 + 0.22 * Math.pow(v, 3);
      const a = Math.min(1, (rim + haze) * fadeV * (u > 0.985 ? 0.4 : 1));
      const i = (y * w + x) * 4;
      // white-hot near the bottom rims, then orange, then infected red higher up
      const hot = Math.min(1, rim * v * 1.4);
      img.data[i] = 255;
      img.data[i + 1] = Math.round(60 + 170 * hot + 40 * Math.pow(v, 4));
      img.data[i + 2] = Math.round(40 + 140 * hot * hot);
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Frame around a winning symbol: soft gold-red halo, gold double rim, gem corners. */
export function paintGoldWinFrame(w: number, h: number): HTMLCanvasElement {
  const b = 14;
  const [c, ctx] = makeCanvas(w + b * 2, h + b * 2);
  ctx.translate(b, b);
  const box = (inset: number, r: number) => rr(ctx, inset, inset, w - inset * 2, h - inset * 2, r);
  ctx.save();
  ctx.filter = 'blur(6px)';
  box(4, 16);
  ctx.strokeStyle = 'rgba(255,150,60,0.8)';
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.restore();
  box(4, 16);
  ctx.strokeStyle = '#1a0806';
  ctx.lineWidth = 10;
  ctx.stroke();
  box(4, 16);
  ctx.strokeStyle = goldGrad(ctx, 0, 0, w, h);
  ctx.lineWidth = 6;
  ctx.stroke();
  box(10, 11);
  ctx.strokeStyle = 'rgba(255,236,180,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (const [x, y] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = goldGrad(ctx, -10, -10, 10, 10);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#1a0806';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    const g = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, 6);
    g.addColorStop(0, '#ffd0c8');
    g.addColorStop(0.45, '#ff2a36');
    g.addColorStop(1, '#5a0008');
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  return c;
}

/**
 * Title banner for the big screens: a black-lacquer band with rounded cartouche ends, polished
 * gold rails, a thin lapis/gold/carnelian block border, and a winged sun spreading over the top.
 * Returns the canvas and the y of the band's centre within it (the sprite's anchor).
 */
export function paintBanner(width: number, height: number, tone: 'dark' | 'red'): { canvas: HTMLCanvasElement; cy: number } {
  const S = 2;
  const top = height * 0.55;
  const W = width + 40;
  const H = height + top + 20;
  const [c, ctx] = makeCanvas(W * S, H * S);
  ctx.scale(S, S);
  const x0 = 20;
  const y0 = top;
  const r = height / 2;
  // soft drop shadow
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rr(ctx, x0 + 6, y0 + 12, width - 12, height, r);
  ctx.fill();
  ctx.restore();
  // gold rim
  rr(ctx, x0, y0, width, height, r);
  ctx.fillStyle = goldGrad(ctx, 0, y0, 0, y0 + height);
  ctx.fill();
  // lacquer body
  const inset = 7;
  rr(ctx, x0 + inset, y0 + inset, width - inset * 2, height - inset * 2, r - inset);
  const body = ctx.createLinearGradient(0, y0, 0, y0 + height);
  if (tone === 'red') {
    body.addColorStop(0, '#5a0a10');
    body.addColorStop(0.5, '#2a0306');
    body.addColorStop(1, '#120103');
  } else {
    body.addColorStop(0, '#2a1610');
    body.addColorStop(0.5, '#120807');
    body.addColorStop(1, '#060203');
  }
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // inner glow from the centre, glossy top and a block border along the bottom
  const glow = ctx.createRadialGradient(x0 + width / 2, y0 + height / 2, 0, x0 + width / 2, y0 + height / 2, width * 0.5);
  glow.addColorStop(0, tone === 'red' ? 'rgba(255,60,40,0.28)' : 'rgba(255,190,90,0.16)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x0, y0, width, height);
  const gl = ctx.createLinearGradient(0, y0, 0, y0 + height * 0.45);
  gl.addColorStop(0, 'rgba(255,240,210,0.22)');
  gl.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x0, y0, width, height * 0.45);
  const by = y0 + height - inset - 12;
  const colors = ['#1f42a8', '#f2c25a', '#c92a1c', '#f2c25a'];
  for (let x = x0 + r * 0.6, k = 0; x < x0 + width - r * 0.6; x += 10, k++) {
    ctx.fillStyle = colors[k % 4];
    ctx.fillRect(x, by, 9, 6);
  }
  ctx.restore();
  // fine gold inner line
  rr(ctx, x0 + inset + 5, y0 + inset + 5, width - (inset + 5) * 2, height - (inset + 5) * 2, r - inset - 5);
  ctx.strokeStyle = 'rgba(242,194,90,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // highlight along the top rail
  ctx.strokeStyle = 'rgba(255,250,225,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0 + 1.5);
  ctx.lineTo(x0 + width - r, y0 + 1.5);
  ctx.stroke();
  // winged sun crowning the banner
  wingedSun(ctx, x0 + width / 2, y0 - 2, Math.min(width * 0.32, height * 2.1));
  return { canvas: c, cy: (y0 + height / 2) / H };
}

/** Gold cartouche for amounts: pill with a polished rim and a lacquer face. */
export function paintCartouche(width: number, height: number): HTMLCanvasElement {
  const S = 2;
  const W = width + 40;
  const H = height + 40;
  const [c, ctx] = makeCanvas(W * S, H * S);
  ctx.scale(S, S);
  const x0 = 20;
  const y0 = 16;
  const r = height / 2;
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  rr(ctx, x0 + 4, y0 + 10, width - 8, height, r);
  ctx.fill();
  ctx.restore();
  rr(ctx, x0, y0, width, height, r);
  ctx.fillStyle = goldGrad(ctx, 0, y0, 0, y0 + height);
  ctx.fill();
  rr(ctx, x0 + 5, y0 + 5, width - 10, height - 10, r - 5);
  ctx.fillStyle = '#0a0405';
  ctx.fill();
  rr(ctx, x0 + 9, y0 + 9, width - 18, height - 18, r - 9);
  const face = ctx.createLinearGradient(0, y0, 0, y0 + height);
  face.addColorStop(0, '#24110b');
  face.addColorStop(0.55, '#0e0605');
  face.addColorStop(1, '#050202');
  ctx.fillStyle = face;
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,194,90,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  const gl = ctx.createLinearGradient(0, y0, 0, y0 + height * 0.5);
  gl.addColorStop(0, 'rgba(255,230,190,0.16)');
  gl.addColorStop(1, 'rgba(255,230,190,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x0, y0, width, height * 0.5);
  ctx.restore();
  return c;
}

/** Soft volumetric light rays (white, transparent background) for the big screens. */
export function paintSoftRays(size = 1024): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const cx = size / 2;
  const n = 30;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.filter = 'blur(10px)';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.08;
    const wdt = 0.025 + rnd() * 0.07;
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    const k = 0.35 + rnd() * 0.65;
    g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`);
    g.addColorStop(0.3, `rgba(255,255,255,${0.45 * k})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.arc(cx, cx, cx, a - wdt, a + wdt);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Reliquary frame for the "the Book picks a strain" draw: polished gold, lacquer well, gems. */
export function paintShrineFrame(w: number, h: number): HTMLCanvasElement {
  const S = 2;
  const pad = 24;
  const [c, ctx] = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S);
  ctx.scale(S, S);
  ctx.translate(pad, pad);
  ctx.save();
  ctx.filter = 'blur(12px)';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  rr(ctx, 4, 12, w - 8, h, 30);
  ctx.fill();
  ctx.restore();
  rr(ctx, 0, 0, w, h, 30);
  ctx.fillStyle = goldGrad(ctx, 0, 0, w * 0.3, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,4,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // engraved groove
  rr(ctx, 9, 9, w - 18, h - 18, 24);
  ctx.strokeStyle = 'rgba(70,36,4,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  rr(ctx, 11, 11, w - 22, h - 22, 22);
  ctx.strokeStyle = 'rgba(255,245,210,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // lacquer well
  const m = 22;
  rr(ctx, m, m, w - m * 2, h - m * 2, 16);
  const well = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w * 0.6);
  well.addColorStop(0, '#2a0c08');
  well.addColorStop(1, '#070203');
  ctx.fillStyle = well;
  ctx.fill();
  ctx.strokeStyle = '#0a0405';
  ctx.lineWidth = 3;
  ctx.stroke();
  rr(ctx, m + 5, m + 5, w - (m + 5) * 2, h - (m + 5) * 2, 12);
  ctx.strokeStyle = 'rgba(242,194,90,0.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // top sheen on the gold
  ctx.save();
  rr(ctx, 0, 0, w, h, 30);
  ctx.clip();
  const sh = ctx.createLinearGradient(0, 0, w, h);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.3, 'rgba(255,250,225,0.35)');
  sh.addColorStop(0.38, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, m + 4);
  ctx.fillRect(0, 0, m + 4, h);
  ctx.restore();
  for (const [x, y] of [[m * 0.5, m * 0.5], [w - m * 0.5, m * 0.5], [m * 0.5, h - m * 0.5], [w - m * 0.5, h - m * 0.5]]) gem(ctx, x, y, 8);
  return c;
}

/** Gold arrowhead pointing right (mirror it for the left one). */
export function paintArrowHead(): HTMLCanvasElement {
  const S = 2;
  const [c, ctx] = makeCanvas(48 * S, 56 * S);
  ctx.scale(S, S);
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(42, 28);
  ctx.lineTo(6, 50);
  ctx.lineTo(16, 28);
  ctx.closePath();
  ctx.fillStyle = goldGrad(ctx, 0, 6, 0, 50);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,24,2,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return c;
}
