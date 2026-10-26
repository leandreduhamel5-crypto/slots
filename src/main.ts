import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './style.css';
import { Application } from 'pixi.js';
import gsap from 'gsap';
import { Game } from './game/Game';
import { buildSymbolTextures } from './game/textures';
import { buildMascotTextures } from './game/Mascot';
import { warmDigits } from './game/Digits';
import { loadAssets } from './game/assets';

async function boot(): Promise<void> {
  const progress = document.getElementById('loader-bar');
  const setProgress = (p: number) => progress?.style.setProperty('--p', String(p));

  await Promise.all([
    document.fonts.load('400 64px "Luckiest Guy"'),
    document.fonts.load('700 64px Nunito'),
    document.fonts.load('800 64px Nunito'),
    document.fonts.load('900 64px Nunito'),
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

  const assets = await loadAssets();
  const [tex, mascot] = await Promise.all([buildSymbolTextures(assets.symbols), buildMascotTextures()]);
  warmDigits([118, 114, 56, 54]);
  setProgress(1);

  const game = new Game(app, tex, tex.canvases[0], mascot, assets);
  if (import.meta.env.DEV) Object.assign(window, { game, app, gsap });

  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 900);
  }
}

void boot();
