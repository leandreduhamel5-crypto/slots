import { Container, Sprite, type Texture } from 'pixi.js';
import { LITE } from './device';

export interface ParticleTextures {
  drop: Texture;
  dropCyan: Texture;
  star: Texture;
  puff: Texture;
  spore: Texture;
  /** gold coin (128 px), optional */
  coin?: Texture;
  /** a crisp grain of gold sand */
  grain?: Texture;
}

type Kind = 'drop' | 'cyan' | 'star' | 'puff' | 'spark' | 'tex' | 'coin' | 'sand';

interface P {
  s: Sprite;
  kind: Kind;
  vx: number;
  vy: number;
  life: number;
  max: number;
  spin: number;
  g: number;
  size: number;
}

/** Cartoon VFX: ink-outlined blood drops, comic stars, smoke puffs and glowing sparks. */
export class Particles extends Container {
  private ps: P[] = [];
  /** size of a particle relative to the design: small screens get smaller, fewer ones */
  unit = 1;

  constructor(private tex: ParticleTextures) {
    super();
  }

  private add(kind: Kind, x: number, y: number, vx: number, vy: number, max: number, size: number, custom?: Texture): void {
    if (LITE && this.ps.length >= 160) return;
    const byKind: Record<Kind, Texture> = {
      drop: this.tex.drop,
      cyan: this.tex.dropCyan,
      star: this.tex.star,
      puff: this.tex.puff,
      spark: this.tex.spore,
      sand: this.tex.grain ?? this.tex.spore,
      tex: this.tex.spore,
      coin: this.tex.coin ?? this.tex.spore,
    };
    const t = custom ?? byKind[kind];
    const s = new Sprite(t);
    s.anchor.set(0.5, kind === 'drop' || kind === 'cyan' ? 0.65 : 0.5);
    if (kind === 'puff') s.tint = 0x8a6a4a; // warm desert dust (dark enough not to bloom)
    if (kind === 'star') s.blendMode = 'add';
    if (kind === 'spark') {
      s.blendMode = 'add';
      s.tint = Math.random() < 0.5 ? 0xff3347 : 0xffd23f;
    }
    if (kind === 'sand') {
      s.blendMode = 'add';
      s.tint = [0xffc860, 0xe8a040, 0xfff0c0, 0xc87828][Math.floor(Math.random() * 4)];
    }
    s.position.set(x, y);
    this.addChild(s);
    const g = kind === 'sand' ? 620 : kind === 'puff' ? -60 : kind === 'star' ? 300 : kind === 'tex' ? 700 : kind === 'coin' ? 1150 : 1300;
    const spin = kind === 'coin' ? (6 + Math.random() * 8) * (Math.random() < 0.5 ? -1 : 1) : (Math.random() - 0.5) * 10;
    this.ps.push({ s, kind, vx, vy, life: Math.random() * (kind === 'coin' ? 0.3 : 0), max, spin, g, size: size * this.unit });
    this.scaleOf(this.ps[this.ps.length - 1]);
  }

  private scaleOf(p: P): void {
    const k = p.life / p.max;
    let sc = p.size;
    if (p.kind === 'tex') {
      p.s.scale.set(sc / p.s.texture.width);
      return;
    }
    if (p.kind === 'coin') {
      // spinning on its vertical axis: width follows |cos|, darker when seen edge-on
      const c = Math.cos(p.life * p.spin);
      p.s.scale.set((sc / 128) * Math.max(0.1, Math.abs(c)), sc / 128);
      const v = Math.round(150 + 105 * Math.abs(c));
      p.s.tint = (v << 16) | (v << 8) | v;
      return;
    }
    if (p.kind === 'star') sc *= k < 0.2 ? k / 0.2 : 1 - (k - 0.2) * 0.8;
    if (p.kind === 'puff') sc *= 0.6 + k * 0.8;
    p.s.scale.set(sc / 64);
  }

  /** Blood (or antidote) splash: drops + a few stars. */
  burst(x: number, y: number, n: number, power = 1, cyan = false): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (250 + Math.random() * 650) * power;
      const r = Math.random();
      const kind: Kind = r < 0.62 ? (cyan ? 'cyan' : 'drop') : r < 0.82 ? 'star' : 'spark';
      const size = kind === 'star' ? 34 + Math.random() * 30 : kind === 'spark' ? 18 + Math.random() * 24 : 22 + Math.random() * 26;
      this.add(kind, x, y, Math.cos(a) * v, Math.sin(a) * v - 260 * power, 0.7 + Math.random() * 0.9, size);
    }
  }

  puffs(x: number, y: number, n: number, spread = 60): void {
    for (let i = 0; i < n; i++) {
      this.add('puff', x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.4, (Math.random() - 0.5) * 80, -50 - Math.random() * 60, 0.9 + Math.random() * 0.5, 36 + Math.random() * 26);
    }
  }

  /** Gold coins thrown up from a point. */
  coins(x: number, y: number, n: number, power = 1): void {
    if (!this.tex.coin) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = (500 + Math.random() * 600) * power;
      this.add('coin', x + (Math.random() - 0.5) * 60, y, Math.cos(a) * v, Math.sin(a) * v, 1.3 + Math.random() * 0.6, 34 + Math.random() * 22);
    }
  }

  sparks(x: number, y: number, n: number, power = 0.5): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (200 + Math.random() * 400) * power;
      this.add('spark', x, y, Math.cos(a) * v, Math.sin(a) * v - 120, 0.5 + Math.random() * 0.5, 14 + Math.random() * 20);
    }
  }

  /** Golden sand shaken loose: grains spilling from a line of the given width. */
  sand(x: number, y: number, width: number, n: number, power = 1): void {
    for (let i = 0; i < n; i++) {
      const up = Math.random() < 0.45;
      this.add('sand', x + (Math.random() - 0.5) * width, y, (Math.random() - 0.5) * 170 * power, (up ? -(90 + Math.random() * 260) : Math.random() * 90) * power, 0.5 + Math.random() * 0.8, 7 + Math.random() * 13);
    }
  }

  /** Dust rolling sideways out of a seam. */
  dust(x: number, y: number, width: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.add('puff', x + (Math.random() - 0.5) * width, y + Math.random() * 10, dir * (90 + Math.random() * 200), -(30 + Math.random() * 70), 0.6 + Math.random() * 0.5, 70 + Math.random() * 80);
    }
  }

  private fountainState: { x: number; y: number; rate: number; power: number; acc: number } | null = null;

  /** A big win: a jet of coins from a point, falling back across the screen. */
  startFountain(x: number, y: number, rate: number, power: number): void {
    this.fountainState = { x, y, rate, power, acc: 0 };
  }

  setFountainRate(rate: number): void {
    if (this.fountainState) this.fountainState.rate = rate;
  }

  private rainState: { textures: Texture[]; width: number; rate: number; acc: number } | null = null;

  /** Big-win shower: themed mini symbols tumbling from the top of the screen (the slot "coin rain"). */
  startRain(textures: Texture[], width: number, rate: number): void {
    this.rainState = { textures, width, rate, acc: 0 };
  }

  /** Heavier rain (big-win tiers escalate it). */
  setRainRate(rate: number): void {
    if (this.rainState) this.rainState.rate = rate;
  }

  stopRain(): void {
    this.rainState = null;
    this.fountainState = null;
  }

  update(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    if (this.rainState) {
      const r = this.rainState;
      r.acc += r.rate * this.unit * dt;
      while (r.acc >= 1) {
        r.acc--;
        if (this.tex.coin && Math.random() < 0.88) {
          this.add('coin', Math.random() * r.width, -60, (Math.random() - 0.5) * 80, 150 + Math.random() * 250, 2.6, 44 + Math.random() * 26);
          continue;
        }
        const t = r.textures[Math.floor(Math.random() * r.textures.length)];
        this.add('tex', Math.random() * r.width, -60, (Math.random() - 0.5) * 120, 100 + Math.random() * 200, 2.6, 60 + Math.random() * 50, t);
      }
    }
    const jet = this.fountainState;
    if (jet) {
      jet.acc += jet.rate * dt;
      while (jet.acc >= 1) {
        jet.acc--;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.95;
        const v = (1000 + Math.random() * 620) * jet.power;
        this.add('coin', jet.x + (Math.random() - 0.5) * 120, jet.y, Math.cos(a) * v, Math.sin(a) * v, 2.2 + Math.random() * 0.5, 40 + Math.random() * 44);
      }
    }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life += dt;
      p.vy += p.g * dt;
      const drag = p.kind === 'puff' ? (p.vx > 600 ? 0.995 : 0.94) : 0.995;
      p.vx *= drag;
      p.vy *= p.kind === 'puff' ? drag : 1;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      if (p.kind === 'drop' || p.kind === 'cyan') p.s.rotation = Math.atan2(p.vy, p.vx) - Math.PI / 2;
      else if (p.kind === 'coin') p.s.rotation = p.vx * 0.0006;
      else p.s.rotation += p.spin * dt * (p.kind === 'puff' ? 0.1 : p.kind === 'tex' ? 0.35 : 1);
      this.scaleOf(p);
      const k = p.life / p.max;
      p.s.alpha = p.kind === 'puff' ? Math.max(0, 1 - k) * 0.6 : k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
      if (p.life >= p.max) {
        p.s.destroy();
        this.ps.splice(i, 1);
      }
    }
  }
}
