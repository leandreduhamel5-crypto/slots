import { Texture } from 'pixi.js';
import { SYMBOLS, Sym } from '../math/config';
import { SYMBOL_ART, VEINS_SVG } from './art/symbols';
import {
  INK,
  MATERIALS,
  glossyDrip,
  makeCanvas,
  render3DText,
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

type Deco = 'blood' | 'steel' | 'toxic' | 'slime' | 'rust';

const ROYALS: Record<string, { text: string; material: Deco; glow: string; drip: [string, string, string] }> = {
  a: { text: 'A', material: 'blood', glow: '#ff3347', drip: ['#ff8a96', '#e0213a', '#7a0418'] },
  k: { text: 'K', material: 'steel', glow: '#38dcff', drip: ['#c8fbff', '#38dcff', '#0f5f86'] },
  q: { text: 'Q', material: 'toxic', glow: '#b46bff', drip: ['#efd6ff', '#a85cf0', '#4a1488'] },
  j: { text: 'J', material: 'slime', glow: '#7be05a', drip: ['#e2ffcc', '#6fd04a', '#1d6a18'] },
  ten: { text: '10', material: 'rust', glow: '#ffa23a', drip: ['#ffe0a8', '#f08a2a', '#7a3006'] },
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

/** Glyph mask of a royal letter, used for its glow map. */
function glyph(text: string, size: number, color: string): HTMLCanvasElement {
  const S = TEX_SIZE;
  const [c, ctx] = makeCanvas(S, S);
  ctx.font = `${size}px "Luckiest Guy", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, S / 2, S / 2 + 10);
  return c;
}

function rivet3d(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y + 2, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, '#c9d3dc');
  g.addColorStop(1, '#5a6672');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y + r * 0.2);
  ctx.lineTo(x + r * 0.55, y - r * 0.2);
  ctx.stroke();
}

function splat(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rnd: () => number): void {
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = r * (i % 2 ? 0.6 + rnd() * 0.15 : 1 + rnd() * 0.25);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/** Royal: 3D lettering in its own material, with themed details and a soft colour aura. */
function drawRoyal(key: string, seed: number): HTMLCanvasElement {
  const r = ROYALS[key];
  const S = TEX_SIZE;
  const two = r.text.length > 1;
  const size = two ? 176 : 214;
  const rnd = seeded(seed);
  const [c, ctx] = makeCanvas(S, S);

  const aura = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.5);
  aura.addColorStop(0, r.glow + '55');
  aura.addColorStop(0.6, r.glow + '18');
  aura.addColorStop(1, r.glow + '00');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(S / 2, S - 30, 92, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const letter = render3DText(r.text, { size, material: MATERIALS[r.material] });
  const lx = (S - letter.width) / 2 + 4;
  const ly = (S - letter.height) / 2 - 2;
  // where the glyph sits inside the 320 canvas
  const top = S / 2 - size * 0.4;
  const bottom = S / 2 + size * 0.36;
  const halfW = two ? size * 0.55 : size * 0.38;

  if (r.material === 'blood') splat(ctx, S / 2 + halfW * 0.95, top + 20, 16, '#e0213a', rnd);
  ctx.drawImage(letter, lx, ly);

  switch (r.material) {
    case 'blood': {
      glossyDrip(ctx, S / 2 - halfW * 0.62, bottom - 6, 34, 7, r.drip);
      glossyDrip(ctx, S / 2 + halfW * 0.7, bottom - 6, 50, 8, r.drip);
      glossyDrip(ctx, S / 2 + 4, S / 2 + size * 0.1, 22, 5, r.drip);
      splat(ctx, S / 2 - halfW * 1.05, top + 46, 7, '#e0213a', rnd);
      break;
    }
    case 'steel': {
      rivet3d(ctx, S / 2 - halfW * 0.5, top + 34, 9);
      rivet3d(ctx, S / 2 - halfW * 0.5, bottom - 34, 9);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(S / 2 + 10, S / 2 - 30);
      ctx.lineTo(S / 2 + 36, S / 2 - 58);
      ctx.moveTo(S / 2 + 16, S / 2 - 22);
      ctx.lineTo(S / 2 + 30, S / 2 - 38);
      ctx.stroke();
      ctx.save();
      ctx.translate(S / 2 + 18, S / 2 + 34);
      ctx.rotate(-0.6);
      ctx.beginPath();
      ctx.roundRect(-62, -15, 124, 30, 8);
      ctx.lineWidth = 6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      const bg = ctx.createLinearGradient(0, -15, 0, 15);
      bg.addColorStop(0, '#fff6e2');
      bg.addColorStop(1, '#d8c49c');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.fillStyle = '#c9b086';
      ctx.fillRect(-18, -13, 36, 26);
      ctx.fillStyle = '#a88c60';
      for (let i = -12; i <= 12; i += 8) for (let j = -7; j <= 7; j += 7) ctx.fillRect(i, j, 3, 3);
      ctx.fillStyle = '#e0213a';
      ctx.beginPath();
      ctx.arc(4, 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      glossyDrip(ctx, S / 2 + halfW * 0.65, bottom - 8, 26, 6, r.drip);
      break;
    }
    case 'toxic': {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(S / 2 - 56, S / 2 + 4);
      ctx.quadraticCurveTo(S / 2 - 10, S / 2 + 22, S / 2 + 24, S / 2 + 10);
      ctx.stroke();
      for (let i = -48; i <= 18; i += 16) {
        ctx.beginPath();
        ctx.moveTo(S / 2 + i - 5, S / 2 - 6 + Math.abs(i + 15) * 0.1);
        ctx.lineTo(S / 2 + i + 5, S / 2 + 22 - Math.abs(i + 15) * 0.1);
        ctx.stroke();
      }
      for (const [bx, by, br] of [
        [S / 2 + 30, S / 2 - 44, 8],
        [S / 2 + 46, S / 2 - 22, 5],
        [S / 2 - 40, S / 2 - 40, 4],
      ]) {
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
      }
      glossyDrip(ctx, S / 2 + halfW * 0.78, bottom - 4, 40, 8, r.drip);
      glossyDrip(ctx, S / 2 - halfW * 0.35, bottom - 6, 24, 6, r.drip);
      break;
    }
    case 'slime': {
      rivet3d(ctx, S / 2 + 14, top + 34, 10);
      glossyDrip(ctx, S / 2 - halfW * 0.6, bottom - 18, 30, 7, r.drip);
      glossyDrip(ctx, S / 2 + 20, bottom - 2, 44, 8, r.drip);
      glossyDrip(ctx, S / 2 + 22, top + 8, 18, 5, r.drip);
      break;
    }
    case 'rust': {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let x = S / 2 + 18;
      let y = S / 2 - 52;
      ctx.moveTo(x, y);
      for (let i = 0; i < 5; i++) {
        x += 10 + rnd() * 8;
        y += 14 + rnd() * 6 * (i % 2 ? -1 : 1);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      rivet3d(ctx, S / 2 - halfW * 0.58, top + 36, 8);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(122,48,6,0.55)';
        ctx.beginPath();
        ctx.arc(S / 2 + (rnd() - 0.2) * halfW * 1.4, S / 2 + (rnd() - 0.5) * size * 0.5, 3 + rnd() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      glossyDrip(ctx, S / 2 + halfW * 0.25, bottom - 4, 30, 7, ['#ff8a96', '#e0213a', '#7a0418']);
      break;
    }
  }
  return c;
}

const PREMIUM_AURA: Record<string, string> = {
  codex: '#ff3347',
  zero: '#ffb03a',
  mask: '#ff3347',
  antidote: '#38dcff',
  blood: '#ff3347',
};

/** Studio "lighting pass": colour aura behind, top-light / bottom-shade volume clipped to the art. */
function finishPremium(src: HTMLCanvasElement, aura: string): HTMLCanvasElement {
  const S = src.width;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.52);
  g.addColorStop(0, aura + '50');
  g.addColorStop(0.55, aura + '1c');
  g.addColorStop(1, aura + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const [v, vctx] = makeCanvas(S, S);
  vctx.drawImage(src, 0, 0);
  vctx.globalCompositeOperation = 'source-atop';
  const light = vctx.createLinearGradient(0, 0, 0, S);
  light.addColorStop(0, 'rgba(255,255,255,0.16)');
  light.addColorStop(0.4, 'rgba(255,255,255,0)');
  light.addColorStop(0.7, 'rgba(0,0,0,0)');
  light.addColorStop(1, 'rgba(10,0,20,0.28)');
  vctx.fillStyle = light;
  vctx.fillRect(0, 0, S, S);
  ctx.drawImage(v, 0, 0);
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
      canvases.push(finishPremium(full, PREMIUM_AURA[def.key] ?? '#ff3347'));
      glowCanvases.push(softGlow(await svgCanvas(art.glow), 14));
    } else {
      const r = ROYALS[def.key];
      canvases.push(drawRoyal(def.key, def.id * 977 + 13));
      glowCanvases.push(softGlow(glyph(r.text, r.text.length > 1 ? 176 : 214, r.glow), 10));
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
