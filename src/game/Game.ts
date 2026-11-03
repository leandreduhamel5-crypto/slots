import { Application, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import gsap from 'gsap';
import { BASE_STRIPS, BET_LEVELS, FREE_STRIPS, REELS, ROWS, Sym, minCount } from '../math/config';
import type { FreeSpinOutcome, Grid, Round, SpinOutcome } from '../math/engine';
import { GameServer } from '../server/GameServer';
import { LITE } from './device';
import { Hud } from '../ui/Hud';
import { Paytable } from '../ui/Paytable';
import { Audio } from './Audio';
import { Background } from './Background';
import { Digits } from './Digits';
import { BOARD_H, BOARD_W, COLORS, FRAME_MARGIN_X, FRAME_MARGIN_Y } from './layout';
import { Logo, eyeFromCodex, logoCanvas } from './Logo';
import type { LoadedAssets } from './assets';
import { setShowIntro, showIntro, showsIntro } from '../ui/Intro';
import { Overlays, winTier } from './Overlays';
import { ReelBoard } from './ReelBoard';
import { STRAIN_BAR_H, STRAIN_BAR_W, StrainBar, makePlate, sizePlate } from './StrainBar';
import type { SymbolTextures } from './textures';

const PREFS_KEY = 'codex-infecta:prefs';
/** the gold of the frame, in world units */
const FRAME_OUTER_W = 1490;
const FRAME_OUTER_H = 847;
const FRAME_TOP = 65;
const UPRIGHT_LOGO_H = 420;
/** room beside the frame from which the bonus for sale stands there and not in the console */
const SIDE_BUY_ROOM = 190;
const BOARD_Y = 186;
const WORLD_TOP = -172;
/** just under the frame: everything on screen stays clear of the console */
const WORLD_BOTTOM = BOARD_Y + BOARD_H + 142;
const WORLD_W = BOARD_W + 360;

const CELL_W = 300;
const CELL_H = 128;
/** on an upright screen the two cells stand above the bar, lower and wider */
const STACK_CELL_W = (STRAIN_BAR_W - 8) / 2;
const STACK_CELL_H = 92;

/** Bonus panel in the place of the title: the spins and the bonus total, either side of the bar of the strains. */
class FeatureBanner extends Container {
  private spins = new Container();
  private total = new Container();
  private spinPlate = makePlate(CELL_W, CELL_H);
  private totalPlate = makePlate(CELL_W, CELL_H);
  private count = new Digits(54);
  private amount = new Digits(54);
  private amountMax = 1;
  private times: Text;
  private totalCaption: Text;
  private caption: Text;
  private strains: StrainBar;
  private track = new Graphics().roundRect(-124, 0, 248, 7, 3.5).fill(0x050a1e).stroke({ width: 1, color: 0xc08a30 });
  private bar = new Graphics().roundRect(0, 0, 244, 4, 2).fill(0xf2c25a);
  private spinGlow: Sprite;
  private gainGlow: Sprite;
  private lit: Sym[] = [];
  private gain = { v: 0 };
  private bet = 1;

  constructor(tex: SymbolTextures) {
    super();
    const caps = (size: number, fill: number) => ({
      fontFamily: 'Cinzel, serif',
      fontWeight: '900' as const,
      fontSize: size,
      fill,
      letterSpacing: size * 0.1,
      dropShadow: { color: 0x000000, blur: 3, distance: 2, angle: Math.PI / 2, alpha: 0.9 },
    });
    const cellGlow = () => {
      const g = new Sprite(tex.glow);
      g.anchor.set(0.5);
      g.width = 300;
      g.height = 150;
      g.blendMode = 'add';
      g.tint = 0xffc860;
      g.alpha = 0;
      return g;
    };
    this.spinGlow = cellGlow();
    this.gainGlow = cellGlow();
    this.caption = new Text({ text: 'TOURS GRATUITS', style: caps(19, 0xe8c878) });
    this.caption.anchor.set(0.5);
    this.totalCaption = new Text({ text: 'GAIN BONUS', style: caps(19, 0xe8c878) });
    this.totalCaption.anchor.set(0.5);
    this.times = new Text({ text: '', style: caps(17, 0xfff0c8) });
    this.times.anchor.set(0.5);
    this.bar.scale.x = 0;
    this.strains = new StrainBar(tex);
    this.spins.addChild(this.spinPlate, this.spinGlow, this.caption, this.count, this.track, this.bar);
    this.total.addChild(this.totalPlate, this.gainGlow, this.totalCaption, this.amount, this.times);
    this.addChild(this.spins, this.strains, this.total);
    this.visible = false;
  }

  /** In a row on a wide screen; the two cells above the bar on an upright one. */
  arrange(upright: boolean): void {
    const w = upright ? STACK_CELL_W : CELL_W;
    const h = upright ? STACK_CELL_H : CELL_H;
    sizePlate(this.spinPlate, w, h);
    sizePlate(this.totalPlate, w, h);
    const cellX = upright ? w / 2 + 4 : STRAIN_BAR_W / 2 + 10 + CELL_W / 2;
    const stack = (STACK_CELL_H + 8 + STRAIN_BAR_H) / 2;
    const cellY = upright ? STACK_CELL_H / 2 - stack : 0;
    this.spins.position.set(-cellX, cellY);
    this.total.position.set(cellX, cellY);
    this.strains.y = upright ? stack - STRAIN_BAR_H / 2 : 0;
    this.caption.y = this.totalCaption.y = upright ? -28 : -40;
    this.count.y = this.amount.y = upright ? 10 : 2;
    this.count.scale.set(upright ? 0.74 : 1);
    this.amountMax = upright ? 0.74 : 1;
    this.track.y = upright ? 32 : 41;
    this.bar.position.set(-122, this.track.y + 1.5);
    this.totalCaption.x = upright ? -76 : 0;
    this.times.position.set(upright ? 92 : 0, upright ? -28 : 44);
    this.showGain(this.gain.v);
  }

  /** The bonus starts: every strain goes back into the shadow. */
  reset(): void {
    this.lit = [];
    this.strains.set([]);
  }

  /** A strain has caught in the bar. */
  set onIgnite(fn: () => void) {
    this.strains.onIgnite = fn;
  }

  set(spin: number, total: number, specials: Sym[]): void {
    this.count.text = `${spin}/${total}`;
    gsap.to(this.bar.scale, { x: Math.min(1, spin / Math.max(1, total)), duration: 0.35, ease: 'power2.out' });
    for (const s of specials) if (!this.lit.includes(s)) this.strains.ignite(s);
    this.lit = [...specials];
  }

  private showGain(v: number): void {
    this.amount.value = v;
    this.amount.scale.set(Math.min(this.amountMax, 236 / Math.max(1, this.amount.inkWidth)));
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
  flash(s: Sym): void {
    this.strains.flash(s);
  }

  /** Where a strain sits in the bar, on screen. */
  strainPoint(s: Sym): { x: number; y: number } {
    return this.strains.pointOf(s);
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
  private busy = false;
  private turbo = false;
  private sound = true;
  private music = true;
  private autoLeft = 0;
  /** an automatic run stops under this balance, or on a single win of this much */
  private autoFloor = -Infinity;
  private autoCeiling = Infinity;
  private viewW = 0;
  private viewH = 0;

  constructor(
    private app: Application,
    private tex: SymbolTextures,
    codexCanvas: HTMLCanvasElement,
    assets: LoadedAssets,
    templeNight: HTMLImageElement,
    sands: { outside: HTMLImageElement; infected: HTMLImageElement; door: HTMLImageElement; hallMaps: HTMLImageElement[]; pyramidMaps: HTMLImageElement[] },
    logoImage: HTMLImageElement,
    corridorDoor: HTMLImageElement,
  ) {
    this.bg = new Background(tex.spore, tex.glow, templeNight, sands, assets.background);
    this.bg.onDoor = () => this.audio.stoneDoor(1.6);
    this.bg.onLightning = (power) => this.audio.lightning(power);
    this.board = new ReelBoard(tex, BASE_STRIPS);
    this.board.position.set(0, BOARD_Y);
    const logoArt = logoCanvas(eyeFromCodex(codexCanvas, codexCanvas.width), assets.logo ?? logoImage);
    this.logo = new Logo(logoArt);
    this.logo.position.set(BOARD_W / 2, -18);
    this.logo.homeX = BOARD_W / 2;
    this.banner = new FeatureBanner(tex);
    this.banner.onIgnite = () => this.audio.strainIgnite();
    this.banner.position.set(BOARD_W / 2, 0);
    this.teaser = this.buildTeaser(tex);
    this.logoShade = new Sprite(tex.glow);
    this.logoShade.anchor.set(0.5);
    this.logoShade.tint = 0x050208;
    this.logoShade.alpha = 0.7;
    this.strainShow.visible = false;
    this.world.addChild(this.logoShade, this.logo, this.banner, this.board, this.teaser, this.strainShow);
    this.scene.addChild(this.bg, this.world);
    this.overlays = new Overlays(tex, this.audio, {
      thump: (p) => this.bg.thump(p),
      wave: (p) => this.bg.wave(p),
    }, corridorDoor);
    // bloom: emissive bits (eyes, veins, orb, neon, glows) radiate
    if (!LITE) {
      this.bloom.resolution = app.renderer.resolution;
      this.scene.filters = [this.bloom];
    }
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
      setting: (key, on) => {
        if (key === 'sound') {
          this.sound = on;
          this.audio.setMuted(!on);
        } else if (key === 'music') {
          this.music = on;
          this.audio.setMusic(on);
        } else if (key === 'turbo') {
          this.turbo = on;
          this.hud.setTurbo(on);
        } else setShowIntro(on);
        this.audio.click();
        this.savePrefs();
      },
      report: () => ({
        settings: { sound: this.sound, music: this.music, turbo: this.turbo, intro: showsIntro() },
        history: this.server.history,
      }),
      openInfo: () => {
        this.audio.click();
        this.paytable.open(this.server.bet, this.best);
      },
      auto: (n, limits) => {
        this.audio.click();
        this.autoLeft = n;
        this.autoFloor = limits?.loss ? this.server.state.balance - limits.loss * this.server.bet : -Infinity;
        this.autoCeiling = limits?.win ? limits.win * this.server.bet : Infinity;
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
      hold: (on) => {
        this.holding = on;
        if (on && !this.busy) void this.play();
      },
      pickBet: (i) => {
        if (this.busy) return;
        this.server.setBetIndex(i);
        this.audio.click();
        this.refreshHud();
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
        if (e.repeat && this.spinGate === null && !this.overlays.busy && this.busy) return;
        if (e.repeat && (this.spinGate || this.overlays.busy)) return;
        if (this.paytable.isOpen) this.paytable.close();
        else if (!this.hud.modalOpen) this.onSpinPressed();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp') this.changeBet(1);
      else if (e.code === 'ArrowDown') this.changeBet(-1);
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
    this.hud.setBetLevels(BET_LEVELS);

    showIntro(logoArt.toDataURL('image/png'), tex.images, () => {
      this.audio.unlock();
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
  /** the strains at work, large, in the room an upright screen has under the reels */
  private strainShow = new Container();

  private showStrains(specials: Sym[]): void {
    const c = this.strainShow;
    c.removeChildren().forEach((o) => o.destroy());
    const size = specials.length > 1 ? 250 : 340;
    specials.forEach((s, i) => {
      const sp = new Sprite(this.tex.normal[s]);
      sp.anchor.set(0.5);
      sp.width = sp.height = size;
      sp.position.set((i - (specials.length - 1) / 2) * size, -80);
      c.addChild(sp);
    });
    const line = (text: string, size: number, y: number, fill: number) => {
      const t = new Text({ text, style: { fontFamily: 'Cinzel, serif', fontWeight: '900', fontSize: size, fill, letterSpacing: size * 0.08, stroke: { color: COLORS.ink, width: size * 0.16, join: 'round' } } });
      t.anchor.set(0.5);
      t.y = y;
      c.addChild(t);
    };
    line(specials.length > 1 ? 'SOUCHES ACTIVES' : 'SOUCHE ACTIVE', 62, 130, 0xffd98a);
    line('ENVAHIT TOUT LE ROULEAU', 40, 204, 0xfff0d0);
  }

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
    this.bg.resize(w, h);
    this.overlays.resize(w, h, hudH);
  }

  /** Wide screens: the reels in the very middle, the queen on their left. */
  private layoutWide(w: number, availH: number): void {
    const scale = Math.min((w * 0.98) / WORLD_W, (availH * 0.985) / (WORLD_BOTTOM - WORLD_TOP));
    this.teaser.visible = this.strainShow.visible = false;
    this.logo.scale.set(0.8);
    this.logo.y = -68;
    this.logoShade.position.set(this.logo.x, this.logo.y + 20);
    this.logoShade.width = 1000;
    this.logoShade.height = 380;
    this.banner.y = -68;
    this.banner.scale.set(1);
    this.banner.arrange(false);
    this.world.scale.set(scale);
    this.world.pivot.set(BOARD_W / 2, (WORLD_TOP + WORLD_BOTTOM) / 2);
    this.world.position.set(w / 2, availH / 2);
    const beside = (w - FRAME_OUTER_W * scale) / 2;
    this.hud.placeBuy(
      beside >= SIDE_BUY_ROOM
        ? { x: beside / 2 + 8, y: availH / 2 - 10, scale: Math.min(1.2, beside / 240, availH / 400) }
        : null,
    );
  }

  /**
   * Upright screens are read from the top: the logo, the reels as wide as the screen allows, and in
   * whatever room is left above the console, the decor and the reminder of the feature.
   */
  private layoutUpright(w: number, availH: number): void {
    this.hud.placeBuy(null);
    const inset = 16;
    const scale = Math.min((w * 0.985) / FRAME_OUTER_W, (availH - inset) / (UPRIGHT_LOGO_H + FRAME_OUTER_H));
    let room = (availH - inset) / scale - UPRIGHT_LOGO_H - FRAME_OUTER_H;
    // on very tall screens the slack goes above the logo
    const slack = Math.max(0, room - 1200);
    room -= slack * 0.45;
    this.world.scale.set(scale);
    this.world.pivot.set(BOARD_W / 2, 0);
    this.world.position.set(w / 2, inset + (slack * 0.45 + UPRIGHT_LOGO_H - FRAME_TOP) * scale);
    const logoY = FRAME_TOP - UPRIGHT_LOGO_H / 2;
    this.logo.scale.set(1.5);
    this.logo.y = logoY;
    this.logoShade.position.set(this.logo.x, logoY + 20);
    this.logoShade.width = 1500;
    this.logoShade.height = 520;
    this.banner.y = logoY;
    this.banner.scale.set(1.8);
    this.banner.arrange(true);
    const frameBottom = FRAME_TOP + FRAME_OUTER_H;
    this.teaser.visible = room > 300 && !this.inFeature;
    this.teaser.scale.set(Math.max(0.5, Math.min(1, room / 860)));
    this.teaser.position.set(BOARD_W / 2, frameBottom + room * 0.72);
    this.strainShow.visible = room > 300 && this.inFeature;
    this.strainShow.scale.copyFrom(this.teaser.scale);
    this.strainShow.position.copyFrom(this.teaser.position);
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
    else {
      this.bg.setLive(false);
      if (LITE) this.app.renderer.resize(this.viewW, this.viewH, 1);
      else this.scene.filters = [];
    }
  }

  /** wins in a row: each one sings a little higher */
  private streak = 0;

  private update(dt: number): void {
    this.watchFrameRate(dt);
    dt *= this.warp;
    this.board.update(dt);
    this.bg.update(dt);
    this.overlays.update(dt);
  }

  private bloom = new AdvancedBloomFilter({ threshold: 0.82, bloomScale: 0.28, brightness: 1, blur: 4, quality: 2 });

  /** the player's biggest win, in times the bet */
  private best = 0;

  private isRecord(round: Round): boolean {
    return round.totalWin / round.bet > this.best;
  }

  /** Sound, turbo and the record stay as the player left them. */
  private loadPrefs(): void {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { sound?: boolean; music?: boolean; turbo?: boolean; best?: number };
      this.sound = p.sound ?? true;
      this.music = p.music ?? true;
      this.turbo = p.turbo ?? false;
      this.best = p.best ?? 0;
    } catch {
      /* storage unavailable */
    }
    this.audio.setMuted(!this.sound);
    this.audio.setMusic(this.music);
    this.hud.setTurbo(this.turbo);
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: this.sound, music: this.music, turbo: this.turbo, best: this.best }));
    } catch {
      /* storage unavailable */
    }
  }

  private refreshHud(): void {
    const i = this.server.state.betIndex;
    this.hud.setBalance(this.server.state.balance);
    this.hud.setBet(BET_LEVELS[i], i > 0 && !this.busy, i < BET_LEVELS.length - 1 && !this.busy);
    this.hud.setRefill(!this.busy && this.server.state.balance < this.server.bet);
    this.hud.setBuy(this.server.bonusPrice, this.server.state.balance >= this.server.bonusPrice);
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

  /** the spin button is held down */
  private holding = false;

  /** a round is under way */
  get playing(): boolean {
    return this.busy;
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
    this.hud.closeMenus();
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

    await this.spinTo(round.base.grid, null);
    await this.presentOutcome(round.base, round.bet, 0, false);

    if (round.feature) await this.runFeature(round, 0);
    else {
      const tier = winTier(round.totalWin, round.bet);
      if (tier >= 0) {
        await this.overlays.bigWin(round.totalWin, round.bet, (v) => this.hud.setWin(v), this.isRecord(round));
      }
    }
    this.finishRound(round);
  }

  private finishRound(round: Round): void {
    const before = this.server.state.balance;
    this.server.settle();
    this.hud.setWin(round.totalWin);
    if (round.totalWin > 0) this.hud.rollBalance(before, this.server.state.balance, Math.min(1400, 450 + (round.totalWin / round.bet) * 30));
    if (this.isRecord(round)) {
      this.best = round.totalWin / round.bet;
      this.savePrefs();
    }
    this.busy = false;
    this.hud.setSpinning(false);
    this.refreshHud();
    if (this.autoLeft > 0) {
      const limit = this.server.state.balance < this.autoFloor || round.totalWin >= this.autoCeiling;
      this.autoLeft = limit ? 0 : this.autoLeft - 1;
      this.hud.setAuto(this.autoLeft);
      if (this.autoLeft > 0) setTimeout(() => void this.play(), round.totalWin > 0 ? 550 : 120);
    } else if (this.holding) {
      setTimeout(() => this.holding && void this.play(), round.totalWin > 0 ? 450 : 80);
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
        this.audio.reelStop(r, this.board.slammed);
        navigator.vibrate?.(r === REELS - 1 ? 16 : 7);
        for (let row = 0; row < ROWS; row++) {
          const s = grid[r][row];
          if (s === Sym.CODEX) {
            landedCodex++;
            this.audio.codex(landedCodex);
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
        this.bg.flare(0.2 + size * 0.1);
        this.bg.wave(0.5 + size * 0.2);
        if (size >= 1) this.audio.coins(size * 5);
      }
      else this.audio.tick();
      shown += lineSum;
      this.hud.rollWin(shown, celebrate ? 900 : 300, label);
      if (celebrate) this.board.showWinBurst(lineSum, size);
      if (inFeature) this.sendToPanel(shown, celebrate ? 0.9 : 0.2);
      await this.board.presentWins(o.lineWins, o.scatter, celebrate, () => this.audio.tick());
    }
    for (const exp of o.expansions) {
      await this.board.expand(
        exp,
        () => {
          this.banner.flash(exp.symbol);
          this.audio.expand();
        },
        this.board.toLocal(this.banner.strainPoint(exp.symbol)),
      );
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
      this.audio.hush(true);
      // the pyramids on the reels wake the great one: a thread of gold from each to the capstone…
      await this.board.callTemple(this.board.toLocal(this.bg.apexOnScreen()), (i) => this.audio.templeCall(i));
      // …out of the sanctuary by its gate of gold…
      this.audio.riser(1.6, 0.8);
      gsap.to(this.world, { alpha: 0, duration: 0.5, ease: 'power2.in' });
      gsap.to(this.hud.root, { opacity: 0, duration: 0.4 });
      await this.bg.leaveHall(this.turbo);
      // …the sands by night, and the great door opening by itself…
      await this.bg.openPyramid(this.turbo);
      // …and the camera goes in
      await this.bg.zoomTo(9, this.turbo ? 0.5 : 0.8);
      await this.overlays.corridor(this.turbo ? 1.2 : 2.2);
      this.bg.camera.k = 1;
      this.layout();
      gsap.to(this.world, { alpha: 1, duration: 0.6 });
      gsap.to(this.hud.root, { opacity: 1, duration: 0.6 });
      await this.overlays.featureIntro(f.special, 10, true);
    }
    this.banner.reset();
    this.enterFeature(true);
    this.board.clearWins();
    this.board.reels.forEach((r) => r.setStrip(FREE_STRIPS[this.board.reels.indexOf(r)]));
    const resumeSpin = f.spins[startAt - 1];
    this.banner.set(startAt, resumeSpin?.total ?? 10, resumeSpin?.specials ?? firstSpecials);
    this.showStrains(resumeSpin?.specials ?? firstSpecials);
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
        this.showStrains(s.specials);
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
    this.inFeature = on;
    this.layout();
    this.bg.setFeature(on);
    this.board.setFeature(on);
    this.audio.setFeature(on);
    if (on) this.audio.hush(false);
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
