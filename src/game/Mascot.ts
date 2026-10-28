import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { EYES, MOUTH, PH, PRES, PW, URAEUS, paintPharaoh } from './art/pharaoh';
import { makeCanvas } from './art/painters';

/** the character stands on this point (bottom centre of the collar) */
const FEET = { x: PW / 2, y: PH - 20 };
const HEAD = { x: 200, y: 200 };
const RAGE_SCALE = 1.06;
const GOLD = 0xffc860;
const RED = 0xff2a22;

export interface MascotTextures {
  body: Texture;
  jaw: Texture;
  cracks: Texture;
  cracksGlow: Texture;
  ring: Texture;
  iris: Texture;
  glow: Texture;
}

/** 'human' is the calm golden pharaoh, 'inhuman' the infected form shown during free spins. */
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

export async function buildMascotTextures(): Promise<MascotTextures> {
  const a = paintPharaoh();
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  return { body: t(a.body), jaw: t(a.jaw), cracks: t(a.cracks), cracksGlow: t(a.cracksGlow), ring: t(a.ring), iris: t(a.iris), glow: t(glowCanvas()) };
}

interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  a0: number;
}

/**
 * "Le Pharaon": a golden death mask floating in front of a slowly turning ring of hieroglyphs.
 * Its eyes are empty sockets lit from within; they follow the reels while they spin, blaze on a
 * win, and the jaw drops to pour out light on big wins. In the free spins the infection takes it:
 * molten cracks spread over the gold, the eyes and the ring turn red, lightning crawls around it.
 */
export class Mascot extends Container {
  private grow = new Container();
  private float = new Container();
  private rig = new Container();
  private aura: Sprite;
  private ringC = new Container();
  private ring: Sprite;
  private ringGlow: Sprite;
  private body: Sprite;
  private cracks: Sprite;
  private cracksGlow: Sprite;
  private mouthGlow: Sprite;
  private jaw: Sprite;
  private irises: Sprite[] = [];
  private halos: Sprite[] = [];
  private beams: Sprite[] = [];
  private uraeus: Sprite;
  private bookC = new Container();
  private bookGlow: Sprite;
  private book: Sprite | null = null;
  private sparks = new Graphics();
  private motesBack = new Container();
  private motesFront = new Container();
  private motes: Mote[] = [];
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private t = Math.random() * 10;
  private rage = 0;
  private emitIn = 0;
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  private fx = { y: 0, lean: 0, jaw: 0, flare: 0, spin: 0, beam: 0 };
  form: Form = 'human';
  /** called at the climax of a transformation (particles, sound…) */
  onTransform: ((to: Form) => void) | null = null;

  constructor(
    private tex: MascotTextures,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    const k = 1 / PRES;
    const art = (t: Texture) => {
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
    this.rig.pivot.set(FEET.x, FEET.y);

    this.aura = glow(HEAD.x, HEAD.y + 40, 640, GOLD);
    this.aura.alpha = 0.25;

    this.ring = art(tex.ring);
    this.ring.anchor.set(0.5);
    this.ringGlow = art(tex.ring);
    this.ringGlow.anchor.set(0.5);
    this.ringGlow.blendMode = 'add';
    this.ringC.position.set(HEAD.x, HEAD.y);
    this.ringC.addChild(this.ring, this.ringGlow);

    this.body = art(tex.body);
    this.cracks = art(tex.cracks);
    this.cracksGlow = art(tex.cracksGlow);
    this.cracksGlow.blendMode = 'add';
    this.cracks.alpha = this.cracksGlow.alpha = 0;
    this.mouthGlow = glow(MOUTH[0], MOUTH[1] + 8, 120, GOLD);
    this.mouthGlow.alpha = 0;
    this.jaw = art(tex.jaw);

    for (const [ex, ey] of EYES) {
      const halo = glow(ex, ey, 70, GOLD);
      const iris = new Sprite(tex.iris);
      iris.anchor.set(0.5);
      iris.position.set(ex, ey);
      iris.width = iris.height = 26;
      iris.blendMode = 'add';
      const beam = new Sprite(tex.glow);
      beam.anchor.set(0, 0.5);
      beam.position.set(ex, ey);
      beam.blendMode = 'add';
      beam.alpha = 0;
      this.halos.push(halo);
      this.irises.push(iris);
      this.beams.push(beam);
    }
    this.uraeus = glow(URAEUS[0], URAEUS[1], 50, 0xff5a3a);
    this.uraeus.alpha = 0.3;

    this.bookGlow = glow(0, 0, 220, GOLD);
    this.bookGlow.alpha = 0.4;
    this.bookC.position.set(48, 392);
    this.bookC.addChild(this.bookGlow);
    this.bookC.visible = false;

    this.sparks.blendMode = 'add';
    this.rig.addChild(
      this.aura,
      this.motesBack,
      this.ringC,
      this.body,
      this.cracks,
      this.cracksGlow,
      this.mouthGlow,
      this.jaw,
      ...this.halos,
      ...this.irises,
      ...this.beams,
      this.uraeus,
      this.bookC,
      this.sparks,
      this.motesFront,
    );
    this.float.addChild(this.rig);
    this.grow.addChild(this.float);
    this.addChild(this.grow);
    if (custom) {
      // professional artwork: a still image that keeps the hover, ring, aura and reactions
      for (const c of [this.body, this.jaw, this.cracks, this.cracksGlow, this.mouthGlow, this.uraeus, ...this.irises, ...this.halos]) c.visible = false;
      const img = new Sprite(Texture.from(custom));
      img.anchor.set(0.5, 1);
      img.position.set(FEET.x, FEET.y);
      img.scale.set(PH / custom.naturalHeight);
      this.rig.addChildAt(img, this.rig.getChildIndex(this.body));
    }

    gsap.ticker.add(this.tick);
    this.scheduleTell();
  }

  /** The Book of Infection floats beside the pharaoh, toward the reels. */
  setBook(t: Texture): void {
    this.book?.destroy();
    this.book = new Sprite(t);
    this.book.anchor.set(0.5);
    this.book.width = this.book.height = 128;
    this.bookC.addChild(this.book);
    this.bookC.visible = true;
  }

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
    const beat = Math.pow(Math.max(0, Math.sin(t * (2.2 + r * 1.6))), 10);

    this.float.y = Math.sin(t * 1.4) * (7 + r * 3) + fx.y;
    this.rig.rotation = Math.sin(t * 0.8) * 0.012 + fx.lean;
    this.ringC.rotation += dt * (0.1 + r * 0.25 + fx.spin);
    fx.spin *= Math.pow(0.3, dt);
    this.ringGlow.alpha = 0.12 + r * 0.25 + fx.flare * 0.7 + beat * 0.15 * r;
    const tint = lerpColor(GOLD, RED, r);
    this.ringGlow.tint = tint;
    this.ring.tint = lerpColor(0xffffff, 0xff9a8a, r);
    this.aura.tint = tint;
    this.aura.alpha = 0.2 + r * 0.15 + fx.flare * 0.35 + beat * 0.1;
    this.body.tint = this.jaw.tint = lerpColor(0xffffff, 0xffb8a8, r * 0.6);
    this.cracks.alpha = r;
    this.cracksGlow.alpha = r * (0.45 + beat * 0.55 + fx.flare * 0.5);

    // eyes: ease toward the look target; the glow breathes and blazes with the flare
    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 7);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 7);
    const flick = Math.random() < 0.015 ? 0.4 : 1;
    this.irises.forEach((iris, i) => {
      const [ex, ey] = EYES[i];
      iris.position.set(ex + this.look.x * 8, ey + this.look.y * 3);
      const s = (24 + fx.flare * 14 + Math.sin(t * 3 + i) * 1.5) / 64;
      iris.scale.set(s * 1.25, s);
      iris.tint = lerpColor(0xffffff, 0xff8a70, r);
      iris.alpha = flick;
      const halo = this.halos[i];
      halo.position.copyFrom(iris.position);
      halo.tint = tint;
      halo.alpha = (0.45 + r * 0.35 + 0.15 * Math.sin(t * 2.3) + fx.flare * 0.6) * flick;
      halo.scale.set(((70 + fx.flare * 90) / 256) * 1.3, (70 + fx.flare * 90) / 256);
      const beam = this.beams[i];
      beam.position.copyFrom(iris.position);
      beam.alpha = fx.beam * (0.8 + Math.random() * 0.2);
      beam.tint = tint;
      beam.scale.set(900 / 256, (16 + Math.random() * 6) / 256);
      beam.rotation = Math.PI + 0.12 + Math.sin(t * 6) * 0.02;
    });
    this.uraeus.alpha = 0.25 + r * 0.4 + fx.flare * 0.6;

    this.jaw.y = fx.jaw;
    this.mouthGlow.alpha = Math.min(1, fx.jaw / 8);
    this.mouthGlow.tint = tint;
    this.mouthGlow.scale.set(((90 + fx.jaw * 6) / 256) * 1.4, (90 + fx.jaw * 6) / 256);

    this.bookC.y = 392 + Math.sin(t * 2.1 + 1) * 7;
    this.bookC.rotation = Math.sin(t * 1.3) * 0.06 - 0.08;
    this.bookGlow.tint = tint;
    this.bookGlow.alpha = 0.3 + fx.flare * 0.5 + beat * 0.2 * r;

    // gold dust rising around the mask, infected embers in the free spins
    this.emitIn -= dt;
    if (this.emitIn <= 0) {
      this.emitIn = 0.12 - r * 0.06;
      this.spawnMote();
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
      m.s.x += (m.vx + Math.sin(t * 2 + i) * 10) * dt;
      m.s.y += m.vy * dt;
      m.s.alpha = m.a0 * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
    }
  };

  private spawnMote(x = 40 + Math.random() * 320, y = 300 + Math.random() * 200, burst = 0): void {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set((3 + Math.random() * 7) / 256);
    s.blendMode = 'add';
    s.tint = this.form === 'inhuman' ? (Math.random() < 0.7 ? RED : 0xffa070) : Math.random() < 0.7 ? GOLD : 0xfff0c0;
    (Math.random() < 0.5 ? this.motesBack : this.motesFront).addChild(s);
    const a = Math.random() * Math.PI * 2;
    this.motes.push({
      s,
      vx: burst ? Math.cos(a) * burst : (Math.random() - 0.5) * 16,
      vy: burst ? Math.sin(a) * burst - 40 : -(30 + Math.random() * 50),
      life: 1.4 + Math.random() * 1.2,
      age: 0,
      a0: 0.9,
    });
  }

  private burst(n: number, x = HEAD.x, y = HEAD.y, speed = 160): void {
    for (let i = 0; i < n; i++) this.spawnMote(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60, speed * (0.4 + Math.random() * 0.8));
  }

  /** Crawling lightning around the head: a few jagged arcs that flicker out. */
  private crackle(power = 1): void {
    const g = this.sparks;
    g.clear();
    for (let k = 0; k < 3 + power * 3; k++) {
      const a0 = Math.random() * Math.PI * 2;
      const r0 = 150 + Math.random() * 90;
      let x = HEAD.x + Math.cos(a0) * r0;
      let y = HEAD.y + Math.sin(a0) * r0;
      g.moveTo(x, y);
      const steps = 6 + Math.floor(Math.random() * 4);
      const da = (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.1);
      for (let i = 1; i <= steps; i++) {
        const a = a0 + da * i;
        const rr = r0 + (Math.random() - 0.5) * 40;
        x = HEAD.x + Math.cos(a) * rr;
        y = HEAD.y + Math.sin(a) * rr;
        g.lineTo(x, y);
      }
    }
    g.stroke({ width: 7, color: RED, alpha: 0.35, join: 'round', cap: 'round' });
    g.stroke({ width: 2, color: 0xffd0c0, alpha: 1, join: 'round', cap: 'round' });
    gsap.killTweensOf(g);
    gsap.fromTo(g, { alpha: 1 }, { alpha: 0, duration: 0.35, ease: 'steps(5)' });
  }

  /* ------------------------------------------------------------ behaviour */

  /** Idle "tells": a glance at the reels or at the player, a whisper of light, the ring surging. */
  private scheduleTell(): void {
    gsap.delayedCall(4 + Math.random() * 5, () => {
      if (this.destroyed) return;
      if (!this.busy?.isActive()) {
        const roll = Math.random();
        const tl = gsap.timeline();
        if (roll < 0.45) {
          const dir = Math.random() < 0.6 ? -1 : 1;
          tl.add(() => this.lookAt(dir, 0.2)).add(() => this.lookAt(0, 0), 1.2 + Math.random());
        } else if (roll < 0.75) {
          tl.to(this.fx, { jaw: 4, flare: 0.3, duration: 0.25, ease: 'power2.out' }).to(this.fx, { jaw: 0, flare: 0, duration: 0.4 }, '+=0.25');
        } else {
          tl.to(this.fx, { spin: 1.2, flare: 0.45, duration: 0.2 }).to(this.fx, { flare: 0, duration: 0.8 });
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

  /** Infect (or heal) the pharaoh with a glitchy, crackling transformation. */
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
    tl.to(this.fx, { flare: 0.8, jaw: 6, lean: 0, duration: 0.3 }, 0).to(this.rig.scale, { x: 0.94, y: 1.06, duration: 0.3, ease: 'power2.out' }, 0);
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
      this.burst(26);
      if (to === 'inhuman') this.crackle(1.4);
      this.onTransform?.(to);
    }, 0.55)
      .fromTo(this.rig.scale, { x: 1.12, y: 0.9 }, { x: 1, y: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' }, 0.55)
      .to(this.grow.scale, { x: scale, y: scale, duration: 0.5, ease: 'back.out(2)' }, 0.55)
      .to(this.fx, { jaw: to === 'inhuman' ? 20 : 8, flare: 1.2, spin: 4, duration: 0.15 }, 0.55)
      .to(this.fx, { jaw: 0, flare: 0, duration: 0.6 }, 1.5);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        // the eyes follow the reels (to the left of the pharaoh on screen), the ring surges
        this.lookAt(-1, 0.25);
        tl.to(this.fx, { lean: -0.035, spin: 1.6, flare: 0.25, duration: 0.25, ease: 'back.out(2)' })
          .to(this.fx, { lean: 0, flare: 0, duration: 0.7, ease: 'sine.inOut' }, '+=0.5')
          .add(() => this.lookAt(-0.6, 0.1), '<');
        break;
      case 'win':
        this.lookAt(0, 0);
        this.burst(14);
        tl.to(this.fx, { y: -18, jaw: 9, flare: 0.9, spin: 2.5, duration: 0.2, ease: 'power2.out' })
          .to(this.fx, { y: 0, duration: 0.6, ease: 'bounce.out' }, 0.45)
          .to(this.fx, { jaw: 0, flare: 0, duration: 0.5 }, 0.7);
        if (this.book) tl.fromTo(this.bookC.scale, { x: 1, y: 1 }, { x: 1.18, y: 1.18, duration: 0.15, yoyo: true, repeat: 1 }, 0);
        break;
      case 'big': {
        this.lookAt(-1, 0.4);
        tl.to(this.fx, { y: -30, jaw: 22, flare: 1.4, spin: 6, duration: 0.25, ease: 'power2.out' }, 0)
          .to(this.fx, { beam: 1, duration: 0.12 }, 0.1)
          .add(() => {
            this.burst(40, MOUTH[0], MOUTH[1], 220);
            this.crackle(1.2);
          }, 0.1)
          .to(this.rig, { x: '+=5', duration: 0.04, yoyo: true, repeat: 15 }, 0.1)
          .to(this.fx, { beam: 0, duration: 0.4 }, 1.1)
          .to(this.fx, { y: 0, jaw: 0, flare: 0, duration: 0.8, ease: 'bounce.out' }, 1.2)
          .add(() => this.lookAt(0, 0), 1.6);
        break;
      }
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
