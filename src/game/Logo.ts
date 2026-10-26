import { Container, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';
import { INK, MATERIALS, makeCanvas, render3DText, seeded } from './art/painters';

/** Jagged blood splash behind the title, with a glossy gradient and ink rim. */
function splash(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  const rnd = seeded(seed);
  const pts: [number, number][] = [];
  const n = 30;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spike = i % 2 ? 0.74 + rnd() * 0.12 : 1 + rnd() * 0.26;
    pts.push([cx + Math.cos(a) * rx * spike, cy + Math.sin(a) * ry * spike]);
  }
  const path = () => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  path();
  ctx.lineWidth = 22;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#d4102c';
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, '#5a2a66');
  g.addColorStop(0.5, '#2e1538');
  g.addColorStop(1, '#170b1c');
  path();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.2, cy - ry * 0.55, rx * 0.7, ry * 0.3, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 1.15 + rnd() * 0.3;
    const r = 6 + rnd() * 12;
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#d4102c';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function paintLogo(eye: HTMLCanvasElement): HTMLCanvasElement {
  const w = 1100;
  const h = 360;
  const [c, ctx] = makeCanvas(w, h);
  splash(ctx, w / 2, 126, 345, 100, 11);

  // CODEX — big bone 3D letters, each tilted and bounced
  const word = 'CODEX';
  const size = 182;
  const rot = [-0.08, 0.05, -0.03, 0.06, -0.06];
  const dy = [10, -8, 4, -10, 8];
  const letters = [...word].map((ch, i) =>
    render3DText(ch, { size, material: MATERIALS.bone, depth: 16, ink: 13, coat: { colors: ['#ff6a7a', '#d4102c', '#7a0418'], height: size * 0.17, seed: 31 + i * 7 } }),
  );
  const advance = letters.map((l) => l.width - 54);
  const total = advance.reduce((a, b) => a + b, 0);
  let x = w / 2 - total / 2;
  letters.forEach((l, i) => {
    const cx = x + advance[i] / 2;
    const cy = 128 + dy[i];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot[i]);
    ctx.drawImage(l, -l.width / 2, -l.height / 2);
    ctx.restore();
    x += advance[i];
  });

  // ribbon with INFECTA
  const rw = 560;
  const ry = 286;
  const rh = 74;
  const ribbonEnd = (dir: number) => {
    const x0 = w / 2 + dir * (rw / 2 - 24);
    ctx.beginPath();
    ctx.moveTo(x0, ry - rh / 2 + 14);
    ctx.lineTo(x0 + dir * 80, ry - rh / 2 + 14);
    ctx.lineTo(x0 + dir * 52, ry + 10);
    ctx.lineTo(x0 + dir * 80, ry + rh / 2 + 14);
    ctx.lineTo(x0, ry + rh / 2 + 14);
    ctx.closePath();
    ctx.lineWidth = 9;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = '#4a0718';
    ctx.fill();
  };
  ribbonEnd(-1);
  ribbonEnd(1);
  const band = () => {
    ctx.beginPath();
    ctx.moveTo(w / 2 - rw / 2, ry - rh / 2);
    ctx.quadraticCurveTo(w / 2, ry - rh / 2 - 16, w / 2 + rw / 2, ry - rh / 2);
    ctx.lineTo(w / 2 + rw / 2, ry + rh / 2);
    ctx.quadraticCurveTo(w / 2, ry + rh / 2 - 16, w / 2 - rw / 2, ry + rh / 2);
    ctx.closePath();
  };
  band();
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const bg = ctx.createLinearGradient(0, ry - rh / 2, 0, ry + rh / 2);
  bg.addColorStop(0, '#4a2a55');
  bg.addColorStop(0.5, '#2a1530');
  bg.addColorStop(1, '#180a1c');
  band();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w / 2 - rw / 2 + 14, ry - rh / 2 + 10);
  ctx.quadraticCurveTo(w / 2, ry - rh / 2 - 4, w / 2 + rw / 2 - 14, ry - rh / 2 + 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // stitches along the ribbon
  ctx.setLineDash([10, 9]);
  ctx.strokeStyle = 'rgba(255,210,63,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2 - rw / 2 + 16, ry + rh / 2 - 10);
  ctx.quadraticCurveTo(w / 2, ry + rh / 2 - 24, w / 2 + rw / 2 - 16, ry + rh / 2 - 10);
  ctx.stroke();
  ctx.setLineDash([]);

  const sub = render3DText('INFECTA', { size: 60, material: MATERIALS.blood, depth: 6, ink: 7 });
  ctx.drawImage(sub, w / 2 - sub.width / 2, ry - sub.height / 2 - 4);
  for (const dir of [-1, 1]) {
    const ex = w / 2 + dir * (sub.width / 2 + 18);
    ctx.drawImage(eye, ex - 32, ry - 34, 64, 64);
  }
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

export class Logo extends Container {
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
  private sprite: Sprite;

  constructor(art: HTMLCanvasElement) {
    super();
    this.sprite = new Sprite(Texture.from(art));
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
