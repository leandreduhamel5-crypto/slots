import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { AdvancedBloomFilter, ShockwaveFilter } from 'pixi-filters';
import gsap from 'gsap';
import { BASE_STRIPS, BET_LEVELS, FREE_STRIPS, REELS, ROWS, Sym, minCount } from '../math/config';
import type { FreeSpinOutcome, Grid, Round, SpinOutcome } from '../math/engine';
import { GameServer } from '../server/GameServer';
import { Hud } from '../ui/Hud';
import { Paytable } from '../ui/Paytable';
import { Audio } from './Audio';
import { Background } from './Background';
import { BOARD_H, BOARD_W, COLORS } from './layout';
import { Logo, eyeFromCodex, logoCanvas } from './Logo';
import type { LoadedAssets } from './assets';
import { Mascot, type MascotTextures } from './Mascot';
import { Particles } from './Particles';
import { showIntro } from '../ui/Intro';
import { Overlays, winTier } from './Overlays';
import { ReelBoard } from './ReelBoard';
import type { SymbolTextures } from './textures';

const BOARD_Y = 152;
const WORLD_TOP = -140;
const WORLD_BOTTOM = BOARD_Y + BOARD_H + 118;
const MASCOT_X = 248;
const MASCOT_SCALE = 0.74;
const SHOW_MASCOT = true;
const WORLD_W = BOARD_W + 200;

class FeatureBanner extends Container {
  private count: Text;
  private icons = new Container();

  constructor(private tex: SymbolTextures) {
    super();
    const ink = COLORS.ink;
    const cartoon = (size: number, fill: number) => ({
      fontFamily: 'Cinzel, "Luckiest Guy", serif', fontWeight: '900' as const,
      fontSize: size,
      fill,
      stroke: { color: ink, width: size * 0.2, join: 'round' as const },
      dropShadow: { color: ink, blur: 0, distance: size * 0.08, angle: Math.PI / 2, alpha: 1 },
      letterSpacing: 2,
    });
    const plate = new Graphics()
      .roundRect(-340, -66, 680, 150, 30)
      .fill(ink)
      .roundRect(-340, -76, 680, 150, 30)
      .fill(0x1a0a08)
      .stroke({ width: 9, color: ink })
      .roundRect(-334, -70, 668, 138, 25)
      .stroke({ width: 3, color: 0xc48a2a })
      .roundRect(-326, -66, 652, 10, 5)
      .fill({ color: 0xffe2a0, alpha: 0.1 })
      .roundRect(-320, -60, 300, 118, 20)
      .fill(0x0c0404)
      .stroke({ width: 6, color: ink })
      .roundRect(-316, -56, 292, 110, 17)
      .stroke({ width: 2, color: 0x8a5612 });
    const label = new Text({ text: 'TOURS GRATUITS', style: cartoon(28, COLORS.infection) });
    label.anchor.set(0.5);
    label.position.set(-170, -34);
    this.count = new Text({ text: '0 / 10', style: cartoon(64, COLORS.yellow) });
    this.count.anchor.set(0.5);
    this.count.position.set(-170, 18);
    const strains = new Text({ text: 'SOUCHES', style: cartoon(24, 0xf2c25a) });
    strains.anchor.set(0.5);
    strains.position.set(150, -48);
    this.icons.position.set(150, 14);
    this.addChild(plate, label, this.count, strains, this.icons);
    this.visible = false;
  }

  set(spin: number, total: number, specials: Sym[]): void {
    this.count.text = `${spin} / ${total}`;
    if (this.icons.children.length !== specials.length) {
      this.icons.removeChildren().forEach((c) => c.destroy());
      specials.forEach((s, i) => {
        const sp = new Sprite(this.tex.normal[s]);
        sp.anchor.set(0.5);
        sp.width = sp.height = 100;
        sp.x = (i - (specials.length - 1) / 2) * 104;
        this.icons.addChild(sp);
        gsap.from(sp.scale, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1.2, 0.4)' });
      });
    }
  }

  bump(): void {
    gsap.fromTo(this.count.scale, { x: 1.4, y: 0.7 }, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' });
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
  private banner: FeatureBanner;
  private overlays: Overlays;
  private hud: Hud;
  private paytable: Paytable;
  private shock = new ShockwaveFilter({ center: { x: 0, y: 0 }, amplitude: 40, wavelength: 220, speed: 900, brightness: 1.15, radius: -1 });
  private shakePower = 0;
  private busy = false;
  private turbo = false;
  private sound = true;
  private autoLeft = 0;
  private viewW = 0;
  private viewH = 0;

  constructor(
    app: Application,
    tex: SymbolTextures,
    codexCanvas: HTMLCanvasElement,
    mascotTex: MascotTextures,
    assets: LoadedAssets,
    templeNight: HTMLImageElement,
    templeInfected: HTMLImageElement,
  ) {
    this.bg = new Background(tex.spore, tex.glow, templeNight, templeInfected, assets.background);
    this.bg.onLightning = (power) => this.audio.lightning(power);
    this.board = new ReelBoard(tex, BASE_STRIPS);
    this.board.position.set(0, BOARD_Y);
    this.board.onAnticipate = (on) => this.pushIn(on);
    this.board.onImpact = (p) => this.punch(p);
    const logoArt = logoCanvas(eyeFromCodex(codexCanvas, codexCanvas.width), assets.logo);
    this.logo = new Logo(logoArt);
    this.logo.position.set(BOARD_W / 2, -18);
    this.logo.homeX = BOARD_W / 2;
    this.banner = new FeatureBanner(tex);
    this.banner.position.set(BOARD_W / 2, 6);
    this.teaser = this.buildTeaser(tex);
    this.mascot = new Mascot(mascotTex, assets.mascot);
    this.mascot.scale.set(MASCOT_SCALE);
    this.mascot.position.set(BOARD_W + MASCOT_X, BOARD_Y + BOARD_H + 24);
    this.mascot.setBook(tex.normal[Sym.CODEX]);
    this.mascotFx = new Particles(tex);
    this.mascot.onTransform = (to) => {
      if (!this.mascot.visible) return;
      const x = this.mascot.x;
      const y = this.mascot.y - 280;
      this.mascotFx.impact(x, y, 1.6);
      this.mascotFx.burst(x, y, 30, 1.1);
      this.audio.stinger(to === 'inhuman' ? 2 : 0);
      this.bg.thump(to === 'inhuman' ? 0.4 : 0.15);
      this.shake(to === 'inhuman' ? 16 : 6);
    };
    this.world.addChild(this.logo, this.banner, this.board, this.mascot, this.teaser, this.mascotFx);
    this.scene.addChild(this.bg, this.world);
    this.overlays = new Overlays(tex, this.audio, {
      shake: (p) => this.shake(p),
      punch: (p) => this.punch(p),
      shockwave: () => this.shockwave(),
      glitch: (p) => this.logo.glitch(p),
      thump: (p) => this.bg.thump(p),
    });
    // bloom: emissive bits (eyes, veins, orb, neon, glows) radiate
    this.bloom.resolution = app.renderer.resolution;
    this.scene.filters = [this.bloom];
    app.stage.addChild(this.scene, this.overlays);

    this.hud = new Hud({
      spin: () => this.onSpinPressed(),
      betDelta: (d) => this.changeBet(d),
      toggleTurbo: () => {
        this.turbo = !this.turbo;
        this.hud.setTurbo(this.turbo);
        this.audio.click();
      },
      toggleSound: () => {
        this.sound = !this.sound;
        this.audio.setMuted(!this.sound);
        this.hud.setSound(this.sound);
      },
      openInfo: () => {
        this.audio.click();
        this.paytable.open(this.server.bet);
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
    });
    this.paytable = new Paytable(tex.images);
    document.body.append(this.hud.root, this.paytable.root);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (this.paytable.isOpen) this.paytable.close();
        else this.onSpinPressed();
      }
    });
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    app.ticker.add((t) => this.update(t.deltaMS));
    window.addEventListener('resize', () => this.layout());
    new ResizeObserver(() => this.layout()).observe(this.hud.root);
    this.layout();
    this.refreshHud();
    this.hud.setTurbo(false);
    this.hud.setSound(true);

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
      s.width = s.height = 118;
      s.position.set((i - 1) * 104, 0);
      s.rotation = (i - 1) * 0.12;
      c.addChild(s);
      gsap.to(s, { y: -8, duration: 1.4, delay: i * 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    const t = new Text({
      text: '10 TOURS GRATUITS',
      style: {
        fontFamily: 'Cinzel, "Luckiest Guy", serif', fontWeight: '900' as const,
        fontSize: 64,
        fill: COLORS.yellow,
        stroke: { color: COLORS.ink, width: 12, join: 'round' },
        dropShadow: { color: COLORS.ink, blur: 0, distance: 6, angle: Math.PI / 2, alpha: 1 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(0, 100);
    const sub = new Text({
      text: 'la souche envahit tout le rouleau',
      style: { fontFamily: 'Nunito, sans-serif', fontWeight: '900' as const, fontSize: 34, fill: 0xffffff, stroke: { color: COLORS.ink, width: 7, join: 'round' } },
    });
    sub.anchor.set(0.5);
    sub.position.set(0, 154);
    c.addChild(t, sub);
    c.position.set(BOARD_W / 2, BOARD_Y + BOARD_H + 150);
    c.visible = false;
    return c;
  }

  private layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    const hudH = this.hud.root.getBoundingClientRect().height || 120;
    const availH = h - hudH;
    const portrait = w < h;
    const bottom = portrait ? WORLD_BOTTOM + 270 : WORLD_BOTTOM;
    const worldH = bottom - WORLD_TOP;
    const worldW = portrait ? BOARD_W + 150 : WORLD_W;
    const scale = Math.min((w * 0.98) / worldW, (availH * 0.96) / worldH);
    this.teaser.visible = portrait && !this.inFeature;
    this.logo.scale.set(portrait ? 1.12 : 1);
    this.logo.y = portrait ? -44 : -18;
    this.baseScale = scale;
    this.world.scale.set(scale * this.zoom);
    this.world.pivot.set(BOARD_W / 2, (WORLD_TOP + bottom) / 2);
    this.world.position.set(w / 2, availH / 2);
    const mascotRight = (BOARD_W + MASCOT_X + 250 * MASCOT_SCALE - BOARD_W / 2) * scale + w / 2;
    this.mascot.visible = SHOW_MASCOT && !portrait && mascotRight < w;
    this.bg.resize(w, h);
    this.overlays.resize(w, h);
  }

  /** Time warp for hit-stops (1 = normal). */
  private warp = 1;

  /** The third book lands: flash, shockwave, camera kick, and (on the last reel) a short freeze-frame. */
  private triggerHit(freeze: boolean): void {
    this.bg.thump(0.5);
    this.shockwave();
    this.punch(1.8);
    this.shake(16);
    this.logo.glitch(2);
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

  private update(dt: number): void {
    dt *= this.warp;
    this.board.update(dt);
    this.mascotFx.update(dt);
    this.bg.update(dt);
    this.overlays.update(dt);
    if (this.shakePower > 0.2) {
      this.scene.position.set((Math.random() - 0.5) * this.shakePower, (Math.random() - 0.5) * this.shakePower);
      this.shakePower *= Math.pow(0.0025, dt / 1000);
    } else if (this.shakePower) {
      this.shakePower = 0;
      this.scene.position.set(0, 0);
    }
  }

  private baseScale = 1;
  /** camera zoom = slow push (anticipation) × quick kick (impacts) */
  private cam = { push: 1, kick: 1 };
  private get zoom(): number {
    return this.cam.push * this.cam.kick;
  }
  private applyZoom = (): void => {
    this.world.scale.set(this.baseScale * this.zoom);
  };

  /** Camera: a quick zoom kick that settles back. */
  private punch(power = 1): void {
    gsap.killTweensOf(this.cam, 'kick');
    gsap.fromTo(
      this.cam,
      { kick: 1 + 0.045 * power },
      { kick: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)', onUpdate: this.applyZoom },
    );
  }

  /** Camera: slow push-in while the reels build suspense. */
  private pushIn(on: boolean): void {
    gsap.killTweensOf(this.cam, 'push');
    gsap.to(this.cam, { push: on ? 1.03 : 1, duration: on ? 1.2 : 0.4, ease: 'sine.inOut', onUpdate: this.applyZoom });
  }

  private shake(power: number): void {
    this.shakePower = Math.max(this.shakePower, power);
  }

  private bloom = new AdvancedBloomFilter({ threshold: 0.7, bloomScale: 0.6, brightness: 1, blur: 6, quality: 5 });

  private shockwave(): void {
    this.shock.center = { x: this.viewW / 2, y: this.viewH / 2 };
    this.shock.time = 0;
    this.scene.filters = [this.bloom, this.shock];
    gsap.killTweensOf(this.shock);
    gsap.to(this.shock, {
      time: 1.4,
      duration: 1.4,
      ease: 'none',
      onComplete: () => {
        this.scene.filters = [this.bloom];
      },
    });
  }

  private refreshHud(): void {
    const i = this.server.state.betIndex;
    this.hud.setBalance(this.server.state.balance);
    this.hud.setBet(BET_LEVELS[i], i > 0 && !this.busy, i < BET_LEVELS.length - 1 && !this.busy);
    this.hud.setRefill(!this.busy && this.server.state.balance < this.server.bet);
  }

  private changeBet(d: number): void {
    if (this.busy) return;
    this.server.setBetIndex(this.server.state.betIndex + d);
    this.audio.click();
    this.refreshHud();
  }

  private onSpinPressed(): void {
    this.audio.unlock();
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

  private async play(): Promise<void> {
    if (this.busy) return;
    if (this.server.state.balance < this.server.bet) {
      this.autoLeft = 0;
      this.hud.setAuto(0);
      this.refreshHud();
      return;
    }
    this.busy = true;
    this.hud.setSpinning(true);
    this.hud.setWin(0);
    let round: Round;
    try {
      round = await this.server.spin();
    } catch {
      this.busy = false;
      this.hud.setSpinning(false);
      this.refreshHud();
      return;
    }
    this.hud.setBalance(this.server.state.balance);
    this.audio.spinStart();
    this.hud.pulseSpin();
    this.mascot.react('spin');

    await this.spinTo(round.base.grid, null);
    this.mascot.lookAt(0, 0);
    await this.presentOutcome(round.base, round.bet, 0, false);

    if (round.feature) await this.runFeature(round, 0);
    else {
      const tier = winTier(round.totalWin, round.bet);
      if (tier >= 0) {
        this.mascot.react('big');
        if (this.mascot.visible) await this.sleep(900);
        await this.overlays.bigWin(round.totalWin, round.bet, (v) => this.hud.setWin(v));
      }
    }
    this.finishRound(round);
  }

  private finishRound(round: Round): void {
    this.server.settle();
    this.hud.setWin(round.totalWin);
    this.busy = false;
    this.hud.setSpinning(false);
    this.refreshHud();
    if (this.autoLeft > 0) {
      this.autoLeft--;
      this.hud.setAuto(this.autoLeft);
      if (this.autoLeft > 0) setTimeout(() => void this.play(), round.totalWin > 0 ? 900 : 250);
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
        this.audio.win(size);
        this.bg.flare(0.45 + size * 0.2);
        this.board.coinBurst(6 + size * 8);
        this.audio.coins(6 + size * 8);
      }
      else this.audio.tick();
      shown += lineSum;
      this.hud.rollWin(shown, celebrate ? 900 : 300, label);
      if (size >= 2) this.shake(4);
      if (celebrate && !inFeature) this.board.showPlaque(lineSum, 'GAIN');
      if (celebrate) this.mascot.react('win');
      await this.board.presentWins(o.lineWins, o.scatter, celebrate, () => this.audio.tick());
    }
    for (const exp of o.expansions) {
      await this.board.expand(exp, () => {
        this.audio.expand();
        this.bg.thump(0.3);
        this.shake(8);
      });
      shown += exp.win;
      this.hud.rollWin(shown, 900, label);
      this.audio.win(exp.win >= bet * 5 ? 2 : 1);
    }
  }

  private async runFeature(round: Round, startAt: number): Promise<void> {
    const f = round.feature!;
    const firstSpecials = f.spins[0]?.specials.slice(0, 1) ?? [f.special];
    if (startAt === 0) {
      await this.sleep(this.turbo ? 300 : 700);
      this.mascot.react('feature');
      if (this.mascot.visible) await this.sleep(1300);
      await this.overlays.featureIntro(f.special, 10);
    }
    this.enterFeature(true);
    this.board.clearWins();
    this.board.reels.forEach((r) => r.setStrip(FREE_STRIPS[this.board.reels.indexOf(r)]));
    const resumeSpin = f.spins[startAt - 1];
    this.banner.set(startAt, resumeSpin?.total ?? 10, resumeSpin?.specials ?? firstSpecials);
    let featureWin = resumeSpin?.featureWin ?? 0;
    this.hud.setWin(featureWin, 'Gain bonus');

    for (let i = startAt; i < f.spins.length; i++) {
      const s: FreeSpinOutcome = f.spins[i];
      const before = f.spins[i - 1]?.specials ?? firstSpecials;
      this.banner.set(s.index, i === 0 ? 10 : f.spins[i - 1].total, before);
      this.banner.bump();
      this.audio.spinStart();
      await this.sleep(this.turbo ? 150 : 350);
      await this.spinTo(s.grid, before);
      await this.presentOutcome(s, round.bet, featureWin, true);
      featureWin = s.featureWin;
      this.hud.setWin(featureWin, 'Gain bonus');
      if (winTier(s.win, round.bet) >= 0) await this.overlays.bigWin(s.win, round.bet);
      if (s.retrigger) {
        await this.overlays.retrigger(s.retrigger.spins, s.retrigger.mutation, before);
        this.banner.set(s.index, s.total, s.specials);
      }
      this.server.markFreeSpinShown(i + 1);
      await this.sleep(s.win > 0 ? (this.turbo ? 500 : 900) : this.turbo ? 150 : 350);
    }
    this.board.clearWins();
    await this.overlays.featureOutro(f.win, f.spins.length, round.bet, (v) => this.hud.setWin(v, 'Gain bonus'));
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
    gsap.to(this.banner, { alpha: on ? 1 : 0, duration: 0.5, onComplete: () => (this.banner.visible = on) });
  }

  /** Round recovery: a reload in the middle of a round picks it up where it was left. */
  private async resume(round: Round): Promise<void> {
    this.busy = true;
    this.hud.setSpinning(true);
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
