import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { LINES, REELS, ROWS, Sym } from '../math/config';
import type { Expansion, Grid, LineWin, ScatterWin } from '../math/engine';
import { Particles } from './Particles';
import { Reel } from './Reel';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, COLORS, LINE_COLORS, REEL_GAP, cellCenter, reelX } from './layout';
import { FRAME_BLEED, FRAME_PAD, type SymbolTextures } from './textures';
import { fmt } from '../ui/format';

export interface SpinPlan {
  grid: Grid;
  turbo: boolean;
  /** reels (index) that get the anticipation treatment */
  anticipate: number[];
  onReelStop?: (reel: number) => void;
}

type Cell = [number, number];

/** A glow map sprite glued to a reel symbol so it follows its animations. */
interface GlowPair {
  src: Sprite;
  reel: Reel;
  glow: Sprite;
}

export class ReelBoard extends Container {
  readonly reels: Reel[] = [];
  private panels = new Container();
  private reelLayer = new Container();
  private dimLayer = new Graphics();
  private expandLayer = new Container();
  private frameLayer = new Container();
  private infectionGlow: Sprite;
  private anticipationLayer = new Container();
  private glowLayer = new Container();
  private winFrameLayer = new Container();
  private lineLayer = new Container();
  private sparks: Particles;
  private labelLayer = new Container();
  private cycleTl: gsap.core.Timeline | null = null;
  private anticipationFx: { glow: Sprite; veins: Sprite; mask: Graphics }[] = [];
  private glows: GlowPair[] = [];
  private hurried = false;

  constructor(
    private tex: SymbolTextures,
    strips: Sym[][],
  ) {
    super();
    this.sparks = new Particles(tex.spore);

    for (let r = 0; r < REELS; r++) {
      const p = new Sprite(tex.reelPanels[r]);
      p.position.set(reelX(r) - REEL_GAP / 2, 0);
      this.panels.addChild(p);
    }

    const mask = new Graphics().rect(-6, 0, BOARD_W + 12, BOARD_H).fill(0xffffff);
    this.reelLayer.mask = mask;

    for (let r = 0; r < REELS; r++) {
      const initial: Sym[] = [];
      for (let row = 0; row < ROWS; row++) initial.push(strips[r][(row + r * 5) % strips[r].length]);
      const reel = new Reel(tex, strips[r], initial);
      reel.x = reelX(r);
      this.reels.push(reel);
      this.reelLayer.addChild(reel);

      const glow = new Sprite(tex.glow);
      glow.anchor.set(0.5);
      glow.tint = COLORS.infection;
      glow.width = CELL_W * 1.7;
      glow.height = BOARD_H * 1.3;
      glow.position.set(reelX(r) + CELL_W / 2, BOARD_H / 2);
      glow.alpha = 0;
      glow.blendMode = 'add';
      const veins = new Sprite(tex.veins);
      veins.position.set(reelX(r), 0);
      veins.width = CELL_W;
      veins.height = BOARD_H;
      veins.blendMode = 'add';
      veins.alpha = 0;
      const vm = new Graphics().rect(reelX(r), 0, CELL_W, BOARD_H).fill(0xffffff);
      vm.pivot.y = BOARD_H;
      vm.y = BOARD_H;
      vm.scale.y = 0;
      veins.mask = vm;
      this.anticipationFx.push({ glow, veins, mask: vm });
      this.anticipationLayer.addChild(glow, vm, veins);
    }

    const shade = new Sprite(tex.shade);
    shade.width = BOARD_W + 12;
    shade.height = BOARD_H;
    shade.x = -6;

    const frame = new Sprite(tex.frame);
    frame.position.set(-FRAME_PAD - FRAME_BLEED, -FRAME_PAD - FRAME_BLEED);
    this.infectionGlow = new Sprite(tex.glow);
    this.infectionGlow.anchor.set(0.5);
    this.infectionGlow.position.set(BOARD_W / 2, BOARD_H / 2);
    this.infectionGlow.width = BOARD_W * 1.5;
    this.infectionGlow.height = BOARD_H * 1.8;
    this.infectionGlow.tint = COLORS.infection;
    this.infectionGlow.blendMode = 'add';
    this.infectionGlow.alpha = 0;
    this.frameLayer.addChild(this.infectionGlow, frame);

    this.addChild(
      this.panels,
      mask,
      this.reelLayer,
      this.dimLayer,
      this.expandLayer,
      shade,
      this.frameLayer,
      this.anticipationLayer,
      this.glowLayer,
      this.winFrameLayer,
      this.lineLayer,
      this.sparks,
      this.labelLayer,
    );
  }

  update(dtMs: number): void {
    for (const r of this.reels) r.update(dtMs);
    this.sparks.update(dtMs);
    for (const g of this.glows) {
      g.glow.position.set(g.reel.x + g.src.x, g.src.y);
      g.glow.scale.copyFrom(g.src.scale);
      g.glow.rotation = g.src.rotation;
    }
  }

  /** Free spins: the whole board breathes red. */
  setFeature(on: boolean): void {
    gsap.killTweensOf(this.infectionGlow);
    if (on) {
      this.infectionGlow.alpha = 0.18;
      gsap.to(this.infectionGlow, { alpha: 0.42, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } else gsap.to(this.infectionGlow, { alpha: 0, duration: 0.6 });
    for (const p of this.panels.children as Sprite[]) gsap.to(p, { tint: on ? 0xffb0b8 : 0xffffff, duration: 0.8 });
  }

  /** Spins all reels and lands them on `plan.grid`. */
  async spin(plan: SpinPlan): Promise<void> {
    this.clearWins();
    this.hurried = false;
    const startGap = plan.turbo ? 0.03 : 0.07;
    this.reels.forEach((r, i) => r.start(i * startGap * 1000));

    const first = plan.turbo ? 380 : 780;
    const gap = plan.turbo ? 90 : 210;
    const anticipation = plan.turbo ? 900 : 1500;
    let t = first;
    const stops: Promise<void>[] = [];
    for (let i = 0; i < REELS; i++) {
      const reel = this.reels[i];
      const isAnt = plan.anticipate.includes(i);
      if (isAnt) t += anticipation;
      const at = t;
      stops.push(
        (async () => {
          if (isAnt) {
            await this.sleep(at - anticipation + 120);
            if (!this.hurried) this.setAnticipation(i, true, anticipation / 1000);
            await this.sleep(anticipation - 120);
          } else await this.sleep(at);
          await reel.stop(plan.grid[i]);
          this.setAnticipation(i, false, 0);
          plan.onReelStop?.(i);
        })(),
      );
      t += gap;
    }
    await Promise.all(stops);
  }

  /** Slam-stop: lands all remaining reels as fast as possible. */
  hurry(): void {
    this.hurried = true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const end = performance.now() + ms;
      const loop = () => (this.hurried || performance.now() >= end ? resolve() : requestAnimationFrame(loop));
      loop();
    });
  }

  private setAnticipation(reel: number, on: boolean, dur: number): void {
    const { glow, veins, mask } = this.anticipationFx[reel];
    gsap.killTweensOf([glow, glow.scale, veins, mask.scale]);
    if (on) {
      glow.alpha = 0;
      gsap.to(glow, { alpha: 0.8, duration: 0.25 });
      gsap.to(glow.scale, { x: glow.scale.x * 1.1, duration: 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      veins.alpha = 1;
      mask.scale.y = 0;
      gsap.to(mask.scale, { y: 1, duration: dur, ease: 'power1.in' });
      gsap.to(veins, { alpha: 0.4, duration: 0.12, yoyo: true, repeat: -1, ease: 'steps(2)' });
      this.reels[reel].speedScale = 1.25;
      const c = cellCenter(reel, 2);
      const emit = () => {
        if (glow.alpha <= 0.05) return;
        this.sparks.burst(c.x + (Math.random() - 0.5) * CELL_W, BOARD_H, 4, 0.5);
        gsap.delayedCall(0.08, emit);
      };
      gsap.delayedCall(0.1, emit);
    } else {
      gsap.to(glow, { alpha: 0, duration: 0.3 });
      gsap.to(veins, { alpha: 0, duration: 0.25 });
      this.reels[reel].speedScale = 1;
    }
  }

  cell(reel: number, row: number): Sprite {
    return this.reels[reel].cellAt(row);
  }

  private symbolAt(reel: number, row: number): Sym {
    return this.reels[reel].symbols[row + 1];
  }

  /** Pop animation on a freshly landed symbol (codex / special). */
  popCell(reel: number, row: number, color = COLORS.infection): void {
    const s = this.cell(reel, row);
    const base = s.scale.x;
    gsap.fromTo(s.scale, { x: base * 1.3, y: base * 1.3 }, { x: base, y: base, duration: 0.5, ease: 'back.out(2.5)' });
    const flash = new Sprite(this.tex.glow);
    flash.anchor.set(0.5);
    flash.tint = color;
    flash.blendMode = 'add';
    const c = cellCenter(reel, row);
    flash.position.set(c.x, c.y);
    flash.width = flash.height = CELL_W * 2;
    this.labelLayer.addChild(flash);
    gsap.fromTo(flash, { alpha: 1 }, { alpha: 0, duration: 0.7, onComplete: () => flash.destroy() });
    const g = this.attachGlow(reel, row);
    gsap.fromTo(g, { alpha: 1 }, { alpha: 0, duration: 0.9, onComplete: () => this.detachGlow(g) });
    this.sparks.burst(c.x, c.y, 18, 0.55);
  }

  private attachGlow(reel: number, row: number): Sprite {
    const src = this.cell(reel, row);
    const glow = new Sprite(this.tex.glowMaps[this.symbolAt(reel, row)]);
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    this.glowLayer.addChild(glow);
    this.glows.push({ src, reel: this.reels[reel], glow });
    this.update(0);
    return glow;
  }

  private detachGlow(glow: Sprite): void {
    this.glows = this.glows.filter((g) => g.glow !== glow);
    gsap.killTweensOf(glow);
    glow.destroy();
  }

  clearWins(): void {
    this.cycleTl?.kill();
    this.cycleTl = null;
    this.dimLayer.clear();
    for (const g of [...this.glows]) this.detachGlow(g.glow);
    for (const layer of [this.lineLayer, this.labelLayer, this.expandLayer, this.winFrameLayer]) {
      for (const c of layer.removeChildren()) {
        gsap.killTweensOf(c);
        c.destroy();
      }
    }
    for (const reel of this.reels) {
      for (const c of reel.cells) {
        gsap.killTweensOf(c.scale);
        gsap.killTweensOf(c);
        c.alpha = 1;
        c.rotation = 0;
        c.skew.set(0, 0);
      }
      reel.cells.forEach((_, i) => reel.setSymbol(i, reel.symbols[i]));
      reel.cells.forEach((c) => (c.x = CELL_W / 2));
    }
  }

  /** Clears the transient win decorations but keeps the reels as they are. */
  private clearHighlights(): void {
    this.dimLayer.clear();
    for (const g of [...this.glows]) this.detachGlow(g.glow);
    for (const layer of [this.lineLayer, this.labelLayer, this.winFrameLayer]) {
      for (const c of layer.removeChildren()) {
        gsap.killTweensOf(c);
        c.destroy();
      }
    }
  }

  private linePoints(line: number): { x: number; y: number }[] {
    const pts = LINES[line].map((row, r) => cellCenter(r, row));
    return [{ x: -16, y: pts[0].y }, ...pts, { x: BOARD_W + 16, y: pts[pts.length - 1].y }];
  }

  /** Draws a payline progressively, like infection racing through the cells. */
  private traceLine(line: number, alpha = 1, duration = 0.4): Graphics {
    const g = new Graphics();
    g.alpha = alpha;
    const color = LINE_COLORS[line];
    const pts = this.linePoints(line);
    const segs: number[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segs.push(d);
      total += d;
    }
    const draw = (t: number) => {
      if (g.destroyed) return;
      g.clear();
      let left = total * t;
      const path: { x: number; y: number }[] = [pts[0]];
      for (let i = 1; i < pts.length && left > 0; i++) {
        const k = Math.min(1, left / segs[i - 1]);
        path.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k });
        left -= segs[i - 1];
      }
      const stroke = (width: number, c: number, a: number) => {
        g.moveTo(path[0].x, path[0].y);
        for (const p of path) g.lineTo(p.x, p.y);
        g.stroke({ width, color: c, alpha: a, join: 'round', cap: 'round' });
      };
      stroke(22, color, 0.12);
      stroke(12, color, 0.25);
      stroke(5, color, 0.95);
      stroke(1.6, 0xffffff, 0.9);
      const head = path[path.length - 1];
      if (t < 1) g.circle(head.x, head.y, 9).fill({ color: 0xffffff, alpha: 0.9 }).circle(head.x, head.y, 18).fill({ color, alpha: 0.35 });
    };
    const o = { t: 0 };
    draw(0);
    gsap.to(o, { t: 1, duration, ease: 'power1.inOut', onUpdate: () => draw(o.t) });
    return g;
  }

  private dimExcept(cells: Cell[]): void {
    const keep = new Set(cells.map(([r, row]) => `${r}:${row}`));
    this.dimLayer.clear();
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (!keep.has(`${r}:${row}`)) this.dimLayer.rect(reelX(r), row * CELL_H, CELL_W, CELL_H).fill({ color: 0x000000, alpha: 0.66 });
      }
    }
  }

  private winFrame(reel: number, row: number, delay: number): void {
    const f = new Sprite(this.tex.winFrame);
    f.anchor.set(0.5);
    const c = cellCenter(reel, row);
    f.position.set(c.x, c.y);
    this.winFrameLayer.addChild(f);
    gsap.fromTo(f.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: 0.35, delay, ease: 'back.out(2)' });
    gsap.fromTo(f, { alpha: 0 }, { alpha: 1, duration: 0.2, delay });
    gsap.to(f, { alpha: 0.55, duration: 0.45, delay: delay + 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  /** Signature win animation per symbol. */
  private animateSymbol(reel: number, row: number, strong: boolean, delay: number): void {
    const s = this.cell(reel, row);
    const sym = this.symbolAt(reel, row);
    gsap.killTweensOf(s.scale);
    gsap.killTweensOf(s);
    const b = s.scale.x;
    const amp = strong ? 1 : 0.6;
    const tl = gsap.timeline({ delay, repeat: 1 });
    switch (sym) {
      case Sym.HEART:
        // double heartbeat
        for (let i = 0; i < 2; i++) {
          tl.to(s.scale, { x: b * (1 + 0.16 * amp), y: b * (1 + 0.2 * amp), duration: 0.09, ease: 'power2.out' })
            .to(s.scale, { x: b, y: b, duration: 0.14, ease: 'power2.in' })
            .to(s.scale, { x: b * (1 + 0.1 * amp), y: b * (1 + 0.12 * amp), duration: 0.08 })
            .to(s.scale, { x: b, y: b, duration: 0.3, ease: 'power2.in' });
        }
        break;
      case Sym.ZERO:
        tl.to(s.scale, { x: b * (1 + 0.14 * amp), y: b * (1 + 0.14 * amp), duration: 0.25, ease: 'power2.out' });
        for (let i = 0; i < 8; i++) tl.to(s, { x: CELL_W / 2 + (Math.random() - 0.5) * 12 * amp, rotation: (Math.random() - 0.5) * 0.08 * amp, duration: 0.04 });
        tl.to(s, { x: CELL_W / 2, rotation: 0, duration: 0.1 }).to(s.scale, { x: b, y: b, duration: 0.35, ease: 'back.out(2)' });
        break;
      case Sym.MASK:
        tl.to(s.scale, { x: b * (1 + 0.12 * amp), y: b * (1 + 0.12 * amp), duration: 0.3, ease: 'power2.out' })
          .to(s, { rotation: 0.08 * amp, duration: 0.18, ease: 'sine.inOut' })
          .to(s, { rotation: -0.08 * amp, duration: 0.3, ease: 'sine.inOut' })
          .to(s, { rotation: 0, duration: 0.2 })
          .to(s.scale, { x: b, y: b, duration: 0.3 });
        break;
      case Sym.SERUM:
        tl.to(s.scale, { x: b * (1 + 0.12 * amp), y: b * (1 + 0.12 * amp), duration: 0.25 })
          .to(s, { rotation: 0.14 * amp, duration: 0.15, ease: 'sine.inOut' })
          .to(s, { rotation: -0.12 * amp, duration: 0.2, ease: 'sine.inOut' })
          .to(s, { rotation: 0.06 * amp, duration: 0.18, ease: 'sine.inOut' })
          .to(s, { rotation: 0, duration: 0.2 })
          .to(s.scale, { x: b, y: b, duration: 0.3 });
        break;
      case Sym.CODEX:
        tl.to(s.scale, { x: b * (1 + 0.2 * amp), y: b * (1 + 0.2 * amp), duration: 0.3, ease: 'back.out(3)' })
          .to(s, { rotation: 0.05, duration: 0.05, yoyo: true, repeat: 5 })
          .to(s.scale, { x: b, y: b, duration: 0.4, ease: 'power2.inOut' });
        break;
      default:
        tl.to(s.scale, { x: b * (1 + 0.12 * amp), y: b * (1 + 0.12 * amp), duration: 0.28, ease: 'back.out(2)' })
          .to(s.scale, { x: b * (1 + 0.04 * amp), y: b * (1 + 0.04 * amp), duration: 0.3, ease: 'sine.inOut' })
          .to(s.scale, { x: b, y: b, duration: 0.3 });
    }
    const g = this.attachGlow(reel, row);
    g.alpha = 0;
    gsap.to(g, { alpha: strong ? 1 : 0.7, duration: 0.25, delay });
    gsap.to(g, { alpha: 0.25, duration: 0.5, delay: delay + 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  private highlightCells(cells: Cell[], strong: boolean, stagger: number): void {
    const seen = new Set<string>();
    const uniq = cells.filter(([r, row]) => {
      const k = `${r}:${row}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    uniq.forEach(([r, row]) => {
      const delay = r * stagger;
      this.winFrame(r, row, delay);
      this.animateSymbol(r, row, strong, delay);
      if (strong) {
        const c = cellCenter(r, row);
        gsap.delayedCall(delay, () => this.sparks.burst(c.x, c.y, 10, 0.45));
      }
    });
  }

  private addLabel(text: string, x: number, y: number, color = 0xffffff, scale = 1): Text {
    const t = new Text({
      text,
      style: {
        fontFamily: 'Rajdhani, sans-serif',
        fontWeight: '700',
        fontSize: 46,
        fill: color,
        stroke: { color: 0x14000a, width: 8, join: 'round' },
        dropShadow: { color: COLORS.infection, blur: 14, distance: 0, alpha: 1 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.labelLayer.addChild(t);
    gsap.fromTo(t.scale, { x: 0.3 * scale, y: 0.3 * scale }, { x: scale, y: scale, duration: 0.4, ease: 'back.out(2.5)' });
    gsap.from(t, { y: y + 18, duration: 0.4, ease: 'power2.out' });
    return t;
  }

  /**
   * Shows every winning line at once, then cycles through them one by one.
   * Resolves after the first full overview (the cycling keeps running until the next spin).
   */
  async presentWins(lineWins: LineWin[], scatter: ScatterWin | null, celebrate: boolean, onLine?: (i: number) => void): Promise<void> {
    if (!lineWins.length && !scatter) return;
    const all: Cell[] = [...lineWins.flatMap((w) => w.cells), ...(scatter?.cells ?? [])];
    this.dimExcept(all);
    this.highlightCells(all, celebrate, 0.06);
    lineWins.forEach((w, i) => {
      const g = this.traceLine(w.line, 0.85, 0.45);
      g.alpha = 0;
      this.lineLayer.addChild(g);
      gsap.to(g, { alpha: 0.85, duration: 0.01, delay: i * 0.08 });
    });
    if (scatter) {
      const mid = scatter.cells[Math.floor(scatter.cells.length / 2)];
      const c = cellCenter(mid[0], mid[1]);
      this.addLabel(fmt(scatter.win), c.x, c.y + CELL_H * 0.36, 0xffd27a);
    }
    await wait(celebrate ? 1400 : 950);

    const items: { cells: Cell[]; line?: number; win: number }[] = [
      ...lineWins.map((w) => ({ cells: w.cells, line: w.line, win: w.win })),
      ...(scatter ? [{ cells: scatter.cells, win: scatter.win }] : []),
    ];
    if (items.length < 2 && !celebrate) return;
    const tl = gsap.timeline({ repeat: -1 });
    items.forEach((it, i) => {
      tl.add(() => {
        this.clearHighlights();
        this.dimExcept(it.cells);
        if (it.line !== undefined) this.lineLayer.addChild(this.traceLine(it.line, 1, 0.3));
        const last = it.cells[it.cells.length - 1];
        const c = cellCenter(last[0], last[1]);
        this.addLabel(fmt(it.win), c.x, c.y + CELL_H * 0.36, it.line !== undefined ? LINE_COLORS[it.line] : 0xffd27a);
        this.highlightCells(it.cells, false, 0.04);
        onLine?.(i);
      });
      tl.to({}, { duration: 1.5 });
    });
    this.cycleTl = tl;
  }

  /** Book-style expansion: veins crawl down the reel, the reel bursts, then the strain fills it. */
  async expand(exp: Expansion, onReel?: (reel: number) => void): Promise<void> {
    this.clearHighlights();
    for (const r of exp.reels) {
      const x = reelX(r);
      // the strain symbols on this reel flare first
      for (let row = 0; row < ROWS; row++) {
        if (this.symbolAt(r, row) === exp.symbol) {
          const g = this.attachGlow(r, row);
          gsap.fromTo(g, { alpha: 0 }, { alpha: 1, duration: 0.15, yoyo: true, repeat: 1 });
        }
      }
      const veins = new Sprite(this.tex.veins);
      veins.position.set(x, 0);
      veins.width = CELL_W;
      veins.height = BOARD_H;
      veins.blendMode = 'add';
      const vm = new Graphics().rect(x, 0, CELL_W, BOARD_H).fill(0xffffff);
      vm.scale.y = 0;
      veins.mask = vm;
      const big = new Sprite(this.tex.expanded.get(exp.symbol)!);
      big.position.set(x + CELL_W / 2, BOARD_H / 2);
      big.anchor.set(0.5);
      big.width = CELL_W;
      big.height = BOARD_H;
      big.alpha = 0;
      const flash = new Sprite(this.tex.glow);
      flash.anchor.set(0.5);
      flash.position.set(x + CELL_W / 2, BOARD_H / 2);
      flash.width = CELL_W * 2.4;
      flash.height = BOARD_H * 1.4;
      flash.tint = COLORS.infection;
      flash.blendMode = 'add';
      flash.alpha = 0;
      this.expandLayer.addChild(vm, veins, big);
      this.labelLayer.addChild(flash);
      onReel?.(r);
      await new Promise<void>((resolve) => {
        const sx = big.scale.x;
        const sy = big.scale.y;
        gsap
          .timeline({ onComplete: resolve })
          .to(vm.scale, { y: 1, duration: 0.45, ease: 'power2.in' })
          .add(() => {
            for (let row = 0; row < ROWS; row++) {
              const c = cellCenter(r, row);
              this.sparks.burst(c.x, c.y, 16, 0.7);
            }
          })
          .to(flash, { alpha: 1, duration: 0.08 })
          .to(big, { alpha: 1, duration: 0.12 }, '<')
          .fromTo(big.scale, { x: sx * 1.25, y: sy * 1.08 }, { x: sx, y: sy, duration: 0.4, ease: 'back.out(2.2)' }, '<')
          .to(flash, { alpha: 0, duration: 0.5 })
          .to(veins, { alpha: 0, duration: 0.3 }, '<');
      });
      gsap.to(big, { alpha: 0.85, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    await wait(250);
    exp.lines.forEach((line, i) => {
      const g = this.traceLine(line, 0.75, 0.35);
      g.alpha = 0;
      this.lineLayer.addChild(g);
      gsap.to(g, { alpha: 0.75, duration: 0.01, delay: i * 0.06 });
    });
    await wait(500);
    this.addLabel(fmt(exp.win), BOARD_W / 2, BOARD_H / 2, 0xffd27a, 1.6);
    this.sparks.burst(BOARD_W / 2, BOARD_H / 2, 40, 1);
    await wait(1400);
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
