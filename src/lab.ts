import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/900.css';
import { PAINTED } from './game/art/premium';
import { downsample } from './game/art/paint';

/** Dev-only: renders the painted premium symbols large and at reel size. ?only=blood to focus one. */
async function run(): Promise<void> {
  await Promise.all([document.fonts.load('400 64px "Luckiest Guy"'), document.fonts.load('900 64px Nunito')]);
  const out = document.getElementById('out')!;
  const only = new URLSearchParams(location.search).get('only');
  for (const [key, fn] of Object.entries(PAINTED)) {
    if (only && only !== key) continue;
    const s = fn();
    const big = document.createElement('div');
    big.className = 'cell';
    const full = s.base;
    const ctx = full.getContext('2d')!;
    for (const [name, p] of Object.entries(s.parts)) if (name !== 'lid') ctx.drawImage(p, 0, 0);
    big.append(full);
    const small = document.createElement('div');
    small.className = 'cell';
    const sm = downsample(full, 320);
    sm.style.width = sm.style.height = '150px';
    small.append(sm, document.createElement('br'), key);
    out.append(big, small);
  }
  document.body.dataset.ready = '1';
}
void run();
