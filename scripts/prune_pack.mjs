import fs from 'node:fs';
import { recognizeSign, SENSITIVITY, signThreshold } from '../src/lib/personalClassifier.js';

const [, , outPath, ...inputs] = process.argv;
const MIN_SIGN_ACCURACY = Number(process.env.MIN_SIGN_ACCURACY ?? 0.7);
const MAX_WRONG = Number(process.env.MAX_WRONG ?? 0.12);

if (!outPath || inputs.length === 0) {
  console.error('Usage: node scripts/prune_pack.mjs <out.json> <pack.json> [more packs...]');
  process.exit(1);
}

const packs = inputs.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const byId = new Map();
for (const pack of packs) for (const sign of pack.signs) byId.set(sign.id, sign);
let signs = [...byId.values()];

function evaluate(list) {
  const train = [];
  const test = [];
  for (const sign of list) {
    const cut = Math.floor(sign.examples.length * 0.7);
    const examples = sign.examples.slice(0, cut);
    train.push({ id: sign.id, examples, threshold: signThreshold(examples) });
    for (const feature of sign.examples.slice(cut)) test.push({ id: sign.id, feature });
  }
  const per = Object.fromEntries(list.map((s) => [s.id, { ok: 0, n: 0 }]));
  let correct = 0;
  let wrong = 0;
  for (const t of test) {
    const result = recognizeSign(t.feature, train, [], SENSITIVITY.normal);
    per[t.id].n += 1;
    if (result.id === t.id) {
      correct += 1;
      per[t.id].ok += 1;
    } else if (result.id) {
      wrong += 1;
    }
  }
  const accuracy = Object.fromEntries(Object.entries(per).map(([id, v]) => [id, v.n ? v.ok / v.n : 0]));
  return { correct: correct / test.length, wrong: wrong / test.length, accuracy };
}

let report = evaluate(signs);
console.log(`start: ${signs.length} signs, correct ${(report.correct * 100).toFixed(0)}%, wrong ${(report.wrong * 100).toFixed(0)}%`);
while (signs.length > 1) {
  const [worstId, worstAccuracy] = Object.entries(report.accuracy).sort((a, b) => a[1] - b[1])[0];
  if (worstAccuracy >= MIN_SIGN_ACCURACY && report.wrong <= MAX_WRONG) break;
  signs = signs.filter((s) => s.id !== worstId);
  console.log(`dropped ${worstId.replace('asl-', '')} (${(worstAccuracy * 100).toFixed(0)}%)`);
  report = evaluate(signs);
}

console.log(`kept: ${signs.length} signs, correct ${(report.correct * 100).toFixed(0)}%, wrong ${(report.wrong * 100).toFixed(0)}%`);
console.log(Object.entries(report.accuracy).map(([id, a]) => `${id.replace('asl-', '')} ${(a * 100).toFixed(0)}%`).join(', '));
fs.writeFileSync(outPath, JSON.stringify({ ...packs[0], signs }));
