import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/800.css';
import { SYMBOLS } from './math/config';
import { MATERIALS, render3DText } from './game/art/painters';
import { buildSymbolTextures } from './game/textures';
import { eyeFromCodex, paintLogo } from './game/Logo';

/** Dev art-review sheet: every generated asset on one page. */
async function main(): Promise<void> {
  await document.fonts.load('400 64px "Luckiest Guy"');
  const root = document.getElementById('gallery')!;
  const section = (title: string, items: [string, HTMLCanvasElement | string][], dark = true) => {
    const h = document.createElement('h2');
    h.textContent = title;
    const row = document.createElement('div');
    row.className = 'row' + (dark ? ' dark' : '');
    for (const [label, src] of items) {
      const f = document.createElement('figure');
      const el = typeof src === 'string' ? Object.assign(new Image(), { src }) : src;
      f.append(el, Object.assign(document.createElement('figcaption'), { textContent: label }));
      row.append(f);
    }
    root.append(h, row);
  };
  section(
    'Matières 3D',
    Object.entries(MATERIALS).map(([k, m]) => [k, render3DText('A', { size: 150, material: m })]),
  );
  const tex = await buildSymbolTextures();
  section('Symboles', SYMBOLS.map((s, i) => [s.name, tex.canvases[i]]));
  const eye = eyeFromCodex(tex.canvases[0], tex.canvases[0].width);
  section('Logo', [['logo', paintLogo(eye)]], false);
}

void main();
