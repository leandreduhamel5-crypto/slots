export const REELS = 5;
export const ROWS = 3;

export enum Sym {
  CODEX = 0,
  ZERO = 1,
  MASK = 2,
  SERUM = 3,
  HEART = 4,
  A = 5,
  K = 6,
  Q = 7,
  J = 8,
  TEN = 9,
}

export const SYMBOL_COUNT = 10;

export interface SymbolDef {
  id: Sym;
  key: string;
  name: string;
  /** index = number of matching symbols on a line (0..5), value = multiplier of line bet */
  pays: number[];
}

export const SYMBOLS: SymbolDef[] = [
  { id: Sym.CODEX, key: 'codex', name: 'Codex Infecta', pays: [0, 0, 0, 2, 20, 200] },
  { id: Sym.ZERO, key: 'zero', name: 'Patient Zéro', pays: [0, 0, 10, 100, 1000, 5000] },
  { id: Sym.MASK, key: 'mask', name: 'Masque à gaz', pays: [0, 0, 5, 40, 400, 2000] },
  { id: Sym.SERUM, key: 'serum', name: 'Sérum', pays: [0, 0, 0, 30, 100, 750] },
  { id: Sym.HEART, key: 'heart', name: 'Cœur contaminé', pays: [0, 0, 0, 30, 100, 750] },
  { id: Sym.A, key: 'a', name: 'As', pays: [0, 0, 0, 5, 40, 150] },
  { id: Sym.K, key: 'k', name: 'Roi', pays: [0, 0, 0, 5, 40, 150] },
  { id: Sym.Q, key: 'q', name: 'Dame', pays: [0, 0, 0, 5, 25, 100] },
  { id: Sym.J, key: 'j', name: 'Valet', pays: [0, 0, 0, 5, 25, 100] },
  { id: Sym.TEN, key: 'ten', name: 'Dix', pays: [0, 0, 0, 5, 25, 100] },
];

/** Minimum count for a symbol to pay (also used for the expanding-symbol threshold). */
export function minCount(s: Sym): number {
  return SYMBOLS[s].pays.findIndex((p) => p > 0);
}

/** Row index per reel. Row 0 = top. */
export const LINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 2, 2, 2, 1],
  [1, 0, 0, 0, 1],
  [2, 2, 1, 0, 0],
  [0, 0, 1, 2, 2],
  [2, 1, 1, 1, 0],
];

export const FREE_SPINS_AWARD = 10;
export const SCATTER_TRIGGER = 3;
/** Each retrigger mutates one more expanding symbol, up to this many. */
export const MAX_EXPANDING = 3;
export const MAX_WIN_X = 5000;

export const BET_LEVELS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
export const DEFAULT_BET_INDEX = 3;
export const START_BALANCE = 1000;

/** Symbol counts per reel, in Sym order: CODEX, ZERO, MASK, SERUM, HEART, A, K, Q, J, TEN. Tuned with scripts/simulate.ts. */
export const BASE_COUNTS: number[][] = [
  [1, 2, 3, 3, 3, 5, 5, 6, 6, 6],
  [1, 2, 3, 3, 3, 5, 5, 6, 6, 6],
  [1, 2, 2, 3, 3, 5, 5, 6, 6, 6],
  [1, 2, 2, 3, 3, 5, 5, 6, 6, 6],
  [1, 2, 2, 3, 3, 5, 5, 6, 6, 6],
];

export const FREE_COUNTS: number[][] = [
  [1, 3, 3, 4, 4, 5, 5, 5, 5, 5],
  [1, 3, 3, 4, 4, 5, 5, 5, 5, 5],
  [1, 3, 3, 4, 4, 5, 5, 5, 5, 5],
  [1, 3, 3, 4, 4, 5, 5, 5, 5, 5],
  [1, 3, 3, 4, 4, 5, 5, 5, 5, 5],
];

/**
 * Deterministically lays out a strip: symbols are spread evenly by count, then the few remaining
 * clashes (the same premium twice in a row) are swapped away. Strips are fixed, so outcomes are auditable.
 */
export function buildStrip(counts: number[], offset: number): Sym[] {
  const len = counts.reduce((a, b) => a + b, 0);
  const slots: (Sym | null)[] = new Array(len).fill(null);
  const order = counts.map((c, s) => ({ s: s as Sym, c })).sort((a, b) => a.c - b.c);
  for (const { s, c } of order) {
    for (let i = 0; i < c; i++) {
      const phase = (s * 0.618034 + offset * 0.414214) % 1;
      let p = Math.floor(((i + phase) * len) / c) % len;
      while (slots[p] !== null) p = (p + 1) % len;
      slots[p] = s;
    }
  }
  const strip = slots as Sym[];
  for (let i = 0; i < len; i++) {
    const a = strip[i], b = strip[(i + 1) % len];
    if (a === b && a < Sym.A) {
      for (let j = 2; j < len; j++) {
        const k = (i + j) % len;
        const c = strip[k];
        if (c >= Sym.A && strip[(k + 1) % len] !== a && strip[(k - 1 + len) % len] !== a) {
          strip[k] = a;
          strip[(i + 1) % len] = c;
          break;
        }
      }
    }
  }
  return strip;
}

export const BASE_STRIPS: Sym[][] = BASE_COUNTS.map((c, r) => buildStrip(c, r));
export const FREE_STRIPS: Sym[][] = FREE_COUNTS.map((c, r) => buildStrip(c, r + 11));
