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

/** Brushed-gold fill for a band, lit from the top. */
function goldBand(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, vertical = false): CanvasGradient {
  const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#fff4c4');
  g.addColorStop(0.15, '#f6c95a');
  g.addColorStop(0.42, '#a8661a');
  g.addColorStop(0.58, '#5a3208');
  g.addColorStop(0.78, '#d79a34');
  g.addColorStop(1, '#6a3a08');
  return g;
}

/** Big winged sun crowning the frame: three tiers of feathers sweeping up and out, a gold disc, a ruby. */
function grandWingedSun(ctx: CanvasRenderingContext2D, x: number, y: number, span: number): void {
  const tiers: [number, string | null][] = [[1, null], [0.78, 'lapis'], [0.56, null]];
  tiers.forEach(([k, kind], row) => {
    for (const side of [-1, 1]) {
      const len = span * k;
      const n = 10 - row * 2;
      for (let i = n - 1; i >= 0; i--) {
        const t = i / (n - 1);
        // feathers fan out along a gentle upward arc
        const fx = x + side * (span * 0.1 + t * (len - span * 0.1));
        const fy = y - 4 - row * 7 - Math.sin(t * Math.PI * 0.9) * span * 0.06 + t * t * span * 0.03;
        const fh = span * (0.085 - row * 0.012) * (1 - t * 0.5);
        const fw = (len - span * 0.1) / (n - 1) + 8;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(side * (-0.18 + t * 0.32));
        ctx.beginPath();
        ctx.moveTo(-fw / 2, fh * 0.35);
        ctx.lineTo(fw / 2, fh * 0.35);
        ctx.quadraticCurveTo(fw / 2 + side * fw * 0.25, -fh * 0.4, 0, -fh);
        ctx.quadraticCurveTo(-fw / 2 - side * fw * 0.1, -fh * 0.4, -fw / 2, fh * 0.35);
        ctx.closePath();
        ctx.fillStyle = kind === 'lapis' ? (i % 2 ? '#1f42a8' : '#3060d0') : goldGrad(ctx, -fw, -fh, fw, fh);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,18,2,0.85)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,245,210,0.45)';
        ctx.beginPath();
        ctx.moveTo(0, fh * 0.2);
        ctx.lineTo(0, -fh * 0.75);
        ctx.stroke();
        ctx.restore();
      }
    }
  });
  const r = span * 0.11;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.35, r, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad(ctx, x - r, y - r * 1.35, x + r, y + r * 0.65);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,2,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  gem(ctx, x, y - r * 0.35, r * 0.62);
}

/** Lotus capital / base on the side columns. */
function capital(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, flip: boolean): void {
  const h = w * 0.7;
  const d = flip ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, d);
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, 0);
  ctx.bezierCurveTo(-w * 0.55, -h * 0.3, -w * 0.6, -h * 0.8, -w * 0.5, -h);
  ctx.lineTo(w * 0.5, -h);
  ctx.bezierCurveTo(w * 0.6, -h * 0.8, w * 0.55, -h * 0.3, w * 0.32, 0);
  ctx.closePath();
  ctx.fillStyle = goldGrad(ctx, -w / 2, -h, w / 2, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,2,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,30,4,0.6)';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * w * 0.09, -2);
    ctx.quadraticCurveTo(i * w * 0.16, -h * 0.5, i * w * 0.2, -h + 3);
    ctx.stroke();
  }
  ctx.fillStyle = goldGrad(ctx, -w / 2, -h - 8, w / 2, -h);
  ctx.fillRect(-w * 0.58, -h - 8, w * 1.16, 9);
  ctx.restore();
}

export function paintEgyptFrame(s: EgyptFrameSpec): HTMLCanvasElement {
  const W = s.boardW + s.pad * 2;
  const H = s.boardH + s.pad * 2;
  const [c, ctx] = makeCanvas(W + s.bleed * 2, H + s.bleed * 2);
  ctx.translate(s.bleed, s.bleed);
  const inner = { x: s.pad - 4, y: s.pad - 4, w: s.boardW + 8, h: s.boardH + 8 };

  // drop shadow outside the frame
  ctx.save();
  ctx.filter = 'blur(20px)';
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  rr(ctx, 4, 18, W, H, 10);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 4);
  ctx.fill();
  ctx.restore();

  // body: dark lacquer behind the gold work
  ctx.save();
  rr(ctx, 0, 0, W, H, 10);
  ctx.roundRect(inner.x, inner.y, inner.w, inner.h, 4);
  ctx.clip('evenodd');
  ctx.fillStyle = '#120706';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // top and bottom rails: gold, a lapis/carnelian inlay band, engraved ticks
  const rail = (y: number, h: number) => {
    ctx.fillStyle = goldBand(ctx, 0, y, W, h);
    ctx.fillRect(0, y, W, h);
    ctx.strokeStyle = 'rgba(40,18,2,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, y + 0.75, W - 1.5, h - 1.5);
    const by = y + h * 0.36;
    const bh = h * 0.28;
    for (let x = 30, k = 0; x < W - 30; x += 16, k++) {
      ctx.fillStyle = k % 4 === 0 ? '#c92a1c' : k % 2 ? '#1f42a8' : '#f2c25a';
      ctx.fillRect(x, by, 14, bh);
    }
    ctx.fillStyle = 'rgba(255,248,220,0.6)';
    ctx.fillRect(2, y + 2, W - 4, 1.5);
  };
  rail(0, s.pad - 6);
  rail(H - s.pad + 6, s.pad - 6);

  // side columns: fluted gold shafts with lotus capitals
  const colW = s.pad - 2;
  for (const x0 of [0, W - colW]) {
    ctx.fillStyle = goldBand(ctx, x0, 0, colW, H, true);
    ctx.fillRect(x0, s.pad - 8, colW, H - (s.pad - 8) * 2);
    ctx.strokeStyle = 'rgba(40,18,2,0.55)';
    ctx.lineWidth = 1.2;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(x0 + (colW * k) / 4, s.pad);
      ctx.lineTo(x0 + (colW * k) / 4, H - s.pad);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(40,18,2,0.9)';
    ctx.strokeRect(x0 + 0.75, s.pad - 8, colW - 1.5, H - (s.pad - 8) * 2);
    capital(ctx, x0 + colW / 2, s.pad + 30, colW * 1.3, false);
    capital(ctx, x0 + colW / 2, H - s.pad - 30, colW * 1.3, true);
  }

  // inner window lip: a thin bright gold bead and a deep shadow into the reels
  ctx.save();
  rr(ctx, inner.x - 4, inner.y - 4, inner.w + 8, inner.h + 8, 6);
  ctx.lineWidth = 5;
  ctx.strokeStyle = goldGrad(ctx, inner.x, inner.y, inner.x + 60, inner.y + inner.h);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(30,12,2,0.95)';
  rr(ctx, inner.x - 1, inner.y - 1, inner.w + 2, inner.h + 2, 4);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 4);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.filter = 'blur(10px)';
  ctx.lineWidth = 26;
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 4);
  ctx.stroke();
  ctx.restore();

  // corner blocks with rubies
  for (const [x, y] of [[colW / 2, s.pad / 2 - 3], [W - colW / 2, s.pad / 2 - 3], [colW / 2, H - s.pad / 2 + 3], [W - colW / 2, H - s.pad / 2 + 3]]) {
    ctx.fillStyle = goldGrad(ctx, x - 26, y - 26, x + 26, y + 26);
    rr(ctx, x - 26, y - 24, 52, 48, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,18,2,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    rr(ctx, x - 18, y - 16, 36, 32, 4);
    ctx.strokeStyle = 'rgba(255,240,200,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    gem(ctx, x, y, 11);
  }
  // the crown: a great winged sun over the top rail, a small one under the bottom rail
  grandWingedSun(ctx, W / 2, s.pad / 2 - 4, Math.min(W * 0.3, 380));
  wingedSun(ctx, W / 2, H - s.pad / 2 + 3, 110);
  // nothing may cover the reels
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 4);
  ctx.fill();
  ctx.restore();
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
  face.addColorStop(0, '#1c3172');
  face.addColorStop(0.55, '#101d4c');
  face.addColorStop(1, '#0a1230');
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
/** A grain of gold sand: small and crisp, not a soft dot. */
export function paintGrain(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.translate(32, 32);
  const g = ctx.createRadialGradient(-7, -8, 1, 0, 0, 26);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, '#ffe9a8');
  g.addColorStop(1, '#c98a24');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 18 + ((i * 5) % 3) * 4;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  return c;
}

/** What flies off the rail: torn leaves of gold, and a few tiny gold charms (ankh, lotus, eye). */
export function paintGoldFlakes(): HTMLCanvasElement[] {
  const gold = (ctx: CanvasRenderingContext2D) => {
    const g = ctx.createLinearGradient(-20, -24, 20, 24);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(0.42, '#f2c25a');
    g.addColorStop(0.72, '#b87a1c');
    g.addColorStop(1, '#ffe08a');
    return g;
  };
  const make = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    const [c, ctx] = makeCanvas(64, 64);
    ctx.translate(32, 32);
    ctx.fillStyle = ctx.strokeStyle = gold(ctx);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(40,18,0,0.8)';
    ctx.shadowBlur = 3;
    draw(ctx);
    return c;
  };
  const leaf = (pts: [number, number][]) => (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  };
  return [
    make(leaf([[-4, -24], [15, -11], [20, 8], [3, 24], [-15, 13], [-20, -7]])),
    make(leaf([[0, -26], [11, -3], [6, 21], [-9, 24], [-14, -2]])),
    make(leaf([[-20, -13], [5, -22], [22, -2], [11, 17], [-13, 12]])),
    // ankh
    make((ctx) => {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, -14, 7.5, 10, 0, 0, Math.PI * 2);
      ctx.moveTo(0, -4);
      ctx.lineTo(0, 26);
      ctx.moveTo(-15, 4);
      ctx.lineTo(15, 4);
      ctx.stroke();
    }),
    // lotus
    make((ctx) => {
      for (const a of [-0.95, -0.48, 0, 0.48, 0.95]) {
        ctx.save();
        ctx.translate(0, 19);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(10, -18, 0, -38);
        ctx.quadraticCurveTo(-10, -18, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }),
    // eye
    make((ctx) => {
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-24, -1);
      ctx.quadraticCurveTo(0, -20, 24, -1);
      ctx.quadraticCurveTo(0, 14, -24, -1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-5, 9);
      ctx.quadraticCurveTo(-4, 24, -14, 22);
      ctx.moveTo(8, 8);
      ctx.lineTo(18, 21);
      ctx.stroke();
    }),
  ];
}

/** A small cut ruby in a gold bezel. */
export function paintGem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r + r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad(ctx, x - r, y - r, x + r, y + r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,24,2,0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.5, x, y, r);
  g.addColorStop(0, '#ffb4a0');
  g.addColorStop(0.4, '#e01830');
  g.addColorStop(1, '#5a0410');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

/** Lapis flecked with gold. */
function lapis(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const g = ctx.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h / 2, Math.max(w, h) * 0.62);
  g.addColorStop(0, '#1d3c8c');
  g.addColorStop(0.55, '#102258');
  g.addColorStop(1, '#050a20');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = seeded(seed);
  for (let i = 0; i < (w * h) / 900; i++) {
    ctx.fillStyle = `rgba(255,214,130,${0.06 + r() * 0.34})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

/**
 * The plaque of the big screens, of one family with the frame: a pylon of gold with stepped
 * corners and a rubied rim, round a well of lapis.
 */
export function paintPlaque(w: number, h: number): HTMLCanvasElement {
  const S = 2;
  const pad = 30;
  const [c, ctx] = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S);
  ctx.scale(S, S);
  ctx.translate(pad, pad);
  const STEP = 30;
  const pylon = (i: number) => {
    const s = STEP;
    ctx.beginPath();
    ctx.moveTo(i + s, i);
    ctx.lineTo(w - i - s, i);
    ctx.lineTo(w - i - s, i + s);
    ctx.lineTo(w - i, i + s);
    ctx.lineTo(w - i, h - i - s);
    ctx.lineTo(w - i - s, h - i - s);
    ctx.lineTo(w - i - s, h - i);
    ctx.lineTo(i + s, h - i);
    ctx.lineTo(i + s, h - i - s);
    ctx.lineTo(i, h - i - s);
    ctx.lineTo(i, i + s);
    ctx.lineTo(i + s, i + s);
    ctx.closePath();
  };
  ctx.save();
  ctx.filter = 'blur(14px)';
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  pylon(0);
  ctx.fill();
  ctx.restore();
  pylon(0);
  ctx.fillStyle = goldGrad(ctx, 0, 0, w * 0.22, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,24,2,0.95)';
  ctx.lineWidth = 2;
  ctx.stroke();
  pylon(3);
  ctx.strokeStyle = 'rgba(255,246,214,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // the rim is engraved all the way round
  ctx.fillStyle = 'rgba(70,36,4,0.8)';
  const tick = (x: number, y: number, flat: boolean) => {
    ctx.beginPath();
    const [a, b] = flat ? [8, 4.2] : [4.2, 8];
    ctx.moveTo(x - a, y);
    ctx.lineTo(x, y - b);
    ctx.lineTo(x + a, y);
    ctx.lineTo(x, y + b);
    ctx.closePath();
    ctx.fill();
  };
  for (let x = STEP + 34; x < w - STEP - 24; x += 34) {
    tick(x, 11, true);
    tick(x, h - 11, true);
  }
  for (let y = STEP + 30; y < h - STEP - 20; y += 34) {
    tick(11, y, false);
    tick(w - 11, y, false);
  }
  const well = 22;
  ctx.save();
  pylon(well);
  ctx.clip();
  ctx.translate(well, well);
  lapis(ctx, w - well * 2, h - well * 2, 41);
  ctx.restore();
  pylon(well);
  ctx.strokeStyle = '#080408';
  ctx.lineWidth = 3;
  ctx.stroke();
  pylon(well + 5);
  ctx.strokeStyle = 'rgba(242,194,90,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (const [x, y] of [[STEP - 2, STEP - 2], [w - STEP + 2, STEP - 2], [STEP - 2, h - STEP + 2], [w - STEP + 2, h - STEP + 2]]) paintGem(ctx, x, y, 9);
  return c;
}

/** Sinks the ends of the strain drum into the dark. */
export function paintDrumShade(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(3,7,26,0.96)');
  g.addColorStop(0.28, 'rgba(3,7,26,0)');
  g.addColorStop(0.72, 'rgba(3,7,26,0)');
  g.addColorStop(1, 'rgba(3,7,26,0.96)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(3,7,26,0.55)');
  v.addColorStop(0.22, 'rgba(3,7,26,0)');
  v.addColorStop(0.78, 'rgba(3,7,26,0)');
  v.addColorStop(1, 'rgba(3,7,26,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** A cartouche for amounts: gold round lapis, a ruby at each end. Stretches between its end caps. */
export function paintSeal(): HTMLCanvasElement {
  const S = 2;
  const pad = 14;
  const w = 520;
  const h = 150;
  const [c, ctx] = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S);
  ctx.scale(S, S);
  ctx.translate(pad, pad);
  const pill = (i: number) => {
    ctx.beginPath();
    ctx.roundRect(i, i, w - i * 2, h - i * 2, (h - i * 2) / 2);
  };
  ctx.save();
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  pill(0);
  ctx.fill();
  ctx.restore();
  pill(0);
  ctx.fillStyle = goldGrad(ctx, 0, 0, 0, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(50,24,2,0.95)';
  ctx.lineWidth = 2;
  ctx.stroke();
  pill(3);
  ctx.strokeStyle = 'rgba(255,246,214,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  pill(12);
  ctx.clip();
  ctx.translate(12, 12);
  lapis(ctx, w - 24, h - 24, 53);
  ctx.restore();
  pill(12);
  ctx.strokeStyle = '#080408';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  pill(17);
  ctx.strokeStyle = 'rgba(242,194,90,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  paintGem(ctx, 44, h / 2, 13);
  paintGem(ctx, w - 44, h / 2, 13);
  return c;
}

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

/**
 * The band between the reels and the frame: lapis lazuli inlaid with gold hieroglyphs, the same
 * materials as the frame, so that this margin reads as part of it. (mx, my) is where the reels
 * start, (rw, rh) their size.
 */
export function paintReelSurround(w: number, h: number, mx: number, my: number, rw: number, rh: number): HTMLCanvasElement {
  const rnd = seeded(23);
  const [c, ctx] = makeCanvas(w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, '#16275c');
  g.addColorStop(1, '#0b1436');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // veins of the stone
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rnd() < 0.7 ? `rgba(6,10,34,${0.2 + rnd() * 0.3})` : `rgba(120,160,255,${0.04 + rnd() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, 1 + rnd() * 7, 0.6 + rnd() * 2, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,214,130,${0.25 + rnd() * 0.5})`; // flecks of pyrite, as in real lapis
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, 0.5 + rnd() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  const glyph = (kind: number, x: number, y: number, k: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.beginPath();
    if (kind === 0) {
      ctx.ellipse(0, -9, 7, 9, 0, 0, Math.PI * 2);
      ctx.moveTo(-11, 2);
      ctx.lineTo(11, 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 19);
    } else if (kind === 1) {
      ctx.moveTo(-17, 0);
      ctx.quadraticCurveTo(0, -14, 17, 0);
      ctx.quadraticCurveTo(0, 11, -17, 0);
      ctx.moveTo(4, 0);
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
    } else if (kind === 2) {
      ctx.moveTo(0, 18);
      ctx.quadraticCurveTo(-13, 0, 2, -18);
      ctx.quadraticCurveTo(10, 0, 0, 18);
    } else if (kind === 3) {
      ctx.arc(0, -4, 11, 0, Math.PI * 2);
      ctx.moveTo(-15, 13);
      ctx.lineTo(15, 13);
    } else {
      ctx.moveTo(-14, 13);
      ctx.lineTo(0, -14);
      ctx.lineTo(14, 13);
      ctx.closePath();
    }
    for (const [col, off] of [['rgba(0,0,0,0.6)', 1.4], ['#d8a848', 0]] as const) {
      ctx.save();
      ctx.translate(off, off);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };
  // glyphs run along the four sides, in the open part of the band
  const sx = mx - 22;
  for (let y = my + 30, i = 0; y < my + rh - 16; y += 54, i++) {
    glyph(i % 5, sx, y, 0.72);
    glyph((i + 2) % 5, w - sx, y, 0.72);
  }
  const sy = my - 15;
  for (let x = mx + 36, i = 0; x < mx + rw - 20; x += 62, i++) {
    // the pendants of the frame hang over the middle of the top and bottom rows
    if (Math.abs(x - w / 2) < 86) continue;
    glyph((i + 1) % 5, x, sy, 0.46);
    glyph((i + 3) % 5, x, h - sy, 0.46);
  }
  // a gold bezel seats the reels in the band
  const bezel = (t: number, col: string, wd: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = wd;
    ctx.strokeRect(mx - t, my - t, rw + t * 2, rh + t * 2);
  };
  bezel(5, '#3a2008', 8);
  bezel(5, '#a8741e', 4);
  bezel(5, '#f0cc70', 1.2);
  return c;
}

/** The bonus panel: lapis in gold, two compartments and a ruby between them. Painted at 2×. */
export function paintBonusPanel(w: number, h: number): HTMLCanvasElement {
  const S = 2;
  const [c, ctx] = makeCanvas((w + 24) * S, (h + 24) * S);
  ctx.scale(S, S);
  ctx.translate(12, 12);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = goldGrad(ctx, 0, 0, 0, h);
  rr(ctx, 0, 0, w, h, 12);
  ctx.fill();
  ctx.restore();
  const face = ctx.createLinearGradient(0, 0, 0, h);
  face.addColorStop(0, '#1c3172');
  face.addColorStop(1, '#0a1230');
  ctx.fillStyle = face;
  rr(ctx, 4, 4, w - 8, h - 8, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,200,120,0.55)';
  ctx.lineWidth = 1;
  rr(ctx, 8, 8, w - 16, h - 16, 6);
  ctx.stroke();
  // the divider
  ctx.fillStyle = goldGrad(ctx, 0, 0, 0, h);
  ctx.fillRect(w / 2 - 1.5, 8, 3, h - 16);
  const g = ctx.createRadialGradient(w / 2 - 3, h / 2 - 4, 1, w / 2, h / 2, 12);
  g.addColorStop(0, '#ffd8c8');
  g.addColorStop(0.45, '#ff3a2a');
  g.addColorStop(1, '#6a0008');
  ctx.fillStyle = goldGrad(ctx, 0, h / 2 - 15, 0, h / 2 + 15);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 11, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/**
 * The sand in front of the temple, in three banks: moonlit crests, ripples drawn by the wind,
 * dark palms at the two ends. This is the ground the queen and the slot stand on.
 */
export function paintDunes(w: number, h: number): HTMLCanvasElement {
  const rnd = seeded(41);
  const [c, ctx] = makeCanvas(w, h);
  const bank = (base: number, amp: number, phase: number, top: string, low: string, crest: string) => {
    const y = (x: number) => base + Math.sin(x * 0.0021 + phase) * amp + Math.sin(x * 0.0057 + phase * 2) * amp * 0.34;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base - amp, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, low);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // ripples follow the shape of the bank
    for (let k = 0; k < 16; k++) {
      const dy = 12 + k * 15 + rnd() * 6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const yy = y(x) + dy + Math.sin(x * 0.019 + k * 1.3) * 3.2;
        if (x) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.strokeStyle = k % 2 ? 'rgba(0,0,0,0.13)' : 'rgba(255,220,180,0.05)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    // moonlight on the crest
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      if (x) ctx.lineTo(x, y(x));
      else ctx.moveTo(x, y(x));
    }
    ctx.strokeStyle = crest;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  const palm = (x: number, y: number, k: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = '#07040a';
    ctx.strokeStyle = '#07040a';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(16, -110, -6, -230);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i / 8) * Math.PI;
      const L = 112 + rnd() * 34;
      const ex = Math.cos(a) * L;
      const ey = Math.sin(a) * L * 0.5 + 30;
      ctx.beginPath();
      ctx.moveTo(-6, -232);
      ctx.quadraticCurveTo(ex * 0.5, -232 + Math.sin(a) * 66 - 22, ex - 6, -232 + ey);
      ctx.quadraticCurveTo(ex * 0.45, -232 + Math.sin(a) * 40 - 6, -6, -226);
      ctx.fill();
    }
    ctx.restore();
  };
  palm(w * 0.045, h * 0.52, 1.25);
  palm(w * 0.1, h * 0.6, 0.86);
  palm(w * 0.965, h * 0.5, 1.3);
  palm(w * 0.905, h * 0.62, 0.8);
  bank(h * 0.42, 40, 0.6, '#a8835c', '#5a3e30', 'rgba(255,232,190,0.6)');
  bank(h * 0.6, 34, 2.1, '#86633f', '#3c2820', 'rgba(255,226,180,0.45)');
  bank(h * 0.8, 22, 4.4, '#5c4230', '#1c1210', 'rgba(255,220,170,0.3)');
  return c;
}
