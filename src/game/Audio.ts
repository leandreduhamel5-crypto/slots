import { LITE } from './device';
/**
 * Procedural sound design with the Web Audio API: no audio files. The strings are physical models
 * (Karplus-Strong), so what rewards the player is a plucked string, not an oscillator.
 *
 * The score is not composed here: real recordings dropped in public/assets/audio/ (music.mp3 for the
 * game, bonus.mp3 for the free spins) play in a loop under the sound effects. Without them the game
 * only has its night: a low drone, wind, and now and then a gong far away.
 *
 * Mix: sfx / ui / music buses → glue compressor → limiter, with a shared stone-hall reverb
 * (generated impulse response) and a dark echo for the plucked and blown instruments.
 */

type Pan = number;

const A4 = 440;
const midi = (n: number) => A4 * Math.pow(2, (n - 69) / 12);
/** semitones of the hijaz scale, for coin counts */
const TICK_SCALE = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
/* Everything sits on E Hijaz (phrygian dominant): the augmented second F → G# is the Egyptian colour. */
/** Saidi, the horse-dance of Upper Egypt: D T . D D . T . */
const SAIDI = ['D', 'T', '', 'D', 'D', '', 'T', ''];
/** the walking bass under the bonus: root, fifth, octave */
const BASS_WALK = [0, 0, 0, 7, 12, 0, 7, 1];
const SPIN_LEVEL = 0.07;
const MUSIC_LEVEL = 0.5;
/** a string carries more than the bowls it replaced, for the same nominal volume */
const STRING_LEVEL = 1.7;
/** a phone's little speaker needs a little more */
const MASTER_LEVEL = LITE ? 1.2 : 0.9;

function softClip(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2);
  }
  return curve;
}

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
  private feature = false;
  private seqTimer = 0;
  private ambTimer = 0;
  private musicDuck!: GainNode;
  private musicSwitch!: GainNode;
  private musicOn = true;
  muted = false;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      // a call or the lock screen leaves an iPhone's sound "interrupted", not suspended
      const live = this.ctx as AudioContext;
      if (live.state !== 'running') void live.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    // without this an iPhone on silent plays the game mute, as it would a ringtone
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    this.attach(new AC());
    this.startMusic();
  }

  /** Builds the mix graph on a context (also used to render sounds offline in tests). */
  attach(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.noise = this.makeNoise();

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
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
    // a soft saturation warms everything, a touch of weight below and of air above
    // (it reads ±1, so the signal goes in at half level: peaks up to 2 are rounded, not cut)
    const headroom = ctx.createGain();
    headroom.gain.value = 0.5;
    const warm = ctx.createWaveShaper();
    warm.curve = softClip();
    warm.oversample = LITE ? 'none' : '2x';
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 95;
    low.gain.value = 2.5;
    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 8500;
    air.gain.value = 2;
    this.master.connect(headroom).connect(warm).connect(low).connect(air).connect(glue).connect(limiter).connect(ctx.destination);

    // corridor reverb
    const verb = ctx.createConvolver();
    verb.buffer = this.makeImpulse(LITE ? 2.2 : 3.2, 2.6);
    const verbTone = ctx.createBiquadFilter();
    verbTone.type = 'lowpass';
    verbTone.frequency.value = 3800;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    this.reverbIn = ctx.createGain();
    // the walls are far away: the hall answers a moment after the sound
    const distance = ctx.createDelay(0.1);
    distance.delayTime.value = 0.035;
    this.reverbIn.connect(distance).connect(verb).connect(verbTone).connect(verbOut).connect(this.master);

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
    this.sfx = bus(0.9, 0.2);
    this.ui = bus(0.6, 0.05);
    const music = bus(MUSIC_LEVEL, 0.42);
    this.musicSwitch = ctx.createGain();
    this.musicSwitch.gain.value = this.musicOn ? 1 : 0;
    this.musicSwitch.connect(music);
    this.musicDuck = ctx.createGain();
    this.musicDuck.connect(this.musicSwitch);
    this.music = this.musicDuck;
  }

  /** The game falls silent while its tab is hidden, and picks up where it was. */
  setHidden(hidden: boolean): void {
    const live = this.ctx as AudioContext | null;
    if (!live?.suspend) return;
    void (hidden ? live.suspend() : live.resume());
  }

  /** The music has its own switch: the sounds of the game go on without it. */
  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicSwitch.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, this.ctx.currentTime, 0.05);
  }

  setFeature(on: boolean): void {
    this.feature = on;
    if (this.ctx) this.playScore();
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

  /* ================================================================ instruments */

  private doorSide = 1;

  private strings = new Map<number, { buffer: AudioBuffer; rate: number }>();

  /**
   * One string, computed once per note: a burst of noise softened by the finger, running round a
   * delay line that loses its highs on every pass. The result is tuned by playback rate.
   */
  private string(note: number): { buffer: AudioBuffer; rate: number } {
    let s = this.strings.get(note);
    if (s) return s;
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const f = midi(note);
    const N = Math.max(2, Math.round(sr / f + 0.38));
    const line = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) {
      lp = lp * 0.5 + (Math.random() * 2 - 1) * 0.5;
      line[i] = lp;
    }
    // plucked a seventh of the way along the string: that notch is what makes it sound like a string
    const comb = Math.max(1, Math.round(N / 7));
    const shaped = line.map((v, i) => v - line[(i + N - comb) % N] * 0.9);
    const seconds = LITE ? 1.2 : 1.9;
    const buffer = ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    const d = buffer.getChannelData(0);
    // low strings ring longer than high ones
    const loss = Math.pow(0.001, 1 / (f * Math.min(2.6, 1.5 * Math.pow(330 / f, 0.5))));
    let peak = 0;
    let i = 0;
    for (let n = 0; n < d.length; n++) {
      const a = shaped[i];
      const b = shaped[(i + 1) % N];
      const v = a * 0.62 + b * 0.38;
      d[n] = a;
      shaped[i] = v * loss;
      i = (i + 1) % N;
      peak = Math.max(peak, Math.abs(a));
    }
    for (let n = 0; n < d.length; n++) d[n] /= peak;
    s = { buffer, rate: f / (sr / (N - 0.38)) };
    this.strings.set(note, s);
    return s;
  }

  /** One plucked note through the box of its instrument. */
  private pluck(at: number, note: number, vol: number, pan: Pan, len: number, boxF: number, boxGain: number, top: number, dest: AudioNode, echo: number): void {
    const ctx = this.ctx!;
    const { buffer, rate } = this.string(note);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * STRING_LEVEL, at);
    g.gain.setValueAtTime(vol * STRING_LEVEL, at + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    const box = ctx.createBiquadFilter();
    box.type = 'peaking';
    box.frequency.value = boxF;
    box.Q.value = 0.8;
    box.gain.value = boxGain;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = top;
    src.connect(box).connect(lp).connect(g).connect(this.pan(pan, dest));
    const e = ctx.createGain();
    e.gain.value = echo;
    g.connect(e).connect(this.echoIn);
    src.start(at);
    src.stop(at + len + 0.05);
  }

  /** A string of the qanun, warm rather than bright. Every reward in the game is made of it. */
  private mallet(at: number, note: number, vol: number, pan: Pan = 0, ring = 1, dest: AudioNode = this.sfx): void {
    this.pluck(at, note, vol, pan, 0.45 + ring * 0.55, 340, 5, 3400, dest, 0.08);
  }

  /** A chord of bowls rolled from the bottom up, on a soft drum. */
  private fanfare(at: number, notes: number[], len: number, vol: number): void {
    notes.forEach((n, i) => this.mallet(at + i * 0.035, n, vol * 2.2, (i - (notes.length - 1) / 2) * 0.25, 1 + len));
    this.doum(at, 0.6, this.sfx);
  }

  /** Sagat: the dancers' finger cymbals, one bright ring. */
  private sagat(at: number, f: number, vol: number, pan: Pan = 0, dest: AudioNode = this.sfx): void {
    for (const [r, g, d] of [[1, 1, 0.5], [2.41, 0.5, 0.3], [3.93, 0.28, 0.16]]) this.voice({ at, f: f * r, vol: vol * g, r: d, a: 0.001, pan, dest, echo: 0.15 });
  }

  /** Temple gong: inharmonic partials blooming after the strike, with a very long tail. */
  private gong(at: number, f: number, vol: number, pan: Pan = 0, len = 4): void {
    const parts: [number, number, number, number][] = [
      [1, 1, 0.012, 1],
      [1.48, 0.7, 0.05, 0.8],
      [2.09, 0.55, 0.09, 0.7],
      [2.73, 0.4, 0.14, 0.6],
      [3.41, 0.3, 0.2, 0.45],
      [4.37, 0.22, 0.26, 0.35],
      [5.61, 0.14, 0.3, 0.25],
    ];
    for (const [r, g, a, d] of parts) this.voice({ at, f: f * r, vol: vol * g, a, r: len * d, pan, echo: 0.15, detune: (Math.random() - 0.5) * 6 });
    this.hiss({ at, dur: 0.05, type: 'lowpass', f0: 900, vol: vol * 0.8, a: 0.001, pan });
  }

  /** Sistrum: a shaken rattle of small metal discs, the sound of the temple rites. */
  private sistrum(at: number, vol: number, pan: Pan = 0, shakes = 3): void {
    for (let i = 0; i < shakes; i++) {
      const t = at + i * 0.045 + Math.random() * 0.008;
      const v = vol * (1 - i / (shakes + 1));
      this.hiss({ at: t, dur: 0.06, type: 'bandpass', f0: 6200, q: 5, vol: v, a: 0.001, pan });
      this.hiss({ at: t, dur: 0.04, type: 'bandpass', f0: 8900, q: 7, vol: v * 0.6, a: 0.001, pan });
    }
  }

  /** Low impact: pitch-dropping sine + click transient + crunchy body. */
  private boom(at: number, vol: number, f = 60, pan: Pan = 0): void {
    this.voice({ at, f: f * 2.2, to: f * 0.5, glide: 0.35, vol, r: 0.6, a: 0.003, pan });
    this.voice({ at, f: f * 4, to: f, glide: 0.06, type: 'triangle', vol: vol * 0.5, r: 0.12, a: 0.001, pan });
    this.hiss({ at, dur: 0.25, type: 'lowpass', f0: 2600, f1: 120, vol: vol * 0.45, a: 0.002, pan });
  }

  /** Darbuka: the round "doum" in the middle of the skin, its pitch dropping as the skin relaxes. */
  private doum(at: number, vol = 1, dest: AudioNode = this.music): void {
    this.voice({ at, f: 168, to: 86, glide: 0.05, vol: 0.5 * vol, r: 0.34, a: 0.002, dest });
    this.voice({ at, f: 276, to: 170, glide: 0.04, vol: 0.13 * vol, r: 0.11, a: 0.001, dest });
    this.hiss({ at, dur: 0.022, type: 'bandpass', f0: 900, q: 0.9, vol: 0.14 * vol, a: 0.0008, dest });
  }

  /** The dry, ringing "tek" of the fingertips on the rim. */
  private tek(at: number, vol = 1, dest: AudioNode = this.music): void {
    this.voice({ at, f: 1240, to: 1050, glide: 0.02, vol: 0.16 * vol, r: 0.07, a: 0.0008, dest, pan: 0.15 });
    this.voice({ at, f: 2380, to: 2150, glide: 0.02, vol: 0.05 * vol, r: 0.04, a: 0.0008, dest, pan: 0.15 });
    this.hiss({ at, dur: 0.014, type: 'bandpass', f0: 2800, q: 1.4, vol: 0.2 * vol, a: 0.0006, dest, pan: 0.15 });
  }

  private timpani(at: number, f: number, vol: number): void {
    this.voice({ at, f: f * 1.5, to: f, glide: 0.05, vol, r: 1.1, a: 0.004 });
    this.voice({ at, f: f * 2.4, to: f * 2.2, glide: 0.1, vol: vol * 0.25, r: 0.5, a: 0.003 });
    this.hiss({ at, dur: 0.12, type: 'lowpass', f0: 900, f1: 200, vol: vol * 0.35, a: 0.002 });
  }

  /* ================================================================ ambience & music */

  private startMusic(): void {
    this.startDrone();
    this.scheduleAmbience();
    void this.loadTrack('music');
    void this.loadTrack('bonus');
    clearInterval(this.seqTimer);
    this.seqTimer = window.setInterval(() => this.sequence(), 50);
  }

  /** A desert night: an open drone on E and B, and wind moving through the stones. */
  private startDrone(): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    const g = ctx.createGain();
    g.gain.value = 0.13;
    for (const [f, type] of [[41.2, 'sine'], [82.41, 'triangle'], [82.6, 'triangle'], [123.47, 'triangle'], [164.8, 'sine']] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    this.droneOut = ctx.createGain();
    this.droneOut.connect(this.music);
    lp.connect(g).connect(this.droneOut);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 0.7;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.09;
    const lfo2g = ctx.createGain();
    lfo2g.gain.value = 260;
    lfo2.connect(lfo2g).connect(bp.frequency);
    lfo2.start();
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    n.connect(bp).connect(ng).connect(this.music);
    n.start();
  }

  private tracks = new Map<string, AudioBuffer>();
  private track: { name: string; out: GainNode; src: AudioBufferSourceNode } | null = null;
  private droneOut: GainNode | null = null;

  /** Fetches a recording of the score, if there is one, and starts it if its moment has come. */
  private async loadTrack(name: string): Promise<void> {
    try {
      const res = await fetch(`assets/audio/${name}.mp3`);
      if (!res.ok || !res.headers.get('content-type')?.includes('audio')) return;
      this.tracks.set(name, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
      if (name === 'music' || this.feature) this.playScore();
    } catch {
      /* no recording: the game keeps its night sounds */
    }
  }

  /** Crossfades to the recording of the moment. */
  private playScore(): void {
    const ctx = this.ctx!;
    const name = this.feature && this.tracks.has('bonus') ? 'bonus' : 'music';
    const buffer = this.tracks.get(name);
    if (!buffer || this.track?.name === name) return;
    const at = this.t;
    if (this.track) {
      this.track.out.gain.setTargetAtTime(0.0001, at, 0.4);
      this.track.src.stop(at + 2.5);
    }
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.setTargetAtTime(1.4, at, 0.4);
    out.connect(this.music);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(out);
    src.start(at);
    this.track = { name, out, src };
    this.droneOut?.gain.setTargetAtTime(0.0001, at, 0.5);
  }

  /** Runs every 50 ms: the loop of the big wins is scheduled ahead of time. */
  private sequence(): void {
    if (this.ctx) this.bigWinSequence();
  }

  /** Now and then, far away in the temple: a gong, or a sistrum in another chamber. */
  private scheduleAmbience(): void {
    clearTimeout(this.ambTimer);
    this.ambTimer = window.setTimeout(() => {
      if (!this.ctx) return;
      const at = this.t;
      const p = (Math.random() - 0.5) * 1.6;
      const roll = Math.random();
      if (roll < 0.34) this.gong(at, 62, 0.02, p, 4);
      else if (roll < 0.6) this.sistrum(at, 0.02, p, 5);
      else this.hiss({ at, dur: 3.6, type: 'bandpass', f0: 420, f1: 1100, q: 0.8, vol: 0.05, a: 1.6, dest: this.music, pan: -p, pan1: p }); // a gust over the dunes
      this.scheduleAmbience();
    }, 9000 + Math.random() * 11000);
  }

  /* ================================================================ sfx */

  /** Small stone button. */
  click(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.voice({ at, f: 320, to: 170, glide: 0.05, vol: 0.45, r: 0.07, a: 0.001, dest: this.ui });
    this.hiss({ at, dur: 0.018, type: 'bandpass', f0: 1900, q: 2, vol: 0.3, a: 0.001, dest: this.ui });
  }

  /** The press: a small, crisp click and a breath of air as the wheels go. */
  spinStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.voice({ at, f: 240, to: 110, glide: 0.04, vol: 0.28, r: 0.07, a: 0.001 });
    this.hiss({ at, dur: 0.01, type: 'bandpass', f0: 2600, q: 1.5, vol: 0.14, a: 0.0005 });
    this.hiss({ at: at + 0.01, dur: 0.22, type: 'bandpass', f0: 600, f1: 2200, q: 0.8, vol: 0.035, a: 0.05, pan: -0.3, pan1: 0.3 });
    this.startSpinLoop(at + 0.03);
  }

  /** One second of a soft, airy whirr with a light pulse in it: it should almost not be noticed. Seamless when looped. */
  private spinBuffer: AudioBuffer | null = null;

  private makeSpinBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const N = sr;
    const F = Math.floor(sr * 0.05);
    const b = ctx.createBuffer(2, N, sr);
    const beats = 12;
    for (let ch = 0; ch < 2; ch++) {
      const raw = new Float32Array(N + F);
      let lp = 0;
      for (let i = 0; i < raw.length; i++) {
        lp = lp * 0.93 + (Math.random() * 2 - 1) * 0.07;
        const phase = (i / N) * beats + (ch ? 0.35 : 0);
        raw[i] = lp * (0.6 + 0.4 * Math.pow(0.5 + 0.5 * Math.cos(phase * Math.PI * 2), 2));
      }
      const d = b.getChannelData(ch);
      for (let i = 0; i < N; i++) d[i] = i < F ? raw[i] * (i / F) + raw[N + i] * (1 - i / F) : raw[i];
    }
    return b;
  }

  private spinGain: GainNode | null = null;

  /** Reels spinning: the rumble thins out as each reel stops. */
  private startSpinLoop(at: number): void {
    this.spinLoop?.stop(at);
    const ctx = this.ctx!;
    this.spinBuffer ??= this.makeSpinBuffer();
    const src = ctx.createBufferSource();
    src.buffer = this.spinBuffer;
    src.loop = true;
    src.playbackRate.setValueAtTime(0.7, at);
    src.playbackRate.linearRampToValueAtTime(1.05, at + 0.35);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(SPIN_LEVEL, at + 0.18);
    src.connect(tone).connect(out).connect(this.sfx);
    src.start(at);
    this.spinGain = out;
    const kill = window.setTimeout(() => this.spinLoop?.stop(this.t), 12000);
    this.spinLoop = {
      stop: (t: number) => {
        clearTimeout(kill);
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0.0001, t, 0.04);
        src.stop(t + 0.3);
        this.spinLoop = null;
        this.spinGain = null;
      },
    };
  }

  /**
   * A reel stops: a soft thud and one round note. The five notes climb E F G# A and resolve up on E,
   * so each spin plays a little phrase that wants to be heard to its end.
   */
  reelStop(i: number, slammed = false): void {
    if (!this.ctx) return;
    const at = this.t;
    const pan = (i - 2) * 0.12;
    const last = i >= 4;
    // stopped by hand, the reels fall together: one blow, not a pile of notes
    if (slammed && !last) return;
    this.voice({ at, f: 132 - i * 4, to: 68, glide: 0.05, vol: 0.3, r: 0.1, a: 0.001, pan });
    this.mallet(at, [64, 65, 68, 69, 76][Math.min(4, i)], last ? 0.44 : 0.36, pan, last ? 1.5 : 0.8);
    if (last) this.spinLoop?.stop(at);
    else if (this.spinGain) this.spinGain.gain.setTargetAtTime(SPIN_LEVEL * ((4 - i) / 5), at, 0.03);
  }

  /** A door of stone dragged open: a long low grind with grit falling from the lintel. */
  stoneDoor(dur: number): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur, type: 'bandpass', f0: 130, f1: 260, q: 1.2, vol: 0.32, a: dur * 0.2 });
    this.voice({ at, f: 46, to: 38, glide: dur, vol: 0.2, r: dur * 0.6, a: dur * 0.3, hold: dur * 0.2 });
    for (let k = 0; k < 4; k++) this.rubble(at + k * (dur / 4) + Math.random() * 0.1, 7, (Math.random() - 0.5) * 1.2);
  }

  /** Small stones: dry ticks in a falling scatter. */
  private rubble(at: number, n: number, pan: Pan): void {
    for (let k = 0; k < n; k++) {
      const t = at + Math.pow(k / n, 1.5) * 0.36 + Math.random() * 0.012;
      const big = Math.random() < 0.35;
      this.hiss({ at: t, dur: big ? 0.03 : 0.014, type: 'bandpass', f0: big ? 620 + Math.random() * 500 : 1500 + Math.random() * 2200, q: 2.6, vol: (big ? 0.16 : 0.09) * (1 - (k / n) * 0.7), a: 0.0007, pan: pan + (Math.random() - 0.5) * 0.7 });
    }
  }

  /**
   * A gold coin: the strike is a tick of bright metal; its bell modes are inharmonic and one of them
   * is doubled a few hertz apart, which gives struck gold its shimmer. Long ones settle in two
   * small bounces; a short one is a single clean ting for fast counting.
   */
  private coin(at: number, vol: number, pan: Pan, pitch = 1, dest: AudioNode = this.sfx, short = false): void {
    const f = 2900 * pitch;
    const modes: [number, number, number][] = [
      [1, 0.62, 0.15],
      [1.34, 1, 0.3],
      [1.87, 0.6, 0.2],
      [2.41, 0.36, 0.13],
      [3.03, 0.22, 0.08],
    ];
    const ring = (t: number, v: number, decay: number, count: number) => {
      for (const [r, g, d] of modes.slice(0, count)) {
        this.voice({ at: t, f: f * r * (1 + (Math.random() - 0.5) * 0.008), vol: v * g, r: d * decay, a: 0.0006, pan, dest });
      }
      this.hiss({ at: t, dur: 0.006, type: 'bandpass', f0: 7400, q: 1.2, vol: v * 0.8, a: 0.0004, pan, dest });
    };
    this.voice({ at, f: f * 1.34 + 5, vol: vol * 0.5, r: 0.3, a: 0.0006, pan, dest, echo: short ? 0 : 0.08 });
    if (short) {
      ring(at, vol, 0.55, 3);
      return;
    }
    ring(at, vol, 1, 5);
    const gap = 0.055 + Math.random() * 0.03;
    ring(at + gap, vol * 0.34, 0.5, 3);
    ring(at + gap * 1.7, vol * 0.14, 0.32, 2);
  }

  /** A pour of coins into a heap, carried on a shake of the sistrum, the rattle of the temples. */
  coins(n: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const count = Math.min(12, 3 + Math.round(n * 0.5));
    const span = 0.3 + count * 0.04;
    for (let k = 0; k < count; k++) {
      const dt = Math.pow(Math.random(), 1.4) * span;
      this.coin(at + dt, 0.035 + Math.random() * 0.03, (Math.random() - 0.5) * 1.4, 0.88 + Math.random() * 0.34);
    }
    this.sistrum(at, 0.022, -0.3, 3);
    if (count > 6) this.sistrum(at + span * 0.55, 0.018, 0.3, 3);
    this.hiss({ at, dur: span + 0.12, type: 'bandpass', f0: 5200, f1: 3400, q: 0.9, vol: 0.012, a: 0.03, pan: -0.25, pan1: 0.25 });
  }

  /** A pyramid lands: a temple gong, pitch climbing with each one, and voices rising with it. */
  codex(n: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const note = 45 + [0, 3, 7, 12, 15][Math.min(4, Math.max(0, n - 1))];
    this.gong(at, midi(note) / 2, 0.07 + n * 0.01, (n - 3) * 0.25, 2.4);
    this.boom(at, 0.22, 46);
    this.mallet(at, note + 24, 0.14, 0, 2);
  }

  /** The last reel decides: drum roll closing in, sistrum shaking faster, strings climbing. */
  anticipation(dur: number): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur, type: 'bandpass', f0: 400, f1: 2400, q: 1.2, vol: 0.025, a: dur * 0.8 });
    // the drum roll tightens as the reel slows
    let t = 0;
    let gap = 0.26;
    while (t < dur) {
      const k = t / dur;
      this.doum(at + t, 0.25 + k * 0.35, this.sfx);
      // the same string, plucked faster and faster
      this.mallet(at + t, 64, 0.05 + k * 0.08, 0, 0.3);
      t += gap;
      gap = Math.max(0.075, gap * 0.9);
    }
  }

  /** Cinematic impact: sub drop, crack, metallic ring and a long dark tail. */
  impact(power = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    this.voice({ at, f: 110, to: 32, glide: 0.5, vol: 0.55 * power, r: 1.2, a: 0.002 });
    this.hiss({ at, dur: 0.07, type: 'highpass', f0: 1500, vol: 0.26 * power, a: 0.0008 });
    this.hiss({ at, dur: 1.4, type: 'lowpass', f0: 1000, f1: 60, vol: 0.2 * power, a: 0.01 });
    this.gong(at, 49, 0.08 * power, 0, 2.4);
  }

  /** Rising tension: noise sweep and a climbing detuned saw. */
  riser(dur: number, power = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur, type: 'bandpass', f0: 300, f1: 3000, q: 1.2, vol: 0.08 * power, a: dur * 0.9, pan: -0.4, pan1: 0.4 });
  }

  /* ---------------------------------------------------------------- big wins */

  private bigLoop: { next: number; step: number; tier: number; until: number; out: GainNode } | null = null;

  /** Big win opens: the music ducks and the temple orchestra takes over. */
  bigWinStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.duck(0.18);
    const out = this.ctx.createGain();
    out.gain.value = 1;
    out.connect(this.sfx);
    this.bigLoop = { next: at + 0.42, step: 0, tier: 0, until: at + 60, out };
    this.hiss({ at, dur: 0.42, type: 'bandpass', f0: 500, f1: 4200, q: 1.2, vol: 0.14, a: 0.38 });
    this.coins(18);
  }

  /** Runs inside the music sequencer: 132 bpm drums and a mizmar figure that climbs with the tier. */
  private bigWinSequence(): void {
    const b = this.bigLoop;
    if (!b) return;
    const stepDur = 60 / 132 / 2;
    while (b.next < this.t + 0.25 && b.next < b.until) {
      const at = b.next;
      const s = b.step % 8;
      const hit = SAIDI[s];
      if (hit === 'D') this.doum(at, 0.7, b.out);
      else if (hit === 'T') this.tek(at, 0.5, b.out);
      if (s % 2 === 1) this.sistrum(at, 0.01, s < 4 ? -0.4 : 0.4, 2);
      const up = [0, 3, 5, 7][Math.min(3, b.tier)];
      this.voice({ at, f: midi(40 + up + BASS_WALK[s]), vol: 0.16, r: stepDur * 0.85, a: 0.005, type: 'triangle', dest: b.out });
      b.next += stepDur;
      b.step++;
    }
  }

  /** Each big-win tier: timpani, a brass chord climbing the Hijaz scale and a gong. */
  tierUp(tier: number): void {
    if (!this.ctx) return;
    const at = this.t;
    if (this.bigLoop) this.bigLoop.tier = tier;
    const r = [52, 55, 57, 59][Math.min(tier, 3)];
    this.timpani(at, midi(r - 24), 0.5);
    this.fanfare(at, [r + 12, r + 19, r + 24], 1, 0.06 + tier * 0.01);
    this.impact(0.4 + tier * 0.1);
    this.coins(10 + tier * 4);
  }

  /** The count lands: the loop stops dead on one huge Hijaz chord. */
  bigWinEnd(tier: number): void {
    if (!this.ctx) return;
    const at = this.t;
    if (this.bigLoop) this.bigLoop.until = at;
    this.timpani(at, midi(28), 0.6);
    this.fanfare(at, [52, 64, 71, 76, 80], 2, 0.07);
    this.gong(at, 41, 0.18 + tier * 0.01, 0, 4.5);
    this.impact(0.7);
    for (let i = 0; i < 6; i++) this.mallet(at + 0.08 + i * 0.07, 64 + [0, 1, 4, 5, 7, 12][i], 0.12, (i - 2.5) * 0.25, 1.6);
    this.coins(24);
  }

  /** Overlay closes: the loop is gone and the music comes back. */
  bigWinStop(): void {
    if (!this.ctx || !this.bigLoop) return;
    const { out } = this.bigLoop;
    out.gain.setTargetAtTime(0.0001, this.t, 0.12);
    window.setTimeout(() => out.disconnect(), 1500);
    this.bigLoop = null;
    this.duck(1);
  }

  /** The cinematics speak for themselves: the music steps far back, until the bonus begins. */
  hush(on: boolean): void {
    if (!this.ctx) return;
    clearTimeout(this.breathTimer);
    this.duck(on ? 0.22 : 1);
  }

  private duck(level: number): void {
    this.musicDuck.gain.setTargetAtTime(level, this.ctx!.currentTime, 0.2);
  }

  private breathTimer = 0;

  /** The music steps back for a moment, so a reward can be heard without being louder. */
  private breathe(): void {
    if (this.bigLoop) return;
    this.duck(0.6);
    clearTimeout(this.breathTimer);
    this.breathTimer = window.setTimeout(() => !this.bigLoop && this.duck(1), 1100);
  }

  /** Low drum swell under a big-win count-up. */
  timpaniRoll(dur: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const n = Math.floor(dur / 0.09);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      this.voice({ at: at + i * 0.09 + Math.random() * 0.01, f: 62, to: 41, glide: 0.05, vol: 0.03 + k * 0.1, r: 0.22, a: 0.003 });
    }
  }

  /** Win: finger cymbals running up the Hijaz scale over a mizmar call, then a warm chord. size 0..3. */
  win(size: number, streak = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    this.breathe();
    const up = Math.min(Math.max(0, streak - 1), 4) * 2; // wins in a row climb
    const scale = [64, 65, 68, 69, 71, 72, 74, 76].map((n) => n + up);
    const count = 4 + size;
    const gap = 0.075;
    for (let i = 0; i < count; i++) this.mallet(at + i * gap, scale[i % scale.length], 0.13, (i / count - 0.5) * 0.9, 1);
    const end = at + count * gap;
    for (const n of [64, 71, 76]) this.mallet(end, n + up, 0.09, 0, 2);
    if (size >= 2) this.gong(end, 55, 0.04, 0, 2.2);
  }

  /** A winning symbol lights up: one clear note, higher along the reels. */
  ignite(reel: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const note = [64, 65, 68, 69, 71][Math.min(4, reel)];
    const pan = (reel - 2) * 0.3;
    this.mallet(at, note, 0.2, pan, 1.2);
  }

  /** Count-up tick: a small coin; give it progress (0..1) and it climbs in pitch as the total grows. */
  tick(progress = -1): void {
    if (!this.ctx) return;
    const at = this.t;
    if (progress >= 0) {
      // the count climbs the game's own scale, so a long count-up sings instead of just rattling
      const step = Math.floor(Math.min(1, progress) * (TICK_SCALE.length - 1));
      this.coin(at, 0.13, (Math.random() - 0.5) * 0.5, Math.pow(2, TICK_SCALE[step] / 12), this.ui, true);
    } else this.coin(at, 0.15, (Math.random() - 0.5) * 0.4, 0.97 + Math.random() * 0.08, this.ui, true);
  }

  /** A strain floods a reel: rushing sand, a rising voice, a slab slamming home. */
  expand(): void {
    if (!this.ctx) return;
    const at = this.t;
    // the bolt that falls from the bar
    this.hiss({ at, dur: 0.42, type: 'bandpass', f0: 300, f1: 2000, q: 1.2, vol: 0.05, a: 0.26 });
    this.boom(at + 0.42, 0.24, 46);
    this.gong(at + 0.42, 55, 0.06, 0, 2);
    for (const n of [64, 71, 76]) this.mallet(at + 0.42, n, 0.11, 0, 2);
  }

  /** Lightning: a whip-crack and crackle for a close strike, then thunder rolling across the stereo field. */
  lightning(power = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    const pan = (Math.random() - 0.5) * 0.8;
    if (power >= 0.5) {
      this.boom(at, 0.16 * power, 36, pan);
    }
    const t2 = at + (power >= 0.5 ? 0.08 : 0.6);
    this.hiss({ at: t2, dur: 2.2 + power, type: 'lowpass', f0: 500 + power * 400, f1: 45, vol: 0.015 + power * 0.1, a: power >= 0.5 ? 0.05 : 0.4, pan: pan - 0.5, pan1: pan + 0.5 });
    this.voice({ at: t2, f: 38, to: 30, glide: 2, vol: 0.015 + power * 0.1, r: 1.8 + power, a: 0.1 });
  }

  /** The curse strikes: sub boom, gong, and a dark cluster of low voices. level 0..3 scales it. */
  stinger(level: number): void {
    if (!this.ctx) return;
    const at = this.t;
    this.boom(at, 0.7, 40);
    this.gong(at, 44 + level * 3, 0.16 + level * 0.03, 0, 3);
  }

  /** A pyramid sends its thread of gold: a note climbing at speed, higher with each one. */
  templeCall(i: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const n = [57, 60, 64, 69, 72][Math.min(4, i)];
    const pan = (i - 1) * 0.4;
    this.voice({ at, f: midi(n), to: midi(n + 24), glide: 0.34, type: 'triangle', vol: 0.07, r: 0.42, a: 0.01, pan, echo: 0.3 });
    this.mallet(at + 0.32, n + 12, 0.12, pan, 1.5);
  }

  /** A doorway of the corridor rushes past: a thump and a blow of air, on one side then the other. */
  doorPass(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.doorSide = -this.doorSide;
    this.hiss({ at, dur: 0.22, type: 'bandpass', f0: 500, f1: 1600, q: 0.8, vol: 0.18, a: 0.04, pan: this.doorSide * 0.8, pan1: -this.doorSide * 0.8 });
    this.voice({ at, f: 74, to: 40, glide: 0.12, vol: 0.26, r: 0.16, a: 0.003, pan: this.doorSide * 0.3 });
  }

  /** The last free spin waits for its press: a low gong and the heart of the temple, twice. */
  lastSpin(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.gong(at, midi(33), 0.06, 0, 3);
    this.doum(at, 0.8, this.sfx);
    this.doum(at + 0.3, 0.55, this.sfx);
  }

  /** A strain catches in the bar of the panel: two bowls, and the finger cymbals. */
  strainIgnite(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.mallet(at, 76, 0.16, -0.1, 1.4);
    this.mallet(at + 0.08, 83, 0.14, 0.1, 1.8);
    this.sagat(at + 0.08, 2100, 0.012);
  }

  /** The gold of a win reaches the bonus total: one high bowl and two coins. */
  gainLand(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.mallet(at, 88, 0.16, 0.3, 1.3);
    this.coin(at, 0.09, 0.2, 1);
    this.coin(at + 0.06, 0.06, 0.4, 1.12);
  }

  /** A new record: the bowls climb the scale to the top and a bright ring answers. */
  record(): void {
    if (!this.ctx) return;
    const at = this.t;
    [64, 65, 68, 69].forEach((n, i) => this.mallet(at + i * 0.09, n, 0.13, (i - 1.5) * 0.2, i === 3 ? 2.4 : 1));
    this.sagat(at + 0.27, 2100, 0.014);
  }

  /** One tooth of the strain drum going by: a dry catch and a small gold note, climbing the scale. */
  drumTick(progress: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const step = Math.floor(Math.min(1, Math.max(0, progress)) * (TICK_SCALE.length - 1));
    this.hiss({ at, dur: 0.012, type: 'bandpass', f0: 2100, q: 2, vol: 0.2, a: 0.0006 });
    this.voice({ at, f: 190, to: 120, glide: 0.03, vol: 0.14, r: 0.05, a: 0.001 });
    this.mallet(at, 69 + TICK_SCALE[step], 0.19, 0, 0.35);
  }

  /** The drum locks on the strain: a great gong, the temple choir, and the reed crying out the scale. */
  strainLock(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.gong(at, midi(33), 0.1, 0, 4);
    [64, 65, 68, 69, 71].forEach((n, i) => this.mallet(at + 0.08 + i * 0.08, n, 0.12, (i - 2) * 0.2, i === 4 ? 2.4 : 1));
  }

  featureStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.stinger(2);
    [64, 65, 68, 69, 71, 76].forEach((n, i) => this.mallet(at + 0.4 + i * 0.1, n, 0.13, (i - 2.5) * 0.25, i === 5 ? 2.4 : 1.2));
  }
}
