import { Container, DisplacementFilter, Graphics, MeshPlane, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { makeCanvas } from './art/painters';
import baseUrl from './art/egypt/cleo/base.webp';
import armUUrl from './art/egypt/cleo/armU.webp';
import armFUrl from './art/egypt/cleo/armF.webp';
import headUrl from './art/egypt/cleo/head.webp';
import staffUrl from './art/egypt/cleo/staff.webp';

/**
 * Cleopatra as a cut-out skeletal character (the way slot studios rig their mascots in Spine):
 * the painting is split into body, head, upper arm, forearm and the cobra staff, the area
 * behind each moving part is painted in, and the parts hang on a bone hierarchy. Coordinates
 * are pixels of the original 805×997 painting.
 */
export const ART_W = 805;
export const ART_H = 997;
const LAYERS = {
  base: { url: baseUrl, at: [0, 257] },
  armU: { url: armUUrl, at: [211, 317] },
  armF: { url: armFUrl, at: [21, 534] },
  head: { url: headUrl, at: [235, 0] },
  staff: { url: staffUrl, at: [559, 46] },
} as const;
type LayerKey = keyof typeof LAYERS;

/* joints */
const NECK: [number, number] = [480, 292];
const SHOULDER: [number, number] = [322, 345];
const ELBOW: [number, number] = [262, 565];
const PALM: [number, number] = [92, 850];
const GRIP: [number, number] = [660, 480];
const HIPS: [number, number] = [430, 760];
/* features */
const EYES: [number, number][] = [
  [500, 127],
  [555, 157],
];
const CHEST: [number, number] = [470, 420];
const VEIL: [number, number] = [120, 560];
const COBRA_C: [number, number] = [730, 95];
const COBRA_NECK: [number, number] = [690, 250];
const COBRA_EYE: [number, number] = [752, 77];
const COBRA_MOUTH: [number, number] = [792, 115];
const STAFF_FOOT: [number, number] = [588, 990];

const GOLD = 0xffc860;
const RED = 0xff2a22;

export interface MascotTextures {
  layers: Record<LayerKey, Texture>;
  canvases: Record<LayerKey, HTMLCanvasElement>;
  silhouette: Texture;
  headCracks: [Texture, Texture];
  baseCracks: [Texture, Texture];
  glow: Texture;
  noise: Texture;
  beam: Texture;
  ring: Texture;
  sparkles: Record<LayerKey, [number, number][]>;
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


function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
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

export async function buildMascotTextures(flat: HTMLImageElement): Promise<MascotTextures> {
  const keys = Object.keys(LAYERS) as LayerKey[];
  const imgs = await Promise.all(keys.map((k) => loadImage(LAYERS[k].url)));
  const canvases = {} as Record<LayerKey, HTMLCanvasElement>;
  const layers = {} as Record<LayerKey, Texture>;
  const sparkles = {} as Record<LayerKey, [number, number][]>;
  keys.forEach((k, i) => {
    canvases[k] = canvasOf(imgs[i]);
    layers[k] = Texture.from(canvases[k]);
    sparkles[k] = sparklePoints(canvases[k]);
  });
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  const hc = cracksFor(canvases.head, LAYERS.head.at, [
    [EYES[0][0], EYES[0][1] + 8, Math.PI * 0.6, 70],
    [EYES[1][0], EYES[1][1] + 8, Math.PI * 0.45, 60],
    [NECK[0], NECK[1] - 20, Math.PI * 0.5, 40],
  ], 29);
  const bc = cracksFor(canvases.base, LAYERS.base.at, [
    [NECK[0], NECK[1] + 10, Math.PI * 0.5, 110],
    [CHEST[0] - 80, CHEST[1] - 60, Math.PI * 0.6, 160],
    [CHEST[0] + 40, CHEST[1] + 60, Math.PI * 0.45, 160],
    [HIPS[0], HIPS[1], Math.PI * 0.55, 180],
  ], 17);
  const noise = t(noiseCanvas());
  noise.source.addressMode = 'repeat';
  return {
    layers,
    canvases,
    silhouette: t(silhouetteCanvas(canvasOf(flat))),
    headCracks: [t(hc[0]), t(hc[1])],
    baseCracks: [t(bc[0]), t(bc[1])],
    glow: t(glowCanvas()),
    noise,
    beam: t(beamCanvas()),
    ring: t(ringCanvas()),
    sparkles,
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

/** A bone: a container whose origin is the joint, holding a part drawn at its art position. */
class Bone extends Container {
  constructor(joint: readonly [number, number], parentJoint: readonly [number, number] = [0, 0]) {
    super();
    this.position.set(joint[0] - parentJoint[0], joint[1] - parentJoint[1]);
    this.pivot.set(0, 0);
    this.joint = joint;
  }
  joint: readonly [number, number];
  /** add a display object positioned in art coordinates */
  place<T extends Container>(o: T, at: readonly [number, number]): T {
    o.position.set(at[0] - this.joint[0], at[1] - this.joint[1]);
    this.addChild(o);
    return o;
  }
}

/**
 * Cleopatra, alive. Bones: hips → torso (breathing mesh) → head (turns, tilts, hair sways),
 * shoulder → upper arm → forearm with an energy orb in her palm, and the hand gripping the
 * cobra staff, whose snake head sways, rears and strikes (a warped mesh). Gestures are full
 * poses blended over the idle: she strikes the floor with her staff when the reels spin,
 * raises her hand with a flare of magic on wins, lifts the staff to the sky while the cobra
 * spits light on big wins, and in the free spins the infection cracks her open.
 */
export class Mascot extends Container {
  private float = new Container();
  private rig: Bone;
  private torso: Bone;
  private head: Bone;
  private armU: Bone;
  private armF: Bone;
  private staff: Bone;
  private baseMesh: MeshPlane;
  private baseRest: Float32Array;
  private headMesh: MeshPlane;
  private headRest: Float32Array;
  private staffMesh: MeshPlane;
  private staffRest: Float32Array;
  private auraOuter: Sprite;
  private noise: Sprite;
  private displace: DisplacementFilter;
  private eyeGlows: Sprite[] = [];
  private headCracks: Sprite[] = [];
  private baseCracks: Sprite[] = [];
  private cobraEye: Sprite;
  private mouthOrb: Sprite;
  private beam: Sprite;
  private orb: Sprite;
  private orbCore: Sprite;
  private shock: Sprite;
  private sparks = new Graphics();
  private front = new Container();
  private motes: Mote[] = [];
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private t = Math.random() * 10;
  private rage = 0;
  private emitIn = 0;
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  /** pose channels, animated by gestures */
  private fx = {
    y: 0,
    flare: 0,
    beam: 0,
    shake: 0,
    strike: 0,
    rear: 0,
    /** 0 hanging … 1 hand raised with the orb */
    raise: 0,
    /** 0 rest … 1 staff lifted to the sky */
    lift: 0,
    /** staff driven down into the floor */
    thump: 0,
    orb: 0,
    bow: 0,
  };
  form: Form = 'human';
  onTransform: ((to: Form) => void) | null = null;

  constructor(
    private tex: MascotTextures,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    void custom;
    const glow = (size: number, tint: number) => {
      const s = new Sprite(tex.glow);
      s.anchor.set(0.5);
      s.width = s.height = size;
      s.tint = tint;
      s.blendMode = 'add';
      return s;
    };
    const mesh = (k: LayerKey, vx: number, vy: number): [MeshPlane, Float32Array] => {
      const m = new MeshPlane({ texture: tex.layers[k], verticesX: vx, verticesY: vy });
      m.autoResize = false;
      return [m, new Float32Array(m.geometry.positions)];
    };

    // bones (positions relative to the parent joint)
    this.rig = new Bone(HIPS);
    this.rig.position.set(0, 0);
    this.rig.pivot.set(0, 0);
    this.torso = new Bone(HIPS, HIPS);
    this.head = new Bone(NECK, HIPS);
    this.armU = new Bone(SHOULDER, HIPS);
    this.armF = new Bone(ELBOW, SHOULDER);
    this.staff = new Bone(GRIP, HIPS);

    // aura behind everything
    this.auraOuter = new Sprite(tex.silhouette);
    this.auraOuter.anchor.set(0.5);
    this.auraOuter.blendMode = 'add';
    this.noise = new Sprite(tex.noise);
    this.noise.renderable = false;
    this.noise.scale.set(1.8);
    this.displace = new DisplacementFilter({ sprite: this.noise, scale: 24 });
    const aura = new Container();
    aura.addChild(this.auraOuter);
    aura.filters = [this.displace];
    this.rig.place(aura, [ART_W / 2, ART_H / 2]);
    this.rig.addChild(this.noise);

    // torso
    [this.baseMesh, this.baseRest] = mesh('base', 20, 24);
    this.torso.place(this.baseMesh, LAYERS.base.at);
    for (const ct of tex.baseCracks) {
      const s = this.torso.place(new Sprite(ct), LAYERS.base.at);
      s.alpha = 0;
      this.baseCracks.push(s);
    }
    this.baseCracks[1].blendMode = 'add';

    // left arm: upper arm then forearm with the palm orb
    this.armU.place(new Sprite(tex.layers.armU), LAYERS.armU.at);
    this.armF.place(new Sprite(tex.layers.armF), LAYERS.armF.at);
    this.orb = this.armF.place(glow(120, GOLD), PALM);
    this.orbCore = this.armF.place(glow(40, 0xffffff), PALM);
    this.orb.alpha = this.orbCore.alpha = 0;
    this.armU.addChild(this.armF);

    // head
    [this.headMesh, this.headRest] = mesh('head', 16, 16);
    this.head.place(this.headMesh, LAYERS.head.at);
    for (const ct of tex.headCracks) {
      const s = this.head.place(new Sprite(ct), LAYERS.head.at);
      s.alpha = 0;
      this.headCracks.push(s);
    }
    this.headCracks[1].blendMode = 'add';
    for (const e of EYES) this.eyeGlows.push(this.head.place(glow(40, GOLD), e));

    // staff and cobra
    [this.staffMesh, this.staffRest] = mesh('staff', 10, 30);
    this.staff.place(this.staffMesh, LAYERS.staff.at);
    this.cobraEye = this.staff.place(glow(46, RED), COBRA_EYE);
    this.mouthOrb = this.staff.place(glow(20, GOLD), COBRA_MOUTH);
    this.mouthOrb.alpha = 0;
    this.beam = this.staff.place(new Sprite(tex.beam), COBRA_MOUTH);
    this.beam.anchor.set(0.02, 0.5);
    this.beam.blendMode = 'add';
    this.beam.alpha = 0;
    this.shock = this.staff.place(new Sprite(tex.ring), STAFF_FOOT);
    this.shock.anchor.set(0.5);
    this.shock.blendMode = 'add';
    this.shock.alpha = 0;

    this.torso.addChild(this.head);
    this.sparks.blendMode = 'add';
    // draw order: torso, head, arm (in front of the veil), staff in front of everything
    this.rig.addChild(this.torso, this.armU, this.staff, this.sparks, this.front);
    this.sparks.position.set(-HIPS[0], -HIPS[1]);
    this.front.position.set(-HIPS[0], -HIPS[1]);
    // the rig stands on the bottom-centre of the painting
    this.rig.position.set(HIPS[0] - ART_W / 2, HIPS[1] - ART_H);
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

  /** Global art-space point of a point attached to a bone (for particles). */
  private artPoint(bone: Bone, p: readonly [number, number]): [number, number] {
    const g = bone.toGlobal({ x: p[0] - bone.joint[0], y: p[1] - bone.joint[1] });
    const l = this.front.toLocal(g);
    return [l.x, l.y];
  }

  /* ------------------------------------------------------------ per-frame */

  private warpMesh(m: MeshPlane, rest: Float32Array, at: readonly [number, number], f: (x: number, y: number, o: [number, number]) => void): void {
    const pos = m.geometry.positions;
    const o: [number, number] = [0, 0];
    for (let i = 0; i < pos.length; i += 2) {
      const x = rest[i] + at[0];
      const y = rest[i + 1] + at[1];
      o[0] = 0;
      o[1] = 0;
      f(x, y, o);
      pos[i] = rest[i] + o[0];
      pos[i + 1] = rest[i + 1] + o[1];
    }
    m.geometry.getBuffer('aPosition').update();
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
    const shake = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 4);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 4);
    const breath = Math.sin(t * 1.6);

    // whole body: hip sway, weight shift, a bow forward on gestures
    this.float.y = Math.sin(t * 1.1) * 3 + fx.y;
    this.rig.rotation = Math.sin(t * 0.55) * 0.012 - fx.bow * 0.04 + fx.lift * 0.02;
    this.rig.x = HIPS[0] - ART_W / 2 + shake;
    this.torso.rotation = Math.sin(t * 0.55 + 0.6) * 0.008 - fx.lift * 0.03;
    this.torso.scale.set(1, 1 + breath * 0.004);

    // torso mesh: breathing chest, rippling veil
    this.warpMesh(this.baseMesh, this.baseRest, LAYERS.base.at, (x, y, o) => {
      const wc = 1 - smooth(60, 220, Math.hypot(x - CHEST[0], (y - CHEST[1]) * 0.8));
      o[1] -= breath * 3 * wc;
      o[0] += (x - CHEST[0]) * 0.006 * breath * wc;
      const wv = (1 - smooth(120, 380, Math.hypot(x - VEIL[0], (y - VEIL[1]) * 0.6))) * (1 - smooth(200, 440, x));
      o[0] += Math.sin(t * 1.8 + y * 0.012 + x * 0.01) * 12 * wv * (1 + r) + fx.raise * 10 * wv;
      o[1] += Math.cos(t * 1.4 + x * 0.015) * 6 * wv;
    });

    // head: looks toward the reels, tilts, nods back on big moments; hair sways
    this.head.rotation = -this.look.x * 0.06 + Math.sin(t * 0.7) * 0.015 - fx.lift * 0.05 + fx.bow * 0.04;
    this.head.position.set(NECK[0] - HIPS[0] + this.look.x * 3, NECK[1] - HIPS[1] - breath * 1.5 + this.look.y * 2);
    this.warpMesh(this.headMesh, this.headRest, LAYERS.head.at, (x, y, o) => {
      const wh = smooth(150, 330, y) * (1 - smooth(260, 420, x));
      o[0] += Math.sin(t * 1.2 + y * 0.012) * 6 * wh - this.head.rotation * 40 * wh;
    });

    // left arm: idle sway, raises with the orb
    this.armU.rotation = Math.sin(t * 0.9) * 0.025 + fx.raise * 0.03;
    this.armF.rotation = Math.sin(t * 0.9 + 0.7) * 0.03 + fx.raise * 0.2;
    this.orb.alpha = Math.min(1, fx.orb * (0.8 + 0.2 * Math.sin(t * 9)) + r * 0.25);
    this.orbCore.alpha = Math.min(1, fx.orb * 0.9 + r * 0.15);
    this.orb.tint = tint;
    this.orb.width = this.orb.height = 90 + fx.orb * 90 + Math.sin(t * 7) * 10;

    // staff: sways in her grip, lifts to the sky, thumps the floor
    // the rod slides along its own line so the body behind it is never uncovered
    this.staff.rotation = Math.sin(t * 0.8) * 0.006;
    const slide = -fx.lift * 80 + fx.thump * 16;
    this.staff.position.set(GRIP[0] - HIPS[0] - slide * 0.143, GRIP[1] - HIPS[1] + slide);
    this.warpMesh(this.staffMesh, this.staffRest, LAYERS.staff.at, (x, y, o) => {
      const wk = 1 - smooth(90, 210, Math.hypot(x - COBRA_C[0], (y - COBRA_C[1]) * 0.8));
      if (wk <= 0) return;
      const ang = Math.sin(t * 1.3) * 0.07 - fx.rear * 0.2 + fx.strike * 0.14;
      const dx = x - COBRA_NECK[0];
      const dy = y - COBRA_NECK[1];
      const sc = 1 + fx.strike * 0.14;
      o[0] += (dx * Math.cos(ang) * sc - dy * Math.sin(ang) * sc - dx + fx.strike * 28) * wk;
      o[1] += (dx * Math.sin(ang) * sc + dy * Math.cos(ang) * sc - dy - fx.rear * 14 + Math.sin(t * 1.3 + 1) * 3) * wk;
    });
    // overlays riding the cobra head
    const cob = (p: readonly [number, number]): [number, number] => {
      const wk = 1 - smooth(90, 210, Math.hypot(p[0] - COBRA_C[0], (p[1] - COBRA_C[1]) * 0.8));
      const ang = Math.sin(t * 1.3) * 0.07 - fx.rear * 0.2 + fx.strike * 0.14;
      const dx = p[0] - COBRA_NECK[0];
      const dy = p[1] - COBRA_NECK[1];
      const sc = 1 + fx.strike * 0.14;
      return [
        p[0] + (dx * Math.cos(ang) * sc - dy * Math.sin(ang) * sc - dx + fx.strike * 28) * wk - GRIP[0],
        p[1] + (dx * Math.sin(ang) * sc + dy * Math.cos(ang) * sc - dy - fx.rear * 14 + Math.sin(t * 1.3 + 1) * 3) * wk - GRIP[1],
      ];
    };
    this.cobraEye.position.set(...cob(COBRA_EYE));
    this.cobraEye.tint = r > 0.5 ? RED : 0xff3a24;
    this.cobraEye.alpha = 0.55 + 0.25 * Math.sin(t * 3.1) + fx.flare * 0.5 + r * 0.3;
    this.cobraEye.scale.set((34 + fx.flare * 36) / 256);
    const mouth = cob(COBRA_MOUTH);
    this.mouthOrb.position.set(...mouth);
    this.mouthOrb.alpha = Math.min(1, fx.beam * 1.2 + fx.strike * 0.4);
    this.mouthOrb.tint = tint;
    this.mouthOrb.scale.set((24 + fx.beam * 90 + Math.random() * 10) / 256);
    this.beam.position.set(...mouth);
    this.beam.alpha = fx.beam * (0.85 + Math.random() * 0.15);
    this.beam.tint = tint;
    this.beam.scale.set((1300 * (0.5 + fx.beam * 0.5)) / 512, (300 + Math.random() * 40) / 64);
    this.beam.rotation = -0.75 + Math.sin(t * 6) * 0.03;

    // eyes, cracks, aura
    const flick = Math.random() < 0.012 ? 0.3 : 1;
    for (const g of this.eyeGlows) {
      g.tint = lerpColor(0xffd890, RED, r);
      g.alpha = (0.15 + r * 0.6 + beat * 0.25 * r + fx.flare * 0.6) * flick;
      const s = (30 + fx.flare * 30 + r * 10) / 256;
      g.scale.set(s * 1.4, s);
    }
    this.headCracks[0].alpha = this.baseCracks[0].alpha = r;
    this.headCracks[1].alpha = this.baseCracks[1].alpha = r * (0.4 + beat * 0.6 + fx.flare * 0.4);
    this.noise.x = (this.noise.x + dt * 10) % 256;
    this.noise.y = (this.noise.y - dt * 70) % 256;
    this.displace.scale.x = 14 + r * 14 + fx.flare * 20;
    this.displace.scale.y = 26 + r * 20 + fx.flare * 30;
    this.auraOuter.tint = tint;
    this.auraOuter.alpha = 0.28 + r * 0.25 + beat * 0.1 + fx.flare * 0.35;
    this.baseMesh.tint = this.headMesh.tint = lerpColor(0xffffff, 0xffb8a8, r * 0.55);

    // sparkles on the gold, embers, orb wisps
    this.emitIn -= dt;
    if (this.emitIn <= 0) {
      this.emitIn = 0.04 - r * 0.012;
      this.spawnSparkle();
      if (Math.random() < 0.45 + r * 0.4) this.spawnEmber();
      if (fx.orb > 0.3 || r > 0.5) this.spawnOrbWisp();
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

  private mote(x: number, y: number, tint: number, vx: number, vy: number, life: number, size: number, startScale = 0): void {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.blendMode = 'add';
    s.tint = tint;
    if (startScale) s.scale.set(startScale);
    this.front.addChild(s);
    this.motes.push({ s, vx, vy, life, age: 0, a0: 1, size });
  }

  private spawnSparkle(): void {
    const keys: [LayerKey, Bone][] = [['base', this.torso], ['head', this.head], ['staff', this.staff], ['armU', this.armU], ['armF', this.armF]];
    const [k, bone] = keys[Math.floor(Math.random() * keys.length)];
    const pts = this.tex.sparkles[k];
    if (!pts.length) return;
    const p = pts[Math.floor(Math.random() * pts.length)];
    const [x, y] = this.artPoint(bone, [p[0] + LAYERS[k].at[0], p[1] + LAYERS[k].at[1]]);
    this.mote(x, y, this.form === 'inhuman' ? 0xff6a40 : 0xfff0c0, 0, -6, 0.35 + Math.random() * 0.4, 12 + Math.random() * 18);
  }

  private spawnEmber(at?: [number, number], speed = 0): void {
    const [x, y] = at ?? [Math.random() * ART_W, ART_H * (0.35 + Math.random() * 0.6)];
    const a = Math.random() * Math.PI * 2;
    const tint = this.form === 'inhuman' ? (Math.random() < 0.7 ? RED : 0xffa070) : Math.random() < 0.6 ? 0xff9a40 : GOLD;
    this.mote(
      x + (speed ? (Math.random() - 0.5) * 30 : 0),
      y,
      tint,
      speed ? Math.cos(a) * speed : (Math.random() - 0.5) * 16,
      speed ? Math.sin(a) * speed - 40 : -(40 + Math.random() * 70),
      1.4 + Math.random() * 1.2,
      0,
      (3 + Math.random() * 7) / 256,
    );
  }

  /** Wisps of light spiralling around the orb in her palm. */
  private spawnOrbWisp(): void {
    const [x, y] = this.artPoint(this.armF, PALM);
    const a = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * 40;
    this.mote(x + Math.cos(a) * r, y + Math.sin(a) * r, this.form === 'inhuman' ? RED : 0xffe0a0, -Math.cos(a) * 60, -Math.sin(a) * 60 - 30, 0.6 + Math.random() * 0.4, 14 + Math.random() * 12);
  }

  private burst(n: number, at: [number, number], speed = 180): void {
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

  /** The staff strikes the floor: a ring of light and sparks bursting from its foot. */
  private staffImpact(power: number): void {
    const s = this.shock;
    gsap.killTweensOf([s, s.scale]);
    s.tint = this.form === 'inhuman' ? RED : GOLD;
    gsap.fromTo(s.scale, { x: 0.3, y: 0.09 }, { x: 1.6 * power, y: 0.45 * power, duration: 0.6, ease: 'power2.out' });
    gsap.fromTo(s, { alpha: 1 }, { alpha: 0, duration: 0.6, ease: 'power1.in' });
    this.burst(Math.round(14 * power), this.artPoint(this.staff, STAFF_FOOT), 200);
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
          tl.add(() => this.lookAt(dir, Math.random() * 0.5)).add(() => this.lookAt(0, 0), 1.6 + Math.random());
        } else if (roll < 0.65) {
          tl.to(this.fx, { rear: 0.6, duration: 0.35, ease: 'power2.out' }).to(this.fx, { rear: 0, strike: 0.4, duration: 0.14, ease: 'power3.in' }).to(this.fx, { strike: 0, duration: 0.4 });
        } else if (roll < 0.85) {
          // she summons a small flame in her palm and closes her hand on it
          tl.to(this.fx, { raise: 0.45, orb: 0.6, duration: 0.6, ease: 'sine.inOut' }).to(this.fx, { raise: 0, orb: 0, duration: 0.8, ease: 'sine.inOut' }, '+=0.8');
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

  shockwave(power = 1): void {
    this.staffImpact(power);
  }

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
    tl.to(this.fx, { flare: 0.8, lift: 1, raise: 1, orb: 1, rear: 1, shake: 6, duration: 0.4, ease: 'power2.out' }, 0);
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
      this.burst(30, this.artPoint(this.armF, PALM), 220);
      if (to === 'inhuman') this.crackle(1.4);
      this.onTransform?.(to);
    }, 0.6)
      .to(this.fx, { lift: 0, thump: 1, rear: 0, strike: 1, flare: 1.2, duration: 0.14, ease: 'power3.in' }, 0.6)
      .add(() => this.staffImpact(1.4), 0.74)
      .to(this.fx, { thump: 0, strike: 0, flare: 0, shake: 0, raise: 0, orb: 0, duration: 0.8, ease: 'power2.out' }, 1.3);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        // lift the staff a little and strike the floor with it
        this.lookAt(1, 0.4);
        tl.to(this.fx, { lift: 0.25, rear: 0.4, duration: 0.16, ease: 'power2.out' })
          .to(this.fx, { lift: 0, thump: 1, rear: 0, strike: 0.3, duration: 0.1, ease: 'power3.in' })
          .add(() => this.staffImpact(0.7))
          .to(this.fx, { thump: 0, strike: 0, duration: 0.4, ease: 'power2.out' })
          .add(() => this.lookAt(0.7, 0.3));
        break;
      case 'codex':
        tl.to(this.fx, { rear: 0.8, duration: 0.12, ease: 'power2.out' }).to(this.fx, { rear: 0, strike: 0.8, flare: 0.5, duration: 0.1, ease: 'power3.in' }).to(this.fx, { strike: 0, flare: 0, duration: 0.5 });
        break;
      case 'win':
        // she raises her hand and a flame of gold blooms in her palm
        this.lookAt(-0.3, 0);
        tl.to(this.fx, { raise: 1, orb: 1, flare: 0.6, bow: -0.5, duration: 0.45, ease: 'back.out(1.6)' })
          .add(() => this.burst(18, this.artPoint(this.armF, PALM), 170), 0.35)
          .to(this.fx, { rear: 0.6, duration: 0.15 }, 0.2)
          .to(this.fx, { rear: 0, strike: 0.7, duration: 0.1, ease: 'power3.in' }, 0.4)
          .to(this.fx, { strike: 0, duration: 0.4 }, 0.6)
          .to(this.fx, { raise: 0, orb: 0, flare: 0, bow: 0, duration: 0.9, ease: 'sine.inOut' }, 1.4)
          .add(() => this.lookAt(0.5, 0.2));
        break;
      case 'big':
        // staff to the sky, the cobra spits light, her free hand blazes
        this.lookAt(0.4, -0.6);
        tl.to(this.fx, { lift: 1, raise: 0.8, orb: 1, rear: 1, flare: 1, y: -8, duration: 0.4, ease: 'back.out(1.4)' })
          .to(this.fx, { rear: 0, strike: 1, flare: 1.4, shake: 5, duration: 0.12, ease: 'power3.in' })
          .to(this.fx, { beam: 1, duration: 0.15 })
          .add(() => {
            this.burst(40, this.artPoint(this.staff, COBRA_MOUTH), 240);
            this.crackle(1.2);
          }, '<')
          .to(this.fx, { beam: 0, shake: 0, duration: 0.45 }, '+=1.2')
          .to(this.fx, { lift: 0, thump: 1, strike: 0, duration: 0.18, ease: 'power3.in' })
          .add(() => this.staffImpact(1.3))
          .to(this.fx, { thump: 0, raise: 0, orb: 0, flare: 0, y: 0, duration: 0.8, ease: 'power2.out' })
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
