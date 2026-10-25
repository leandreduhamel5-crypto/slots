/**
 * Cartoon-horror symbol art (cel shading: flat base + flat shadow + flat highlight + thick ink outline).
 * Every symbol is split into layers so it can be rigged: `base` is drawn on the reels, `parts` are animated
 * on wins (eye, eyelid, jaw…) and `glow` holds only the luminous bits.
 *
 * Palette — ink #170b14 · infection #ff3347 · blood #e0213a / #8e0f26 · antidote #38dcff / #1599c2
 *           bone #f2e6cc · brass #f2b642 / #b07a1e · asylum steel #5b6e66 · hood #34424f
 */

export const INK = '#170b14';
const OL = `stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
const OL5 = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const OL3 = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;

const svg = (body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>${defs}</defs>${body}</svg>`;

/** A cartoon vein: ink casing + coloured core. */
const vein = (d: string, w: number, color = '#ff3347') =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

const groundShadow = (cx = 128, rx = 82) => `<ellipse cx="${cx}" cy="242" rx="${rx}" ry="9" fill="#000" opacity=".35"/>`;

export interface SymbolArt {
  base: string;
  /** animated layers, drawn on top of base in this order */
  parts: Record<string, string>;
  glow: string;
}

/* ------------------------------------------------------------------ CODEX */
const CODEX_ROT = 'rotate(-6 128 128)';
const codexVeins = [
  vein('M120 82 C116 66 124 54 116 38', 5),
  vein('M168 108 C182 100 184 84 188 68', 5),
  vein('M174 146 C188 154 186 172 192 188', 4),
  vein('M120 174 C114 190 122 204 112 218', 5),
  vein('M86 104 C76 96 78 80 70 72', 4),
  vein('M84 152 C74 160 78 176 68 186', 4),
].join('');
const eyeAlmond = 'M84 128 Q128 80 172 128 Q128 176 84 128 Z';

const codexBase = svg(`
  ${groundShadow(132, 84)}
  <g transform="${CODEX_ROT}">
    <path d="M70 40 H196 Q208 40 208 52 V212 Q208 224 196 224 H70 Z" fill="#f2e6cc" ${OL}/>
    <path d="M200 52 V214 M190 46 V220" stroke="#c4ab7c" stroke-width="3"/>
    <rect x="46" y="26" width="150" height="204" rx="16" fill="#9a1838"/>
    <g clip-path="url(#cv)">
      <path d="M196 26 V230 H112 C170 196 176 110 150 26 Z" fill="#6a0d27"/>
      <path d="M58 26 H120 C88 40 76 80 72 130 L46 130 V26 Z" fill="#c43656"/>
      <rect x="46" y="26" width="28" height="204" fill="#5a0b22"/>
      <rect x="46" y="26" width="10" height="204" fill="#7a1230"/>
    </g>
    <rect x="46" y="26" width="150" height="204" rx="16" fill="none" ${OL}/>
    <path d="M74 30 V226" stroke="${INK}" stroke-width="4"/>
    <rect x="86" y="40" width="98" height="176" rx="10" fill="none" stroke="#e8a64e" stroke-width="3" stroke-dasharray="8 7" opacity=".75"/>
    ${[58, 122, 186].map((y) => `<rect x="42" y="${y}" width="36" height="13" rx="5" fill="#f2b642" ${OL3}/><rect x="46" y="${y + 2}" width="28" height="3" rx="1.5" fill="#ffe08a"/>`).join('')}
    <path d="M196 26 V68 L154 26 Z" fill="#f2b642" ${OL5}/>
    <path d="M196 230 V188 L154 230 Z" fill="#f2b642" ${OL5}/>
    <path d="M190 34 V52 L172 34 Z" fill="#ffe08a"/>
    ${codexVeins}
    <path d="M74 128 Q128 64 182 128 Q128 192 74 128 Z" fill="#4a0718" ${OL}/>
    <path d="${eyeAlmond}" fill="#fff4e4"/>
    <path d="M84 128 Q128 80 172 128 Q128 102 84 128 Z" fill="#e6c4b4"/>
    <g stroke="#e0213a" stroke-width="2" fill="none" stroke-linecap="round">
      <path d="M90 128 C98 124 102 130 108 125"/><path d="M166 128 C158 132 154 126 148 131"/>
      <path d="M96 134 C102 138 106 134 110 139"/><path d="M160 122 C154 118 150 123 146 119"/>
    </g>
    <path d="${eyeAlmond}" fill="none" stroke="${INK}" stroke-width="5"/>
  </g>
  <path d="M118 226 C118 236 116 244 120 250 C124 254 130 252 128 244 C126 238 126 232 126 226 Z" fill="#e0213a" ${OL3}/>
`, `<clipPath id="cv"><rect x="46" y="26" width="150" height="204" rx="16"/></clipPath>`);

const codexIris = svg(`
  <g transform="${CODEX_ROT}">
    <circle cx="128" cy="128" r="29" fill="#ff3347" stroke="${INK}" stroke-width="5"/>
    <circle cx="128" cy="128" r="21" fill="none" stroke="#b5122f" stroke-width="7"/>
    <path d="M128 106 Q118 128 128 150 Q138 128 128 106 Z" fill="${INK}"/>
    <circle cx="139" cy="116" r="7" fill="#fff"/><circle cx="117" cy="141" r="3.5" fill="#fff"/>
  </g>`);

const codexLid = svg(`
  <g transform="${CODEX_ROT}">
    <path d="M78 128 Q128 72 178 128 Q128 184 78 128 Z" fill="#9a1838" stroke="${INK}" stroke-width="5"/>
    <path d="M86 112 Q128 84 170 112" fill="none" stroke="#c43656" stroke-width="6" stroke-linecap="round"/>
    <path d="M80 128 Q128 152 176 128" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M90 136 l-6 9 M108 143 l-3 10 M128 146 v10 M148 143 l3 10 M166 136 l6 9" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  </g>`);

const codexGlow = svg(`
  <g transform="${CODEX_ROT}">
    ${codexVeins}
    <circle cx="128" cy="128" r="29" fill="#ff3347"/>
  </g>`);

/* ------------------------------------------------------------------ L'INFECTÉ */
const zeroEyes = `
  <path d="M95 131 Q108 122 120 137 Q106 145 95 131 Z" fill="#ffd23f"/>
  <path d="M161 131 Q148 122 136 137 Q150 145 161 131 Z" fill="#ffd23f"/>
  <path d="M95 131 Q108 122 120 137 Q106 145 95 131 Z" fill="none" stroke="#ff3347" stroke-width="3"/>
  <path d="M161 131 Q148 122 136 137 Q150 145 161 131 Z" fill="none" stroke="#ff3347" stroke-width="3"/>
  <circle cx="108" cy="133" r="3" fill="#fff"/><circle cx="148" cy="133" r="3" fill="#fff"/>`;
const zeroCracks = [
  'M118 104 L114 116 L120 122',
  'M140 106 L146 118 L140 124',
  'M90 156 L98 162 L94 172',
  'M166 156 L158 162 L162 172',
].map((d) => `<path d="${d}" fill="none" stroke="#ff3347" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const upperTeeth = [92, 104, 116, 128, 140, 152]
  .map((x, i) => {
    const y = 163 + Math.abs(i - 2.5) * -1.2;
    return `<path d="M${x} ${y} L${x + 6} ${y + 15} L${x + 12} ${y} Z" fill="#f2e6cc" ${OL3}/>`;
  })
  .join('');

const zeroBase = svg(`
  ${groundShadow()}
  <path d="M24 256 C26 206 52 184 86 174 L170 174 C204 184 230 206 232 256 Z" fill="#2c3844" ${OL}/>
  <path d="M118 176 L128 214 L138 176" fill="none" stroke="#1c252e" stroke-width="5"/>
  <circle cx="104" cy="196" r="5" fill="#9aa6b0" ${OL3}/><circle cx="152" cy="196" r="5" fill="#9aa6b0" ${OL3}/>
  <path d="M104 200 V232 M152 200 V226" stroke="#9aa6b0" stroke-width="4"/>
  <path d="M44 214 C30 140 54 50 128 34 C202 50 226 140 212 214 C180 236 76 236 44 214 Z" fill="#34424f"/>
  <g clip-path="url(#hd)">
    <path d="M150 30 C222 60 232 160 214 222 L142 242 C192 180 192 90 150 30 Z" fill="#222c36"/>
    <path d="M72 66 C56 98 50 140 54 186 L40 186 C36 120 50 78 92 48 Z" fill="#4f6273"/>
  </g>
  <path d="M44 214 C30 140 54 50 128 34 C202 50 226 140 212 214 C180 236 76 236 44 214 Z" fill="none" ${OL}/>
  <path d="M70 210 C58 150 76 84 128 76 C180 84 198 150 186 210 C160 224 96 224 70 210 Z" fill="#0e0710" ${OL5}/>
  <path d="M84 200 C74 150 88 100 128 96 C168 100 182 150 172 200 C150 216 106 216 84 200 Z" fill="#5e5068"/>
  <g clip-path="url(#fc)">
    <path d="M150 96 C190 120 186 180 168 214 L128 220 C170 180 168 130 150 96 Z" fill="#45384f"/>
    <ellipse cx="114" cy="112" rx="20" ry="9" fill="#7d6e88"/>
    <path d="M84 104 C110 116 146 116 172 104 L172 90 L84 90 Z" fill="#0e0710" opacity=".55"/>
  </g>
  <path d="M84 200 C74 150 88 100 128 96 C168 100 182 150 172 200 C150 216 106 216 84 200 Z" fill="none" ${OL5}/>
  ${zeroCracks}
  <path d="M88 129 Q108 112 126 137 Q106 154 88 129 Z" fill="${INK}"/>
  <path d="M168 129 Q148 112 130 137 Q150 154 168 129 Z" fill="${INK}"/>
  ${zeroEyes}
  <path d="M122 146 L128 154 L134 146" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <path d="M84 158 Q128 176 172 158 Q168 210 128 212 Q88 210 84 158 Z" fill="#4a0718" ${OL5}/>
  <path d="M104 198 Q128 184 152 198 Q128 208 104 198 Z" fill="#c4304e"/>
  ${upperTeeth}
`, `<clipPath id="hd"><path d="M44 214 C30 140 54 50 128 34 C202 50 226 140 212 214 C180 236 76 236 44 214 Z"/></clipPath>
    <clipPath id="fc"><path d="M84 200 C74 150 88 100 128 96 C168 100 182 150 172 200 C150 216 106 216 84 200 Z"/></clipPath>`);

const zeroJaw = svg(`
  <path d="M90 194 Q128 212 166 194 Q164 216 128 222 Q92 216 90 194 Z" fill="#5e5068" ${OL5}/>
  <path d="M120 212 Q128 216 136 212" fill="none" stroke="#45384f" stroke-width="4" stroke-linecap="round"/>
  ${[98, 110, 122, 134, 146]
    .map((x, i) => {
      const y = 199 + Math.abs(i - 2) * -1.5;
      return `<path d="M${x} ${y} L${x + 6} ${y - 13} L${x + 12} ${y} Z" fill="#f2e6cc" ${OL3}/>`;
    })
    .join('')}
  <path d="M150 210 C152 222 150 232 153 240 C156 245 162 242 160 235 C158 228 158 220 157 210 Z" fill="#e0213a" ${OL3}/>`);

const zeroGlow = svg(`${zeroEyes}${zeroCracks}`);

/* ------------------------------------------------------------------ MASQUE */
const maskEyes = `
  <ellipse cx="93" cy="110" rx="11" ry="8" fill="#ff3347"/><ellipse cx="163" cy="110" rx="11" ry="8" fill="#ff3347"/>
  <circle cx="96" cy="108" r="3" fill="#fff"/><circle cx="166" cy="108" r="3" fill="#fff"/>`;
const maskShape = 'M128 30 C70 30 50 78 52 120 C54 170 84 206 128 216 C172 206 202 170 204 120 C206 78 186 30 128 30 Z';
const lens = (cx: number) => `
  <circle cx="${cx}" cy="108" r="31" fill="#f2b642" ${OL5}/>
  <path d="M${cx + 22} ${108 + 22} A31 31 0 0 1 ${cx - 28} ${108 + 13}" fill="none" stroke="#b07a1e" stroke-width="7"/>
  <circle cx="${cx}" cy="108" r="22" fill="#1b0c14" ${OL5}/>
  ${[0, 90, 180, 270].map((a) => `<circle cx="${cx + Math.cos((a * Math.PI) / 180) * 27}" cy="${108 + Math.sin((a * Math.PI) / 180) * 27}" r="2.6" fill="#ffe08a"/>`).join('')}`;

const maskBase = svg(`
  ${groundShadow()}
  <path d="M20 100 C36 90 56 90 68 96 L66 128 C52 122 36 124 22 132 Z" fill="#2a2a30" ${OL5}/>
  <path d="M236 100 C220 90 200 90 188 96 L190 128 C204 122 220 124 234 132 Z" fill="#2a2a30" ${OL5}/>
  <path d="${maskShape}" fill="#5b6e66"/>
  <g clip-path="url(#mk)">
    <path d="M150 26 C220 50 220 170 172 214 L128 222 C186 180 196 90 150 26 Z" fill="#3c4b45"/>
    <path d="M66 76 C60 100 60 130 66 150 L50 150 C46 110 52 80 90 46 Z" fill="#86998f"/>
    <path d="M120 40 C140 36 160 40 172 50" fill="none" stroke="#86998f" stroke-width="6" stroke-linecap="round"/>
  </g>
  <path d="${maskShape}" fill="none" ${OL}/>
  <path d="M128 140 V156" stroke="${INK}" stroke-width="4"/>
  <circle cx="128" cy="52" r="5" fill="#9aa6b0" ${OL3}/>
  ${lens(93)}${lens(163)}
  ${maskEyes}
  <path d="M74 96 Q82 86 94 84" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <path d="M144 96 Q152 86 164 84" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <path d="M172 92 L164 106 L172 114 L162 126 M164 106 L150 102" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="58" cy="168" r="15" fill="#9aa6b0" ${OL5}/><circle cx="58" cy="168" r="7" fill="#6d7983"/>
  <rect x="92" y="150" width="72" height="72" rx="16" fill="#9aa6b0"/>
  <g clip-path="url(#cn)">
    <rect x="142" y="150" width="30" height="80" fill="#6d7983"/>
    <rect x="96" y="150" width="10" height="80" fill="#c9d3dc"/>
  </g>
  <rect x="92" y="150" width="72" height="72" rx="16" fill="none" ${OL}/>
  <path d="M96 172 H160 M96 188 H160 M96 204 H160" stroke="${INK}" stroke-width="4"/>
  <g transform="translate(-84 -18)">
    <path d="M150 64 C160 58 170 64 168 74 C176 76 176 86 168 86 C164 92 154 88 156 82 C148 80 146 70 150 64 Z" fill="#e0213a" ${OL3}/>
    <circle cx="176" cy="66" r="3.5" fill="#e0213a" ${OL3}/>
  </g>
`, `<clipPath id="mk"><path d="${maskShape}"/></clipPath><clipPath id="cn"><rect x="92" y="150" width="72" height="72" rx="16"/></clipPath>`);

const maskGlow = svg(maskEyes);

/* ------------------------------------------------------------------ ANTIDOTE */
const ANT_ROT = 'rotate(-36 128 128)';
const antLiquid = `<rect x="103" y="112" width="50" height="86" rx="8" fill="#38dcff"/>`;
const antidoteBase = svg(`
  ${groundShadow(128, 70)}
  <g transform="${ANT_ROT}">
    <rect x="98" y="8" width="60" height="16" rx="7" fill="#c9d3dc" ${OL5}/>
    <rect x="119" y="22" width="18" height="48" fill="#8a96a2" ${OL5}/>
    <rect x="80" y="66" width="96" height="16" rx="8" fill="#c9d3dc" ${OL5}/>
    <rect x="96" y="80" width="64" height="126" rx="14" fill="#dff6ff"/>
    ${antLiquid}
    <g clip-path="url(#lq)">
      <rect x="135" y="100" width="20" height="100" fill="#1599c2"/>
      <rect x="107" y="100" width="8" height="100" fill="#b6f6ff"/>
    </g>
    <rect x="103" y="100" width="50" height="14" rx="4" fill="#2a3540"/>
    <circle cx="124" cy="176" r="4" fill="#fff" opacity=".85"/><circle cx="138" cy="160" r="2.6" fill="#fff" opacity=".85"/><circle cx="118" cy="140" r="2.2" fill="#fff" opacity=".85"/>
    <rect x="96" y="80" width="64" height="126" rx="14" fill="none" ${OL}/>
    <path d="M96 126 H110 M96 146 H106 M96 166 H110 M96 186 H106" stroke="${INK}" stroke-width="3.5"/>
    <rect x="102" y="86" width="7" height="18" rx="3.5" fill="#fff" opacity=".85"/>
    <rect x="96" y="150" width="64" height="20" fill="#fff4e4" ${OL3}/>
    <path d="M128 153 V167 M121 160 H135" stroke="#1599c2" stroke-width="4" stroke-linecap="round"/>
    <path d="M114 204 H142 L136 222 H120 Z" fill="#8a96a2" ${OL5}/>
    <rect x="125" y="220" width="6" height="30" rx="2" fill="#e3e9ee" ${OL3}/>
  </g>
  <path d="M196 214 q-8 11 0 16 q8 -5 0 -16 Z" fill="#38dcff" ${OL3}/>
`, `<clipPath id="lq"><rect x="103" y="112" width="50" height="86" rx="8"/></clipPath>`);

const antidoteGlow = svg(`<g transform="${ANT_ROT}">${antLiquid}</g><path d="M196 214 q-8 11 0 16 q8 -5 0 -16 Z" fill="#38dcff"/>`);

/* ------------------------------------------------------------------ POCHE DE SANG */
const bagShape = 'M66 34 H190 Q210 34 210 56 V172 Q210 214 170 224 H86 Q46 214 46 172 V56 Q46 34 66 34 Z';
const bagBlood = 'M46 92 Q88 76 128 90 Q168 104 210 86 V172 Q210 214 170 224 H86 Q46 214 46 172 Z';
const bloodBase = svg(`
  ${groundShadow()}
  <rect x="106" y="8" width="44" height="28" rx="10" fill="#dfe6ea" ${OL5}/>
  <rect x="117" y="16" width="22" height="10" rx="5" fill="${INK}"/>
  <path d="${bagShape}" fill="#eef3f6"/>
  <g clip-path="url(#bg)">
    <path d="${bagBlood}" fill="#e0213a"/>
    <path d="M168 90 C210 110 214 190 176 230 L128 234 C192 190 196 130 168 90 Z" fill="#8e0f26"/>
    <path d="M62 104 C56 130 58 160 66 186" fill="none" stroke="#ff7d8c" stroke-width="10" stroke-linecap="round"/>
    <path d="M46 92 Q88 76 128 90 Q168 104 210 86" fill="none" stroke="#ff5a6a" stroke-width="5"/>
    <rect x="58" y="40" width="10" height="40" rx="5" fill="#fff"/>
    <path d="M46 46 H210" stroke="#c9d3dc" stroke-width="4"/>
  </g>
  <path d="${bagShape}" fill="none" ${OL}/>
  <circle cx="160" cy="146" r="5" fill="#ff7d8c" opacity=".8"/><circle cx="150" cy="196" r="3.5" fill="#ff7d8c" opacity=".8"/>
  <rect x="84" y="110" width="88" height="72" rx="10" fill="#fff4e4" ${OL5}/>
  <rect x="84" y="110" width="88" height="16" rx="8" fill="#e0213a"/>
  <rect x="84" y="110" width="88" height="72" rx="10" fill="none" ${OL5}/>
  <path d="M128 132 C120 146 114 152 114 160 A14 14 0 0 0 142 160 C142 152 136 146 128 132 Z" fill="#e0213a" ${OL3}/>
  <circle cx="123" cy="158" r="3" fill="#fff"/>
  <path d="M96 172 H112 M146 172 H160" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <rect x="96" y="220" width="18" height="22" rx="5" fill="#dfe6ea" ${OL5}/>
  <rect x="142" y="220" width="18" height="30" rx="5" fill="#e0213a" ${OL5}/>
`, `<clipPath id="bg"><path d="${bagShape}"/></clipPath>`);

const bloodGlow = svg(`<g clip-path="url(#bg)"><path d="${bagBlood}" fill="#e0213a"/></g>`, `<clipPath id="bg"><path d="${bagShape}"/></clipPath>`);

export const SYMBOL_ART: Record<string, SymbolArt> = {
  codex: { base: codexBase, parts: { iris: codexIris, lid: codexLid }, glow: codexGlow },
  zero: { base: zeroBase, parts: { jaw: zeroJaw }, glow: zeroGlow },
  mask: { base: maskBase, parts: {}, glow: maskGlow },
  antidote: { base: antidoteBase, parts: {}, glow: antidoteGlow },
  blood: { base: bloodBase, parts: {}, glow: bloodGlow },
};

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
