import { Container, DisplacementFilter, Graphics, MeshPlane, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { CHAR_EYES, CHAR_FEET, CHAR_HEAD, CS, paintCharacter } from './art/character';
import { makeCanvas } from './art/painters';
import { Fire, paintFlameBlob } from './Fire';

const RAGE_SCALE = 1.05;
const GOLD = 0xffc860;
const RED = 0xff2a22;

export interface MascotTextures {
  art: Texture;
  silhouette: Texture;
  cracks: Texture;
  cracksGlow: Texture;
  ring: Texture;
  iris: Texture;
  glow: Texture;
  flame: Texture;
  noise: Texture;
  smoke: Texture;
  beam: Texture;
}

/** 'human' is the calm guardian, 'inhuman' the infected form shown during free spins. */
export type Form = 'human' | 'inhuman';
export type Reaction = 'spin' | 'win' | 'big' | 'feature';

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

/** Tileable noise for the displacement that makes the aura burn like a heat haze. */
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

/** Light shaft: hot at the source, widening and fading out along its length. */
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

export async function buildMascotTextures(art: HTMLImageElement): Promise<MascotTextures> {
  const a = paintCharacter(art);
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  const noise = t(noiseCanvas());
  noise.source.addressMode = 'repeat';
  return {
    art: t(a.art),
    silhouette: t(a.silhouette),
    cracks: t(a.cracks),
    cracksGlow: t(a.cracksGlow),
    ring: t(a.ring),
    iris: t(a.iris),
    glow: t(glowCanvas()),
    flame: t(paintFlameBlob()),
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

/**
 * "Le Gardien": the painted Anubis bust brought to life. The art is a deformable mesh that
 * breathes, leans and turns its head in fake 3D; its eyes burn with live flames; a heat-hazed
 * aura of infection flickers around its silhouette; a ring of glyphs turns on the ground below
 * like a summoning circle, with smoke and embers rising from it. It watches the reels spin,
 * roars on wins, blasts beams on big wins, and in the free spins the infection cracks it open.
 */
export class Mascot extends Container {
  private grow = new Container();
  private float = new Container();
  private rig = new Container();
  private circle = new Container();
  private ring: Sprite;
  private ringGlow: Sprite;
  private floorGlow: Sprite;
  private auraOuter: Sprite;
  private auraInner: Sprite;
  private noise: Sprite;
  private displace: DisplacementFilter;
  private body: MeshPlane;
  private basePos: Float32Array;
  private cracks: Sprite;
  private cracksGlow: Sprite;
  private irises: Sprite[] = [];
  private halos: Sprite[] = [];
  private beams: Sprite[] = [];
  private eyeFires: Fire[] = [];
  private bookC = new Container();
  private bookGlow: Sprite;
  private book: Sprite | null = null;
  private sparks = new Graphics();
  private back = new Container();
  private front = new Container();
  private motes: Mote[] = [];
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private t = Math.random() * 10;
  private rage = 0;
  private emitIn = 0;
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  private fx = { y: 0, lean: 0, roar: 0, flare: 0, spin: 0, beam: 0, shake: 0 };
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
    this.rig.pivot.set(CHAR_FEET[0], CHAR_FEET[1]);

    // summoning circle on the ground, seen in perspective
    this.ring = new Sprite(tex.ring);
    this.ring.anchor.set(0.5);
    this.ring.scale.set(0.42);
    this.ringGlow = new Sprite(tex.ring);
    this.ringGlow.anchor.set(0.5);
    this.ringGlow.scale.set(0.42);
    this.ringGlow.blendMode = 'add';
    this.floorGlow = glow(0, 0, 520, GOLD);
    this.floorGlow.alpha = 0.35;
    const spin = new Container();
    spin.addChild(this.ring, this.ringGlow);
    this.circle.addChild(this.floorGlow, spin);
    this.circle.scale.set(1, 0.3);

    // heat-hazed aura around the silhouette
    this.auraOuter = new Sprite(tex.silhouette);
    this.auraOuter.anchor.set(0.5);
    this.auraOuter.position.set(CS / 2, CS / 2);
    this.auraOuter.scale.set(1.12);
    this.auraOuter.blendMode = 'add';
    this.auraInner = new Sprite(tex.silhouette);
    this.auraInner.anchor.set(0.5);
    this.auraInner.position.set(CS / 2, CS / 2);
    this.auraInner.scale.set(1.03);
    this.auraInner.blendMode = 'add';
    this.noise = new Sprite(tex.noise);
    this.noise.renderable = false;
    this.noise.scale.set(1.6);
    this.displace = new DisplacementFilter({ sprite: this.noise, scale: 26 });
    const aura = new Container();
    aura.addChild(this.auraOuter, this.auraInner);
    aura.filters = [this.displace];

    // the body: a mesh so it can breathe, lean and turn
    this.body = new MeshPlane({ texture: tex.art, verticesX: 16, verticesY: 16 });
    this.body.autoResize = false;
    this.basePos = new Float32Array(this.body.geometry.positions);
    this.cracks = new Sprite(tex.cracks);
    this.cracksGlow = new Sprite(tex.cracksGlow);
    this.cracksGlow.blendMode = 'add';
    this.cracks.alpha = this.cracksGlow.alpha = 0;

    for (const [ex, ey, k] of CHAR_EYES) {
      const halo = glow(ex, ey, 90 * k, RED);
      const iris = new Sprite(tex.iris);
      iris.anchor.set(0.5);
      iris.position.set(ex, ey);
      iris.blendMode = 'add';
      const beam = new Sprite(tex.beam);
      beam.anchor.set(0.02, 0.5);
      beam.blendMode = 'add';
      beam.alpha = 0;
      const fire = new Fire(tex.flame, tex.glow, 34 * k);
      fire.hot = 1;
      fire.position.set(ex, ey);
      this.halos.push(halo);
      this.irises.push(iris);
      this.beams.push(beam);
      this.eyeFires.push(fire);
    }

    this.bookGlow = glow(0, 0, 230, RED);
    this.bookGlow.alpha = 0.45;
    this.bookC.position.set(470, 400);
    this.bookC.addChild(this.bookGlow);
    this.bookC.visible = false;

    this.sparks.blendMode = 'add';
    this.rig.addChild(
      this.noise,
      this.back,
      aura,
      this.body,
      this.cracks,
      this.cracksGlow,
      ...this.halos,
      ...this.eyeFires,
      ...this.irises,
      ...this.beams,
      this.bookC,
      this.sparks,
      this.front,
    );
    this.float.addChild(this.rig);
    this.grow.addChild(this.circle, this.float);
    this.addChild(this.grow);
    // the circle stays on the ground while the body floats
    this.circle.position.set(0, -4);
    if (custom) {
      // a user's own character art replaces the bust, keeping the whole rig
      this.body.texture = Texture.from(custom);
    }

    gsap.ticker.add(this.tick);
    this.scheduleTell();
  }

  /** The wild symbol (the red pyramid) floats beside the guardian. */
  setBook(t: Texture): void {
    this.book?.destroy();
    this.book = new Sprite(t);
    this.book.anchor.set(0.5);
    this.book.width = this.book.height = 150;
    this.bookC.addChild(this.book);
    this.bookC.visible = true;
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    gsap.ticker.remove(this.tick);
    super.destroy(options);
  }

  /* ------------------------------------------------------------ per-frame */

  /** Displacement of an art point for the current pose (breath, lean, head turn, shake). */
  private warp(x: number, y: number, out: [number, number]): void {
    const t = this.t;
    const fx = this.fx;
    const v = y / CS; // 0 top … 1 bottom
    const free = Math.pow(1 - v, 1.4); // the base stays planted
    // fake 3D head turn: points near the head's centre move most, ears and snout lead
    const d = Math.max(0, 1 - Math.hypot(x - CHAR_HEAD[0], (y - CHAR_HEAD[1]) * 1.2) / 260);
    const turn = this.look.x * 16 * d * d + this.look.x * 6 * free;
    const nod = this.look.y * 8 * d;
    const breath = Math.sin(t * 1.5) * (3 + this.rage * 2) * free;
    const sway = Math.sin(t * 0.7) * 4 * free;
    const lean = fx.lean * 60 * free;
    const roar = fx.roar * 10 * d;
    const shake = fx.shake ? (Math.random() - 0.5) * fx.shake * free : 0;
    out[0] = x + turn + sway + lean + shake + (x - CHAR_HEAD[0]) * roar * 0.004;
    out[1] = y - breath + nod - roar * (1 - v) * 0.6 + (shake ? (Math.random() - 0.5) * fx.shake * 0.5 : 0);
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
    const tint = lerpColor(0xff6a30, RED, r);

    this.float.y = Math.sin(t * 1.2) * (6 + r * 3) + fx.y;
    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 5);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 5);

    // mesh pose
    const pos = this.body.geometry.positions;
    const base = this.basePos;
    const o: [number, number] = [0, 0];
    for (let i = 0; i < pos.length; i += 2) {
      this.warp(base[i], base[i + 1], o);
      pos[i] = o[0];
      pos[i + 1] = o[1];
    }
    this.body.geometry.getBuffer('aPosition').update();
    // overlays follow the head
    this.warp(CHAR_HEAD[0], CHAR_HEAD[1], o);
    const hx = o[0] - CHAR_HEAD[0];
    const hy = o[1] - CHAR_HEAD[1];
    this.cracks.position.set(hx * 0.7, hy * 0.7);
    this.cracksGlow.position.copyFrom(this.cracks.position);
    this.body.tint = lerpColor(0xffffff, 0xffc0b0, r * 0.5);
    this.cracks.alpha = r;
    this.cracksGlow.alpha = r * (0.4 + beat * 0.6 + fx.flare * 0.5);

    // aura: heat haze scrolling upward, breathing with the beat
    this.noise.x = (this.noise.x + dt * 10) % 256;
    this.noise.y = (this.noise.y - dt * 70) % 256;
    this.displace.scale.x = 18 + r * 14 + fx.flare * 20;
    this.displace.scale.y = 30 + r * 20 + fx.flare * 30;
    this.auraOuter.tint = tint;
    this.auraInner.tint = lerpColor(0xffa060, 0xff5040, r);
    this.auraOuter.alpha = 0.35 + r * 0.25 + beat * 0.15 + fx.flare * 0.4;
    this.auraInner.alpha = 0.18 + r * 0.2 + fx.flare * 0.3;
    this.auraOuter.scale.set(1.1 + beat * 0.02 + fx.flare * 0.06);
    this.auraOuter.position.set(CS / 2 + hx * 0.5, CS / 2 + hy * 0.5);
    this.auraInner.position.copyFrom(this.auraOuter.position);

    // eyes: halo, iris, flames licking up from them, beams on big wins
    const flick = Math.random() < 0.012 ? 0.35 : 1;
    CHAR_EYES.forEach(([ex, ey, k], i) => {
      this.warp(ex, ey, o);
      const iris = this.irises[i];
      iris.position.set(o[0], o[1]);
      const s = ((22 + fx.flare * 16 + Math.sin(t * 3 + i) * 1.5) * k) / 64;
      iris.scale.set(s * 1.4, s);
      iris.alpha = flick;
      const halo = this.halos[i];
      halo.position.copyFrom(iris.position);
      halo.tint = tint;
      halo.alpha = Math.min(0.9, 0.5 + r * 0.2 + fx.flare * 0.35) * flick;
      const hs = ((80 + fx.flare * 50) * k) / 256;
      halo.scale.set(hs * 1.3, hs);
      const fire = this.eyeFires[i];
      fire.position.copyFrom(iris.position);
      fire.update(dt);
      if (fx.flare > 0.3) fire.roar(fx.flare);
      const beam = this.beams[i];
      beam.position.copyFrom(iris.position);
      beam.alpha = fx.beam * (0.85 + Math.random() * 0.15);
      beam.tint = tint;
      beam.scale.set((1000 * (0.6 + fx.beam * 0.4)) / 512, ((190 + Math.random() * 30) * k) / 64);
      // twin shafts blasting up into the sky in a V
      beam.rotation = -Math.PI / 2 + (i === 0 ? -0.38 : -0.62) + Math.sin(t * 5 + i) * 0.03;
    });

    // summoning circle
    this.ring.rotation += dt * (0.25 + r * 0.4 + fx.spin);
    this.ringGlow.rotation = this.ring.rotation;
    fx.spin *= Math.pow(0.3, dt);
    this.ringGlow.tint = tint;
    this.ring.tint = lerpColor(0xffe0a0, 0xff8070, r);
    this.ringGlow.alpha = 0.25 + r * 0.25 + fx.flare * 0.6 + beat * 0.15;
    this.floorGlow.tint = tint;
    this.floorGlow.alpha = 0.3 + r * 0.2 + fx.flare * 0.4;

    // the wild relic floating beside the guardian
    this.bookC.y = 400 + Math.sin(t * 2.1 + 1) * 8;
    this.bookC.rotation = Math.sin(t * 1.3) * 0.06;
    this.bookGlow.alpha = 0.35 + fx.flare * 0.5 + beat * 0.25 * r;

    // smoke rising from the circle, embers drifting up
    this.emitIn -= dt;
    if (this.emitIn <= 0) {
      this.emitIn = 0.08 - r * 0.03;
      this.spawnSmoke();
      if (Math.random() < 0.7 + r * 0.3) this.spawnEmber();
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += dt;
      const k = m.age / m.life;
      if (k >= 1) {
        m.s.destroy();
        this.motes.splice(i, 1);
        continue;
      }
      m.s.x += (m.vx + Math.sin(t * 2 + i) * 8) * dt;
      m.s.y += m.vy * dt;
      m.s.scale.set(m.s.scale.x + m.grow * dt);
      m.s.alpha = m.a0 * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
    }
  };

  private spawnSmoke(): void {
    const s = new Sprite(this.tex.smoke);
    s.anchor.set(0.5);
    s.position.set(CHAR_FEET[0] + (Math.random() - 0.5) * 380, CHAR_FEET[1] - Math.random() * 30);
    s.scale.set(0.5 + Math.random() * 0.5);
    s.tint = this.form === 'inhuman' ? 0x6a1810 : 0x3a2a30;
    (Math.random() < 0.6 ? this.back : this.front).addChild(s);
    this.motes.push({ s, vx: (Math.random() - 0.5) * 20, vy: -(20 + Math.random() * 30), life: 1.8 + Math.random(), age: 0, a0: 0.55, grow: 0.25 });
  }

  private spawnEmber(x = CHAR_FEET[0] + (Math.random() - 0.5) * 400, y = CHAR_FEET[1] - Math.random() * 80, burst = 0): void {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set((3 + Math.random() * 7) / 256);
    s.blendMode = 'add';
    s.tint = this.form === 'inhuman' ? (Math.random() < 0.7 ? RED : 0xffa070) : Math.random() < 0.6 ? 0xff7a30 : GOLD;
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

  private burst(n: number, x = CHAR_HEAD[0], y = CHAR_HEAD[1], speed = 180): void {
    for (let i = 0; i < n; i++) this.spawnEmber(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80, speed * (0.4 + Math.random() * 0.8));
  }

  /** Lightning crawling over the silhouette. */
  private crackle(power = 1): void {
    const g = this.sparks;
    g.clear();
    for (let k = 0; k < 3 + power * 3; k++) {
      const a0 = Math.random() * Math.PI * 2;
      const r0 = 170 + Math.random() * 90;
      let x = CHAR_HEAD[0] + Math.cos(a0) * r0;
      let y = CHAR_HEAD[1] + Math.sin(a0) * r0 * 0.9;
      g.moveTo(x, y);
      const da = (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.1);
      for (let i = 1; i <= 7; i++) {
        const a = a0 + da * i;
        const rr = r0 + (Math.random() - 0.5) * 50;
        x = CHAR_HEAD[0] + Math.cos(a) * rr;
        y = CHAR_HEAD[1] + Math.sin(a) * rr * 0.9;
        g.lineTo(x, y);
      }
    }
    g.stroke({ width: 8, color: RED, alpha: 0.35, join: 'round', cap: 'round' });
    g.stroke({ width: 2.2, color: 0xffd0c0, alpha: 1, join: 'round', cap: 'round' });
    gsap.killTweensOf(g);
    gsap.fromTo(g, { alpha: 1 }, { alpha: 0, duration: 0.35, ease: 'steps(5)' });
  }

  /* ------------------------------------------------------------ behaviour */

  /** Idle tells: a glance at the reels or at the player, a growl of light, the circle surging. */
  private scheduleTell(): void {
    gsap.delayedCall(3.5 + Math.random() * 4.5, () => {
      if (this.destroyed) return;
      if (!this.busy?.isActive()) {
        const roll = Math.random();
        const tl = gsap.timeline();
        if (roll < 0.45) {
          const dir = Math.random() < 0.65 ? -1 : 0.6;
          tl.add(() => this.lookAt(dir, Math.random() * 0.4)).add(() => this.lookAt(0, 0), 1.3 + Math.random());
        } else if (roll < 0.75) {
          tl.to(this.fx, { roar: 0.5, flare: 0.45, duration: 0.3, ease: 'power2.out' }).to(this.fx, { roar: 0, flare: 0, duration: 0.6 }, '+=0.2');
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

  private play(tl: gsap.core.Timeline): void {
    this.busy?.progress(1).kill();
    this.busy = tl;
  }

  /** Infect (or heal) the guardian with a glitchy, crackling transformation. */
  setForm(to: Form, animate = true): void {
    if (to === this.form) return;
    const scale = to === 'inhuman' ? RAGE_SCALE : 1;
    if (!animate) {
      this.form = to;
      this.rage = to === 'inhuman' ? 1 : 0;
      this.grow.scale.set(scale);
      return;
    }
    this.filters = [this.split];
    const tl = gsap.timeline({ onComplete: () => (this.filters = []) });
    tl.to(this.fx, { flare: 0.8, roar: 0.6, shake: 6, duration: 0.3 }, 0).to(this.rig.scale, { x: 0.95, y: 1.05, duration: 0.3, ease: 'power2.out' }, 0);
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
      .fromTo(this.rig.scale, { x: 1.1, y: 0.92 }, { x: 1, y: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' }, 0.55)
      .to(this.grow.scale, { x: scale, y: scale, duration: 0.5, ease: 'back.out(2)' }, 0.55)
      .to(this.fx, { roar: 1, flare: 1.2, spin: 4, duration: 0.15 }, 0.55)
      .to(this.fx, { roar: 0, flare: 0, shake: 0, duration: 0.7 }, 1.4);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        // the guardian follows the reels (to its left on screen) and the circle surges
        this.lookAt(-1, 0.3);
        tl.to(this.fx, { lean: -0.06, spin: 1.8, flare: 0.25, duration: 0.25, ease: 'back.out(2)' })
          .to(this.fx, { lean: 0, flare: 0, duration: 0.8, ease: 'sine.inOut' }, '+=0.4')
          .add(() => this.lookAt(-0.7, 0.15), '<');
        break;
      case 'win':
        this.lookAt(0, 0);
        this.burst(16);
        tl.to(this.fx, { y: -16, roar: 0.8, flare: 0.9, spin: 2.5, duration: 0.2, ease: 'power2.out' })
          .to(this.fx, { y: 0, duration: 0.6, ease: 'bounce.out' }, 0.45)
          .to(this.fx, { roar: 0, flare: 0, duration: 0.5 }, 0.7);
        if (this.book) tl.fromTo(this.bookC.scale, { x: 1, y: 1 }, { x: 1.18, y: 1.18, duration: 0.15, yoyo: true, repeat: 1 }, 0);
        break;
      case 'big':
        this.lookAt(-0.8, 0.5);
        tl.to(this.fx, { y: -26, roar: 1.2, flare: 1.4, spin: 6, shake: 8, duration: 0.25, ease: 'power2.out' }, 0)
          .to(this.fx, { beam: 1, duration: 0.12 }, 0.1)
          .add(() => {
            this.burst(40, CHAR_EYES[0][0], CHAR_EYES[0][1], 240);
            this.crackle(1.2);
          }, 0.1)
          .to(this.fx, { beam: 0, shake: 0, duration: 0.4 }, 1.2)
          .to(this.fx, { y: 0, roar: 0, flare: 0, duration: 0.8, ease: 'bounce.out' }, 1.3)
          .add(() => this.lookAt(0, 0), 1.7);
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
