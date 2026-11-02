/**
 * Layout of the backdrop, in the 1920×1080 logical space the game positions its live effects in.
 * The backdrops are 3D scenes ray marched offline (tools/render_temple.py, tools/render_pyramid.py) at
 * RS×, seen by one same camera; these are the screen positions of their props, as the scripts print them.
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
export const MOON: [number, number, number] = [1232, 120, 30];
/** the gate of gold at the end of the avenue */
export const GATE: [number, number] = [960, 585];
/** the door of the pyramid, in the picture of the sands: left, top, width, height */
export const DOOR: [number, number, number, number] = [903, 535, 114, 193];
/** the moon, over the sands */
export const MOON_OUT: [number, number, number] = [570, 114, 44];
