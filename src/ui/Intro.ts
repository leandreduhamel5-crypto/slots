import { Sym } from '../math/config';

const SKIP_KEY = 'codex-infecta:skip-intro';

/**
 * Title screen shown once the assets are ready: the three things a player needs to know,
 * and a button whose click also unlocks Web Audio.
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
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `
    <div class="intro-inner">
      <img class="intro-logo" src="${logo}" alt="Codex Infecta">
      <div class="intro-cards">
        <div class="intro-card">
          <div class="intro-art"><img src="${images[Sym.CODEX]}" alt=""><img src="${images[Sym.CODEX]}" alt=""><img src="${images[Sym.CODEX]}" alt=""></div>
          <h3>3 Codex</h3>
          <p>déclenchent <b>10 tours gratuits</b>. Le Codex est aussi joker.</p>
        </div>
        <div class="intro-card featured">
          <div class="intro-art expand"><img src="${images[Sym.ZERO]}" alt=""><img src="${images[Sym.ZERO]}" alt=""><img src="${images[Sym.ZERO]}" alt=""></div>
          <h3>La souche</h3>
          <p>s'étend sur <b>tout le rouleau</b> et paie sur les 10 lignes.</p>
        </div>
        <div class="intro-card">
          <div class="intro-art"><img src="${images[Sym.MASK]}" alt=""><img src="${images[Sym.HEART]}" alt=""><img src="${images[Sym.SERUM]}" alt=""></div>
          <h3>Mutation</h3>
          <p>chaque relance ajoute <b>+10 tours</b> et une <b>nouvelle souche</b>.</p>
        </div>
      </div>
      <button class="intro-play">Entrer</button>
      <label class="intro-skip"><input type="checkbox"> Ne plus afficher</label>
      <p class="intro-note">Jeu de démonstration · crédits fictifs sans valeur · gain max 5 000×</p>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const start = () => {
    const box = el.querySelector<HTMLInputElement>('.intro-skip input')!;
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
  el.querySelector('.intro-play')!.addEventListener('click', start);
}
