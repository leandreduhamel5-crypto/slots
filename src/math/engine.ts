import {
  BASE_STRIPS,
  FREE_SPINS_AWARD,
  FREE_STRIPS,
  LINES,
  MAX_EXPANDING,
  MAX_WIN_X,
  REELS,
  ROWS,
  SCATTER_TRIGGER,
  SYMBOLS,
  Sym,
  minCount,
} from './config';
import type { Rng } from './rng';

export type Grid = Sym[][]; // grid[reel][row]

export interface LineWin {
  line: number;
  symbol: Sym;
  count: number;
  win: number;
  /** [reel, row] cells that form the win */
  cells: [number, number][];
}

export interface ScatterWin {
  count: number;
  win: number;
  cells: [number, number][];
}

export interface Expansion {
  symbol: Sym;
  reels: number[];
  win: number;
  lines: number[];
}

export interface SpinOutcome {
  stops: number[];
  grid: Grid;
  lineWins: LineWin[];
  scatter: ScatterWin | null;
  expansions: Expansion[];
  /** Win of this spin after max-win clipping */
  win: number;
}

export interface FreeSpinOutcome extends SpinOutcome {
  index: number;
  total: number;
  retrigger: { spins: number; mutation: Sym | null } | null;
  specials: Sym[];
  /** Cumulative feature win after this spin */
  featureWin: number;
}

export interface Round {
  bet: number;
  lineBet: number;
  base: SpinOutcome;
  feature: { special: Sym; spins: FreeSpinOutcome[]; win: number } | null;
  totalWin: number;
  capped: boolean;
}

export const PREMIUM_EXPANDERS: Sym[] = [Sym.ZERO, Sym.MASK, Sym.ANTIDOTE, Sym.BLOOD, Sym.A, Sym.K, Sym.Q, Sym.J, Sym.TEN];

export function spinStops(rng: Rng, strips: Sym[][]): { stops: number[]; grid: Grid } {
  const stops: number[] = [];
  const grid: Grid = [];
  for (let r = 0; r < REELS; r++) {
    const strip = strips[r];
    const stop = rng.int(strip.length);
    stops.push(stop);
    const col: Sym[] = [];
    for (let row = 0; row < ROWS; row++) col.push(strip[(stop + row) % strip.length]);
    grid.push(col);
  }
  return { stops, grid };
}

export function evaluateLines(grid: Grid, lineBet: number): LineWin[] {
  const wins: LineWin[] = [];
  LINES.forEach((rows, line) => {
    let base: Sym | null = null;
    let count = 0;
    for (let r = 0; r < REELS; r++) {
      const s = grid[r][rows[r]];
      if (s === Sym.CODEX) {
        count++;
        continue;
      }
      if (base === null) base = s;
      if (s !== base) break;
      count++;
    }
    if (base === null) return; // a full line of codex only pays as scatter
    const mult = SYMBOLS[base].pays[count] ?? 0;
    if (mult > 0) {
      const cells: [number, number][] = [];
      for (let r = 0; r < count; r++) cells.push([r, rows[r]]);
      wins.push({ line, symbol: base, count, win: mult * lineBet, cells });
    }
  });
  return wins;
}

export function evaluateScatter(grid: Grid, bet: number): ScatterWin | null {
  const cells: [number, number][] = [];
  grid.forEach((col, r) => col.forEach((s, row) => s === Sym.CODEX && cells.push([r, row])));
  const mult = SYMBOLS[Sym.CODEX].pays[Math.min(cells.length, 5)] ?? 0;
  if (cells.length < SCATTER_TRIGGER) return null;
  return { count: cells.length, win: mult * bet, cells };
}

/** Book-style expansion: the special symbol fills every reel it lands on and pays on all lines, adjacency not required. */
export function evaluateExpansion(grid: Grid, special: Sym, lineBet: number): Expansion | null {
  const reels: number[] = [];
  grid.forEach((col, r) => col.includes(special) && reels.push(r));
  if (reels.length < minCount(special)) return null;
  const mult = SYMBOLS[special].pays[reels.length];
  return { symbol: special, reels, win: mult * lineBet * LINES.length, lines: LINES.map((_, i) => i) };
}

function sumWins(lineWins: LineWin[], scatter: ScatterWin | null, expansions: Expansion[]): number {
  return (
    lineWins.reduce((a, w) => a + w.win, 0) + (scatter?.win ?? 0) + expansions.reduce((a, e) => a + e.win, 0)
  );
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function playRound(rng: Rng, bet: number): Round {
  const lineBet = bet / LINES.length;
  const cap = bet * MAX_WIN_X;

  const b = spinStops(rng, BASE_STRIPS);
  const lineWins = evaluateLines(b.grid, lineBet);
  const scatter = evaluateScatter(b.grid, bet);
  let total = Math.min(cap, sumWins(lineWins, scatter, []));
  const base: SpinOutcome = { ...b, lineWins, scatter, expansions: [], win: round2(total) };

  let feature: Round['feature'] = null;
  if (scatter) {
    const special = PREMIUM_EXPANDERS[rng.int(PREMIUM_EXPANDERS.length)];
    const specials: Sym[] = [special];
    const spins: FreeSpinOutcome[] = [];
    let remaining = FREE_SPINS_AWARD;
    let totalSpins = FREE_SPINS_AWARD;
    let featureWin = 0;
    while (remaining > 0 && total < cap) {
      remaining--;
      const f = spinStops(rng, FREE_STRIPS);
      const lw = evaluateLines(f.grid, lineBet);
      const sc = evaluateScatter(f.grid, bet);
      const ex: Expansion[] = [];
      for (const s of specials) {
        const e = evaluateExpansion(f.grid, s, lineBet);
        if (e) ex.push(e);
      }
      const raw = sumWins(lw, sc, ex);
      const win = Math.min(raw, cap - total);
      total += win;
      featureWin += win;

      let retrigger: FreeSpinOutcome['retrigger'] = null;
      if (sc) {
        let mutation: Sym | null = null;
        if (specials.length < MAX_EXPANDING) {
          const pool = PREMIUM_EXPANDERS.filter((s) => !specials.includes(s));
          mutation = pool[rng.int(pool.length)];
          specials.push(mutation);
        }
        remaining += FREE_SPINS_AWARD;
        totalSpins += FREE_SPINS_AWARD;
        retrigger = { spins: FREE_SPINS_AWARD, mutation };
      }
      spins.push({
        ...f,
        lineWins: lw,
        scatter: sc,
        expansions: ex,
        win: round2(win),
        index: spins.length + 1,
        total: totalSpins,
        retrigger,
        specials: [...specials],
        featureWin: round2(featureWin),
      });
    }
    feature = { special, spins, win: round2(featureWin) };
  }

  return { bet, lineBet, base, feature, totalWin: round2(total), capped: total >= cap };
}
