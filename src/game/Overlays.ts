import { Container, FillGradient, Graphics, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import gsap from 'gsap';
import { SYMBOLS, Sym } from '../math/config';
import { PREMIUM_EXPANDERS } from '../math/engine';
import type { Audio } from './Audio';
import { COLORS } from './layout';
import { Particles } from './Particles';
import type { SymbolTextures } from './textures';
import { fmt } from '../ui/format';

export const WIN_TIERS = [
  { x: 15, name: 'CONTAMINATION', colors: ['#fffaf0', '#e9dfc9', '#8a7650'], glow: 0xff2a3d },
  { x: 40, name: 'ÉPIDÉMIE', colors: ['#fff0c0', '#ffa04a', '#8b2a00'], glow: 0xff7a3a },
  { x: 100, name: 'PANDÉMIE', colors: ['#ffd0d6', '#ff2a3d', '#5a0010'], glow: 0xff2a3d },
  { x: 500, name: 'EXTINCTION', colors: ['#fbefff', '#d79bff', '#7a2aa8'], glow: 0xc06bff },
];

function gradient(colors: string[]): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: colors.map((color, i) => ({ offset: i / (colors.length - 1), color })),
    textureSpace: 'local',
  });
}

export function winTier(win: number, bet: number): number {
  let t = -1;
  WIN_TIERS.forEach((tier, i) => {
    if (win >= tier.x * bet) t = i;
  });
  return t;
}

const title = (size: number, fill: string | number | FillGradient = gradient(['#fffaf0', '#e9dfc9', '#8a7650'])): TextStyleOptions => ({
  fontFamily: 'Cinzel, serif',
  fontWeight: '900',
  fontSize: size,
  fill,
  stroke: { color: 0x050304, width: Math.max(6, size / 9), join: 'round' },
  dropShadow: { color: COLORS.infection, blur: size / 4, distance: 0, alpha: 1 },
  letterSpacing: size / 14,
  align: 'center',
});

const amountStyle = (size: number): TextStyleOptions => ({
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: '700',
  fontSize: size,
  fill: 0xffd27a,
  stroke: { color: 0x2a0005, width: size / 10, join: 'round' },
  dropShadow: { color: 0xff5a3a, blur: size / 5, distance: 0, alpha: 1 },
});

export interface FxHooks {
  shake(power: number): void;
  shockwave(): void;
  glitch(power: number): void;
  thump(power: number): void;
}

export class Overlays extends Container {
  private dim = new Graphics();
  private content = new Container();
  private particles: Particles;
  private w = 1920;
  private h = 1080;
  private skipRequested = false;

  constructor(
    private tex: SymbolTextures,
    private audio: Audio,
    private fx: FxHooks,
  ) {
    super();
    this.particles = new Particles(tex.spore);
    this.addChild(this.dim, this.particles, this.content);
    this.visible = false;
    this.eventMode = 'static';
    this.on('pointertap', () => (this.skipRequested = true));
  }

  get busy(): boolean {
    return this.visible;
  }

  /** Lets keyboard / HUD skip the current overlay step. */
  skip(): void {
    this.skipRequested = true;
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.content.position.set(w / 2, h / 2);
    this.content.scale.set(Math.min(w / 1400, h / 1000, 1.2));
    this.drawDim(this.dim.alpha || 0.78);
  }

  private drawDim(alpha: number): void {
    this.dim.clear().rect(0, 0, this.w, this.h).fill({ color: 0x030304, alpha: 1 });
    this.dim.alpha = alpha;
  }

  update(dtMs: number): void {
    this.particles.update(dtMs);
  }

  private open(): void {
    this.content.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.skipRequested = false;
    this.visible = true;
    this.drawDim(0);
    gsap.to(this.dim, { alpha: 0.86, duration: 0.3 });
  }

  private async close(): Promise<void> {
    this.particles.stopFountain();
    await new Promise<void>((r) => gsap.to([this.content, this.dim], { alpha: 0, duration: 0.35, onComplete: r }));
    this.content.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.content.alpha = 1;
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

  private rays(color: number): Graphics {
    const g = new Graphics();
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + (Math.PI / n) * 0.7;
      g.moveTo(0, 0).lineTo(Math.cos(a0) * 900, Math.sin(a0) * 900).lineTo(Math.cos(a1) * 900, Math.sin(a1) * 900).closePath();
    }
    g.fill({ color, alpha: 0.12 });
    g.blendMode = 'add';
    gsap.to(g, { rotation: Math.PI * 2, duration: 40, repeat: -1, ease: 'none' });
    return g;
  }

  /** Slowly turning ritual circle, echoing the one engraved on the Codex. */
  private runeRing(radius: number, color: number): Graphics {
    const g = new Graphics();
    g.circle(0, 0, radius).stroke({ width: 3, color, alpha: 0.55 });
    g.circle(0, 0, radius - 22).stroke({ width: 1.5, color, alpha: 0.4 });
    g.circle(0, 0, radius + 14).stroke({ width: 1, color, alpha: 0.25 });
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const len = i % 6 === 0 ? 20 : i % 2 ? 8 : 12;
      g.moveTo(Math.cos(a) * radius, Math.sin(a) * radius)
        .lineTo(Math.cos(a) * (radius - len), Math.sin(a) * (radius - len))
        .stroke({ width: i % 6 === 0 ? 3 : 1.5, color, alpha: 0.6 });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.circle(Math.cos(a) * (radius - 11), Math.sin(a) * (radius - 11), 5).fill({ color, alpha: 0.8 });
    }
    g.blendMode = 'add';
    gsap.to(g, { rotation: Math.PI * 2, duration: 30, repeat: -1, ease: 'none' });
    return g;
  }

  private ringBurst(color: number): void {
    const g = new Graphics();
    g.blendMode = 'add';
    this.content.addChildAt(g, 0);
    const o = { r: 40, a: 1 };
    gsap.to(o, {
      r: 900,
      a: 0,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => {
        if (g.destroyed) return;
        g.clear().circle(0, 0, o.r).stroke({ width: 6 + o.r * 0.02, color, alpha: o.a * 0.85 });
      },
      onComplete: () => g.destroy(),
    });
  }

  private glowDisc(size: number, color: number, alpha = 0.8): Sprite {
    const s = new Sprite(this.tex.glow);
    s.anchor.set(0.5);
    s.width = s.height = size;
    s.tint = color;
    s.alpha = alpha;
    s.blendMode = 'add';
    return s;
  }

  /** Tiered big-win celebration with escalating title while the amount counts up. */
  async bigWin(win: number, bet: number, onTick?: (v: number) => void): Promise<void> {
    const top = winTier(win, bet);
    if (top < 0) return;
    this.open();
    const rays = this.rays(COLORS.infection);
    const disc = this.glowDisc(1100, COLORS.infection, 0.55);
    const ring = this.runeRing(330, COLORS.infection);
    const eye = new Sprite(this.tex.glowMaps[Sym.CODEX]);
    eye.anchor.set(0.5);
    eye.width = eye.height = 760;
    eye.alpha = 0.35;
    eye.blendMode = 'add';
    gsap.to(eye, { alpha: 0.6, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.tierFx = { rays, ring, disc };
    const heading = new Text({ text: WIN_TIERS[0].name, style: title(118, gradient(WIN_TIERS[0].colors)) });
    heading.anchor.set(0.5);
    heading.y = -110;
    const amount = new Text({ text: fmt(0), style: amountStyle(150) });
    amount.anchor.set(0.5);
    amount.y = 80;
    const sub = new Text({
      text: 'TOUCHEZ POUR PASSER',
      style: { fontFamily: 'Rajdhani, sans-serif', fontWeight: '600', fontSize: 24, fill: 0x9aa3b2, letterSpacing: 6 },
    });
    sub.anchor.set(0.5);
    sub.y = 260;
    sub.alpha = 0.7;
    this.content.addChild(rays, disc, eye, ring, heading, amount, sub);
    this.ringBurst(COLORS.infection);
    gsap.fromTo(heading.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.6, ease: 'back.out(2)' });
    gsap.to(disc.scale, { x: disc.scale.x * 1.12, y: disc.scale.y * 1.12, duration: 0.5, yoyo: true, repeat: -1 });
    this.audio.stinger(0);
    this.fx.shockwave();
    this.fx.shake(10);
    this.fx.thump(0.4);
    this.particles.burst(this.w / 2, this.h / 2, 80, 1);
    this.particles.startFountain(this.w / 2, this.h * 0.62, 45);

    const perTier = 2.2;
    const duration = perTier * (top + 1);
    const counter = { v: 0 };
    let tier = 0;
    let lastTick = 0;
    const tween = gsap.to(counter, {
      v: win,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        amount.text = fmt(counter.v);
        onTick?.(counter.v);
        const now = performance.now();
        if (now - lastTick > 70) {
          this.audio.tick();
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
    gsap.fromTo(amount.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(3)' });
    this.audio.win(3);
    await this.waitOrSkip(2200);
    await this.close();
  }

  private tierFx: { rays: Graphics; ring: Graphics; disc: Sprite } | null = null;

  private upgrade(heading: Text, tier: number): void {
    const t = WIN_TIERS[tier];
    heading.text = t.name;
    heading.style.fill = gradient(t.colors);
    heading.style.dropShadow = { color: t.glow, blur: 30, distance: 0, alpha: 1, angle: 0 };
    if (this.tierFx) {
      this.tierFx.rays.tint = t.glow;
      this.tierFx.ring.tint = t.glow;
      this.tierFx.disc.tint = t.glow;
    }
    this.ringBurst(t.glow);
    gsap.fromTo(heading.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2)' });
    this.audio.stinger(tier);
    this.fx.shockwave();
    this.fx.shake(10 + tier * 6);
    this.fx.glitch(1 + tier);
    this.fx.thump(0.3 + tier * 0.1);
    this.particles.burst(this.w / 2, this.h * 0.45, 60 + tier * 40, 1 + tier * 0.2);
  }

  private async roulette(y: number, final: Sym, exclude: Sym[] = []): Promise<void> {
    const pool = PREMIUM_EXPANDERS.filter((s) => s === final || !exclude.includes(s));
    const frame = new Graphics()
      .roundRect(-130, -130, 260, 260, 22)
      .fill({ color: 0x0b0c10, alpha: 0.95 })
      .roundRect(-130, -130, 260, 260, 22)
      .stroke({ width: 4, color: COLORS.infection })
      .roundRect(-118, -118, 236, 236, 16)
      .stroke({ width: 1.5, color: COLORS.gold, alpha: 0.6 });
    frame.y = y;
    const glow = this.glowDisc(560, COLORS.infection, 0.5);
    glow.y = y;
    const sprite = new Sprite(this.tex.normal[pool[0]]);
    sprite.anchor.set(0.5);
    sprite.width = sprite.height = 220;
    sprite.y = y;
    this.content.addChild(glow, frame, sprite);
    gsap.from([frame.scale, sprite.scale], { x: 0, y: 0, duration: 0.4, ease: 'back.out(2)' });

    let i = Math.floor(Math.random() * pool.length);
    let delay = 40;
    const steps = 22 + Math.floor(Math.random() * 4);
    for (let k = 0; k < steps; k++) {
      i = (i + 1) % pool.length;
      const s = k === steps - 1 ? final : pool[i];
      sprite.texture = this.tex.normal[s];
      sprite.width = sprite.height = 220;
      this.audio.tick();
      await new Promise((r) => setTimeout(r, delay));
      delay *= 1.08;
    }
    this.audio.codex(4);
    this.fx.shockwave();
    this.fx.thump(0.35);
    gsap.fromTo(sprite.scale, { x: sprite.scale.x * 1.4, y: sprite.scale.y * 1.4 }, { x: sprite.scale.x, y: sprite.scale.y, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    this.particles.burst(this.w / 2, this.h / 2 + y * this.content.scale.y, 70, 0.8);
  }

  async featureIntro(special: Sym, spins: number): Promise<void> {
    this.open();
    this.audio.featureStart();
    this.fx.shake(14);
    this.fx.glitch(3);
    const rays = this.rays(COLORS.infection);
    const book = new Sprite(this.tex.normal[Sym.CODEX]);
    book.anchor.set(0.5);
    book.width = book.height = 420;
    book.y = -40;
    const head = new Text({ text: `${spins} TOURS GRATUITS`, style: title(92) });
    head.anchor.set(0.5);
    head.y = -330;
    this.content.addChild(rays, this.glowDisc(900, COLORS.infection, 0.6), this.runeRing(300, COLORS.infection), book, head);
    this.ringBurst(COLORS.infection);
    gsap.from(book.scale, { x: 0, y: 0, duration: 0.8, ease: 'back.out(1.6)' });
    gsap.from(head, { alpha: 0, y: -380, duration: 0.6, delay: 0.3 });
    gsap.to(book, { rotation: 0.04, duration: 0.12, yoyo: true, repeat: 7, ease: 'sine.inOut' });
    await this.waitOrSkip(1500);

    gsap.to(book, { alpha: 0.15, duration: 0.5 });
    const caption = new Text({ text: 'LE CODEX CHOISIT UNE SOUCHE…', style: title(40, 0xff8a94) });
    caption.anchor.set(0.5);
    caption.y = 210;
    this.content.addChild(caption);
    await this.roulette(-30, special);
    caption.text = `SOUCHE : ${SYMBOLS[special].name.toUpperCase()}`;
    caption.style = title(52, COLORS.bone);
    const rule = new Text({
      text: 'Elle se propage sur tout le rouleau et paie sur les 10 lignes',
      style: { fontFamily: 'Rajdhani, sans-serif', fontWeight: '600', fontSize: 30, fill: 0xb8c0cc, align: 'center' },
    });
    rule.anchor.set(0.5);
    rule.y = 270;
    const go = new Text({ text: 'TOUCHEZ POUR COMMENCER', style: title(28, 0xff5a6a) });
    go.anchor.set(0.5);
    go.y = 340;
    gsap.to(go, { alpha: 0.35, duration: 0.6, yoyo: true, repeat: -1 });
    this.content.addChild(rule, go);
    await this.waitOrSkip(4500);
    await this.close();
  }

  async retrigger(spins: number, mutation: Sym | null, active: Sym[]): Promise<void> {
    this.open();
    this.audio.stinger(1);
    this.fx.shake(12);
    this.fx.glitch(2);
    const head = new Text({ text: `+${spins} TOURS GRATUITS`, style: title(96) });
    head.anchor.set(0.5);
    head.y = mutation !== null ? -300 : -40;
    this.content.addChild(this.rays(COLORS.infection), head);
    gsap.from(head.scale, { x: 0, y: 0, duration: 0.6, ease: 'back.out(2)' });
    if (mutation !== null) {
      const sub = new Text({ text: 'MUTATION ! UNE NOUVELLE SOUCHE SE RÉPAND', style: title(40, 0xff8a94) });
      sub.anchor.set(0.5);
      sub.y = -200;
      this.content.addChild(sub);
      await this.roulette(30, mutation, active);
      const name = new Text({ text: SYMBOLS[mutation].name.toUpperCase(), style: title(52) });
      name.anchor.set(0.5);
      name.y = 230;
      this.content.addChild(name);
    }
    await this.waitOrSkip(2600);
    await this.close();
  }

  async featureOutro(total: number, spins: number, bet: number, onTick?: (v: number) => void): Promise<void> {
    this.open();
    this.audio.stinger(1);
    const head = new Text({ text: 'INFECTION TERMINÉE', style: title(86) });
    head.anchor.set(0.5);
    head.y = -170;
    const amount = new Text({ text: fmt(0), style: amountStyle(140) });
    amount.anchor.set(0.5);
    amount.y = 10;
    const sub = new Text({
      text: `${spins} tours gratuits · ${fmt(total / bet)}× la mise`,
      style: { fontFamily: 'Rajdhani, sans-serif', fontWeight: '600', fontSize: 34, fill: 0xb8c0cc },
    });
    sub.anchor.set(0.5);
    sub.y = 150;
    this.content.addChild(this.rays(COLORS.infection), this.glowDisc(900, COLORS.infection, 0.45), head, amount, sub);
    gsap.from(head.scale, { x: 0, y: 0, duration: 0.6, ease: 'back.out(2)' });
    if (total > 0) this.particles.startFountain(this.w / 2, this.h * 0.62, 30);
    const counter = { v: 0 };
    const tween = gsap.to(counter, {
      v: total,
      duration: Math.min(4, 1 + total / bet / 40),
      ease: 'power2.out',
      onUpdate: () => {
        amount.text = fmt(counter.v);
        onTick?.(counter.v);
      },
    });
    await Promise.race([new Promise<void>((r) => tween.eventCallback('onComplete', () => r())), this.waitOrSkip(5000)]);
    tween.progress(1);
    this.audio.win(2);
    await this.waitOrSkip(2600);
    await this.close();
  }

  async message(text: string, ms = 1600): Promise<void> {
    this.open();
    const t = new Text({ text, style: title(64) });
    t.anchor.set(0.5);
    this.content.addChild(t);
    gsap.from(t.scale, { x: 0.5, y: 0.5, duration: 0.4, ease: 'back.out(2)' });
    await this.waitOrSkip(ms);
    await this.close();
  }
}
