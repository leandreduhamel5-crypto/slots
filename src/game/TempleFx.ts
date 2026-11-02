import { Container, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { makeCanvas } from './art/painters';
import { APEX, TH as H, TW as W } from './art/templeHD';

type Pt = [number, number];

/** Horizontal anamorphic streak (bright core, long soft wings). */
function streakCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(512, 32);
  const img = ctx.createImageData(512, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 512; x++) {
      const u = Math.abs(x / 511 - 0.5) * 2;
      const v = Math.abs(y / 31 - 0.5) * 2;
      const a = Math.pow(1 - u, 2.2) * Math.exp(-v * v * 9);
      const i = (y * 512 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Four-point star with thin rays, for the capstone flare. */
function starCanvas(): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2);
      const dy = (y - S / 2) / (S / 2);
      const r = Math.hypot(dx, dy);
      const rays = Math.exp(-Math.abs(dx) * 60) * (1 - Math.abs(dy)) + Math.exp(-Math.abs(dy) * 60) * (1 - Math.abs(dx));
      const core = Math.exp(-r * r * 40);
      const a = Math.min(1, rays * 0.9 + core);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const sc = ([x, y]: Pt): Pt => [x - W / 2, y - H / 2];

/** Live light on the temple: the gold capstone breathing, and sheet lightning in the far clouds. */
export class TempleFx extends Container {
  private streak: Texture;
  private star: Texture;
  private capFlare = new Container();
  private capStreak: Sprite;
  private capStar: Sprite;
  private capCore: Sprite;
  private sheet: Sprite;
  private t = 0;
  private nextSheet = 5;
  private flash = 0;
  feature = 0;
  /** called when energy reaches the capstone (power 0..1) */
  onCharge: ((power: number) => void) | null = null;

  constructor(glow: Texture) {
    super();
    this.streak = Texture.from(streakCanvas());
    this.star = Texture.from(starCanvas());

    this.sheet = new Sprite(glow);
    this.sheet.anchor.set(0.5);
    this.sheet.blendMode = 'add';
    this.sheet.alpha = 0;

    this.capStreak = new Sprite(this.streak);
    this.capStreak.anchor.set(0.5);
    this.capStreak.blendMode = 'add';
    this.capStar = new Sprite(this.star);
    this.capStar.anchor.set(0.5);
    this.capStar.blendMode = 'add';
    this.capCore = new Sprite(glow);
    this.capCore.anchor.set(0.5);
    this.capCore.blendMode = 'add';
    this.capFlare.addChild(this.capCore, this.capStreak, this.capStar);
    this.capFlare.position.set(...sc([APEX[0], APEX[1] + 6]));

    this.addChild(this.sheet, this.capFlare);
  }

  /** The capstone answers (wins, bonus start). */
  surge(power = 1): void {
    this.flash = Math.max(this.flash, power * 0.6);
  }

  update(dt: number, boltLight: number): void {
    this.t += dt;
    const t = this.t;
    const f = this.feature;
    const red = f > 0.5;
    this.flash *= Math.pow(0.05, dt);

    // capstone flare: breathing, spiking when energy arrives
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
    const p = 0.3 + pulse * 0.1 + this.flash * 0.6 + f * 0.2 + boltLight * 0.25;
    this.capStreak.width = 260 + p * 340;
    this.capStreak.height = 8 + p * 6;
    this.capStreak.alpha = Math.min(1, 0.2 + p * 0.4);
    this.capStar.scale.set((60 + p * 110) / 256);
    this.capStar.rotation = Math.sin(t * 0.3) * 0.15;
    this.capStar.alpha = Math.min(1, 0.5 + p * 0.4);
    this.capCore.width = this.capCore.height = 70 + p * 90;
    this.capCore.alpha = Math.min(1, 0.5 + p * 0.4);
    const tint = red ? 0xff4a30 : 0xffd9a0;
    this.capStreak.tint = this.capCore.tint = tint;
    this.capStar.tint = red ? 0xffb0a0 : 0xfff2d8;

    // night: sheet lightning glowing inside distant clouds
    this.nextSheet -= dt;
    if (this.nextSheet <= 0) {
      this.nextSheet = red ? 9 + Math.random() * 8 : 18 + Math.random() * 16;
      const x = Math.random() < 0.5 ? 150 + Math.random() * 500 : 1250 + Math.random() * 550;
      this.sheet.position.set(...sc([x, 60 + Math.random() * 200]));
      this.sheet.width = 500 + Math.random() * 400;
      this.sheet.height = this.sheet.width * 0.5;
      this.sheet.tint = red ? 0xff3020 : 0xa8b4ff;
      gsap.killTweensOf(this.sheet);
      gsap
        .timeline()
        .set(this.sheet, { alpha: 0 })
        .to(this.sheet, { alpha: red ? 0.26 : 0.16, duration: 0.08 })
        .to(this.sheet, { alpha: 0, duration: 0.5 });
    }
  }
}
