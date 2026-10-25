export interface Rng {
  /** Uniform integer in [0, n). */
  int(n: number): number;
}

/** Crypto RNG with rejection sampling so every value in [0, n) is equally likely (no modulo bias). */
export class CryptoRng implements Rng {
  private buf = new Uint32Array(64);
  private pos = 64;

  private next32(): number {
    if (this.pos >= this.buf.length) {
      crypto.getRandomValues(this.buf);
      this.pos = 0;
    }
    return this.buf[this.pos++];
  }

  int(n: number): number {
    const limit = 0x100000000 - (0x100000000 % n);
    let x: number;
    do x = this.next32();
    while (x >= limit);
    return x % n;
  }
}

/** Fast seeded PRNG (xoshiro128**) for simulations and reproducible tests. */
export class SeededRng implements Rng {
  private s: Uint32Array;

  constructor(seed: number) {
    this.s = new Uint32Array(4);
    let z = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      z = (z + 0x9e3779b9) >>> 0;
      let t = z;
      t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0;
      t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
      this.s[i] = (t ^ (t >>> 16)) >>> 0;
    }
  }

  private next32(): number {
    const s = this.s;
    const r = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return r;
  }

  int(n: number): number {
    const limit = 0x100000000 - (0x100000000 % n);
    let x: number;
    do x = this.next32();
    while (x >= limit);
    return x % n;
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
