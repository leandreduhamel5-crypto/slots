import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/cinzel-decorative/900.css';
import '@fontsource/creepster/400.css';
import './style.css';
import { Application } from 'pixi.js';
import gsap from 'gsap';
import { Game } from './game/Game';
import { bookCanvas, buildSymbolTextures } from './game/textures';
import { buildMascotTextures } from './game/Mascot';
import { warmDigits } from './game/Digits';
import { loadAssets } from './game/assets';
import { loadEgyptArt } from './game/art/egypt';

async function boot(): Promise<void> {
  const progress = document.getElementById('loader-bar');
  const setProgress = (p: number) => progress?.style.setProperty('--p', String(p));

  await Promise.all([
    document.fonts.load('400 64px "Luckiest Guy"'),
    document.fonts.load('700 64px Nunito'),
    document.fonts.load('800 64px Nunito'),
    document.fonts.load('900 64px Nunito'),
    document.fonts.load('900 64px Cinzel'),
    document.fonts.load('900 64px "Cinzel Decorative"'),
    document.fonts.load('400 64px Creepster'),
  ]);
  setProgress(0.3);

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#07080b',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.getElementById('stage')!.appendChild(app.canvas);
  setProgress(0.55);

  const [assets, egypt] = await Promise.all([loadAssets(), loadEgyptArt()]);
  // built-in painted art first, then anything the user dropped into public/assets wins
  const symbolArt = new Map([...egypt.symbols, ...assets.symbols]);
  const [tex, mascot] = await Promise.all([buildSymbolTextures(symbolArt), buildMascotTextures(egypt.symbols.get('mask')!)]);
  warmDigits([118, 114, 56, 54]);
  setProgress(1);

  const game = new Game(app, tex, bookCanvas(), mascot, assets, egypt.extra.templeNight, egypt.extra.templeInfected);
  if (import.meta.env.DEV) Object.assign(window, { game, app, gsap });

  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 900);
  }
}

void boot();
