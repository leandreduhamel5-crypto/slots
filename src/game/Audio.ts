/**
 * Procedural sound design with the Web Audio API — no audio files, everything is synthesised.
 *
 * Mix: sfx / ui / music buses → glue compressor → limiter, with a shared "asylum corridor" reverb
 * (generated impulse response) and a dark tape-style echo for bells and the music box.
 * Music: a generative creepy music box over slow minor pads in the base game; a driving pulse
 * (kick, ticks, bass ostinato) during free spins. Ambience: sub drone, wind, heartbeat, distant
 * metal creaks and whispers. Every SFX is layered (transient + body + tail) and placed in stereo.
 */

type Pan = number;

const A4 = 440;
const midi = (n: number) => A4 * Math.pow(2, (n - 69) / 12);
/** A harmonic minor, the score's home key */
/** E Hijaz (phrygian dominant): the augmented second F → G# gives the Egyptian colour */
const SCALE = [64, 65, 68, 69, 71, 72, 74, 76, 77, 80, 81];
/** E – F – E – Dm (Hijaz cadence) as MIDI chords, root first */
const PROGRESSION = [
  [40, 56, 59, 64],
  [41, 57, 60, 65],
  [40, 56, 59, 64],
  [38, 57, 62, 65],
];
/** Maqsum darbuka rhythm over 8 eighths: D T . T D . T . */
const MAQSUM = ['D', 'T', '', 'T', 'D', '', 'T', ''];

export class Audio {
  private ctx: BaseAudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private ui!: GainNode;
  private music!: GainNode;
  private reverbIn!: GainNode;
  private echoIn!: GainNode;
  private noise!: AudioBuffer;
  private spinLoop: { stop: (at: number) => void } | null = null;
  private heartTimer = 0;
  private heartRate = 1.15;
  private feature = false;
  private seqTimer = 0;
  private nextStep = 0;
  private step = 0;
  private ambTimer = 0;
  muted = false;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      const live = this.ctx as AudioContext;
      if (live.state === 'suspended') void live.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.attach(new AC());
    this.startMusic();
  }

  /** Builds the mix graph on a context (also used to render sounds offline in tests). */
  attach(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.noise = this.makeNoise();

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.ratio.value = 3;
    glue.attack.value = 0.01;
    glue.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    this.master.connect(glue).connect(limiter).connect(ctx.destination);

    // corridor reverb
    const verb = ctx.createConvolver();
    verb.buffer = this.makeImpulse(2.8, 2.4);
    const verbTone = ctx.createBiquadFilter();
    verbTone.type = 'lowpass';
    verbTone.frequency.value = 5200;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(verb).connect(verbTone).connect(verbOut).connect(this.master);

    // dark echo (dotted-eighth feel), darker on every repeat
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2200;
    this.echoIn = ctx.createGain();
    this.echoIn.connect(delay);
    delay.connect(dark).connect(fb).connect(delay);
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.5;
    dark.connect(echoOut);
    echoOut.connect(this.master);
    echoOut.connect(this.reverbIn);

    const bus = (gain: number, verbSend: number) => {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(this.master);
      const s = ctx.createGain();
      s.gain.value = verbSend;
      g.connect(s).connect(this.reverbIn);
      return g;
    };
    this.sfx = bus(0.9, 0.22);
    this.ui = bus(0.6, 0.05);
    this.music = bus(0.42, 0.5);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setFeature(on: boolean): void {
    this.feature = on;
    this.heartRate = on ? 0.7 : 1.15;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 0.55 : 0.42, this.ctx.currentTime, 0.6);
  }

  /** "Now", nudged 10 ms ahead so an envelope never starts in the past and loses its attack. */
  private get t(): number {
    return this.ctx!.currentTime + 0.01;
  }

  /* ================================================================ building blocks */

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /** Stereo impulse: early reflections then a dense, darkening exponential tail. */
  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const env = Math.pow(1 - k, decay);
        // one-pole low-pass that closes over time: the tail gets darker
        const a = 0.15 + k * 0.8;
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
        d[i] = lp * env * 1.6;
      }
      // a few discrete early reflections off the tiled walls
      for (const [ms, g] of [[11, 0.5], [19, 0.35], [31, 0.3], [47, 0.2]]) {
        const idx = Math.floor((ms + ch * 3) * 0.001 * ctx.sampleRate);
        if (idx < len) d[idx] += g * (ch ? -1 : 1);
      }
    }
    return b;
  }

  private pan(p: Pan, dest: AudioNode): AudioNode {
    if (!p) return dest;
    const ctx = this.ctx!;
    const sp = ctx.createStereoPanner();
    sp.pan.value = Math.max(-1, Math.min(1, p));
    sp.connect(dest);
    return sp;
  }

  /** Gain envelope: attack, then exponential release. */
  private env(at: number, attack: number, peak: number, release: number, hold = 0): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    if (hold) g.gain.setValueAtTime(Math.max(0.0002, peak), at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    return g;
  }

  private voice(o: {
    at: number;
    f: number;
    to?: number;
    glide?: number;
    type?: OscillatorType;
    vol: number;
    a?: number;
    r: number;
    hold?: number;
    dest?: AudioNode;
    pan?: Pan;
    detune?: number;
    lp?: number;
    echo?: number;
  }): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, o.at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, o.at + (o.glide ?? o.r));
    if (o.detune) osc.detune.value = o.detune;
    const g = this.env(o.at, o.a ?? 0.004, o.vol, o.r, o.hold);
    let src: AudioNode = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      src = f;
    }
    src.connect(g);
    g.connect(this.pan(o.pan ?? 0, o.dest ?? this.sfx));
    if (o.echo) {
      const e = ctx.createGain();
      e.gain.value = o.echo;
      g.connect(e).connect(this.echoIn);
    }
    osc.start(o.at);
    osc.stop(o.at + (o.a ?? 0.004) + (o.hold ?? 0) + o.r + 0.05);
  }

  private hiss(o: {
    at: number;
    dur: number;
    type: BiquadFilterType;
    f0: number;
    f1?: number;
    q?: number;
    vol: number;
    a?: number;
    dest?: AudioNode;
    pan?: Pan;
    pan1?: Pan;
  }): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f0, o.at);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, o.at + o.dur);
    const g = this.env(o.at, o.a ?? 0.01, o.vol, o.dur);
    n.connect(f).connect(g);
    if (o.pan1 !== undefined) {
      const sp = ctx.createStereoPanner();
      sp.pan.setValueAtTime(o.pan ?? 0, o.at);
      sp.pan.linearRampToValueAtTime(o.pan1, o.at + o.dur);
      g.connect(sp).connect(o.dest ?? this.sfx);
    } else g.connect(this.pan(o.pan ?? 0, o.dest ?? this.sfx));
    n.start(o.at, Math.random());
    n.stop(o.at + (o.a ?? 0.01) + o.dur + 0.05);
  }

  /** Soft-clip waveshaper for growls and crunchy impacts. */
  private drive(amount: number): WaveShaperNode {
    const ws = this.ctx!.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    ws.curve = curve;
    ws.oversample = '2x';
    return ws;
  }

  /** Metallic inharmonic bell (codex). */
  private bell(at: number, f: number, vol: number, pan: Pan = 0): void {
    [1, 2.76, 5.4, 8.93, 13.34].forEach((r, k) =>
      this.voice({ at, f: f * r, vol: vol / (k + 1.2), r: 2.4 - k * 0.4, a: 0.002, pan, echo: 0.35, detune: (Math.random() - 0.5) * 8 }),
    );
  }

  /** Low impact: pitch-dropping sine + click transient + crunchy body. */
  private boom(at: number, vol: number, f = 60, pan: Pan = 0): void {
    this.voice({ at, f: f * 2.2, to: f * 0.5, glide: 0.35, vol, r: 0.6, a: 0.003, pan });
    this.voice({ at, f: f * 4, to: f, glide: 0.06, type: 'triangle', vol: vol * 0.5, r: 0.12, a: 0.001, pan });
    this.hiss({ at, dur: 0.25, type: 'lowpass', f0: 2600, f1: 120, vol: vol * 0.45, a: 0.002, pan });
  }

  /* ================================================================ ambience & music */

  private startMusic(): void {
    this.startDrone();
    this.scheduleHeart();
    this.scheduleAmbience();
    this.nextStep = this.t + 0.3;
    this.step = 0;
    clearInterval(this.seqTimer);
    this.seqTimer = window.setInterval(() => this.sequence(), 50);
  }

  private startDrone(): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    lp.Q.value = 4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 70;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    const g = ctx.createGain();
    g.gain.value = 0.12;
    for (const f of [41.2, 41.35, 82.4, 123.5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    lp.connect(g).connect(this.music);
    // wind through the corridor
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.9;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.09;
    const lfo2g = ctx.createGain();
    lfo2g.gain.value = 350;
    lfo2.connect(lfo2g).connect(bp.frequency);
    lfo2.start();
    const ng = ctx.createGain();
    ng.gain.value = 0.03;
    n.connect(bp).connect(ng).connect(this.music);
    n.start();
  }

  /** Step sequencer (eighth notes), scheduled ahead of time for sample-accurate timing. */
  private sequence(): void {
    if (!this.ctx) return;
    const bpm = this.feature ? 104 : 72;
    const stepDur = 60 / bpm / 2;
    while (this.nextStep < this.t + 0.25) {
      this.playStep(this.step, this.nextStep, stepDur);
      this.nextStep += stepDur;
      this.step++;
    }
  }

  private playStep(step: number, at: number, dur: number): void {
    const bar = Math.floor(step / 8);
    const s = step % 8;
    const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
    // pad: one swell every two bars
    if (s === 0 && bar % 2 === 0) this.pad(at, chord, dur * 16);
    if (!this.feature) {
      // a ney phrase every four bars, the music box answering in between
      if (s === 0 && bar % 4 === 1) this.neyPhrase(at, dur);
      else if (bar % 4 !== 1 && bar % 4 !== 2 && Math.random() < (s % 2 ? 0.18 : 0.38)) {
        const pool = Math.random() < 0.7 ? chord.slice(1).map((n) => n + 12) : SCALE.map((n) => n + 12);
        this.musicBox(at, midi(pool[Math.floor(Math.random() * pool.length)]));
      }
    } else {
      // free spins: darbuka maqsum, bass ostinato, music box doubles
      const hit = MAQSUM[s];
      if (hit === 'D') this.doum(at);
      else if (hit === 'T') this.tek(at);
      if (s === 7 && Math.random() < 0.6) this.tek(at + dur * 0.5, 0.6);
      const root = chord[0];
      const bassNotes = [root, root, root + 12, root, root + 7, root, root + 12, root + 1];
      this.bass(at, midi(bassNotes[s]), dur);
      if (Math.random() < 0.3) this.musicBox(at, midi(chord[1 + (s % 3)] + 24), 0.06);
    }
  }

  /** Ney flute: breathy sine with delayed vibrato and a little grace-note slide. */
  private ney(at: number, f: number, len: number, vol = 0.07): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.97, at);
    o.frequency.exponentialRampToValueAtTime(f, at + 0.08);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, at);
    vg.gain.linearRampToValueAtTime(f * 0.012, at + len * 0.6);
    vib.connect(vg).connect(o.frequency);
    const h = ctx.createOscillator();
    h.type = 'triangle';
    h.frequency.value = f * 2;
    const hg = ctx.createGain();
    hg.gain.value = 0.12;
    h.connect(hg);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.12);
    g.gain.setValueAtTime(vol * 0.85, at + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.25);
    o.connect(g);
    hg.connect(g);
    g.connect(this.music);
    const e = ctx.createGain();
    e.gain.value = 0.45;
    g.connect(e).connect(this.echoIn);
    for (const n of [o, vib, h]) {
      n.start(at);
      n.stop(at + len + 0.3);
    }
    // breath
    this.hiss({ at, dur: len, type: 'bandpass', f0: f * 2.5, q: 3, vol: vol * 0.25, a: 0.1, dest: this.music });
  }

  private neyPhrase(at: number, dur: number): void {
    const motifs = [
      [76, 77, 80, 77, 76],
      [71, 72, 71, 69, 68, 69],
      [64, 65, 68, 69, 68, 65, 64],
      [81, 80, 77, 76],
    ];
    const m = motifs[Math.floor(Math.random() * motifs.length)];
    let t = at;
    m.forEach((n, i) => {
      const len = i === m.length - 1 ? dur * 5 : dur * (Math.random() < 0.3 ? 2 : 1);
      this.ney(t, midi(n), len);
      t += len;
    });
  }

  /** Darbuka: deep "doum" in the centre, dry "tek" on the rim. */
  private doum(at: number): void {
    this.voice({ at, f: 140, to: 78, glide: 0.08, vol: 0.5, r: 0.32, a: 0.002, dest: this.music });
    this.voice({ at, f: 220, to: 160, glide: 0.05, type: 'triangle', vol: 0.12, r: 0.12, a: 0.001, dest: this.music });
  }

  private tek(at: number, vol = 1): void {
    this.hiss({ at, dur: 0.05, type: 'bandpass', f0: 3200, q: 2.5, vol: 0.45 * vol, a: 0.001, dest: this.music, pan: 0.25 });
    this.voice({ at, f: 680, to: 520, glide: 0.03, type: 'triangle', vol: 0.26 * vol, r: 0.05, a: 0.001, dest: this.music, pan: 0.25 });
  }

  private pad(at: number, chord: number[], len: number): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(this.feature ? 900 : 500, at);
    f.frequency.linearRampToValueAtTime(this.feature ? 1600 : 1000, at + len * 0.5);
    f.frequency.linearRampToValueAtTime(this.feature ? 900 : 500, at + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.05, at + len * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, at + len);
    f.connect(g).connect(this.music);
    for (const n of chord.slice(1)) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(f);
        o.start(at);
        o.stop(at + len + 0.1);
      }
    }
  }

  private musicBox(at: number, f: number, vol = 0.07): void {
    this.voice({ at, f, vol, r: 1.1, a: 0.002, dest: this.music, echo: 0.6, pan: (Math.random() - 0.5) * 0.8 });
    this.voice({ at, f: f * 4.02, vol: vol * 0.35, r: 0.25, a: 0.001, dest: this.music, echo: 0.4 });
    this.voice({ at, f: f * 2.0, vol: vol * 0.2, r: 0.6, a: 0.002, dest: this.music });
  }

  private bass(at: number, f: number, dur: number): void {
    this.voice({ at, f, type: 'sawtooth', vol: 0.11, r: dur * 0.9, a: 0.005, lp: 420, dest: this.music });
    this.voice({ at, f: f / 2, vol: 0.12, r: dur * 0.9, a: 0.005, dest: this.music });
  }

  private scheduleHeart(): void {
    const tick = () => {
      if (!this.ctx) return;
      const at = this.t;
      this.voice({ at, f: 72, to: 34, glide: 0.18, vol: 0.32, r: 0.24, a: 0.008, dest: this.music });
      this.voice({ at: at + 0.22, f: 64, to: 32, glide: 0.18, vol: 0.2, r: 0.22, a: 0.008, dest: this.music });
      this.heartTimer = window.setTimeout(tick, this.heartRate * 1000);
    };
    clearTimeout(this.heartTimer);
    this.heartTimer = window.setTimeout(tick, 800);
  }

  /** Distant metal creaks and whispers now and then. */
  private scheduleAmbience(): void {
    clearTimeout(this.ambTimer);
    this.ambTimer = window.setTimeout(() => {
      if (!this.ctx) return;
      if (Math.random() < 0.55) this.creak();
      else this.whisper();
      this.scheduleAmbience();
    }, 9000 + Math.random() * 12000);
  }

  private creak(): void {
    const ctx = this.ctx!;
    const at = this.t;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = 90 + Math.random() * 60;
    o.frequency.setValueAtTime(base, at);
    for (let i = 1; i <= 8; i++) o.frequency.linearRampToValueAtTime(base * (1 + (Math.random() - 0.3) * 0.25), at + i * 0.15);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 600;
    bp.Q.value = 9;
    const g = this.env(at, 0.2, 0.05, 1.0, 0.3);
    o.connect(bp).connect(g).connect(this.pan((Math.random() - 0.5) * 1.6, this.music));
    o.start(at);
    o.stop(at + 1.6);
  }

  private whisper(): void {
    const at = this.t;
    const p = Math.random() < 0.5 ? -0.9 : 0.9;
    for (let i = 0; i < 4; i++) {
      this.hiss({ at: at + i * 0.18, dur: 0.16, type: 'bandpass', f0: 1800 + Math.random() * 1600, f1: 900 + Math.random() * 800, q: 6, vol: 0.035, a: 0.03, dest: this.music, pan: p });
    }
  }

  /* ================================================================ sfx */

  click(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.voice({ at, f: 2200, to: 1400, glide: 0.03, type: 'square', vol: 0.09, r: 0.035, a: 0.001, lp: 5000, dest: this.ui });
    this.voice({ at, f: 260, to: 170, glide: 0.06, vol: 0.22, r: 0.08, a: 0.002, dest: this.ui });
  }

  spinStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    // lever clunk + whoosh
    this.boom(at, 0.35, 70);
    this.hiss({ at, dur: 0.5, type: 'bandpass', f0: 300, f1: 2800, q: 0.8, vol: 0.2, a: 0.04, pan: -0.4, pan1: 0.4 });
    this.voice({ at, f: 900, to: 300, glide: 0.08, type: 'square', vol: 0.03, r: 0.08, a: 0.001, lp: 3000 });
    this.startSpinLoop(at + 0.05);
  }

  /** Reels spinning: a ratcheting rattle that stops with the last reel. */
  private startSpinLoop(at: number): void {
    this.spinLoop?.stop(at);
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.4;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 17;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.5;
    lfo.connect(lfoG).connect(am.gain);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(0.05, at + 0.15);
    n.connect(bp).connect(am).connect(out).connect(this.sfx);
    // low motor hum underneath
    const hum = ctx.createOscillator();
    hum.type = 'triangle';
    hum.frequency.value = 58;
    const hg = ctx.createGain();
    hg.gain.value = 0.5;
    hum.connect(hg).connect(out);
    n.start(at);
    lfo.start(at);
    hum.start(at);
    const kill = window.setTimeout(() => this.spinLoop?.stop(this.t), 12000);
    this.spinLoop = {
      stop: (t: number) => {
        clearTimeout(kill);
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0.0001, t, 0.05);
        for (const s of [n, lfo, hum]) s.stop(t + 0.4);
        this.spinLoop = null;
      },
    };
  }

  reelStop(i: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const pan = (i - 2) * 0.3;
    const pitch = 1 + (Math.random() - 0.5) * 0.06;
    this.voice({ at, f: (150 - i * 8) * pitch, to: 48, glide: 0.12, vol: 0.42, r: 0.18, a: 0.002, pan });
    this.voice({ at, f: 2400 * pitch, to: 900, glide: 0.02, type: 'square', vol: 0.025, r: 0.03, a: 0.001, lp: 4000, pan });
    this.hiss({ at, dur: 0.08, type: 'bandpass', f0: 2600, f1: 900, q: 1.5, vol: 0.1, a: 0.001, pan });
    if (i >= 4) this.spinLoop?.stop(at);
  }

  /** Codex lands: tolling bell, pitch climbing with each one, plus a choir breath. */
  codex(n: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const f = midi(57 + [0, 3, 7, 12, 15][Math.min(4, Math.max(0, n - 1))]);
    this.bell(at, f, 0.22, (n - 3) * 0.25);
    this.boom(at, 0.45, 50);
    this.choir(at, [f / 2, f * 0.75], 1.2, 0.05 + n * 0.015);
  }

  /** Formant "aah" made from filtered saws. */
  private choir(at: number, freqs: number[], len: number, vol: number): void {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.linearRampToValueAtTime(vol, at + len * 0.3);
    out.gain.exponentialRampToValueAtTime(0.0001, at + len);
    out.connect(this.sfx);
    for (const [ff, q, g] of [[700, 8, 1], [1150, 10, 0.6], [2800, 12, 0.25]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = q;
      const bg = ctx.createGain();
      bg.gain.value = g * 3;
      bp.connect(bg).connect(out);
      for (const f of freqs) {
        for (const det of [-12, 0, 12]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = det;
          // slow vibrato
          const v = ctx.createOscillator();
          v.frequency.value = 5 + Math.random();
          const vg = ctx.createGain();
          vg.gain.value = 6;
          v.connect(vg).connect(o.detune);
          o.connect(bp);
          o.start(at);
          v.start(at);
          o.stop(at + len + 0.1);
          v.stop(at + len + 0.1);
        }
      }
    }
  }

  /** Suspense riser while the last reels decide the feature. */
  anticipation(dur: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const at = this.t;
    for (const det of [-14, 14]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, at);
      o.frequency.exponentialRampToValueAtTime(380, at + dur);
      o.detune.value = det;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(250, at);
      f.frequency.exponentialRampToValueAtTime(3500, at + dur);
      // tremolo accelerating with the tension
      const trem = ctx.createGain();
      trem.gain.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(4, at);
      lfo.frequency.linearRampToValueAtTime(14, at + dur);
      const lg = ctx.createGain();
      lg.gain.value = 0.4;
      lfo.connect(lg).connect(trem.gain);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.09, at + dur * 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.15);
      o.connect(f).connect(trem).connect(g).connect(this.pan(det > 0 ? 0.4 : -0.4, this.sfx));
      o.start(at);
      lfo.start(at);
      o.stop(at + dur + 0.2);
      lfo.stop(at + dur + 0.2);
    }
    this.hiss({ at, dur, type: 'bandpass', f0: 400, f1: 5000, q: 2, vol: 0.07, a: dur * 0.8 });
    // racing heartbeat
    for (let k = 0; k < dur / 0.42; k++) this.voice({ at: at + k * 0.42, f: 70, to: 34, glide: 0.15, vol: 0.3, r: 0.2, a: 0.006 });
  }

  /** Win jingle; size 0..3 scales length, layers and brightness. */
  win(size: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const up = [64, 65, 68, 71, 72, 76, 77, 80, 83, 88];
    const count = 3 + size * 2;
    for (let i = 0; i < count; i++) {
      const t = at + i * 0.075;
      const f = midi(up[i % up.length]);
      const p = (i / count - 0.5) * 0.9;
      // marimba-ish body + glassy overtone
      this.voice({ at: t, f, vol: 0.19, r: 0.45, a: 0.002, pan: p, echo: 0.25 });
      this.voice({ at: t, f: f * 3.99, vol: 0.04, r: 0.12, a: 0.001, pan: p });
      this.voice({ at: t, f: f * 2, type: 'triangle', vol: 0.05, r: 0.3, a: 0.002, pan: p });
    }
    if (size >= 1) {
      // closing chord with sparkle
      const t = at + count * 0.075;
      for (const n of [52, 64, 68, 71]) this.voice({ at: t, f: midi(n), type: 'triangle', vol: 0.07, r: 1.2, a: 0.01, echo: 0.3 });
      this.hiss({ at: t, dur: 0.8, type: 'highpass', f0: 6000, vol: 0.05, a: 0.05 });
    }
    if (size >= 2) this.boom(at, 0.4, 55);
    if (size >= 3) this.choir(at + 0.2, [midi(45), midi(52), midi(57)], 2.2, 0.08);
  }

  /** Count-up tick (coin-like), slightly randomised. */
  tick(): void {
    if (!this.ctx) return;
    const at = this.t;
    const f = 2300 + Math.random() * 400;
    this.voice({ at, f, vol: 0.12, r: 0.06, a: 0.001, dest: this.ui, pan: (Math.random() - 0.5) * 0.4 });
    this.voice({ at, f: f * 1.5, vol: 0.05, r: 0.04, a: 0.001, dest: this.ui });
  }

  /** Strain expands over a reel: slimy splash, rising whoosh, sub hit. */
  expand(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur: 0.45, type: 'lowpass', f0: 200, f1: 3200, q: 3, vol: 0.2, a: 0.25 });
    this.voice({ at, f: 55, to: 220, glide: 0.45, type: 'sawtooth', vol: 0.08, r: 0.2, a: 0.35, lp: 900 });
    // wet splat: resonant bandpass sweeping down
    this.hiss({ at: at + 0.42, dur: 0.35, type: 'bandpass', f0: 1800, f1: 200, q: 7, vol: 0.3, a: 0.003 });
    this.boom(at + 0.42, 0.6, 45);
  }

  /** Power outage: electric zap, buzz, a fading whine, then distant thunder. */
  thunder(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur: 0.12, type: 'highpass', f0: 2500, vol: 0.12, a: 0.001 });
    this.voice({ at, f: 120, type: 'square', vol: 0.05, r: 0.5, a: 0.002, lp: 1800 });
    this.voice({ at, f: 3200, to: 180, glide: 0.9, type: 'sine', vol: 0.03, r: 0.9, a: 0.01 });
    const t2 = at + 0.35;
    this.hiss({ at: t2, dur: 2.8, type: 'lowpass', f0: 800, f1: 50, vol: 0.28, a: 0.05, pan: -0.5, pan1: 0.5 });
    this.voice({ at: t2, f: 34, vol: 0.3, r: 2.2, a: 0.05, dest: this.music });
  }

  /** Monster roar + sub boom + dissonant cluster; level 0..3 scales it. */
  stinger(level: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const at = this.t;
    this.boom(at, 0.7, 40);
    // roar: noise + growling saw through a drive and sweeping formants
    const len = 1.1 + level * 0.25;
    const sum = ctx.createGain();
    const drv = this.drive(3 + level);
    const out = this.env(at, 0.05, 0.22 + level * 0.04, len, 0.1);
    sum.connect(drv);
    for (const [f0, f1, q] of [[500, 300, 5], [1100, 700, 6], [2400, 1500, 7]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(f0 * 0.7, at);
      bp.frequency.linearRampToValueAtTime(f0, at + 0.15);
      bp.frequency.exponentialRampToValueAtTime(f1, at + len);
      drv.connect(bp).connect(out);
    }
    out.connect(this.sfx);
    const growl = ctx.createOscillator();
    growl.type = 'sawtooth';
    growl.frequency.setValueAtTime(85 - level * 8, at);
    growl.frequency.exponentialRampToValueAtTime(48, at + len);
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 23;
    const fg = ctx.createGain();
    fg.gain.value = 18;
    flutter.connect(fg).connect(growl.frequency);
    growl.connect(sum);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.6;
    n.connect(ng).connect(sum);
    for (const s of [growl, flutter, n]) {
      s.start(at);
      s.stop(at + len + 0.3);
    }
    // dissonant brass-like cluster under it
    for (const f of [110, 116.5, 155.6, 164.8]) {
      this.voice({ at, f: f * (1 + level * 0.02), type: 'sawtooth', vol: 0.03, r: 2.2, a: 0.08, lp: 1400, detune: 6 });
    }
  }

  featureStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.stinger(2);
    this.choir(at + 0.3, [midi(45), midi(52), midi(57), midi(60)], 3, 0.1);
    [57, 60, 64, 69].forEach((n, i) => this.bell(at + 0.5 + i * 0.18, midi(n), 0.12, (i - 1.5) * 0.4));
  }
}
