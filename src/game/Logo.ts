import { Container, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { INK, goo, makeCanvas, seeded } from './art/painters';

const FONT = '"Luckiest Guy", sans-serif';

/** One cel-shaded cartoon letter (ink casing, drop, shadow tone, base tone, gloss). */
function letter(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  size: number,
  rot: number,
  colors: { base: string; shadow: string; light: string },
): void {
  const pad = size;
  const [lc, l] = makeCanvas(size * 2, size * 2);
  l.font = `${size}px ${FONT}`;
  l.textAlign = 'center';
  l.textBaseline = 'middle';
  l.fillStyle = colors.shadow;
  l.fillText(ch, pad, pad);
  l.globalCompositeOperation = 'source-atop';
  l.fillStyle = colors.base;
  l.fillText(ch, pad - 4, pad - 7);
  l.fillStyle = colors.light;
  l.beginPath();
  l.ellipse(pad - size * 0.08, pad - size * 0.3, size * 0.3, size * 0.09, -0.1, 0, Math.PI * 2);
  l.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(ch, 0, size * 0.06);
  ctx.strokeText(ch, 0, 0);
  ctx.drawImage(lc, -pad, -pad);
  ctx.restore();
}

function splat(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  const rnd = seeded(seed);
  ctx.beginPath();
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spike = i % 2 ? 0.78 + rnd() * 0.12 : 1 + rnd() * 0.22;
    const x = cx + Math.cos(a) * rx * spike;
    const y = cy + Math.sin(a) * ry * spike;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#b5122f';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 1.12 + rnd() * 0.25;
    const r = 6 + rnd() * 10;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r, 0, Math.PI * 2);
    ctx.fillStyle = '#b5122f';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();
  }
}

export function paintLogo(eye: HTMLCanvasElement): HTMLCanvasElement {
  const w = 1100;
  const h = 330;
  const [c, ctx] = makeCanvas(w, h);
  splat(ctx, w / 2, 120, 330, 92, 11);

  const word = 'CODEX';
  const size = 176;
  ctx.font = `${size}px ${FONT}`;
  const widths = [...word].map((ch) => ctx.measureText(ch).width);
  const spacing = 4;
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (word.length - 1);
  let x = w / 2 - total / 2;
  const rot = [-0.07, 0.05, -0.03, 0.06, -0.05];
  const dy = [8, -6, 4, -8, 6];
  const bone = { base: '#f6ead0', shadow: '#c9a978', light: '#fffaf0' };
  [...word].forEach((ch, i) => {
    letter(ctx, ch, x + widths[i] / 2, 128 + dy[i], size, rot[i], bone);
    x += widths[i] + spacing;
  });
  const rnd = seeded(4);
  for (const gx of [w / 2 - 170, w / 2 - 40, w / 2 + 120, w / 2 + 200]) goo(ctx, gx, 196, 18 + rnd() * 26, 6 + rnd() * 3);

  // ribbon
  const rw = 520;
  const ry = 262;
  const rh = 66;
  const ribbon = (dir: number) => {
    ctx.beginPath();
    const x0 = w / 2 + dir * (rw / 2 - 20);
    ctx.moveTo(x0, ry - rh / 2 + 10);
    ctx.lineTo(x0 + dir * 70, ry - rh / 2 + 10);
    ctx.lineTo(x0 + dir * 46, ry + 6);
    ctx.lineTo(x0 + dir * 70, ry + rh / 2 + 10);
    ctx.lineTo(x0, ry + rh / 2 + 10);
    ctx.closePath();
    ctx.fillStyle = '#4a0718';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.stroke();
  };
  ribbon(-1);
  ribbon(1);
  ctx.beginPath();
  ctx.moveTo(w / 2 - rw / 2, ry - rh / 2);
  ctx.quadraticCurveTo(w / 2, ry - rh / 2 - 14, w / 2 + rw / 2, ry - rh / 2);
  ctx.lineTo(w / 2 + rw / 2, ry + rh / 2);
  ctx.quadraticCurveTo(w / 2, ry + rh / 2 - 14, w / 2 - rw / 2, ry + rh / 2);
  ctx.closePath();
  ctx.fillStyle = '#2a1530';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2 - rw / 2 + 12, ry - rh / 2 + 9);
  ctx.quadraticCurveTo(w / 2, ry - rh / 2 - 4, w / 2 + rw / 2 - 12, ry - rh / 2 + 9);
  ctx.strokeStyle = '#5a3366';
  ctx.lineWidth = 4;
  ctx.stroke();

  const red = { base: '#ff3347', shadow: '#a3102a', light: '#ff9aa4' };
  const sub = 'INFECTA';
  const ss = 58;
  ctx.font = `${ss}px ${FONT}`;
  const sw = [...sub].map((ch) => ctx.measureText(ch).width);
  const st = sw.reduce((a, b) => a + b, 0) + 10 * (sub.length - 1);
  let sx = w / 2 - st / 2;
  [...sub].forEach((ch, i) => {
    letter(ctx, ch, sx + sw[i] / 2, ry - 2 + (i % 2 ? -2 : 2), ss, (i % 2 ? 1 : -1) * 0.04, red);
    sx += sw[i] + 10;
  });
  for (const dir of [-1, 1]) {
    const ex = w / 2 + dir * (st / 2 + 44);
    ctx.drawImage(eye, ex - 30, ry - 30, 60, 60);
  }
  return c;
}

export class Logo extends Container {
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private sprite: Sprite;

  constructor(eye: HTMLCanvasElement) {
    super();
    this.sprite = new Sprite(Texture.from(paintLogo(eye)));
    this.sprite.anchor.set(0.5, 0.45);
    this.sprite.scale.set(0.78);
    this.addChild(this.sprite);
    this.scheduleGlitch();
    gsap.to(this.sprite.scale, { x: 0.8, y: 0.77, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  private scheduleGlitch(): void {
    gsap.delayedCall(4 + Math.random() * 5, () => {
      this.glitch();
      this.scheduleGlitch();
    });
  }

  /** Cartoon "boing" plus a short chromatic glitch. */
  glitch(power = 1): void {
    this.filters = [this.split];
    gsap.fromTo(this.sprite, { rotation: -0.04 * power }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' });
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
