import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url);
const forbidden = [
  'classAd','setŞekil','setŞekilWidth','setŞekilHeight','addŞekil','addParçalar',
  'defaultExampleİptalled','setGenişlik','setYükseklik','toSabit','materialGenişlik',
  'selectedParçalar','Otomatikally','istendiAt'
];

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const failures = [];
for (const path of files(root)) {
  const source = readFileSync(path, 'utf8');
  for (const token of forbidden) if (source.includes(token)) failures.push(`${path}: forbidden accidental identifier/text "${token}"`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Source integrity check passed.');
