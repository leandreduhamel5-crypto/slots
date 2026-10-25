/**
 * Hand-authored vector art for the premium symbols. Palette:
 * void #07080b · infection #ff2a3d · blood #5a0010 · bone #e9dfc9 · steel #6f7d8c · rust gold #c39555
 */

const GLOW = (id: string, std: number) => `
  <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="${std}" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

/** Grain that multiplies into whatever it is applied to: leather, skin, rubber, rust. */
const GRIT = (id: string, freq: number, strength: number, seed: number) => `
  <filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -${strength} ${strength * 0.7}" result="dark"/>
    <feComposite in="dark" in2="SourceGraphic" operator="in" result="grain"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge>
  </filter>`;

const SHADOW = `
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000" flood-opacity="0.9"/>
  </filter>`;

const svg = (body: string, defs: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>${defs}${SHADOW}</defs>${body}</svg>`;

const runes = (cx: number, cy: number, r: number, n: number) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
    const len = i % 3 === 0 ? 9 : 5;
    const x2 = cx + Math.cos(a) * (r - len), y2 = cy + Math.sin(a) * (r - len);
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    if (i % 3 === 1) {
      const b = a + 0.12;
      d += `M${(cx + Math.cos(b) * (r - 3)).toFixed(1)} ${(cy + Math.sin(b) * (r - 3)).toFixed(1)}l2 2`;
    }
  }
  return d;
};

export const CODEX_SVG = svg(
  `
  <circle cx="128" cy="128" r="122" fill="url(#aura)"/>
  <g filter="url(#shadow)">
    <path d="M58 40 H204 a10 10 0 0 1 10 10 V214 a10 10 0 0 1 -10 10 H58 Z" fill="url(#pages)"/>
    <g stroke="#7d6e52" stroke-width="1" opacity=".55">
      <path d="M200 46 V218"/><path d="M204 48 V216"/><path d="M208 52 V212"/>
      <path d="M62 218 H198"/><path d="M62 221 H200"/>
    </g>
    <rect x="38" y="24" width="160" height="202" rx="12" fill="url(#leather)" filter="url(#gritL)"/>
    <rect x="38" y="24" width="160" height="202" rx="12" fill="none" stroke="#0a0204" stroke-width="3"/>
    <rect x="38" y="24" width="28" height="202" rx="10" fill="url(#spine)"/>
    <g stroke="#0d0204" stroke-width="3"><path d="M40 62 H64"/><path d="M40 125 H64"/><path d="M40 188 H64"/></g>
    <g stroke="#7a2030" stroke-width="1.2" opacity=".7"><path d="M40 59 H64"/><path d="M40 122 H64"/><path d="M40 185 H64"/></g>
    <path d="M66 28 V222" stroke="#000" stroke-opacity=".6" stroke-width="2.5"/>
    <rect x="76" y="34" width="112" height="182" rx="7" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3"/>
    <rect x="75" y="33" width="112" height="182" rx="7" fill="none" stroke="#c39555" stroke-opacity=".45" stroke-width="1.6"/>
    <rect x="82" y="40" width="98" height="168" rx="5" fill="none" stroke="#c39555" stroke-opacity=".25" stroke-width="1" stroke-dasharray="4 3"/>
  </g>
  <path d="M196 112 H214 a4 4 0 0 1 4 4 V140 a4 4 0 0 1 -4 4 H196 Z" fill="url(#gold)" stroke="#2b1a08" stroke-width="2"/>
  <rect x="204" y="121" width="9" height="14" rx="2" fill="#1a0f05"/>
  <circle cx="208.5" cy="126" r="2" fill="#c39555"/>
  <g fill="url(#gold)" stroke="#3b2410" stroke-width="2">
    <path d="M198 24 h-34 a6 6 0 0 0 -2 4 l32 32 a6 6 0 0 0 4 -2 z"/>
    <path d="M198 226 h-34 a6 6 0 0 1 -2 -4 l32 -32 a6 6 0 0 1 4 2 z"/>
    <path d="M66 24 h30 l-30 28 z"/>
    <path d="M66 226 h30 l-30 -28 z"/>
  </g>
  <g stroke="#5c3c18" stroke-width="1" fill="none" opacity=".9">
    <path d="M190 30 l-18 0 M190 30 l0 18"/><path d="M190 220 l-18 0 M190 220 l0 -18"/>
  </g>
  <g fill="#f0cf8c"><circle cx="186" cy="36" r="2.5"/><circle cx="186" cy="214" r="2.5"/><circle cx="74" cy="34" r="2.2"/><circle cx="74" cy="216" r="2.2"/></g>
  <g fill="none" stroke="#c39555" stroke-opacity=".55">
    <circle cx="128" cy="125" r="56" stroke-width="1.5"/>
    <circle cx="128" cy="125" r="47" stroke-width="1"/>
    <path d="${runes(128, 125, 56, 36)}" stroke-width="1.4"/>
  </g>
  <g stroke="#ff2a3d" stroke-linecap="round" fill="none" filter="url(#vglow)">
    <path d="M150 112 C164 98 168 80 184 62" stroke-width="3"/>
    <path d="M170 88 C176 88 182 92 190 88" stroke-width="1.8"/>
    <path d="M140 150 C150 172 156 184 178 208" stroke-width="3"/>
    <path d="M158 180 C166 178 172 184 180 180" stroke-width="1.6"/>
    <path d="M110 150 C98 170 94 190 84 212" stroke-width="2.6"/>
    <path d="M108 102 C98 86 94 70 84 46" stroke-width="2.6"/>
    <path d="M96 76 C90 74 84 78 78 74" stroke-width="1.5"/>
    <path d="M176 128 C184 130 190 126 196 130" stroke-width="2"/>
    <path d="M80 128 C72 132 64 128 58 134" stroke-width="2"/>
  </g>
  <g filter="url(#eglow)">
    <path d="M78 125 Q128 70 178 125 Q128 180 78 125 Z" fill="#3a0008"/>
    <path d="M84 125 Q128 80 172 125 Q128 170 84 125 Z" fill="url(#sclera)"/>
    <g stroke="#b0001a" stroke-width="1" fill="none" opacity=".8">
      <path d="M88 125 C96 120 100 126 106 121"/><path d="M168 125 C160 130 156 124 150 129"/>
      <path d="M92 130 C100 134 104 130 108 135"/><path d="M164 119 C156 115 152 120 148 116"/>
    </g>
    <circle cx="128" cy="125" r="27" fill="url(#iris)"/>
    <g stroke="#ff9a70" stroke-width=".8" opacity=".55">
      ${Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return `<path d="M${(128 + Math.cos(a) * 9).toFixed(1)} ${(125 + Math.sin(a) * 9).toFixed(1)}L${(128 + Math.cos(a) * 25).toFixed(1)} ${(125 + Math.sin(a) * 25).toFixed(1)}"/>`;
      }).join('')}
    </g>
    <path d="M128 101 C120 114 120 136 128 149 C136 136 136 114 128 101 Z" fill="#070102"/>
    <ellipse cx="138" cy="114" rx="6" ry="4" fill="#fff" opacity=".9"/>
    <circle cx="117" cy="136" r="2" fill="#fff" opacity=".5"/>
  </g>
  <path d="M80 125 Q128 76 176 125" fill="none" stroke="#1a0104" stroke-width="6" stroke-linecap="round"/>
  <path d="M82 126 Q128 172 174 126" fill="none" stroke="#1a0104" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  <path d="M120 224 C121 234 119 242 121 250 C123 254 128 252 127 246 C126 238 126 230 126 224 Z" fill="#b0001a"/>
  `,
  `
  <radialGradient id="aura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".6"/><stop offset=".55" stop-color="#8b0a1a" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a1626"/><stop offset=".45" stop-color="#420912"/><stop offset="1" stop-color="#150205"/></linearGradient>
  <linearGradient id="spine" x1="0" x2="1"><stop offset="0" stop-color="#1a0307"/><stop offset=".6" stop-color="#4a0b16"/><stop offset="1" stop-color="#140205"/></linearGradient>
  <linearGradient id="pages" x1="0" x2="1"><stop offset="0" stop-color="#efe5cf"/><stop offset="1" stop-color="#9c8b6a"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dca0"/><stop offset=".45" stop-color="#b8894a"/><stop offset="1" stop-color="#4a2e10"/></linearGradient>
  <radialGradient id="sclera" cx=".5" cy=".45"><stop offset="0" stop-color="#fff0d4"/><stop offset=".6" stop-color="#e2b49a"/><stop offset="1" stop-color="#8a2a2a"/></radialGradient>
  <radialGradient id="iris"><stop offset="0" stop-color="#ffe0b0"/><stop offset=".22" stop-color="#ff7a3a"/><stop offset=".6" stop-color="#e0102c"/><stop offset="1" stop-color="#2a0006"/></radialGradient>
  ${GLOW('vglow', 2.6)}${GLOW('eglow', 5)}${GRIT('gritL', 0.85, 0.9, 4)}
  `,
);

export const ZERO_SVG = svg(
  `
  <circle cx="128" cy="118" r="116" fill="url(#zaura)"/>
  <g filter="url(#shadow)">
    <path d="M14 256 C20 214 46 192 78 182 L128 196 L178 182 C210 192 236 214 242 256 Z" fill="url(#cloak)" filter="url(#gritZ)"/>
    <path d="M14 256 C20 214 46 192 78 182" fill="none" stroke="#ff2a3d" stroke-opacity=".45" stroke-width="2.5"/>
    <path d="M242 256 C236 214 210 192 178 182" fill="none" stroke="#ff2a3d" stroke-opacity=".45" stroke-width="2.5"/>
    <path d="M128 10 C74 10 42 58 40 116 C38 160 50 196 66 222 L190 222 C206 196 218 160 216 116 C214 58 182 10 128 10 Z" fill="url(#hood)" filter="url(#gritZ)"/>
    <path d="M128 10 C74 10 42 58 40 116 C38 160 50 196 66 222" fill="none" stroke="#7b8aa6" stroke-opacity=".5" stroke-width="3"/>
    <path d="M128 10 C182 10 214 58 216 116 C218 160 206 196 190 222" fill="none" stroke="#3a4458" stroke-opacity=".5" stroke-width="2"/>
    <path d="M60 222 L76 200 L84 222 L98 204 L104 222 Z M196 222 L180 200 L172 222 L158 204 L152 222 Z" fill="#07080b"/>
    <path d="M128 36 C88 36 66 80 68 128 C70 172 92 206 128 214 C164 206 186 172 188 128 C190 80 168 36 128 36 Z" fill="#030304"/>
    <path d="M128 54 C98 54 84 86 86 126 C88 164 104 194 128 200 C152 194 168 164 170 126 C172 86 158 54 128 54 Z" fill="url(#skin)" filter="url(#gritS)"/>
    <path d="M86 126 C88 164 104 194 128 200 C152 194 168 164 170 126" fill="none" stroke="#ff2a3d" stroke-opacity=".35" stroke-width="3"/>
    <path d="M86 106 C100 92 114 94 128 100 C142 94 156 92 170 106 L172 84 C150 58 106 58 84 84 Z" fill="#030304" opacity=".85"/>
    <path d="M98 150 C104 158 108 168 106 180 M158 150 C152 158 148 168 150 180" stroke="#2b303a" stroke-width="2" fill="none" opacity=".8"/>
  </g>
  <g stroke="#1d212a" stroke-width="1.4" fill="none" opacity=".9">
    <path d="M100 74 l8 12 l-4 9 l8 10"/><path d="M158 78 l-6 11 l6 8"/><path d="M146 176 l8 9 l-2 10"/>
  </g>
  <g stroke="#ff2a3d" stroke-width="1.8" fill="none" filter="url(#zv)" stroke-linecap="round">
    <path d="M104 166 C96 178 98 190 106 200 C110 206 108 214 104 222"/>
    <path d="M152 166 C160 176 158 188 150 200 C146 206 150 214 154 224"/>
    <path d="M128 192 V230 C128 236 122 240 118 248"/>
    <path d="M128 214 C138 222 146 226 160 236"/>
    <path d="M96 138 C88 126 92 116 86 106"/>
    <path d="M162 136 C170 122 164 114 170 102"/>
    <path d="M112 102 C116 90 112 80 118 70"/>
  </g>
  <path d="M92 116 C100 104 116 106 120 118 C114 130 98 130 92 116 Z" fill="#000"/>
  <path d="M164 116 C156 104 140 106 136 118 C142 130 158 130 164 116 Z" fill="#000"/>
  <g filter="url(#zeye)">
    <path d="M97 117 C102 112 112 112 116 118 C110 122 102 122 97 117 Z" fill="#ff2a3d"/>
    <path d="M159 117 C154 112 144 112 140 118 C146 122 154 122 159 117 Z" fill="#ff2a3d"/>
    <ellipse cx="107" cy="117" rx="3.5" ry="2.2" fill="#fff3e0"/>
    <ellipse cx="149" cy="117" rx="3.5" ry="2.2" fill="#fff3e0"/>
  </g>
  <path d="M120 138 L128 148 L136 138" fill="none" stroke="#2b303a" stroke-width="2"/>
  <path d="M80 152 C92 164 112 160 128 160 C144 160 164 164 176 152 C170 186 86 186 80 152 Z" fill="#0d0003"/>
  <path d="M80 152 C92 164 112 160 128 160 C144 160 164 164 176 152 C170 186 86 186 80 152 Z" fill="url(#maw)"/>
  <g fill="url(#tooth)" stroke="#4a3a28" stroke-width=".7">
    <path d="M86 156 l5 9 l3 -8 z"/><path d="M94 159 l4 12 l4 -11 z"/><path d="M104 160 l4 14 l4 -14 z"/><path d="M114 161 l4 15 l4 -15 z"/><path d="M124 161 l4 16 l4 -16 z"/>
    <path d="M134 161 l4 15 l4 -15 z"/><path d="M144 160 l4 14 l4 -14 z"/><path d="M154 159 l4 12 l4 -12 z"/><path d="M163 157 l3 9 l5 -10 z"/>
    <path d="M94 178 l5 -9 l4 10 z"/><path d="M106 182 l4 -11 l4 11 z"/><path d="M118 184 l4 -12 l4 12 z"/><path d="M130 184 l4 -12 l4 12 z"/><path d="M142 182 l4 -11 l4 10 z"/><path d="M154 178 l4 -9 l4 8 z"/>
  </g>
  <path d="M80 152 L70 146 M176 152 L186 146" stroke="#3a0008" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M138 182 C140 192 138 202 140 212 C142 218 147 216 146 209 C145 200 145 192 143 182 Z" fill="#c0001c"/>
  <path d="M104 180 C105 186 104 192 105 196 C106 199 109 198 108 194 C108 190 108 186 107 180 Z" fill="#c0001c"/>
  `,
  `
  <radialGradient id="zaura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".42"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="hood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#323a4c"/><stop offset=".5" stop-color="#151821"/><stop offset="1" stop-color="#07080b"/></linearGradient>
  <linearGradient id="cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2430"/><stop offset="1" stop-color="#07080b"/></linearGradient>
  <radialGradient id="skin" cx=".5" cy=".62" r=".7"><stop offset="0" stop-color="#d4d8de"/><stop offset=".5" stop-color="#8a92a0"/><stop offset="1" stop-color="#2a2f39"/></radialGradient>
  <radialGradient id="maw" cx=".5" cy=".45"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".85"/><stop offset="1" stop-color="#2a0005" stop-opacity="0"/></radialGradient>
  <linearGradient id="tooth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ead2"/><stop offset="1" stop-color="#a8946e"/></linearGradient>
  ${GLOW('zeye', 4.5)}${GLOW('zv', 2.2)}${GRIT('gritZ', 0.7, 0.8, 9)}${GRIT('gritS', 1.1, 0.7, 2)}
  `,
);

export const MASK_SVG = svg(
  `
  <circle cx="128" cy="128" r="116" fill="url(#maura)"/>
  <g filter="url(#shadow)">
    <path d="M18 100 C36 88 56 88 70 96 L66 126 C50 120 34 122 20 132 Z" fill="url(#strap)"/>
    <path d="M238 100 C220 88 200 88 186 96 L190 126 C206 120 222 122 236 132 Z" fill="url(#strap)"/>
    <rect x="28" y="100" width="14" height="22" rx="2" fill="none" stroke="#9c7a48" stroke-width="3" transform="rotate(-14 35 111)"/>
    <rect x="214" y="100" width="14" height="22" rx="2" fill="none" stroke="#9c7a48" stroke-width="3" transform="rotate(14 221 111)"/>
    <path d="M128 20 C76 20 50 58 48 106 C46 152 64 190 92 210 L164 210 C192 190 210 152 208 106 C206 58 180 20 128 20 Z" fill="url(#rubber)" filter="url(#gritM)"/>
    <path d="M128 20 C76 20 50 58 48 106 C46 152 64 190 92 210 L164 210 C192 190 210 152 208 106 C206 58 180 20 128 20 Z" fill="none" stroke="#0b0c0f" stroke-width="3"/>
    <path d="M66 50 C90 30 166 30 190 50" fill="none" stroke="#8a97ad" stroke-opacity=".55" stroke-width="3"/>
    <path d="M56 140 C60 170 74 192 92 206" fill="none" stroke="#ff2a3d" stroke-opacity=".3" stroke-width="3"/>
    <path d="M200 140 C196 170 182 192 164 206" fill="none" stroke="#ff2a3d" stroke-opacity=".3" stroke-width="3"/>
    <path d="M128 140 V164" stroke="#0b0c0f" stroke-width="2"/>
    <path d="M90 170 H166 L158 240 C158 250 98 250 98 240 Z" fill="url(#can)" stroke="#0b0c0f" stroke-width="3"/>
    <g stroke="#14171c" stroke-width="3"><path d="M95 188 H161"/><path d="M96 202 H160"/><path d="M97 216 H159"/><path d="M98 230 H158"/></g>
    <g stroke="#c5ceda" stroke-width="1" opacity=".35"><path d="M95 185 H161"/><path d="M96 199 H160"/><path d="M97 213 H159"/><path d="M98 227 H158"/></g>
    <ellipse cx="128" cy="170" rx="38" ry="11" fill="#2b3038" stroke="#0b0c0f" stroke-width="2"/>
    <ellipse cx="128" cy="170" rx="26" ry="6" fill="#121418"/>
    <g fill="#0b0c0f"><circle cx="116" cy="170" r="2"/><circle cx="128" cy="170" r="2"/><circle cx="140" cy="170" r="2"/></g>
  </g>
  <g>
    <circle cx="90" cy="104" r="33" fill="url(#brass)" stroke="#2b1a08" stroke-width="2"/>
    <circle cx="166" cy="104" r="33" fill="url(#brass)" stroke="#2b1a08" stroke-width="2"/>
    <circle cx="90" cy="104" r="27" fill="none" stroke="#2b1a08" stroke-width="1.5"/>
    <circle cx="166" cy="104" r="27" fill="none" stroke="#2b1a08" stroke-width="1.5"/>
    <circle cx="90" cy="104" r="24" fill="url(#lens)"/>
    <circle cx="166" cy="104" r="24" fill="url(#lens)"/>
    <g filter="url(#mglow)">
      <ellipse cx="92" cy="106" rx="10" ry="7" fill="#ff2a3d"/>
      <ellipse cx="164" cy="106" rx="10" ry="7" fill="#ff2a3d"/>
      <circle cx="92" cy="106" r="3" fill="#fff0dc"/>
      <circle cx="164" cy="106" r="3" fill="#fff0dc"/>
    </g>
    <path d="M74 90 C80 82 90 80 100 82" stroke="#fff" stroke-opacity=".55" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M150 90 C156 82 166 80 176 82" stroke="#fff" stroke-opacity=".55" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <g stroke="#f6eee2" stroke-width="1.4" fill="none" opacity=".9">
      <path d="M172 86 L164 102 L173 110 L160 126"/><path d="M164 102 L148 98"/><path d="M173 110 L186 115"/><path d="M168 118 L176 124"/>
    </g>
    <path d="M160 126 C162 134 160 142 163 150" stroke="#ff2a3d" stroke-width="2.5" fill="none" filter="url(#mglow)" stroke-linecap="round"/>
    <g fill="#e0b46a" stroke="#3b2410" stroke-width=".8">
      <circle cx="90" cy="73" r="3"/><circle cx="90" cy="135" r="3"/><circle cx="59" cy="104" r="3"/><circle cx="121" cy="104" r="3"/>
      <circle cx="166" cy="73" r="3"/><circle cx="166" cy="135" r="3"/><circle cx="135" cy="104" r="3"/><circle cx="197" cy="104" r="3"/>
    </g>
  </g>
  <path d="M106 240 C108 248 106 252 108 256" stroke="#c0001c" stroke-width="4" stroke-linecap="round" fill="none"/>
  `,
  `
  <radialGradient id="maura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="rubber" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#535c6c"/><stop offset=".45" stop-color="#2a2f38"/><stop offset="1" stop-color="#0d0f13"/></linearGradient>
  <linearGradient id="strap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f38"/><stop offset="1" stop-color="#0d0f13"/></linearGradient>
  <linearGradient id="can" x1="0" x2="1"><stop offset="0" stop-color="#2e343e"/><stop offset=".3" stop-color="#9aa6b8"/><stop offset=".55" stop-color="#4b5360"/><stop offset="1" stop-color="#16191f"/></linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dca0"/><stop offset=".45" stop-color="#9c6f36"/><stop offset="1" stop-color="#2e1c08"/></linearGradient>
  <radialGradient id="lens" cx=".5" cy=".55"><stop offset="0" stop-color="#6a0014"/><stop offset=".65" stop-color="#1a0205"/><stop offset="1" stop-color="#050102"/></radialGradient>
  ${GLOW('mglow', 5)}${GRIT('gritM', 1.2, 0.85, 6)}
  `,
);

export const SERUM_SVG = svg(
  `
  <circle cx="128" cy="142" r="114" fill="url(#saura)"/>
  <g filter="url(#shadow)">
    <path d="M100 14 H156 V30 C156 36 150 38 146 38 H110 C106 38 100 36 100 30 Z" fill="url(#wax)"/>
    <path d="M106 36 C106 44 104 50 106 56 C108 60 112 58 111 52 C110 46 111 40 112 36 Z M146 36 C146 40 145 46 147 48 C149 50 151 48 150 44 C150 40 150 38 150 36 Z" fill="#8b0010"/>
    <rect x="106" y="30" width="44" height="16" rx="3" fill="url(#cap)" stroke="#0b0c0f" stroke-width="2"/>
    <path d="M110 46 H146 V92 C188 104 212 136 212 172 C212 214 174 244 128 244 C82 244 44 214 44 172 C44 136 68 104 110 92 Z" fill="url(#glass)" stroke="#d3dce8" stroke-opacity=".7" stroke-width="3"/>
  </g>
  <path d="M56 160 C78 148 100 164 128 154 C156 144 178 162 200 154 C206 204 174 236 128 236 C82 236 50 206 56 160 Z" fill="url(#liquid)" filter="url(#sglow)"/>
  <g fill="none" stroke="#3a0008" stroke-width="3" opacity=".55" stroke-linecap="round">
    <path d="M90 214 C100 196 120 200 126 184 C132 170 150 176 160 166"/>
    <path d="M110 228 C118 214 140 220 150 204"/>
  </g>
  <path d="M56 160 C78 148 100 164 128 154 C156 144 178 162 200 154" fill="none" stroke="#ffb0b0" stroke-width="2.5" opacity=".85"/>
  <g fill="#ffc9c9" opacity=".8">
    <circle cx="94" cy="198" r="5"/><circle cx="112" cy="180" r="3"/><circle cx="152" cy="208" r="6"/><circle cx="166" cy="184" r="3"/><circle cx="130" cy="218" r="2.5"/><circle cx="82" cy="176" r="2.5"/><circle cx="142" cy="188" r="2"/>
  </g>
  <path d="M66 132 C58 154 60 186 74 210" stroke="#fff" stroke-opacity=".5" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M190 150 C194 170 190 190 182 204" stroke="#fff" stroke-opacity=".2" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M117 52 V90" stroke="#fff" stroke-opacity=".38" stroke-width="5" stroke-linecap="round"/>
  <g transform="translate(128 118) rotate(-4)">
    <path d="M-40 -21 H40 V19 C30 23 -30 17 -40 21 Z" fill="url(#label)" stroke="#5c4b33" stroke-width="1.5"/>
    <path d="M18 -21 C22 -10 30 -6 40 -8 V-21 Z" fill="#7a0014" opacity=".55"/>
    <g fill="none" stroke="#9a0014" stroke-width="3.4">
      <circle cx="-2" cy="-6" r="8"/><circle cx="-9" cy="6" r="8"/><circle cx="5" cy="6" r="8"/>
    </g>
    <circle cx="-2" cy="2" r="3.5" fill="#9a0014"/>
    <path d="M-36 -14 H-22 M-36 -8 H-26 M20 12 H36 M24 6 H36" stroke="#5c4b33" stroke-width="1.6"/>
  </g>
  `,
  `
  <radialGradient id="saura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="cap" x1="0" x2="1"><stop offset="0" stop-color="#2e343e"/><stop offset=".4" stop-color="#a8b3c3"/><stop offset="1" stop-color="#1a1d23"/></linearGradient>
  <linearGradient id="wax" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0102a"/><stop offset="1" stop-color="#5a0010"/></linearGradient>
  <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#a8bad0" stop-opacity=".4"/><stop offset=".5" stop-color="#26303e" stop-opacity=".3"/><stop offset="1" stop-color="#a8bad0" stop-opacity=".35"/></linearGradient>
  <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4a5c"/><stop offset=".55" stop-color="#c8001e"/><stop offset="1" stop-color="#4a000c"/></linearGradient>
  <linearGradient id="label" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2e8d2"/><stop offset="1" stop-color="#b8a582"/></linearGradient>
  ${GLOW('sglow', 5)}
  `,
);

export const HEART_SVG = svg(
  `
  <circle cx="128" cy="138" r="116" fill="url(#haura)"/>
  <g filter="url(#shadow)">
    <path d="M84 70 C80 50 82 30 90 16 L104 18 C98 32 98 50 100 66 Z" fill="url(#vein)" stroke="#12030e" stroke-width="2"/>
    <path d="M112 62 C110 40 118 22 136 14 C156 6 178 12 186 28 C188 36 182 40 176 36 C168 26 150 24 140 32 C132 40 130 52 132 66 Z" fill="url(#vessel)" stroke="#2a0207" stroke-width="2.5"/>
    <path d="M140 30 C140 20 142 12 146 6 L154 8 C150 14 148 22 148 30 Z M158 28 C160 18 164 12 170 8 L176 12 C170 16 168 22 166 30 Z" fill="url(#vessel)" stroke="#2a0207" stroke-width="1.5"/>
    <path d="M150 74 C162 60 182 56 198 62 L196 76 C184 72 170 74 160 84 Z" fill="url(#vein)" stroke="#12030e" stroke-width="2"/>
    <path d="M100 76 C112 66 130 64 140 72 C150 82 144 96 132 96 C122 96 112 90 100 76 Z" fill="url(#vessel)" stroke="#2a0207" stroke-width="2"/>
    <path d="M88 76 C56 82 38 112 42 148 C46 188 80 220 122 242 C128 246 134 246 140 240 C178 212 214 176 214 132 C214 96 190 70 156 72 C140 74 128 82 122 90 C112 80 100 74 88 76 Z" fill="url(#muscle)" filter="url(#gritH)"/>
    <path d="M88 76 C56 82 38 112 42 148 C46 188 80 220 122 242 C128 246 134 246 140 240 C178 212 214 176 214 132 C214 96 190 70 156 72 C140 74 128 82 122 90 C112 80 100 74 88 76 Z" fill="none" stroke="#14020a" stroke-width="3"/>
  </g>
  <path d="M68 100 C58 122 60 152 74 176" stroke="#ffb0b0" stroke-opacity=".45" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M168 86 C182 92 192 104 196 118" stroke="#ffb0b0" stroke-opacity=".3" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M122 92 C116 130 126 180 136 236" stroke="#2a0207" stroke-width="3.5" fill="none" opacity=".8"/>
  <g stroke="#4a0a3a" stroke-width="2.4" fill="none" opacity=".9" stroke-linecap="round">
    <path d="M122 110 C104 116 92 130 80 150"/><path d="M98 126 C94 140 96 152 100 166"/>
    <path d="M128 140 C148 150 160 168 168 192"/><path d="M152 160 C168 158 180 164 190 172"/>
  </g>
  <g stroke="#ff2a3d" stroke-width="2" fill="none" filter="url(#hv)" stroke-linecap="round">
    <path d="M124 104 C142 110 154 124 180 120"/>
    <path d="M154 118 C160 132 172 138 192 146"/>
    <path d="M120 134 C100 140 86 154 66 154"/>
    <path d="M130 170 C142 182 150 196 154 214"/>
    <path d="M94 150 C92 166 98 178 108 190"/>
  </g>
  <g filter="url(#hp)">
    <circle cx="172" cy="152" r="10" fill="url(#pus)"/>
    <circle cx="94" cy="114" r="7.5" fill="url(#pus)"/>
    <circle cx="142" cy="200" r="6.5" fill="url(#pus)"/>
    <circle cx="190" cy="112" r="5" fill="url(#pus)"/>
    <circle cx="82" cy="172" r="5" fill="url(#pus)"/>
    <circle cx="112" cy="206" r="3.5" fill="url(#pus)"/>
  </g>
  <g fill="#14020a">
    <path d="M200 92 l20 -12 l-12 18 z"/><path d="M210 132 l22 2 l-20 9 z"/><path d="M46 120 l-20 -7 l18 16 z"/><path d="M56 172 l-16 11 l20 -4 z"/><path d="M172 200 l14 12 l-18 -6 z"/>
  </g>
  <path d="M130 240 C130 248 128 252 130 256" stroke="#c0001c" stroke-width="5" stroke-linecap="round"/>
  `,
  `
  <radialGradient id="haura"><stop offset="0" stop-color="#ff2a3d" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="muscle" cx=".32" cy=".32" r=".85"><stop offset="0" stop-color="#e03a52"/><stop offset=".45" stop-color="#951024"/><stop offset="1" stop-color="#250207"/></radialGradient>
  <linearGradient id="vessel" x1="0" x2="1"><stop offset="0" stop-color="#5a0010"/><stop offset=".5" stop-color="#c03a52"/><stop offset="1" stop-color="#3a0008"/></linearGradient>
  <linearGradient id="vein" x1="0" x2="1"><stop offset="0" stop-color="#2a0a3a"/><stop offset=".5" stop-color="#6b2a7a"/><stop offset="1" stop-color="#1a0624"/></linearGradient>
  <radialGradient id="pus" cx=".4" cy=".35"><stop offset="0" stop-color="#fff2d6"/><stop offset=".35" stop-color="#ff6a3a"/><stop offset="1" stop-color="#8b0010"/></radialGradient>
  ${GLOW('hv', 2.2)}${GLOW('hp', 3.2)}${GRIT('gritH', 1.4, 0.6, 11)}
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
