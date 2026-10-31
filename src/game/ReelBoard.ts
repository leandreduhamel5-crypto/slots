import { Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { REELS, ROWS, Sym } from '../math/config';
import type { Expansion, Grid, LineWin, ScatterWin } from '../math/engine';
import { Digits } from './Digits';
import { Particles } from './Particles';
import { Reel } from './Reel';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, COLORS, FRAME_MARGIN_X, FRAME_MARGIN_Y, REEL_GAP, SYMBOL_SIZE, TILE_H, TILE_W, cellCenter, reelX } from './layout';
import { FRAME_ART, FRAME_BLEED, FRAME_PAD, TEX_SIZE, TEX_UNIT, type SymbolTextures } from './textures';
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
  halo: Sprite;
  shine: Sprite;
  src: Sprite;
  tweens: gsap.core.Animation[];
}

/** Tint of the star-burst behind each winning symbol. */
/** Glowing eyes / gems on the painted symbols: [x, y, radius, tint] in texture px from the centre. */
const EYES: Partial<Record<Sym, [number, number, number, number][]>> = {
  [Sym.CODEX]: [[1, -80, 15, 0xffb040]],
  [Sym.ZERO]: [[-27, -23, 8, 0xff3a2a], [27, -23, 8, 0xff3a2a]],
  [Sym.MASK]: [[24, -23, 9, 0xff2a2a]],
  [Sym.ANTIDOTE]: [[0, -100, 16, 0xff3040]],
  [Sym.BLOOD]: [[5, -32, 20, 0xff4a2a]],
};

/** seconds between one winning symbol lighting up and the next */
const IGNITE_STAGGER = 0.13;

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


export class ReelBoard extends Container {
  readonly reels: Reel[] = [];
  private panels = new Container();
  private reelLayer = new Container();
  private dimLayer = new Graphics();
  private expandLayer = new Container();
  private frameLayer = new Container();
  private infectionGlow: Sprite;
  private anticipationLayer = new Container();
  private lineLayer = new Container();
  /** the gold ribbons joining winning symbols, under the symbols */
  private ribbonLayer = new Container();
  /** reels a strain column stands on, this spin */
  private columns = new Set<number>();
  private rigLayer = new Container();
  private fx: Particles;
  private labelLayer = new Container();
  private cycleTl: gsap.core.Timeline | null = null;
  private spinLights: Sprite[] = [];
  private rubyFlares: Sprite[] = [];
  private seatLights: Sprite[] = [];
  private edgeLights: Sprite[] = [];
  private accent = 0xffc860;
  private anticipationFx: { glow: Sprite; veins: Sprite; border: Graphics; comets: Sprite[] }[] = [];
  private throbbing: Rig[] = [];
  private rigs = new Map<string, Rig>();
  private hurried = false;
  /** camera hooks */
  onAnticipate: ((on: boolean) => void) | null = null;
  onImpact: ((power: number) => void) | null = null;
  /** a winning symbol of this reel has just lit up */
  onIgnite: ((reel: number) => void) | null = null;
  private ambientIn = 2.5;

  constructor(
    private tex: SymbolTextures,
    strips: Sym[][],
  ) {
    super();
    this.fx = new Particles(tex);

    // lapis and gold around the reels, running on under the frame
    const surround = new Sprite(tex.surround);
    surround.position.set(-FRAME_MARGIN_X - 16, -FRAME_MARGIN_Y - 16);
    this.addChildAt(surround, 0);
    const cast = new Sprite(tex.glow);
    cast.anchor.set(0.5);
    cast.position.set(BOARD_W / 2, BOARD_H / 2 + 34);
    cast.width = BOARD_W * 1.95;
    cast.height = BOARD_H * 2;
    cast.tint = 0x000000;
    cast.alpha = 0.9;
    this.addChildAt(cast, 0);
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
      // light curtain rising from the bottom of the reel (soft gradient: no hard edges)
      const veins = new Sprite(tex.veins);
      veins.anchor.set(0, 1);
      veins.position.set(reelX(r), BOARD_H);
      veins.width = CELL_W;
      veins.height = BOARD_H;
      veins.alpha = 0;
      veins.blendMode = 'add';
      // pulsing gold border with two comets of light racing around it
      const border = new Graphics();
      const pad = 3;
      for (const [w, a] of [[16, 0.18], [7, 0.4], [2.5, 1]] as const) {
        border.roundRect(reelX(r) - pad, -pad, CELL_W + pad * 2, BOARD_H + pad * 2, 10).stroke({ width: w, color: 0xffc860, alpha: a });
      }
      border.blendMode = 'add';
      border.alpha = 0;
      const comets = [0, 1].map(() => {
        const c = new Sprite(tex.glow);
        c.anchor.set(0.5);
        c.blendMode = 'add';
        c.tint = 0xfff0c0;
        c.alpha = 0;
        return c;
      });
      this.anticipationFx.push({ glow, veins, border, comets });
      this.anticipationLayer.addChild(glow, veins, border, ...comets);
      // energy running through the column while it turns
      const run = new Sprite(tex.glow);
      run.anchor.set(0.5);
      run.position.set(reelX(r) + CELL_W / 2, BOARD_H / 2);
      run.width = CELL_W * 1.15;
      run.height = BOARD_H * 1.5;
      run.blendMode = 'add';
      run.alpha = 0;
      this.spinLights.push(run);
      // the blow of the slab seating, travelling down the column
      const seat = new Sprite(tex.glow);
      seat.anchor.set(0.5);
      seat.position.set(reelX(r) + CELL_W / 2, 0);
      seat.width = CELL_W * 1.25;
      seat.height = CELL_H;
      seat.blendMode = 'add';
      seat.alpha = 0;
      this.seatLights.push(seat);
      // where the reel strikes the frame
      const edge = new Sprite(tex.glow);
      edge.anchor.set(0.5);
      edge.position.set(reelX(r) + CELL_W / 2, BOARD_H + 6);
      edge.width = CELL_W * 1.5;
      edge.height = 46;
      edge.blendMode = 'add';
      edge.alpha = 0;
      this.edgeLights.push(edge);
      this.anticipationLayer.addChild(run, seat);
    }

    const shade = new Sprite(tex.shade);
    shade.width = BOARD_W + 12;
    shade.height = BOARD_H;
    shade.x = -6;

    // the painted art-direction frame, on top of the whole slot
    const fit = FRAME_ART;
    // the frame lies over the whole slot; its opening is wider than the reels, so that the cobras
    // and pendants of the frame rest on the stone around them and not on the symbols
    const k = (BOARD_W + FRAME_MARGIN_X * 2) / fit.window[2];
    const ky = (BOARD_H + FRAME_MARGIN_Y * 2) / fit.window[3];
    const toBoard = (x: number, y: number): [number, number] => [-FRAME_MARGIN_X + (x - fit.window[0]) * k, -FRAME_MARGIN_Y + (y - fit.window[1]) * ky];
    const frame = new Sprite(tex.frame);
    if (tex.frame.width === fit.size[0]) {
      frame.scale.set(k, ky);
      frame.position.set(...toBoard(0, 0));
    } else frame.position.set(-FRAME_PAD - FRAME_BLEED, -FRAME_PAD - FRAME_BLEED);
    this.infectionGlow = new Sprite(tex.glow);
    this.infectionGlow.anchor.set(0.5);
    this.infectionGlow.position.set(BOARD_W / 2, BOARD_H / 2);
    this.infectionGlow.width = BOARD_W * 1.5;
    this.infectionGlow.height = BOARD_H * 1.8;
    this.infectionGlow.tint = COLORS.infection;
    this.infectionGlow.blendMode = 'add';
    this.infectionGlow.alpha = 0;
    // warm halo behind the gold, like the glow around the frame in the concept
    const halo = new Sprite(tex.glow);
    halo.anchor.set(0.5);
    halo.position.set(BOARD_W / 2, BOARD_H / 2);
    halo.width = BOARD_W * 1.55;
    halo.height = BOARD_H * 1.7;
    halo.tint = 0xff6a20;
    halo.blendMode = 'add';
    halo.alpha = 0.16;
    gsap.to(halo, { alpha: 0.26, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.frameLayer.addChild(halo, this.infectionGlow, frame);
    const light = (x: number, y: number, size: number, tint: number) => {
      const g = new Sprite(tex.glow);
      g.anchor.set(0.5);
      g.position.set(x, y);
      g.width = g.height = size;
      g.tint = tint;
      g.blendMode = 'add';
      this.frameLayer.addChild(g);
      return g;
    };
    // every ruby of the frame glows and pulses, a little out of phase
    fit.rubies.forEach(([rx, ry], i) => {
      const [x, y] = toBoard(rx, ry);
      const big = i === 4;
      const eye = light(x, y, (big ? 70 : i < 4 ? 44 : 22) * k * 2.1, COLORS.infection);
      const flare = light(x, y, (big ? 190 : i < 6 ? 130 : 70) * k, 0xff5a30);
      flare.alpha = 0;
      this.rubyFlares.push(flare);
      gsap.fromTo(eye, { alpha: 0.2 }, { alpha: big ? 0.7 : 0.55, duration: 1.1 + i * 0.17, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.3 });
      // a star glint crosses each ruby now and then
      const star = light(x - 3 * k, y - 4 * k, (big ? 46 : 26) * k * 2.1, 0xffffff);
      star.alpha = 0;
      const tw = () => gsap.timeline({ delay: 2 + Math.random() * 7, onComplete: tw }).to(star, { alpha: 0.9, duration: 0.12 }).to(star, { alpha: 0, duration: 0.5 });
      tw();
    });
    // a glint of light sweeps along the gold rails now and then
    const railY = [toBoard(0, fit.window[1] - 14)[1], toBoard(0, fit.window[1] + fit.window[3] + 14)[1]];
    for (const y of railY) {
      const glint = light(-60, y, 110, 0xfff2cc);
      glint.scale.y *= 0.2;
      glint.alpha = 0;
      const run = () =>
        gsap
          .timeline({ delay: 3 + Math.random() * 5, onComplete: run })
          .set(glint, { x: -60, alpha: 0 })
          .to(glint, { alpha: 0.85, duration: 0.2 })
          .to(glint, { x: BOARD_W + 60, duration: 1.5, ease: 'sine.inOut' }, 0)
          .to(glint, { alpha: 0, duration: 0.25 }, 1.25);
      run();
    }

    this.addChild(
      this.panels,
      mask,
      this.reelLayer,
      this.dimLayer,
      this.expandLayer,
      shade,
      this.ribbonLayer,
      this.rigLayer,
      this.anticipationLayer,
      this.lineLayer,
      this.frameLayer,
      ...this.edgeLights,
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
    return !this.cycleTl && this.rigs.size === 0 && this.columns.size === 0 && this.reels.every((r) => r.idle);
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
    this.accent = on ? 0xff3a24 : 0xffc860;
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
    const startGap = plan.turbo ? 0.02 : 0.045;
    this.reels.forEach((r, i) => {
      r.start(i * startGap * 1000);
      const run = this.spinLights[i];
      gsap.killTweensOf(run);
      run.tint = this.accent;
      gsap.to(run, { alpha: 0.2, duration: 0.3, delay: i * startGap });
    });

    const first = plan.turbo ? 260 : 500;
    const gap = plan.turbo ? 65 : 130;
    const anticipation = plan.turbo ? 800 : 1300;
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
          this.landImpact(i);
          plan.onReelStop?.(i);
        })(),
      );
      t += gap;
    }
    await Promise.all(stops);
  }

  /**
   * A reel has seated: nothing bounces. The light drains down the column in one blow, gold sand
   * spills from the seam and dust rolls along the base of the frame.
   */
  private landImpact(reel: number): void {
    const x = reelX(reel) + CELL_W / 2;
    const run = this.spinLights[reel];
    gsap.killTweensOf(run);
    gsap.to(run, { alpha: 0, duration: 0.18, ease: 'power2.out' });
    const seat = this.seatLights[reel];
    seat.tint = this.accent;
    gsap.killTweensOf(seat);
    gsap.fromTo(seat, { y: 0, alpha: 0.85 }, { y: BOARD_H, alpha: 0, duration: 0.2, ease: 'power2.in' });
    // a line of light where the reel stops; desert sand pours over the rail and gold flies off it
    const heavy = reel === REELS - 1;
    const y = BOARD_H + 8;
    const edge = this.edgeLights[reel];
    edge.tint = this.accent;
    gsap.killTweensOf(edge);
    gsap.fromTo(edge, { alpha: 0.85 }, { alpha: 0, duration: 0.28, ease: 'power2.out' });
    this.fx.seat(x, y, CELL_W * 0.92, heavy);
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
    const { glow, veins, border, comets } = this.anticipationFx[reel];
    gsap.killTweensOf([glow, glow.scale, veins, veins.scale, border, ...comets]);
    this.onAnticipate?.(on);
    if (on) {
      glow.alpha = 0;
      gsap.to(glow, { alpha: 0.38, duration: 0.25 });
      gsap.to(glow.scale, { x: glow.scale.x * 1.1, duration: 0.22, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      veins.alpha = 0.42;
      const sy = BOARD_H / veins.texture.height;
      veins.scale.y = 0;
      gsap.to(veins.scale, { y: sy, duration: dur, ease: 'power1.in' });
      gsap.fromTo(border, { alpha: 0 }, { alpha: 1, duration: 0.2 });
      gsap.to(border, { alpha: 0.45, duration: 0.18, yoyo: true, repeat: -1, delay: 0.2, ease: 'sine.inOut' });
      // comets race around the reel's outline, faster as the decision nears
      const L = 2 * (CELL_W + BOARD_H);
      const at = (d: number): [number, number] => {
        d = ((d % L) + L) % L;
        const x0 = reelX(reel) - 3;
        const w = CELL_W + 6;
        const h = BOARD_H + 6;
        if (d < w) return [x0 + d, -3];
        if (d < w + h) return [x0 + w, -3 + d - w];
        if (d < 2 * w + h) return [x0 + w - (d - w - h), h - 3];
        return [x0, h - 3 - (d - 2 * w - h)];
      };
      const run = { d: 0 };
      comets.forEach((c) => {
        c.alpha = 1;
        c.width = c.height = 46;
      });
      gsap.to(run, {
        d: L * 3.2,
        duration: dur,
        ease: 'power2.in',
        onUpdate: () => comets.forEach((c, k) => c.position.set(...at(run.d + (k * L) / 2))),
      });
      this.reels[reel].speedScale = 1.25;
      // the books already down throb like a heart while the last reel decides
      for (let r = 0; r < reel; r++) {
        for (let row = 0; row < ROWS; row++) {
          if (this.symbolAt(r, row) !== Sym.CODEX) continue;
          const rig = this.rig(r, row);
          const sc = rig.body.scale.x;
          rig.tweens.push(
            gsap.to(rig.body.scale, { x: sc * 1.12, y: sc * 1.12, duration: 0.2, yoyo: true, repeat: -1, repeatDelay: 0.25, ease: 'power2.out' }),
            gsap.to(rig.glow, { alpha: 0.8, duration: 0.2, yoyo: true, repeat: -1, repeatDelay: 0.25 }),
          );
          this.throbbing.push(rig);
        }
      }
      const x = reelX(reel) + CELL_W / 2;
      const emit = () => {
        if (glow.alpha <= 0.05) return;
        this.fx.sparks(x + (Math.random() - 0.5) * CELL_W, BOARD_H - 10, 3, 0.6);
        gsap.delayedCall(0.09, emit);
      };
      gsap.delayedCall(0.1, emit);
    } else {
      gsap.to(glow, { alpha: 0, duration: 0.3 });
      gsap.to(veins, { alpha: 0, duration: 0.25 });
      gsap.to(border, { alpha: 0, duration: 0.25 });
      gsap.to(comets, { alpha: 0, duration: 0.2 });
      this.reels[reel].speedScale = 1;
      for (const rig of this.throbbing) if (!rig.root.destroyed) this.dropRig(rig);
      this.throbbing = [];
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
    const halo = new Sprite(this.tex.glow);
    halo.anchor.set(0.5);
    halo.width = CELL_W * 1.5;
    halo.height = CELL_H * 1.5;
    halo.blendMode = 'add';
    halo.tint = SYMBOL_GLOW[sym] ?? COLORS.yellow;
    halo.alpha = 0;
    const body = new Container();
    body.scale.set(SYMBOL_SIZE / TEX_SIZE);
    // the bonus tile fills its cell: body keeps the common scale the animations rely on
    const seat = new Container();
    if (sym === Sym.CODEX) seat.scale.set(TILE_W / SYMBOL_SIZE, TILE_H / SYMBOL_SIZE);
    seat.addChild(body);
    root.addChild(halo, seat);
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
    shine.height = 460 * TEX_UNIT;
    shine.width = 150 * TEX_UNIT;
    shine.rotation = 0.38;
    shine.x = -TEX_SIZE;
    shine.blendMode = 'add';
    shine.mask = shineMask;
    src.alpha = 0;
    this.rigLayer.addChild(root);
    const rig: Rig = { key, reel, row, sym, root, body, parts, glow, halo, shine, src, tweens: [] };
    this.rigs.set(key, rig);
    return rig;
  }

  private dropRig(rig: Rig): void {
    for (const t of rig.tweens) t.kill();
    gsap.killTweensOf([rig.body, rig.body.scale, rig.glow, rig.halo, rig.halo.scale, rig.shine, ...Object.values(rig.parts), ...Object.values(rig.parts).map((p) => p.scale)]);
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

  /** Glow + cross glint sprites on a painted symbol's eyes (texture space, body-local). */
  private eyeFlares(rig: Rig, scale = 1): { glow: Sprite; cross: Container }[] {
    return (EYES[rig.sym] ?? []).map(([ex, ey, er, tint]) => {
      const x = ex * TEX_UNIT;
      const y = ey * TEX_UNIT;
      const r = er * TEX_UNIT;
      const glow = new Sprite(this.tex.glow);
      glow.anchor.set(0.5);
      glow.position.set(x, y);
      glow.width = glow.height = r * 6 * scale;
      glow.tint = tint;
      glow.blendMode = 'add';
      glow.alpha = 0;
      const cross = new Container();
      cross.position.set(x, y);
      cross.alpha = 0;
      for (const [w, h] of [[r * 11, r * 0.6], [r * 0.6, r * 7]]) {
        const ray = new Sprite(this.tex.glow);
        ray.anchor.set(0.5);
        ray.width = w * scale;
        ray.height = h * scale;
        ray.tint = 0xffe0c0;
        ray.blendMode = 'add';
        cross.addChild(ray);
      }
      rig.body.addChild(glow, cross);
      return { glow, cross };
    });
  }

  /** Win signature for the painted Egyptian symbols (and the royals). */
  private egyptWin(rig: Rig, tl: gsap.core.Timeline, amp: number, once: (fn: () => void) => void, pos: { x: number; y: number }): void {
    const b = rig.body;
    for (const f of this.eyeFlares(rig)) {
      tl.fromTo(f.glow, { alpha: 0 }, { alpha: 1, duration: 0.18 }, 0.12)
        .fromTo(f.glow.scale, { x: f.glow.scale.x * 0.4, y: f.glow.scale.y * 0.4 }, { x: f.glow.scale.x, y: f.glow.scale.y, duration: 0.35, ease: 'power3.out' }, 0.12)
        .fromTo(f.cross, { alpha: 0, rotation: -0.5 }, { alpha: 1, rotation: 0.25, duration: 0.4, ease: 'power2.out' }, 0.16)
        .to(f.cross, { alpha: 0, duration: 0.35 }, 0.62)
        .to(f.glow, { alpha: 0.55, duration: 0.4 }, 0.6);
    }
    once(() => this.fx.sparks(pos.x, pos.y, amp > 0.8 ? 12 : 6, 0.55));
    switch (rig.sym) {
      case Sym.ZERO: // Pharaoh: a slow, regal rise
        tl.to(b, { y: -10 * amp, duration: 0.35, ease: 'power2.out' }, 0.15).to(b, { y: 0, duration: 0.5, ease: 'sine.inOut' }, 0.75);
        break;
      case Sym.MASK: // Anubis: snarling head toss
        tl.to(b, { rotation: -0.12 * amp, duration: 0.12, ease: 'power2.out' }, 0.18)
          .to(b, { rotation: 0, duration: 0.45, ease: 'power2.inOut' });
        break;
      case Sym.ANTIDOTE: // Scarab: scuttles
        tl.to(b, { rotation: 0.05 * amp, duration: 0.09, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.18);
        break;
      case Sym.BLOOD: // Eye of Horus: throbs
        tl.to(rig.glow, { alpha: 0.3, duration: 0.14 }, 0.3).to(rig.glow, { alpha: 0.05, duration: 0.6 }, 0.45);
        break;
      default: // royals
        // the royals simply catch the light
    }
  }

  /** A four-pointed star of light, on and off, somewhere on the symbol's edge. */
  private twinkle(rig: Rig, delay: number): void {
    const star = new Sprite(this.tex.star);
    star.anchor.set(0.5);
    star.blendMode = 'add';
    star.tint = 0xffe6b0;
    const a = Math.random() * Math.PI * 2;
    star.position.set(Math.cos(a) * SYMBOL_SIZE * (0.26 + Math.random() * 0.2), Math.sin(a) * SYMBOL_SIZE * (0.26 + Math.random() * 0.2));
    const size = (26 + Math.random() * 26) / star.texture.width;
    star.scale.set(0);
    rig.root.addChild(star);
    rig.tweens.push(
      gsap
        .timeline({ delay, repeat: -1, repeatDelay: 0.9 + Math.random() * 1.2 })
        .to(star.scale, { x: size, y: size, duration: 0.2, ease: 'sine.out' })
        .to(star, { rotation: 0.8, duration: 0.45, ease: 'none' }, 0)
        .to(star.scale, { x: 0, y: 0, duration: 0.25, ease: 'sine.in' }, 0.2),
    );
  }

  private performIdle(rig: Rig): void {
    const b = rig.body;
    const s = b.scale.x;
    let tl: gsap.core.Timeline;
    if (!this.tex.rigs.has(rig.sym) && EYES[rig.sym]) {
      // the painted gods watch: eyes kindle, a glint, then back to sleep
      tl = gsap.timeline();
      for (const f of this.eyeFlares(rig, 0.7)) {
        tl.fromTo(f.glow, { alpha: 0 }, { alpha: 0.95, duration: 0.25 }, 0).to(f.glow, { alpha: 0, duration: 0.6 }, 0.7);
        tl.fromTo(f.cross, { alpha: 0, rotation: -0.3 }, { alpha: 1, rotation: 0.3, duration: 0.35 }, 0.1).to(f.cross, { alpha: 0, duration: 0.3 }, 0.5);
      }
      tl.fromTo(rig.shine, { x: -TEX_SIZE }, { x: TEX_SIZE, duration: 0.7, ease: 'power1.inOut' }, 0);
      tl.eventCallback('onComplete', () => this.dropRig(rig));
      rig.tweens.push(tl);
      return;
    }
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
          .to(rig.glow, { alpha: 0.5, duration: 0.15 }, 0)
          .to(rig.glow, { alpha: 0, duration: 0.4 }, 0.5);
        break;
      case Sym.BLOOD:
        tl = gsap
          .timeline()
          .to(b.scale, { x: s * 1.08, y: s * 0.93, duration: 0.15 })
          .to(b.scale, { x: s * 0.95, y: s * 1.06, duration: 0.15 })
          .to(b.scale, { x: s, y: s, duration: 0.5, ease: 'power3.out' });
        break;
      default:
        tl = gsap
          .timeline()
          .to(rig.glow, { alpha: 0.5, duration: 0.25, yoyo: true, repeat: 1 })
          .to(b, { rotation: 0.06, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0);
    }
    // a light sweep glints across the symbol
    tl.fromTo(rig.shine, { x: -TEX_SIZE }, { x: TEX_SIZE, duration: 0.7, ease: 'power1.inOut' }, 0);
    tl.eventCallback('onComplete', () => this.dropRig(rig));
    rig.tweens.push(tl);
  }

  /**
   * A winning symbol catches the light: it comes forward into a warm glow of gold, a blade of
   * light crosses it and stars of light twinkle on its edges, like sun on polished metal.
   */
  private performWin(rig: Rig, strong: boolean, delay: number): void {
    const b = rig.body;
    const s = SYMBOL_SIZE / TEX_SIZE;
    const amp = strong ? 1 : 0.65;
    const pos = cellCenter(rig.reel, rig.row);
    const hs = rig.halo.scale.x;
    const up = s * (1 + 0.13 * amp);
    const tl = gsap.timeline({ delay });
    tl.fromTo(rig.halo, { alpha: 0 }, { alpha: strong ? 0.62 : 0.42, duration: 0.2, ease: 'sine.out' }, 0)
      .to(rig.halo, { alpha: strong ? 0.3 : 0.2, duration: 0.7, ease: 'sine.out' }, 0.2)
      .fromTo(rig.halo.scale, { x: hs * 0.7, y: hs * 0.7 }, { x: hs, y: hs, duration: 0.45, ease: 'power2.out' }, 0)
      .to(b.scale, { x: up, y: up, duration: 0.38, ease: 'power3.out' }, 0)
      .fromTo(rig.glow, { alpha: 0.08 }, { alpha: 0, duration: 0.6, ease: 'sine.out' }, 0);
    rig.tweens.push(
      gsap.to(b.scale, { x: up * 0.97, y: up * 0.97, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 0.45 }),
      gsap.to(rig.halo, { alpha: strong ? 0.4 : 0.28, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 0.9 }),
      gsap.fromTo(rig.shine, { x: -TEX_SIZE }, { x: TEX_SIZE, duration: 0.75, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.5, delay: delay + 0.1 }),
    );
    for (let i = 0; i < (strong ? 5 : 3); i++) this.twinkle(rig, delay + 0.15 + i * 0.26);
    // one-shot particle effects, so a looping win cycle doesn't flood the screen
    const once = (fn: () => void) => rig.tweens.push(gsap.delayedCall(delay + 0.3, fn));
    once(() => this.fx.sand(pos.x, pos.y + CELL_H * 0.2, CELL_W * 0.7, strong ? 22 : 10, 1.1));
    if (!this.tex.rigs.has(rig.sym)) this.egyptWin(rig, tl, amp, once, pos);
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
    gsap.fromTo(flash, { alpha: 0.22 }, { alpha: 0, duration: 0.5, onComplete: () => flash.destroy() });
    this.fx.impact(c.x, c.y, 0.8, 1);
    const rig = this.rig(reel, row);
    const s = SYMBOL_SIZE / TEX_SIZE;
    const tl = gsap
      .timeline({ onComplete: () => this.dropRig(rig) })
      .fromTo(rig.body.scale, { x: s * 1.3, y: s * 1.3 }, { x: s, y: s, duration: 0.2, ease: 'power3.in' })
      .fromTo(rig.glow, { alpha: 0.08 }, { alpha: 0, duration: 0.5 }, 0);
    if (rig.parts.lid) tl.add(this.blink(rig), 0.35);
    rig.tweens.push(tl);
  }

  clearWins(): void {
    this.cycleTl?.kill();
    this.cycleTl = null;
    this.dimLayer.clear();
    this.clearRigs();
    this.columns.clear();
    for (const layer of [this.lineLayer, this.ribbonLayer, this.labelLayer, this.expandLayer]) {
      for (const c of layer.removeChildren()) {
        gsap.killTweensOf(c);
        c.destroy({ children: true });
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
    for (const layer of [this.lineLayer, this.ribbonLayer, this.labelLayer]) {
      for (const c of layer.removeChildren()) {
        gsap.killTweensOf(c);
        c.destroy({ children: true });
      }
    }
  }

  /**
   * The reading of a win: a ribbon of gold grows from symbol to symbol, in step with their lighting
   * up. It joins only the symbols that won, so what paid can be seen at a glance.
   */
  private linkCells(cells: Cell[], stagger: number): void {
    const pts = [...cells].sort((a, b) => a[0] - b[0]).map(([r, row]) => cellCenter(r, row));
    if (pts.length < 2) return;
    const g = new Graphics();
    g.blendMode = 'add';
    this.ribbonLayer.addChild(g);
    const draw = (t: number) => {
      if (g.destroyed) return;
      const end = t * (pts.length - 1);
      const n = Math.floor(end);
      const tip = n >= pts.length - 1 ? pts[pts.length - 1] : { x: pts[n].x + (pts[n + 1].x - pts[n].x) * (end - n), y: pts[n].y + (pts[n + 1].y - pts[n].y) * (end - n) };
      const path = [...pts.slice(0, n + 1), tip];
      g.clear();
      for (const [width, color, alpha] of [[34, 0xffa030, 0.14], [14, 0xffc860, 0.42], [4.5, 0xfff0c8, 0.95]] as const) {
        g.moveTo(path[0].x, path[0].y);
        for (const p of path) g.lineTo(p.x, p.y);
        g.stroke({ width, color, alpha, join: 'round', cap: 'round' });
      }
    };
    const o = { t: 0 };
    draw(0);
    gsap.to(o, { t: 1, duration: stagger * (pts.length - 1), ease: 'none', onUpdate: () => draw(o.t) });
  }

  private dimExcept(cells: Cell[]): void {
    const keep = new Set(cells.map(([r, row]) => `${r}:${row}`));
    this.dimLayer.clear();
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (!keep.has(`${r}:${row}`)) this.dimLayer.rect(reelX(r), row * CELL_H, CELL_W + REEL_GAP, CELL_H).fill({ color: 0x07030a, alpha: 0.8 });
      }
    }
    gsap.killTweensOf(this.dimLayer);
    gsap.fromTo(this.dimLayer, { alpha: 0 }, { alpha: 1, duration: 0.3, ease: 'sine.out' });
  }

  /** The frame answers a win: every ruby flares, then a pillar of gold rises in the winning reels. */
  private celebrateFrame(reels: number[], strong: boolean): void {
    this.rubyFlares.forEach((f, i) => {
      gsap.killTweensOf(f);
      gsap.fromTo(f, { alpha: 0 }, { alpha: strong ? 0.9 : 0.55, duration: 0.2, delay: i * 0.025, yoyo: true, repeat: 1, repeatDelay: 0.2, ease: 'sine.inOut' });
    });
    if (!strong) return;
    this.raceFrame();
    for (const r of new Set(reels)) {
      const p = new Sprite(this.tex.veins);
      p.anchor.set(0, 1);
      p.position.set(reelX(r), BOARD_H);
      p.width = CELL_W;
      p.height = BOARD_H;
      p.blendMode = 'add';
      p.tint = 0xffc860;
      this.lineLayer.addChildAt(p, 0);
      const sy = p.scale.y;
      gsap.fromTo(p.scale, { y: 0 }, { y: sy, duration: 0.6, delay: r * 0.07, ease: 'power2.out' });
      gsap.fromTo(p, { alpha: 0.75 }, { alpha: 0, duration: 1.1, delay: r * 0.07 + 0.25, ease: 'sine.in', onComplete: () => !p.destroyed && p.destroy() });
    }
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
      this.performWin(this.rig(r, row), strong, r * stagger);
      gsap.delayedCall(r * stagger, () => this.onIgnite?.(r));
    });
  }

  private addLabel(text: string, x: number, y: number, _color = 0xffffff, scale = 1): Digits {
    const t = new Digits(54);
    t.text = text;
    const pool = new Sprite(this.tex.glow);
    pool.anchor.set(0.5);
    pool.width = 34 + t.inkWidth * 1.5;
    pool.height = 104;
    pool.tint = 0x000000;
    t.addChildAt(pool, 0);
    t.position.set(x, y);
    this.labelLayer.addChild(t);
    gsap.fromTo(t.scale, { x: 0.2 * scale, y: 0.2 * scale }, { x: scale, y: scale, duration: 0.5, ease: 'power3.out' });
    gsap.from(t, { y: y + 24, duration: 0.35, ease: 'power3.out' });
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
    if (lineWins.length === 1 && !scatter) this.linkCells(lineWins[0].cells, IGNITE_STAGGER);
    this.highlightCells(all, celebrate, IGNITE_STAGGER);
    this.celebrateFrame(all.map(([r]) => r), celebrate);
    if (scatter) {
      const mid = scatter.cells[Math.floor(scatter.cells.length / 2)];
      const c = cellCenter(mid[0], mid[1]);
      this.addLabel(fmt(scatter.win), c.x, c.y + CELL_H * 0.36, COLORS.yellow);
    }
    await wait(celebrate ? 1150 : 750);

    // each win is shown once, then the board goes quiet until the next spin
    const items: { cells: Cell[]; line?: number; win: number }[] = [
      ...lineWins.map((w) => ({ cells: w.cells, line: w.line, win: w.win })),
      ...(scatter ? [{ cells: scatter.cells, win: scatter.win }] : []),
    ];
    const tl = gsap.timeline({
      onComplete: () => {
        this.cycleTl = null;
        this.clearHighlights();
      },
    });
    if (items.length > 1) {
      items.forEach((it, i) => {
        tl.add(() => {
          this.clearHighlights();
          this.dimExcept(it.cells);
          if (it.line !== undefined) this.linkCells(it.cells, 0.09);
          const last = it.cells[it.cells.length - 1];
          const c = cellCenter(last[0], last[1]);
          this.addLabel(fmt(it.win), c.x, c.y + CELL_H * 0.36, COLORS.yellow);
          this.highlightCells(it.cells, false, 0.09);
          onLine?.(i);
        });
        tl.to({}, { duration: items.length > 4 ? 0.7 : 1 });
      });
    } else tl.to({}, { duration: 0.9 });
    this.cycleTl = tl;
  }

  /**
   * The amount lands in the middle of the reels like a seal: it falls out of the light, hits, and
   * the gold flies. size 0..2.
   */
  showWinBurst(amount: number, size: number): void {
    const c = new Container();
    c.position.set(BOARD_W / 2, BOARD_H / 2);
    const shade = new Sprite(this.tex.glow);
    shade.anchor.set(0.5);
    shade.width = 760;
    shade.height = 320;
    shade.tint = 0x000000;
    shade.alpha = 0.72;
    const flash = new Sprite(this.tex.glow);
    flash.anchor.set(0.5);
    flash.width = 900;
    flash.height = 420;
    flash.blendMode = 'add';
    flash.tint = 0xffc860;
    flash.alpha = 0;
    const val = new Digits(118);
    val.value = amount;
    const k = (size >= 2 ? 1 : 0.8) * Math.min(1, (BOARD_W * 0.7) / Math.max(1, val.inkWidth));
    c.addChild(shade, flash, val);
    this.labelLayer.addChild(c);
    gsap.fromTo(c, { alpha: 0 }, { alpha: 1, duration: 0.12 });
    gsap.fromTo(val.scale, { x: k * 1.9, y: k * 1.9 }, {
      x: k,
      y: k,
      duration: 0.3,
      ease: 'power3.in',
      onComplete: () => {
        if (c.destroyed) return;
        this.onImpact?.(0.5 + size * 0.3);
        gsap.fromTo(flash, { alpha: 1 }, { alpha: 0, duration: 0.6, ease: 'power2.out' });
        this.fx.coins(BOARD_W / 2, BOARD_H / 2, 8 + size * 8, 0.8);
        this.fx.sand(BOARD_W / 2, BOARD_H / 2, BOARD_W * 0.5, 50 + size * 30, 1.8);
      },
    });
    gsap.to(c, { alpha: 0, duration: 0.3, delay: 1.25, onComplete: () => !c.destroyed && c.destroy({ children: true }) });
  }

  /** Two sparks of gold race round the opening of the frame. */
  private raceFrame(): void {
    const x0 = -FRAME_MARGIN_X + 6;
    const y0 = -FRAME_MARGIN_Y + 6;
    const w = BOARD_W + (FRAME_MARGIN_X - 6) * 2;
    const h = BOARD_H + (FRAME_MARGIN_Y - 6) * 2;
    const L = 2 * (w + h);
    const at = (d: number): [number, number] => {
      d = ((d % L) + L) % L;
      if (d < w) return [x0 + d, y0];
      if (d < w + h) return [x0 + w, y0 + d - w];
      if (d < 2 * w + h) return [x0 + w - (d - w - h), y0 + h];
      return [x0, y0 + h - (d - 2 * w - h)];
    };
    for (const start of [0, L / 2]) {
      const s = new Sprite(this.tex.glow);
      s.anchor.set(0.5);
      s.width = s.height = 90;
      s.blendMode = 'add';
      s.tint = 0xffe0a0;
      this.labelLayer.addChild(s);
      const o = { d: start };
      gsap.to(o, {
        d: start + L,
        duration: 1.1,
        ease: 'sine.inOut',
        onUpdate: () => {
          if (s.destroyed) return;
          const [x, y] = at(o.d);
          s.position.set(x, y);
          this.fx.sand(x, y, 12, 1, 0.4);
        },
        onComplete: () => !s.destroyed && s.destroy(),
      });
    }
  }

  /** Gold coins spraying out of the win plaque. */
  coinBurst(n: number): void {
    if (n > 0) this.fx.coins(BOARD_W / 2, BOARD_H + 40, n, 0.85);
  }

  /** A pillar of light where a strain slams into a reel. */
  private slamLight(cx: number): void {
    const layer = this.labelLayer;
    const beam = new Sprite(this.tex.glow);
    beam.anchor.set(0.5);
    beam.position.set(cx, BOARD_H / 2);
    beam.width = CELL_W * 1.8;
    beam.height = BOARD_H * 2.4;
    beam.tint = 0xffd2a0;
    beam.blendMode = 'add';
    const core = new Sprite(this.tex.glow);
    core.anchor.set(0.5);
    core.position.set(cx, BOARD_H / 2);
    core.width = CELL_W * 0.5;
    core.height = BOARD_H * 2.2;
    core.tint = 0xffffff;
    core.blendMode = 'add';
    layer.addChild(beam, core);
    const done = () => [beam, core].forEach((o) => !o.destroyed && o.destroy());
    gsap.fromTo(beam, { alpha: 0.6 }, { alpha: 0, duration: 0.7, ease: 'power2.out', onComplete: done });
    gsap.fromTo(beam.scale, { x: beam.scale.x * 1.4 }, { x: beam.scale.x * 0.4, duration: 0.7, ease: 'power2.out' });
    gsap.fromTo(core, { alpha: 0.5 }, { alpha: 0, duration: 0.45, ease: 'power3.out' });
    this.fx.coins(cx, BOARD_H * 0.75, 8, 0.8);
  }

  /** Lets the pass over the winning lines finish, briskly: it must not light symbols over a column. */
  private settleWins(): Promise<void> {
    const tl = this.cycleTl;
    if (!tl) return Promise.resolve();
    tl.timeScale(2.5);
    return new Promise((resolve) => {
      tl.eventCallback('onComplete', () => {
        this.cycleTl = null;
        resolve();
      });
    });
  }

  /** Book-style expansion: infected light rises up the reel, it bursts, then the strain slams in. */
  async expand(exp: Expansion, onReel?: (reel: number) => void): Promise<void> {
    await this.settleWins();
    this.clearHighlights();
    for (const r of exp.reels) {
      const x = reelX(r);
      // a reel a first strain has already taken shows nothing of what lies beneath its column
      const covered = this.columns.has(r);
      this.columns.add(r);
      for (let row = 0; row < ROWS && !covered; row++) {
        if (this.symbolAt(r, row) === exp.symbol) {
          const rig = this.rig(r, row);
          const s = SYMBOL_SIZE / TEX_SIZE;
          rig.tweens.push(
            gsap
              .timeline()
              .to(rig.body.scale, { x: s * 1.3, y: s * 1.3, duration: 0.2, ease: 'power3.out' })
              .to(rig.glow, { alpha: 0.55, duration: 0.2 }, 0),
          );
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
      big.width = CELL_W + 6;
      big.height = BOARD_H + 6;
      big.alpha = 0;
      const light = new Sprite(this.tex.glow);
      light.anchor.set(0.5);
      light.position.copyFrom(big.position);
      light.width = CELL_W * 1.9;
      light.height = BOARD_H * 1.25;
      light.blendMode = 'add';
      light.tint = 0xffb040;
      light.alpha = 0;
      const sweepMask = new Sprite(this.tex.expanded.get(exp.symbol)!);
      sweepMask.anchor.set(0.5);
      sweepMask.position.copyFrom(big.position);
      sweepMask.width = big.width;
      sweepMask.height = big.height;
      const sweep = new Sprite(this.tex.shine);
      sweep.anchor.set(0.5);
      sweep.width = CELL_W * 1.1;
      sweep.height = 260;
      sweep.rotation = Math.PI / 2 + 0.35;
      sweep.blendMode = 'add';
      sweep.position.set(big.x, -240);
      sweep.mask = sweepMask;
      // under every column: the lights of neighbouring reels must not wash each other out
      this.expandLayer.addChildAt(light, 0);
      this.expandLayer.addChild(vm, veins, big, sweepMask, sweep);
      onReel?.(r);
      await new Promise<void>((resolve) => {
        const sx = big.scale.x;
        const sy = big.scale.y;
        gsap
          .timeline({ onComplete: resolve })
          .to(vm.scale, { y: 1, duration: 0.4, ease: 'power2.in' })
          .add(() => {
            for (const rig of [...this.rigs.values()].filter((g) => g.reel === r)) this.dropRig(rig);
            this.onImpact?.(0.8);
            this.slamLight(x + CELL_W / 2);
            for (let row = 0; row < ROWS; row++) this.fx.seat(x + CELL_W / 2, (row + 1) * CELL_H, CELL_W * 0.9, false);
          })
          .to(big, { alpha: 1, duration: 0.05 })
          .fromTo(big.scale, { x: sx * 1.09, y: sy * 1.09 }, { x: sx, y: sy, duration: 0.3, ease: 'power3.in' }, '<')
          .fromTo(light, { alpha: 0.95 }, { alpha: 0.26, duration: 0.7, ease: 'power2.out' }, '<')
          .to(veins, { alpha: 0, duration: 0.3 }, '<')
          .to(sweep, { y: BOARD_H + 240, duration: 0.6, ease: 'power1.inOut' }, '<0.12');
      });
      gsap.to(light, { alpha: 0.42, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    this.clearRigs();
    await wait(250);
    this.addLabel(fmt(exp.win), BOARD_W / 2, BOARD_H / 2, COLORS.yellow, 1.7);
    this.fx.coins(BOARD_W / 2, BOARD_H * 0.62, 18, 0.9);
    await wait(1400);
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
