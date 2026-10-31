export const CELL_W = 216;
export const CELL_H = 198;
export const REEL_GAP = 10;
export const BOARD_W = 5 * CELL_W + 4 * REEL_GAP;
export const BOARD_H = 3 * CELL_H;
export const SYMBOL_SIZE = 178;
/** the bonus tile is a framed painting: it takes the whole cell, not the symbol's square */
export const TILE_W = CELL_W - 2;
export const TILE_H = CELL_H - 2;
/** room between the reels and the frame's opening: the cobras and pendants live there, clear of the symbols */
export const FRAME_MARGIN_X = 50;
export const FRAME_MARGIN_Y = 30;

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

export function reelX(reel: number): number {
  return reel * (CELL_W + REEL_GAP);
}

export function cellCenter(reel: number, row: number): { x: number; y: number } {
  return { x: reelX(reel) + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}
