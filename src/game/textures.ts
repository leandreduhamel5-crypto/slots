import { Container, NineSliceSprite, Texture } from 'pixi.js';
import { SYMBOLS, Sym } from '../math/config';
import {
  INK,
  makeCanvas,
  paintShine,
  paintSunburst,
  paintDepthShade,
  paintDrop,
  paintPuff,
  paintStar,
  softGlow,
} from './art/painters';
import { BOARD_H, BOARD_W, CELL_W, FRAME_MARGIN_X, FRAME_MARGIN_Y, REEL_GAP } from './layout';
import { containCanvas } from './assets';
import { ICONS as PAINTED } from './art/icons';
import { downsample } from './art/paint';
import { paintRoyal } from './art/royals';
import { goldGrad, paintCoin, paintEgyptFrame, paintGem, paintGoldFlakes, paintGrain, paintSeal, paintReelSurround, paintRisingColumn, paintStonePanel } from './art/egyptFrame';

/** the painted symbols are 512 px: keep all of it, the screens that show it are getting bigger */
export const TEX_SIZE = 512;
/** textures used to be 320 px: effects laid out on the art are written in those units */
export const TEX_UNIT = TEX_SIZE / 320;
export const FRAME_PAD = 40;
export const FRAME_BLEED = 60;
/** the art-direction frame (egypt/frame.webp): size, reel window and ruby centres in its pixels */
export const FRAME_ART = {
  size: [1671, 941],
  window: [148, 103, 1375, 723],
  rubies: [[118, 75], [1552, 76], [118, 850], [1554, 850], [833, 62], [833, 848], [492, 75], [1178, 75], [496, 857], [1172, 857]],
} as const;

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
  grain: Texture;
  flakes: Texture[];
  rigs: Map<Sym, SymbolRig>;
  expanded: Map<Sym, Texture>;
  /** additive glow layers that make each symbol light up */
  glowMaps: Texture[];
  frame: Texture;
  /** the lapis band around the reels, running on under the frame */
  surround: Texture;
  reelPanels: Texture[];
  shade: Texture;
  /** the winged rubies of the frame, cut out to crown the big screens */
  crest: Texture;
  /** cartouche for amounts, see makeSeal */
  seal: Texture;
  veins: Texture;
  glow: Texture;
  spore: Texture;
  drop: Texture;
  dropCyan: Texture;
  star: Texture;
  puff: Texture;
  shine: Texture;
  sunburst: Texture;
  coin: Texture;
}

type Deco = 'blood' | 'steel' | 'toxic' | 'slime' | 'rust';

const ROYALS: Record<string, { text: string; material: Deco; glow: string; drip: [string, string, string] }> = {
  a: { text: 'A', material: 'blood', glow: '#ff3347', drip: ['#ff8a96', '#e0213a', '#7a0418'] },
  k: { text: 'K', material: 'steel', glow: '#38dcff', drip: ['#c8fbff', '#38dcff', '#0f5f86'] },
  q: { text: 'Q', material: 'toxic', glow: '#b46bff', drip: ['#efd6ff', '#a85cf0', '#4a1488'] },
  j: { text: 'J', material: 'slime', glow: '#7be05a', drip: ['#e2ffcc', '#6fd04a', '#1d6a18'] },
  ten: { text: '10', material: 'rust', glow: '#ffa23a', drip: ['#ffe0a8', '#f08a2a', '#7a3006'] },
};

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

/** letters and numbers are the low symbols: drawn smaller, they leave the stage to the gods */
const ROYAL_KEYS = ['a', 'k', 'q', 'j', 'ten'];
const ROYAL_SCALE = 0.8;

function insetCanvas(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  if (k === 1) return src;
  const [c, ctx] = makeCanvas(src.width, src.height);
  const d = src.width * k;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (src.width - d) / 2, (src.height - d) / 2, d, d);
  return c;
}

function cropFrame(frame: HTMLImageElement | null, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  if (frame) ctx.drawImage(frame, x, y, w, h, 0, 0, w, h);
  return c;
}

/** The winged ruby of the frame, freed from the rails it grows out of. */
function cleanCrest(frame: HTMLImageElement | null): HTMLCanvasElement {
  const c = cropFrame(frame, 515, 0, 645, 172);
  const ctx = c.getContext('2d')!;
  // the outline of the wing's tips, on the left; the right wing mirrors it round the ruby
  const stub: [number, number][] = [[-8, 30], [0, 30], [4, 38], [12, 47], [14, 52], [13, 59], [20, 66], [32, 73], [33, 81], [44, 88], [48, 92], [46, 100], [60, 106], [82, 118], [84, 180], [-8, 180]];
  ctx.globalCompositeOperation = 'destination-out';
  for (const mirror of [false, true]) {
    ctx.beginPath();
    for (const [x, y] of stub) ctx.lineTo(mirror ? 642 - x : x, y);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** A cartouche of the given size, centred on its origin. */
export function makeSeal(tex: Texture, w: number, h: number): Container {
  const c = new Container();
  const k = h / 300;
  const s = new NineSliceSprite({ texture: tex, leftWidth: 240, rightWidth: 240, topHeight: 40, bottomHeight: 40, anchor: 0.5 });
  s.width = Math.max(500, w / k);
  s.height = tex.height;
  s.scale.set(k);
  c.addChild(s);
  return c;
}

/** A rim of light behind the art, so that even the black jackal stands out from the dark reels. */
function backlit(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.shadowColor = color + 'b0';
  ctx.shadowBlur = 11 * TEX_UNIT;
  ctx.drawImage(src, 0, 0);
  ctx.shadowBlur = 0;
  ctx.drawImage(src, 0, 0);
  return c;
}

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
    ctx.drawImage(src, 0, (i - steps / 2) * 8 * TEX_UNIT);
  }
  ctx.globalAlpha = 1;
  return c;
}

/**
 * Strain column for free spins: a lapis niche in a gold frame, lit from behind, the symbol once per
 * row at a little under its reel size so the column reads as three winning symbols, not as a poster.
 */
function drawExpanded(symbolCanvas: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const S = 2;
  const [c, ctx] = makeCanvas(w * S, h * S);
  ctx.scale(S, S);
  const box = (inset: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, r);
  };
  box(3, 12);
  const bg = ctx.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0, '#060c24');
  bg.addColorStop(0.5, '#142a66');
  bg.addColorStop(1, '#060c24');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  box(3, 12);
  ctx.clip();
  const rows = 3;
  const rowH = h / rows;
  ctx.globalCompositeOperation = 'lighter';
  const shaft = ctx.createLinearGradient(0, 0, w, 0);
  shaft.addColorStop(0.08, 'rgba(70,110,230,0)');
  shaft.addColorStop(0.5, 'rgba(70,110,230,0.28)');
  shaft.addColorStop(0.92, 'rgba(70,110,230,0)');
  ctx.fillStyle = shaft;
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    const cy = rowH * (r + 0.5);
    const g = ctx.createRadialGradient(w / 2, cy, 8, w / 2, cy, w * 0.52);
    g.addColorStop(0, 'rgba(255,190,110,0.2)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - rowH / 2, w, rowH);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // gold rules between the rows, each with a small ruby at its centre
  for (let r = 1; r < rows; r++) {
    const y = rowH * r;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, y - 2, w - 28, 5);
    ctx.fillStyle = goldGrad(ctx, 14, y, w - 14, y);
    ctx.fillRect(14, y - 1, w - 28, 2.5);
    paintGem(ctx, w / 2, y, 6.5);
  }
  const size = w * 0.74;
  for (let r = 0; r < rows; r++) {
    const cy = rowH * (r + 0.5);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7 * S;
    ctx.drawImage(symbolCanvas, (w - size) / 2, cy - size / 2, size, size);
    ctx.restore();
  }
  // the frame: dark bed, gold, a thin bright inner line
  box(4, 12);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.stroke();
  box(4, 12);
  ctx.strokeStyle = goldGrad(ctx, 0, 0, w, h);
  ctx.lineWidth = 5;
  ctx.stroke();
  box(9, 8);
  ctx.strokeStyle = 'rgba(255,240,200,0.5)';
  ctx.lineWidth = 1;
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
  return paintEgyptFrame({ boardW: BOARD_W, boardH: BOARD_H, pad: FRAME_PAD, bleed: FRAME_BLEED });
}

/** The procedural Book art (whatever the reel symbol uses): the logo cuts its eye out of it. */
export function bookCanvas(): HTMLCanvasElement {
  const painted = PAINTED.codex();
  const [full, f] = makeCanvas(TEX_SIZE, TEX_SIZE);
  const k = PREMIUM_ZOOM.codex;
  const draw = (src: HTMLCanvasElement) => {
    const small = downsample(src, TEX_SIZE);
    f.save();
    f.translate(TEX_SIZE / 2, TEX_SIZE / 2);
    f.scale(k, k);
    f.drawImage(small, -TEX_SIZE / 2, -TEX_SIZE / 2);
    f.restore();
  };
  draw(painted.base);
  for (const [name, pc] of Object.entries(painted.parts)) if (name !== 'lid') draw(pc);
  return full;
}

export async function buildSymbolTextures(overrides: Map<string, HTMLImageElement> = new Map(), frameArt: HTMLImageElement | null = null): Promise<SymbolTextures> {
  const canvases: HTMLCanvasElement[] = [];
  const glowCanvases: HTMLCanvasElement[] = [];
  const rigs = new Map<Sym, SymbolRig>();
  for (const def of SYMBOLS) {
    const custom = overrides.get(def.key);
    if (custom) {
      // professional artwork from public/assets: used as-is, no procedural rig
      const c = backlit(insetCanvas(containCanvas(custom, TEX_SIZE), ROYAL_KEYS.includes(def.key) ? ROYAL_SCALE : 1), PREMIUM_AURA[def.key] ?? '#ffb060');
      canvases.push(c);
      glowCanvases.push(softGlow(c, 12 * TEX_UNIT));
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
  const expanded = new Map<Sym, Texture>();
  canvases.forEach((c, i) => {
    if (i !== Sym.CODEX) expanded.set(i as Sym, Texture.from(drawExpanded(c, 220, 600)));
  });

  return {
    canvases,
    normal: canvases.map((c) => Texture.from(c)),
    blur: canvases.map((c) => Texture.from(motionBlur(c))),
    images: canvases.map((c) => c.toDataURL('image/png')),
    rigs,
    expanded,
    glowMaps: glowCanvases.map((c) => Texture.from(c)),
    // the 3D-rendered frame (art/frame3d.ts) is 2x; the painted one is the fallback
    frame: frameArt ? Texture.from(frameArt) : Texture.from(framed()),
    surround: Texture.from(paintReelSurround(BOARD_W + (FRAME_MARGIN_X + 16) * 2, BOARD_H + (FRAME_MARGIN_Y + 16) * 2, FRAME_MARGIN_X + 16, FRAME_MARGIN_Y + 16, BOARD_W, BOARD_H)),
    reelPanels: [0, 1, 2, 3, 4].map((r) => Texture.from(paintStonePanel(CELL_W + REEL_GAP, BOARD_H, 100 + r * 17))),
    shade: Texture.from(paintDepthShade(BOARD_H)),
    crest: Texture.from(cleanCrest(frameArt)),
    seal: Texture.from(paintSeal()),
    veins: Texture.from(paintRisingColumn(CELL_W, BOARD_H)),
    glow: Texture.from(radial(256, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']])),
    spore: Texture.from(radial(64, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']])),
    drop: Texture.from(paintDrop()),
    dropCyan: Texture.from(paintDrop('#38dcff', '#c8fbff')),
    star: Texture.from(paintStar()),
    puff: Texture.from(paintPuff()),
    shine: Texture.from(paintShine()),
    sunburst: Texture.from(paintSunburst()),
    coin: Texture.from(paintCoin()),
    grain: Texture.from(paintGrain()),
    flakes: paintGoldFlakes().map((c) => Texture.from(c)),
  };
}
