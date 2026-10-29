import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/900.css';
import { ICONS as PAINTED } from './game/art/icons';
import { downsample } from './game/art/paint';
import { paintRoyal } from './game/art/royals';
import { Audio } from './game/Audio';

/** Dev-only: renders the painted premium symbols large and at reel size. ?only=blood to focus one. */
async function run(): Promise<void> {
  await Promise.all([document.fonts.load('400 64px "Luckiest Guy"'), document.fonts.load('900 64px Nunito')]);
  const out = document.getElementById('out')!;
  const only = new URLSearchParams(location.search).get('only');
  if (only === 'temple3d') {
    const { renderTemple3D } = await import('./game/art/temple3d');
    const params = new URLSearchParams(location.search);
    const scale = Number(params.get('scale') ?? 4 / 3);
    const states = (params.get('states') ?? 'night,infected').split(',') as ('night' | 'infected')[];
    const w = window as unknown as Record<string, unknown>;
    for (const st of states) {
      const t0 = performance.now();
      const { canvas, marks } = await renderTemple3D(st, scale);
      w['t3d_' + st] = canvas.toDataURL('image/png');
      w['t3d_marks'] = marks;
      w['t3d_ms_' + st] = performance.now() - t0;
    }
    document.body.dataset.ready = '1';
    return;
  }
  if (only === 'audio') {
    // render every sound offline, report levels and draw a spectrogram for each
    const tests: [string, (a: Audio) => void, number][] = [
      ['click', (a) => a.click(), 0.5],
      ['spinStart+stops', (a) => { a.spinStart(); }, 3],
      ['reelStop', (a) => a.reelStop(2), 1],
      ['codex 1', (a) => a.codex(1), 3.5],
      ['codex 3', (a) => a.codex(3), 3.5],
      ['anticipation', (a) => a.anticipation(1.6), 2.5],
      ['win 0', (a) => a.win(0), 2],
      ['win 3', (a) => a.win(3), 3.5],
      ['tick', (a) => a.tick(), 0.4],
      ['expand', (a) => a.expand(), 2],
      ['lightning 1', (a) => a.lightning(1), 4],
      ['lightning .3', (a) => a.lightning(0.3), 4],
      ['coins 20', (a) => a.coins(20), 1.5],
      ['impact', (a) => a.impact(1.2), 3],
      ['riser', (a) => a.riser(3), 3.5],
      ['tierUp 3', (a) => a.tierUp(3), 3],
      ['roll 3s', (a) => a.timpaniRoll(3), 4],
      ['win 1', (a) => a.win(1), 3],
      ['tick .8', (a) => a.tick(0.8), 0.5],
      ['stinger 0', (a) => a.stinger(0), 3],
      ['stinger 3', (a) => a.stinger(3), 3.5],
      ['featureStart', (a) => a.featureStart(), 4.5],
    ];
    const report: Record<string, { peak: number; rms: number; nan: boolean }> = {};
    for (const [name, fn, secs] of tests) {
      const sr = 22050;
      const off = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
      const a = new Audio();
      a.attach(off);
      // trigger 0.1 s in, like in the live game where the mix graph is already running
      void off.suspend(0.1).then(() => {
        fn(a);
        void off.resume();
      });
      const buf = await off.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0;
      let sum = 0;
      let nan = false;
      for (const v of d) {
        if (Number.isNaN(v)) nan = true;
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      report[name] = { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), nan };
      // spectrogram: time → x, log frequency → y
      const W = 360;
      const H = 120;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d')!;
      const img = ctx.createImageData(W, H);
      const N = 512;
      for (let x = 0; x < W; x++) {
        const start = Math.floor((x / W) * (d.length - N));
        for (let y = 0; y < H; y++) {
          const freq = 40 * Math.pow(10000 / 40, 1 - y / H);
          let re = 0;
          let im = 0;
          for (let k = 0; k < N; k += 2) {
            const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N);
            const ph = (2 * Math.PI * freq * k) / sr;
            re += d[start + k] * w * Math.cos(ph);
            im += d[start + k] * w * Math.sin(ph);
          }
          const mag = Math.sqrt(re * re + im * im) / 64;
          const v = Math.max(0, Math.min(1, (Math.log10(mag + 1e-5) + 4) / 4));
          const i = (y * W + x) * 4;
          img.data[i] = 255 * Math.min(1, v * 1.6);
          img.data[i + 1] = 255 * Math.max(0, v * 1.6 - 0.6);
          img.data[i + 2] = 255 * Math.max(0, 0.6 - v);
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.append(c, document.createElement('br'), `${name} · pic ${report[name].peak} · rms ${report[name].rms}`);
      out.append(cell);
    }
    (window as unknown as { audioReport: unknown }).audioReport = report;
    document.body.dataset.ready = '1';
    return;
  }
  if (only === 'royals') {
    for (const key of ['a', 'k', 'q', 'j', 'ten']) {
      const big = paintRoyal(key);
      big.style.width = '256px';
      const sm = downsample(big, 320);
      sm.style.width = sm.style.height = '150px';
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.append(big, sm);
      out.append(cell);
    }
    document.body.dataset.ready = '1';
    return;
  }
  for (const [key, fn] of Object.entries(PAINTED)) {
    if (only && only !== key) continue;
    const s = fn();
    const big = document.createElement('div');
    big.className = 'cell';
    const full = s.base;
    const ctx = full.getContext('2d')!;
    for (const [name, p] of Object.entries(s.parts)) if (name !== 'lid') ctx.drawImage(p, 0, 0);
    big.append(full);
    const small = document.createElement('div');
    small.className = 'cell';
    const sm = downsample(full, 320);
    sm.style.width = sm.style.height = '150px';
    small.append(sm, document.createElement('br'), key);
    out.append(big, small);
  }
  document.body.dataset.ready = '1';
}
void run();
