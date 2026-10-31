import { Container, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { ROWS, Sym } from '../math/config';
import { CELL_H, CELL_W, SYMBOL_SIZE } from './layout';
import type { SymbolTextures } from './textures';

type Phase = 'idle' | 'starting' | 'spinning' | 'stopping' | 'landing';

const MAX_SPEED = 3800; // px / s
const BLUR_SPEED = 1400;
/** The last cell of travel: speed bleeds off into a dead stop, like a stone slab seating. */
const SEAT_POWER = 2.6;

/**
 * One reel column. Sprites[0] sits just above the window and sprites[ROWS + 1] just below it.
 * Symbols scroll downward; new ones enter at the top.
 */
export class Reel extends Container {
  readonly cells: Sprite[] = [];
  readonly symbols: Sym[] = [];
  private offset = 0;
  private speed = 0;
  private phase: Phase = 'idle';
  private stopQueue: Sym[] = [];
  private landed: (() => void) | null = null;
  private stripPos: number;
  private seating = false;
  speedScale = 1;

  get idle(): boolean {
    return this.phase === 'idle';
  }
  onLand: (() => void) | null = null;

  constructor(
    private tex: SymbolTextures,
    private strip: Sym[],
    initial: Sym[],
  ) {
    super();
    this.stripPos = Math.floor(Math.random() * strip.length);
    const all = [this.filler(), ...initial, this.filler()];
    for (let i = 0; i < ROWS + 2; i++) {
      const s = new Sprite(tex.normal[all[i]]);
      s.anchor.set(0.5);
      s.width = s.height = SYMBOL_SIZE;
      s.x = CELL_W / 2;
      this.cells.push(s);
      this.symbols.push(all[i]);
      this.addChild(s);
    }
    this.layoutCells();
  }

  setStrip(strip: Sym[]): void {
    this.strip = strip;
  }

  /** Symbol visible at a row (0 = top). */
  cellAt(row: number): Sprite {
    return this.cells[row + 1];
  }

  setSymbol(index: number, s: Sym, blurred = false): void {
    this.symbols[index] = s;
    this.cells[index].texture = blurred ? this.tex.blur[s] : this.tex.normal[s];
    this.cells[index].width = this.cells[index].height = SYMBOL_SIZE;
  }

  private filler(): Sym {
    this.stripPos = (this.stripPos + 1) % this.strip.length;
    return this.strip[this.stripPos];
  }

  start(delay: number): void {
    this.phase = 'starting';
    this.stopQueue = [];
    gsap.killTweensOf(this);
    const tug = { v: 0 };
    gsap
      .timeline({ delay: delay / 1000 })
      .to(tug, {
        v: -16,
        duration: 0.13,
        ease: 'sine.out',
        onUpdate: () => this.applyOffset(tug.v),
      })
      .add(() => {
        this.phase = 'spinning';
        this.speed = 0;
        this.offset = tug.v;
        gsap.to(this, { speed: MAX_SPEED, duration: 0.25, ease: 'power1.in' });
      });
  }

  /** Requests the reel to land on `target` (top to bottom). Resolves once it has settled. */
  stop(target: Sym[]): Promise<void> {
    return new Promise((resolve) => {
      const go = () => {
        this.phase = 'stopping';
        // symbols enter from the top, so bottom row first
        this.stopQueue = [...target].reverse();
        this.stopQueue.push(this.filler());
        this.landed = resolve;
      };
      if (this.phase === 'spinning') go();
      else {
        const wait = () => (this.phase === 'spinning' ? go() : requestAnimationFrame(wait));
        wait();
      }
    });
  }

  update(dtMs: number): void {
    if (this.phase !== 'spinning' && this.phase !== 'stopping') return;
    this.offset += (this.speed * this.speedScale * dtMs) / 1000;
    while (this.offset >= CELL_H) {
      this.offset -= CELL_H;
      this.shift();
      if ((this.phase as Phase) === 'landing') return;
    }
    this.layoutCells();
  }

  private shift(): void {
    const sprite = this.cells.pop()!;
    this.symbols.pop();
    this.cells.unshift(sprite);
    let next: Sym;
    const finishing = this.phase === 'stopping' && this.stopQueue.length > 0;
    if (finishing) next = this.stopQueue.shift()!;
    else next = this.filler();
    this.symbols.unshift(next);
    const blurred = this.speed > BLUR_SPEED && !finishing;
    sprite.texture = blurred ? this.tex.blur[next] : this.tex.normal[next];
    sprite.width = sprite.height = SYMBOL_SIZE;

    if (this.phase === 'stopping') {
      // un-blur everything that will be visible when landing
      if (this.stopQueue.length <= 3) {
        for (let i = 0; i < this.cells.length; i++) this.setSymbol(i, this.symbols[i]);
      }
      // one cell short of the final position: land() carries it the rest of the way
      if (this.stopQueue.length === 1 && !this.seating) {
        this.seating = true;
        this.land();
      } else if (this.stopQueue.length === 0) this.seating = false;
    }
  }

  /** No overshoot and no bounce: the velocity is continuous, then the reel is simply stopped. */
  private land(): void {
    this.phase = 'landing';
    const from = this.offset;
    const dist = CELL_H - from;
    const v0 = Math.max(600, this.speed * this.speedScale);
    this.speed = 0;
    gsap.killTweensOf(this);
    const o = { k: 0 };
    gsap.to(o, {
      k: 1,
      duration: (SEAT_POWER * dist) / v0,
      ease: `power${SEAT_POWER - 1}.out`,
      onUpdate: () => this.applyOffset(from + dist * o.k),
      onComplete: () => {
        this.offset = 0;
        this.phase = 'stopping';
        this.shift();
        this.phase = 'idle';
        this.layoutCells();
        this.onLand?.();
        const cb = this.landed;
        this.landed = null;
        cb?.();
      },
    });
  }

  private applyOffset(v: number): void {
    this.offset = v;
    this.layoutCells();
  }

  private layoutCells(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].y = (i - 1) * CELL_H + CELL_H / 2 + this.offset;
    }
  }
}
