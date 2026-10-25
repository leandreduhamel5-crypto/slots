import { Container, Sprite, Texture } from 'pixi.js';

interface P {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  spin: number;
  g: number;
}

const TINTS = [0xff2a3d, 0xff5a3a, 0xb0001a, 0xffd27a, 0xe9dfc9];

/** Blood-spore bursts and fountains for wins. */
export class Particles extends Container {
  private ps: P[] = [];
  private fountain: { x: number; y: number; rate: number; acc: number } | null = null;

  constructor(private tex: Texture) {
    super();
  }

  burst(x: number, y: number, n: number, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (200 + Math.random() * 700) * power;
      this.add(x, y, Math.cos(a) * v, Math.sin(a) * v - 200 * power, 0.8 + Math.random() * 1.2);
    }
  }

  startFountain(x: number, y: number, rate: number): void {
    this.fountain = { x, y, rate, acc: 0 };
  }

  stopFountain(): void {
    this.fountain = null;
  }

  private add(x: number, y: number, vx: number, vy: number, max: number): void {
    const s = new Sprite(this.tex);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    const size = 6 + Math.random() * 22;
    s.width = s.height = size;
    s.tint = TINTS[Math.floor(Math.random() * TINTS.length)];
    s.position.set(x, y);
    this.addChild(s);
    this.ps.push({ s, vx, vy, life: 0, max, spin: (Math.random() - 0.5) * 8, g: 900 + Math.random() * 600 });
  }

  update(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    if (this.fountain) {
      const f = this.fountain;
      f.acc += f.rate * dt;
      while (f.acc >= 1) {
        f.acc--;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
        const v = 700 + Math.random() * 700;
        this.add(f.x + (Math.random() - 0.5) * 60, f.y, Math.cos(a) * v, Math.sin(a) * v, 1.4 + Math.random());
      }
    }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life += dt;
      p.vy += p.g * dt;
      p.vx *= 0.995;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      p.s.alpha = Math.max(0, 1 - p.life / p.max);
      if (p.life >= p.max) {
        p.s.destroy();
        this.ps.splice(i, 1);
      }
    }
  }
}
