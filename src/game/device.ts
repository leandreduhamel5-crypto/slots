import { ImageSource, Texture } from 'pixi.js';

const query = new URLSearchParams(location.search);
const touch = window.matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) <= 820;
const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;

/**
 * Phones and small tablets. A mobile browser kills the page that asks for too much graphics memory,
 * so these get lighter art, no antialiasing and no full-screen filters. Add ?lite or ?full to the
 * address to force one or the other.
 */
export const LITE = query.has('full') ? false : query.has('lite') || (touch && small) || memory <= 2;

document.documentElement.classList.toggle('lite', LITE);

/**
 * A painting as a texture. On LITE devices it keeps only k of its pixels but the same logical size,
 * so everything laid out on it stays where it is.
 */
export function slim(art: HTMLCanvasElement | HTMLImageElement, k = 0.5): Texture {
  if (!LITE) return Texture.from(art);
  const image = art instanceof HTMLImageElement;
  const w = image ? art.naturalWidth : art.width;
  const h = image ? art.naturalHeight : art.height;
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art, 0, 0, c.width, c.height);
  return new Texture({ source: new ImageSource({ resource: c, resolution: k }) });
}
