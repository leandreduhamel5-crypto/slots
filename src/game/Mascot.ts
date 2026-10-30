import { Container, DisplacementFilter, Graphics, MeshPlane, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { makeCanvas } from './art/painters';
import { paintFlameBlob } from './Fire';

/**
 * Cleopatra, one uniform character: the painting (soft-matted, hair strand by strand) is a
 * single dense mesh deformed by an invisible skeleton with smooth skin weights, the way Spine
 * meshes are rigged in production slots. No part is ever cut out, so nothing can tear or show
 * a seam. Coordinates are pixels of the 809×1003 matte.
 */
export const ART_W = 809;
export const ART_H = 1003;
type V2 = [number, number];
const P = (x: number, y: number): V2 => [x, y + 6];

/* skeleton (rest pose) */
const HIPS = P(430, 760);
const CHEST = P(470, 420);
const NECK = P(480, 292);
const HEAD_C = P(515, 150);
const SHOULDER = P(322, 345);
const ELBOW = P(262, 565);
const PALM = P(92, 850);
const COBRA_NECK = P(690, 250);
const COBRA_C = P(730, 95);
/* features */
const EYES: V2[] = [P(500, 127), P(555, 157)];
const COBRA_EYE = P(752, 77);
const COBRA_MOUTH = P(792, 115);
const VEIL = P(120, 560);
const HAIR = P(330, 250);

const GOLD = 0xffc860;
const RED = 0xff2a22;

export interface MascotTextures {
  art: Texture;
  silhouette: Texture;
  rim: Texture;
  cracks: [Texture, Texture];
  glow: Texture;
  flame: Texture;
  noise: Texture;
  beam: Texture;
  ring: Texture;
  sparkles: V2[];
  edge: V2[];
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


/** Shockwave ring (thin, bright) for the staff striking the floor. */
function ringCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 90, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
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


/** Thin bright outline of the silhouette (for the red rim light of the infected form). */
function rimCanvas(art: HTMLCanvasElement): HTMLCanvasElement {
  const pad = 30;
  const [c, ctx] = makeCanvas(art.width + pad * 2, art.height + pad * 2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.drawImage(art, pad + Math.cos(a) * 6, pad + Math.sin(a) * 6);
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(art, pad, pad);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  const [b, bx] = makeCanvas(c.width, c.height);
  bx.filter = 'blur(3px)';
  bx.drawImage(c, 0, 0);
  return b;
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

export async function buildMascotTextures(img: HTMLImageElement): Promise<MascotTextures> {
  const art = canvasOf(img);
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  const cr = cracksFor(art, [0, 0], [
    [EYES[0][0], EYES[0][1] + 8, Math.PI * 0.6, 70],
    [EYES[1][0], EYES[1][1] + 8, Math.PI * 0.45, 60],
    [NECK[0], NECK[1] + 10, Math.PI * 0.5, 110],
    [CHEST[0] - 80, CHEST[1] - 60, Math.PI * 0.6, 160],
    [CHEST[0] + 40, CHEST[1] + 60, Math.PI * 0.45, 160],
    [HIPS[0], HIPS[1], Math.PI * 0.55, 180],
    [ELBOW[0], ELBOW[1], Math.PI * 0.7, 140],
  ], 29);
  const noise = t(noiseCanvas());
  noise.source.addressMode = 'repeat';
  return {
    art: Texture.from(img),
    silhouette: t(silhouetteCanvas(art)),
    rim: t(rimCanvas(art)),
    cracks: [t(cr[0]), t(cr[1])],
    glow: t(glowCanvas()),
    flame: t(paintFlameBlob()),
    noise,
    beam: t(beamCanvas()),
    ring: t(ringCanvas()),
    sparkles: sparklePoints(art),
    edge: edgePoints(art),
  };
}

/* ------------------------------------------------------------------ skinning */

type M = [number, number, number, number, number, number]; // a b c d tx ty
const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
/** rotate by r (and scale by s) around pivot p, then translate by (dx, dy) */
const around = (p: V2, r: number, dx = 0, dy = 0, s = 1): M => {
  const c = Math.cos(r) * s;
  const n = Math.sin(r) * s;
  return [c, n, -n, c, p[0] - c * p[0] + n * p[1] + dx, p[1] - n * p[0] - c * p[1] + dy];
};
const apply = (m: M, x: number, y: number): V2 => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** distance from p to the segment ab */
function segDist(p: V2, a: V2, b: V2): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t);
}

const BONES = ['hips', 'chest', 'head', 'armU', 'armF', 'cobra'] as const;
type BoneName = (typeof BONES)[number];

/** Smooth skin weights of an art point. */
function weights(x: number, y: number): number[] {
  const p: V2 = [x, y];
  const head = (1 - smooth(150, 230, Math.hypot(x - HEAD_C[0], (y - HEAD_C[1]) * 0.85))) * (1 - smooth(NECK[1] - 30, NECK[1] + 30, y));
  const cobra = (1 - smooth(80, 190, Math.hypot(x - COBRA_C[0], (y - COBRA_C[1]) * 0.75))) * smooth(560, 620, x);
  const armF = (1 - smooth(40, 95, segDist(p, ELBOW, PALM))) * smooth(ELBOW[1] - 40, ELBOW[1] + 40, y) * (1 - smooth(300, 380, x));
  const armU = (1 - smooth(40, 90, segDist(p, SHOULDER, ELBOW))) * (1 - armF) * (1 - smooth(330, 400, x));
  const chest = (1 - smooth(HIPS[1] - 200, HIPS[1] - 20, y)) * (1 - head) * (1 - armU) * (1 - armF) * (1 - cobra);
  const raw = [0, chest, head, armU, armF, cobra];
  const sum = raw.reduce((a, b) => a + b, 0);
  raw[0] = Math.max(0, 1 - sum);
  const tot = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / tot);
}

interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  a0: number;
  size: number;
  grow?: number;
  ramp?: boolean;
}

/**
 * Behaviour: a living idle (weight shift, breathing, the head drifting toward the reels, hair
 * and veil in the wind, the cobra swaying), then full-body gestures: on spin she lifts her chin
 * and the cobra rears and strikes; on a win her free hand rises and a flame of gold blooms in
 * her palm; on a big win she leans back, hand raised, while the cobra spits light over the reels.
 * In the free spins she is wreathed in a red aura: flames licking off her silhouette, a red rim
 * light, glowing eyes and molten cracks.
 */
export class Mascot extends Container {
  private float = new Container();
  private rig = new Container();
  private mesh: MeshPlane;
  private rest: Float32Array;
  private skin: Float32Array;
  private auraOuter: Sprite;
  private noise: Sprite;
  private displace: DisplacementFilter;
  private rim: Sprite;
  private cracks: Sprite[] = [];
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
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  private bones = {} as Record<BoneName, M>;
  private fx = { y: 0, flare: 0, beam: 0, shake: 0, strike: 0, rear: 0, raise: 0, orb: 0, lean: 0, chin: 0 };
  form: Form = 'human';
  onTransform: ((to: Form) => void) | null = null;

  constructor(
    private tex: MascotTextures,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    const glow = (size: number, tint: number) => {
      const s = new Sprite(tex.glow);
      s.anchor.set(0.5);
      s.width = s.height = size;
      s.tint = tint;
      s.blendMode = 'add';
      return s;
    };
    this.auraOuter = new Sprite(tex.silhouette);
    this.auraOuter.anchor.set(0.5);
    this.auraOuter.position.set(ART_W / 2, ART_H / 2);
    this.auraOuter.blendMode = 'add';
    this.noise = new Sprite(tex.noise);
    this.noise.renderable = false;
    this.noise.scale.set(1.8);
    this.displace = new DisplacementFilter({ sprite: this.noise, scale: 24 });
    const aura = new Container();
    aura.addChild(this.auraOuter);
    aura.filters = [this.displace];

    this.mesh = new MeshPlane({ texture: custom ? Texture.from(custom) : tex.art, verticesX: 36, verticesY: 44 });
    this.mesh.autoResize = false;
    if (custom) this.mesh.scale.set(ART_W / custom.naturalWidth, ART_H / custom.naturalHeight);
    this.rest = new Float32Array(this.mesh.geometry.positions);
    // per-vertex weights (in art space), computed once
    const n = this.rest.length / 2;
    this.skin = new Float32Array(n * BONES.length);
    const sx = this.mesh.scale.x;
    const sy = this.mesh.scale.y;
    for (let i = 0; i < n; i++) {
      const w = weights(this.rest[i * 2] * sx, this.rest[i * 2 + 1] * sy);
      for (let b = 0; b < BONES.length; b++) this.skin[i * BONES.length + b] = w[b];
    }

    this.rim = new Sprite(tex.rim);
    this.rim.position.set(-30, -30);
    this.rim.blendMode = 'add';
    this.rim.alpha = 0;
    for (const ct of tex.cracks) {
      const s = new Sprite(ct);
      s.alpha = 0;
      this.cracks.push(s);
    }
    this.cracks[1].blendMode = 'add';
    for (let i = 0; i < EYES.length; i++) this.eyeGlows.push(glow(40, GOLD));
    this.cobraEye = glow(46, RED);
    this.mouthOrb = glow(20, GOLD);
    this.mouthOrb.alpha = 0;
    this.beam = new Sprite(tex.beam);
    this.beam.anchor.set(0.02, 0.5);
    this.beam.blendMode = 'add';
    this.beam.alpha = 0;
    this.orb = glow(120, GOLD);
    this.orbCore = glow(40, 0xffffff);
    this.orb.alpha = this.orbCore.alpha = 0;
    this.sparks.blendMode = 'add';

    this.rig.addChild(this.noise, this.back, aura, this.mesh, this.cracks[0], this.cracks[1], this.rim, ...this.eyeGlows, this.cobraEye, this.beam, this.mouthOrb, this.orb, this.orbCore, this.sparks, this.front);
    this.rig.pivot.set(ART_W / 2, ART_H);
    this.float.addChild(this.rig);
    this.addChild(this.float);

    for (const b of BONES) this.bones[b] = [1, 0, 0, 1, 0, 0];
    gsap.ticker.add(this.tick);
    this.scheduleTell();
  }

  /** Kept for API compatibility. */
  setBook(_t: Texture): void {}

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    gsap.ticker.remove(this.tick);
    super.destroy(options);
  }

  /** Skinned position of an art point. */
  private pose(x: number, y: number): V2 {
    const w = weights(x, y);
    let ox = 0;
    let oy = 0;
    BONES.forEach((b, i) => {
      if (w[i] < 1e-4) return;
      const q = apply(this.bones[b], x, y);
      ox += q[0] * w[i];
      oy += q[1] * w[i];
    });
    return [ox, oy];
  }

  private solveBones(): void {
    const t = this.t;
    const fx = this.fx;
    const breath = Math.sin(t * 1.6);
    const hips = around(HIPS, Math.sin(t * 0.55) * 0.012 - fx.lean * 0.05, Math.sin(t * 0.55) * 3, 0);
    const chest = mul(hips, around(HIPS, Math.sin(t * 0.55 + 0.7) * 0.01 - fx.lean * 0.04, 0, -breath * 2.2, 1 + breath * 0.004));
    const head = mul(
      chest,
      around(NECK, -this.look.x * 0.07 + Math.sin(t * 0.7) * 0.02 - fx.chin * 0.1 + fx.lean * 0.06, this.look.x * 4, this.look.y * 3 - breath * 1.2),
    );
    const armU = mul(chest, around(SHOULDER, Math.sin(t * 0.9) * 0.025 + fx.raise * 0.1));
    const armF = mul(armU, around(ELBOW, Math.sin(t * 0.9 + 0.7) * 0.035 + fx.raise * 0.42));
    const cobra = mul(
      chest,
      around(COBRA_NECK, Math.sin(t * 1.3) * 0.07 - fx.rear * 0.22 + fx.strike * 0.16, fx.strike * 30, -fx.rear * 16 + Math.sin(t * 1.3 + 1) * 3, 1 + fx.strike * 0.14),
    );
    Object.assign(this.bones, { hips, chest, head, armU, armF, cobra });
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
    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 3.5);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 3.5);
    this.float.y = Math.sin(t * 1.1) * 3 + fx.y;
    this.rig.x = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
    this.solveBones();

    // skin the mesh, plus secondary motion (hair, veil) that follows the bones
    const pos = this.mesh.geometry.positions;
    const rest = this.rest;
    const sk = this.skin;
    const sx = this.mesh.scale.x;
    const sy = this.mesh.scale.y;
    const B = BONES.length;
    const mats = BONES.map((b) => this.bones[b]);
    for (let i = 0, v = 0; i < pos.length; i += 2, v++) {
      const x = rest[i] * sx;
      const y = rest[i + 1] * sy;
      let ox = 0;
      let oy = 0;
      for (let b = 0; b < B; b++) {
        const w = sk[v * B + b];
        if (w < 1e-4) continue;
        const m = mats[b];
        ox += (m[0] * x + m[2] * y + m[4]) * w;
        oy += (m[1] * x + m[3] * y + m[5]) * w;
      }
      // hair: strands swing behind her shoulder, lagging the head
      const wh = (1 - smooth(70, 190, Math.hypot(x - HAIR[0], (y - HAIR[1]) * 0.7))) * smooth(150, 300, y);
      ox += Math.sin(t * 1.15 + y * 0.012) * 5 * wh + this.look.x * -4 * wh;
      // veil and ribbons ripple, more when she moves
      const wv = (1 - smooth(120, 380, Math.hypot(x - VEIL[0], (y - VEIL[1]) * 0.6))) * (1 - smooth(200, 440, x));
      ox += Math.sin(t * 1.8 + y * 0.012 + x * 0.01) * (10 + fx.raise * 6) * wv * (1 + r * 0.8);
      oy += Math.cos(t * 1.4 + x * 0.015) * 5 * wv;
      pos[i] = ox / sx;
      pos[i + 1] = oy / sy;
    }
    this.mesh.geometry.getBuffer('aPosition').update();
    this.mesh.tint = lerpColor(0xffffff, 0xffc0b0, r * 0.45);

    // overlays ride the skeleton
    const ch = this.bones.chest;
    for (const s of [...this.cracks]) {
      s.position.set(ch[4], ch[5]);
      s.rotation = Math.atan2(ch[1], ch[0]);
    }
    this.cracks[0].alpha = r;
    this.cracks[1].alpha = r * (0.4 + beat * 0.6 + fx.flare * 0.4);
    this.rim.alpha = r * (0.55 + beat * 0.45) + fx.flare * 0.25;
    this.rim.tint = lerpColor(0xffd080, RED, r);
    const flick = Math.random() < 0.012 ? 0.3 : 1;
    EYES.forEach((e, i) => {
      const [x, y] = this.pose(e[0], e[1]);
      const g = this.eyeGlows[i];
      g.position.set(x, y);
      g.tint = lerpColor(0xffd890, RED, r);
      g.alpha = (0.12 + r * 0.75 + beat * 0.25 * r + fx.flare * 0.6) * flick;
      const s = (28 + fx.flare * 30 + r * 16) / 256;
      g.scale.set(s * 1.5, s);
    });
    const ce = this.pose(...COBRA_EYE);
    this.cobraEye.position.set(...ce);
    this.cobraEye.tint = RED;
    this.cobraEye.alpha = 0.55 + 0.25 * Math.sin(t * 3.1) + fx.flare * 0.5 + r * 0.3;
    this.cobraEye.scale.set((34 + fx.flare * 36) / 256);
    const mo = this.pose(...COBRA_MOUTH);
    this.mouthOrb.position.set(...mo);
    this.mouthOrb.alpha = Math.min(1, fx.beam * 1.2 + fx.strike * 0.4);
    this.mouthOrb.tint = tint;
    this.mouthOrb.scale.set((24 + fx.beam * 90 + Math.random() * 10) / 256);
    this.beam.position.set(...mo);
    this.beam.alpha = fx.beam * (0.85 + Math.random() * 0.15);
    this.beam.tint = tint;
    this.beam.scale.set((1300 * (0.5 + fx.beam * 0.5)) / 512, (300 + Math.random() * 40) / 64);
    this.beam.rotation = -0.75 + Math.sin(t * 6) * 0.03;
    const palm = this.pose(...PALM);
    this.orb.position.set(...palm);
    this.orbCore.position.set(...palm);
    this.orb.alpha = Math.min(1, fx.orb * (0.8 + 0.2 * Math.sin(t * 9)) + r * 0.3);
    this.orbCore.alpha = Math.min(1, fx.orb * 0.9 + r * 0.2);
    this.orb.tint = tint;
    this.orb.width = this.orb.height = 90 + fx.orb * 100 + r * 30 + Math.sin(t * 7) * 10;

    // aura: golden heat haze at rest, a red burning one when infected
    this.noise.x = (this.noise.x + dt * 10) % 256;
    this.noise.y = (this.noise.y - dt * (70 + r * 90)) % 256;
    this.displace.scale.x = 14 + r * 22 + fx.flare * 20;
    this.displace.scale.y = 26 + r * 40 + fx.flare * 30;
    this.auraOuter.tint = tint;
    this.auraOuter.alpha = 0.26 + r * 0.45 + beat * 0.15 * (1 + r) + fx.flare * 0.35;
    this.auraOuter.scale.set(1 + r * 0.05 + beat * 0.02 * r);

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
    const [x, y] = this.pose(p[0], p[1]);
    this.mote(x, y, this.form === 'inhuman' ? 0xff6a40 : 0xfff0c0, 0, -6, 0.35 + Math.random() * 0.4, 12 + Math.random() * 18);
  }

  private spawnFlame(): void {
    const pts = this.tex.edge;
    const p = pts[Math.floor(Math.random() * pts.length)];
    const [x, y] = this.pose(p[0], p[1]);
    const s = new Sprite(this.tex.flame);
    s.anchor.set(0.5, 0.8);
    s.position.set(x + (Math.random() - 0.5) * 6, y);
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
    const [x, y] = this.pose(...PALM);
    const a = Math.random() * Math.PI * 2;
    const rr = 30 + Math.random() * 40;
    this.mote(x + Math.cos(a) * rr, y + Math.sin(a) * rr, this.form === 'inhuman' ? RED : 0xffe0a0, -Math.cos(a) * 60, -Math.sin(a) * 60 - 30, 0.6 + Math.random() * 0.4, 14 + Math.random() * 12);
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

  private scheduleTell(): void {
    gsap.delayedCall(3 + Math.random() * 4, () => {
      if (this.destroyed) return;
      if (!this.busy?.isActive()) {
        const roll = Math.random();
        const tl = gsap.timeline();
        if (roll < 0.35) {
          const dir = Math.random() < 0.65 ? 1 : -0.6;
          tl.add(() => this.lookAt(dir, Math.random() * 0.5)).add(() => this.lookAt(0, 0), 1.8 + Math.random());
        } else if (roll < 0.65) {
          tl.to(this.fx, { rear: 0.6, duration: 0.4, ease: 'sine.out' }).to(this.fx, { rear: 0, strike: 0.4, duration: 0.14, ease: 'power3.in' }).to(this.fx, { strike: 0, duration: 0.5, ease: 'sine.out' });
        } else if (roll < 0.85) {
          tl.to(this.fx, { raise: 0.5, orb: 0.6, duration: 0.8, ease: 'sine.inOut' }).to(this.fx, { raise: 0, orb: 0, duration: 1, ease: 'sine.inOut' }, '+=0.9');
        } else {
          tl.to(this.fx, { chin: 0.6, flare: 0.4, duration: 0.5, ease: 'sine.inOut' }).to(this.fx, { chin: 0, flare: 0, duration: 0.9, ease: 'sine.inOut' }, '+=0.4');
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
    tl.to(this.fx, { flare: 0.8, lean: 0.6, chin: 0.8, raise: 1, orb: 1, rear: 1, shake: 5, duration: 0.5, ease: 'power2.out' }, 0);
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
      this.burst(36, this.pose(...PALM), 240);
      if (to === 'inhuman') this.crackle(1.4);
      this.onTransform?.(to);
    }, 0.6)
      .to(this.fx, { rear: 0, strike: 1, flare: 1.3, duration: 0.14, ease: 'power3.in' }, 0.6)
      .to(this.fx, { strike: 0, flare: 0, shake: 0, lean: 0, chin: 0, raise: 0, orb: 0, duration: 1, ease: 'sine.inOut' }, 1.4);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        this.lookAt(1, 0.4);
        tl.to(this.fx, { chin: 0.4, rear: 0.6, duration: 0.22, ease: 'power2.out' })
          .to(this.fx, { rear: 0, strike: 0.55, duration: 0.11, ease: 'power3.in' })
          .to(this.fx, { strike: 0, chin: 0, duration: 0.55, ease: 'sine.out' })
          .add(() => this.lookAt(0.7, 0.3));
        break;
      case 'codex':
        tl.to(this.fx, { rear: 0.8, duration: 0.12, ease: 'power2.out' }).to(this.fx, { rear: 0, strike: 0.8, flare: 0.5, duration: 0.1, ease: 'power3.in' }).to(this.fx, { strike: 0, flare: 0, duration: 0.5 });
        break;
      case 'win':
        this.lookAt(-0.2, 0.1);
        tl.to(this.fx, { raise: 1, orb: 1, flare: 0.6, chin: 0.3, duration: 0.55, ease: 'back.out(1.4)' })
          .add(() => this.burst(18, this.pose(...PALM), 170), 0.4)
          .to(this.fx, { rear: 0.6, duration: 0.18 }, 0.2)
          .to(this.fx, { rear: 0, strike: 0.7, duration: 0.11, ease: 'power3.in' }, 0.45)
          .to(this.fx, { strike: 0, duration: 0.45 }, 0.65)
          .to(this.fx, { raise: 0, orb: 0, flare: 0, chin: 0, duration: 1.1, ease: 'sine.inOut' }, 1.5)
          .add(() => this.lookAt(0.5, 0.2));
        break;
      case 'big':
        this.lookAt(0.4, -0.6);
        tl.to(this.fx, { lean: 1, chin: 1, raise: 1, orb: 1, rear: 1, flare: 1, y: -6, duration: 0.5, ease: 'back.out(1.3)' })
          .to(this.fx, { rear: 0, strike: 1, flare: 1.4, shake: 4, duration: 0.12, ease: 'power3.in' })
          .to(this.fx, { beam: 1, duration: 0.15 })
          .add(() => {
            this.burst(40, this.pose(...COBRA_MOUTH), 240);
            this.crackle(1.2);
          }, '<')
          .to(this.fx, { beam: 0, shake: 0, duration: 0.5 }, '+=1.2')
          .to(this.fx, { strike: 0, lean: 0, chin: 0, raise: 0, orb: 0, flare: 0, y: 0, duration: 1.1, ease: 'sine.inOut' })
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
