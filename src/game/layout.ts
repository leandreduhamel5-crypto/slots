export const CELL_W = 196;
export const CELL_H = 184;
export const REEL_GAP = 10;
export const BOARD_W = 5 * CELL_W + 4 * REEL_GAP;
export const BOARD_H = 3 * CELL_H;
export const SYMBOL_SIZE = 178;

export const COLORS = {
  ink: 0x170b14,
  yellow: 0xffd23f,
  cyan: 0x38dcff,
  infection: 0xff3347,
  blood: 0x5a0010,
  bone: 0xe9dfc9,
  steel: 0x6f7d8c,
  gold: 0xc39555,
  void: 0x07080b,
};

/** One colour per payline so overlapping wins stay readable. */
export const LINE_COLORS = [
  0xffd23f, 0xff3347, 0x2ad0c8, 0x3a6cff, 0xff8a1a, 0xf6e6c0, 0xd81b60, 0x9ae05a, 0xc78bff, 0xffa8a0,
];

export function reelX(reel: number): number {
  return reel * (CELL_W + REEL_GAP);
}

export function cellCenter(reel: number, row: number): { x: number; y: number } {
  return { x: reelX(reel) + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}
