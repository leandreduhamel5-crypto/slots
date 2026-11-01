import { Container, Graphics, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import { BLOOD_METAL, GOLD, IVORY, metalTitle, textMask } from './art/logoArt';
import { paintArrowHead, paintDrumShade, paintGoldRule, paintPlaque, paintShrineFrame, paintSoftRays } from './art/egyptFrame';
import { Digits } from './Digits';
import { StrainBar } from './StrainBar';
import gsap from 'gsap';
import { SYMBOLS, Sym } from '../math/config';
import { PREMIUM_EXPANDERS } from '../math/engine';
import type { Audio } from './Audio';
import { Particles } from './Particles';
import { LITE, slim } from './device';

/** pixels of a big title per unit of its size */
const TITLE_DENSITY = LITE ? 1.2 : 2;
import { makeSeal, type SymbolTextures } from './textures';
import { fmt } from '../ui/format';

export const WIN_TIERS = [
  { x: 15, name: 'CONTAMINATION', material: 'gold', ray: 0x3a2408 },
  { x: 40, name: 'ÉPIDÉMIE', material: 'gold', ray: 0x4a2c0a },
  { x: 100, name: 'PANDÉMIE', material: 'gold', ray: 0x5a360c },
  { x: 500, name: 'EXTINCTION', material: 'gold', ray: 0x6a400e },
];

/** Widest a tier title and an amount may be, in overlay units: they stay inside their plates. */
const BIG_TITLE_W = 850;
const AMOUNT_W = 820;

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
  thump(power: number): void;
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
      // cast-metal lettering like the logo, painted at 2x (less on a phone, where casting it takes half a second)
      const spec = material === 'infection' || material === 'blood' ? BLOOD_METAL : material === 'bone' ? IVORY : GOLD;
      const mask = textMask(text, 'Cinzel, serif', size * TITLE_DENSITY, (size * 0.12 * TITLE_DENSITY) / 2, (size * 0.5 * TITLE_DENSITY) / 2);
      const cracks = spec === BLOOD_METAL ? Math.max(4, Math.round(text.length * 1.4)) : 0;
      const edge = (size * 0.11 * TITLE_DENSITY) / 2;
      t = Texture.from(metalTitle(mask, { ...spec, bevel: edge }, { outline: edge, cracks, seed: text.length * 7 }));
      this.headCache.set(key, t);
    }
    const s = new Sprite(t);
    s.anchor.set(0.5);
    s.scale.set(this.fitScale(t, size, maxWidth));
    return s;
  }

  /** Scale of a title so its letters (not the transparent padding) fit in maxWidth. */
  private fitScale(t: Texture, size: number, maxWidth: number): number {
    const unit = 1 / TITLE_DENSITY;
    const ink = t.width * unit - size * 0.9;
    return Math.min(unit, unit * (maxWidth / Math.max(1, ink)));
  }

  /** Paint the big titles ahead of time, a frame apart, so nothing hitches when they appear. */
  private warmTitles(): void {
    const jobs: [string, number, string][] = [...WIN_TIERS.map((t) => [t.name, 104, t.material] as [string, number, string]), ['10 TOURS GRATUITS', 88, 'gold']];
    const art: (() => void)[] = [
      () => this.plaqueTex(1240, 290),
      () => this.shrineArt(300),
      () => (this.drumShade ??= slim(paintDrumShade(1184, 234))),
      () => this.raysTex(),
    ];
    const next = () => {
      const job = art.shift();
      const j = job ? null : jobs.shift();
      if (job) job();
      else if (j) this.head3d(...j);
      else return;
      setTimeout(next, LITE ? 500 : 120);
    };
    setTimeout(next, 1500);
  }

  constructor(
    private tex: SymbolTextures,
    private audio: Audio,
    private fx: FxHooks,
    door: HTMLImageElement,
  ) {
    super();
    this.doorTex = slim(door);
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
    this.particles.unit = Math.max(0.45, Math.min(1.1, Math.min(w, h * 1.7) / 1500));
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
    this.particles.stopRain();
    this.audio.bigWinStop();
    this.emberOn = false;
    await new Promise<void>((r) =>
      gsap
        .timeline({ onComplete: r })
        .to([this.content, this.back, this.dim], { alpha: 0, duration: 0.3 }),
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
    base.alpha = 0.07;
    const counter = new Sprite(this.raysTex());
    counter.anchor.set(0.5);
    counter.width = counter.height = 2000;
    counter.blendMode = 'add';
    counter.alpha = 0.03;
    counter.rotation = 0.08;
    const core = new Sprite(this.tex.glow);
    core.anchor.set(0.5);
    core.width = core.height = 900;
    core.blendMode = 'add';
    core.alpha = 0.2;
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
    this.rays ??= Texture.from(paintSoftRays(LITE ? 512 : 1024));
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


  private doorTex: Texture;
  private shrineTex: Texture | null = null;
  private rimTex: Texture | null = null;
  private plaques = new Map<string, Texture>();
  private drumShade: Texture | null = null;
  private arrowTex: Texture | null = null;
  private ruleTex: Texture | null = null;

  /** The winged ruby of the frame, crowning a title: it sits just above the given height. */
  private ribbon(width: number, _height: number, _color: number): Sprite {
    const s = new Sprite(this.tex.crest);
    s.scale.set((width * 0.68) / this.tex.crest.width);
    s.anchor.set(0.5, 1 + 58 / s.height);
    return s;
  }

  private plaqueTex(w: number, h: number): Texture {
    const key = `${w}x${h}`;
    let t = this.plaques.get(key);
    if (!t) {
      t = slim(paintPlaque(w, h));
      this.plaques.set(key, t);
    }
    return t;
  }

  /** The gold window of the strain drum, and the same frame with its opening cut out. */
  private shrineArt(size: number): void {
    if (this.shrineTex && this.rimTex) return;
    const art = paintShrineFrame(size, size);
    this.shrineTex = Texture.from(art);
    // laid over the symbols, so they pass behind the gold
    const cut = document.createElement('canvas');
    cut.width = art.width;
    cut.height = art.height;
    const x = cut.getContext('2d')!;
    x.drawImage(art, 0, 0);
    x.globalCompositeOperation = 'destination-out';
    x.beginPath();
    x.roundRect(100, 100, art.width - 200, art.height - 200, 24);
    x.fill();
    this.rimTex = Texture.from(cut);
  }

  /** A plaque of the big screens, unfolding sideways out of its centre. */
  private plaque(w: number, h: number, y: number): Sprite {
    const s = new Sprite(this.plaqueTex(w, h));
    s.anchor.set(0.5);
    s.scale.set(0.5);
    s.y = y;
    gsap.fromTo(s.scale, { x: 0.02 }, { x: 0.5, duration: 0.42, ease: 'power3.out' });
    return s;
  }

  /** Things arrive on the big screens by settling a little into place, never by slamming. */
  private popIn(o: Container, delay = 0): void {
    const sx = o.scale.x;
    const sy = o.scale.y;
    gsap.fromTo(o.scale, { x: sx * 1.06, y: sy * 1.06 }, { x: sx, y: sy, duration: 0.5, delay, ease: 'power2.out' });
    gsap.fromTo(o, { alpha: 0 }, { alpha: 1, duration: 0.4, delay });
  }

  /** A blade of light crossing a title, masked by its letters. */
  private titleSweep(title: Sprite, parent: Container = this.content, height = 340): void {
    const mask = new Sprite(title.texture);
    mask.anchor.set(0.5);
    mask.scale.copyFrom(title.scale);
    mask.position.copyFrom(title.position);
    const blade = new Sprite(this.tex.shine);
    blade.anchor.set(0.5);
    blade.height = height;
    blade.width = 150;
    blade.rotation = 0.35;
    blade.blendMode = 'add';
    blade.position.y = title.y;
    blade.mask = mask;
    parent.addChild(mask, blade);
    gsap.fromTo(blade, { x: -700 }, { x: 700, duration: 0.8, ease: 'power1.inOut', onComplete: () => { blade.destroy(); mask.destroy(); } });
  }

  /** A thread of gold across a big screen. */
  private rule(y: number, width: number): Sprite {
    this.ruleTex ??= Texture.from(paintGoldRule());
    const s = new Sprite(this.ruleTex);
    s.anchor.set(0.5);
    s.y = y;
    s.scale.set(width / s.texture.width, 1);
    gsap.fromTo(s, { alpha: 0 }, { alpha: 1, duration: 0.5, delay: 0.2 });
    return s;
  }

  /** Tiered big-win screen: the title climbs from tier to tier over one amount, on the dimmed game. */
  async bigWin(win: number, bet: number, onTick?: (v: number) => void, record = false): Promise<void> {
    const top = winTier(win, bet);
    if (top < 0) return;
    this.open();
    const t0 = WIN_TIERS[0];
    const rays = this.sunburst(t0.ray);
    this.burstRays = rays;
    const crown = new Sprite(this.tex.crest);
    crown.anchor.set(0.5);
    crown.scale.set(0.8);
    crown.y = -262;
    const heading = this.head3d(t0.name, 104, t0.material, BIG_TITLE_W);
    heading.y = -142;
    const pips = this.tierPips();
    pips.y = -52;
    const amount = new Digits(118);
    amount.value = 0;
    amount.y = 70;
    const mult = new Digits(54);
    mult.y = 186;
    mult.scale.set(0.8);
    const showMult = (v: number) => {
      mult.text = `×${Math.floor(v / bet)}`;
    };
    showMult(0);
    const sub = new Text({ text: 'TOUCHEZ POUR PASSER', style: body(18, 0xd8b878) });
    sub.anchor.set(0.5);
    sub.y = 326;
    gsap.to(sub, { alpha: 0.45, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.content.addChild(this.rule(244, 860), heading, pips, amount, mult, crown, sub);
    gsap.fromTo(crown, { alpha: 0 }, { alpha: 1, duration: 0.5, delay: 0.1 });
    this.popIn(heading, 0.14);
    this.popIn(amount, 0.24);
    this.popIn(mult, 0.28);
    this.popIn(pips, 0.3);
    this.lightPip(pips, 0);
    this.audio.bigWinStart();
    gsap.delayedCall(0.42, () => {
      if (!this.visible || heading.destroyed) return;
      this.audio.tierUp(0);
      this.titleSweep(heading);
    });
    this.particles.startRain([this.tex.coin], this.w, 3);

    const duration = 2.1 * (top + 1);
    this.audio.timpaniRoll(duration);
    const counter = { v: 0 };
    let tier = 0;
    let lastTick = 0;
    const fitted = () => Math.min(1.15, AMOUNT_W / Math.max(1, amount.inkWidth));
    const tween = gsap.to(counter, {
      v: win,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        if (amount.destroyed) return;
        amount.value = counter.v;
        amount.scale.set(fitted());
        showMult(counter.v);
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
          this.lightPip(pips, tier);
        }
      },
    });
    const done = new Promise<void>((r) => tween.eventCallback('onComplete', () => r()));
    await Promise.race([done, this.waitOrSkip(duration * 1000 + 50)]);
    if (tween.isActive()) {
      tween.progress(1);
      if (tier < top) this.upgrade(heading, top);
      for (let i = tier + 1; i <= top; i++) this.lightPip(pips, i);
      showMult(win);
    }
    this.titleSweep(heading);
    this.audio.bigWinEnd(top);
    if (record) this.recordStamp(0, 286);
    await this.waitOrSkip(2400);
    await this.close();
  }

  /** The biggest win this player has ever had: a seal struck on the plaque. */
  private recordStamp(x: number, y: number): void {
    const c = new Container();
    const t = new Text({ text: 'NOUVEAU RECORD', style: body(22, 0xffe9b0) });
    t.anchor.set(0.5);
    c.addChild(t);
    c.position.set(x, y);
    c.alpha = 0;
    this.content.addChild(c);
    gsap.delayedCall(0.55, () => {
      if (c.destroyed) return;
      this.popIn(c);
      gsap.delayedCall(0.3, () => {
        if (c.destroyed) return;
        this.audio.record();
      });
    });
  }

  /** One gem per win tier, in a row under the title: they light up as the count climbs. */
  private tierPips(): Container {
    const row = new Container();
    const gap = 54;
    WIN_TIERS.forEach((_, i) => {
      const pip = new Container();
      pip.x = (i - (WIN_TIERS.length - 1) / 2) * gap;
      const off = new Graphics().poly([0, -13, 13, 0, 0, 13, -13, 0]).fill(0x1a1006).stroke({ width: 2.5, color: 0xc08a30 });
      const on = new Graphics().poly([0, -13, 13, 0, 0, 13, -13, 0]).fill(0xffe7a0).stroke({ width: 2.5, color: 0xfff6d8 });
      on.alpha = 0;
      const halo = new Sprite(this.tex.glow);
      halo.anchor.set(0.5);
      halo.width = halo.height = 92;
      halo.blendMode = 'add';
      halo.tint = 0xffc860;
      halo.alpha = 0;
      pip.addChild(halo, off, on);
      row.addChild(pip);
    });
    return row;
  }

  private lightPip(row: Container, tier: number): void {
    const pip = row.children[tier] as Container;
    const [halo, , on] = pip.children;
    on.alpha = 1;
    gsap.fromTo(halo, { alpha: 1 }, { alpha: 0.5, duration: 0.5 });
  }

  private upgrade(heading: Sprite, tier: number): void {
    const t = WIN_TIERS[tier];
    const tex = this.head3d(t.name, 104, t.material, BIG_TITLE_W);
    heading.texture = tex.texture;
    const k = tex.scale.x;
    gsap.killTweensOf(heading.scale);
    gsap.fromTo(heading.scale, { x: k * 1.06, y: k * 1.06 }, { x: k, y: k, duration: 0.4, ease: 'power2.out' });
    if (this.burstRays) this.retint(this.burstRays, t.ray);
    this.audio.tierUp(tier);
    this.titleSweep(heading);
    this.particles.setRainRate(3 + tier * 2);
  }

  /**
   * The strain drum: the premium symbols turn on a wheel inside a plaque of lapis and gold, coming
   * forward as they pass behind a gold window, while lamps chase round the rim at the wheel's speed.
   * It throws back, spins up, slows to a stop on the strain, and everything blazes.
   */
  private async roulette(y: number, final: Sym, exclude: Sym[], bar: StrainBar): Promise<void> {
    const pool = PREMIUM_EXPANDERS.filter((s) => s === final || !exclude.includes(s));
    const box = new Container();
    box.y = y;
    const WINDOW = 300;
    const PW = 1240;
    const PH = 290;
    const aura = new Sprite(this.tex.glow);
    aura.anchor.set(0.5);
    aura.width = 1500;
    aura.height = 760;
    aura.tint = 0xffa030;
    aura.blendMode = 'add';
    aura.alpha = 0.26;
    gsap.to(aura, { alpha: 0.38, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const rays = new Sprite(this.raysTex());
    rays.anchor.set(0.5);
    rays.width = rays.height = 1500;
    rays.tint = 0xffc060;
    rays.blendMode = 'add';
    rays.alpha = 0;
    gsap.to(rays, { rotation: Math.PI * 2, duration: 40, repeat: -1, ease: 'none' });
    const shaft = new Sprite(this.tex.glow);
    shaft.anchor.set(0.5);
    shaft.width = 420;
    shaft.height = 1500;
    shaft.tint = 0xffd080;
    shaft.blendMode = 'add';
    shaft.alpha = 0;
    const plaque = this.plaque(PW, PH, 0);
    this.drumShade ??= slim(paintDrumShade(PW - 56, PH - 56));
    const shade = new Sprite(this.drumShade);
    shade.anchor.set(0.5);
    this.shrineArt(WINDOW);
    const frame = new Sprite(this.shrineTex!);
    const rim = new Sprite(this.rimTex!);
    for (const f of [frame, rim]) {
      f.anchor.set(0.5);
      f.scale.set(0.5);
    }
    const well = new Sprite(this.tex.glow);
    well.anchor.set(0.5);
    well.width = well.height = 340;
    well.tint = 0xffc060;
    well.blendMode = 'add';
    well.alpha = 0;
    const crown = new Sprite(this.tex.crest);
    crown.anchor.set(0.5);
    crown.scale.set(0.56);
    crown.y = -WINDOW / 2 - 34;
    const foot = new Sprite(this.tex.crest);
    foot.anchor.set(0.5);
    foot.scale.set(0.42);
    foot.y = WINDOW / 2 + 26;
    this.arrowTex ??= Texture.from(paintArrowHead());
    const arrowL = new Sprite(this.arrowTex);
    const arrowR = new Sprite(this.arrowTex);
    for (const [a, d] of [[arrowL, -1], [arrowR, 1]] as const) {
      a.anchor.set(0.5);
      a.scale.set(-0.62 * d, 0.62);
      a.position.set(d * (WINDOW / 2 + 28), 0);
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
    box.addChild(aura, rays, shaft, plaque, frame, well, strip, shade, rim, crown, foot, arrowL, arrowR, flash);
    this.content.addChild(box);
    gsap.fromTo(box, { alpha: 0 }, { alpha: 1, duration: 0.3 });
    gsap.fromTo(crown, { y: crown.y - 100, alpha: 0 }, { y: crown.y, alpha: 1, duration: 0.45, ease: 'power3.out', delay: 0.1 });
    gsap.fromTo(foot, { y: foot.y + 100, alpha: 0 }, { y: foot.y, alpha: 1, duration: 0.45, ease: 'power3.out', delay: 0.1 });
    this.popIn(frame);
    this.popIn(rim);

    const state = { off: 0 };
    let lastIdx = 0;
    const end = target * spacing;
    /** radians of wheel between two symbols */
    const TURN = 0.58;
    const layout = () => {
      for (let k = 0; k < count; k++) {
        const sp = items[k];
        const a = ((k * spacing - state.off) / spacing) * TURN;
        sp.visible = Math.abs(a) < 1.42;
        if (!sp.visible) continue;
        const depth = Math.cos(a);
        sp.x = Math.sin(a) * 560;
        sp.width = sp.height = 92 + 150 * Math.pow(depth, 1.6);
        sp.alpha = Math.min(1, depth * 2.4);
        const v = Math.round(96 + 159 * Math.pow(depth, 4));
        sp.tint = (v << 16) | (v << 8) | v;
      }
      // the window warms as the wheel runs out of speed
      well.alpha = Math.max(0, 1 - (end - state.off) / (spacing * 3)) * 0.42;
      const idx = Math.round(state.off / spacing);
      if (idx !== lastIdx) {
        lastIdx = idx;
        bar.focus(pool[(((startIndex + idx) % pool.length) + pool.length) % pool.length]);
        this.audio.drumTick(state.off / end);
        gsap.fromTo(arrowL, { x: -(WINDOW / 2 + 16), alpha: 1 }, { x: -(WINDOW / 2 + 28), alpha: 0.7, duration: 0.16 });
        gsap.fromTo(arrowR, { x: WINDOW / 2 + 16, alpha: 1 }, { x: WINDOW / 2 + 28, alpha: 0.7, duration: 0.16 });
      }
    };
    layout();
    await new Promise<void>((resolve) => {
      this.audio.riser(3.5, 0.8);
      const tl = gsap
        .timeline({ onComplete: resolve })
        .to(state, { off: -spacing * 0.45, duration: 0.42, ease: 'power2.out', onUpdate: layout })
        .to(state, { off: end, duration: 3.5, ease: 'power4.out', onUpdate: layout });
      const skipWatch = () => {
        if (this.skipRequested) {
          this.skipRequested = false;
          tl.kill();
          state.off = end;
          layout();
          resolve();
        } else if (tl.isActive() || tl.progress() === 0) requestAnimationFrame(skipWatch);
      };
      requestAnimationFrame(skipWatch);
    });
    // lock: the wheel empties, the strain blazes in its window and the light goes straight up
    const chosen = items[target];
    bar.ignite(final, false);
    for (const sp of items) if (sp !== chosen) gsap.to(sp, { alpha: 0, duration: 0.3 });
    this.audio.impact(0.9);
    this.audio.strainLock();
    this.fx.thump(0.3);
    gsap.fromTo(flash, { alpha: 0.5, width: 240, height: 240 }, { alpha: 0, width: 700, height: 700, duration: 0.65, ease: 'power2.out' });
    const size = chosen.width;
    gsap.fromTo(chosen, { width: size, height: size }, { width: 262, height: 262, duration: 0.4, ease: 'power2.out' });
    gsap.to(rays, { alpha: 0.14, duration: 0.5 });
    gsap.killTweensOf(aura, 'alpha');
    gsap.to(aura, { alpha: 0.3, duration: 0.4 });
    gsap.to(well, { alpha: 0.3, duration: 0.3 });
    gsap.delayedCall(0.34, () => {
      if (chosen.destroyed) return;
      this.titleSweep(chosen, box);
    });
    // the emptied wings of the plaque say what the strain will do
    for (const [text, side] of [['ENVAHIT\nTOUT LE ROULEAU', -1], ['PAIE SUR\nLES 10 LIGNES', 1]] as const) {
      const t = new Text({ text, style: { ...body(30, 0xffe2ac), lineHeight: 46 } });
      t.anchor.set(0.5);
      t.x = side * 400;
      box.addChild(t);
      gsap.fromTo(t, { x: side * 330, alpha: 0 }, { x: side * 400, alpha: 1, duration: 0.45, ease: 'power3.out', delay: 0.3 });
    }
  }

  /** The row of all the strains under the drum: the light of the wheel passes over them. */
  private strainRow(y: number, active: Sym[]): StrainBar {
    const bar = new StrainBar(this.tex);
    bar.y = y;
    bar.scale.set(0.82);
    bar.set(active);
    this.content.addChild(bar);
    gsap.fromTo(bar, { alpha: 0 }, { alpha: 1, duration: 0.4 });
    return bar;
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
      const s = new Sprite(this.doorTex);
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
            if (d.z < 0.25) {
              d.z += 8;
              this.audio.doorPass();
            }
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
            tch.s.alpha = Math.min(1, (8 - tch.z) * 0.4) * (0.26 + Math.random() * 0.08);
          }
          core.width = core.height = 160 + Math.pow(st.t, 3) * 1500;
          core.alpha = (0.4 + st.t * 0.3) * Math.min(1, (1 - st.t) * 8);
          layer.alpha = Math.min(1, (1 - st.t) * 6);
        },
        onComplete: resolve,
      });
    });
    this.audio.impact(0.8);
    layer.destroy({ children: true });
  }

  async featureIntro(special: Sym, spins: number, fromCorridor = false): Promise<void> {
    if (!fromCorridor) this.open();
    else {
      // out of the dark, into the chamber
      this.content.alpha = 1;
      gsap.fromTo(this.dim, { alpha: 1 }, { alpha: 0.86, duration: 0.9 });
    }
    this.audio.featureStart();
    this.sunburst(0x46060c);
    const head = this.head3d(`${spins} TOURS GRATUITS`, 88, 'gold', 1000);
    head.y = -312;
    this.content.addChild(head);
    // a player may skip this screen at any moment: nothing delayed may touch what is gone
    this.popIn(head, 0.3);
    gsap.delayedCall(0.8, () => !head.destroyed && this.titleSweep(head));
    await this.waitOrSkip(1050);
    const seal = makeSeal(this.tex.seal, 840, 96);
    seal.y = 206;
    this.content.addChild(seal);
    this.popIn(seal);
    const caption = new Text({ text: 'LE ROULEAU CHOISIT VOTRE SOUCHE…', style: body(24, 0xffd9a0) });
    caption.anchor.set(0.5);
    caption.y = 206;
    this.content.addChild(caption);
    gsap.fromTo(caption, { alpha: 0 }, { alpha: 1, duration: 0.4 });
    gsap.to(caption, { alpha: 0.55, duration: 0.6, yoyo: true, repeat: -1, delay: 0.4 });
    const bar = this.strainRow(306, []);
    await this.roulette(-30, special, [], bar);
    gsap.killTweensOf(caption);
    caption.destroy();
    const strain = this.head3d(`SOUCHE : ${SYMBOLS[special].name.toUpperCase()}`, 50, 'gold', 660);
    strain.y = 206;
    this.content.addChild(strain);
    this.popIn(strain);
    gsap.delayedCall(0.3, () => !strain.destroyed && this.titleSweep(strain));
    const go = new Text({ text: 'TOUCHEZ POUR COMMENCER', style: body(24, 0xffd27a) });
    go.anchor.set(0.5);
    go.y = 384;
    gsap.to(go, { alpha: 0.4, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.content.addChild(go);
    gsap.fromTo(go, { alpha: 0 }, { alpha: 1, duration: 0.5, delay: 0.3 });
    await this.waitOrSkip(4500);
    await this.close();
  }

  async retrigger(spins: number, mutation: Sym | null, active: Sym[]): Promise<void> {
    this.open();
    this.audio.stinger(1);
    this.sunburst(0x3e1806);
    const ribbon = this.ribbon(1120, 150, 0x8a0f26);
    ribbon.y = -20;
    ribbon.visible = mutation === null;
    const head = this.head3d(`+${spins} TOURS GRATUITS`, 84, 'gold', 940);
    head.y = mutation !== null ? -320 : ribbon.y - 10;
    this.content.addChild(ribbon, head);
    this.popIn(ribbon);
    this.popIn(head, 0.05);
    if (mutation !== null) {
      const seal = makeSeal(this.tex.seal, 840, 96);
      seal.y = 206;
      this.content.addChild(seal);
      this.popIn(seal, 0.2);
      const sub = new Text({ text: 'MUTATION ! UNE NOUVELLE SOUCHE', style: body(24, 0xffd9a0) });
      sub.anchor.set(0.5);
      sub.y = 206;
      this.content.addChild(sub);
      this.popIn(sub, 0.2);
      const bar = this.strainRow(306, active);
      await this.roulette(-30, mutation, active, bar);
      sub.destroy();
      const name = this.head3d(SYMBOLS[mutation].name.toUpperCase(), 50, 'gold', 660);
      name.y = 206;
      this.content.addChild(name);
      this.popIn(name);
    }
    await this.waitOrSkip(2600);
    await this.close();
  }

  async featureOutro(total: number, spins: number, bet: number, bestSpin: number, record: boolean, onTick?: (v: number) => void): Promise<void> {
    this.open();
    this.audio.stinger(1);
    this.sunburst(0x3a2408);
    const crown = new Sprite(this.tex.crest);
    crown.anchor.set(0.5);
    crown.scale.set(0.8);
    crown.y = -256;
    const head = this.head3d('INFECTION TERMINÉE', 74, 'gold', 760);
    head.y = -138;
    const amount = new Digits(114);
    amount.value = 0;
    amount.y = 30;
    const sub = new Text({ text: `${spins} tours · ×${Math.floor(total / bet)} la mise${bestSpin > 0 ? ` · meilleur tour ${fmt(bestSpin)}` : ''}`, style: body(22, 0xffe2ac) });
    sub.anchor.set(0.5);
    sub.y = 164;
    this.content.addChild(this.rule(-62, 860), this.rule(112, 860), head, amount, sub, crown);
    gsap.fromTo(crown, { alpha: 0 }, { alpha: 1, duration: 0.5, delay: 0.1 });
    this.popIn(head, 0.12);
    this.popIn(amount, 0.2);
    this.popIn(sub, 0.26);
    if (total > 0) this.particles.startRain([this.tex.coin], this.w, 3);
    const counter = { v: 0 };
    const tween = gsap.to(counter, {
      v: total,
      duration: Math.min(4, 1 + total / bet / 40),
      ease: 'power2.out',
      onUpdate: () => {
        if (amount.destroyed) return;
        amount.value = counter.v;
        amount.scale.set(Math.min(1.15, AMOUNT_W / Math.max(1, amount.inkWidth)));
        onTick?.(counter.v);
      },
    });
    await Promise.race([new Promise<void>((r) => tween.eventCallback('onComplete', () => r())), this.waitOrSkip(5000)]);
    tween.progress(1);
    this.audio.bigWinEnd(1);
    this.titleSweep(head);
    if (record) this.recordStamp(0, 236);
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
