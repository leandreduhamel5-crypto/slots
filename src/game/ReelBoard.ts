import { Container, Graphics, Mesh, PlaneGeometry, Sprite, Text, Texture, type NineSliceSprite } from 'pixi.js';
import gsap from 'gsap';
import { REELS, ROWS, Sym } from '../math/config';
import type { Expansion, Grid, LineWin, ScatterWin } from '../math/engine';
import { Digits } from './Digits';
import { Particles } from './Particles';
import { Reel } from './Reel';
import { BOARD_H, BOARD_W, CELL_H, CELL_W, COLORS, FRAME_MARGIN_X, FRAME_MARGIN_Y, REEL_GAP, SYMBOL_SIZE, TILE_H, TILE_W, cellCenter, reelX } from './layout';
import { paintCellFrame } from './art/egyptFrame';
import { makePlate } from './StrainBar';
import { FRAME_ART, FRAME_BLEED, FRAME_PAD, TEX_SIZE, TEX_UNIT, type SymbolTextures } from './textures';

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
  /** the vertices of the symbol, when it can turn on itself; shared by its picture and its glow */
  geo: PlaneGeometry | null;
  /** lights set on the symbol, which must follow it when it turns */
  pins: { o: Container; x: number; y: number }[];
  /** part of a win: the short flash of its landing must not take it away */
  won: boolean;
}

/** The plaque under the reels: what a win pays is read there, and nothing is ever written over the symbols. */
interface WinPlate {
  root: Container;
  plate: NineSliceSprite;
  caption: Text;
  value: Digits;
  shown: { v: number };
}

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

/** vertices per side of a symbol that turns: at 10 × 10 it still goes through the batcher */
const TURN_GRID = 10;
/** how far the middle of each symbol stands out of its plane, in half widths */
const RELIEF: Partial<Record<Sym, number>> = {
  [Sym.ZERO]: 0.55,
  [Sym.MASK]: 0.5,
  [Sym.ANTIDOTE]: 0.45,
  [Sym.BLOOD]: 0.4,
  [Sym.A]: 0.24,
  [Sym.K]: 0.24,
  [Sym.Q]: 0.24,
  [Sym.J]: 0.24,
  [Sym.TEN]: 0.24,
};
const PLATE_W = 430;
const PLATE_H = 94;
/** from the bottom of the reels: the plaque lies over the foot of the frame */
const PLATE_Y = 50;

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
  private rubyFlares: Sprite[] = [];
  private edgeLights: Sprite[] = [];
  private accent = 0xffc860;
  private plateLayer = new Container();
  private plate: WinPlate | null = null;
  private cellFrame = Texture.from(paintCellFrame(CELL_W, CELL_H));
  private spareGeometry: PlaneGeometry[] = [];
  /** in the bonus, winning symbols light up without moving */
  private still = false;
  private anticipationFx: { glow: Sprite; veins: Sprite; border: Graphics; comets: Sprite[] }[] = [];
  private throbbing: Rig[] = [];
  private rigs = new Map<string, Rig>();
  private hurried = false;
  /** camera hooks */
  private ambientIn = 2.5;
  /** a winning symbol of this reel has just lit up */
  onIgnite: ((reel: number) => void) | null = null;

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
      // where the reel strikes the frame
      const edge = new Sprite(tex.glow);
      edge.anchor.set(0.5);
      edge.position.set(reelX(r) + CELL_W / 2, BOARD_H + 6);
      edge.width = CELL_W * 1.5;
      edge.height = 46;
      edge.blendMode = 'add';
      edge.alpha = 0;
      this.edgeLights.push(edge);
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
    if (Math.abs(tex.frame.width - fit.size[0]) < 2) {
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
    halo.alpha = 0.1;
    this.frameLayer.addChild(halo, this.infectionGlow, frame);
    // now and then the light slides across the gold of the frame; nothing moves but the light
    const goldOnly = new Sprite(tex.frame);
    goldOnly.scale.copyFrom(frame.scale);
    goldOnly.position.copyFrom(frame.position);
    const sheen = new Sprite(tex.shine);
    sheen.anchor.set(0.5);
    sheen.width = 260;
    sheen.height = BOARD_H * 2;
    sheen.rotation = 0.32;
    sheen.y = BOARD_H / 2;
    sheen.blendMode = 'add';
    sheen.alpha = 0.3;
    sheen.mask = goldOnly;
    sheen.visible = false;
    this.frameLayer.addChild(goldOnly, sheen);
    gsap.fromTo(sheen, { x: -320 }, {
      x: BOARD_W + 320,
      duration: 1.7,
      ease: 'sine.inOut',
      repeat: -1,
      repeatDelay: 16,
      delay: 9,
      onStart: () => (sheen.visible = true),
      onRepeat: () => (sheen.visible = true),
      onComplete: () => (sheen.visible = false),
    });
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
      // the two great rubies of the crests, top and bottom
      const big = i === 4 || i === 5;
      const eye = light(x, y, (big ? 70 : i < 4 ? 44 : 22) * k * 2.1, COLORS.infection);
      const flare = light(x, y, (big ? 190 : i < 6 ? 130 : 70) * k, 0xff5a30);
      flare.alpha = 0;
      this.rubyFlares.push(flare);
      gsap.fromTo(eye, { alpha: 0.12 }, { alpha: big ? 0.34 : 0.26, duration: 2.2 + i * 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.3 });
      // a star glint crosses each ruby now and then
      const star = light(x - 3 * k, y - 4 * k, (big ? 46 : 26) * k * 2.1, 0xffffff);
      star.alpha = 0;
      const tw = () => gsap.timeline({ delay: 8 + Math.random() * 18, onComplete: tw }).to(star, { alpha: 0.5, duration: 0.2 }).to(star, { alpha: 0, duration: 0.6 });
      tw();
    });
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
      this.plateLayer,
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
    this.still = on;
    this.accent = on ? 0xff3a24 : 0xffc860;
    gsap.killTweensOf(this.infectionGlow);
    if (on) {
      this.infectionGlow.alpha = 0.07;
      gsap.to(this.infectionGlow, { alpha: 0.12, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
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

  /** A reel has seated: nothing bounces. A thin line of light runs along the rail and gold sand spills from the seam. */
  private landImpact(reel: number): void {
    const edge = this.edgeLights[reel];
    edge.tint = this.accent;
    gsap.killTweensOf(edge);
    gsap.fromTo(edge, { alpha: 0.3 }, { alpha: 0, duration: 0.25, ease: 'power2.out' });
    this.fx.seat(reelX(reel) + CELL_W / 2, BOARD_H + 8, CELL_W * 0.9, reel === REELS - 1);
  }

  /** the player has stopped the reels by hand */
  get slammed(): boolean {
    return this.hurried;
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
    if (on) {
      glow.alpha = 0;
      gsap.to(glow, { alpha: 0.16, duration: 0.25 });
      gsap.to(glow.scale, { x: glow.scale.x * 1.1, duration: 0.22, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      veins.alpha = 0.18;
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
        c.alpha = 0.7;
        c.width = c.height = 30;
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
    halo.tint = this.accent;
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
    const relief = !r && RELIEF[sym] ? this.takeGeometry() : null;
    const onGrid = (t: Texture) => {
      const m = new Mesh({ geometry: relief!, texture: t });
      body.addChild(m);
      return m;
    };
    if (r) {
      add(r.base);
      for (const [name, t] of Object.entries(r.parts)) parts[name] = add(t);
      if (parts.lid) parts.lid.scale.y = 0;
    } else if (relief) onGrid(this.tex.normal[sym]);
    else add(this.tex.normal[sym]);
    const glow = relief ? (onGrid(this.tex.glowMaps[sym]) as unknown as Sprite) : add(this.tex.glowMaps[sym]);
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
    const rig: Rig = { key, reel, row, sym, root, body, parts, glow, halo, shine, src, tweens: [], geo: relief, pins: [], won: false };
    this.rigs.set(key, rig);
    return rig;
  }

  private dropRig(rig: Rig): void {
    for (const t of rig.tweens) t.kill();
    gsap.killTweensOf([rig.body, rig.body.scale, rig.glow, rig.halo, rig.halo.scale, rig.shine, ...Object.values(rig.parts), ...Object.values(rig.parts).map((p) => p.scale)]);
    rig.src.alpha = 1;
    rig.root.destroy({ children: true });
    if (rig.geo) {
      this.turn(rig, 0);
      this.spareGeometry.push(rig.geo);
    }
    this.rigs.delete(rig.key);
  }

  /** A flat grid the size of a symbol, centred; they are kept and reused, rigs come and go all the time. */
  private takeGeometry(): PlaneGeometry {
    const spare = this.spareGeometry.pop();
    if (spare) return spare;
    const g = new PlaneGeometry({ width: TEX_SIZE, height: TEX_SIZE, verticesX: TURN_GRID, verticesY: TURN_GRID });
    const p = g.positions;
    for (let i = 0; i < p.length; i++) p[i] -= TEX_SIZE / 2;
    g.getBuffer('aPosition').update();
    return g;
  }

  /** Where a point of a symbol goes when the symbol is turned by `a` radians: its middle stands proud, like a head. */
  private turned(x: number, y: number, a: number, relief: number): [number, number] {
    const R = TEX_SIZE / 2;
    const r2 = (x * x + y * y) / (R * R);
    const z = r2 < 1 ? relief * R * Math.sqrt(1 - r2) : 0;
    const k = 2.8 * TEX_SIZE;
    const depth = -x * Math.sin(a) + z * (Math.cos(a) - 1);
    const p = k / (k - depth);
    return [(x * Math.cos(a) + z * Math.sin(a)) * p, y * p];
  }

  /** Turns a symbol on itself. Only its light and its volume change: it stays in its cell. */
  private turn(rig: Rig, a: number): void {
    const relief = RELIEF[rig.sym] ?? 0;
    const pos = rig.geo!.positions;
    const step = TEX_SIZE / (TURN_GRID - 1);
    let i = 0;
    for (let v = 0; v < TURN_GRID; v++) {
      for (let u = 0; u < TURN_GRID; u++) {
        const [x, y] = this.turned(u * step - TEX_SIZE / 2, v * step - TEX_SIZE / 2, a, relief);
        pos[i++] = x;
        pos[i++] = y;
      }
    }
    rig.geo!.getBuffer('aPosition').update();
    for (const pin of rig.pins) if (!pin.o.destroyed) pin.o.position.set(...this.turned(pin.x, pin.y, a, relief));
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
      rig.pins.push({ o: glow, x, y }, { o: cross, x, y });
      return { glow, cross };
    });
  }

  /** Win signature for the painted Egyptian symbols (and the royals). */
  private egyptWin(rig: Rig, tl: gsap.core.Timeline, amp: number): void {
    const b = rig.body;
    for (const f of this.eyeFlares(rig)) {
      tl.fromTo(f.glow, { alpha: 0 }, { alpha: 1, duration: 0.18 }, 0.12)
        .fromTo(f.glow.scale, { x: f.glow.scale.x * 0.4, y: f.glow.scale.y * 0.4 }, { x: f.glow.scale.x, y: f.glow.scale.y, duration: 0.35, ease: 'power3.out' }, 0.12)
        .fromTo(f.cross, { alpha: 0, rotation: -0.5 }, { alpha: 1, rotation: 0.25, duration: 0.4, ease: 'power2.out' }, 0.16)
        .to(f.cross, { alpha: 0, duration: 0.35 }, 0.62)
        .to(f.glow, { alpha: 0.55, duration: 0.4 }, 0.6);
    }
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
    rig.won = true;
    const b = rig.body;
    const s = SYMBOL_SIZE / TEX_SIZE;
    const amp = strong ? 1 : 0.65;
    const pos = cellCenter(rig.reel, rig.row);
    const hs = rig.halo.scale.x;
    const up = s * (1 + 0.13 * amp);
    const tl = gsap.timeline({ delay });
    const line = new Sprite(this.cellFrame);
    line.anchor.set(0.5);
    rig.root.addChildAt(line, 1);
    tl.fromTo(line, { alpha: 0 }, { alpha: strong ? 1 : 0.8, duration: 0.22, ease: 'sine.out' }, 0);
    if (rig.geo) {
      const o = { a: 0 };
      const amp = strong ? 0.36 : 0.26;
      rig.tweens.push(
        gsap
          .timeline({ delay: delay + 0.08, repeat: -1, repeatDelay: 0.5, onUpdate: () => this.turn(rig, o.a) })
          .to(o, { a: amp, duration: 0.5, ease: 'sine.inOut' })
          .to(o, { a: -amp, duration: 1, ease: 'sine.inOut' })
          .to(o, { a: 0, duration: 0.5, ease: 'sine.inOut' }),
      );
    }
    tl.fromTo(rig.halo, { alpha: 0 }, { alpha: strong ? 0.36 : 0.26, duration: 0.2, ease: 'sine.out' }, 0)
      .to(rig.halo, { alpha: strong ? 0.18 : 0.12, duration: 0.7, ease: 'sine.out' }, 0.2)
      .fromTo(rig.halo.scale, { x: hs * 0.7, y: hs * 0.7 }, { x: hs, y: hs, duration: 0.45, ease: 'power2.out' }, 0)
      .fromTo(rig.glow, { alpha: 0.08 }, { alpha: 0, duration: 0.6, ease: 'sine.out' }, 0);
    if (!this.still) {
      tl.to(b.scale, { x: up, y: up, duration: 0.38, ease: 'power3.out' }, 0);
      rig.tweens.push(gsap.to(b.scale, { x: up * 0.97, y: up * 0.97, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 0.45 }));
    }
    rig.tweens.push(
      gsap.to(rig.halo, { alpha: strong ? 0.24 : 0.16, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 0.9 }),
      gsap.fromTo(rig.shine, { x: -TEX_SIZE }, { x: TEX_SIZE, duration: 0.75, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.5, delay: delay + 0.1 }),
    );
    if (strong) this.twinkle(rig, delay + 0.2);
    // one-shot particle effects, so a looping win cycle doesn't flood the screen
    const once = (fn: () => void) => rig.tweens.push(gsap.delayedCall(delay + 0.3, fn));
    once(() => this.fx.sand(pos.x, pos.y + CELL_H * 0.2, CELL_W * 0.7, strong ? 5 : 3, 1));
    if (!this.tex.rigs.has(rig.sym) && !this.still) this.egyptWin(rig, tl, amp);
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
    this.fx.sand(c.x, c.y + CELL_H * 0.3, CELL_W * 0.7, 8, 1);
    const rig = this.rig(reel, row);
    const tl = gsap.timeline({ onComplete: () => void (rig.won || this.dropRig(rig)) }).fromTo(rig.glow, { alpha: 0.5 }, { alpha: 0, duration: 0.6, ease: 'sine.out' });
    rig.tweens.push(tl);
  }

  clearWins(): void {
    this.cycleTl?.kill();
    this.cycleTl = null;
    this.dimLayer.clear();
    this.clearRigs();
    this.columns.clear();
    this.hidePlate(true);
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
      for (const [width, color, alpha] of [[14, 0xffc860, 0.22], [3.5, 0xfff0c8, 0.8]] as const) {
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
    const dark = { color: 0x07030a, alpha: 0.62 };
    this.dimLayer.clear();
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (!keep.has(`${r}:${row}`)) this.dimLayer.rect(reelX(r), row * CELL_H, CELL_W, CELL_H).fill(dark);
      }
      this.dimLayer.rect(reelX(r) - REEL_GAP, 0, REEL_GAP, BOARD_H).fill(dark);
    }
    this.dimLayer.rect(BOARD_W, 0, REEL_GAP, BOARD_H).fill(dark);
    gsap.killTweensOf(this.dimLayer);
    gsap.fromTo(this.dimLayer, { alpha: 0 }, { alpha: 1, duration: 0.3, ease: 'sine.out' });
  }

  /** The frame answers a win: every ruby flares, then a pillar of gold rises in the winning reels. */
  private celebrateFrame(reels: number[], strong: boolean): void {
    this.rubyFlares.forEach((f, i) => {
      gsap.killTweensOf(f);
      gsap.fromTo(f, { alpha: 0 }, { alpha: strong ? 0.4 : 0.22, duration: 0.3, delay: i * 0.025, yoyo: true, repeat: 1, repeatDelay: 0.2, ease: 'sine.inOut' });
    });
    if (!strong) return;
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
      gsap.fromTo(p, { alpha: 0.28 }, { alpha: 0, duration: 1.1, delay: r * 0.07 + 0.25, ease: 'sine.in', onComplete: () => !p.destroyed && p.destroy() });
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
        this.hidePlate();
      },
    });
    if (items.length > 1) {
      items.forEach((it, i) => {
        tl.add(() => {
          this.clearHighlights();
          this.dimExcept(it.cells);
          if (it.line !== undefined) this.linkCells(it.cells, 0.09);
          this.showPlate(it.win, it.line !== undefined ? `LIGNE ${it.line + 1}` : 'PYRAMIDES');
          this.highlightCells(it.cells, false, 0.09);
          onLine?.(i);
        });
        tl.to({}, { duration: items.length > 4 ? 0.7 : 1 });
      });
    } else tl.to({}, { duration: 0.9 });
    this.cycleTl = tl;
  }

  /** The total of a win comes up on the plaque. size 0..2. */
  showWinBurst(amount: number, size: number): void {
    this.showPlate(amount, 'GAIN', 0.5, size >= 2 ? 1.14 : 1);
  }

  private winPlate(): WinPlate {
    if (this.plate) return this.plate;
    const root = new Container();
    root.position.set(BOARD_W / 2, BOARD_H + PLATE_Y);
    root.visible = false;
    const plate = makePlate(PLATE_W, PLATE_H);
    const caption = new Text({
      text: '',
      style: { fontFamily: 'Cinzel, serif', fontWeight: '900', fontSize: 17, fill: 0xe8c878, letterSpacing: 3, dropShadow: { color: 0x000000, blur: 3, distance: 2, angle: Math.PI / 2, alpha: 0.9 } },
    });
    caption.anchor.set(0.5);
    caption.y = -29;
    const value = new Digits(54);
    value.y = 9;
    root.addChild(plate, caption, value);
    this.plateLayer.addChild(root);
    this.plate = { root, plate, caption, value, shown: { v: 0 } };
    return this.plate;
  }

  private showPlate(amount: number, caption: string, count = 0, scale = 1): void {
    const p = this.winPlate();
    const write = (v: number) => {
      p.value.value = v;
      p.value.scale.set(Math.min(1, (PLATE_W - 60) / Math.max(1, p.value.inkWidth)));
    };
    gsap.killTweensOf([p.root, p.root.scale, p.shown]);
    p.caption.text = caption;
    p.shown.v = count > 0 ? 0 : amount;
    write(p.shown.v);
    if (count > 0) gsap.to(p.shown, { v: amount, duration: count, ease: 'power2.out', onUpdate: () => write(p.shown.v) });
    if (!p.root.visible) p.root.alpha = 0;
    p.root.visible = true;
    p.root.scale.set(scale);
    gsap.to(p.root, { alpha: 1, duration: 0.2 });
  }

  private hidePlate(now = false): void {
    const p = this.plate;
    if (!p) return;
    gsap.killTweensOf([p.root, p.shown]);
    if (now) p.root.visible = false;
    else gsap.to(p.root, { alpha: 0, duration: 0.3, onComplete: () => void (p.root.visible = false) });
  }

  /** A stream of gold from the middle of the reels to a point of the board, along a curve. */
  flyGold(to: { x: number; y: number }, delay: number, onLand: () => void): void {
    const n = 14;
    const stagger = 0.03;
    const x0 = BOARD_W / 2;
    const y0 = BOARD_H / 2;
    for (let i = 0; i < n; i++) {
      const s = new Sprite(i % 3 ? this.tex.glow : this.tex.star);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = i % 3 ? 0xffb040 : 0xfff0c8;
      s.width = s.height = i % 3 ? 44 : 70;
      s.alpha = 0;
      this.labelLayer.addChild(s);
      const bend = (i % 2 ? 1 : -1) * (120 + Math.random() * 180);
      const cx = (x0 + to.x) / 2 + bend;
      const cy = (y0 + to.y) / 2 + 60;
      const o = { t: 0 };
      gsap.to(o, {
        t: 1,
        delay: delay + i * stagger,
        duration: 0.5,
        ease: 'power2.in',
        onUpdate: () => {
          if (s.destroyed) return;
          const u = 1 - o.t;
          s.position.set(u * u * x0 + 2 * u * o.t * cx + o.t * o.t * to.x, u * u * y0 + 2 * u * o.t * cy + o.t * o.t * to.y);
          s.alpha = Math.min(1, o.t * 6);
        },
        onComplete: () => !s.destroyed && s.destroy(),
      });
    }
    gsap.delayedCall(delay + 0.5 + stagger * n * 0.5, onLand);
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
    gsap.fromTo(beam, { alpha: 0.3 }, { alpha: 0, duration: 0.7, ease: 'power2.out', onComplete: done });
    gsap.fromTo(beam.scale, { x: beam.scale.x * 1.4 }, { x: beam.scale.x * 0.4, duration: 0.7, ease: 'power2.out' });
    gsap.fromTo(core, { alpha: 0.2 }, { alpha: 0, duration: 0.45, ease: 'power3.out' });
  }

  /**
   * The pyramids on the reels call the great one: each lights up in turn and sends a thread of gold
   * to the capstone. Resolves when the last thread lands.
   */
  async callTemple(to: { x: number; y: number }, onThread: (i: number) => void): Promise<void> {
    await this.settleWins();
    this.clearHighlights();
    this.hidePlate();
    const cells: Cell[] = [];
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) if (this.symbolAt(r, row) === Sym.CODEX) cells.push([r, row]);
    await Promise.all(
      cells.map(([r, row], i) =>
        new Promise<void>((resolve) => {
          const from = cellCenter(r, row);
          const g = new Graphics();
          g.blendMode = 'add';
          this.labelLayer.addChild(g);
          const o = { t: 0 };
          const draw = () => {
            if (g.destroyed) return;
            const x = from.x + (to.x - from.x) * o.t;
            const y = from.y + (to.y - from.y) * o.t;
            g.clear();
            for (const [width, color, alpha] of [[10, 0xffc860, 0.22], [2.5, 0xfff0c8, 0.9]] as const) {
              g.moveTo(from.x, from.y).lineTo(x, y).stroke({ width, color, alpha, cap: 'round' });
            }
          };
          const delay = i * 0.17;
          gsap.delayedCall(delay, () => {
            onThread(i);
            this.popCell(r, row, 0xffc860);
          });
          gsap.to(o, {
            t: 1,
            delay,
            duration: 0.34,
            ease: 'power2.in',
            onUpdate: draw,
            onComplete: () => {
              this.fx.sand(from.x, from.y, CELL_W * 0.6, 16, 1);
              gsap.to(g, { alpha: 0, duration: 0.4, onComplete: () => !g.destroyed && g.destroy() });
              resolve();
            },
          });
        }),
      ),
    );
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

  /** A bolt falls from the strain in its bar onto the top of the reel it is taking. */
  private strikeReel(from: { x: number; y: number }, x: number): void {
    const g = new Graphics();
    g.blendMode = 'add';
    this.labelLayer.addChild(g);
    const fork = (a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] => {
      let pts = [a, b];
      let rough = Math.hypot(b.x - a.x, b.y - a.y) * 0.18;
      for (let k = 0; k < 5; k++) {
        const next = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i];
          const q = pts[i + 1];
          next.push({ x: (p.x + q.x) / 2 + (Math.random() - 0.5) * rough, y: (p.y + q.y) / 2 + (Math.random() - 0.5) * rough * 0.4 }, q);
        }
        pts = next;
        rough *= 0.55;
      }
      return pts;
    };
    const draw = () => {
      if (g.destroyed) return;
      const pts = fork(from, { x, y: 2 });
      g.clear();
      for (const [width, color, alpha] of [[12, 0xffa050, 0.2], [2.5, 0xfff4e0, 0.85]] as const) {
        g.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) g.lineTo(p.x, p.y);
        g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
      }
    };
    draw();
    gsap.to(g, { alpha: 0, duration: 0.34, ease: 'power2.in', onComplete: () => !g.destroyed && g.destroy() });
  }

  /** Book-style expansion: infected light rises up the reel, it bursts, then the strain slams in. */
  async expand(exp: Expansion, onReel: (reel: number) => void, source: { x: number; y: number }): Promise<void> {
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
          rig.tweens.push(gsap.to(rig.glow, { alpha: 0.55, duration: 0.2 }));
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
      onReel(r);
      this.strikeReel(source, x + CELL_W / 2);
      await new Promise<void>((resolve) => {
        gsap
          .timeline({ onComplete: resolve })
          .to(vm.scale, { y: 1, duration: 0.4, ease: 'power2.in' })
          .add(() => {
            for (const rig of [...this.rigs.values()].filter((g) => g.reel === r)) this.dropRig(rig);
            this.slamLight(x + CELL_W / 2);
          })
          .to(big, { alpha: 1, duration: 0.16, ease: 'sine.out' })
          .fromTo(light, { alpha: 0.5 }, { alpha: 0.14, duration: 0.7, ease: 'power2.out' }, '<')
          .to(veins, { alpha: 0, duration: 0.3 }, '<')
          .to(sweep, { y: BOARD_H + 240, duration: 0.6, ease: 'power1.inOut' }, '<0.12');
      });
      gsap.to(light, { alpha: 0.2, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    this.clearRigs();
    await wait(250);
    this.showPlate(exp.win, 'LA SOUCHE PAIE', 0.6, 1.14);
    await wait(1400);
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
