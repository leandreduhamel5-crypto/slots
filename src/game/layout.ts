export const CELL_W = 196;
export const CELL_H = 184;
export const REEL_GAP = 10;
export const BOARD_W = 5 * CELL_W + 4 * REEL_GAP;
export const BOARD_H = 3 * CELL_H;
export const SYMBOL_SIZE = 178;

export const COLORS = {
  infection: 0xff2a3d,
  blood: 0x5a0010,
  bone: 0xe9dfc9,
  steel: 0x6f7d8c,
  gold: 0xc39555,
  void: 0x07080b,
};

/** One colour per payline so overlapping wins stay readable. */
export const LINE_COLORS = [
  0xff2a3d, 0xffb347, 0xe9dfc9, 0xc06bff, 0x8fb4ff, 0xff6b9a, 0x6be0c4, 0xffe066, 0xff7a3a, 0xb0f05a,
];

export function reelX(reel: number): number {
  return reel * (CELL_W + REEL_GAP);
}

export function cellCenter(reel: number, row: number): { x: number; y: number } {
  return { x: reelX(reel) + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}
