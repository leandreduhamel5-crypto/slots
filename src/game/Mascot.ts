import { Container, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { MASCOT_ARM, MASCOT_BODY, MASCOT_EYES, MASCOT_HEAD, MASCOT_JAW, MASCOT_LIDS } from './art/mascot';
import { makeCanvas } from './art/painters';
import { loadSvg } from './textures';

const RES = 1.5;
const W = 400;
const H = 600;
const NECK = { x: 200, y: 262 };
const SHOULDER = { x: 292, y: 300 };
const FEET = { x: 200, y: 584 };

async function part(svg: string): Promise<Texture> {
  const img = await loadSvg(svg, W * RES, H * RES);
  const [c, ctx] = makeCanvas(W * RES, H * RES);
  ctx.drawImage(img, 0, 0, W * RES, H * RES);
  return Texture.from(c);
}

export interface MascotTextures {
  body: Texture;
  arm: Texture;
  head: Texture;
  jaw: Texture;
  eyes: Texture;
  lids: Texture;
}

export async function buildMascotTextures(): Promise<MascotTextures> {
  const [body, arm, head, jaw, eyes, lids] = await Promise.all([MASCOT_BODY, MASCOT_ARM, MASCOT_HEAD, MASCOT_JAW, MASCOT_EYES, MASCOT_LIDS].map(part));
  return { body, arm, head, jaw, eyes, lids };
}

export type Reaction = 'spin' | 'win' | 'big' | 'feature';

/** Rigged cartoon mascot: breathes, blinks, watches the reels and reacts to wins. */
export class Mascot extends Container {
  private breath = new Container();
  private rig = new Container();
  private headIdle = new Container();
  private headC = new Container();
  private armIdle = new Container();
  private arm: Sprite;
  private jaw: Sprite;
  private eyes: Sprite;
  private lids: Sprite;
  private busy: gsap.core.Timeline | null = null;

  constructor(t: MascotTextures) {
    super();
    const sprite = (tex: Texture, ox = 0, oy = 0) => {
      const s = new Sprite(tex);
      s.scale.set(1 / RES);
      s.position.set(-ox, -oy);
      return s;
    };
    this.rig.pivot.set(FEET.x, FEET.y);
    const body = sprite(t.body);
    this.arm = sprite(t.arm);
    this.arm.anchor.set(SHOULDER.x / W, SHOULDER.y / H);
    this.arm.position.set(0, 0);
    this.armIdle.position.set(SHOULDER.x, SHOULDER.y);
    this.armIdle.addChild(this.arm);
    this.headC.pivot.set(NECK.x, NECK.y);
    this.headIdle.position.set(NECK.x, NECK.y);
    this.headIdle.addChild(this.headC);
    const head = sprite(t.head);
    this.jaw = sprite(t.jaw);
    this.eyes = sprite(t.eyes);
    this.eyes.blendMode = 'add';
    this.eyes.alpha = 0.5;
    this.lids = sprite(t.lids);
    this.lids.alpha = 0;
    this.headC.addChild(head, this.jaw, this.eyes, this.lids);
    this.rig.addChild(body, this.headIdle, this.armIdle);
    this.breath.addChild(this.rig);
    this.addChild(this.breath);
    this.idle();
    this.scheduleBlink();
  }

  private idle(): void {
    gsap.to(this.breath.scale, { y: 1.025, x: 0.99, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to(this.headIdle, { rotation: 0.04, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.fromTo(this.armIdle, { rotation: -0.04 }, { rotation: 0.06, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to(this.eyes, { alpha: 0.9, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  private scheduleBlink(): void {
    gsap.delayedCall(2 + Math.random() * 3.5, () => {
      gsap.timeline().set(this.lids, { alpha: 1 }).set(this.lids, { alpha: 0 }, 0.12);
      if (Math.random() < 0.3) gsap.timeline().set(this.lids, { alpha: 1 }, 0.25).set(this.lids, { alpha: 0 }, 0.35);
      this.scheduleBlink();
    });
  }

  private play(tl: gsap.core.Timeline): void {
    this.busy?.progress(1).kill();
    this.busy = tl;
  }

  react(kind: Reaction): void {
    const j = this.jaw;
    const h = this.headC;
    const a = this.arm;
    const r = this.rig;
    const tl = gsap.timeline();
    switch (kind) {
      case 'spin':
        tl.to(h, { rotation: -0.12, duration: 0.25, ease: 'back.out(2)' }).to(h, { rotation: 0, duration: 0.6, ease: 'sine.inOut' }, '+=0.8');
        break;
      case 'win':
        for (let i = 0; i < 4; i++) tl.to(j, { y: 10, duration: 0.07 }).to(j, { y: 0, duration: 0.07 });
        tl.to(h, { rotation: 0.1, duration: 0.08, yoyo: true, repeat: 5 }, 0)
          .to(r, { y: -16, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, 0);
        break;
      case 'big':
        tl.to(h, { rotation: -0.22, duration: 0.2, ease: 'back.out(2)' })
          .to(j, { y: 26, duration: 0.15 }, 0)
          .to(a, { rotation: -1.6, duration: 0.25, ease: 'back.out(2)' }, 0)
          .to(this.eyes, { alpha: 1, duration: 0.1 }, 0)
          .to(r, { x: 6, duration: 0.04, yoyo: true, repeat: 15 }, 0.15)
          .to(r.scale, { x: 1.06, y: 1.06, duration: 0.2 }, 0)
          .to([h, a], { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, '+=0.6')
          .to(j, { y: 0, duration: 0.2 }, '<')
          .to(r.scale, { x: 1, y: 1, duration: 0.4 }, '<');
        break;
      case 'feature':
        tl.to(r.scale, { x: 1.12, y: 0.86, duration: 0.15 })
          .to(r, { y: -90, duration: 0.3, ease: 'power2.out' })
          .to(r.scale, { x: 0.94, y: 1.1, duration: 0.3 }, '<')
          .to(a, { rotation: -1.8, duration: 0.3 }, '<')
          .to(j, { y: 26, duration: 0.2 }, '<')
          .to(r, { y: 0, duration: 0.3, ease: 'power2.in' })
          .to(r.scale, { x: 1.15, y: 0.85, duration: 0.1 })
          .to(r.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.35)' })
          .to(a, { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, '<')
          .to(j, { y: 0, duration: 0.2 }, '<');
        break;
    }
    this.play(tl);
  }
}

export const MASCOT_HEIGHT = H;
export const MASCOT_WIDTH = W;
