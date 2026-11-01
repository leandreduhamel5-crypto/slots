/**
 * Layout of the backdrop, in the 1920×1080 logical space the game positions its live effects in.
 * The backdrop is a 3D scene ray marched offline (tools/render_temple.py) into egypt/temple_night.webp
 * and egypt/temple_infected.webp at RS×; these are the screen positions of its props, as it prints them.
 */
export const TW = 1920;
export const TH = 1080;
export const RS = 4 / 3;
/** tip of the gold capstone */
export const APEX: [number, number] = [960, 59];
/** half the width of the pyramid at HORIZON */
export const PYRAMID_HALF = 667;
/** a line low in the sky, where heat lightning lands and stars stop */
export const HORIZON = 600;
/** gold braziers: the top of the coals, where the live fire burns */
export const BRAZIERS: [number, number][] = [
  [149, 566],
  [1771, 566],
];
/** the nearest guardians: x of each and y of the top of his head */
export const OBELISKS = [203, 1717];
export const OBELISK_TIP_Y = 248;
export const MOON: [number, number, number] = [610, 165, 78];
/** the pyramid's visible edges, base corner → apex (screen) */
export const PYRAMID_EDGES: [[number, number], [number, number]][] = [
  [[644, 691], APEX],
  [[350, 670], APEX],
  [[1716, 672], APEX],
];
/** the nearest guardians: [foot, head] */
export const OBELISK_SHAFTS: [[number, number], [number, number]][] = [
  [[203, 750], [203, 248]],
  [[1717, 750], [1717, 248]],
];
