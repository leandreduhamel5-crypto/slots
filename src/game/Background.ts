import { coverCanvas } from './assets';
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import gsap from 'gsap';
import { INK, goo, makeCanvas, seeded } from './art/painters';
import { COLORS } from './layout';

const W = 1920;
const H = 1080;
const LAMPS = [470, 960, 1450];
const PORTHOLES: [number, number][] = [
  [225, 470],
  [345, 470],
  [1575, 470],
  [1695, 470],
];

function ink(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function shape(ctx: CanvasRenderingContext2D, draw: () => void, fill: string, line = 6): void {
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  draw();
  ink(ctx, line);
}

function door(ctx: CanvasRenderingContext2D, x: number, w: number, top: number, bottom: number, bloody: boolean): void {
  // frame
  shape(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(x - 18, top - 18, w + 36, bottom - top + 18, [16, 16, 0, 0]);
  }, '#2b3a44', 7);
  for (const [dx, flip] of [
    [0, false],
    [w / 2, true],
  ] as [number, boolean][]) {
    const dw = w / 2;
    shape(ctx, () => {
      ctx.beginPath();
      ctx.rect(x + dx, top, dw, bottom - top);
    }, '#4b6370', 6);
    ctx.fillStyle = '#3a4f5a';
    ctx.fillRect(x + dx + (flip ? 4 : dw - 22), top + 4, 18, bottom - top - 8);
    ctx.fillStyle = '#6a8794';
    ctx.fillRect(x + dx + (flip ? dw - 14 : 8), top + 10, 6, bottom - top - 20);
    // porthole
    const cx = x + dx + dw / 2;
    const cy = top + 140;
    shape(ctx, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    }, '#9aa6b0', 6);
    shape(ctx, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    }, '#5a0b22', 5);
    ctx.fillStyle = '#ff3347';
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - 12, cy - 12, 8, 4, -0.7, 0, Math.PI * 2);
    ctx.fill();
    // push plate
    shape(ctx, () => {
      ctx.beginPath();
      ctx.roundRect(cx - 28, top + 250, 56, 18, 6);
    }, '#c9d3dc', 4);
    // kick plate
    shape(ctx, () => {
      ctx.beginPath();
      ctx.rect(x + dx + 10, bottom - 60, dw - 20, 44);
    }, '#2b3a44', 4);
  }
  if (bloody) {
    // handprint smear
    ctx.save();
    ctx.translate(x + w * 0.72, top + 300);
    ctx.rotate(0.2);
    shape(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
      for (const [fx, fy, fr] of [
        [-20, -34, 7],
        [-6, -42, 7],
        [8, -40, 7],
        [20, -30, 6],
        [28, 2, 6],
      ]) {
        ctx.moveTo(fx + fr, fy);
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      }
    }, '#b5122f', 4);
    ctx.restore();
    goo(ctx, x + w * 0.72, top + 320, 70, 5, '#b5122f', '#ff5a6a');
  }
}

function lamp(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, 150);
  ink(ctx, 6);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, 150);
  ctx.strokeStyle = '#3a3440';
  ctx.lineWidth = 2;
  ctx.stroke();
  shape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x - 20, 150);
    ctx.lineTo(x + 20, 150);
    ctx.lineTo(x + 70, 210);
    ctx.lineTo(x - 70, 210);
    ctx.closePath();
  }, '#3f5a52', 6);
  ctx.fillStyle = '#5d7e72';
  ctx.beginPath();
  ctx.moveTo(x - 16, 156);
  ctx.lineTo(x - 4, 156);
  ctx.lineTo(x - 40, 204);
  ctx.lineTo(x - 58, 204);
  ctx.closePath();
  ctx.fill();
  shape(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(x, 212, 26, 12, 0, 0, Math.PI * 2);
  }, '#fff1b0', 5);
}

function paintScene(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(W, H);
  const rnd = seeded(31);

  // wall
  ctx.fillStyle = '#35294a';
  ctx.fillRect(0, 0, W, 780);
  ctx.fillStyle = '#2d233f';
  for (let x = 0; x < W; x += 160) ctx.fillRect(x + 70, 140, 26, 400);
  // ceiling + pipes
  ctx.fillStyle = '#160f1c';
  ctx.fillRect(0, 0, W, 120);
  for (const [y, r, col] of [
    [56, 18, '#3a4a55'],
    [98, 12, '#4b3a2a'],
  ] as [number, number, string][]) {
    shape(ctx, () => {
      ctx.beginPath();
      ctx.roundRect(-20, y - r, W + 40, r * 2, r);
    }, col, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, y - r + 4, W, 4);
    for (let x = 120; x < W; x += 340) {
      shape(ctx, () => {
        ctx.beginPath();
        ctx.roundRect(x, y - r - 6, 26, r * 2 + 12, 6);
      }, '#5d7280', 5);
    }
  }
  // drip from a pipe
  goo(ctx, 812, 108, 60, 5, '#7be05a', '#d2ffb8');

  // wainscot tiles
  const ty = 540;
  ctx.fillStyle = '#1d3a46';
  ctx.fillRect(0, ty, W, 240);
  for (let y = ty; y < 780; y += 40) {
    for (let x = (y / 40) % 2 ? -30 : 0; x < W; x += 60) {
      ctx.fillStyle = rnd() < 0.5 ? '#2a5262' : '#264a59';
      ctx.fillRect(x + 3, y + 3, 54, 34);
    }
  }
  ctx.fillStyle = '#2b4a56';
  ctx.fillRect(0, ty - 14, W, 16);
  ctx.beginPath();
  ctx.moveTo(0, ty - 14);
  ctx.lineTo(W, ty - 14);
  ctx.moveTo(0, ty + 2);
  ctx.lineTo(W, ty + 2);
  ink(ctx, 5);

  // floor (perspective rows)
  ctx.fillStyle = '#17111d';
  ctx.fillRect(0, 780, W, H - 780);
  let y = 780;
  let rowH = 30;
  let row = 0;
  while (y < H) {
    const tw = rowH * 2.2;
    for (let x = row % 2 ? -tw / 2 : 0; x < W; x += tw) {
      ctx.fillStyle = (Math.floor(x / tw) + row) % 2 ? '#241c2c' : '#1b1522';
      ctx.fillRect(x, y, tw, rowH);
    }
    y += rowH;
    rowH *= 1.32;
    row++;
  }
  ctx.beginPath();
  ctx.moveTo(0, 780);
  ctx.lineTo(W, 780);
  ink(ctx, 7);

  door(ctx, 165, 240, 330, 780, false);
  door(ctx, 1515, 240, 330, 780, true);

  // SORTIE sign over the right door
  shape(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(1560, 262, 150, 50, 8);
  }, '#5a0b22', 6);
  ctx.font = '34px "Luckiest Guy", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5a6a';
  ctx.fillText('SORTIE', 1635, 290);

  // quarantine poster on the left
  ctx.save();
  ctx.translate(560, 330);
  ctx.rotate(-0.06);
  shape(ctx, () => {
    ctx.beginPath();
    ctx.rect(-80, -100, 160, 200);
  }, '#ffd23f', 6);
  ctx.fillStyle = INK;
  ctx.fillRect(-80, 50, 160, 50);
  ctx.font = '26px "Luckiest Guy", sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('QUARANTAINE', 0, 78);
  // biohazard
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 18, -24 + Math.sin(a) * 18, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -24, 8, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  // torn corner
  ctx.fillStyle = '#2b2236';
  ctx.beginPath();
  ctx.moveTo(80, -100);
  ctx.lineTo(40, -100);
  ctx.lineTo(80, -60);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // blood splats on the wall
  for (const [sx, sy, sr] of [
    [1330, 420, 40],
    [700, 610, 28],
    [1240, 680, 22],
  ]) {
    shape(ctx, () => {
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const r = sr * (i % 2 ? 0.7 : 1 + rnd() * 0.3);
        if (i === 0) ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
        else ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      }
      ctx.closePath();
    }, '#8e0f26', 5);
    goo(ctx, sx + 6, sy + sr * 0.6, sr * 1.4, 5, '#8e0f26', '#e0213a');
  }

  // wheelchair silhouette
  ctx.save();
  ctx.translate(1290, 900);
  shape(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.moveTo(150, 30);
    ctx.arc(120, 30, 30, 0, Math.PI * 2);
  }, '#100b14', 7);
  shape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-30, -150);
    ctx.lineTo(-10, -20);
    ctx.lineTo(120, -20);
    ctx.lineTo(130, 10);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-40, -150);
    ctx.closePath();
  }, '#211a28', 6);
  ctx.restore();

  for (const lx of LAMPS) lamp(ctx, lx);

  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H / 2, H);
  v.addColorStop(0, 'rgba(10,4,12,0)');
  v.addColorStop(1, 'rgba(10,4,12,0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return c;
}

/** Light cone under a hanging lamp. */
function paintCone(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(600, 900);
  const g = ctx.createLinearGradient(0, 0, 0, 900);
  g.addColorStop(0, 'rgba(255,241,176,0.55)');
  g.addColorStop(1, 'rgba(255,241,176,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(250, 0);
  ctx.lineTo(350, 0);
  ctx.lineTo(600, 900);
  ctx.lineTo(0, 900);
  ctx.closePath();
  ctx.fill();
  return c;
}

/** Tileable value-noise fog. */
function paintFog(size = 512): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const rnd = seeded(42);
  const octaves = [
    { cells: 4, amp: 0.55 },
    { cells: 8, amp: 0.28 },
    { cells: 16, amp: 0.17 },
  ];
  const grids = octaves.map((o) => Array.from({ length: o.cells * o.cells }, () => rnd()));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      octaves.forEach((o, k) => {
        const fx = (x / size) * o.cells;
        const fy = (y / size) * o.cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = smooth(fx - x0), ty = smooth(fy - y0);
        const g = grids[k];
        const at = (ix: number, iy: number) => g[(iy % o.cells) * o.cells + (ix % o.cells)];
        const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        v += (a * (1 - ty) + b * ty) * o.amp;
      });
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, Math.max(0, v - 0.4) * 2.4 * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

interface Spore {
  s: Sprite;
  vx: number;
  vy: number;
  phase: number;
}

export class Background extends Container {
  private sceneC = new Container();
  private scene: Sprite;
  private lampGlows: Sprite[] = [];
  private cones: Sprite[] = [];
  private portholes: Sprite[] = [];
  private blackout = new Graphics();
  private chains: Sprite[] = [];
  private chainFront = new Container();
  private redWash: Sprite;
  private fog: TilingSprite;
  private spores: Spore[] = [];
  private sporeLayer = new Container();
  private pulse = new Graphics();
  private t = 0;
  private feature = 0;
  private nextOutage = 7;
  private dark = 0;
  private w = W;
  private h = H;
  onLightning: (() => void) | null = null;

  constructor(
    private sporeTex: Texture,
    chainTex: Texture,
    glowTex: Texture,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    this.scene = new Sprite(Texture.from(custom ? coverCanvas(custom, W, H) : paintScene()));
    this.scene.anchor.set(0.5);
    this.sceneC.addChild(this.scene);
    const coneTex = Texture.from(paintCone());
    for (const lx of LAMPS) {
      const cone = new Sprite(coneTex);
      cone.anchor.set(0.5, 0);
      cone.position.set(lx - W / 2, 215 - H / 2);
      cone.blendMode = 'add';
      cone.alpha = 0.3;
      this.cones.push(cone);
      const g = new Sprite(glowTex);
      g.anchor.set(0.5);
      g.position.set(lx - W / 2, 212 - H / 2);
      g.width = g.height = 220;
      g.tint = 0xfff1b0;
      g.blendMode = 'add';
      cone.visible = g.visible = !custom;
      this.lampGlows.push(g);
      this.sceneC.addChild(cone, g);
    }
    for (const [px, py] of PORTHOLES) {
      const g = new Sprite(glowTex);
      g.anchor.set(0.5);
      g.position.set(px - W / 2, py - H / 2);
      g.width = g.height = 170;
      g.tint = COLORS.infection;
      g.blendMode = 'add';
      g.visible = !custom;
      this.portholes.push(g);
      this.sceneC.addChild(g);
    }
    this.blackout.rect(-W, -H, W * 2, H * 2).fill(0x05020a);
    this.blackout.alpha = 0;
    this.sceneC.addChild(this.blackout);

    this.redWash = new Sprite(sporeTex);
    this.redWash.anchor.set(0.5);
    this.redWash.tint = COLORS.infection;
    this.redWash.blendMode = 'add';
    this.redWash.alpha = 0;
    this.fog = new TilingSprite({ texture: Texture.from(paintFog()), width: W, height: H });
    this.fog.tint = 0x9a7aa8;
    this.fog.alpha = 0.1;

    for (const [x, len] of [
      [60, 700],
      [W - 60, 780],
    ]) {
      const c = new Sprite(chainTex);
      c.anchor.set(0.5, 0);
      c.position.set(x - W / 2, -H / 2 - 20);
      c.height = len;
      c.scale.x = c.scale.y;
      this.chains.push(c);
      this.chainFront.addChild(c);
    }

    this.addChild(this.sceneC, this.redWash, this.fog, this.sporeLayer, this.chainFront, this.pulse);
    for (let i = 0; i < 50; i++) this.spores.push(this.spawn(true));
  }

  private spawn(initial: boolean): Spore {
    const s = new Sprite(this.sporeTex);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.width = s.height = 3 + Math.random() * Math.random() * 12;
    s.tint = Math.random() < 0.75 ? COLORS.infection : 0xfff1b0;
    s.position.set(Math.random() * this.w, initial ? Math.random() * this.h : this.h + 20);
    this.sporeLayer.addChild(s);
    return { s, vx: (Math.random() - 0.5) * 10, vy: -(6 + Math.random() * 20), phase: Math.random() * 10 };
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const scale = Math.max(w / W, h / H);
    for (const c of [this.sceneC, this.chainFront]) {
      c.scale.set(scale);
      c.position.set(w / 2, h / 2);
    }
    this.redWash.position.set(w / 2, h * 0.45);
    this.redWash.width = w * 1.2;
    this.redWash.height = h * 1.2;
    this.fog.width = w;
    this.fog.height = h;
  }

  setFeature(on: boolean): void {
    gsap.to(this, { feature: on ? 1 : 0, duration: 1.2 });
  }

  /** Deceit-style power outage: lights die, flicker, come back. */
  flash(): void {
    const o = { d: 0 };
    gsap
      .timeline({ onUpdate: () => (this.dark = o.d) })
      .to(o, { d: 0.85, duration: 0.06 })
      .to(o, { d: 0.2, duration: 0.05 })
      .to(o, { d: 0.9, duration: 0.05 })
      .to(o, { d: 0.9, duration: 0.5 })
      .to(o, { d: 0.3, duration: 0.05 })
      .to(o, { d: 0.75, duration: 0.05 })
      .to(o, { d: 0, duration: 0.3 });
    this.onLightning?.();
  }

  thump(strength = 0.35): void {
    this.pulse.clear().rect(0, 0, this.w, this.h).fill({ color: COLORS.infection });
    this.pulse.blendMode = 'add';
    gsap.fromTo(this.pulse, { alpha: strength }, { alpha: 0, duration: 0.6, ease: 'power2.out' });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.t += dt;
    this.fog.tilePosition.x += dt * 12;
    this.fog.tilePosition.y += dt * 3;
    const beat = Math.pow(Math.max(0, Math.sin(this.t * (2.6 + this.feature * 1.6))), 12);
    this.redWash.alpha = this.feature * (0.14 + beat * 0.12);
    this.blackout.alpha = this.dark * 0.9;
    this.lampGlows.forEach((g, i) => {
      const flick = Math.sin(this.t * (13 + i * 3)) * Math.sin(this.t * (3.1 + i)) > 0.92 ? 0.25 : 1;
      const on = (1 - this.dark) * flick;
      g.alpha = 0.55 * on;
      this.cones[i].alpha = (0.4 + this.feature * 0.05) * on;
      this.cones[i].tint = this.feature > 0.5 ? 0xff9aa4 : 0xffffff;
    });
    this.portholes.forEach((g, i) => (g.alpha = 0.35 + 0.25 * Math.sin(this.t * 2 + i) + this.feature * 0.3 + beat * 0.2));
    this.chains.forEach((c, i) => (c.rotation = Math.sin(this.t * (0.6 + i * 0.13) + i) * 0.015));
    this.nextOutage -= dt;
    if (this.nextOutage <= 0) {
      this.nextOutage = 12 + Math.random() * 16;
      this.flash();
    }
    const speed = 1 + this.feature * 1.5;
    for (let i = 0; i < this.spores.length; i++) {
      const p = this.spores[i];
      p.s.x += (p.vx + Math.sin(this.t + p.phase) * 8) * dt * speed;
      p.s.y += p.vy * dt * speed;
      p.s.alpha = 0.3 + 0.4 * Math.abs(Math.sin(this.t * 1.7 + p.phase));
      if (p.s.y < -30 || p.s.x < -30 || p.s.x > this.w + 30) {
        p.s.destroy();
        this.spores[i] = this.spawn(false);
      }
    }
  }
}
