import { coverCanvas } from './assets';
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { GodrayFilter } from 'pixi-filters';
import gsap from 'gsap';
import { makeCanvas, seeded } from './art/painters';
import { APEX, BRAZIERS, HORIZON, MOON, OBELISKS, OBELISK_TIP_Y, PYRAMID_HALF, RS, TH as H, TW as W } from './art/templeHD';
import { Fire, paintFlameBlob } from './Fire';
import { TempleFx } from './TempleFx';
import { COLORS } from './layout';

/** Soft disc for the spreading-infection mask: opaque core, feathered rim. */
function revealCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.72, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
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

/** Wispy clouds, tileable horizontally, fading out toward the horizon. */
function paintClouds(w = 512, h = 256): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const rnd = seeded(77);
  const octaves = [
    { cx: 3, cy: 2, amp: 0.5 },
    { cx: 6, cy: 4, amp: 0.27 },
    { cx: 12, cy: 8, amp: 0.15 },
    { cx: 24, cy: 16, amp: 0.08 },
  ];
  const grids = octaves.map((o) => Array.from({ length: o.cx * (o.cy + 1) }, () => rnd()));
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      octaves.forEach((o, k) => {
        const fx = (x / w) * o.cx;
        const fy = (y / h) * o.cy;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = sm(fx - x0), ty = sm(fy - y0);
        const g = grids[k];
        const at = (ix: number, iy: number) => g[iy * o.cx + (ix % o.cx)];
        const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        v += (a * (1 - ty) + b * ty) * o.amp;
      });
      const fade = Math.sin((y / h) * Math.PI);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.max(0, Math.min(1, (v - 0.48) * 3.2)) * fade * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** A soft ring of light around the moon (clear centre so the disc keeps its detail). */
function paintHaloRing(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.3, 'rgba(255,255,255,0)');
  g.addColorStop(0.36, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}

/** Is this point open sky (not behind the pyramid, an obelisk or the moon)? */
function openSky(x: number, y: number): boolean {
  if (y > HORIZON - 120) return false;
  const slope = APEX[1] + ((HORIZON - APEX[1]) * Math.abs(x - APEX[0])) / PYRAMID_HALF;
  if (y > slope - 24) return false;
  for (const ox of OBELISKS) if (Math.abs(x - ox) < 80) return false;
  return Math.hypot(x - MOON[0], y - MOON[1]) > MOON[2] + 30;
}

type Pt = [number, number];

/** Jagged lightning path by midpoint displacement. */
function boltPath(a: Pt, b: Pt, rough: number): Pt[] {
  let pts: Pt[] = [a, b];
  let disp = Math.hypot(b[0] - a[0], b[1] - a[1]) * rough;
  for (let k = 0; k < 6; k++) {
    const next: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const off = (Math.random() - 0.5) * disp;
      next.push([(x0 + x1) / 2 + (-(y1 - y0) / len) * off, (y0 + y1) / 2 + ((x1 - x0) / len) * off], pts[i + 1]);
    }
    pts = next;
    disp *= 0.55;
  }
  return pts;
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
  /** the same temple, infected: crossfaded in for the free spins */
  private infected: Sprite | null = null;
  /** additive copy of the infected art: makes its cracks throb with the beat */
  private infectedPulse: Sprite | null = null;
  private lampGlows: Sprite[] = [];
  private tips: Sprite[] = [];
  private heart: Sprite | null = null;
  private flareV = 0;
  private bolts = new Graphics();
  private boltLight = 0;
  private rays = new GodrayFilter({ angle: 24, parallel: true, gain: 0.4, lacunarity: 2.6, alpha: 0.28 });
  private redWash: Sprite;
  private fog: TilingSprite;
  private spores: Spore[] = [];
  private sporeLayer = new Container();
  private pulse = new Graphics();
  private t = 0;
  private feature = 0;
  private nextStrike = 9;
  templeFx: TempleFx | null = null;
  /** soft circle growing from the capstone: the infection spreading over the night scene */
  private reveal: Sprite | null = null;
  private spread = { r: 0 };
  private groundFog: TilingSprite | null = null;
  private fires: Fire[] = [];
  private stars: { s: Sprite; f: number; p: number; a: number }[] = [];
  private clouds: TilingSprite | null = null;
  private moonHalo: Sprite | null = null;
  private meteor: Sprite;
  private nextMeteor = 6;
  private w = W;
  private h = H;
  /** called on every lightning strike with its power (0.3 distant … 1 direct hit) */
  onLightning: ((power: number) => void) | null = null;

  constructor(
    private sporeTex: Texture,
    glowTex: Texture,
    night: HTMLImageElement,
    infected: HTMLImageElement,
    custom: HTMLImageElement | null = null,
  ) {
    super();
    // the temple is a 3D scene rendered offline in two states (art/temple3d.ts); live lights, lightning and fire go on top
    this.scene = new Sprite(Texture.from(custom ? coverCanvas(custom, W, H) : night));
    this.scene.anchor.set(0.5);
    if (!custom) this.scene.scale.set(1 / RS);
    this.sceneC.addChild(this.scene);
    const flameTex = Texture.from(paintFlameBlob());
    if (!custom) {
      const tex = Texture.from(infected);
      this.infected = new Sprite(tex);
      this.infectedPulse = new Sprite(tex);
      for (const s of [this.infected, this.infectedPulse]) {
        s.anchor.set(0.5);
        s.scale.set(1 / RS);
        s.alpha = 0;
      }
      this.infectedPulse.blendMode = 'add';
      this.reveal = new Sprite(Texture.from(revealCanvas()));
      this.reveal.anchor.set(0.5);
      this.reveal.position.set(APEX[0] - W / 2, APEX[1] - H / 2);
      this.reveal.renderable = true;
      this.sceneC.addChild(this.infected, this.infectedPulse, this.reveal);
      this.infected.mask = this.reveal;
      // low mist drifting over the polished floor
      this.groundFog = new TilingSprite({ texture: Texture.from(paintFog()), width: W * 1.2, height: 260 });
      this.groundFog.position.set(-W * 0.6, H / 2 - 330);
      this.groundFog.tileScale.set(2.2, 0.7);
      this.groundFog.alpha = 0.16;

      // the capstone: a lighthouse of gold at night, the infection's heart in the bonus
      this.heart = new Sprite(glowTex);
      this.heart.anchor.set(0.5);
      this.heart.position.set(APEX[0] - W / 2, APEX[1] + 12 - H / 2);
      this.heart.blendMode = 'add';
      this.sceneC.addChild(this.heart);
      // twinkling stars in the open sky
      for (let i = 0; i < 60; i++) {
        let x = 0;
        let y = 0;
        for (let k = 0; k < 20; k++) {
          x = Math.random() * W;
          y = Math.random() * (HORIZON - 160);
          if (openSky(x, y)) break;
        }
        if (!openSky(x, y)) continue;
        const st = new Sprite(glowTex);
        st.anchor.set(0.5);
        st.position.set(x - W / 2, y - H / 2);
        st.scale.set((3 + Math.random() * Math.random() * 9) / 256);
        st.blendMode = 'add';
        st.tint = Math.random() < 0.7 ? 0xfff2d8 : 0xbcd0ff;
        this.stars.push({ s: st, f: 0.6 + Math.random() * 2.4, p: Math.random() * 10, a: 0.4 + Math.random() * 0.6 });
        this.sceneC.addChild(st);
      }
      this.moonHalo = new Sprite(Texture.from(paintHaloRing()));
      this.moonHalo.anchor.set(0.5);
      this.moonHalo.position.set(MOON[0] - W / 2, MOON[1] - H / 2);
      this.moonHalo.blendMode = 'add';
      this.sceneC.addChild(this.moonHalo);
      // slow clouds drifting across the sky
      this.clouds = new TilingSprite({ texture: Texture.from(paintClouds()), width: W, height: 560 });
      this.clouds.position.set(-W / 2, -H / 2 - 40);
      this.clouds.tileScale.set(2.2, 2.2);
      this.sceneC.addChild(this.clouds);
      for (const [lx, ly] of BRAZIERS) {
        const g = new Sprite(glowTex);
        g.anchor.set(0.5);
        g.position.set(lx - W / 2, ly - 60 - H / 2);
        g.width = g.height = 300;
        g.tint = 0xff8a2a;
        g.blendMode = 'add';
        this.lampGlows.push(g);
        const fire = new Fire(flameTex, glowTex, 150);
        fire.position.set(lx - W / 2, ly - H / 2);
        this.fires.push(fire);
        this.sceneC.addChild(g, fire);
      }
      // the obelisks' gold pyramidions catch the light
      for (const x of OBELISKS) {
        const g = new Sprite(glowTex);
        g.anchor.set(0.5);
        g.position.set(x - W / 2, OBELISK_TIP_Y + 24 - H / 2);
        g.width = g.height = 180;
        g.blendMode = 'add';
        this.tips.push(g);
        this.sceneC.addChild(g);
      }
    }
    if (this.groundFog) this.sceneC.addChild(this.groundFog);
    if (!custom) {
      this.templeFx = new TempleFx(glowTex);
      this.templeFx.onCharge = (p) => this.flare(p * 0.5);
      this.sceneC.addChild(this.templeFx);
    }
    this.bolts.blendMode = 'add';
    this.meteor = new Sprite(glowTex);
    this.meteor.anchor.set(0.92, 0.5);
    this.meteor.blendMode = 'add';
    this.meteor.visible = false;
    this.sceneC.addChild(this.bolts, this.meteor);

    this.redWash = new Sprite(sporeTex);
    this.redWash.anchor.set(0.5);
    this.redWash.tint = COLORS.infection;
    this.redWash.blendMode = 'add';
    this.redWash.alpha = 0;
    this.fog = new TilingSprite({ texture: Texture.from(paintFog()), width: W, height: H });
    this.fog.tint = 0x6a5070;
    this.fog.alpha = 0.07;

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
    // drifting sand glints at night, embers of the infection in the bonus
    s.tint = this.feature > 0.5 ? (Math.random() < 0.8 ? COLORS.infection : 0xffb080) : Math.random() < 0.7 ? 0xffd890 : 0xff7a3a;
    s.position.set(Math.random() * this.w, initial ? Math.random() * this.h : this.h + 20);
    this.sporeLayer.addChild(s);
    return { s, vx: (Math.random() - 0.5) * 10, vy: -(6 + Math.random() * 20), phase: Math.random() * 10 };
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.applyCamera();
    this.redWash.position.set(w / 2, h * 0.45);
    this.redWash.width = w * 1.2;
    this.redWash.height = h * 1.2;
    this.fog.width = w;
    this.fog.height = h;
  }

  /** camera dolly: k = zoom factor, focus = the art point that stays put while zooming in */
  readonly camera = { k: 1, fx: APEX[0], fy: 430 };

  private applyCamera(): void {
    const base = Math.max(this.w / W, this.h / H);
    const s = base * this.camera.k;
    const f = [this.camera.fx - W / 2, this.camera.fy - H / 2];
    this.sceneC.scale.set(s);
    this.sceneC.position.set(this.w / 2 - f[0] * (s - base), this.h / 2 - f[1] * (s - base));
  }

  /** Dolly the camera into (k > 1) or back out of the pyramid. */
  zoomTo(k: number, duration: number, ease = 'power3.in'): Promise<void> {
    return new Promise((r) => gsap.to(this.camera, { k, duration, ease, onUpdate: () => this.applyCamera(), onComplete: r }));
  }

  /** Free spins: the pyramid turns red under a barrage of lightning. */
  setFeature(on: boolean): void {
    gsap.to(this, { feature: on ? 1 : 0, duration: on ? 0.9 : 1.6, ease: 'power2.inOut' });
    // the infection spreads outward from the capstone (and recedes back into it)
    gsap.killTweensOf(this.spread);
    gsap.to(this.spread, { r: on ? 1 : 0, duration: on ? 1.6 : 1.4, ease: on ? 'power2.in' : 'power2.inOut' });
    if (on) {
      this.strike(1, APEX);
      this.templeFx?.surge(1);
      gsap.delayedCall(0.35, () => this.strike(0.8));
      gsap.delayedCall(0.8, () => this.strike(0.9));
      this.nextStrike = 3;
    }
  }

  /** A lightning strike; without a target it hits the pyramid somewhere along its slopes. */
  strike(power = 1, target?: Pt): void {
    const [ax, ay] = APEX;
    let to: Pt;
    const r = Math.random();
    if (target) to = target;
    else if (r < 0.3) to = [ax, ay + 10];
    else if (r < 0.55) {
      // the obelisks' gold tips act as lightning rods
      to = [OBELISKS[Math.random() < 0.5 ? 0 : 1], OBELISK_TIP_Y];
    } else {
      // somewhere on the slopes left visible beside the reels
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = ax + side * (540 + Math.random() * 360);
      to = [x, ay + ((HORIZON - ay) * Math.abs(x - ax)) / PYRAMID_HALF];
    }
    const from: Pt = [to[0] + (Math.random() - 0.5) * 500, -40];
    const main = boltPath(from, to, 0.28);
    const g = this.bolts;
    g.clear();
    const stroke = (pts: Pt[], scale: number) => {
      for (const [w, color, alpha] of [[34, 0xff2020, 0.2], [13, 0xff5a50, 0.5], [5, 0xffc0b0, 0.95], [2.2, 0xffffff, 1]] as const) {
        g.moveTo(pts[0][0] - W / 2, pts[0][1] - H / 2);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] - W / 2, pts[i][1] - H / 2);
        g.stroke({ width: w * scale, color, alpha, cap: 'round', join: 'round' });
      }
    };
    stroke(main, power);
    // forks peel off the main channel
    for (let k = 0; k < 3 + Math.floor(power * 3); k++) {
      const i = 6 + Math.floor(Math.random() * (main.length * 0.7));
      const p = main[Math.min(i, main.length - 2)];
      const len = 80 + Math.random() * 200 * power;
      const ang = Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      stroke(boltPath(p, [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len], 0.35), power * 0.45);
    }
    // impact: a burst of light where it lands
    g.circle(to[0] - W / 2, to[1] - H / 2, 60 * power).fill({ color: 0xff6a5a, alpha: 0.35 });
    g.circle(to[0] - W / 2, to[1] - H / 2, 18 * power).fill({ color: 0xffffff, alpha: 0.9 });
    const o = { v: 1 };
    gsap.killTweensOf(this.bolts);
    gsap
      .timeline({ onUpdate: () => ((this.bolts.alpha = o.v), (this.boltLight = o.v * power)) })
      .set(o, { v: 1 })
      .to(o, { v: 0.15, duration: 0.05 })
      .to(o, { v: 1, duration: 0.03 })
      .to(o, { v: 0.4, duration: 0.07 })
      .to(o, { v: 0.9, duration: 0.03 })
      .to(o, { v: 0, duration: 0.45, ease: 'power2.in' });
    // the whole sky flashes
    this.pulse.clear().rect(0, 0, this.w, this.h).fill({ color: 0xffd0c8 });
    this.pulse.blendMode = 'add';
    gsap.fromTo(this.pulse, { alpha: 0.28 * power }, { alpha: 0, duration: 0.5, ease: 'power3.out' });
    this.flare(0.6 * power);
    this.onLightning?.(power);
  }

  /** Kept for callers: a dramatic strike on the capstone. */
  flash(): void {
    this.strike(0.9, [APEX[0], APEX[1] + 10]);
  }

  /** The temple answers a win: the capstone blazes, braziers roar, light shafts brighten. */
  flare(power = 0.6): void {
    if (power >= 0.6 && this.flareV < 0.5) this.templeFx?.surge(power);
    this.flareV = Math.max(this.flareV, power);
    for (const fire of this.fires) fire.roar(power);
  }

  thump(strength = 0.35): void {
    this.flare(strength * 2);
    this.pulse.clear().rect(0, 0, this.w, this.h).fill({ color: COLORS.infection });
    this.pulse.blendMode = 'add';
    gsap.fromTo(this.pulse, { alpha: strength }, { alpha: 0, duration: 0.6, ease: 'power2.out' });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.t += dt;
    const f = this.feature;
    const beat = Math.pow(Math.max(0, Math.sin(this.t * (2.6 + f * 1.6))), 12);
    this.rays.time += dt * 0.25;
    this.rays.alpha = Math.min(0.48, 0.26 + f * 0.1 + this.flareV * 0.15 + this.boltLight * 0.2);
    this.fog.tilePosition.x += dt * 12;
    this.fog.tilePosition.y += dt * 3;
    this.fog.tint = f > 0.5 ? 0xa02030 : 0x6a5070;
    this.fog.alpha = 0.07 + f * 0.05;
    this.redWash.alpha = f * (0.1 + beat * 0.1);
    if (this.infected && this.infectedPulse) {
      this.infected.alpha = Math.min(1, f * 3);
      if (this.reveal) {
        // the mask texture fades to transparent at its rim: scale so it covers the screen at r=1
        const size = 80 + this.spread.r * 5200;
        this.reveal.width = this.reveal.height = size;
      }
      this.infectedPulse.alpha = f * (beat * 0.22 + this.boltLight * 0.5 + this.flareV * 0.25);
    }
    this.flareV *= Math.pow(0.25, dt);
    this.lampGlows.forEach((g, i) => {
      const flick = 0.75 + 0.25 * Math.sin(this.t * (11 + i * 2.3)) * Math.sin(this.t * (4.7 + i));
      g.alpha = Math.min(1, 0.6 * flick + this.flareV * 0.5);
      g.tint = f > 0.5 ? 0xff3a2a : 0xff8a2a;
      g.scale.y = g.scale.x * (1 + 0.1 * Math.sin(this.t * 9 + i));
    });
    this.tips.forEach((g, i) => {
      g.alpha = 0.3 + 0.12 * Math.sin(this.t * 1.3 + i * 2) + this.flareV * 0.6 + this.boltLight * 0.5;
      g.tint = f > 0.5 ? 0xff3030 : 0xffc870;
    });
    if (this.heart) {
      this.heart.alpha = Math.min(1, 0.4 + beat * 0.3 * f + f * 0.3 + this.flareV + this.boltLight);
      this.heart.tint = f > 0.5 ? COLORS.infection : 0xffd890;
      this.heart.scale.set(((300 + f * 260) / this.heart.texture.width) * (1 + this.flareV * 0.6 + beat * 0.15 * f));
    }
    if (this.templeFx) {
      this.templeFx.feature = f;
      this.templeFx.update(dt, this.boltLight);
    }
    if (this.groundFog) {
      this.groundFog.tilePosition.x += dt * 18;
      this.groundFog.tint = f > 0.5 ? 0xa02020 : 0x8a7a9a;
      this.groundFog.alpha = 0.14 + f * 0.08;
    }
    for (const fire of this.fires) {
      fire.hot = f;
      fire.update(dt);
    }
    for (const st of this.stars) st.s.alpha = st.a * (0.55 + 0.45 * Math.sin(this.t * st.f + st.p)) * (1 - f * 0.6);
    if (this.clouds) {
      this.clouds.tilePosition.x -= dt * (6 + f * 30);
      this.clouds.tint = f > 0.5 ? 0xff4a3a : 0x8a7c9c;
      this.clouds.alpha = 0.2 + f * 0.15 + this.boltLight * 0.4;
    }
    if (this.moonHalo) {
      this.moonHalo.tint = f > 0.5 ? 0xff3020 : 0xffe8c0;
      this.moonHalo.alpha = 0.35 + 0.1 * Math.sin(this.t * 0.7) + f * 0.25;
      this.moonHalo.scale.set((MOON[2] * 5.8) / 256);
    }
    // a shooting star now and then on calm nights
    this.nextMeteor -= dt;
    if (this.nextMeteor <= 0 && f < 0.5 && this.infected) {
      this.nextMeteor = 14 + Math.random() * 20;
      const x0 = 300 + Math.random() * 1300;
      const y0 = 40 + Math.random() * 160;
      const ang = Math.PI * (0.12 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : Math.PI);
      const m = this.meteor;
      m.visible = true;
      m.rotation = ang;
      m.tint = 0xfff0d0;
      m.position.set(x0 - W / 2, y0 - H / 2);
      const o = { k: 0 };
      gsap.to(o, {
        k: 1,
        duration: 0.9,
        ease: 'power1.in',
        onUpdate: () => {
          m.position.set(x0 + Math.cos(ang) * 520 * o.k - W / 2, y0 + Math.sin(ang) * 520 * o.k - H / 2);
          m.scale.set((60 + 240 * Math.sin(o.k * Math.PI)) / 256, 4 / 256);
          m.alpha = Math.sin(o.k * Math.PI);
        },
        onComplete: () => (m.visible = false),
      });
    }
    // weather: rare heat lightning on the horizon at night, the pyramid under fire in the bonus
    this.nextStrike -= dt;
    if (this.nextStrike <= 0 && this.infected) {
      if (f > 0.5) {
        this.strike(0.6 + Math.random() * 0.4);
        if (Math.random() < 0.3) gsap.delayedCall(0.18, () => this.strike(0.5));
        this.nextStrike = 2.5 + Math.random() * 4;
      } else {
        const x = Math.random() < 0.5 ? 200 + Math.random() * 300 : 1420 + Math.random() * 300;
        this.strike(0.3, [x, HORIZON - 60]);
        this.nextStrike = 18 + Math.random() * 20;
      }
    }
    const speed = 1 + f * 1.5;
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
