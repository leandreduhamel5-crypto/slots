import { Container, DisplacementFilter, Graphics, MeshPlane, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { makeCanvas } from './art/painters';

/**
 * Cleopatra from the art-direction sheet (egypt/cleopatra.webp, cut out of the concept), brought
 * to life as a deformable mesh. Coordinates below are pixels in that cutout (805×997).
 */
export const ART_W = 805;
export const ART_H = 997;
const EYES: [number, number][] = [
  [500, 127],
  [555, 157],
];
const HEAD_C: [number, number] = [515, 165];
const NECK: [number, number] = [495, 255];
const HAIR_C: [number, number] = [400, 220];
const CHEST: [number, number] = [470, 420];
const COBRA_C: [number, number] = [730, 95];
const COBRA_NECK: [number, number] = [690, 250];
const COBRA_EYE: [number, number] = [752, 77];
const COBRA_MOUTH: [number, number] = [792, 115];
const VEIL: [number, number] = [120, 560];

const GOLD = 0xffc860;
const RED = 0xff2a22;

export interface MascotTextures {
  art: Texture;
  silhouette: Texture;
  cracks: Texture;
  cracksGlow: Texture;
  glow: Texture;
  noise: Texture;
  beam: Texture;
  /** bright golden pixels of the art (ribbons, jewellery) where sparkles appear */
  sparklePoints: [number, number][];
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

function silhouetteCanvas(art: HTMLCanvasElement): HTMLCanvasElement {
  const blur = 16;
  const pad = blur * 3;
  const [c, ctx] = makeCanvas(art.width + pad * 2, art.height + pad * 2);
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(art, pad, pad);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Molten cracks over the skin and gold, clipped to the art: [core, glow]. */
function cracksCanvas(art: HTMLCanvasElement): [HTMLCanvasElement, HTMLCanvasElement] {
  const w = art.width;
  const h = art.height;
  let st = 29;
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
  const seeds: [number, number, number, number][] = [
    [EYES[0][0], EYES[0][1] + 8, Math.PI * 0.6, 70],
    [EYES[1][0], EYES[1][1] + 8, Math.PI * 0.45, 60],
    [NECK[0], NECK[1], Math.PI * 0.5, 110],
    [CHEST[0] - 80, CHEST[1] - 60, Math.PI * 0.6, 160],
    [CHEST[0] + 40, CHEST[1] + 60, Math.PI * 0.45, 160],
    [300, 520, Math.PI * 0.55, 180],
    [COBRA_C[0], COBRA_C[1] + 30, Math.PI * 0.5, 120],
  ];
  for (const [x, y, a, l] of seeds) grow(x, y, a, l, 2);
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
  const [core, cc] = makeCanvas(w, h);
  stroke(cc, 3.2, 'rgba(40,0,2,0.9)');
  stroke(cc, 1.8, '#ff3a24');
  stroke(cc, 0.7, '#ffd0a0');
  const [sharp, sc] = makeCanvas(w, h);
  stroke(sc, 9, 'rgba(255,40,30,0.95)');
  const [glow, gc] = makeCanvas(w, h);
  gc.filter = 'blur(6px)';
  gc.drawImage(sharp, 0, 0);
  for (const ctx of [cc, gc]) {
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(art, 0, 0);
  }
  return [core, glow];
}

/** Samples the brightest golden pixels (the glowing ribbons and jewels). */
function sparklePoints(art: HTMLCanvasElement): [number, number][] {
  const d = art.getContext('2d')!.getImageData(0, 0, art.width, art.height).data;
  const pts: [number, number][] = [];
  for (let y = 0; y < art.height; y += 3) {
    for (let x = 0; x < art.width; x += 3) {
      const i = (y * art.width + x) * 4;
      if (d[i + 3] > 200 && d[i] > 245 && d[i + 1] > 210 && d[i + 2] < 190) pts.push([x, y]);
    }
  }
  return pts;
}

export async function buildMascotTextures(img: HTMLImageElement): Promise<MascotTextures> {
  const art = canvasOf(img);
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  const [cracks, cracksGlow] = cracksCanvas(art);
  const noise = t(noiseCanvas());
  noise.source.addressMode = 'repeat';
  return {
    art: Texture.from(img),
    silhouette: t(silhouetteCanvas(art)),
    cracks: t(cracks),
    cracksGlow: t(cracksGlow),
    glow: t(glowCanvas()),
    noise,
    beam: t(beamCanvas()),
    sparklePoints: sparklePoints(art),
  };
}

interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  a0: number;
  size: number;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Cleopatra, alive. The painted cutout is a 24×30 mesh warped every frame by weighted regions:
 * her chest breathes, her head turns and tilts toward the reels, her hair and veil sway, and the
 * golden cobra of her staff sways on its neck, rears up and strikes. Her eyes and the cobra's
 * eye glow, sparkles run along the gold, a heat-hazed aura burns around her silhouette, and in
 * the free spins molten cracks spread over her as the infection takes her.
 */
export class Mascot extends Container {
  private float = new Container();
  private rig = new Container();
  private auraOuter: Sprite;
  private auraInner: Sprite;
  private noise: Sprite;
  private displace: DisplacementFilter;
  private body: MeshPlane;
  private basePos: Float32Array;
  private cracks: Sprite;
  private cracksGlow: Sprite;
  private eyeGlows: Sprite[] = [];
  private cobraEye: Sprite;
  private mouthOrb: Sprite;
  private beam: Sprite;
  private sparks = new Graphics();
  private front = new Container();
  private motes: Mote[] = [];
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private t = Math.random() * 10;
  private rage = 0;
  private emitIn = 0;
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  private fx = { y: 0, lean: 0, flare: 0, beam: 0, shake: 0, strike: 0, rear: 0 };
  form: Form = 'human';
  /** called at the climax of a transformation (particles, sound…) */
  onTransform: ((to: Form) => void) | null = null;

  constructor(
    private tex: MascotTextures,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    const glow = (x: number, y: number, size: number, tint: number) => {
      const s = new Sprite(tex.glow);
      s.anchor.set(0.5);
      s.position.set(x, y);
      s.width = s.height = size;
      s.tint = tint;
      s.blendMode = 'add';
      return s;
    };
    // the rig stands on the bottom-centre of the art
    this.rig.pivot.set(ART_W / 2, ART_H);

    this.auraOuter = new Sprite(tex.silhouette);
    this.auraOuter.anchor.set(0.5);
    this.auraOuter.position.set(ART_W / 2, ART_H / 2);
    this.auraOuter.scale.set(1.04);
    this.auraOuter.blendMode = 'add';
    this.auraInner = new Sprite(tex.silhouette);
    this.auraInner.anchor.set(0.5);
    this.auraInner.position.set(ART_W / 2, ART_H / 2);
    this.auraInner.blendMode = 'add';
    this.noise = new Sprite(tex.noise);
    this.noise.renderable = false;
    this.noise.scale.set(1.8);
    this.displace = new DisplacementFilter({ sprite: this.noise, scale: 24 });
    const aura = new Container();
    aura.addChild(this.auraOuter, this.auraInner);
    aura.filters = [this.displace];

    this.body = new MeshPlane({ texture: custom ? Texture.from(custom) : tex.art, verticesX: 24, verticesY: 30 });
    this.body.autoResize = false;
    if (custom) this.body.scale.set(ART_W / custom.naturalWidth, ART_H / custom.naturalHeight);
    this.basePos = new Float32Array(this.body.geometry.positions);
    this.cracks = new Sprite(tex.cracks);
    this.cracksGlow = new Sprite(tex.cracksGlow);
    this.cracksGlow.blendMode = 'add';
    this.cracks.alpha = this.cracksGlow.alpha = 0;
    for (const [ex, ey] of EYES) this.eyeGlows.push(glow(ex, ey, 40, GOLD));
    this.cobraEye = glow(COBRA_EYE[0], COBRA_EYE[1], 46, RED);
    this.mouthOrb = glow(COBRA_MOUTH[0], COBRA_MOUTH[1], 20, GOLD);
    this.mouthOrb.alpha = 0;
    this.beam = new Sprite(tex.beam);
    this.beam.anchor.set(0.02, 0.5);
    this.beam.blendMode = 'add';
    this.beam.alpha = 0;
    this.sparks.blendMode = 'add';

    this.rig.addChild(this.noise, aura, this.body, this.cracks, this.cracksGlow, ...this.eyeGlows, this.cobraEye, this.beam, this.mouthOrb, this.sparks, this.front);
    this.float.addChild(this.rig);
    this.addChild(this.float);

    gsap.ticker.add(this.tick);
    this.scheduleTell();
  }

  /** Kept for API compatibility. */
  setBook(_t: Texture): void {}

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    gsap.ticker.remove(this.tick);
    super.destroy(options);
  }

  /* ------------------------------------------------------------ pose */

  /** Displacement of an art point for the current pose. */
  private warp(x: number, y: number, out: [number, number]): void {
    const t = this.t;
    const fx = this.fx;
    const r = this.rage;
    let ox = 0;
    let oy = 0;
    // breathing: the chest and shoulders rise and swell
    const wc = 1 - smooth(60, 220, Math.hypot(x - CHEST[0], (y - CHEST[1]) * 0.8));
    const breath = Math.sin(t * 1.6) * (1 + r * 0.4);
    oy -= breath * 3.2 * wc;
    ox += (x - CHEST[0]) * 0.006 * breath * wc;
    // head: turns and tilts around the neck
    const wh = 1 - smooth(80, 200, Math.hypot(x - HEAD_C[0], y - HEAD_C[1]));
    if (wh > 0) {
      const ang = -this.look.x * 0.045 + Math.sin(t * 0.7) * 0.012 + fx.lean * 0.5;
      const dx = x - NECK[0];
      const dy = y - NECK[1];
      ox += (dx * Math.cos(ang) - dy * Math.sin(ang) - dx + this.look.x * 5) * wh;
      oy += (dx * Math.sin(ang) + dy * Math.cos(ang) - dy + this.look.y * 3 - breath * 1.5) * wh;
    }
    // hair sways behind her shoulder
    const whair = (1 - smooth(60, 200, Math.hypot(x - HAIR_C[0], (y - HAIR_C[1]) * 0.7))) * smooth(150, 330, y);
    ox += Math.sin(t * 1.1 + y * 0.01) * 5 * whair;
    // veil and ribbons ripple in the wind
    const wv = (1 - smooth(120, 360, Math.hypot(x - VEIL[0], (y - VEIL[1]) * 0.6))) * (1 - smooth(200, 420, x));
    ox += Math.sin(t * 1.8 + y * 0.012 + x * 0.01) * 10 * wv * (1 + r);
    oy += Math.cos(t * 1.4 + x * 0.015) * 5 * wv;
    // the cobra: sways on its neck, rears back, strikes toward the reels
    const wk = 1 - smooth(90, 210, Math.hypot(x - COBRA_C[0], (y - COBRA_C[1]) * 0.8));
    if (wk > 0) {
      const ang = Math.sin(t * 1.3) * 0.06 - fx.rear * 0.18 + fx.strike * 0.12;
      const dx = x - COBRA_NECK[0];
      const dy = y - COBRA_NECK[1];
      const sc = 1 + fx.strike * 0.12;
      ox += (dx * Math.cos(ang) * sc - dy * Math.sin(ang) * sc - dx + fx.strike * 26) * wk;
      oy += (dx * Math.sin(ang) * sc + dy * Math.cos(ang) * sc - dy - fx.rear * 12 + Math.sin(t * 1.3 + 1) * 3) * wk;
    }
    if (fx.shake) {
      ox += (Math.random() - 0.5) * fx.shake;
      oy += (Math.random() - 0.5) * fx.shake * 0.5;
    }
    out[0] = x + ox;
    out[1] = y + oy;
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

    this.float.y = Math.sin(t * 1.1) * 4 + fx.y;
    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 4);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 4);

    const pos = this.body.geometry.positions;
    const base = this.basePos;
    const o: [number, number] = [0, 0];
    const sx = this.body.scale.x;
    const sy = this.body.scale.y;
    for (let i = 0; i < pos.length; i += 2) {
      this.warp(base[i] * sx, base[i + 1] * sy, o);
      pos[i] = o[0] / sx;
      pos[i + 1] = o[1] / sy;
    }
    this.body.geometry.getBuffer('aPosition').update();
    this.body.tint = lerpColor(0xffffff, 0xffb8a8, r * 0.55);

    // overlays follow the warp
    this.warp(HEAD_C[0], HEAD_C[1], o);
    this.cracks.position.set((o[0] - HEAD_C[0]) * 0.4, (o[1] - HEAD_C[1]) * 0.4);
    this.cracksGlow.position.copyFrom(this.cracks.position);
    this.cracks.alpha = r;
    this.cracksGlow.alpha = r * (0.4 + beat * 0.6 + fx.flare * 0.4);
    const flick = Math.random() < 0.012 ? 0.3 : 1;
    EYES.forEach(([ex, ey], i) => {
      this.warp(ex, ey, o);
      const g = this.eyeGlows[i];
      g.position.set(o[0], o[1]);
      g.tint = lerpColor(0xffd890, RED, r);
      g.alpha = (0.18 + r * 0.6 + beat * 0.25 * r + fx.flare * 0.6) * flick;
      g.scale.set(((30 + fx.flare * 30 + r * 10) / 256) * 1.4, (30 + fx.flare * 30 + r * 10) / 256);
    });
    this.warp(COBRA_EYE[0], COBRA_EYE[1], o);
    this.cobraEye.position.set(o[0], o[1]);
    this.cobraEye.tint = tint === GOLD ? 0xff3a24 : RED;
    this.cobraEye.alpha = 0.55 + 0.25 * Math.sin(t * 3.1) + fx.flare * 0.5 + r * 0.3;
    this.cobraEye.scale.set((34 + fx.flare * 36) / 256);
    this.warp(COBRA_MOUTH[0], COBRA_MOUTH[1], o);
    this.mouthOrb.position.set(o[0], o[1]);
    this.mouthOrb.alpha = Math.min(1, fx.beam * 1.2 + fx.strike * 0.4);
    this.mouthOrb.tint = tint;
    this.mouthOrb.scale.set((24 + fx.beam * 80 + Math.random() * 10) / 256);
    this.beam.position.set(o[0], o[1]);
    this.beam.alpha = fx.beam * (0.85 + Math.random() * 0.15);
    this.beam.tint = tint;
    this.beam.scale.set((1200 * (0.5 + fx.beam * 0.5)) / 512, (280 + Math.random() * 40) / 64);
    // the stream arcs over the reels toward the sky
    this.beam.rotation = -0.55 + Math.sin(t * 6) * 0.03;

    // aura
    this.noise.x = (this.noise.x + dt * 10) % 256;
    this.noise.y = (this.noise.y - dt * 70) % 256;
    this.displace.scale.x = 14 + r * 14 + fx.flare * 20;
    this.displace.scale.y = 26 + r * 20 + fx.flare * 30;
    this.auraOuter.tint = tint;
    this.auraInner.tint = lerpColor(0xffd090, 0xff5040, r);
    this.auraOuter.alpha = 0.32 + r * 0.25 + beat * 0.12 + fx.flare * 0.4;
    this.auraInner.alpha = 0.06 + r * 0.12 + fx.flare * 0.2;

    // sparkles running along the gold, embers drifting up
    this.emitIn -= dt;
    if (this.emitIn <= 0) {
      this.emitIn = 0.045 - r * 0.015;
      this.spawnSparkle();
      if (Math.random() < 0.5 + r * 0.4) this.spawnEmber();
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
      m.s.alpha = m.a0 * Math.sin(kk * Math.PI);
      if (m.size) m.s.scale.set((m.size * Math.sin(kk * Math.PI)) / 256);
    }
  };

  private spawnSparkle(): void {
    const pts = this.tex.sparklePoints;
    if (!pts.length) return;
    const [x, y] = pts[Math.floor(Math.random() * pts.length)];
    const o: [number, number] = [0, 0];
    this.warp(x, y, o);
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.position.set(o[0], o[1]);
    s.blendMode = 'add';
    s.tint = this.form === 'inhuman' ? 0xff6a40 : 0xfff0c0;
    this.front.addChild(s);
    this.motes.push({ s, vx: 0, vy: -6, life: 0.35 + Math.random() * 0.4, age: 0, a0: 1, size: 12 + Math.random() * 18 });
  }

  private spawnEmber(x = Math.random() * ART_W, y = ART_H * (0.35 + Math.random() * 0.6), burst = 0): void {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set((3 + Math.random() * 7) / 256);
    s.blendMode = 'add';
    s.tint = this.form === 'inhuman' ? (Math.random() < 0.7 ? RED : 0xffa070) : Math.random() < 0.6 ? 0xff9a40 : GOLD;
    this.front.addChild(s);
    const a = Math.random() * Math.PI * 2;
    this.motes.push({
      s,
      vx: burst ? Math.cos(a) * burst : (Math.random() - 0.5) * 16,
      vy: burst ? Math.sin(a) * burst - 40 : -(40 + Math.random() * 70),
      life: 1.4 + Math.random() * 1.2,
      age: 0,
      a0: 0.95,
      size: 0,
    });
  }

  private burst(n: number, at: [number, number] = [HEAD_C[0], HEAD_C[1]], speed = 180): void {
    for (let i = 0; i < n; i++) this.spawnEmber(at[0] + (Math.random() - 0.5) * 40, at[1] + (Math.random() - 0.5) * 40, speed * (0.4 + Math.random() * 0.8));
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

  private scheduleTell(): void {
    gsap.delayedCall(3 + Math.random() * 4, () => {
      if (this.destroyed) return;
      if (!this.busy?.isActive()) {
        const roll = Math.random();
        const tl = gsap.timeline();
        if (roll < 0.4) {
          const dir = Math.random() < 0.65 ? 1 : -0.6;
          tl.add(() => this.lookAt(dir, Math.random() * 0.5)).add(() => this.lookAt(0, 0), 1.4 + Math.random());
        } else if (roll < 0.75) {
          // the cobra rears, then flicks toward the reels
          tl.to(this.fx, { rear: 0.6, duration: 0.35, ease: 'power2.out' }).to(this.fx, { rear: 0, strike: 0.4, duration: 0.14, ease: 'power3.in' }).to(this.fx, { strike: 0, duration: 0.4 });
        } else {
          tl.to(this.fx, { flare: 0.4, duration: 0.25 }).to(this.fx, { flare: 0, duration: 0.8 });
          if (this.form === 'inhuman') this.crackle(0.6);
        }
        this.play(tl);
      }
      this.scheduleTell();
    });
  }

  /** x: -1 away from the reels … 1 toward them. */
  lookAt(x: number, y: number): void {
    this.look.tx = x;
    this.look.ty = y;
  }

  shockwave(_power = 1): void {}

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
    tl.to(this.fx, { flare: 0.8, rear: 1, shake: 6, duration: 0.3 }, 0);
    for (let i = 0; i < 6; i++) {
      tl.add(() => {
        this.rage = i % 2 ? (to === 'inhuman' ? 0.2 : 0.8) : to === 'inhuman' ? 0.9 : 0.1;
        this.split.red = { x: (Math.random() - 0.5) * 22, y: (Math.random() - 0.5) * 6 };
        this.split.blue = { x: (Math.random() - 0.5) * 22, y: 0 };
        if (to === 'inhuman') this.crackle(0.7);
      }, 0.1 + i * 0.07);
    }
    tl.add(() => {
      this.form = to;
      this.split.red = { x: 0, y: 0 };
      this.split.blue = { x: 0, y: 0 };
      this.burst(30);
      if (to === 'inhuman') this.crackle(1.4);
      this.onTransform?.(to);
    }, 0.55)
      .to(this.fx, { rear: 0, strike: 1, flare: 1.2, duration: 0.15 }, 0.55)
      .to(this.fx, { strike: 0, flare: 0, shake: 0, duration: 0.7 }, 1.4);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        this.lookAt(1, 0.4);
        tl.to(this.fx, { rear: 0.5, flare: 0.2, duration: 0.2, ease: 'power2.out' })
          .to(this.fx, { rear: 0, strike: 0.35, duration: 0.12, ease: 'power3.in' })
          .to(this.fx, { strike: 0, flare: 0, duration: 0.5 })
          .add(() => this.lookAt(0.7, 0.3), 0.6);
        break;
      case 'codex':
        tl.to(this.fx, { rear: 0.8, duration: 0.12, ease: 'power2.out' }).to(this.fx, { rear: 0, strike: 0.8, flare: 0.5, duration: 0.1, ease: 'power3.in' }).to(this.fx, { strike: 0, flare: 0, duration: 0.5 });
        break;
      case 'win':
        this.lookAt(0.3, 0);
        tl.to(this.fx, { rear: 0.7, flare: 0.6, duration: 0.18, ease: 'power2.out' })
          .to(this.fx, { rear: 0, strike: 0.8, flare: 0.9, duration: 0.12, ease: 'power3.in' })
          .add(() => this.burst(18, COBRA_MOUTH, 160))
          .to(this.fx, { strike: 0, flare: 0, duration: 0.6 }, '+=0.15');
        break;
      case 'big':
        this.lookAt(0.6, -0.4);
        tl.to(this.fx, { rear: 1, flare: 1, y: -10, duration: 0.25, ease: 'power2.out' })
          .to(this.fx, { rear: 0, strike: 1, flare: 1.4, shake: 5, duration: 0.12, ease: 'power3.in' })
          .to(this.fx, { beam: 1, duration: 0.15 })
          .add(() => {
            this.burst(40, COBRA_MOUTH, 240);
            this.crackle(1.2);
          }, '<')
          .to(this.fx, { beam: 0, shake: 0, duration: 0.45 }, '+=1.1')
          .to(this.fx, { strike: 0, flare: 0, y: 0, duration: 0.8, ease: 'power2.out' })
          .add(() => this.lookAt(0, 0));
        break;
      case 'feature':
        this.lookAt(0, 0);
        this.setForm('inhuman');
        return;
    }
    this.play(tl);
  }
}

function lerpColor(a: number, b: number, k: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * k) << s;
  };
  return ch(16) | ch(8) | ch(0);
}
