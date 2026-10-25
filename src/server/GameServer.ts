import { BET_LEVELS, DEFAULT_BET_INDEX, START_BALANCE } from '../math/config';
import { playRound, type Round } from '../math/engine';
import { CryptoRng } from '../math/rng';

/**
 * In-browser stand-in for a Remote Gaming Server: it owns the balance, decides every outcome and
 * persists the round in progress so a reload resumes it (round recovery), like a real RGS would.
 * The client only ever receives finished outcomes to present.
 */
export interface Session {
  balance: number;
  betIndex: number;
  pending: Round | null;
  /** How many free spins of the pending round the client has already shown */
  shownFreeSpins: number;
}

const KEY = 'codex-infecta:session:v1';

export class GameServer {
  private rng = new CryptoRng();
  private session: Session;

  constructor() {
    this.session = this.load() ?? {
      balance: START_BALANCE,
      betIndex: DEFAULT_BET_INDEX,
      pending: null,
      shownFreeSpins: 0,
    };
  }

  get state(): Readonly<Session> {
    return this.session;
  }

  get bet(): number {
    return BET_LEVELS[this.session.betIndex];
  }

  setBetIndex(i: number): void {
    if (this.session.pending) return;
    this.session.betIndex = Math.max(0, Math.min(BET_LEVELS.length - 1, i));
    this.save();
  }

  /** Dev-only: when set, rounds are redrawn until the predicate matches (used to test features). */
  force: ((r: Round) => boolean) | null = null;

  async spin(): Promise<Round> {
    if (this.session.pending) throw new Error('round in progress');
    const bet = this.bet;
    if (this.session.balance < bet - 1e-9) throw new Error('insufficient funds');
    this.session.balance = round2(this.session.balance - bet);
    let round = playRound(this.rng, bet);
    if (import.meta.env.DEV && this.force) {
      for (let i = 0; i < 2_000_000 && !this.force(round); i++) round = playRound(this.rng, bet);
      this.force = null;
    }
    this.session.pending = round;
    this.session.shownFreeSpins = 0;
    this.save();
    await delay(60);
    return round;
  }

  markFreeSpinShown(n: number): void {
    this.session.shownFreeSpins = n;
    this.save();
  }

  /** Settles the pending round: credits the total win. Idempotent. */
  settle(): number {
    const r = this.session.pending;
    if (!r) return this.session.balance;
    this.session.balance = round2(this.session.balance + r.totalWin);
    this.session.pending = null;
    this.session.shownFreeSpins = 0;
    this.save();
    return this.session.balance;
  }

  refill(): void {
    if (this.session.pending) return;
    this.session.balance = START_BALANCE;
    this.save();
  }

  private load(): Session | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.session));
    } catch {
      /* storage unavailable: session lives in memory only */
    }
  }
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
