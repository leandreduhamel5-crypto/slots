import { Container, Sprite, type Texture } from 'pixi.js';

export interface ParticleTextures {
  drop: Texture;
  dropCyan: Texture;
  star: Texture;
  puff: Texture;
  spore: Texture;
  /** gold coin (128 px), optional */
  coin?: Texture;
}

type Kind = 'drop' | 'cyan' | 'star' | 'puff' | 'spark' | 'tex' | 'coin';

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
  private fountain: { x: number; y: number; rate: number; acc: number } | null = null;

  constructor(private tex: ParticleTextures) {
    super();
  }

  private add(kind: Kind, x: number, y: number, vx: number, vy: number, max: number, size: number, custom?: Texture): void {
    const byKind: Record<Kind, Texture> = {
      drop: this.tex.drop,
      cyan: this.tex.dropCyan,
      star: this.tex.star,
      puff: this.tex.puff,
      spark: this.tex.spore,
      tex: this.tex.spore,
      coin: this.tex.coin ?? this.tex.spore,
    };
    const t = custom ?? byKind[kind];
    const s = new Sprite(t);
    s.anchor.set(0.5, kind === 'drop' || kind === 'cyan' ? 0.65 : 0.5);
    if (kind === 'puff') s.tint = 0xd8bc94; // desert dust
    if (kind === 'star') s.blendMode = 'add';
    if (kind === 'spark') {
      s.blendMode = 'add';
      s.tint = Math.random() < 0.5 ? 0xff3347 : 0xffd23f;
    }
    s.position.set(x, y);
    this.addChild(s);
    const g = kind === 'puff' ? -60 : kind === 'star' ? 300 : kind === 'tex' ? 700 : kind === 'coin' ? 1150 : 1300;
    const spin = kind === 'coin' ? (6 + Math.random() * 8) * (Math.random() < 0.5 ? -1 : 1) : (Math.random() - 0.5) * 10;
    this.ps.push({ s, kind, vx, vy, life: Math.random() * (kind === 'coin' ? 0.3 : 0), max, spin, g, size });
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

  /** Comic impact: a ring of stars and smoke. */
  impact(x: number, y: number, power = 1, puffs = 4): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const v = 380 * power;
      this.add('star', x, y, Math.cos(a) * v, Math.sin(a) * v, 0.55, 44);
    }
    for (let i = 0; i < puffs; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 160 * power;
      this.add('puff', x + Math.cos(a) * 30, y + Math.sin(a) * 30, Math.cos(a) * v, Math.sin(a) * v, 0.7, 50 + Math.random() * 30);
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

  private rainState: { textures: Texture[]; width: number; rate: number; acc: number } | null = null;

  /** Big-win shower: themed mini symbols tumbling from the top of the screen (the slot "coin rain"). */
  startRain(textures: Texture[], width: number, rate: number): void {
    this.rainState = { textures, width, rate, acc: 0 };
  }

  stopRain(): void {
    this.rainState = null;
  }

  startFountain(x: number, y: number, rate: number): void {
    this.fountain = { x, y, rate, acc: 0 };
  }

  stopFountain(): void {
    this.fountain = null;
  }

  update(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    if (this.fountain) {
      const f = this.fountain;
      f.acc += f.rate * dt;
      while (f.acc >= 1) {
        f.acc--;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const v = 800 + Math.random() * 700;
        const r = Math.random();
        const kind: Kind = this.tex.coin ? (r < 0.7 ? 'coin' : r < 0.85 ? 'drop' : 'spark') : r < 0.55 ? 'drop' : r < 0.75 ? 'cyan' : 'star';
        const size = kind === 'coin' ? 40 + Math.random() * 24 : kind === 'star' ? 50 : 34 + Math.random() * 20;
        this.add(kind, f.x + (Math.random() - 0.5) * 80, f.y, Math.cos(a) * v, Math.sin(a) * v, 1.5 + Math.random(), size);
      }
    }
    if (this.rainState) {
      const r = this.rainState;
      r.acc += r.rate * dt;
      while (r.acc >= 1) {
        r.acc--;
        if (this.tex.coin && Math.random() < 0.55) {
          this.add('coin', Math.random() * r.width, -60, (Math.random() - 0.5) * 80, 150 + Math.random() * 250, 2.6, 44 + Math.random() * 26);
          continue;
        }
        const t = r.textures[Math.floor(Math.random() * r.textures.length)];
        this.add('tex', Math.random() * r.width, -60, (Math.random() - 0.5) * 120, 100 + Math.random() * 200, 2.6, 60 + Math.random() * 50, t);
      }
    }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life += dt;
      p.vy += p.g * dt;
      const drag = p.kind === 'puff' ? 0.94 : 0.995;
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
