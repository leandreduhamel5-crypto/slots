import { Texture } from 'pixi.js';
import { SYMBOLS, Sym } from '../math/config';
import { VEINS_SVG } from './art/symbols';
import {
  INK,
  makeCanvas,
  paintShine,
  paintSunburst,
  paintDepthShade,
  paintDrop,
  paintFrame,
  paintPuff,
  paintReelPanel,
  paintStar,
  paintWinFrame,
  softGlow,
} from './art/painters';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, REEL_GAP, reelX } from './layout';
import { containCanvas } from './assets';
import { ICONS as PAINTED } from './art/icons';
import { downsample } from './art/paint';
import { paintRoyal } from './art/royals';
import { decorateFrame } from './art/frameDeco';

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
  veins: Texture;
  glow: Texture;
  spore: Texture;
  drop: Texture;
  dropCyan: Texture;
  star: Texture;
  puff: Texture;
  shine: Texture;
  sunburst: Texture;
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

/** Royal: 3D lettering over its painted emblem (art/royals.ts), with a soft colour aura. */
function drawRoyal(key: string): HTMLCanvasElement {
  const r = ROYALS[key];
  const S = TEX_SIZE;
  const [c, ctx] = makeCanvas(S, S);
  const aura = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.5);
  aura.addColorStop(0, r.glow + '44');
  aura.addColorStop(0.6, r.glow + '14');
  aura.addColorStop(1, r.glow + '00');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(downsample(paintRoyal(key), S), 0, 0);
  return c;
}

const PREMIUM_ZOOM: Record<string, number> = { codex: 1.1, zero: 1.12, mask: 1.12, antidote: 1.08, blood: 1.08 };

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

/** Steel cabinet frame plus its painted ornaments (brass eye brackets, veins, gauge, hazard lamp). */
function framed(): HTMLCanvasElement {
  const c = paintFrame({ boardW: BOARD_W, boardH: BOARD_H, pad: FRAME_PAD, bleed: FRAME_BLEED, reelX, cellW: CELL_W, reels: 5 });
  const ctx = c.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0); // paintFrame leaves its bleed translation applied
  decorateFrame(ctx, FRAME_BLEED, FRAME_BLEED, BOARD_W + FRAME_PAD * 2, BOARD_H + FRAME_PAD * 2);
  return c;
}

export async function buildSymbolTextures(overrides: Map<string, HTMLImageElement> = new Map()): Promise<SymbolTextures> {
  const canvases: HTMLCanvasElement[] = [];
  const glowCanvases: HTMLCanvasElement[] = [];
  const rigs = new Map<Sym, SymbolRig>();
  for (const def of SYMBOLS) {
    const custom = overrides.get(def.key);
    if (custom) {
      // professional artwork from public/assets: used as-is, no procedural rig
      const c = containCanvas(custom, TEX_SIZE);
      canvases.push(c);
      glowCanvases.push(softGlow(c, 12));
    } else if (PAINTED[def.key]) {
      // hand-painted premium (512 px, downsampled)
      const painted = PAINTED[def.key]();
      const aura = PREMIUM_AURA[def.key] ?? '#ff3347';
      // premiums are framed tighter than the royals so they dominate the reels
      const k = PREMIUM_ZOOM[def.key] ?? 1;
      const zoom = (src: HTMLCanvasElement) => {
        if (k === 1) return src;
        const [z, zc] = makeCanvas(src.width, src.height);
        zc.translate(src.width / 2, src.height / 2);
        zc.scale(k, k);
        zc.drawImage(src, -src.width / 2, -src.height / 2);
        return z;
      };
      painted.base = zoom(painted.base);
      painted.glow = zoom(painted.glow);
      for (const name of Object.keys(painted.parts)) painted.parts[name] = zoom(painted.parts[name]);
      const base = downsample(painted.base, TEX_SIZE);
      const parts: Record<string, Texture> = {};
      const [full, f] = makeCanvas(TEX_SIZE, TEX_SIZE);
      f.drawImage(base, 0, 0);
      for (const [name, pc] of Object.entries(painted.parts)) {
        const small = downsample(pc, TEX_SIZE);
        parts[name] = Texture.from(small);
        if (name !== 'lid') f.drawImage(small, 0, 0);
      }
      rigs.set(def.id, { base: Texture.from(finishPremium(base, aura)), parts });
      canvases.push(finishPremium(full, aura));
      glowCanvases.push(softGlow(downsample(painted.glow, TEX_SIZE), 14));
    } else {
      const r = ROYALS[def.key];
      canvases.push(drawRoyal(def.key));
      glowCanvases.push(softGlow(glyph(r.text, r.text.length > 1 ? 168 : 206, r.glow), 10));
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
    frame: Texture.from(framed()),
    reelPanels: [0, 1, 2, 3, 4].map((r) => Texture.from(paintReelPanel(CELL_W + REEL_GAP, BOARD_H, 100 + r * 17))),
    shade: Texture.from(paintDepthShade(BOARD_H)),
    winFrame: Texture.from(paintWinFrame(CELL_W, CELL_H)),
    veins: Texture.from(vc),
    glow: Texture.from(radial(256, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']])),
    spore: Texture.from(radial(64, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']])),
    drop: Texture.from(paintDrop()),
    dropCyan: Texture.from(paintDrop('#38dcff', '#c8fbff')),
    star: Texture.from(paintStar()),
    puff: Texture.from(paintPuff()),
    shine: Texture.from(paintShine()),
    sunburst: Texture.from(paintSunburst()),
  };
}
