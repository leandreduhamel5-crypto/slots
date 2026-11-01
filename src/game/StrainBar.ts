import { Container, Graphics, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import type { Sym } from '../math/config';
import { PREMIUM_EXPANDERS } from '../math/engine';
import { paintBonusPlate } from './art/egyptFrame';
import { makeCanvas } from './art/painters';
import type { SymbolTextures } from './textures';

const SLOT = 84;
export const STRAIN_BAR_W = SLOT * PREMIUM_EXPANDERS.length + 24;
export const STRAIN_BAR_H = 128;
const LIT_SIZE = 94;
const SHADOW_SIZE = 70;
const SHADOW_ART = 96;
/** how far the plate is painted around its face, in pixels of its texture */
const PLATE_MARGIN = 32;

let plateTex: Texture | null = null;

/** A plate of lapis and gold of any size, centred on its position. */
export function makePlate(w: number, h: number): NineSliceSprite {
  plateTex ??= Texture.from(paintBonusPlate());
  const s = new NineSliceSprite({ texture: plateTex, leftWidth: 64, rightWidth: 64, topHeight: 64, bottomHeight: 64, anchor: 0.5 });
  s.scale.set(0.5);
  sizePlate(s, w, h);
  return s;
}

export function sizePlate(s: NineSliceSprite, w: number, h: number): void {
  s.width = w * 2 + PLATE_MARGIN * 2;
  s.height = h * 2 + PLATE_MARGIN * 2;
}

const shadows = new Map<Sym, Texture>();

/** The symbol in grey and in the dark. Painted by hand: a filter per icon costs too much, and Safari's canvas has none. */
function shadowOf(tex: SymbolTextures, s: Sym): Texture {
  let t = shadows.get(s);
  if (!t) {
    const [c, x] = makeCanvas(SHADOW_ART, SHADOW_ART);
    x.drawImage(tex.normal[s].source.resource as CanvasImageSource, 0, 0, SHADOW_ART, SHADOW_ART);
    const img = x.getImageData(0, 0, SHADOW_ART, SHADOW_ART);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * 0.36;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v * 1.08;
    }
    x.putImageData(img, 0, 0);
    t = Texture.from(c);
    shadows.set(s, t);
  }
  return t;
}

interface Slot {
  sym: Sym;
  /** the dark tile with its gold edge, under a strain that is lit */
  well: Graphics;
  shadow: Sprite;
  lit: Sprite;
  halo: Sprite;
  flare: Sprite;
}

/** All the strains in a row: those at work in full colour, the others grey, in the shadow. */
export class StrainBar extends Container {
  private slots: Slot[] = [];
  private spark: Sprite;
  private focused: Sym | null = null;
  /** the strains lit up */
  private active: Sym[] = [];
  /** a strain has just caught */
  onIgnite: (() => void) | null = null;

  constructor(tex: SymbolTextures) {
    super();
    this.addChild(makePlate(STRAIN_BAR_W, STRAIN_BAR_H));
    const glow = (size: number, tint: number) => {
      const g = new Sprite(tex.glow);
      g.anchor.set(0.5);
      g.width = g.height = size;
      g.blendMode = 'add';
      g.tint = tint;
      g.alpha = 0;
      return g;
    };
    PREMIUM_EXPANDERS.forEach((sym, i) => {
      const x = (i - (PREMIUM_EXPANDERS.length - 1) / 2) * SLOT;
      const halo = glow(150, 0xffa030);
      const flare = glow(260, 0xfff0c8);
      const shadow = new Sprite(shadowOf(tex, sym));
      shadow.anchor.set(0.5);
      shadow.width = shadow.height = SHADOW_SIZE;
      const lit = new Sprite(tex.normal[sym]);
      lit.anchor.set(0.5);
      lit.width = lit.height = LIT_SIZE;
      lit.visible = false;
      const well = new Graphics().roundRect(-40, -56, 80, 112, 10).fill(0x1c0a08).stroke({ width: 3, color: 0xf2c25a });
      well.visible = false;
      for (const s of [well, halo, flare, shadow, lit]) s.x = x;
      this.addChild(well, halo, shadow, lit, flare);
      this.slots.push({ sym, well, shadow, lit, halo, flare });
    });
    this.spark = glow(120, 0xffe0a0);
    this.addChild(this.spark);
  }

  private show(slot: Slot): void {
    const on = this.active.includes(slot.sym);
    const shown = on || slot.sym === this.focused;
    slot.lit.visible = shown;
    slot.well.visible = shown;
    slot.shadow.visible = !shown;
    if (on === gsap.isTweening(slot.halo)) {
      gsap.killTweensOf(slot.halo);
      slot.halo.alpha = 0;
      if (on) gsap.fromTo(slot.halo, { alpha: 0.6 }, { alpha: 1, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
  }

  /** These strains lit, the others in the shadow, without ceremony. */
  set(active: Sym[]): void {
    this.active = [...active];
    this.slots.forEach((s) => this.show(s));
  }

  /** The light of a choice passing over one strain (null: nothing under it any more). */
  focus(s: Sym | null): void {
    const was = this.focused;
    this.focused = s;
    for (const slot of this.slots) if (slot.sym === was || slot.sym === s) this.show(slot);
  }

  /** A strain catches: with `scan`, a light first runs along the row to find it. */
  ignite(s: Sym, scan = true): void {
    const slot = this.slots.find((k) => k.sym === s)!;
    const blaze = () => {
      if (this.destroyed) return;
      this.focus(null);
      this.active.push(s);
      this.show(slot);
      gsap.fromTo(slot.flare, { alpha: 1 }, { alpha: 0, duration: 0.8, ease: 'power2.out' });
      this.onIgnite?.();
    };
    if (!scan) {
      blaze();
      return;
    }
    const from = this.slots[0].lit.x;
    const run = { x: from };
    this.spark.alpha = 1;
    gsap.to(run, {
      x: slot.lit.x,
      duration: 0.25 + 0.06 * this.slots.indexOf(slot),
      ease: 'sine.inOut',
      onUpdate: () => {
        if (this.destroyed) return;
        this.spark.x = run.x;
        this.focus(this.slots[Math.round((run.x - from) / SLOT)].sym);
      },
      onComplete: () => {
        if (this.destroyed) return;
        gsap.to(this.spark, { alpha: 0, duration: 0.25 });
        blaze();
      },
    });
  }

  /** The strains at work answer: one of them has just taken a reel. */
  flash(): void {
    for (const slot of this.slots) {
      if (this.active.includes(slot.sym)) gsap.fromTo(slot.flare, { alpha: 0.8 }, { alpha: 0, duration: 0.7, ease: 'power2.out' });
    }
  }
}
