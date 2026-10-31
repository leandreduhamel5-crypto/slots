import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { makeCanvas } from './art/painters';
import { APEX, MOON, OBELISK_SHAFTS, PYRAMID_EDGES, TH as H, TW as W } from './art/templeHD';

type Pt = [number, number];

/** Horizontal anamorphic streak (bright core, long soft wings). */
function streakCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(512, 32);
  const img = ctx.createImageData(512, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 512; x++) {
      const u = Math.abs(x / 511 - 0.5) * 2;
      const v = Math.abs(y / 31 - 0.5) * 2;
      const a = Math.pow(1 - u, 2.2) * Math.exp(-v * v * 9);
      const i = (y * 512 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Four-point star with thin rays, for the capstone flare. */
function starCanvas(): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2);
      const dy = (y - S / 2) / (S / 2);
      const r = Math.hypot(dx, dy);
      const rays = Math.exp(-Math.abs(dx) * 60) * (1 - Math.abs(dy)) + Math.exp(-Math.abs(dy) * 60) * (1 - Math.abs(dx));
      const core = Math.exp(-r * r * 40);
      const a = Math.min(1, rays * 0.9 + core);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Soft vertical band used for the light rising up the obelisks. */
function bandCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-in';
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  return c;
}

const sc = ([x, y]: Pt): Pt => [x - W / 2, y - H / 2];

interface Comet {
  head: Sprite;
  tail: Sprite;
  from: Pt;
  to: Pt;
  t: number;
  speed: number;
}

interface Band {
  s: Sprite;
  shaft: [Pt, Pt];
  t: number;
  speed: number;
}

/**
 * Live energy on the temple: light comets climbing the pyramid's edges and bursting at the
 * capstone, an anamorphic flare on the capstone and the moon, light rising up the obelisks'
 * engraved shafts, sheet lightning inside the night clouds, and in the free spins red energy
 * arcing from the obelisk tips into the capstone.
 */
export class TempleFx extends Container {
  private streak: Texture;
  private star: Texture;
  private band: Texture;
  private capFlare = new Container();
  private capStreak: Sprite;
  private capStar: Sprite;
  private capCore: Sprite;
  private moonStreak: Sprite;
  private comets: Comet[] = [];
  private bands: Band[] = [];
  private arcs = new Graphics();
  private sheet: Sprite;
  private t = 0;
  private nextComet = 1.5;
  private nextBand = 0.8;
  private nextArc = 2;
  private nextSheet = 5;
  private flash = 0;
  feature = 0;
  /** called when energy reaches the capstone (power 0..1) */
  onCharge: ((power: number) => void) | null = null;

  constructor(private glow: Texture) {
    super();
    this.streak = Texture.from(streakCanvas());
    this.star = Texture.from(starCanvas());
    this.band = Texture.from(bandCanvas());

    this.sheet = new Sprite(glow);
    this.sheet.anchor.set(0.5);
    this.sheet.blendMode = 'add';
    this.sheet.alpha = 0;

    const [mx, my] = sc([MOON[0], MOON[1]]);
    this.moonStreak = new Sprite(this.streak);
    this.moonStreak.anchor.set(0.5);
    this.moonStreak.position.set(mx, my);
    this.moonStreak.blendMode = 'add';
    this.moonStreak.width = MOON[2] * 9;
    this.moonStreak.height = 18;

    this.capStreak = new Sprite(this.streak);
    this.capStreak.anchor.set(0.5);
    this.capStreak.blendMode = 'add';
    this.capStar = new Sprite(this.star);
    this.capStar.anchor.set(0.5);
    this.capStar.blendMode = 'add';
    this.capCore = new Sprite(glow);
    this.capCore.anchor.set(0.5);
    this.capCore.blendMode = 'add';
    this.capFlare.addChild(this.capCore, this.capStreak, this.capStar);
    this.capFlare.position.set(...sc([APEX[0], APEX[1] + 6]));

    this.arcs.blendMode = 'add';
    this.addChild(this.sheet, this.moonStreak, this.arcs, this.capFlare);
  }

  private spawnComet(edge: [Pt, Pt], speed: number): void {
    const head = new Sprite(this.glow);
    head.anchor.set(0.5);
    head.blendMode = 'add';
    const tail = new Sprite(this.streak);
    tail.anchor.set(1, 0.5);
    tail.blendMode = 'add';
    this.addChildAt(tail, 2);
    this.addChildAt(head, 3);
    this.comets.push({ head, tail, from: sc(edge[0]), to: sc(edge[1]), t: 0, speed });
  }

  /** A volley of comets up every visible edge at once (wins, bonus start). */
  surge(power = 1): void {
    for (const e of PYRAMID_EDGES) this.spawnComet(e, 0.9 + power * 0.6);
  }

  private spawnBand(i: number, speed: number): void {
    const s = new Sprite(this.band);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    this.addChildAt(s, 2);
    this.bands.push({ s, shaft: [sc(OBELISK_SHAFTS[i][0]), sc(OBELISK_SHAFTS[i][1])], t: 0, speed });
  }

  /** Lightning arc between two points, flickering out. */
  private arc(a: Pt, b: Pt, power: number): void {
    const g = this.arcs;
    g.clear();
    let pts: Pt[] = [a, b];
    let disp = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.22;
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
    for (const [w, color, alpha] of [[22, 0xff1a10, 0.22], [8, 0xff5a40, 0.55], [2.5, 0xfff0e0, 1]] as const) {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke({ width: w * power, color, alpha, cap: 'round', join: 'round' });
    }
    gsap.killTweensOf(g);
    gsap.fromTo(g, { alpha: 1 }, { alpha: 0, duration: 0.45, ease: 'steps(6)' });
    this.flash = Math.max(this.flash, 0.6 * power);
  }

  update(dt: number, boltLight: number): void {
    this.t += dt;
    const t = this.t;
    const f = this.feature;
    const red = f > 0.5;
    this.flash *= Math.pow(0.05, dt);

    // capstone flare: breathing, spiking when energy arrives
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
    const p = 0.55 + pulse * 0.25 + this.flash + f * 0.35 + boltLight * 0.5;
    this.capStreak.width = 520 + p * 520;
    this.capStreak.height = 10 + p * 10;
    this.capStreak.alpha = Math.min(1, 0.35 + p * 0.45);
    this.capStar.scale.set((60 + p * 110) / 256);
    this.capStar.rotation = Math.sin(t * 0.3) * 0.15;
    this.capStar.alpha = Math.min(1, 0.5 + p * 0.4);
    this.capCore.width = this.capCore.height = 70 + p * 90;
    this.capCore.alpha = Math.min(1, 0.5 + p * 0.4);
    const tint = red ? 0xff4a30 : 0xffd9a0;
    this.capStreak.tint = this.capCore.tint = tint;
    this.capStar.tint = red ? 0xffb0a0 : 0xfff2d8;
    this.moonStreak.tint = red ? 0xff5040 : 0xdfe6ff;
    this.moonStreak.alpha = 0.22 + 0.06 * Math.sin(t * 0.8) + f * 0.15;

    // comets climbing the edges
    this.nextComet -= dt;
    if (this.nextComet <= 0) {
      const e = PYRAMID_EDGES[Math.floor(Math.random() * PYRAMID_EDGES.length)];
      this.spawnComet(e, red ? 1.1 : 0.6);
      this.nextComet = red ? 0.5 + Math.random() * 0.9 : 2.5 + Math.random() * 3;
    }
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      c.t += dt * c.speed * (0.4 + c.t * 1.4);
      const k = Math.min(1, c.t);
      const x = c.from[0] + (c.to[0] - c.from[0]) * k;
      const y = c.from[1] + (c.to[1] - c.from[1]) * k;
      const ang = Math.atan2(c.to[1] - c.from[1], c.to[0] - c.from[0]);
      const col = red ? 0xff3a24 : 0xffd27a;
      c.head.position.set(x, y);
      c.head.tint = col;
      c.head.width = c.head.height = 50 + k * 60;
      c.head.alpha = Math.min(1, k * 5);
      c.tail.position.set(x, y);
      c.tail.rotation = ang;
      c.tail.tint = col;
      c.tail.width = 300 + k * 300;
      c.tail.height = 14 + k * 10;
      c.tail.alpha = Math.min(1, k * 5) * 0.9;
      if (k >= 1) {
        c.head.destroy();
        c.tail.destroy();
        this.comets.splice(i, 1);
        this.flash = Math.max(this.flash, red ? 0.9 : 0.5);
        this.onCharge?.(red ? 0.7 : 0.35);
      }
    }

    // light rising up the obelisk shafts
    this.nextBand -= dt;
    if (this.nextBand <= 0) {
      this.spawnBand(Math.random() < 0.5 ? 0 : 1, red ? 0.9 : 0.45);
      this.nextBand = red ? 0.6 + Math.random() * 0.8 : 1.8 + Math.random() * 2;
    }
    for (let i = this.bands.length - 1; i >= 0; i--) {
      const b = this.bands[i];
      b.t += dt * b.speed;
      const k = b.t;
      const [a, z] = b.shaft;
      b.s.position.set(a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k);
      b.s.rotation = Math.atan2(z[0] - a[0], -(z[1] - a[1]));
      b.s.width = 110 - k * 34;
      b.s.height = 240;
      b.s.tint = red ? 0xff3020 : 0xffc870;
      b.s.alpha = Math.sin(Math.min(1, k) * Math.PI);
      if (k >= 1) {
        b.s.destroy();
        this.bands.splice(i, 1);
      }
    }

    // free spins: the obelisks feed red energy into the capstone
    this.nextArc -= dt;
    if (this.nextArc <= 0 && red) {
      const i = Math.random() < 0.5 ? 0 : 1;
      this.arc(sc(OBELISK_SHAFTS[i][1]), sc([APEX[0], APEX[1] + 8]), 0.6 + Math.random() * 0.5);
      this.onCharge?.(0.35);
      this.nextArc = 8 + Math.random() * 7;
    }

    // night: sheet lightning glowing inside distant clouds
    this.nextSheet -= dt;
    if (this.nextSheet <= 0) {
      this.nextSheet = red ? 1.5 + Math.random() * 2 : 6 + Math.random() * 8;
      const x = Math.random() < 0.5 ? 150 + Math.random() * 500 : 1250 + Math.random() * 550;
      this.sheet.position.set(...sc([x, 60 + Math.random() * 200]));
      this.sheet.width = 500 + Math.random() * 400;
      this.sheet.height = this.sheet.width * 0.5;
      this.sheet.tint = red ? 0xff3020 : 0xa8b4ff;
      gsap.killTweensOf(this.sheet);
      gsap
        .timeline()
        .set(this.sheet, { alpha: 0 })
        .to(this.sheet, { alpha: red ? 0.6 : 0.35, duration: 0.05 })
        .to(this.sheet, { alpha: 0.05, duration: 0.07 })
        .to(this.sheet, { alpha: red ? 0.5 : 0.28, duration: 0.05 })
        .to(this.sheet, { alpha: 0, duration: 0.5 });
    }
  }
}
