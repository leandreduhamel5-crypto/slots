/**
 * Main character, in two forms sharing one rig (400×600 canvas, same pivots):
 *  - "human": a survivor in a hoodie who is secretly infected (red eye, veins, bandaged hand)
 *  - "inhuman": the revealed monster (charcoal skin, molten cracks, split jaw, long claws)
 * Pivots: neck (200, 262) · near shoulder (292, 300) · feet (200, 584).
 */
import { INK } from './symbols';

const OL = `stroke="${INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"`;
const OL5 = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const OL3 = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600"><defs>${defs}</defs>${body}</svg>`;

/** Filled shape with cel shadow / highlight clipped inside, then inked. */
const cel = (id: string, d: string, base: string, shadow: string, light: string | null, shadowD: string, lightD = '', line = OL) => `
  <clipPath id="${id}"><path d="${d}"/></clipPath>
  <path d="${d}" fill="${base}"/>
  <g clip-path="url(#${id})"><path d="${shadowD}" fill="${shadow}"/>${light ? `<path d="${lightD}" fill="${light}"/>` : ''}</g>
  <path d="${d}" fill="none" ${line}/>`;

/** Molten infection crack: dark rim, orange body, yellow core. */
const crack = (d: string, w = 4) =>
  `<path d="${d}" fill="none" stroke="#5a0a10" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="#ff5a2a" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="#ffd23f" stroke-width="${Math.max(1, w * 0.35)}" stroke-linecap="round" stroke-linejoin="round"/>`;

const veinD = (d: string, w = 3) => `<path d="${d}" fill="none" stroke="#7a1f5a" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* palette */
const HOOD = { base: '#3a4658', shadow: '#283141', light: '#56677e', band: '#2f3a4a' };
const JEANS = { base: '#2e3a5c', shadow: '#202945', light: '#46578a' };
const SKIN = { base: '#efd2bd', shadow: '#d4a68f', light: '#fff0e2' };
const CHAR = { base: '#2e2030', shadow: '#1d141f', light: '#46344a' };

const shadowFeet = `<ellipse cx="200" cy="584" rx="124" ry="13" fill="#000" opacity=".4"/>`;
const TORSO = 'M122 278 C150 252 250 252 280 278 C298 330 296 400 284 452 C240 466 160 466 118 452 C106 400 104 330 122 278 Z';

/* ================================================================ HUMAN */

const humanLegs = `
  ${cel('lgL', 'M158 446 L150 556 L190 556 L196 446 Z', JEANS.base, JEANS.shadow, JEANS.light, 'M178 446 L176 556 L190 556 L196 446 Z', 'M160 452 L166 452 L160 550 L154 550 Z')}
  ${cel('lgR', 'M206 446 L212 556 L252 556 L244 446 Z', JEANS.base, JEANS.shadow, JEANS.light, 'M228 446 L234 556 L252 556 L244 446 Z', 'M210 452 L216 452 L218 550 L212 550 Z')}
  <path d="M164 492 Q172 486 182 492 L180 506 Q172 512 164 506 Z" fill="${SKIN.base}" ${OL3}/>
  ${veinD('M168 496 L174 502 L178 498', 2)}
  <path d="M188 470 L186 540 M220 470 L224 540" stroke="#1a2238" stroke-width="2.5"/>
  ${['M144 552 Q140 578 158 582 L198 582 Q206 570 194 552 Z', 'M206 552 Q198 570 206 582 L246 582 Q264 578 258 552 Z']
    .map((d) => `<path d="${d}" fill="#ecebf2" ${OL5}/>`)
    .join('')}
  <path d="M144 574 L200 574 M206 574 L260 574" stroke="#9aa0b0" stroke-width="6"/>
  <path d="M160 558 l8 0 M162 565 l8 0 M232 558 l8 0 M230 565 l8 0" stroke="#e0213a" stroke-width="3.5" stroke-linecap="round"/>`;

const humanFarArm = cel(
  'fa',
  'M128 286 C106 330 106 382 134 414 L162 404 C148 376 148 336 158 300 Z',
  HOOD.base,
  HOOD.shadow,
  HOOD.light,
  'M146 290 C138 340 140 380 162 404 L150 410 C128 380 126 330 136 292 Z',
  'M118 320 C114 350 118 380 128 400 L122 402 C110 380 108 350 114 322 Z',
);

const humanTorso = `
  <path d="M150 262 C170 236 230 236 250 262 C236 282 164 282 150 262 Z" fill="${HOOD.band}" ${OL5}/>
  ${cel(
    'tr',
    TORSO,
    HOOD.base,
    HOOD.shadow,
    HOOD.light,
    'M232 256 C300 280 306 400 284 460 L200 470 C262 420 270 320 232 256 Z',
    'M126 286 C114 330 112 390 120 440 L112 440 C104 390 106 330 118 286 Z',
  )}
  <path d="M286 300 C296 350 294 410 284 452" fill="none" stroke="#ff3347" stroke-width="3" opacity=".75"/>
  <path d="M150 372 Q200 384 250 372 L246 420 Q200 432 154 420 Z" fill="${HOOD.band}" ${OL5}/>
  <path d="M118 440 C160 454 240 454 284 440 L284 458 C240 472 160 472 118 458 Z" fill="${HOOD.band}" ${OL5}/>
  <path d="M182 270 C180 300 180 330 176 352 M218 270 C220 296 222 322 226 344" fill="none" stroke="#e8e6f0" stroke-width="4.5" stroke-linecap="round"/>
  <rect x="171" y="350" width="10" height="14" rx="3" fill="#9aa0b0" ${OL3}/><rect x="221" y="342" width="10" height="14" rx="3" fill="#9aa0b0" ${OL3}/>
  <circle cx="200" cy="318" r="20" fill="none" stroke="#56677e" stroke-width="4"/>
  ${[-90, 30, 150].map((a) => `<circle cx="${200 + Math.cos((a * Math.PI) / 180) * 8}" cy="${318 + Math.sin((a * Math.PI) / 180) * 8}" r="9" fill="none" stroke="#56677e" stroke-width="3.5"/>`).join('')}
  <path d="M244 300 C254 292 266 300 262 312 C272 316 268 330 256 326 C250 336 236 330 240 318 C230 312 234 300 244 300 Z" fill="#b5122f" ${OL3}/>
  <circle cx="270" cy="296" r="4" fill="#b5122f" ${OL3}/><circle cx="236" cy="336" r="3" fill="#b5122f"/>`;

export const HUMAN_BODY = svg(`${shadowFeet}${humanLegs}${humanFarArm}${humanTorso}`);

export const HUMAN_ARM = svg(`
  ${cel(
    'na',
    'M276 282 C304 300 322 350 326 410 L296 416 C292 368 282 330 262 306 Z',
    HOOD.base,
    HOOD.shadow,
    HOOD.light,
    'M300 300 C318 340 326 380 326 412 L312 414 C312 370 304 330 288 300 Z',
  )}
  <path d="M294 404 L328 400 L330 420 L296 424 Z" fill="${HOOD.band}" ${OL5}/>
  ${cel(
    'hd',
    'M298 420 C292 446 300 466 316 468 C332 470 338 452 334 424 Z',
    SKIN.base,
    SKIN.shadow,
    null,
    'M320 420 C330 440 330 460 316 468 L334 468 L336 420 Z',
  )}
  <path d="M298 434 L334 430 M298 446 L334 442" stroke="#f0e6d0" stroke-width="7"/>
  <path d="M298 434 L334 430 M298 446 L334 442" stroke="${INK}" stroke-width="1.5" opacity=".5"/>
  <circle cx="320" cy="438" r="3" fill="#b5122f"/>
  ${veinD('M306 456 L312 450 L318 458 L324 452', 2.5)}
  <path d="M304 466 l-2 8 M312 469 l0 9 M321 468 l2 8" stroke="#3a1a2a" stroke-width="4" stroke-linecap="round"/>`);

const humanEyeL = 'M150 164 Q168 148 188 164 Q168 176 150 164 Z';
const humanEyeR = 'M212 164 Q232 148 252 164 Q232 176 212 164 Z';
const humanHair = 'M124 152 C112 112 122 74 150 60 L146 40 L168 52 L176 30 L192 48 L206 26 L216 48 L234 32 L238 56 L258 50 C282 72 292 110 280 152 L266 128 C258 100 240 92 200 94 C160 92 142 100 134 128 Z';
const humanFace = 'M134 160 C134 104 166 78 200 78 C234 78 266 104 266 160 C266 212 236 242 200 242 C164 242 134 212 134 160 Z';

export const HUMAN_HEAD = svg(`
  ${cel('nk', 'M178 218 L176 268 L224 268 L222 218 Z', SKIN.shadow, '#c08a76', null, 'M206 218 L210 268 L224 268 L222 218 Z', '', OL5)}
  ${veinD('M186 234 L192 246 L186 258', 3)}${veinD('M212 236 L206 250 L214 262', 2.5)}
  <path d="${humanHair}" fill="#2a1c22" ${OL}/>
  <ellipse cx="134" cy="170" rx="12" ry="18" fill="${SKIN.base}" ${OL5}/>
  <ellipse cx="266" cy="170" rx="12" ry="18" fill="${SKIN.shadow}" ${OL5}/>
  ${cel(
    'fc',
    humanFace,
    SKIN.base,
    SKIN.shadow,
    SKIN.light,
    'M226 80 C270 104 276 200 232 240 L200 246 C250 200 254 120 226 80 Z',
    'M150 150 C150 120 162 104 178 98 C166 112 160 130 160 150 Z',
    OL5,
  )}
  <ellipse cx="160" cy="194" rx="12" ry="6" fill="#ff8a96" opacity=".35"/>
  <path d="M154 176 Q168 184 186 176" fill="none" stroke="#8a5a8a" stroke-width="4" stroke-linecap="round" opacity=".6"/>
  <path d="M214 176 Q232 186 252 174" fill="none" stroke="#7a1f5a" stroke-width="5" stroke-linecap="round" opacity=".8"/>
  ${veinD('M248 172 L258 182 L254 194 M252 180 L264 188', 2.5)}
  <path d="${humanEyeL}" fill="#fff" ${OL3}/>
  <circle cx="170" cy="163" r="7.5" fill="#5a6a7a"/><circle cx="170" cy="163" r="3.5" fill="${INK}"/><circle cx="172" cy="160" r="2" fill="#fff"/>
  <path d="${humanEyeR}" fill="#ffe6e0" ${OL3}/>
  <path d="M214 164 L222 162 M250 164 L242 167" stroke="#e0213a" stroke-width="1.8"/>
  <circle cx="232" cy="163" r="8.5" fill="#ff3347"/><path d="M232 156 Q229 163 232 170 Q235 163 232 156 Z" fill="${INK}"/><circle cx="235" cy="159" r="2" fill="#fff"/>
  <path d="M150 140 L184 132" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M216 128 L252 138" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M198 172 Q192 190 202 194" fill="none" stroke="#b4806e" stroke-width="4" stroke-linecap="round"/>
  <path d="M138 128 C150 92 186 80 214 84 C246 86 266 106 268 134 L256 118 L248 138 L236 112 L224 136 L212 108 L198 132 L186 106 L174 134 L162 112 L150 138 Z" fill="#2a1c22" ${OL5}/>
  <path d="M176 104 L186 96 M216 98 L230 102 M246 112 L254 118" stroke="#4a3440" stroke-width="4" stroke-linecap="round"/>`);

export const HUMAN_JAW = svg(`
  <path d="M174 206 Q200 220 228 202" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  <path d="M206 210 L212 220 L217 207 Z" fill="#fff" ${OL3}/>
  <path d="M172 204 L168 200 M230 200 L234 196" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`);

export const HUMAN_EYES = svg(`
  <circle cx="232" cy="163" r="10" fill="#ff3347"/>
  ${veinD('M248 172 L258 182 L254 194 M252 180 L264 188', 3).replaceAll('#7a1f5a', '#ff3347')}`);

export const HUMAN_LIDS = svg(`
  <path d="M148 164 Q168 144 190 164 Q168 180 148 164 Z" fill="${SKIN.base}" ${OL3}/>
  <path d="M210 164 Q232 144 254 164 Q232 180 210 164 Z" fill="${SKIN.shadow}" ${OL3}/>
  <path d="M150 166 Q168 174 188 166 M212 166 Q232 174 252 166" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`);

/* ================================================================ INHUMAN */

const inhumanCracksBody = [
  'M150 300 L160 330 L152 360 L166 392',
  'M240 290 L232 320 L246 346 L238 380',
  'M196 360 L206 386 L198 412',
  'M110 360 L104 400 L112 440 L100 480',
  'M172 488 L178 512 L172 534',
  'M228 490 L224 514 L232 536',
];

const inhumanBody = svg(`
  ${shadowFeet}
  <path d="M160 222 L170 196 L180 226 Z M218 226 L230 194 L240 222 Z M188 214 L200 184 L212 214 Z" fill="#e8dcc4" ${OL5}/>
  ${cel('ilL', 'M156 446 L146 548 L188 548 L196 446 Z', JEANS.base, JEANS.shadow, null, 'M176 446 L174 548 L188 548 L196 446 Z')}
  ${cel('ilR', 'M206 446 L214 548 L256 548 L244 446 Z', JEANS.base, JEANS.shadow, null, 'M228 446 L236 548 L256 548 L244 446 Z')}
  <path d="M152 480 L162 470 L172 484 L184 472 L190 488 L184 520 L160 524 L150 512 Z" fill="${CHAR.base}" ${OL3}/>
  <path d="M212 498 L222 488 L232 500 L244 490 L250 504 L246 530 L220 532 L212 520 Z" fill="${CHAR.base}" ${OL3}/>
  ${crack(inhumanCracksBody[4], 3)}${crack(inhumanCracksBody[5], 3)}
  <path d="M140 546 Q136 572 156 576 L196 576 Q202 562 190 546 Z" fill="${CHAR.base}" ${OL5}/>
  <path d="M206 546 Q200 562 206 576 L248 576 Q268 572 262 546 Z" fill="${CHAR.base}" ${OL5}/>
  ${['M140 570 L126 590 L148 578', 'M160 576 L154 596 L170 580', 'M180 576 L182 596 L192 578', 'M222 576 L218 596 L232 578', 'M244 576 L250 596 L256 576', 'M262 568 L278 588 L262 580']
    .map((d) => `<path d="${d} Z" fill="#e8dcc4" ${OL3}/>`)
    .join('')}
  ${cel(
    'ifa',
    'M126 284 C100 340 88 420 92 506 L118 508 C118 430 128 360 152 302 Z',
    CHAR.base,
    CHAR.shadow,
    CHAR.light,
    'M140 290 C122 360 116 430 118 508 L108 508 C104 430 112 350 130 290 Z',
    'M108 340 C98 390 96 440 98 490 L94 490 C92 440 94 380 104 340 Z',
  )}
  ${crack(inhumanCracksBody[3], 3.5)}
  <path d="M120 284 L148 296 L140 318 L128 312 L118 328 Z" fill="${HOOD.base}" ${OL5}/>
  <g transform="translate(104 508) rotate(14)">
    <path d="M-22 -4 C-26 16 -16 28 0 28 C16 28 26 16 22 -4 Z" fill="${CHAR.base}" ${OL5}/>
    <path d="M-18 22 L-28 70 L-8 28 Z M-4 28 L-6 80 L8 28 Z M10 26 L20 74 L20 22 Z" fill="#e8dcc4" ${OL3}/>
  </g>
  ${cel(
    'itr',
    TORSO,
    CHAR.base,
    CHAR.shadow,
    CHAR.light,
    'M232 256 C300 280 306 400 284 460 L200 470 C262 420 270 320 232 256 Z',
    'M126 286 C114 330 112 390 120 440 L112 440 C104 390 106 330 118 286 Z',
  )}
  <path d="M140 330 Q170 322 200 332 Q230 322 262 330 M146 356 Q172 348 200 358 Q228 348 256 356 M152 382 Q174 376 200 384 Q226 376 250 382" fill="none" stroke="${CHAR.shadow}" stroke-width="5" stroke-linecap="round"/>
  ${crack(inhumanCracksBody[0])}${crack(inhumanCracksBody[1])}${crack(inhumanCracksBody[2])}
  <path d="M122 278 C150 252 250 252 280 278 L276 300 L262 290 L250 312 L236 288 L222 306 L206 284 L190 304 L176 284 L162 306 L148 286 L132 304 Z" fill="${HOOD.base}" ${OL5}/>
  <path d="M118 420 L132 404 L146 424 L160 410 L178 432 L196 414 L214 434 L232 412 L248 430 L264 410 L284 428 L284 456 C240 470 160 470 118 456 Z" fill="${HOOD.base}" ${OL5}/>
  <path d="M140 450 L150 474 L158 452 M240 452 L248 478 L258 452" fill="${HOOD.base}" ${OL3}/>
`);
export const INHUMAN_BODY = inhumanBody;

export const INHUMAN_ARM = svg(`
  ${cel(
    'ina',
    'M272 282 C312 300 344 380 352 486 L326 494 C318 400 296 336 262 306 Z',
    CHAR.base,
    CHAR.shadow,
    CHAR.light,
    'M300 296 C330 340 348 420 352 488 L338 490 C334 420 318 350 290 300 Z',
    'M284 300 C296 312 306 330 312 350 L306 352 C300 334 290 318 278 306 Z',
  )}
  ${crack('M296 330 L306 360 L300 392 L314 430 L310 460', 3.5)}
  <path d="M268 280 L300 290 L294 316 L280 308 L270 324 Z" fill="${HOOD.base}" ${OL5}/>
  <g transform="translate(340 490) rotate(-10)">
    <path d="M-24 -4 C-28 18 -18 30 0 30 C18 30 28 18 24 -4 Z" fill="${CHAR.base}" ${OL5}/>
    <path d="M-20 24 L-34 78 L-10 30 Z M-6 30 L-10 92 L8 30 Z M10 28 L22 86 L22 24 Z M22 14 L42 54 L26 6 Z" fill="#e8dcc4" ${OL3}/>
  </g>`);

const inhumanSkull = 'M136 150 C128 90 166 58 200 56 C236 58 274 90 266 150 C264 204 246 240 200 254 C154 240 138 204 136 150 Z';
const inhumanEyes = `
  <path d="M146 150 Q168 132 190 156 Q166 168 146 150 Z" fill="#ffd23f"/>
  <path d="M256 150 Q234 132 212 156 Q236 168 256 150 Z" fill="#ffd23f"/>
  <path d="M146 150 Q168 132 190 156 Q166 168 146 150 Z" fill="none" stroke="#ff3347" stroke-width="4.5"/>
  <path d="M256 150 Q234 132 212 156 Q236 168 256 150 Z" fill="none" stroke="#ff3347" stroke-width="4.5"/>
  <path d="M168 142 L168 160 M234 142 L234 160" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
const inhumanCracksHead = ['M196 62 L188 90 L198 108 L190 128', 'M226 70 L236 96 L228 114', 'M150 110 L162 124 L152 138', 'M252 176 L240 192 L250 206', 'M150 176 L160 194 L148 208'];

export const INHUMAN_HEAD = svg(`
  ${cel('ink', 'M176 222 L172 270 L228 270 L224 222 Z', CHAR.base, CHAR.shadow, null, 'M206 222 L212 270 L228 270 L224 222 Z', '', OL5)}
  ${cel(
    'isk',
    inhumanSkull,
    CHAR.base,
    CHAR.shadow,
    CHAR.light,
    'M230 60 C276 92 280 200 230 248 L200 256 C254 200 260 120 230 60 Z',
    'M150 140 C150 108 162 86 182 72 C166 92 160 116 160 140 Z',
    OL5,
  )}
  <path d="M150 64 L156 40 L168 62 M232 62 L246 36 L252 66 M196 58 L200 34 L208 58" fill="#2a1c22" ${OL3}/>
  ${inhumanCracksHead.map((d) => crack(d, 3.5)).join('')}
  <path d="M138 150 Q168 122 198 158 Q166 180 138 150 Z" fill="${INK}"/>
  <path d="M264 150 Q234 122 204 158 Q236 180 264 150 Z" fill="${INK}"/>
  ${inhumanEyes}
  <path d="M136 182 Q200 204 266 182 Q258 252 200 262 Q142 252 136 182 Z" fill="#4a0718" ${OL5}/>
  <path d="M168 238 Q200 222 232 238 Q200 252 168 238 Z" fill="#c4304e"/>
  ${[140, 154, 168, 182, 196, 210, 224, 238, 250]
    .map((x, i) => {
      const y = 186 + Math.abs(i - 4) * -1.4 + Math.abs(i - 4) * 0.8;
      const len = i % 2 ? 16 : 24;
      return `<path d="M${x} ${y} L${x + 7} ${y + len} L${x + 14} ${y} Z" fill="#f2e6cc" ${OL3}/>`;
    })
    .join('')}`);

export const INHUMAN_JAW = svg(`
  <path d="M144 236 Q200 258 258 236 Q252 272 200 282 Q148 272 144 236 Z" fill="${CHAR.base}" ${OL5}/>
  ${crack('M176 262 L186 272 L180 280', 2.5)}
  ${[150, 164, 178, 192, 206, 220, 234]
    .map((x, i) => {
      const len = i % 2 ? 14 : 22;
      return `<path d="M${x} 244 L${x + 7} ${244 - len} L${x + 14} 244 Z" fill="#f2e6cc" ${OL3}/>`;
    })
    .join('')}
  <path d="M230 270 C232 284 230 294 234 304 C238 310 244 306 241 296 C239 288 239 280 238 270 Z" fill="#7be05a" ${OL3}/>`);

export const INHUMAN_EYES = svg(`${inhumanEyes}${inhumanCracksHead.map((d) => crack(d, 3.5)).join('')}${inhumanCracksBody.slice(0, 3).map((d) => crack(d)).join('')}`);

export const INHUMAN_LIDS = svg(`
  <path d="M136 150 Q168 120 200 158 Q166 184 136 150 Z" fill="${CHAR.shadow}" ${OL3}/>
  <path d="M266 150 Q234 120 202 158 Q236 184 266 150 Z" fill="${CHAR.shadow}" ${OL3}/>`);
