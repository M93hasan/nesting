import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const layers = ['domain', 'application', 'infrastructure'];
const forbidden = {
  domain: new Set(['application', 'infrastructure', 'workers', 'components', 'storage', 'import', 'export']),
  application: new Set(['infrastructure', 'workers', 'components', 'storage', 'import', 'export']),
  infrastructure: new Set(['presentation', 'components']),
};
const failures = [];

function visit(directory) {
  return readdirSync(directory).flatMap(name => {
    const file = join(directory, name);
    return statSync(file).isDirectory() ? visit(file) : /\.tsx?$/.test(name) ? [file] : [];
  });
}

for (const layer of layers) {
  const directory = join(root, layer);
  for (const file of visit(directory)) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier === 'react' || specifier.startsWith('react/') || specifier === 'react-dom') {
        failures.push(`${relative(root, file)}: React dependency in ${layer} layer`);
      }
      if (!specifier.startsWith('.')) continue;
      const target = relative(root, resolve(file, '..', specifier));
      const targetLayer = target.split(/[\\/]/)[0];
      if (forbidden[layer].has(targetLayer)
        || (layer === 'infrastructure' && /^(App|AuthGate)(?:\\.|$)/.test(target))) {
        failures.push(`${relative(root, file)}: forbidden ${layer} -> ${targetLayer} dependency`);
      }
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Clean Architecture dependency boundaries passed.');
