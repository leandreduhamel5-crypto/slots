/**
 * Hand-authored vector art for the premium symbols. Palette:
 * void #07080b · infection #ff2a3d · blood #5a0010 · bone #e9dfc9 · steel #6f7d8c · rust gold #c39555
 */

const GLOW = (id: string, std: number) => `
  <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="${std}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

const SHADOW = `
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.85"/>
  </filter>`;

const svg = (body: string, defs: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>${defs}${SHADOW}</defs>${body}</svg>`;

export const CODEX_SVG = svg(
  `
  <circle cx="128" cy="128" r="118" fill="url(#aura)"/>
  <g filter="url(#shadow)">
    <path d="M60 36 H200 a10 10 0 0 1 10 10 V214 a10 10 0 0 1 -10 10 H60 Z" fill="url(#pages)"/>
    <path d="M200 44 V216 M204 50 V212" stroke="#9c8d70" stroke-width="1.5" opacity=".7"/>
    <rect x="42" y="26" width="154" height="198" rx="12" fill="url(#leather)" stroke="#0a0204" stroke-width="3"/>
    <rect x="42" y="26" width="26" height="198" rx="10" fill="url(#spine)"/>
    <path d="M68 30 V220" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
    <rect x="76" y="36" width="110" height="178" rx="6" fill="none" stroke="#c39555" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 4"/>
  </g>
  <g fill="url(#gold)" stroke="#3b2410" stroke-width="2">
    <path d="M196 26 h-30 l30 30 z"/>
    <path d="M196 224 h-30 l30 -30 z"/>
    <path d="M68 26 h28 l-28 26 z"/>
    <path d="M68 224 h28 l-28 -26 z"/>
  </g>
  <g fill="#c39555"><circle cx="186" cy="36" r="3"/><circle cx="186" cy="214" r="3"/><circle cx="78" cy="36" r="3"/><circle cx="78" cy="214" r="3"/></g>
  <g stroke="#ff2a3d" stroke-linecap="round" fill="none" filter="url(#vglow)" opacity=".95">
    <path d="M132 125 C150 110 160 92 182 70" stroke-width="3"/>
    <path d="M162 98 C170 98 176 104 186 102" stroke-width="2"/>
    <path d="M128 140 C140 165 150 178 176 206" stroke-width="3"/>
    <path d="M150 172 C158 170 166 176 172 172" stroke-width="2"/>
    <path d="M118 140 C104 160 98 185 84 210" stroke-width="2.5"/>
    <path d="M120 116 C108 96 102 76 88 52" stroke-width="2.5"/>
    <path d="M98 82 C92 80 86 84 80 80" stroke-width="1.6"/>
    <path d="M142 128 C160 132 172 128 188 136" stroke-width="2"/>
  </g>
  <g filter="url(#eglow)">
    <path d="M86 128 Q128 84 170 128 Q128 172 86 128 Z" fill="url(#sclera)" stroke="#2a0207" stroke-width="3"/>
    <circle cx="128" cy="128" r="25" fill="url(#iris)"/>
    <path d="M128 106 C121 118 121 138 128 150 C135 138 135 118 128 106 Z" fill="#090103"/>
    <circle cx="137" cy="118" r="5" fill="#fff" opacity=".85"/>
  </g>
  <path d="M86 128 Q128 92 170 128" fill="none" stroke="#120104" stroke-width="5" stroke-linecap="round"/>
  `,
  `
  <radialGradient id="aura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".55"/><stop offset=".55" stop-color="#8b0a1a" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b1220"/><stop offset=".5" stop-color="#3a0710"/><stop offset="1" stop-color="#170206"/></linearGradient>
  <linearGradient id="spine" x1="0" x2="1"><stop offset="0" stop-color="#1a0307"/><stop offset=".6" stop-color="#3f0912"/><stop offset="1" stop-color="#140205"/></linearGradient>
  <linearGradient id="pages" x1="0" x2="1"><stop offset="0" stop-color="#e9dfc9"/><stop offset="1" stop-color="#a9997a"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0cf8c"/><stop offset=".5" stop-color="#b8894a"/><stop offset="1" stop-color="#5c3c18"/></linearGradient>
  <radialGradient id="sclera" cx=".5" cy=".45"><stop offset="0" stop-color="#f6e7c8"/><stop offset=".7" stop-color="#d9a98f"/><stop offset="1" stop-color="#7d2a2a"/></radialGradient>
  <radialGradient id="iris"><stop offset="0" stop-color="#ffd0a0"/><stop offset=".25" stop-color="#ff5a3a"/><stop offset=".7" stop-color="#d0001c"/><stop offset="1" stop-color="#3a0008"/></radialGradient>
  ${GLOW('vglow', 2.5)}${GLOW('eglow', 5)}
  `,
);

export const ZERO_SVG = svg(
  `
  <circle cx="128" cy="120" r="110" fill="url(#zaura)"/>
  <g filter="url(#shadow)">
    <path d="M128 14 C70 14 36 66 34 128 C32 176 40 214 50 240 H206 C216 214 224 176 222 128 C220 66 186 14 128 14 Z" fill="url(#hood)"/>
    <path d="M128 14 C70 14 36 66 34 128 C32 176 40 214 50 240" fill="none" stroke="#5a6a86" stroke-opacity=".55" stroke-width="3"/>
    <path d="M128 40 C88 40 66 84 68 134 C70 178 92 214 128 222 C164 214 186 178 188 134 C190 84 168 40 128 40 Z" fill="#050608"/>
    <path d="M128 58 C96 58 82 92 84 132 C86 170 102 202 128 208 C154 202 170 170 172 132 C174 92 160 58 128 58 Z" fill="url(#skin)"/>
    <path d="M84 110 C100 96 112 98 128 104 C144 98 156 96 172 110 L172 92 C150 66 106 66 84 92 Z" fill="#050608" opacity=".75"/>
  </g>
  <g stroke="#2a2f3a" stroke-width="1.6" fill="none" opacity=".9">
    <path d="M100 76 l8 14 l-4 10 l9 12"/>
    <path d="M160 82 l-6 12 l6 8"/>
    <path d="M150 182 l8 10 l-2 10"/>
  </g>
  <g stroke="#ff2a3d" stroke-width="1.8" fill="none" filter="url(#zv)" opacity=".85" stroke-linecap="round">
    <path d="M100 170 C94 182 96 194 104 204"/>
    <path d="M156 168 C164 178 162 192 154 204"/>
    <path d="M128 196 V214"/>
    <path d="M96 140 C90 128 92 118 88 110"/>
    <path d="M162 140 C168 126 164 118 170 108"/>
  </g>
  <path d="M94 118 C102 108 116 110 120 122 C114 132 100 132 94 118 Z" fill="#000"/>
  <path d="M162 118 C154 108 140 110 136 122 C142 132 156 132 162 118 Z" fill="#000"/>
  <g filter="url(#zeye)">
    <ellipse cx="107" cy="121" rx="9" ry="5" fill="#ff2a3d"/>
    <ellipse cx="149" cy="121" rx="9" ry="5" fill="#ff2a3d"/>
    <ellipse cx="107" cy="121" rx="3.5" ry="2.2" fill="#ffe2c0"/>
    <ellipse cx="149" cy="121" rx="3.5" ry="2.2" fill="#ffe2c0"/>
  </g>
  <path d="M120 140 L128 150 L136 140" fill="none" stroke="#3a3f4b" stroke-width="2"/>
  <path d="M92 160 C108 154 148 154 164 160 C158 186 98 186 92 160 Z" fill="#120104"/>
  <path d="M92 160 C108 154 148 154 164 160 C158 186 98 186 92 160 Z" fill="url(#maw)"/>
  <g fill="#e9dfc9" stroke="#6b5a45" stroke-width=".8">
    <path d="M96 161 l5 11 l4 -12 z"/><path d="M106 159 l4 12 l4 -13 z"/><path d="M116 158 l4 13 l4 -13 z"/><path d="M126 158 l3 14 l4 -14 z"/>
    <path d="M136 158 l4 13 l4 -13 z"/><path d="M146 159 l4 12 l4 -12 z"/><path d="M155 160 l3 10 l4 -10 z"/>
    <path d="M100 176 l5 -9 l4 10 z"/><path d="M112 179 l4 -10 l4 10 z"/><path d="M124 180 l4 -11 l4 11 z"/><path d="M136 180 l4 -11 l4 10 z"/><path d="M148 177 l4 -9 l4 8 z"/>
  </g>
  <path d="M140 182 C142 192 140 200 142 210 C144 214 148 212 147 206 C146 198 146 190 144 182 Z" fill="#b0001a"/>
  `,
  `
  <radialGradient id="zaura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262b38"/><stop offset=".6" stop-color="#12141b"/><stop offset="1" stop-color="#07080b"/></linearGradient>
  <radialGradient id="skin" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#c2c7cf"/><stop offset=".6" stop-color="#7d8592"/><stop offset="1" stop-color="#2e333d"/></radialGradient>
  <radialGradient id="maw" cx=".5" cy=".3"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".6"/><stop offset="1" stop-color="#2a0005" stop-opacity="0"/></radialGradient>
  ${GLOW('zeye', 4)}${GLOW('zv', 2)}
  `,
);

export const MASK_SVG = svg(
  `
  <circle cx="128" cy="128" r="112" fill="url(#maura)"/>
  <g filter="url(#shadow)">
    <path d="M24 108 C40 98 58 96 70 104 L66 128 C52 124 38 126 26 134 Z" fill="#1b1e24"/>
    <path d="M232 108 C216 98 198 96 186 104 L190 128 C204 124 218 126 230 134 Z" fill="#1b1e24"/>
    <path d="M128 24 C78 24 54 60 52 106 C50 150 66 186 92 206 L164 206 C190 186 206 150 204 106 C202 60 178 24 128 24 Z" fill="url(#rubber)" stroke="#0b0c0f" stroke-width="3"/>
    <path d="M70 52 C92 34 164 34 186 52" fill="none" stroke="#69758a" stroke-opacity=".5" stroke-width="3"/>
    <path d="M94 168 H162 L156 236 C156 244 100 244 100 236 Z" fill="url(#can)" stroke="#0b0c0f" stroke-width="3"/>
    <g stroke="#1a1d22" stroke-width="3"><path d="M98 186 H158"/><path d="M99 200 H157"/><path d="M100 214 H156"/><path d="M101 228 H155"/></g>
    <ellipse cx="128" cy="168" rx="34" ry="10" fill="#2b3038" stroke="#0b0c0f" stroke-width="2"/>
    <circle cx="128" cy="168" r="6" fill="#0b0c0f"/>
  </g>
  <g>
    <circle cx="92" cy="106" r="31" fill="url(#brass)" stroke="#2b1a08" stroke-width="2"/>
    <circle cx="164" cy="106" r="31" fill="url(#brass)" stroke="#2b1a08" stroke-width="2"/>
    <circle cx="92" cy="106" r="23" fill="url(#lens)"/>
    <circle cx="164" cy="106" r="23" fill="url(#lens)"/>
    <g filter="url(#mglow)">
      <ellipse cx="94" cy="108" rx="9" ry="6" fill="#ff2a3d"/>
      <ellipse cx="162" cy="108" rx="9" ry="6" fill="#ff2a3d"/>
      <circle cx="94" cy="108" r="2.5" fill="#ffe2c0"/>
      <circle cx="162" cy="108" r="2.5" fill="#ffe2c0"/>
    </g>
    <path d="M78 92 C84 86 92 84 100 86" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 92 C156 86 164 84 172 86" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g stroke="#f1e9dc" stroke-width="1.4" fill="none" opacity=".85">
      <path d="M170 90 L162 104 L170 112 L158 126"/>
      <path d="M162 104 L148 100"/>
      <path d="M170 112 L182 116"/>
    </g>
    <g fill="#c39555">
      <circle cx="92" cy="77" r="2.5"/><circle cx="92" cy="135" r="2.5"/><circle cx="63" cy="106" r="2.5"/><circle cx="121" cy="106" r="2.5"/>
      <circle cx="164" cy="77" r="2.5"/><circle cx="164" cy="135" r="2.5"/><circle cx="135" cy="106" r="2.5"/><circle cx="193" cy="106" r="2.5"/>
    </g>
  </g>
  <path d="M108 236 C110 244 108 250 110 254" stroke="#b0001a" stroke-width="4" stroke-linecap="round" fill="none"/>
  `,
  `
  <radialGradient id="maura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="rubber" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5260"/><stop offset=".45" stop-color="#2a2f38"/><stop offset="1" stop-color="#0f1115"/></linearGradient>
  <linearGradient id="can" x1="0" x2="1"><stop offset="0" stop-color="#3a414c"/><stop offset=".35" stop-color="#8a95a5"/><stop offset=".6" stop-color="#4b5360"/><stop offset="1" stop-color="#1c2027"/></linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0cf8c"/><stop offset=".5" stop-color="#9c6f36"/><stop offset="1" stop-color="#3b2410"/></linearGradient>
  <radialGradient id="lens" cx=".5" cy=".55"><stop offset="0" stop-color="#5a0010"/><stop offset=".7" stop-color="#1a0205"/><stop offset="1" stop-color="#050102"/></radialGradient>
  ${GLOW('mglow', 5)}
  `,
);

export const SERUM_SVG = svg(
  `
  <circle cx="128" cy="140" r="110" fill="url(#saura)"/>
  <g filter="url(#shadow)">
    <rect x="104" y="18" width="48" height="26" rx="4" fill="url(#cap)" stroke="#0b0c0f" stroke-width="2"/>
    <g stroke="#1a1d22" stroke-width="2"><path d="M112 20 V42"/><path d="M122 20 V42"/><path d="M134 20 V42"/><path d="M144 20 V42"/></g>
    <path d="M110 44 H146 V92 C186 104 208 136 208 170 C208 212 172 240 128 240 C84 240 48 212 48 170 C48 136 70 104 110 92 Z" fill="url(#glass)" stroke="#c9d3df" stroke-opacity=".6" stroke-width="3"/>
  </g>
  <path d="M60 156 C80 146 100 160 128 152 C156 144 176 160 196 152 C200 196 172 230 128 230 C84 230 56 200 60 156 Z" fill="url(#liquid)" filter="url(#sglow)"/>
  <path d="M60 156 C80 146 100 160 128 152 C156 144 176 160 196 152" fill="none" stroke="#ff8a8a" stroke-width="2" opacity=".8"/>
  <g fill="#ffb3b3" opacity=".75">
    <circle cx="96" cy="196" r="5"/><circle cx="112" cy="178" r="3"/><circle cx="150" cy="204" r="6"/><circle cx="164" cy="180" r="3"/><circle cx="130" cy="214" r="2.5"/><circle cx="84" cy="172" r="2.5"/>
  </g>
  <path d="M70 130 C64 150 66 180 78 204" stroke="#fff" stroke-opacity=".45" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M116 50 V90" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
  <g transform="translate(128 120)">
    <rect x="-38" y="-20" width="76" height="40" rx="4" fill="url(#label)" stroke="#5c4b33" stroke-width="1.5"/>
    <g fill="none" stroke="#9a0014" stroke-width="3.2">
      <circle cx="0" cy="-6" r="8"/><circle cx="-7" cy="6" r="8"/><circle cx="7" cy="6" r="8"/>
    </g>
    <circle cx="0" cy="2" r="3.5" fill="#9a0014"/>
    <path d="M-34 -14 H-20 M-34 -8 H-24 M20 14 H34 M24 8 H34" stroke="#5c4b33" stroke-width="1.6"/>
  </g>
  `,
  `
  <radialGradient id="saura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="cap" x1="0" x2="1"><stop offset="0" stop-color="#3a414c"/><stop offset=".4" stop-color="#9aa5b5"/><stop offset="1" stop-color="#20242b"/></linearGradient>
  <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#9fb0c4" stop-opacity=".35"/><stop offset=".5" stop-color="#2a3442" stop-opacity=".25"/><stop offset="1" stop-color="#9fb0c4" stop-opacity=".3"/></linearGradient>
  <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3b4e"/><stop offset=".6" stop-color="#c0001c"/><stop offset="1" stop-color="#5a0010"/></linearGradient>
  <linearGradient id="label" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe5cf"/><stop offset="1" stop-color="#bfae8c"/></linearGradient>
  ${GLOW('sglow', 4)}
  `,
);

export const HEART_SVG = svg(
  `
  <circle cx="128" cy="134" r="112" fill="url(#haura)"/>
  <g filter="url(#shadow)">
    <path d="M100 66 C98 44 102 26 112 16 L130 18 C124 32 122 48 124 64 Z" fill="url(#vessel)" stroke="#2a0207" stroke-width="2"/>
    <path d="M132 64 C134 44 146 30 166 24 C178 22 188 30 186 40 C172 40 156 48 150 70 Z" fill="url(#vessel)" stroke="#2a0207" stroke-width="2"/>
    <path d="M150 70 C160 60 176 58 190 64 L186 76 C176 72 166 74 158 82 Z" fill="#6b1a5a" stroke="#2a0207" stroke-width="2"/>
    <path d="M86 78 C70 72 58 76 50 86 L58 96 C66 88 76 86 88 90 Z" fill="#6b1a5a" stroke="#2a0207" stroke-width="2"/>
    <path d="M90 70 C60 74 40 104 44 140 C48 182 86 214 126 236 C130 238 134 238 138 234 C176 206 210 170 212 128 C214 92 190 64 156 66 C140 66 128 74 122 82 C114 72 102 68 90 70 Z" fill="url(#muscle)" stroke="#1a0105" stroke-width="3"/>
  </g>
  <path d="M74 98 C66 116 66 140 76 162" stroke="#ff9a9a" stroke-opacity=".45" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M122 84 C118 120 126 170 134 230" stroke="#2a0207" stroke-width="3" fill="none" opacity=".7"/>
  <g stroke="#ff2a3d" stroke-width="2" fill="none" filter="url(#hv)" stroke-linecap="round">
    <path d="M122 96 C140 104 150 120 176 118"/>
    <path d="M150 112 C156 126 168 132 186 140"/>
    <path d="M120 130 C100 136 88 150 70 150"/>
    <path d="M128 160 C142 172 150 186 156 204"/>
    <path d="M96 142 C94 158 100 170 110 182"/>
  </g>
  <g filter="url(#hp)">
    <circle cx="170" cy="150" r="9" fill="url(#pus)"/>
    <circle cx="96" cy="112" r="7" fill="url(#pus)"/>
    <circle cx="140" cy="196" r="6" fill="url(#pus)"/>
    <circle cx="186" cy="110" r="5" fill="url(#pus)"/>
    <circle cx="84" cy="168" r="4.5" fill="url(#pus)"/>
  </g>
  <g fill="#1a0105">
    <path d="M196 96 l18 -10 l-12 16 z"/><path d="M206 132 l20 2 l-18 8 z"/><path d="M48 120 l-18 -6 l16 14 z"/><path d="M60 170 l-14 10 l18 -4 z"/>
  </g>
  <path d="M130 234 C130 242 128 248 130 254 C132 256 136 254 134 248 C134 242 134 238 134 232 Z" fill="#b0001a"/>
  `,
  `
  <radialGradient id="haura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="muscle" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#d23048"/><stop offset=".5" stop-color="#8b0a1a"/><stop offset="1" stop-color="#2a0207"/></radialGradient>
  <linearGradient id="vessel" x1="0" x2="1"><stop offset="0" stop-color="#5a0010"/><stop offset=".5" stop-color="#b03048"/><stop offset="1" stop-color="#3a0008"/></linearGradient>
  <radialGradient id="pus" cx=".4" cy=".35"><stop offset="0" stop-color="#fff0d0"/><stop offset=".35" stop-color="#ff5a3a"/><stop offset="1" stop-color="#8b0010"/></radialGradient>
  ${GLOW('hv', 2)}${GLOW('hp', 3)}
  `,
);

/** Organic vein network used as an overlay for expansions, frames and the background. */
export const VEINS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 600" width="200" height="600">
<defs>${GLOW('g', 3)}</defs>
<g stroke="#ff2a3d" fill="none" stroke-linecap="round" filter="url(#g)">
  <path d="M100 0 C90 60 120 110 98 170 C80 220 118 270 100 330 C86 380 112 440 96 500 C90 540 104 570 100 600" stroke-width="5"/>
  <path d="M98 170 C70 180 50 160 20 176" stroke-width="3"/>
  <path d="M100 330 C130 340 150 320 182 334" stroke-width="3"/>
  <path d="M96 500 C70 490 46 506 18 494" stroke-width="3"/>
  <path d="M104 90 C130 96 150 80 176 90" stroke-width="2.5"/>
  <path d="M100 250 C76 254 60 240 30 250" stroke-width="2.5"/>
  <path d="M102 420 C128 424 146 410 174 420" stroke-width="2.5"/>
  <path d="M50 160 C40 140 44 120 30 104" stroke-width="1.6"/>
  <path d="M150 320 C160 300 152 284 166 266" stroke-width="1.6"/>
  <path d="M46 506 C40 530 50 548 40 570" stroke-width="1.6"/>
  <path d="M150 80 C154 60 146 44 158 26" stroke-width="1.6"/>
</g></svg>`;

export const PREMIUM_SVGS: Record<string, string> = {
  codex: CODEX_SVG,
  zero: ZERO_SVG,
  mask: MASK_SVG,
  serum: SERUM_SVG,
  heart: HEART_SVG,
};
