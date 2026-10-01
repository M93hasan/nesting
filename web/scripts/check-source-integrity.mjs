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
const version = String(pkg.version || '');
if (!/^\d+\.\d+\.\d+$/.test(version)) failures.push(`package.json version "${version}" is invalid`);

for (const workerPath of [join(webRoot, 'worker', 'serula-worker.js'), join(webRoot, 'worker', 'index.js')]) {
  const source = readFileSync(workerPath, 'utf8');
  if (!source.includes("import packageInfo from '../package.json';"))
    failures.push(`${workerPath}: version must be imported from package.json`);
  if (!source.includes('const APP_VERSION=String(packageInfo.version);'))
    failures.push(`${workerPath}: APP_VERSION must come from package.json`);
  if (/const APP_VERSION=['"][0-9]/.test(source) || /Build marker:\s*[0-9]/.test(source))
    failures.push(`${workerPath}: hard-coded version found`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Source integrity check passed. Single version source: package.json (${version}).`);
