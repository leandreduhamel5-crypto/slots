import { Texture } from 'pixi.js';
import { SYMBOLS, Sym } from '../math/config';
import { SYMBOL_ART, VEINS_SVG } from './art/symbols';
import {
  INK,
  goo,
  makeCanvas,
  paintChain,
  paintDepthShade,
  paintDrop,
  paintFrame,
  paintPuff,
  paintReelPanel,
  paintStar,
  paintWinFrame,
  seeded,
  softGlow,
} from './art/painters';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, REEL_GAP, reelX } from './layout';

export const TEX_SIZE = 320;
export const FRAME_PAD = 40;
export const FRAME_BLEED = 60;

export interface SymbolRig {
  /** the symbol without its animated parts */
  base: Texture;
  parts: Record<string, Texture>;
}

export interface SymbolTextures {
  normal: Texture[];
  blur: Texture[];
  canvases: HTMLCanvasElement[];
  /** data URLs for DOM usage (paytable, intro) */
  images: string[];
  rigs: Map<Sym, SymbolRig>;
  expanded: Map<Sym, Texture>;
  /** additive glow layers that make each symbol light up */
  glowMaps: Texture[];
  frame: Texture;
  reelPanels: Texture[];
  shade: Texture;
  winFrame: Texture;
  chain: Texture;
  veins: Texture;
  glow: Texture;
  spore: Texture;
  drop: Texture;
  dropCyan: Texture;
  star: Texture;
  puff: Texture;
}

const ROYALS: Record<string, { text: string; base: string; shadow: string; light: string; deco: 'goo' | 'bandage' | 'stitch' | 'bolt' | 'crack' }> = {
  a: { text: 'A', base: '#ff3347', shadow: '#a3102a', light: '#ff8a96', deco: 'goo' },
  k: { text: 'K', base: '#38dcff', shadow: '#1580a6', light: '#c8fbff', deco: 'bandage' },
  q: { text: 'Q', base: '#b46bff', shadow: '#6a2fb0', light: '#e2c4ff', deco: 'stitch' },
  j: { text: 'J', base: '#7be05a', shadow: '#2f8a2a', light: '#d2ffb8', deco: 'bolt' },
  ten: { text: '10', base: '#ffa23a', shadow: '#b3560c', light: '#ffe0a8', deco: 'crack' },
};

export function loadSvg(svg: string, w: number, h: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(w, h);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function svgCanvas(svg: string, size = TEX_SIZE): Promise<HTMLCanvasElement> {
  const img = await loadSvg(svg, size, size);
  const [c, ctx] = makeCanvas(size, size);
  ctx.drawImage(img, 0, 0, size, size);
  return c;
}

/** Glyph mask of a royal letter, used for fills / shading. */
function glyph(text: string, size: number, color: string, dx = 0, dy = 0): HTMLCanvasElement {
  const S = TEX_SIZE;
  const [c, ctx] = makeCanvas(S, S);
  ctx.font = `${size}px "Luckiest Guy", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, S / 2 + dx, S / 2 + 18 + dy);
  return c;
}

function drawRoyal(key: string, seed: number): HTMLCanvasElement {
  const r = ROYALS[key];
  const S = TEX_SIZE;
  const size = r.text.length > 1 ? 196 : 236;
  const rnd = seeded(seed);
  const [c, ctx] = makeCanvas(S, S);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(S / 2, S - 26, 96, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${size}px "Luckiest Guy", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 26;
  ctx.strokeStyle = INK;
  ctx.strokeText(r.text, S / 2, S / 2 + 18 + 7);
  ctx.strokeText(r.text, S / 2, S / 2 + 18);

  // cel-shaded fill: shadow colour, base offset up-left, gloss band on top
  const [lc, l] = makeCanvas(S, S);
  l.drawImage(glyph(r.text, size, r.shadow), 0, 0);
  l.globalCompositeOperation = 'source-atop';
  l.drawImage(glyph(r.text, size, r.base, -5, -7), 0, 0);
  l.fillStyle = r.light;
  l.beginPath();
  l.ellipse(S / 2 - 22, S / 2 - size * 0.28, size * 0.42, size * 0.13, -0.12, 0, Math.PI * 2);
  l.fill();
  l.fillStyle = 'rgba(255,255,255,0.85)';
  l.beginPath();
  l.ellipse(S / 2 - 46, S / 2 - size * 0.32, 14, 6, -0.4, 0, Math.PI * 2);
  l.fill();

  l.strokeStyle = INK;
  l.lineCap = 'round';
  if (r.deco === 'stitch') {
    l.lineWidth = 4;
    l.beginPath();
    l.moveTo(S / 2 - 60, S / 2 + 30);
    l.quadraticCurveTo(S / 2, S / 2 + 4, S / 2 + 60, S / 2 + 36);
    l.stroke();
    for (let i = -50; i <= 50; i += 20) {
      l.beginPath();
      l.moveTo(S / 2 + i - 6, S / 2 + 12 + Math.abs(i) * 0.25);
      l.lineTo(S / 2 + i + 6, S / 2 + 34 + Math.abs(i) * 0.25);
      l.stroke();
    }
  } else if (r.deco === 'crack') {
    l.lineWidth = 4;
    let x = S / 2 - 50;
    let y = S / 2 - 50;
    l.beginPath();
    l.moveTo(x, y);
    for (let i = 0; i < 6; i++) {
      x += 14 + rnd() * 6;
      y += (rnd() - 0.3) * 34;
      l.lineTo(x, y);
    }
    l.stroke();
  }
  ctx.drawImage(lc, 0, 0);

  if (r.deco === 'bandage') {
    ctx.save();
    ctx.translate(S / 2 + 10, S / 2 + 24);
    ctx.rotate(-0.55);
    ctx.beginPath();
    ctx.roundRect(-70, -16, 140, 32, 8);
    ctx.fillStyle = '#efe3c6';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#d4c09a';
    ctx.fillRect(-20, -14, 40, 28);
    ctx.fillStyle = '#c4ab7c';
    for (let i = -14; i <= 14; i += 9) for (let j = -8; j <= 8; j += 8) ctx.fillRect(i, j, 3, 3);
    ctx.fillStyle = '#e0213a';
    ctx.beginPath();
    ctx.arc(6, 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (r.deco === 'bolt') {
    for (const [x, y] of [
      [S / 2 + 18, S / 2 - 64],
      [S / 2 + 18, S / 2 + 6],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#9aa6b0';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.stroke();
    }
  } else if (r.deco === 'goo') {
    ctx.beginPath();
    ctx.moveTo(S / 2 - 30, S / 2 - size * 0.36);
    ctx.quadraticCurveTo(S / 2, S / 2 - size * 0.48, S / 2 + 30, S / 2 - size * 0.36);
    ctx.quadraticCurveTo(S / 2 + 18, S / 2 - size * 0.28, S / 2 + 6, S / 2 - size * 0.3);
    ctx.quadraticCurveTo(S / 2 - 12, S / 2 - size * 0.26, S / 2 - 30, S / 2 - size * 0.36);
    ctx.fillStyle = '#7be05a';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const x = S / 2 + (rnd() - 0.5) * size * 0.6;
    goo(ctx, x, S / 2 + size * 0.36, 14 + rnd() * 26, 4 + rnd() * 3, r.base, r.light);
  }
  return c;
}

function motionBlur(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    ctx.globalAlpha = 0.22;
    ctx.drawImage(src, 0, (i - steps / 2) * 8);
  }
  ctx.globalAlpha = 1;
  return c;
}

function drawExpanded(symbolCanvas: HTMLCanvasElement, veins: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 22);
  ctx.fillStyle = '#3a0a22';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#5a0b2a';
  ctx.beginPath();
  ctx.moveTo(w * 0.62, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.3, h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.drawImage(veins, 0, 0, w, h);
  ctx.globalAlpha = 0.35;
  const ghost = w * 0.62;
  ctx.drawImage(symbolCanvas, (w - ghost) / 2, 8, ghost, ghost);
  ctx.drawImage(symbolCanvas, (w - ghost) / 2, h - ghost - 8, ghost, ghost);
  ctx.globalAlpha = 1;
  ctx.restore();
  const size = Math.min(w * 1.18, h * 0.6);
  ctx.drawImage(symbolCanvas, (w - size) / 2, (h - size) / 2, size, size);
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 22);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 22);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 5;
  ctx.stroke();
  return c;
}

function radial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export async function buildSymbolTextures(): Promise<SymbolTextures> {
  const canvases: HTMLCanvasElement[] = [];
  const glowCanvases: HTMLCanvasElement[] = [];
  const rigs = new Map<Sym, SymbolRig>();
  for (const def of SYMBOLS) {
    const art = SYMBOL_ART[def.key];
    if (art) {
      const base = await svgCanvas(art.base);
      const parts: Record<string, Texture> = {};
      const [full, f] = makeCanvas(TEX_SIZE, TEX_SIZE);
      f.drawImage(base, 0, 0);
      for (const [name, svg] of Object.entries(art.parts)) {
        const pc = await svgCanvas(svg);
        parts[name] = Texture.from(pc);
        if (name !== 'lid') f.drawImage(pc, 0, 0);
      }
      rigs.set(def.id, { base: Texture.from(base), parts });
      canvases.push(full);
      glowCanvases.push(softGlow(await svgCanvas(art.glow), 14));
    } else {
      const r = ROYALS[def.key];
      canvases.push(drawRoyal(def.key, def.id * 977 + 13));
      glowCanvases.push(softGlow(glyph(r.text, r.text.length > 1 ? 196 : 236, r.light), 10));
    }
  }
  const veinsImg = await loadSvg(VEINS_SVG, 200, 600);
  const expanded = new Map<Sym, Texture>();
  canvases.forEach((c, i) => {
    if (i !== Sym.CODEX) expanded.set(i as Sym, Texture.from(drawExpanded(c, veinsImg, 220, 600)));
  });
  const [vc, vctx] = makeCanvas(200, 600);
  vctx.drawImage(veinsImg, 0, 0);

  return {
    canvases,
    normal: canvases.map((c) => Texture.from(c)),
    blur: canvases.map((c) => Texture.from(motionBlur(c))),
    images: canvases.map((c) => c.toDataURL('image/png')),
    rigs,
    expanded,
    glowMaps: glowCanvases.map((c) => Texture.from(c)),
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
    drop: Texture.from(paintDrop()),
    dropCyan: Texture.from(paintDrop('#38dcff', '#c8fbff')),
    star: Texture.from(paintStar()),
    puff: Texture.from(paintPuff()),
  };
}
