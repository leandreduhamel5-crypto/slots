import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { LINES, REELS, ROWS, Sym } from '../math/config';
import type { Expansion, Grid, LineWin, ScatterWin } from '../math/engine';
import { Digits } from './Digits';
import { Particles } from './Particles';
import { Reel } from './Reel';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, COLORS, LINE_COLORS, REEL_GAP, SYMBOL_SIZE, cellCenter, reelX } from './layout';
import { FRAME_BLEED, FRAME_PAD, TEX_SIZE, type SymbolTextures } from './textures';
import { fmt } from '../ui/format';

export interface SpinPlan {
  grid: Grid;
  turbo: boolean;
  /** reels (index) that get the anticipation treatment */
  anticipate: number[];
  onReelStop?: (reel: number) => void;
}

type Cell = [number, number];

/** An animated stand-in for a reel symbol: base + moving parts + glow, floating above the frame. */
interface Rig {
  key: string;
  reel: number;
  row: number;
  sym: Sym;
  root: Container;
  body: Container;
  parts: Record<string, Sprite>;
  glow: Sprite;
  burst: Sprite;
  shine: Sprite;
  src: Sprite;
  tweens: gsap.core.Animation[];
}

/** Tint of the star-burst behind each winning symbol. */
const SYMBOL_GLOW: Record<number, number> = {
  [Sym.CODEX]: 0xff3347,
  [Sym.ZERO]: 0xffb03a,
  [Sym.MASK]: 0xff3347,
  [Sym.ANTIDOTE]: 0x38dcff,
  [Sym.BLOOD]: 0xff3347,
  [Sym.A]: 0xff3347,
  [Sym.K]: 0x38dcff,
  [Sym.Q]: 0xb46bff,
  [Sym.J]: 0x7be05a,
  [Sym.TEN]: 0xffa23a,
};

const LABEL_STYLE = (size: number, fill: number) => ({
  fontFamily: '"Luckiest Guy", sans-serif',
  fontSize: size,
  fill,
  stroke: { color: COLORS.ink, width: size * 0.22, join: 'round' as const },
  dropShadow: { color: COLORS.ink, blur: 0, distance: size * 0.09, angle: Math.PI / 2, alpha: 1 },
  letterSpacing: 2,
});

export class ReelBoard extends Container {
  readonly reels: Reel[] = [];
  private panels = new Container();
  private reelLayer = new Container();
  private dimLayer = new Graphics();
  private expandLayer = new Container();
  private frameLayer = new Container();
  private infectionGlow: Sprite;
  private anticipationLayer = new Container();
  private winFrameLayer = new Container();
  private lineLayer = new Container();
  private rigLayer = new Container();
  private fx: Particles;
  private labelLayer = new Container();
  private cycleTl: gsap.core.Timeline | null = null;
  private anticipationFx: { glow: Sprite; veins: Sprite; mask: Graphics }[] = [];
  private rigs = new Map<string, Rig>();
  private hurried = false;
  /** camera hooks */
  onAnticipate: ((on: boolean) => void) | null = null;
  onImpact: ((power: number) => void) | null = null;
  private ambientIn = 2.5;
  private plaque: Container | null = null;

  constructor(
    private tex: SymbolTextures,
    strips: Sym[][],
  ) {
    super();
    this.fx = new Particles(tex);

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
      this.winFrameLayer,
      this.lineLayer,
      this.rigLayer,
      this.fx,
      this.labelLayer,
    );
  }

  update(dtMs: number): void {
    for (const r of this.reels) r.update(dtMs);
    this.fx.update(dtMs);
    this.ambientIn -= dtMs / 1000;
    if (this.ambientIn <= 0) {
      this.ambientIn = 2 + Math.random() * 2.5;
      this.ambient();
    }
  }

  private get idle(): boolean {
    return !this.cycleTl && this.rigs.size === 0 && this.reels.every((r) => r.idle);
  }

  /** Signs of life while nothing happens: a premium symbol blinks, chomps or wobbles. */
  private ambient(): void {
    if (!this.idle) return;
    const cells: Cell[] = [];
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) if (this.symbolAt(r, row) <= Sym.BLOOD) cells.push([r, row]);
    if (!cells.length) return;
    const [r, row] = cells[Math.floor(Math.random() * cells.length)];
    const rig = this.rig(r, row);
    this.performIdle(rig);
  }

  /** Free spins: the whole board breathes red. */
  setFeature(on: boolean): void {
    gsap.killTweensOf(this.infectionGlow);
    if (on) {
      this.infectionGlow.alpha = 0.12;
      gsap.to(this.infectionGlow, { alpha: 0.3, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } else gsap.to(this.infectionGlow, { alpha: 0, duration: 0.6 });
    for (const p of this.panels.children as Sprite[]) gsap.to(p, { tint: on ? 0xffb8c4 : 0xffffff, duration: 0.8 });
  }

  /** Spins all reels and lands them on `plan.grid`. */
  async spin(plan: SpinPlan): Promise<void> {
    this.clearWins();
    this.hurried = false;
    const startGap = plan.turbo ? 0.03 : 0.07;
    this.reels.forEach((r, i) => r.start(i * startGap * 1000));

    const first = plan.turbo ? 380 : 760;
    const gap = plan.turbo ? 90 : 200;
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
          this.landSquash(i);
          plan.onReelStop?.(i);
        })(),
      );
      t += gap;
    }
    await Promise.all(stops);
  }

  /** Cartoon squash on the symbols of a reel that just landed. */
  private landSquash(reel: number): void {
    for (let row = 0; row < ROWS; row++) {
      const s = this.cell(reel, row);
      const b = SYMBOL_SIZE / TEX_SIZE;
      gsap.fromTo(s.scale, { x: b * 1.1, y: b * 0.86 }, { x: b, y: b, duration: 0.45, ease: 'elastic.out(1.1, 0.35)' });
    }
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
    this.onAnticipate?.(on);
    if (on) {
      glow.alpha = 0;
      gsap.to(glow, { alpha: 0.75, duration: 0.25 });
      gsap.to(glow.scale, { x: glow.scale.x * 1.1, duration: 0.22, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      veins.alpha = 1;
      mask.scale.y = 0;
      gsap.to(mask.scale, { y: 1, duration: dur, ease: 'power1.in' });
      this.reels[reel].speedScale = 1.25;
      const x = reelX(reel) + CELL_W / 2;
      const emit = () => {
        if (glow.alpha <= 0.05) return;
        this.fx.sparks(x + (Math.random() - 0.5) * CELL_W, BOARD_H - 10, 3, 0.6);
        if (Math.random() < 0.3) this.fx.puffs(x, BOARD_H + 10, 1, CELL_W);
        gsap.delayedCall(0.09, emit);
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

  /* ------------------------------------------------------------------ rigs */

  private rig(reel: number, row: number): Rig {
    const key = `${reel}:${row}`;
    const existing = this.rigs.get(key);
    if (existing) return existing;
    const sym = this.symbolAt(reel, row);
    const src = this.cell(reel, row);
    const root = new Container();
    const c = cellCenter(reel, row);
    root.position.set(c.x, c.y);
    const burst = new Sprite(this.tex.sunburst);
    burst.anchor.set(0.5);
    burst.width = burst.height = CELL_W * 1.7;
    burst.blendMode = 'add';
    burst.tint = SYMBOL_GLOW[sym] ?? COLORS.yellow;
    burst.alpha = 0;
    const body = new Container();
    body.scale.set(SYMBOL_SIZE / TEX_SIZE);
    root.addChild(burst, body);
    const parts: Record<string, Sprite> = {};
    const r = this.tex.rigs.get(sym);
    const add = (t: import('pixi.js').Texture) => {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      body.addChild(s);
      return s;
    };
    if (r) {
      add(r.base);
      for (const [name, t] of Object.entries(r.parts)) parts[name] = add(t);
      if (parts.lid) parts.lid.scale.y = 0;
    } else add(this.tex.normal[sym]);
    const glow = add(this.tex.glowMaps[sym]);
    glow.blendMode = 'add';
    glow.alpha = 0;
    const shineMask = add(this.tex.normal[sym]);
    const shine = add(this.tex.shine);
    shine.height = 460;
    shine.width = 150;
    shine.rotation = 0.38;
    shine.x = -320;
    shine.blendMode = 'add';
    shine.mask = shineMask;
    src.alpha = 0;
    this.rigLayer.addChild(root);
    const rig: Rig = { key, reel, row, sym, root, body, parts, glow, burst, shine, src, tweens: [] };
    this.rigs.set(key, rig);
    return rig;
  }

  private dropRig(rig: Rig): void {
    for (const t of rig.tweens) t.kill();
    gsap.killTweensOf([rig.body, rig.body.scale, rig.glow, rig.burst, rig.burst.scale, rig.shine, ...Object.values(rig.parts), ...Object.values(rig.parts).map((p) => p.scale)]);
    rig.src.alpha = 1;
    rig.root.destroy({ children: true });
    this.rigs.delete(rig.key);
  }

  private clearRigs(): void {
    for (const r of [...this.rigs.values()]) this.dropRig(r);
  }

  /** Symbol whose rig animation applies; artwork overrides have no parts, so they use the generic moves. */
  private motionOf(rig: Rig): Sym | -1 {
    if (rig.sym === Sym.CODEX && !rig.parts.iris) return -1;
    if (rig.sym === Sym.ZERO && !rig.parts.jaw) return -1;
    return rig.sym;
  }

  private blink(rig: Rig, delay = 0): gsap.core.Timeline {
    const lid = rig.parts.lid;
    return gsap
      .timeline({ delay })
      .to(lid.scale, { y: 1, duration: 0.07, ease: 'power2.in' })
      .to(lid.scale, { y: 0, duration: 0.12, ease: 'power2.out' }, '+=0.05');
  }

  private performIdle(rig: Rig): void {
    const b = rig.body;
    const s = b.scale.x;
    let tl: gsap.core.Timeline;
    switch (this.motionOf(rig)) {
      case Sym.CODEX:
        tl = gsap
          .timeline()
          .to(rig.parts.iris, { x: -10, duration: 0.25, ease: 'power2.inOut' })
          .to(rig.parts.iris, { x: 10, duration: 0.35, ease: 'power2.inOut' }, '+=0.25')
          .to(rig.parts.iris, { x: 0, duration: 0.25 }, '+=0.25')
          .add(this.blink(rig), '+=0.1');
        break;
      case Sym.ZERO:
        tl = gsap
          .timeline()
          .to(rig.parts.jaw, { y: 14, duration: 0.12, ease: 'power2.out' })
          .to(rig.parts.jaw, { y: 0, duration: 0.1, ease: 'power2.in' })
          .to(rig.parts.jaw, { y: 14, duration: 0.12, ease: 'power2.out' })
          .to(rig.parts.jaw, { y: 0, duration: 0.1, ease: 'power2.in' })
          .to(rig.glow, { alpha: 0.9, duration: 0.15 }, 0)
          .to(rig.glow, { alpha: 0, duration: 0.4 }, 0.5);
        break;
      case Sym.BLOOD:
        tl = gsap
          .timeline()
          .to(b.scale, { x: s * 1.08, y: s * 0.93, duration: 0.15 })
          .to(b.scale, { x: s * 0.95, y: s * 1.06, duration: 0.15 })
          .to(b.scale, { x: s, y: s, duration: 0.5, ease: 'elastic.out(1.2, 0.3)' });
        break;
      default:
        tl = gsap
          .timeline()
          .to(rig.glow, { alpha: 0.9, duration: 0.25, yoyo: true, repeat: 1 })
          .to(b, { rotation: 0.06, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0);
    }
    tl.eventCallback('onComplete', () => this.dropRig(rig));
    rig.tweens.push(tl);
  }

  /** Signature win animation per symbol. */
  private performWin(rig: Rig, strong: boolean, delay: number): void {
    const b = rig.body;
    const s = SYMBOL_SIZE / TEX_SIZE;
    const amp = strong ? 1 : 0.65;
    const pos = cellCenter(rig.reel, rig.row);
    const tl = gsap.timeline({ delay, repeat: -1, repeatDelay: 0.5 });
    const bs = rig.burst.scale.x;
    rig.tweens.push(
      gsap.fromTo(rig.burst, { alpha: 0 }, { alpha: strong ? 0.75 : 0.4, duration: 0.25, delay }),
      gsap.fromTo(rig.burst.scale, { x: bs * 0.3, y: bs * 0.3 }, { x: bs, y: bs, duration: 0.5, delay, ease: 'back.out(2)' }),
      gsap.to(rig.burst, { rotation: Math.PI * 2, duration: 6, repeat: -1, ease: 'none' }),
    );
    tl.fromTo(rig.shine, { x: -320 }, { x: 320, duration: 0.55, ease: 'power1.inOut' }, 0.1);
    // one-shot particle effects, so a looping win cycle doesn't flood the screen
    const once = (fn: () => void) => rig.tweens.push(gsap.delayedCall(delay + 0.3, fn));
    // pop out (shared)
    tl.to(b.scale, { x: s * (1 + 0.28 * amp), y: s * (1 + 0.18 * amp), duration: 0.12, ease: 'power2.out' })
      .to(b.scale, { x: s * (1 + 0.12 * amp), y: s * (1 + 0.24 * amp), duration: 0.1 })
      .to(b.scale, { x: s * 1.12, y: s * 1.12, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' })
      .to(rig.glow, { alpha: 1, duration: 0.15 }, 0);
    switch (this.motionOf(rig)) {
      case Sym.CODEX:
        tl.to(rig.parts.iris, { x: -12, duration: 0.18 }, 0.2)
          .to(rig.parts.iris, { x: 12, duration: 0.25 })
          .to(rig.parts.iris, { x: 0, duration: 0.18 })
          .add(this.blink(rig))
          .to(b, { rotation: 0.08, duration: 0.06, yoyo: true, repeat: 5 }, 0.3);
        break;
      case Sym.ZERO:
        for (let i = 0; i < 3; i++) {
          tl.to(rig.parts.jaw, { y: 18 * amp, duration: 0.1, ease: 'power2.out' }, 0.2 + i * 0.26).to(rig.parts.jaw, { y: 0, duration: 0.12, ease: 'power3.in' });
        }
        tl.to(b, { x: 5, duration: 0.04, yoyo: true, repeat: 9 }, 0.2);
        break;
      case Sym.MASK:
        tl.to(b, { rotation: -0.1 * amp, duration: 0.15, ease: 'sine.inOut' }, 0.2)
          .to(b, { rotation: 0.1 * amp, duration: 0.3, ease: 'sine.inOut' })
          .to(b, { rotation: 0, duration: 0.2 });
        once(() => this.fx.puffs(pos.x, pos.y + CELL_H * 0.4, strong ? 3 : 1, 50));
        break;
      case Sym.ANTIDOTE:
        tl.to(b, { rotation: 0.16 * amp, duration: 0.12 }, 0.2)
          .to(b, { rotation: -0.12 * amp, duration: 0.16 })
          .to(b, { rotation: 0, duration: 0.2, ease: 'back.out(3)' });
        once(() => this.fx.burst(pos.x + CELL_W * 0.3, pos.y + CELL_H * 0.32, strong ? 7 : 3, 0.45, true));
        break;
      case Sym.BLOOD:
        tl.to(b.scale, { x: s * 1.24, y: s * 1.0, duration: 0.14 }, 0.45)
          .to(b.scale, { x: s * 1.04, y: s * 1.2, duration: 0.14 })
          .to(b.scale, { x: s * 1.12, y: s * 1.12, duration: 0.5, ease: 'elastic.out(1.2, 0.3)' });
        once(() => this.fx.burst(pos.x, pos.y + CELL_H * 0.4, strong ? 6 : 3, 0.4));
        break;
      default:
        tl.to(b, { rotation: -0.07, duration: 0.1 }, 0.2)
          .to(b, { rotation: 0.07, duration: 0.14 })
          .to(b, { rotation: 0, duration: 0.3, ease: 'elastic.out(1.2, 0.4)' });
    }
    tl.to(b.scale, { x: s * 1.04, y: s * 1.04, duration: 0.3 }).to(rig.glow, { alpha: 0.35, duration: 0.3 }, '<');
    rig.tweens.push(tl);
  }

  /** Pop animation on a freshly landed codex / strain symbol. */
  popCell(reel: number, row: number, color = COLORS.infection): void {
    const c = cellCenter(reel, row);
    const flash = new Sprite(this.tex.glow);
    flash.anchor.set(0.5);
    flash.tint = color;
    flash.blendMode = 'add';
    flash.position.set(c.x, c.y);
    flash.width = flash.height = CELL_W * 2;
    this.labelLayer.addChild(flash);
    gsap.fromTo(flash, { alpha: 1 }, { alpha: 0, duration: 0.6, onComplete: () => flash.destroy() });
    this.fx.impact(c.x, c.y, 0.8, 1);
    const rig = this.rig(reel, row);
    const s = SYMBOL_SIZE / TEX_SIZE;
    const tl = gsap
      .timeline({ onComplete: () => this.dropRig(rig) })
      .fromTo(rig.body.scale, { x: s * 1.45, y: s * 0.7 }, { x: s * 0.9, y: s * 1.25, duration: 0.1 })
      .to(rig.body.scale, { x: s, y: s, duration: 0.5, ease: 'elastic.out(1.2, 0.35)' })
      .fromTo(rig.glow, { alpha: 1 }, { alpha: 0, duration: 0.7 }, 0);
    if (rig.parts.lid) tl.add(this.blink(rig), 0.35);
    rig.tweens.push(tl);
  }

  clearWins(): void {
    this.hidePlaque();
    this.cycleTl?.kill();
    this.cycleTl = null;
    this.dimLayer.clear();
    this.clearRigs();
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
      }
      reel.cells.forEach((_, i) => reel.setSymbol(i, reel.symbols[i]));
      reel.cells.forEach((c) => (c.x = CELL_W / 2));
    }
  }

  /** Clears the transient win decorations but keeps the reels as they are. */
  private clearHighlights(): void {
    this.dimLayer.clear();
    this.clearRigs();
    for (const layer of [this.lineLayer, this.labelLayer, this.winFrameLayer]) {
      for (const c of layer.removeChildren()) {
        gsap.killTweensOf(c);
        c.destroy();
      }
    }
  }

  private linePoints(line: number): { x: number; y: number }[] {
    const pts = LINES[line].map((row, r) => cellCenter(r, row));
    return [{ x: -20, y: pts[0].y }, ...pts, { x: BOARD_W + 20, y: pts[pts.length - 1].y }];
  }

  /** Thick inked payline drawn progressively. */
  private traceLine(line: number, duration = 0.4): Graphics {
    const g = new Graphics();
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
      const stroke = (width: number, c: number, a = 1) => {
        g.moveTo(path[0].x, path[0].y);
        for (const p of path) g.lineTo(p.x, p.y);
        g.stroke({ width, color: c, alpha: a, join: 'round', cap: 'round' });
      };
      stroke(19, COLORS.ink);
      stroke(10, color);
      stroke(3, 0xffffff, 0.75);
      const head = path[path.length - 1];
      if (t < 1) g.circle(head.x, head.y, 13).fill(COLORS.ink).circle(head.x, head.y, 8).fill(0xffffff);
      for (const p of path.slice(1, -1)) g.circle(p.x, p.y, 9).fill(COLORS.ink).circle(p.x, p.y, 5).fill(color);
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
        if (!keep.has(`${r}:${row}`)) this.dimLayer.rect(reelX(r), row * CELL_H, CELL_W, CELL_H).fill({ color: 0x0a0410, alpha: 0.7 });
      }
    }
  }

  private winFrame(reel: number, row: number, delay: number): void {
    const f = new Sprite(this.tex.winFrame);
    f.anchor.set(0.5);
    const c = cellCenter(reel, row);
    f.position.set(c.x, c.y);
    this.winFrameLayer.addChild(f);
    gsap.fromTo(f.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.4, delay, ease: 'elastic.out(1.2, 0.4)' });
    gsap.fromTo(f, { alpha: 0 }, { alpha: 1, duration: 0.1, delay });
    gsap.to(f.scale, { x: 1.04, y: 1.04, duration: 0.35, delay: delay + 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
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
      this.performWin(this.rig(r, row), strong, delay);
      if (strong) {
        const c = cellCenter(r, row);
        gsap.delayedCall(delay, () => this.fx.sparks(c.x, c.y, 8, 0.5));
      }
    });
  }

  private addLabel(text: string, x: number, y: number, _color = 0xffffff, scale = 1): Digits {
    const t = new Digits(54);
    t.text = text;
    t.position.set(x, y);
    this.labelLayer.addChild(t);
    gsap.fromTo(t.scale, { x: 0.2 * scale, y: 0.2 * scale }, { x: scale, y: scale, duration: 0.5, ease: 'elastic.out(1.2, 0.45)' });
    gsap.from(t, { y: y + 24, duration: 0.35, ease: 'back.out(2)' });
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
    lineWins.forEach((w, i) => {
      const g = this.traceLine(w.line, 0.4);
      g.alpha = 0;
      this.lineLayer.addChild(g);
      gsap.to(g, { alpha: 1, duration: 0.01, delay: i * 0.08 });
    });
    this.highlightCells(all, celebrate, 0.06);
    if (scatter) {
      const mid = scatter.cells[Math.floor(scatter.cells.length / 2)];
      const c = cellCenter(mid[0], mid[1]);
      this.addLabel(fmt(scatter.win), c.x, c.y + CELL_H * 0.36, COLORS.yellow);
    }
    await wait(celebrate ? 1500 : 1000);

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
        if (it.line !== undefined) this.lineLayer.addChild(this.traceLine(it.line, 0.3));
        const last = it.cells[it.cells.length - 1];
        const c = cellCenter(last[0], last[1]);
        this.addLabel(fmt(it.win), c.x, c.y + CELL_H * 0.36, it.line !== undefined ? LINE_COLORS[it.line] : COLORS.yellow);
        this.highlightCells(it.cells, false, 0.04);
        onLine?.(i);
      });
      tl.to({}, { duration: 1.6 });
    });
    this.cycleTl = tl;
  }

  /** Total-win plaque hanging under the reels. */
  showPlaque(amount: number, label: string): void {
    this.hidePlaque();
    const c = new Container();
    const w = 380;
    const h = 92;
    const plate = new Graphics()
      .roundRect(-w / 2, -h / 2 + 8, w, h, 22)
      .fill(COLORS.ink)
      .roundRect(-w / 2, -h / 2, w, h, 22)
      .fill(0x2a1530)
      .stroke({ width: 8, color: COLORS.ink })
      .roundRect(-w / 2 + 10, -h / 2 + 8, w - 20, 10, 5)
      .fill(0x4a2a55);
    const tab = new Graphics().roundRect(-90, -h / 2 - 22, 180, 34, 12).fill(COLORS.infection).stroke({ width: 6, color: COLORS.ink });
    const lab = new Text({ text: label, style: LABEL_STYLE(26, 0xffffff) });
    lab.anchor.set(0.5);
    lab.y = -h / 2 - 5;
    const val = new Digits(56);
    val.value = 0;
    val.y = 12;
    c.addChild(plate, tab, lab, val);
    c.position.set(BOARD_W / 2, BOARD_H + FRAME_PAD + 26);
    this.labelLayer.parent!.addChild(c);
    this.plaque = c;
    gsap.fromTo(c.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.45)' });
    const o = { v: 0 };
    gsap.to(o, { v: amount, duration: 0.9, ease: 'power2.out', onUpdate: () => (val.value = o.v) });
  }

  hidePlaque(): void {
    const p = this.plaque;
    if (!p) return;
    this.plaque = null;
    gsap.killTweensOf(p);
    gsap.to(p.scale, { x: 0, y: 0, duration: 0.2, ease: 'back.in(2)', onComplete: () => p.destroy({ children: true }) });
  }

  /** Book-style expansion: tendrils crawl down the reel, it bursts, then the strain slams in. */
  async expand(exp: Expansion, onReel?: (reel: number) => void): Promise<void> {
    this.clearHighlights();
    for (const r of exp.reels) {
      const x = reelX(r);
      for (let row = 0; row < ROWS; row++) {
        if (this.symbolAt(r, row) === exp.symbol) {
          const rig = this.rig(r, row);
          const s = SYMBOL_SIZE / TEX_SIZE;
          rig.tweens.push(
            gsap
              .timeline()
              .to(rig.body.scale, { x: s * 1.3, y: s * 1.3, duration: 0.2, ease: 'back.out(3)' })
              .to(rig.glow, { alpha: 1, duration: 0.2 }, 0),
          );
        }
      }
      const veins = new Sprite(this.tex.veins);
      veins.position.set(x, 0);
      veins.width = CELL_W;
      veins.height = BOARD_H;
      const vm = new Graphics().rect(x, 0, CELL_W, BOARD_H).fill(0xffffff);
      vm.scale.y = 0;
      veins.mask = vm;
      const big = new Sprite(this.tex.expanded.get(exp.symbol)!);
      big.position.set(x + CELL_W / 2, BOARD_H / 2);
      big.anchor.set(0.5);
      big.width = CELL_W + 6;
      big.height = BOARD_H + 6;
      big.alpha = 0;
      this.expandLayer.addChild(vm, veins, big);
      onReel?.(r);
      await new Promise<void>((resolve) => {
        const sx = big.scale.x;
        const sy = big.scale.y;
        gsap
          .timeline({ onComplete: resolve })
          .to(vm.scale, { y: 1, duration: 0.4, ease: 'power2.in' })
          .add(() => {
            for (const rig of [...this.rigs.values()].filter((g) => g.reel === r)) this.dropRig(rig);
            this.fx.impact(x + CELL_W / 2, BOARD_H / 2, 1.2);
            this.onImpact?.(0.8);
            for (let row = 0; row < ROWS; row++) this.fx.burst(x + CELL_W / 2, row * CELL_H + CELL_H / 2, 8, 0.7);
          })
          .to(big, { alpha: 1, duration: 0.05 })
          .fromTo(big.scale, { x: sx * 1.35, y: sy * 0.8 }, { x: sx, y: sy, duration: 0.55, ease: 'elastic.out(1.1, 0.35)' }, '<')
          .to(veins, { alpha: 0, duration: 0.3 }, '<');
      });
      gsap.to(big.scale, { x: big.scale.x * 1.02, y: big.scale.y * 1.01, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    this.clearRigs();
    await wait(250);
    exp.lines.forEach((line, i) => {
      const g = this.traceLine(line, 0.3);
      g.alpha = 0;
      this.lineLayer.addChild(g);
      gsap.to(g, { alpha: 0.85, duration: 0.01, delay: i * 0.06 });
    });
    await wait(500);
    this.addLabel(fmt(exp.win), BOARD_W / 2, BOARD_H / 2, COLORS.yellow, 1.7);
    this.fx.burst(BOARD_W / 2, BOARD_H / 2, 40, 1);
    await wait(1400);
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
