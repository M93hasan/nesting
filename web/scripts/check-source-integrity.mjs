import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const root = join(webRoot, 'src');
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

const pkg = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(webRoot, 'package-lock.json'), 'utf8'));
const expectedVersion = String(pkg.version);
const lockVersions = [String(lock.version || ''), String(lock.packages?.['']?.version || '')];
for (const value of lockVersions) {
  if (value !== expectedVersion) failures.push(`package-lock version "${value}" does not match package.json "${expectedVersion}"`);
}
const readme = readFileSync(join(webRoot, '..', 'README.md'), 'utf8');
const expectedBadge = `version-${expectedVersion}-`;
const expectedReadmeVersion = `v${expectedVersion}`;
if (!readme.includes(expectedBadge)) failures.push(`README version badge does not match package.json "${expectedVersion}"`);
if (!readme.includes(expectedReadmeVersion)) failures.push(`README current version does not match package.json "${expectedVersion}"`);

for (const workerPath of [join(webRoot, 'worker', 'serula-worker.js'), join(webRoot, 'worker', 'index.js')]) {
  const source = readFileSync(workerPath, 'utf8');
  const marker = source.match(/Build marker:\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] || '';
  if (marker !== expectedVersion) failures.push(`${workerPath}: build marker "${marker}" does not match package.json "${expectedVersion}"`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Source integrity check passed. Version ${expectedVersion} is synchronized.`);
