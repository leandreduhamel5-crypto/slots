import { coverCanvas } from './assets';
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { GodrayFilter } from 'pixi-filters';
import gsap from 'gsap';
import { makeCanvas, seeded } from './art/painters';
import { H, W, paintScene } from './art/scene';
import { COLORS } from './layout';

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
  private heart: Sprite | null = null;
  /** volumetric light shafts slanting down through the corridor */
  private rays = new GodrayFilter({ angle: 22, parallel: true, gain: 0.42, lacunarity: 2.6, alpha: 0.32 });
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
    glowTex: Texture,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    const painted = custom ? null : paintScene();
    this.scene = new Sprite(Texture.from(custom ? coverCanvas(custom, W, H) : painted!.canvas));
    this.scene.anchor.set(0.5);
    this.sceneC.addChild(this.scene);
    if (painted) {
      // the infection's heart pulsing at the end of the corridor
      this.heart = new Sprite(glowTex);
      this.heart.anchor.set(0.5);
      this.heart.position.set(painted.heart[0] - W / 2, painted.heart[1] - H / 2 - 120);
      this.heart.width = 760;
      this.heart.height = 560;
      this.heart.tint = COLORS.infection;
      this.heart.blendMode = 'add';
      this.sceneC.addChild(this.heart);
      const coneTex = Texture.from(paintCone());
      for (const [lx, ly] of painted.lamps) {
        const cone = new Sprite(coneTex);
        cone.anchor.set(0.5, 0);
        cone.position.set(lx - W / 2, ly - H / 2);
        cone.scale.set(0.85);
        cone.blendMode = 'add';
        cone.alpha = 0.3;
        this.cones.push(cone);
        const g = new Sprite(glowTex);
        g.anchor.set(0.5);
        g.position.set(lx - W / 2, ly - H / 2);
        g.width = g.height = 200;
        g.tint = 0xfff1b0;
        g.blendMode = 'add';
        this.lampGlows.push(g);
        this.sceneC.addChild(cone, g);
      }
      for (const [px, py] of painted.portholes) {
        const g = new Sprite(glowTex);
        g.anchor.set(0.5);
        g.position.set(px - W / 2, py - H / 2);
        g.width = g.height = 150;
        g.tint = COLORS.infection;
        g.blendMode = 'add';
        this.portholes.push(g);
        this.sceneC.addChild(g);
      }
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

    this.addChild(this.sceneC, this.redWash, this.fog, this.sporeLayer, this.pulse);
    this.rays.resolution = 0.5;
    this.sceneC.filters = [this.rays];
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
    this.sceneC.scale.set(scale);
    this.sceneC.position.set(w / 2, h / 2);
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
    this.rays.time += dt * 0.25;
    this.rays.alpha = (0.32 + this.feature * 0.1) * (1 - this.dark);
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
    if (this.heart) this.heart.alpha = (0.35 + beat * 0.35 + this.feature * 0.25) * (1 - this.dark * 0.6);
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
