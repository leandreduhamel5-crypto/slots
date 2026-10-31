import { fmt } from './format';

const ICONS = {
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  // papyrus scroll: the rules and pays
  info: '<svg viewBox="0 0 24 24"><path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10v1a2 2 0 0 0 2 2"/><path d="M7 4a2 2 0 0 0-2 2v11"/><path d="M8.5 9.5h4.5M8.5 13h4.5"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M3.5 9.5v5h3.8l5.2 4.3V5.2L7.3 9.5z"/><path d="M15.8 9.2a4 4 0 0 1 0 5.6M18.4 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M3.5 9.5v5h3.8l5.2 4.3V5.2L7.3 9.5z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>',
  turbo: '<svg viewBox="0 0 24 24"><path d="M13.5 2.5L5 13.5h6.2l-1.4 8 8.7-11.2h-6.3z"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 0 1-13.1 5"/><path d="M4.5 12a7.5 7.5 0 0 1 13.1-5"/><path d="M17.8 3.2v4.1h-4.1M6.2 20.8v-4.1h4.1"/></svg>',
  spin: '<svg viewBox="0 0 64 64"><path d="M49 34a17 17 0 1 1-5-13"/><path d="M47.5 10.5v11.2H36.3"/></svg>',
  stop: '<svg viewBox="0 0 64 64"><rect x="22" y="22" width="20" height="20" rx="3"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M6 12h12M12 6v12"/></svg>',
};

/** Shared gradients for the gold line icons (referenced from CSS as url(#hud-gold)). */
const DEFS = `<svg class="hud-defs" width="0" height="0" aria-hidden="true"><defs>
  <linearGradient id="hud-gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff6cf"/><stop offset="0.35" stop-color="#f6c95a"/><stop offset="0.7" stop-color="#c7871f"/><stop offset="1" stop-color="#ffe08a"/>
  </linearGradient>
</defs></svg>`;

export interface HudHandlers {
  spin(): void;
  betDelta(d: number): void;
  toggleTurbo(): void;
  toggleSound(): void;
  openInfo(): void;
  auto(count: number): void;
  refill(): void;
  buy(): void;
}

export class Hud {
  readonly root: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  private autoMenu: HTMLElement;
  private winTween = 0;

  constructor(h: HudHandlers) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'console';
    this.root.innerHTML = `${DEFS}
      <div class="c-zone c-left"></div>
      <div class="c-zone c-center"></div>
      <div class="c-zone c-right"></div>
      <div class="c-row c-row1"></div>
      <div class="c-row c-row2"></div>
      <div class="c-parts">
        <div class="c-sys" data-k="sys">
          <button class="c-btn" data-k="info" aria-label="Règles et paiements">${ICONS.info}</button>
          <button class="c-btn" data-k="sound" aria-label="Son">${ICONS.sound}</button>
        </div>
        <div class="c-meter" data-k="balanceBox"><label>Solde</label><span data-k="balance">0,00</span></div>
        <div class="c-meter c-win" data-k="winBox"><label data-k="winLabel">Gain</label><span data-k="win">0,00</span></div>
        <div class="c-bet" data-k="betBox">
          <button class="c-btn c-step" data-k="betDec" aria-label="Diminuer la mise">${ICONS.minus}</button>
          <div class="c-meter c-betmeter"><label>Mise</label><span data-k="bet">0,00</span></div>
          <button class="c-btn c-step" data-k="betInc" aria-label="Augmenter la mise">${ICONS.plus}</button>
        </div>
        <button class="c-buy" data-k="buy" aria-label="Acheter le bonus"><b>Achat bonus</b><span data-k="buyPrice">0,00</span></button>
        <div class="c-play" data-k="play">
          <button class="c-btn c-auto" data-k="auto" aria-label="Jeu automatique">${ICONS.auto}</button>
          <button class="spin" data-k="spin" aria-label="Lancer"><span class="spin-halo"></span><span class="spin-gleam"></span><span class="spin-icon" data-k="spinIcon">${ICONS.spin}</span><span class="spin-count" data-k="autoCount"></span></button>
          <button class="c-btn c-turbo" data-k="turbo" aria-label="Turbo">${ICONS.turbo}</button>
        </div>
      </div>
      <div class="auto-menu" data-k="autoMenu">
        <p>Tours automatiques</p>
        <div>${[10, 25, 50, 100].map((n) => `<button data-auto="${n}">${n}</button>`).join('')}</div>
      </div>
      <button class="refill" data-k="refill">Recharger 1 000 crédits</button>
      <div class="buy-modal" data-k="buyModal">
        <div class="buy-card">
          <h3>Acheter le bonus</h3>
          <p>Entrez directement dans la pyramide avec <b>10 tours gratuits</b> et une souche qui envahit les rouleaux.</p>
          <div class="buy-cost"><label>Prix</label><span data-k="buyCost">0,00</span></div>
          <div class="buy-actions">
            <button data-k="buyNo">Annuler</button>
            <button class="yes" data-k="buyYes">Acheter</button>
          </div>
        </div>
      </div>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (this.el[e.dataset.k!] = e));
    this.autoMenu = this.el.autoMenu;

    this.el.spin.addEventListener('click', () => h.spin());
    this.el.betDec.addEventListener('click', () => h.betDelta(-1));
    this.el.betInc.addEventListener('click', () => h.betDelta(1));
    this.el.turbo.addEventListener('click', () => h.toggleTurbo());
    this.el.sound.addEventListener('click', () => h.toggleSound());
    this.el.info.addEventListener('click', () => h.openInfo());
    this.el.refill.addEventListener('click', () => h.refill());
    this.el.buy.addEventListener('click', () => this.el.buyModal.classList.add('open'));
    this.el.buyNo.addEventListener('click', () => this.el.buyModal.classList.remove('open'));
    this.el.buyYes.addEventListener('click', () => {
      this.el.buyModal.classList.remove('open');
      h.buy();
    });
    this.el.auto.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.root.classList.contains('autoplaying')) h.auto(0);
      else this.autoMenu.classList.toggle('open');
    });
    this.autoMenu.querySelectorAll<HTMLButtonElement>('[data-auto]').forEach((b) =>
      b.addEventListener('click', () => {
        this.autoMenu.classList.remove('open');
        h.auto(Number(b.dataset.auto));
      }),
    );
    document.addEventListener('click', () => this.autoMenu.classList.remove('open'));
    this.arrange();
    window.addEventListener('resize', () => this.arrange());
  }

  /** Desktop: three zones on one row. Portrait phones: meters on top, controls below. */
  private arrange(): void {
    const mobile = window.matchMedia('(max-aspect-ratio: 1/1)').matches;
    const q = (c: string) => this.root.querySelector<HTMLElement>(c)!;
    const e = this.el;
    if (mobile) {
      q('.c-row1').append(e.balanceBox, e.buy, e.winBox);
      q('.c-row2').append(e.sys, e.betBox, e.play);
    } else {
      q('.c-left').append(e.sys, e.balanceBox, e.buy);
      q('.c-center').append(e.play);
      q('.c-right').append(e.betBox, e.winBox);
    }
    this.root.classList.toggle('mobile', mobile);
  }

  setBuy(price: number, enabled: boolean): void {
    this.el.buyPrice.textContent = fmt(price);
    this.el.buyCost.textContent = fmt(price);
    (this.el.buy as HTMLButtonElement).disabled = !enabled;
  }

  get buyOpen(): boolean {
    return this.el.buyModal.classList.contains('open');
  }

  setBalance(v: number): void {
    this.el.balance.textContent = fmt(v);
  }

  setBet(v: number, canDec: boolean, canInc: boolean): void {
    this.el.bet.textContent = fmt(v);
    (this.el.betDec as HTMLButtonElement).disabled = !canDec;
    (this.el.betInc as HTMLButtonElement).disabled = !canInc;
  }

  setWin(v: number, label = 'Gain'): void {
    cancelAnimationFrame(this.winTween);
    this.el.win.textContent = fmt(v);
    this.el.winLabel.textContent = label;
    this.el.win.parentElement!.classList.toggle('lit', v > 0);
  }

  /** Rolls the win meter up from its current value. */
  rollWin(to: number, ms: number, label = 'Gain'): void {
    cancelAnimationFrame(this.winTween);
    this.el.winLabel.textContent = label;
    const from = parseFloat(this.el.win.textContent!.replace(/\s/g, '').replace(',', '.')) || 0;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      this.el.win.textContent = fmt(from + (to - from) * e);
      if (k < 1) this.winTween = requestAnimationFrame(step);
    };
    this.el.win.parentElement!.classList.toggle('lit', to > 0);
    step();
  }

  setSpinning(spinning: boolean): void {
    this.root.classList.toggle('spinning', spinning);
    (this.el.betDec as HTMLButtonElement).disabled ||= spinning;
    (this.el.betInc as HTMLButtonElement).disabled ||= spinning;
  }

  setLocked(locked: boolean): void {
    this.root.classList.toggle('locked', locked);
  }

  setFeature(on: boolean): void {
    this.root.classList.toggle('feature', on);
  }

  setTurbo(on: boolean): void {
    this.el.turbo.classList.toggle('active', on);
  }

  setSound(on: boolean): void {
    this.el.sound.innerHTML = on ? ICONS.sound : ICONS.mute;
    this.el.sound.classList.toggle('active', !on);
  }

  setAuto(remaining: number): void {
    this.root.classList.toggle('autoplaying', remaining > 0);
    this.el.autoCount.textContent = remaining > 0 ? String(remaining) : '';
    this.el.auto.classList.toggle('active', remaining > 0);
  }

  setRefill(show: boolean): void {
    this.el.refill.classList.toggle('show', show);
  }

  pulseSpin(): void {
    this.el.spin.classList.remove('pulse');
    void this.el.spin.offsetWidth;
    this.el.spin.classList.add('pulse');
  }
}
