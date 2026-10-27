import { MATERIALS, glossyDrip, render3DText } from './painters';
import { P, groundShadow, layer } from './paint';

const C = P / 2;

function letter(ctx: CanvasRenderingContext2D, text: string, size: number, material: string, dx = 0, dy = 0): void {
  const l = render3DText(text, { size, material: MATERIALS[material] });
  ctx.drawImage(l, C - l.width / 2 + dx, C - l.height / 2 + dy);
}

/** Clean royals: one glossy 3D letter in its material and a single drip — they sit a step behind the premiums. */
const CLEAN: Record<string, { text: string; material: string; drip: [string, string, string]; size: number; dx: number }> = {
  a: { text: 'A', material: 'blood', drip: ['#ff8a96', '#e0213a', '#7a0418'], size: 380, dx: 70 },
  k: { text: 'K', material: 'steel', drip: ['#c8fbff', '#38dcff', '#0f5f86'], size: 380, dx: 62 },
  q: { text: 'Q', material: 'toxic', drip: ['#efd6ff', '#a85cf0', '#4a1488'], size: 380, dx: 52 },
  j: { text: 'J', material: 'slime', drip: ['#e2ffcc', '#6fd04a', '#1d6a18'], size: 380, dx: -48 },
  ten: { text: '10', material: 'rust', drip: ['#ffe0a8', '#f08a2a', '#7a3006'], size: 316, dx: 40 },
};

export function paintRoyal(key: string): HTMLCanvasElement {
  const [c, ctx] = layer();
  const r = CLEAN[key];
  groundShadow(ctx, C, P - 44, 140, 12, 0.4);
  letter(ctx, r.text, r.size, r.material, 0, -6);
  glossyDrip(ctx, C + r.dx, C + r.size * 0.3, 56, 15, r.drip);
  return c;
}

