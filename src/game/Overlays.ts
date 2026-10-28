import { Container, FillGradient, Graphics, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import { MATERIALS, render3DText } from './art/painters';
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
  { x: 15, name: 'CONTAMINATION', material: 'pharaoh', ray: 0x3a2408 },
  { x: 40, name: 'ÉPIDÉMIE', material: 'gold', ray: 0x3e1806 },
  { x: 100, name: 'PANDÉMIE', material: 'infection', ray: 0x46060c },
  { x: 500, name: 'EXTINCTION', material: 'infection', ray: 0x5a0410 },
];

export function winTier(win: number, bet: number): number {
  let t = -1;
  WIN_TIERS.forEach((tier, i) => {
    if (win >= tier.x * bet) t = i;
  });
  return t;
}

/** Two-tone hard-stop fill: the cartoon cel-shading look for text. */
function cel(light: string, base: string): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: light },
      { offset: 0.48, color: light },
      { offset: 0.52, color: base },
      { offset: 1, color: base },
    ],
    textureSpace: 'local',
  });
}

const title = (size: number, light = '#fff6c0', base = '#ffd23f'): TextStyleOptions => ({
  fontFamily: 'Cinzel, "Luckiest Guy", serif', fontWeight: '900' as const,
  fontSize: size,
  fill: cel(light, base),
  stroke: { color: COLORS.ink, width: Math.max(8, size * 0.16), join: 'round' },
  dropShadow: { color: COLORS.ink, blur: 0, distance: size * 0.09, angle: Math.PI / 2, alpha: 1 },
  letterSpacing: size * 0.03,
  align: 'center',
});

const body = (size: number, fill = 0xffffff): TextStyleOptions => ({
  fontFamily: 'Nunito, sans-serif',
  fontWeight: '900',
  fontSize: size,
  fill,
  stroke: { color: COLORS.ink, width: size * 0.22, join: 'round' },
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
  private skipRequested = false;
  private burstRays: Container | null = null;
  private emberLayer = new Container();
  private headCache = new Map<string, Texture>();

  /** Big 3D title rendered once with the lettering engine and cached. */
  private head3d(text: string, size: number, material = 'gold'): Sprite {
    const key = `${text}|${size}|${material}`;
    let t = this.headCache.get(key);
    if (!t) {
      t = Texture.from(render3DText(text, { size, material: MATERIALS[material] }));
      this.headCache.set(key, t);
    }
    const s = new Sprite(t);
    s.anchor.set(0.5);
    return s;
  }

  constructor(
    private tex: SymbolTextures,
    private audio: Audio,
    private fx: FxHooks,
  ) {
    super();
    this.particles = new Particles(tex);
    for (const t of WIN_TIERS) this.head3d(t.name, 104, t.material);
    this.head3d('10 TOURS GRATUITS', 88, 'gold');
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

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.content.position.set(w / 2, h / 2);
    this.content.scale.set(Math.min(w / 1300, h / 1000, 1.2));
    this.back.position.set(w / 2, h / 2);
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
    this.drawDim(0);
    gsap.to(this.dim, { alpha: 0.82, duration: 0.25 });
  }

  private async close(): Promise<void> {
    this.particles.stopFountain();
    this.particles.stopRain();
    this.emberOn = false;
    await new Promise<void>((r) =>
      gsap
        .timeline({ onComplete: r })
        .to(this.content.scale, { x: this.content.scale.x * 0.6, y: this.content.scale.y * 0.6, duration: 0.25, ease: 'back.in(2)' })
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
    base.width = base.height = 2600;
    const counter = new Sprite(this.raysTex());
    counter.anchor.set(0.5);
    counter.width = counter.height = 2200;
    counter.alpha = 0.45;
    counter.rotation = 0.08;
    const core = new Sprite(this.tex.glow);
    core.anchor.set(0.5);
    core.width = core.height = 900;
    core.blendMode = 'add';
    core.alpha = 0.55;
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
    if (this.rays) return this.rays;
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#1a0a1e';
    ctx.fillRect(0, 0, S, S);
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + (Math.PI / n) * (0.75 + (i % 3) * 0.2);
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(S / 2, S / 2);
      ctx.arc(S / 2, S / 2, S * 0.75, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    // vignette darkening toward the edges
    const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,2,10,0.75)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, S, S);
    this.rays = Texture.from(cv);
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


  /** Ink-outlined ribbon banner. */
  private ribbon(width: number, height: number, color: number): Graphics {
    const g = new Graphics();
    const w = width / 2;
    const h = height / 2;
    for (const d of [-1, 1]) {
      g.poly([d * (w - 30), -h + 26, d * (w + 70), -h + 26, d * (w + 40), 12, d * (w + 70), h + 26, d * (w - 30), h + 26])
        .fill(0x5a0b22)
        .stroke({ width: 8, color: COLORS.ink, join: 'round' });
    }
    g.moveTo(-w, -h).quadraticCurveTo(0, -h - 24, w, -h).lineTo(w, h).quadraticCurveTo(0, h - 24, -w, h).closePath().fill(color).stroke({ width: 9, color: COLORS.ink, join: 'round' });
    g.moveTo(-w + 16, -h + 12).quadraticCurveTo(0, -h - 8, w - 16, -h + 12).stroke({ width: 6, color: 0xffffff, alpha: 0.25 });
    return g;
  }

  private plate(width: number, height: number): Graphics {
    return new Graphics()
      .roundRect(-width / 2, -height / 2 + 10, width, height, 26)
      .fill(COLORS.ink)
      .roundRect(-width / 2, -height / 2, width, height, 26)
      .fill(0x120605)
      .stroke({ width: 9, color: COLORS.ink })
      .roundRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, 22)
      .stroke({ width: 5, color: 0xd8a03a })
      .roundRect(-width / 2 + 13, -height / 2 + 13, width - 26, height - 26, 16)
      .stroke({ width: 1.5, color: 0x7a4a10 })
      .roundRect(-width / 2 + 16, -height / 2 + 14, width - 32, 10, 5)
      .fill({ color: 0xffe2a0, alpha: 0.1 });
  }

  private popIn(o: Container, delay = 0, from = 0.2): void {
    const sx = o.scale.x;
    const sy = o.scale.y;
    gsap.fromTo(o.scale, { x: sx * from, y: sy * from }, { x: sx, y: sy, duration: 0.6, delay, ease: 'elastic.out(1.1, 0.45)' });
  }

  /** Tiered big-win celebration: the title escalates while the amount counts up. */
  async bigWin(win: number, bet: number, onTick?: (v: number) => void): Promise<void> {
    const top = winTier(win, bet);
    if (top < 0) return;
    this.open();
    const t0 = WIN_TIERS[0];
    const rays = this.sunburst(t0.ray);
    this.burstRays = rays;
    const eye = new Sprite(this.tex.normal[Sym.CODEX]);
    eye.anchor.set(0.5);
    eye.width = eye.height = 380;
    eye.y = -40;
    eye.alpha = 0.9;
    gsap.to(eye, { rotation: 0.06, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const ribbon = this.ribbon(860, 150, 0x1e0a08);
    ribbon.y = -150;
    const heading = this.head3d(t0.name, 104, t0.material);
    heading.y = -160;
    const plate = this.plate(620, 170);
    plate.y = 150;
    const amount = new Digits(118);
    amount.value = 0;
    amount.y = 150;
    const sub = new Text({ text: 'touchez pour passer', style: body(24, 0xb8a8c8) });
    sub.anchor.set(0.5);
    sub.y = 290;
    this.content.addChild(eye, ribbon, heading, plate, amount, sub);
    this.popIn(eye, 0, 0.1);
    this.popIn(ribbon, 0.1);
    this.popIn(heading, 0.15);
    this.popIn(plate, 0.2);
    this.popIn(amount, 0.25);
    this.audio.stinger(0);
    this.fx.shockwave();
    this.fx.shake(10);
    this.fx.thump(0.35);
    this.particles.impact(this.w / 2, this.h / 2, 1.6);
    this.particles.startFountain(this.w / 2, this.h * 0.7, 30);
    this.audio.coins(24);
    this.particles.startRain([Sym.CODEX, Sym.ANTIDOTE, Sym.BLOOD, Sym.ZERO].map((s) => this.tex.normal[s]), this.w, 6);
    this.fx.punch(1);

    const duration = 2.1 * (top + 1);
    const counter = { v: 0 };
    let tier = 0;
    let lastTick = 0;
    const tween = gsap.to(counter, {
      v: win,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        amount.value = counter.v;
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
    gsap.fromTo(amount.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.4)' });
    this.audio.win(3);
    await this.waitOrSkip(2200);
    await this.close();
  }

  private upgrade(heading: Sprite, tier: number): void {
    const t = WIN_TIERS[tier];
    heading.texture = this.head3d(t.name, 104, t.material).texture;
    gsap.fromTo(heading.scale, { x: 1.7, y: 0.6 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.4)' });
    if (this.burstRays) this.retint(this.burstRays, t.ray);
    this.audio.stinger(tier);
    this.fx.shockwave();
    this.fx.shake(10 + tier * 6);
    this.fx.glitch(1 + tier);
    this.fx.thump(0.3 + tier * 0.1);
    this.particles.impact(this.w / 2, this.h * 0.38, 1.2 + tier * 0.3);
    this.particles.burst(this.w / 2, this.h * 0.45, 30 + tier * 20, 1 + tier * 0.2);
    this.particles.startRain([Sym.CODEX, Sym.ANTIDOTE, Sym.BLOOD, Sym.ZERO].map((s) => this.tex.normal[s]), this.w, 6 + tier * 6);
    this.fx.punch(1 + tier * 0.3);
  }

  /** Cartoon slot-window roulette that lands on the chosen strain. */
  private async roulette(y: number, final: Sym, exclude: Sym[] = []): Promise<void> {
    const pool = PREMIUM_EXPANDERS.filter((s) => s === final || !exclude.includes(s));
    const box = new Container();
    box.y = y;
    const frame = new Graphics()
      .roundRect(-150, -140, 300, 290, 34)
      .fill(COLORS.ink)
      .roundRect(-150, -150, 300, 290, 34)
      .fill(0x8a5612)
      .stroke({ width: 9, color: COLORS.ink })
      .roundRect(-142, -142, 284, 274, 28)
      .stroke({ width: 5, color: 0xf2c25a })
      .roundRect(-124, -124, 248, 238, 22)
      .fill(0x120606)
      .stroke({ width: 7, color: COLORS.ink })
      .roundRect(-118, -118, 236, 226, 18)
      .stroke({ width: 4, color: COLORS.yellow });
    for (const [bx, by] of [
      [-132, -132],
      [132, -132],
      [-132, 122],
      [132, 122],
    ]) frame.circle(bx, by, 9).fill(0xe0213a).stroke({ width: 4, color: COLORS.ink }).circle(bx - 3, by - 3, 3).fill(0xffd0c8);
    const sprite = new Sprite(this.tex.normal[pool[0]]);
    sprite.anchor.set(0.5);
    sprite.width = sprite.height = 220;
    sprite.y = -6;
    const arrowL = new Graphics().poly([-190, -30, -160, -6, -190, 18]).fill(COLORS.infection).stroke({ width: 6, color: COLORS.ink, join: 'round' });
    const arrowR = new Graphics().poly([190, -30, 160, -6, 190, 18]).fill(COLORS.infection).stroke({ width: 6, color: COLORS.ink, join: 'round' });
    box.addChild(frame, sprite, arrowL, arrowR);
    this.content.addChild(box);
    this.popIn(box);

    let i = Math.floor(Math.random() * pool.length);
    let delay = 40;
    const steps = 22 + Math.floor(Math.random() * 4);
    for (let k = 0; k < steps; k++) {
      i = (i + 1) % pool.length;
      const s = k === steps - 1 ? final : pool[i];
      sprite.texture = this.tex.normal[s];
      sprite.width = sprite.height = 220;
      gsap.fromTo(sprite, { y: -36 }, { y: -6, duration: Math.min(0.12, delay / 1000), ease: 'power1.out' });
      this.audio.tick();
      await new Promise((r) => setTimeout(r, delay));
      delay *= 1.08;
    }
    this.audio.codex(4);
    this.fx.shockwave();
    this.fx.thump(0.35);
    const sx = sprite.scale.x;
    gsap.fromTo(sprite.scale, { x: sx * 1.5, y: sx * 0.7 }, { x: sx, y: sx, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' });
    gsap.fromTo(frame.scale, { x: 1.1, y: 0.92 }, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' });
    const sc = this.content.scale.y;
    this.particles.impact(this.w / 2, this.h / 2 + y * sc, 1.2);
    this.particles.burst(this.w / 2, this.h / 2 + y * sc, 30, 0.8);
  }

  async featureIntro(special: Sym, spins: number): Promise<void> {
    this.open();
    this.audio.featureStart();
    this.fx.shake(16);
    this.fx.glitch(3);
    this.sunburst(0x46060c);
    const book = new Sprite(this.tex.normal[Sym.CODEX]);
    book.anchor.set(0.5);
    book.width = book.height = 440;
    book.y = 10;
    const ribbon = this.ribbon(900, 150, 0x8a0f26);
    ribbon.y = -300;
    const head = this.head3d(`${spins} TOURS GRATUITS`, 88, 'gold');
    head.y = -312;
    this.content.addChild(book, ribbon, head);
    gsap.fromTo(book, { y: -700 }, { y: 10, duration: 0.45, ease: 'power3.in' });
    gsap.delayedCall(0.45, () => {
      this.fx.shake(22);
      this.particles.impact(this.w / 2, this.h / 2, 1.8);
      const s = book.scale.x;
      gsap.fromTo(book.scale, { x: s * 1.35, y: s * 0.7 }, { x: s, y: s, duration: 0.6, ease: 'elastic.out(1.2, 0.35)' });
    });
    this.popIn(ribbon, 0.6);
    this.popIn(head, 0.65);
    await this.waitOrSkip(1700);

    gsap.to(book, { alpha: 0, duration: 0.3 });
    const caption = new Text({ text: 'LE LIVRE CHOISIT UNE SOUCHE…', style: title(42, '#ffb0b8', '#ff3347') });
    caption.anchor.set(0.5);
    caption.y = 230;
    this.content.addChild(caption);
    this.popIn(caption);
    await this.roulette(-20, special);
    caption.destroy();
    const strain = this.head3d(`SOUCHE : ${SYMBOLS[special].name.toUpperCase()}`, 54, 'blood');
    strain.y = 228;
    this.content.addChild(strain);
    this.popIn(strain);
    const rule = new Text({ text: 'elle envahit tout le rouleau et paie sur les 10 lignes', style: body(30, 0xe8dcf0) });
    rule.anchor.set(0.5);
    rule.y = 295;
    const go = new Text({ text: 'TOUCHEZ POUR COMMENCER', style: title(32, '#ffffff', '#ff7a86') });
    go.anchor.set(0.5);
    go.y = 360;
    gsap.to(go.scale, { x: 1.08, y: 1.08, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.content.addChild(rule, go);
    await this.waitOrSkip(4500);
    await this.close();
  }

  async retrigger(spins: number, mutation: Sym | null, active: Sym[]): Promise<void> {
    this.open();
    this.audio.stinger(1);
    this.fx.shake(14);
    this.fx.glitch(2);
    this.sunburst(0x3e1806);
    const ribbon = this.ribbon(820, 150, 0x8a0f26);
    ribbon.y = mutation !== null ? -290 : -20;
    const head = this.head3d(`+${spins} TOURS GRATUITS`, 84, 'gold');
    head.y = ribbon.y - 10;
    this.content.addChild(ribbon, head);
    this.popIn(ribbon);
    this.popIn(head, 0.05);
    this.particles.impact(this.w / 2, this.h / 2, 1.4);
    if (mutation !== null) {
      const sub = new Text({ text: 'MUTATION ! UNE NOUVELLE SOUCHE', style: title(44, '#ffb0b8', '#ff3347') });
      sub.anchor.set(0.5);
      sub.y = -185;
      this.content.addChild(sub);
      this.popIn(sub, 0.2);
      await this.roulette(40, mutation, active);
      const name = this.head3d(SYMBOLS[mutation].name.toUpperCase(), 56, 'blood');
      name.y = 250;
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
    const head = this.head3d('INFECTION TERMINÉE', 80, 'bone');
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
    const ribbon = this.ribbon(900, 150, 0x1e0a08);
    const t = this.head3d(text, 62, 'bone');
    t.y = -8;
    this.content.addChild(ribbon, t);
    this.popIn(ribbon);
    this.popIn(t, 0.05);
    await this.waitOrSkip(ms);
    await this.close();
  }
}
