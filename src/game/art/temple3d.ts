import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * The backdrop as a real 3D scene, rendered offline (lab.html?only=temple3d) into two images:
 * a stepped limestone pyramid built block by block, granite obelisks with engraved glyphs and
 * gold pyramidions, gold braziers lighting the scene, a polished stone floor reflecting it all,
 * moonlight with soft shadows, fog and bloom. 'infected' turns the light red and makes molten
 * cracks blaze across the pyramid. The projected screen positions of the key props are returned
 * so the live layer (fire, lightning, glows) can sit exactly on them.
 */
export type State = 'night' | 'infected';

export interface Marks {
  apex: [number, number];
  braziers: [number, number][];
  obelisks: [number, number][];
  moon: [number, number, number];
  horizon: number;
  pyramidHalf: number;
  /** pyramid base corners (screen) and obelisk shaft bottom/top centres */
  corners: [number, number][];
  shafts: [number, number][][];
}

const OUT_W = 1920;
const OUT_H = 1080;

/* ------------------------------------------------------------------ noise */

function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function valueNoise(seed: number, cells: number): (x: number, y: number) => number {
  const r = rng(seed);
  const g = new Float32Array((cells + 1) * (cells + 1)).map(() => r());
  const at = (i: number, j: number) => g[(((j % cells) + cells) % cells) * (cells + 1) + (((i % cells) + cells) % cells)];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * cells;
    const fy = y * cells;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = s(fx - i);
    const ty = s(fy - j);
    return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty;
  };
}

function fbm(seed: number, base: number, oct: number): (x: number, y: number) => number {
  const ls = Array.from({ length: oct }, (_, k) => valueNoise(seed + k * 31, base << k));
  return (x, y) => {
    let v = 0;
    let a = 0.5;
    let n = 0;
    for (const l of ls) {
      v += l(x, y) * a;
      n += a;
      a *= 0.5;
    }
    return v / n;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Tangent-space normal map from a grey height canvas. */
function normalFrom(height: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = height.width;
  const h = height.height;
  const src = height.getContext('2d')!.getImageData(0, 0, w, h).data;
  const [c, ctx] = canvas(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x: number, y: number) => src[((((y + h) % h) * w + ((x + w) % w)) * 4)] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/* ------------------------------------------------------------------ textures */

function limestone(): { map: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } {
  const S = 512;
  const [hc, hx] = canvas(S, S);
  const [cc, cx] = canvas(S, S);
  const hi = hx.createImageData(S, S);
  const ci = cx.createImageData(S, S);
  const big = fbm(3, 3, 5);
  const fine = fbm(9, 24, 4);
  const r = rng(77);
  const pits: [number, number, number][] = Array.from({ length: 140 }, () => [r() * S, r() * S, 1 + r() * r() * 7]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      let h = big(u, v) * 0.6 + fine(u, v) * 0.4;
      // strata: limestone has faint horizontal bedding
      h += Math.sin(v * 70 + big(u * 2, v) * 6) * 0.03;
      for (const [px, py, pr] of pits) {
        const d = Math.hypot(x - px, y - py);
        if (d < pr) h -= (1 - d / pr) * 0.35;
      }
      // chipped, rounded block edges
      const e = Math.min(u, v, 1 - u, 1 - v);
      if (e < 0.04) h -= (0.04 - e) * 6 * (0.6 + fine(u * 3, v * 3) * 0.8);
      const i = (y * S + x) * 4;
      const hv = Math.max(0, Math.min(1, h));
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hv * 255;
      hi.data[i + 3] = 255;
      const k = 0.72 + hv * 0.42;
      const warm = big(u * 1.7 + 3, v * 1.7);
      ci.data[i] = Math.min(255, (196 + warm * 30) * k);
      ci.data[i + 1] = Math.min(255, (162 + warm * 22) * k);
      ci.data[i + 2] = Math.min(255, (112 + warm * 10) * k);
      ci.data[i + 3] = 255;
    }
  }
  hx.putImageData(hi, 0, 0);
  cx.putImageData(ci, 0, 0);
  const [rc, rx] = canvas(S, S);
  rx.drawImage(hc, 0, 0);
  rx.globalCompositeOperation = 'difference';
  rx.fillStyle = '#fff';
  rx.fillRect(0, 0, S, S);
  rx.globalCompositeOperation = 'source-over';
  rx.fillStyle = 'rgba(200,200,200,0.55)';
  rx.fillRect(0, 0, S, S);
  return { map: tex(cc, true), normal: tex(normalFrom(hc, 6), false), rough: tex(rc, false) };
}

function floorTiles(): { map: THREE.Texture; normal: THREE.Texture } {
  const S = 1024;
  const n = 4;
  const [hc, hx] = canvas(S, S);
  const [cc, cx] = canvas(S, S);
  const noise = fbm(21, 6, 5);
  const hi = hx.createImageData(S, S);
  const ci = cx.createImageData(S, S);
  const r = rng(5);
  const tint = Array.from({ length: n * n }, () => 0.75 + r() * 0.4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * n;
      const v = (y / S) * n;
      const fu = u - Math.floor(u);
      const fv = v - Math.floor(v);
      const g = Math.min(fu, fv, 1 - fu, 1 - fv);
      const groove = g < 0.012 ? 0 : g < 0.03 ? (g - 0.012) / 0.018 : 1;
      const nz = noise(x / S, y / S);
      const i = (y * S + x) * 4;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = (groove * 0.8 + nz * 0.2) * 255;
      hi.data[i + 3] = 255;
      const t = tint[Math.floor(v) * n + Math.floor(u)] * (0.75 + nz * 0.5) * (0.35 + groove * 0.65);
      ci.data[i] = 70 * t;
      ci.data[i + 1] = 56 * t;
      ci.data[i + 2] = 48 * t;
      ci.data[i + 3] = 255;
    }
  }
  hx.putImageData(hi, 0, 0);
  cx.putImageData(ci, 0, 0);
  return { map: tex(cc, true, 14), normal: tex(normalFrom(hc, 8), false, 14) };
}

/** Column of hieroglyphs: white engraving on black (emissive mask and height for the normal map). */
function glyphColumn(seed: number): { mask: THREE.Texture; normal: THREE.Texture } {
  const W = 256;
  const H = 2048;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const r = rng(seed);
  // cartouche frame lines down both sides
  ctx.fillRect(22, 40, 6, H - 80);
  ctx.fillRect(W - 28, 40, 6, H - 80);
  for (let y = 120; y < H - 120; y += 150) {
    const k = Math.floor(r() * 6);
    const x = W / 2;
    ctx.beginPath();
    if (k === 0) {
      // eye of Horus
      ctx.moveTo(x - 55, y);
      ctx.quadraticCurveTo(x, y - 42, x + 55, y);
      ctx.quadraticCurveTo(x, y + 30, x - 55, y);
      ctx.moveTo(x + 14, y);
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.moveTo(x - 10, y + 22);
      ctx.lineTo(x - 22, y + 58);
      ctx.stroke();
    } else if (k === 1) {
      // ankh
      ctx.ellipse(x, y - 30, 22, 30, 0, 0, Math.PI * 2);
      ctx.moveTo(x - 46, y + 6);
      ctx.lineTo(x + 46, y + 6);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 70);
      ctx.stroke();
    } else if (k === 2) {
      // water
      for (let j = 0; j < 3; j++) {
        ctx.moveTo(x - 60, y - 20 + j * 22);
        for (let q = 0; q < 6; q++) ctx.lineTo(x - 60 + (q + 1) * 20, y - 20 + j * 22 + (q % 2 ? 0 : -12));
      }
      ctx.stroke();
    } else if (k === 3) {
      // sun disc
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.moveTo(x + 10, y);
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (k === 4) {
      // feather of Maat
      ctx.moveTo(x, y + 60);
      ctx.quadraticCurveTo(x - 36, y, x + 8, y - 60);
      ctx.quadraticCurveTo(x + 28, y, x, y + 60);
      ctx.stroke();
    } else {
      // scarab
      ctx.ellipse(x, y + 8, 26, 38, 0, 0, Math.PI * 2);
      ctx.moveTo(x - 26, y);
      ctx.lineTo(x - 58, y - 26);
      ctx.moveTo(x + 26, y);
      ctx.lineTo(x + 58, y - 26);
      ctx.moveTo(x - 24, y + 30);
      ctx.lineTo(x - 50, y + 56);
      ctx.moveTo(x + 24, y + 30);
      ctx.lineTo(x + 50, y + 56);
      ctx.stroke();
    }
  }
  const mask = tex(c, true);
  mask.wrapS = mask.wrapT = THREE.ClampToEdgeWrapping;
  // engraving is cut in: invert for the height
  const [hc, hx] = canvas(W, H);
  hx.filter = 'blur(2px)';
  hx.drawImage(c, 0, 0);
  hx.globalCompositeOperation = 'difference';
  hx.fillStyle = '#fff';
  hx.fillRect(0, 0, W, H);
  const normal = tex(normalFrom(hc, 3), false);
  normal.wrapS = normal.wrapT = THREE.ClampToEdgeWrapping;
  return { mask, normal };
}

/** A few long molten veins fanning down a face from the apex (white on transparent). */
function crackTexture(seed: number, amount: number): THREE.Texture {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const r = rng(seed);
  const lines: [number, number][][] = [];
  const grow = (x: number, y: number, a: number, len: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    for (let i = 0; i < 12; i++) {
      a += (r() - 0.5) * 0.3;
      x += Math.cos(a) * (len / 12);
      y += Math.sin(a) * (len / 12);
      pts.push([x, y]);
    }
    lines.push(pts);
    if (depth > 0) {
      const p = pts[5 + Math.floor(r() * 5)];
      grow(p[0], p[1], a + (r() < 0.5 ? 0.55 : -0.55), len * 0.42, depth - 1);
    }
  };
  for (let i = 0; i < amount; i++) grow(S / 2 + (r() - 0.5) * 16, 30, Math.PI / 2 + ((i + 0.5) / amount - 0.5) * 1.15 + (r() - 0.5) * 0.12, 620 + r() * 260, 1);
  const pass = (w: number, col: string, blur: number) => {
    ctx.save();
    ctx.filter = blur ? `blur(${blur}px)` : 'none';
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pts of lines) {
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.lineWidth = Math.max(1, w * (1 - i / pts.length));
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  pass(16, 'rgba(255,255,255,0.16)', 6);
  pass(3.5, 'rgba(255,255,255,0.9)', 0);
  const t = tex(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function skyTexture(state: State): THREE.Texture {
  const W = 2048;
  const H = 1024;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const stops = state === 'night' ? ['#02030a', '#060a20', '#141640', '#3a2a50', '#7a4a3a'] : ['#0a0103', '#2a0408', '#5a060c', '#9a0e14', '#e0301c'];
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const r = rng(11);
  for (let i = 0; i < 1400; i++) {
    const y = r() * H * 0.8;
    const a = (state === 'night' ? 0.9 : 0.35) * (0.2 + r() * 0.8) * (1 - y / H);
    ctx.fillStyle = state === 'night' ? `rgba(255,${240 + r() * 15},${220 + r() * 35},${a})` : `rgba(255,170,150,${a})`;
    ctx.beginPath();
    ctx.arc(r() * W, y, r() * r() * 1.8 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // milky band
  const band = ctx.createLinearGradient(0, H * 0.1, W, H * 0.6);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, state === 'night' ? 'rgba(180,170,255,0.07)' : 'rgba(255,90,60,0.06)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, H);
  // clouds, lit from below
  const w = 512;
  const h = 256;
  const [cl, clx] = canvas(w, h);
  const img = clx.createImageData(w, h);
  const dens = fbm(state === 'night' ? 17 : 19, 3, 6);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const d = dens(u * 1.6, v * 0.9);
      const cloud = Math.max(0, Math.min(1, (d - 0.5) * 3.4)) * (0.25 + v * 0.75);
      const under = Math.max(0, Math.min(1, (dens(u * 1.6, v * 0.9 + 0.03) - d) * 14 + 0.3));
      const i = (y * w + x) * 4;
      if (state === 'night') {
        img.data[i] = 20 + 140 * under;
        img.data[i + 1] = 18 + 110 * under;
        img.data[i + 2] = 34 + 120 * under;
      } else {
        img.data[i] = 40 + 215 * under;
        img.data[i + 1] = 6 + 50 * under;
        img.data[i + 2] = 8 + 30 * under;
      }
      img.data[i + 3] = cloud * 230;
    }
  }
  clx.putImageData(img, 0, 0);
  ctx.filter = 'blur(2px)';
  ctx.drawImage(cl, 0, H * 0.05, W, H * 0.62);
  ctx.filter = 'none';
  return tex(c, true);
}

function moonTexture(state: State): THREE.Texture {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const n = fbm(41, 4, 5);
  const img = ctx.createImageData(S, S);
  const r = rng(8);
  const craters: [number, number, number][] = Array.from({ length: 22 }, () => [r() * S, r() * S, 8 + r() * 46]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x / S - 0.5;
      const dy = y / S - 0.5;
      const d = Math.hypot(dx, dy) * 2;
      const i = (y * S + x) * 4;
      if (d > 1) {
        img.data[i + 3] = 0;
        continue;
      }
      let v = 0.72 + n(x / S, y / S) * 0.35;
      for (const [cx, cy, cr] of craters) {
        const q = Math.hypot(x - cx, y - cy) / cr;
        if (q < 1) v -= (1 - q) * 0.12;
        if (q > 0.85 && q < 1.05) v += 0.05;
      }
      v *= 1 - Math.pow(Math.max(0, dx + dy + 0.2), 2) * 0.45;
      const [R, G, B] = state === 'night' ? [255, 244, 222] : [255, 120, 96];
      img.data[i] = R * v;
      img.data[i + 1] = G * v;
      img.data[i + 2] = B * v;
      img.data[i + 3] = Math.min(1, (1 - d) * 40) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, true);
}

/* ------------------------------------------------------------------ props */

function goldMaterial(env: THREE.Texture, red: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: red ? 0xe08a40 : 0xe0a02c, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 0.9 });
}

function obelisk(env: THREE.Texture, state: State, seed: number): THREE.Group {
  const g = new THREE.Group();
  const h = 36;
  const geo = new THREE.BoxGeometry(3.4, h, 3.4, 1, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * 0.66);
      pos.setZ(i, pos.getZ(i) * 0.66);
    }
  }
  geo.computeVertexNormals();
  geo.translate(0, h / 2 + 2.2, 0);
  const glyphs = glyphColumn(seed);
  const red = state === 'infected';
  const stone = new THREE.MeshStandardMaterial({
    color: 0x2a2228,
    roughness: 0.32,
    metalness: 0.1,
    normalMap: glyphs.normal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    emissive: red ? 0xff2a1a : 0xc89030,
    emissiveMap: glyphs.mask,
    emissiveIntensity: red ? 2.6 : 0.35,
    envMap: env,
    envMapIntensity: 0.5,
  });
  const shaft = new THREE.Mesh(geo, stone);
  shaft.castShadow = shaft.receiveShadow = true;
  g.add(shaft);
  const capGeo = new THREE.ConeGeometry(2.25 * Math.SQRT1_2 * 1.02, 3.4, 4, 1);
  capGeo.rotateY(Math.PI / 4);
  const cap = new THREE.Mesh(capGeo, goldMaterial(env, red));
  cap.position.y = h + 2.2 + 1.7;
  cap.castShadow = true;
  g.add(cap);
  // plinth with a gold and lapis band
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.2, 5.6), new THREE.MeshStandardMaterial({ color: 0x241c20, roughness: 0.4, envMap: env, envMapIntensity: 0.4 }));
  plinth.position.y = 1.1;
  plinth.castShadow = plinth.receiveShadow = true;
  g.add(plinth);
  const band = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.3, 5.7), goldMaterial(env, red));
  band.position.y = 2.05;
  g.add(band);
  const lapis = new THREE.Mesh(new THREE.BoxGeometry(5.65, 0.5, 5.65), new THREE.MeshStandardMaterial({ color: 0x1a3aa0, roughness: 0.25, metalness: 0.2, envMap: env }));
  lapis.position.y = 1.65;
  g.add(lapis);
  return g;
}

function brazier(env: THREE.Texture, state: State): { group: THREE.Group; bowlTop: THREE.Vector3 } {
  const g = new THREE.Group();
  const red = state === 'infected';
  const gold = goldMaterial(env, red);
  // fluted column profile turned on a lathe
  const prof: THREE.Vector2[] = [];
  const pts: [number, number][] = [[1.9, 0], [1.9, 0.5], [1.5, 0.7], [1.35, 1.0], [0.9, 1.3], [0.7, 1.7], [0.6, 6.0], [0.85, 6.25], [0.85, 6.45], [0.6, 6.7], [0.55, 8.9], [0.9, 9.2], [0.8, 9.5]];
  for (const [x, y] of pts) prof.push(new THREE.Vector2(x, y));
  const col = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), gold);
  col.castShadow = true;
  g.add(col);
  const bowlProf: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    bowlProf.push(new THREE.Vector2(0.8 + Math.sin(t * Math.PI * 0.5) * 2.0, 9.5 + (1 - Math.cos(t * Math.PI * 0.5)) * 1.8));
  }
  bowlProf.push(new THREE.Vector2(3.0, 11.4), new THREE.Vector2(2.8, 11.45));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProf, 64), gold);
  bowl.castShadow = true;
  g.add(bowl);
  // glowing coals in the bowl
  const coals = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 48),
    new THREE.MeshBasicMaterial({ color: red ? new THREE.Color(6, 0.5, 0.3) : new THREE.Color(6, 2.4, 0.6) }),
  );
  coals.rotation.x = -Math.PI / 2;
  coals.position.y = 11.0;
  g.add(coals);
  const light = new THREE.PointLight(red ? 0xff3020 : 0xff8a30, red ? 420 : 320, 0, 2);
  light.position.y = 13.5;
  g.add(light);
  return { group: g, bowlTop: new THREE.Vector3(0, 11.2, 0) };
}

/* ------------------------------------------------------------------ scene */

export async function renderTemple3D(state: State, scale = 4 / 3): Promise<{ canvas: HTMLCanvasElement; marks: Marks }> {
  const W = Math.round(OUT_W * scale);
  const H = Math.round(OUT_H * scale);
  const red = state === 'infected';
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = red ? 0.95 : 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.FogExp2(red ? 0x2a0406 : 0x0e0e22, red ? 0.0036 : 0.0042);

  const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 3000);
  camera.position.set(0, 8, 78);
  camera.lookAt(0, 26, -40);
  camera.updateMatrixWorld();

  // sky dome backdrop and moon
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2200, 1100), new THREE.MeshBasicMaterial({ map: skyTexture(state), fog: false, depthWrite: false }));
  sky.position.set(0, 420, -900);
  sky.lookAt(camera.position);
  scene.add(sky);
  const moonPos = new THREE.Vector3(-210, 250, -700);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(46, 64),
    new THREE.MeshBasicMaterial({ map: moonTexture(state), transparent: true, fog: false, color: red ? new THREE.Color(1.5, 0.45, 0.4) : new THREE.Color(0.82, 0.8, 0.76), depthWrite: false }),
  );
  moon.position.copy(moonPos);
  moon.lookAt(camera.position);
  scene.add(moon);

  // lights
  const moonLight = new THREE.DirectionalLight(red ? 0xff5040 : 0xa8b8ff, red ? 2.4 : 3.2);
  moonLight.position.set(-140, 100, 20);
  moonLight.target.position.set(0, 10, -40);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(4096, 4096);
  const sc = moonLight.shadow.camera;
  sc.left = -110;
  sc.right = 110;
  sc.top = 110;
  sc.bottom = -60;
  sc.near = 10;
  sc.far = 400;
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.04;
  moonLight.shadow.radius = 3;
  scene.add(moonLight, moonLight.target);
  const rim = new THREE.DirectionalLight(red ? 0xff2010 : 0xff8a50, red ? 1.4 : 0.7);
  rim.position.set(80, 30, -160);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(red ? 0x5a1010 : 0x1c2448, red ? 0x200404 : 0x120a06, red ? 0.35 : 0.22));

  /** additive light effects: drawn in the beauty pass but kept out of the occlusion */
  const glowOnly: THREE.Object3D[] = [];

  // the great pyramid, block by block
  const stone = limestone();
  const B = 52;
  const PH = 64;
  const PZ = -48;
  const courses = 58;
  const ch = PH / courses;
  const blockW = 2.7;
  const blocks: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const r = rng(101);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < courses; k++) {
    const half = B * (1 - k / courses);
    const y = k * ch + ch / 2;
    const depth = (B / courses) * 2.2;
    for (let side = 0; side < 4; side++) {
      q.setFromAxisAngle(up, (side * Math.PI) / 2);
      // blocks of irregular length with staggered joints, like real masonry
      let x = -half + (k % 2 ? blockW * 0.45 * r() : 0) - blockW * 0.5;
      while (x < half) {
        const len = blockW * (0.65 + r() * 0.9);
        const x0 = Math.max(-half, x);
        const x1 = Math.min(half, x + len);
        x += len;
        if (x1 - x0 < 0.4) continue;
        if (r() < 0.01 && k > 2 && k < courses - 3) continue; // missing block
        const out = r() < 0.07 ? (r() - 0.5) * 0.45 : 0;
        const local = new THREE.Vector3((x0 + x1) / 2, y + (r() - 0.5) * 0.05, half - depth / 2 + out);
        local.applyQuaternion(q);
        const s = new THREE.Vector3((x1 - x0) * (0.95 + r() * 0.03), ch * (0.93 + r() * 0.05), depth);
        m.compose(local, q, s);
        blocks.push(m.clone());
        const tone = 0.8 + r() * 0.28 - (r() < 0.1 ? 0.16 : 0);
        colors.push(new THREE.Color(tone, tone * (0.96 + r() * 0.04), tone * (0.9 + r() * 0.06)));
      }
    }
  }
  const blockMat = new THREE.MeshStandardMaterial({
    map: stone.map,
    normalMap: stone.normal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: stone.rough,
    roughness: 0.92,
    color: red ? 0xd08070 : 0xffffff,
    envMap: env,
    envMapIntensity: 0.04,
  });
  const blockMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.09), blockMat, blocks.length);
  blocks.forEach((mm, i) => {
    blockMesh.setMatrixAt(i, mm);
    blockMesh.setColorAt(i, colors[i]);
  });
  blockMesh.castShadow = blockMesh.receiveShadow = true;
  const pyramid = new THREE.Group();
  pyramid.add(blockMesh);
  // core so nothing shows through the gaps
  const core = new THREE.Mesh(new THREE.ConeGeometry(B * Math.SQRT2 * 0.97, PH * 0.98, 4, 1), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }));
  core.rotation.y = Math.PI / 4;
  core.position.y = (PH * 0.98) / 2;
  pyramid.add(core);
  // gold capstone
  const capH = 5.5;
  const capGeo = new THREE.ConeGeometry((B / courses) * 3 * Math.SQRT2, capH, 4, 1);
  capGeo.rotateY(Math.PI / 4);
  const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xe8a830, metalness: 1, roughness: 0.2, envMap: env, envMapIntensity: 1.3, emissive: red ? 0xff2010 : 0x8a4a08, emissiveIntensity: red ? 1.0 : 0.5 }));
  cap.position.y = PH - 3 * ch + capH / 2;
  cap.castShadow = true;
  pyramid.add(cap);
  // molten cracks on the faces: blazing in the bonus, dormant embers at night
  if (red) {
    const n = new THREE.Vector3(0, B, PH).normalize().multiplyScalar(0.9);
    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute('position', new THREE.Float32BufferAttribute([-B + n.x, n.y, B + n.z, B + n.x, n.y, B + n.z, n.x, PH + n.y, n.z], 3));
    faceGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    for (let side = 0; side < 4; side++) {
      const ct = crackTexture(300 + side * 17, 3);
      const mat = new THREE.MeshBasicMaterial({
        map: ct,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: new THREE.Color(1.5, 0.24, 0.12),
        fog: false,
      });
      const face = new THREE.Mesh(faceGeo, mat);
      face.rotation.y = (side * Math.PI) / 2;
      pyramid.add(face);
      glowOnly.push(face);
    }
  }
  pyramid.position.set(0, 0, PZ);
  pyramid.rotation.y = 0.62;
  scene.add(pyramid);
  if (red) {
    // the infection's beam from the capstone into the clouds
    for (const [rad, op] of [[5, 0.25], [2, 0.6], [0.7, 1]] as const) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(rad * 1.6, rad * 0.4, 420, 32, 1, true),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(3 * op, 0.4 * op, 0.25 * op), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      );
      beam.position.set(0, PH + 210, PZ);
      scene.add(beam);
      glowOnly.push(beam);
    }
  }

  // distant pyramids and dunes in the haze
  const sand = new THREE.MeshStandardMaterial({ color: red ? 0x4a1612 : 0x3a2e2a, roughness: 1 });
  for (const [x, z, s, ry] of [[-150, -260, 0.55, 0.3], [170, -300, 0.7, 0.9], [-60, -420, 0.4, 0.5]] as const) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(B * Math.SQRT2 * s, PH * s, 4, 1), sand);
    p.position.set(x, (PH * s) / 2, z);
    p.rotation.y = ry;
    scene.add(p);
  }
  const duneGeo = new THREE.PlaneGeometry(1600, 500, 160, 50);
  const dn = fbm(55, 2, 4);
  const dp = duneGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) dp.setZ(i, dn(dp.getX(i) / 1600 + 0.5, dp.getY(i) / 500 + 0.5) * 34 - 8);
  duneGeo.computeVertexNormals();
  const dunes = new THREE.Mesh(duneGeo, sand);
  dunes.rotation.x = -Math.PI / 2;
  dunes.position.set(0, -2, -380);
  dunes.receiveShadow = true;
  scene.add(dunes);

  // polished stone floor: a mirror under semi-opaque tiles
  const mirror = new Reflector(new THREE.PlaneGeometry(900, 900), { textureWidth: W / 2, textureHeight: H / 2, color: 0x8a8a8a, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, -100);
  scene.add(mirror);
  const tiles = floorTiles();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: tiles.map, normalMap: tiles.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.38, metalness: 0.05, transparent: true, opacity: 0.8, envMap: env, envMapIntensity: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.02, -100);
  floor.receiveShadow = true;
  scene.add(floor);

  // foreground props framing the reels
  const obPos = [new THREE.Vector3(-33, 0, 2), new THREE.Vector3(33, 0, 2)];
  obPos.forEach((p, i) => {
    const o = obelisk(env, state, 7 + i * 13);
    o.position.copy(p);
    o.rotation.y = i ? -0.35 : 0.35;
    scene.add(o);
  });
  const brPos = [new THREE.Vector3(-17, 0, 30), new THREE.Vector3(17, 0, 30)];
  const bowlTops: THREE.Vector3[] = [];
  brPos.forEach((p) => {
    const b = brazier(env, state);
    b.group.position.copy(p);
    scene.add(b.group);
    bowlTops.push(b.bowlTop.clone().add(p));
  });

  // render: bloom for the glows, ACES grading, MSAA
  const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  // ambient occlusion: dark joints between the blocks, contact shadows under the props
  const gtao = new GTAOPass(scene, camera, W, H);
  gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 12 });
  gtao.blendIntensity = 1;
  const aoRender = gtao.render.bind(gtao);
  gtao.render = (...args: Parameters<typeof aoRender>) => {
    for (const o of glowOnly) o.visible = false;
    aoRender(...args);
    for (const o of glowOnly) o.visible = true;
  };
  composer.addPass(gtao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), red ? 0.55 : 0.5, 0.5, 0.88));
  composer.addPass(new OutputPass());
  composer.render();

  // vignette and grain on a 2D canvas copy
  const [out, octx] = canvas(W, H);
  octx.drawImage(renderer.domElement, 0, 0);
  const vg = octx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  octx.fillStyle = vg;
  octx.fillRect(0, 0, W, H);

  const project = (v: THREE.Vector3): [number, number] => {
    const p = v.clone().project(camera);
    return [Math.round((p.x * 0.5 + 0.5) * OUT_W), Math.round((-p.y * 0.5 + 0.5) * OUT_H)];
  };
  const apexW = new THREE.Vector3(0, PH, 0).applyMatrix4(pyramid.matrixWorld);
  const baseL = project(new THREE.Vector3(-B, 0, B).applyMatrix4(pyramid.matrixWorld));
  const baseR = project(new THREE.Vector3(B, 0, -B).applyMatrix4(pyramid.matrixWorld));
  const moonScreen = project(moonPos);
  const moonEdge = project(moonPos.clone().add(new THREE.Vector3(46, 0, 0)));
  const marks: Marks = {
    apex: project(apexW),
    braziers: bowlTops.map(project),
    obelisks: obPos.map((p) => project(p.clone().add(new THREE.Vector3(0, 36 + 2.2 + 3.4, 0)))),
    moon: [moonScreen[0], moonScreen[1], Math.abs(moonEdge[0] - moonScreen[0])],
    horizon: project(new THREE.Vector3(0, 0, -400))[1],
    pyramidHalf: Math.round(Math.max(Math.abs(baseL[0] - OUT_W / 2), Math.abs(baseR[0] - OUT_W / 2))),
    corners: [[-B, B], [B, B], [B, -B], [-B, -B]].map(([x, z]) => project(new THREE.Vector3(x, 0, z).applyMatrix4(pyramid.matrixWorld))),
    shafts: obPos.map((p) => [project(p.clone().add(new THREE.Vector3(0, 2.2, 0))), project(p.clone().add(new THREE.Vector3(0, 38.2, 0)))]),
  };
  renderer.dispose();
  return { canvas: out, marks };
}
