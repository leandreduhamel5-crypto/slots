import { LITE } from './device';
/**
 * Procedural sound design with the Web Audio API: no audio files. Every sound here comes back
 * thousands of times in a session, so the rules are strict: low, round, short, one thing at a time,
 * nothing that beats, and nothing bright. A reward is a low plucked string (Karplus-Strong), never
 * an edge of metal. Measure after any change: see tools notes in memory, the ear cannot be used here.
 *
 * The score is not composed here: real recordings dropped in public/assets/audio/ (music.mp3 for the
 * game, bonus.mp3 for the free spins) play in a loop under the sound effects. Without them the game
 * only has its wind.
 *
 * Mix: sfx / ui / music buses → a soft top → glue compressor → limiter, with a short stone-hall
 * reverb (generated impulse response).
 */

type Pan = number;

const A4 = 440;
const midi = (n: number) => A4 * Math.pow(2, (n - 69) / 12);
/* Everything sits on E Hijaz (phrygian dominant): the augmented second F → G# is the Egyptian colour. */
/** Saidi, the horse-dance of Upper Egypt: D T . D D . T . */
const SAIDI = ['D', 'T', '', 'D', 'D', '', 'T', ''];
/** the walking bass under the big wins: root, fifth, octave */
const BASS_WALK = [0, 0, 0, 7, 12, 0, 7, 1];
const SPIN_LEVEL = 0.05;
const MUSIC_LEVEL = 0.5;
/** a phone's little speaker needs a little more */
const MASTER_LEVEL = LITE ? 0.85 : 0.65;

export class Audio {
  private ctx: BaseAudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private ui!: GainNode;
  private music!: GainNode;
  private reverbIn!: GainNode;
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
    glue.threshold.value = -22;
    glue.ratio.value = 2.5;
    glue.attack.value = 0.01;
    glue.release.value = 0.25;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    // nothing tiring gets through: the top of the spectrum is closed for everything, music included
    const top = ctx.createBiquadFilter();
    top.type = 'lowpass';
    top.frequency.value = 5200;
    top.Q.value = 0.5;
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 110;
    low.gain.value = 1.5;
    this.master.connect(top).connect(low).connect(glue).connect(limiter).connect(ctx.destination);

    // a short stone room: the tail of a long hall piles up over thousands of sounds
    const verb = ctx.createConvolver();
    verb.buffer = this.makeImpulse(LITE ? 1.3 : 1.8, 3);
    const verbTone = ctx.createBiquadFilter();
    verbTone.type = 'lowpass';
    verbTone.frequency.value = 2200;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.4;
    this.reverbIn = ctx.createGain();
    // the walls are far away: the hall answers a moment after the sound
    const distance = ctx.createDelay(0.1);
    distance.delayTime.value = 0.035;
    this.reverbIn.connect(distance).connect(verb).connect(verbTone).connect(verbOut).connect(this.master);

    const bus = (gain: number, verbSend: number) => {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(this.master);
      const s = ctx.createGain();
      s.gain.value = verbSend;
      g.connect(s).connect(this.reverbIn);
      return g;
    };
    this.sfx = bus(0.9, 0.12);
    this.ui = bus(0.6, 0.02);
    const music = bus(MUSIC_LEVEL, 0.2);
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
      lp = lp * 0.72 + (Math.random() * 2 - 1) * 0.28;
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

  /** One plucked note of an oud: low, round, and over quickly. Every reward in the game is made of it. */
  private oud(at: number, note: number, vol: number, pan: Pan = 0, ring = 1, dest: AudioNode = this.sfx): void {
    const ctx = this.ctx!;
    const { buffer, rate } = this.string(note);
    const len = 0.5 + ring * 0.6;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    // a thumb, not a pick: the note swells for a few milliseconds instead of snapping
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.setValueAtTime(vol, at + len * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    const box = ctx.createBiquadFilter();
    box.type = 'peaking';
    box.frequency.value = 260;
    box.Q.value = 0.8;
    box.gain.value = 4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    src.connect(box).connect(lp).connect(g).connect(this.pan(pan, dest));
    src.start(at);
    src.stop(at + len + 0.05);
  }

  /** Several strings stroked with the thumb, from the bottom up. */
  private strum(at: number, notes: number[], vol: number, ring = 1.5): void {
    notes.forEach((n, i) => this.oud(at + i * 0.035, n, vol, (i - (notes.length - 1) / 2) * 0.16, ring));
  }

  /** A bronze bowl touched with a soft mallet: a round note with no edge. */
  private bowl(at: number, f: number, vol: number, pan: Pan = 0, len = 1): void {
    for (const [r, g, d] of [[1, 1, 1], [2.01, 0.14, 0.55], [3.02, 0.04, 0.3]]) this.voice({ at, f: f * r, vol: vol * g, a: 0.008, r: len * d, pan });
  }

  /** Temple gong, far away: only its low partials reach here. */
  private gong(at: number, f: number, vol: number, pan: Pan = 0, len = 3): void {
    for (const [r, g, a, d] of [[1, 1, 0.02, 1], [1.48, 0.6, 0.06, 0.75], [2.09, 0.34, 0.1, 0.55], [2.73, 0.16, 0.16, 0.4]]) {
      this.voice({ at, f: f * r, vol: vol * g, a, r: len * d, pan, detune: (Math.random() - 0.5) * 5 });
    }
  }

  /** A weight set down: a pitch that sinks and a breath of low air. */
  private boom(at: number, vol: number, f = 60, pan: Pan = 0): void {
    this.voice({ at, f: f * 2, to: f * 0.6, glide: 0.2, vol, r: 0.5, a: 0.006, pan });
    this.hiss({ at, dur: 0.22, type: 'lowpass', f0: 420, f1: 90, vol: vol * 0.3, a: 0.004, pan });
  }

  /** Darbuka: the round "doum" in the middle of the skin, its pitch dropping as the skin relaxes. */
  private doum(at: number, vol = 1, dest: AudioNode = this.music): void {
    this.voice({ at, f: 150, to: 82, glide: 0.05, vol: 0.34 * vol, r: 0.3, a: 0.003, dest });
    this.voice({ at, f: 240, to: 150, glide: 0.04, vol: 0.07 * vol, r: 0.1, a: 0.002, dest });
  }

  /** The same skin touched nearer the rim, with the flesh of the finger. */
  private knock(at: number, vol = 1, dest: AudioNode = this.music): void {
    this.voice({ at, f: 340, to: 280, glide: 0.03, vol: 0.09 * vol, r: 0.07, a: 0.002, dest, pan: 0.12 });
  }

  /* ================================================================ ambience & music */

  private startMusic(): void {
    this.startWind();
    this.scheduleAmbience();
    void this.loadTrack('music');
    void this.loadTrack('bonus');
    clearInterval(this.seqTimer);
    this.seqTimer = window.setInterval(() => this.sequence(), 50);
  }

  /** The desert at night, very far off: wind moving through the stones. */
  private startWind(): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 340;
    bp.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 150;
    lfo.connect(depth).connect(bp.frequency);
    lfo.start();
    this.windOut = ctx.createGain();
    this.windOut.gain.value = 0.02;
    n.connect(bp).connect(this.windOut).connect(this.music);
    n.start();
  }

  private tracks = new Map<string, AudioBuffer>();
  private track: { name: string; out: GainNode; src: AudioBufferSourceNode } | null = null;
  private windOut: GainNode | null = null;

  /** Fetches a recording of the score, if there is one, and starts it if its moment has come. */
  private async loadTrack(name: string): Promise<void> {
    try {
      const res = await fetch(`assets/audio/${name}.mp3`);
      if (!res.ok || !res.headers.get('content-type')?.includes('audio')) return;
      this.tracks.set(name, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
      if (name === 'music' || this.feature) this.playScore();
    } catch {
      /* no recording: the game keeps its wind */
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
    out.gain.setTargetAtTime(1, at, 0.4);
    out.connect(this.music);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(out);
    src.start(at);
    this.track = { name, out, src };
    this.windOut?.gain.setTargetAtTime(0.008, at, 0.5);
  }

  /** Runs every 50 ms: the loop of the big wins is scheduled ahead of time. */
  private sequence(): void {
    if (this.ctx) this.bigWinSequence();
  }

  /** Now and then a gust over the dunes. */
  private scheduleAmbience(): void {
    clearTimeout(this.ambTimer);
    this.ambTimer = window.setTimeout(() => {
      if (!this.ctx) return;
      const p = (Math.random() - 0.5) * 1.6;
      this.hiss({ at: this.t, dur: 3.6, type: 'bandpass', f0: 300, f1: 620, q: 0.8, vol: 0.022, a: 1.6, dest: this.music, pan: -p, pan1: p });
      this.scheduleAmbience();
    }, 14000 + Math.random() * 12000);
  }

  /* ================================================================ sfx */

  /** Small stone button. */
  click(): void {
    if (!this.ctx) return;
    this.voice({ at: this.t, f: 280, to: 190, glide: 0.04, vol: 0.14, r: 0.06, a: 0.002, dest: this.ui });
  }

  /** The press: a soft push, and the reels are away. */
  spinStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.voice({ at, f: 150, to: 82, glide: 0.09, vol: 0.09, r: 0.13, a: 0.005 });
    this.startSpinLoop(at + 0.03);
  }

  /** One second of the reels turning: a low, even murmur, nothing that beats. Seamless when looped. */
  private spinBuffer: AudioBuffer | null = null;

  private makeSpinBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const N = sr;
    const F = Math.floor(sr * 0.05);
    const b = ctx.createBuffer(2, N, sr);
    for (let ch = 0; ch < 2; ch++) {
      const raw = new Float32Array(N + F);
      let lp = 0;
      let peak = 0;
      for (let i = 0; i < raw.length; i++) {
        lp = lp * 0.975 + (Math.random() * 2 - 1) * 0.025;
        raw[i] = lp;
        peak = Math.max(peak, Math.abs(lp));
      }
      const d = b.getChannelData(ch);
      for (let i = 0; i < N; i++) d[i] = (i < F ? raw[i] * (i / F) + raw[N + i] * (1 - i / F) : raw[i]) / peak;
    }
    return b;
  }

  private spinGain: GainNode | null = null;

  /** Reels spinning: the murmur thins out as each reel stops. */
  private startSpinLoop(at: number): void {
    this.spinLoop?.stop(at);
    const ctx = this.ctx!;
    this.spinBuffer ??= this.makeSpinBuffer();
    const src = ctx.createBufferSource();
    src.buffer = this.spinBuffer;
    src.loop = true;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 420;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(SPIN_LEVEL, at + 0.2);
    src.connect(tone).connect(out).connect(this.sfx);
    src.start(at);
    this.spinGain = out;
    const kill = window.setTimeout(() => this.spinLoop?.stop(this.t), 12000);
    this.spinLoop = {
      stop: (t: number) => {
        clearTimeout(kill);
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0.0001, t, 0.05);
        src.stop(t + 0.3);
        this.spinLoop = null;
        this.spinGain = null;
      },
    };
  }

  /**
   * A reel seats: a soft, dull stop, always the same, because it comes back thousands of times.
   * The second tone is what a phone's little speaker can play of it.
   */
  reelStop(i: number, slammed = false): void {
    if (!this.ctx) return;
    const at = this.t;
    const pan = (i - 2) * 0.1;
    const last = i >= 4;
    // stopped by hand, the reels fall together: one blow, not a pile of them
    if (slammed && !last) return;
    const v = last ? 0.13 : 0.1;
    this.voice({ at, f: 116, to: 66, glide: 0.05, vol: v, r: 0.09, a: 0.003, pan });
    this.voice({ at, f: 390, to: 260, glide: 0.03, vol: v * 0.34, r: 0.05, a: 0.003, pan });
    if (last) this.spinLoop?.stop(at);
    else if (this.spinGain) this.spinGain.gain.setTargetAtTime(SPIN_LEVEL * ((4 - i) / 5), at, 0.04);
  }

  /** A door of stone dragged open: a long low grind with grit falling from the lintel. */
  stoneDoor(dur: number): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur, type: 'bandpass', f0: 110, f1: 200, q: 1.2, vol: 0.14, a: dur * 0.2 });
    this.voice({ at, f: 46, to: 38, glide: dur, vol: 0.12, r: dur * 0.6, a: dur * 0.3, hold: dur * 0.2 });
    for (let k = 0; k < 3; k++) this.rubble(at + k * (dur / 3) + Math.random() * 0.1, 4, (Math.random() - 0.5) * 1.2);
  }

  /** Small stones: dull knocks in a falling scatter. */
  private rubble(at: number, n: number, pan: Pan): void {
    for (let k = 0; k < n; k++) {
      const t = at + Math.pow(k / n, 1.5) * 0.36 + Math.random() * 0.012;
      this.voice({ at: t, f: 240 + Math.random() * 300, to: 130, glide: 0.03, vol: 0.022 * (1 - (k / n) * 0.7), r: 0.04, a: 0.002, pan: pan + (Math.random() - 0.5) * 0.7 });
    }
  }

  /** A gold coin set down: a soft low clink, nothing that rings in the teeth. */
  private coin(at: number, vol: number, pan: Pan, pitch = 1): void {
    const f = 1180 * pitch;
    this.voice({ at, f, vol, r: 0.1, a: 0.004, pan });
    this.voice({ at, f: f * 1.5, vol: vol * 0.22, r: 0.05, a: 0.004, pan });
  }

  /** A few coins on a heap. */
  coins(n: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const count = Math.min(5, 2 + Math.round(n * 0.2));
    for (let k = 0; k < count; k++) this.coin(at + k * 0.075 + Math.random() * 0.02, 0.014, (Math.random() - 0.5) * 0.9, 0.9 + Math.random() * 0.2);
  }

  /** A pyramid lands: a bronze bowl, higher with each one. */
  codex(n: number): void {
    if (!this.ctx) return;
    const at = this.t;
    const note = 57 + [0, 3, 7, 12, 15][Math.min(4, Math.max(0, n - 1))];
    this.bowl(at, midi(note), 0.1, (n - 3) * 0.25, 1.6);
    this.gong(at, midi(note - 24), 0.03, 0, 2);
    this.doum(at, 0.4, this.sfx);
  }

  /** The last reel decides: a heart beating faster under a low note that climbs. */
  anticipation(dur: number): void {
    if (!this.ctx) return;
    const at = this.t;
    this.voice({ at, f: 98, to: 130, glide: dur, vol: 0.035, a: dur * 0.5, hold: dur * 0.4, r: 0.3 });
    let t = 0;
    let gap = 0.46;
    while (t < dur) {
      this.doum(at + t, 0.2 + (t / dur) * 0.26, this.sfx);
      t += gap;
      gap = Math.max(0.24, gap * 0.88);
    }
  }

  /** Cinematic impact: something very heavy, a long way down. */
  impact(power = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    this.voice({ at, f: 90, to: 36, glide: 0.4, vol: 0.16 * power, r: 0.9, a: 0.006 });
    this.hiss({ at, dur: 0.9, type: 'lowpass', f0: 420, f1: 60, vol: 0.04 * power, a: 0.01 });
    this.gong(at, 49, 0.03 * power, 0, 2);
  }

  /** Rising tension: air slowly opening. */
  riser(dur: number, power = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur, type: 'bandpass', f0: 220, f1: 900, q: 0.9, vol: 0.022 * power, a: dur * 0.9, pan: -0.3, pan1: 0.3 });
  }

  /* ---------------------------------------------------------------- big wins */

  private bigLoop: { next: number; step: number; tier: number; until: number; out: GainNode } | null = null;

  /** Big win opens: the music ducks and a darbuka takes over, unhurried. */
  bigWinStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.duck(0.3);
    const out = this.ctx.createGain();
    out.gain.value = 1;
    out.connect(this.sfx);
    this.bigLoop = { next: at + 0.3, step: 0, tier: 0, until: at + 60, out };
    this.strum(at, [40, 47, 52], 0.13, 1.5);
  }

  /** Runs inside the sequencer: a saidi groove and a walking bass that climbs with the tier. */
  private bigWinSequence(): void {
    const b = this.bigLoop;
    if (!b) return;
    const stepDur = 60 / 108 / 2;
    while (b.next < this.t + 0.25 && b.next < b.until) {
      const at = b.next;
      const s = b.step % 8;
      const hit = SAIDI[s];
      if (hit === 'D') this.doum(at, 0.5, b.out);
      else if (hit === 'T') this.knock(at, 0.5, b.out);
      if (s % 2 === 0) this.oud(at, 40 + [0, 3, 5, 7][Math.min(3, b.tier)] + BASS_WALK[s], 0.09, 0, 0.5, b.out);
      b.next += stepDur;
      b.step++;
    }
  }

  /** Each big-win tier: a stroke of the strings and a far gong, a step higher. */
  tierUp(tier: number): void {
    if (!this.ctx) return;
    const at = this.t;
    if (this.bigLoop) this.bigLoop.tier = tier;
    const r = [52, 55, 57, 59][Math.min(tier, 3)];
    this.strum(at, [r - 12, r - 5, r], 0.16, 1.4);
    this.gong(at, midi(r - 24), 0.035, 0, 2);
    this.doum(at, 0.5, this.sfx);
  }

  /** The count lands: the groove stops on one full, warm chord. */
  bigWinEnd(tier: number): void {
    if (!this.ctx) return;
    const at = this.t;
    if (this.bigLoop) this.bigLoop.until = at;
    this.strum(at, [40, 52, 59, 64, 68], 0.16, 2);
    this.gong(at, 41, 0.05 + tier * 0.005, 0, 3);
    this.doum(at, 0.6, this.sfx);
    this.coins(10);
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

  /** A win: a few low notes of the oud, climbing the Hijaz scale, then one chord that rests. size 0..3. */
  win(size: number, streak = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    this.breathe();
    const up = Math.min(Math.max(0, streak - 1), 3); // wins in a row climb
    const scale = [52, 56, 57, 59, 64].map((n) => n + up);
    const count = 2 + Math.min(size, 3);
    const gap = 0.1;
    for (let i = 0; i < count; i++) this.oud(at + i * gap, scale[i], 0.2, (i / count - 0.5) * 0.5, 0.8);
    this.strum(at + count * gap, [52 + up, 59 + up, 64 + up], 0.1, 1.6);
    if (size >= 2) this.gong(at + count * gap, 55, 0.025, 0, 2);
  }

  /** A line is shown, or a win too small to celebrate: one dry touch. */
  tick(): void {
    if (!this.ctx) return;
    this.voice({ at: this.t, f: 460, to: 360, glide: 0.02, vol: 0.05, r: 0.05, a: 0.003, dest: this.ui });
  }

  /** A strain floods a reel: air rising, and a slab set down. */
  expand(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.hiss({ at, dur: 0.42, type: 'bandpass', f0: 200, f1: 640, q: 0.9, vol: 0.022, a: 0.26 });
    this.boom(at + 0.42, 0.1, 46);
    this.gong(at + 0.42, 55, 0.025, 0, 1.6);
    this.strum(at + 0.42, [52, 59, 64], 0.12, 1.4);
  }

  /** Thunder a long way off, rolling across the stereo field. */
  lightning(power = 1): void {
    if (!this.ctx) return;
    const at = this.t;
    const pan = (Math.random() - 0.5) * 0.8;
    const t2 = at + (power >= 0.5 ? 0.08 : 0.6);
    this.hiss({ at: t2, dur: 2.2 + power, type: 'lowpass', f0: 300, f1: 45, vol: 0.006 + power * 0.04, a: power >= 0.5 ? 0.06 : 0.4, pan: pan - 0.5, pan1: pan + 0.5 });
    this.voice({ at: t2, f: 38, to: 30, glide: 2, vol: 0.006 + power * 0.04, r: 1.8 + power, a: 0.12 });
  }

  /** The curse strikes: something enormous settling, and a gong. level 0..3 scales it. */
  stinger(level: number): void {
    if (!this.ctx) return;
    const at = this.t;
    this.boom(at, 0.2, 40);
    this.gong(at, 44 + level * 3, 0.05 + level * 0.01, 0, 2.4);
  }

  /** A pyramid sends its thread of gold: one low string, higher with each one. */
  templeCall(i: number): void {
    if (!this.ctx) return;
    this.oud(this.t, [45, 48, 52, 57, 60][Math.min(4, i)], 0.2, (i - 1) * 0.3, 1.5);
  }

  /** A doorway of the corridor rushes past: a push of air, on one side then the other. */
  doorPass(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.doorSide = -this.doorSide;
    this.hiss({ at, dur: 0.22, type: 'bandpass', f0: 260, f1: 620, q: 0.8, vol: 0.05, a: 0.04, pan: this.doorSide * 0.7, pan1: -this.doorSide * 0.7 });
    this.voice({ at, f: 74, to: 42, glide: 0.12, vol: 0.09, r: 0.15, a: 0.006, pan: this.doorSide * 0.3 });
  }

  /** The last free spin waits for its press: the heart of the temple, twice. */
  lastSpin(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.gong(at, midi(33), 0.03, 0, 2.4);
    this.doum(at, 0.6, this.sfx);
    this.doum(at + 0.3, 0.42, this.sfx);
  }

  /** A strain catches in the bar of the panel: two strings. */
  strainIgnite(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.oud(at, 59, 0.16, -0.1, 1.2);
    this.oud(at + 0.09, 64, 0.14, 0.1, 1.4);
  }

  /** The gold of a win reaches the bonus total: one soft bowl. */
  gainLand(): void {
    if (!this.ctx) return;
    this.bowl(this.t, midi(69), 0.05, 0.2, 0.6);
  }

  /** A new record: the strings climb, and rest. */
  record(): void {
    if (!this.ctx) return;
    const at = this.t;
    [52, 56, 59, 64].forEach((n, i) => this.oud(at + i * 0.1, n, 0.18, (i - 1.5) * 0.15, i === 3 ? 2 : 0.9));
  }

  /** One tooth of the strain drum going by: a small wooden catch. */
  drumTick(progress: number): void {
    if (!this.ctx) return;
    this.voice({ at: this.t, f: 300 + Math.min(1, Math.max(0, progress)) * 70, to: 210, glide: 0.02, vol: 0.075, r: 0.035, a: 0.002 });
  }

  /** The drum locks on the strain: a gong, and the strings going up the scale. */
  strainLock(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.gong(at, midi(33), 0.05, 0, 3);
    [52, 53, 56, 57, 59].forEach((n, i) => this.oud(at + 0.08 + i * 0.09, n, 0.16, (i - 2) * 0.15, i === 4 ? 2 : 0.8));
  }

  featureStart(): void {
    if (!this.ctx) return;
    const at = this.t;
    this.stinger(1);
    [52, 53, 56, 57, 59, 64].forEach((n, i) => this.oud(at + 0.4 + i * 0.1, n, 0.16, (i - 2.5) * 0.14, i === 5 ? 2 : 0.9));
  }
}
