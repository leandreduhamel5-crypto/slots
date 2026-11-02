import { coverCanvas } from './assets';
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import gsap from 'gsap';
import { paintSoftRays } from './art/egyptFrame';
import { makeCanvas, seeded } from './art/painters';
import { APEX, DOOR, GATE, HORIZON, MOON, MOON_OUT, PYRAMID_HALF, TH as H, TW as W } from './art/templeHD';
import { LITE, slim } from './device';
import { TempleLight } from './TempleLight';
import { TempleFx } from './TempleFx';
import { COLORS } from './layout';

/** radius of the circle that reveals the infected temple, before scaling */
const REVEAL_R = 100;

/** The edge of the infection: a torn, uneven circle, so that it creeps instead of inflating like a ball. */
function blotOutline(): number[] {
  const rnd = seeded(13);
  const pts: number[] = [];
  const n = 180;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = REVEAL_R * (0.8 + 0.09 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 8 + 2) + 0.04 * Math.sin(a * 19) + rnd() * 0.05);
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
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
  // the roofs of the two aisles close the sky on both sides
  if (Math.min(x, W - x) < 530 + y * 0.69) return false;
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
  /** the sands before the pyramid, by night: only seen on the way into the bonus */
  private outside: Sprite | null = null;
  /** the pyramid split by the infection: the backdrop of the free spins */
  private infected: Sprite | null = null;
  /** additive copy of the infected art: makes its cracks throb with the beat */
  private infectedPulse: Sprite | null = null;
  private heart: Sprite | null = null;
  private flareV = 0;
  private bolts = new Graphics();
  private strikeGlow: Sprite;
  private boltLight = 0;
  private rayLayer: Sprite;
  private redWash: Sprite;
  private fog: TilingSprite;
  private spores: Spore[] = [];
  private sporeLayer = new Container();
  private pulse = new Graphics();
  private t = 0;
  private feature = 0;
  private nextStrike = 9;
  templeFx: TempleFx | null = null;
  /**
   * Blot growing from the capstone: the infection spreading over the night scene. It is drawn, not
   * a soft sprite: a sprite mask takes a render target as large as itself, and this one ends up
   * thousands of pixels wide, more than a phone can hold. The ring of light gives it its burning front.
   */
  private reveal: Graphics | null = null;
  private revealFront: Sprite | null = null;
  private revealing = false;
  private spread = { r: 0 };
  private groundFog: TilingSprite | null = null;
  private stars: { s: Sprite; f: number; p: number; a: number }[] = [];
  private clouds: TilingSprite | null = null;
  private moonHalo: Sprite | null = null;
  private meteor: Sprite;
  private nextMeteor = 6;
  /** live light through the hall */
  private live: TempleLight | null = null;
  private gateGlow: Sprite | null = null;
  private boltSide = 1;
  private moon = MOON;
  /** the two leaves of the door of the pyramid, in the picture of the sands */
  private door = new Container();
  private doorLeaves: Sprite[] = [];
  private doorHeat: Sprite | null = null;
  private doorInside = new Graphics();
  private flashLayer = new Graphics();
  /** the door has begun to open */
  onDoor: (() => void) | null = null;
  private w = W;
  private h = H;
  /** called on every lightning strike with its power (0.3 distant … 1 direct hit) */
  onLightning: ((power: number) => void) | null = null;

  constructor(
    private sporeTex: Texture,
    glowTex: Texture,
    night: HTMLImageElement,
    art: { outside: HTMLImageElement; infected: HTMLImageElement; door: HTMLImageElement; hallMaps: HTMLImageElement[]; pyramidMaps: HTMLImageElement[] },
    custom: HTMLImageElement | null = null,
  ) {
    super();
    // the temple is a 3D scene rendered offline in two states (art/temple3d.ts); live lights, lightning and fire go on top
    this.scene = new Sprite(Texture.from(custom ? coverCanvas(custom, W, H) : night));
    this.scene.anchor.set(0.5);
    const artScale = W / night.naturalWidth;
    if (!custom) this.scene.scale.set(artScale);
    const fogTex = slim(paintFog());
    this.sceneC.addChild(this.scene);
    if (!custom) {
      const tex = Texture.from(art.infected);
      const sands = Texture.from(art.outside);
      // the pictures fill the screen, never smaller than their pixels on a phone: no need for mipmaps
      if (LITE) tex.source.autoGenerateMipmaps = sands.source.autoGenerateMipmaps = this.scene.texture.source.autoGenerateMipmaps = false;
      this.outside = new Sprite(sands);
      this.outside.anchor.set(0.5);
      this.outside.scale.set(artScale);
      this.outside.visible = false;
      this.sceneC.addChild(this.outside);
      this.infected = new Sprite(tex);
      this.infectedPulse = new Sprite(tex);
      for (const s of [this.infected, this.infectedPulse]) {
        s.anchor.set(0.5);
        s.scale.set(artScale);
        s.alpha = 0;
      }
      this.infectedPulse.blendMode = 'add';
      this.reveal = new Graphics().poly(blotOutline()).fill(0xffffff);
      // the infection comes out of the door of the pyramid
      this.reveal.position.set(DOOR[0] + DOOR[2] / 2 - W / 2, DOOR[1] + DOOR[3] - H / 2);
      this.reveal.visible = false;
      this.revealFront = new Sprite(Texture.from(paintHaloRing()));
      this.revealFront.anchor.set(0.5);
      this.revealFront.position.copyFrom(this.reveal.position);
      this.revealFront.blendMode = 'add';
      this.revealFront.tint = 0xff8a4a;
      this.revealFront.visible = false;
      this.sceneC.addChild(this.infected, this.infectedPulse, this.reveal, this.revealFront);
      this.buildDoor(art.door, glowTex);
      this.live = new TempleLight(art.hallMaps, art.pyramidMaps);
      this.gateGlow = new Sprite(glowTex);
      this.gateGlow.anchor.set(0.5);
      this.gateGlow.position.set(GATE[0] - W / 2, GATE[1] - H / 2);
      this.gateGlow.blendMode = 'add';
      this.sceneC.addChild(this.door, this.live, this.gateGlow);
      // low mist drifting over the polished floor
      this.groundFog = new TilingSprite({ texture: fogTex, width: W * 1.2, height: 260 });
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
    this.strikeGlow = new Sprite(glowTex);
    this.strikeGlow.anchor.set(0.5);
    this.strikeGlow.blendMode = 'add';
    this.strikeGlow.alpha = 0;
    this.sceneC.addChild(this.bolts, this.strikeGlow, this.meteor);

    this.redWash = new Sprite(sporeTex);
    this.redWash.anchor.set(0.5);
    this.redWash.tint = COLORS.infection;
    this.redWash.blendMode = 'add';
    this.redWash.alpha = 0;
    this.fog = new TilingSprite({ texture: fogTex, width: W, height: H });
    this.fog.tint = 0x6a5070;
    this.fog.alpha = 0.025;

    // sky rays are painted once and turned slowly: a filter on the scene costs either the
    // frame rate or, at low resolution, the sharpness of the whole picture
    this.rayLayer = new Sprite(Texture.from(paintSoftRays(LITE ? 512 : 1024)));
    this.rayLayer.anchor.set(0.5);
    this.rayLayer.blendMode = 'add';
    this.addChild(this.sceneC, this.rayLayer, this.redWash, this.fog, this.sporeLayer, this.pulse, this.flashLayer);
    for (let i = 0; i < 22; i++) this.spores.push(this.spawn(true));
  }

  /** The door of the pyramid: shut over the dark of the opening, its leaves slide into the wall. */
  private buildDoor(leaf: HTMLImageElement, glowTex: Texture): void {
    const [x, y, w, h] = DOOR;
    this.door.position.set(x - W / 2, y - H / 2);
    this.door.visible = false;
    const tex = Texture.from(leaf);
    const heat = new Sprite(glowTex);
    heat.anchor.set(0.5);
    heat.position.set(w / 2, h * 0.6);
    heat.width = w * 2.4;
    heat.height = h * 1.5;
    heat.tint = 0xff3a14;
    heat.blendMode = 'add';
    heat.alpha = 0;
    this.doorHeat = heat;
    const clip = new Graphics().rect(0, 0, w, h).fill(0xffffff);
    this.doorInside.rect(0, 0, w, h).fill(0xff5a20);
    this.doorInside.alpha = 0;
    const leaves = new Container();
    leaves.mask = clip;
    const k = w / 2 / tex.width;
    for (const right of [false, true]) {
      const s = new Sprite(tex);
      s.scale.set(right ? -k : k, h / tex.height);
      s.x = right ? w : 0;
      leaves.addChild(s);
      this.doorLeaves.push(s);
    }
    this.door.addChild(this.doorInside, leaves, clip, heat);
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
    this.rayLayer.position.set(w / 2, h * 0.06);
    this.rayLayer.width = this.rayLayer.height = Math.max(w, h) * 2.4;
    this.fog.width = w;
    this.fog.height = h;
  }

  /** camera dolly: k = zoom factor, focus = the art point that stays put while zooming in */
  readonly camera = { k: 1, fx: GATE[0], fy: GATE[1] };

  /** Which of the two places is on screen: the sanctuary, or the sands before the pyramid. */
  private place(outside: boolean): void {
    this.scene.visible = !outside;
    if (this.outside) this.outside.visible = outside;
    this.live?.useScene(outside ? 'pyramid' : 'hall');
    this.moon = outside ? MOON_OUT : MOON;
    this.moonHalo?.position.set(this.moon[0] - W / 2, this.moon[1] - H / 2);
    this.gateGlow?.position.set(outside ? DOOR[0] + DOOR[2] / 2 - W / 2 : GATE[0] - W / 2, outside ? DOOR[1] + DOOR[3] / 2 - H / 2 : GATE[1] - H / 2);
    this.camera.fx = outside ? DOOR[0] + DOOR[2] / 2 : GATE[0];
    this.camera.fy = outside ? DOOR[1] + DOOR[3] / 2 : GATE[1];
  }

  /** A veil of light over the whole screen. */
  private veil(colour: number, from: number, to: number, duration: number): Promise<void> {
    const g = this.flashLayer;
    g.clear().rect(0, 0, this.w, this.h).fill(colour);
    return new Promise((r) => gsap.fromTo(g, { alpha: from }, { alpha: to, duration, ease: 'sine.inOut', onComplete: r }));
  }

  /** Out of the sanctuary: down the nave, into the light of its gate, and out on the sands by night. */
  async leaveHall(fast: boolean): Promise<void> {
    void this.zoomTo(7, fast ? 0.8 : 1.5);
    await new Promise((r) => setTimeout(r, fast ? 500 : 1050));
    await this.veil(0xffe2a8, 0, 1, fast ? 0.25 : 0.42);
    // the light fades on the whole of it: the sands, the great pyramid, the moon
    gsap.killTweensOf(this.camera);
    this.place(true);
    this.door.visible = true;
    this.camera.k = 1;
    this.applyCamera();
    await this.veil(0xffe2a8, 1, 0, fast ? 0.3 : 0.7);
  }

  /** The great door opens by itself, and what was shut inside comes out. */
  async openPyramid(fast: boolean): Promise<void> {
    const open = fast ? 0.9 : 1.8;
    const hold = fast ? 0.2 : 1.1;
    gsap.to(this.camera, { k: 2.7, duration: hold + open + 0.5, ease: 'sine.inOut', onUpdate: () => this.applyCamera() });
    await new Promise((r) => setTimeout(r, hold * 1000));
    this.onDoor?.();
    const w = DOOR[2];
    gsap.to(this.doorInside, { alpha: 1, duration: 0.5 });
    if (this.doorHeat) gsap.to(this.doorHeat, { alpha: 0.75, duration: open, ease: 'power2.in' });
    gsap.to(this.doorLeaves[0], { x: -w / 2, duration: open, ease: 'sine.inOut' });
    gsap.to(this.doorLeaves[1], { x: w * 1.5, duration: open, ease: 'sine.inOut' });
    if (this.live) gsap.to(this.live, { doorLight: 1, duration: open, ease: 'power2.in' });
    await new Promise((r) => setTimeout(r, open * 650));
    this.setFeature(true);
    await new Promise((r) => setTimeout(r, open * 350 + 500));
  }

  private shown = false;


  private applyCamera(): void {
    // a little larger than the screen, so the edge of the picture never shows
    const base = Math.max(this.w / W, this.h / H) * 1.06;
    const s = base * this.camera.k;
    const f = [this.camera.fx - W / 2, this.camera.fy - H / 2];
    this.sceneC.scale.set(s);
    this.sceneC.position.set(this.w / 2 - f[0] * (s - base), this.h / 2 - f[1] * (s - base));
  }

  /** Where the capstone is on screen. */
  apexOnScreen(): { x: number; y: number } {
    return this.sceneC.toGlobal({ x: APEX[0] - W / 2, y: APEX[1] - H / 2 });
  }

  /** Dolly the camera down the nave, into the gate. */
  zoomTo(k: number, duration: number, ease = 'power3.in'): Promise<void> {
    return new Promise((r) => gsap.to(this.camera, { k, duration, ease, onUpdate: () => this.applyCamera(), onComplete: r }));
  }

  /** Free spins: the pyramid turns red under a barrage of lightning. */
  setFeature(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    if (on) {
      if (this.outside) {
        // straight here when a bonus is picked up after a reload
        this.place(true);
      }
    } else {
      this.place(false);
      this.door.visible = false;
      this.doorLeaves.forEach((s) => gsap.killTweensOf(s));
      if (this.doorLeaves.length) {
        this.doorLeaves[0].x = 0;
        this.doorLeaves[1].x = DOOR[2];
        this.doorInside.alpha = 0;
        this.doorHeat!.alpha = 0;
      }
      if (this.live) this.live.doorLight = 0;
    }
    gsap.to(this, { feature: on ? 1 : 0, duration: on ? 0.9 : 1.6, ease: 'power2.inOut' });
    // the infection spreads outward from the capstone (and recedes back into it)
    gsap.killTweensOf(this.spread);
    gsap.to(this.spread, { r: on ? 1 : 0, duration: on ? 1.6 : 1.4, ease: on ? 'power2.in' : 'power2.inOut' });
    if (on) {
      this.strike(1, APEX);
      this.templeFx?.surge(1);
      this.nextStrike = 6;
      this.live?.wave(0xff3a1a, 1, false, 75, 0.12);
    }
  }

  /** A win leaves the reels and runs away down the nave. */
  wave(power: number): void {
    this.live?.wave(this.feature > 0.5 ? 0xff5a30 : 0xffc870, power, true, 110, 0.3);
  }

  setLive(on: boolean): void {
    if (this.live) this.live.visible = on;
  }

  /** A lightning strike; without a target it hits the pyramid somewhere along its slopes. */
  strike(power = 1, target?: Pt): void {
    const [ax, ay] = APEX;
    const to: Pt = target ?? [ax, ay + 10];
    const from: Pt = [to[0] + (Math.random() - 0.5) * 500, -40];
    this.boltSide = to[0] < W / 2 ? -1 : 1;
    const infected = this.feature > 0.5;
    const glow = infected ? 0xff3020 : 0x5a7cff;
    const mid = infected ? 0xffa890 : 0xc4d6ff;
    // a tree of channels: the main bolt, its forks and their twigs
    const main = boltPath(from, to, 0.24);
    const tree: { pts: Pt[]; w: number; start: number }[] = [{ pts: main, w: power, start: 0 }];
    const forkOf = (src: Pt[], w: number, start: number, depth: number) => {
      const n = depth === 0 ? 3 + Math.floor(power * 4) : 2;
      for (let k = 0; k < n; k++) {
        const i = 4 + Math.floor(Math.random() * (src.length * 0.75));
        const q = src[Math.min(i, src.length - 2)];
        const r = src[Math.min(i + 1, src.length - 1)];
        const dir = Math.atan2(r[1] - q[1], r[0] - q[0]) + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.6);
        const len = (depth === 0 ? 120 + Math.random() * 240 : 40 + Math.random() * 90) * (0.6 + power * 0.5);
        const pts = boltPath(q, [q[0] + Math.cos(dir) * len, q[1] + Math.sin(dir) * len], 0.32);
        const s0 = start + (i / src.length) * (1 - start);
        tree.push({ pts, w: w * 0.5, start: s0 });
        if (depth < 1) forkOf(pts, w * 0.5, s0, depth + 1);
      }
    };
    forkOf(main, power, 0, 0);
    const g = this.bolts;
    const draw = (reveal: number) => {
      g.clear();
      for (const b of tree) {
        const k = (reveal - b.start) / Math.max(0.05, 1 - b.start);
        if (k <= 0) continue;
        const count = Math.max(2, Math.ceil(b.pts.length * Math.min(1, k)));
        // the channel is drawn in lengths, thinner as it runs: a bolt tapers, it is not a cable
        const chunks = 5;
        for (let c = 0; c < chunks; c++) {
          const i0 = Math.floor((c / chunks) * (count - 1));
          const i1 = Math.ceil(((c + 1) / chunks) * (count - 1));
          const taper = 1 - (c / chunks) * 0.65;
          for (const [wd, color, alpha] of [[26, glow, 0.1], [9, glow, 0.32], [3.4, mid, 0.9], [1.5, 0xffffff, 1]] as const) {
            g.moveTo(b.pts[i0][0] - W / 2, b.pts[i0][1] - H / 2);
            for (let i = i0 + 1; i <= i1 && i < b.pts.length; i++) g.lineTo(b.pts[i][0] - W / 2, b.pts[i][1] - H / 2);
            g.stroke({ width: Math.max(0.7, wd * b.w * taper), color, alpha, cap: 'round', join: 'round' });
          }
        }
      }
    };
    const o = { v: 1, r: 0 };
    gsap.killTweensOf(this.bolts);
    this.bolts.alpha = 1;
    draw(0.02);
    // the stepped leader races down, then the return stroke lights the whole channel
    gsap
      .timeline({ onUpdate: () => ((this.bolts.alpha = o.v), (this.boltLight = o.v * power)) })
      .to(o, { r: 1, duration: 0.08, ease: 'none', onUpdate: () => draw(o.r) })
      .add(() => {
        const hit = this.strikeGlow;
        hit.position.set(to[0] - W / 2, to[1] - H / 2);
        hit.tint = mid;
        gsap.killTweensOf(hit);
        gsap.fromTo(hit, { alpha: 0.9 * power, width: 220, height: 220 }, { alpha: 0, width: 620 * power, height: 620 * power, duration: 0.55, ease: 'power2.out' });
        if (power >= 0.5) this.onLightning?.(power);
      })
      .to(o, { v: 0.2, duration: 0.05 })
      .to(o, { v: 1, duration: 0.03 })
      .to(o, { v: 0.35, duration: 0.08 })
      .to(o, { v: 0.85, duration: 0.03 })
      .to(o, { v: 0, duration: 0.42, ease: 'power2.in' });
    // the sky answers, softly
    this.pulse.clear().rect(0, 0, this.w, this.h).fill({ color: infected ? 0xff9080 : 0xa0b4ff });
    this.pulse.blendMode = 'add';
    gsap.fromTo(this.pulse, { alpha: 0.05 * power }, { alpha: 0, duration: 0.55, ease: 'power3.out' });
    this.flare(0.5 * power);
    if (power < 0.5) this.onLightning?.(power);
  }

  /** Kept for callers: a dramatic strike on the capstone. */
  flash(): void {
    this.strike(0.9, [APEX[0], APEX[1] + 10]);
  }

  /** The temple answers a win: the capstone blazes, braziers roar, light shafts brighten. */
  flare(power = 0.6): void {
    if (power >= 0.6 && this.flareV < 0.5) this.templeFx?.surge(power);
    this.flareV = Math.max(this.flareV, power);
  }

  thump(strength = 0.35): void {
    this.flare(strength * 2);
    this.pulse.clear().rect(0, 0, this.w, this.h).fill({ color: COLORS.infection });
    this.pulse.blendMode = 'add';
    gsap.fromTo(this.pulse, { alpha: strength * 0.1 }, { alpha: 0, duration: 0.5, ease: 'power2.out' });
  }

  setRays(on: boolean): void {
    this.rayLayer.visible = on;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.t += dt;
    const f = this.feature;
    const beat = Math.pow(Math.max(0, Math.sin(this.t * (2.6 + f * 1.6))), 12);
    this.rayLayer.rotation += dt * 0.008;
    this.rayLayer.alpha = Math.min(0.1, 0.04 + f * 0.02 + this.flareV * 0.03 + this.boltLight * 0.03);
    this.rayLayer.tint = f > 0.5 ? 0xff5040 : 0xffd8a0;
    this.fog.tilePosition.x += dt * 12;
    this.fog.tilePosition.y += dt * 3;
    this.fog.tint = f > 0.5 ? 0xa02030 : 0x6a5070;
    this.fog.alpha = 0.025 + f * 0.025;
    this.redWash.alpha = f * 0.05;
    if (this.infected && this.infectedPulse) {
      const r = this.spread.r;
      this.infected.alpha = Math.min(1, f * 3);
      this.infected.visible = r > 0;
      this.infectedPulse.visible = r > 0;
      if (this.reveal && this.revealFront) {
        // the mask is only there while the infection spreads: fully out, the picture simply shows
        const spreading = r > 0 && r < 1;
        if (spreading !== this.revealing) {
          this.revealing = spreading;
          this.infected.mask = spreading ? this.reveal : null;
          this.reveal.visible = spreading;
          this.revealFront.visible = spreading;
        }
        const radius = 40 + r * 2700;
        this.reveal.scale.set(radius / REVEAL_R);
        // the ring of the halo texture sits at 36% of its radius, a blot at about 80% of its own
        this.revealFront.width = this.revealFront.height = (radius * 2 * 0.8) / 0.36;
        this.revealFront.alpha = Math.min(1, Math.sin(Math.PI * r) * 4);
      }
      this.infectedPulse.alpha = f * (beat * 0.03 + this.boltLight * 0.14 + this.flareV * 0.06);
    }
    this.flareV *= Math.pow(0.25, dt);
    if (this.heart) {
      this.heart.alpha = Math.min(0.7, 0.08 + beat * 0.1 * f + f * 0.14 + this.flareV * 0.3 + this.boltLight * 0.4);
      this.heart.tint = f > 0.5 ? COLORS.infection : 0xffd890;
      this.heart.scale.set(((300 + f * 260) / this.heart.texture.width) * (1 + this.flareV * 0.6 + beat * 0.15 * f));
    }
    if (this.live?.visible) this.live.update(dt, f, this.flareV, this.boltLight, this.boltSide);
    if (this.gateGlow) {
      this.gateGlow.tint = f > 0.5 ? 0xff2a10 : 0xffb050;
      // the nearer the camera comes, the more the gate fills the air
      this.gateGlow.alpha = Math.min(1, 0.34 + 0.06 * Math.sin(this.t * 1.3) + beat * f * 0.3 + this.flareV * 0.3 + (this.camera.k - 1) * 0.3);
      this.gateGlow.width = 150;
      this.gateGlow.height = 260;
    }
    if (this.templeFx) {
      this.templeFx.feature = f;
      this.templeFx.update(dt, this.boltLight);
    }
    if (this.groundFog) {
      this.groundFog.tilePosition.x += dt * 18;
      this.groundFog.tint = f > 0.5 ? 0xa02020 : 0x8a7a9a;
      this.groundFog.alpha = 0.05 + f * 0.03;
    }
    for (const st of this.stars) st.s.alpha = st.a * (0.55 + 0.45 * Math.sin(this.t * st.f + st.p)) * (1 - f * 0.6);
    if (this.clouds) {
      this.clouds.tilePosition.x -= dt * (6 + f * 30);
      this.clouds.tint = f > 0.5 ? 0xff4a3a : 0x8a7c9c;
      this.clouds.alpha = 0.2 + f * 0.15 + this.boltLight * 0.4;
    }
    if (this.moonHalo) {
      this.moonHalo.tint = f > 0.5 ? 0xff3020 : 0xffe8c0;
      this.moonHalo.alpha = 0.16 + 0.03 * Math.sin(this.t * 0.7) + f * 0.08;
      this.moonHalo.scale.set((this.moon[2] * 5.8) / 256);
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
        this.strike(0.5 + Math.random() * 0.2);
        this.nextStrike = 20 + Math.random() * 14;
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
      p.s.alpha = 0.12 + 0.2 * Math.abs(Math.sin(this.t * 1.7 + p.phase));
      if (p.s.y < -30 || p.s.x < -30 || p.s.x > this.w + 30) {
        p.s.destroy();
        this.spores[i] = this.spawn(false);
      }
    }
  }
}
