/**
 * "L'Infecté" mascot, cartoon cel-shaded, split into rig parts that share one 400×600 canvas.
 * Pivots (in that canvas): neck (200, 262), near shoulder (292, 300).
 */
import { INK } from './symbols';

const OL = `stroke="${INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"`;
const OL5 = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const OL3 = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600"><defs>${defs}</defs>${body}</svg>`;

const claw = (x: number, y: number, rot: number) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M-22 0 C-24 18 -16 30 0 30 C16 30 24 18 22 0 Z" fill="#5e5068" ${OL5}/>
    <path d="M-16 26 L-22 58 L-8 30 Z M-2 30 L-2 66 L8 30 Z M12 26 L22 56 L18 24 Z" fill="#f2e6cc" ${OL3}/>
  </g>`;

export const MASCOT_BODY = svg(`
  <ellipse cx="200" cy="584" rx="130" ry="14" fill="#000" opacity=".4"/>
  <path d="M150 470 L140 560 Q140 574 156 574 L186 574 Q194 560 186 548 L184 470 Z" fill="#232c36" ${OL}/>
  <path d="M216 470 L214 548 Q206 560 214 574 L244 574 Q260 574 258 560 L250 470 Z" fill="#232c36" ${OL}/>
  <path d="M140 566 L128 588 M156 572 L150 592 M246 572 L254 592 M258 566 L272 586" stroke="#f2e6cc" stroke-width="7" stroke-linecap="round"/>
  <path d="M112 300 C88 360 74 430 82 520 L100 524 C100 450 112 380 132 330 Z" fill="#2c3844" ${OL}/>
  ${claw(92, 520, 10)}
  <path d="M120 270 C150 246 250 246 282 270 C306 330 300 420 278 486 C240 500 160 500 122 486 C100 420 96 330 120 270 Z" fill="#34424f"/>
  <g clip-path="url(#torso)">
    <path d="M230 250 C300 270 310 420 278 500 L200 504 C260 440 262 320 230 250 Z" fill="#222c36"/>
    <path d="M128 280 C114 330 112 400 122 460 L108 460 C100 400 104 320 120 270 Z" fill="#4f6273"/>
    <path d="M150 400 Q200 420 250 400 L246 456 Q200 470 154 456 Z" fill="#2a3540" ${OL5}/>
    <path d="M176 270 L170 360 M224 270 L230 352" stroke="#c9d3dc" stroke-width="5" stroke-linecap="round"/>
    <circle cx="170" cy="364" r="7" fill="#c9d3dc" ${OL3}/><circle cx="230" cy="356" r="7" fill="#c9d3dc" ${OL3}/>
    <path d="M196 300 C210 330 200 360 214 390" stroke="#ff3347" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M150 486 L162 470 L174 490 L190 472 L204 492 L220 474 L236 490 L250 472 L262 488" fill="none" stroke="#1a222b" stroke-width="6"/>
  </g>
  <path d="M120 270 C150 246 250 246 282 270 C306 330 300 420 278 486 C240 500 160 500 122 486 C100 420 96 330 120 270 Z" fill="none" ${OL}/>
  <path d="M214 330 C224 324 236 330 232 342 C240 346 236 358 226 354 C220 362 208 356 212 346 C204 340 206 330 214 330 Z" fill="#e0213a" ${OL3}/>
`, `<clipPath id="torso"><path d="M120 270 C150 246 250 246 282 270 C306 330 300 420 278 486 C240 500 160 500 122 486 C100 420 96 330 120 270 Z"/></clipPath>`);

export const MASCOT_ARM = svg(`
  <path d="M280 282 C320 300 350 360 358 430 L338 438 C326 380 304 336 270 316 Z" fill="#34424f" ${OL}/>
  <path d="M300 300 C326 320 342 360 348 410" stroke="#222c36" stroke-width="8" fill="none" stroke-linecap="round"/>
  ${claw(350, 432, -12)}
`);

const faceShape = 'M150 236 C136 186 152 134 200 128 C248 134 264 186 250 236 C230 254 170 254 150 236 Z';
export const MASCOT_HEAD = svg(`
  <path d="M92 250 C76 160 110 64 200 44 C290 64 324 160 308 250 C270 278 130 278 92 250 Z" fill="#34424f"/>
  <g clip-path="url(#hood)">
    <path d="M226 40 C320 72 330 190 310 258 L230 276 C290 210 290 110 226 40 Z" fill="#222c36"/>
    <path d="M130 80 C108 120 98 170 104 230 L88 230 C82 160 98 108 150 64 Z" fill="#4f6273"/>
  </g>
  <path d="M92 250 C76 160 110 64 200 44 C290 64 324 160 308 250 C270 278 130 278 92 250 Z" fill="none" ${OL}/>
  <path d="M128 250 C112 180 136 112 200 104 C264 112 288 180 272 250 C240 268 160 268 128 250 Z" fill="#0e0710" ${OL5}/>
  <path d="${faceShape}" fill="#5e5068"/>
  <g clip-path="url(#face)">
    <path d="M222 128 C266 150 262 220 244 252 L200 256 C246 210 246 160 222 128 Z" fill="#45384f"/>
    <ellipse cx="186" cy="146" rx="22" ry="9" fill="#7d6e88"/>
    <path d="M150 140 C180 152 220 152 250 140 L250 120 L150 120 Z" fill="#0e0710" opacity=".6"/>
  </g>
  <path d="${faceShape}" fill="none" ${OL5}/>
  <path d="M188 138 L184 150 L190 156 M214 140 L220 152 L214 158" fill="none" stroke="#ff3347" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M158 170 Q178 156 196 176 Q176 190 158 170 Z" fill="${INK}"/>
  <path d="M242 170 Q222 156 204 176 Q224 190 242 170 Z" fill="${INK}"/>
  <path d="M164 172 Q178 164 190 178 Q176 184 164 172 Z" fill="#ffd23f"/>
  <path d="M236 172 Q222 164 210 178 Q224 184 236 172 Z" fill="#ffd23f"/>
  <circle cx="178" cy="174" r="3" fill="#fff"/><circle cx="222" cy="174" r="3" fill="#fff"/>
  <path d="M156 200 Q200 214 244 200 Q240 240 200 244 Q160 240 156 200 Z" fill="#4a0718" ${OL5}/>
  <path d="M176 234 Q200 222 224 234 Q200 242 176 234 Z" fill="#c4304e"/>
  ${[162, 174, 186, 198, 210, 222].map((x) => `<path d="M${x} 204 L${x + 6} 218 L${x + 12} 204 Z" fill="#f2e6cc" ${OL3}/>`).join('')}
`, `<clipPath id="hood"><path d="M92 250 C76 160 110 64 200 44 C290 64 324 160 308 250 C270 278 130 278 92 250 Z"/></clipPath>
    <clipPath id="face"><path d="${faceShape}"/></clipPath>`);

export const MASCOT_JAW = svg(`
  <path d="M160 232 Q200 250 240 232 Q236 256 200 262 Q164 256 160 232 Z" fill="#5e5068" ${OL5}/>
  ${[168, 180, 192, 204, 216].map((x) => `<path d="M${x} 238 L${x + 6} 226 L${x + 12} 238 Z" fill="#f2e6cc" ${OL3}/>`).join('')}
  <path d="M222 252 C224 264 222 272 226 280 C230 284 236 280 233 272 C231 266 231 260 230 252 Z" fill="#e0213a" ${OL3}/>
`);

export const MASCOT_EYES = svg(`
  <path d="M164 172 Q178 164 190 178 Q176 184 164 172 Z" fill="#ffd23f"/>
  <path d="M236 172 Q222 164 210 178 Q224 184 236 172 Z" fill="#ffd23f"/>
  <path d="M164 172 Q178 164 190 178 Q176 184 164 172 Z" fill="none" stroke="#ff3347" stroke-width="4"/>
  <path d="M236 172 Q222 164 210 178 Q224 184 236 172 Z" fill="none" stroke="#ff3347" stroke-width="4"/>
`);

/** Eyelids for blinking (hood-shadow coloured). */
export const MASCOT_LIDS = svg(`
  <path d="M156 170 Q178 152 198 176 Q178 194 156 170 Z" fill="#45384f" ${OL3}/>
  <path d="M244 170 Q222 152 202 176 Q222 194 244 170 Z" fill="#45384f" ${OL3}/>
`);
