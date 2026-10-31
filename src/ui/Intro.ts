import { Sym } from '../math/config';
import cleo from '../game/art/egypt/cleo_full.webp';
import temple from '../game/art/egypt/temple_night.webp';

const SKIP_KEY = 'codex-infecta:skip-intro';

/**
 * Title screen shown once the assets are ready: the queen before her temple, the logo, the three
 * things a player needs to know, and a button whose click also unlocks Web Audio.
 */
export function showIntro(logo: string, images: string[], onStart: () => void): void {
  let skip = false;
  try {
    skip = localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    /* storage unavailable */
  }
  if (skip) {
    onStart();
    return;
  }
  const cell = (s: Sym) => `<img src="${images[s]}" alt="">`;
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `
    <div class="ti-sky" style="background-image:url(${temple})"></div>
    <div class="ti-rays"></div>
    <div class="ti-sand">${'<i></i>'.repeat(14)}</div>
    <img class="ti-queen" src="${cleo}" alt="">
    <div class="ti-main">
      <img class="ti-logo" src="${logo}" alt="Book of Infection">
      <p class="ti-tag">Ouvrez la pyramide. Libérez la souche.</p>
      <div class="ti-cards">
        <div class="ti-card">
          <div class="ti-art fan"><img src="${images[Sym.CODEX]}" alt=""><img src="${images[Sym.CODEX]}" alt=""><img src="${images[Sym.CODEX]}" alt=""></div>
          <h3>3 Pyramides</h3>
          <p><b>10 tours gratuits</b><br>La Pyramide est aussi joker</p>
        </div>
        <div class="ti-card lead">
          <div class="ti-art board">
            <div class="ti-reel">${cell(Sym.MASK)}${cell(Sym.ANTIDOTE)}${cell(Sym.BLOOD)}</div>
            <div class="ti-reel on">${cell(Sym.ZERO)}${cell(Sym.ZERO)}${cell(Sym.ZERO)}</div>
            <div class="ti-reel">${cell(Sym.BLOOD)}${cell(Sym.MASK)}${cell(Sym.ANTIDOTE)}</div>
          </div>
          <h3>La souche</h3>
          <p>Envahit <b>tout le rouleau</b><br>et paie sur les 10 lignes</p>
        </div>
        <div class="ti-card">
          <div class="ti-art row"><img src="${images[Sym.MASK]}" alt=""><img src="${images[Sym.BLOOD]}" alt=""><img src="${images[Sym.ANTIDOTE]}" alt=""></div>
          <h3>Mutation</h3>
          <p><b>+10 tours</b> à chaque relance<br>et une nouvelle souche</p>
        </div>
      </div>
      <button class="ti-play"><span>Entrer</span></button>
      <label class="ti-skip"><input type="checkbox"> Ne plus afficher</label>
    </div>
    <p class="ti-note">Jeu de démonstration · crédits fictifs sans valeur · gain max 5 000×</p>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const start = () => {
    window.removeEventListener('keydown', onKey);
    const box = el.querySelector<HTMLInputElement>('.ti-skip input')!;
    try {
      if (box.checked) localStorage.setItem(SKIP_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    el.classList.remove('show');
    el.classList.add('leave');
    setTimeout(() => el.remove(), 900);
    onStart();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') start();
  };
  window.addEventListener('keydown', onKey);
  el.querySelector('.ti-play')!.addEventListener('click', start);
}
