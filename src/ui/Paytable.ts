import { LINES, MAX_EXPANDING, MAX_WIN_X, SYMBOLS, Sym, BONUS_BUY_X } from '../math/config';
import { fmt } from './format';

export const THEORETICAL_RTP = '95,8 %';

export class Paytable {
  readonly root: HTMLElement;

  constructor(private images: string[]) {
    this.root = document.createElement('div');
    this.root.id = 'paytable';
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
  }

  open(bet: number): void {
    const lineBet = bet / LINES.length;
    const sym = (s: Sym) => {
      const d = SYMBOLS[s];
      const rows = [5, 4, 3, 2]
        .filter((n) => d.pays[n] > 0)
        .map((n) => {
          const v = s === Sym.CODEX ? d.pays[n] * bet : d.pays[n] * lineBet;
          return `<li><b>${n}×</b><span>${fmt(v)}</span></li>`;
        })
        .join('');
      return `<div class="pt-sym${s <= Sym.BLOOD ? ' premium' : ''}"><img src="${this.images[s]}" alt="${d.name}"><div><h4>${d.name}</h4><ul>${rows}</ul></div></div>`;
    };
    const lineGrid = (rows: number[], i: number) =>
      `<div class="pt-line"><span>${i + 1}</span><div class="grid">${[0, 1, 2]
        .map((row) => [0, 1, 2, 3, 4].map((r) => `<i class="${rows[r] === row ? 'on' : ''}"></i>`).join(''))
        .join('')}</div></div>`;

    this.root.innerHTML = `
      <div class="pt-panel" role="dialog" aria-label="Règles du jeu">
        <button class="pt-close" aria-label="Fermer">×</button>
        <h2>Book of <em>Infection</em></h2>
        <p class="pt-lead">Montants affichés pour une mise de <b>${fmt(bet)}</b>.</p>

        <section class="pt-codex">
          <img src="${this.images[Sym.CODEX]}" alt="Codex">
          <div>
            <h3>La Pyramide : joker et scatter</h3>
            <p>Il remplace tous les symboles sur une ligne. Il paie aussi n'importe où sur les rouleaux, multiplié par la mise totale.</p>
            <p><b>3 Pyramides ou plus</b> déclenchent <b>10 tours gratuits</b>.</p>
            <ul class="pt-inline"><li><b>5×</b> ${fmt(200 * bet)}</li><li><b>4×</b> ${fmt(20 * bet)}</li><li><b>3×</b> ${fmt(2 * bet)}</li></ul>
          </div>
        </section>

        <section>
          <h3>Tours gratuits : la souche</h3>
          <p>Avant les tours gratuits, la Pyramide choisit au hasard un <b>symbole infecté</b>, la souche. Quand elle apparaît sur assez de rouleaux pour payer, elle <b>s'étend sur toute la hauteur de chaque rouleau</b>. Elle paie alors sur les 10 lignes, même si les rouleaux ne sont pas côte à côte.</p>
          <p><b>Mutation</b> : chaque fois que 3 Pyramides retombent pendant les tours gratuits, vous gagnez <b>+10 tours</b> et une <b>souche supplémentaire</b> s'ajoute (jusqu'à ${MAX_EXPANDING} souches actives en même temps).</p>
          <p><b>Achat bonus</b> : pour ${BONUS_BUY_X}× la mise, vous entrez directement dans les tours gratuits.</p>
        </section>

        <section>
          <h3>Paiements</h3>
          <div class="pt-grid">${[Sym.ZERO, Sym.MASK, Sym.ANTIDOTE, Sym.BLOOD, Sym.A, Sym.K, Sym.Q, Sym.J, Sym.TEN].map(sym).join('')}</div>
        </section>

        <section>
          <h3>10 lignes de paiement</h3>
          <div class="pt-lines">${LINES.map(lineGrid).join('')}</div>
          <p>Les gains se lisent de gauche à droite, en partant du premier rouleau. Seul le meilleur gain de chaque ligne est payé. Les gains des différentes lignes s'additionnent.</p>
        </section>

        <section class="pt-facts">
          <div><b>${THEORETICAL_RTP}</b><span>RTP théorique (20 millions de tours simulés)</span></div>
          <div><b>Élevée</b><span>Volatilité</span></div>
          <div><b>${MAX_WIN_X.toLocaleString('fr-FR')}×</b><span>Gain maximal</span></div>
          <div><b>≈ 1 / 250</b><span>Fréquence des tours gratuits</span></div>
        </section>
        <p class="pt-legal">Jeu de démonstration. Les crédits sont fictifs et n'ont aucune valeur. Chaque résultat est tiré au hasard par un générateur cryptographique, sans biais de modulo. En cas de dysfonctionnement, tous les paiements et tous les jeux sont annulés.</p>
      </div>`;
    this.root.querySelector('.pt-close')!.addEventListener('click', () => this.close());
    this.root.classList.add('open');
  }

  close(): void {
    this.root.classList.remove('open');
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }
}
