import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/900.css';
import { PAINTED } from './game/art/premium';
import { downsample } from './game/art/paint';
import { ORB, SRES, paintSpectre } from './game/art/spectre';
import { paintRoyal } from './game/art/royals';

/** Dev-only: renders the painted premium symbols large and at reel size. ?only=blood to focus one. */
async function run(): Promise<void> {
  await Promise.all([document.fonts.load('400 64px "Luckiest Guy"'), document.fonts.load('900 64px Nunito')]);
  const out = document.getElementById('out')!;
  const only = new URLSearchParams(location.search).get('only');
  if (only === 'royals') {
    for (const key of ['a', 'k', 'q', 'j', 'ten']) {
      const big = paintRoyal(key);
      big.style.width = '256px';
      const sm = downsample(big, 320);
      sm.style.width = sm.style.height = '150px';
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.append(big, sm);
      out.append(cell);
    }
    document.body.dataset.ready = '1';
    return;
  }
  if (only === 'spectre') {
    const sp = paintSpectre();
    for (const [name, parts] of Object.entries(sp)) {
      const c = document.createElement('canvas');
      c.width = parts.cloak.width;
      c.height = parts.cloak.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(parts.cloak, 0, 0);
      if (name === 'rage') ctx.drawImage(parts.horns, 0, 0);
      ctx.drawImage(parts.handL, 0, 0);
      ctx.drawImage(parts.face, 0, 0);
      ctx.drawImage(parts.eyeArt, 0, 0);
      ctx.drawImage(parts.jaw, 0, 0);
      ctx.drawImage(parts.handR, 0, 0);
      ctx.drawImage(parts.orb, (ORB.x - 60) * SRES, (ORB.y - 60) * SRES);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(parts.eyes, 0, 0);
      c.style.width = '400px';
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.append(c);
      out.append(cell);
    }
    document.body.dataset.ready = '1';
    return;
  }
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
