import { Application, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { AdvancedBloomFilter, ShockwaveFilter } from 'pixi-filters';
import gsap from 'gsap';
import { BASE_STRIPS, BET_LEVELS, FREE_STRIPS, REELS, ROWS, Sym, minCount } from '../math/config';
import type { FreeSpinOutcome, Grid, Round, SpinOutcome } from '../math/engine';
import { GameServer } from '../server/GameServer';
import { LITE, slim } from './device';
import { Hud } from '../ui/Hud';
import { Paytable } from '../ui/Paytable';
import { paintBonusPanel } from './art/egyptFrame';
import { Audio } from './Audio';
import { Background } from './Background';
import { Digits } from './Digits';
import { BOARD_H, BOARD_W, COLORS, FRAME_MARGIN_X, FRAME_MARGIN_Y } from './layout';
import { Logo, eyeFromCodex, logoCanvas } from './Logo';
import type { LoadedAssets } from './assets';
import { Mascot, type MascotTextures } from './Mascot';
import { Particles } from './Particles';
import { showIntro } from '../ui/Intro';
import { Overlays, winTier } from './Overlays';
import { ReelBoard } from './ReelBoard';
import type { SymbolTextures } from './textures';

const PREFS_KEY = 'codex-infecta:prefs';
/** the gold of the frame, in world units */
const FRAME_OUTER_W = 1490;
const FRAME_OUTER_H = 847;
const FRAME_TOP = 65;
const UPRIGHT_LOGO_H = 340;
/** the painting of the queen */
const QUEEN_H = 1003;
const BOARD_Y = 186;
const WORLD_TOP = -172;
/** just under the frame: everything on screen stays clear of the console */
const WORLD_BOTTOM = BOARD_Y + BOARD_H + 142;
/** Cleopatra stands left of the reels, her cobra staff right beside the frame */
const MASCOT_X = -437;
const MASCOT_SCALE = 0.68;
const SHOW_MASCOT = true;
const WORLD_W = BOARD_W + 360;

const PANEL_W = 820;
const PANEL_H = 128;
const PANEL_MID = 276;
/** centre of the two cells either side of the strain */
const PANEL_CELL = PANEL_MID / 2 + (PANEL_W - PANEL_MID) / 4;

/** Bonus panel in the place of the title: spins on the left, the strains in their cartouche, the bonus total on the right. */
class FeatureBanner extends Container {
  private count = new Digits(54);
  private amount = new Digits(54);
  private times: Text;
  private icons = new Container();
  /** the strains the icons show: a new bonus can have another strain, with the same count */
  private shown = '';
  private caption: Text;
  private bar = new Graphics().roundRect(0, 0, 244, 4, 2).fill(0xf2c25a);
  private glow: Sprite;
  private spinGlow: Sprite;
  private gainGlow: Sprite;
  private gain = { v: 0 };
  private bet = 1;

  constructor(private tex: SymbolTextures) {
    super();
    const plate = new Sprite(slim(paintBonusPanel(PANEL_W, PANEL_H, PANEL_MID), 0.6));
    plate.anchor.set(0.5);
    plate.scale.set(0.5);
    const caps = (size: number, fill: number) => ({
      fontFamily: 'Cinzel, serif',
      fontWeight: '900' as const,
      fontSize: size,
      fill,
      letterSpacing: size * 0.1,
      dropShadow: { color: 0x000000, blur: 3, distance: 2, angle: Math.PI / 2, alpha: 0.9 },
    });
    const cellGlow = (x: number, w: number, h: number, tint: number) => {
      const g = new Sprite(tex.glow);
      g.anchor.set(0.5);
      g.position.set(x, 0);
      g.width = w;
      g.height = h;
      g.blendMode = 'add';
      g.tint = tint;
      g.alpha = 0;
      return g;
    };
    this.spinGlow = cellGlow(-PANEL_CELL, 300, 150, 0xffc860);
    this.gainGlow = cellGlow(PANEL_CELL, 300, 150, 0xffc860);
    this.caption = new Text({ text: 'TOURS GRATUITS', style: caps(19, 0xe8c878) });
    this.caption.anchor.set(0.5);
    this.caption.position.set(-PANEL_CELL, -40);
    this.count.position.set(-PANEL_CELL, 2);
    const total = new Text({ text: 'GAIN BONUS', style: caps(19, 0xe8c878) });
    total.anchor.set(0.5);
    total.position.set(PANEL_CELL, -40);
    this.amount.position.set(PANEL_CELL, 2);
    this.times = new Text({ text: '', style: caps(17, 0xfff0c8) });
    this.times.anchor.set(0.5);
    this.times.position.set(PANEL_CELL, 44);
    const strains = new Text({ text: 'SOUCHE', style: caps(17, 0xe8c878) });
    strains.anchor.set(0.5);
    strains.position.set(0, -68);
    this.icons.position.set(0, 12);
    // how far through the free spins we are
    const track = new Graphics().roundRect(-124, 0, 248, 7, 3.5).fill(0x050a1e).stroke({ width: 1, color: 0xc08a30 });
    track.position.set(-PANEL_CELL, 41);
    this.bar.position.set(-PANEL_CELL - 122, 42.5);
    this.bar.scale.x = 0;
    this.glow = cellGlow(0, 300, 210, 0xffb040);
    this.glow.position.y = 12;
    this.glow.alpha = 0.3;
    gsap.to(this.glow, { alpha: 0.5, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.addChild(plate, this.spinGlow, this.gainGlow, this.caption, this.count, track, this.bar, total, this.amount, this.times, strains, this.glow, this.icons);
    this.visible = false;
  }

  set(spin: number, total: number, specials: Sym[]): void {
    this.count.text = `${spin}/${total}`;
    gsap.to(this.bar.scale, { x: Math.min(1, spin / Math.max(1, total)), duration: 0.35, ease: 'power2.out' });
    const key = specials.join();
    if (key !== this.shown) {
      this.shown = key;
      this.icons.removeChildren().forEach((c) => c.destroy());
      const size = [118, 104, 86][Math.min(2, specials.length - 1)];
      specials.forEach((s, i) => {
        const sp = new Sprite(this.tex.normal[s]);
        sp.anchor.set(0.5);
        sp.width = sp.height = size;
        sp.x = (i - (specials.length - 1) / 2) * (size - 2);
        this.icons.addChild(sp);
        gsap.from(sp, { alpha: 0, duration: 0.4 });
      });
    }
  }

  private showGain(v: number): void {
    this.amount.value = v;
    this.amount.scale.set(Math.min(1, 236 / Math.max(1, this.amount.inkWidth)));
  }

  private showTimes(v: number): void {
    this.times.text = v >= this.bet ? `×${Math.floor(v / this.bet)} LA MISE` : '';
  }

  /** The bonus total as it stands, without a count. */
  setGain(v: number, bet: number): void {
    this.bet = bet;
    gsap.killTweensOf(this.gain);
    this.gain.v = v;
    this.showGain(v);
    this.showTimes(v);
  }

  /** The gold arrives from the reels: the total climbs and its cell lights up. */
  rollGain(to: number): void {
    gsap.killTweensOf(this.gain);
    gsap.to(this.gain, { v: to, duration: 0.6, ease: 'power2.out', onUpdate: () => this.showGain(this.gain.v), onComplete: () => this.showTimes(to) });
    gsap.killTweensOf(this.gainGlow);
    gsap.fromTo(this.gainGlow, { alpha: 0.9 }, { alpha: 0, duration: 0.8, ease: 'power2.out' });
  }

  /** Where the gold of a win lands on screen. */
  get gainPoint(): { x: number; y: number } {
    return this.amount.toGlobal({ x: 0, y: 0 });
  }

  /** The press has counted: the cell of the spins answers with a little light. */
  bump(): void {
    gsap.killTweensOf(this.spinGlow);
    gsap.fromTo(this.spinGlow, { alpha: 0.6 }, { alpha: 0, duration: 0.5, ease: 'power2.out' });
  }

  /** The next free spin is the player's to launch: the banner says so, for anyone new to the game. */
  setAwaiting(on: boolean, last = false): void {
    gsap.killTweensOf(this.caption);
    this.caption.alpha = 1;
    this.caption.text = last ? 'DERNIER TOUR' : on ? 'À VOUS DE LANCER' : 'TOURS GRATUITS';
    this.caption.style.fill = last ? 0xff9a70 : on ? 0xfff0c8 : 0xe8c878;
    if (on) gsap.to(this.caption, { alpha: 0.45, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  /** The strain has just taken a reel. */
  flash(): void {
    gsap.killTweensOf(this.glow);
    gsap.fromTo(this.glow, { alpha: 1 }, { alpha: 0.3, duration: 0.7, ease: 'power2.out', onComplete: () => void gsap.to(this.glow, { alpha: 0.5, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' }) });
  }
}

export class Game {
  private server = new GameServer();
  private audio = new Audio();
  private scene = new Container();
  private world = new Container();
  private bg: Background;
  private board: ReelBoard;
  private logo: Logo;
  /** the capstone blazes right behind the logo: this keeps its letters readable */
  private logoShade: Sprite;
  private banner: FeatureBanner;
  private overlays: Overlays;
  private hud: Hud;
  private paytable: Paytable;
  private shock = new ShockwaveFilter({ center: { x: 0, y: 0 }, amplitude: 16, wavelength: 180, speed: 1100, brightness: 1.04, radius: -1 });
  private busy = false;
  private turbo = false;
  private sound = true;
  private autoLeft = 0;
  private viewW = 0;
  private viewH = 0;

  constructor(
    private app: Application,
    tex: SymbolTextures,
    codexCanvas: HTMLCanvasElement,
    mascotTex: MascotTextures,
    assets: LoadedAssets,
    templeNight: HTMLImageElement,
    templeInfected: HTMLImageElement,
    logoImage: HTMLImageElement,
  ) {
    this.bg = new Background(tex.spore, tex.glow, templeNight, templeInfected, assets.background);
    this.bg.onLightning = (power) => this.audio.lightning(power);
    this.board = new ReelBoard(tex, BASE_STRIPS);
    this.board.position.set(0, BOARD_Y);
    this.board.onIgnite = (r) => this.audio.ignite(r);
    const logoArt = logoCanvas(eyeFromCodex(codexCanvas, codexCanvas.width), assets.logo ?? logoImage);
    this.logo = new Logo(logoArt);
    this.logo.position.set(BOARD_W / 2, -18);
    this.logo.homeX = BOARD_W / 2;
    this.banner = new FeatureBanner(tex);
    this.banner.position.set(BOARD_W / 2, 0);
    this.teaser = this.buildTeaser(tex);
    this.mascot = new Mascot(mascotTex);
    this.mascot.scale.set(MASCOT_SCALE);
    this.mascot.position.set(MASCOT_X, WORLD_BOTTOM);
    this.mascot.setBook(tex.normal[Sym.CODEX]);
    this.mascotFx = new Particles(tex);
    this.mascot.onTransform = (to) => {
      if (!this.mascot.visible) return;
      const x = this.mascot.x + 110 * this.mascot.scale.x;
      const y = this.mascot.y - 830 * this.mascot.scale.y;
      this.mascotFx.impact(x, y, 1.6);
      this.mascotFx.burst(x, y, 30, 1.1);
      this.audio.stinger(to === 'inhuman' ? 2 : 0);
      this.bg.thump(to === 'inhuman' ? 0.4 : 0.15);
    };
    this.logoShade = new Sprite(tex.glow);
    this.logoShade.anchor.set(0.5);
    this.logoShade.tint = 0x050208;
    this.logoShade.alpha = 0.7;
    this.world.addChild(this.logoShade, this.logo, this.banner, this.board, this.mascot, this.teaser, this.mascotFx);
    this.scene.addChild(this.bg, this.world);
    this.overlays = new Overlays(tex, this.audio, {
      shockwave: () => this.shockwave(),
      glitch: (p) => this.logo.glitch(p),
      thump: (p) => this.bg.thump(p),
    });
    // bloom: emissive bits (eyes, veins, orb, neon, glows) radiate
    if (!LITE) {
      this.bloom.resolution = app.renderer.resolution;
      this.scene.filters = [this.bloom];
    }
    this.shock.resolution = app.renderer.resolution;
    app.stage.addChild(this.scene, this.overlays);

    this.hud = new Hud({
      spin: () => this.onSpinPressed(),
      betDelta: (d) => this.changeBet(d),
      toggleTurbo: () => {
        this.turbo = !this.turbo;
        this.hud.setTurbo(this.turbo);
        this.audio.click();
        this.savePrefs();
      },
      toggleSound: () => {
        this.sound = !this.sound;
        this.audio.setMuted(!this.sound);
        this.hud.setSound(this.sound);
        this.savePrefs();
      },
      openInfo: () => {
        this.audio.click();
        this.paytable.open(this.server.bet, this.best);
      },
      auto: (n) => {
        this.audio.click();
        this.autoLeft = n;
        this.hud.setAuto(n);
        if (n > 0 && !this.busy) void this.play();
      },
      refill: () => {
        this.server.refill();
        this.refreshHud();
      },
      buy: () => {
        this.audio.click();
        this.autoLeft = 0;
        this.hud.setAuto(0);
        void this.play(true);
      },
    });
    this.paytable = new Paytable(tex.images);
    document.body.append(this.hud.root, this.paytable.root);

    // the reels themselves answer a touch: they launch the waiting free spin and stop a spin in progress
    this.board.eventMode = 'static';
    this.board.hitArea = new Rectangle(-FRAME_MARGIN_X, -FRAME_MARGIN_Y, BOARD_W + FRAME_MARGIN_X * 2, BOARD_H + FRAME_MARGIN_Y * 2);
    this.board.on('pointertap', () => this.busy && this.onSpinPressed());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        // a key held down must not run through the player's free spins or skip a big win
        if (e.repeat && (this.spinGate || this.overlays.busy)) return;
        if (this.paytable.isOpen) this.paytable.close();
        else if (!this.hud.buyOpen) this.onSpinPressed();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      this.paytable.close();
      this.hud.closeMenus();
    });
    document.addEventListener('visibilitychange', () => this.audio.setHidden(document.hidden));
    const unlock = () => this.audio.unlock();
    // Safari only lets sound start on the end of a touch, not on its beginning
    for (const e of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(e, unlock);
    // on a phone the game takes the whole screen where the browser allows it (not on an iPhone)
    if (LITE) window.addEventListener('pointerup', () => void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}), { once: true });

    app.ticker.add((t) => this.update(t.deltaMS));
    window.addEventListener('resize', () => this.layout());
    new ResizeObserver(() => this.layout()).observe(this.hud.root);
    this.layout();
    this.refreshHud();
    this.loadPrefs();
    this.hud.setBuyArt(tex.images[Sym.CODEX]);

    showIntro(logoArt.toDataURL('image/png'), tex.images, () => {
      this.audio.unlock();
      this.logo.glitch(2);
      this.bg.flash();
      if (this.server.state.pending) void this.resume(this.server.state.pending);
    });
  }

  /** Dev console helper: game.debug('win' | 'feature' | 'big' | 'retrigger' | 'expand'). */
  debug(kind: 'win' | 'feature' | 'big' | 'retrigger' | 'expand'): void {
    if (!import.meta.env.DEV) return;
    const preds: Record<string, (r: Round) => boolean> = {
      win: (r) => !r.feature && r.totalWin >= r.bet * 3 && r.totalWin < r.bet * 15,
      feature: (r) => !!r.feature,
      big: (r) => !r.feature && r.totalWin >= r.bet * 40,
      retrigger: (r) => !!r.feature?.spins.some((s) => s.retrigger?.mutation != null),
      expand: (r) => !!r.feature && r.feature.win >= r.bet * 100,
    };
    this.server.force = preds[kind];
    void this.play();
  }

  private teaser: Container;
  private mascot: Mascot;
  private mascotFx: Particles;

  /** Portrait-only reminder of the feature, filling the space under the reels. */
  private buildTeaser(tex: SymbolTextures): Container {
    const c = new Container();
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(tex.normal[Sym.CODEX]);
      s.anchor.set(0.5);
      s.width = s.height = 164;
      s.position.set((i - 1) * 142, -158);
      s.rotation = (i - 1) * 0.12;
      c.addChild(s);
    }
    const t = new Text({
      text: '10 TOURS\nGRATUITS',
      style: {
        fontFamily: 'Cinzel, "Luckiest Guy", serif', fontWeight: '900' as const,
        fontSize: 92,
        lineHeight: 100,
        align: 'center',
        fill: COLORS.yellow,
        stroke: { color: COLORS.ink, width: 14, join: 'round' },
        dropShadow: { color: COLORS.ink, blur: 0, distance: 7, angle: Math.PI / 2, alpha: 1 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(0, 20);
    const sub = new Text({
      text: 'LA SOUCHE ENVAHIT\nTOUT LE ROULEAU',
      style: { fontFamily: 'Nunito, sans-serif', fontWeight: '900' as const, fontSize: 44, lineHeight: 52, align: 'center', fill: 0xfff0d0, stroke: { color: COLORS.ink, width: 9, join: 'round' } },
    });
    sub.anchor.set(0.5);
    sub.position.set(0, 180);
    c.addChild(t, sub);
    c.visible = false;
    return c;
  }

  private layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    // the console's gold rail stands 24 px above it
    const hudH = (this.hud.root.getBoundingClientRect().height || 120) + 24;
    const availH = h - hudH;
    if (w < h) this.layoutUpright(w, availH);
    else this.layoutWide(w, availH);
    this.bg.resize(w, h, hudH);
    this.overlays.resize(w, h, hudH);
  }

  /** Wide screens: the reels in the very middle, the queen on their left. */
  private layoutWide(w: number, availH: number): void {
    const scale = Math.min((w * 0.98) / WORLD_W, (availH * 0.985) / (WORLD_BOTTOM - WORLD_TOP));
    this.teaser.visible = false;
    this.logo.scale.set(0.8);
    this.logo.y = -68;
    this.logoShade.position.set(this.logo.x, this.logo.y + 20);
    this.logoShade.width = 1000;
    this.logoShade.height = 380;
    this.banner.y = -68;
    this.banner.scale.set(1.1);
    this.world.scale.set(scale);
    this.world.pivot.set(BOARD_W / 2, (WORLD_TOP + WORLD_BOTTOM) / 2);
    this.world.position.set(w / 2, availH / 2);
    // shown when her face is on screen (the veil and arm may run off the left edge)
    const faceX = (MASCOT_X + 113 * MASCOT_SCALE - BOARD_W / 2) * scale + w / 2;
    this.mascot.x = MASCOT_X;
    this.mascot.scale.set(MASCOT_SCALE);
    this.mascot.y = WORLD_BOTTOM;
    this.mascot.visible = SHOW_MASCOT && faceX > 40;
  }

  /**
   * Upright screens are read from the top: the logo, the reels as wide as the screen allows, and in
   * whatever room is left above the console, the queen and the reminder of the feature.
   */
  private layoutUpright(w: number, availH: number): void {
    const inset = 16;
    const scale = Math.min((w * 0.985) / FRAME_OUTER_W, (availH - inset) / (UPRIGHT_LOGO_H + FRAME_OUTER_H));
    let room = (availH - inset) / scale - UPRIGHT_LOGO_H - FRAME_OUTER_H;
    // on very tall screens the slack goes above the logo, so the queen is not left floating
    const slack = Math.max(0, room - QUEEN_H * 1.2);
    room -= slack * 0.45;
    this.world.scale.set(scale);
    this.world.pivot.set(BOARD_W / 2, 0);
    this.world.position.set(w / 2, inset + (slack * 0.45 + UPRIGHT_LOGO_H - FRAME_TOP) * scale);
    const logoY = FRAME_TOP - UPRIGHT_LOGO_H / 2;
    this.logo.scale.set(1.3);
    this.logo.y = logoY;
    this.logoShade.position.set(this.logo.x, logoY + 20);
    this.logoShade.width = 1500;
    this.logoShade.height = 520;
    this.banner.y = logoY;
    this.banner.scale.set(1.75);
    const frameBottom = FRAME_TOP + FRAME_OUTER_H;
    const shown = room > 300;
    const k = Math.max(0.6, Math.min(1.2, room / (QUEEN_H * 0.8)));
    this.mascot.visible = SHOW_MASCOT && shown;
    this.mascot.scale.set(k);
    this.mascot.x = BOARD_W * 0.76;
    // cut by the console at the thighs, her head always clear of the frame
    this.mascot.y = Math.max(frameBottom + room + QUEEN_H * k * 0.2, frameBottom - 8 + QUEEN_H * k);
    this.teaser.visible = shown && !this.inFeature;
    this.teaser.scale.set(Math.max(0.62, Math.min(1.05, room / 620)));
    this.teaser.position.set(BOARD_W * 0.15, frameBottom + room / 2 - 4);
  }

  /** Time warp for hit-stops (1 = normal). */
  private warp = 1;

  /** The third pyramid lands: a flash and (on the last reel) a short freeze-frame. */
  private triggerHit(freeze: boolean): void {
    this.bg.thump(0.5);
    if (!freeze) return;
    this.warp = 0.06;
    gsap.globalTimeline.timeScale(0.06);
    window.setTimeout(() => {
      const start = performance.now();
      const ramp = () => {
        const k = Math.min(1, (performance.now() - start) / 260);
        this.warp = 0.06 + (1 - 0.06) * k * k;
        gsap.globalTimeline.timeScale(this.warp);
        if (k < 1) requestAnimationFrame(ramp);
      };
      ramp();
    }, 170);
  }

  /** 0 full, 1 no god rays, 2 no bloom either (on a phone: fewer pixels). The game steps down by itself on a slow machine. */
  private quality = 0;
  private frameAvg = 16;
  private frameCount = 0;

  private watchFrameRate(dt: number): void {
    // a long gap is a hidden tab or a one-off hitch, not the machine's real speed
    if (dt > 120 || document.hidden) return;
    this.frameAvg += (dt - this.frameAvg) * 0.04;
    if (++this.frameCount < 300 || this.frameAvg < 28 || this.quality >= 2) return;
    this.frameCount = 0;
    this.frameAvg = 16;
    this.quality++;
    if (this.quality === 1) this.bg.setRays(false);
    else if (LITE) this.app.renderer.resize(this.viewW, this.viewH, 1);
    else this.scene.filters = [];
  }

  /** wins in a row: each one sings a little higher */
  private streak = 0;

  private update(dt: number): void {
    this.watchFrameRate(dt);
    dt *= this.warp;
    this.board.update(dt);
    this.mascotFx.update(dt);
    this.bg.update(dt);
    this.overlays.update(dt);
  }

  private bloom = new AdvancedBloomFilter({ threshold: 0.7, bloomScale: 0.6, brightness: 1, blur: 5, quality: 2 });

  private shockwave(): void {
    if (LITE) return;
    this.shock.center = { x: this.viewW / 2, y: this.viewH / 2 };
    this.shock.time = 0;
    this.scene.filters = this.quality >= 2 ? [this.shock] : [this.bloom, this.shock];
    gsap.killTweensOf(this.shock);
    gsap.to(this.shock, {
      time: 1.4,
      duration: 1.4,
      ease: 'none',
      onComplete: () => {
        this.scene.filters = this.quality >= 2 ? [] : [this.bloom];
      },
    });
  }

  /** the player's biggest win, in times the bet */
  private best = 0;

  private isRecord(round: Round): boolean {
    return round.totalWin / round.bet > this.best;
  }

  /** Sound, turbo and the record stay as the player left them. */
  private loadPrefs(): void {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { sound?: boolean; turbo?: boolean; best?: number };
      this.sound = p.sound ?? true;
      this.turbo = p.turbo ?? false;
      this.best = p.best ?? 0;
    } catch {
      /* storage unavailable */
    }
    this.audio.setMuted(!this.sound);
    this.hud.setSound(this.sound);
    this.hud.setTurbo(this.turbo);
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: this.sound, turbo: this.turbo, best: this.best }));
    } catch {
      /* storage unavailable */
    }
  }

  private refreshHud(): void {
    const i = this.server.state.betIndex;
    this.hud.setBalance(this.server.state.balance);
    this.hud.setBet(BET_LEVELS[i], i > 0 && !this.busy, i < BET_LEVELS.length - 1 && !this.busy);
    this.hud.setRefill(!this.busy && this.server.state.balance < this.server.bet);
    this.hud.setBuy(this.server.bonusPrice, !this.busy && this.server.state.balance >= this.server.bonusPrice);
  }

  private changeBet(d: number): void {
    if (this.busy) return;
    this.server.setBetIndex(this.server.state.betIndex + d);
    this.audio.click();
    this.refreshHud();
  }

  /** set while a free spin is waiting for the player's press */
  private spinGate: (() => void) | null = null;

  /** A free spin never starts by itself, autoplay or not. */
  private waitForPress(last: boolean): Promise<void> {
    this.hud.setAwaiting(true);
    this.banner.setAwaiting(true, last);
    if (last) this.audio.lastSpin();
    return new Promise((resolve) => (this.spinGate = resolve));
  }

  private onSpinPressed(): void {
    this.audio.unlock();
    if (this.spinGate) {
      const go = this.spinGate;
      this.spinGate = null;
      this.hud.setAwaiting(false);
      this.banner.setAwaiting(false);
      go();
      return;
    }
    if (this.overlays.busy) {
      this.overlays.skip();
      return;
    }
    if (this.busy) {
      this.board.hurry();
      return;
    }
    if (this.autoLeft > 0) {
      this.autoLeft = 0;
      this.hud.setAuto(0);
      return;
    }
    void this.play();
  }

  private async play(bought = false): Promise<void> {
    if (this.busy) return;
    if (this.server.state.balance < (bought ? this.server.bonusPrice : this.server.bet)) {
      this.autoLeft = 0;
      this.hud.setAuto(0);
      this.refreshHud();
      return;
    }
    this.busy = true;
    this.hud.setSpinning(true);
    this.hud.setWin(0);
    this.refreshHud();
    let round: Round;
    try {
      round = await this.server.spin(bought);
    } catch {
      this.busy = false;
      this.hud.setSpinning(false);
      this.refreshHud();
      return;
    }
    this.hud.setBalance(this.server.state.balance);
    if (round.base.win <= round.bet) this.streak = 0;
    this.audio.spinStart();
    this.hud.pulseSpin();
    this.mascot.react('spin');

    await this.spinTo(round.base.grid, null);
    await this.presentOutcome(round.base, round.bet, 0, false);

    if (round.feature) await this.runFeature(round, 0);
    else {
      const tier = winTier(round.totalWin, round.bet);
      if (tier >= 0) {
        this.mascot.react('big');
        if (this.mascot.visible) await this.sleep(900);
        await this.overlays.bigWin(round.totalWin, round.bet, (v) => this.hud.setWin(v), this.isRecord(round));
      }
    }
    this.finishRound(round);
  }

  private finishRound(round: Round): void {
    this.server.settle();
    this.hud.setWin(round.totalWin);
    if (this.isRecord(round)) {
      this.best = round.totalWin / round.bet;
      this.savePrefs();
    }
    this.busy = false;
    this.hud.setSpinning(false);
    this.refreshHud();
    if (this.autoLeft > 0) {
      this.autoLeft--;
      this.hud.setAuto(this.autoLeft);
      if (this.autoLeft > 0) setTimeout(() => void this.play(), round.totalWin > 0 ? 550 : 120);
    }
  }

  /** Spins the reels with anticipation on reels that could complete a codex trigger or a strain expansion. */
  private async spinTo(grid: Grid, specials: Sym[] | null): Promise<void> {
    const anticipate: number[] = [];
    let codex = 0;
    const specialReels = new Map<Sym, number>();
    for (let r = 0; r < REELS; r++) {
      const hot = codex >= 2 || (specials ?? []).some((s) => (specialReels.get(s) ?? 0) >= Math.max(2, minCount(s) - 1));
      if (r >= 2 && hot) anticipate.push(r);
      codex += grid[r].filter((s) => s === Sym.CODEX).length;
      for (const s of specials ?? []) if (grid[r].includes(s)) specialReels.set(s, (specialReels.get(s) ?? 0) + 1);
    }
    let landedCodex = 0;
    let playedRiser = false;
    await this.board.spin({
      grid,
      turbo: this.turbo,
      anticipate,
      onReelStop: (r) => {
        this.audio.reelStop(r);
        navigator.vibrate?.(r === REELS - 1 ? 16 : 7);
        for (let row = 0; row < ROWS; row++) {
          const s = grid[r][row];
          if (s === Sym.CODEX) {
            landedCodex++;
            this.audio.codex(landedCodex);
            this.mascot.react('codex');
            this.board.popCell(r, row);
            if (landedCodex === 3) this.triggerHit(r === REELS - 1);
            else if (landedCodex > 3) this.bg.thump(0.25);
          } else if (specials?.includes(s)) {
            this.board.popCell(r, row, COLORS.bone);
          }
        }
        const next = r + 1;
        if (anticipate.includes(next) && !playedRiser) {
          playedRiser = true;
          this.audio.anticipation(this.turbo ? 1 : 1.6);
        }
      },
    });
  }

  private async presentOutcome(o: SpinOutcome, bet: number, already: number, inFeature: boolean): Promise<void> {
    const label = inFeature ? 'Gain bonus' : 'Gain';
    const lineSum = o.lineWins.reduce((a, w) => a + w.win, 0) + (o.scatter?.win ?? 0);
    let shown = already;
    if (lineSum > 0) {
      // Wins at or below the stake are shown plainly, without celebration (no "loss disguised as a win").
      const celebrate = lineSum > bet;
      const size = lineSum >= bet * 5 ? 2 : lineSum > bet ? 1 : 0;
      if (celebrate) {
        this.streak++;
        this.audio.win(size, this.streak);
        this.bg.flare(0.45 + size * 0.2);
        this.board.coinBurst(size * 8);
        this.audio.coins(6 + size * 8);
      }
      else this.audio.tick();
      shown += lineSum;
      this.hud.rollWin(shown, celebrate ? 900 : 300, label);
      if (celebrate) this.board.showWinBurst(lineSum, size);
      if (inFeature) this.sendToPanel(shown, celebrate ? 0.9 : 0.2);
      if (celebrate) this.mascot.react('win');
      await this.board.presentWins(o.lineWins, o.scatter, celebrate, () => this.audio.tick());
    }
    for (const exp of o.expansions) {
      await this.board.expand(exp, () => {
        this.banner.flash();
        this.audio.expand();
      });
      shown += exp.win;
      this.hud.rollWin(shown, 900, label);
      this.audio.win(exp.win >= bet * 5 ? 2 : 1);
      this.sendToPanel(shown, 0);
    }
  }

  /** The gold of a win flies from the reels to the bonus total. */
  private sendToPanel(total: number, delay: number): void {
    this.board.flyGold(this.board.toLocal(this.banner.gainPoint), delay, () => {
      this.banner.rollGain(total);
      this.audio.gainLand();
    });
  }

  private async runFeature(round: Round, startAt: number): Promise<void> {
    const f = round.feature!;
    const firstSpecials = f.spins[0]?.specials.slice(0, 1) ?? [f.special];
    if (startAt === 0) {
      await this.sleep(this.turbo ? 200 : 450);
      // the pyramids on the reels wake the great one: a thread of gold from each to the capstone…
      await this.board.callTemple(this.board.toLocal(this.bg.apexOnScreen()), (i) => this.audio.templeCall(i));
      // …Cleopatra is taken by the infection, the infection spreads over the temple…
      this.mascot.react('feature');
      this.bg.setFeature(true);
      await this.sleep(1600);
      // …and the camera dives into the pyramid
      this.audio.stoneDoor(1.6);
      gsap.to(this.world, { alpha: 0, duration: 0.5, ease: 'power2.in' });
      gsap.to(this.hud.root, { opacity: 0, duration: 0.4 });
      await this.bg.zoomTo(4.2, 1.1);
      await this.overlays.corridor(this.turbo ? 1.2 : 2.2);
      this.bg.camera.k = 1;
      this.layout();
      gsap.to(this.world, { alpha: 1, duration: 0.6 });
      gsap.to(this.hud.root, { opacity: 1, duration: 0.6 });
      await this.overlays.featureIntro(f.special, 10, true);
    }
    this.enterFeature(true);
    this.board.clearWins();
    this.board.reels.forEach((r) => r.setStrip(FREE_STRIPS[this.board.reels.indexOf(r)]));
    const resumeSpin = f.spins[startAt - 1];
    this.banner.set(startAt, resumeSpin?.total ?? 10, resumeSpin?.specials ?? firstSpecials);
    let featureWin = resumeSpin?.featureWin ?? 0;
    this.hud.setWin(featureWin, 'Gain bonus');
    this.banner.setGain(featureWin, round.bet);
    let bestSpin = f.spins.slice(0, startAt).reduce((a, s) => Math.max(a, s.win), 0);

    for (let i = startAt; i < f.spins.length; i++) {
      const s: FreeSpinOutcome = f.spins[i];
      const before = f.spins[i - 1]?.specials ?? firstSpecials;
      const total = i === 0 ? 10 : f.spins[i - 1].total;
      await this.waitForPress(s.index === total);
      // the count moves on the press, not at the end of the spin before
      this.banner.set(s.index, total, before);
      this.banner.bump();
      this.audio.spinStart();
      this.hud.pulseSpin();
      await this.spinTo(s.grid, before);
      await this.presentOutcome(s, round.bet, featureWin, true);
      featureWin = s.featureWin;
      bestSpin = Math.max(bestSpin, s.win);
      this.hud.setWin(featureWin, 'Gain bonus');
      if (winTier(s.win, round.bet) >= 0) await this.overlays.bigWin(s.win, round.bet);
      if (s.retrigger) {
        await this.overlays.retrigger(s.retrigger.spins, s.retrigger.mutation, before);
        this.banner.set(s.index, s.total, s.specials);
      }
      this.server.markFreeSpinShown(i + 1);
    }
    await this.sleep(this.turbo ? 300 : 700);
    this.board.clearWins();
    await this.overlays.featureOutro(f.win, f.spins.length, round.bet, bestSpin, this.isRecord(round), (v) => this.hud.setWin(v, 'Gain bonus'));
    this.enterFeature(false);
    this.board.reels.forEach((r, i) => r.setStrip(BASE_STRIPS[i]));
  }

  private inFeature = false;

  private enterFeature(on: boolean): void {
    if (!on) this.mascot.setForm('human');
    else if (this.mascot.form !== 'inhuman') this.mascot.setForm('inhuman', false);
    this.inFeature = on;
    this.layout();
    this.bg.setFeature(on);
    this.board.setFeature(on);
    this.audio.setFeature(on);
    this.hud.setFeature(on);
    this.banner.visible = true;
    gsap.to(this.logo, { alpha: on ? 0 : 1, duration: 0.5 });
    gsap.to(this.logoShade, { alpha: on ? 0 : 0.7, duration: 0.5 });
    gsap.to(this.banner, { alpha: on ? 1 : 0, duration: 0.5, onComplete: () => (this.banner.visible = on) });
  }

  /** Round recovery: a reload in the middle of a round picks it up where it was left. */
  private async resume(round: Round): Promise<void> {
    this.busy = true;
    this.hud.setSpinning(true);
    this.refreshHud();
    round.base.grid.forEach((col, r) => col.forEach((s, row) => this.board.reels[r].setSymbol(row + 1, s)));
    await this.overlays.message('REPRISE DE LA PARTIE', 1800);
    if (round.feature && this.server.state.shownFreeSpins < round.feature.spins.length) {
      await this.runFeature(round, this.server.state.shownFreeSpins);
    }
    this.finishRound(round);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
