import { Container, Graphics, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import { BLOOD_METAL, GOLD, IVORY, metalTitle, textMask } from './art/logoArt';
import { paintArrowHead, paintShrineFrame, paintSoftRays } from './art/egyptFrame';
import { Digits } from './Digits';
import gsap from 'gsap';
import { SYMBOLS, Sym } from '../math/config';
import { PREMIUM_EXPANDERS } from '../math/engine';
import type { Audio } from './Audio';
import { COLORS } from './layout';
import { Particles } from './Particles';
import type { SymbolTextures } from './textures';
import { fmt } from '../ui/format';

export const WIN_TIERS = [
  { x: 15, name: 'CONTAMINATION', material: 'gold', ray: 0x3a2408 },
  { x: 40, name: 'ÉPIDÉMIE', material: 'gold', ray: 0x4a2c0a },
  { x: 100, name: 'PANDÉMIE', material: 'gold', ray: 0x5a360c },
  { x: 500, name: 'EXTINCTION', material: 'gold', ray: 0x6a400e },
];

/** Widest a tier title and an amount may be, in overlay units: they stay inside their plates. */
const BIG_TITLE_W = 850;
const AMOUNT_W = 560;

export function winTier(win: number, bet: number): number {
  let t = -1;
  WIN_TIERS.forEach((tier, i) => {
    if (win >= tier.x * bet) t = i;
  });
  return t;
}



const body = (size: number, fill = 0xffffff): TextStyleOptions => ({
  fontFamily: 'Cinzel, serif',
  fontWeight: '900',
  fontSize: size,
  fill,
  stroke: { color: 0x0a0204, width: size * 0.12, join: 'round' },
  dropShadow: { color: 0x000000, blur: size * 0.3, distance: size * 0.05, angle: Math.PI / 2, alpha: 0.9 },
  letterSpacing: size * 0.06,
  align: 'center',
});

export interface FxHooks {
  shake(power: number): void;
  shockwave(): void;
  glitch(power: number): void;
  thump(power: number): void;
  punch(power: number): void;
}

export class Overlays extends Container {
  private dim = new Graphics();
  /** rotating rays live below the particles so the symbol rain falls in front of them */
  private back = new Container();
  private content = new Container();
  private particles: Particles;
  private w = 1920;
  private h = 1080;
  private hudH = 120;
  private skipRequested = false;
  private burstRays: Container | null = null;
  private emberLayer = new Container();
  private headCache = new Map<string, Texture>();

  /** Big 3D title rendered once with the lettering engine and cached. */
  private head3d(text: string, size: number, material = 'gold', maxWidth = 1120): Sprite {
    const key = `${text}|${size}|${material}`;
    let t = this.headCache.get(key);
    if (!t) {
      // cast-metal lettering like the logo, painted at 2x
      const spec = material === 'infection' || material === 'blood' ? BLOOD_METAL : material === 'bone' ? IVORY : GOLD;
      const mask = textMask(text, 'Cinzel, serif', size * 2, size * 0.12, size * 0.5);
      const cracks = spec === BLOOD_METAL ? Math.max(4, Math.round(text.length * 1.4)) : 0;
      t = Texture.from(metalTitle(mask, { ...spec, bevel: size * 0.11 }, { outline: size * 0.11, cracks, seed: text.length * 7 }));
      this.headCache.set(key, t);
    }
    const s = new Sprite(t);
    s.anchor.set(0.5);
    s.scale.set(this.fitScale(t, size, maxWidth));
    return s;
  }

  /** Scale of a title so its letters (not the transparent padding) fit in maxWidth. */
  private fitScale(t: Texture, size: number, maxWidth: number): number {
    const ink = t.width * 0.5 - size * 0.9;
    return Math.min(0.5, 0.5 * (maxWidth / Math.max(1, ink)));
  }

  /** Paint the big titles ahead of time, a frame apart, so nothing hitches when they appear. */
  private warmTitles(): void {
    const jobs: [string, number, string][] = [...WIN_TIERS.map((t) => [t.name, 104, t.material] as [string, number, string]), ['10 TOURS GRATUITS', 88, 'gold']];
    const next = () => {
      const j = jobs.shift();
      if (!j) return;
      this.head3d(...j);
      setTimeout(next, 120);
    };
    setTimeout(next, 1500);
  }

  constructor(
    private tex: SymbolTextures,
    private audio: Audio,
    private fx: FxHooks,
  ) {
    super();
    this.particles = new Particles(tex);
    this.warmTitles();
    this.addChild(this.dim, this.back, this.emberLayer, this.particles, this.content);
    this.visible = false;
    this.eventMode = 'static';
    this.on('pointertap', () => (this.skipRequested = true));
  }

  get busy(): boolean {
    return this.visible;
  }

  skip(): void {
    this.skipRequested = true;
  }

  resize(w: number, h: number, hudH = this.hudH): void {
    this.w = w;
    this.h = h;
    this.hudH = hudH;
    const avail = h - hudH;
    this.content.position.set(w / 2, avail / 2);
    this.content.scale.set(Math.min(w / 1300, avail / 800, 1.2));
    this.back.position.set(w / 2, avail / 2);
    this.back.scale.set(Math.max(w / 1300, h / 1000, 1));
    this.drawDim(this.dim.alpha);
  }

  private drawDim(alpha: number): void {
    this.dim.clear().rect(0, 0, this.w, this.h).fill(0x0a0410);
    this.dim.alpha = alpha;
  }

  update(dtMs: number): void {
    this.particles.update(dtMs);
    this.updateEmbers(dtMs / 1000);
  }

  private clearLayers(): void {
    for (const layer of [this.content, this.back]) {
      layer.removeChildren().forEach((c) => {
        // stop every tween on the node and its descendants (rays and glows loop forever)
        const kill = (n: Container) => {
          gsap.killTweensOf(n);
          gsap.killTweensOf(n.scale);
          for (const ch of n.children) kill(ch as Container);
        };
        kill(c);
        c.destroy({ children: true });
      });
      layer.alpha = 1;
    }
  }

  private open(): void {
    this.clearLayers();
    this.skipRequested = false;
    this.visible = true;
    this.content.alpha = 1;
    this.dim.tint = 0xffffff;
    this.drawDim(0);
    gsap.to(this.dim, { alpha: 0.86, duration: 0.25 });
  }

  private async close(): Promise<void> {
    this.particles.stopFountain();
    this.particles.stopRain();
    this.audio.bigWinStop();
    this.emberOn = false;
    await new Promise<void>((r) =>
      gsap
        .timeline({ onComplete: r })
        .to(this.content.scale, { x: this.content.scale.x * 1.12, y: this.content.scale.y * 1.12, duration: 0.3, ease: 'power2.in' })
        .to([this.content, this.back, this.dim], { alpha: 0, duration: 0.25 }, '<'),
    );
    this.clearLayers();
    this.resize(this.w, this.h);
    this.visible = false;
  }

  private waitOrSkip(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const start = performance.now();
      const loop = () => {
        if (this.skipRequested) {
          this.skipRequested = false;
          resolve(true);
        } else if (performance.now() - start >= ms) resolve(false);
        else requestAnimationFrame(loop);
      };
      loop();
    });
  }

  /** Classic cartoon sunburst: alternating wedges, slowly turning. */
  /**
   * Light composition behind every overlay: soft rays brightest at the centre, a second ray set
   * turning the other way for depth, and a pulsing core glow. Tinted per screen.
   */
  private sunburst(color: number): Container {
    const c = new Container();
    const base = new Sprite(this.raysTex());
    base.anchor.set(0.5);
    base.width = base.height = 2400;
    base.blendMode = 'add';
    base.alpha = 0.16;
    const counter = new Sprite(this.raysTex());
    counter.anchor.set(0.5);
    counter.width = counter.height = 2000;
    counter.blendMode = 'add';
    counter.alpha = 0.07;
    counter.rotation = 0.08;
    const core = new Sprite(this.tex.glow);
    core.anchor.set(0.5);
    core.width = core.height = 900;
    core.blendMode = 'add';
    core.alpha = 0.4;
    c.addChild(base, counter, core);
    const lighten = (col: number, k: number) => {
      const ch = (sh: number) => Math.min(255, Math.round(((col >> sh) & 255) * k + 18));
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    };
    base.tint = counter.tint = lighten(color, 2.1);
    core.tint = lighten(color, 3.4);
    c.alpha = 0;
    gsap.to(c, { alpha: 1, duration: 0.3 });
    gsap.to(base, { rotation: Math.PI * 2, duration: 46, repeat: -1, ease: 'none' });
    gsap.to(counter, { rotation: 0.08 - Math.PI * 2, duration: 70, repeat: -1, ease: 'none' });
    gsap.to(core.scale, { x: core.scale.x * 1.15, y: core.scale.y * 1.15, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.back.addChild(c);
    this.startEmbers();
    return c;
  }

  private retint(c: Container, color: number): void {
    const [base, counter, core] = c.children as Sprite[];
    const lighten = (col: number, k: number) => {
      const ch = (sh: number) => Math.min(255, Math.round(((col >> sh) & 255) * k + 18));
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    };
    base.tint = counter.tint = lighten(color, 2.1);
    core.tint = lighten(color, 3.4);
  }

  private rays: Texture | null = null;
  private raysTex(): Texture {
    this.rays ??= Texture.from(paintSoftRays());
    return this.rays;
  }

  /** Embers drifting up through the overlay while it is open. */
  private embers: { s: Sprite; vy: number; vx: number; life: number; age: number }[] = [];
  private emberOn = false;
  private startEmbers(): void {
    this.emberOn = true;
  }

  private updateEmbers(dt: number): void {
    if (this.emberOn && this.visible && Math.random() < dt * 18) {
      const s = new Sprite(this.tex.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = Math.random() < 0.6 ? 0xff5a2a : 0xffd23f;
      s.width = s.height = 8 + Math.random() * 14;
      s.position.set(Math.random() * this.w, this.h + 10);
      this.emberLayer.addChild(s);
      this.embers.push({ s, vy: -(60 + Math.random() * 120), vx: (Math.random() - 0.5) * 40, life: 3 + Math.random() * 2, age: 0 });
    }
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.age += dt;
      e.s.x += (e.vx + Math.sin(e.age * 3 + i) * 20) * dt;
      e.s.y += e.vy * dt;
      e.s.alpha = Math.min(1, e.age * 2) * Math.max(0, 1 - e.age / e.life);
      if (e.age > e.life) {
        e.s.destroy();
        this.embers.splice(i, 1);
      }
    }
  }


  private shrineTex: Texture | null = null;
  private band: Texture | null = null;
  private bandTex(): Texture {
    if (!this.band) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(128, 32, 4, 128, 32, 128);
      g.addColorStop(0, 'rgba(4,1,2,0.75)');
      g.addColorStop(0.6, 'rgba(4,1,2,0.45)');
      g.addColorStop(1, 'rgba(4,1,2,0)');
      ctx.setTransform(1, 0, 0, 0.25, 0, 24);
      ctx.fillStyle = g;
      ctx.fillRect(0, -96, 256, 256);
      this.band = Texture.from(c);
    }
    return this.band;
  }
  private arrowTex: Texture | null = null;

  /** The winged ruby of the frame, crowning a title: it sits just above the given height. */
  private ribbon(width: number, _height: number, _color: number): Sprite {
    const s = new Sprite(this.tex.crest);
    s.scale.set((width * 0.68) / this.tex.crest.width);
    s.anchor.set(0.5, 1 + 58 / s.height);
    return s;
  }

  /** A pool of darkness that lifts an amount off the screen. */
  private plate(width: number, height: number): Sprite {
    const s = new Sprite(this.bandTex());
    s.anchor.set(0.5);
    s.width = width * 1.5;
    s.height = height * 1.7;
    return s;
  }

  private popIn(o: Container, delay = 0, from = 0.2): void {
    const sx = o.scale.x;
    const sy = o.scale.y;
    gsap.fromTo(o.scale, { x: sx * Math.max(from, 1.5), y: sy * Math.max(from, 1.5) }, { x: sx, y: sy, duration: 0.32, delay, ease: 'power3.in' });
    gsap.fromTo(o, { alpha: 0 }, { alpha: 1, duration: 0.2, delay });
  }

  /** A soft bloom of gold opening from a point of the content layer. */
  private bloom(y: number, tint: number, size = 1400): void {
    const r = new Sprite(this.tex.glow);
    r.anchor.set(0.5);
    r.y = y;
    r.blendMode = 'add';
    r.tint = tint;
    this.content.addChildAt(r, 0);
    gsap.fromTo(r, { width: size * 0.3, height: size * 0.3, alpha: 0.9 }, { width: size, height: size, alpha: 0, duration: 0.9, ease: 'power2.out', onComplete: () => r.destroy() });
  }

  /** A title strikes: gold flies off it along its whole width. */
  private titleHit(y: number, width = 900): void {
    const k = this.content.scale.y;
    const sy = this.content.y + y * k;
    this.particles.sand(this.w / 2, sy, width * k, 110, 2.4);
    this.particles.sparks(this.w / 2, sy, 26, 1.4);
    this.bloom(y, 0xffc860, 1500);
  }

  /** A blade of light crossing a title, masked by its letters. */
  private titleSweep(title: Sprite): void {
    const mask = new Sprite(title.texture);
    mask.anchor.set(0.5);
    mask.scale.copyFrom(title.scale);
    mask.position.copyFrom(title.position);
    const blade = new Sprite(this.tex.shine);
    blade.anchor.set(0.5);
    blade.height = 340;
    blade.width = 150;
    blade.rotation = 0.35;
    blade.blendMode = 'add';
    blade.position.y = title.y;
    blade.mask = mask;
    this.content.addChild(mask, blade);
    gsap.fromTo(blade, { x: -700 }, { x: 700, duration: 0.8, ease: 'power1.inOut', onComplete: () => { blade.destroy(); mask.destroy(); } });
  }

  /** Tiered big-win celebration: each tier is a heavier blow; the amount never leaves its cartouche. */
  async bigWin(win: number, bet: number, onTick?: (v: number) => void): Promise<void> {
    const top = winTier(win, bet);
    if (top < 0) return;
    this.open();
    const t0 = WIN_TIERS[0];
    const rays = this.sunburst(t0.ray);
    this.burstRays = rays;
    const ribbon = this.ribbon(1040, 150, 0x1e0a08);
    ribbon.y = -100;
    const heading = this.head3d(t0.name, 104, t0.material, BIG_TITLE_W);
    heading.y = -100;
    const plate = this.plate(760, 190);
    plate.y = 100;
    const amount = new Digits(118);
    amount.value = 0;
    amount.y = 100;
    const low = new Sprite(this.tex.crestLow);
    low.anchor.set(0.5);
    low.scale.set(0.82);
    low.y = 255;
    const sub = new Text({ text: 'TOUCHEZ POUR PASSER', style: body(18, 0xd8b878) });
    sub.anchor.set(0.5);
    sub.y = 340;
    gsap.to(sub, { alpha: 0.45, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.content.addChild(plate, ribbon, heading, amount, low, sub);
    this.popIn(ribbon, 0.06);
    this.popIn(heading, 0.1);
    this.popIn(amount, 0.2);
    this.popIn(low, 0.26);
    this.audio.bigWinStart();
    gsap.delayedCall(0.42, () => {
      if (!this.visible || heading.destroyed) return;
      this.audio.tierUp(0);
      this.fx.shockwave();
      this.fx.shake(10);
      this.fx.thump(0.35);
      this.fx.punch(1);
      this.titleHit(-100);
      this.titleSweep(heading);
    });
    this.particles.startFountain(this.w * 0.14, this.h * 0.86, 16);
    this.particles.startFountain2(this.w * 0.86, this.h * 0.86, 16);
    this.particles.startRain([this.tex.coin], this.w, 12);

    const duration = 2.1 * (top + 1);
    this.audio.timpaniRoll(duration);
    const counter = { v: 0 };
    let tier = 0;
    let lastTick = 0;
    const tween = gsap.to(counter, {
      v: win,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        amount.value = counter.v;
        amount.scale.set(Math.min(1, AMOUNT_W / Math.max(1, amount.inkWidth)));
        onTick?.(counter.v);
        const now = performance.now();
        if (now - lastTick > 70) {
          this.audio.tick(counter.v / win);
          lastTick = now;
        }
        const t = winTier(counter.v, bet);
        if (t > tier) {
          tier = t;
          this.upgrade(heading, tier);
        }
      },
    });
    const done = new Promise<void>((r) => tween.eventCallback('onComplete', () => r()));
    await Promise.race([done, this.waitOrSkip(duration * 1000 + 50)]);
    if (tween.isActive()) {
      tween.progress(1);
      if (tier < top) this.upgrade(heading, top);
    }
    const k = amount.scale.x;
    gsap.fromTo(amount.scale, { x: k * 1.3, y: k * 1.3 }, { x: k, y: k, duration: 0.3, ease: 'power3.in' });
    gsap.delayedCall(0.3, () => {
      if (!this.visible || heading.destroyed) return;
      this.bloom(120, 0xfff0c0, 1700);
      this.fx.shake(14);
      this.fx.thump(0.5);
      this.titleSweep(heading);
    });
    this.audio.bigWinEnd(top);
    await this.waitOrSkip(2400);
    await this.close();
  }

  private upgrade(heading: Sprite, tier: number): void {
    const t = WIN_TIERS[tier];
    const tex = this.head3d(t.name, 104, t.material, BIG_TITLE_W);
    heading.texture = tex.texture;
    const k = tex.scale.x;
    gsap.killTweensOf(heading.scale);
    gsap.fromTo(heading.scale, { x: k * 1.7, y: k * 1.7 }, { x: k, y: k, duration: 0.24, ease: 'power3.in' });
    if (this.burstRays) this.retint(this.burstRays, t.ray);
    this.audio.tierUp(tier);
    gsap.delayedCall(0.22, () => {
      if (!this.visible || heading.destroyed) return;
      this.fx.shockwave();
      this.fx.shake(10 + tier * 6);
      this.fx.glitch(1 + tier);
      this.fx.thump(0.3 + tier * 0.1);
      this.fx.punch(1 + tier * 0.3);
      this.titleHit(-100, 900 + tier * 60);
      this.titleSweep(heading);
    });
    this.particles.setRainRate(12 + tier * 10);
  }

  /** Cartoon slot-window roulette that lands on the chosen strain. */
  /**
   * The strain draw as a carousel: the premium symbols race sideways through a gold reliquary,
   * scaled and dimmed with their distance from it, decelerate, and lock onto the strain with a
   * flash and a shockwave.
   */
  private async roulette(y: number, final: Sym, exclude: Sym[] = []): Promise<void> {
    const pool = PREMIUM_EXPANDERS.filter((s) => s === final || !exclude.includes(s));
    const box = new Container();
    box.y = y;
    const aura = new Sprite(this.tex.glow);
    aura.anchor.set(0.5);
    aura.width = aura.height = 620;
    aura.tint = COLORS.infection;
    aura.blendMode = 'add';
    aura.alpha = 0.45;
    gsap.to(aura.scale, { x: aura.scale.x * 1.1, y: aura.scale.y * 1.1, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    // a dark band the carousel runs along
    const band = new Sprite(this.bandTex());
    band.anchor.set(0.5);
    band.width = 1600;
    band.height = 300;
    this.shrineTex ??= Texture.from(paintShrineFrame(300, 290));
    const frame = new Sprite(this.shrineTex);
    frame.anchor.set(0.5);
    frame.scale.set(0.5);
    frame.y = -5;
    this.arrowTex ??= Texture.from(paintArrowHead());
    const arrowL = new Sprite(this.arrowTex);
    const arrowR = new Sprite(this.arrowTex);
    for (const [a, d] of [[arrowL, -1], [arrowR, 1]] as const) {
      a.anchor.set(0.5);
      a.scale.set(-0.5 * d, 0.5);
      a.position.set(d * 186, -6);
    }
    const strip = new Container();
    const spacing = 250;
    const count = pool.length * 6;
    const items: Sprite[] = [];
    const startIndex = Math.floor(Math.random() * pool.length);
    for (let k = 0; k < count; k++) {
      const sp = new Sprite(this.tex.normal[pool[(startIndex + k) % pool.length]]);
      sp.anchor.set(0.5);
      items.push(sp);
      strip.addChild(sp);
    }
    // land on a copy of the final symbol in the last third of the strip
    let target = count - 1;
    for (let k = count - pool.length * 2; k < count - pool.length; k++) if (pool[(startIndex + k) % pool.length] === final) target = k;
    const flash = new Sprite(this.tex.glow);
    flash.anchor.set(0.5);
    flash.blendMode = 'add';
    flash.alpha = 0;
    box.addChild(aura, band, frame, strip, arrowL, arrowR, flash);
    box.y = y - 6;
    this.content.addChild(box);
    gsap.fromTo(box, { alpha: 0 }, { alpha: 1, duration: 0.3 });
    this.popIn(frame, 0, 0.4);

    const state = { off: 0 };
    let lastIdx = -1;
    const layout = () => {
      for (let k = 0; k < count; k++) {
        const sp = items[k];
        const d = k * spacing - state.off;
        const ad = Math.abs(d);
        const near = Math.max(0, 1 - ad / 760);
        sp.visible = ad < 900;
        sp.x = d * (0.85 + near * 0.15);
        const size = 120 + 110 * Math.pow(near, 2);
        sp.width = sp.height = size;
        sp.alpha = Math.min(1, near * 1.6);
        const v = Math.round(90 + 165 * Math.pow(near, 3));
        sp.tint = (v << 16) | (v << 8) | v;
      }
      const idx = Math.round(state.off / spacing);
      if (idx !== lastIdx) {
        lastIdx = idx;
        this.audio.tick(Math.min(1, state.off / (target * spacing)));
        gsap.fromTo(frame.scale, { x: 0.505, y: 0.505 }, { x: 0.5, y: 0.5, duration: 0.12 });
        for (const ar of [arrowL, arrowR]) gsap.fromTo(ar, { alpha: 1 }, { alpha: 0.55, duration: 0.15 });
      }
    };
    layout();
    await new Promise<void>((resolve) => {
      this.audio.riser(3.1, 0.8);
      gsap.to(state, { off: target * spacing, duration: 3.4, ease: 'power4.out', onUpdate: layout, onComplete: resolve });
      const skipWatch = () => {
        if (this.skipRequested) {
          this.skipRequested = false;
          gsap.killTweensOf(state);
          state.off = target * spacing;
          layout();
          resolve();
        } else if (gsap.isTweening(state)) requestAnimationFrame(skipWatch);
      };
      requestAnimationFrame(skipWatch);
    });
    // lock: everything else falls away, the strain blazes
    const chosen = items[target];
    for (const sp of items) if (sp !== chosen) gsap.to(sp, { alpha: 0, duration: 0.35 });
    this.audio.impact(1.2);
    this.audio.codex(4);
    this.fx.shockwave();
    this.fx.thump(0.45);
    this.fx.shake(14);
    gsap.fromTo(flash, { alpha: 1, width: 200, height: 200 }, { alpha: 0, width: 900, height: 900, duration: 0.6, ease: 'power2.out' });
    gsap.fromTo(chosen, { width: 330, height: 330 }, { width: 240, height: 240, duration: 0.7, ease: 'power3.out' });
    gsap.fromTo(frame.scale, { x: 0.54, y: 0.54 }, { x: 0.5, y: 0.5, duration: 0.4, ease: 'power3.out' });
    gsap.to(aura, { alpha: 0.85, duration: 0.2 });
    gsap.to(band, { alpha: 0, duration: 0.4 });
    const sc = this.content.scale.y;
    this.particles.impact(this.w / 2, this.h / 2 + y * sc, 1.4);
    this.particles.burst(this.w / 2, this.h / 2 + y * sc, 40, 0.9);
  }

  private doorTex: Texture | null = null;

  /** One doorway of the pyramid's inner corridor: carved stone frame, glyph bands, gold lintel. */
  private door(): Texture {
    if (this.doorTex) return this.doorTex;
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    const outer = new Path2D();
    outer.rect(0, 0, S, S);
    const hole = new Path2D();
    hole.moveTo(S * 0.3, S * 0.86);
    hole.lineTo(S * 0.34, S * 0.2);
    hole.lineTo(S * 0.66, S * 0.2);
    hole.lineTo(S * 0.7, S * 0.86);
    hole.closePath();
    outer.addPath(hole);
    // stone wall around the opening
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
    g.addColorStop(0, '#5a3a24');
    g.addColorStop(1, '#120806');
    x.fillStyle = g;
    x.fill(outer, 'evenodd');
    x.save();
    x.clip(outer, 'evenodd');
    // stone courses
    x.strokeStyle = 'rgba(0,0,0,0.45)';
    x.lineWidth = 3;
    for (let y = 0; y < S; y += 38) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(S, y);
      x.stroke();
      for (let k = (y / 38) % 2 ? 0 : 40; k < S; k += 80) {
        x.beginPath();
        x.moveTo(k, y);
        x.lineTo(k, y + 38);
        x.stroke();
      }
    }
    // glyph columns either side of the door, lit gold
    x.strokeStyle = '#f2c25a';
    x.fillStyle = '#f2c25a';
    x.lineWidth = 4;
    x.lineCap = 'round';
    for (const cx of [S * 0.24, S * 0.76]) {
      for (let y = S * 0.26; y < S * 0.82; y += 46) {
        const k = Math.floor(((cx + y) * 7) % 4);
        x.beginPath();
        if (k === 0) {
          x.ellipse(cx, y - 8, 7, 9, 0, 0, Math.PI * 2);
          x.moveTo(cx - 11, y + 2);
          x.lineTo(cx + 11, y + 2);
          x.moveTo(cx, y);
          x.lineTo(cx, y + 18);
        } else if (k === 1) {
          x.moveTo(cx - 14, y);
          x.quadraticCurveTo(cx, y - 12, cx + 14, y);
          x.quadraticCurveTo(cx, y + 9, cx - 14, y);
          x.moveTo(cx + 3, y);
          x.arc(cx, y, 3, 0, Math.PI * 2);
        } else if (k === 2) {
          x.arc(cx, y, 9, 0, Math.PI * 2);
        } else {
          x.moveTo(cx, y + 14);
          x.quadraticCurveTo(cx - 9, y - 2, cx + 2, y - 14);
          x.quadraticCurveTo(cx + 7, y, cx, y + 14);
        }
        x.stroke();
      }
    }
    // gold lintel over the door
    const lg = x.createLinearGradient(0, S * 0.12, 0, S * 0.2);
    lg.addColorStop(0, '#fff1b8');
    lg.addColorStop(0.5, '#c98a24');
    lg.addColorStop(1, '#5a3006');
    x.fillStyle = lg;
    x.fillRect(S * 0.28, S * 0.13, S * 0.44, S * 0.07);
    x.restore();
    // edge glow of the opening
    x.strokeStyle = 'rgba(255,120,60,0.6)';
    x.lineWidth = 3;
    x.stroke(hole);
    // the wall fades into darkness toward the edges: nested doors read as one endless corridor
    x.globalCompositeOperation = 'destination-in';
    const fade = x.createRadialGradient(S / 2, S * 0.52, S * 0.22, S / 2, S * 0.52, S * 0.5);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = fade;
    x.fillRect(0, 0, S, S);
    this.doorTex = Texture.from(c);
    return this.doorTex;
  }

  /**
   * Inside the pyramid: doorways rush toward the camera down a torch-lit corridor toward a red
   * glow that grows until it swallows the screen.
   */
  async corridor(duration = 2.2): Promise<void> {
    this.open();
    gsap.killTweensOf(this.dim);
    this.drawDim(1);
    this.dim.tint = 0x050102;
    const layer = new Container();
    this.back.addChild(layer);
    const core = new Sprite(this.tex.glow);
    core.anchor.set(0.5);
    core.blendMode = 'add';
    core.tint = 0xff3a1a;
    layer.addChild(core);
    const doors: { s: Sprite; z: number }[] = [];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const s = new Sprite(this.door());
      s.anchor.set(0.5);
      layer.addChildAt(s, 0);
      doors.push({ s, z: 1 + (i / N) * 8 });
    }
    const torches: { s: Sprite; z: number; side: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const s = new Sprite(this.tex.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = i % 3 ? 0xff8a30 : 0xffc060;
      layer.addChild(s);
      torches.push({ s, z: 1 + (i / 12) * 8, side: i % 2 ? 1 : -1 });
    }
    this.audio.riser(duration, 1);
    const st = { t: 0 };
    await new Promise<void>((resolve) => {
      gsap.to(st, {
        t: 1,
        duration,
        ease: 'none',
        onUpdate: () => {
          const speed = 2.5 + st.t * 9;
          const dt = 1 / 60;
          for (const d of doors) {
            d.z -= dt * speed;
            if (d.z < 0.25) d.z += 8;
            const k = 1 / d.z;
            d.s.scale.set(k * 4.2);
            const v = Math.round(Math.min(255, 60 + 195 * Math.min(1, k * 1.2)));
            d.s.tint = (v << 16) | (Math.round(v * 0.75) << 8) | Math.round(v * 0.55);
            d.s.alpha = Math.min(1, (8 - d.z) * 0.6);
          }
          doors.sort((a, b) => b.z - a.z).forEach((d, i) => layer.setChildIndex(d.s, i));
          for (const tch of torches) {
            tch.z -= dt * speed;
            if (tch.z < 0.25) tch.z += 8;
            const k = 1 / tch.z;
            tch.s.position.set(tch.side * 470 * k, 150 * k);
            tch.s.width = tch.s.height = 140 * k;
            tch.s.alpha = Math.min(1, (8 - tch.z) * 0.4) * (0.8 + Math.random() * 0.2);
          }
          core.width = core.height = 160 + Math.pow(st.t, 3) * 3000;
          core.alpha = 0.45 + st.t * 0.55;
          core.tint = st.t > 0.85 ? 0xffd0b0 : 0xff3a1a;
          layer.y = Math.sin(st.t * 40) * 3 * st.t;
        },
        onComplete: resolve,
      });
    });
    this.fx.shake(14);
    this.fx.thump(0.8);
    this.audio.impact(1.3);
    // the wall of sand that follows us out of the corridor
    this.particles.storm(this.w, this.h, 46);
    layer.destroy({ children: true });
  }

  async featureIntro(special: Sym, spins: number, fromCorridor = false): Promise<void> {
    if (!fromCorridor) this.open();
    else {
      // we arrive inside: the white-red flash fades to the chamber
      this.content.alpha = 1;
      this.dim.tint = 0xffffff;
      gsap.fromTo(this.dim, { alpha: 1 }, { alpha: 0.86, duration: 0.6 });
    }
    this.audio.featureStart();
    this.fx.shake(16);
    this.fx.glitch(3);
    this.sunburst(0x46060c);
    // the pyramid rises out of a pillar of light
    const pillar = new Sprite(this.tex.glow);
    pillar.anchor.set(0.5);
    pillar.blendMode = 'add';
    pillar.tint = 0xff4a30;
    pillar.width = 260;
    pillar.height = 1400;
    pillar.alpha = 0;
    const ring = new Sprite(this.tex.glow);
    ring.anchor.set(0.5);
    ring.blendMode = 'add';
    ring.tint = 0xffc870;
    const pyr = new Sprite(this.tex.normal[Sym.CODEX]);
    pyr.anchor.set(0.5);
    pyr.width = pyr.height = 420;
    pyr.y = 30;
    const head = this.head3d(`${spins} TOURS GRATUITS`, 88, 'gold', 1000);
    head.y = -330;
    this.content.addChild(pillar, ring, pyr, head);
    gsap.fromTo(pillar, { alpha: 0, width: 40 }, { alpha: 0.9, width: 300, duration: 0.35, ease: 'power2.out' });
    gsap.to(pillar, { alpha: 0, duration: 0.8, delay: 0.6 });
    gsap.fromTo(pyr, { y: 500, alpha: 0 }, { y: 30, alpha: 1, duration: 0.55, ease: 'power3.out', delay: 0.15 });
    const ps = pyr.scale.x;
    gsap.fromTo(pyr.scale, { x: ps * 0.4, y: ps * 0.4 }, { x: ps, y: ps, duration: 0.55, ease: 'back.out(1.6)', delay: 0.15 });
    // a player may skip this screen at any moment: nothing delayed may touch what is gone
    gsap.delayedCall(0.7, () => {
      if (ring.destroyed) return;
      this.fx.shake(20);
      this.fx.shockwave();
      this.particles.impact(this.w / 2, this.h / 2, 1.8);
      gsap.fromTo(ring, { alpha: 1, width: 100, height: 100 }, { alpha: 0, width: 1100, height: 1100, duration: 0.8, ease: 'power2.out' });
    });
    // the title slams in
    head.alpha = 0;
    gsap.delayedCall(0.75, () => {
      if (head.destroyed) return;
      head.alpha = 1;
      const k = head.scale.x;
      gsap.fromTo(head.scale, { x: k * 2.6, y: k * 2.6 }, {
        x: k,
        y: k,
        duration: 0.35,
        ease: 'power3.in',
        onComplete: () => {
          if (head.destroyed) return;
          this.fx.shake(18);
          this.fx.punch(1.4);
          this.titleHit(head.y, 1000);
          this.titleSweep(head);
        },
      });
    });
    gsap.to(pyr, { rotation: 0.04, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.7 });
    await this.waitOrSkip(1900);

    // the pyramid rises above the reliquary and pours its light into it
    gsap.to(pyr, { y: -175, duration: 0.5, ease: 'power2.inOut' });
    gsap.to(pyr.scale, { x: ps * 0.42, y: ps * 0.42, duration: 0.5, ease: 'power2.inOut' });
    const beam = new Sprite(this.tex.glow);
    beam.anchor.set(0.5, 0);
    beam.blendMode = 'add';
    beam.tint = 0xff3a24;
    beam.position.set(0, -150);
    beam.width = 90;
    beam.height = 0;
    this.content.addChildAt(beam, this.content.getChildIndex(pyr));
    gsap.to(beam, { height: 220, alpha: 0.8, duration: 0.5, delay: 0.3 });
    await this.waitOrSkip(450);
    const caption = new Text({ text: 'LA PYRAMIDE CHOISIT UNE SOUCHE…', style: body(30, 0xffb0a0) });
    caption.anchor.set(0.5);
    caption.y = 210;
    this.content.addChild(caption);
    gsap.fromTo(caption, { alpha: 0 }, { alpha: 1, duration: 0.4 });
    gsap.to(caption, { alpha: 0.5, duration: 0.6, yoyo: true, repeat: -1, delay: 0.4 });
    await this.roulette(40, special);
    gsap.killTweensOf(caption);
    caption.destroy();
    gsap.to(beam, { alpha: 0, duration: 0.4 });
    const strain = this.head3d(`SOUCHE : ${SYMBOLS[special].name.toUpperCase()}`, 54, 'blood', 1000);
    strain.y = 236;
    this.content.addChild(strain);
    this.popIn(strain);
    const rule = new Text({ text: 'ELLE ENVAHIT TOUT LE ROULEAU ET PAIE SUR LES 10 LIGNES', style: body(22, 0xe8d8c0) });
    rule.anchor.set(0.5);
    rule.y = 298;
    const go = new Text({ text: 'TOUCHEZ POUR COMMENCER', style: body(26, 0xffd27a) });
    go.anchor.set(0.5);
    go.y = 352;
    gsap.to(go, { alpha: 0.4, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.content.addChild(rule, go);
    gsap.fromTo([rule, go], { alpha: 0 }, { alpha: 1, duration: 0.5, delay: 0.3 });
    await this.waitOrSkip(4500);
    await this.close();
  }

  async retrigger(spins: number, mutation: Sym | null, active: Sym[]): Promise<void> {
    this.open();
    this.audio.stinger(1);
    this.fx.shake(14);
    this.fx.glitch(2);
    this.sunburst(0x3e1806);
    const ribbon = this.ribbon(1120, 150, 0x8a0f26);
    ribbon.y = mutation !== null ? -248 : -20;
    const head = this.head3d(`+${spins} TOURS GRATUITS`, 84, 'gold', 940);
    head.y = ribbon.y - 10;
    this.content.addChild(ribbon, head);
    this.popIn(ribbon);
    this.popIn(head, 0.05);
    this.particles.impact(this.w / 2, this.h / 2, 1.4);
    if (mutation !== null) {
      const sub = new Text({ text: 'MUTATION ! UNE NOUVELLE SOUCHE', style: body(30, 0xff8a70) });
      sub.anchor.set(0.5);
      sub.y = -150;
      this.content.addChild(sub);
      this.popIn(sub, 0.2);
      await this.roulette(50, mutation, active);
      const name = this.head3d(SYMBOLS[mutation].name.toUpperCase(), 56, 'blood');
      name.y = 240;
      this.content.addChild(name);
      this.popIn(name);
    }
    await this.waitOrSkip(2600);
    await this.close();
  }

  async featureOutro(total: number, spins: number, bet: number, onTick?: (v: number) => void): Promise<void> {
    this.open();
    this.audio.stinger(1);
    this.sunburst(0x3a2408);
    const ribbon = this.ribbon(900, 150, 0x1e0a08);
    ribbon.y = -200;
    const head = this.head3d('INFECTION TERMINÉE', 80, 'bone', 740);
    head.y = -210;
    const plate = this.plate(620, 180);
    plate.y = 20;
    const amount = new Digits(114);
    amount.value = 0;
    amount.y = 20;
    const sub = new Text({ text: `${spins} tours gratuits · ${fmt(total / bet)}× la mise`, style: body(32, 0xe8dcf0) });
    sub.anchor.set(0.5);
    sub.y = 170;
    this.content.addChild(ribbon, head, plate, amount, sub);
    this.popIn(ribbon);
    this.popIn(head, 0.05);
    this.popIn(plate, 0.15);
    this.popIn(amount, 0.2);
    if (total > 0) {
      this.particles.startFountain(this.w / 2, this.h * 0.7, 30);
      this.audio.coins(20);
    }
    const counter = { v: 0 };
    const tween = gsap.to(counter, {
      v: total,
      duration: Math.min(4, 1 + total / bet / 40),
      ease: 'power2.out',
      onUpdate: () => {
        amount.value = counter.v;
        amount.scale.set(Math.min(1, AMOUNT_W / Math.max(1, amount.inkWidth)));
        onTick?.(counter.v);
      },
    });
    await Promise.race([new Promise<void>((r) => tween.eventCallback('onComplete', () => r())), this.waitOrSkip(5000)]);
    tween.progress(1);
    this.audio.bigWinEnd(1);
    await this.waitOrSkip(2600);
    await this.close();
  }

  async message(text: string, ms = 1600): Promise<void> {
    this.open();
    const ribbon = this.ribbon(900, 150, 0x1e0a08);
    const t = this.head3d(text, 62, 'bone', 740);
    t.y = -8;
    this.content.addChild(ribbon, t);
    this.popIn(ribbon);
    this.popIn(t, 0.05);
    await this.waitOrSkip(ms);
    await this.close();
  }
}
