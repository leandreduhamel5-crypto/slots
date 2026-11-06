import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import './style.css';
import { Application, TextureSource } from 'pixi.js';
import gsap from 'gsap';
import { Game } from './game/Game';
import { LITE } from './game/device';
import { bookCanvas, buildSymbolTextures } from './game/textures';
import { warmDigits } from './game/Digits';
import { loadAssets } from './game/assets';
import { loadEgyptArt } from './game/art/egypt';
import { watchForUpdates } from './update';

// large art shown small must be filtered through mipmaps, or it shimmers and looks pixelated
TextureSource.defaultOptions.autoGenerateMipmaps = true;

/** The browser can take the graphics away (low memory, a locked phone). Pixi gets them back by itself; failing that the page reloads, and the round in play is saved. */
function watchContext(canvas: HTMLCanvasElement): void {
  let timer = 0;
  canvas.addEventListener('webglcontextlost', () => (timer = window.setTimeout(() => location.reload(), 4000)));
  canvas.addEventListener('webglcontextrestored', () => clearTimeout(timer));
}

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
  ]);
  setProgress(0.3);

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#07080b',
    antialias: !LITE,
    powerPreference: 'high-performance',
    resolution: Math.min(window.devicePixelRatio || 1, LITE ? 1.5 : 2),
    autoDensity: true,
  });
  if (LITE) app.ticker.maxFPS = 60;
  watchContext(app.canvas);
  document.getElementById('stage')!.appendChild(app.canvas);
  setProgress(0.5);

  const [assets, egypt] = await Promise.all([loadAssets(), loadEgyptArt()]);
  // built-in painted art first, then anything the user dropped into public/assets wins
  setProgress(0.72);
  const symbolArt = new Map([...egypt.symbols, ...assets.symbols]);
  const tex = await buildSymbolTextures(symbolArt, egypt.extra.frame);
  warmDigits([118, 114, 56, 54]);
  setProgress(1);

  const x = egypt.extra;
  const sands = { outside: x.pyramidNight, infected: x.pyramidInfected, door: x.pyramidDoor, lava: x.pyramidLava, hallMaps: [x.templeMapA, x.templeMapB], pyramidMaps: [x.pyramidMapA, x.pyramidMapB] };
  const game = new Game(app, tex, bookCanvas(), assets, x.templeNight, sands, x.logo, x.corridorDoor);
  if (import.meta.env.DEV) Object.assign(window, { game, app, gsap });
  else watchForUpdates(() => game.playing);

  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 600);
  }
}

boot().catch((e: unknown) => {
  console.error(e);
  const caption = document.querySelector('.ld-caption');
  if (caption) caption.textContent = "Le jeu n'a pas pu démarrer sur cet appareil. Essaie un autre navigateur, ou active l'accélération graphique.";
});
