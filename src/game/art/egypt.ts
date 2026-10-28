/**
 * "Book of Infection" painted artwork (from the art-direction concept sheet), matted onto
 * transparency. Keys are the game's symbol keys; extra art (pyramid, virus…) is used by screens.
 */
import pharaoh from './egypt/pharaoh.webp';
import anubis from './egypt/anubis.webp';
import scarab from './egypt/scarab.webp';
import horus from './egypt/horus.webp';
import a from './egypt/a.webp';
import k from './egypt/k.webp';
import q from './egypt/q.webp';
import j from './egypt/j.webp';
import ten from './egypt/ten.webp';
import pyramid from './egypt/pyramid.webp';
import virus from './egypt/virus.webp';
import templeNight from './egypt/temple_night.webp';
import templeInfected from './egypt/temple_infected.webp';

export const SYMBOL_ART_URLS: Record<string, string> = {
  // the red pyramid from the concept sheet is the wild/scatter
  codex: pyramid,
  zero: pharaoh,
  mask: anubis,
  antidote: scarab,
  blood: horus,
  a,
  k,
  q,
  j,
  ten,
};

export const EXTRA_ART_URLS = { pyramid, virus, templeNight, templeInfected };

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadEgyptArt(): Promise<{ symbols: Map<string, HTMLImageElement>; extra: Record<keyof typeof EXTRA_ART_URLS, HTMLImageElement> }> {
  const symbols = new Map<string, HTMLImageElement>();
  await Promise.all(Object.entries(SYMBOL_ART_URLS).map(async ([key, url]) => symbols.set(key, await load(url))));
  const keys = Object.keys(EXTRA_ART_URLS) as (keyof typeof EXTRA_ART_URLS)[];
  const imgs = await Promise.all(keys.map((k) => load(EXTRA_ART_URLS[k])));
  const extra = Object.fromEntries(keys.map((k, i) => [k, imgs[i]])) as Record<keyof typeof EXTRA_ART_URLS, HTMLImageElement>;
  return { symbols, extra };
}
