import { Texture } from 'pixi.js';
import { SYMBOLS, Sym } from '../math/config';
import { PREMIUM_SVGS, VEINS_SVG } from './art/symbols';
import { glowMap, paintChain, paintDepthShade, paintFrame, paintReelPanel, paintWinFrame } from './art/painters';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, REEL_GAP, reelX } from './layout';

export const FRAME_PAD = 34;
export const FRAME_BLEED = 60;

export const TEX_SIZE = 320;

export interface SymbolTextures {
  normal: Texture[];
  blur: Texture[];
  canvases: HTMLCanvasElement[];
  /** data URLs for DOM usage (paytable) */
  images: string[];
  expanded: Map<Sym, Texture>;
  /** additive glow maps that make each symbol light up on wins */
  glowMaps: Texture[];
  frame: Texture;
  reelPanels: Texture[];
  shade: Texture;
  winFrame: Texture;
  chain: Texture;
  veins: Texture;
  glow: Texture;
  spore: Texture;
}

const ROYALS: Record<string, { text: string; top: string; mid: string; bottom: string; glow: string }> = {
  a: { text: 'A', top: '#ff8a94', mid: '#e0122c', bottom: '#4a0010', glow: '#ff2a3d' },
  k: { text: 'K', top: '#e2ebf6', mid: '#7f93ad', bottom: '#1e2738', glow: '#8fb4ff' },
  q: { text: 'Q', top: '#ecc6ff', mid: '#9346bf', bottom: '#2a0b3d', glow: '#c06bff' },
  j: { text: 'J', top: '#fff6dc', mid: '#c9b083', bottom: '#4a3a1e', glow: '#ffe2a8' },
  ten: { text: '10', top: '#ffd2a0', mid: '#d0601c', bottom: '#4a1804', glow: '#ff8a3a' },
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function loadSvg(svg: string, w: number, h: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(w, h);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** Seeded so every royal gets the same cracks on every load. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawRoyal(key: string, seed: number): HTMLCanvasElement {
  const r = ROYALS[key];
  const S = TEX_SIZE;
  const [c, ctx] = canvas(S, S);
  const fontSize = r.text.length > 1 ? 168 : 212;
  ctx.font = `900 ${fontSize}px Cinzel, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = S / 2;
  const cy = S / 2 + 6;

  // Aura
  const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, S * 0.48);
  aura.addColorStop(0, hexA(r.glow, 0.28));
  aura.addColorStop(1, hexA(r.glow, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, S, S);

  // Letter in its own layer so cracks and veins can be clipped to it
  const [lc, l] = canvas(S, S);
  l.font = ctx.font;
  l.textAlign = 'center';
  l.textBaseline = 'middle';
  const grad = l.createLinearGradient(0, cy - fontSize / 2, 0, cy + fontSize / 2);
  grad.addColorStop(0, r.top);
  grad.addColorStop(0.45, r.mid);
  grad.addColorStop(1, r.bottom);
  l.lineJoin = 'round';
  l.lineWidth = 16;
  l.strokeStyle = '#050304';
  l.strokeText(r.text, cx, cy);
  l.fillStyle = grad;
  l.fillText(r.text, cx, cy);

  // Bevel highlight
  l.save();
  l.globalCompositeOperation = 'source-atop';
  const shine = l.createLinearGradient(0, cy - fontSize / 2, 0, cy);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  l.fillStyle = shine;
  l.fillRect(0, cy - fontSize / 2, S, fontSize / 2.2);

  // Infection: cracks + glowing veins clipped to the glyph
  const rnd = mulberry(seed);
  l.strokeStyle = 'rgba(10,2,4,0.8)';
  l.lineWidth = 2;
  for (let i = 0; i < 6; i++) crack(l, rnd, cx + (rnd() - 0.5) * 120, cy + (rnd() - 0.5) * 140, 5);
  l.shadowColor = '#ff2a3d';
  l.shadowBlur = 8;
  l.strokeStyle = 'rgba(255,42,61,0.9)';
  l.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) crack(l, rnd, cx + (rnd() - 0.5) * 100, cy + fontSize * 0.35, 6, -1);
  l.restore();

  // Inner stroke rim
  l.lineWidth = 2;
  l.strokeStyle = hexA(r.top, 0.6);
  l.strokeText(r.text, cx, cy - 1);

  ctx.save();
  ctx.shadowColor = hexA(r.glow, 0.85);
  ctx.shadowBlur = 22;
  ctx.drawImage(lc, 0, 0);
  ctx.restore();
  ctx.drawImage(lc, 0, 0);

  // Blood drips from the base of the glyph
  const drips = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < drips; i++) {
    const x = cx + (rnd() - 0.5) * fontSize * 0.7;
    const y0 = cy + fontSize * 0.36;
    const len = 18 + rnd() * 34;
    drip(ctx, x, y0, len, 3 + rnd() * 3);
  }
  return c;
}

function crack(l: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, segs: number, dirY = 0) {
  l.beginPath();
  l.moveTo(x, y);
  for (let i = 0; i < segs; i++) {
    x += (rnd() - 0.5) * 34;
    y += dirY ? dirY * (8 + rnd() * 16) : (rnd() - 0.5) * 34;
    l.lineTo(x, y);
  }
  l.stroke();
}

function drip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + len);
  g.addColorStop(0, '#7a0014');
  g.addColorStop(1, '#d0102a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.6, y + len * 0.6, x - w * 0.9, y + len);
  ctx.arc(x, y + len, w, Math.PI, 0, true);
  ctx.quadraticCurveTo(x + w * 0.6, y + len * 0.6, x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,200,200,0.5)';
  ctx.beginPath();
  ctx.arc(x - w * 0.35, y + len - w * 0.2, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function motionBlur(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = canvas(src.width, src.height);
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    ctx.globalAlpha = 0.22;
    ctx.drawImage(src, 0, (i - steps / 2) * 7);
  }
  ctx.globalAlpha = 1;
  return c;
}

function drawExpanded(symbolCanvas: HTMLCanvasElement, veins: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(40,0,8,0.92)');
  bg.addColorStop(0.5, 'rgba(90,0,16,0.92)');
  bg.addColorStop(1, 'rgba(40,0,8,0.92)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(veins, 0, 0, w, h);
  ctx.globalAlpha = 1;
  const aura = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, h * 0.5);
  aura.addColorStop(0, 'rgba(255,42,61,0.55)');
  aura.addColorStop(1, 'rgba(255,42,61,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, w, h);
  const size = Math.min(w * 1.15, h * 0.62);
  ctx.save();
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 40;
  ctx.drawImage(symbolCanvas, (w - size) / 2, (h - size) / 2, size, size);
  ctx.restore();
  const ghost = size * 0.55;
  ctx.globalAlpha = 0.25;
  ctx.drawImage(symbolCanvas, (w - ghost) / 2, h * 0.02, ghost, ghost);
  ctx.drawImage(symbolCanvas, (w - ghost) / 2, h - ghost - h * 0.02, ghost, ghost);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,42,61,0.9)';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 20;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  return c;
}

function radial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export async function buildSymbolTextures(): Promise<SymbolTextures> {
  const canvases: HTMLCanvasElement[] = [];
  for (const def of SYMBOLS) {
    const svg = PREMIUM_SVGS[def.key];
    if (svg) {
      const img = await loadSvg(svg, TEX_SIZE, TEX_SIZE);
      const [c, ctx] = canvas(TEX_SIZE, TEX_SIZE);
      ctx.drawImage(img, 0, 0, TEX_SIZE, TEX_SIZE);
      canvases.push(c);
    } else {
      canvases.push(drawRoyal(def.key, def.id * 977 + 13));
    }
  }
  const veinsImg = await loadSvg(VEINS_SVG, 200, 600);
  const expanded = new Map<Sym, Texture>();
  canvases.forEach((c, i) => {
    if (i !== Sym.CODEX) expanded.set(i as Sym, Texture.from(drawExpanded(c, veinsImg, 220, 600)));
  });
  const [vc, vctx] = canvas(200, 600);
  vctx.drawImage(veinsImg, 0, 0);

  return {
    canvases,
    normal: canvases.map((c) => Texture.from(c)),
    blur: canvases.map((c) => Texture.from(motionBlur(c))),
    images: canvases.map((c) => c.toDataURL('image/png')),
    expanded,
    glowMaps: canvases.map((c) => Texture.from(glowMap(c))),
    frame: Texture.from(
      paintFrame({ boardW: BOARD_W, boardH: BOARD_H, pad: FRAME_PAD, bleed: FRAME_BLEED, reelX, cellW: CELL_W, reels: 5 }),
    ),
    reelPanels: [0, 1, 2, 3, 4].map((r) => Texture.from(paintReelPanel(CELL_W + REEL_GAP, BOARD_H, 100 + r * 17))),
    shade: Texture.from(paintDepthShade(BOARD_H)),
    winFrame: Texture.from(paintWinFrame(CELL_W, CELL_H)),
    chain: Texture.from(paintChain(900)),
    veins: Texture.from(vc),
    glow: Texture.from(radial(256, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']])),
    spore: Texture.from(radial(64, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']])),
  };
}
