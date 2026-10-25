import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { ShockwaveFilter } from 'pixi-filters';
import gsap from 'gsap';
import { BASE_STRIPS, BET_LEVELS, FREE_STRIPS, REELS, ROWS, Sym, minCount } from '../math/config';
import type { FreeSpinOutcome, Grid, Round, SpinOutcome } from '../math/engine';
import { GameServer } from '../server/GameServer';
import { Hud } from '../ui/Hud';
import { Paytable } from '../ui/Paytable';
import { Audio } from './Audio';
import { Background } from './Background';
import { BOARD_H, BOARD_W, COLORS } from './layout';
import { Logo, eyeFromCodex, paintLogo } from './Logo';
import { showIntro } from '../ui/Intro';
import { Overlays, winTier } from './Overlays';
import { ReelBoard } from './ReelBoard';
import type { SymbolTextures } from './textures';

const BOARD_Y = 152;
const WORLD_TOP = -112;
const WORLD_BOTTOM = BOARD_Y + BOARD_H + 64;
const WORLD_W = BOARD_W + 200;

class FeatureBanner extends Container {
  private count: Text;
  private icons = new Container();

  constructor(private tex: SymbolTextures) {
    super();
    const plate = new Graphics()
      .roundRect(-330, -70, 660, 140, 20)
      .fill({ color: 0x0a0b0f, alpha: 0.9 })
      .roundRect(-330, -70, 660, 140, 20)
      .stroke({ width: 3, color: COLORS.infection })
      .roundRect(-322, -62, 644, 124, 15)
      .stroke({ width: 1, color: COLORS.gold, alpha: 0.5 });
    const label = new Text({
      text: 'TOURS GRATUITS',
      style: { fontFamily: 'Cinzel, serif', fontWeight: '700', fontSize: 26, fill: 0xff5a6a, letterSpacing: 4 },
    });
    label.anchor.set(0.5);
    label.position.set(-170, -28);
    this.count = new Text({
      text: '0 / 10',
      style: {
        fontFamily: 'Rajdhani, sans-serif',
        fontWeight: '700',
        fontSize: 68,
        fill: COLORS.bone,
        dropShadow: { color: COLORS.infection, blur: 14, distance: 0, alpha: 1 },
      },
    });
    this.count.anchor.set(0.5);
    this.count.position.set(-170, 22);
    const strains = new Text({
      text: 'SOUCHES',
      style: { fontFamily: 'Cinzel, serif', fontWeight: '700', fontSize: 20, fill: 0x9aa3b2, letterSpacing: 4 },
    });
    strains.anchor.set(0.5);
    strains.position.set(150, -46);
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
        sp.width = sp.height = 96;
        sp.x = (i - (specials.length - 1) / 2) * 104;
        this.icons.addChild(sp);
        gsap.from(sp.scale, { x: 0, y: 0, duration: 0.5, ease: 'back.out(2)' });
      });
    }
  }

  bump(): void {
    gsap.fromTo(this.count.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(3)' });
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
  ) {
    this.bg = new Background(tex.spore, tex.chain, tex.glow);
    this.bg.onLightning = () => this.audio.thunder();
    this.board = new ReelBoard(tex, BASE_STRIPS);
    this.board.position.set(0, BOARD_Y);
    this.logo = new Logo(eyeFromCodex(codexCanvas, codexCanvas.width));
    this.logo.position.set(BOARD_W / 2, 0);
    this.logo.homeX = BOARD_W / 2;
    this.banner = new FeatureBanner(tex);
    this.banner.position.set(BOARD_W / 2, 6);
    this.world.addChild(this.logo, this.banner, this.board);
    this.scene.addChild(this.bg, this.world);
    this.overlays = new Overlays(tex, this.audio, {
      shake: (p) => this.shake(p),
      shockwave: () => this.shockwave(),
      glitch: (p) => this.logo.glitch(p),
      thump: (p) => this.bg.thump(p),
    });
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

    const eye = eyeFromCodex(codexCanvas, codexCanvas.width);
    showIntro(paintLogo(eye).toDataURL('image/png'), tex.images, () => {
      this.audio.unlock();
      this.logo.glitch(2);
      this.bg.flash();
      if (this.server.state.pending) void this.resume(this.server.state.pending);
    });
  }

  /** Dev console helper: game.debug('feature' | 'big' | 'retrigger' | 'expand'). */
  debug(kind: 'feature' | 'big' | 'retrigger' | 'expand'): void {
    if (!import.meta.env.DEV) return;
    const preds: Record<string, (r: Round) => boolean> = {
      feature: (r) => !!r.feature,
      big: (r) => !r.feature && r.totalWin >= r.bet * 40,
      retrigger: (r) => !!r.feature?.spins.some((s) => s.retrigger?.mutation != null),
      expand: (r) => !!r.feature && r.feature.win >= r.bet * 100,
    };
    this.server.force = preds[kind];
    void this.play();
  }

  private layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    const hudH = this.hud.root.getBoundingClientRect().height || 120;
    const availH = h - hudH;
    const worldH = WORLD_BOTTOM - WORLD_TOP;
    const worldW = w < h ? BOARD_W + 70 : WORLD_W;
    const scale = Math.min((w * 0.98) / worldW, (availH * 0.96) / worldH);
    this.world.scale.set(scale);
    this.world.pivot.set(BOARD_W / 2, (WORLD_TOP + WORLD_BOTTOM) / 2);
    this.world.position.set(w / 2, availH / 2);
    this.bg.resize(w, h);
    this.overlays.resize(w, h);
  }

  private update(dt: number): void {
    this.board.update(dt);
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

  private shake(power: number): void {
    this.shakePower = Math.max(this.shakePower, power);
  }

  private shockwave(): void {
    this.shock.center = { x: this.viewW / 2, y: this.viewH / 2 };
    this.shock.time = 0;
    this.scene.filters = [this.shock];
    gsap.killTweensOf(this.shock);
    gsap.to(this.shock, {
      time: 1.4,
      duration: 1.4,
      ease: 'none',
      onComplete: () => {
        this.scene.filters = [];
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

    await this.spinTo(round.base.grid, null);
    await this.presentOutcome(round.base, round.bet, 0, false);

    if (round.feature) await this.runFeature(round, 0);
    else {
      const tier = winTier(round.totalWin, round.bet);
      if (tier >= 0) await this.overlays.bigWin(round.totalWin, round.bet, (v) => this.hud.setWin(v));
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
            this.board.popCell(r, row);
            if (landedCodex >= 3) this.bg.thump(0.25);
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
      if (celebrate) this.audio.win(size);
      else this.audio.tick();
      shown += lineSum;
      this.hud.rollWin(shown, celebrate ? 900 : 300, label);
      if (size >= 2) this.shake(4);
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

  private enterFeature(on: boolean): void {
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
