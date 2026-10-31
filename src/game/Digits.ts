import { Container, Sprite, Texture } from 'pixi.js';
import { MATERIALS, render3DText } from './art/painters';
import { fmt } from '../ui/format';

const GLYPHS = '0123456789,. ×';
interface Glyph {
  tex: Texture;
  /** visible (non-transparent) horizontal extent, relative to the texture centre */
  left: number;
  right: number;
}
const cache = new Map<string, Map<string, Glyph>>();

/** Horizontal bounds of the opaque pixels, so spacing follows the real letter shape. */
function inkBounds(c: HTMLCanvasElement): [number, number] {
  const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let min = c.width;
  let max = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 40) {
        if (x < min) min = x;
        if (x > max) max = x;
      }
    }
  }
  return min > max ? [0, c.width] : [min, max + 1];
}

function glyphSet(size: number, material: string): Map<string, Glyph> {
  const key = `${size}|${material}`;
  let set = cache.get(key);
  if (!set) {
    set = new Map();
    for (const ch of GLYPHS) {
      if (ch === ' ') continue;
      const c = render3DText(ch, { size, material: MATERIALS[material], pad: 18 });
      const [l, r] = inkBounds(c);
      set.set(ch, { tex: Texture.from(c), left: l - c.width / 2, right: r - c.width / 2 });
    }
    cache.set(key, set);
  }
  return set;
}

/** Pre-renders glyph sets during loading so the first big win doesn't hitch. */
export function warmDigits(sizes: number[], material = 'gold'): void {
  for (const size of sizes) glyphSet(size, material);
}

/**
 * Bitmap-font style counter: each character is a pre-rendered 3D glyph, so counting up
 * at 60 fps only swaps sprite textures instead of re-rasterising text.
 */
export class Digits extends Container {
  private glyphs: Map<string, Glyph>;
  private sprites: Sprite[] = [];
  private current = '';
  /** width of the current text, before this container's own scale */
  inkWidth = 0;

  constructor(
    private size: number,
    material = 'gold',
  ) {
    super();
    this.glyphs = glyphSet(size, material);
  }

  set value(v: number) {
    this.text = fmt(v);
  }

  set text(t: string) {
    if (t === this.current) return;
    this.current = t;
    const chars = [...t].filter((c) => c !== ' ' && c !== ' ' && c !== ' ');
    while (this.sprites.length < chars.length) {
      const s = new Sprite();
      s.anchor.set(0.5);
      this.sprites.push(s);
      this.addChild(s);
    }
    // outlines touch slightly, like hand-lettered comic numbers
    const kern = -this.size * 0.04;
    let width = 0;
    chars.forEach((ch, i) => {
      const s = this.sprites[i];
      const g = this.glyphs.get(ch) ?? this.glyphs.get('0')!;
      s.texture = g.tex;
      s.visible = true;
      if (i > 0) width += kern;
      s.x = width - g.left;
      s.y = ch === ',' || ch === '.' ? this.size * 0.06 : 0;
      width += g.right - g.left;
    });
    for (let i = chars.length; i < this.sprites.length; i++) this.sprites[i].visible = false;
    for (const s of this.sprites) s.x -= width / 2;
    this.inkWidth = width;
  }
}
