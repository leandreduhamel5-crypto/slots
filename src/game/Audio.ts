/**
 * Procedural sound design with the Web Audio API: no audio files, every sound is synthesised.
 * Dark ambient drone + heartbeat, mechanical reel thuds, metallic codex bells, risers and stingers.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private droneNodes: AudioNode[] = [];
  private heartTimer = 0;
  private heartRate = 1.15;
  muted = false;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.5;
    this.music.connect(this.master);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startDrone();
    this.scheduleHeart();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setFeature(on: boolean): void {
    this.heartRate = on ? 0.72 : 1.15;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 0.75 : 0.5, this.ctx.currentTime, 0.5);
  }

  private get t(): number {
    return this.ctx!.currentTime;
  }

  private startDrone(): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    lp.Q.value = 6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    const g = ctx.createGain();
    g.gain.value = 0.16;
    for (const f of [36.7, 36.95, 55.1, 73.3]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      this.droneNodes.push(o);
    }
    lp.connect(g).connect(this.music);

    // airy wind
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.8;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2g = ctx.createGain();
    lfo2g.gain.value = 400;
    lfo2.connect(lfo2g).connect(bp.frequency);
    lfo2.start();
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    n.connect(bp).connect(ng).connect(this.music);
    n.start();
  }

  private scheduleHeart(): void {
    const tick = () => {
      if (!this.ctx) return;
      this.heartbeat();
      this.heartTimer = window.setTimeout(tick, this.heartRate * 1000);
    };
    clearTimeout(this.heartTimer);
    this.heartTimer = window.setTimeout(tick, 800);
  }

  private heartbeat(): void {
    const thump = (at: number, vol: number) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.frequency.setValueAtTime(70, at);
      o.frequency.exponentialRampToValueAtTime(32, at + 0.18);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      o.connect(g).connect(this.music);
      o.start(at);
      o.stop(at + 0.3);
    };
    thump(this.t, 0.5);
    thump(this.t + 0.22, 0.32);
  }

  private env(node: AudioNode, at: number, a: number, peak: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + decay);
    node.connect(g);
    return g;
  }

  private noiseBurst(at: number, dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    f.Q.value = 1.2;
    n.connect(f);
    this.env(f, at, 0.02, vol, dur).connect(this.sfx);
    n.start(at, Math.random());
    n.stop(at + dur + 0.1);
  }

  private tone(at: number, freq: number, type: OscillatorType, vol: number, decay: number, attack = 0.005, dest?: AudioNode): void {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    this.env(o, at, attack, vol, decay).connect(dest ?? this.sfx);
    o.start(at);
    o.stop(at + attack + decay + 0.05);
  }

  click(): void {
    if (!this.ctx) return;
    this.tone(this.t, 1800, 'square', 0.05, 0.03);
    this.tone(this.t, 240, 'sine', 0.1, 0.06);
  }

  spinStart(): void {
    if (!this.ctx) return;
    this.noiseBurst(this.t, 0.45, 'bandpass', 300, 2400, 0.22);
    this.tone(this.t, 110, 'triangle', 0.18, 0.2);
  }

  reelStop(i: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(140 - i * 6, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    this.env(o, at, 0.004, 0.45, 0.16).connect(this.sfx);
    o.start(at);
    o.stop(at + 0.25);
    this.noiseBurst(at, 0.06, 'highpass', 3000, 1500, 0.08);
  }

  /** Metallic inharmonic bell; pitch climbs with each codex. */
  codex(n: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const base = 220 * Math.pow(1.26, n - 1);
    [1, 2.76, 5.4, 8.93].forEach((r, k) => this.tone(at, base * r, 'sine', 0.22 / (k + 1), 1.6 - k * 0.3, 0.002));
    this.tone(at, 55, 'sine', 0.5, 0.5);
    this.noiseBurst(at, 0.3, 'lowpass', 1200, 200, 0.2);
  }

  anticipation(dur: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(80, at);
    o.frequency.exponentialRampToValueAtTime(420, at + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, at);
    f.frequency.exponentialRampToValueAtTime(3000, at + dur);
    o.connect(f);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.16, at + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.1);
    f.connect(g).connect(this.sfx);
    o.start(at);
    o.stop(at + dur + 0.2);
    this.noiseBurst(at, dur, 'bandpass', 400, 4000, 0.08);
  }

  /** Short minor arpeggio; size 0..3 scales length and brightness. */
  win(size: number): void {
    if (!this.ctx) return;
    const notes = [220, 261.6, 329.6, 392, 440, 523.3, 659.3];
    const count = 3 + size * 2;
    for (let i = 0; i < count; i++) {
      const at = this.t + i * 0.07;
      const f = notes[i % notes.length] * (i >= notes.length ? 2 : 1);
      this.tone(at, f, 'triangle', 0.14, 0.5);
      this.tone(at, f * 2.01, 'sine', 0.05, 0.3);
    }
  }

  tick(): void {
    if (!this.ctx) return;
    this.tone(this.t, 2400 + Math.random() * 200, 'sine', 0.035, 0.04);
  }

  expand(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.noiseBurst(at, 0.5, 'lowpass', 200, 3000, 0.25);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, at);
    o.frequency.exponentialRampToValueAtTime(220, at + 0.45);
    this.env(o, at, 0.3, 0.14, 0.4).connect(this.sfx);
    o.start(at);
    o.stop(at + 0.9);
    this.tone(at + 0.45, 41, 'sine', 0.6, 0.8);
  }

  /** Distant rolling thunder. */
  thunder(): void {
    if (!this.ctx) return;
    const at = this.t + 0.25;
    this.noiseBurst(at, 2.8, 'lowpass', 900, 60, 0.3);
    this.noiseBurst(at + 0.15, 1.6, 'lowpass', 400, 50, 0.25);
    this.tone(at, 32, 'sine', 0.35, 2.2, 0.05, this.music);
  }

  /** Dissonant cluster + sub boom for big moments. */
  stinger(level: number): void {
    if (!this.ctx) return;
    const at = this.t;
    this.tone(at, 36, 'sine', 0.8, 1.6);
    this.noiseBurst(at, 1.2, 'lowpass', 4000, 80, 0.35);
    const chord = [110, 130.8, 155.6, 164.8, 220 * (1 + level * 0.02)];
    for (const f of chord) {
      this.tone(at, f, 'sawtooth', 0.05, 2.4, 0.08);
      this.tone(at, f * 1.006, 'sawtooth', 0.05, 2.4, 0.08);
    }
  }

  featureStart(): void {
    if (!this.ctx) return;
    this.stinger(2);
    for (let i = 0; i < 4; i++) this.tone(this.t + 0.5 + i * 0.16, 220 * Math.pow(1.189, i), 'triangle', 0.16, 0.8);
  }
}
