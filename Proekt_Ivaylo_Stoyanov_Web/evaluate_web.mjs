import {readFileSync, writeFileSync} from 'node:fs';
import {features, classify} from './dist/model.mjs';

const read = path => readFileSync(new URL(path, import.meta.url));
const classes = JSON.parse(read('./dist/classes.json'));
const training = read('./dist/training.bin');
const index = new Map(classes.map((item, i) => [item.id, i]));
const matrix = classes.map(() => classes.map(() => 0));
let total = 0;
for (const row of read('./data.csv').toString().trim().split(/\r?\n/)) {
  const [split, expected, grid] = row.split(',');
  if (split !== 'test') continue;
  const [best] = classify(features(Uint8Array.from(grid, Number)), training, classes.length);
  matrix[index.get(expected)][best.index]++;
  total++;
}
const correct = matrix.reduce((sum, row, i) => sum + row[i], 0);
const report = {correct, total, matrix};
if (process.argv.includes('--write')) {
  writeFileSync(new URL('./dist/evaluation.json', import.meta.url), JSON.stringify(report));
}
console.log(`Точност — ${(100 * correct / total).toFixed(1)}% (${correct}/${total})`);
matrix.forEach((row, i) => {
  console.log(classes[i].glyph, row.join(' '));
});
