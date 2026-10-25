import { playRound } from '../src/math/engine';
import { SeededRng } from '../src/math/rng';

const N = Number(process.argv[2] ?? 2_000_000);
const seed = Number(process.argv[3] ?? 12345);
const rng = new SeededRng(seed);
const bet = 1;

let wagered = 0;
let returned = 0;
let baseReturn = 0;
let featureReturn = 0;
let hits = 0;
let features = 0;
let retriggers = 0;
let maxWin = 0;
let capped = 0;
let sumSq = 0;
const buckets = [0, 1, 5, 15, 40, 100, 500, 1000, 5000];
const bucketCounts = new Array(buckets.length).fill(0);

for (let i = 0; i < N; i++) {
  const r = playRound(rng, bet);
  wagered += bet;
  returned += r.totalWin;
  baseReturn += r.base.win;
  sumSq += r.totalWin * r.totalWin;
  if (r.totalWin > 0) hits++;
  if (r.feature) {
    features++;
    featureReturn += r.feature.win;
    retriggers += r.feature.spins.filter((s) => s.retrigger).length;
  }
  if (r.capped) capped++;
  if (r.totalWin > maxWin) maxWin = r.totalWin;
  for (let b = buckets.length - 1; b >= 0; b--) {
    if (r.totalWin >= buckets[b] && r.totalWin > 0) {
      bucketCounts[b]++;
      break;
    }
  }
}

const rtp = returned / wagered;
const mean = returned / N;
const sd = Math.sqrt(sumSq / N - mean * mean);
const pct = (x: number) => (x * 100).toFixed(3) + '%';

console.log(`Spins            ${N.toLocaleString()}`);
console.log(`RTP              ${pct(rtp)}  (±${pct((1.96 * sd) / Math.sqrt(N))} @95%)`);
console.log(`  base game      ${pct(baseReturn / wagered)}`);
console.log(`  free spins     ${pct(featureReturn / wagered)}`);
console.log(`Hit frequency    ${pct(hits / N)}  (1 in ${(N / hits).toFixed(2)})`);
console.log(`Feature trigger  1 in ${(N / Math.max(1, features)).toFixed(1)}`);
console.log(`Avg feature win  ${(featureReturn / Math.max(1, features)).toFixed(2)}x`);
console.log(`Retrigger rate   ${pct(retriggers / Math.max(1, features))} per feature`);
console.log(`Std deviation    ${sd.toFixed(2)}  (volatility index @90% ${(1.65 * sd).toFixed(2)})`);
console.log(`Max win          ${maxWin.toFixed(2)}x   capped rounds: ${capped}`);
console.log('Win distribution (x bet):');
buckets.forEach((b, i) => {
  const next = buckets[i + 1];
  const label = next ? `${b}–${next}x` : `${b}x+`;
  const freq = bucketCounts[i] ? `1 in ${(N / bucketCounts[i]).toFixed(1)}` : '—';
  console.log(`  ${label.padEnd(12)} ${freq}`);
});
