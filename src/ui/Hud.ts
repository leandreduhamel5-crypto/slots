import { fmt } from './format';

const ICONS = {
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  turbo: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
  spin: '<svg viewBox="0 0 64 64"><path d="M50 32a18 18 0 1 1-5.3-12.7"/><path d="M48 12v9h-9"/></svg>',
  stop: '<svg viewBox="0 0 64 64"><rect x="22" y="22" width="20" height="20" rx="3"/></svg>',
};

export interface HudHandlers {
  spin(): void;
  betDelta(d: number): void;
  toggleTurbo(): void;
  toggleSound(): void;
  openInfo(): void;
  auto(count: number): void;
  refill(): void;
}

export class Hud {
  readonly root: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  private autoMenu: HTMLElement;
  private winTween = 0;

  constructor(h: HudHandlers) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-meters">
        <div class="meter"><label>Solde</label><span data-k="balance">0,00</span></div>
        <div class="meter meter-win"><label data-k="winLabel">Gain</label><span data-k="win">0,00</span></div>
      </div>
      <div class="hud-controls">
        <div class="hud-side">
          <button class="icon" data-k="info" aria-label="Règles et paiements">${ICONS.info}</button>
          <button class="icon" data-k="sound" aria-label="Son">${ICONS.sound}</button>
        </div>
        <div class="bet">
          <button class="step" data-k="betDec" aria-label="Diminuer la mise">−</button>
          <div class="meter"><label>Mise</label><span data-k="bet">0,00</span></div>
          <button class="step" data-k="betInc" aria-label="Augmenter la mise">+</button>
        </div>
        <button class="spin" data-k="spin" aria-label="Lancer"><span class="spin-ring"></span><span data-k="spinIcon">${ICONS.spin}</span><span class="spin-count" data-k="autoCount"></span></button>
        <div class="hud-side">
          <button class="icon" data-k="auto" aria-label="Jeu automatique">${ICONS.auto}</button>
          <button class="icon" data-k="turbo" aria-label="Turbo">${ICONS.turbo}</button>
        </div>
      </div>
      <div class="auto-menu" data-k="autoMenu">
        <p>Tours automatiques</p>
        <div>${[10, 25, 50, 100].map((n) => `<button data-auto="${n}">${n}</button>`).join('')}</div>
      </div>
      <button class="refill" data-k="refill">Recharger 1 000 crédits</button>
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
