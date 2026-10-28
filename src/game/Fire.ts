import { Container, Sprite, Texture } from 'pixi.js';
import { makeCanvas } from './art/painters';

/** Soft flame blob: hot core fading out, stretched vertically by the sprites. */
export function paintFlameBlob(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 36, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

/** colour over a flame tongue's life: white-hot core → yellow → orange → deep red */
const RAMPS = {
  gold: [0xffe6a8, 0xffa830, 0xff5a0a, 0x8a1400],
  infected: [0xfff0e0, 0xff7a5a, 0xff2a1c, 0x8a0608],
};

function mix(a: number, b: number, k: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k) << s;
  return ch(16) | ch(8) | ch(0);
}

function ramp(r: number[], k: number): number {
  const x = Math.min(0.999, Math.max(0, k)) * (r.length - 1);
  const i = Math.floor(x);
  return mix(r[i], r[i + 1], x - i);
}

interface Tongue {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  phase: number;
  spark: boolean;
}

/**
 * Live brazier fire: additive tongues of flame licking upward with a colour ramp, a flickering
 * core and stray sparks. `hot` blends to the infection's red fire; `roar()` makes it flare up.
 */
export class Fire extends Container {
  private pool: Sprite[] = [];
  private live: Tongue[] = [];
  private core: Sprite;
  private acc = 0;
  private t = Math.random() * 10;
  private boost = 0;
  hot = 0;
  /** size factor relative to the 92 px reference brazier */
  private get k(): number {
    return this.width0 / 92;
  }

  constructor(
    private flame: Texture,
    private glow: Texture,
    private width0 = 92,
  ) {
    super();
    this.core = new Sprite(flame);
    this.core.anchor.set(0.5, 0.75);
    this.core.blendMode = 'add';
    this.addChild(this.core);
  }

  roar(power = 1): void {
    this.boost = Math.max(this.boost, power);
  }

  private get(): Sprite {
    let s = this.pool.pop();
    if (!s) {
      s = new Sprite(this.flame);
      s.blendMode = 'add';
      s.anchor.set(0.5);
      this.addChild(s);
    }
    s.visible = true;
    return s;
  }

  private spawnTongue(spark: boolean): void {
    const s = this.get();
    s.texture = spark ? this.glow : this.flame;
    const u = (Math.random() + Math.random() - 1) * 0.5; // biased to the centre
    const heat = (1 + this.boost * 0.8) * this.k;
    this.live.push({
      s,
      vx: -u * 30 + (Math.random() - 0.5) * 16,
      vy: spark ? -(160 + Math.random() * 180) * heat : -(120 + Math.random() * 110) * heat,
      life: spark ? 0.9 + Math.random() * 0.9 : 0.42 + Math.random() * 0.36,
      age: 0,
      size: (spark ? 3 + Math.random() * 4 : (16 + Math.random() * 20) * (1 - Math.abs(u) * 0.8) * (1 + this.boost * 0.4)) * this.k,
      phase: Math.random() * 10,
      spark,
    });
    s.position.set(u * this.width0, spark ? -10 : 0);
  }

  update(dt: number): void {
    this.t += dt;
    this.boost *= Math.pow(0.2, dt);
    const r = this.hot > 0.5 ? RAMPS.infected : RAMPS.gold;
    // flickering core, the bright heart of the fire sitting in the bowl
    const flick = 0.85 + 0.15 * Math.sin(this.t * 17) * Math.sin(this.t * 6.3);
    this.core.scale.set(((this.width0 * 0.95) / 64) * flick, ((this.width0 * 1.1) / 64) * (flick + this.boost * 0.4));
    this.core.tint = ramp(r, 0.18);
    this.core.alpha = 0.45;

    this.acc += dt * (75 + this.boost * 80);
    while (this.acc >= 1) {
      this.acc -= 1;
      this.spawnTongue(Math.random() < 0.06);
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.s.visible = false;
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      // tongues lick sideways more as they rise; they converge into a point
      p.s.x += (p.vx + Math.sin(this.t * 9 + p.phase) * 40 * k) * dt - p.s.x * dt * (p.spark ? 0 : 1.6);
      p.s.y += p.vy * dt;
      p.vy *= Math.pow(p.spark ? 0.7 : 0.9, dt);
      if (p.spark) {
        p.s.scale.set(p.size / 256);
        p.s.tint = ramp(r, 0.3 + k * 0.5);
        p.s.alpha = 1 - k;
      } else {
        const sz = p.size * (1 - k * 0.7);
        p.s.scale.set(sz / 64, (sz * (2.2 + k * 1.6)) / 64);
        p.s.tint = ramp(r, k);
        p.s.alpha = (k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.3)) * 0.45;
      }
    }
  }
}
