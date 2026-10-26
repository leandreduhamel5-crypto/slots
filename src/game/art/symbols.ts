/** Shared SVG art: the tendril column used for anticipation and expansions (premium symbols are painted in premium.ts). */

export const INK = '#170b14';

/** A cartoon vein: ink casing + coloured core. */
const vein = (d: string, w: number, color = '#ff3347') =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

/** Cartoon tendril column used for anticipation and expansions. */
export const VEINS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 600" width="200" height="600">
  ${vein('M100 0 C86 60 122 110 98 170 C78 222 120 270 100 330 C84 382 114 440 96 500 C88 540 106 570 100 600', 12)}
  ${vein('M98 170 C70 182 50 160 18 178', 7)}
  ${vein('M100 330 C132 342 150 320 184 336', 7)}
  ${vein('M96 500 C70 490 44 506 16 494', 7)}
  ${vein('M104 90 C132 98 150 80 178 92', 6)}
  ${vein('M100 250 C76 256 58 240 28 252', 6)}
  ${vein('M102 420 C130 426 148 410 176 422', 6)}
  ${[['50', '168'], ['150', '330'], ['46', '498'], ['154', '86']].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#ffd23f" stroke="${INK}" stroke-width="4"/>`).join('')}
</svg>`;
