import { Container, DisplacementFilter, Graphics, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { paintSoftRays } from './art/egyptFrame';
import { makeCanvas } from './art/painters';
import { paintFlameBlob } from './Fire';

/** Cleopatra's painting. Coordinates are pixels of the 809×1003 art. */
export const ART_W = 809;
export const ART_H = 1003;
type V2 = [number, number];

/* features */
const EYES: V2[] = [[501, 133], [556, 162]];
const PALM: V2 = [84, 876];
const COBRA_EYE: V2 = [752, 83];
const COBRA_MOUTH: V2 = [792, 121];
const HALO: V2 = [490, 210];
/** crown, earrings, armband, belt gems, staff */
const JEWELS: V2[] = [[578, 58], [416, 190], [541, 245], [305, 412], [408, 808], [443, 765], [640, 440], COBRA_EYE];

const GOLD = 0xffc860;
const RED = 0xff2a22;

export interface MascotTextures {
  art: Texture;
  /** the highlights of the gold and the jewels alone, for the light that travels over her */
  gold: Texture;
  silhouette: Texture;
  rim: Texture;
  cracks: [Texture, Texture];
  sparkles: V2[];
  edge: V2[];
  glow: Texture;
  flame: Texture;
  noise: Texture;
  beam: Texture;
  blade: Texture;
  rays: Texture;
}

/** 'human' is the queen at peace, 'inhuman' the infected queen of the free spins. */
export type Form = 'human' | 'inhuman';
export type Reaction = 'spin' | 'win' | 'big' | 'feature' | 'codex';

function glowCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}

function noiseCanvas(): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const cells = 8;
  const g = Array.from({ length: cells * cells * 2 }, () => Math.random());
  const sm = (t: number) => t * t * (3 - 2 * t);
  const at = (i: number, j: number, k: number) => g[(((j % cells) + cells) % cells) * cells * 2 + (((i % cells) + cells) % cells) * 2 + k];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * cells;
      const fy = (y / S) * cells;
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const tx = sm(fx - i);
      const ty = sm(fy - j);
      const ch = (k: number) => (at(i, j, k) * (1 - tx) + at(i + 1, j, k) * tx) * (1 - ty) + (at(i, j + 1, k) * (1 - tx) + at(i + 1, j + 1, k) * tx) * ty;
      const p = (y * S + x) * 4;
      img.data[p] = ch(0) * 255;
      img.data[p + 1] = ch(1) * 255;
      img.data[p + 2] = 128;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Light shaft: hot at the source, widening and fading along its length. */
function beamCanvas(): HTMLCanvasElement {
  const W = 512;
  const H = 64;
  const [c, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const half = 0.12 + u * 0.38;
    const along = Math.pow(1 - u, 1.6) * Math.min(1, u * 30);
    for (let y = 0; y < H; y++) {
      const v = Math.abs(y / H - 0.5) / half;
      const a = Math.max(0, 1 - v * v) * along;
      const core = Math.max(0, 1 - v * 4) * along;
      const i = (y * W + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 200 + core * 55;
      img.data[i + 2] = 170 + core * 85;
      img.data[i + 3] = Math.min(255, (a * 0.7 + core * 0.6) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function canvasOf(img: HTMLImageElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  return c;
}

/** Soft glow of a layer, in the layer's own frame (it shares the layer's mesh). */
function silhouetteCanvas(art: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(art.width, art.height);
  ctx.filter = 'blur(16px)';
  ctx.drawImage(art, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Molten cracks on one layer (seeds in art coordinates), clipped to it: [core, glow]. */
function cracksFor(layer: HTMLCanvasElement, at: readonly [number, number], seeds: [number, number, number, number][], seed: number): [HTMLCanvasElement, HTMLCanvasElement] {
  let st = seed;
  const rnd = () => ((st = (st * 16807) % 2147483647) / 2147483647);
  const lines: [number, number][][] = [];
  const grow = (x: number, y: number, a: number, len: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    for (let i = 0; i < 9; i++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * (len / 9);
      y += Math.sin(a) * (len / 9);
      pts.push([x, y]);
    }
    lines.push(pts);
    if (depth > 0) for (let k = 0; k < 2; k++) {
      const q = pts[2 + Math.floor(rnd() * 6)];
      grow(q[0], q[1], a + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.5, depth - 1);
    }
  };
  for (const [x, y, a, l] of seeds) grow(x - at[0], y - at[1], a, l, 2);
  const stroke = (ctx: CanvasRenderingContext2D, wd: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pts of lines) {
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.lineWidth = Math.max(0.6, wd * (1 - i / pts.length));
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
    }
  };
  const [core, cc] = makeCanvas(layer.width, layer.height);
  stroke(cc, 3.2, 'rgba(40,0,2,0.9)');
  stroke(cc, 1.8, '#ff3a24');
  stroke(cc, 0.7, '#ffd0a0');
  const [sharp, sc] = makeCanvas(layer.width, layer.height);
  stroke(sc, 9, 'rgba(255,40,30,0.95)');
  const [glow, gc] = makeCanvas(layer.width, layer.height);
  gc.filter = 'blur(6px)';
  gc.drawImage(sharp, 0, 0);
  for (const ctx of [cc, gc]) {
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(layer, 0, 0);
  }
  return [core, glow];
}

/** Brightest golden pixels of a layer (ribbons, jewels), in layer coordinates. */
function sparklePoints(c: HTMLCanvasElement): [number, number][] {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const pts: [number, number][] = [];
  for (let y = 0; y < c.height; y += 3) {
    for (let x = 0; x < c.width; x += 3) {
      const i = (y * c.width + x) * 4;
      if (d[i + 3] > 200 && d[i] > 245 && d[i + 1] > 210 && d[i + 2] < 190) pts.push([x, y]);
    }
  }
  return pts;
}

function lerpColor(a: number, b: number, k: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * k) << s;
  };
  return ch(16) | ch(8) | ch(0);
}


/** Thin bright outline of a layer (for the red rim light of the infected form). */
function rimCanvas(art: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(art.width, art.height);
  ctx.drawImage(art, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.filter = 'blur(5px)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.drawImage(art, Math.cos(a) * 3, Math.sin(a) * 3);
  }
  ctx.filter = 'none';
  return c;
}

/** Points along the outer silhouette, for the flames of the infected aura. */
function edgePoints(art: HTMLCanvasElement): V2[] {
  const w = art.width;
  const h = art.height;
  const d = art.getContext('2d')!.getImageData(0, 0, w, h).data;
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const pts: V2[] = [];
  for (let y = 2; y < h - 60; y += 5) {
    for (let x = 2; x < w - 2; x += 5) {
      if (A(x, y) > 128 && (A(x - 6, y) < 40 || A(x + 6, y) < 40 || A(x, y - 6) < 40)) pts.push([x, y]);
    }
  }
  return pts;
}

/** Only what shines in the painting: warm, bright pixels, softly thresholded. */
function goldCanvas(art: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(art.width, art.height);
  const src = art.getContext('2d')!.getImageData(0, 0, art.width, art.height);
  const d = src.data;
  for (let i = 0; i < d.length; i += 4) {
    const warm = Math.max(0, Math.min(1, (d[i] - d[i + 2] - 40) / 90));
    const lit = Math.max(0, Math.min(1, (d[i + 1] - 120) / 80));
    // gold is yellow, skin is orange: the ratio of green to red keeps her skin out of it
    const yellow = Math.max(0, Math.min(1, (d[i + 1] / Math.max(1, d[i]) - 0.74) / 0.1));
    d[i + 3] = d[i + 3] * warm * lit * yellow;
  }
  ctx.putImageData(src, 0, 0);
  return c;
}

/** Soft vertical band: bright in the middle, gone at the edges. */
function bladeCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 8);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 8);
  return c;
}

export async function buildMascotTextures(painting: HTMLImageElement): Promise<MascotTextures> {
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  const art = canvasOf(painting);
  const cr = cracksFor(art, [0, 0], [
    [501, 141, Math.PI * 0.6, 70], [556, 170, Math.PI * 0.45, 60],
    [470, 340, Math.PI * 0.6, 150], [510, 470, Math.PI * 0.45, 160], [430, 760, Math.PI * 0.55, 180],
    [262, 548, Math.PI * 0.7, 140], [320, 400, Math.PI * 0.6, 120],
  ], 29);
  const noise = t(noiseCanvas());
  noise.source.addressMode = 'repeat';
  return {
    art: Texture.from(painting),
    gold: t(goldCanvas(art)),
    silhouette: t(silhouetteCanvas(art)),
    rim: t(rimCanvas(art)),
    cracks: [t(cr[0]), t(cr[1])],
    sparkles: sparklePoints(art),
    edge: edgePoints(art),
    glow: t(glowCanvas()),
    flame: t(paintFlameBlob()),
    noise,
    beam: t(beamCanvas()),
    blade: t(bladeCanvas()),
    rays: t(paintSoftRays()),
  };
}

/* ------------------------------------------------------------------ the character */

const lerpTo = (a: number, b: number, k: number) => a + (b - a) * k;

interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  a0: number;
  size: number;
  ramp?: boolean;
}

/**
 * The painting is never bent: no pixel of her changes shape or size, so nothing can look like a
 * warped image. She lives through light, as a painted slot character should. Torchlight flickers
 * on her skin, blades of light travel over the gold, stars cross her jewels. On a win
 * a halo of rays opens behind her and a flame burns at her fingertips; on a big win the cobra
 * spits light over the reels. In the free spins she burns: red rim light, molten cracks, flames
 * licking off the silhouette, glowing eyes.
 */
export class Mascot extends Container {
  private rig = new Container();
  private art: Sprite;
  private gold: Sprite;
  private sheen: Sprite;
  private blade: Sprite;
  private halo: Sprite;
  private haloCore: Sprite;
  private aura: Sprite;
  private rim: Sprite;
  private cracks: Sprite[];
  private noise: Sprite;
  private displace: DisplacementFilter;
  private eyeGlows: Sprite[] = [];
  private cobraEye: Sprite;
  private mouthOrb: Sprite;
  private beam: Sprite;
  private orb: Sprite;
  private orbCore: Sprite;
  private sparks = new Graphics();
  private back = new Container();
  private front = new Container();
  private motes: Mote[] = [];
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private t = Math.random() * 10;
  private rage = 0;
  private emitIn = 0;
  private flameIn = 0;
  private glintIn = 1;
  private sweepIn = 3;
  private fx = { flare: 0, beam: 0, shake: 0, orb: 0, halo: 0, sweep: -1 };
  form: Form = 'human';
  onTransform: ((to: Form) => void) | null = null;

  constructor(private tex: MascotTextures) {
    super();
    const glow = (size: number, tint: number) => {
      const s = new Sprite(tex.glow);
      s.anchor.set(0.5);
      s.width = s.height = size;
      s.tint = tint;
      s.blendMode = 'add';
      return s;
    };
    const layer = (t: Texture, add = false) => {
      const s = new Sprite(t);
      if (add) s.blendMode = 'add';
      s.alpha = 0;
      return s;
    };
    this.noise = new Sprite(tex.noise);
    this.noise.renderable = false;
    this.noise.scale.set(1.8);
    this.displace = new DisplacementFilter({ sprite: this.noise, scale: 24 });
    this.aura = layer(tex.silhouette, true);
    const auraGroup = new Container();
    auraGroup.addChild(this.aura);
    auraGroup.filters = [this.displace];

    this.halo = new Sprite(tex.rays);
    this.halo.anchor.set(0.5);
    this.halo.position.set(...HALO);
    this.halo.blendMode = 'add';
    this.halo.alpha = 0;
    this.haloCore = glow(620, GOLD);
    this.haloCore.position.set(...HALO);
    this.haloCore.alpha = 0;

    this.art = new Sprite(tex.art);
    this.gold = layer(tex.gold, true);
    this.cracks = [layer(tex.cracks[0]), layer(tex.cracks[1], true)];
    this.rim = layer(tex.rim, true);
    // a blade of light: the gold highlights, revealed through a moving soft band
    this.sheen = layer(tex.gold, true);
    this.blade = new Sprite(tex.blade);
    this.blade.anchor.set(0.5);
    this.blade.height = ART_H * 1.8;
    this.blade.width = 200;
    this.blade.rotation = 0.32;
    this.blade.position.set(-300, ART_H / 2);
    this.sheen.mask = this.blade;

    this.rig.addChild(this.noise, this.halo, this.haloCore, this.back, auraGroup, this.art, this.gold, this.cracks[0], this.cracks[1], this.rim, this.sheen, this.blade);
    for (const e of EYES) {
      const g = glow(40, GOLD);
      g.position.set(...e);
      this.eyeGlows.push(g);
    }
    this.cobraEye = glow(46, RED);
    this.cobraEye.position.set(...COBRA_EYE);
    this.mouthOrb = glow(20, GOLD);
    this.mouthOrb.position.set(...COBRA_MOUTH);
    this.mouthOrb.alpha = 0;
    this.beam = new Sprite(tex.beam);
    this.beam.anchor.set(0.02, 0.5);
    this.beam.position.set(...COBRA_MOUTH);
    this.beam.blendMode = 'add';
    this.beam.alpha = 0;
    this.orb = glow(120, GOLD);
    this.orbCore = glow(26, 0xffffff);
    this.orb.position.set(...PALM);
    this.orbCore.position.set(...PALM);
    this.orb.alpha = this.orbCore.alpha = 0;
    this.sparks.blendMode = 'add';

    this.rig.addChild(...this.eyeGlows, this.cobraEye, this.beam, this.mouthOrb, this.orb, this.orbCore, this.sparks, this.front);
    this.rig.pivot.set(ART_W / 2, ART_H);
    this.addChild(this.rig);
    gsap.ticker.add(this.tick);
  }

  /** Kept for API compatibility. */
  setBook(_t: Texture): void {}

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    gsap.ticker.remove(this.tick);
    super.destroy(options);
  }

  private tick = (): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, gsap.ticker.deltaRatio() / 60);
    this.t += dt;
    const t = this.t;
    this.rage += ((this.form === 'inhuman' ? 1 : 0) - this.rage) * Math.min(1, dt * 2.5);
    const r = this.rage;
    const fx = this.fx;
    const beat = Math.pow(Math.max(0, Math.sin(t * (2.2 + r * 1.8))), 10);
    const tint = lerpColor(GOLD, RED, r);
    this.rig.x = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;

    // torchlight: two slow flickers, never in step, breathing on the skin and in the gold
    const flame = 0.5 + 0.3 * Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1) + 0.2 * Math.sin(t * 13.1 + 2);
    const warm = lerpTo(0xff, 0xe2, 1 - flame) | 0;
    const cool = lerpTo(0xf6, 0xcc, 1 - flame) | 0;
    this.art.tint = lerpColor((0xff << 16) | (warm << 8) | cool, 0xffc0b0, r * 0.45);
    this.gold.alpha = 0.08 + flame * 0.14 + fx.flare * 0.22 + fx.halo * 0.14;
    this.gold.tint = tint;

    this.glintIn -= dt;
    if (this.glintIn <= 0) {
      this.glintIn = 0.5 + Math.random() * 1.3;
      this.glint(JEWELS[Math.floor(Math.random() * JEWELS.length)], 1);
    }
    this.sweepIn -= dt;
    if (this.sweepIn <= 0) {
      this.sweepIn = 5 + Math.random() * 4;
      this.sweep(1.5);
    }
    this.sheen.visible = fx.sweep >= 0;
    if (this.sheen.visible) {
      this.sheen.alpha = 0.95;
      this.sheen.tint = lerpColor(0xfff0d0, 0xff5a3a, r);
      this.blade.x = -240 + fx.sweep * (ART_W + 480);
    }

    // halo of rays behind her
    this.halo.visible = this.haloCore.visible = fx.halo > 0.01;
    if (this.halo.visible) {
      this.halo.tint = this.haloCore.tint = tint;
      this.halo.alpha = Math.min(0.85, fx.halo * 0.7);
      this.halo.rotation = t * 0.12;
      this.halo.width = this.halo.height = 760 + fx.halo * 380 + beat * 30;
      this.haloCore.alpha = Math.min(0.75, fx.halo * 0.55) * (0.85 + flame * 0.15);
    }

    // the skins of the infected form cost nothing at peace
    const burning = r > 0.01 || fx.flare > 0.01;
    this.aura.parent!.visible = burning;
    this.rim.visible = this.cracks[0].visible = this.cracks[1].visible = burning;
    this.cracks[0].alpha = r;
    this.cracks[1].alpha = r * (0.4 + beat * 0.6 + fx.flare * 0.4);
    this.rim.alpha = r * (0.55 + beat * 0.45) + fx.flare * 0.2;
    this.rim.tint = lerpColor(0xffd080, RED, r);
    const flick = Math.random() < 0.012 ? 0.3 : 1;
    this.eyeGlows.forEach((g) => {
      g.tint = lerpColor(0xffd890, RED, r);
      g.alpha = (0.08 + r * 0.6 + beat * 0.2 * r + fx.flare * 0.14) * flick;
      const s = (24 + fx.flare * 6 + r * 12) / 256;
      g.scale.set(s * 1.5, s);
    });
    this.cobraEye.alpha = 0.55 + 0.25 * Math.sin(t * 3.1) + fx.flare * 0.5 + r * 0.3;
    this.cobraEye.scale.set((34 + fx.flare * 36) / 256);
    this.mouthOrb.alpha = Math.min(1, fx.beam * 1.2);
    this.mouthOrb.tint = tint;
    this.mouthOrb.scale.set((24 + fx.beam * 90 + Math.random() * 10) / 256);
    this.beam.alpha = fx.beam * (0.85 + Math.random() * 0.15);
    this.beam.tint = tint;
    this.beam.scale.set((1300 * (0.5 + fx.beam * 0.5)) / 512, (300 + Math.random() * 40) / 64);
    this.beam.rotation = -0.75 + Math.sin(t * 6) * 0.03;
    this.orb.alpha = Math.min(1, fx.orb * (0.8 + 0.2 * Math.sin(t * 9)) + r * 0.3);
    this.orbCore.alpha = Math.min(1, fx.orb * 0.5 + r * 0.15);
    this.orb.tint = tint;
    this.orb.width = this.orb.height = 70 + fx.orb * 70 + r * 24 + Math.sin(t * 7) * 8;

    // aura: a red burning haze when infected, a brief gold one on a flare
    this.noise.x = (this.noise.x + dt * 10) % 256;
    this.noise.y = (this.noise.y - dt * (70 + r * 90)) % 256;
    this.displace.scale.x = 14 + r * 22 + fx.flare * 20;
    this.displace.scale.y = 26 + r * 40 + fx.flare * 30;
    this.aura.tint = tint;
    this.aura.alpha = r * 0.65 + beat * 0.15 * r + fx.flare * 0.3;

    // particles
    this.emitIn -= dt;
    if (this.emitIn <= 0) {
      this.emitIn = 0.045;
      this.spawnSparkle();
      if (Math.random() < 0.45 + r * 0.4) this.spawnEmber();
      if (fx.orb > 0.3 || r > 0.5) this.spawnOrbWisp();
    }
    // the red aura: flames licking up off her silhouette
    if (r > 0.05) {
      this.flameIn -= dt * r;
      while (this.flameIn <= 0) {
        this.flameIn += 0.012;
        this.spawnFlame();
      }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += dt;
      const kk = m.age / m.life;
      if (kk >= 1) {
        m.s.destroy();
        this.motes.splice(i, 1);
        continue;
      }
      m.s.x += m.vx * dt;
      m.s.y += m.vy * dt;
      if (m.ramp) {
        // flame tongue: white-hot to red, stretching as it rises
        m.s.tint = lerpColor(lerpColor(0xffe0b0, 0xff3a1a, Math.min(1, kk * 2)), 0x6a0004, Math.max(0, kk * 2 - 1));
        m.s.alpha = m.a0 * Math.sin(kk * Math.PI) * r;
        const sz = m.size * (1 - kk * 0.6);
        m.s.scale.set(sz / 64, (sz * (1.6 + kk * 1.4)) / 64);
      } else {
        m.s.alpha = m.a0 * Math.sin(kk * Math.PI);
        if (m.size) m.s.scale.set((m.size * Math.sin(kk * Math.PI)) / 256);
      }
    }
  };

  /** A blade of light travelling across the gold. */
  private sweep(duration: number): void {
    gsap.killTweensOf(this.fx, 'sweep');
    gsap.fromTo(this.fx, { sweep: 0 }, { sweep: 1, duration, ease: 'sine.inOut', onComplete: () => void (this.fx.sweep = -1) });
  }

  /** A four-pointed star crossing a jewel. */
  private glint(at: V2, size: number): void {
    const c = new Container();
    c.position.set(...at);
    for (const [w, h] of [[90, 5], [5, 58]]) {
      const ray = new Sprite(this.tex.glow);
      ray.anchor.set(0.5);
      ray.width = w * size;
      ray.height = h * size;
      ray.blendMode = 'add';
      ray.tint = 0xfff4d8;
      c.addChild(ray);
    }
    const dot = new Sprite(this.tex.glow);
    dot.anchor.set(0.5);
    dot.width = dot.height = 26 * size;
    dot.blendMode = 'add';
    c.addChild(dot);
    c.scale.set(0.2);
    c.alpha = 0;
    this.front.addChild(c);
    gsap
      .timeline({ onComplete: () => c.destroy({ children: true }) })
      .to(c, { alpha: 1, duration: 0.12, ease: 'sine.out' }, 0)
      .to(c.scale, { x: 1, y: 1, duration: 0.2, ease: 'power2.out' }, 0)
      .to(c, { rotation: 0.3, duration: 0.55, ease: 'none' }, 0)
      .to(c, { alpha: 0, duration: 0.3, ease: 'sine.in' }, 0.25);
  }

  /** Every jewel lights up, one after the other. */
  private jewels(): void {
    JEWELS.forEach((j, i) => gsap.delayedCall(i * 0.07, () => !this.destroyed && this.glint(j, 1.3)));
  }

  private mote(x: number, y: number, tint: number, vx: number, vy: number, life: number, size: number, startScale = 0, layer = this.front): Mote {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.blendMode = 'add';
    s.tint = tint;
    if (startScale) s.scale.set(startScale);
    layer.addChild(s);
    const m: Mote = { s, vx, vy, life, age: 0, a0: 1, size };
    this.motes.push(m);
    return m;
  }

  private spawnSparkle(): void {
    const pts = this.tex.sparkles;
    if (!pts.length) return;
    const p = pts[Math.floor(Math.random() * pts.length)];
    this.mote(p[0], p[1], this.form === 'inhuman' ? 0xff6a40 : 0xfff0c0, 0, -6, 0.35 + Math.random() * 0.4, 12 + Math.random() * 18);
  }

  private spawnFlame(): void {
    const pts = this.tex.edge;
    const p = pts[Math.floor(Math.random() * pts.length)];
    const s = new Sprite(this.tex.flame);
    s.anchor.set(0.5, 0.8);
    s.position.set(p[0] + (Math.random() - 0.5) * 6, p[1]);
    s.blendMode = 'add';
    (Math.random() < 0.65 ? this.back : this.front).addChild(s);
    this.motes.push({ s, vx: (Math.random() - 0.5) * 20, vy: -(90 + Math.random() * 120), life: 0.45 + Math.random() * 0.4, age: 0, a0: 0.75, size: 18 + Math.random() * 26, ramp: true });
  }

  private spawnEmber(at?: V2, speed = 0): void {
    const [x, y] = at ?? [Math.random() * ART_W, ART_H * (0.35 + Math.random() * 0.6)];
    const a = Math.random() * Math.PI * 2;
    const tint = this.form === 'inhuman' ? (Math.random() < 0.7 ? RED : 0xffa070) : Math.random() < 0.6 ? 0xff9a40 : GOLD;
    this.mote(
      x,
      y,
      tint,
      speed ? Math.cos(a) * speed : (Math.random() - 0.5) * 16,
      speed ? Math.sin(a) * speed - 40 : -(40 + Math.random() * 70),
      1.4 + Math.random() * 1.2,
      0,
      (3 + Math.random() * 7) / 256,
    );
  }

  private spawnOrbWisp(): void {
    const a = Math.random() * Math.PI * 2;
    const rr = 30 + Math.random() * 40;
    this.mote(PALM[0] + Math.cos(a) * rr, PALM[1] + Math.sin(a) * rr, this.form === 'inhuman' ? RED : 0xffe0a0, -Math.cos(a) * 60, -Math.sin(a) * 60 - 30, 0.6 + Math.random() * 0.4, 14 + Math.random() * 12);
  }

  private burst(n: number, at: V2, speed = 180): void {
    for (let i = 0; i < n; i++) this.spawnEmber(at, speed * (0.4 + Math.random() * 0.8));
  }

  private crackle(power = 1): void {
    const g = this.sparks;
    g.clear();
    const cx = ART_W * 0.55;
    const cy = ART_H * 0.42;
    for (let k = 0; k < 3 + power * 3; k++) {
      const a0 = Math.random() * Math.PI * 2;
      const r0 = 300 + Math.random() * 120;
      let x = cx + Math.cos(a0) * r0 * 0.8;
      let y = cy + Math.sin(a0) * r0 * 1.1;
      g.moveTo(x, y);
      const da = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.08);
      for (let i = 1; i <= 7; i++) {
        const a = a0 + da * i;
        const rr = r0 + (Math.random() - 0.5) * 60;
        x = cx + Math.cos(a) * rr * 0.8;
        y = cy + Math.sin(a) * rr * 1.1;
        g.lineTo(x, y);
      }
    }
    g.stroke({ width: 10, color: RED, alpha: 0.35, join: 'round', cap: 'round' });
    g.stroke({ width: 2.6, color: 0xffd0c0, alpha: 1, join: 'round', cap: 'round' });
    gsap.killTweensOf(g);
    gsap.fromTo(g, { alpha: 1 }, { alpha: 0, duration: 0.35, ease: 'steps(5)' });
  }

  /* ------------------------------------------------------------ behaviour */

  private play(tl: gsap.core.Timeline): void {
    this.busy?.progress(1).kill();
    this.busy = tl;
  }

  setForm(to: Form, animate = true): void {
    if (to === this.form) return;
    if (!animate) {
      this.form = to;
      this.rage = to === 'inhuman' ? 1 : 0;
      return;
    }
    this.filters = [this.split];
    const tl = gsap.timeline({ onComplete: () => (this.filters = []) });
    tl.to(this.fx, { flare: 0.8, halo: 1, orb: 1, shake: 4, duration: 0.5, ease: 'power2.out' }, 0);
    for (let i = 0; i < 6; i++) {
      tl.add(() => {
        this.rage = i % 2 ? (to === 'inhuman' ? 0.2 : 0.8) : to === 'inhuman' ? 0.9 : 0.1;
        this.split.red = { x: (Math.random() - 0.5) * 22, y: (Math.random() - 0.5) * 6 };
        this.split.blue = { x: (Math.random() - 0.5) * 22, y: 0 };
        if (to === 'inhuman') this.crackle(0.7);
      }, 0.15 + i * 0.07);
    }
    tl.add(() => {
      this.form = to;
      this.split.red = { x: 0, y: 0 };
      this.split.blue = { x: 0, y: 0 };
      this.burst(36, PALM, 240);
      if (to === 'inhuman') this.crackle(1.4);
      this.onTransform?.(to);
    }, 0.6)
      .to(this.fx, { flare: 1.3, duration: 0.14, ease: 'power3.in' }, 0.6)
      .to(this.fx, { flare: 0, shake: 0, halo: 0, orb: 0, duration: 1, ease: 'sine.inOut' }, 1.4);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        this.sweep(0.8);
        tl.to(this.fx, { flare: 0.3, duration: 0.15, ease: 'power2.out' }).to(this.fx, { flare: 0, duration: 0.6, ease: 'sine.out' });
        break;
      case 'codex':
        this.glint(COBRA_EYE, 1.5);
        tl.to(this.fx, { flare: 0.7, duration: 0.1, ease: 'power2.out' }).to(this.fx, { flare: 0, duration: 0.6, ease: 'sine.out' });
        break;
      case 'win':
        // a halo opens behind her, her jewels catch fire, a flame burns at her fingertips
        this.sweep(0.9);
        this.jewels();
        tl.to(this.fx, { halo: 0.7, orb: 1, flare: 0.5, duration: 0.6, ease: 'sine.out' })
          .add(() => this.burst(18, PALM, 170), 0.4)
          .to(this.fx, { halo: 0, orb: 0, flare: 0, duration: 1.1, ease: 'sine.inOut' }, 1.7);
        break;
      case 'big':
        this.sweep(0.7);
        this.jewels();
        tl.to(this.fx, { halo: 1.3, orb: 1, flare: 1, duration: 0.55, ease: 'power2.inOut' })
          .to(this.fx, { flare: 1.4, shake: 3, duration: 0.12, ease: 'power3.in' })
          .to(this.fx, { beam: 1, duration: 0.15 })
          .add(() => {
            this.burst(40, COBRA_MOUTH, 240);
            this.crackle(1.2);
            this.sweep(0.7);
          }, '<')
          .to(this.fx, { beam: 0, shake: 0, duration: 0.5 }, '+=1.2')
          .to(this.fx, { halo: 0, orb: 0, flare: 0, duration: 1.1, ease: 'sine.inOut' });
        break;
      case 'feature':
        this.setForm('inhuman');
        return;
    }
    this.play(tl);
  }
}
