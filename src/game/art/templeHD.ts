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
export const MOON: [number, number, number] = [1270, 110, 63];
/** the gate of gold at the end of the avenue */
export const GATE: [number, number] = [960, 605];
