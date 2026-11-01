/**
 * "Book of Infection" painted artwork (from the art-direction concept sheet), matted onto
 * transparency. Keys are the game's symbol keys; extra art (pyramid…) is used by screens.
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
import cleoFull from './egypt/cleo_full.webp';
import frame from './egypt/frame.webp';
import logo from './egypt/logo.webp';
import templeNight from './egypt/temple_night.webp';
import templeInfected from './egypt/temple_infected.webp';
import templeNightLite from './egypt/temple_night_m.webp';
import templeInfectedLite from './egypt/temple_infected_m.webp';
import dunesBack from './egypt/dunes_back.webp';
import dunesFront from './egypt/dunes_front.webp';
import palmATrunk from './egypt/palm_a_trunk.webp';
import palmACrown from './egypt/palm_a_crown.webp';
import palmBTrunk from './egypt/palm_b_trunk.webp';
import palmBCrown from './egypt/palm_b_crown.webp';
import ruinColumn from './egypt/ruin_column.webp';
import { LITE } from '../device';

/** the sky of the title screen and of the game */
export const TEMPLE_NIGHT_URL = LITE ? templeNightLite : templeNight;

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

export const EXTRA_ART_URLS = { pyramid, templeNight: TEMPLE_NIGHT_URL, templeInfected: LITE ? templeInfectedLite : templeInfected, cleoFull, frame, logo, dunesBack, dunesFront, palmATrunk, palmACrown, palmBTrunk, palmBCrown, ruinColumn };

/** the foreground of the backdrop, painted by tools/paint_decor.py */
export type DecorArt = Record<'dunesBack' | 'dunesFront' | 'palmATrunk' | 'palmACrown' | 'palmBTrunk' | 'palmBCrown' | 'ruinColumn', HTMLImageElement>;

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
