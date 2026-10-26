/**
 * Optional professional artwork. Drop files in public/assets/ and list them in
 * public/assets/manifest.json; anything listed replaces the procedurally drawn version.
 */
export interface AssetManifest {
  /** symbol key (codex, zero, mask, antidote, blood, a, k, q, j, ten) → file */
  symbols: Record<string, string>;
  background: string | null;
  logo: string | null;
}

const EMPTY: AssetManifest = { symbols: {}, background: null, logo: null };

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export interface LoadedAssets {
  symbols: Map<string, HTMLImageElement>;
  background: HTMLImageElement | null;
  logo: HTMLImageElement | null;
}

export async function loadAssets(): Promise<LoadedAssets> {
  let manifest = EMPTY;
  try {
    const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = { ...EMPTY, ...(await res.json()) };
  } catch {
    /* no manifest: everything stays procedural */
  }
  const symbols = new Map<string, HTMLImageElement>();
  await Promise.all(
    Object.entries(manifest.symbols).map(async ([key, file]) => {
      const img = await loadImage(`assets/${file}`);
      if (img) symbols.set(key, img);
    }),
  );
  const [background, logo] = await Promise.all([
    manifest.background ? loadImage(`assets/${manifest.background}`) : null,
    manifest.logo ? loadImage(`assets/${manifest.logo}`) : null,
  ]);
  return { symbols, background, logo };
}

/** Draws an image centred and contained in a square canvas. */
export function containCanvas(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const k = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  c.getContext('2d')!.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return c;
}

/** Draws an image scaled to cover a w×h canvas (centre crop). */
export function coverCanvas(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  c.getContext('2d')!.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}
