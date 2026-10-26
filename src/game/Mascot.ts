import { Container, MeshPlane, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { EYE_Y, ORB, SHOULDER_L, SHOULDER_R, SRES, SW, SH, paintSmokePuff, paintSpectre, type SpectreParts } from './art/spectre';
import { makeCanvas } from './art/painters';

const FEET = { x: 200, y: 584 };
const RAGE_SCALE = 1.12;

interface FormTextures {
  cloak: Texture;
  face: Texture;
  jaw: Texture;
  eyeArt: Texture;
  eyes: Texture;
  handL: Texture;
  handR: Texture;
  orb: Texture;
  horns: Texture;
}

export interface MascotTextures {
  human: FormTextures;
  inhuman: FormTextures;
  puff: Texture;
  glow: Texture;
}

/** 'human' is the calm keeper, 'inhuman' the unleashed form shown during free spins. */
export type Form = 'human' | 'inhuman';
export type Reaction = 'spin' | 'win' | 'big' | 'feature';

function form(p: SpectreParts): FormTextures {
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  return {
    cloak: t(p.cloak),
    face: t(p.face),
    jaw: t(p.jaw),
    eyeArt: t(p.eyeArt),
    eyes: t(p.eyes),
    handL: t(p.handL),
    handR: t(p.handR),
    orb: t(p.orb),
    horns: t(p.horns),
  };
}

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
  const painted = paintSpectre();
  return { human: form(painted.calm), inhuman: form(painted.rage), puff: Texture.from(paintSmokePuff()), glow: Texture.from(glowCanvas()) };
}

interface Mote {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  grow: number;
  spin: number;
  a0: number;
}

/**
 * "Le Gardien du Codex": a floating hooded wraith. Its tattered cloak is a mesh rippling in an
 * unseen wind, smoke pours from the hem, embers rise, the orb of infection pulses in one claw and
 * the Codex rests in the other. During free spins it unleashes: horns, molten cracks, red eyes.
 */
export class Mascot extends Container {
  private grow = new Container();
  private float = new Container();
  private rig = new Container();
  private aura: Sprite;
  private smokeBack = new Container();
  private smokeFront = new Container();
  private cloak: MeshPlane;
  private basePos: Float32Array;
  private horns: Sprite;
  private faceC = new Container();
  private face: Sprite;
  private jaw: Sprite;
  private eyeArt: Sprite;
  private eyes: Sprite;
  private handL = new Container();
  private handR = new Container();
  private handLs: Sprite;
  private handRs: Sprite;
  private orbC = new Container();
  private orb: Sprite;
  private orbGlow: Sprite;
  private motes: Mote[] = [];
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private t = Math.random() * 10;
  private rage = 0;
  private emitIn = 0;
  private lift = { y: 0, lean: 0, wind: 1, flare: 1 };
  form: Form = 'human';
  /** called at the climax of a transformation (particles, sound…) */
  onTransform: ((to: Form) => void) | null = null;

  constructor(
    private tex: MascotTextures,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    const k = 1 / SRES;
    const sprite = (t: Texture) => {
      const s = new Sprite(t);
      s.scale.set(k);
      return s;
    };
    const t = tex.human;
    this.rig.pivot.set(FEET.x, FEET.y);

    this.aura = new Sprite(tex.glow);
    this.aura.anchor.set(0.5);
    this.aura.position.set(200, 300);
    this.aura.width = 560;
    this.aura.height = 680;
    this.aura.blendMode = 'add';
    this.aura.tint = 0x8e0f26;
    this.aura.alpha = 0.35;

    this.cloak = new MeshPlane({ texture: t.cloak, verticesX: 9, verticesY: 16 });
    this.cloak.autoResize = false;
    this.cloak.scale.set(k);
    this.basePos = new Float32Array(this.cloak.geometry.positions);

    this.horns = sprite(tex.inhuman.horns);
    this.horns.anchor.set(0.5, 80 / SH);
    this.horns.position.set(SW / 2, 80);
    this.horns.alpha = 0;

    this.face = sprite(t.face);
    this.jaw = sprite(t.jaw);
    // eye layers pivot on the eye line so a blink squashes them in place
    this.eyeArt = sprite(t.eyeArt);
    this.eyeArt.anchor.set(0.5, EYE_Y / SH);
    this.eyeArt.position.set(SW / 2, EYE_Y);
    this.eyes = sprite(t.eyes);
    this.eyes.anchor.set(0.5, EYE_Y / SH);
    this.eyes.position.set(SW / 2, EYE_Y);
    this.eyes.blendMode = 'add';
    this.faceC.addChild(this.face, this.jaw, this.eyeArt, this.eyes);

    this.handLs = sprite(t.handL);
    this.handLs.position.set(-SHOULDER_L.x, -SHOULDER_L.y);
    this.handL.position.set(SHOULDER_L.x, SHOULDER_L.y);
    this.handL.addChild(this.handLs);
    this.handRs = sprite(t.handR);
    this.handRs.position.set(-SHOULDER_R.x, -SHOULDER_R.y);
    this.handR.position.set(SHOULDER_R.x, SHOULDER_R.y);
    this.orbGlow = new Sprite(tex.glow);
    this.orbGlow.anchor.set(0.5);
    this.orbGlow.width = this.orbGlow.height = 150;
    this.orbGlow.blendMode = 'add';
    this.orb = sprite(t.orb);
    this.orb.anchor.set(0.5);
    this.orbC.position.set(ORB.x - SHOULDER_R.x, ORB.y - SHOULDER_R.y);
    this.orbC.addChild(this.orbGlow, this.orb);
    this.handR.addChild(this.handRs, this.orbC);

    this.rig.addChild(this.aura, this.smokeBack, this.cloak, this.horns, this.faceC, this.handL, this.handR, this.smokeFront);
    this.float.addChild(this.rig);
    this.grow.addChild(this.float);
    this.addChild(this.grow);
    this.applyTint();
    if (custom) {
      // professional artwork: a still image that keeps the hover, aura, smoke and reactions
      for (const c of [this.cloak, this.horns, this.faceC, this.handL, this.handR]) c.visible = false;
      const art = new Sprite(Texture.from(custom));
      art.anchor.set(0.5, 1);
      art.position.set(FEET.x, FEET.y);
      art.scale.set(560 / custom.naturalHeight);
      this.rig.addChildAt(art, this.rig.getChildIndex(this.cloak));
    }

    gsap.ticker.add(this.tick);
    this.scheduleBlink();
    this.scheduleTell();
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    gsap.ticker.remove(this.tick);
    super.destroy(options);
  }

  private apply(f: Form): void {
    const t = this.tex[f];
    this.cloak.texture = t.cloak;
    this.face.texture = t.face;
    this.jaw.texture = t.jaw;
    this.eyeArt.texture = t.eyeArt;
    this.eyes.texture = t.eyes;
    this.handLs.texture = t.handL;
    this.handRs.texture = t.handR;
    this.orb.texture = t.orb;
    this.horns.alpha = f === 'inhuman' ? 1 : 0;
    this.applyTint(f);
  }

  private applyTint(f: Form = this.form): void {
    const rage = f === 'inhuman';
    this.aura.tint = rage ? 0xff2a3a : 0x8e0f26;
    this.orbGlow.tint = rage ? 0xff5a2a : 0x7dff5a;
  }

  /* ------------------------------------------------------------ per-frame */

  private tick = (): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, gsap.ticker.deltaRatio() / 60);
    this.t += dt;
    const t = this.t;
    const rage = this.form === 'inhuman' ? 1 : 0;
    this.rage += (rage - this.rage) * Math.min(1, dt * 3);
    const r = this.rage;

    // hover + sway
    this.float.y = Math.sin(t * 1.7) * (8 + r * 4) + this.lift.y;
    this.rig.rotation = Math.sin(t * 0.9) * 0.015 + this.lift.lean;
    // cloak rippling: anchored at the hood, free at the hem
    const pos = this.cloak.geometry.positions;
    const base = this.basePos;
    const H = SH * SRES;
    const amp = (11 + r * 10) * SRES * this.lift.wind;
    for (let i = 0; i < pos.length; i += 2) {
      const x = base[i];
      const y = base[i + 1];
      const ny = y / H;
      const free = Math.pow(Math.max(0, (ny - 0.3) / 0.7), 1.5);
      pos[i] = x + Math.sin(t * (2.2 + r) + ny * 6 + x * 0.004) * amp * free;
      pos[i + 1] = y + Math.sin(t * 1.6 + x * 0.01) * amp * 0.22 * free;
    }
    this.cloak.geometry.getBuffer('aPosition').update();

    // hands, orb, eyes, aura
    this.handL.rotation = Math.sin(t * 1.5 + 1) * 0.035;
    this.handR.rotation = Math.sin(t * 1.9) * 0.05;
    this.orbC.y = ORB.y - SHOULDER_R.y + Math.sin(t * 3) * 5;
    this.orb.rotation += dt * (0.6 + r * 2);
    const pulse = 0.5 + 0.5 * Math.sin(t * (3 + r * 3));
    this.orbGlow.alpha = 0.55 + pulse * 0.4;
    this.orbGlow.width = this.orbGlow.height = (140 + pulse * 40) * this.lift.flare;
    this.eyes.alpha = (0.45 + 0.3 * Math.sin(t * 5.3) * Math.sin(t * 2.1) + r * 0.3) * (Math.random() < 0.02 ? 0.3 : 1);
    this.aura.alpha = 0.28 + r * 0.25 + pulse * 0.1;

    // smoke from the hem, embers rising
    this.emitIn -= dt;
    if (this.emitIn <= 0) {
      this.emitIn = 0.09 - r * 0.03;
      this.spawnSmoke();
      if (Math.random() < 0.6 + r * 0.4) this.spawnEmber();
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
      m.s.x += m.vx * dt;
      m.s.y += m.vy * dt;
      m.s.rotation += m.spin * dt;
      m.s.scale.set(m.s.scale.x + m.grow * dt);
      m.s.alpha = m.a0 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    }
  };

  private spawnSmoke(): void {
    const s = new Sprite(this.tex.puff);
    s.anchor.set(0.5);
    const x = 50 + Math.random() * 300;
    s.position.set(x, 556 + Math.random() * 34);
    s.scale.set(0.25 + Math.random() * 0.25);
    s.tint = this.form === 'inhuman' ? 0x8a3a4a : 0x6a5a86;
    (Math.random() < 0.55 ? this.smokeBack : this.smokeFront).addChild(s);
    this.motes.push({ s, vx: (x - 200) * 0.25 + (Math.random() - 0.5) * 30, vy: 6 + Math.random() * 18, life: 1.4 + Math.random() * 0.8, age: 0, grow: 0.35, spin: (Math.random() - 0.5) * 1.2, a0: 0.85 });
  }

  private spawnEmber(): void {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.position.set(60 + Math.random() * 280, 470 + Math.random() * 110);
    s.scale.set(0.03 + Math.random() * 0.04);
    s.blendMode = 'add';
    s.tint = Math.random() < 0.5 ? 0xff5a2a : 0xff2a44;
    this.smokeFront.addChild(s);
    this.motes.push({ s, vx: (Math.random() - 0.5) * 30, vy: -(40 + Math.random() * 60), life: 1.6 + Math.random(), age: 0, grow: 0, spin: 0, a0: 1 });
  }

  /* ------------------------------------------------------------ behaviour */

  private scheduleBlink(): void {
    gsap.delayedCall(2.5 + Math.random() * 3.5, () => {
      if (this.destroyed) return;
      const blink = () => gsap.timeline().to([this.eyeArt.scale, this.eyes.scale], { y: 0.05 / SRES, duration: 0.06 }).to([this.eyeArt.scale, this.eyes.scale], { y: 1 / SRES, duration: 0.1 });
      blink();
      if (Math.random() < 0.3) gsap.delayedCall(0.22, blink);
      this.scheduleBlink();
    });
  }

  /** Idle "tells": a glance at the reels, a hungry chomp, the orb flaring. */
  private scheduleTell(): void {
    gsap.delayedCall(4 + Math.random() * 5, () => {
      if (this.destroyed) return;
      if (!this.busy?.isActive()) {
        const roll = Math.random();
        if (roll < 0.4) this.play(gsap.timeline().to(this.faceC, { x: 7, duration: 0.25, ease: 'power2.out' }).to(this.faceC, { x: -4, duration: 0.3 }, '+=0.6').to(this.faceC, { x: 0, duration: 0.3 }, '+=0.4'));
        else if (roll < 0.75) this.play(this.chomp(this.form === 'inhuman' ? 3 : 2));
        else this.play(this.orbFlare(0.6));
      }
      this.scheduleTell();
    });
  }

  private chomp(n: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const open = this.form === 'inhuman' ? 16 : 9;
    for (let i = 0; i < n; i++) tl.to(this.jaw, { y: open, duration: 0.08, ease: 'power2.out' }).to(this.jaw, { y: 0, duration: 0.09, ease: 'power3.in' });
    return tl;
  }

  private orbFlare(power: number): gsap.core.Timeline {
    return gsap
      .timeline()
      .to(this.orb.scale, { x: (1 + 0.35 * power) / SRES, y: (1 + 0.35 * power) / SRES, duration: 0.15, ease: 'back.out(3)' })
      .to(this.lift, { flare: 1 + 0.8 * power, duration: 0.15 }, 0)
      .to(this.orb.scale, { x: 1 / SRES, y: 1 / SRES, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
      .to(this.lift, { flare: 1, duration: 0.5 }, '<');
  }

  private play(tl: gsap.core.Timeline): void {
    this.busy?.progress(1).kill();
    this.busy = tl;
  }

  /** Unleash (or calm) the wraith with a glitchy transformation. */
  setForm(to: Form, animate = true): void {
    if (to === this.form) return;
    const scale = to === 'inhuman' ? RAGE_SCALE : 1;
    if (!animate) {
      this.form = to;
      this.apply(to);
      this.grow.scale.set(scale);
      return;
    }
    this.filters = [this.split];
    const tl = gsap.timeline({ onComplete: () => (this.filters = []) });
    tl.to(this.lift, { wind: 3, duration: 0.3 }, 0).to(this.rig.scale, { x: 0.9, y: 1.1, duration: 0.3, ease: 'power2.out' }, 0);
    for (let i = 0; i < 6; i++) {
      tl.add(() => {
        this.apply(i % 2 ? this.form : to);
        this.split.red = { x: (Math.random() - 0.5) * 24, y: (Math.random() - 0.5) * 6 };
        this.split.blue = { x: (Math.random() - 0.5) * 24, y: 0 };
      }, 0.1 + i * 0.07);
    }
    tl.add(() => {
      this.form = to;
      this.apply(to);
      this.split.red = { x: 0, y: 0 };
      this.split.blue = { x: 0, y: 0 };
      for (let i = 0; i < 16; i++) this.spawnSmoke();
      this.onTransform?.(to);
    }, 0.55)
      .fromTo(this.rig.scale, { x: 1.2, y: 0.82 }, { x: 1, y: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' }, 0.55)
      .to(this.grow.scale, { x: scale, y: scale, duration: 0.5, ease: 'back.out(2)' }, 0.55)
      .fromTo(this.horns.scale, { x: 0.2 / SRES, y: 0.2 / SRES }, { x: 1 / SRES, y: 1 / SRES, duration: 0.5, ease: 'back.out(3)' }, 0.55)
      .to(this.jaw, { y: to === 'inhuman' ? 22 : 6, duration: 0.15 }, 0.55)
      .add(this.orbFlare(1.2), 0.55)
      .to(this.jaw, { y: 0, duration: 0.25 }, 1.4)
      .to(this.lift, { wind: 1, duration: 1 }, 1.2);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const monster = this.form === 'inhuman';
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        // lean toward the reels (the art is mirrored on screen) and flare the orb
        tl.to(this.lift, { lean: 0.07, duration: 0.25, ease: 'back.out(2)' }).add(this.orbFlare(0.5), 0).to(this.lift, { lean: 0, duration: 0.7, ease: 'sine.inOut' }, '+=0.6');
        break;
      case 'win':
        tl.to(this.lift, { y: -26, duration: 0.2, ease: 'power2.out' })
          .add(this.chomp(3), 0)
          .add(this.orbFlare(1), 0)
          .to(this.lift, { y: 0, duration: 0.6, ease: 'bounce.out' }, 0.5);
        break;
      case 'big':
        if (!monster) {
          this.setForm('inhuman');
          gsap.delayedCall(2.6, () => this.setForm('human'));
          return;
        }
        tl.to(this.lift, { y: -34, wind: 2.5, duration: 0.25, ease: 'power2.out' })
          .add(this.chomp(5), 0)
          .add(this.orbFlare(1.4), 0)
          .to(this.rig, { x: 6, duration: 0.04, yoyo: true, repeat: 15 }, 0.15)
          .to(this.lift, { y: 0, wind: 1, duration: 0.8, ease: 'bounce.out' }, 0.9);
        break;
      case 'feature':
        this.setForm('inhuman');
        return;
    }
    this.play(tl);
  }
}
