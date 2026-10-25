import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import './style.css';
import { Application } from 'pixi.js';
import { Game } from './game/Game';
import { buildSymbolTextures } from './game/textures';

async function boot(): Promise<void> {
  const progress = document.getElementById('loader-bar');
  const setProgress = (p: number) => progress?.style.setProperty('--p', String(p));

  await Promise.all([
    document.fonts.load('900 64px Cinzel'),
    document.fonts.load('700 64px Cinzel'),
    document.fonts.load('700 64px Rajdhani'),
    document.fonts.load('600 64px Rajdhani'),
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

  const tex = await buildSymbolTextures();
  setProgress(1);

  const game = new Game(app, tex, tex.canvases[0]);
  if (import.meta.env.DEV) Object.assign(window, { game, app });

  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 900);
  }
}

void boot();
