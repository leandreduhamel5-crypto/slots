import { Container, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { MH, MRES, MW, paintMascot, type MascotParts } from './art/mascotPaint';

const RES = MRES;
const W = MW;
const H = MH;
const NECK = { x: 200, y: 262 };
const SHOULDER = { x: 292, y: 300 };
const FEET = { x: 200, y: 584 };
const INHUMAN_SCALE = 1.16;

interface FormTextures {
  body: Texture;
  arm: Texture;
  head: Texture;
  jaw: Texture;
  eyes: Texture;
  lids: Texture;
}

export interface MascotTextures {
  human: FormTextures;
  inhuman: FormTextures;
}

export type Form = keyof MascotTextures;

function form(parts: MascotParts): FormTextures {
  const t = (c: HTMLCanvasElement) => Texture.from(c);
  return { body: t(parts.body), arm: t(parts.arm), head: t(parts.head), jaw: t(parts.jaw), eyes: t(parts.eyes), lids: t(parts.lids) };
}

export async function buildMascotTextures(): Promise<MascotTextures> {
  const painted = paintMascot();
  return { human: form(painted.human), inhuman: form(painted.inhuman) };
}

export type Reaction = 'spin' | 'win' | 'big' | 'feature';

/**
 * The main character, rigged like a Spine skeleton: breath, head, arm, jaw, glowing eyes, eyelids.
 * As a human it hides the infection (nervous glances, a red eye, split-second glitches into its
 * true form); during free spins it is revealed as the Inhuman.
 */
export class Mascot extends Container {
  private grow = new Container();
  private breath = new Container();
  private rig = new Container();
  private headIdle = new Container();
  private headC = new Container();
  private armIdle = new Container();
  private body: Sprite;
  private head: Sprite;
  private arm: Sprite;
  private jaw: Sprite;
  private eyes: Sprite;
  private lids: Sprite;
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private busy: gsap.core.Timeline | null = null;
  private idleTweens: gsap.core.Animation[] = [];
  form: Form = 'human';
  /** called at the climax of a transformation (particles, sound…) */
  onTransform: ((to: Form) => void) | null = null;

  constructor(private tex: MascotTextures) {
    super();
    const sprite = (t: Texture) => {
      const s = new Sprite(t);
      s.scale.set(1 / RES);
      return s;
    };
    const t = tex.human;
    this.rig.pivot.set(FEET.x, FEET.y);
    this.body = sprite(t.body);
    this.arm = sprite(t.arm);
    this.arm.anchor.set(SHOULDER.x / W, SHOULDER.y / H);
    this.armIdle.position.set(SHOULDER.x, SHOULDER.y);
    this.armIdle.addChild(this.arm);
    this.headC.pivot.set(NECK.x, NECK.y);
    this.headIdle.position.set(NECK.x, NECK.y);
    this.headIdle.addChild(this.headC);
    this.head = sprite(t.head);
    this.jaw = sprite(t.jaw);
    this.eyes = sprite(t.eyes);
    this.eyes.blendMode = 'add';
    this.lids = sprite(t.lids);
    this.lids.alpha = 0;
    this.headC.addChild(this.head, this.jaw, this.eyes, this.lids);
    this.rig.addChild(this.body, this.headIdle, this.armIdle);
    this.breath.addChild(this.rig);
    this.grow.addChild(this.breath);
    this.addChild(this.grow);
    this.startIdle();
    this.scheduleBlink();
    this.scheduleTell();
  }

  private apply(f: Form): void {
    const t = this.tex[f];
    this.body.texture = t.body;
    this.arm.texture = t.arm;
    this.head.texture = t.head;
    this.jaw.texture = t.jaw;
    this.eyes.texture = t.eyes;
    this.lids.texture = t.lids;
  }

  private startIdle(): void {
    for (const tw of this.idleTweens) tw.kill();
    const monster = this.form === 'inhuman';
    gsap.set(this.breath.scale, { x: 1, y: 1 });
    this.idleTweens = [
      gsap.to(this.breath.scale, {
        y: monster ? 1.05 : 1.022,
        x: monster ? 0.97 : 0.99,
        duration: monster ? 0.9 : 1.5,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      }),
      gsap.fromTo(this.headIdle, { rotation: -0.03 }, { rotation: monster ? 0.07 : 0.04, duration: monster ? 1.3 : 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
      gsap.fromTo(this.armIdle, { rotation: -0.04 }, { rotation: monster ? 0.12 : 0.05, duration: monster ? 1.1 : 1.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
      gsap.fromTo(this.eyes, { alpha: monster ? 0.6 : 0.2 }, { alpha: monster ? 1 : 0.55, duration: monster ? 0.5 : 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
    ];
  }

  private scheduleBlink(): void {
    gsap.delayedCall(2 + Math.random() * 3.5, () => {
      gsap.timeline().set(this.lids, { alpha: 1 }).set(this.lids, { alpha: 0 }, 0.12);
      if (Math.random() < 0.3) gsap.timeline().set(this.lids, { alpha: 1 }, 0.25).set(this.lids, { alpha: 0 }, 0.35);
      this.scheduleBlink();
    });
  }

  /** The infected tell: a nervous glance, or a split-second glitch into the true form. */
  private scheduleTell(): void {
    gsap.delayedCall(5 + Math.random() * 6, () => {
      if (!this.busy?.isActive()) {
        if (this.form === 'human') {
          if (Math.random() < 0.45) this.glitchFlash(0.18);
          else this.play(gsap.timeline().to(this.headC, { rotation: 0.16, duration: 0.15 }).to(this.headC, { rotation: -0.1, duration: 0.25 }, '+=0.35').to(this.headC, { rotation: 0, duration: 0.3 }, '+=0.3'));
        } else {
          this.play(this.chomp(3));
        }
      }
      this.scheduleTell();
    });
  }

  private glitchFlash(duration: number): void {
    this.filters = [this.split];
    const tl = gsap.timeline({
      onComplete: () => {
        this.apply(this.form);
        this.filters = [];
      },
    });
    for (let i = 0; i < 4; i++) {
      tl.add(() => {
        this.apply(i % 2 ? this.form : this.form === 'human' ? 'inhuman' : 'human');
        this.split.red = { x: (Math.random() - 0.5) * 16, y: 0 };
        this.split.blue = { x: (Math.random() - 0.5) * 16, y: 0 };
        this.rig.x = (Math.random() - 0.5) * 10;
      });
      tl.to({}, { duration: duration / 4 });
    }
    tl.add(() => (this.rig.x = 0));
    this.play(tl);
  }

  private chomp(n: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    for (let i = 0; i < n; i++) tl.to(this.jaw, { y: this.form === 'inhuman' ? 20 : 8, duration: 0.08 }).to(this.jaw, { y: 0, duration: 0.09 });
    return tl;
  }

  private play(tl: gsap.core.Timeline): void {
    this.busy?.progress(1).kill();
    this.busy = tl;
  }

  /** Reveal (or hide) the Inhuman with a glitchy, shaking transformation. */
  setForm(to: Form, animate = true): void {
    if (to === this.form) return;
    if (!animate) {
      this.form = to;
      this.apply(to);
      this.grow.scale.set(to === 'inhuman' ? INHUMAN_SCALE : 1);
      this.startIdle();
      return;
    }
    const r = this.rig;
    this.filters = [this.split];
    const tl = gsap.timeline({
      onComplete: () => {
        this.filters = [];
        this.startIdle();
      },
    });
    tl.to(r.scale, { x: 0.92, y: 1.08, duration: 0.25, ease: 'power2.out' }).to(r, { x: 5, duration: 0.03, yoyo: true, repeat: 13 }, 0);
    for (let i = 0; i < 6; i++) {
      tl.add(() => {
        this.apply(i % 2 ? this.form : to);
        this.split.red = { x: (Math.random() - 0.5) * 22, y: (Math.random() - 0.5) * 6 };
        this.split.blue = { x: (Math.random() - 0.5) * 22, y: 0 };
      }, 0.1 + i * 0.07);
    }
    tl.add(() => {
      this.form = to;
      this.apply(to);
      this.split.red = { x: 0, y: 0 };
      this.split.blue = { x: 0, y: 0 };
      r.x = 0;
      this.onTransform?.(to);
    }, 0.55)
      .fromTo(r.scale, { x: 1.25, y: 0.78 }, { x: 1, y: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' }, 0.55)
      .to(this.grow.scale, { x: to === 'inhuman' ? INHUMAN_SCALE : 1, y: to === 'inhuman' ? INHUMAN_SCALE : 1, duration: 0.5, ease: 'back.out(2)' }, 0.55)
      .to(this.jaw, { y: to === 'inhuman' ? 26 : 6, duration: 0.15 }, 0.55)
      .to(this.armIdle, { rotation: to === 'inhuman' ? -1.4 : 0, duration: 0.3, ease: 'back.out(2)' }, 0.55)
      .to(this.jaw, { y: 0, duration: 0.25 }, 1.4)
      .to(this.armIdle, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 1.4);
    this.play(tl);
  }

  react(kind: Reaction): void {
    const j = this.jaw;
    const h = this.headC;
    const a = this.arm;
    const r = this.rig;
    const monster = this.form === 'inhuman';
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        tl.to(h, { rotation: -0.12, duration: 0.25, ease: 'back.out(2)' }).to(h, { rotation: 0, duration: 0.6, ease: 'sine.inOut' }, '+=0.8');
        break;
      case 'win':
        if (monster) tl.add(this.chomp(4)).to(h, { rotation: 0.12, duration: 0.08, yoyo: true, repeat: 5 }, 0);
        else
          tl.to(a, { rotation: -2.2, duration: 0.2, ease: 'back.out(2)' })
            .to(r, { y: -18, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, 0)
            .to(j, { y: 5, duration: 0.08, yoyo: true, repeat: 3 }, 0)
            .to(a, { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, '+=0.4');
        break;
      case 'big':
        if (!monster) {
          this.setForm('inhuman');
          gsap.delayedCall(2.4, () => this.setForm('human'));
          return;
        }
        tl.to(h, { rotation: -0.22, duration: 0.2, ease: 'back.out(2)' })
          .to(j, { y: 28, duration: 0.15 }, 0)
          .to(a, { rotation: -1.6, duration: 0.25, ease: 'back.out(2)' }, 0)
          .to(r, { x: 6, duration: 0.04, yoyo: true, repeat: 15 }, 0.15)
          .to([h, a], { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, '+=0.6')
          .to(j, { y: 0, duration: 0.2 }, '<');
        break;
      case 'feature':
        this.setForm('inhuman');
        return;
    }
    this.play(tl);
  }
}
