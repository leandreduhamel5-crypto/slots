import { Container, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { INK, makeCanvas, paintShine, softGlow } from './art/painters';
import { goldGrad } from './art/egyptFrame';
import { GOLD, cheapBlur, dilateMask, metalTitle, textMask } from './art/logoArt';


/**
 * "BOOK OF INFECTION" in the spirit of the art-direction sheet: an Eye of Horus emblem in
 * polished gold, BOOK OF in wide-tracked capitals between gold rules, INFECTION in tall
 * Cinzel cast in gold with molten red veins, and a small subtitle. Painted at 2x.
 */
export function paintLogo(_eye?: HTMLCanvasElement): HTMLCanvasElement {
  const S = 2;
  const w = 1100 * S;
  const h = 380 * S;
  const [c, ctx] = makeCanvas(w, h);
  const cx = w / 2;

  // a soft dark halo so the title reads over the bright sky
  ctx.save();
  ctx.filter = 'blur(60px)';
  ctx.fillStyle = 'rgba(10,2,4,0.65)';
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.5, w * 0.36, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- Eye of Horus emblem
  const [em, ex] = makeCanvas(420, 220);
  ex.fillStyle = '#fff';
  ex.strokeStyle = '#fff';
  ex.lineCap = 'round';
  ex.lineJoin = 'round';
  // brow
  ex.lineWidth = 16;
  ex.beginPath();
  ex.moveTo(90, 52);
  ex.quadraticCurveTo(210, 8, 340, 50);
  ex.stroke();
  // almond eye outline with the long kohl tail
  ex.lineWidth = 14;
  ex.beginPath();
  ex.moveTo(100, 112);
  ex.quadraticCurveTo(205, 40, 320, 104);
  ex.quadraticCurveTo(205, 160, 100, 112);
  ex.moveTo(318, 104);
  ex.lineTo(392, 110);
  ex.stroke();
  // the falcon markings: the drop and the spiral
  ex.lineWidth = 13;
  ex.beginPath();
  ex.moveTo(176, 140);
  ex.lineTo(150, 205);
  ex.moveTo(240, 140);
  ex.quadraticCurveTo(250, 200, 300, 196);
  ex.quadraticCurveTo(330, 190, 316, 168);
  ex.stroke();
  const emblem = metalTitle(em, { ...GOLD, bevel: 6 }, { outline: 5 });
  const emX = cx - em.width / 2;
  const emY = 8;
  ctx.drawImage(emblem, emX, emY);
  // the iris: a glowing ruby
  const ir = { x: emX + 208, y: emY + 102, r: 30 };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(ir.x, ir.y, 4, ir.x, ir.y, ir.r * 3);
  halo.addColorStop(0, 'rgba(255,60,40,0.8)');
  halo.addColorStop(1, 'rgba(255,40,30,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(ir.x - ir.r * 3, ir.y - ir.r * 3, ir.r * 6, ir.r * 6);
  ctx.restore();
  const rg = ctx.createRadialGradient(ir.x - 8, ir.y - 8, 2, ir.x, ir.y, ir.r);
  rg.addColorStop(0, '#ffd8c8');
  rg.addColorStop(0.35, '#ff3a2a');
  rg.addColorStop(1, '#5a0008');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(ir.x, ir.y, ir.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(ir.x - 9, ir.y - 10, 8, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // ---- BOOK OF between gold rules
  const bm = textMask('BOOK OF', 'Cinzel, serif', 96, 34, 24, 700);
  const book = metalTitle(bm, { ...GOLD, bevel: 5 }, { outline: 5 });
  const bookY = 210;
  ctx.drawImage(book, cx - bm.width / 2, bookY);
  const ruleY = bookY + bm.height / 2;
  const rule = (x0: number, x1: number) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    const outward = x0 < cx ? [0, 1] : [1, 0];
    g.addColorStop(outward[0], 'rgba(242,194,90,0)');
    g.addColorStop(outward[1], 'rgba(255,226,150,1)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), ruleY - 2, Math.abs(x1 - x0), 4);
    const d = x0 < cx ? x1 : x1;
    ctx.save();
    ctx.translate(d, ruleY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = goldGrad(ctx, -9, -9, 9, 9);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  };
  rule(cx - bm.width / 2 - 360, cx - bm.width / 2 + 10);
  rule(cx + bm.width / 2 + 360, cx + bm.width / 2 - 10);

  // ---- INFECTION: tall cast gold with molten veins
  const im = textMask('INFECTION', 'Cinzel, serif', 290, 26, 50, 700);
  const inf = metalTitle(im, GOLD, { outline: 9, cracks: 16, seed: 11 });
  const k = Math.min(1, (w - 80) / inf.width);
  ctx.save();
  ctx.translate(cx, 480);
  ctx.scale(k, k);
  // red ember glow behind the letters
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  const gp = 220;
  const [padded, px] = makeCanvas(im.width + gp * 2, im.height + gp * 2);
  px.drawImage(im, gp, gp);
  ctx.drawImage(cheapBlur(dilateMask(padded, 10, '#ff2a14'), 44), -inf.width / 2 - gp, -inf.height / 2 - gp, padded.width, padded.height);
  ctx.restore();
  ctx.drawImage(inf, -inf.width / 2, -inf.height / 2);
  ctx.restore();

  return c;
}

/** Logo canvas: professional artwork from public/assets if provided, else the painted one. */
export function logoCanvas(eye: HTMLCanvasElement, custom: HTMLImageElement | null): HTMLCanvasElement {
  if (!custom) return paintLogo(eye);
  // the logo is kept at 2×: it is the first thing a player reads on a big screen
  const [c, ctx] = makeCanvas(2200, 720);
  const k = Math.min(2200 / custom.naturalWidth, 720 / custom.naturalHeight);
  const w = custom.naturalWidth * k;
  const h = custom.naturalHeight * k;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(custom, (2200 - w) / 2, (720 - h) / 2, w, h);
  return c;
}

function emberCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return c;
}

interface Drop {
  s: Sprite;
  vy: number;
  life: number;
}

/**
 * The in-game logo, alive: it breathes, a light sweep crosses the letters, a red halo pulses
 * behind it, blood drops fall from the letters, and now and then it glitches.
 */
export class Logo extends Container {
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private inner = new Container();
  private sprite: Sprite;
  private halo: Sprite;
  private shine: Sprite;
  private dropTex: Texture;
  private drops: Drop[] = [];
  private dropLayer = new Container();
  private art: HTMLCanvasElement;
  private base = 0.78;

  constructor(art: HTMLCanvasElement) {
    super();
    this.art = art;
    const tex = Texture.from(art);
    // the painted art is 2× (custom art is 1×): keep the on-screen size the same
    const k = 1100 / art.width;
    this.base = 0.78 * k;
    this.inner.scale.set(this.base);
    // red halo hugging the silhouette
    this.halo = new Sprite(Texture.from(softGlow(art, 18 / k)));
    this.halo.anchor.set(0.5, 0.45);
    this.halo.blendMode = 'add';
    this.halo.tint = 0xff2a44;
    this.halo.alpha = 0.35;
    this.sprite = new Sprite(tex);
    this.sprite.anchor.set(0.5, 0.45);
    // light sweep, masked by the logo itself
    const mask = new Sprite(tex);
    mask.anchor.set(0.5, 0.45);
    this.shine = new Sprite(Texture.from(paintShine()));
    this.shine.anchor.set(0.5);
    this.shine.height = art.height * 1.3;
    this.shine.width = 220 / k;
    this.shine.rotation = 0.35;
    this.shine.blendMode = 'add';
    this.shine.x = -art.width;
    this.shine.mask = mask;
    this.dropTex = Texture.from(emberCanvas());
    this.inner.addChild(this.halo, this.sprite, mask, this.shine, this.dropLayer);
    this.addChild(this.inner);
    this.addGems();
    this.scheduleShine();
    gsap.to(this.inner.scale, { x: this.base * 1.012, y: this.base * 1.012, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to(this.halo, { alpha: 0.6, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.ticker.add(this.tick);
  }

  /** The five rubies of the artwork smoulder, and a star crosses each of them now and then. */
  private addGems(): void {
    const k = 2200 / 1992; // artwork px → canvas px
    const gems: [number, number, number][] = [[993, 108, 1.5], [525, 238, 0.8], [1455, 238, 0.8], [1495, 395, 1.1], [990, 556, 1]];
    gems.forEach(([x, y, size], i) => {
      const gx = x * k - this.art.width / 2;
      const gy = y * k + (720 - 619 * k) / 2 - this.art.height * 0.45;
      const glow = new Sprite(this.dropTex);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = 0xff2a14;
      glow.position.set(gx, gy);
      glow.scale.set(size * 5);
      gsap.fromTo(glow, { alpha: 0.2 }, { alpha: 0.75, duration: 1.3 + i * 0.21, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.3 });
      const star = new Sprite(this.dropTex);
      star.anchor.set(0.5);
      star.blendMode = 'add';
      star.position.set(gx, gy);
      star.scale.set(size * 9, size * 0.5);
      star.alpha = 0;
      const glint = () => gsap.timeline({ delay: 3 + Math.random() * 8, onComplete: glint }).fromTo(star, { alpha: 0 }, { alpha: 1, duration: 0.14 }).to(star, { alpha: 0, duration: 0.6 });
      glint();
      this.inner.addChild(glow, star);
    });
  }

  private scheduleShine(): void {
    gsap.delayedCall(2.5 + Math.random() * 2.5, () => {
      if (this.destroyed) return;
      this.sweep();
      this.scheduleShine();
    });
  }

  /** Light sweep across the letters. */
  sweep(duration = 0.9): void {
    const w = this.art.width;
    gsap.fromTo(this.shine, { x: -w * 0.6 }, { x: w * 0.6, duration, ease: 'power1.inOut' });
  }

  private tick = (): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, gsap.ticker.deltaRatio() / 60);
    // embers rise off the molten INFECTION letters
    if (Math.random() < dt * 9) {
      const s = new Sprite(this.dropTex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.scale.set((0.4 + Math.random() * 0.7) / this.k());
      s.tint = Math.random() < 0.7 ? 0xff6a20 : 0xffd080;
      s.position.set((Math.random() - 0.5) * this.art.width * 0.8, this.art.height * (0.12 + Math.random() * 0.3));
      s.alpha = 0;
      this.dropLayer.addChild(s);
      this.drops.push({ s, vy: -(40 + Math.random() * 70) / this.k(), life: 0 });
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life += dt;
      d.s.y += d.vy * dt;
      d.s.x += Math.sin(d.life * 4 + i) * 20 * dt / this.k();
      d.s.alpha = Math.min(1, d.life * 3) * Math.max(0, 1 - d.life / 1.6);
      if (d.life > 1.6) {
        d.s.destroy();
        this.drops.splice(i, 1);
      }
    }
  };

  private k(): number {
    return 1100 / this.art.width;
  }

  /** Struck by an event: a short chromatic tear and a sweep of light. */
  glitch(power = 1): void {
    this.filters = [this.split];
    if (power > 1) this.sweep(0.6);
    const tl = gsap.timeline();
    for (let i = 0; i < 5; i++) {
      tl.add(() => {
        const j = () => (Math.random() - 0.5) * 10 * power;
        this.split.red = { x: j(), y: 0 };
        this.split.blue = { x: j(), y: 0 };
      });
      tl.to({}, { duration: 0.04 });
    }
    tl.add(() => {
      this.split.red = { x: 0, y: 0 };
      this.split.blue = { x: 0, y: 0 };
      this.filters = [];
    });
  }

  homeX = 0;
}

/** Cuts the eye out of the codex symbol art for the logo. */
export function eyeFromCodex(codex: HTMLImageElement | HTMLCanvasElement, size: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(120, 120);
  ctx.beginPath();
  ctx.arc(60, 60, 56, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(60, 60, 50, 0, Math.PI * 2);
  ctx.clip();
  const scale = size / 256;
  ctx.drawImage(codex, 72 * scale, 70 * scale, 112 * scale, 112 * scale, 0, 0, 120, 120);
  ctx.restore();
  return c;
}
