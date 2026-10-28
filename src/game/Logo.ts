import { Container, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { INK, makeCanvas, paintShine, softGlow } from './art/painters';
import { goldGrad } from './art/egyptFrame';
import { BLOOD_METAL, GOLD, metalTitle, textMask } from './art/logoArt';

/** Eye medallion that replaces an "O" in BOOK: gold ring, red reptile eye. */
function eyeMedallion(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.9);
  halo.addColorStop(0, 'rgba(255,40,40,0.75)');
  halo.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.restore();
  // ring (with ink edge, matching the 3D letters)
  ctx.beginPath();
  ctx.arc(x, y, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0204';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad(ctx, x - r, y - r, x + r, y + r);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.74, 0, Math.PI * 2);
  ctx.fillStyle = '#1a0306';
  ctx.fill();
  // almond
  const almond = () => {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.66, y);
    ctx.quadraticCurveTo(x, y - r * 0.7, x + r * 0.66, y);
    ctx.quadraticCurveTo(x, y + r * 0.7, x - r * 0.66, y);
    ctx.closePath();
  };
  almond();
  const ig = ctx.createRadialGradient(x, y, 1, x, y, r * 0.6);
  ig.addColorStop(0, '#ffe8a0');
  ig.addColorStop(0.35, '#ff7a1a');
  ig.addColorStop(0.75, '#e01020');
  ig.addColorStop(1, '#5a0008');
  ctx.fillStyle = ig;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.09, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0002';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y - r * 0.2, r * 0.12, r * 0.07, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * "BOOK OF INFECTION" as cast metal (art/logoArt.ts): polished-gold BOOK OF with the eye
 * medallion as its second O, and INFECTION in blood-red metal veined with molten cracks,
 * both rimmed in gold. Painted at 2× (2200×760) for crisp edges on any screen.
 */
export function paintLogo(_eye?: HTMLCanvasElement): HTMLCanvasElement {
  const S = 2;
  const w = 1100 * S;
  const h = 380 * S;
  const [c, ctx] = makeCanvas(w, h);

  // dark smoke behind the title so it reads over anything
  ctx.save();
  ctx.filter = 'blur(60px)';
  ctx.fillStyle = 'rgba(20,0,4,0.7)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- BOOK OF: one mask, the eye takes the place of the second O
  const deco = '"Cinzel Decorative", Cinzel, serif';
  const size = 270;
  const pad = 40;
  const [, mx] = makeCanvas(10, 10);
  mx.font = `900 ${size}px ${deco}`;
  const wB = mx.measureText('B').width;
  const wO = mx.measureText('O').width;
  const wK = mx.measureText('K').width;
  mx.font = `900 ${size * 0.48}px ${deco}`;
  const wOF = mx.measureText('OF').width;
  const gap = 10;
  const eyeW = wO * 1.08;
  const total = wB + wO + eyeW + wK + wOF + gap * 5;
  const [bm, bctx] = makeCanvas(Math.ceil(total + pad * 2), Math.ceil(size * 1.25 + pad * 2));
  bctx.fillStyle = '#fff';
  bctx.textBaseline = 'middle';
  const midY = bm.height / 2 + size * 0.04;
  let x = pad;
  bctx.font = `900 ${size}px ${deco}`;
  bctx.fillText('B', x, midY);
  x += wB + gap;
  bctx.fillText('O', x, midY);
  x += wO + gap;
  const eyeX = x + eyeW / 2;
  x += eyeW + gap;
  bctx.fillText('K', x, midY);
  x += wK + gap * 2;
  bctx.font = `900 ${size * 0.48}px ${deco}`;
  bctx.fillText('OF', x, midY - size * 0.2);
  const book = metalTitle(bm, GOLD, { outline: 9, tilt: -0.05 });
  const bookX = w / 2 - bm.width / 2;
  const bookY = 30;
  ctx.drawImage(book, bookX, bookY);
  eyeMedallion(ctx, bookX + eyeX, bookY + midY + 4, size * 0.4);

  // ---- INFECTION: blood metal with molten veins
  const im = textMask('INFECTION', 'Cinzel, serif', 300, 14, 50);
  const inf = metalTitle(im, BLOOD_METAL, { outline: 10, cracks: 22, seed: 11 });
  const k = Math.min(1, (w - 60) / inf.width);
  ctx.save();
  ctx.translate(w / 2, 520);
  ctx.scale(k, k);
  ctx.drawImage(inf, -inf.width / 2, -inf.height / 2);
  ctx.restore();
  return c;
}

/** Logo canvas: professional artwork from public/assets if provided, else the painted one. */
export function logoCanvas(eye: HTMLCanvasElement, custom: HTMLImageElement | null): HTMLCanvasElement {
  if (!custom) return paintLogo(eye);
  const [c, ctx] = makeCanvas(1100, 360);
  const k = Math.min(1100 / custom.naturalWidth, 360 / custom.naturalHeight);
  const w = custom.naturalWidth * k;
  const h = custom.naturalHeight * k;
  ctx.drawImage(custom, (1100 - w) / 2, (360 - h) / 2, w, h);
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
    this.scheduleGlitch();
    this.scheduleShine();
    gsap.to(this.inner.scale, { x: this.base * 1.025, y: this.base * 0.99, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to(this.halo, { alpha: 0.6, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.ticker.add(this.tick);
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

  private scheduleGlitch(): void {
    gsap.delayedCall(4 + Math.random() * 5, () => {
      if (this.destroyed) return;
      this.glitch();
      this.scheduleGlitch();
    });
  }

  /** Cartoon "boing" plus a short chromatic glitch. */
  glitch(power = 1): void {
    this.filters = [this.split];
    gsap.fromTo(this.inner, { rotation: -0.04 * power }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' });
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
