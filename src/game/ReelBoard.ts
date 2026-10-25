import { BlurFilter, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { LINES, REELS, ROWS, Sym } from '../math/config';
import type { Expansion, Grid, LineWin, ScatterWin } from '../math/engine';
import { Reel } from './Reel';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, COLORS, LINE_COLORS, cellCenter, reelX } from './layout';
import type { SymbolTextures } from './textures';
import { fmt } from '../ui/format';

export interface SpinPlan {
  grid: Grid;
  turbo: boolean;
  /** reels (index) that get the anticipation treatment */
  anticipate: number[];
  onReelStop?: (reel: number) => void;
}

export class ReelBoard extends Container {
  readonly reels: Reel[] = [];
  private reelLayer = new Container();
  private dimLayer = new Graphics();
  private anticipationLayer = new Container();
  private expandLayer = new Container();
  private lineLayer = new Container();
  private labelLayer = new Container();
  private cycleTl: gsap.core.Timeline | null = null;
  private anticipationGlows: Sprite[] = [];
  private hurried = false;

  constructor(
    private tex: SymbolTextures,
    strips: Sym[][],
  ) {
    super();
    this.buildFrame();

    const mask = new Graphics().rect(-6, 0, BOARD_W + 12, BOARD_H).fill(0xffffff);
    this.reelLayer.mask = mask;
    this.addChild(mask, this.reelLayer);

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
      glow.width = CELL_W * 1.6;
      glow.height = BOARD_H * 1.25;
      glow.position.set(reelX(r) + CELL_W / 2, BOARD_H / 2);
      glow.alpha = 0;
      glow.blendMode = 'add';
      this.anticipationGlows.push(glow);
      this.anticipationLayer.addChild(glow);
    }

    this.addChild(this.dimLayer, this.anticipationLayer, this.expandLayer, this.lineLayer, this.labelLayer);
  }

  private buildFrame(): void {
    const pad = 22;
    const frame = new Container();
    const back = new Graphics()
      .roundRect(-pad, -pad, BOARD_W + pad * 2, BOARD_H + pad * 2, 18)
      .fill({ color: 0x050608, alpha: 0.82 });
    const outer = new Sprite(frameTexture(pad));
    outer.position.set(-pad - FRAME_BLEED, -pad - FRAME_BLEED);

    const seps = new Graphics();
    for (let r = 1; r < REELS; r++) {
      const x = reelX(r) - REEL_SEP_OFFSET;
      seps.moveTo(x, 6).lineTo(x, BOARD_H - 6).stroke({ width: 2, color: 0x1c2027, alpha: 1 });
    }
    // rivets
    const rivets = new Graphics();
    const pts = [
      [-pad + 14, -pad + 14],
      [BOARD_W + pad - 14, -pad + 14],
      [-pad + 14, BOARD_H + pad - 14],
      [BOARD_W + pad - 14, BOARD_H + pad - 14],
    ];
    for (const [x, y] of pts) rivets.circle(x, y, 5).fill(COLORS.gold).circle(x - 1.5, y - 1.5, 1.8).fill(0xf6e3b5);

    // inner columns shading
    const cols = new Graphics();
    for (let r = 0; r < REELS; r++) cols.rect(reelX(r), 0, CELL_W, BOARD_H).fill({ color: 0x10131a, alpha: 0.75 });

    // vein corners that pulse
    const veinL = new Sprite(this.tex.veins);
    veinL.anchor.set(0.5);
    veinL.height = BOARD_H + 120;
    veinL.width = 110;
    veinL.position.set(-pad - 10, BOARD_H / 2);
    const veinR = new Sprite(this.tex.veins);
    veinR.anchor.set(0.5);
    veinR.height = BOARD_H + 120;
    veinR.width = 110;
    veinR.scale.x *= -1;
    veinR.position.set(BOARD_W + pad + 10, BOARD_H / 2);
    for (const v of [veinL, veinR]) {
      v.alpha = 0.35;
      gsap.to(v, { alpha: 0.7, duration: 0.55, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }

    frame.addChild(veinL, veinR, back, cols, seps, outer, rivets);
    this.addChild(frame);
  }

  update(dtMs: number): void {
    for (const r of this.reels) r.update(dtMs);
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
            if (!this.hurried) this.setAnticipation(i, true);
            await this.sleep(anticipation - 120);
          } else await this.sleep(at);
          await reel.stop(plan.grid[i]);
          this.setAnticipation(i, false);
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

  private setAnticipation(reel: number, on: boolean): void {
    const g = this.anticipationGlows[reel];
    gsap.killTweensOf(g);
    if (on) {
      g.alpha = 0;
      gsap.to(g, { alpha: 0.75, duration: 0.25 });
      gsap.to(g.scale, { x: g.scale.x * 1.08, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      this.reels[reel].speedScale = 1.25;
    } else {
      gsap.killTweensOf(g.scale);
      gsap.to(g, { alpha: 0, duration: 0.3 });
      this.reels[reel].speedScale = 1;
    }
  }

  cell(reel: number, row: number): Sprite {
    return this.reels[reel].cellAt(row);
  }

  /** Pop animation on a freshly landed symbol (codex / special). */
  popCell(reel: number, row: number, color = COLORS.infection): void {
    const s = this.cell(reel, row);
    const base = s.scale.x;
    gsap.fromTo(s.scale, { x: base * 1.25, y: base * 1.25 }, { x: base, y: base, duration: 0.45, ease: 'back.out(2.5)' });
    const flash = new Sprite(this.tex.glow);
    flash.anchor.set(0.5);
    flash.tint = color;
    flash.blendMode = 'add';
    const c = cellCenter(reel, row);
    flash.position.set(c.x, c.y);
    flash.width = flash.height = CELL_W * 1.8;
    this.labelLayer.addChild(flash);
    gsap.fromTo(flash, { alpha: 0.95 }, { alpha: 0, duration: 0.6, onComplete: () => flash.destroy() });
  }

  clearWins(): void {
    this.cycleTl?.kill();
    this.cycleTl = null;
    this.dimLayer.clear();
    this.lineLayer.removeChildren().forEach((c) => c.destroy());
    this.labelLayer.removeChildren().forEach((c) => c.destroy());
    this.expandLayer.removeChildren().forEach((c) => c.destroy());
    for (const reel of this.reels) {
      for (const c of reel.cells) {
        gsap.killTweensOf(c.scale);
        gsap.killTweensOf(c);
        c.alpha = 1;
        c.filters = [];
      }
      reel.cells.forEach((_, i) => reel.setSymbol(i, reel.symbols[i]));
    }
  }

  private drawLine(line: number, alpha = 1): Container {
    const g = new Graphics();
    const rows = LINES[line];
    const color = LINE_COLORS[line];
    const pts = rows.map((row, r) => cellCenter(r, row));
    const path = (gr: Graphics) => {
      gr.moveTo(-14, pts[0].y);
      for (const p of pts) gr.lineTo(p.x, p.y);
      gr.lineTo(BOARD_W + 14, pts[pts.length - 1].y);
    };
    path(g);
    g.stroke({ width: 14, color, alpha: 0.25, join: 'round', cap: 'round' });
    path(g);
    g.stroke({ width: 5, color, alpha: 0.95, join: 'round', cap: 'round' });
    path(g);
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.8, join: 'round', cap: 'round' });
    g.alpha = alpha;
    g.filters = [new BlurFilter({ strength: 0.6 })];
    return g;
  }

  private dimExcept(cells: [number, number][]): void {
    const keep = new Set(cells.map(([r, row]) => `${r}:${row}`));
    this.dimLayer.clear();
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (!keep.has(`${r}:${row}`)) this.dimLayer.rect(reelX(r), row * CELL_H, CELL_W, CELL_H).fill({ color: 0x000000, alpha: 0.62 });
      }
    }
  }

  private animateCells(cells: [number, number][], strong: boolean): void {
    for (const [r, row] of cells) {
      const s = this.cell(r, row);
      gsap.killTweensOf(s.scale);
      const base = s.scale.x;
      gsap.to(s.scale, {
        x: base * (strong ? 1.14 : 1.08),
        y: base * (strong ? 1.14 : 1.08),
        duration: 0.32,
        yoyo: true,
        repeat: 3,
        ease: 'sine.inOut',
      });
      s.filters = [new GlowFilter({ distance: 14, outerStrength: strong ? 3 : 1.8, color: COLORS.infection, quality: 0.25 })];
    }
  }

  private addLabel(text: string, x: number, y: number, color = 0xffffff, scale = 1): Text {
    const t = new Text({
      text,
      style: {
        fontFamily: 'Cinzel, serif',
        fontWeight: '900',
        fontSize: 40,
        fill: color,
        stroke: { color: 0x000000, width: 7 },
        dropShadow: { color: COLORS.infection, blur: 12, distance: 0, alpha: 1 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.labelLayer.addChild(t);
    gsap.fromTo(t.scale, { x: 0.3 * scale, y: 0.3 * scale }, { x: scale, y: scale, duration: 0.35, ease: 'back.out(2)' });
    return t;
  }

  /**
   * Shows every winning line at once, then cycles through them one by one.
   * Resolves after the first full overview (the cycling keeps running until the next spin).
   */
  async presentWins(lineWins: LineWin[], scatter: ScatterWin | null, celebrate: boolean, onLine?: (i: number) => void): Promise<void> {
    if (!lineWins.length && !scatter) return;
    const all: [number, number][] = [...lineWins.flatMap((w) => w.cells), ...(scatter?.cells ?? [])];
    this.dimExcept(all);
    this.animateCells(all, celebrate);
    for (const w of lineWins) this.lineLayer.addChild(this.drawLine(w.line, 0.9));
    if (scatter) {
      const mid = scatter.cells[Math.floor(scatter.cells.length / 2)];
      const c = cellCenter(mid[0], mid[1]);
      this.addLabel(`${fmt(scatter.win)}`, c.x, c.y + CELL_H * 0.38, 0xffd27a);
    }
    await wait(celebrate ? 1300 : 900);

    const items: { cells: [number, number][]; line?: number; win: number }[] = [
      ...lineWins.map((w) => ({ cells: w.cells, line: w.line, win: w.win })),
      ...(scatter ? [{ cells: scatter.cells, win: scatter.win }] : []),
    ];
    if (items.length < 2 && !celebrate) return;
    const tl = gsap.timeline({ repeat: -1 });
    items.forEach((it, i) => {
      tl.add(() => {
        this.lineLayer.removeChildren().forEach((c) => c.destroy());
        this.labelLayer.removeChildren().forEach((c) => c.destroy());
        this.dimExcept(it.cells);
        if (it.line !== undefined) this.lineLayer.addChild(this.drawLine(it.line));
        const last = it.cells[it.cells.length - 1];
        const c = cellCenter(last[0], last[1]);
        this.addLabel(fmt(it.win), c.x, c.y + CELL_H * 0.36, it.line !== undefined ? LINE_COLORS[it.line] : 0xffd27a);
        this.animateCells(it.cells, false);
        onLine?.(i);
      });
      tl.to({}, { duration: 1.4 });
    });
    this.cycleTl = tl;
  }

  /** Book-style expansion: veins crawl down the reel, then the special symbol fills it. */
  async expand(exp: Expansion, onReel?: (reel: number) => void): Promise<void> {
    this.dimLayer.clear();
    this.lineLayer.removeChildren().forEach((c) => c.destroy());
    this.labelLayer.removeChildren().forEach((c) => c.destroy());
    for (const r of exp.reels) {
      const x = reelX(r);
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
      this.expandLayer.addChild(vm, veins, big);
      onReel?.(r);
      await new Promise<void>((resolve) => {
        gsap
          .timeline({ onComplete: resolve })
          .to(vm.scale, { y: 1, duration: 0.45, ease: 'power2.in' })
          .to(big, { alpha: 1, duration: 0.18 }, '-=0.05')
          .fromTo(big.scale, { x: big.scale.x * 1.2, y: big.scale.y * 1.05 }, { x: big.scale.x, y: big.scale.y, duration: 0.35, ease: 'back.out(2)' }, '<')
          .to(veins, { alpha: 0, duration: 0.3 });
      });
    }
    await wait(250);
    for (const line of exp.lines) this.lineLayer.addChild(this.drawLine(line, 0.7));
    this.addLabel(fmt(exp.win), BOARD_W / 2, BOARD_H / 2, 0xffd27a, 1.5);
    await wait(1500);
  }
}

const REEL_SEP_OFFSET = 5;
const FRAME_BLEED = 40;

/** Frame outline with its red glow baked into a texture (a live glow filter costs a full pass every frame). */
function frameTexture(pad: number): Texture {
  const w = BOARD_W + pad * 2;
  const h = BOARD_H + pad * 2;
  const c = document.createElement('canvas');
  c.width = w + FRAME_BLEED * 2;
  c.height = h + FRAME_BLEED * 2;
  const ctx = c.getContext('2d')!;
  ctx.translate(FRAME_BLEED, FRAME_BLEED);
  const rr = (x: number, y: number, ww: number, hh: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, ww, hh, r);
  };
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 26;
  ctx.strokeStyle = 'rgba(255,42,61,0.9)';
  ctx.lineWidth = 3;
  rr(7, 7, w - 14, h - 14, 13);
  ctx.stroke();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#2a2f38';
  ctx.lineWidth = 5;
  rr(0, 0, w, h, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,42,61,0.6)';
  ctx.lineWidth = 2;
  rr(7, 7, w - 14, h - 14, 13);
  ctx.stroke();
  return Texture.from(c);
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
