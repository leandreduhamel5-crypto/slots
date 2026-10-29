import { Container, DisplacementFilter, Graphics, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { CH, COBRA_EYE, COBRA_HINGE, COBRA_MOUTH, COBRA_NECK, CRES, CW, EARRINGS, EYES_C, HAND, NECK, paintCleopatra, paintCracksOver } from './art/cleopatra';
import { makeCanvas } from './art/painters';

const GOLD = 0xffc860;
const RED = 0xff2a22;
const FEET: [number, number] = [CW / 2 + 28, CH - 16];
const JAW_HINGE = COBRA_HINGE;

export interface MascotTextures {
  hairBack: Texture;
  body: Texture;
  face: Texture;
  eyes: Texture;
  irises: Texture;
  lids: Texture;
  hairFront: Texture;
  earring: Texture;
  staff: Texture;
  cobraHead: Texture;
  cobraJaw: Texture;
  arm: Texture;
  silhouette: Texture;
  flat: Texture;
  faceCracks: Texture;
  faceCracksGlow: Texture;
  bodyCracks: Texture;
  bodyCracksGlow: Texture;
  ring: Texture;
  glow: Texture;
  noise: Texture;
  smoke: Texture;
  beam: Texture;
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

function smokeCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.filter = 'blur(5px)';
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 24;
    const x = 64 + Math.cos(a) * d;
    const y = 64 + Math.sin(a) * d;
    const r = 16 + Math.random() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
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

/** Ring of glyphs for the summoning circle on the ground. */
function ringCanvas(): HTMLCanvasElement {
  const S = 600;
  const [c, ctx] = makeCanvas(S, S);
  ctx.translate(S / 2, S / 2);
  const R = 250;
  const gold = (r: number) => {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#fff3c0');
    g.addColorStop(0.4, '#c08420');
    g.addColorStop(0.7, '#f4c44c');
    g.addColorStop(1, '#5a3206');
    return g;
  };
  for (const r of [R - 26, R + 26]) {
    ctx.strokeStyle = gold(r);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(14,24,70,0.6)';
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffd77a';
  ctx.fillStyle = '#ffd77a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const n = 16;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * Math.PI * 2);
    ctx.translate(0, -R);
    ctx.beginPath();
    if (i % 4 === 0) {
      ctx.ellipse(0, -8, 5, 7, 0, 0, Math.PI * 2);
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.moveTo(0, -1);
      ctx.lineTo(0, 15);
    } else if (i % 4 === 1) {
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(0, -10, 12, 0);
      ctx.quadraticCurveTo(0, 7, -12, 0);
      ctx.moveTo(2.5, 0);
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    } else if (i % 4 === 2) {
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
    } else {
      ctx.moveTo(0, 14);
      ctx.quadraticCurveTo(-8, -2, 2, -14);
      ctx.quadraticCurveTo(6, 0, 0, 14);
    }
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.rotate(((i + 0.5) / n) * Math.PI * 2);
    ctx.beginPath();
    ctx.arc(0, -R, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

function fadeCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);
  return c;
}

/** White silhouette of the whole figure, blurred: tinted and heat-hazed it becomes the aura. */
function silhouetteCanvas(flat: HTMLCanvasElement): HTMLCanvasElement {
  const blur = 14 * CRES;
  const pad = blur * 3;
  const [c, ctx] = makeCanvas(flat.width + pad * 2, flat.height + pad * 2);
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(flat, pad, pad);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export async function buildMascotTextures(): Promise<MascotTextures> {
  const a = paintCleopatra();
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  const [faceCracks, faceCracksGlow] = paintCracksOver(a.face, [
    [EYES_C[0][0] - 6, EYES_C[0][1] + 10, Math.PI * 0.6, 60],
    [EYES_C[1][0] + 6, EYES_C[1][1] + 10, Math.PI * 0.4, 60],
    [NECK[0], 130, Math.PI * 0.5, 60],
    [NECK[0] - 40, 260, Math.PI * 0.65, 40],
  ], 31);
  const [bodyCracks, bodyCracksGlow] = paintCracksOver(a.body, [
    [NECK[0], 300, Math.PI * 0.5, 80],
    [NECK[0] - 90, 400, Math.PI * 0.6, 120],
    [NECK[0] + 100, 400, Math.PI * 0.4, 120],
  ], 17);
  const noise = t(noiseCanvas());
  noise.source.addressMode = 'repeat';
  return {
    hairBack: t(a.hairBack),
    body: t(a.body),
    face: t(a.face),
    eyes: t(a.eyes),
    irises: t(a.irises),
    lids: t(a.lids),
    hairFront: t(a.hairFront),
    earring: t(a.earring),
    staff: t(a.staff),
    cobraHead: t(a.cobraHead),
    cobraJaw: t(a.cobraJaw),
    arm: t(a.arm),
    silhouette: t(silhouetteCanvas(a.flat)),
    flat: t(a.flat),
    faceCracks: t(faceCracks),
    faceCracksGlow: t(faceCracksGlow),
    bodyCracks: t(bodyCracks),
    bodyCracksGlow: t(bodyCracksGlow),
    ring: t(ringCanvas()),
    glow: t(glowCanvas()),
    noise,
    smoke: t(smokeCanvas()),
    beam: t(beamCanvas()),
  };
}

interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  a0: number;
  grow: number;
}

interface Pendulum {
  s: Sprite;
  a: number;
  v: number;
}

/**
 * Cleopatra, alive. Every painted layer is rigged: she breathes, her head tilts and turns, her
 * eyes follow the reels and blink, her earrings swing with real pendulum physics, her braids
 * sway. In her hand the golden cobra staff lives too: the cobra sways, its eyes glow, it hisses
 * at spins, strikes toward the reels on wins and spits a stream of light on big wins. A heat-
 * hazed aura burns around her, a glyph circle turns on the ground, smoke and embers rise, she
 * is mirrored on the polished floor. In the free spins the infection cracks her open.
 */
export class Mascot extends Container {
  private grow = new Container();
  private float = new Container();
  private rig = new Container();
  private circle = new Container();
  private ring: Sprite;
  private ringGlow: Sprite;
  private floorGlow: Sprite;
  private reflection: Sprite;
  private shock: Sprite;
  private auraOuter: Sprite;
  private auraInner: Sprite;
  private noise: Sprite;
  private displace: DisplacementFilter;
  private bodyC = new Container();
  private hairBack: Sprite;
  private headC = new Container();
  private irises: Sprite;
  private lids: Sprite;
  private faceCracks: Sprite;
  private faceCracksGlow: Sprite;
  private bodyCracks: Sprite;
  private bodyCracksGlow: Sprite;
  private eyeGlows: Sprite[] = [];
  private earrings: Pendulum[] = [];
  private staffC = new Container();
  private cobraC = new Container();
  private jaw: Sprite;
  private cobraEye: Sprite;
  private mouthOrb: Sprite;
  private cobraBeam: Sprite;
  private sparks = new Graphics();
  private back = new Container();
  private front = new Container();
  private motes: Mote[] = [];
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private t = Math.random() * 10;
  private rage = 0;
  private emitIn = 0;
  private headPrev = { x: 0, r: 0 };
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  private fx = { y: 0, lean: 0, flare: 0, spin: 0, beam: 0, shake: 0, jaw: 0, strike: 0, raise: 0, blink: 0 };
  form: Form = 'human';
  /** called at the climax of a transformation (particles, sound…) */
  onTransform: ((to: Form) => void) | null = null;

  constructor(
    private tex: MascotTextures,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    const k = 1 / CRES;
    const part = (t: Texture) => {
      const s = new Sprite(t);
      s.scale.set(k);
      return s;
    };
    const glow = (x: number, y: number, size: number, tint: number) => {
      const s = new Sprite(tex.glow);
      s.anchor.set(0.5);
      s.position.set(x, y);
      s.width = s.height = size;
      s.tint = tint;
      s.blendMode = 'add';
      return s;
    };
    this.rig.pivot.set(FEET[0], FEET[1]);

    // ground: summoning circle, floor glow, reflection, shockwave ring
    this.ring = new Sprite(tex.ring);
    this.ring.anchor.set(0.5);
    this.ring.scale.set(0.8);
    this.ringGlow = new Sprite(tex.ring);
    this.ringGlow.anchor.set(0.5);
    this.ringGlow.scale.set(0.8);
    this.ringGlow.blendMode = 'add';
    this.floorGlow = glow(0, 0, 560, GOLD);
    const spin = new Container();
    spin.addChild(this.ring, this.ringGlow);
    this.circle.addChild(this.floorGlow, spin);
    this.circle.scale.set(1, 0.3);
    this.circle.position.set(0, -4);
    this.reflection = new Sprite(tex.flat);
    this.reflection.anchor.set(FEET[0] / CW, 0);
    this.reflection.scale.set(k, -k * 0.5);
    const fade = new Sprite(Texture.from(fadeCanvas()));
    fade.anchor.set(0.5, 0);
    fade.width = CW * 1.2;
    fade.height = CH * 0.45;
    this.reflection.mask = fade;
    const refl = new Container();
    refl.addChild(this.reflection, fade);
    this.shock = new Sprite(tex.ring);
    this.shock.anchor.set(0.5);
    this.shock.blendMode = 'add';
    this.shock.alpha = 0;
    const shockC = new Container();
    shockC.scale.set(1, 0.3);
    shockC.addChild(this.shock);

    // aura: blurred silhouette, heat-hazed
    this.auraOuter = new Sprite(tex.silhouette);
    this.auraOuter.anchor.set(0.5);
    this.auraOuter.scale.set(k * 1.08);
    this.auraOuter.blendMode = 'add';
    this.auraInner = new Sprite(tex.silhouette);
    this.auraInner.anchor.set(0.5);
    this.auraInner.scale.set(k * 1.01);
    this.auraInner.blendMode = 'add';
    for (const a of [this.auraOuter, this.auraInner]) a.position.set(CW / 2, CH / 2);
    this.noise = new Sprite(tex.noise);
    this.noise.renderable = false;
    this.noise.scale.set(1.6);
    this.displace = new DisplacementFilter({ sprite: this.noise, scale: 26 });
    const aura = new Container();
    aura.addChild(this.auraOuter, this.auraInner);
    aura.filters = [this.displace];

    // body
    this.hairBack = part(tex.hairBack);
    this.bodyCracks = part(tex.bodyCracks);
    this.bodyCracksGlow = part(tex.bodyCracksGlow);
    this.bodyCracksGlow.blendMode = 'add';
    this.bodyC.addChild(part(tex.body), this.bodyCracks, this.bodyCracksGlow);
    this.bodyC.pivot.set(FEET[0], 560);
    this.bodyC.position.set(FEET[0], 560);

    // head: pivots on the neck
    this.headC.pivot.set(NECK[0], NECK[1]);
    this.headC.position.set(NECK[0], NECK[1]);
    this.irises = part(tex.irises);
    this.lids = part(tex.lids);
    this.lids.alpha = 0;
    this.faceCracks = part(tex.faceCracks);
    this.faceCracksGlow = part(tex.faceCracksGlow);
    this.faceCracksGlow.blendMode = 'add';
    for (const [ex, ey] of EYES_C) this.eyeGlows.push(glow(ex, ey, 54, RED));
    const earC = new Container();
    for (const [ex, ey] of EARRINGS) {
      const s = new Sprite(tex.earring);
      s.anchor.set(0.5, 5 / 70);
      s.scale.set(k);
      s.position.set(ex, ey);
      earC.addChild(s);
      this.earrings.push({ s, a: 0, v: 0 });
    }
    this.headC.addChild(part(tex.face), this.faceCracks, this.faceCracksGlow, part(tex.eyes), this.irises, this.lids, ...this.eyeGlows, part(tex.hairFront), earC);

    // staff and cobra: the staff turns around the hand, the cobra's head around its neck
    this.staffC.pivot.set(HAND[0], HAND[1]);
    this.staffC.position.set(HAND[0], HAND[1]);
    this.cobraC.pivot.set(COBRA_NECK[0], COBRA_NECK[1]);
    this.cobraC.position.set(COBRA_NECK[0], COBRA_NECK[1]);
    this.jaw = part(tex.cobraJaw);
    const jawC = new Container();
    jawC.pivot.set(JAW_HINGE[0], JAW_HINGE[1]);
    jawC.position.set(JAW_HINGE[0], JAW_HINGE[1]);
    jawC.addChild(this.jaw);
    this.jawC = jawC;
    this.cobraEye = glow(COBRA_EYE[0], COBRA_EYE[1], 34, RED);
    this.mouthOrb = glow(COBRA_MOUTH[0], COBRA_MOUTH[1], 10, GOLD);
    this.mouthOrb.alpha = 0;
    this.cobraBeam = new Sprite(tex.beam);
    this.cobraBeam.anchor.set(0.02, 0.5);
    this.cobraBeam.blendMode = 'add';
    this.cobraBeam.alpha = 0;
    this.cobraBeam.position.set(COBRA_MOUTH[0], COBRA_MOUTH[1]);
    this.cobraC.addChild(jawC, part(tex.cobraHead), this.cobraEye, this.cobraBeam, this.mouthOrb);
    this.staffC.addChild(part(tex.staff), this.cobraC);

    this.sparks.blendMode = 'add';
    this.rig.addChild(this.noise, this.back, aura, this.hairBack, this.bodyC, this.headC, this.staffC, part(tex.arm), this.sparks, this.front);
    this.float.addChild(this.rig);
    this.grow.addChild(refl, this.circle, shockC, this.float);
    this.addChild(this.grow);
    if (custom) {
      // a user's own character art replaces the painted queen, keeping aura, circle and fx
      for (const c of [this.hairBack, this.bodyC, this.headC, this.staffC]) c.visible = false;
      const img = new Sprite(Texture.from(custom));
      img.anchor.set(0.5, 1);
      img.position.set(FEET[0], FEET[1]);
      img.scale.set(CH / custom.naturalHeight);
      this.rig.addChildAt(img, this.rig.getChildIndex(this.bodyC));
    }

    gsap.ticker.add(this.tick);
    this.scheduleBlink();
    this.scheduleTell();
  }

  private jawC: Container;

  /** The wild symbol is the cobra staff's power now; kept for API compatibility. */
  setBook(_t: Texture): void {}

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    gsap.ticker.remove(this.tick);
    super.destroy(options);
  }

  /* ------------------------------------------------------------ per-frame */

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

    // hover, breath, lean
    this.float.y = Math.sin(t * 1.2) * (5 + r * 3) + fx.y;
    this.rig.rotation = Math.sin(t * 0.6) * 0.008 + fx.lean;
    this.rig.x = shake;
    const breath = Math.sin(t * 1.6);
    this.bodyC.scale.set(1 + breath * 0.004, 1 + breath * 0.012);
    this.hairBack.skew.x = Math.sin(t * 0.9) * 0.012;

    // head: follows the look target with a little overshoot, tilts with it, bobs with the breath
    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 4);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 4);
    const hx = this.look.x * 3 + Math.sin(t * 0.5) * 0.8;
    const hr = -this.look.x * 0.035 + Math.sin(t * 0.7) * 0.01 + fx.lean * 0.4;
    this.headC.position.set(NECK[0] + hx + shake * 0.3, NECK[1] - breath * 1 + this.look.y * 1.5);
    this.headC.rotation = hr;
    // irises lead the head
    this.irises.position.set(this.look.x * 5 * (1 / 1), this.look.y * 2);
    this.lids.alpha = fx.blink;
    for (const g of this.eyeGlows) {
      g.alpha = (r * (0.55 + beat * 0.45) + fx.flare * 0.6) * (1 - fx.blink);
      g.scale.set((50 + fx.flare * 40) / 256);
      g.tint = tint;
    }
    this.irises.tint = lerpColor(0xffffff, 0xff5040, r);
    // earrings: pendulums driven by the head's motion
    const dx = this.headC.x - this.headPrev.x;
    const dr = this.headC.rotation - this.headPrev.r;
    this.headPrev.x = this.headC.x;
    this.headPrev.r = this.headC.rotation;
    for (const e of this.earrings) {
      e.v += (-e.a * 90 - e.v * 5 - dx * 5 - dr * 60) * dt;
      e.a = Math.max(-0.5, Math.min(0.5, e.a + e.v * dt));
      e.s.rotation = e.a - this.headC.rotation;
    }

    // cracks of the infection
    this.faceCracks.alpha = this.bodyCracks.alpha = r;
    this.faceCracksGlow.alpha = this.bodyCracksGlow.alpha = r * (0.4 + beat * 0.6 + fx.flare * 0.4);

    // staff: sways, rises on wins; cobra sways and strikes
    this.staffC.rotation = Math.sin(t * 0.8) * 0.02 - fx.raise * 0.08;
    this.staffC.y = HAND[1] - fx.raise * 18;
    const strike = fx.strike;
    this.cobraC.rotation = Math.sin(t * 1.4) * 0.07 - strike * 0.25 + Math.sin(t * 9) * 0.02 * fx.jaw;
    this.cobraC.position.set(COBRA_NECK[0] - strike * 26, COBRA_NECK[1] - strike * 6 + Math.sin(t * 1.4 + 1) * 3);
    this.cobraC.scale.set(1 + strike * 0.12);
    this.jawC.rotation = fx.jaw * 0.5;
    this.cobraEye.tint = tint;
    this.cobraEye.alpha = 0.55 + 0.25 * Math.sin(t * 3.1) + fx.flare * 0.5 + r * 0.3;
    this.cobraEye.scale.set((28 + fx.flare * 30) / 256);
    this.mouthOrb.alpha = Math.min(1, fx.beam * 1.2 + fx.jaw * 0.3);
    this.mouthOrb.tint = tint;
    this.mouthOrb.scale.set((20 + fx.beam * 60 + Math.random() * 8) / 256);
    this.cobraBeam.alpha = fx.beam * (0.85 + Math.random() * 0.15);
    this.cobraBeam.tint = tint;
    this.cobraBeam.scale.set((1000 * (0.5 + fx.beam * 0.5)) / 512, (150 + Math.random() * 30) / 64);
    // the stream arcs up into the sky over the reels
    this.cobraBeam.rotation = Math.PI + 0.75 + Math.sin(t * 6) * 0.03;

    // aura
    this.noise.x = (this.noise.x + dt * 10) % 256;
    this.noise.y = (this.noise.y - dt * 70) % 256;
    this.displace.scale.x = 16 + r * 14 + fx.flare * 20;
    this.displace.scale.y = 28 + r * 20 + fx.flare * 30;
    this.auraOuter.tint = tint;
    this.auraInner.tint = lerpColor(0xffd090, 0xff5040, r);
    this.auraOuter.alpha = 0.22 + r * 0.25 + beat * 0.1 + fx.flare * 0.3;
    this.auraInner.alpha = 0.06 + r * 0.12 + fx.flare * 0.15;

    // ground
    this.ring.rotation += dt * (0.2 + r * 0.4 + fx.spin);
    this.ringGlow.rotation = this.ring.rotation;
    fx.spin *= Math.pow(0.3, dt);
    this.ringGlow.tint = this.floorGlow.tint = tint;
    this.ring.tint = lerpColor(0xffe0a0, 0xff8070, r);
    this.ringGlow.alpha = 0.25 + r * 0.25 + fx.flare * 0.6 + beat * 0.15;
    this.floorGlow.alpha = 0.3 + r * 0.2 + fx.flare * 0.4;
    this.reflection.y = -this.float.y * 0.5;
    this.reflection.alpha = 0.2 + r * 0.06;

    // smoke from the circle, embers rising
    this.emitIn -= dt;
    if (this.emitIn <= 0) {
      this.emitIn = 0.08 - r * 0.03;
      this.spawnSmoke();
      if (Math.random() < 0.7 + r * 0.3) this.spawnEmber();
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
      m.s.x += (m.vx + Math.sin(t * 2 + i) * 8) * dt;
      m.s.y += m.vy * dt;
      m.s.scale.set(m.s.scale.x + m.grow * dt);
      m.s.alpha = m.a0 * (kk < 0.2 ? kk / 0.2 : 1 - (kk - 0.2) / 0.8);
    }
  };

  private spawnSmoke(): void {
    const s = new Sprite(this.tex.smoke);
    s.anchor.set(0.5);
    s.position.set(FEET[0] + (Math.random() - 0.5) * 420, FEET[1] - 40 - Math.random() * 60);
    s.scale.set(0.6 + Math.random() * 0.6);
    s.tint = this.form === 'inhuman' ? 0x6a1810 : 0x3a2a30;
    (Math.random() < 0.6 ? this.back : this.front).addChild(s);
    this.motes.push({ s, vx: (Math.random() - 0.5) * 20, vy: -(18 + Math.random() * 26), life: 1.8 + Math.random(), age: 0, a0: 0.55, grow: 0.25 });
  }

  private spawnEmber(x = FEET[0] + (Math.random() - 0.5) * 440, y = FEET[1] - 60 - Math.random() * 100, burst = 0): void {
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
      grow: 0,
    });
  }

  /** Where the cobra's mouth is right now, in rig space. */
  private mouth(): [number, number] {
    const p = this.cobraC.toGlobal({ x: COBRA_MOUTH[0], y: COBRA_MOUTH[1] });
    const l = this.rig.toLocal(p);
    return [l.x, l.y];
  }

  private burst(n: number, at?: [number, number], speed = 180): void {
    const [x, y] = at ?? [NECK[0], NECK[1] - 80];
    for (let i = 0; i < n; i++) this.spawnEmber(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50, speed * (0.4 + Math.random() * 0.8));
  }

  /** Lightning crawling around her silhouette. */
  private crackle(power = 1): void {
    const g = this.sparks;
    g.clear();
    const cx = NECK[0];
    const cy = NECK[1] - 20;
    for (let k = 0; k < 3 + power * 3; k++) {
      const a0 = Math.random() * Math.PI * 2;
      const r0 = 190 + Math.random() * 90;
      let x = cx + Math.cos(a0) * r0;
      let y = cy + Math.sin(a0) * r0 * 1.2;
      g.moveTo(x, y);
      const da = (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.1);
      for (let i = 1; i <= 7; i++) {
        const a = a0 + da * i;
        const rr = r0 + (Math.random() - 0.5) * 50;
        x = cx + Math.cos(a) * rr;
        y = cy + Math.sin(a) * rr * 1.2;
        g.lineTo(x, y);
      }
    }
    g.stroke({ width: 8, color: RED, alpha: 0.35, join: 'round', cap: 'round' });
    g.stroke({ width: 2.2, color: 0xffd0c0, alpha: 1, join: 'round', cap: 'round' });
    gsap.killTweensOf(g);
    gsap.fromTo(g, { alpha: 1 }, { alpha: 0, duration: 0.35, ease: 'steps(5)' });
  }

  /* ------------------------------------------------------------ behaviour */

  private scheduleBlink(): void {
    gsap.delayedCall(2.2 + Math.random() * 3.5, () => {
      if (this.destroyed) return;
      const blink = () => gsap.timeline().to(this.fx, { blink: 1, duration: 0.05 }).to(this.fx, { blink: 0, duration: 0.09 }, '+=0.04');
      blink();
      if (Math.random() < 0.25) gsap.delayedCall(0.25, blink);
      this.scheduleBlink();
    });
  }

  /** Idle tells: a glance at the reels or at the player, the cobra tasting the air, the circle surging. */
  private scheduleTell(): void {
    gsap.delayedCall(3 + Math.random() * 4, () => {
      if (this.destroyed) return;
      if (!this.busy?.isActive()) {
        const roll = Math.random();
        const tl = gsap.timeline();
        if (roll < 0.4) {
          const dir = Math.random() < 0.65 ? -1 : 0.7;
          tl.add(() => this.lookAt(dir, Math.random() * 0.5)).add(() => this.lookAt(0, 0), 1.4 + Math.random());
        } else if (roll < 0.75) {
          // the cobra flicks out, tastes the air
          tl.to(this.fx, { strike: 0.35, jaw: 0.6, duration: 0.18, ease: 'power2.out' }).to(this.fx, { jaw: 0.1, duration: 0.06, yoyo: true, repeat: 3 }).to(this.fx, { strike: 0, jaw: 0, duration: 0.4 });
        } else {
          tl.to(this.fx, { spin: 1.4, flare: 0.35, duration: 0.25 }).to(this.fx, { flare: 0, duration: 0.8 });
          if (this.form === 'inhuman') this.crackle(0.6);
        }
        this.play(tl);
      }
      this.scheduleTell();
    });
  }

  lookAt(x: number, y: number): void {
    this.look.tx = x;
    this.look.ty = y;
  }

  /** Ring of light racing outward on the floor. */
  shockwave(power = 1): void {
    const s = this.shock;
    gsap.killTweensOf([s, s.scale]);
    s.tint = this.form === 'inhuman' ? RED : GOLD;
    gsap.fromTo(s.scale, { x: 0.4, y: 0.4 }, { x: 1.2 + power * 0.6, y: 1.2 + power * 0.6, duration: 0.7, ease: 'power2.out' });
    gsap.fromTo(s, { alpha: Math.min(1, power) }, { alpha: 0, duration: 0.7, ease: 'power1.in' });
  }

  private play(tl: gsap.core.Timeline): void {
    this.busy?.progress(1).kill();
    this.busy = tl;
  }

  /** Infect (or heal) the queen with a glitchy, crackling transformation. */
  setForm(to: Form, animate = true): void {
    if (to === this.form) return;
    if (!animate) {
      this.form = to;
      this.rage = to === 'inhuman' ? 1 : 0;
      return;
    }
    this.filters = [this.split];
    const tl = gsap.timeline({ onComplete: () => (this.filters = []) });
    tl.to(this.fx, { flare: 0.8, raise: 1, shake: 6, duration: 0.3 }, 0).to(this.rig.scale, { x: 0.96, y: 1.04, duration: 0.3, ease: 'power2.out' }, 0);
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
      this.shockwave(1.2);
      if (to === 'inhuman') this.crackle(1.4);
      this.onTransform?.(to);
    }, 0.55)
      .fromTo(this.rig.scale, { x: 1.08, y: 0.94 }, { x: 1, y: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' }, 0.55)
      .to(this.fx, { jaw: 1, strike: 0.6, flare: 1.2, spin: 4, duration: 0.15 }, 0.55)
      .to(this.fx, { jaw: 0, strike: 0, flare: 0, raise: 0, shake: 0, duration: 0.7 }, 1.4);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        // she watches the reels, the cobra hisses at them
        this.lookAt(-1, 0.4);
        tl.to(this.fx, { lean: -0.02, spin: 1.8, flare: 0.25, jaw: 0.8, strike: 0.25, duration: 0.2, ease: 'back.out(2)' })
          .to(this.fx, { jaw: 0, strike: 0, duration: 0.3 }, 0.45)
          .to(this.fx, { lean: 0, flare: 0, duration: 0.8, ease: 'sine.inOut' }, 0.6)
          .add(() => this.lookAt(-0.7, 0.3), 0.6);
        break;
      case 'codex':
        // a pyramid lands: the cobra rears and strikes
        tl.to(this.fx, { strike: 0.8, jaw: 1, flare: 0.5, duration: 0.12, ease: 'power3.out' }).to(this.fx, { strike: 0, jaw: 0, flare: 0, duration: 0.5, ease: 'power2.out' }, 0.25);
        break;
      case 'win':
        this.lookAt(0, 0);
        this.shockwave(0.7);
        this.burst(16, this.mouth());
        tl.to(this.fx, { y: -10, raise: 1, flare: 0.9, spin: 2.5, jaw: 0.8, strike: 0.5, duration: 0.22, ease: 'power2.out' })
          .to(this.fx, { y: 0, raise: 0, duration: 0.7, ease: 'bounce.out' }, 0.5)
          .to(this.fx, { flare: 0, jaw: 0, strike: 0, duration: 0.5 }, 0.6);
        break;
      case 'big':
        this.shockwave(1.3);
        this.lookAt(-0.6, -0.3);
        tl.to(this.fx, { y: -20, raise: 1.4, flare: 1.4, spin: 6, shake: 6, jaw: 1, strike: 0.7, duration: 0.25, ease: 'power2.out' }, 0)
          .to(this.fx, { beam: 1, duration: 0.15 }, 0.15)
          .add(() => {
            this.burst(40, this.mouth(), 240);
            this.crackle(1.2);
          }, 0.15)
          .to(this.fx, { beam: 0, shake: 0, duration: 0.45 }, 1.4)
          .to(this.fx, { y: 0, raise: 0, flare: 0, jaw: 0, strike: 0, duration: 0.8, ease: 'bounce.out' }, 1.5)
          .add(() => this.lookAt(0, 0), 1.9);
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
