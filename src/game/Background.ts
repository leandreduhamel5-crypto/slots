import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import gsap from 'gsap';
import { COLORS } from './layout';

const W = 1920;
const H = 1080;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Ruined asylum hall: arched windows bleeding red light, brick wall, light shafts and vignette. */
function paintScene(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0d13');
  bg.addColorStop(0.6, '#07080c');
  bg.addColorStop(1, '#030304');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // bricks
  ctx.strokeStyle = 'rgba(120,130,150,0.05)';
  ctx.lineWidth = 2;
  for (let y = 0, row = 0; y < H; y += 38, row++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    for (let x = row % 2 ? 0 : 60; x < W; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 38);
      ctx.stroke();
    }
  }

  const windows = [250, 640, 1280, 1670];
  for (const wx of windows) {
    const ww = 190;
    const top = 120;
    const bottom = 760;
    const arch = (inset: number) => {
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2 + inset, bottom);
      ctx.lineTo(wx - ww / 2 + inset, top + ww / 2);
      ctx.quadraticCurveTo(wx - ww / 2 + inset, top + inset, wx, top - 30 + inset);
      ctx.quadraticCurveTo(wx + ww / 2 - inset, top + inset, wx + ww / 2 - inset, top + ww / 2);
      ctx.lineTo(wx + ww / 2 - inset, bottom);
      ctx.closePath();
    };
    // stone surround
    arch(-18);
    ctx.fillStyle = '#12151c';
    ctx.fill();
    arch(0);
    const glow = ctx.createLinearGradient(0, top, 0, bottom);
    glow.addColorStop(0, '#5a0614');
    glow.addColorStop(0.5, '#2a020a');
    glow.addColorStop(1, '#0c0103');
    ctx.fillStyle = glow;
    ctx.fill();
    // bars + cross
    ctx.save();
    arch(0);
    ctx.clip();
    ctx.fillStyle = '#05060a';
    for (let bx = wx - ww / 2 + 22; bx < wx + ww / 2; bx += 30) ctx.fillRect(bx, top - 40, 7, bottom - top + 40);
    ctx.fillRect(wx - ww / 2, top + 210, ww, 10);
    ctx.fillRect(wx - ww / 2, top + 420, ww, 10);
    ctx.restore();
  }

  // light shafts from the windows
  ctx.globalCompositeOperation = 'lighter';
  for (const wx of windows) {
    const g = ctx.createLinearGradient(wx, 200, wx + 140, 1080);
    g.addColorStop(0, 'rgba(255,42,61,0.10)');
    g.addColorStop(1, 'rgba(255,42,61,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(wx - 80, 200);
    ctx.lineTo(wx + 80, 200);
    ctx.lineTo(wx + 330, H);
    ctx.lineTo(wx - 40, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // floor
  const floor = ctx.createLinearGradient(0, 760, 0, H);
  floor.addColorStop(0, 'rgba(0,0,0,0)');
  floor.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 760, W, H - 760);

  // stains / blood splatters
  const rnd = seeded(7);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 6 + rnd() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(90,0,16,0.35)');
    g.addColorStop(1, 'rgba(90,0,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return c;
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
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
      const a = Math.max(0, v - 0.35) * 2.2;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
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
  life: number;
}

const WINDOWS = [250, 640, 1280, 1670];

export class Background extends Container {
  private sceneC = new Container();
  private scene: Sprite;
  private windowGlows: Sprite[] = [];
  private lightning: Sprite;
  private chains: Sprite[] = [];
  private nextFlash = 6;
  onLightning: (() => void) | null = null;
  private redWash: Sprite;
  private fogA: TilingSprite;
  private fogB: TilingSprite;
  private spores: Spore[] = [];
  private sporeLayer = new Container();
  private pulse = new Graphics();
  private t = 0;
  private feature = 0;

  constructor(
    private sporeTex: Texture,
    chainTex: Texture,
    glowTex: Texture,
  ) {
    super();
    this.scene = new Sprite(Texture.from(paintScene()));
    this.scene.anchor.set(0.5);
    this.sceneC.addChild(this.scene);
    for (const wx of WINDOWS) {
      const g = new Sprite(glowTex);
      g.anchor.set(0.5);
      g.position.set(wx - W / 2, 440 - H / 2);
      g.width = 420;
      g.height = 900;
      g.tint = COLORS.infection;
      g.blendMode = 'add';
      g.alpha = 0.25;
      this.windowGlows.push(g);
      this.sceneC.addChild(g);
    }
    this.lightning = new Sprite(glowTex);
    this.lightning.anchor.set(0.5);
    this.lightning.width = W * 1.6;
    this.lightning.height = H * 1.4;
    this.lightning.position.set(0, -H * 0.3);
    this.lightning.tint = 0xffc2c8;
    this.lightning.blendMode = 'add';
    this.lightning.alpha = 0;
    this.sceneC.addChild(this.lightning);
    this.redWash = new Sprite(sporeTex);
    this.redWash.anchor.set(0.5);
    this.redWash.tint = COLORS.infection;
    this.redWash.blendMode = 'add';
    this.redWash.alpha = 0.12;
    const fogTex = Texture.from(paintFog());
    this.fogA = new TilingSprite({ texture: fogTex, width: W, height: H });
    this.fogB = new TilingSprite({ texture: fogTex, width: W, height: H });
    this.fogA.tint = 0x8a96aa;
    this.fogB.tint = 0x6a2030;
    this.fogA.alpha = 0.16;
    this.fogB.alpha = 0.14;
    this.fogB.tileScale.set(1.6);
    const chainLayer = new Container();
    for (const [x, len, alpha] of [
      [70, 760, 0.95],
      [150, 520, 0.7],
      [W - 70, 820, 0.95],
      [W - 170, 460, 0.65],
    ]) {
      const c = new Sprite(chainTex);
      c.anchor.set(0.5, 0);
      c.position.set(x - W / 2, -H / 2 - 20);
      c.height = len;
      c.scale.x = c.scale.y;
      c.alpha = alpha;
      c.tint = 0x9aa3b5;
      this.chains.push(c);
      chainLayer.addChild(c);
    }
    const front = new Container();
    front.addChild(chainLayer);
    this.chainFront = front;
    this.addChild(this.sceneC, this.redWash, this.fogA, this.sporeLayer, this.fogB, front, this.pulse);

    for (let i = 0; i < 80; i++) this.spores.push(this.spawn(true));
  }

  private spawn(initial: boolean): Spore {
    const s = new Sprite(this.sporeTex);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    const size = 3 + Math.random() * Math.random() * 16;
    s.width = s.height = size;
    s.tint = Math.random() < 0.8 ? COLORS.infection : 0xe9dfc9;
    s.position.set(Math.random() * this.w, initial ? Math.random() * this.h : this.h + 20);
    this.sporeLayer.addChild(s);
    return { s, vx: (Math.random() - 0.5) * 12, vy: -(8 + Math.random() * 28), phase: Math.random() * 10, life: 0 };
  }

  private w = W;
  private h = H;

  private chainFront: Container;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const scale = Math.max(w / W, h / H);
    this.sceneC.scale.set(scale);
    this.sceneC.position.set(w / 2, h / 2);
    this.chainFront.scale.set(scale);
    this.chainFront.position.set(w / 2, h / 2);
    this.redWash.position.set(w / 2, h * 0.45);
    this.redWash.width = w * 1.1;
    this.redWash.height = h * 1.1;
    for (const f of [this.fogA, this.fogB]) {
      f.width = w;
      f.height = h;
    }
  }

  setFeature(on: boolean): void {
    gsap.to(this, { feature: on ? 1 : 0, duration: 1.2 });
  }

  /** Distant lightning behind the windows: two quick flickers. */
  flash(): void {
    gsap.killTweensOf(this.lightning);
    gsap
      .timeline()
      .to(this.lightning, { alpha: 0.5, duration: 0.05 })
      .to(this.lightning, { alpha: 0.1, duration: 0.08 })
      .to(this.lightning, { alpha: 0.7, duration: 0.04 })
      .to(this.lightning, { alpha: 0, duration: 0.9, ease: 'power2.out' });
    this.onLightning?.();
  }

  /** Big red heartbeat flash. */
  thump(strength = 0.35): void {
    this.pulse.clear().rect(0, 0, this.w, this.h).fill({ color: COLORS.infection });
    this.pulse.blendMode = 'add';
    gsap.fromTo(this.pulse, { alpha: strength }, { alpha: 0, duration: 0.6, ease: 'power2.out' });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.t += dt;
    this.fogA.tilePosition.x += dt * 14;
    this.fogA.tilePosition.y += dt * 3;
    this.fogB.tilePosition.x -= dt * 22;
    this.fogB.tilePosition.y += dt * 6;
    const beat = Math.pow(Math.max(0, Math.sin(this.t * (2.6 + this.feature * 1.6))), 12);
    this.redWash.alpha = 0.08 + this.feature * 0.16 + beat * (0.05 + this.feature * 0.1);
    this.fogB.alpha = 0.12 + this.feature * 0.12;
    for (let i = 0; i < this.windowGlows.length; i++) {
      const flicker = 0.5 + 0.5 * Math.sin(this.t * (7 + i * 1.3) + i * 2) * Math.sin(this.t * (2.3 + i) + i);
      this.windowGlows[i].alpha = 0.16 + this.feature * 0.2 + flicker * 0.1 + beat * 0.08;
    }
    this.chains.forEach((c, i) => (c.rotation = Math.sin(this.t * (0.6 + i * 0.13) + i) * 0.015));
    this.nextFlash -= dt;
    if (this.nextFlash <= 0) {
      this.nextFlash = 9 + Math.random() * 14;
      this.flash();
    }
    const speed = 1 + this.feature * 1.5;
    for (let i = 0; i < this.spores.length; i++) {
      const p = this.spores[i];
      p.life += dt;
      p.s.x += (p.vx + Math.sin(this.t + p.phase) * 10) * dt * speed;
      p.s.y += p.vy * dt * speed;
      p.s.alpha = 0.35 + 0.45 * Math.abs(Math.sin(this.t * 1.7 + p.phase));
      if (p.s.y < -30 || p.s.x < -30 || p.s.x > this.w + 30) {
        p.s.destroy();
        this.spores[i] = this.spawn(false);
      }
    }
  }
}
