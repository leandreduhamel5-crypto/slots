/** Procedural Canvas2D painters for frame, reel panels and decor. Everything is drawn once and cached as a texture. */

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d')!];
}

export function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Speckle noise clipped to the current path. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, n: number, light = 0.05, dark = 0.18): void {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const s = rnd() * 2.2 + 0.4;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${rnd() * light})` : `rgba(0,0,0,${rnd() * dark})`;
    ctx.fillRect(x, y, s, s);
  }
}

function gem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = r * 1.6;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffd0c0');
  g.addColorStop(0.3, '#ff3a4a');
  g.addColorStop(0.75, '#a0001a');
  g.addColorStop(1, '#2a0006');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function goldPlate(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#f6dca0');
  g.addColorStop(0.45, '#a8783c');
  g.addColorStop(1, '#3a220a');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#1a0f05';
  ctx.lineWidth = 2;
  // quatrefoil
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.moveTo(x + Math.cos(a) * r * 0.45 + r * 0.55, y + Math.sin(a) * r * 0.45);
    ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.55, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = '#120a06';
  ctx.fill();
  gem(ctx, x, y, r * 0.42);
}

function tendril(ctx: CanvasRenderingContext2D, pts: number[], width: number, rnd: () => number): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i + 3 < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  ctx.strokeStyle = '#1a0206';
  ctx.lineWidth = width + 4;
  ctx.stroke();
  path();
  const g = ctx.createLinearGradient(pts[0], pts[1], pts[pts.length - 2], pts[pts.length - 1]);
  g.addColorStop(0, '#6a0a1a');
  g.addColorStop(1, '#2a0208');
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 10;
  path();
  ctx.strokeStyle = 'rgba(255,60,80,0.85)';
  ctx.lineWidth = Math.max(1, width * 0.18);
  ctx.stroke();
  ctx.restore();
  // pustules along the tendril
  for (let i = 2; i + 3 < pts.length; i += 4) {
    if (rnd() < 0.6) {
      const r = 2 + rnd() * width * 0.45;
      const x = pts[i + 2] + (rnd() - 0.5) * width;
      const y = pts[i + 3] + (rnd() - 0.5) * width;
      const pg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      pg.addColorStop(0, '#fff0d0');
      pg.addColorStop(0.4, '#ff5a3a');
      pg.addColorStop(1, '#6a0010');
      ctx.save();
      ctx.shadowColor = '#ff2a3d';
      ctx.shadowBlur = 8;
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + len);
  g.addColorStop(0, '#5a0010');
  g.addColorStop(1, '#d0102a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.5, y + len * 0.6, x - w * 0.9, y + len);
  ctx.arc(x, y + len, w, Math.PI, 0, true);
  ctx.quadraticCurveTo(x + w * 0.5, y + len * 0.6, x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,210,210,0.55)';
  ctx.beginPath();
  ctx.arc(x - w * 0.35, y + len - w * 0.2, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

export interface FrameSpec {
  boardW: number;
  boardH: number;
  pad: number;
  bleed: number;
  reelX: (r: number) => number;
  cellW: number;
  reels: number;
}

/** Ornate gothic metal frame overgrown with infected tendrils; the board area stays transparent. */
export function paintFrame(s: FrameSpec): HTMLCanvasElement {
  const W = s.boardW + s.pad * 2;
  const H = s.boardH + s.pad * 2;
  const [c, ctx] = makeCanvas(W + s.bleed * 2, H + s.bleed * 2);
  const rnd = seeded(1337);
  ctx.translate(s.bleed, s.bleed);
  const inner = { x: s.pad - 4, y: s.pad - 4, w: s.boardW + 8, h: s.boardH + 8 };

  // outer glow
  ctx.save();
  ctx.shadowColor = 'rgba(255,42,61,0.55)';
  ctx.shadowBlur = 40;
  rrect(ctx, 0, 0, W, H, 22);
  ctx.fillStyle = '#0b0c10';
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.shadowBlur = 0;
  rrect(ctx, inner.x, inner.y, inner.w, inner.h, 10);
  ctx.fill();
  ctx.restore();

  // metal ring
  ctx.save();
  rrect(ctx, 0, 0, W, H, 22);
  ctx.roundRect(inner.x, inner.y, inner.w, inner.h, 10);
  ctx.clip('evenodd');
  const metal = ctx.createLinearGradient(0, 0, 0, H);
  metal.addColorStop(0, '#3a414e');
  metal.addColorStop(0.08, '#1d2129');
  metal.addColorStop(0.5, '#14171d');
  metal.addColorStop(0.92, '#1d2129');
  metal.addColorStop(1, '#0a0b0e');
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, rnd, 9000, 0.06, 0.25);
  // engraved channel
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  rrect(ctx, 11, 11, W - 22, H - 22, 16);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(195,149,85,0.35)';
  ctx.lineWidth = 1.2;
  rrect(ctx, 12.5, 12.5, W - 25, H - 25, 15);
  ctx.stroke();
  // gothic notches on the channel
  ctx.fillStyle = 'rgba(195,149,85,0.4)';
  for (let x = 70; x < W - 70; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 5, 14);
    ctx.lineTo(x, 20);
    ctx.lineTo(x - 5, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, H - 8);
    ctx.lineTo(x + 5, H - 14);
    ctx.lineTo(x, H - 20);
    ctx.lineTo(x - 5, H - 14);
    ctx.fill();
  }
  ctx.restore();

  // bevels
  ctx.strokeStyle = 'rgba(200,210,230,0.22)';
  ctx.lineWidth = 2;
  rrect(ctx, 1, 1, W - 2, H - 2, 21);
  ctx.stroke();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  rrect(ctx, inner.x - 1, inner.y - 1, inner.w + 2, inner.h + 2, 11);
  ctx.stroke();

  // inner infected lip
  ctx.save();
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 22;
  ctx.strokeStyle = 'rgba(255,42,61,0.95)';
  ctx.lineWidth = 2.5;
  rrect(ctx, inner.x + 1, inner.y + 1, inner.w - 2, inner.h - 2, 9);
  ctx.stroke();
  ctx.stroke();
  ctx.restore();

  // reel separators: thin iron bars with rivets
  for (let r = 1; r < s.reels; r++) {
    const x = s.pad + s.reelX(r) - 5;
    const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
    g.addColorStop(0, '#0a0b0e');
    g.addColorStop(0.5, '#3a414e');
    g.addColorStop(1, '#0a0b0e');
    ctx.fillStyle = g;
    ctx.fillRect(x - 3, s.pad, 6, s.boardH);
    for (const y of [s.pad + 10, s.pad + s.boardH / 2, s.pad + s.boardH - 10]) {
      ctx.fillStyle = '#c39555';
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6e3b5';
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // tendrils creeping from the corners over the frame
  const T = (pts: number[], w: number) => tendril(ctx, pts, w, rnd);
  T([-10, 60, 20, 30, 60, 22, 110, 14, 170, 18, 230, 22, 270, 8], 9);
  T([-6, 90, 10, 140, 6, 190, 4, 240, 14, 280], 7);
  T([W + 10, H - 70, W - 30, H - 20, W - 90, H - 18, W - 150, H - 10, W - 220, H - 16], 9);
  T([W + 6, H - 110, W - 6, H - 170, W - 2, H - 230, W - 12, H - 280], 6);
  T([W + 4, 40, W - 40, 14, W - 100, 22, W - 140, 6], 6);
  T([-4, H - 40, 40, H - 10, 90, H - 18, 120, H - 4], 6);

  // corner ornaments
  const co = 26;
  for (const [x, y] of [
    [co - 6, co - 6],
    [W - co + 6, co - 6],
    [co - 6, H - co + 6],
    [W - co + 6, H - co + 6],
  ]) {
    // spikes
    ctx.fillStyle = '#20242c';
    const dx = x < W / 2 ? -1 : 1;
    const dy = y < H / 2 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x + dx * 10, y);
    ctx.lineTo(x + dx * 46, y + dy * 46);
    ctx.lineTo(x, y + dy * 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,210,230,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    goldPlate(ctx, x, y, 24);
  }
  // side gems
  for (const [x, y] of [
    [0, H / 2],
    [W, H / 2],
  ]) {
    goldPlate(ctx, x, y, 18);
  }

  // blood dripping off the bottom edge
  for (let i = 0; i < 9; i++) {
    const x = 90 + rnd() * (W - 180);
    drip(ctx, x, H - 3, 10 + rnd() * 34, 2.5 + rnd() * 2.5);
  }
  return c;
}

/** Background of one reel column: recessed panel with faint organic texture. */
export function paintReelPanel(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const rnd = seeded(seed);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#07080b');
  g.addColorStop(0.15, '#12151c');
  g.addColorStop(0.5, '#171a22');
  g.addColorStop(0.85, '#12151c');
  g.addColorStop(1, '#07080b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, rnd, 1600, 0.03, 0.15);
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#ff2a3d';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    let x = rnd() * w;
    let y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < h) {
      x += (rnd() - 0.5) * 30;
      y += 20 + rnd() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, h * 0.6);
  v.addColorStop(0, 'rgba(90,0,16,0.10)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Top/bottom inner shadow that gives the reel window depth. */
export function paintDepthShade(h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(4, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0.92)');
  g.addColorStop(0.12, 'rgba(0,0,0,0.25)');
  g.addColorStop(0.2, 'rgba(0,0,0,0)');
  g.addColorStop(0.8, 'rgba(0,0,0,0)');
  g.addColorStop(0.88, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  return c;
}

/** Glowing bracket frame drawn around each winning cell. */
export function paintWinFrame(w: number, h: number): HTMLCanvasElement {
  const b = 18;
  const [c, ctx] = makeCanvas(w + b * 2, h + b * 2);
  ctx.translate(b, b);
  ctx.save();
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = 'rgba(255,42,61,0.9)';
  ctx.lineWidth = 3;
  rrect(ctx, 4, 4, w - 8, h - 8, 12);
  ctx.stroke();
  ctx.restore();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#f6dca0');
  g.addColorStop(1, '#a8783c');
  ctx.strokeStyle = g;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const L = 26;
  const corners: [number, number, number, number][] = [
    [2, 2, 1, 1],
    [w - 2, 2, -1, 1],
    [2, h - 2, 1, -1],
    [w - 2, h - 2, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
    ctx.stroke();
    gem(ctx, x + dx * 3, y + dy * 3, 4);
  }
  return c;
}

/** One vertical hanging chain strip. */
export function paintChain(len: number): HTMLCanvasElement {
  const lw = 22;
  const lh = 34;
  const [c, ctx] = makeCanvas(lw + 8, len);
  for (let y = 0, i = 0; y < len; y += lh - 8, i++) {
    ctx.save();
    ctx.translate(lw / 2 + 4, y + lh / 2);
    const g = ctx.createLinearGradient(-lw / 2, 0, lw / 2, 0);
    g.addColorStop(0, '#0a0b0e');
    g.addColorStop(0.45, i % 2 ? '#3a414e' : '#5a6474');
    g.addColorStop(1, '#0a0b0e');
    ctx.strokeStyle = g;
    if (i % 2) {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -lh / 2);
      ctx.lineTo(0, lh / 2);
      ctx.stroke();
    } else {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, lw / 2 - 3, lh / 2 - 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  return c;
}

/**
 * Glow map of a symbol: only its bright / saturated parts (eyes, veins, liquid, gems), blurred.
 * Added on top with additive blending, it makes the symbol "light up" on wins.
 */
export function glowMap(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const [mc, m] = makeCanvas(w, h);
  m.drawImage(src, 0, 0);
  const img = m.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    const keep = a > 120 && ((max > 170 && sat > 0.55) || max > 235);
    if (!keep) d[i + 3] = 0;
    else d[i + 3] = Math.min(255, (max - 120) * 2.2);
  }
  m.putImageData(img, 0, 0);
  // colour-preserving blur: offset copies on rings (works without ctx.filter support)
  const [c, ctx] = makeCanvas(w, h);
  ctx.globalCompositeOperation = 'lighter';
  for (const [radius, alpha] of [
    [14, 0.07],
    [8, 0.1],
    [4, 0.14],
  ]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(mc, Math.cos(a) * radius, Math.sin(a) * radius);
    }
  }
  ctx.globalAlpha = 0.9;
  ctx.drawImage(mc, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return c;
}
