import { makeCanvas, seeded } from './painters';

/**
 * Title lettering rendered like a cast-metal logo: the glyph mask is turned into a height field
 * (a blurred mask clipped to the letters), its gradient gives a normal per pixel, and that
 * normal is lit — diffuse, a sharp specular and a reflected-environment ramp that makes the
 * typical bands of polished gold. Layers: drop shadow, dark backing rim, gold outline, the
 * beveled face, optional molten cracks glowing inside the letters.
 */

type Ctx = CanvasRenderingContext2D;

export interface MetalSpec {
  /** environment ramp sampled by the facing direction: bright sky to dark ground */
  ramp: [number, string][];
  /** bevel width in px (at the render scale) */
  bevel: number;
  /** strength of the sharp highlight */
  spec: number;
}

export const GOLD: MetalSpec = {
  ramp: [
    [0, '#fffbe6'],
    [0.16, '#ffe08a'],
    [0.34, '#e8a83a'],
    [0.5, '#8a4e0e'],
    [0.6, '#5a300a'],
    [0.72, '#c9862a'],
    [0.86, '#ffd77a'],
    [1, '#7a4208'],
  ],
  bevel: 9,
  spec: 0.9,
};

export const BLOOD_METAL: MetalSpec = {
  ramp: [
    [0, '#ffd8c8'],
    [0.14, '#ff6a50'],
    [0.32, '#d8141c'],
    [0.5, '#6a0208'],
    [0.62, '#3a0004'],
    [0.76, '#b00c14'],
    [0.9, '#ff5a3a'],
    [1, '#5a0006'],
  ],
  bevel: 11,
  spec: 0.75,
};

function rampLUT(stops: [number, string][]): Uint8ClampedArray {
  const [c, ctx] = makeCanvas(256, 1);
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
  void c;
}

/** Alpha channel of a canvas as floats 0..1. */
function alphaOf(c: HTMLCanvasElement): Float32Array {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const a = new Float32Array(c.width * c.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
  return a;
}

function blurred(c: HTMLCanvasElement, r: number): HTMLCanvasElement {
  const [b, ctx] = makeCanvas(c.width, c.height);
  ctx.filter = `blur(${r}px)`;
  ctx.drawImage(c, 0, 0);
  return b;
}

/** Grows a mask by r px, filled with a solid colour. */
export function dilateMask(c: HTMLCanvasElement, r: number, color: string): HTMLCanvasElement {
  const [d, ctx] = makeCanvas(c.width, c.height);
  const steps = Math.max(12, Math.round(r * 2));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(c, Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.drawImage(c, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, d.width, d.height);
  return d;
}

/** Lit, beveled metal face clipped to the mask. */
export function metalFace(mask: HTMLCanvasElement, m: MetalSpec, tilt = 0): HTMLCanvasElement {
  const w = mask.width;
  const h = mask.height;
  const A = alphaOf(mask);
  const H1 = alphaOf(blurred(mask, m.bevel));
  const H2 = alphaOf(blurred(mask, m.bevel * 0.35));
  const lut = rampLUT(m.ramp);
  const [c, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const L = [-0.45, -0.7, 0.55];
  const ll = Math.hypot(L[0], L[1], L[2]);
  L[0] /= ll;
  L[1] /= ll;
  L[2] /= ll;
  const rnd = seeded(5);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = A[i];
      if (a <= 0.01) continue;
      // two bevel scales: a wide rounded body and a crisp edge
      const hx = (H1[i + 1] - H1[i - 1]) * 0.7 + (H2[i + 1] - H2[i - 1]) * 0.5;
      const hy = (H1[i + w] - H1[i - w]) * 0.7 + (H2[i + w] - H2[i - w]) * 0.5;
      const k = 7;
      let nx = -hx * k;
      let ny = -hy * k;
      let nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      // reflection of the view ray picks a band of the environment ramp
      const ry = ny * 0.9 + (y / h - 0.5) * 0.55 + tilt;
      const t = Math.max(0, Math.min(255, Math.round((ry * 0.5 + 0.5) * 255)));
      const hv = Math.max(0, nx * (L[0]) + ny * (L[1]) + (nz + 1) * L[2] * 0.5);
      const spec = Math.pow(Math.max(0, hv), 26) * m.spec;
      const grain = (rnd() - 0.5) * 10;
      const shade = 0.55 + diff * 0.6;
      const p = i * 4;
      img.data[p] = lut[t * 4] * shade + spec * 255 + grain;
      img.data[p + 1] = lut[t * 4 + 1] * shade + spec * 240 + grain;
      img.data[p + 2] = lut[t * 4 + 2] * shade + spec * 210 + grain;
      img.data[p + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Molten cracks running through the letters (clipped to the mask): core, glow layer. */
export function moltenCracks(mask: HTMLCanvasElement, seed: number, density: number): [HTMLCanvasElement, HTMLCanvasElement] {
  const w = mask.width;
  const h = mask.height;
  const rnd = seeded(seed);
  const lines: [number, number][][] = [];
  const grow = (x: number, y: number, a: number, len: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    for (let i = 0; i < 9; i++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * (len / 9);
      y += Math.sin(a) * (len / 9);
      pts.push([x, y]);
    }
    lines.push(pts);
    if (depth > 0) for (let k = 0; k < 2; k++) {
      const p = pts[2 + Math.floor(rnd() * 6)];
      grow(p[0], p[1], a + (rnd() < 0.5 ? 1 : -1), len * 0.5, depth - 1);
    }
  };
  for (let i = 0; i < density; i++) grow(rnd() * w, h * (0.2 + rnd() * 0.6), (rnd() - 0.5) * 2 + (rnd() < 0.5 ? 0 : Math.PI), h * (0.35 + rnd() * 0.4), 2);
  const stroke = (ctx: Ctx, width: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pts of lines) {
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.lineWidth = Math.max(0.8, width * (1 - i / pts.length));
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
    }
  };
  const [core, cc] = makeCanvas(w, h);
  stroke(cc, 7, 'rgba(30,0,2,0.85)');
  stroke(cc, 3.6, '#ff6a20');
  stroke(cc, 1.4, '#fff0b0');
  const [glow, gc] = makeCanvas(w, h);
  gc.filter = 'blur(7px)';
  stroke(gc, 14, 'rgba(255,90,20,1)');
  for (const ctx of [cc, gc]) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.filter = 'none';
    ctx.drawImage(mask, 0, 0);
  }
  return [core, glow];
}

/** Text mask with letter spacing, centred. */
export function textMask(text: string, font: string, size: number, spacing: number, pad: number): HTMLCanvasElement {
  const [, mctx] = makeCanvas(10, 10);
  mctx.font = `900 ${size}px ${font}`;
  const widths = [...text].map((ch) => mctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  const [c, ctx] = makeCanvas(Math.ceil(total + pad * 2), Math.ceil(size * 1.2 + pad * 2));
  ctx.font = `900 ${size}px ${font}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  let x = pad;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, c.height / 2 + size * 0.04);
    x += widths[i] + spacing;
  });
  return c;
}

/**
 * Full metal title block: shadow, black backing, gold outline, lit face, optional cracks.
 * Returns the composed canvas plus the face mask (for live glows).
 */
export function metalTitle(mask: HTMLCanvasElement, m: MetalSpec, o: { outline: number; cracks?: number; seed?: number; tilt?: number }): HTMLCanvasElement {
  const w = mask.width;
  const h = mask.height;
  const [c, ctx] = makeCanvas(w, h);
  // drop shadow
  ctx.save();
  ctx.filter = `blur(${o.outline * 2.4}px)`;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(dilateMask(mask, o.outline * 1.5, '#000'), 0, o.outline * 1.6);
  ctx.restore();
  // dark backing and a gold outline ring
  const goldRim = dilateMask(mask, o.outline, '#000');
  ctx.drawImage(dilateMask(mask, o.outline * 1.9, '#0a0204'), 0, 0);
  ctx.drawImage(metalFace(goldRim, { ...GOLD, bevel: o.outline * 0.9, spec: 1 }, -0.1), 0, 0);
  ctx.drawImage(dilateMask(mask, o.outline * 0.32, '#140406'), 0, 0);
  ctx.drawImage(metalFace(mask, m, o.tilt ?? 0), 0, 0);
  if (o.cracks) {
    const [core, glow] = moltenCracks(mask, o.seed ?? 3, o.cracks);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glow, 0, 0);
    ctx.restore();
    ctx.drawImage(core, 0, 0);
  }
  return c;
}
