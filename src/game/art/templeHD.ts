/**
 * Layout of the backdrop, in the 1920×1080 logical space the game positions its live effects in.
 * The backdrop itself is a 3D scene rendered offline (art/temple3d.ts, lab.html?only=temple3d)
 * into egypt/temple_night.webp and egypt/temple_infected.webp at RS×; these are the screen
 * positions of its props as projected by that render.
 */
export const TW = 1920;
export const TH = 1080;
export const RS = 4 / 3;
/** tip of the gold capstone */
export const APEX: [number, number] = [960, 57];
/** where the pyramid's silhouette reaches PYRAMID_FOOT_Y, measured from the apex column */
export const PYRAMID_HALF = 1177;
/** a line low in the sky, where heat lightning lands and stars stop */
export const HORIZON = 600;
/** gold braziers: the top of the coals, where the live fire burns */
export const BRAZIERS: [number, number][] = [
  [334, 690],
  [1586, 690],
];
/** obelisks: x of the shaft and y of the gold pyramidion's tip */
export const OBELISKS = [233, 1687];
export const OBELISK_TIP_Y = 61;
export const MOON: [number, number, number] = [500, 273, 100];
