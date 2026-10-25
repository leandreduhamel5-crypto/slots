import { Container, Sprite, Texture } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import gsap from 'gsap';

function paintLogo(eye: HTMLCanvasElement): HTMLCanvasElement {
  const w = 1100;
  const h = 250;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // CODEX — cracked bone
  ctx.font = '900 132px Cinzel, serif';
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px';
  const g = ctx.createLinearGradient(0, 30, 0, 170);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(0.5, '#d8c9a8');
  g.addColorStop(1, '#5c4a30');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#050304';
  ctx.strokeText('CODEX', w / 2, 100);
  ctx.save();
  ctx.shadowColor = 'rgba(255,42,61,0.9)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = g;
  ctx.fillText('CODEX', w / 2, 100);
  ctx.restore();
  ctx.fillStyle = g;
  ctx.fillText('CODEX', w / 2, 100);
  // cracks on the letters
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = 'rgba(20,4,6,0.85)';
  ctx.lineWidth = 2;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 18; i++) {
    let x = 260 + rnd() * 580;
    let y = 50 + rnd() * 100;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * 40;
      y += (rnd() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // INFECTA — glowing red with flanking rules
  ctx.font = '700 54px Cinzel, serif';
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '26px';
  ctx.save();
  ctx.shadowColor = '#ff2a3d';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ff3448';
  ctx.fillText('INFECTA', w / 2 + 13, 200);
  ctx.restore();
  ctx.fillStyle = '#ffd0d4';
  ctx.globalAlpha = 0.35;
  ctx.fillText('INFECTA', w / 2 + 13, 198);
  ctx.globalAlpha = 1;

  // rules ending in an infected eye on each side of the word
  const half = ctx.measureText('INFECTA').width / 2;
  const eyeW = 64;
  const gap = 26;
  ctx.strokeStyle = 'rgba(255,42,61,0.7)';
  ctx.lineWidth = 2;
  for (const dir of [-1, 1]) {
    const ex = w / 2 + dir * (half + gap + eyeW / 2);
    ctx.beginPath();
    ctx.moveTo(ex + dir * (eyeW / 2 + 8), 200);
    ctx.lineTo(ex + dir * (eyeW / 2 + 190), 200);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = '#ff2a3d';
    ctx.shadowBlur = 18;
    ctx.drawImage(eye, ex - eyeW / 2, 200 - eyeW / 2, eyeW, eyeW);
    ctx.restore();
  }
  return c;
}

export class Logo extends Container {
  private split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });

  constructor(eye: HTMLCanvasElement) {
    super();
    const s = new Sprite(Texture.from(paintLogo(eye)));
    s.anchor.set(0.5);
    s.scale.set(0.82);
    this.addChild(s);
    this.scheduleGlitch();
    gsap.to(s.scale, { x: 0.835, y: 0.835, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  private scheduleGlitch(): void {
    gsap.delayedCall(3 + Math.random() * 5, () => {
      this.glitch();
      this.scheduleGlitch();
    });
  }

  glitch(power = 1): void {
    this.filters = [this.split];
    const tl = gsap.timeline();
    for (let i = 0; i < 6; i++) {
      tl.add(() => {
        const j = () => (Math.random() - 0.5) * 14 * power;
        this.split.red = { x: j(), y: j() / 3 };
        this.split.blue = { x: j(), y: j() / 3 };
        this.x += (Math.random() - 0.5) * 6 * power;
      });
      tl.to({}, { duration: 0.04 });
    }
    tl.add(() => {
      this.split.red = { x: 0, y: 0 };
      this.split.blue = { x: 0, y: 0 };
      this.x = this.homeX;
      this.filters = [];
    });
  }

  homeX = 0;
}

/** Cuts the iris out of the codex symbol art for the logo. */
export function eyeFromCodex(codex: HTMLImageElement | HTMLCanvasElement, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 120;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.ellipse(60, 60, 58, 34, 0, 0, Math.PI * 2);
  ctx.clip();
  const scale = size / 256;
  ctx.drawImage(codex, 86 * scale, 86 * scale, 84 * scale, 84 * scale, 0, 0, 120, 120);
  return c;
}
