import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/cinzel-decorative/900.css';
import '@fontsource/creepster/400.css';
import './style.css';
import { Application, TextureSource } from 'pixi.js';
import gsap from 'gsap';
import { Game } from './game/Game';
import { bookCanvas, buildSymbolTextures } from './game/textures';
import { buildMascotTextures } from './game/Mascot';
import { warmDigits } from './game/Digits';
import { loadAssets } from './game/assets';
import { loadEgyptArt } from './game/art/egypt';

// large art shown small must be filtered through mipmaps, or it shimmers and looks pixelated
TextureSource.defaultOptions.autoGenerateMipmaps = true;

async function boot(): Promise<void> {
  const loader = document.getElementById('loader');
  const percent = document.getElementById('loader-percent');
  const setProgress = (p: number) => {
    loader?.style.setProperty('--p', String(p));
    if (percent) percent.textContent = `${Math.round(p * 100)} %`;
  };
  setProgress(0.08);

  await Promise.all([
    document.fonts.load('400 64px "Luckiest Guy"'),
    document.fonts.load('700 64px Nunito'),
    document.fonts.load('800 64px Nunito'),
    document.fonts.load('900 64px Nunito'),
    document.fonts.load('700 64px Cinzel'),
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
    powerPreference: 'high-performance',
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.getElementById('stage')!.appendChild(app.canvas);
  setProgress(0.5);

  const [assets, egypt] = await Promise.all([loadAssets(), loadEgyptArt()]);
  // built-in painted art first, then anything the user dropped into public/assets wins
  setProgress(0.72);
  const symbolArt = new Map([...egypt.symbols, ...assets.symbols]);
  const [tex, mascot] = await Promise.all([buildSymbolTextures(symbolArt, egypt.extra.frame), buildMascotTextures(egypt.extra.cleoFull)]);
  warmDigits([118, 114, 56, 54]);
  setProgress(1);

  const game = new Game(app, tex, bookCanvas(), mascot, assets, egypt.extra.templeNight, egypt.extra.templeInfected, egypt.extra.logo);
  if (import.meta.env.DEV) Object.assign(window, { game, app, gsap });

  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 600);
  }
}

void boot();
